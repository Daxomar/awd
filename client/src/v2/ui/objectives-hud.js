// Stage 6 HUD objectives: a compact, collapsible first-session guide on the main game screen.
// Progress and rewards stay on the server (objective_status / objective_claim); only the open/closed
// preference is local.
import {h,ic,toast} from './dom.js';
import {net} from '../net.js';
import {hudRows,currentObjective} from './hud-state.js';

const PREF='awd.objectives.open';
const readOpen=()=>{try{return localStorage.getItem(PREF)==='1';}catch{return false;}};
const saveOpen=v=>{try{localStorage.setItem(PREF,v?'1':'0');}catch{}};
const ICON={houses:'house-line',home:'house',interact:'hand-tap',meet:'hand-waving',jobs:'briefcase',status:'heartbeat',explore:'compass',map:'map-trifold',messages:'chat-circle-dots',boutique:'t-shirt'};

export function goObjective(d,act){
  switch(d.action){
    case 'home':return act.nav('home');
    case 'map':return act.map();
    case 'interact':return act.nav('interact');
    case 'status':return act.status();
    case 'meet':return act.meet();
    case 'houses':case 'jobs':return act.app(d.action);
    default:return act.phone(d.action);
  }
}

export function buildObjectives(act){
  let open=readOpen(),view={label:'',rows:[]},known=null;
  const pending=new Set();
  const el=h('section.objectives-hud',{hidden:true,'aria-label':'Objectives'});
  function claim(d){
    if(pending.has(d.id))return;
    if(!net.send({t:'objective_claim',id:d.id}))return toast('Reconnect before claiming.','bad');
    pending.add(d.id);setTimeout(()=>{pending.delete(d.id);draw();},15000);draw();
  }
  function row(d){
    const state=d.claimed?'claimed':d.completed?'ready':'open';
    return h('div.obj-row',{'data-state':state},
      h('span.obj-mark',{'aria-hidden':'true'},ic(d.claimed?'check-circle':d.completed?'gift':'circle')),
      h('div.obj-text',null,h('strong',null,d.title),h('small',null,d.claimed?`Done · ${d.xp} XP earned`:d.description)),
      d.claimed?null:d.completed?h('button.obj-btn.claim',{disabled:pending.has(d.id),onclick:()=>claim(d)},`Claim ${d.xp} XP`):
        h('button.obj-btn',{'aria-label':'Go: '+d.title,onclick:()=>goObjective(d,act)},'Go'));
  }
  function draw(){
    const cur=currentObjective(view);el.hidden=!cur;if(!cur)return;
    const done=view.rows.filter(d=>d.completed).length,total=view.rows.length;
    const head=h('div.obj-head',null,
      h('button.obj-toggle',{'aria-expanded':String(open),'aria-controls':'obj-panel',onclick:()=>{open=!open;saveOpen(open);draw();}},
        h('span.obj-icon',{'aria-hidden':'true'},ic(cur.completed?'gift':ICON[cur.action]||'target')),
        h('span.obj-copy',null,h('small',null,`${view.label} · ${done}/${total}`),h('strong',null,cur.completed?'Ready to claim: '+cur.title:cur.title)),
        h('span.obj-bar',{role:'progressbar','aria-label':'Objectives progress','aria-valuemin':'0','aria-valuemax':String(total),'aria-valuenow':String(done)},h('i',{style:{width:(total?done/total*100:0)+'%'}})),
        ic(open?'caret-up':'caret-down')),
      cur.completed?h('button.obj-btn.claim',{disabled:pending.has(cur.id),onclick:()=>claim(cur)},'Claim'):h('button.obj-btn',{'aria-label':'Go: '+cur.title,onclick:()=>goObjective(cur,act)},'Go'));
    const panel=open?h('div.obj-panel',{id:'obj-panel'},...view.rows.map(row),
      h('button.obj-more',{onclick:()=>act.phone('milestones')},'All milestones',ic('caret-right'))):null;
    el.replaceChildren(head,...(panel?[panel]:[]));
  }
  function update(rows){
    view=hudRows(rows);
    const done=new Set((rows||[]).filter(d=>d.completed).map(d=>d.id));
    if(known)for(const d of view.rows)if(done.has(d.id)&&!known.has(d.id)){
      toast(`Objective complete: ${d.title}. Claim ${d.xp} XP.`,'good');el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse');
    }
    for(const d of rows||[])if(d.claimed&&pending.has(d.id)){pending.delete(d.id);toast(`+${d.xp} XP${d.badge?' · '+d.badge+' badge':''}`,'gold');}
    known=done;draw();
  }
  return {el,update};
}
