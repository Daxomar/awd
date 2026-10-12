import * as Game from './game/rules.js';
// A compromised/inconsistent process must restart, rather than keep serving.
const fatal=e=>{console.error('[fatal]',e?.code||e?.name||'Unexpected failure');process.exit(1);};
process.on('uncaughtException',fatal);process.on('unhandledRejection',fatal);
// HTTP + WebSocket entry point (uWebSockets.js). One process = one Accra shard.
import uWS from 'uWebSockets.js';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { CFG } from './config.js';
import { migrate, topWorth, pool } from './db.js';
import * as Ads from './ads.js';
import { migrateGist } from './gist.js';
import * as Social from './social.js';
import { signup, login, check, authenticate, cookieToken, sessionCookie, revoke, changePassword } from './auth.js';
import { securityHeaders, inlineScriptHashes, staticPath, allowedOrigin, clientIp, RateLimiter, parseMessage, takeMessage } from './security.js';
import { Shard } from './shard.js';
import { Bus } from './bus.js';

for (let i = 1; ; i++) { try { await migrate(); await Ads.migrateAds(); await migrateGist(); await Social.migrateSocial(); break; } catch (e) { console.error(`[db] not ready (${e.code || e.message}), retry ${i} in 3s`); await new Promise((r) => setTimeout(r, 3000)); } }
let shard;
const bus = new Bus(CFG.shardId, (ch, m) => shard && shard.fromBus(ch, m));
shard = new Shard(bus);
Ads.setTopupHook((ref, amt) => Social.topupPaid(ref, amt, shard));
setInterval(() => bus.heartbeat(shard.online), 5000);

const BOT_KEY = CFG.dev ? process.env.BOT_KEY || '' : '';
const limiter = new RateLimiter(bus.pub);
const STATIC = process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : null;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };

function readJson(res, cb, max = 16384) {
  let buf = Buffer.alloc(0); let aborted = false;
  res.onAborted(() => { aborted = true; });
  res.onData((chunk, last) => {
    if (aborted) return;
    if (buf.length + chunk.byteLength > max) { aborted = true; buf = null; res.cork(() => securityHeaders(res.writeStatus('413 Payload Too Large')).end()); return; }
    buf = Buffer.concat([buf, Buffer.from(chunk)]);
    if (last) {
      let j; try { j = JSON.parse(buf.toString()); } catch {}
      if (!j || Array.isArray(j) || typeof j !== 'object') return json(res, () => aborted, {error:'Invalid JSON object.'}, '400 Bad Request');
      Promise.resolve(cb(j, () => aborted)).catch(e => { console.error('[http]', e.code || 'request failed'); json(res, () => aborted, {error:'Service temporarily unavailable.'}, '503 Service Unavailable'); });
    }
  });
}
function json(res, isAborted, obj, status = '200 OK', headers={}) { if (isAborted()) return; res.cork(() => { res.writeStatus(status);for(const [k,v] of Object.entries(headers))res.writeHeader(k,v);securityHeaders(res).writeHeader('content-type', 'application/json').writeHeader('cache-control','no-store').end(JSON.stringify(obj)); }); }
function mutationAllowed(res, req) {
  if (!allowedOrigin(req.getHeader('origin'))) { json(res, () => false, {error:'Request origin is not allowed.'}, '403 Forbidden'); return false; }
  if (!(req.getHeader('content-type') || '').toLowerCase().startsWith('application/json')) { json(res, () => false, {error:'Use application/json.'}, '415 Unsupported Media Type'); return false; }
  return true;
}
async function allow(res, aborted, category, identity, max, seconds) {
  if (await limiter.take(category, identity, max, seconds)) return !aborted();
  json(res, aborted, {error:'Too many requests. Try again later.'}, '429 Too Many Requests', {'retry-after':String(seconds)}); return false;
}
function disconnectAccount(id, sessionHash) {
  const p = shard.byAcct(id);
  if (p && (!sessionHash || p.ws.getUserData().acct.sessionHash === sessionHash)) p.ws.end(4003, 'Session ended');
  bus.publish('awd:session', {id,sessionHash});
}
setInterval(() => pool.query("delete from sessions where expires_at<now() or last_seen<now()-interval '24 hours'").catch(e => console.error('[session cleanup]',e.code)), 3600000).unref();

