import {event,life} from './game/life-progression.js';

export async function migrateJournal(db){
  await db.query(`create table if not exists life_events(acct int not null references accounts(id),seq bigint not null,kind text not null,at timestamptz not null,facts jsonb not null,primary key(acct,seq));
    create index if not exists life_events_recent on life_events(acct,at desc);
    create table if not exists life_requests(acct int not null references accounts(id),key uuid not null,op text not null,digest text not null,result jsonb not null,at timestamptz not null default now(),primary key(acct,key));`);
}
export async function saveJournal(db,acct,state,before=null){
  if(before){
    if([state.cash,state.momo].some(n=>!Number.isFinite(n)||n<0||n>Number.MAX_SAFE_INTEGER))throw Error('Invalid wallet state');
    const delta=state.cash+state.momo-before.cash-before.momo;
    const recorded=(state.life?.queue||[]).filter(e=>e.seq>(before.life?.seq||0)&&e.type==='money').reduce((sum,e)=>sum+e.facts.delta,0);
    const missing=Math.round((delta-recorded)*100)/100;
    if(missing)event(state,'money',{delta:missing,label:'Wallet transfer or credit',balance:state.cash+state.momo});
  }
  const pending=state.life?.queue||[];
  if(pending.length)await db.query(`insert into life_events(acct,seq,kind,at,facts)
    select $1,e.seq,e.type,to_timestamp(e.at/1000.0),e.facts from jsonb_to_recordset($2::jsonb) as e(seq bigint,type text,at numeric,facts jsonb)
    on conflict(acct,seq) do nothing`,[acct,JSON.stringify(pending)]);
  if(state.life)state.life.queue=[];
}
export const validRequest=k=>typeof k==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(k);
export async function financeView(db,acct,s){
  const rows=(await db.query("select seq,extract(epoch from at)*1000 as at,facts from life_events where acct=$1 and kind='money' order by seq desc limit 60",[acct])).rows;
  return {balance:s.cash+s.momo,cash:s.cash,momo:s.momo,savings:s.flags.fixed?.amount||0,
    home:s.home,rentPaidUntil:s.rentPaidUntil,arrears:s.arrears||0,owned:!!s.owned[s.home],loan:s.loan,
    rows:rows.map(r=>({id:r.seq,at:+r.at,...r.facts})),legacy:s.ledger.slice(-20).reverse().filter(([at,amount,label])=>!rows.some(r=>r.facts.delta===amount&&r.facts.label===label&&Math.abs(+r.at-at)<1000))};
}
