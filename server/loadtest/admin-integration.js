// Stage 11 acceptance against the loopback QA server and its isolated *_security database: the administrator API
// enforces sessions, roles, CSRF/origin, password re-entry, audit, optimistic concurrency, pagination and safe errors.
// Accounts are disposable and created here with random passwords that are never printed.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
assert.notEqual(process.env.NODE_ENV, 'production', 'Do not run fixture mutation against a production environment.');
const dbUrl = new URL(process.env.DATABASE_URL || 'postgres://invalid/invalid');
assert.ok(['localhost', '127.0.0.1'].includes(dbUrl.hostname) && dbUrl.pathname.endsWith('_security'), 'Isolated local *_security database required');
const BASE = process.env.ADMIN_TEST_BASE || 'http://127.0.0.1:8083';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(BASE).hostname), 'Loopback QA server only');
const {pool} = await import('../src/db.js'), {REPORT_TARGET_SQL} = await import('../src/admin/store.js'), {hashPassword} = await import('../src/auth.js'), Game = await import('../src/game/rules.js');
const tag = Date.now().toString(36).slice(-6), checks = [];
const ok = (cond, text) => { assert.ok(cond, text); checks.push(text); console.log('PASS ' + text); };

async function account(name, role = null) {
  const password = crypto.randomBytes(18).toString('base64url');
  const id = +(await pool.query('insert into accounts(username, pass, adult_verified) values($1, $2, true) returning id', [name, await hashPassword(password)])).rows[0].id;
  const state = Game.newState({id, u: name}); state.onboarded = true;
  await pool.query('insert into players(id, state) values($1, $2)', [id, JSON.stringify(state)]);
  if (role) await pool.query('insert into admin_users(acct, role) values($1, $2)', [id, role]);
  return {id, name, password};
}
async function req(path, {method = 'GET', body, cookie = '', csrf, origin = BASE, type = 'application/json'} = {}) {
  const headers = {origin, cookie};
  if (method !== 'GET') headers['content-type'] = type;
  if (csrf) headers['x-admin-csrf'] = csrf;
  const r = await fetch(BASE + path, {method, headers, body: body ? JSON.stringify(body) : undefined});
  let data = {}; try { data = await r.json(); } catch {}
  return {status: r.status, data, setCookie: r.headers.get('set-cookie') || ''};
}
async function signIn(u) {
  const r = await req('/api/admin/session', {method: 'POST', body: {username: u.name, password: u.password}});
  const cookie = (r.setCookie.match(/awd_admin=[A-Za-z0-9_-]{43}/) || [''])[0];
  return {...r, cookie, csrf: r.data.csrf};
}
const as = s => ({get: (p) => req(p, {cookie: s.cookie}), post: (p, body, extra = {}) => req(p, {method: 'POST', body, cookie: s.cookie, csrf: s.csrf, ...extra})});
const gameLogin = u => fetch(BASE + '/api/login', {method: 'POST', headers: {origin: BASE, 'content-type': 'application/json'}, body: JSON.stringify({username: u.name, password: u.password})});

