import * as Game from './game/rules.js';
process.on('uncaughtException', (e) => console.error('[uncaught]', e && e.stack || e)); process.on('unhandledRejection', (e) => console.error('[unhandled]', e && e.stack || e));
// HTTP + WebSocket entry point (uWebSockets.js). One process = one Accra shard.
import uWS from 'uWebSockets.js';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { CFG } from './config.js';
import { migrate, topWorth } from './db.js';
import * as Ads from './ads.js';
import { migrateGist } from './gist.js';
import * as Social from './social.js';
import { signup, login, check } from './auth.js';
import { Shard } from './shard.js';
import { Bus } from './bus.js';

for (let i = 1; ; i++) { try { await migrate(); await Ads.migrateAds(); await migrateGist(); await Social.migrateSocial(); break; } catch (e) { console.error(`[db] not ready (${e.code || e.message}), retry ${i} in 3s`); await new Promise((r) => setTimeout(r, 3000)); } }
let shard;
const bus = new Bus(CFG.shardId, (ch, m) => shard && shard.fromBus(ch, m));
shard = new Shard(bus);
Ads.setTopupHook((ref, amt) => Social.topupPaid(ref, amt, shard));
setInterval(() => bus.heartbeat(shard.online), 5000);

const BOT_KEY = process.env.BOT_KEY || '';
const STATIC = process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : null;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };

function readJson(res, cb, max = 16384) {
  let buf = Buffer.alloc(0); let aborted = false;
  res.onAborted(() => { aborted = true; });
  res.onData((chunk, last) => { buf = Buffer.concat([buf, Buffer.from(chunk)]); if (buf.length > max) { aborted = true; res.cork(() => res.writeStatus('413').end()); return; } if (last && !aborted) { let j = null; try { j = JSON.parse(buf.toString() || '{}'); } catch {} cb(j || {}, () => aborted); } });
}
function json(res, isAborted, obj, status = '200 OK') { if (isAborted()) return; res.cork(() => { res.writeStatus(status).writeHeader('content-type', 'application/json').writeHeader('access-control-allow-origin', '*').end(JSON.stringify(obj)); }); }
// naive per-IP rate limit for auth endpoints
const hits = new Map(); setInterval(() => hits.clear(), 60000);
const limited = (ip) => { const n = (hits.get(ip) || 0) + 1; hits.set(ip, n); return n > 20; };

const app = uWS.App();
let lag = 0; { let t = performance.now(); setInterval(() => { const n = performance.now(); lag = Math.max(0, n - t - 500) * 0.3 + lag * 0.7; t = n; }, 500); }
app.get('/health', (res) => res.end(JSON.stringify({ ok: true, shard: CFG.shardId, online: shard.online, tickMs: shard.stats.slowMs || 0, lagMs: Math.round(lag), rooms: shard.rooms.size, outKB: Math.round(shard.stats.outBytes / 1024), mem: Math.round(process.memoryUsage().rss / 1048576) })));
let CATALOG = null; app.get('/api/data', (res) => { CATALOG ||= JSON.stringify(Game.catalog()); res.cork(() => res.writeHeader('content-type', 'application/json').writeHeader('cache-control', 'public, max-age=300').end(CATALOG)); });
app.get('/api/stats', (res) => { let ab = false; res.onAborted(() => (ab = true)); bus.shards().then((s) => json(res, () => ab, { shards: s, here: shard.online, stats: shard.stats })); });
app.get('/api/board', (res) => { let ab = false; res.onAborted(() => (ab = true)); topWorth(50).then((rows) => json(res, () => ab, { rows })).catch(() => json(res, () => ab, { rows: [] })); });
for (const [route, fn] of [['/api/signup', signup], ['/api/login', login]]) {
  app.options(route, (res) => res.writeHeader('access-control-allow-origin', '*').writeHeader('access-control-allow-headers', 'content-type').end());
  app.post(route, (res, req) => {
    const ip = Buffer.from(res.getRemoteAddressAsText()).toString();
    readJson(res, async (body, isAborted) => {
      if (limited(ip)) return json(res, isAborted, { error: 'Too many attempts. Wait a minute.' }, '429 Too Many Requests');
      try { json(res, isAborted, await fn(body)); } catch (e) { console.error(e); json(res, isAborted, { error: 'Server error' }, '500 Internal Server Error'); }
    });
  });
}
// ---- paid billboards ----
const qs = (req) => new URLSearchParams(req.getQuery() || '');
const adHits = new Map(); setInterval(() => adHits.clear(), 3600000);
app.get('/api/billboards', (res) => { let ab = false; res.onAborted(() => (ab = true)); Ads.listSlots().then((s) => json(res, () => ab, { slots: s })).catch(() => json(res, () => ab, { slots: [] })); });
app.post('/api/ads', (res, req) => { const ip = Buffer.from(res.getRemoteAddressAsText()).toString();
  readJson(res, async (b, isAborted) => { const n = (adHits.get(ip) || 0) + 1; adHits.set(ip, n); if (n > 10) return json(res, isAborted, { error: 'Too many submissions. Try later.' }, '429 Too Many Requests');
    try { json(res, isAborted, await Ads.createOrder(b)); } catch (e) { console.error('[ads]', e); json(res, isAborted, { error: 'Server error' }, '500 Internal Server Error'); } }, 6 * 1024 * 1024); });
