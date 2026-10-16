// Only disposable loopback fixtures. No provider API, real payments or production data.
import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs';
assert.notEqual(process.env.NODE_ENV,'production');const u=new URL(process.env.DATABASE_URL||'http://invalid');assert.ok(['localhost','127.0.0.1'].includes(u.hostname)&&u.pathname.endsWith('_security'));
const {pool,migrate,savePlayers,loadPlayer}=await import('../src/db.js');
const Game=await import('../src/game/rules.js'),Social=await import('../src/social.js'),Life=await import('../src/life-service.js');
const {settleShared,sharedDefinition}=await import('../src/life-social.js'),{PERIOD}=await import('../src/game/business-model.js');
const {withMoney,withPlayers}=await import('../src/account-money.js'),{gameTransaction}=await import('../src/life-game.js');
const {Shard}=await import('../src/shard.js');
const queryTimes=[],actionTimes=[];
pool.on('connect',db=>{const original=db.query.bind(db);db.query=(...args)=>{const at=performance.now(),record=()=>queryTimes.push(performance.now()-at),cb=args.at(-1);if(typeof cb==='function'){args[args.length-1]=(...r)=>{record();cb(...r);};return original(...args);}return original(...args).finally(record);};});
const checks=[],players=new Map(),messages=[],notices=[];
const shard={players,byAcct:id=>players.get(id),send:(p,m)=>messages.push({acct:p.acct,...m}),deliverDm:acct=>notices.push(acct),deliverCredit(){},toRoom(){},after(){},fault(){}};
async function player(suffix){const name='lf'+Date.now().toString(36)+suffix;const id=(await pool.query('insert into accounts(username,pass,created_at) values($1,$2,now()-interval \'2 days\') returning id',[name,'disposable-unusable-password'])).rows[0].id;
 const s=Game.newState({id,u:name}),origin=Game.DATA.ORIGINS[s.birthOrigin];Object.assign(s,{onboarded:true,origin:s.birthOrigin,home:origin.homes[0],cash:origin.cash,momo:origin.momo,place:'circle',rentPaidUntil:Date.now()+7*86400000});s.flags.bornAt=Date.now()-2*86400000;
 const p={acct:id,name,state:s,id,leaseToken:crypto.randomUUID(),roomSerial:0,room:null,rx:0,rz:0};await savePlayers([{id,state:s,worth:Game.netWorth(s)}]);players.set(id,p);return p;}
