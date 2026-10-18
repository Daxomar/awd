import test from 'node:test';
import assert from 'node:assert/strict';
import {needView,locationView,activityView,walletValue,moodView,zoneActions,confirmRoomArrival,hudRows,currentObjective} from '../src/v2/ui/hud-state.js';
import {ActivityRequests} from '../src/v2/ui/activity-requests.js';
import {loadPersistedCityChat,savePersistedCityChat,getRecentChatSenders} from '../src/v2/ui/chat.js';
test('authoritative room arrival unlocks interaction before the next player-state update',()=>{
 const state={place:null,cash:120,busy:{id:'travel',travel:{from:'oxford',to:'n:osu'},end:99999}};
 confirmRoomArrival(state,{place:'n:osu',streetReturn:null});
 assert.equal(activityView(state,1000),null);assert.equal(state.place,'n:osu');assert.equal(state.cash,120);
 assert.equal(locationView(state,{locs:[{id:'n:osu',name:'Osu streets'}]}).name,'Osu streets');
 const activity={id:'nap',start:1000,end:9000};state.busy=activity;
 confirmRoomArrival(state,{place:'home'});assert.equal(state.busy,activity);
});
test('needs reflect actual values and confirmed recovery; mood and money remain real',()=>{
 assert.equal(needView(15,25).status,'critical');assert.equal(needView(30,40).status,'declining');assert.equal(needView(55,30).status,'recovering');assert.equal(needView(75,75).status,'normal');assert.equal(needView(120).value,100);
 assert.equal(walletValue({cash:200,momo:600}),800);assert.equal(walletValue({cash:175,momo:600}),775);assert.equal(moodView({mood:-22}).value,-22);
});
test('location uses current state, not a previous room label, including transport and visits',()=>{
 const cat={homes:{nima:{area:'Nima'}},locs:[{id:'oxford',name:'Oxford Street',area:'Osu'},{id:'n:nima',name:'Nima streets',area:'Nima'}]};
 assert.deepEqual(locationView({place:'home',home:'nima'},cat,'Stale venue'),{name:'Home',area:'Nima'});
 assert.equal(locationView({place:'oxford'},cat,'Nima').area,'Osu');assert.equal(locationView({place:'n:nima'},cat).name,'Nima streets');
 assert.equal(locationView({place:'home',busy:{travel:{},label:'Taxi to Osu'}},cat,'Home').name,'On the road');assert.equal(locationView({place:'visit:1'},cat,'Ama’s place').area,'Visiting a player');
});
test('activity progress is bounded; cancel follows existing server rules, not a new timer',()=>{
 const b={id:'nap',label:'Nap',start:1000,end:11000,sleep:true};assert.equal(activityView({busy:b},6000).progress,.5);assert.equal(activityView({busy:b},12000).remaining,0);assert.equal(activityView({busy:b},-1).progress,0);assert.equal(activityView({busy:b},5000).canCancel,true);
 assert.equal(activityView({busy:{...b,mg:'azonto'}},5000).canCancel,false);assert.equal(activityView({busy:{...b,travel:{mode:'walk'}}},5000).canCancel,false);assert.equal(activityView({shift:{start:1000}},1000).remaining,3600);assert.equal(activityView({shift:{start:1000,maxDuration:180000}},1000).remaining,180);
 assert.equal(activityView({},5000),null);
});
test('context menus contain only actions mapped to that selected object',()=>{
 assert.deepEqual(zoneActions({acts:['sleep','nap','imagined']},[{id:'sleep'},{id:'nap'},{id:'cook'}]).map(a=>a.id),['sleep','nap']);
});
function netMock(){const h={};return {connected:true,h,on(t,f){(h[t]||=[]).push(f);return()=>h[t]=h[t].filter(x=>x!==f);},emit(t,m){for(const f of [...h[t]||[]])f(m);},send(){return true;}};}
test('action listener exists before send; only the matching confirmed action resolves',async()=>{
 const n=netMock(),q=new ActivityRequests(n);n.send=m=>{n.emit('busy',{busy:{id:'unrelated'}});n.emit('busy',{busy:{id:m.id}});return true;};await q.request({t:'act',id:'bath'});
 n.send=()=>true;let resolved=false;const game=q.request({id:'dance'}).then(()=>resolved=true);n.emit('mg',{act:'unrelated'});await Promise.resolve();assert.equal(resolved,false);n.emit('mg',{act:'dance'});await game;assert.equal(resolved,true);
 q.dispose();assert.ok(Object.values(n.h).every(a=>a.length===0));
});
test('rejections, connection loss, duplicate taps and timeouts recover without duplicate listeners',async()=>{
 const n=netMock(),q=new ActivityRequests(n,{timeout:25});const count=Object.values(n.h).reduce((s,a)=>s+a.length,0);
 for(let i=0;i<3;i++){const request=q.request({id:'bath'});await assert.rejects(q.request({id:'bath'}),/Wait/);n.emit('toast',{k:'bad',m:'Not available here'});await assert.rejects(request,/Not available/);}
 const disconnected=q.request({id:'nap'});n.emit('connection',{connected:false});await assert.rejects(disconnected,/Connection lost/);await assert.rejects(q.request({id:'nap'}),/not confirmed/);
 n.connected=false;await assert.rejects(q.request({id:'bath'}),/Reconnecting/);n.connected=true;n.send=()=>false;await assert.rejects(q.request({id:'bath'}),/Could not send/);
 assert.equal(Object.values(n.h).reduce((s,a)=>s+a.length,0),count);q.dispose();assert.ok(Object.values(n.h).every(a=>a.length===0));
});
test('HUD objectives follow the first-session path, prefer a claim, then hand over to long-term goals',()=>{
 const row=(id,first,o={})=>({id,first,title:id,xp:10,completed:false,claimed:false,...o});
 const rows=[row('first_meal',0),row('needs_check',7),row('first_home',1,{completed:true,claimed:true}),row('first_street',2,{completed:true}),row('first_friend',0),row('career_five',0,{category:'long'})];
 let v=hudRows(rows);
 assert.equal(v.label,'Getting started');assert.deepEqual(v.rows.map(d=>d.id),['first_home','first_street','needs_check','first_friend']);
 assert.equal(currentObjective(v).id,'first_street','a completed, unclaimed objective is offered for claiming first');
 rows[3].claimed=true;v=hudRows(rows);assert.equal(currentObjective(v).id,'needs_check','then the next open objective, without forcing order');
 for(const d of rows)if(d.first||d.id==='first_friend')Object.assign(d,{completed:true,claimed:true});
 v=hudRows(rows);assert.equal(v.label,'Next goal');assert.deepEqual(v.rows.map(d=>d.id),['first_meal']);
 assert.equal(currentObjective(hudRows([])),null,'no rows hides the HUD objective');
 assert.equal(hudRows([row('needs_check',7)]).rows.length,1,'first-week First Friend absent: the path still works');
});
test('ambient street life is budgeted, varies by time of day and is deterministic per street',async()=>{
 const {ambientBudget,populationFor,rng,residentLook}=await import('../src/v2/scene/ambient.js');
 const low=ambientBudget({deviceMemory:2,hardwareConcurrency:4}),high=ambientBudget({deviceMemory:8,hardwareConcurrency:8});
 assert.ok(low.walkers<high.walkers&&low.parked<high.parked,'low-end devices get fewer residents and cars');
 for(const b of [low,high])assert.ok(b.walkers+b.talkers<=8&&b.moving<=1,'hard population caps; at most one moving vehicle');
 const day=populationFor(12,high),late=populationFor(2,high),evening=populationFor(20,high);
 assert.ok(late.walkers<evening.walkers&&evening.walkers<=day.walkers);assert.equal(late.talkers,0);assert.equal(late.moving,0);
 const a=rng(42),b=rng(42);assert.deepEqual([a(),a(),a()],[b(),b(),b()]);
 const look=residentLook(rng(7));assert.ok(['m','f'].includes(look.body)&&look.top&&look.bottom&&!('name' in look),'residents carry no player identity');
});
test('world chat persists the last 50 messages and provides recent unique senders for player discovery',()=>{
 const mem = new Map();
 const mockStorage = {
   getItem: k => mem.get(k) ?? null,
   setItem: (k, v) => mem.set(k, String(v)),
   removeItem: k => mem.delete(k),
 };
 const origStorage = globalThis.localStorage;
 globalThis.localStorage = mockStorage;
 try {
   const sample = [];
   for (let i = 1; i <= 60; i++) {
     sample.push({ n: `player_${i % 5}`, m: `hello message ${i}`, at: 1000 + i * 10, id: `pid_${i % 5}` });
   }
   savePersistedCityChat(sample);
   const loaded = loadPersistedCityChat();
   assert.equal(loaded.length, 50, 'caps city chat history at 50 messages');
   assert.equal(loaded[loaded.length - 1].m, 'hello message 60');

   const recent = getRecentChatSenders();
   assert.ok(recent.length <= 5, 'returns unique senders');
   assert.deepEqual(recent.map(r => r.name), ['player_0', 'player_4', 'player_3', 'player_2', 'player_1']);
 } finally {
   globalThis.localStorage = origStorage;
 }
});
