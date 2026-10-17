// Compact world HUD. Secondary systems remain in the phone or the status sheet.
import {h,ic,cedi,sheet,closeSheets} from './dom.js';
import {portrait} from './portrait.js';
import {G,accraClock,accraNow} from '../store.js';
import {NEEDS,needView,locationView,activityView,walletValue,moodView,zoneActions} from './hud-state.js';
import {buildObjectives} from './objectives-hud.js';
import {net} from '../net.js';
import {activeLifeEvent} from './life-event.js';
import './game-ui.css';

export function buildHud(ui,act){
 const name=h('strong'),condition=h('small'),face=h('span.player-face');
 const identity=h('button.player-status',{'aria-label':'Character status','aria-expanded':'false',onclick:()=>openStatus()},face,h('span.player-copy',null,name,condition),ic('caret-down'));
 const balance=h('strong.tnum'),wallet=h('button.wallet-control',{'aria-label':'Open wallet',onclick:()=>act.wallet()},ic('wallet'),balance);
 const online=h('span.online-count');
 const population=h('span.hud-population',null,h('span.connection-dot',{'aria-hidden':'true'}),online);
 const location=h('span.current-location'),time=h('time'),place=h('button.location-control',{'aria-label':'Current location and city map',onclick:()=>act.map()},ic('map-pin'),h('span.location-copy',null,location,population),time,ic('caret-right'));
 const offline=h('p.connection-note',{hidden:true,role:'status'},ic('wifi-slash'),'Reconnecting. Your saved life is safe.');
 const top=h('header.hud.play-hud',{'aria-label':'Player and location'},h('div.hud-surface',null,h('div.hud-top',null,identity,wallet),place),offline);
 const streetName=h('span'),entrance=h('button.street-entrance',{hidden:true,onclick:()=>{if(nearbyZone)act.openZone(nearbyZone);}});
 const streetRow=h('div.street-context',{hidden:true},streetName,entrance);top.querySelector('.hud-surface').append(streetRow);
 const objectives=buildObjectives(act);top.querySelector('.hud-surface').append(objectives.el);
 const lifeChip=h('button.life-chip',{hidden:true,onclick:()=>act.lifeEvent()});top.querySelector('.hud-surface').append(lifeChip);
 let nearbyZone=null,streetKey='';
 const busy=h('div.busy.activity-hud',{hidden:true}),zones=h('div.zones.interaction-options'),chips=h('div.status-extras');
 const navBtn=(id,icon,label)=>h('button',{'data-nav':id,'aria-label':label,onclick:()=>act.nav(id)},ic(icon),h('span',null,label),h('span.badge',{hidden:true}));
 const nav=h('nav.nav.play-nav',{'aria-label':'Game controls'},navBtn('home','house','Home'),navBtn('map','map-trifold','Map'),navBtn('interact','hand-tap','Interact'),navBtn('chat','chat-circle-dots','Chat'),navBtn('phone','device-mobile','Phone'));
 const bottom=h('div.bottom.play-bottom',null,busy,nav),chatlog=h('div.chatlog',{ 'aria-hidden':'true' });
 ui.append(top,chatlog,bottom);
 let lookSig='',needSig='',extrasSig='',lastNeeds={},needViews={},statusDraw=null;
 const patch=(el,text)=>{if(el.textContent!==text)el.textContent=text;};
 function openStatus(){
  closeSheets();identity.setAttribute('aria-expanded','true');const content=h('div.sheet-body.status-body');
  if(G.objectives?.some(d=>d.id==='needs_check'&&!d.completed))net.send({t:'objective_status',seen:'needs'});
  statusDraw=()=>{
   const s=G.state,m=moodView(s),career=G.cat.careers[s.job?.id];
   if(content.childElementCount){
    patch(content.querySelector('.status-identity h3'),s.name);patch(content.querySelector('.status-identity p'),`${m.label} (${m.value>0?'+':''}${m.value})`);
    for(const button of content.querySelectorAll('[data-need]')){const k=button.dataset.need,v=needViews[k]||needView(s.n?.[k]);button.dataset.status=v.status;button.setAttribute('aria-label',`${NEEDS[k].label}: ${v.value} out of 100. ${v.label}`);patch(button.querySelector('strong'),String(v.value));patch(button.querySelector('small'),v.label);button.querySelector('.need-track i').style.width=v.value+'%';}
    patch(content.querySelector('.status-links .world-row span'),career?career.ranks[s.job.rank]?.[0]||career.name:'Find your next opportunity');return;
   }
   content.replaceChildren(h('div.status-identity',null,portrait(s.look,s.name,'status-portrait'),h('div',null,h('h3',null,s.name),h('p',null,m.label,` (${m.value>0?'+':''}${m.value})`))),h('h3.panel-heading',null,'Your needs'),h('div.needs',null,...Object.entries(NEEDS).map(([k,n])=>{
    const v=needViews[k]||needView(s.n?.[k]);return h('button.need-detail',{'data-need':k,'data-status':v.status,'aria-label':`${n.label}: ${v.value} out of 100. ${v.label}`,onclick:()=>openNeed(k)},h('span.need-heading',null,ic(n.icon),n.label,h('strong',null,String(v.value))),h('span.need-track',null,h('i',{style:{width:v.value+'%'}})),h('small',null,v.label));
   })),h('h3.panel-heading',null,'Your life'),h('div.status-links',null,
    actionLink('briefcase',career?career.ranks[s.job.rank]?.[0]||career.name:'Find your next opportunity',()=>act.work()),
    actionLink('users','Relationships & contacts',()=>act.phone('contacts')),
    actionLink('user-circle',`Your life · reputation ${s.rep||0}`,()=>act.me()),
    actionLink('speaker-high','Sound settings',()=>act.sound()),actionLink('question','Quick tour',()=>act.tutorial())),chips);
  };
  statusDraw();sheet(content,{title:'How you dey?',sub:'Your character and what they need',onclose:()=>{identity.setAttribute('aria-expanded','false');statusDraw=null;}});
 }
 function actionLink(icon,label,fn){return h('button.world-row',{onclick:()=>{closeSheets();fn();}},ic(icon),h('span',null,label),ic('caret-right'));}
 function openNeed(key){
  closeSheets();const s=G.state,n=NEEDS[key],v=needViews[key]||needView(s.n?.[key]);
  const context=act.context?.(),options=[];
  if(context)for(const z of context.spec?.zones||[])for(const a of zoneActions(z,context.actions))if((a.fx?.[key]||0)>0)options.push({z,a});
  const body=h('div.sheet-body.need-explanation',null,h('div.need-score',{'data-status':v.status},ic(n.icon),h('strong',null,String(v.value)),h('span',null,'/ 100 · '+v.label)),h('p',null,n.tip),h('h3.panel-heading',null,options.length?'Available here':'Look around Accra'),...options.slice(0,5).map(({z,a})=>actionLink(z.icon?.replace('ph-','')||n.icon,a.label,()=>act.openZone(z))),options.length?null:h('p.muted',null,'There is no matching activity in this room.'),actionLink('map-trifold','Open city map',()=>act.map()),actionLink('heart','Health details in your phone',()=>act.needs()));
  sheet(body,{title:n.label,sub:'Based on your current needs'});
 }
 const H={top,zones,nav,chips,busy,bottom,chatlog,
  objective(rows){objectives.update(rows);},
  setNav(id){for(const b of nav.children){const on=b.dataset.nav===id;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));}},
  badge(id,n){const b=nav.querySelector(`[data-nav="${id}"] .badge`);if(b){b.hidden=!n;patch(b,n>99?'99+':String(n));}},
  stats(){const s=G.state;if(!s)return;
   patch(name,s.name);const m=moodView(s),critical=Object.keys(NEEDS).find(k=>(s.n?.[k]??100)<20);
   patch(condition,s.jail>0?'In police custody':s.sick?(s.sick.kind||'Feeling unwell'):critical?NEEDS[critical].label+' needs attention':m.label);identity.classList.toggle('critical',!!critical||!!s.sick);
   patch(balance,cedi(walletValue(s),true));wallet.setAttribute('aria-label',`Wallet ${cedi(walletValue(s))}. Open MoMo`);
   const look=JSON.stringify(s.look);if(look!==lookSig){lookSig=look;face.replaceChildren(portrait(s.look,s.name,'hud-portrait'));}
   const sig=JSON.stringify(s.n);if(sig!==needSig){needSig=sig;for(const k of Object.keys(NEEDS))needViews[k]=needView(s.n?.[k],lastNeeds[k]);lastNeeds={...s.n};}statusDraw?.();
  },
  clock(){if(!G.state)return;const c=accraClock(),l=locationView(G.state,G.cat,G.placeName);patch(location,l.name+(l.area&&!l.name.toLowerCase().includes(l.area.toLowerCase())?' · '+l.area:''));place.title=location.textContent;patch(time,`${String(c.hh).padStart(2,'0')}:${String(c.mm).padStart(2,'0')}`);patch(online,G.connected===false?'Offline':Number.isSafeInteger(G.online)?`${G.online.toLocaleString('en-GH')} player${G.online===1?'':'s'} online${Number.isSafeInteger(G.today)&&G.today>G.online?` · ${G.today.toLocaleString('en-GH')} today`:''}`:'Online · checking players…');population.dataset.connected=String(G.connected!==false);population.title=population.textContent;offline.hidden=G.connected!==false;},
  progress(){const a=activityView(G.state,accraNow());nav.querySelector('[data-nav="map"]').setAttribute('aria-disabled',String(!!a?.travel));if(!a||a.travel){busy.hidden=true;busy.dataset.id='';return;}busy.hidden=false;
   if(busy.dataset.id!==a.id){busy.dataset.id=a.id;busy.replaceChildren(ic(a.travel?'bus':a.shift?'briefcase':'hourglass-medium'),h('div.grow',null,h('strong.bl',null,a.label),h('div.activity-meta'),h('div.bar',{role:'progressbar','aria-label':a.label,'aria-valuemin':'0','aria-valuemax':'100'},h('i'))),a.canCancel?h('button.bx',{'aria-label':'Stop activity',onclick:()=>act.cancel()},ic('x')):a.shift?h('button.bx',{'aria-label':'View shift',onclick:()=>act.work()},ic('briefcase')):null);}
   patch(busy.querySelector('.activity-meta'),a.remaining?(a.remaining>60?`${Math.ceil(a.remaining/60)} min remaining`:`${a.remaining}s remaining`):'Finishing…');busy.querySelector('.bar i').style.width=(a.progress*100).toFixed(1)+'%';busy.querySelector('.bar').setAttribute('aria-valuenow',String(Math.round(a.progress*100)));
  },
  quests(){const s=G.state;if(!s)return;const sig=JSON.stringify([G.gem,s.job,s.shift,s.sick,s.home,s.daily,s.dumsor,activeLifeEvent()?.at]);if(sig===extrasSig)return;extrasSig=sig;chips.replaceChildren();
   const ev=activeLifeEvent();lifeChip.hidden=!ev;if(ev)lifeChip.replaceChildren(ic('lightning'),h('span',null,ev.title),h('small',null,'Decide'));
   if(G.gem)chips.append(actionLink('diamond',`Gem hunt · ${cedi(G.gem.prize)}`,()=>act.gem()));
   if(s.daily?.list?.length)chips.append(actionLink('target',`Today ${s.daily.list.filter(x=>x.done).length}/${s.daily.list.length}`,()=>act.goals()));
   if(s.sick)chips.append(actionLink('first-aid',s.sick.kind||'See health details',()=>act.needs()));
   if(s.dumsor)chips.append(h('p.context-hint',null,'Power outage in this area'));
   if(!s.home)chips.append(actionLink('house','Find a home',()=>act.app('houses')));
  },
  chatLine(name,text){const line=h('div',null,h('b',null,name),text);chatlog.replaceChildren(line);setTimeout(()=>line.remove(),4500);},
  connection(m){G.connected=m.connected;if(!m.connected){G.online=null;G.today=null;}offline.replaceChildren(ic(m.connected?'wifi-high':'wifi-slash'),m.terminal?'Session ended. Reload to sign in again.':'Reconnecting. Your saved life is safe.',...(m.terminal?[h('button',{onclick:()=>window.location.reload()},'Reload')]:[]));},
  streetHint(info){
   const key=info?info.name+'|'+(info.zone?.id||''):'';if(key===streetKey)return;streetKey=key;streetRow.hidden=!info;nearbyZone=info?.zone||null;
   if(info){patch(streetName,info.name);streetName.title=info.name;entrance.hidden=!nearbyZone;if(nearbyZone){patch(entrance,nearbyZone.label);entrance.setAttribute('aria-label','Entrance: '+nearbyZone.label);}}
  },
  openStatus,openNeed,
 };
 return H;
}
