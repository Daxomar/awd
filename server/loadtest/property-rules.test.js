import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game/rules.js';

const now=Date.UTC(2026,9,16,12);
function player(){
  const state=Game.newState({id:9797,u:'property_rules'});
  Object.assign(state,{onboarded:true,home:'nima',place:'unit:awd-osu-01',cash:800,needsAt:now,lastDaily:Game.clock(now).day,lastWeekly:Math.floor((now/86400000+3)/7)});
  return {acct:9797,state,x:0,z:0};
}
const context=(items={})=>({unit:'awd-osu-01',revision:4,template:'nima',items,canAct:true});

test('unit candidates and paid travel survive migration without granting authorization',()=>{
  const p=player();assert.equal(Game.migrate(p.state,{id:p.acct,u:p.state.name}).place,p.state.place);
  p.state.place='unit:../../home';assert.equal(Game.migrate(p.state,{id:p.acct,u:p.state.name}).place,'home');
  p.state.place=null;p.state.busy={id:'travel',end:now+10000,travel:{to:'bank',x:150,z:250}};
  const saved=Game.migrate(p.state,{id:p.acct,u:p.state.name});assert.equal(saved.place,null);assert.equal(saved.busy.travel.to,'bank');
  p.state.busy=null;assert.equal(Game.migrate(p.state,{id:p.acct,u:p.state.name}).place,'home');
});
test('unit appliance eligibility never borrows legacy belongings or trusts message benefits',()=>{
  const p=player();p.state.items={gas:true,tv:true};p.state.food=1;
  assert.equal(Game.homeAction(p,'cook',now,context()).t,'toast');assert.equal(p.state.food,1);
  assert.equal(Game.onMsg(p,{t:'act',home:true,id:'cook',homeBenefits:context({gas:true})},{},now).t,'toast');
  assert.equal(Game.homeAction(p,'cook',now,{...context({gas:true}),canAct:false}).t,'toast');
  const old=structuredClone(p.state.items);const started=Game.homeAction(p,'cook',now,context({gas:true,fridge:true}));
  assert.equal(started.t,'busy');assert.deepEqual(p.state.items,old);assert.equal(p.state.home,'nima');
  assert.equal(started.busy.homeBenefits.fridge,true);assert.equal(started.busy.homeBenefits.unit,'awd-osu-01');
});
test('completion uses the verified start snapshot and keeps legacy furniture unchanged',()=>{
  const rich=player(),plain=player();
  for(const p of [rich,plain]){p.state.food=1;p.state.n.hunger=1;}
  const a=Game.homeAction(rich,'cook',now,context({gas:true,fridge:true}));
  const b=Game.homeAction(plain,'cook',now,context({gas:true}));
  rich.state.items.fridge=false;plain.state.items.fridge=true;
  Game.tick(rich,a.busy.end+1,{});Game.tick(plain,b.busy.end+1,{});
  assert.ok(rich.state.n.hunger>plain.state.n.hunger);assert.equal(rich.state.home,'nima');assert.equal(rich.state.items.fridge,false);
});
