import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from './db.js';
import { CFG } from './config.js';
import { safeEqual } from './security.js';
const scrypt = promisify(crypto.scrypt), USER_RE = /^[a-zA-Z0-9_]{3,16}$/, SESSION_MS = 7 * 86400000;
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
export function passwordError(password, username = '') {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128 || Buffer.byteLength(password) > 512) return 'Use a password of 12–128 characters.';
  if (/^(password\d*|123456\d*|qwerty\d*|letmein\d*|accrawedey\d*|111111\d*)$/i.test(password) || (username && password.toLowerCase() === username.toLowerCase())) return 'Choose a less predictable password.';
  return null;
}
export function adultDob(value, now = new Date()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(+d) || d.toISOString().slice(0,10) !== value) return false;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) age--;
  return age >= 18 && age <= 120;
}
export async function hashPassword(password, salt = crypto.randomBytes(16), cost = 32768) {
  const key = await scrypt(password, salt, 32, { N: cost, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${cost}$${salt.toString('hex')}$${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || typeof password !== 'string' || password.length > 128) return false;
  let salt, key, cost;
  if (/^[0-9a-f]{32}:[0-9a-f]{64}$/.test(stored)) { [salt,key] = stored.split(':'); cost = 16384; }
  else { const m = /^scrypt\$(16384|32768)\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(stored); if (!m) return false; [,cost,salt,key] = m; cost = +cost; }
  const actual = await hashPassword(password, Buffer.from(salt,'hex'), cost);
  return safeEqual(actual.split('$').at(-1), key);
}
// Signed URL tokens are restricted to development automation.
export function sign(payload) { const body = Buffer.from(JSON.stringify(payload)).toString('base64url'); return body + '.' + crypto.createHmac('sha256', CFG.secret).update(body).digest('base64url'); }
export function check(token) {
  if (!CFG.dev || typeof token !== 'string' || token.length > 512) return null;
  const parts = token.split('.'); if (parts.length !== 2) return null;
  const [body, mac] = parts;
  if (!safeEqual(mac, crypto.createHmac('sha256', CFG.secret).update(body).digest('base64url'))) return null;
  try { const p = JSON.parse(Buffer.from(body,'base64url').toString()); return Number.isInteger(p.id) && p.id > 0 && USER_RE.test(p.u) && Number.isFinite(p.exp) && p.exp > Date.now() ? p : null; } catch { return null; }
}
async function issueSession(db, account) {
  const sessionKey = crypto.randomBytes(32).toString('base64url'), expiry = Date.now() + SESSION_MS;
  await db.query('insert into sessions(token_hash,account,expires_at) values($1,$2,$3)', [digest(sessionKey),account.id,new Date(expiry)]);
  await db.query('delete from sessions where account=$1 and token_hash in (select token_hash from sessions where account=$1 order by created_at desc offset 5)',[account.id]);
  return {id:account.id,username:account.username,sessionKey,expiry,...(CFG.dev ? {token:sign({id:account.id,u:account.username,exp:expiry})} : {})};
}
export async function signup(body) {
  const {username,password,dob,agree} = body || {};
  if (typeof username !== 'string' || !USER_RE.test(username)) return {error:'Username: 3–16 letters, numbers or _'};
  const error = passwordError(password,username); if (error) return {error};
  if (!adultDob(dob) || agree !== true) return {error:'Confirm that you are 18 or older and accept the terms.'};
  const pass = await hashPassword(password), db = await pool.connect();
  try {
    await db.query('begin');
    await db.query('select pg_advisory_xact_lock(hashtext($1))',[username.toLowerCase()]);
    if ((await db.query('select 1 from accounts where lower(username)=lower($1)',[username])).rowCount) { await db.query('rollback'); return {error:'That username is unavailable.'}; }
    // Store an adult attestation rather than a full date of birth.
    const a = (await db.query('insert into accounts(username,pass,adult_verified) values($1,$2,true) returning id,username',[username,pass])).rows[0];
    const result = await issueSession(db,a); await db.query('commit'); return result;
  } catch (e) { await db.query('rollback'); if (e.code === '23505') return {error:'That username is unavailable.'}; throw e; } finally { db.release(); }
}
const dummy = hashPassword('dummy-account-password', Buffer.alloc(16, 7));
export async function login({username,password} = {}) {
  if (typeof username !== 'string' || !USER_RE.test(username) || typeof password !== 'string' || password.length > 128 || Buffer.byteLength(password) > 512) return {error:'Wrong username or password.'};
  const a = (await pool.query('select id,username,pass,banned,suspended_until from accounts where lower(username)=lower($1) order by id limit 1',[username])).rows[0];
  const matches = await verifyPassword(password, a?.pass || await dummy);
  if (!a || !matches || a.banned) return {error:'Wrong username or password.'};
  // Stage 11: only someone who knows the password learns that the account is suspended, and until when.
  if (a.suspended_until && +new Date(a.suspended_until) > Date.now()) return {error:`This account is suspended until ${new Date(a.suspended_until).toUTCString()}.`};
  const db = await pool.connect();
  try {
    await db.query('begin');
    const locked = (await db.query('select pass,banned from accounts where id=$1 for update',[a.id])).rows[0];
    if (locked.banned || locked.pass !== a.pass) { await db.query('rollback'); return {error:'Wrong username or password.'}; }
    if (!a.pass.startsWith('scrypt$32768$')) await db.query('update accounts set pass=$2 where id=$1',[a.id,await hashPassword(password)]);
    const result = await issueSession(db,a); await db.query('commit'); return result;
  } catch (e) { await db.query('rollback'); throw e; } finally { db.release(); }
}
export function cookieToken(header = '') {
  const value = header.split(';').map(s => s.trim()).find(s => s.startsWith(CFG.cookieName + '='))?.slice(CFG.cookieName.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value || '') ? value : null;
}
export function sessionCookie(key, expiry) {
  return `${CFG.cookieName}=${key || ''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${key ? Math.max(0,Math.floor((expiry-Date.now())/1000)) : 0}${CFG.secureCookies ? '; Secure' : ''}`;
}
export async function authenticate(token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) return null;
  const a = (await pool.query(`select a.id,a.username as u,s.expires_at from sessions s join accounts a on a.id=s.account
    where s.token_hash=$1 and s.expires_at>now() and s.last_seen>now()-interval '24 hours' and not a.banned
    and (a.suspended_until is null or a.suspended_until<now())`,[digest(token)])).rows[0];
  if (!a) return null;
  await pool.query("update sessions set last_seen=now() where token_hash=$1 and last_seen<now()-interval '5 minutes'",[digest(token)]);
  return {id:a.id,u:a.u,exp:+new Date(a.expires_at),sessionHash:digest(token)};
}
export async function revoke(token, all = false) {
  const acct = await authenticate(token); if (!acct) return null;
  await pool.query(all ? 'delete from sessions where account=$1' : 'delete from sessions where token_hash=$1',[all ? acct.id : acct.sessionHash]); return acct;
}
export async function changePassword(token, {currentPassword,password} = {}) {
  const a = await authenticate(token); if (!a) return {error:'Please log in again.'};
  const error = passwordError(password,a.u); if (error) return {error};
  if (typeof currentPassword !== 'string' || currentPassword.length > 128) return {error:'Current password is incorrect.'};
  const stored = (await pool.query('select pass from accounts where id=$1',[a.id])).rows[0]?.pass;
  if (!await verifyPassword(currentPassword,stored)) return {error:'Current password is incorrect.'};
  const pass = await hashPassword(password), db = await pool.connect();
  try {
    await db.query('begin');
    const r = await db.query('update accounts set pass=$3 where id=$1 and pass=$2',[a.id,stored,pass]);
    if (!r.rowCount) { await db.query('rollback'); return {error:'Password changed elsewhere. Please log in again.'}; }
    await db.query('delete from sessions where account=$1',[a.id]); await db.query('commit'); return {ok:true,account:a.id};
  } catch (e) { await db.query('rollback'); throw e; } finally { db.release(); }
}
