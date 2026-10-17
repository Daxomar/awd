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
import * as Payments from './payments.js';
import * as FirstFriend from './first-friend.js';
import * as Events from './events.js';
import * as Objectives from './objectives.js';
import * as Life from './life-service.js';
import { signup, login, check, authenticate, cookieToken, sessionCookie, revoke, changePassword } from './auth.js';
import { securityHeaders, inlineScriptHashes, staticPath, allowedOrigin, clientIp, RateLimiter, parseMessage, takeMessage } from './security.js';
import { Shard } from './shard.js';
import { Bus } from './bus.js';
import { migrateAdmin, recordConnection, touchOnline, bump, loadFlags } from './admin/store.js';
import { registerAdmin } from './admin/routes.js';
import { adminAuth, adminToken, endSessionsOf } from './admin/session.js';
import { can } from './admin/roles.js';
import * as Ops from './admin/ops.js';

for (let i = 1; ; i++) { try { await migrate(); await Ads.migrateAds(); await migrateGist(); await Social.migrateSocial(); await Payments.migratePayments();await FirstFriend.migrateFirstFriend();await Life.migrateLife();await Objectives.migrateObjectives(); await Events.migrateEvents(); await migrateAdmin(); break; } catch (e) { console.error(`[db] not ready (${e.code || e.message}), retry ${i} in 3s`); await new Promise((r) => setTimeout(r, 3000)); } }
let shard;
const bus = new Bus(CFG.shardId, (ch, m) => shard && shard.fromBus(ch, m));
shard = new Shard(bus);
shard.phase8Ready=true;
Payments.registerPayment('ad',Ads.fulfillPayment);
Payments.registerPayment('topup',Social.fulfillPayment);
Social.observeMessages(FirstFriend.reply);
let introReconciling=false;
setInterval(async()=>{if(introReconciling)return;introReconciling=true;try{await Ops.track('introduction-reconcile',()=>FirstFriend.reconcile(shard));}catch(e){console.error('[introduction reconciliation]',e.code||'deferred');}finally{introReconciling=false;}},60000).unref();
let reconciling=false;
setInterval(async()=>{if(reconciling)return;reconciling=true;try{await Ops.track('payment-reconcile',()=>Payments.reconcile());}catch(e){console.error('[payment reconciliation]',e.code||'unavailable');}finally{reconciling=false;}},60000).unref();
setInterval(() => bus.heartbeat(shard.online), 5000);
// Stage 11: feature flags changed on any shard reach this one within 10 s; long sessions still count as active today.
setInterval(()=>Ops.track('flag-refresh',loadFlags).catch(()=>{}),10000).unref();
setInterval(()=>Ops.track('activity-touch',()=>touchOnline([...shard.players.values()].filter(p=>!p.bot&&p.acct>0).map(p=>p.acct))).catch(()=>{}),600000).unref();

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
function json(res, isAborted, obj, status = '200 OK', headers={}) { if (isAborted()) return; Ops.count(status); res.cork(() => { res.writeStatus(status);for(const [k,v] of Object.entries(headers))res.writeHeader(k,v);securityHeaders(res).writeHeader('content-type', 'application/json').writeHeader('cache-control','no-store').end(JSON.stringify(obj)); }); }
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
setInterval(() => pool.query("delete from admin_sessions where expires_at<now() or last_seen<now()-interval '30 minutes'").catch(e => console.error('[admin session cleanup]',e.code)), 600000).unref();

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
        if (sessionKey) bump(route === '/api/signup' ? 'signup' : 'signin').catch(e => Ops.incident('counters', e.code));
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
        if(result.ok){disconnectAccount(result.account);await endSessionsOf(result.account);}
        if(!ab()&&result.ok) res.cork(()=>res.writeHeader('set-cookie',sessionCookie('',0)));
        return json(res,ab,result.error?{error:result.error}:{ok:true},result.error?'400 Bad Request':'200 OK');
      }finally{authActive--;}
    }
    const a=await revoke(token,route==='/api/logout-all');
    if(a) disconnectAccount(a.id,route==='/api/logout-all'?null:a.sessionHash);
    if(a&&route==='/api/logout-all') await endSessionsOf(a.id);
    if(!ab()) res.cork(()=>res.writeHeader('set-cookie',sessionCookie('',0)));
    json(res,ab,{ok:true});
  });
});
// ---- paid billboards ----
const qs = (req) => new URLSearchParams(req.getQuery() || '');
let adsActive=0;
limitedRead('/api/billboards',()=>async()=>({slots:await Ads.listSlots()}));
app.post('/api/ads', (res, req) => { if(!mutationAllowed(res,req))return; const ip = clientIp(res,req),token=cookieToken(req.getHeader('cookie'));
  readJson(res, async (b, isAborted) => { if(!await allow(res,isAborted,'ads',ip,5,3600))return;
    if(adsActive>=2)return json(res,isAborted,{error:'Artwork processing is busy. Try again shortly.'},'503 Service Unavailable');
    adsActive++;
    try { const a=await authenticate(token);if(!a)return json(res,isAborted,{error:'Sign in to the game before booking an advertisement.'},'401 Unauthorized');json(res, isAborted, await Ads.createOrder(b,a.id)); } catch (e) { console.error('[ads]', e.code||'request failed'); json(res, isAborted, { error: 'Server error' }, '500 Internal Server Error'); }finally{adsActive--;} }, 6 * 1024 * 1024); });
