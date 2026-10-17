import crypto from 'node:crypto';
import {pool} from './db.js';
import {moderate} from './filter.js';
import * as D from './game/data.js';

const WEEK=7*86400000;
const amount=(name,cap)=>{const value=process.env[name];if(value===undefined||value==='')return cap;const n=Number(value);return Number.isSafeInteger(n)&&n>=0?Math.min(cap,n):0;};
export const REWARDS={enabled:process.env.FIRST_FRIEND_REWARDS_ENABLED==='1',initiator:amount('FIRST_FRIEND_NEW_REWARD',1000),recipient:amount('FIRST_FRIEND_HOST_REWARD',500)};
export function newPlayerEligible(state,now=Date.now()){
  const born=state.flags?.bornAt||state.created;
  return !!state.onboarded&&Number.isFinite(born)&&born<=now&&now-born<=WEEK&&!(state.flags?.jailUntil>now)&&!(state.flags?.muteUntil>now);
}
function receives(state,other,now){
  return state?.onboarded&&!(state.flags?.muteUntil>now)&&!(state.flags?.jailUntil>now)&&!state.flags?.dmFriends&&!(state.flags?.blocked||[]).includes(other);
}
export function genuineReply(text,intro){
  const clean=s=>String(s||'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const a=clean(text),b=clean(intro);return a.length>=12&&a!==b;
}
export async function migrateFirstFriend(){
  await pool.query(`create table if not exists intro_profiles(acct int primary key references accounts(id),opted_out boolean not null default false,requested_at timestamptz,quiet_until timestamptz,completed_at timestamptz);
    create table if not exists intro_matches(id uuid primary key,initiator int not null references accounts(id),recipient int not null references accounts(id),
      status text not null default 'pending',text text not null,expires_at timestamptz not null,created_at timestamptz not null default now(),
      intro_dm bigint references dms(id),reply_dm bigint references dms(id),completed_at timestamptz,
      new_reward int not null default 0,host_reward int not null default 0,check(initiator<>recipient),unique(initiator,recipient));
    create unique index if not exists intro_one_outgoing on intro_matches(initiator) where status in ('pending','accepted');
    create unique index if not exists intro_one_incoming on intro_matches(recipient) where status in ('pending','accepted');
    create table if not exists intro_completions(acct int primary key references accounts(id),match uuid unique not null references intro_matches(id),completed_at timestamptz not null default now());
    create table if not exists intro_rewards(match uuid not null references intro_matches(id),acct int not null references accounts(id),role text not null,amount int not null,credit bigint references credits(id),created_at timestamptz not null default now(),primary key(match,acct));
    create index if not exists intro_host_rewards on intro_rewards(acct,created_at) where role='recipient';
    alter table intro_profiles add column if not exists discoverable boolean not null default false;`);
}
async function transaction(fn){
  const db=await pool.connect();try{await db.query('begin');await db.query('select pg_advisory_xact_lock(7402,0)');const r=await fn(db);await db.query('commit');return r;}catch(e){await db.query('rollback');throw e;}finally{db.release();}
}
async function expire(db=pool){
  await db.query("update intro_matches set status='expired' where status in ('pending','accepted') and expires_at<now()");
}
async function profile(db,acct){
  await db.query('insert into intro_profiles(acct) values($1) on conflict do nothing',[acct]);
  return (await db.query('select * from intro_profiles where acct=$1',[acct])).rows[0];
}
export async function status(p){
  await expire();const pref=await profile(pool,p.acct);
  const rows=(await pool.query(`select m.id,m.initiator,m.recipient,m.status,m.expires_at,m.completed_at,a.username as starter,b.username as host,m.new_reward,m.host_reward
    from intro_matches m join accounts a on a.id=m.initiator join accounts b on b.id=m.recipient
    where (m.initiator=$1 or m.recipient=$1) and m.status in ('pending','accepted','completed') order by m.created_at desc limit 10`,[p.acct])).rows;
  return {t:'intro',eligible:newPlayerEligible(p.state)&&!pref.completed_at,optedOut:pref.opted_out,discoverable:!!pref.discoverable,rewardsEnabled:REWARDS.enabled,
    rows:rows.map(m=>({id:m.id,status:m.status,incoming:m.recipient===p.acct,with:m.recipient===p.acct?m.starter:m.host,expires:m.expires_at,newReward:m.new_reward,hostReward:m.host_reward})),completed:!!pref.completed_at};
}
export async function request(shard,p,msg){
  if(!newPlayerEligible(p.state))return {t:'intro_result',error:'This optional introduction is for players in their first week.'};
  const text=moderate(String(msg.text||''),240);
  if(text.blocked||!text.text||text.text.trim().length<12)return {t:'intro_result',error:'Write a short, respectful introduction of at least 12 characters.'};
  const now=Date.now(),target=msg.to===undefined?null:Number.isSafeInteger(msg.to)&&msg.to>0?msg.to:-1;
  if(target===-1)return {t:'intro_result',error:'Choose a player from the list.'};
  // A chosen player must still be connected and either share this room instance or have opted into discovery.
  const candidates=[...shard.players.values()].filter(o=>!o.bot&&!o.gone&&o.acct!==p.acct&&(target===null||o.acct===target)&&receives(o.state,p.acct,now)&&receives(p.state,o.acct,now));
  // Randomize actual connected candidates; no fabricated/offline fallback.
  for(let i=candidates.length-1;i>0;i--){const j=crypto.randomInt(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  const result=await transaction(async db=>{
    await expire(db);const pref=await profile(db,p.acct);
    if(pref.completed_at||pref.opted_out)return {error:'This introduction is complete or paused.'};
    const active=(await db.query("select id from intro_matches where initiator=$1 and status in ('pending','accepted')",[p.acct])).rows[0];
    if(active)return {existing:true};
    if(pref.requested_at&&now-new Date(pref.requested_at).getTime()<30000)return {error:'Wait 30 seconds before trying another match.'};
    const recent=+(await db.query("select count(*) n from intro_matches where initiator=$1 and created_at>now()-interval '1 hour'",[p.acct])).rows[0].n;
    if(recent>=5)return {error:'You have tried enough introductions for now. Explore and try again later.'};
    await db.query('update intro_profiles set requested_at=now() where acct=$1',[p.acct]);
    for(const o of candidates.slice(0,50)){
      if(o.gone||!shard.byAcct(o.acct))continue;
      const rp=await profile(db,o.acct);if(rp.opted_out||rp.quiet_until&&new Date(rp.quiet_until).getTime()>now)continue;
      // Only people who share this room instance or opted into discovery can be introduced (chosen or suggested).
      if(!(p.room&&o.room===p.room)&&!rp.discoverable)continue;
      const denied=await db.query(`select 1 from intro_matches where (initiator=$1 and recipient=$2) or (initiator=$2 and recipient=$1)
        or (recipient=$2 and status in ('pending','accepted')) union all select 1 from dm_links where a=least($1,$2) and b=greatest($1,$2) limit 1`,[p.acct,o.acct]);
      if(denied.rowCount)continue;
      const accounts=await db.query('select id,banned from accounts where id=any($1::int[])',[ [p.acct,o.acct] ]);
      if(accounts.rows.length!==2||accounts.rows.some(a=>a.banned))continue;
      const id=crypto.randomUUID();
      await db.query("insert into intro_matches(id,initiator,recipient,text,expires_at,new_reward,host_reward) values($1,$2,$3,$4,now()+interval '2 minutes',$5,$6)",[id,p.acct,o.acct,text.text,REWARDS.enabled?REWARDS.initiator:0,REWARDS.enabled?REWARDS.recipient:0]);
      return {id,recipient:o.acct};
    }
    return target===null?{waiting:true}:{error:'That player is not available for an introduction right now. Choose someone else or try later.'};
  });
  if(result.recipient)shard.deliverDm(result.recipient,{t:'intro_offer',id:result.id,from:p.name,fromAcct:p.acct});
  return {t:'intro_result',...result,...(!result.error?{state:await status(p)}:{})};
}
export async function answer(shard,p,msg){
  if(!/^[0-9a-f-]{36}$/.test(msg.id||'')||typeof msg.yes!=='boolean')return {t:'intro_result',error:'Invalid introduction response.'};
  const result=await transaction(async db=>{
    await expire(db);
    const m=(await db.query("select * from intro_matches where id=$1 and recipient=$2 for update",[msg.id,p.acct])).rows[0];
    if(!m||m.status!=='pending')return {error:'This introduction is no longer awaiting consent.'};
    const permitted=(await db.query('select id from accounts where id=any($1::int[]) and not banned',[[m.initiator,p.acct]])).rowCount===2;
    if(!permitted){await db.query("update intro_matches set status='cancelled' where id=$1",[m.id]);return {error:'This introduction is no longer available.'};}
    const pref=await profile(db,p.acct),a=shard.byAcct(m.initiator),other=a?.state||(await db.query('select state from players where id=$1',[m.initiator])).rows[0]?.state;
    const allowed=!pref.opted_out&&receives(p.state,m.initiator,Date.now())&&receives(other,p.acct,Date.now());
    if(!msg.yes||!allowed){await db.query("update intro_matches set status='declined' where id=$1",[m.id]);await db.query("update intro_profiles set quiet_until=now()+interval '10 minutes' where acct=$1",[p.acct]);return {declined:true,initiator:m.initiator};}
    const ids=[Math.min(m.initiator,p.acct),Math.max(m.initiator,p.acct)];
    const link=(await db.query('select status from dm_links where a=$1 and b=$2',ids)).rows[0];
    if(link&&link.status!=='accepted'){await db.query("update intro_matches set status='cancelled' where id=$1",[m.id]);return {error:'Messaging preferences changed. This introduction was cancelled.'};}
    await db.query("insert into dm_links(a,b,initiator,status) values($1,$2,$3,'accepted') on conflict(a,b) do nothing",[...ids,m.initiator]);
    const dm=(await db.query("insert into dms(from_id,to_id,text,kind) values($1,$2,$3,'text') returning id,extract(epoch from at)*1000 as at",[m.initiator,p.acct,m.text])).rows[0];
    await db.query("update intro_matches set status='accepted',intro_dm=$2,expires_at=now()+interval '24 hours' where id=$1",[m.id,dm.id]);
    const starter=(await db.query('select username from accounts where id=$1',[m.initiator])).rows[0].username;
    return {accepted:true,initiator:m.initiator,starter,text:m.text,dm:+dm.id,at:+dm.at};
  });
  if(result.accepted){
    shard.deliverDm(p.acct,{t:'dm_in',from:result.starter,fromAcct:result.initiator,m:{id:result.dm,from:result.starter,to:p.name,text:result.text,kind:'text',at:result.at,mine:false}});
    shard.deliverDm(result.initiator,{t:'intro_update',from:p.name,fromAcct:p.acct,status:'accepted'});
  }else if(result.declined)shard.deliverDm(result.initiator,{t:'intro_update',from:p.name,fromAcct:p.acct,status:'declined'});
  return {t:'intro_result',error:result.error,state:await status(p)};
}
export async function preferences(p,msg){
  if(typeof msg.discoverable==='boolean'){await transaction(async db=>{await profile(db,p.acct);await db.query('update intro_profiles set discoverable=$2 where acct=$1',[p.acct,msg.discoverable]);});return status(p);}
  if(typeof msg.out!=='boolean')return {t:'intro_result',error:'Invalid introduction preference.'};
  await transaction(async db=>{await profile(db,p.acct);await db.query('update intro_profiles set opted_out=$2 where acct=$1',[p.acct,msg.out]);if(msg.out)await db.query("update intro_matches set status='cancelled' where (initiator=$1 or recipient=$1) and status in ('pending','accepted')",[p.acct]);});
  return status(p);
}
// Stage 6 discovery lists. Only real connected players: Nearby = same room instance (already visible there),
// Discover = players who opted in (no location shown), Friends = accepted message contacts.
const card=o=>{const j=o.state.job&&D.CAREERS[o.state.job.id];return {acct:o.acct,name:o.name,look:o.state.look||null,job:j?j.ranks[o.state.job.rank]?.[0]||j.name:null,newcomer:newPlayerEligible(o.state)};};
export async function people(shard,p){
  await expire();const now=Date.now(),mine=await profile(pool,p.acct);
  const live=[...shard.players.values()].filter(o=>!o.bot&&!o.gone&&o.acct!==p.acct&&o.state?.onboarded),ids=live.map(o=>o.acct);
  const prefs=new Map((await pool.query('select acct,opted_out,discoverable,quiet_until from intro_profiles where acct=any($1::int[])',[ids])).rows.map(r=>[r.acct,r]));
  const past=new Set((await pool.query('select case when initiator=$1 then recipient else initiator end as o from intro_matches where initiator=$1 or recipient=$1',[p.acct])).rows.map(r=>r.o));
  const linked=new Set((await pool.query('select case when a=$1 then b else a end as o from dm_links where a=$1 or b=$1',[p.acct])).rows.map(r=>r.o));
  const busy=new Set((await pool.query("select recipient from intro_matches where recipient=any($1::int[]) and status in ('pending','accepted')",[ids])).rows.map(r=>r.recipient));
  const banned=new Set((await pool.query('select id from accounts where id=any($1::int[]) and banned',[ids])).rows.map(r=>r.id));
  const open=o=>{const pr=prefs.get(o.acct);return !banned.has(o.acct)&&!pr?.opted_out&&!(pr?.quiet_until&&new Date(pr.quiet_until).getTime()>now)&&receives(o.state,p.acct,now)&&receives(p.state,o.acct,now)&&!past.has(o.acct)&&!linked.has(o.acct)&&!busy.has(o.acct);};
  const nearby=p.room?live.filter(o=>o.room===p.room&&open(o)):[],discover=live.filter(o=>o.room!==p.room&&prefs.get(o.acct)?.discoverable&&open(o));
  for(let i=discover.length-1;i>0;i--){const j=crypto.randomInt(i+1);[discover[i],discover[j]]=[discover[j],discover[i]];}
  const friends=(await pool.query("select a.id,a.username from dm_links l join accounts a on a.id=(case when l.a=$1 then l.b else l.a end) where (l.a=$1 or l.b=$1) and l.status='accepted' and not a.banned order by a.username limit 50",[p.acct])).rows;
  return {t:'intro_people',canIntroduce:newPlayerEligible(p.state)&&!mine.completed_at&&!mine.opted_out,discoverable:!!mine.discoverable,optedOut:mine.opted_out,
    nearby:nearby.slice(0,30).map(card),discover:discover.slice(0,30).map(card),friends:friends.map(f=>({acct:f.id,name:f.username,online:!!shard.byAcct(f.id)}))};
}
export async function reply(shard,from,to,dmId){
  const completed=await transaction(async db=>{
    const m=(await db.query("select * from intro_matches where recipient=$1 and initiator=$2 and status='accepted' and expires_at>now() for update",[from,to])).rows[0];
    if(!m||!m.intro_dm||dmId<=+m.intro_dm)return null;
    const d=(await db.query("select text from dms where id=$1 and from_id=$2 and to_id=$3 and kind='text'",[dmId,from,to])).rows[0];
    if(!d||!genuineReply(d.text,m.text))return null;
    if((await db.query('select id from accounts where id=any($1::int[]) and not banned',[[from,to]])).rowCount!==2)return null;
    const pref=await profile(db,to),host=await profile(db,from);
    if(pref.opted_out||host.opted_out||pref.completed_at)return null;
    const a=shard.byAcct(to),b=shard.byAcct(from);
    const saved=(await db.query('select id,state from players where id=any($1::int[])',[[to,from]])).rows;
    const sa=a?.state||saved.find(s=>s.id===to)?.state,sb=b?.state||saved.find(s=>s.id===from)?.state;
    if(!receives(sa,from,Date.now())||!receives(sb,to,Date.now()))return null;
    const first=await db.query('insert into intro_completions(acct,match) values($1,$2) on conflict do nothing returning acct',[to,m.id]);
    if(!first.rowCount)return null;
    await db.query('update intro_profiles set completed_at=now() where acct=$1',[to]);
    await db.query("update intro_matches set status='completed',reply_dm=$2,completed_at=now() where id=$1",[m.id,dmId]);
    const hostAccount=(await db.query('select created_at from accounts where id=$1',[from])).rows[0];
    const cap=+(await db.query("select count(*) n from intro_rewards where acct=$1 and role='recipient' and amount>0",[from])).rows[0].n;
    const daily=+(await db.query("select count(*) n from intro_rewards where acct=$1 and role='recipient' and amount>0 and created_at>now()-interval '1 day'",[from])).rows[0].n;
    for(const [acct,role,value]of [[to,'initiator',REWARDS.enabled?m.new_reward:0],[from,'recipient',REWARDS.enabled&&Date.now()-new Date(hostAccount.created_at).getTime()>=86400000&&cap<3&&daily<1?m.host_reward:0]]){
      let credit=null;
      if(value>0)credit=(await db.query("insert into credits(to_id,from_name,amount,kind,note) values($1,'Accra We Dey',$2,'intro','Your first friend in Accra') returning id",[acct,value])).rows[0].id;
      await db.query('insert into intro_rewards(match,acct,role,amount,credit) values($1,$2,$3,$4,$5) on conflict do nothing',[m.id,acct,role,value,credit]);
    }
    return {initiator:to,recipient:from};
  });
  if(completed)for(const acct of [completed.initiator,completed.recipient]){shard.deliverCredit(acct);const p=shard.byAcct(acct);if(p)shard.send(p,{t:'intro_complete'});}
  return completed;
}
export async function reconcile(shard){
  await expire();
  const rows=(await pool.query(`select m.initiator,m.recipient,d.id as reply from intro_matches m join lateral
    (select id from dms where from_id=m.recipient and to_id=m.initiator and id>m.intro_dm and kind='text' order by id desc limit 20) d on true
    where m.status='accepted' and m.expires_at>now() limit 100`)).rows;
  for(const r of rows)await reply(shard,r.recipient,r.initiator,+r.reply);
}