const app = uWS.App();
let lag = 0; { let t = performance.now(); setInterval(() => { const n = performance.now(); lag = Math.max(0, n - t - 500) * 0.3 + lag * 0.7; t = n; }, 500); }
app.get('/health', (res) => {let ab=false;res.onAborted(()=>{ab=true;});pool.query('select 1').then(()=>{const ok=!CFG.production||bus.pub.status==='ready';json(res,()=>ab,{ok},ok?'200 OK':'503 Service Unavailable');}).catch(()=>json(res,()=>ab,{ok:false},'503 Service Unavailable'));});
let CATALOG = null; app.get('/api/data', (res) => { CATALOG ||= JSON.stringify(Game.catalog()); res.cork(() => res.writeHeader('content-type', 'application/json').writeHeader('cache-control', 'public, max-age=300').end(CATALOG)); });
function limitedRead(route, factory, max=120, seconds=60, category=route){
  app.get(route,(res,req)=>{
    const action=factory(req),ip=clientIp(res,req);let aborted=false;res.onAborted(()=>{aborted=true;});
    (async()=>{if(await allow(res,()=>aborted,category,ip,max,seconds))json(res,()=>aborted,await action());})()
      .catch(()=>json(res,()=>aborted,{error:'Service unavailable.'},'503 Service Unavailable'));
  });
}
limitedRead('/api/stats',()=>async()=>({shards:await bus.shards(),here:shard.online}));
limitedRead('/api/board',()=>async()=>({rows:await topWorth(50)}));
let authActive = 0;
for (const [route, fn] of [['/api/signup', signup], ['/api/login', login]]) {
  app.post(route, (res, req) => {
    if (!mutationAllowed(res,req)) return;
    const ip = clientIp(res,req);
    readJson(res, async (body, isAborted) => {
      if (!await allow(res,isAborted,'auth-ip',ip,20,60)) return;
      if (!await allow(res,isAborted,'auth-user',String(body.username || '').slice(0,16).toLowerCase(),10,900)) return;
      if (route === '/api/signup' && !await allow(res,isAborted,'signup',ip,CFG.dev ? 100 : 5,3600)) return;
      if (authActive >= 4) return json(res,isAborted,{error:'Login service is busy. Try again shortly.'},'503 Service Unavailable');
      authActive++;
      try {
        const result = await fn(body), {sessionKey,expiry,...publicResult} = result;
        if (!isAborted() && sessionKey) res.cork(() => res.writeHeader('set-cookie',sessionCookie(sessionKey,expiry)));
        json(res,isAborted,{...publicResult,...(sessionKey ? {ok:true} : {})}, result.error ? '400 Bad Request' : '200 OK');
      } finally { authActive--; }
    });
  });
}
app.get('/api/session',(res,req) => {
  const token = cookieToken(req.getHeader('cookie')),ip=clientIp(res,req); let ab=false; res.onAborted(()=>{ab=true;});
  (async()=>{if(!await allow(res,()=>ab,'session',ip,120,60))return;const a=await authenticate(token);json(res,()=>ab,{authenticated:!!a,...(a?{id:a.id,username:a.u}:{}),...(CFG.dev?{dev:true}:{})});})().catch(()=>json(res,()=>ab,{error:'Service unavailable.'},'503 Service Unavailable'));
});
for (const route of ['/api/logout','/api/logout-all','/api/password']) app.post(route,(res,req)=>{
  if (!mutationAllowed(res,req)) return;
  const token=cookieToken(req.getHeader('cookie')), ip=clientIp(res,req);
  readJson(res,async(body,ab)=>{
    if (!await allow(res,ab,'account-security',ip,10,900)) return;
    if(route==='/api/password') {
      if(authActive>=4)return json(res,ab,{error:'Login service is busy. Try again shortly.'},'503 Service Unavailable');
      authActive++;
      try{
        const result=await changePassword(token,body);
        if(result.ok) disconnectAccount(result.account);
        if(!ab()&&result.ok) res.cork(()=>res.writeHeader('set-cookie',sessionCookie('',0)));
        return json(res,ab,result.error?{error:result.error}:{ok:true},result.error?'400 Bad Request':'200 OK');
      }finally{authActive--;}
    }
    const a=await revoke(token,route==='/api/logout-all');
    if(a) disconnectAccount(a.id,route==='/api/logout-all'?null:a.sessionHash);
    if(!ab()) res.cork(()=>res.writeHeader('set-cookie',sessionCookie('',0)));
    json(res,ab,{ok:true});
  });
});
// ---- paid billboards ----
const qs = (req) => new URLSearchParams(req.getQuery() || '');
let adsActive=0;
limitedRead('/api/billboards',()=>async()=>({slots:await Ads.listSlots()}));
app.post('/api/ads', (res, req) => { if(!mutationAllowed(res,req))return; const ip = clientIp(res,req);
  readJson(res, async (b, isAborted) => { if(!await allow(res,isAborted,'ads',ip,5,3600))return;
    if(adsActive>=2)return json(res,isAborted,{error:'Artwork processing is busy. Try again shortly.'},'503 Service Unavailable');
    adsActive++;
    try { json(res, isAborted, await Ads.createOrder(b)); } catch (e) { console.error('[ads]', e.code||'request failed'); json(res, isAborted, { error: 'Server error' }, '500 Internal Server Error'); }finally{adsActive--;} }, 6 * 1024 * 1024); });
