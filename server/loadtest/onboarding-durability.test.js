import test from 'node:test';
import assert from 'node:assert/strict';
import {Shard} from '../src/shard.js';
import {pool} from '../src/db.js';
import * as Game from '../src/game/rules.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(){const messages=[],p={id:1,acct:1,name:'checkpoint',state:Game.newState({id:1,u:'checkpoint'}),x:0,z:0,bot:false};
 const shard=Object.create(Shard.prototype);Object.assign(shard,{saves:new Map(),players:new Map([[1,p]]),byAcctMap:new Map([[1,p]]),stats:{outBytes:0},oware:{leave(){}},leaveRoom(){},enterRoom(){p.entered=(p.entered||0)+1;p.roomPlace=p.state.place;},send(_,m){messages.push(m);},fault(){}});return {shard,p,messages};}
test('checkpoint acknowledgments follow durable save; failed save rolls back; disconnect waits without a save deadlock',async()=>{
 const original=pool.query;try{
  const {shard,p,messages}=fixture(),saving=deferred();pool.query=()=>saving.promise;
  const first=shard.progressOnboarding(p,{t:'onboarding',id:'first',op:'begin',revision:0});
  assert.equal(messages.length,0);assert.equal(p.onboardingSave,true);
  shard.progressOnboarding(p,{t:'onboarding',id:'second',op:'roll',revision:0});assert.equal(messages.at(-1).ok,false);
  saving.reject(Error('database unavailable'));await first;assert.equal(p.state.onboarding,undefined);assert.equal(messages.at(-1).ok,false);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(p.onboardingSave,false);
  const commit=deferred();let calls=0;pool.query=()=>++calls===1?commit.promise:Promise.resolve({rows:[]});
  const next=shard.progressOnboarding(p,{t:'onboarding',id:'retry',op:'begin',revision:0});shard.leave(p);assert.equal(p.gone,true);
  commit.resolve({rows:[]});await next;await shard.saves.get(1);assert.equal(calls,2);assert.equal(p.state.onboarding.step,'character');
 }finally{pool.query=original;}
});
test('completion enters a room only once after save; repeated finish preserves spent balance',async()=>{
 const original=pool.query;try{
  pool.query=async()=>({rows:[]});const {shard,p}=fixture();
  for(const [op,fields] of [['begin',{}],['character',{name:'Esi',look:{body:'f'},traits:['hustler','highlife']}],['roll',{}],['homes',{}],['home',{home:Game.DATA.ORIGINS[p.state.birthOrigin].homes[0]}],['finish',{}]]){
   await shard.progressOnboarding(p,{t:'onboarding',id:op,op,revision:p.state.onboarding?.revision||0,...fields});await new Promise(resolve=>setImmediate(resolve));
  }
  assert.equal(p.entered,1);assert.equal(p.state.onboarded,true);const total=p.state.cash+p.state.momo;p.state.cash-=29;
  await shard.progressOnboarding(p,{t:'onboarding',id:'again',op:'finish',revision:0});assert.equal(p.entered,1);assert.equal(p.state.cash+p.state.momo,total-29);assert.notEqual(p.x,0);
 }finally{pool.query=original;}
});
test('a failed first checkpoint releases the account lease before welcome',async()=>{
 const original=pool.query;let released=0;try{
  const {shard}=fixture();shard.bus={pub:{status:'ready',set:async()=> 'OK',eval:async()=>{released++;return 1;}}};
  pool.query=async sql=>{if(sql.startsWith('select state'))return {rows:[]};throw Error('initial save failed');};
  await assert.rejects(shard.joinAccount({}, {id:99,u:'new_account'}),/initial save failed/);assert.equal(released,1);assert.equal(shard.players.size,1);
 }finally{pool.query=original;}
});
