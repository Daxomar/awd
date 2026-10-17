// Stage 6 Meet: consent-based introductions to real players. Nearby = this room, Discover = players who
// opted in, Friends = accepted contacts. Nothing here invents players; empty lists say so honestly.
import {h,ic,sheet} from './dom.js';
import {portrait} from './portrait.js';
import {net} from '../net.js';
import {G} from '../store.js';

const TABS=[['nearby','Nearby'],['discover','Discover'],['friends','Friends']];
const HELLO='Hi! I am new in Accra and looking around. How is your day going?';

export function openMeet(act,{tab='nearby',onObjective}={}){
  let people=null,intro=null,note='',busy=false,chosen=null,draft=HELLO;
  const body=h('div.sheet-body.meet-body');
  const load=()=>{note='';net.send({t:'intro_people'});net.send({t:'intro_status'});draw();};
  const offs=[
    net.on('intro_people',m=>{people=m;busy=false;draw();}),
    net.on('intro',m=>{intro=m;draw();}),
    net.on('intro_result',m=>{busy=false;if(m.error)note=m.error;else if(m.waiting)note='No eligible player is available right now.';else if(m.id||m.existing){note='Introduction sent. They will see it and choose whether to accept.';chosen=null;}if(m.state)intro=m.state;draw();}),
    net.on('intro_update',m=>{if(m.status==='accepted'){s.close();act.message(m.from);}else load();}),
    net.on('intro_complete',load),
  ];
  const s=sheet(body,{title:'Meet people',sub:'Real players on this server. They choose whether to accept.',tall:true,onclose:()=>offs.forEach(off=>off())});

  function send(person){
    if(busy)return;busy=true;note='Sending your introduction…';
    if(!net.send({t:'intro_request',to:person.acct,text:draft})){busy=false;note='Reconnect before sending.';}
    draw();
  }
  function personRow(p,kind){
    const can=kind!=='friends'&&people?.canIntroduce;
    const open=chosen===p.acct;
    const row=h('div.meet-person',null,
      h('div.meet-who',null,p.look?portrait(p.look,p.name,'meet-portrait'):h('span.meet-portrait',null,ic('user')),
        h('div.grow',null,h('strong',null,'@'+p.name),h('small',null,kind==='friends'?(p.online?'Online now':'Offline'):[p.job||'Exploring Accra',p.newcomer?'new this week':null].filter(Boolean).join(' · '))),
        can?h('button.btn.small',{'aria-expanded':String(open),onclick:()=>{chosen=open?null:p.acct;draw();}},open?'Cancel':'Say hello'):
          h('button.btn.small',{onclick:()=>{s.close();act.message(p.name);}},kind==='friends'?'Message':'Message request')));
    if(open)row.append(h('div.meet-compose',null,
      h('label',null,h('span',null,'Your hello (they see it only if they accept)'),
        h('textarea',{rows:3,maxlength:240,value:draft,oninput:e=>{draft=e.target.value;}})),
      h('button.btn.primary.wide',{disabled:busy,onclick:()=>send(p)},'Send introduction')));
    return row;
  }
  function empty(kind){
    const text=kind==='nearby'?'Nobody else who accepts introductions is in this place right now.':kind==='discover'?'No players have opted into discovery right now.':'No accepted contacts yet. When someone accepts your hello, they appear here.';
    const ideas=(G.objectives||[]).filter(d=>d.first&&!d.completed).slice(0,2);
    return h('div.meet-empty',null,h('p',null,text),
      kind!=='friends'?h('p.muted',null,'Your progress is saved. You can keep exploring and try again later.'):null,
      h('button.btn.wide',{disabled:busy,onclick:load},ic('arrow-clockwise'),' Retry'),
      ideas.length?h('div',null,h('h3.panel-heading',null,'Meanwhile, try'),...ideas.map(d=>h('button.world-row',{onclick:()=>{s.close();onObjective?.(d);}},ic('target'),h('span',null,d.title),ic('caret-right')))):null);
  }
  function offers(){
    const rows=(intro?.rows||[]).filter(r=>r.status==='pending'||r.status==='accepted');
    return rows.map(r=>h('div.meet-offer',null,
      h('strong',null,r.incoming?(r.status==='pending'?`@${r.with} wants to say hello`:`You accepted @${r.with}`):(r.status==='pending'?`Waiting for @${r.with} to accept`:`@${r.with} accepted your hello`)),
      h('small',null,r.status==='pending'?'Expires '+new Date(r.expires).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'Reply in Messages to complete your first conversation.'),
      r.incoming&&r.status==='pending'?h('div.row.gap',null,
        h('button.btn.primary.grow',{onclick:()=>{net.send({t:'intro_answer',id:r.id,yes:true});s.close();setTimeout(()=>act.message(r.with),400);}},'Accept'),
        h('button.btn.ghost.grow',{onclick:()=>net.send({t:'intro_answer',id:r.id,yes:false})},'Decline')):null,
      r.status==='accepted'?h('button.btn.wide',{onclick:()=>{s.close();act.message(r.with);}},'Open conversation'):null));
  }
  function draw(){
    const list=people?.[tab]||[];
    body.replaceChildren(...[
      ...offers(),
      h('div.meet-tabs',{role:'tablist'},...TABS.map(([id,label])=>h('button',{role:'tab','aria-selected':String(tab===id),onclick:()=>{tab=id;chosen=null;draw();}},label,people?h('span.meet-count',null,String(people[id]?.length||0)):null))),
      note?h('p.meet-note',{role:'status'},note):null,
      !people?h('p.muted',null,'Looking for players online…'):list.length?h('div.meet-list',null,...list.map(p=>personRow(p,tab))):empty(tab),
      people&&!people.canIntroduce&&tab!=='friends'&&list.length?h('p.muted',null,intro?.completed?'Your first introduction is complete. You can still send message requests.':'Introductions are for a player’s first week. You can still send a message request.'):null,
      h('h3.panel-heading',null,'Your privacy'),
      toggle('Let other players find me in Discover',!!people?.discoverable,v=>net.send({t:'intro_preferences',discoverable:v})),
      toggle('Pause all introductions',!!people?.optedOut,v=>net.send({t:'intro_preferences',out:v})),
      h('p.muted',null,'Discover never shows where you are. '+(intro?.rewardsEnabled?'Only a verified first conversation can earn the configured one-time reward.':'Introductions award XP only; no cash is paid.'))].filter(Boolean));
  }
  function toggle(label,on,set){
    return h('label.meet-toggle',null,h('input',{type:'checkbox',checked:on,onchange:e=>{set(e.target.checked);setTimeout(load,2100);}}),h('span',null,label));
  }
  load();
  return s;
}
