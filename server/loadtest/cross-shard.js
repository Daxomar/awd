// Run development shards on ports 8080/8081 against the same Postgres and Redis.
import assert from 'node:assert/strict';
import WebSocket from 'ws';

async function client(port, prefix) {
  const username = prefix + Date.now().toString().slice(-8);
  const response = await fetch(`http://127.0.0.1:${port}/api/signup`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({username,password:'qa-cross-shard-2026',dob:'1995-01-01',agree:true}) });
  const {token,error} = await response.json(); assert.ok(token,error);
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`), queue=[], waiters=[];
  ws.on('message', raw => { const m=JSON.parse(raw); const i=waiters.findIndex(w=>w.match(m)); if(i<0) queue.push(m); else { const w=waiters.splice(i,1)[0]; clearTimeout(w.timer); w.resolve(m); } });
  const wait = (match,timeout=10000) => new Promise((resolve,reject)=> { const i=queue.findIndex(match); if(i>=0) return resolve(queue.splice(i,1)[0]); const w={match,resolve}; w.timer=setTimeout(()=>{ const i=waiters.indexOf(w); if(i>=0) waiters.splice(i,1); reject(Error('Timed out: '+username)); },timeout); waiters.push(w); });
  const welcome=await wait(m=>m.t==='welcome');
  const send=m=>ws.send(JSON.stringify(m));
  send({t:'onboard',traits:['hustler','sweetmouth'],home:welcome.state.birthOrigin==='dbee'?'osu':'nima'}); await wait(m=>m.t==='onboarded');
  return {username,ws,queue,wait,send,welcome};
}

const a=await client(8080,'csa'), b=await client(8081,'csb');
try {
  assert.notEqual(a.welcome.shard,b.welcome.shard);
  await new Promise(resolve=>setTimeout(resolve,1000));
  a.send({t:'chat',ch:'city',clientId:'cross-city',text:'City delivery across servers'});
  const message=await b.wait(m=>m.t==='chat' && m.clientId==='cross-city');
  assert.equal(message.n,a.username); assert.equal(message.shard,a.welcome.shard);
  assert.equal((await a.wait(m=>m.t==='chat_ack' && m.clientId==='cross-city')).ok,true);
  a.send({t:'dm',to:b.username,clientId:'cross-dm',text:'Private delivery across servers'});
  const dm=await b.wait(m=>m.t==='dm_in'); assert.equal(dm.from,a.username); assert.equal(dm.m.text,'Private delivery across servers');
  assert.equal((await a.wait(m=>m.t==='dm_ack' && m.clientId==='cross-dm')).ok,true);
  a.send({t:'game_create',kind:'four',to:b.username});
  const game=(await a.wait(m=>m.t==='game_state')).game;
  await b.wait(m=>m.t==='game_notice' && m.id===game.id);
  b.send({t:'game_answer',id:game.id,yes:true});
  assert.equal((await b.wait(m=>m.t==='game_state')).game.status,'active');
  a.send({t:'game_move',id:game.id,version:0,column:0});
  const moved=(await a.wait(m=>m.t==='game_state')).game;
  assert.equal(moved.state.version,1);
  await b.wait(m=>m.t==='game_notice' && m.id===game.id);
  b.send({t:'game_list'});
  assert.equal((await b.wait(m=>m.t==='game_list')).rows.find(g=>g.id===game.id).state.version,1);
  a.send({t:'ballot',choice:1}); const ballot=await a.wait(m=>m.t==='ballot');
  b.send({t:'ballot'}); const shared=await b.wait(m=>m.t==='ballot');
  assert.equal(shared.rows[0].votes,ballot.rows[0].votes);
  a.send({t:'ballot',choice:2}); const changed=await a.wait(m=>m.t==='ballot');
  assert.equal(changed.rows[0].votes,ballot.rows[0].votes-1);
  assert.equal(changed.rows[1].votes,ballot.rows[1].votes+1);
  b.send({t:'block',name:a.username,on:true}); await b.wait(m=>m.t==='toast');
  a.send({t:'dm',to:b.username,clientId:'cross-block',text:'Blocked delivery check'});
  await a.wait(m=>m.t==='dm_ack' && m.clientId==='cross-block');
  await new Promise(resolve=>setTimeout(resolve,700));
  assert.equal(b.queue.some(m=>m.t==='dm_in' && m.m.text==='Blocked delivery check'),false);
  console.log('PASS two real Redis-connected shards: City chat, sender identity, private chat, acknowledgements, live blocking, game notices and shared community votes');
} finally { a.ws.close(); b.ws.close(); }
