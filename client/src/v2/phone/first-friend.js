import {h} from '../ui/dom.js';
import {net} from '../net.js';
export function firstFriend(win,act){
  let state=null,note='',draft='';
  const load=()=>net.send({t:'intro_status'});
  const update=s=>{state=s;win.refresh();};
  const offs=[net.on('intro',update),net.on('intro_result',m=>{note=m.error||(m.waiting?'No eligible player is available here yet. Explore, or retry in 30 seconds.':'');if(m.state)state=m.state;win.refresh();}),net.on('intro_update',load),net.on('intro_complete',load)];
  win.onclose=()=>{offs.forEach(off=>off());clearInterval(timer);};const timer=setInterval(load,30000);
  win.page('Your first friend in Accra',()=>{
    const body=h('div',null,h('p',{style:{padding:'0 8px'}},'An optional introduction to a real online player on this server. They decide whether to accept. Keep personal contact details private.'),note?h('p',{role:'status',style:{padding:'0 8px'}},note):null);
    if(!state){body.append(h('p',null,'Checking introductions…'));return body;}
    if(state.completed)body.append(h('div.group',{style:{padding:'16px'}},h('strong',null,'First introduction completed'),h('p',null,'Keep the conversation going in Messages. This introduction can only be completed once.')));
    if(state.optedOut)body.append(h('p',null,'Introductions are paused.'));
    const active=state.rows.filter(r=>r.status!=='completed');
    for(const r of active)body.append(h('div.group',{style:{padding:'16px'}},h('strong',null,r.incoming?'Someone new to Accra wants to say hello. Accept or decline?':`Introduction to @${r.with}`),h('p',null,`${r.status} · expires ${new Date(r.expires).toLocaleTimeString()}`),
      r.incoming&&r.status==='pending'?h('div.row',null,h('button.ibtn.grow.green',{onclick:()=>net.send({t:'intro_answer',id:r.id,yes:true})},'Accept'),h('button.ibtn.grow.gray',{onclick:()=>net.send({t:'intro_answer',id:r.id,yes:false})},'Decline')):null,
      r.status==='accepted'?h('button.ibtn.wide',{onclick:()=>act.message(r.with)},'Open private conversation'):null));
    if(state.eligible&&!state.optedOut&&!active.some(r=>!r.incoming)){
      const text=h('textarea',{maxlength:240,rows:3,value:draft,placeholder:'Write a friendly hello…','aria-label':'Your introduction',oninput:e=>{draft=e.target.value;},style:{width:'100%'}});
      body.append(h('div.group',{style:{padding:'16px'}},h('strong',null,'Say hello to your first online friend'),h('p',null,'Your message stays private until the other player accepts. A genuine reply completes the introduction.'),text,h('button.ibtn.wide.green',{onclick:()=>{note='Looking for an eligible online player…';net.send({t:'intro_request',text:draft});win.refresh();}},'Find someone online')));
    }
    if(!state.eligible&&!state.completed)body.append(h('p',null,'New-player introductions are available in the first week. You can still meet people in public hubs or send message requests.'));
    body.append(h('p',{style:{padding:'0 8px',fontSize:'13px'}},state.rewardsEnabled?'Only eligible, verified first conversations can earn configured rewards. Repeated introductions do not grant repeated rewards.':'Introductions currently award no cash. Meeting someone is optional.'),
      h('button.ibtn.wide.gray',{onclick:()=>net.send({t:'intro_preferences',out:!state.optedOut})},state.optedOut?'Allow introductions':'Pause introductions'),h('button.ibtn.wide.gray',{onclick:()=>act.phone('explore')},'Explore social hubs'),h('button.ibtn.wide.gray',{onclick:load},'Refresh status'));
    return body;
  });load();
}
