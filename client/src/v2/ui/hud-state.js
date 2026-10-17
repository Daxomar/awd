// Presentation derives only from confirmed game state, never inferred rewards.
export function confirmRoomArrival(state,message){
 state.place=message.place;
 // The authoritative room can arrive before the periodic player-state update.
 // End only the obsolete travel overlay/state, preserving ordinary activities.
 if(state.busy?.travel)state.busy=null;
 if(Object.hasOwn(message,'streetReturn'))state.streetReturn=message.streetReturn;
}
export const NEEDS = {
 hunger: {label:'Hunger',icon:'bowl-food',tip:'Eat at a food joint or cook at home.'},
 energy: {label:'Energy',icon:'lightning',tip:'Sleep or take a nap to restore energy.'},
 fun: {label:'Fun',icon:'confetti',tip:'Enjoy music, games, TV or a day out.'},
 social: {label:'Social',icon:'chat-circle-dots',tip:'Chat with other players or spend time together.'},
 hygiene: {label:'Hygiene',icon:'shower',tip:'Have a bath at home or use a nearby washroom.'},
 bladder: {label:'Bladder',icon:'toilet',tip:'Use the toilet at home or a venue washroom.'},
};
export function needView(value,previous){
 const v=Math.round(Math.max(0,Math.min(100,Number.isFinite(value)?value:0)));
 const rising=Number.isFinite(previous)&&v>previous+.5;
 return {value:v,status:v<20?'critical':rising?'recovering':v<45?'declining':'normal',label:v<20?'Critical':rising?'Recovering':v<45?'Low':'Good'};
}
export function locationView(state,cat,roomName=''){
 if(state?.busy?.travel)return {name:'On the road',area:state.busy.label||'Travelling'};
 const place=state?.place;
 if(place==='home'){const home=cat?.homes?.[state.home];return {name:'Home',area:home?.area||roomName||'Accra'};}
 const l=cat?.locs?.find(l=>l.id===place);
 return {name:l?.name||roomName||'Accra',area:l?.area||(place?.startsWith('visit:')?'Visiting a player':'Accra')};
}
export function activityView(state,now){
 const b=state?.busy,sh=state?.shift;if(!b&&!sh)return null;
 const start=b?.start??sh.start,end=b?.end??(sh.start+3600000);
 const progress=Math.max(0,Math.min(1,(now-start)/Math.max(1,end-start)));
 return {id:b?`${b.id}:${start}`:`shift:${start}`,label:b?.label||'At work',progress,remaining:Math.max(0,Math.ceil((end-now)/1000)),canCancel:!!b&&!b.travel&&!b.mg,travel:!!b?.travel,shift:!b&&!!sh};
}
export function walletValue(s){return (Number.isFinite(s?.cash)?s.cash:0)+(Number.isFinite(s?.momo)?s.momo:0);}
export function moodView(s){const m=Number.isFinite(s?.mood)?s.mood:0;return {value:m,label:m>15?'Feeling good':m> -15?'Taking it easy':'Needs attention',icon:m>15?'smiley':m> -15?'smiley-meh':'smiley-sad'};}
export function zoneActions(z,actions){return (z.acts||[]).map(id=>actions.find(a=>a.id===id)).filter(Boolean);}

// Stage 6 Which objectives the HUD guides: the first-session path (plus First Friend while it is open),
// then the next unclaimed long-term goal once the introduction is done.
export function hudRows(rows){
  const all=rows||[],first=all.filter(d=>d.first).sort((a,b)=>a.first-b.first);
  const friend=all.find(d=>d.id==='first_friend');
  const path=friend?[...first,friend]:first;
  if(path.some(d=>!d.claimed))return {label:'Getting started',rows:path};
  const next=all.find(d=>!d.claimed);
  return {label:'Next goal',rows:next?[next]:[]};
}
export function currentObjective(view){
  return view.rows.find(d=>d.completed&&!d.claimed)||view.rows.find(d=>!d.completed)||null;
}
