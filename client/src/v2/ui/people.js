// Current public profile + server-permitted social actions. Scoped listeners die
// with the menu, including failed or abandoned profile loads.
import {h,ic,sheet,closeSheets} from './dom.js';
import {G} from '../store.js';
import {net} from '../net.js';
import {portrait} from './portrait.js';
export const SOCIALS=[['wave','icon:hand-waving','Wave',0],['chat','icon:chat-circle-dots','Talk',0],['joke','icon:smiley','Joke',0],['compliment','icon:star','Praise',3],['gist','icon:chat-circle-dots','Gist',8],['dance','icon:person-simple-dance','Dance',10],['hug','icon:smiley','Hug',25],['flirt','icon:smiley','Flirt',35],['askout','icon:envelope','Ask out',70],['propose','icon:diamond','Propose',120]];
export const LEVELS=[[0,'Stranger'],[10,'Acquaintance'],[30,'Friend'],[70,'Good friend'],[120,'Best friend']];
export const level=pts=>LEVELS.filter(([t])=>pts>=t).pop()[1];
export function openPerson(pid,name,act){
 closeSheets();let offProfile=()=>{},profileTimer,disposed=false,finishSocial;
 const body=h('div.sheet-body'),error=h('p.context-error',{role:'alert',hidden:true}),notice=h('p.context-state',{role:'status'});
 const sh=sheet(body,{title:'@'+name,sub:'In this place with you',onclose:()=>{disposed=true;offProfile();clearTimeout(profileTimer);finishSocial?.(false,Error('Menu closed.'));act.clearFocus?.();}});
 act.focusPerson?.(pid);
 const fail=message=>{if(disposed)return;error.hidden=false;error.textContent=message;};
 function load(){
  offProfile();clearTimeout(profileTimer);body.replaceChildren(h('p.context-hint',null,'Getting this player’s profile…'),error);error.hidden=true;
  if(!net.connected){showRetry('Reconnect before opening this profile.');return;}
  offProfile=net.on('profile',m=>{if(m.p?.name?.toLowerCase()!==name.toLowerCase())return;offProfile();clearTimeout(profileTimer);if(!disposed)render(m.p);});
  profileTimer=setTimeout(()=>{offProfile();showRetry('The profile could not be loaded. Try again.');},10000);net.send({t:'profile',name});
 }
 function showRetry(message){fail(message);body.replaceChildren(error,h('button.btn.primary.wide',{onclick:load},'Try again'));}
 function social(kind){
  if(!net.connected)return Promise.reject(Error('Reconnect before interacting.'));
  return new Promise((resolve,reject)=>{
   let timer;const offs=[];finishSocial=(ok,m)=>{offs.forEach(off=>off());clearTimeout(timer);finishSocial=null;ok?resolve(m):reject(m);};
   offs.push(net.on('social_done',m=>{if(m.with?.toLowerCase()===name.toLowerCase()&&m.kind===kind)finishSocial?.(true,m);}),net.on('rsocial',m=>{if(kind==='propose'&&m.a===G.myId&&m.b===pid&&m.kind===kind)finishSocial?.(true,m);}),net.on('toast',m=>{
    // Ask-out sends a personal confirmation toast, not social_done or rsocial.
    if(kind==='askout'&&m.m?.trim()===`You asked ${name} out. Waiting…`)finishSocial?.(true,m);
    else finishSocial?.(false,Error(m.m));
   }),net.on('connection',m=>{if(!m.connected)finishSocial?.(false,Error('Connection lost. Try again when you reconnect.'));}));
   timer=setTimeout(()=>finishSocial?.(false,Error('The interaction was not confirmed. Try again.')),10000);net.send({t:'social',id:pid,kind});
  });
 }
 function render(p){
  const pts=p.friend||0;let pending=false;
  const card=h('div.pcard',null,portrait(p.look,name,'pav'),h('div.grow',null,h('strong',null,'@'+p.name),h('p.muted',null,[p.title,p.job].filter(Boolean).join(' · ')),h('small',null,level(pts)+' · '+pts+' friendship')));
  const socs=h('div.socials',null,...SOCIALS.map(([kind,icon,label,min])=>h('button.soc'+(pts<min?'.locked':''),{'aria-disabled':String(pts<min),onclick:async()=>{
   if(pending)return;if(pts<min){fail(`Reach ${min} friendship to ${label.toLowerCase()}.`);return;}
   pending=true;error.hidden=true;notice.textContent='Waiting for confirmation…';socs.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{await social(kind);if(!disposed){act.socialFx?.(pid,kind);sh.close();}}catch(e){fail(e.message);}finally{pending=false;notice.textContent='';socs.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }},h('span.se',null,icon),label)));
  const button=(text,icon,fn)=>h('button.world-row',{onclick:()=>{sh.close();fn();}},ic(icon),h('span',null,text),ic('caret-right'));
  body.replaceChildren(card,h('h3.panel-heading',null,'Spend time together'),socs,notice,error,h('h3.panel-heading',null,'Keep in touch'),
   button('Private message','chat-circle-text',()=>act.message(p.name)),button('Send money','hand-coins',()=>act.sendMoney(p.name)),button('Challenge to Oware','squares-four',()=>act.oware(pid,p.name)),
   button('Report player','flag',()=>net.send({t:'report',id:pid,reason:'Reported from player card'})),button(p.blocked?'Unblock':'Block','prohibit',()=>net.send({t:'block',name:p.name,on:!p.blocked})));
 }
 load();return sh;
}
