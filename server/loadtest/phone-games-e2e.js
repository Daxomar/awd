import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base='http://127.0.0.1:8080';
async function connect(token){
 const ws=new WebSocket(base.replace('http','ws')+'/ws?token='+token),queue=[],waiters=[];
 ws.on('message',raw=>{const m=JSON.parse(raw),i=waiters.findIndex(w=>w.f(m));if(i<0)queue.push(m);else{const w=waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}});
 const wait=(f,ms=10000)=>new Promise((resolve,reject)=>{const i=queue.findIndex(f);if(i>=0)return resolve(queue.splice(i,1)[0]);const w={f,resolve};w.timer=setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(Error('Timeout '+queue.slice(-8).map(m=>m.t+':'+(m.m||'')).join(',')));},ms);waiters.push(w);});
 const welcome=await wait(m=>m.t==='welcome');return {ws,queue,wait,welcome,token,send:m=>ws.send(JSON.stringify(m))};
}
async function player(prefix){const username=prefix+Date.now().toString().slice(-8),r=await fetch(base+'/api/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password:'qa-games-2026',dob:'1995-01-01',agree:true})}),sign=await r.json();assert.ok(sign.token,JSON.stringify(sign));const c=await connect(sign.token);c.username=username;c.send({t:'onboard',home:c.welcome.state.birthOrigin==='dbee'?'osu':'nima',traits:['hustler','detty'],look:{body:'f',bust:.8,shoulders:.6}});const m=await c.wait(m=>m.t==='onboarded');assert.equal(m.state.job,null);return c;}
const a=await player('gqa'),b=await player('gqb'),c=await player('gqc');
try{
 a.send({t:'send',to:b.username,amount:10});assert.equal((await a.wait(m=>m.t==='send_res')).ok,true);
 a.send({t:'dm',to:b.username,text:'Hello before our game',clientId:'first'});assert.equal((await a.wait(m=>m.t==='dm_ack'&&m.clientId==='first')).ok,true);await b.wait(m=>m.t==='dm_in');
 a.send({t:'dm',to:b.username,text:'Still pending',clientId:'second'});assert.equal((await a.wait(m=>m.t==='dm_ack'&&m.clientId==='second')).ok,false);
 b.send({t:'dm_thread',with:a.username});assert.equal((await b.wait(m=>m.t==='dm_thread')).request.incoming,true);
 b.send({t:'dm_answer',name:a.username,yes:true});assert.equal((await b.wait(m=>m.t==='dm_thread')).request.status,'accepted');
 await new Promise(r=>setTimeout(r,750));b.send({t:'dm',to:a.username,text:'Accepted',clientId:'reply'});assert.equal((await b.wait(m=>m.t==='dm_ack'&&m.clientId==='reply')).ok,true);
 console.log('PASS message requests, paid transfer before first request, acceptance and acknowledgement');
 a.send({t:'game_create',kind:'tic',to:b.username});let game=(await a.wait(m=>m.t==='game_state')).game;assert.equal(game.status,'pending');
 c.send({t:'game_answer',id:game.id,yes:true});assert.match((await c.wait(m=>m.t==='toast')).m,/not found/);
 b.send({t:'game_answer',id:game.id,yes:true});assert.equal((await b.wait(m=>m.t==='game_state')).game.status,'active');
 a.send({t:'game_move',id:game.id,version:0,cell:0});assert.equal((await a.wait(m=>m.t==='game_state')).game.state.board[0],0);
 b.send({t:'game_move',id:game.id,version:0,cell:4});assert.match((await b.wait(m=>m.t==='toast')).m,/changed/);
 b.send({t:'game_move',id:game.id,version:1,cell:4});await b.wait(m=>m.t==='game_state');
 a.ws.close();await new Promise(r=>setTimeout(r,600));const oldname=a.username;Object.assign(a,await connect(a.token));a.username=oldname;
 a.send({t:'game_list'});game=(await a.wait(m=>m.t==='game_list')).rows.find(g=>g.id===game.id);assert.deepEqual(game.state.board.slice(0,5),[0,null,null,null,1]);assert.equal(a.welcome.state.look.bust,.8);
 for(const [who,cell,version]of [[a,1,2],[b,3,3],[a,2,4]]){who.send({t:'game_move',id:game.id,cell,version});game=(await who.wait(m=>m.t==='game_state')).game;}
 assert.equal(game.status,'done');assert.equal(game.state.winner,0);
 console.log('PASS game invitations, nonparticipant rejection, stale turn rejection, reconnect persistence and winning');
 a.send({t:'game_create',kind:'cards',to:b.username});game=(await a.wait(m=>m.t==='game_state')).game;assert.equal(game.state.hand.length,7);assert.equal(game.state.deck,undefined);assert.equal(game.state.hands,undefined);
 b.send({t:'game_answer',id:game.id,yes:true});game=(await b.wait(m=>m.t==='game_state')).game;assert.equal(game.state.hand.length,7);assert.equal(game.state.opponentCards,7);
 a.send({t:'game_move',id:game.id,version:0,op:'draw'});game=(await a.wait(m=>m.t==='game_state')).game;assert.equal(game.state.hand.length,8);assert.equal(game.state.turn,1);
 b.send({t:'game_resign',id:game.id});assert.equal((await b.wait(m=>m.t==='game_state')).game.status,'done');
 console.log('PASS private card hands, drawing and resignation');
}finally{a.ws.close();b.ws.close();c.ws.close();}
