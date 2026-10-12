import { pool } from './db.js';
import * as Game from './game/rules.js';

// Keep the saved debit/credit and its ledger in one transaction. The live state
// is replaced only after commit, and ticks/saves cannot overwrite that commit.
export async function withMoney(p, work) {
  if(p.moneyBusy)throw new Error('Account transaction already in progress');
  p.moneyBusy=true;
  const task=(async()=>{
    if(p.saving)await p.saving;
    if(p.gone)return null;
    const state=structuredClone(p.state),db=await pool.connect();
    try {
      await db.query('begin');
      await db.query('select id from players where id=$1 for update',[p.acct]);
      const result=await work(db,state);
      await db.query(`insert into players(id,state,worth,updated_at) values($1,$2,$3,now())
        on conflict(id) do update set state=excluded.state,worth=excluded.worth,updated_at=now()`,[p.acct,JSON.stringify(state),Game.netWorth(state)]);
      await db.query('commit');p.state=state;p.dirty=true;return result;
    }catch(e){await db.query('rollback');throw e;}finally{db.release();}
  })();
  p.moneyTask=task;
  try{return await task;}finally{p.moneyBusy=false;if(p.moneyTask===task)p.moneyTask=null;}
}
