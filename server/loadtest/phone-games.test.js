import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,play,gameView} from '../src/game/phone-games.js';
import * as Game from '../src/game/rules.js';
const move=(s,side,m)=>play(s,side,{version:s.version,...m});
test('noughts and crosses enforces turns, occupied cells, stale moves and finishes',()=>{
 const s=initial('tic');assert.match(move(s,1,{cell:1}),/turn/);assert.equal(move(s,0,{cell:0}),null);
 assert.match(play(s,1,{version:0,cell:1}),/changed/);assert.match(move(s,1,{cell:0}),/empty/);
 for(const [side,cell]of [[1,3],[0,1],[1,4],[0,2]])assert.equal(move(s,side,{cell}),null);
 assert.equal(s.winner,0);assert.match(move(s,1,{cell:8}),/finished/);
});
test('four in a row respects gravity and recognizes a diagonal win',()=>{
 const s=initial('four');for(const [side,column]of [[0,0],[1,1],[0,1],[1,2],[0,4],[1,2],[0,2],[1,3],[0,4],[1,3],[0,5],[1,3],[0,3]])assert.equal(move(s,side,{column}),null);
 assert.equal(s.winner,0);assert.equal(s.board[35],0);
});
test('card hands and deck stay private and invalid card actions do not advance a turn',()=>{
 const s=initial('cards'),row={a:1,b:2,an:'a',bn:'b',id:'1',state:s,kind:'cards'};
 for(const id of [1,2]){const view=gameView(row,id).state;assert.equal(view.hand.length,7);assert.equal(view.opponentCards,7);assert.equal(view.hands,undefined);assert.equal(view.deck,undefined);assert.equal(view.discard,undefined);}
 s.hands[0]=[{c:'green',n:4},{c:'wild',n:'draw4'}];s.colour='red';s.discard=[{c:'red',n:1}];
 assert.match(move(s,0,{card:0}),/Match/);assert.equal(s.version,0);
 s.hands[0].push({c:'red',n:3});assert.match(move(s,0,{card:1,colour:'gold'}),/matching/);
 assert.equal(move(s,0,{card:2}),null);assert.equal(s.turn,1);
});
test('two player reverse skips and draw penalties apply before declaring a winner',()=>{
 const s=initial('cards');s.hands=[[{c:'red',n:'reverse'},{c:'red',n:'draw2'}],[{c:'blue',n:5}]];s.colour='red';s.discard=[{c:'red',n:2}];
 assert.equal(move(s,0,{card:0}),null);assert.equal(s.turn,0);assert.equal(move(s,0,{card:0}),null);assert.equal(s.winner,0);assert.equal(s.hands[1].length,3);
});
test('birth roll is stable, both backgrounds can choose housing without an assigned career',()=>{
 const cat=Game.catalog();
 for(const origin of ['hustler','dbee']){const state=Game.newState({id:100,u:'test'});state.birthOrigin=origin;const p={acct:100,state};
  const bad=Game.onMsg(p,{t:'onboard',home:'trasacco',traits:['hustler','detty']},{},Date.now());assert.equal(bad.t,'toast');assert.equal(state.onboarded,false);assert.equal(state.look,null);
  Game.onMsg(p,{t:'onboard',home:cat.origins[origin].homes[0],traits:['hustler','detty']},{},Date.now());assert.equal(state.onboarded,true);assert.equal(state.job,null);assert.equal(state.loan,null);
  assert.equal(Game.migrate(state,{id:100,u:'test'}).birthOrigin,origin);
 }
 assert.equal(Game.birthOrigin(37),Game.birthOrigin(37));
});
test('custody blocks travel and releases after free bail review; basic needs remain usable',()=>{
 const state=Game.newState({id:101,u:'test'}),now=Date.now(),p={acct:101,state};state.onboarded=true;state.place='police';state.flags.jailUntil=now+600000;state.flags.bailReview=now+120000;state.n.hunger=10;
 assert.match(Game.onMsg(p,{t:'travel',to:'circle',mode:'trotro'},{},now).m,/custody/);
 assert.match(Game.onMsg(p,{t:'jail',op:'bail'},{},now).m,/review/);
 Game.onMsg(p,{t:'jail',op:'meal'},{},now);assert.equal(state.n.hunger,35);
 assert.equal(Game.onMsg(p,{t:'jail',op:'bail'},{},now+120001).released,true);assert.equal(state.flags.jailUntil,0);
});
test('fixed savings preserves net worth and early withdrawal never creates earnings',()=>{
 const state=Game.newState({id:105,u:'saver'}),p={acct:105,state};state.onboarded=true;state.momo=2000;
 const worth=Game.netWorth(state),earned=state.stats.earned;
 Game.onMsg(p,{t:'bank',op:'fixed',amount:1000},{},Date.now());assert.equal(state.momo,1000);assert.equal(Game.netWorth(state),worth);
 Game.onMsg(p,{t:'bank',op:'withdrawFixed'},{},Date.now());assert.equal(state.momo,2000);assert.equal(state.stats.earned,earned);
 Game.onMsg(p,{t:'bank',op:'fixed',amount:1000},{},Date.now());state.flags.fixed.until=Date.now()-1;
 Game.onMsg(p,{t:'bank',op:'withdrawFixed'},{},Date.now());assert.equal(state.momo,2009);assert.equal(state.stats.earned,earned+9);
});
test('daily rental requires the showroom and expires without creating an owned asset',()=>{
 const now=Date.now(),state=Game.newState({id:106,u:'driver'}),p={acct:106,state};state.onboarded=true;state.momo=2000;Game.goPlace(p,'home');
 assert.match(Game.onMsg(p,{t:'rentcar'},{},now).m,/Visit/);Game.goPlace(p,'cars');const before=Game.netWorth(state);
 assert.equal(Game.onMsg(p,{t:'rentcar'},{},now).t,'st');assert.equal(state.car,null);assert.equal(Game.netWorth(state),before-350);
 assert.equal(Game.travel(p,{to:'circle',mode:'car'},now,{}).t,'busy');state.busy=null;Game.goPlace(p,'cars');
 assert.match(Game.travel(p,{to:'circle',mode:'car'},now+86400001,{}).m,/No car/);
});
