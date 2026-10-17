import * as Game from './game/rules.js';
import {withMoney} from './account-money.js';
import crypto from 'node:crypto';
import {validRequest} from './life-journal.js';
import {isUnitPlace,prepareProperty} from './property-context.js';

export const durableActions=new Set(['act','work','apply','buy','bank','phone','travel','donate','jail','rentcar','bet','mgResult','bizcheck','course','autowork','profile_set','homeaccess','lifeevent']);
export function durableTick(s,now){
  const c=Game.clock(now),wk=Math.floor((now/86400000+3)/7);
  return !!(s.onboarded&&(
    s.busy&&!s.busy.mg&&now>=s.busy.end||s.shift&&(now-s.shift.start>=3600000||s.shift.activeTask?.readyAt<=now)||
    c.h>=18&&s.lastDaily!==c.day||s.lastWeekly!==wk||s.rentPaidUntil&&s.home&&!s.owned[s.home]&&now>=s.rentPaidUntil||
    s.loan&&now>=s.loan.next||s.flags.matchBets?.some(b=>!b.settled&&now>=b.end)||
    Game.aspirationDue(s,now)||Game.needsEmergency(s,now)||Game.autoworkDue(s,now)||Game.lifeEventDue(s,now)||
    s.shift&&(s.shift.completedTasks?.length||0)>=3));
}
export async function gameTransaction(shard,p,msg=null,now=Date.now(),queued=false){
  if(p.pending&&!queued||p.gistPending){if(msg)shard.send(p,{t:'toast',k:'bad',m:'Finish the pending account request first.'});return;}
  let shadow;
  const previousPlace=p.state.place,previousHome=p.state.home;
  try{
    const r=await withMoney(p,async(db,s)=>{
      shadow={...p,state:s};const request=typeof msg==='function'?msg.request:msg;let digest;
      if(request?.clientAction){
        if(!validRequest(request.clientAction))throw Error('Invalid gameplay action reference.');
        digest=crypto.createHash('sha256').update(JSON.stringify(request)).digest('hex');
        const old=(await db.query('select digest from life_requests where acct=$1 and key=$2',[p.acct,request.clientAction])).rows[0];
        if(old){if(old.digest!==digest)throw Error('Gameplay action reference was reused for different content.');return {t:'toast',m:'This action was already saved. Your current state is restored.'};}
      }
      const result=typeof msg==='function'?msg(shadow):msg?Game.onMsg(shadow,msg,shard,now):Game.tick(shadow,now,shard);
      if(isUnitPlace(shadow.state.place)&&shadow.state.place!==previousPlace){
        await prepareProperty(shadow,db,now);
        const messages=result?.t==='multi'?result.list:[result];
        for(const item of messages)if(item?.t==='arrived'){item.place=shadow.state.place;item.name=shadow.propertyContext?.name||Game.placeName(s,s.place);}
      }
      if(digest)await db.query('insert into life_requests(acct,key,op,digest,result) values($1,$2,$3,$4,$5)',[p.acct,request.clientAction,'game:'+request.t,digest,'{}']);
      return result;
    });
    if(p.gone||!shadow)return;
    p.x=shadow.x;p.z=shadow.z;p.propertyContext=shadow.propertyContext;
    if(r){if(msg?.t==='act'&&r.t==='busy')p.zn=typeof msg.zn==='string'?msg.zn.slice(0,24):null;shard.send(p,r);shard.after(p,r);}
    if(msg?.t==='buy'&&msg.kind==='item'&&r?.t==='bought'&&p.room?.base==='home:'+p.acct){for(const resident of [...p.room.members])shard.enterRoom(resident);}
    if(msg?.t==='buy'&&msg.kind==='home'&&r?.t==='moved'&&previousPlace==='home'&&previousHome!==p.state.home)shard.enterRoom(p);
    shard.send(p,{t:'st',state:Game.view(p.state)});
  }catch(e){shard.fault(p,'durable gameplay',e);shard.send(p,{t:'toast',k:'bad',m:'Could not save this action. Please try again.'});}
}
