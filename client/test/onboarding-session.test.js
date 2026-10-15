import test from 'node:test';
import assert from 'node:assert/strict';
import { OnboardingSession } from '../src/v2/onboarding-session.js';
function mock(){const h={};return {connected:true,on(t,f){(h[t]||=[]).push(f);return()=>h[t]=h[t].filter(x=>x!==f);},emit(t,m){for(const f of h[t]||[])f(m);},send(){return true;}};}
test('synchronous replies are not lost; queued actions use acknowledged revisions',async()=>{
 const net=mock(),seen=[];net.send=m=>{seen.push(m.revision);net.emit('onboarding',{id:m.id,ok:true,state:{onboarding:{revision:m.revision+1}}});return true;};
 const s=new OnboardingSession(net,{});await Promise.all([s.request('begin'),s.request('roll')]);assert.deepEqual(seen,[0,1]);s.dispose();
});
test('offline, rejected and missing replies do not leave permanent loading',async()=>{
 const net=mock(),s=new OnboardingSession(net,{}, {timeout:20});net.connected=false;
 await assert.rejects(s.request('roll'),/Connection lost/);net.connected=true;
 await assert.rejects(s.request('roll'),/too long/);
 net.send=m=>{net.emit('onboarding',{id:m.id,ok:false,error:'Invalid home',state:{onboarding:{revision:4}}});return true;};
 await assert.rejects(s.request('home'),/Invalid home/);assert.equal(s.state.onboarding.revision,4);
 net.emit('reconnected',{state:{onboarding:{step:'home',revision:5}}});assert.equal(s.state.onboarding.step,'home');s.dispose();
});
test('connection loss rejects an in-flight save promptly and a late reply restores canonical state',async()=>{
 const net=mock(),s=new OnboardingSession(net,{}, {timeout:1000});let sent;net.send=m=>{sent=m;return true;};
 const pending=s.request('roll');await Promise.resolve();net.emit('connection',{connected:false});await assert.rejects(pending,/Connection lost/);
 net.emit('onboarding',{id:sent.id,ok:true,state:{onboarding:{step:'lottery',revealedAt:123,revision:3}}});assert.equal(s.state.onboarding.revealedAt,123);assert.equal(s.pending.size,0);s.dispose();
});
