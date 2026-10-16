import {h} from '../ui/dom.js';
import {G} from '../store.js';
import {net} from '../net.js';
export function milestones(win,act){
  let error='',pending=false,timer,category='intro';
  const load=()=>net.send({t:'objective_status'});
  const offs=[net.on('objectives',()=>{clearTimeout(timer);pending=false;error='';win.refresh();}),net.on('objective_error',m=>{clearTimeout(timer);pending=false;error=m.error;win.refresh();})];
  win.onclose=()=>{clearTimeout(timer);offs.forEach(off=>off());};
  win.page('Your own pace',()=>h('div',null,h('p',{style:{padding:'0 8px'}},'Optional ideas for discovery, friendship and everyday life. Choose any order, or keep exploring. Rewards are one-time XP and badges.'),error?h('p',{role:'status'},error):null,
    h('div.row',null,...[['intro','Getting started'],['long','Long-term']].map(([id,label])=>h('button.ibtn.grow',{onclick:()=>{category=id;win.refresh();},'aria-pressed':category===id},label))),
    h('div.group',null,...(G.objectives||[]).filter(d=>(d.category||'intro')===category).map(d=>h('div',{style:{padding:'14px',borderBottom:'1px solid #ddd'}},h('strong',null,d.title),h('p',{style:{margin:'6px 0'}},d.description),h('small',null,`${d.claimed?'Claimed':d.completed?'Complete':'Available'} · ${d.xp} XP${d.badge?' · '+d.badge+' badge':''}`),
      d.completed&&!d.claimed?h('button.ibtn.wide.green',{disabled:pending,onclick:()=>{pending=net.send({t:'objective_claim',id:d.id});if(!pending)error='Reconnect before claiming your milestone.';else timer=setTimeout(()=>{pending=false;error='No confirmation yet. Check progress before retrying.';win.refresh();},15000);win.refresh();}},'Claim milestone'):!d.completed?h('button.ibtn.wide.gray',{onclick:()=>next(d)},d.action==='home'?'Return to the world':'Open '+(d.action==='meet'?'Meet':d.action==='explore'?'Explore':d.action)):null))),
    h('button.ibtn.wide.gray',{disabled:pending,onclick:load},'Check progress'),h('button.ibtn.wide.gray',{onclick:()=>act.phone('goals')},'Your aspirations')));
  load();
  function next(d){if(d.action==='home'){act.closePhone();act.nav('home');}else if(d.action==='map'){act.closePhone();act.map();}else act.phone(d.action);}
}
