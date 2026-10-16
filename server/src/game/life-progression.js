import {CAREERS,SKILLS} from './data.js';

// Additive state only: old wallet, skill, property and career fields stay valid.
export function life(s){
  s.life ||= {}; const l=s.life;l.seq ||= 0;l.queue ||= [];l.careers ||= {};
  l.professional ||= 0;l.social ||= 0;l.legal ||= {attempts:0,caught:0,fines:0};
  l.business ||= {created:0,sales:0,profit:0};l.commerce ||= {bought:0,sold:0};
  l.shared ||= 0;return l;
}
export function event(s,type,facts={},now=Date.now()){
  const l=life(s);const e={seq:++l.seq,type,at:now,facts};l.queue.push(e);
  // Durable actions flush before acknowledgment; ordinary progression is batched.
  if(l.queue.length>256)throw Error('Progress journal must be saved before more actions');
  return e;
}
export function moneyEvent(s,delta,label,now=Date.now()){
  if(delta)event(s,'money',{delta,label,balance:s.cash+s.momo},now);
}
export function careerRecord(s,id=s.job?.id){
  if(!Object.hasOwn(CAREERS,id||''))return null;
  const l=life(s),current=s.job?.id===id?s.job:null;
  return l.careers[id] ||= {shifts:current?.shifts||0,minutes:0,assignments:0,bestRank:current?.rank||0,reputation:0};
}
export function rememberCareer(s){
  const j=s.job;if(!j)return;const c=careerRecord(s,j.id);
  c.bestRank=Math.max(c.bestRank,j.rank);c.saved={...j};
}
export function workCompleted(s,task,now){
  const c=careerRecord(s);if(!c)return;c.assignments++;c.reputation=Math.min(100,c.reputation+(task.correct?2:1));
  life(s).professional=Math.min(100,life(s).professional+(task.correct?1:.5));
  event(s,'work_assignment',{career:s.job.id,task:task.id,quality:task.correct?'careful':'completed'},now);
}
export function shiftCompleted(s,minutes,pay,promoted,now){
  const existing=s.life?.careers?.[s.job.id],c=careerRecord(s);c.shifts=existing?c.shifts+1:Math.max(1,s.job.shifts);c.minutes+=Math.round(minutes);c.bestRank=Math.max(c.bestRank,s.job.rank);
  c.reputation=Math.min(100,c.reputation+1);rememberCareer(s);
  event(s,'career_shift',{career:s.job.id,minutes:Math.round(minutes),pay,rank:s.job.rank,promoted:!!promoted},now);
}
export function legalOutcome(s,{action,risk,caught,fine=0},now){
  const l=life(s),v=l.legal;v.attempts++;v.caught+=caught?1:0;v.fines+=fine;
  if(caught)v.reviewUntil=Math.max(v.reviewUntil||0,now+86400000);
  v.last={action,risk,caught,fine,at:now};event(s,'legal_outcome',v.last,now);
}
export function employmentRestriction(s,id,now=Date.now()){
  const until=s.life?.legal?.reviewUntil||0;
  return ['bank','police'].includes(id)&&until>now?`New applications here reopen after your game conduct review: ${new Date(until).toUTCString()}. Your existing career is retained.`:null;
}
export const SKILL_EFFECTS={
  hustle:'Market gigs, phone resale values and provision-shop demand',charisma:'Public-facing careers, social choices and food-joint demand',
  coding:'Technical/academic careers, projects, repairs and accessory-shop demand',cooking:'Food-service careers, cooking and food-joint demand',
  fitness:'Sport, manual work and relevant career eligibility',dance:'Dance recreation and performance',music:'Music practice and nightlife work',
  comedy:'Comedy activities and broadcasting careers',driving:'Existing transport-related career eligibility and gigs',photo:'Photography and fashion careers',
};
export function progressionView(s,now=Date.now()){
  const l=life(s),j=s.job,c=j&&CAREERS[j.id],h=j&&careerRecord(s);
  return {professional:l.professional,social:l.social,legal:{...l.legal,heat:s.heat||0,reviewActive:(l.legal.reviewUntil||0)>now},
    careers:l.careers,current:j?{id:j.id,title:c.ranks[j.rank][0],rank:j.rank,grade:j.grade,performance:j.perf,
      lifetimeShifts:h.shifts,assignments:h.assignments,minutes:h.minutes,reputation:h.reputation,
      next:c.ranks[j.rank+1]?.[0]||null,review:employmentRestriction(s,j.id,now)}:null,
    skills:Object.entries(SKILLS).map(([id,name])=>({id,name,value:s.skills[id]||0,max:10,effect:SKILL_EFFECTS[id],
      growth:'Activities and attended work; growth slows as your skill rises.'}))};
}
