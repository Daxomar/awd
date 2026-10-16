import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game/rules.js';
import {WORKPLACES} from '../../shared/workplaces.js';
import {currentTask,beginTask,tickTask} from '../src/game/work-tasks.js';
import {VENUES} from '../../client/src/v2/scene/venues.js';
const cat=Game.catalog();
function worker(id){
  const s=Game.newState({id:21,u:'worker'}),c=cat.careers[id];s.onboarded=true;s.home='nima';s.place=c.at;s.job={id,rank:0,grade:0,perf:40,shifts:0,lastDay:-1};
  s.shift={start:100000,worked:0,tasks:0,wins:0};return {state:s,rx:WORKPLACES[id].x,rz:WORKPLACES[id].z};
}
test('all 19 careers have authored assignments anchored to existing furniture, not minigames',()=>{
  for(const [id,c]of Object.entries(cat.careers)){
    assert.equal(c.mg,undefined);const w=WORKPLACES[id];assert.equal(w.tasks.length,3);
    assert.ok(VENUES[c.at].items.some(it=>Math.hypot(it.x-w.x,it.z-w.z)<.01),id);
    const p=worker(id),cash=p.state.cash+p.state.momo,first=currentTask(p.state);
    assert.equal(beginTask(p,{id:first.id,choice:0},c,200000),null);
    assert.equal(tickTask(p,c,200001),null);assert.ok(beginTask(p,{id:first.id,choice:0},c,200001));
    assert.equal(tickTask(p,c,200000+first.seconds*1000).completed,first.id);
    assert.equal(tickTask(p,c,999999),null);assert.ok(beginTask(p,{id:first.id,choice:0},c,999999));
    assert.equal(p.state.shift.tasks,1);assert.equal(p.state.cash+p.state.momo,cash);
    const reload=structuredClone(p.state);assert.deepEqual(reload.shift.completedTasks,[first.id]);
  }
});
test('work assignments reject remote, forged, invalid and interrupted completions',()=>{
  const p=worker('tech'),c=cat.careers.tech,t=currentTask(p.state);
  assert.ok(beginTask(p,{id:'fake',choice:0},c,200000));assert.ok(beginTask(p,{id:t.id,choice:99},c,200000));
  p.rx=18;assert.ok(beginTask(p,{id:t.id,choice:0},c,200000));p.rx=WORKPLACES.tech.x;
  assert.equal(beginTask(p,{id:t.id,choice:0},c,200000),null);p.state.place='home';
  assert.equal(tickTask(p,c,500000).interrupted,true);assert.equal(p.state.shift.tasks,0);
});
test('employment-only gigs are timed server actions while dance and boxing survive',()=>{
  for(const [place,id]of [['circle','mate'],['chopbar','rush'],['hub','freelance']]){
    const a=cat.locs.find(l=>l.id===place).acts.find(a=>a.id===id);assert.equal(a.mg,undefined);assert.equal(a.earn[0],62);assert.equal(a.min,60);
  }
  assert.equal(cat.locs.find(l=>l.id==='vibes').acts.find(a=>a.id==='battle').mg,'azonto');
  assert.equal(cat.locs.find(l=>l.id==='bukom').acts.find(a=>a.id==='spar').mg,'boxing');
});
test('actual shifts retain pay/experience and cannot pay twice or accept a forged bonus',()=>{
  const p=worker('tech'),s=p.state,now=Date.UTC(2026,9,16,12);s.shift=null;s.needsAt=now;s.lastWeekly=0;s.lastDaily=Game.clock(now).day;
  const before=s.cash+s.momo;
  assert.equal(Game.onMsg(p,{t:'work',op:'start'},{policy:null},now).t,'shift');
  const a=currentTask(s);assert.equal(Game.onMsg(p,{t:'work',op:'beginTask',id:a.id,choice:0},{policy:null},now).t,'worktask');
  assert.equal(Game.onMsg(p,{t:'work',op:'task',wins:99},{policy:null},now+500).t,'toast');
  Game.tick(p,now+90001,{policy:null});assert.equal(s.shift.tasks,1);
  Game.tick(p,now+3600001,{policy:null});assert.equal(s.shift,null);assert.equal(s.cash+s.momo,before+150);assert.equal(s.stats.shifts,1);
  Game.tick(p,now+3601000,{policy:null});assert.equal(s.cash+s.momo,before+150);
  assert.equal(Game.onMsg(p,{t:'work',op:'start'},{policy:null},now+3602000).t,'toast');
  const saved=Game.migrate(structuredClone(s),{id:21,u:'worker'});assert.equal(saved.job.id,'tech');assert.equal(saved.stats.shifts,1);assert.ok(saved.skills.coding>0);
});