limitedRead('/api/ads/verify',req=>{const ref=qs(req).get('ref');return()=>Ads.verify(ref);},10,60,'payment-verify');
app.post('/api/paystack/webhook', (res, req) => { const sig = req.getHeader('x-paystack-signature'); let buf = Buffer.alloc(0), ab = false; res.onAborted(() => (ab = true));
  res.onData((c, last) => { if(ab)return; if(buf.length+c.byteLength>65536){ab=true;buf=null;res.cork(()=>securityHeaders(res.writeStatus('413 Payload Too Large')).end());return;} buf=Buffer.concat([buf,Buffer.from(c)]); if(last) Ads.webhook(buf,sig).then(ok=>{if(!ab)res.cork(()=>securityHeaders(res.writeStatus(ok?'200 OK':'401 Unauthorized')).end());}).catch(()=>{if(!ab)res.cork(()=>res.writeStatus('503 Service Unavailable').end());}); }); });
app.get('/api/admin/ads', (res, req) => { const k = req.getHeader('x-admin-key'),ip=clientIp(res,req); let ab = false; res.onAborted(() => (ab = true)); (async()=>{if(!await allow(res,()=>ab,'admin',ip,10,60))return;const r=await Ads.adminList(k);json(res,()=>ab,r,r.error?'403 Forbidden':'200 OK');})().catch(()=>json(res,()=>ab,{error:'Service unavailable.'},'503 Service Unavailable')); });
app.post('/api/admin/ads', (res, req) => { if(!mutationAllowed(res,req))return; const k = req.getHeader('x-admin-key'),ip=clientIp(res,req); readJson(res, async (b, isAborted) => { if(!await allow(res,isAborted,'admin',ip,10,60))return; const r = await Ads.adminAct(k, b); json(res, isAborted, r, r.error === 'forbidden' ? '403 Forbidden' : '200 OK'); }); });
limitedRead('/api/topup/verify',req=>{const ref=qs(req).get('ref');return()=>Social.topupVerify(ref,shard);},10,60,'payment-verify');
app.get('/api/packs', (res) => res.cork(() => securityHeaders(res).writeHeader('content-type', 'application/json').end(JSON.stringify({ packs: Social.PACKS, cap: Social.TOPUP_WEEK_CAP, live: Social.paymentsLive }))));
app.get('/ads/:id',(res,req)=>{
  const id=Number(req.getParameter(0).replace(/\.jpg$/,'')),key=req.getHeader('x-admin-key');let ab=false;res.onAborted(()=>{ab=true;});
  Ads.adImagePath(id,key).then(f=>{if(ab)return;res.cork(()=>{if(!f){res.writeStatus('404 Not Found');securityHeaders(res).end();return;}securityHeaders(res).writeHeader('content-type','image/jpeg').writeHeader('cache-control',key?'private, no-store':'public, max-age=300').writeHeader('vary','x-admin-key').end(fs.readFileSync(f));});})
    .catch(()=>{if(!ab)res.cork(()=>res.writeStatus('503 Service Unavailable').end());});
});

