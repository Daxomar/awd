// Stage 11: administrator sessions, separate from game sessions. A staff member signs in with their game account
// password, but only an active admin_users row grants a session; it lasts at most 8 hours and ends after 30 idle minutes.
import crypto from 'node:crypto';
import {pool} from '../db.js';
import {CFG} from '../config.js';
import {verifyPassword, hashPassword} from '../auth.js';
import {permsOf, isRole, ROLES} from './roles.js';

export const ABSOLUTE_MS = 8 * 3600000, IDLE_MS = 30 * 60000;
export const ADMIN_COOKIE = CFG.secureCookies ? '__Host-awd_admin' : 'awd_admin';
const USER_RE = /^[a-zA-Z0-9_]{3,16}$/, TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const digest = t => crypto.createHash('sha256').update(t).digest('hex');
const dummy = hashPassword('dummy-admin-password', Buffer.alloc(16, 9));
export const LOGIN_ERROR = 'Wrong username or password, or this account has no administrator access.';

export function adminCookie(key, expires) {
  const age = key ? Math.max(0, Math.floor((expires - Date.now()) / 1000)) : 0;
  return `${ADMIN_COOKIE}=${key || ''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${CFG.secureCookies ? '; Secure' : ''}`;
}
export function adminToken(header = '') {
  const v = header.split(';').map(s => s.trim()).find(s => s.startsWith(ADMIN_COOKIE + '='))?.slice(ADMIN_COOKIE.length + 1);
  return TOKEN_RE.test(v || '') ? v : null;
}
// The CSRF token is bound to the session (HMAC of its hash), so it needs no storage and dies with the session.
export const csrfFor = hash => crypto.createHmac('sha256', CFG.secret).update('admin-csrf:' + hash).digest('base64url');
export function sessionLive(row, now = Date.now()) {
  return !!row && +new Date(row.expires_at) > now && +new Date(row.last_seen) > now - IDLE_MS;
}
const view = r => ({acct: r.acct, name: r.username, role: r.role, roleName: ROLES[r.role]?.name || r.role, perms: permsOf(r.role)});

export async function adminLogin({username, password} = {}) {
  if (typeof username !== 'string' || !USER_RE.test(username) || typeof password !== 'string' || password.length > 128) return {error: LOGIN_ERROR};
  const r = (await pool.query(`select a.id as acct, a.username, a.pass, u.role from accounts a join admin_users u on u.acct = a.id
    where lower(a.username) = lower($1) and u.active and not a.banned and (a.suspended_until is null or a.suspended_until < now()) order by a.id limit 1`, [username])).rows[0];
  const ok = await verifyPassword(password, r?.pass || await dummy);
  if (!r || !ok || !isRole(r.role)) return {error: LOGIN_ERROR};
  const key = crypto.randomBytes(32).toString('base64url'), hash = digest(key), expires = Date.now() + ABSOLUTE_MS;
  await pool.query('insert into admin_sessions(token_hash, acct, expires_at) values($1, $2, $3)', [hash, r.acct, new Date(expires)]);
  await pool.query(`delete from admin_sessions where acct = $1 and token_hash in
    (select token_hash from admin_sessions where acct = $1 order by created_at desc offset 3)`, [r.acct]);
  return {sessionKey: key, expires, admin: view(r), csrf: csrfFor(hash)};
}
export async function adminAuth(token) {
  if (!TOKEN_RE.test(token || '')) return null;
  const hash = digest(token);
  const r = (await pool.query(`select s.expires_at, s.last_seen, u.acct, u.role, a.username from admin_sessions s
    join admin_users u on u.acct = s.acct join accounts a on a.id = s.acct
    where s.token_hash = $1 and u.active and not a.banned and (a.suspended_until is null or a.suspended_until < now())`, [hash])).rows[0];
  if (!sessionLive(r) || !isRole(r.role)) return null;
  await pool.query('update admin_sessions set last_seen = now() where token_hash = $1', [hash]);
  return {...view(r), sessionHash: hash, csrf: csrfFor(hash), expires: +new Date(r.expires_at)};
}
export async function adminLogout(token) {
  if (TOKEN_RE.test(token || '')) await pool.query('delete from admin_sessions where token_hash = $1', [digest(token)]);
}
// Sensitive operations ask for the administrator's password again.
export async function reauth(admin, password) {
  if (typeof password !== 'string' || !password || password.length > 128) return false;
  const stored = (await pool.query('select pass from accounts where id = $1', [admin.acct])).rows[0]?.pass;
  return verifyPassword(password, stored || await dummy);
}
export async function endSessionsOf(acct) {
  await pool.query('delete from admin_sessions where acct = $1', [acct]);
}
