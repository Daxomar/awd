// Accounts: scrypt-hashed passwords, HMAC-signed stateless session tokens.
import crypto from 'node:crypto';
import { pool } from './db.js';
import { CFG } from './config.js';

const hash = (pw, salt = crypto.randomBytes(16)) => new Promise((res, rej) => crypto.scrypt(pw, salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(salt.toString('hex') + ':' + k.toString('hex')))));
async function verify(pw, stored) { const [s, k] = stored.split(':'); const h = await hash(pw, Buffer.from(s, 'hex')); return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(stored)); }
const b64 = (s) => Buffer.from(s).toString('base64url');
export function sign(payload) { const body = b64(JSON.stringify(payload)); const mac = crypto.createHmac('sha256', CFG.secret).update(body).digest('base64url'); return body + '.' + mac; }
export function check(token) {
  if (typeof token !== 'string' || token.length > 512) return null;
  const [body, mac] = token.split('.'); if (!body || !mac) return null;
  const want = crypto.createHmac('sha256', CFG.secret).update(body).digest('base64url');
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); if (p.exp && p.exp < Date.now()) return null; return p; } catch { return null; }
}
const USER_RE = /^[a-zA-Z0-9_]{3,16}$/;
function age(dob) { const d = new Date(dob); if (isNaN(d)) return 0; const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; }
export async function signup({ username, password, dob, agree }) {
  if (!USER_RE.test(username || '')) return { error: 'Username: 3–16 letters, numbers or _' };
  if (typeof password !== 'string' || password.length < 8 || /^(12345678|password|11111111)$/i.test(password)) return { error: 'Password must be at least 8 characters (and not 12345678 )' };
  if (age(dob) < 18) return { error: 'Accra We Dey is 18+ only.' };
  if (!agree) return { error: 'Please confirm you are 18+ and accept the terms.' };
  try {
    const r = await pool.query('insert into accounts (username, pass, dob) values ($1,$2,$3) returning id', [username, await hash(password), dob]);
    const id = r.rows[0].id; return { token: sign({ id, u: username, exp: Date.now() + 30 * 86400000 }), id, username };
  } catch (e) { if (String(e.code) === '23505') return { error: 'That username is taken.' }; throw e; }
}
export async function login({ username, password }) {
  const r = await pool.query('select id, username, pass, banned from accounts where lower(username)=lower($1)', [String(username || '')]);
  const a = r.rows[0]; if (!a || !(await verify(String(password || ''), a.pass))) return { error: 'Wrong username or password.' };
  if (a.banned) return { error: 'This account is banned.' };
  return { token: sign({ id: a.id, u: a.username, exp: Date.now() + 30 * 86400000 }), id: a.id, username: a.username };
}