app.ws('/ws', {
  compression: uWS.SHARED_COMPRESSOR, maxPayloadLength: 4096, idleTimeout: 60, maxBackpressure: 1024 * 1024,
  upgrade: async (res, req, ctx) => {
    const q = new URLSearchParams(req.getQuery() || '');
    const key = req.getHeader('sec-websocket-key'), proto = req.getHeader('sec-websocket-protocol'), ext = req.getHeader('sec-websocket-extensions');
    const origin=req.getHeader('origin'), sessionToken=cookieToken(req.getHeader('cookie')),ip=clientIp(res,req);
    if(!allowedOrigin(origin))return res.writeStatus('403 Forbidden').end();
    let aborted=false;res.onAborted(()=>{aborted=true;});
    try {
      if(!await allow(res,()=>aborted,'ws-connect',ip,CFG.dev?300:30,60))return;
      let acct=await authenticate(sessionToken);
      if(!acct&&CFG.dev) {
        acct=check(q.get('token'));
        if(acct){const a=(await pool.query('select username,banned from accounts where id=$1',[acct.id])).rows[0];if(!a||a.banned)acct=null;else acct.u=a.username;}
        if(!acct&&BOT_KEY&&q.get('bot')===BOT_KEY)acct={id:-(1+Math.floor(Math.random()*1e9)),u:'bot'+Math.floor(Math.random()*1e5),bot:true};
      }
      if(aborted)return;
      if(!acct)return res.cork(()=>securityHeaders(res.writeStatus('401 Unauthorized')).end());
      res.cork(()=>res.upgrade({acct,sessionToken,p:null,q:[],bucket:{},invalid:0},key,proto,ext,ctx));
    } catch { if(!aborted)res.cork(()=>res.writeStatus('503 Service Unavailable').end()); }
  },
  open: async (ws) => {
    const d = ws.getUserData(); d.open = true;
    let r; try { r = await shard.join(ws, d.acct); } catch (e) { console.error('[join]', e.message); if (d.open) ws.end(4002, 'retry'); return; }
    if (!d.open) { if (r.p) shard.leave(r.p); return; }
    if (r.error) { ws.send(JSON.stringify({ t: 'full', m: r.error })); ws.end(4001, 'full'); return; }
    d.p = r.p; for (const m of d.q) handle(ws, m.data, m.bin); d.q = null;
    d.sessionTimer=setInterval(async()=>{
      if(d.checking||!d.open)return;d.checking=true;
      try { if(!d.acct.bot) {const a=d.sessionToken?await authenticate(d.sessionToken):(d.acct.exp>Date.now()&&(await pool.query('select id from accounts where id=$1 and not banned',[d.acct.id])).rows[0]);if(!a&&d.open)ws.end(4003,'Session expired');} }
      catch { if(d.open)ws.end(4003,'Session unavailable'); }
      finally {d.checking=false;}
    },30000);
  },
  message: (ws, data, isBinary) => { const d = ws.getUserData(); if(!takeMessage(d.bucket))return ws.end(4008,'Message limit exceeded'); if (!d.p) { if (d.q && d.q.length < 20) d.q.push({ data: data.slice(0), bin: isBinary }); return; } handle(ws, data, isBinary); },
  close: (ws) => { const d = ws.getUserData(); d.open = false; clearInterval(d.sessionTimer); if (d.p) shard.leave(d.p); },
});
function handle(ws, data, isBinary) {
  const d=ws.getUserData(),p=d.p;if(!p)return;
  const m=isBinary?null:parseMessage(Buffer.from(data).toString());
  if(!m){if(++d.invalid>=3)ws.end(4008,'Invalid message');return;}
  if(!['ping','rmv','emote','chat'].includes(m.t)&&!takeMessage(d.dbBucket||=( {} ),Date.now(),12,4))return shard.send(p,{t:'toast',m:'Too many actions. Give it a moment.',k:'bad'});
  try { Promise.resolve(shard.onJson(p,m)).catch(e=>shard.fault(p,'request',e)); } catch(e){shard.fault(p,'request',e);}
}
const CACHE = new Map(), GZ = new Map(); let cacheBytes = 0; // in-memory static cache (put a CDN in front in production)
if (STATIC) {
  app.get('/*', (res, req) => {
    let url = req.getUrl();
    if(url!=='/'&&!staticPath(STATIC,url)){res.writeStatus('404 Not Found');securityHeaders(res).end('not found');return;}
    if (url === '/' || !path.extname(url)) url = '/index.html';
    const f = staticPath(STATIC,url);
    if (!f || !fs.existsSync(f) || !fs.statSync(f).isFile()) { securityHeaders(res.writeStatus('404 Not Found')).end('not found'); return; }
    let body = CACHE.get(f); if (!body) { body = fs.readFileSync(f); if (cacheBytes + body.length < 256 * 1024 * 1024) { CACHE.set(f, body); cacheBytes += body.length; } }
    const ext = path.extname(f); securityHeaders(res,{html:ext==='.html',scriptHashes:ext==='.html'?inlineScriptHashes(body.toString()):[]});
    if (/^\.(js|css|json|svg|html|webmanifest|glb)$/.test(ext) && /gzip/.test(req.getHeader('accept-encoding')) && body.length > 1024) { let gz = GZ.get(f); if (!gz) { gz = zlib.gzipSync(body, { level: 9 }); GZ.set(f, gz); } body = gz; res.writeHeader('content-encoding', 'gzip').writeHeader('vary', 'accept-encoding'); }
    res.writeHeader('content-type', MIME[ext] || 'application/octet-stream').writeHeader('cache-control', /\/assets\/(index-|.*\.(glb|jpg|png|hdr))/.test(url) ? 'public, max-age=31536000, immutable' : url.startsWith('/map/') ? 'public, max-age=3600' : 'no-cache').end(body);
  });
}
app.listen(CFG.port, (ok) => console.log(ok ? `[awd] ${CFG.shardId} listening on :${CFG.port}` : 'listen failed'));
async function shutdown(){
  for(const p of [...shard.players.values()]){try{p.ws.end(4003,'Server restarting');}catch{}shard.leave(p);}
  await Promise.allSettled([...shard.saves.values()]);await pool.end();bus.pub.disconnect();bus.sub.disconnect();process.exit(0);
}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
