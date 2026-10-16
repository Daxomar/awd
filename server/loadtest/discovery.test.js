import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game/rules.js';
import {NEIGHBOURHOOD_ACTIVITIES,SOCIAL_HUBS} from '../src/game/discovery.js';
test('discovery retains 55 destination IDs and only exposes real public hubs',()=>{
  const cat=Game.catalog();assert.equal(cat.locs.length,55);
  for(const id of SOCIAL_HUBS){const l=cat.locs.find(l=>l.id===id);assert.ok(l&&!l.estate&&l.discovery.hub);assert.ok(l.acts.length);}
  for(const l of cat.locs)assert.ok(l.discovery.reason);
});
test('each authored neighbourhood activity is valid, usable and server timed',()=>{
  const at=Date.UTC(2026,9,16,12);
  for(const [id,a] of Object.entries(NEIGHBOURHOOD_ACTIVITIES)){
    const s=Game.newState({id:102,u:'qa'});s.onboarded=true;s.place='n:'+id;s.home='nima';
    const p={acct:102,name:'qa',state:s};Game.goPlace(p,s.place);
    const result=Game.onMsg(p,{t:'act',loc:s.place,id:a.id},{policy:null},at);
    assert.equal(result.t,'busy',id);assert.equal(s.busy.id,a.id);
    const before=s.skills[Object.keys(a.skill)[0]],finish=s.busy.end;
    Game.tick(p,finish+1,{policy:null});assert.equal(s.busy,null);assert.ok(s.skills[Object.keys(a.skill)[0]]>before,id);
    assert.equal(Game.onMsg(p,{t:'act',loc:s.place,id:a.id},{policy:null},finish+2)?.t,'toast');
    assert.equal(Game.onMsg(p,{t:'act',loc:'n:'+id,id:'invented'},{policy:null},finish+2)?.t==='busy',false);
  }
});
