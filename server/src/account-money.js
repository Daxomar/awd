import { pool } from './db.js';
import * as Game from './game/rules.js';
import {saveJournal} from './life-journal.js';

function requireReload(p){p.moneyUncertain=true;try{p.ws?.end(1013,'Reconnecting to verify saved account state');}catch{}}

// Keep the saved debit/credit and its ledger in one transaction. The live state
// is replaced only after commit, and ticks/saves cannot overwrite that commit.
export async function withMoney(p, work) {
  if(p.moneyBusy||p.gistPending||p.moneyUncertain)throw new Error('Account transaction already in progress');
  p.moneyBusy=true;
  const task=(async()=>{
    if(p.saving)await p.saving;
    if(p.gone)return null;
    const state=structuredClone(p.state),db=await pool.connect();
    let committing=false;
    try {
      await db.query('begin');
      await db.query('select id from players where id=$1 for update',[p.acct]);
      const result=await work(db,state);
      await saveJournal(db,p.acct,state,p.state);
      await db.query(`insert into players(id,state,worth,updated_at) values($1,$2,$3,now())
        on conflict(id) do update set state=excluded.state,worth=excluded.worth,updated_at=now()`,[p.acct,JSON.stringify(state),Game.netWorth(state)]);
      committing=true;await db.query('commit');p.state=state;p.dirty=true;return result;
    }catch(e){if(committing)requireReload(p);await db.query('rollback').catch(()=>{});throw e;}finally{db.release();}
  })();
  p.moneyTask=task;
  try{return await task;}finally{p.moneyBusy=false;if(p.moneyTask===task)p.moneyTask=null;}
}

// Both live accounts are reserved before any await, then row-locked in ID order.
// Offline recipients receive durable credits instead of stale JSON overwrites.
export async function withPlayers(players,work,initiator=null){
  const people=[...new Set(players)].sort((a,b)=>a.acct-b.acct);
  if(people.some(p=>p.connecting||p.moneyBusy||p.moneyUncertain||p.onboardingSave||p.gistPending||p!==initiator&&p.pending||p.gone))throw Error('A participant is saving or disconnected. Try again.');
  for(const p of people)p.moneyBusy=true;
  const task=(async()=>{
    await Promise.all(people.map(p=>p.saving).filter(Boolean));
    if(people.some(p=>p.gone))throw Error('A participant disconnected.');
    const states=new Map(people.map(p=>[p.acct,structuredClone(p.state)])),db=await pool.connect();
    let committing=false;
    try{
      await db.query('begin');await db.query('select id from players where id=any($1::int[]) order by id for update',[people.map(p=>p.acct)]);
      const r=await work(db,states);
      for(const p of people){const s=states.get(p.acct);await saveJournal(db,p.acct,s,p.state);await db.query('update players set state=$2,worth=$3,updated_at=now() where id=$1',[p.acct,JSON.stringify(s),Game.netWorth(s)]);}
      committing=true;await db.query('commit');for(const p of people){p.state=states.get(p.acct);p.dirty=true;}return r;
    }catch(e){if(committing)for(const p of people)requireReload(p);await db.query('rollback').catch(()=>{});throw e;}finally{db.release();}
  })();
  for(const p of people)p.moneyTask=task;
  try{return await task;}finally{for(const p of people){p.moneyBusy=false;if(p.moneyTask===task)p.moneyTask=null;}}
}
