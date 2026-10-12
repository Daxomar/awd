// A shared weekly community ballot, backed by real players' votes.
import {pool} from './db.js';
export const PRIORITIES=[{id:1,name:'Public transport'},{id:2,name:'Affordable food'},{id:3,name:'Housing and neighbourhoods'}];
export async function ballot(p,m){
 if(!p.state.onboarded)return {t:'toast',k:'bad',m:'Create your character first.'};
 const week=Math.floor((Date.now()/86400000+3)/7);
 if(m.choice!==undefined){if(!PRIORITIES.some(r=>r.id===m.choice))return {t:'toast',k:'bad',m:'Choose a community priority.'};await pool.query('insert into votes(week,account,cand) values($1,$2,$3) on conflict(week,account) do update set cand=excluded.cand',[week,p.acct,m.choice]);}
 const [totals,mine]=await Promise.all([pool.query('select cand,count(*)::int n from votes where week=$1 group by cand',[week]),pool.query('select cand from votes where week=$1 and account=$2',[week,p.acct])]);
 return {t:'ballot',week,mine:mine.rows[0]?.cand,rows:PRIORITIES.map(r=>({...r,votes:totals.rows.find(v=>v.cand===r.id)?.n||0}))};
}
