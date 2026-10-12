// Legacy command retained as a free-play continuity check.
import assert from 'node:assert/strict';
import * as G from '../src/game/rules.js';
const shard = {policy:null}; let now=Date.now();
const p={id:1,acct:42,x:0,z:0,state:G.newState({u:'freeplay'})};
G.onMsg(p,{t:'onboard',traits:['hustler','sweetmouth'],home:'nima'},shard,now);
for(let i=0;i<12*24*6;i++) {
  now+=600000; for(const k in p.state.n) p.state.n[k]=70;
  const out=G.tick(p,now,shard), list=out?.t==='multi'?out.list:[out];
  assert.ok(list.every(m=>!['msg','missions','streak'].includes(m?.t)));
  assert.equal(p.state.story.inbox.length,0); assert.equal(p.state.story.goals.length,0);
}
console.log('PASS 12 simulated days: no forced storyline, deadlines or missions');
