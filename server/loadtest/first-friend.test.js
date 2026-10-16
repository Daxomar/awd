import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayerEligible,genuineReply,REWARDS} from '../src/first-friend.js';
test('first friend is optional, time bounded, and cash disabled by default',()=>{
  const now=Date.now(),s={onboarded:true,created:now-100,flags:{}};
  assert.equal(newPlayerEligible(s,now),true);assert.equal(newPlayerEligible({...s,onboarded:false},now),false);
  assert.equal(newPlayerEligible({...s,created:now-8*86400000},now),false);
  assert.equal(newPlayerEligible({...s,flags:{muteUntil:now+1}},now),false);
  assert.equal(newPlayerEligible({...s,flags:{jailUntil:now-1}},now),true);
  if(!process.env.FIRST_FRIEND_REWARDS_ENABLED)assert.equal(REWARDS.enabled,false);
});
test('qualifying reply requires substantive different text, not punctuation or echoes',()=>{
  assert.equal(genuineReply('Welcome to Accra, which area are you exploring?','Hello, I am new here.'),true);
  for(const text of ['Hi','!!!!!!!!!!!!','Hello, I am new here.'])assert.equal(genuineReply(text,'Hello, I am new here.'),false);
});