// Stage 10: activations reach players without a reload (bounded propagation; the client also refreshes every 5 minutes).
Ads.onActivated(slot=>shard.broadcast({t:'ads_changed',slot}));
// Local QA only (PAYSTACK_MOCK=1 on a loopback origin, no real key): a simulated checkout that sends a signed webhook
// through the same verification and fulfilment path as Paystack. Never registered on a public origin.
if(Payments.MOCK){
  console.warn('[payments] MOCK checkout enabled for local QA only');
  app.get('/mock-checkout',(res,req)=>{const ref=qs(req).get('ref')||'',tx=Payments.mockTransaction(ref);let ab=false;res.onAborted(()=>{ab=true;});
    const esc=v=>String(v).replace(/[^a-zA-Z0-9_@. -]/g,'');
    const body=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test checkout</title><style>body{font:16px system-ui;margin:0;background:#f4f6f8;color:#14212b}main{max-width:420px;margin:40px auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 8px 30px #0002}button{width:100%;min-height:48px;margin-top:12px;border:0;border-radius:10px;font:inherit;font-weight:700;background:#0aa06e;color:#fff}button.c{background:#e8ecef;color:#14212b}</style></head><body><main><h1>Test checkout</h1><p>Local QA simulation of Paystack. No real money moves.</p><p>Reference <b>${esc(ref)}</b><br>Amount GH₵${tx?(tx.amount/100).toFixed(2):'—'}<br>Receipt ${esc(tx?.email||'')}</p><button id="pay">Pay with test MoMo</button><button class="c" id="cancel">Cancel payment</button><p id="s" role="status"></p></main><script>const go=o=>fetch('/mock-checkout/pay',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ref:${JSON.stringify(ref)},outcome:o})}).then(r=>r.json()).then(r=>{if(r.callback)location.assign(r.callback);else document.getElementById('s').textContent=r.error||'Unknown reference';});document.getElementById('pay').onclick=()=>go('success');document.getElementById('cancel').onclick=()=>go('cancel');</script></body></html>`;
    if(!ab)res.cork(()=>{securityHeaders(res.writeStatus(tx?'200 OK':'404 Not Found').writeHeader('content-type','text/html; charset=utf-8'),{html:true,scriptHashes:inlineScriptHashes(body)}).end(body);});});
  app.post('/mock-checkout/pay',(res,req)=>{if(!mutationAllowed(res,req))return;readJson(res,async(b,ab)=>{
    const m=Payments.mockCharge(String(b.ref||''),b.outcome==='success'?'success':'cancel');if(!m)return json(res,ab,{error:'Unknown reference.'},'404 Not Found');
    if(m.signature)await Ads.webhook(m.raw,m.signature).catch(e=>console.error('[mock webhook]',e.message));
    json(res,ab,{callback:m.callback});});});
}
limitedRead('/api/ads/verify',req=>{const ref=qs(req).get('ref');return()=>Ads.verify(ref);},10,60,'payment-verify');
app.post('/api/paystack/webhook', (res, req) => { const sig = req.getHeader('x-paystack-signature'); let buf = Buffer.alloc(0), ab = false; res.onAborted(() => (ab = true));
  res.onData((c, last) => { if(ab)return; if(buf.length+c.byteLength>65536){ab=true;buf=null;res.cork(()=>securityHeaders(res.writeStatus('413 Payload Too Large')).end());return;} buf=Buffer.concat([buf,Buffer.from(c)]); if(last) Ads.webhook(buf,sig).then(ok=>{if(!ab)res.cork(()=>securityHeaders(res.writeStatus(ok?'200 OK':'401 Unauthorized')).end());}).catch(()=>{if(!ab)res.cork(()=>res.writeStatus('503 Service Unavailable').end());}); }); });
// Stage 11: the secure administrator API (role-checked sessions, audit log). The older owner-key calls still work, audited.
registerAdmin(app,{shard,bus,json,readJson,mutationAllowed,allow,take:(c,i,m,s)=>limiter.take(c,i,m,s),clientIp,lag:()=>lag,disconnectAccount,Ads,Events,Payments});
limitedRead('/api/topup/verify',req=>{const ref=qs(req).get('ref');return()=>Social.topupVerify(ref,shard);},10,60,'payment-verify');
app.post('/api/payment/return',(res,req)=>{
  if(!mutationAllowed(res,req))return;
  const token=cookieToken(req.getHeader('cookie')),ip=clientIp(res,req);
  readJson(res,async(b,ab)=>{
    if(!await allow(res,ab,'payment-return',ip,10,60))return;
    const a=await authenticate(token);if(!a)return json(res,ab,{error:'Sign in to resume your payment.'},'401 Unauthorized');
    const result=await Payments.paymentReturn(b.state,a.id);if(result.status==='fulfilled')shard.deliverCredit(a.id);json(res,ab,result);
  });
});
for(const route of ['/api/ads/mine','/api/ads/cancel','/api/ads/retry','/api/ads/exposure'])app.post(route,(res,req)=>{
  if(!mutationAllowed(res,req))return;
  const token=cookieToken(req.getHeader('cookie')),ip=clientIp(res,req);
  readJson(res,async(b,ab)=>{
    if(!await allow(res,ab,route,ip,route.endsWith('exposure')?60:30,60))return;
    const a=await authenticate(token);if(!a)return json(res,ab,{error:'Sign in to your account.'},'401 Unauthorized');
    if(!await allow(res,ab,route+'-account',a.id,route.endsWith('exposure')?60:30,60))return;
    if(route.endsWith('mine'))return json(res,ab,await Ads.campaigns(a.id));
    if(route.endsWith('cancel'))return json(res,ab,await Ads.cancelOrder(a.id,b.id));
    if(route.endsWith('retry'))return json(res,ab,await Ads.retryOrder(a.id,b.id));
    const p=shard.byAcct(a.id);if(!p?.state.onboarded||p.gone)return json(res,ab,{error:'Active game session required.'},'403 Forbidden');
    json(res,ab,await Ads.exposure(a.id,b));
  });
});
// Retention: day-level activity is kept about 13 months (enough for monthly and yearly comparisons), as the privacy page says.
setInterval(()=>pool.query("delete from player_activity_days where day<current_date-400").catch(e=>console.error('[activity retention]',e.code)),86400000).unref();
setInterval(()=>pool.query("delete from ad_exposures where at<now()-interval '90 days'").catch(e=>console.error('[ad retention]',e.code)),86400000).unref();
app.get('/api/packs', (res) => res.cork(() => securityHeaders(res).writeHeader('content-type', 'application/json').end(JSON.stringify({ packs: Social.PACKS, cap: Social.TOPUP_WEEK_CAP, live: Social.paymentsLive }))));
app.get('/ads/:id',(res,req)=>{
  const id=Number(req.getParameter(0).replace(/\.jpg$/,'')),key=req.getHeader('x-admin-key'),cookie=req.getHeader('cookie'),token=cookieToken(cookie),staffToken=adminToken(cookie);let ab=false;res.onAborted(()=>{ab=true;});
  // Staff with advertising access can see artwork of campaigns that are not live yet (review, suspended).
  (async()=>{const a=token?await authenticate(token):null,s=staffToken?await adminAuth(staffToken):null;return Ads.adImagePath(id,key,a?.id,!!s&&can(s.role,'ads.read'));})().then(f=>{if(ab)return;res.cork(()=>{if(!f){res.writeStatus('404 Not Found');securityHeaders(res).writeHeader('access-control-allow-origin','*').end();return;}securityHeaders(res).writeHeader('access-control-allow-origin','*').writeHeader('content-type','image/jpeg').writeHeader('cache-control','public, max-age=3600').end(fs.readFileSync(f));});})
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
    if (!d.acct.bot) recordConnection(d.acct.id).catch(e => Ops.incident('activity', e.code));
    d.sessionTimer=setInterval(async()=>{
      if(d.checking||!d.open)return;d.checking=true;
      try { if(!d.acct.bot) {const a=d.sessionToken?await authenticate(d.sessionToken):(d.acct.exp>Date.now()&&(await pool.query('select id from accounts where id=$1 and not banned and (suspended_until is null or suspended_until<now())',[d.acct.id])).rows[0]);if(!a&&d.open)ws.end(4003,'Session expired');} }
      // Disconnect on an unavailable verifier, but allow a fresh cookie-authenticated
      // connection to retry. Only a verified invalid session gets the terminal code.
      catch { if(d.open)ws.end(1013,'Session service unavailable'); }
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
    if (url.startsWith('/admin')) res.writeHeader('x-robots-tag','noindex, nofollow');
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
