import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game/rules.js';
import { matchBoard, settleBets } from '../src/game/matches.js';
import { Shard } from '../src/shard.js';
import { pool } from '../src/db.js';
const cat=Game.catalog(),shard={policy:null};
function player(id=71){const p={id,acct:id,name:'city'+id,bot:true,state:Game.newState({id,u:'city'+id})};Game.onMsg(p,{t:'onboard',traits:['hustler','detty'],home:cat.origins[p.state.birthOrigin].homes[0]},shard,Date.now());return p;}
test('home door connects only the correct neighbourhood and its estate',()=>{
  const p=player(),n='n:'+p.state.home,e='e:'+p.state.home;
  assert.equal(Game.onMsg(p,{t:'street',to:'n:trasacco'},shard,Date.now()).t,'toast');
  assert.equal(Game.onMsg(p,{t:'street',to:n},shard,Date.now()).t,'arrived');assert.equal(p.state.place,n);
  assert.equal(Game.onMsg(p,{t:'street',to:e},shard,Date.now()).t,'arrived');assert.equal(p.state.place,e);
  assert.equal(Game.onMsg(p,{t:'street',to:n},shard,Date.now()).t,'arrived');
  assert.equal(Game.onMsg(p,{t:'street',to:'home'},shard,Date.now()).t,'arrived');
  p.state.flags.jailUntil=Date.now()+100000;assert.equal(Game.onMsg(p,{t:'street',to:n},shard,Date.now()).t,'toast');
});
test('street food schedules use Accra time, including the midnight khebab window',()=>{
  for(const [hour,id,allowed]of [[16,'khebab',false],[17,'khebab',true],[1,'khebab',true],[3,'khebab',false],[10,'fanyogo',true],[20,'fanyogo',false]]){
    const p=player();p.state.place='n:'+p.state.home;const before=p.state.cash+p.state.momo;
    const r=Game.onMsg(p,{t:'act',loc:p.state.place,id},shard,Date.UTC(2026,9,12,hour));
    assert.equal(r.t,allowed?'busy':'toast',`${hour}:00 ${id}`);assert.equal(p.state.cash+p.state.momo,before-(allowed?(id==='khebab'?20:8):0));
  }
});
test('match predictions validate location, money, duplicate bets and kick-off',()=>{
  const p=player(),now=Math.floor(Date.now()/1200000)*1200000+60000,match=matchBoard(now)[0];
  const bet={t:'bet',match:match.id,pick:'home',stake:10};
  assert.equal(Game.onMsg(p,bet,shard,now).t,'toast');p.state.place='viewing';
  for(const stake of [NaN,Infinity,-5,4,101,10.5,'10'])assert.equal(Game.onMsg(p,{...bet,stake},shard,now).t,'toast');
  const balance=p.state.cash+p.state.momo;
  assert.equal(Game.onMsg(p,bet,shard,now).t,'matches');assert.equal(p.state.cash+p.state.momo,balance-10);
  assert.equal(Game.onMsg(p,bet,shard,now).t,'toast');assert.equal(p.state.cash+p.state.momo,balance-10);
  assert.equal(Game.onMsg(player(),bet,shard,match.start).t,'toast');
  assert.equal(matchBoard(now)[0].score,null);assert.equal(matchBoard(match.end)[0].score!==null,true);
});
test('results settle once and survive a saved-state reload',()=>{
  const p=player(),now=Math.floor(Date.now()/1200000)*1200000+60000,match=matchBoard(now)[0];
  p.state.place='viewing';const winningPick=matchBoard(match.end)[0].score.winner;
  Game.onMsg(p,{t:'bet',match:match.id,pick:winningPick,stake:20},shard,now);p.state=JSON.parse(JSON.stringify(p.state));
  let paid=0;assert.equal(settleBets(p.state,match.end,n=>paid+=n),true);assert.equal(paid,Math.round(20*match.odds[winningPick]));assert.equal(settleBets(p.state,match.end+1000,n=>paid+=n),false);assert.equal(paid,Math.round(20*match.odds[winningPick]));
});
test('owned houses can be occupied again without charging for the property twice',()=>{
  const p=player();p.state.cash=0;p.state.momo=5000000;
  Game.onMsg(p,{t:'buy',kind:'home',id:'osu',buy:true},shard,Date.now());assert.equal(p.state.owned.osu,true);const balance=p.state.momo;
  Game.onMsg(p,{t:'buy',kind:'home',id:'osu',buy:true},shard,Date.now());assert.equal(p.state.momo,balance);assert.equal(p.state.home,'osu');
});
test('crafted inherited property keys cannot masquerade as owned homes',()=>{
  const p=player(),home=p.state.home,balance=p.state.cash+p.state.momo;
  for(const id of ['__proto__','constructor','toString','not-a-home']){
    assert.equal(Game.onMsg(p,{t:'buy',kind:'home',id,buy:true},shard,Date.now()).t,'toast');
    assert.equal(p.state.home,home);assert.equal(p.state.cash+p.state.momo,balance);
  }
});
test('estate directory uses purchased homes, excludes renters and protects private interiors',async()=>{
  const s=Object.create(Shard.prototype),p=player(82),owner=player(83),renter=player(84),output=[];const original=pool.query;
  p.bot=false;p.pending=0;p.state.place='e:osu';owner.bot=false;owner.state.owned.osu=true;renter.bot=false;renter.state.home='osu';
  s.players=new Map();s.players.set(owner.id,owner);s.players.set(renter.id,renter);s.send=(_,m)=>output.push(m);
  pool.query=async(sql,params)=>{assert.match(sql,/state->'owned'/);assert.equal(params[0],'osu');assert.deepEqual(JSON.parse(params[2]),[{id:owner.acct,name:owner.name}]);return {rows:[{total:2,owners:[{id:owner.acct,name:owner.name},{id:90,name:'offlineOwner'}]}]};};
  try{await s.async(p,{t:'estate_list',area:'osu'});const m=output.at(-1);assert.equal(m.total,2);assert.deepEqual(m.owners.map(o=>o.name),[owner.name,'offlineOwner']);assert.ok(m.owners.every(o=>!('items'in o)&&!('state'in o)));await s.async(p,{t:'estate_list',area:'trasacco'});assert.equal(output.at(-1).t,'toast');}finally{pool.query=original;}
});
