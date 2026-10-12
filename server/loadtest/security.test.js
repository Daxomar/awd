import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { adultDob,passwordError,hashPassword,verifyPassword,check,sign,sessionCookie } from '../src/auth.js';
import { parseMessage,takeMessage,safeEqual,staticPath,inlineScriptHashes,allowedOrigin } from '../src/security.js';
import * as Game from '../src/game/rules.js';
import { handle as phoneGame } from '../src/game/phone-games.js';
import { CFG } from '../src/config.js';

test('registration bounds passwords, requires real adult calendar dates',()=>{
  assert.ok(passwordError('password123456'));
  assert.ok(passwordError('x'.repeat(129)));
  assert.ok(passwordError({length:32}));
  assert.equal(passwordError('a long unusual passphrase'),null);
  const now=new Date('2026-10-12T12:00:00Z');
  assert.equal(adultDob('2008-10-12',now),true);
  for(const d of ['2008-10-13','1995-02-31','1890-01-01','2027-01-01',null,[]])assert.equal(adultDob(d,now),false);
});
test('scrypt salts differ and legacy password hashes still verify',async()=>{
  const p='security-test-passphrase';const a=await hashPassword(p),b=await hashPassword(p);
  assert.notEqual(a,b);assert.equal(await verifyPassword(p,a),true);assert.equal(await verifyPassword('wrong',a),false);
  const salt=crypto.randomBytes(16),k=crypto.scryptSync(p,salt,32,{N:16384,r:8,p:1});
  assert.equal(await verifyPassword(p,salt.toString('hex')+':'+k.toString('hex')),true);
  for(const bad of ['broken',null,'scrypt$99999999$aa$bb'])assert.equal(await verifyPassword(p,bad),false);
});
test('cookie is HttpOnly and SameSite; non-development signed tokens are disabled',()=>{
  const cookie=sessionCookie('opaque',Date.now()+10000);
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Path=\//);
  assert.match(sessionCookie('',0),/Max-Age=0/);
  const saved={secureCookies:CFG.secureCookies,cookieName:CFG.cookieName};
  try{CFG.secureCookies=true;CFG.cookieName='__Host-awd_session';assert.match(sessionCookie('opaque',Date.now()+10000),/^__Host-awd_session=.*; Secure$/);}finally{Object.assign(CFG,saved);}
  if(process.env.DEV!=='1')assert.equal(check(sign({id:1,u:'player',exp:Date.now()+10000})),null);
  assert.equal(check(sign({id:1,u:'player'})),null);
  assert.equal(safeEqual('aa','éé'),false);
});
test('WebSocket parser rejects arrays, prototype keys and excessive nesting; bursts are bounded',()=>{
  for(const s of ['[]','null','{"t":"look","look":{"__proto__":{}}}','{"t":"constructor","x":{"constructor":1}}'])assert.equal(parseMessage(s),null);
  let v={};for(let i=0;i<10;i++)v={x:v};assert.equal(parseMessage(JSON.stringify({t:'look',v})),null);
  assert.equal(parseMessage('{"t":"ping","c":4}').t,'ping');
  const b={};for(let i=0;i<60;i++)assert.equal(takeMessage(b,1000),true);assert.equal(takeMessage(b,1000),false);assert.equal(takeMessage(b,2000),true);
});
test('static routes reject traversal, Windows separators, dotfiles and malformed escaping',()=>{
  const root=process.cwd();
  for(const u of ['/../.env','/%2e%2e/secret.key','/assets\\..\\secret.key','/.env','/assets/%00','/%zz'])assert.equal(staticPath(root,u),null);
  assert.ok(staticPath(root,'/assets/models/accra-male.glb'));
  assert.equal(inlineScriptHashes('<script>alert(1)</script>').length,1);
  assert.equal(allowedOrigin('https://attacker.invalid'),false);
});
test('economy rejects prototype IDs, non-finite amounts and forged work wins',async()=>{
  const p={acct:4,state:Game.newState({id:4,u:'testplayer'})};
  p.state.onboarded=true;p.state.cash=1000;p.state.momo=1000;p.state.place='circle';
  for(const msg of [{t:'buy',kind:'car',id:'constructor'},{t:'bank',op:'loan',amount:Infinity},{t:'bank',op:'cashout',amount:-4}]){const before=structuredClone(p.state);assert.equal(Game.onMsg(p,msg,{},Date.now()).k,'bad');assert.deepEqual(p.state,before);}
  p.state.job={perf:10};p.state.shift={wins:0,tasks:0};Game.onMsg(p,{t:'work',op:'task',win:true},{},Date.now());assert.equal(p.state.job.perf,10);assert.equal(p.state.shift.wins,0);
  for(const kind of ['constructor','toString','__proto__'])assert.equal((await phoneGame({},p,{t:'game_create',kind})).m,'Choose a game.');
});
test('production refuses default secrets, development bypasses and public HTTP',()=>{
  const env={...process.env,NODE_ENV:'production',SESSION_SECRET:'',BIRTH_SEED:'',PUBLIC_URL:'http://localhost:8080'};
  delete env.SESSION_SECRET_FILE;delete env.BIRTH_SEED_FILE;delete env.ADMIN_KEY_FILE;delete env.DEV;delete env.BOT_KEY;
  const run=overrides=>spawnSync(process.execPath,['--input-type=module','-e',"import './src/config.js'"],{cwd:new URL('..',import.meta.url),env:{...env,...overrides},encoding:'utf8'});
  assert.notEqual(run({}).status,0);
  const valid={SESSION_SECRET:crypto.randomBytes(32).toString('hex'),BIRTH_SEED:crypto.randomBytes(32).toString('hex'),DATABASE_URL:'postgres://localhost/test',REDIS_URL:'redis://localhost'};
  assert.notEqual(run({...valid,DEV:'1'}).status,0);assert.notEqual(run({...valid,PUBLIC_URL:'http://game.example'}).status,0);assert.equal(run(valid).status,0);
});
