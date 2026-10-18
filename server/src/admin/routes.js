// Stage 11: administrator HTTP API. Every protected route goes through guard(): rate limit → admin session →
// role permission (→ CSRF token for writes → password re-entry for the most sensitive operations), and both
// denials and changes are written to the append-only audit log. Hidden UI is never the protection.
import os from 'node:os';
import {pool} from '../db.js';
import {CFG} from '../config.js';
import {safeEqual} from '../security.js';
import {can, REAUTH, permsOf} from './roles.js';
import {adminLogin, adminAuth, adminLogout, adminToken, adminCookie, reauth, endSessionsOf} from './session.js';
import {audit, flagRows, changeFlag} from './store.js';
import * as M from './metrics.js';
import * as P from './players.js';
import * as Ops from './ops.js';

const LEGACY = {acct: null, name: 'legacy-key', role: 'owner', perms: permsOf('owner')};
const reasonOf = b => P.cleanReason(b.reason);

export function registerAdmin(app, deps) {
  const {shard, bus, json, readJson, mutationAllowed, allow, take, clientIp, lag, disconnectAccount, Ads, Events, Payments} = deps;
  const send = (res, ab, r) => { const {httpStatus, ...body} = r || {}; json(res, ab, body, httpStatus || (body.error ? '400 Bad Request' : '200 OK')); };
  const deny = async (res, ab, a, perm, why = 'Your role does not allow this.') => {
    await audit(pool, a, 'denied', {target: perm, outcome: 'denied'}).catch(() => {});
    json(res, ab, {error: why}, '403 Forbidden');
  };
  const online = id => !!shard.byAcct(id);
  // Fail closed: the request is recorded before the action runs; a refused or failed action adds a 'failed' entry.
  const audited = async (a, action, entry, run) => {
    await audit(pool, a, action, {...entry, outcome: 'requested'});
    const r = await run();
    if (r?.error) await audit(pool, a, action, {...entry, detail: {...(entry.detail || {}), error: String(r.error).slice(0, 120)}, outcome: 'failed'});
    return r;
  };

  // GET: query → handler(admin, query). legacyKey lets the older owner-key endpoints keep working (audited).
  function get(route, perm, handler, {legacy = null} = {}) {
    app.get(route, (res, req) => {
      const token = adminToken(req.getHeader('cookie')), key = req.getHeader('x-admin-key'), ip = clientIp(res, req);
      const q = Object.fromEntries(new URLSearchParams(req.getQuery() || ''));
      let aborted = false; res.onAborted(() => { aborted = true; }); const ab = () => aborted;
      (async () => {
        if (!await allow(res, ab, 'admin-api', ip, 240, 60)) return;
        if (key && legacy) {
          if (!await allow(res, ab, 'admin-key', ip, 10, 60)) return;
          if (!Events.adminOk(key)) { await audit(pool, {name: 'legacy-key'}, 'denied', {target: route, outcome: 'denied'}); return json(res, ab, {error: 'forbidden'}, '403 Forbidden'); }
          return send(res, ab, await legacy());
        }
        const a = await adminAuth(token);
        if (!a) return json(res, ab, {error: 'Sign in to the admin dashboard.'}, '401 Unauthorized');
        if (!can(a.role, perm)) return deny(res, ab, a, perm);
        send(res, ab, await handler(a, q));
      })().catch(e => { Ops.incident('admin-api', e?.code || e?.name); json(res, ab, {error: 'Service unavailable.'}, '503 Service Unavailable'); });
    });
  }
  // POST: permOf(body) picks the permission so one route can carry several operations with different rights.
  function post(route, permOf, handler, {legacy = null} = {}) {
    app.post(route, (res, req) => {
      if (!mutationAllowed(res, req)) return;
      const token = adminToken(req.getHeader('cookie')), key = req.getHeader('x-admin-key'), csrf = req.getHeader('x-admin-csrf'), ip = clientIp(res, req);
      readJson(res, async (b, ab) => {
        if (!await allow(res, ab, 'admin-api', ip, 240, 60)) return;
        const perm = typeof permOf === 'function' ? permOf(b) : permOf;
        if (key && legacy) {
          if (!await allow(res, ab, 'admin-key', ip, 10, 60)) return;
          if (!Events.adminOk(key)) { await audit(pool, {name: 'legacy-key'}, 'denied', {target: route, outcome: 'denied'}); return json(res, ab, {error: 'forbidden'}, '403 Forbidden'); }
          const action = `${route.split('/').pop()}.${String(b.op || b.action || 'act').slice(0, 20)}`;
          await audit(pool, LEGACY, action, {target: String(b.id || '').slice(0, 60), outcome: 'requested'});
          const r = await legacy(b);
          if (r?.error) await audit(pool, LEGACY, action, {target: String(b.id || '').slice(0, 60), outcome: 'failed'});
          return send(res, ab, r);
        }
        const a = await adminAuth(token);
        if (!a) return json(res, ab, {error: 'Sign in to the admin dashboard.'}, '401 Unauthorized');
        if (typeof csrf !== 'string' || !safeEqual(csrf, a.csrf)) return deny(res, ab, a, 'csrf', 'Security check failed. Reload the dashboard and try again.');
        if (!perm) return json(res, ab, {error: 'Unknown operation.'}, '400 Bad Request');
        if (!can(a.role, perm)) return deny(res, ab, a, perm);
        if (!await allow(res, ab, 'admin-write', a.acct, 60, 60)) return;
        if (REAUTH.has(perm) && !await reauth(a, b.password)) {
          // Repeated wrong passwords on a live session end that session, so a stolen cookie cannot guess the password.
          if (!await take('admin-reauth-fail', a.acct, 5, 900)) {
            await pool.query('delete from admin_sessions where token_hash = $1', [a.sessionHash]);
            await audit(pool, a, 'session.ended', {target: perm, outcome: 'denied', detail: {why: 'repeated wrong passwords'}});
            return json(res, ab, {error: 'Too many wrong passwords. Sign in again.'}, '401 Unauthorized');
          }
          return deny(res, ab, a, perm + ':reauth', 'Confirm this action with your password.');
        }
        send(res, ab, await handler(a, b));
      });
    });
  }

  // ---- session ----
  app.post('/api/admin/session', (res, req) => {
    if (!mutationAllowed(res, req)) return;
    const ip = clientIp(res, req);
    readJson(res, async (b, ab) => {
      const name = String(b.username || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
      if (!await allow(res, ab, 'admin-login-ip', ip, 20, 900)) return;
      if (!await allow(res, ab, 'admin-login-user-ip', name.toLowerCase() + '|' + ip, 5, 900)) return;
      if (!await allow(res, ab, 'admin-login-user', name.toLowerCase(), 30, 900)) return;
      const r = await adminLogin(b);
      if (r.error) { await audit(pool, {name: name || 'unknown'}, 'session.login', {outcome: 'denied'}); return json(res, ab, {error: r.error}, '401 Unauthorized'); }
      await audit(pool, r.admin, 'session.login');
      if (!ab()) res.cork(() => res.writeHeader('set-cookie', adminCookie(r.sessionKey, r.expires)));
      json(res, ab, {ok: true, admin: r.admin, csrf: r.csrf, expires: r.expires});
    });
  });
  get('/api/admin/session', 'overview.read', async a => ({admin: {acct: a.acct, name: a.name, role: a.role, roleName: a.roleName, perms: a.perms}, csrf: a.csrf, expires: a.expires}));
  app.post('/api/admin/logout', (res, req) => {
    if (!mutationAllowed(res, req)) return;
    const token = adminToken(req.getHeader('cookie'));
    readJson(res, async (b, ab) => {
      const a = await adminAuth(token); if (a) await audit(pool, a, 'session.logout');
      await adminLogout(token);
      if (!ab()) res.cork(() => res.writeHeader('set-cookie', adminCookie('', 0)));
      json(res, ab, {ok: true});
    });
  });

  // ---- overview, players, reports ----
  get('/api/admin/overview', 'overview.read', async () => {
    const shards = await bus.shards();
    return M.overview({online: Object.values(shards).reduce((s, n) => s + n, 0) || shard.online, shards});
  });
  get('/api/admin/players', 'players.read', async (a, q) => P.search(q, online));
  get('/api/admin/player', 'players.read', async (a, q) => P.account(a, Number(q.id), online));
  post('/api/admin/moderate', b => P.MOD_ACTIONS[b.kind], async (a, b) => P.moderate(a, b, id => disconnectAccount(id)));
  get('/api/admin/reports', 'reports.read', async (a, q) => P.reports(q));
  post('/api/admin/reports', 'reports.resolve', async (a, b) => P.resolveReport(a, b));
  get('/api/admin/suggestions', 'reports.read', async (a, q) => P.suggestions(q));
  post('/api/admin/suggestions', 'reports.resolve', async (a, b) => P.resolveSuggestion(a, b));

  // ---- economy, advertising, payments ----
  get('/api/admin/economy', 'economy.read', async (a, q) => M.economy(Number(q.days)));
  get('/api/admin/ads', 'ads.read', async (a, q) => ({...await M.adsSummary(), campaigns: await M.campaigns(q), placements: await Ads.listSlots()}),
    {legacy: () => Ads.listOrders()});
  post('/api/admin/ads', b => (b.op === 'placement' ? 'ads.placements' : 'ads.moderate'), async (a, b) => {
    const reason = reasonOf(b);
    if (reason.length < 5) return {error: 'Give a reason of at least 5 characters.'};
    if (b.op !== 'placement' && !['approve', 'suspend', 'takedown'].includes(b.action)) return {error: 'Choose approve, suspend or takedown.'};
    return audited(a, b.op === 'placement' ? 'ads.placement' : `ads.${b.action}`, {target: b.op === 'placement' ? `placement:${String(b.id).slice(0, 40)}` : `campaign:${Number(b.id)}`, reason,
      detail: b.op === 'placement' ? {paused: !!b.paused} : {}}, async () => {
      const r = b.op === 'placement' ? await Ads.setPlacementPaused(String(b.id || ''), !!b.paused) : await Ads.actOnOrder({id: Number(b.id), action: b.action}, {allowManualPayment: false});
      if (r.ok && b.op !== 'placement') shard.broadcast({t: 'ads_changed'});
      return r;
    });
  }, {legacy: b => Ads.actOnOrder(b)});
  get('/api/admin/payments', 'payments.read', async (a, q) => ({...await M.payments(q), live: Payments.live, simulated: Payments.MOCK}));
  post('/api/admin/payments', 'payments.verify', async (a, b) => {
    const ref = String(b.ref || '');
    if (!Payments.validRef(ref)) return {error: 'Invalid payment reference.'};
    const r = await audited(a, 'payments.verify', {target: `ref:${ref}`}, () => Payments.verifyPayment(ref));
    return {ok: true, result: r, live: Payments.live, note: Payments.live ? 'Checked with the payment provider.' : 'The provider is not connected; this shows the stored status only.'};
  });

  // ---- world and events ----
  get('/api/admin/events', 'events.manage', async () => Events.listEvents(), {legacy: () => Events.listEvents()});
  post('/api/admin/events', 'events.manage', async (a, b) => {
    const reason = reasonOf(b);
    if (b.op !== 'create' && reason.length < 5) return {error: 'Give a reason of at least 5 characters.'};
    return audited(a, `events.${String(b.op || '').slice(0, 20)}`, {target: b.id ? String(b.id).slice(0, 40) : null, reason: reason || null,
      detail: b.op === 'create' ? {title: String(b.spec?.title || '').slice(0, 80), kind: String(b.spec?.kind || '').slice(0, 20), venue: String(b.spec?.venue || '').slice(0, 20)} : {}},
      () => Events.actOnEvent(shard, {...b, reason}));
  }, {legacy: b => Events.actOnEvent(shard, b)});
  get('/api/admin/world', 'world.manage', async () => ({flags: await flagRows(),
    announcements: (await pool.query('select id, text, actor_name, at from admin_announcements order by at desc limit 20')).rows}));
  post('/api/admin/world', 'world.manage', async (a, b) => {
    const reason = reasonOf(b);
    if (b.op === 'flag') {
      if (reason.length < 5) return {error: 'Give a reason of at least 5 characters.'};
      const db = await pool.connect();
      try {
        await db.query('begin');
        const r = await changeFlag(db, b.key, b.enabled, Number(b.version), a.name);
        if (r.error) { await db.query('rollback'); return r; }
        await audit(db, a, 'world.flag', {target: `flag:${b.key}`, reason, detail: {enabled: b.enabled, version: r.version}});
        await db.query('commit'); await flagRows(); return r;
      } catch (e) { await db.query('rollback').catch(() => {}); throw e; } finally { db.release(); }
    }
    if (b.op === 'announce') {
      const text = String(b.text || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, 200);
      if (text.length < 5) return {error: 'Write an announcement of 5 to 200 characters.'};
      await audit(pool, a, 'world.announce', {detail: {text}});
      await pool.query('insert into admin_announcements(text, actor_name) values($1, $2)', [text, a.name]);
      const m = {t: 'toast', m: '📣 ' + text, k: 'info'};
      shard.broadcast(m); bus.publish('awd:global', m);
      return {ok: true, delivered: shard.online};
    }
    return {error: 'Unknown operation.'};
  });

  // ---- operations ----
  get('/api/admin/ops', 'ops.read', async () => {
    const t0 = performance.now(); let db = {ok: false};
    try { await pool.query('select 1'); db = {ok: true, ms: Math.round(performance.now() - t0), pool: {total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount}}; } catch (e) { db = {ok: false, code: e.code || 'unavailable'}; }
    let redis = {status: bus.pub?.status || 'disabled'};
    if (bus.pub?.status === 'ready') { const t1 = performance.now(); try { await bus.pub.ping(); redis = {...redis, ok: true, ms: Math.round(performance.now() - t1)}; } catch { redis = {...redis, ok: false}; } }
    const pay = (await pool.query(`select count(*) filter (where fulfilled_at is null and checks > 0)::int as unresolved, max(checked_at) as last_check from payment_attempts`).catch(() => ({rows: [{}]}))).rows[0];
    const mem = process.memoryUsage();
    return {shard: CFG.shardId, online: shard.online, capacity: CFG.shardCap, shards: await bus.shards(), lagMs: Math.round(lag()),
      faults: shard.stats?.faults || 0, uptimeS: Math.round(process.uptime()), memoryMb: {rss: Math.round(mem.rss / 1048576), heap: Math.round(mem.heapUsed / 1048576)},
      load: os.loadavg()[0], db, redis, payments: {...pay, provider: Payments.MOCK ? 'simulated (local QA)' : Payments.live ? 'connected' : 'not connected'}, ...Ops.snapshot()};
  });
  get('/api/admin/audit', 'audit.read', async (a, q) => P.auditLog(q));
  get('/api/admin/admins', 'admins.manage', async () => P.admins());
  post('/api/admin/admins', 'admins.manage', async (a, b) => P.setAdmin(a, b, async id => { await endSessionsOf(id); }));
}
