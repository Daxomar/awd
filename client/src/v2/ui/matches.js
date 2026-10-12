import { h, sheet, cedi, clockStr } from './dom.js';
import { G } from '../store.js';
import { net } from '../net.js';
let body=null,latest=null;
net.on('matches',m=>{latest=m;if(m.state){G.state=m.state;G.emit('state',m.state);}if(body?.isConnected)draw();});
setInterval(()=>{if(body?.isConnected)net.send({t:'matches'});},15000);
export function openMatches() {
  body=h('div.sheet-body',null,h('p.muted',null,'Loading fixtures…'));
  sheet(body,{title:'Viewing centre',sub:'Simulated fixtures · game money only',tall:true});
  net.send({t:'matches'});if(latest)draw();
}
function draw() {
  body.replaceChildren(h('p.muted',null,'Ghanaian and international clubs. Predictions close at kick-off and settle automatically at full time.'));
  for(const m of latest.matches){
    const bet=latest.bets.find(b=>b.match===m.id),stake=h('select',{ 'aria-label':'Game-money stake' },...[5,10,20,50,100].map(n=>h('option',{value:n,selected:n===10},cedi(n))));
    const box=h('div.match-card',null,h('small.muted',null,m.league),h('strong',null,`${m.home} v ${m.away}`),h('p.muted',null,m.status==='upcoming'?`Kick-off ${clockStr(m.start)} Accra time`:m.status==='live'?`${m.minute}′ · In play`:`Full time ${m.score.home}–${m.score.away}`));
    if(bet)box.append(h('p',null,`${bet.pick.toUpperCase()} · ${cedi(bet.stake)} · ${bet.settled?(bet.payout?'Won '+cedi(bet.payout):'Settled'):'Awaiting full time'}`));
    else if(m.status==='upcoming'){
      const buttons=h('div.row',null,...[['home','Home'],['draw','Draw'],['away','Away']].map(([pick,label])=>h('button.btn.sm.grow',{onclick:()=>{if(net.send({t:'bet',match:m.id,pick,stake:Number(stake.value)})){buttons.querySelectorAll('button').forEach(b=>b.disabled=true);setTimeout(()=>{if(buttons.isConnected)buttons.querySelectorAll('button').forEach(b=>b.disabled=false);},1500);}}},`${label} ×${m.odds[pick]}`)));
      box.append(stake,buttons);
    }
    body.append(box);
  }
  const old=latest.bets.filter(b=>b.settled&&!latest.matches.some(m=>m.id===b.match));if(old.length)body.append(h('h3',null,'Recent results'),...old.slice(-5).reverse().map(b=>h('p.muted',null,`${b.title} · ${b.score.home}–${b.score.away} · ${b.payout?cedi(b.payout)+' won':'Settled'}`)));
}
