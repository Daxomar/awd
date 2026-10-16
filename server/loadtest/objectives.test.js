import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game/rules.js';
import {DEFINITIONS,progressOf} from '../src/objectives.js';
test('milestones have stable unique IDs, bounded one-time XP and actual destinations',()=>{
  assert.equal(new Set(DEFINITIONS.map(d=>d.id)).size,24);
  assert.equal(DEFINITIONS.filter(d=>d.category==='long').length,12);
  assert.deepEqual(DEFINITIONS.slice(0,12).map(d=>d.id),['first_street','first_meal','first_market','first_trip','social_hub','first_social','first_dm','first_friend','first_shift','first_outfit','two_areas','return_home']);
  for(const d of DEFINITIONS){assert.ok(d.title&&d.description);assert.ok(d.xp>=0&&d.xp<=25);if(d.next)assert.ok(DEFINITIONS.some(n=>n.id===d.next));}
  const s=Game.newState({id:301,u:'milestone'});s.onboarded=true;s.home='nima';const p={state:s};
  assert.equal(progressOf(s,'first_street'),false);Game.goPlace(p,'n:nima');assert.equal(progressOf(s,'first_street'),true);
  assert.equal(progressOf(s,'return_home'),false);Game.goPlace(p,'home');assert.equal(progressOf(s,'return_home'),true);
  Game.goPlace(p,'makola');assert.equal(progressOf(s,'first_market'),true);assert.equal(progressOf(s,'two_areas'),true);
  assert.equal(progressOf(s,'invented'),false);assert.equal(progressOf(s,'first_friend'),false);assert.equal(progressOf(s,'first_friend',true),true);
});
