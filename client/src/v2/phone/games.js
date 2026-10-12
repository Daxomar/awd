import {h,ic} from '../ui/dom.js';
import {net} from '../net.js';
const TYPES={tic:['Noughts & Crosses','Three in a row on a 3 × 3 board.'],four:['Four in a Row','Drop a counter; connect four in any direction.'],cards:['Colour Cards','An UNO-style game: match colour or number. Skip, reverse, draw two and wild cards. No stacking; draw four only without a matching colour. Drawing one ends your turn.']};
export function phoneGames(win,act,arg){
 let rows=null,selected=null,busy=false,colour='red';const name=h('input',{placeholder:'Player username',maxLength:16,autocapitalize:'off',value:arg?.with||''});
 const send=m=>{if(busy)return;if(net.send(m)){busy=true;win.refresh();}};
 const load=()=>net.send({t:'game_list'});
 const offs=[net.on('game_list',m=>{rows=m.rows;busy=false;win.refresh();}),net.on('game_state',m=>{rows=rows||[];rows=rows.filter(r=>r.id!==m.game.id);rows.unshift(m.game);selected=m.game.id;busy=false;win.refresh();}),net.on('game_notice',load),net.on('toast',()=>{busy=false;win.refresh();}),net.on('reconnected',load)];
 const timer=setInterval(load,15000),prev=win.onclose;win.onclose=()=>{clearInterval(timer);offs.forEach(f=>f());prev?.();};
 const button=(label,fn,disabled=false)=>h('button.ibtn',{onclick:fn,disabled:disabled||busy},label);
 win.page('Games',()=>{
  const game=rows?.find(r=>r.id===selected);
  if(game){const s=game.state,mine=game.side===s.turn,opponent=game.side===0?game.b:game.a;
   const content=h('div.game-detail',null,button('All games',()=>{selected=null;win.refresh();}),h('h2',null,TYPES[game.kind][0]),h('p',null,`You and @${opponent}`));
   if(game.status==='pending'){content.append(h('p',null,game.side===0?'Invitation sent. They can accept from their phone.':'You have been invited to play.'),...(game.side===1?[button('Accept',()=>send({t:'game_answer',id:game.id,yes:true})),button('Decline',()=>send({t:'game_answer',id:game.id,yes:false}))]:[button('Withdraw invitation',()=>send({t:'game_resign',id:game.id}))]));return content;}
   if(game.status==='declined'){content.append(h('p',null,'Invitation closed.'));return content;}
   const finished=game.status==='done';content.append(h('p.game-status',{'aria-live':'polite'},finished?(s.draw?'Draw':s.winner===game.side?'You won':`@${opponent} won`):mine?'Your turn':`Waiting for @${opponent}`));
   const move=(patch)=>send({t:'game_move',id:game.id,version:s.version,...patch});
   if(game.kind==='cards'){
    content.append(h('div.card-table',null,h('div',null,`${s.opponentCards} cards held by @${opponent}`),h('div.playing-card.'+s.colour,null,String(s.top.n)),h('div',null,`Current colour: ${s.colour}`)));
    const select=h('select',{'aria-label':'Wild card colour',onchange:e=>colour=e.target.value},...['red','gold','green','blue'].map(c=>h('option',{value:c,selected:c===colour},c)));
    content.append(h('label',null,'Wild card colour ',select),h('div.card-hand',null,...s.hand.map((card,i)=>h('button.playing-card.'+card.c,{disabled:finished||!mine||busy,'aria-label':`${card.c} ${card.n}`,onclick:()=>move({card:i,colour})},String(card.n)))),!finished?button('Draw a card',()=>move({op:'draw'}),!mine):null);
   }else{
    const width=game.kind==='tic'?3:7;
    content.append(h('div.game-board.'+game.kind,{style:{gridTemplateColumns:`repeat(${width},1fr)`}},...s.board.map((v,i)=>h('button',{disabled:finished||!mine||busy||(game.kind==='tic'&&v!==null),'aria-label':game.kind==='tic'?`Square ${i+1}`:`Column ${i%7+1}, row ${Math.floor(i/7)+1}`,onclick:()=>move(game.kind==='tic'?{cell:i}:{column:i%7}),class:v===null?'empty':v===game.side?'mine':'opponent'},game.kind==='tic'?(v===null?'':v===0?'X':'O'):h('span')))));
   }
   content.append(h('p.game-rules',null,TYPES[game.kind][1]));if(!finished)content.append(button('Resign',()=>{if(confirm('Resign this friendly game?'))send({t:'game_resign',id:game.id});}));return content;
  }
  return h('div.game-lobby',null,h('h2',null,'Play with friends'),h('p',null,'Friendly games with real players. Invitations and turns stay saved, even when someone goes offline.'),name,h('div.game-types',null,...Object.entries(TYPES).map(([kind,[title,desc]])=>h('div.game-type',null,ic(kind==='cards'?'cards':kind==='four'?'circles-four':'grid-nine'),h('h3',null,title),h('p',null,desc),button('Invite player',()=>send({t:'game_create',kind,to:name.value.trim()}))))),h('h3',null,'Your games'),rows===null?h('p',null,'Loading games…'):rows.length?h('div',null,...rows.map(g=>h('button.game-row',{onclick:()=>{selected=g.id;win.refresh();}},h('b',null,TYPES[g.kind][0]),h('span',null,`@${g.side===0?g.b:g.a} · ${g.status==='active'?(g.side===g.state.turn?'Your turn':'Their turn'):g.status}`)))):h('p',null,'No games yet. Invite someone by username.'),h('h3',null,'Oware'),button('Practice Oware',()=>act.practice()),h('p',null,'You can also challenge a player to Oware from their profile.'));
 });load();
}
