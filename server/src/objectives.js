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
  {id:'career_five',category:'long',title:'Build a work record',description:'Complete five recorded career shifts.',xp:25,action:'progression'},
  {id:'career_promotion',category:'long',title:'Earn a promotion',description:'Reach a higher career rank through existing eligibility rules.',xp:25,badge:'Moving forward',action:'progression'},
  {id:'skill_three',category:'long',title:'Develop a practical skill',description:'Reach level three in an existing skill.',xp:20,action:'progression'},
  {id:'savings_target',category:'long',title:'Build a savings reserve',description:'After earning income, place at least GH₵1,000 in existing fixed savings.',xp:20,action:'bank'},
  {id:'business_start',category:'long',title:'Open your own operation',description:'Create a managed business with game money.',xp:20,action:'enterprise'},
  {id:'business_sale',category:'long',title:'Make a first business sale',description:'Sell stocked goods through settled simulated demand.',xp:20,action:'enterprise'},
  {id:'business_profit',category:'long',title:'Reach operating profit',description:'Accumulate GH₵100 operating profit in managed businesses.',xp:25,action:'enterprise'},
  {id:'player_trade',category:'long',title:'Trade with another player',description:'Complete a permitted phone resale purchase or receive its sale proceeds.',xp:20,action:'market'},
  {id:'mutual_friend',category:'long',title:'Build a mutual friendship',description:'Accept a real player friend request.',xp:15,action:'relationships'},
  {id:'shared_five',category:'long',title:'Make time for people',description:'Complete five consented shared venue activities.',xp:25,badge:'Good company',action:'relationships'},
  {id:'home_ownership',category:'long',title:'A home of your own',description:'Buy a home through the existing property system.',xp:25,action:'houses'},
  {id:'own_vehicle',category:'long',title:'Your own vehicle',description:'Own a vehicle from the existing catalogue.',xp:20,action:'cars'},
  {id:'first_home',title:'Establish your first home',description:'Rent or buy a place to live in the Houses app.',xp:15,action:'houses'},
  {id:'useful_place',title:'Use a local place',description:'Finish any activity at a venue, such as a meal, a game or a service.',xp:10,action:'interact'},
  {id:'meet_try',title:'Say hello to someone',description:'Send an introduction, a message or a greeting to another player. Trying counts, even when nobody is online.',xp:10,action:'meet'},
  {id:'first_earning',title:'Earn your first cedis',description:'Finish a paid work session or a local hustle or gig.',xp:15,action:'jobs'},
  {id:'career_look',title:'Explore careers',description:'Open Jobs and look at what each career needs.',xp:10,action:'jobs'},
  {id:'needs_check',title:'Check how you dey',description:'Open your character status and review your needs.',xp:10,action:'status'},
];
// The first-session path shown on the main HUD. Any order works; the HUD suggests the first open one.
export const FIRST_SESSION=['first_home','first_street','useful_place','meet_try','career_look','first_earning','needs_check','social_hub'];
export const SEEN=['careers','needs'];
export function progressOf(s,id,friend=false,tried=false){
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
    case 'career_five':return Object.values(s.life?.careers||{}).reduce((n,c)=>n+c.shifts,0)>=5;
    case 'career_promotion':return s.stats.promos>0;
    case 'skill_three':return Object.values(s.skills).some(v=>v>=3);
    case 'savings_target':return s.stats.earned>0&&(s.flags.fixed?.amount||0)>=1000;
    case 'business_start':return (s.life?.business?.created||0)>0;
    case 'business_sale':return (s.life?.business?.sales||0)>0;
    case 'business_profit':return (s.life?.business?.profit||0)>=100;
    case 'player_trade':return (s.life?.commerce?.bought||0)+(s.life?.commerce?.sold||0)>0;
    case 'mutual_friend':return Object.values(s.friends).some(f=>f.accepted&&f.pts>=30);
    case 'shared_five':return (s.life?.shared||0)>=5;
    case 'home_ownership':return Object.values(s.owned).some(v=>v===true);
    case 'own_vehicle':return !!s.car;
    case 'first_home':return !!s.home||Object.values(s.owned||{}).some(v=>v===true);
    case 'useful_place':return Object.entries(count).some(([k,v])=>k.startsWith('act:')&&v>0)||s.stats.meals>0;
    case 'meet_try':return tried||friend||count.social>0||count.dm>0;
    case 'first_earning':return s.stats.shifts>0||s.stats.gigs>0;
    case 'career_look':return !!s.flags?.seen?.careers||!!s.job;
    case 'needs_check':return !!s.flags?.seen?.needs;
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
  const intro=(await db.query('select exists(select 1 from intro_completions where acct=$1) as completed,coalesce((select opted_out from intro_profiles where acct=$1),false) as paused,exists(select 1 from intro_profiles where acct=$1 and requested_at is not null) or exists(select 1 from intro_matches where initiator=$1) as tried',[acct])).rows[0];
  const friend=intro.completed;
  const defs=DEFINITIONS.filter(d=>d.eligibility!=='first_week'||newPlayerEligible(state)&&!intro.paused||friend);
  for(const d of defs){const progress=progressOf(state,d.id,friend,intro.tried)?1:0;
    await db.query(`insert into player_objectives(acct,objective,progress,completed_at) values($1,$2,$3,case when $3=1 then now() end)
      on conflict(acct,objective) do update set progress=greatest(player_objectives.progress,excluded.progress),completed_at=coalesce(player_objectives.completed_at,excluded.completed_at)`,[acct,d.id,progress]);
  }
  const records=(await db.query('select objective,progress,completed_at,claimed_at from player_objectives where acct=$1',[acct])).rows;
  return defs.map(d=>{const r=records.find(r=>r.objective===d.id);return {...d,first:FIRST_SESSION.includes(d.id)?FIRST_SESSION.indexOf(d.id)+1:0,eligible:true,progress:r.progress,target:1,completed:!!r.completed_at,claimed:!!r.claimed_at,reward:{xp:d.xp,cash:0,badge:d.badge||null}};});
}
export async function list(p,seen){
  if(!p.state.onboarded)return {t:'objectives',rows:[]};
  // 'seen' only records that a guidance screen was opened (one-time, bounded XP on claim).
  const mark=SEEN.includes(seen)&&!p.state.flags?.seen?.[seen]?seen:null;
  const rows=await withMoney(p,(db,state)=>{if(mark)state.flags.seen={...(state.flags.seen||{}),[mark]:true};return sync(db,p.acct,state);});
  return {t:'objectives',rows:rows||[],...(mark?{state:Game.view(p.state)}:{})};
}
export async function claim(p,id){
  if(typeof id!=='string'||!DEFINITIONS.some(d=>d.id===id)||!p.state.onboarded)return {t:'objective_error',error:'Choose an available milestone.'};
  const result=await withMoney(p,async(db,state)=>{
    const rows=await sync(db,p.acct,state),d=rows.find(d=>d.id===id);
    if(!d?.completed)return {error:'This milestone is not complete.'};
    const changed=await db.query('update player_objectives set claimed_at=now() where acct=$1 and objective=$2 and completed_at is not null and claimed_at is null returning objective',[p.acct,id]);
    if(changed.rowCount){
      await db.query('insert into objective_rewards(acct,objective,xp,badge) values($1,$2,$3,$4)',[p.acct,id,d.xp,d.badge||null]);
      Game.awardXp(state,d.xp);if(d.badge)state.flags.discoveryBadges=[...new Set([...(state.flags.discoveryBadges||[]),d.badge])];
    }
    d.claimed=true;return {rows,claimed:id};
  });
  if(!result||result.error)return {t:'objective_error',error:result?.error||'Account disconnected.'};
  return {t:'objectives',...result,state:Game.view(p.state)};
}
