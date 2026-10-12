// Pipe into `docker compose exec -T game node --input-type=module` on a fresh local/CI stack.
import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base='http://127.0.0.1:8080',origin=new URL(process.env.PUBLIC_URL).origin;
const post=(path,body,cookie)=>fetch(base+path,{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
assert.ok((await fetch(base+'/health')).ok);
const root=await fetch(base+'/');assert.ok(root.ok);assert.match(root.headers.get('content-security-policy'),/frame-ancestors 'none'/);
const r=await post('/api/signup',{username:'docker'+Date.now().toString(36),password:'docker-test-passphrase',dob:'1995-01-01',agree:true});
assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0],user=await r.json();assert.ok(user.ok&&!user.token);
const ws=new WebSocket(base.replace('http','ws')+'/ws',{headers:{origin,cookie}});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Socket timed out')),15000);ws.on('error',reject);ws.on('message',raw=>{const m=JSON.parse(raw);if(m.t==='welcome'){assert.equal(m.dev,false);clearTimeout(timer);resolve();}});});
const closed=new Promise(resolve=>ws.once('close',resolve));assert.ok((await post('/api/logout',{},cookie)).ok);assert.equal(await closed,4003);
assert.equal((await fetch(base+'/assets/models/accra-female-player.glb')).status,200);
console.log('PASS Docker HTTP, model assets, production cookies, authenticated WebSocket and logout');
