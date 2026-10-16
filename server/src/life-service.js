import crypto from 'node:crypto';
import {pool} from './db.js';
import {withMoney,withPlayers} from './account-money.js';
import * as Game from './game/rules.js';
import * as Social from './social.js';
import {progressionView} from './game/life-progression.js';
import {financeView,validRequest} from './life-journal.js';
import {migrateBusinesses,businessesView,businessAction,refreshBusinessAssets} from './life-business.js';
import {migrateCommerce,marketView,commerceAction} from './life-commerce.js';
import {migrateRelationships,socialView,socialAction,settleShared} from './life-social.js';

export async function migrateLife(){await migrateBusinesses(pool);await migrateCommerce(pool);await migrateRelationships(pool);}
const SOCIAL_OPS=new Set(['friend_request','friend_answer','friend_remove','date_request','date_answer','propose_request','relationship_end','social_basic','shared_invite','shared_answer']);
const SECTIONS=new Set(['career','business','finance','market','relationships']);
export async function status(p,section){
  if(!SECTIONS.has(section))throw Error('Choose a life screen.');
  const data=await withMoney(p,async(db,s)=>{
    const data={progression:progressionView(s)};
    if(section==='business')data.business=await businessesView(db,p.acct,s,Date.now());
    if(section==='finance')data.finance=await financeView(db,p.acct,s);
    if(section==='market'){data.market=await marketView(db,p.acct);data.phoneNames=Object.fromEntries(Object.entries(Game.PHONES).map(([id,x])=>[id,x[0]]));}
    if(section==='relationships')data.relationships=await socialView(db,p,s);
    return data;
  });
  return {t:'life_status',section,account:p.acct,...data,state:Game.view(p.state)};
}
export async function handle(shard,p,msg){
  if(!p.state.onboarded)return {t:'life_result',key:msg.key,error:'Finish setting up your life first.'};
  try{
    if(msg.t==='life_status')return await status(p,msg.section);
    if(!validRequest(msg.key)||typeof msg.op!=='string')throw Error('Use a valid action reference. Reopen this screen.');
    const now=Date.now();let target=null,o=null;
    if(SOCIAL_OPS.has(msg.op)){
      if(msg.op==='shared_answer'){
        if(!validRequest(msg.activity))throw Error('Choose a valid invitation.');
        const a=(await pool.query('select a from life_shared where id=$1 and b=$2',[msg.activity,p.acct])).rows[0];
        if(a){o=shard.byAcct(a.a);target=o?{acct:o.acct,name:o.name}:null;}
      }else{
        const a=await Social.acctByName(msg.name);if(!a||a.id===p.acct)throw Error('Choose another player by username.');
        target={acct:a.id,name:a.username};o=shard.byAcct(a.id);
      }
    }
    const perform=async(db,states)=>{
      const s=states.get(p.acct),digest=crypto.createHash('sha256').update(JSON.stringify(msg)).digest('hex');
      const old=(await db.query('select * from life_requests where acct=$1 and key=$2',[p.acct,msg.key])).rows[0];
      if(old){if(old.digest!==digest)throw Error('This action reference belongs to a different request.');return {...old.result,replayed:true};}
      if(SOCIAL_OPS.has(msg.op)){await socialView(db,p,s);if(o&&states.has(o.acct))await socialView(db,o,states.get(o.acct));}
      let result;
      if(msg.op.startsWith('business_')){result=await businessAction(db,s,p.acct,msg,now);await refreshBusinessAssets(db,s,p.acct);}
      else if(msg.op.startsWith('market_'))result=await commerceAction(db,s,p,msg,now);
      else if(SOCIAL_OPS.has(msg.op))result=await socialAction(db,states,shard,p,msg,target,now);
      else throw Error('Unknown life action.');
      await db.query('insert into life_requests(acct,key,op,digest,result) values($1,$2,$3,$4,$5)',[p.acct,msg.key,msg.op,digest,JSON.stringify(result)]);return result;
    };
    const unilateral=['relationship_end','friend_remove'].includes(msg.op),lockOther=o&&(!unilateral||!o.connecting&&!o.moneyBusy&&!o.pending&&!o.gistPending);
    const result=SOCIAL_OPS.has(msg.op)?await withPlayers(lockOther?[p,o]:[p],perform,p):await withMoney(p,(db,s)=>perform(db,new Map([[p.acct,s]])));
    if(result&&!result.replayed){
      if(result.creditTo)shard.deliverCredit(result.creditTo);
      if(result.notify)shard.deliverDm(result.notify,{t:'life_notice',from:p.name,fromAcct:p.acct,message:'An optional relationship or shared activity update is waiting in People.'});
      if(o&&!o.gone)shard.send(o,{t:'st',state:Game.view(o.state)});
    }
    return {t:'life_result',key:msg.key,...result,state:Game.view(p.state)};
  }catch(e){if(e.code&&e.code!=='23505')console.error('[life action]',e.code);const storageFailure=e.code||/connection|timeout|terminated|commit confirmation/i.test(e.message);return {t:'life_result',key:msg.key,error:e.code==='23505'?'That invitation, item or relationship is already reserved. Refresh and try again.':storageFailure?'Could not save this action. Refresh and retry with the same reference.':e.message};}
}
export async function legacySocial(shard,p,msg){
  const o=shard.players.get(msg.id|0);if(!o)return shard.send(p,{t:'toast',m:'They are no longer in this room.'});
  const kind=msg.kind;
  const op=kind==='askout'?'date_request':kind==='propose'?'propose_request':['dance','hug','flirt'].includes(kind)?'shared_invite':'social_basic';
  const r=await handle(shard,p,{t:'life_action',op,name:o.name,kind:op==='shared_invite'?(kind==='flirt'?'date':'conversation'):kind,key:crypto.randomUUID()});
  if(r.state)shard.send(p,{t:'st',state:r.state});shard.send(p,{t:'toast',k:r.error?'bad':'good',m:r.error||r.message});
  if(!r.error)shard.send(p,{t:'social_done',with:o.name,kind,label:r.message,pending:op!=='social_basic',pts:p.state.friends[o.acct]?.pts||0});
}
export async function sharedTick(shard){await settleShared(shard);}
export async function syncRelationships(p){await withMoney(p,(db,s)=>socialView(db,p,s));}
