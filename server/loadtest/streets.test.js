import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game/rules.js';
import { Shard } from '../src/shard.js';
import { localEntry,localRoomInfo,saveLocalMove } from '../src/street-world.js';
import { STREET_IDS,streetGraph } from '../../shared/local-streets.js';
const world={policy:null};
const player=(id=501,home='osu')=>({id,acct:id,name:'street'+id,bot:true,state:{...Game.newState({id,u:'street'+id}),onboarded:true,home,cash:1000,momo:0},x:Game.HOME_POS[home].x,z:Game.HOME_POS[home].z});

test('every existing home/street/estate route retains authority and coherent local entries',()=>{
  for(const id of STREET_IDS){
    const p=player(501,id),n='n:'+id,e='e:'+id,balance=p.state.cash;
    Game.goPlace(p,'home');assert.equal(Game.onMsg(p,{t:'street',to:n},world,Date.now()).t,'arrived');
    assert.deepEqual(localEntry(p.state),streetGraph(id).lots.find(l=>l.role==='home').approach);
    assert.equal(Game.onMsg(p,{t:'street',to:e},world,Date.now()).t,'arrived');assert.equal(localEntry(p.state).z,16);
    assert.equal(Game.onMsg(p,{t:'street',to:n},world,Date.now()).t,'arrived');assert.deepEqual(localEntry(p.state),streetGraph(id).estate);
    assert.equal(Game.onMsg(p,{t:'street',to:'home'},world,Date.now()).t,'arrived');assert.equal(p.state.cash,balance);
    p.state.flags.jailUntil=Date.now()+10000;assert.equal(Game.onMsg(p,{t:'street',to:n},world,Date.now()).t,'toast');
  }
});
test('local movement cannot alter fare coordinates or enter solid lots/unloaded space',()=>{
  const p=player();Game.goPlace(p,'n:osu');const pos={x:p.x,z:p.z};
  assert.ok(saveLocalMove(p.state,0,0));const lot=streetGraph('osu').lots[0];
  for(const [x,z]of [[lot.x,lot.z],[22,0],[NaN,0],[0,Infinity]])assert.equal(saveLocalMove(p.state,x,z),false);
  assert.deepEqual({x:p.x,z:p.z},pos);
  const shard=Object.create(Shard.prototype),sent=[];shard.send=(_,m)=>sent.push(m);shard.toRoom=()=>{};
  Object.assign(p,{room:{},rx:0,rz:0,mvAt:0});shard.roomMove(p,{x:lot.x,z:lot.z});assert.equal(sent[0].t,'rpos');assert.equal(p.rx,0);
  assert.deepEqual({x:p.x,z:p.z},pos);
});
test('optional street saves restore valid positions and safely reject corrupted/older metadata',()=>{
  const p=player();Game.goPlace(p,'n:osu');saveLocalMove(p.state,0,7);
  const restored=JSON.parse(JSON.stringify(p.state));assert.deepEqual(localEntry(restored),{x:0,z:7});
  for(const localWalk of [null,{place:'n:osu',x:900,z:0},{place:'n:osu',x:'0',z:0},{place:'n:nima',x:0,z:0}]){
    const info=localRoomInfo({...restored,localWalk});assert.ok(Number.isFinite(info.x)&&Number.isFinite(info.z));assert.equal(info.network,'osu');
  }
  Game.goPlace(p,'e:osu',undefined,'n:osu');assert.ok(saveLocalMove(p.state,-5,0));
  assert.deepEqual(localEntry(p.state),{x:0,z:16});
  p.state.localWalk={place:'e:osu',x:-5,z:0};assert.deepEqual(localEntry(p.state),{x:0,z:7});
});
test('frontages and returns retain normal walking travel, duration, custody and access rules',()=>{
  const p=player();Game.goPlace(p,'n:osu');const now=Date.now(),target=Game.LOC.oxford;
  const km=Math.hypot(target.x-p.x,target.z-p.z)/1000*1.3,q=Game.tripQuote('walk',km,now,null);
  const r=Game.travel(p,{to:'oxford',mode:'walk',local:true},now,world);
  assert.equal(r.t,'busy');assert.equal(r.busy.end-now,q.secs*1000);assert.equal(p.state.place,null);assert.equal(p.state.cash,1000-q.fare);
  assert.deepEqual(p.state.streetReturn,{place:'n:osu',venue:'oxford'});
  p.state=JSON.parse(JSON.stringify(p.state));Game.tick(p,r.busy.end,world);assert.equal(p.state.place,'oxford');
  const back=Game.travel(p,{to:'n:osu',mode:'walk'},r.busy.end+1,world);assert.equal(back.t,'busy');assert.ok(back.busy.end>r.busy.end+1);
  Game.tick(p,back.busy.end,world);assert.equal(p.state.place,'n:osu');assert.deepEqual(localEntry(p.state),streetGraph('osu').lots.find(l=>l.destination==='oxford').approach);
  for(const to of ['oxford','visit:999','n:trasacco'])assert.equal(Game.onMsg(p,{t:'street',to},world,Date.now()).t,'toast');
  p.state.flags.jailUntil=Date.now()+10000;assert.equal(Game.travel(p,{to:'oxford',mode:'walk'},Date.now(),world).t,'toast');
});
test('segment traversal keeps the room; entering a building removes presence from that area',()=>{
  const shard=Object.create(Shard.prototype),events=[];Object.assign(shard,{rooms:new Map(),stats:{outBytes:0,rooms:0},gem:null});
  const a=player(601),b=player(602);for(const p of [a,b]){p.ws={send:data=>events.push({who:p.id,...JSON.parse(data)})};Game.goPlace(p,'n:osu');shard.enterRoom(p);}
  assert.equal(a.room,b.room);assert.equal(a.room.base,'n:osu');assert.ok(events.some(e=>e.t==='rjoin'));
  a.mvAt=0;shard.roomMove(a,{x:0,z:7});assert.equal(a.room,b.room);assert.ok(events.some(e=>e.t==='rmv'&&e.who===b.id));
  Game.goPlace(a,'home');shard.enterRoom(a);assert.notEqual(a.room,b.room);assert.equal(a.room.base,'home:'+a.acct);assert.equal(b.room.members.size,1);assert.ok(events.some(e=>e.t==='rleave'&&e.who===b.id));
});
