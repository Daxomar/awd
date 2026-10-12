// Run against a separate local *_security database and a production-mode server.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import sharp from 'sharp';
import WebSocket from 'ws';
import { pool } from '../src/db.js';
import * as Social from '../src/social.js';
import * as Game from '../src/game/rules.js';
const BASE=process.env.SECURITY_BASE||'http://127.0.0.1:8082';
const dbUrl=new URL(process.env.DATABASE_URL||'postgres://invalid');
assert.ok(dbUrl.pathname.endsWith('_security')&&['127.0.0.1','localhost'].includes(dbUrl.hostname),'Use an isolated local *_security database.');
const origin=new URL(BASE).origin,tag=Date.now().toString(36),password='test-secure-passphrase';
const post=(url,body,cookie,headers={})=>fetch(BASE+url,{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{}),...headers},body:JSON.stringify(body)});
const cookieOf=r=>r.headers.get('set-cookie')?.split(';')[0];
function connect(cookie){
  const ws=new WebSocket(BASE.replace('http','ws')+'/ws',{headers:{origin,cookie}}),queue=[],waiters=[];
  ws.on('message',raw=>{const m=JSON.parse(raw);const i=waiters.findIndex(w=>w.f(m));if(i<0)queue.push(m);else{const w=waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}});
  const wait=(f,ms=10000)=>new Promise((resolve,reject)=>{const i=queue.findIndex(f);if(i>=0)return resolve(queue.splice(i,1)[0]);const w={f,resolve};w.timer=setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(Error('Socket timed out'));},ms);waiters.push(w);});
  return {ws,wait,queue};
}
async function refused(headers={},query=''){
  return new Promise((resolve,reject)=>{const w=new WebSocket(BASE.replace('http','ws')+'/ws'+query,{headers});w.on('unexpected-response',(req,res)=>{res.resume();resolve(res.statusCode);});w.on('open',()=>{w.close();reject(Error('Unauthorized socket accepted'));});w.on('error',()=>{});});
}
const sockets=[];
try{
  let r=await post('/api/signup',{});assert.equal(r.status,400);
  r=await post('/api/signup',{username:'sa'+tag,password,dob:'1995-01-01',agree:true});assert.equal(r.status,200);
  const cookie=cookieOf(r),a=await r.json();assert.ok(a.ok&&!a.token&&!a.sessionKey);assert.match(r.headers.get('set-cookie'),/HttpOnly.*SameSite=Strict/);
  const row=(await pool.query('select pass,dob,adult_verified from accounts where id=$1',[a.id])).rows[0];assert.match(row.pass,/scrypt\$32768/);assert.equal(row.dob,null);assert.equal(row.adult_verified,true);
  r=await post('/api/signup',{username:('sa'+tag).toUpperCase(),password,dob:'1995-01-01',agree:true});assert.equal(r.status,400);
  r=await post('/api/signup',{username:'sb'+tag,password,dob:'1995-01-01',agree:true});assert.equal(r.status,200);const cookieB=cookieOf(r),b=await r.json();
  assert.equal((await post('/api/login',{username:a.username,password},{},{origin:'https://attacker.invalid'})).status,403);
  assert.equal((await post('/api/login',{username:a.username,password},null,{origin:''})).status,403);
  assert.equal((await post('/api/login',{username:a.username,password},null,{'content-type':'text/plain'})).status,415);
  assert.equal(await refused({origin}),401);assert.equal(await refused({origin:'https://attacker.invalid',cookie}),403);
  assert.equal(await refused({origin},'?token=forged'),401);
  assert.equal((await post('/api/login',{username:a.username,password:'wrong'})).status,400);
  const sidHash=crypto.createHash('sha256').update(cookie.split('=')[1]).digest('hex');
  await pool.query("update sessions set last_seen=now()-interval '25 hours' where token_hash=$1",[sidHash]);assert.equal(await refused({origin,cookie}),401);
  await pool.query('update sessions set last_seen=now() where token_hash=$1',[sidHash]);
  await pool.query('update accounts set banned=true where id=$1',[a.id]);assert.equal(await refused({origin,cookie}),401);await pool.query('update accounts set banned=false where id=$1',[a.id]);
  const c=connect(cookie);sockets.push(c.ws);const w=await c.wait(m=>m.t==='welcome');assert.equal(w.dev,false);
  c.ws.send(JSON.stringify({t:'onboard',traits:['hustler','sweetmouth'],home:w.state.birthOrigin==='dbee'?'osu':'nima'}));await c.wait(m=>m.t==='onboarded');
  const saved=(await pool.query('select state from players where id=$1',[a.id])).rows[0].state;
  saved.momo=1000;saved.flags.bornAt=Date.now()-24*3600000;
  // Direct persistence tests use a separate, disconnected player to avoid a live save overwriting test fixtures.
  c.ws.close();await new Promise(resolve=>c.ws.once('close',resolve));await new Promise(resolve=>setTimeout(resolve,300));
  await pool.query('update players set state=$2 where id=$1',[a.id,JSON.stringify(saved)]);
  const p={acct:a.id,name:a.username,state:saved,dev:false,bot:false};
  let sent=await Social.send({deliverCredit(){}},p,{to:b.username,amount:100});assert.equal(sent.ok,true);assert.equal(p.state.momo,899);
  assert.equal((await pool.query("select (state->>'momo')::int n from players where id=$1",[a.id])).rows[0].n,899);
  // Fail after the credit INSERT: neither that credit nor the debit may survive.
  const creditCount=+(await pool.query('select count(*) n from credits where from_id=$1',[a.id])).rows[0].n;
  const originalConnect=pool.connect.bind(pool);
  pool.connect=async(callback)=>{if(callback)return originalConnect(callback);const db=await originalConnect(),query=db.query.bind(db);db.query=(sql,...args)=>String(sql).startsWith('insert into ledger')?Promise.reject(Object.assign(Error('test rollback'),{code:'QA_ROLLBACK'})):query(sql,...args);const release=db.release.bind(db);db.release=()=>{db.query=query;db.release=release;release();};return db;};
  try{const rejected=await Social.send({deliverCredit(){}},p,{to:b.username,amount:100});assert.equal(rejected.ok,false);assert.equal(p.state.momo,899);}finally{pool.connect=originalConnect;}
  assert.equal(+(await pool.query('select count(*) n from credits where from_id=$1',[a.id])).rows[0].n,creditCount);
  const receiver={acct:b.id,name:b.username,state:Game.newState({id:b.id,u:b.username}),bot:false};receiver.state.onboarded=true;
  await Social.claim(receiver);assert.equal(receiver.state.momo,100);await Social.claim(receiver);assert.equal(receiver.state.momo,100);
  const req=(await pool.query("insert into dms(from_id,to_id,text,kind,amount) values($1,$2,'test','req',50) returning id",[b.id,a.id])).rows[0].id;
  sent=await Social.send({deliverCredit(){}},p,{to:b.username,amount:50,req:+req});assert.equal(sent.ok,true);const balance=p.state.momo;
  sent=await Social.send({deliverCredit(){}},p,{to:b.username,amount:50,req:+req});assert.equal(sent.ok,false);assert.equal(p.state.momo,balance);
  const ref='awt_'+crypto.randomBytes(10).toString('hex');await pool.query('insert into topups(acct,pack,ghs,coins,ref) values($1,$2,10,600,$3)',[b.id,'p10',ref]);
  const credited=await Promise.all([Social.topupPaid(ref,1000),Social.topupPaid(ref,1000)]);assert.equal(credited.filter(Boolean).length,1);
  assert.equal(await Social.topupPaid(ref,999999),false);
  r=await post('/api/login',{username:a.username,password});const otherCookie=cookieOf(r);assert.equal(r.status,200);
  r=await post('/api/password',{currentPassword:'wrong',password:'changed-password-2026'},cookie);assert.equal(r.status,400);
  r=await post('/api/password',{currentPassword:password,password:'changed-password-2026'},cookie);assert.equal(r.status,200);
  assert.equal(await refused({origin,cookie:otherCookie}),401);assert.equal(await refused({origin,cookie}),401);
  r=await post('/api/login',{username:a.username,password:'changed-password-2026'});assert.equal(r.status,200);const changed=cookieOf(r);
  const live=connect(changed);sockets.push(live.ws);await live.wait(m=>m.t==='welcome');const closed=new Promise(resolve=>live.ws.once('close',resolve));
  assert.equal((await post('/api/logout',{},changed)).status,200);assert.equal(await closed,4003);assert.equal(await refused({origin,cookie:changed}),401);
  r=await fetch(BASE+'/api/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:'[]'});assert.equal(r.status,400);
  assert.equal((await post('/api/login',{padding:'x'.repeat(20000)})).status,413);
  assert.equal((await fetch(BASE+'/api/paystack/webhook',{method:'POST',body:'x'.repeat(70000)})).status,413);
  r=await fetch(BASE+'/');assert.match(r.headers.get('content-security-policy'),/object-src 'none'/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  assert.equal((await fetch(BASE+'/%2e%2e/.env')).status,404);
  r=await fetch(BASE+'/api/admin/ads',{headers:{'x-admin-key':'é'.repeat(32)}});assert.equal(r.status,403);
  if(process.env.ADMIN_KEY_FILE){
    const key=fs.readFileSync(process.env.ADMIN_KEY_FILE,'utf8').trim();
    const image=await sharp({create:{width:16,height:16,channels:3,background:'#ffffff'}}).jpeg().toBuffer();
    r=await post('/api/ads',{slot:'circle',title:'Security test',contact:'0000000000',weeks:1,image:'data:image/jpeg;base64,'+image.toString('base64')});assert.equal(r.status,200);const ad=await r.json();assert.ok(ad.manual);
    assert.equal((await fetch(BASE+`/ads/${ad.id}.jpg`)).status,404);
    assert.equal((await fetch(BASE+`/ads/${ad.id}.jpg`,{headers:{'x-admin-key':key}})).status,200);
    for(const action of ['markpaid','approve'])assert.equal((await post('/api/admin/ads',{id:ad.id,action},null,{'x-admin-key':key})).status,200);
    assert.equal((await fetch(BASE+`/ads/${ad.id}.jpg`)).status,200);
    assert.equal((await post('/api/admin/ads',{id:ad.id,action:'takedown'},null,{'x-admin-key':key})).status,200);
    assert.equal((await fetch(BASE+`/ads/${ad.id}.jpg`)).status,404);
  }
  // Account-wide login throttling and WS burst disconnect are enforced.
  r=await post('/api/login',{username:b.username,password});assert.equal(r.status,200);const bc=cookieOf(r);
  assert.equal((await post('/api/logout-all',{},bc)).status,200);assert.equal(await refused({origin,cookie:bc}),401);assert.equal(await refused({origin,cookie:cookieB}),401);
  r=await post('/api/login',{username:b.username,password});assert.equal(r.status,200);const flood=connect(cookieOf(r));sockets.push(flood.ws);await flood.wait(m=>m.t==='welcome');
  const end=new Promise(resolve=>flood.ws.once('close',resolve));for(let i=0;i<80;i++)flood.ws.send('{"t":"ping"}');assert.equal(await end,4008);
  for(let i=0;i<11;i++)r=await post('/api/login',{username:'absent'+tag,password:'wrong'});assert.equal(r.status,429);
  console.log('PASS production cookies, registration, origin/body limits, revocation, password changes, throttling, economy persistence and replay protection');
}finally{for(const ws of sockets)ws.close();await pool.end();}