const action=async(p,op,args={},key=crypto.randomUUID())=>{const at=performance.now();try{return await Life.handle(shard,p,{t:'life_action',key,op,...args});}finally{actionTimes.push({op,ms:performance.now()-at});}};
try{
 await migrate();await Social.migrateSocial();await Life.migrateLife();const a=await player('a'),b=await player('b'),c=await player('c');
 // Initial birth amounts are intact; a funded fixture permits adversarial transaction tests.
 for(const p of [a,b,c]){p.state.cash=25000;p.state.momo=25000;await savePlayers([{id:p.acct,state:p.state,worth:Game.netWorth(p.state)}]);}
 const before=a.state.cash+a.state.momo,key=crypto.randomUUID();const r=await action(a,'business_create',{type:'provisions',location:'makola'},key);assert.ok(!r.error,r.error);const id=r.business;
 assert.equal(a.state.cash+a.state.momo,before-450);assert.equal((await action(a,'business_create',{type:'provisions',location:'makola'},key)).replayed,true);assert.equal(a.state.cash+a.state.momo,before-450);checks.push('business startup and action replay debit once');
 assert.ok((await action(b,'business_stock',{id,quantity:1})).error);assert.ok((await action(a,'business_stock',{id,quantity:99999})).error);
 await action(a,'business_stock',{id,quantity:20});await action(a,'business_configure',{id,price:12,operating:true});
 await pool.query('update life_businesses set last_period=last_period-100 where id=$1',[id]);await action(a,'business_settle',{id});
 const b1=(await pool.query('select * from life_businesses where id=$1',[id])).rows[0],events=(await pool.query("select * from life_business_events where business=$1 and kind='settlement'",[id])).rows;
 assert.equal(events.length,8);assert.ok(b1.stock>=0&&+b1.till>=0);assert.equal(+b1.till,30+events.reduce((n,e)=>n+(+e.revenue)-(+e.expense),0));assert.ok(events.some(e=>e.units>0));
 await action(a,'business_settle',{id});assert.equal((await pool.query("select count(*) n from life_business_events where business=$1 and kind='settlement'",[id])).rows[0].n,'8');checks.push('stock, expense, real profit records, offline cap and idempotent settlement');
 // Close first so a clock boundary cannot add new sales during this accounting check.
 await action(a,'business_configure',{id,price:16,operating:false});
 const taxable=+(await pool.query('select taxable from life_businesses where id=$1',[id])).rows[0].taxable,earned=a.state.stats.earned;
 await action(a,'business_fund',{id,amount:100});await action(a,'business_withdraw',{id,amount:100});assert.equal(a.state.stats.earned-earned,Math.min(100,taxable));
 assert.equal(+(await pool.query('select taxable from life_businesses where id=$1',[id])).rows[0].taxable,0);
 const capitalIncome=a.state.stats.earned;await action(a,'business_fund',{id,amount:50});await action(a,'business_withdraw',{id,amount:50});assert.equal(a.state.stats.earned,capitalIncome);
 checks.push('withdrawals count only recorded profit; a pure capital cycle earns zero and closure retains stock/cash');
 const ph={id:crypto.randomUUID(),m:'button',cond:80,paid:110,fake:false,tested:true,at:Date.now()};a.state.phones.push(ph);await savePlayers([{id:a.acct,state:a.state,worth:Game.netWorth(a.state)}]);
 const listing=await action(a,'market_list',{phone:ph.id,price:100});assert.ok(listing.listing);assert.equal(a.state.phones.length,0);
 const buys=await Promise.all([action(b,'market_buy',{id:listing.listing}),action(c,'market_buy',{id:listing.listing})]);assert.equal(buys.filter(x=>!x.error).length,1);
 assert.equal(b.state.phones.length+c.state.phones.length,1);assert.equal((await pool.query("select count(*) n from credits where to_id=$1 and kind='market'",[a.acct])).rows[0].n,'1');
 await Social.claim(a);assert.equal(a.state.life.commerce.sold,1);assert.ok(!(await Life.status(a,'finance')).finance.legacy.some(x=>x[2].includes('Phone resale')));checks.push('two competing buyers transfer one escrowed phone and one durable seller payment without duplicate financial history');
 const same={key:crypto.randomUUID()};const buyer=buys[0].error?c:b;assert.ok((await action(buyer,'market_buy',{id:listing.listing},same.key)).error);checks.push('closed, unauthorized and duplicate marketplace actions cannot duplicate inventory');
 assert.ok((await action(a,'friend_remove',{name:c.name})).error);assert.ok((await action(a,'relationship_end',{name:c.name})).error);
 assert.equal((await pool.query('select 1 from life_relations where a=$1 and b=$2', [Math.min(a.acct,c.acct),Math.max(a.acct,c.acct)])).rowCount,0);checks.push('nonexistent relationships cannot be removed/ended to create unsolicited notices or rows');
 const room={key:'n:nima#0'};for(const p of [a,b]){p.room=room;Game.goPlace(p,'n:nima');}
 const friendKey=crypto.randomUUID(),friendRequest=await action(a,'friend_request',{name:b.name},friendKey);assert.ok(!friendRequest.error,friendRequest.error);assert.equal(a.state.friends[b.acct].accepted,false);
 const noticeCount=notices.length;assert.equal((await action(a,'friend_request',{name:b.name},friendKey)).replayed,true);assert.equal(notices.length,noticeCount);checks.push('replayed social receipts cannot repeatedly notify another player');
 const accepted=await action(b,'friend_answer',{name:a.name,yes:true});assert.ok(!accepted.error,accepted.error);assert.equal(a.state.friends[b.acct].accepted,true);assert.equal(b.state.friends[a.acct].accepted,true);checks.push('friendship requires mutual persistent consent');
 await action(a,'shared_invite',{name:b.name,kind:'conversation'});let activity=(await pool.query("select id from life_shared where a=$1 and status='pending' order by created_at desc limit 1",[a.acct])).rows[0].id;
 await action(b,'shared_answer',{activity,yes:true});await pool.query("update life_shared set ready_at=now()-interval '1 second' where id=$1",[activity]);await settleShared(shard);await settleShared(shard);
 assert.equal(a.state.life.shared,1);assert.equal(a.state.friends[b.acct].pts,35);assert.equal(b.state.life.shared,1);checks.push('co-located shared activity completes once, with bounded friendship and no cash');
 await action(a,'date_request',{name:b.name});assert.ok(!a.state.flags.partner);await action(b,'date_answer',{name:a.name,yes:true});assert.equal(a.state.flags.partner,b.acct);assert.equal(b.state.flags.partner,a.acct);
 assert.ok((await action(a,'date_request',{name:c.name})).error);await action(a,'relationship_end',{name:b.name});assert.ok(!a.state.flags.partner&&!b.state.flags.partner);checks.push('romance acceptance is mutual, exclusive and reversible');
 await action(a,'shared_invite',{name:b.name,kind:'conversation'});activity=(await pool.query("select id from life_shared where a=$1 and status='pending' order by created_at desc limit 1",[a.acct])).rows[0].id;await action(b,'shared_answer',{activity,yes:true});
 b.roomSerial++;await settleShared(shard);assert.equal((await pool.query('select status from life_shared where id=$1',[activity])).rows[0].status,'cancelled');assert.equal(a.state.life.shared,1);checks.push('room departure/reconnect cancels shared progress without charging');
 b.state.flags.blocked=[a.acct];assert.ok((await action(a,'date_request',{name:b.name})).error);checks.push('blocking and unavailable players cannot receive new consent requests');
 const saved=await loadPlayer(a.acct);assert.equal(saved.life.shared,1);assert.equal(saved.life.business.created,1);const sum=(await pool.query("select count(*) n from life_events where acct=$1 and kind='money'",[a.acct])).rows[0].n;assert.ok(+sum>0);checks.push('durable financial/life events and player state survive reload');
 await Life.migrateLife();assert.equal((await loadPlayer(a.acct)).cash,saved.cash);checks.push('additive migration rerun preserves balances and completed relationships');
  const stockBefore=(await pool.query('select stock from life_businesses where id=$1',[id])).rows[0].stock,walletBefore=a.state.cash+a.state.momo;
  await assert.rejects(withMoney(a,async(db,s)=>{Game.spendFor(s,10,'Rollback check');await db.query('update life_businesses set stock=stock+1 where id=$1',[id]);throw Error('Injected transaction failure');}),/Injected/);
  assert.equal(a.state.cash+a.state.momo,walletBefore);assert.equal((await pool.query('select stock from life_businesses where id=$1',[id])).rows[0].stock,stockBefore);checks.push('failed transactions roll back wallet, stock and financial journal together');
  const buyKey=crypto.randomUUID(),gameBuy={t:'buy',kind:'item',id:'gas',clientAction:buyKey},beforeBuy=b.state.cash+b.state.momo;
  await gameTransaction(shard,b,gameBuy);await gameTransaction(shard,b,gameBuy);assert.equal(b.state.cash+b.state.momo,beforeBuy-900);checks.push('replayed ordinary gameplay purchase reference cannot debit twice');
  const phOwner=buyer;const expiring=await action(phOwner,'market_list',{phone:ph.id,price:50});assert.ok(expiring.listing);
  await pool.query("update life_listings set expires_at=now()-interval '1 second' where id=$1",[expiring.listing]);assert.ok((await action(a,'market_buy',{id:expiring.listing})).error);
  const collectKey=crypto.randomUUID();assert.ok(!(await action(phOwner,'market_cancel',{id:expiring.listing},collectKey)).error);assert.equal((await action(phOwner,'market_cancel',{id:expiring.listing},collectKey)).replayed,true);assert.equal(phOwner.state.phones.filter(x=>x.id===ph.id).length,1);checks.push('expired listings cannot sell; collecting escrow is one-time and persistent');
  c.room=room;Game.goPlace(c,'n:nima');b.state.flags.blocked=[];
  await action(a,'friend_request',{name:c.name});players.delete(a.acct);assert.ok(!(await action(c,'friend_answer',{name:a.name,yes:false})).error);players.set(a.acct,a);checks.push('recipient may decline after the initiating player disconnects');
  await action(a,'date_request',{name:b.name});await pool.query("update life_relations set romance_until=now()-interval '1 second' where a=$1 and b=$2",[[a.acct,b.acct].sort((x,y)=>x-y)[0],[a.acct,b.acct].sort((x,y)=>x-y)[1]]);
  assert.ok((await action(b,'date_answer',{name:a.name,yes:true})).error);b.state.flags.flirtOff=true;assert.ok((await action(a,'date_request',{name:b.name})).error);checks.push('expired or privacy-disabled romantic invitations cannot be accepted');
  assert.ok((await action(a,'payment_initialize',{pack:'p10'})).error);checks.push('life actions have no real-payment or cash-out operation');
 let release;const barrier=new Promise(resolve=>release=resolve),queued=[];
 a.moneyBusy=true;a.moneyTask=barrier;
 const queueShard=Object.assign(Object.create(Shard.prototype),{phase8Ready:true,stats:{inMsgs:0},send:(p,m)=>queued.push(m)});
 const waiting=queueShard.async(a,{t:'life_status',section:'career'});await new Promise(resolve=>setTimeout(resolve,20));assert.equal(queued.length,0);
 a.moneyBusy=false;a.moneyTask=null;release();await waiting;assert.ok(queued.some(m=>m.t==='life_status'));checks.push('phone requests wait for an existing account transaction before reading or changing state');
 let releaseGame;const gameBarrier=new Promise(resolve=>releaseGame=resolve),beforeQueued=a.state.cash+a.state.momo;
 a.moneyBusy=true;a.moneyTask=gameBarrier;queued.length=0;
 const ordinary=queueShard.async(a,{t:'_durable_game',request:{t:'buy',kind:'item',id:'dumbbells',clientAction:crypto.randomUUID()}});
 await new Promise(resolve=>setTimeout(resolve,20));assert.equal(queued.length,0);a.moneyBusy=false;a.moneyTask=null;releaseGame();await ordinary;
 assert.equal(a.state.cash+a.state.momo,beforeQueued-600);assert.equal(a.state.items.dumbbells,true);assert.ok(queued.some(m=>m.t==='bought'));
 const protectedWallet=a.state.cash+a.state.momo;queueShard.onJson(a,{t:'_durable_game',request:{t:'buy',kind:'item',id:'fridge'}});assert.equal(a.state.cash+a.state.momo,protectedWallet);assert.ok(!a.state.items.fridge);
 checks.push('ordinary gameplay waits behind account reads; a client cannot invoke the internal queue envelope');
 const connect=pool.connect.bind(pool),beforeUncertain=a.state.cash+a.state.momo;
 pool.connect=async()=>{const db=await connect(),query=db.query.bind(db);db.query=async(...args)=>{const result=await query(...args);if(args[0]==='commit')throw Error('Injected lost commit confirmation');return result;};const release=db.release.bind(db);db.release=()=>{db.query=query;db.release=release;release();};return db;};
 try{await assert.rejects(withMoney(a,async(db,s)=>Game.spendFor(s,10,'Lost confirmation test')),/Injected/);}finally{pool.connect=connect;}
 assert.equal(a.moneyUncertain,true);await assert.rejects(withMoney(a,async()=>{}),/transaction/);
 a.state=await loadPlayer(a.acct);delete a.moneyUncertain;assert.equal(a.state.cash+a.state.momo,beforeUncertain-10);
 checks.push('a committed but unconfirmed transaction requires canonical reload and cannot overwrite the saved debit');
 b.connecting=true;await assert.rejects(withPlayers([a,b],async()=>{}),/participant/i);delete b.connecting;
 checks.push('a participant still loading saved state cannot enter a multi-account mutation');
 const legacy=await player('legacy'),legacyWallet=legacy.state.cash+legacy.state.momo;
 for(const friends of [null,[],{[a.acct]:{pts:'not-a-number'}}]){legacy.state.friends=friends;await savePlayers([{id:legacy.acct,state:legacy.state,worth:Game.netWorth(legacy.state)}]);await Life.migrateLife();assert.equal((await loadPlayer(legacy.acct)).cash+(await loadPlayer(legacy.acct)).momo,legacyWallet);}
 checks.push('additive relationship import tolerates null, array and nonnumeric legacy friend fields without resetting wallets');
 const meal=sharedDefinition('meal','n:nima');assert.ok(meal?.cost>0);
 async function startMeal(){const r=await action(a,'shared_invite',{name:b.name,kind:'meal'});assert.ok(!r.error,r.error);const id=(await pool.query("select id from life_shared where a=$1 and status='pending' and kind='meal' order by created_at desc limit 1",[a.acct])).rows[0].id;const accepted=await action(b,'shared_answer',{activity:id,yes:true});assert.ok(!accepted.error,accepted.error);await pool.query("update life_shared set ready_at=now()-interval '1 second' where id=$1",[id]);return id;}
 let mealId=await startMeal();const mealA=a.state.cash+a.state.momo,mealB=b.state.cash+b.state.momo;await settleShared(shard);await settleShared(shard);
 assert.equal(a.state.cash+a.state.momo,mealA-meal.cost);assert.equal(b.state.cash+b.state.momo,mealB-meal.cost);assert.equal((await pool.query('select status from life_shared where id=$1',[mealId])).rows[0].status,'completed');
 checks.push('shared meals charge both real menu prices atomically and complete once');
 mealId=await startMeal();await withMoney(a,async(db,s)=>Game.spendFor(s,s.cash+s.momo,'Disposable shortage fixture'));const sharedBefore=a.state.life.shared,otherWallet=b.state.cash+b.state.momo;await settleShared(shard);
 assert.equal((await pool.query('select status from life_shared where id=$1',[mealId])).rows[0].status,'cancelled');assert.equal(a.state.life.shared,sharedBefore);assert.equal(b.state.cash+b.state.momo,otherWallet);
 checks.push('funds spent after accepting a shared meal cancel both charges and rewards at completion');
 for(const p of [a,b,c]){const delta=+(await pool.query("select coalesce(sum((facts->>'delta')::numeric),0) total from life_events where acct=$1 and kind='money'",[p.acct])).rows[0].total;assert.equal(50000+delta,p.state.cash+p.state.momo);}
 checks.push('every fixture wallet reconciles to its initial balance plus permanent financial entries');
 const stats=values=>{const x=[...values].sort((a,b)=>a-b);return {samples:x.length,medianMs:+x[Math.floor(x.length*.5)].toFixed(2),p95Ms:+x[Math.floor(x.length*.95)].toFixed(2),maxMs:+x.at(-1).toFixed(2)};};
 const performanceResults={databaseQueries:stats(queryTimes),lifeActions:stats(actionTimes.map(x=>x.ms)),businessSettlements:stats(actionTimes.filter(x=>x.op==='business_settle').map(x=>x.ms)),scope:'Loopback PostgreSQL; three disposable participants, including two concurrent buyers. Not a production capacity benchmark.'};
 console.log(JSON.stringify({passed:checks.length,checks,performance:performanceResults},null,2));
}finally{await pool.end();}