try {
  // Repeated QA runs share one IP; reset only the disposable limiter keys (Redis db 14, phase8: namespace).
  // Without Redis (CI) the server uses its in-memory limiter, which starts empty, so there is nothing to reset.
  const Redis = (await import('ioredis')).default, r14 = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379/14', {lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null});
  try {
    await r14.connect();
    const keys = await r14.keys((process.env.REDIS_NAMESPACE || 'phase8:') + 'awd:limit:*'); if (keys.length) await r14.del(...keys); await r14.quit();
  } catch { r14.disconnect(); }

  const owner = await account('ow' + tag, 'owner'), owner2 = await account('ox' + tag, 'owner'), mod = await account('mo' + tag, 'moderator');
  const support = await account('su' + tag, 'support'), finance = await account('fi' + tag, 'finance'), plain = await account('pl' + tag);
  const target = await account('tg' + tag), extra = [await account('tgx' + tag + 'a'), await account('tgx' + tag + 'b')];

  // ---- unauthenticated and ordinary-player denial ----
  ok((await req('/api/admin/overview')).status === 401, 'unauthenticated requests are refused (401)');
  ok((await req('/api/admin/moderate', {method: 'POST', body: {acct: target.id, kind: 'note', reason: 'test note'}})).status === 401, 'unauthenticated writes are refused');
  const plainLogin = await signIn(plain);
  ok(plainLogin.status === 401 && !plainLogin.cookie && /no administrator access/.test(plainLogin.data.error), 'an ordinary player with the right password gets no admin session');
  const gameCookie = ((await gameLogin(plain)).headers.get('set-cookie') || '').split(';')[0];
  ok((await req('/api/admin/overview', {cookie: gameCookie})).status === 401, 'a game session cookie does not open the admin API');

  // ---- sign-in and session ----
  const O = await signIn(owner), O2 = await signIn(owner2), Mo = await signIn(mod), Su = await signIn(support), Fi = await signIn(finance);
  ok(O.status === 200 && O.cookie && /HttpOnly/.test(O.setCookie) && /SameSite=Strict/.test(O.setCookie) && O.csrf, 'owner signs in with an HttpOnly, SameSite=Strict session and a CSRF token');
  ok((await as(O).get('/api/admin/session')).data.admin.role === 'owner', 'the session reports the role and permissions');

  // ---- role restrictions ----
  ok((await as(Su).get('/api/admin/payments')).status === 403, 'support analysts cannot open payments');
  ok((await as(Su).post('/api/admin/moderate', {acct: target.id, kind: 'suspend', hours: 1, reason: 'not allowed'})).status === 403, 'support analysts cannot suspend');
  ok((await as(Fi).post('/api/admin/moderate', {acct: target.id, kind: 'note', reason: 'finance note'})).status === 403, 'finance reviewers cannot write moderation notes');
  ok((await as(Mo).get('/api/admin/economy')).status === 403 && (await as(Mo).get('/api/admin/admins')).status === 403, 'moderators cannot see the economy or manage administrators');
  ok((await as(Fi).get('/api/admin/economy')).status === 200 && (await as(Su).get('/api/admin/players')).status === 200, 'each role reaches the sections it needs');

  // ---- CSRF and origin ----
  ok((await req('/api/admin/moderate', {method: 'POST', body: {acct: target.id, kind: 'note', reason: 'no csrf here'}, cookie: Mo.cookie})).status === 403, 'a write without the CSRF token is refused');
  ok((await as(Mo).post('/api/admin/moderate', {acct: target.id, kind: 'note', reason: 'x'}, {csrf: O.csrf})).status === 403, 'another session’s CSRF token is refused');
  ok((await as(Mo).post('/api/admin/moderate', {acct: target.id, kind: 'note', reason: 'cross site'}, {origin: 'https://evil.example'})).status === 403, 'a cross-origin write is refused');
  ok((await as(Mo).post('/api/admin/moderate', {acct: target.id, kind: 'note', reason: 'form post'}, {type: 'text/plain'})).status === 415, 'a non-JSON form post is refused');

  // ---- moderation, password re-entry, wallet untouched ----
  const wallet = async () => { const s = (await pool.query('select state from players where id=$1', [target.id])).rows[0].state; return s.cash + s.momo; };
  const before = await wallet();
  const tCookie = ((await gameLogin(target)).headers.get('set-cookie') || '').split(';')[0];
  ok((await as(Mo).post('/api/admin/moderate', {acct: target.id, kind: 'suspend', hours: 0, reason: 'spam links'})).status === 400, 'invalid suspension lengths are refused with a clear message');
  ok((await as(Mo).post('/api/admin/moderate', {acct: target.id, kind: 'suspend', hours: 2, reason: 'spam links'})).data.ok, 'a moderator suspends a player with a reason');
  const sess = await (await fetch(BASE + '/api/session', {headers: {cookie: tCookie}})).json();
  const relog = await (await gameLogin(target)).json();
  ok(!sess.authenticated && /suspended until/.test(relog.error || ''), 'the suspended player is signed out and told when the suspension ends');
  ok((await as(Mo).post('/api/admin/moderate', {acct: target.id, kind: 'ban', reason: 'repeat spam'})).status === 403, 'a ban without password re-entry is refused');
  ok((await as(Mo).post('/api/admin/moderate', {acct: target.id, kind: 'ban', reason: 'repeat spam', password: mod.password})).data.ok, 'a ban with password re-entry succeeds');
  ok((await as(Mo).post('/api/admin/moderate', {acct: owner.id, kind: 'suspend', hours: 1, reason: 'not allowed'})).status === 403, 'a moderator cannot suspend an owner');
  ok((await as(Mo).post('/api/admin/moderate', {acct: support.id, kind: 'suspend', hours: 1, reason: 'staff lockout attempt'})).status === 403, 'only an owner can suspend another staff account');
  await as(Mo).post('/api/admin/moderate', {acct: target.id, kind: 'unban', reason: 'appeal accepted', password: mod.password});
  await as(Mo).post('/api/admin/moderate', {acct: target.id, kind: 'unsuspend', reason: 'appeal accepted'});
  ok(await wallet() === before, 'moderation never changes the player’s balance');

  // ---- audit ----
  const log = (await as(O).get(`/api/admin/audit?target=acct:${target.id}`)).data.rows;
  ok(['moderation.suspend', 'moderation.ban', 'moderation.unban', 'moderation.unsuspend'].every(a => log.some(l => l.action === a && l.actor_name === mod.name && l.reason)), 'every moderation action is in the audit log with actor and reason');
  const denied = (await as(O).get(`/api/admin/audit?actor=${support.name}`)).data.rows;
  ok(denied.some(l => l.action === 'denied' && l.target === 'payments.read'), 'denied attempts are audited too');
  await assert.rejects(pool.query("update admin_audit set reason='edited' where id=(select max(id) from admin_audit)"), /append-only/);
  ok(true, 'the database refuses edits to audit records');
  ok((await as(Su).get('/api/admin/audit')).status === 403, 'only owners and operations can read the audit log');

  // ---- unauthorised financial actions ----
  ok((await as(Mo).post('/api/admin/payments', {ref: 'awd_' + '0'.repeat(20)})).status === 403, 'moderators cannot touch payment verification');
  ok((await as(Fi).post('/api/admin/payments', {ref: 'not-a-ref'})).status === 400, 'finance re-verification validates the reference');
  ok((await as(O).post('/api/admin/ads', {id: 1, action: 'markpaid', reason: 'manual mark'})).data.error, 'the dashboard cannot mark an advertising payment as paid');
  ok((await as(O).get('/api/admin/payments')).data.note.includes('Nothing here marks a payment as paid'), 'payments review is read-only apart from provider re-verification');

  // ---- concurrent admin changes ----
  const world = (await as(O).get('/api/admin/world')).data.flags.find(f => f.key === 'player_event_hosting');
  const [c1, c2] = await Promise.all([as(O).post('/api/admin/world', {op: 'flag', key: world.key, enabled: !world.enabled, version: world.version, reason: 'owner one'}),
    as(O2).post('/api/admin/world', {op: 'flag', key: world.key, enabled: !world.enabled, version: world.version, reason: 'owner two'})]);
  ok([c1.status, c2.status].sort().join() === '200,409', 'two administrators changing one flag: one wins, the other gets a conflict');
  const now = (await as(O).get('/api/admin/world')).data.flags.find(f => f.key === world.key);
  await as(O).post('/api/admin/world', {op: 'flag', key: world.key, enabled: world.enabled, version: now.version, reason: 'restore after test'});
  // Filed exactly as the game files a player report (player:ID:name), so it must link to the account.
  const rep = +(await pool.query(`insert into reports(reporter, target, text, target_acct) values($1, $2, $3, ${REPORT_TARGET_SQL}) returning id`, [plain.id, `player:${target.id}:${target.name}`, 'QA report text'])).rows[0].id;
  ok((await as(Su).get(`/api/admin/player?id=${target.id}`)).data.reports.some(x => +x.id === rep), 'a report filed in game links to the reported player');
  const [r1, r2] = await Promise.all([as(Mo).post('/api/admin/reports', {id: rep, outcome: 'dismissed', reason: 'duplicate'}), as(O).post('/api/admin/reports', {id: rep, outcome: 'actioned', reason: 'handled'})]);
  ok([r1.status, r2.status].sort().join() === '200,409', 'two administrators closing one report: one wins, the other is told it is already closed');

  // ---- pagination, filtering, safe errors ----
  const p1 = (await as(Su).get(`/api/admin/players?q=tgx${tag}&limit=1&page=1`)).data, p2 = (await as(Su).get(`/api/admin/players?q=tgx${tag}&limit=1&page=2`)).data;
  ok(p1.total === 2 && p1.rows.length === 1 && p2.rows.length === 1 && p1.rows[0].id !== p2.rows[0].id, 'player search pages correctly');
  await as(Mo).post('/api/admin/moderate', {acct: extra[0].id, kind: 'suspend', hours: 1, reason: 'filter test'});
  const sus = (await as(Su).get(`/api/admin/players?q=tgx${tag}&status=suspended`)).data;
  ok(sus.total === 1 && sus.rows[0].id === extra[0].id, 'player search filters by status');
  await as(Mo).post('/api/admin/moderate', {acct: extra[0].id, kind: 'unsuspend', reason: 'filter test done'});
  const bad = await as(Su).get('/api/admin/player?id=abc'), missing = await as(Su).get('/api/admin/player?id=999999999');
  ok(bad.status === 400 && missing.status === 404 && !/ at |stack|select /i.test(JSON.stringify([bad.data, missing.data])), 'bad input gets a plain message without internals');
  const sup = (await as(Su).get(`/api/admin/player?id=${target.id}`)).data, modView = (await as(Mo).get(`/api/admin/player?id=${target.id}`)).data;
  ok(Array.isArray(sup.money) && modView.money === undefined && !JSON.stringify(sup).includes('scrypt'), 'money journals only reach roles allowed to see them; password hashes never leave the server');

  // ---- repeated wrong passwords end the session ----
  const mz = await account('mz' + tag, 'moderator'), Mz = await signIn(mz);
  for (let i = 0; i < 6; i++) await as(Mz).post('/api/admin/moderate', {acct: extra[1].id, kind: 'ban', reason: 'guessing test', password: 'wrong-password-' + i});
  ok((await as(Mz).get('/api/admin/overview')).status === 401 && !(await pool.query('select banned from accounts where id=$1', [extra[1].id])).rows[0].banned, 'repeated wrong passwords on a sensitive action end the admin session');

  // ---- session expiry, role change, sign-out ----
  await pool.query("update admin_sessions set last_seen = now() - interval '31 minutes' where acct = $1", [support.id]);
  ok((await as(Su).get('/api/admin/overview')).status === 401, 'an idle admin session expires after 30 minutes');
  ok((await as(O).post('/api/admin/admins', {username: finance.name, role: 'support', active: true, version: 1, reason: 'role change test'})).status === 403, 'changing roles requires password re-entry');
  ok((await as(O).post('/api/admin/admins', {username: finance.name, role: 'support', active: true, version: 1, reason: 'role change test', password: owner.password})).data.ok, 'an owner changes a role with password re-entry');
  ok((await as(Fi).get('/api/admin/overview')).status === 401, 'a role change ends that administrator’s existing sessions');
  await as(Mo).post('/api/admin/logout', {});
  ok((await as(Mo).get('/api/admin/overview')).status === 401, 'signing out ends the session on the server');

  // ---- metrics are real ----
  const ov = (await as(O).get('/api/admin/overview')).data;
  ok(ov.metrics.registered >= 9 && ov.collectedSince && ov.definitions.dau && Array.isArray(ov.daily) && ov.daily.length === 14, 'overview metrics come from stored data with definitions and a collection start date');
  const ops = (await as(O).get('/api/admin/ops')).data;
  ok(ops.db.ok && typeof ops.lagMs === 'number' && ops.workers && ops.counters, 'operations shows live database, event-loop, worker and error telemetry');
  console.log(JSON.stringify({passed: checks.length}));
} finally {
  await pool.end();
}
