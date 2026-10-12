// Persistent, server-authoritative games. Transactions serialize simultaneous/replayed moves.
import { randomInt } from 'node:crypto';
import { pool } from '../db.js';
import { acctByName, isBlockedBy } from '../social.js';
export const TYPES={tic:'Noughts & Crosses',four:'Four in a Row',cards:'Colour Cards'};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
export function initial(kind){
 const s={kind,turn:0,version:0,winner:null,board:Array(kind==='tic'?9:42).fill(null)};
 if(kind==='cards') {const deck=[];for(const c of ['red','gold','green','blue']){deck.push({c,n:0});for(const n of [1,2,3,4,5,6,7,8,9,'skip','reverse','draw2'])for(let i=0;i<2;i++)deck.push({c,n});}for(let i=0;i<4;i++){deck.push({c:'wild',n:'wild'},{c:'wild',n:'draw4'});}shuffle(deck);s.hands=[deck.splice(0,7),deck.splice(0,7)];const first=deck.findIndex(c=>typeof c.n==='number');s.discard=[deck.splice(first,1)[0]];s.colour=s.discard[0].c;s.deck=deck;delete s.board;}return s;
}
function draw(s,n,side){for(let i=0;i<n;i++){if(!s.deck.length){const last=s.discard.pop();s.deck=shuffle(s.discard);s.discard=[last];}if(s.deck.length)s.hands[side].push(s.deck.pop());}}
export function play(s,side,m){
 if(s.winner!==null||s.draw)return 'This game has finished.';
 if(s.turn!==side)return 'Wait for your turn.';
 if(m.version!==s.version)return 'The board changed. Open the latest game.';
 if(s.kind==='cards'){
  if(m.op==='draw'){draw(s,1,side);s.turn=1-side;s.version++;return null;}
  const index=m.card;if(!Number.isInteger(index)||!s.hands[side][index])return 'Choose a card from your hand.';
  const card=s.hands[side][index],top=s.discard.at(-1);
  if(card.c!=='wild'&&card.c!==s.colour&&card.n!==top.n)return 'Match the colour or value, or play a wild card.';
  if(card.c==='wild'&&!['red','gold','green','blue'].includes(m.colour))return 'Choose the next colour.';
  if(card.n==='draw4'&&s.hands[side].some(c=>c.c===s.colour))return 'Play your matching colour before a draw-four.';
  s.hands[side].splice(index,1);s.discard.push(card);s.colour=card.c==='wild'?m.colour:card.c;
  if(card.n==='draw2')draw(s,2,1-side);if(card.n==='draw4')draw(s,4,1-side);
  if(!s.hands[side].length)s.winner=side;
  s.turn=['skip','reverse','draw2','draw4'].includes(card.n)?side:1-side;s.version++;return null;
 }
 let index=m.cell;
 if(s.kind==='four'){if(!Number.isInteger(m.column)||m.column<0||m.column>6)return 'Choose a column.';index=-1;for(let r=5;r>=0;r--)if(s.board[r*7+m.column]===null){index=r*7+m.column;break;}if(index<0)return 'That column is full.';}
 if(!Number.isInteger(index)||index<0||index>=s.board.length||s.board[index]!==null)return 'Choose an empty square.';
 s.board[index]=side;const width=s.kind==='tic'?3:7,height=s.kind==='tic'?3:6,run=s.kind==='tic'?3:4;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){let count=0;for(let k=0;k<run;k++){const xx=x+k*dx,yy=y+k*dy;if(xx<0||xx>=width||yy<0||yy>=height||s.board[yy*width+xx]!==side)break;count++;}if(count===run)s.winner=side;}
 if(s.winner===null&&s.board.every(x=>x!==null))s.draw=true;s.turn=1-side;s.version++;return null;
}
export function gameView(row,acct){const side=row.a===acct?0:1,state=structuredClone(row.state);if(state.kind==='cards'){state.hand=state.hands[side];state.opponentCards=state.hands[1-side].length;delete state.hands;delete state.deck;state.top=state.discard.at(-1);delete state.discard;}return {id:row.id,kind:row.kind,status:row.status,a:row.an,b:row.bn,side,state,updated:row.updated};}
const fail=m=>({t:'toast',k:'bad',m});
export async function handle(shard,p,m){
 if(!p.state.onboarded)return fail('Create your character first.');
 if(m.t==='game_list'){const r=await pool.query(`select * from phone_games where a=$1 or b=$1 order by updated desc limit 40`,[p.acct]);return {t:'game_list',rows:r.rows.map(r=>gameView(r,p.acct))};}
 if(m.t==='game_create'){
  if(!Object.hasOwn(TYPES,m.kind))return fail('Choose a game.');
  if(Date.now()-(p.gameInviteAt||0)<3000)return fail('Wait a moment before inviting again.');p.gameInviteAt=Date.now();
  const to=await acctByName(m.to);if(!to||to.id===p.acct||to.banned)return fail('Choose another player.');
  const other=shard.byAcct(to.id)?.state||(await pool.query('select state from players where id=$1',[to.id])).rows[0]?.state;
  if(!other?.onboarded||isBlockedBy(p.state,to.id)||isBlockedBy(other,p.acct)||other.flags.dmFriends&&!(other.friends?.[p.acct]?.pts>=30))return fail('This player is not receiving invitations.');
  const db=await pool.connect();let r;
  try{await db.query('begin');await db.query('select pg_advisory_xact_lock($1)',[p.acct]);const count=await db.query("select count(*) from phone_games where (a=$1 or b=$1) and status in ('pending','active')",[p.acct]);if(+count.rows[0].count>=20){await db.query('rollback');return fail('Finish or decline some games first.');}r=await db.query(`insert into phone_games(a,b,an,bn,kind,state) values($1,$2,$3,$4,$5,$6) returning *`,[p.acct,to.id,p.name,to.username,m.kind,initial(m.kind)]);await db.query('commit');}catch(e){await db.query('rollback');throw e;}finally{db.release();}
  shard.deliverDm(to.id,{t:'game_notice',from:p.name,fromAcct:p.acct,id:r.rows[0].id});return {t:'game_state',game:gameView(r.rows[0],p.acct)};
 }
 if(!/^\d{1,19}$/.test(String(m.id)))return fail('Game not found.');
 const db=await pool.connect();let row;
 try{
  await db.query('begin');const r=await db.query('select * from phone_games where id=$1 and (a=$2 or b=$2) for update',[String(m.id).slice(0,30),p.acct]);row=r.rows[0];
  if(!row){await db.query('rollback');return fail('Game not found.');}
  const side=row.a===p.acct?0:1;
  if(m.t==='game_answer'){if(side!==1||row.status!=='pending'){await db.query('rollback');return fail('This invitation is no longer pending.');}row.status=m.yes?'active':'declined';}
  else if(m.t==='game_move'){if(row.status!=='active'){await db.query('rollback');return fail('This game is not active.');}const error=play(row.state,side,m);if(error){await db.query('rollback');return fail(error);}if(row.state.winner!==null||row.state.draw)row.status='done';}
  else if(m.t==='game_resign'){if(!['pending','active'].includes(row.status)){await db.query('rollback');return fail('This game has finished.');}if(row.status==='pending')row.status='declined';else{row.state.winner=1-side;row.status='done';}row.state.version++;}
  else {await db.query('rollback');return fail('Unknown game action.');}
  const updated=await db.query('update phone_games set status=$2,state=$3,updated=now() where id=$1 returning *',[row.id,row.status,row.state]);row=updated.rows[0];await db.query('commit');
 }catch(e){await db.query('rollback');throw e;}finally{db.release();}
 const other=row.a===p.acct?row.b:row.a;shard.deliverDm(other,{t:'game_notice',from:p.name,fromAcct:p.acct,id:row.id});return {t:'game_state',game:gameView(row,p.acct)};
}
