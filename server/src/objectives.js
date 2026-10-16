import {pool} from './db.js';
import {withMoney} from './account-money.js';
import * as Game from './game/rules.js';
import {newPlayerEligible} from './first-friend.js';
export const DEFINITIONS=[
  {id:'first_street',title:'Step into your neighbourhood',description:'Leave your room and explore a local street.',xp:15,next:'first_meal',action:'home'},
  {id:'first_meal',title:'Find your first meal',description:'Buy and finish a meal at an existing food venue.',xp:15,next:'first_market',action:'explore'},
  {id:'first_market',title:'Visit a market',description:'Arrive at Makola or Kantamanto and look around.',xp:20,next:'first_trip',action:'explore'},
  {id:'first_trip',title:'Make a city journey',description:'Finish a journey using the existing travel system.',xp:15,next:'two_areas',action:'map'},
  {id:'social_hub',title:'Find a gathering place',description:'Visit Labadi, Vibes, UG or the Jamestown neighbourhood.',xp:20,next:'first_social',action:'explore'},
  {id:'first_social',title:'Meet someone nearby',description:'Complete a social interaction with another player.',xp:20,next:'first_dm',action:'explore'},
  {id:'first_dm',title:'Send a private hello',description:'Send an accepted text or message request through Messages.',xp:15,next:'first_friend',action:'messages'},
  {id:'first_friend',title:'Your first friend in Accra',description:'Opt in to an introduction and receive an eligible reply.',xp:25,badge:'First friend',eligibility:'first_week',action:'meet'},
  {id:'first_shift',title:'Complete a work shift',description:'Attend work and finish a paid shift.',xp:25,next:'return_home',action:'jobs'},
  {id:'first_outfit',title:'Make your look your own',description:'Save an actual change to your outfit or appearance.',xp:15,action:'boutique'},
  {id:'two_areas',title:'Explore two districts',description:'Visit public destinations in two different areas.',xp:25,badge:'City explorer',action:'explore'},
  {id:'return_home',title:'Find your way home',description:'Return home after exploring a public destination.',xp:15,badge:'At home in Accra',action:'home'},
];
export function progressOf(s,id,friend=false){
  const visits=Object.keys(s.discovery?.visited||{}),count=s.cnt||{};
  switch(id){
    case 'first_street':return visits.some(id=>id.startsWith('n:'));
    case 'first_meal':return s.stats.meals>0;
    case 'first_market':return visits.some(id=>['makola','kantamanto'].includes(id));
    case 'first_trip':return Object.entries(count).some(([k,v])=>k.startsWith('travel:')&&v>0);
    case 'social_hub':return visits.some(id=>['labadi','vibes','ug','n:jtown'].includes(id));
    case 'first_social':return count.social>0;
    case 'first_dm':return count.dm>0;
    case 'first_friend':return friend;
    case 'first_shift':return s.stats.shifts>0;
    case 'first_outfit':return count.outfit>0;
    case 'two_areas':return new Set(visits.map(id=>Game.LOC[id]).filter(l=>l&&!l.estate).map(l=>l.area)).size>=2;
    case 'return_home':return !!s.discovery?.returned;
    default:return false;
  }
}
export async function migrateObjectives(){
  await pool.query(`create table if not exists objective_definitions(id text primary key,spec jsonb not null);
    create table if not exists player_objectives(acct int not null references accounts(id),objective text not null references objective_definitions(id),progress int not null default 0,completed_at timestamptz,claimed_at timestamptz,primary key(acct,objective));
    create table if not exists objective_rewards(acct int not null,objective text not null,xp int not null,badge text,at timestamptz default now(),primary key(acct,objective),foreign key(acct,objective) references player_objectives(acct,objective));`);
  for(const d of DEFINITIONS)await pool.query('insert into objective_definitions(id,spec) values($1,$2) on conflict(id) do update set spec=excluded.spec',[d.id,JSON.stringify(d)]);
}
async function sync(db,acct,state){
  const intro=(await db.query('select exists(select 1 from intro_completions where acct=$1) as completed,coalesce((select opted_out from intro_profiles where acct=$1),false) as paused',[acct])).rows[0];
  const friend=intro.completed;
  const defs=DEFINITIONS.filter(d=>d.eligibility!=='first_week'||newPlayerEligible(state)&&!intro.paused||friend);
  for(const d of defs){const progress=progressOf(state,d.id,friend)?1:0;
    await db.query(`insert into player_objectives(acct,objective,progress,completed_at) values($1,$2,$3,case when $3=1 then now() end)
      on conflict(acct,objective) do update set progress=greatest(player_objectives.progress,excluded.progress),completed_at=coalesce(player_objectives.completed_at,excluded.completed_at)`,[acct,d.id,progress]);
  }
  const records=(await db.query('select objective,progress,completed_at,claimed_at from player_objectives where acct=$1',[acct])).rows;
  return defs.map(d=>{const r=records.find(r=>r.objective===d.id);return {...d,eligible:true,progress:r.progress,target:1,completed:!!r.completed_at,claimed:!!r.claimed_at,reward:{xp:d.xp,cash:0,badge:d.badge||null}};});
}
export async function list(p){
  if(!p.state.onboarded)return {t:'objectives',rows:[]};
  const rows=await withMoney(p,(db,state)=>sync(db,p.acct,state));
  return {t:'objectives',rows:rows||[]};
}
export async function claim(p,id){
  if(typeof id!=='string'||!DEFINITIONS.some(d=>d.id===id)||!p.state.onboarded)return {t:'objective_error',error:'Choose an available milestone.'};
  const result=await withMoney(p,async(db,state)=>{
    const rows=await sync(db,p.acct,state),d=rows.find(d=>d.id===id);
    if(!d?.completed)return {error:'This milestone is not complete.'};
    const changed=await db.query('update player_objectives set claimed_at=now() where acct=$1 and objective=$2 and completed_at is not null and claimed_at is null returning objective',[p.acct,id]);
    if(changed.rowCount){
      await db.query('insert into objective_rewards(acct,objective,xp,badge) values($1,$2,$3,$4)',[p.acct,id,d.xp,d.badge||null]);
      state.xp+=d.xp;if(d.badge)state.flags.discoveryBadges=[...new Set([...(state.flags.discoveryBadges||[]),d.badge])];
    }
    d.claimed=true;return {rows,claimed:id};
  });
  if(!result||result.error)return {t:'objective_error',error:result?.error||'Account disconnected.'};
  return {t:'objectives',...result,state:Game.view(p.state)};
}
