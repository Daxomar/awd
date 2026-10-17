import assert from 'node:assert/strict';
assert.notEqual(process.env.NODE_ENV,'production','Do not run fixture mutation against a production environment.');
const url=new URL(process.env.DATABASE_URL||'postgres://invalid/invalid');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname.endsWith('_security'),'Isolated local *_security database required');
process.env.FIRST_FRIEND_REWARDS_ENABLED='1';
const {pool,migrate}=await import('../src/db.js'),Game=await import('../src/game/rules.js'),Social=await import('../src/social.js'),Intro=await import('../src/first-friend.js');
const players=new Map(),messages=[],checks=[],tag=Date.now().toString(36);
const shard={players,byAcct:id=>players.get(id),deliverDm:(acct,m)=>messages.push({acct,...m}),deliverCredit:()=>{},send:(p,m)=>messages.push({acct:p.acct,...m}),strike:()=>{}};
async function player(suffix){
  const acct=+(await pool.query("insert into accounts(username,pass,created_at) values($1,'unused-mock-account',now()-interval '2 days') returning id",['in'+tag+suffix])).rows[0].id;
  const state=Game.newState({id:acct,u:'in'+tag+suffix});state.onboarded=true;state.home='nima';state.flags.bornAt=Date.now();
  await pool.query('insert into players(id,state) values($1,$2)',[acct,JSON.stringify(state)]);
  const p={acct,name:state.name,state,bot:false,gone:false};players.set(acct,p);return p;
}
const findable=p=>Intro.preferences(p,{discoverable:true});
const resetRate=async p=>pool.query("update intro_profiles set requested_at=now()-interval '1 minute' where acct=$1",[p.acct]);
try{
  await migrate();await Social.migrateSocial();await Intro.migrateFirstFriend();Social.observeMessages(Intro.reply);
  const a=await player('a');let r=await Intro.request(shard,a,{text:'Hello, I am new to this city.'});assert.equal(r.waiting,true);checks.push('no eligible player offers honest waiting fallback, no fake match');
  const b=await player('b');await resetRate(a);r=await Intro.request(shard,a,{text:'Hello, I am new to this city.'});assert.equal(r.waiting,true);checks.push('players who neither share the room nor opted into discovery are never matched');
  await findable(b);await resetRate(a);r=await Intro.request(shard,a,{text:'Hello, I am new to this city.'});assert.ok(r.id);assert.ok(messages.some(m=>m.t==='intro_offer'&&m.acct===b.acct));
  assert.equal((await pool.query('select count(*) n from dms where from_id=$1',[a.acct])).rows[0].n,'0');
  await Intro.answer(shard,b,{id:r.id,yes:false});assert.equal((await pool.query('select count(*) n from dms where from_id=$1',[a.acct])).rows[0].n,'0');checks.push('consent required; declined introduction sends no DM');
  await resetRate(a);r=await Intro.request(shard,a,{text:'Hello, I am new to this city.'});assert.equal(r.waiting,true);checks.push('declined pair is never re-offered');
  const c=await player('c');await findable(c);await resetRate(a);r=await Intro.request(shard,a,{text:'Hello, I am new to this city.'});assert.ok(r.id);
  players.delete(c.acct);assert.equal((await Intro.status(c)).rows[0].status,'pending');players.set(c.acct,c);checks.push('pending consent persists through disconnect/reconnect');
  await Intro.answer(shard,c,{id:r.id,yes:true});assert.ok((await Intro.answer(shard,c,{id:r.id,yes:true})).error);
  assert.equal((await pool.query('select count(*) n from dms where from_id=$1',[a.acct])).rows[0].n,'1');checks.push('safe rematch, acceptance and existing DM delivery once');
  await Social.dm(shard,c,{to:a.name,text:'Hey'});assert.equal((await Intro.status(a)).completed,false);
  assert.equal(await Intro.reply(shard,c.acct,a.acct,99999999),null);checks.push('short replies and client-invented DM IDs earn nothing');
  c.dmAt=0;await Social.dm(shard,c,{to:a.name,text:'Welcome to Accra! Which neighbourhood are you visiting?'});
  assert.equal((await Intro.status(a)).completed,true);let rewards=(await pool.query('select acct,amount from intro_rewards where acct=any($1::int[])',[[a.acct,c.acct]])).rows;
  assert.equal(rewards.find(r=>r.acct===a.acct).amount,1000);assert.equal(rewards.find(r=>r.acct===c.acct).amount,500);
  await Intro.reconcile(shard);c.dmAt=0;await Social.dm(shard,c,{to:a.name,text:'There are also community activities in Jamestown.'});
  assert.equal((await pool.query('select count(*) n from credits where to_id=any($1::int[])',[[a.acct,c.acct]])).rows[0].n,'2');
  assert.ok((await Intro.request(shard,a,{text:'Another introduction please.'})).error);checks.push('genuine stored reply completes once; duplicate events cannot pay twice');
  const d=await player('d');players.clear();players.set(d.acct,d);players.set(c.acct,c);
  r=await Intro.request(shard,d,{text:'Hello, I would like to meet someone.'});await Intro.answer(shard,c,{id:r.id,yes:true});c.dmAt=0;await Social.dm(shard,c,{to:d.name,text:'Hello and welcome, enjoy exploring the city today.'});
  assert.equal((await pool.query("select sum(amount) n from intro_rewards where acct=$1 and role='recipient'",[c.acct])).rows[0].n,'500');checks.push('recipient daily reward cap blocks manufactured repeated welcomes');
  const e=await player('e');players.clear();players.set(e.acct,e);players.set(b.acct,b);await Intro.preferences(b,{out:true});
  assert.equal((await Intro.request(shard,e,{text:'Hello there, new player here.'})).waiting,true);checks.push('opt-out respected, self matching excluded');
  const f=await player('f');await findable(f);players.clear();players.set(e.acct,e);players.set(f.acct,f);await resetRate(e);r=await Intro.request(shard,e,{text:'Hello, would you like to chat?'});
  await pool.query("update intro_matches set expires_at=now()-interval '1 minute' where id=$1",[r.id]);assert.ok((await Intro.answer(shard,f,{id:r.id,yes:true})).error);checks.push('expired request cannot be accepted');
  // Stage 6: choosing a specific person, room-sharing vs discovery, and the discovery lists.
  const g=await player('g'),hh=await player('h');players.clear();players.set(g.acct,g);players.set(hh.acct,hh);
  assert.ok((await Intro.request(shard,g,{to:hh.acct,text:'Hello, nice to meet you here.'})).error);
  assert.ok((await Intro.request(shard,g,{to:'1',text:'Hello, nice to meet you here.'})).error);
  const room={};g.room=room;hh.room=room;await resetRate(g);r=await Intro.request(shard,g,{to:hh.acct,text:'Hello, nice to meet you here.'});
  assert.ok(r.id);assert.ok(messages.some(m=>m.t==='intro_offer'&&m.acct===hh.acct&&m.id===r.id));checks.push('a chosen player must share the room or be discoverable; consent is still required');
  const i=await player('i'),j=await player('j'),k=await player('k'),l=await player('l'),m=await player('m');players.clear();
  for(const x of [i,j,k,l,m])players.set(x.acct,x);await findable(j);await findable(l);await Intro.preferences(l,{out:true});await findable(m);
  const near={};i.room=near;k.room=near;i.state.flags.blocked=[m.acct];
  let list=await Intro.people(shard,i);
  assert.deepEqual(list.nearby.map(x=>x.acct),[k.acct]);assert.deepEqual(list.discover.map(x=>x.acct),[j.acct]);assert.equal(list.canIntroduce,true);
  for(const x of [...list.nearby,...list.discover])assert.deepEqual(Object.keys(x).sort(),['acct','job','look','name','newcomer']);
  checks.push('Nearby is this room only, Discover is opt-in only, opted-out and blocked players are hidden, no location exposed');
  list=await Intro.people(shard,a);assert.ok(list.friends.some(x=>x.acct===c.acct));assert.equal(list.canIntroduce,false);checks.push('Friends lists accepted contacts; a completed first friend cannot introduce again');
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
}finally{await pool.end();}
