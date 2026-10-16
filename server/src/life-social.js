import crypto from 'node:crypto';
import * as Game from './game/rules.js';
import * as Social from './social.js';
import {life,event} from './game/life-progression.js';
import {withPlayers} from './account-money.js';
import {pool} from './db.js';
import {CFG} from './config.js';

const pair=(a,b)=>[Math.min(a,b),Math.max(a,b)];
const identity=p=>`${p.leaseToken}:${p.roomSerial||0}`;
const publicTogether=(a,b)=>a?.room&&a.room===b?.room&&Game.LOC[a.state.place]&&!a.state.place.startsWith('e:');
function allowed(a,b,now){return a&&b&&a!==b&&a.state.onboarded&&b.state.onboarded&&
  !Social.isBlockedBy(a.state,b.acct)&&!Social.isBlockedBy(b.state,a.acct)&&
  ![a,b].some(p=>p.state.flags.jailUntil>now||p.state.flags.muteUntil>now);}
export async function migrateRelationships(db){
  await db.query(`create table if not exists life_relations(a int not null references accounts(id),b int not null references accounts(id),friendship text not null default 'acquaintance',requester int,friend_until timestamptz,points int not null default 0,romance text not null default 'none',romance_from int,romance_until timestamptz,last_social bigint not null default 0,updated_at timestamptz not null default now(),primary key(a,b),check(a<b));
    create index if not exists life_relations_b on life_relations(b);
    create table if not exists life_partners(acct int primary key references accounts(id),other int not null references accounts(id),a int not null,b int not null,foreign key(a,b) references life_relations(a,b));
    create table if not exists life_shared(id uuid primary key,a int not null references accounts(id),b int not null references accounts(id),kind text not null,status text not null default 'pending',room text not null,place text not null,proof jsonb,shard text not null,expires_at timestamptz not null,ready_at timestamptz,created_at timestamptz not null default now(),completed_at timestamptz,check(a<>b));
    create index if not exists life_shared_active on life_shared(shard,status,expires_at);
    alter table life_shared add column if not exists terms jsonb;
    create index if not exists life_shared_a on life_shared(a,created_at desc);
    create index if not exists life_shared_b on life_shared(b,created_at desc);
    create table if not exists life_shared_members(acct int primary key references accounts(id),activity uuid not null references life_shared(id));
    insert into life_relations(a,b,friendship,points,romance)
      select p.id,q.id,'accepted',least(200,least(v.ppts,v.qpts))::int,
      case when p.state->'flags'->>'partner'=q.id::text and q.state->'flags'->>'partner'=p.id::text then case when p.state->'flags'->>'engaged'='true' and q.state->'flags'->>'engaged'='true' then 'engaged' else 'dating' end else 'none' end
      from players p join lateral (select key as other from jsonb_each(case when jsonb_typeof(p.state->'friends')='object' then p.state->'friends' else '{}'::jsonb end) union select p.state->'flags'->>'partner') f on true
      join players q on q.id=case when f.other ~ '^[0-9]{1,9}$' then f.other::int end and p.id<q.id
      cross join lateral (select case when p.state->'friends'->q.id::text->>'pts' ~ '^[0-9]{1,6}([.][0-9]{1,6})?$' then (p.state->'friends'->q.id::text->>'pts')::numeric else 0 end ppts,
        case when q.state->'friends'->p.id::text->>'pts' ~ '^[0-9]{1,6}([.][0-9]{1,6})?$' then (q.state->'friends'->p.id::text->>'pts')::numeric else 0 end qpts) v
      where (v.ppts>=30 and v.qpts>=30
      or p.state->'flags'->>'partner'=q.id::text and q.state->'flags'->>'partner'=p.id::text)
      on conflict(a,b) do nothing;
    insert into life_partners(acct,other,a,b) select a,b,a,b from life_relations where romance in ('dating','engaged') on conflict(acct) do nothing;
    insert into life_partners(acct,other,a,b) select b,a,a,b from life_relations where romance in ('dating','engaged') on conflict(acct) do nothing;`);
}
async function relation(db,a,b){
  const ids=pair(a,b);await db.query('insert into life_relations(a,b) values($1,$2) on conflict do nothing',ids);
  return (await db.query('select * from life_relations where a=$1 and b=$2 for update',ids)).rows[0];
}
function mirror(s,r,other,name){
  s.friends[other]={...(s.friends[other]||{}),n:name,pts:r.friendship==='accepted'?Math.max(30,r.points):Math.min(29,r.points),accepted:r.friendship==='accepted'};
  if(['dating','engaged'].includes(r.romance)){s.flags.partner=other;s.flags.partnerName=name;s.flags.engaged=r.romance==='engaged';}
  else if(s.flags.partner===other){delete s.flags.partner;delete s.flags.partnerName;delete s.flags.engaged;}
}
function friendshipGain(s,r,amount,now){
  const l=life(s),day=Game.clock(now).day;if(l.socialDay?.day!==day)l.socialDay={day,points:0};
  return Math.max(0,Math.min(amount,30-l.socialDay.points));
}
export function sharedDefinition(kind,place,now=Date.now()){
  const loc=Game.LOC[place];if(!loc||loc.estate||place==='police')return null;
  if(['conversation','date'].includes(kind))return {label:kind==='date'?'Spend time on a date':'Conversation together',cost:0,min:30,needs:{social:20,fun:10},tags:['social']};
  const acts=loc.acts.filter(a=>!a.req&&!a.earn&&!a.mg&&!a.crime&&!a.opens&&Game.isOpen({...loc,open:a.open||loc.open,days:a.days||loc.days},now)&&
    (kind==='meal'?a.tags?.includes('eat')&&a.cost>0:kind==='exercise'?a.skill?.fitness&&a.needs?.energy<0:false));
  return acts.sort((a,b)=>(a.cost||0)-(b.cost||0))[0]||null;
}
export async function socialAction(db,states,shard,p,msg,target,now){
  const s=states.get(p.acct),other=target?.acct;
  if(msg.op==='shared_answer')return answerShared(db,shard,p,msg,states,now);
  if(!other)throw Error('Choose a real player.');
  const r=await relation(db,p.acct,other),ids=pair(p.acct,other),o=shard.byAcct(other);
  if(['relationship_end','friend_remove'].includes(msg.op)){
    if(msg.op==='friend_remove'&&r.friendship!=='accepted')throw Error('There is no accepted friendship to remove.');
    if(msg.op==='relationship_end'&&!['dating','engaged'].includes(r.romance)&&!r.romance_from)throw Error('There is no relationship or romantic invitation to end.');
    await db.query("update life_relations set romance='ended',romance_from=null,romance_until=null,friendship=case when $3 then 'removed' else friendship end,updated_at=now() where a=$1 and b=$2",[...ids,msg.op==='friend_remove']);
    await db.query('delete from life_partners where a=$1 and b=$2',ids);r.romance='ended';if(msg.op==='friend_remove')r.friendship='removed';
  }else if(msg.yes===false&&['friend_answer','date_answer'].includes(msg.op)){
    if(msg.op==='friend_answer'){
      if(r.friendship!=='pending'||r.requester===p.acct)throw Error('No friend request to decline.');
      r.friendship='declined';await db.query("update life_relations set friendship='declined',updated_at=now() where a=$1 and b=$2",ids);
    }else{
      if(!r.romance_from||r.romance_from===p.acct)throw Error('No romantic invitation to decline.');
      await db.query('update life_relations set romance_from=null,romance_until=null,updated_at=now() where a=$1 and b=$2',ids);
    }
  }else{
    if(!o||!allowed(p,o,now))throw Error('This player is unavailable or your privacy settings prevent this interaction.');
    const t=states.get(other);if(!t)throw Error('The other player is saving. Try again shortly.');
    if(msg.op==='friend_request'){
      if(!publicTogether(p,o))throw Error('Meet in the same public room before sending a friend request.');
      if(r.friendship==='accepted')throw Error('You are already friends.');
      if(r.friendship==='pending'&&r.friend_until>new Date(now))throw Error('A friend request is already pending.');
      if(['declined','removed'].includes(r.friendship)&&now-new Date(r.updated_at).getTime()<86400000)throw Error('Respect their decision. Try another day.');
      const count=(await db.query("select 1 from life_relations where requester=$1 and friendship='pending' and friend_until>now()",[p.acct])).rowCount;if(count>=5)throw Error('At most five unanswered friend requests.');
      r.friendship='pending';await db.query("update life_relations set friendship='pending',requester=$3,friend_until=now()+interval '1 day',updated_at=now() where a=$1 and b=$2",[...ids,p.acct]);
    }else if(msg.op==='friend_answer'){
      if(typeof msg.yes!=='boolean'||r.friendship!=='pending'||r.requester===p.acct||new Date(r.friend_until).getTime()<=now)throw Error('No current friend request to answer.');
      r.friendship=msg.yes?'accepted':'declined';if(msg.yes)r.points=Math.max(30,r.points);
      await db.query('update life_relations set friendship=$3,points=$4,updated_at=now() where a=$1 and b=$2',[...ids,r.friendship,r.points]);
    }else if(['date_request','propose_request'].includes(msg.op)){
      if(s.flags.flirtOff||t.flags.flirtOff)throw Error('Romantic invitations are turned off.');
      if(r.friendship!=='accepted'||r.points<35)throw Error('Build a mutual friendship (35 points) first.');
      const proposal=msg.op==='propose_request';
      if(proposal&&(r.romance!=='dating'||!s.items.ring))throw Error('A mutual dating relationship and an owned ring are required.');
      if(!proposal&&((s.flags.partner&&s.flags.partner!==other)||t.flags.partner||['dating','engaged'].includes(r.romance)))throw Error('End an existing relationship before starting another.');
      if(r.romance_until&&new Date(r.romance_until).getTime()>now&&r.romance_from)throw Error('A romantic invitation is already pending.');
      await db.query('update life_relations set romance_from=$3,romance_until=now()+interval \'5 minutes\',updated_at=now() where a=$1 and b=$2',[...ids,p.acct]);
    }else if(msg.op==='date_answer'){
      if(typeof msg.yes!=='boolean'||!r.romance_from||r.romance_from===p.acct||new Date(r.romance_until).getTime()<=now)throw Error('No current romantic invitation to answer.');
      const proposal=r.romance==='dating';
      if(msg.yes){
        if(s.flags.flirtOff||t.flags.flirtOff||r.friendship!=='accepted')throw Error('Romance settings or friendship changed.');
        if(proposal&&!t.items.ring)throw Error('The proposing player no longer owns the ring.');
        if(!proposal){
          if(s.flags.partner||t.flags.partner)throw Error('One player is already in a relationship.');
          await db.query('insert into life_partners(acct,other,a,b) values($1,$2,$3,$4),($2,$1,$3,$4)',[p.acct,other,...ids]);
        }else{delete t.items.ring;event(t,'engagement_ring_used',{with:p.acct},now);}
        r.romance=proposal?'engaged':'dating';Game.bump(s,'partner');Game.bump(t,'partner');
      }
      await db.query('update life_relations set romance=$3,romance_from=null,romance_until=null,updated_at=now() where a=$1 and b=$2',[...ids,r.romance]);
    }else if(msg.op==='social_basic'){
      if(!publicTogether(p,o))throw Error('Meet in the same public room first.');
      if(!['wave','chat','joke','compliment','gist'].includes(msg.kind))throw Error('Choose a shared activity with consent.');
      if(now-+r.last_social<60000)throw Error('Give this conversation a minute.');
      const gain=Math.min(friendshipGain(s,r,3,now),friendshipGain(t,r,3,now));r.points=Math.min(r.friendship==='accepted'?200:29,r.points+gain);
      for(const st of [s,t]){life(st).socialDay.points+=gain;st.n.social=Math.min(100,st.n.social+5);Game.bump(st,'social');}
      await db.query('update life_relations set points=$3,last_social=$4 where a=$1 and b=$2',[...ids,r.points,now]);
    }else if(msg.op==='shared_invite'){
      if(!publicTogether(p,o)||s.busy||t.busy||s.shift||t.shift)throw Error('Both players must be free in the same public room.');
      if(r.friendship!=='accepted')throw Error('Accept a mutual friend request first.');
      if(msg.kind==='date'&&!['dating','engaged'].includes(r.romance))throw Error('A date needs a mutually accepted relationship.');
      const def=sharedDefinition(msg.kind,s.place);if(!def||!Game.isOpen(Game.LOC[s.place],now))throw Error('That shared activity is not available here now.');
      if((await db.query("select 1 from life_shared where a=$1 and created_at>now()-interval '1 hour'",[p.acct])).rowCount>=5)throw Error('At most five shared invitations per hour.');
      const id=crypto.randomUUID();await db.query("insert into life_shared(id,a,b,kind,room,place,shard,terms,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '2 minutes')",[id,p.acct,other,msg.kind,p.room.key,s.place,CFG.shardId,JSON.stringify(def)]);
      return {message:'Shared activity invitation sent.',notify:other};
    }else throw Error('Unknown relationship action.');
  }
  mirror(s,r,other,target.name);if(states.has(other))mirror(states.get(other),r,p.acct,p.name);
  event(s,'relationship_change',{with:other,op:msg.op,friendship:r.friendship,romance:r.romance},now);
  return {message:'Relationship saved.',notify:other};
}
async function answerShared(db,shard,p,msg,states,now){
  const a=(await db.query('select * from life_shared where id=$1 and b=$2 for update',[msg.activity,p.acct])).rows[0];
  if(!a||a.status!=='pending'||new Date(a.expires_at).getTime()<=now||typeof msg.yes!=='boolean')throw Error('This invitation is no longer pending.');
  if(!msg.yes){await db.query("update life_shared set status='declined' where id=$1",[a.id]);return {message:'Invitation declined.'};}
  const o=shard.byAcct(a.a);if(!allowed(p,o,now)||!publicTogether(p,o)||p.room.key!==a.room||p.state.busy||o.state.busy||p.state.shift||o.state.shift)throw Error('Both players must be free together in the original room.');
  if(!states.has(o.acct))throw Error('The other participant is unavailable.');
  const def=a.terms||sharedDefinition(a.kind,a.place);if(!def||[p,o].some(x=>x.state.cash+x.state.momo<(def.cost||0)))throw Error('Both players need the menu price available.');
  const r=await relation(db,p.acct,o.acct);if(r.friendship!=='accepted'||a.kind==='date'&&!['dating','engaged'].includes(r.romance))throw Error('The relationship changed.');
  await db.query('insert into life_shared_members(acct,activity) values($1,$3),($2,$3)',[p.acct,o.acct,a.id]);
  await db.query("update life_shared set status='active',proof=$2,ready_at=now()+interval '30 seconds',expires_at=now()+interval '2 minutes' where id=$1",[a.id,JSON.stringify({[p.acct]:identity(p),[o.acct]:identity(o)})]);
  return {message:'Spend 30 seconds together here. Leaving cancels without charging.',notify:o.acct};
}
export async function socialView(db,p,s){
  const rows=(await db.query(`select r.*,case when a=$1 then b else a end as other,ac.username as name from life_relations r join accounts ac on ac.id=case when a=$1 then b else a end where a=$1 or b=$1 order by (a=$2 or b=$2) desc,(romance in ('dating','engaged')) desc,updated_at desc limit 50`,[p.acct,s.flags.partner||0])).rows;
  for(const r of rows)mirror(s,r,r.other,r.name);
  const sessions=(await db.query(`select x.id,x.a,x.b,x.kind,x.status,x.place,x.terms,x.expires_at,x.ready_at,a.username as starter,b.username as host from life_shared x join accounts a on a.id=x.a join accounts b on b.id=x.b where (x.a=$1 or x.b=$1) and status in ('pending','active') and expires_at>now() order by x.created_at desc limit 10`,[p.acct])).rows;
  return {rows:rows.map(r=>({name:r.name,points:r.points,friendship:r.friendship,requestIncoming:r.requester!==p.acct,friendUntil:r.friend_until,romance:r.romance,romanceIncoming:r.romance_from&&r.romance_from!==p.acct,romanceUntil:r.romance_until})),sessions:sessions.map(({terms,...a})=>({...a,incoming:a.b===p.acct,with:a.a===p.acct?a.host:a.starter,cost:terms?.cost||0}))};
}
export async function settleShared(shard){
  const rows=(await pool.query("select * from life_shared where shard=$1 and (status='active' or status='pending' and expires_at<=now()) order by coalesce(ready_at,expires_at) limit 100",[CFG.shardId])).rows;
  for(const a of rows){
    const p=shard.byAcct(a.a),o=shard.byAcct(a.b),now=Date.now();
    if(a.status==='pending'&&new Date(a.expires_at).getTime()>now)continue;
    if(a.status==='active'&&p&&o&&(p.moneyBusy||o.moneyBusy||p.pending||o.pending||p.gistPending||o.gistPending))continue;
    const eligible=a.status==='active'&&allowed(p,o,now)&&publicTogether(p,o)&&p.room.key===a.room&&a.proof?.[p.acct]===identity(p)&&a.proof?.[o.acct]===identity(o)&&!p.state.busy&&!o.state.busy&&!p.state.shift&&!o.state.shift;
    if(!eligible||new Date(a.expires_at).getTime()<=now){await cancelShared(a.id);continue;}
    if(new Date(a.ready_at).getTime()>now)continue;
    try{await withPlayers([p,o],async(db,states)=>{
      const row=(await db.query("select id from life_shared where id=$1 and status='active' for update",[a.id])).rows[0];if(!row)return;
      const r=await relation(db,p.acct,o.acct),def=a.terms||sharedDefinition(a.kind,a.place),loc=Game.LOC[a.place];
      if(!def||r.friendship!=='accepted'||!Game.isOpen(loc,now)||a.kind==='date'&&(!['dating','engaged'].includes(r.romance)||p.state.flags.flirtOff||o.state.flags.flirtOff))throw Error('Activity unavailable.');
      if(def.id&&!Game.isOpen({...loc,open:def.open||loc.open,days:def.days||loc.days},now))throw Error('This menu activity is closed.');
      const sp=states.get(p.acct),so=states.get(o.acct);const cost=def.cost||0;
      if([sp,so].some(s=>s.cash+s.momo<cost))throw Error('Insufficient funds at completion.');
      const gain=Math.min(friendshipGain(sp,r,5,now),friendshipGain(so,r,5,now));r.points=Math.min(200,r.points+gain);
      for(const [x,st,other]of [[p,sp,o],[o,so,p]]){
        Game.spendFor(st,cost,`Shared ${a.kind}`);for(const [k,v]of Object.entries(def.needs||{}))st.n[k]=Math.max(0,Math.min(100,st.n[k]+v*(def.min||30)/60));
        for(const [k,v]of Object.entries(def.inst||{}))if(k!=='food')st.n[k]=Math.max(0,Math.min(100,st.n[k]+v));
        for(const [k,v]of Object.entries(def.skill||{}))Game.gainSkill(st,k,v*(def.min||30)/60);
        life(st).shared++;life(st).socialDay.points+=gain;if(gain)life(st).social=Math.min(100,life(st).social+1);
        if(a.kind==='meal')st.stats.meals++;Game.bump(st,'social');mirror(st,r,other.acct,other.name);event(st,'shared_activity',{id:a.id,kind:a.kind,with:other.acct,cost,friendshipGain:gain},now);
      }
      await db.query('update life_relations set points=$3,updated_at=now() where a=$1 and b=$2',[...pair(p.acct,o.acct),r.points]);
      await db.query("update life_shared set status='completed',completed_at=now() where id=$1",[a.id]);await db.query('delete from life_shared_members where activity=$1',[a.id]);
    });for(const x of [p,o]){shard.send(x,{t:'st',state:Game.view(x.state)});shard.send(x,{t:'life_notice',message:'Shared activity completed. Friendship progress is saved.'});}
    }catch(e){await cancelShared(a.id);for(const x of [p,o])if(x&&!x.gone)shard.send(x,{t:'life_notice',message:'Shared activity cancelled without charging. Check availability and stay together in the original room.'});}
  }
}
async function cancelShared(id){
  const db=await pool.connect();try{await db.query('begin');await db.query("update life_shared set status='cancelled' where id=$1 and status in ('pending','active')",[id]);await db.query('delete from life_shared_members where activity=$1',[id]);await db.query('commit');}catch(e){await db.query('rollback');throw e;}finally{db.release();}
}