app.get('/api/ads/verify', (res, req) => { const ref = qs(req).get('ref'); let ab = false; res.onAborted(() => (ab = true)); Ads.verify(ref).then((r) => json(res, () => ab, r)).catch(() => json(res, () => ab, { error: 'verify failed' })); });
app.post('/api/paystack/webhook', (res, req) => { const sig = req.getHeader('x-paystack-signature'); let buf = Buffer.alloc(0), ab = false; res.onAborted(() => (ab = true));
  res.onData((c, last) => { buf = Buffer.concat([buf, Buffer.from(c)]); if (buf.length > 65536) { ab = true; return; } if (last && !ab) Ads.webhook(buf, sig).then((ok) => { if (!ab) res.cork(() => res.writeStatus(ok ? '200 OK' : '401 Unauthorized').end()); }).catch(() => { if (!ab) res.cork(() => res.writeStatus('500').end()); }); }); });
app.get('/api/admin/ads', (res, req) => { const k = req.getHeader('x-admin-key'); let ab = false; res.onAborted(() => (ab = true)); Ads.adminList(k).then((r) => json(res, () => ab, r, r.error ? '403 Forbidden' : '200 OK')); });
app.post('/api/admin/ads', (res, req) => { const k = req.getHeader('x-admin-key'); readJson(res, async (b, isAborted) => { const r = await Ads.adminAct(k, b); json(res, isAborted, r, r.error === 'forbidden' ? '403 Forbidden' : '200 OK'); }); });
app.get('/api/topup/verify', (res, req) => { const ref = qs(req).get('ref'); let ab = false; res.onAborted(() => (ab = true)); Social.topupVerify(ref, shard).then((r) => json(res, () => ab, r)).catch(() => json(res, () => ab, { error: 'verify failed' })); });
app.get('/api/packs', (res) => res.cork(() => res.writeHeader('content-type', 'application/json').end(JSON.stringify({ packs: Social.PACKS, cap: Social.TOPUP_WEEK_CAP, live: !!process.env.PAYSTACK_SECRET }))));
app.get('/ads/:id', (res, req) => { const f = Ads.adImagePath(parseInt(req.getParameter(0), 10)); if (!f) return res.writeStatus('404').end(); res.writeHeader('content-type', 'image/jpeg').writeHeader('cache-control', 'public, max-age=86400').end(fs.readFileSync(f)); });

app.ws('/ws', {
  compression: uWS.SHARED_COMPRESSOR, maxPayloadLength: 4096, idleTimeout: 60, maxBackpressure: 1024 * 1024,
  upgrade: (res, req, ctx) => {
    const q = new URLSearchParams(req.getQuery() || '');
    const key = req.getHeader('sec-websocket-key'), proto = req.getHeader('sec-websocket-protocol'), ext = req.getHeader('sec-websocket-extensions');
    let acct = check(q.get('token'));
    if (!acct && BOT_KEY && q.get('bot') === BOT_KEY) acct = { id: -(1 + Math.floor(Math.random() * 1e9)), u: 'bot' + Math.floor(Math.random() * 1e5), bot: true };
    if (!acct) { res.writeStatus('401 Unauthorized').end(); return; }
    res.upgrade({ acct, p: null, q: [] }, key, proto, ext, ctx);
  },
  open: async (ws) => {
    const d = ws.getUserData(); d.open = true;
    let r; try { r = await shard.join(ws, d.acct); } catch (e) { console.error('[join]', e.message); if (d.open) ws.end(4002, 'retry'); return; }
    if (!d.open) { if (r.p) shard.leave(r.p); return; }
    if (r.error) { ws.send(JSON.stringify({ t: 'full', m: r.error })); ws.end(4001, 'full'); return; }
    d.p = r.p; for (const m of d.q) handle(ws, m.data, m.bin); d.q = null;
  },
  message: (ws, data, isBinary) => { const d = ws.getUserData(); if (!d.p) { if (d.q && d.q.length < 20) d.q.push({ data: data.slice(0), bin: isBinary }); return; } handle(ws, data, isBinary); },
  close: (ws) => { const d = ws.getUserData(); d.open = false; if (d.p) shard.leave(d.p); },
});
function handle(ws, data, isBinary) {
  const p = ws.getUserData().p; if (!p) return;
  if (isBinary) shard.onBinary(p, data);
  else { let m = null; try { m = JSON.parse(Buffer.from(data).toString()); } catch {} shard.onJson(p, m); }
}
const CACHE = new Map(), GZ = new Map(); let cacheBytes = 0; // in-memory static cache (put a CDN in front in production)
if (STATIC) {
  app.get('/*', (res, req) => {
    let url = req.getUrl(); if (url === '/' || !path.extname(url)) url = '/index.html';
    const f = path.join(STATIC, path.normalize(url).replace(/^(\.\.[/\\])+/, ''));
    if (!f.startsWith(STATIC) || !fs.existsSync(f)) { res.writeStatus('404').end('not found'); return; }
    let body = CACHE.get(f); if (!body) { body = fs.readFileSync(f); if (cacheBytes + body.length < 256 * 1024 * 1024) { CACHE.set(f, body); cacheBytes += body.length; } }
    const ext = path.extname(f); if (/^\.(js|css|json|svg|html|webmanifest)$/.test(ext) && /gzip/.test(req.getHeader('accept-encoding')) && body.length > 1024) { let gz = GZ.get(f); if (!gz) { gz = zlib.gzipSync(body, { level: 9 }); GZ.set(f, gz); } body = gz; res.writeHeader('content-encoding', 'gzip').writeHeader('vary', 'accept-encoding'); }
    res.writeHeader('content-type', MIME[ext] || 'application/octet-stream').writeHeader('cache-control', /\/assets\/(index-|.*\.(glb|jpg|png|hdr))/.test(url) ? 'public, max-age=31536000, immutable' : url.startsWith('/map/') ? 'public, max-age=3600' : 'no-cache').end(body);
  });
}
app.listen(CFG.port, (ok) => console.log(ok ? `[awd] ${CFG.shardId} listening on :${CFG.port}` : 'listen failed'));
process.on('SIGTERM', async () => { await shard.flush().catch(() => {}); process.exit(0); });
