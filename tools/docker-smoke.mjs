// Pipe into `docker compose exec -T game node --input-type=module` on a fresh local/CI stack.
import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base=process.env.SMOKE_BASE||'http://127.0.0.1:8080',origin=new URL(process.env.PUBLIC_URL).origin;
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname),'Disposable local stack only');
const post=(path,body,cookie)=>fetch(base+path,{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
assert.ok((await fetch(base+'/health')).ok);
const root=await fetch(base+'/');assert.ok(root.ok);assert.match(root.headers.get('content-security-policy'),/frame-ancestors 'none'/);
const r=await post('/api/signup',{username:'docker'+Date.now().toString(36),password:'docker-test-passphrase',dob:'1995-01-01',agree:true});
assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0],user=await r.json();assert.ok(user.ok&&!user.token);
const ws=new WebSocket(base.replace('http','ws')+'/ws',{headers:{origin,cookie}});
let state=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Socket timed out')),15000);ws.on('error',reject);ws.on('message',raw=>{const m=JSON.parse(raw);if(m.t==='welcome'){assert.equal(m.dev,false);clearTimeout(timer);resolve(m.state);}});});
let serial=0;
const setup=(op,fields={})=>new Promise((resolve,reject)=>{
  const id='docker-setup-'+(++serial),timer=setTimeout(()=>{ws.off('message',reply);reject(Error('Checkpoint timed out'));},15000);
  function reply(raw){const m=JSON.parse(raw);if(m.t!=='onboarding'||m.id!==id)return;clearTimeout(timer);ws.off('message',reply);state=m.state;resolve(m);}
  ws.on('message',reply);ws.send(JSON.stringify({t:'onboarding',id,op,revision:state.onboarding?.revision||0,...fields}));
});
const assigned=state.birthOrigin;
for(const [op,fields] of [['begin',{}],['character',{name:user.username,look:{body:'f',bust:.8},traits:['hustler','highlife']}],['roll',{}],['homes',{}]])assert.ok((await setup(op,fields)).ok);
assert.ok((await setup('roll',{revision:0,birthOrigin:'forged'})).ok);assert.equal(state.birthOrigin,assigned);assert.equal(state.cash+state.momo,0);
assert.equal((await setup('home',{home:'invalid_home'})).ok,false);
assert.ok((await setup('home',{home:assigned==='dbee'?'osu':'nima'})).ok);
const room=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Home room missing')),15000);function receive(raw){const m=JSON.parse(raw);if(m.t==='room'){clearTimeout(timer);ws.off('message',receive);resolve(m);}}ws.on('message',receive);});
assert.ok((await setup('finish')).complete);assert.equal((await room).place,'home');
const savings=assigned==='dbee'?25000:800;assert.equal(state.cash+state.momo,savings);assert.equal(state.look.bust,.8);
assert.ok((await setup('finish',{revision:0})).complete);assert.equal(state.cash+state.momo,savings);
const closed=new Promise(resolve=>ws.once('close',resolve));assert.ok((await post('/api/logout',{},cookie)).ok);assert.equal(await closed,4003);
assert.equal((await fetch(base+'/assets/models/accra-female-player.glb')).status,200);
console.log('PASS Docker HTTP, model assets, production cookies, saved onboarding, lottery, eligible home room, duplicate completion and logout');
