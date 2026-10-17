import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game/rules.js';
import {MODELS,demandPeriod,periodsToSettle,PERIOD} from '../src/game/business-model.js';
import {life,progressionView} from '../src/game/life-progression.js';
import {sharedDefinition} from '../src/life-social.js';
import {progressOf} from '../src/objectives.js';
import {Shard} from '../src/shard.js';
import {durableTick} from '../src/life-game.js';
const fixture=()=>{const s=Game.newState({id:3434,u:'life_test'});Object.assign(s,{onboarded:true,home:'nima',place:'home',cash:800,momo:0,traits:[]});return {state:s,acct:3434,rx:0,rz:0};};
test('business demand is stock/price/cash/open bounded and offline windows never exceed 48 hours',()=>{
 const m=MODELS.provisions,b={operating:true,price:12,stock:2,till:30,reputation:100,location:'makola',level:0};
 const x=demandPeriod(b,m,{open:true,noise:.95,skill:10});assert.ok(x.units<=2);assert.equal(x.revenue,x.units*12);assert.equal(x.cogs,x.units*8);
 for(const patch of [{stock:0},{operating:false},{price:16}])assert.equal(demandPeriod({...b,...patch},m,{open:true,noise:.95}).units,0);
 assert.equal(demandPeriod({...b,till:0},m,{open:true,noise:.95}).paused,true);
 assert.equal(demandPeriod(b,m,{open:false,noise:.95}).expense,0);
 assert.equal(periodsToSettle(0,1000*PERIOD).periods.length,8);assert.ok(periodsToSettle(0,1000*PERIOD).skipped>0);assert.equal(periodsToSettle(1000,100*PERIOD).periods.length,0);
});
test('career changes preserve history, rank, eligibility and all ten capped skills',()=>{
 const p=fixture(),s=p.state,now=Date.UTC(2026,9,16,12);Game.goPlace(p,'hub');
 s.job={id:'tech',rank:2,grade:1,perf:77,shifts:6,lastDay:-1,since:now-100000};s.skills.coding=5;
 assert.equal(Game.onMsg(p,{t:'apply',id:'tech'},{},now).t,'toast');
 Game.onMsg(p,{t:'work',op:'quit'},{},now);assert.equal(s.life.careers.tech.saved.rank,2);
 Game.onMsg(p,{t:'apply',id:'tech'},{},now);assert.equal(s.job.rank,2);assert.equal(s.job.perf,77);
 for(const k in s.skills){for(let i=0;i<20;i++)Game.gainSkill(s,k,100);assert.ok(s.skills[k]<=10);}
 assert.equal(progressionView(s).skills.length,10);const before=structuredClone(s.skills);Game.onMsg(p,{t:'setSkill',skill:'coding',level:100},{},now);assert.deepEqual(s.skills,before);
});
test('invalid cooking never spends money or groceries; real appliances affect actual home actions',()=>{
 const p=fixture(),s=p.state,now=Date.UTC(2026,9,16,12);s.food=1;
 assert.equal(Game.onMsg(p,{t:'act',home:true,id:'cook'},{},now).t,'toast');assert.equal(s.food,1);assert.equal(s.cash,800);
 s.items.gas=true;s.items.fridge=true;s.n.hunger=0;const r=Game.onMsg(p,{t:'act',home:true,id:'cook'},{},now);assert.equal(r.t,'busy');assert.equal(s.food,0);
 Game.tick(p,r.busy.end+1,{});assert.ok(s.n.hunger>0);assert.ok(s.cash>=0);
 const other=fixture();other.state.items.gas=true;other.state.food=1;other.state.n.hunger=0;const plain=Game.onMsg(other,{t:'act',home:true,id:'cook'},{},now);Game.tick(other,plain.busy.end+1,{});assert.ok(s.n.hunger>other.state.n.hunger);
});
test('crime cannot target players; detection/fines/recovery are server facts and time limited',()=>{
 const p=fixture(),s=p.state,now=Date.UTC(2026,9,16,12);Game.goPlace(p,'circle');
 assert.equal(Game.onMsg(p,{t:'act',loc:'circle',id:'pickpocket',target:55},{},now).k,'bad');
 const r=Game.onMsg(p,{t:'act',loc:'circle',id:'pickpocket'},{},now),random=Math.random;try{Math.random=()=>0;Game.tick(p,r.busy.end+1,{});}finally{Math.random=random;}
 assert.equal(life(s).legal.caught,1);assert.ok(life(s).legal.fines>0);assert.equal(s.place,'police');assert.ok(s.cash>=0);assert.ok(life(s).legal.reviewUntil<=r.busy.end+86400001);
 const review=life(s).legal.reviewUntil,release=s.flags.jailUntil+1;s.skills.charisma=2;Game.goPlace(p,'bank');
 assert.match(Game.onMsg(p,{t:'apply',id:'bank'},{},release).m,/conduct review/);
 Game.goPlace(p,'police');s.needsAt=release;s.lastDaily=Game.clock(release).day;s.lastWeekly=Math.floor((release/86400000+3)/7);
 const wallet=s.cash+s.momo,recovery=Game.onMsg(p,{t:'act',loc:'police',id:'community_service'},{},release);assert.equal(recovery.t,'busy');
 Game.tick(p,recovery.busy.end+1,{});assert.equal(life(s).legal.reviewUntil,review-6*3600000);assert.equal(s.cash+s.momo,wallet);
 Game.goPlace(p,'bank');s.certs={finlit:{passedAt:1},custserv:{passedAt:1},teller:{passedAt:1}};assert.equal(Game.onMsg(p,{t:'apply',id:'bank'},{},review+1).t,'hired');
});
test('shared capabilities refer to real venues and long-term goals reject invented completion',()=>{
 assert.equal(sharedDefinition('meal','home'),null);assert.equal(sharedDefinition('conversation','home'),null);assert.equal(sharedDefinition('exercise','vibes'),null);
 assert.ok(sharedDefinition('meal','chopbar',Date.UTC(2026,9,16,12)).cost>0);
 const s=fixture().state;for(const id of ['business_start','player_trade','mutual_friend','shared_five','home_ownership'])assert.equal(progressOf(s,id),false);
 s.life=undefined;assert.equal(progressOf(s,'business_profit'),false);
});
test('Circle NPC resale cannot be farmed by immediate repeated tapping',()=>{
 const p=fixture(),s=p.state,now=Date.UTC(2026,9,16,12);Game.goPlace(p,'circle');
 for(let i=0;i<8;i++){s.phones.push({id:'stock'+i,m:'button',cond:80,paid:80,fake:false,tested:true});const r=Game.onMsg(p,{t:'phone',op:'sell',id:'stock'+i},{},now+i*60001);assert.equal(r.t,'phones');}
 s.phones.push({id:'extra',m:'button',cond:80,paid:80,fake:false,tested:true});const wallet=s.cash+s.momo;
 assert.equal(Game.onMsg(p,{t:'phone',op:'sell',id:'extra'},{},now+9*60001).k,'bad');assert.equal(s.cash+s.momo,wallet);assert.equal(s.phones.length,1);
});
test('private home access needs reciprocal accepted friendship and respects blocking',()=>{
 const a=fixture(),b=fixture();b.acct++;b.state.home='nima';
 assert.equal(Shard.prototype.canVisit(a,b),false);
 a.state.friends[b.acct]={accepted:true};b.state.friends[a.acct]={accepted:true};
 assert.equal(Shard.prototype.canVisit(a,b),true);b.state.flags.blocked=[a.acct];assert.equal(Shard.prototype.canVisit(a,b),false);
 b.state.flags.blocked=[];b.state.place='circle';assert.equal(Shard.prototype.canVisit(a,b),false);
 // Stage 7 owner-controlled access: invitations, open/closed modes, visitor limit and removal.
 b.state.place='home';const members=new Set([b]),ctx={homePasses:new Map(),homeRemoved:new Map(),rooms:new Map([['home:'+b.acct,{members}]])};
 const check=()=>Shard.prototype.visitCheck.call(ctx,a,b);
 b.state.homeAccess={mode:'invite'};assert.equal(check().ok,false,'invite-only home refuses friends without an invitation');
 ctx.homePasses.set(b.acct,new Map([[a.acct,Date.now()+60000]]));assert.equal(check().ok,true,'an invitation admits the guest');
 ctx.homePasses.clear();b.state.homeAccess={mode:'closed'};assert.equal(check().ok,false);
 a.state.friends={};b.state.friends={};b.state.homeAccess={mode:'open',limit:1};assert.equal(check().ok,true,'an open home admits non-friends');
 const other=fixture();other.acct+=7;members.add(other);assert.equal(check().why,'full','the visitor limit applies');
 a.state.place='visit:'+b.acct;assert.equal(check().ok,true,'a guest already inside is not counted against the limit');
 a.state.place='circle';members.delete(other);ctx.homeRemoved.set(b.acct,new Map([[a.acct,Date.now()+60000]]));assert.equal(check().why,'removed','a removed guest cannot walk straight back in');
});
test('a legitimate promotion persists history and top rank has no invented next threshold',()=>{
 const p=fixture(),s=p.state,now=Date.UTC(2026,9,16,12);Game.goPlace(p,'hub');
 s.job={id:'tech',rank:0,grade:3,perf:100,shifts:20,lastDay:-1};s.skills.coding=10;
 s.shift={start:now-3600000,last:now,worked:60,tasks:1,wins:0};s.needsAt=now;s.lastDaily=Game.clock(now).day;s.lastWeekly=Math.floor((now/86400000+3)/7);
 const blocked=Game.tick(p,now,{});assert.equal(s.job.rank,0,'Junior Developer needs the coding certificate');assert.match(JSON.stringify(blocked),/Practical Coding Simulation/);
 s.certs={codeprac:{passedAt:1}};s.job.perf=100;s.shift={start:now-3600000,last:now,worked:60,tasks:1,wins:0};
 Game.tick(p,now,{});assert.equal(s.job.rank,1);assert.equal(s.stats.promos,1);assert.equal(s.life.careers.tech.bestRank,1);
 s.job.rank=4;s.job.grade=3;s.job.perf=100;s.shift={start:now-3600000,last:now,worked:60,tasks:1,wins:0};
 const r=Game.tick(p,now,{});assert.ok(!JSON.stringify(r).includes('undefined'));assert.equal(s.job.perf,100);
 s.items.ring=true;const wallet=s.cash+s.momo;Game.onMsg(p,{t:'buy',kind:'item',id:'ring'},{},now);assert.equal(s.cash+s.momo,wallet);
});
test('reconnecting preserves attended work without offline salary, skill or assignment progress',()=>{
 const p=fixture(),s=p.state,now=Date.UTC(2026,9,16,12);Game.goPlace(p,'hub');
 s.job={id:'tech',rank:0,grade:0,perf:55,shifts:0,lastDay:-1};s.shift={start:now-7200000,last:now-6000000,worked:20,tasks:1,completedTasks:['saved-task'],activeTask:{id:'incomplete',readyAt:now-1000}};
 s.needsAt=now-60000;const wallet=s.cash+s.momo,skill=s.skills.coding;
 Game.onJoin(p,now);assert.equal(s.shift.worked,20);assert.equal(s.shift.start,now-20*60000);assert.equal(s.shift.activeTask,null);
 Game.tick(p,now,{});assert.equal(s.cash+s.momo,wallet);assert.equal(s.skills.coding,skill);assert.equal(s.shift.tasks,1);
 Game.onJoin(p,now+3600000);assert.equal(s.shift.worked,20);assert.equal(s.job.perf,55);assert.equal(s.cash+s.momo,wallet);
});
test('legacy aspiration rewards and due match predictions use the durable outcome path',()=>{
 const s=fixture().state,now=Date.UTC(2026,9,16,12);s.needsAt=now;s.lastDaily=Game.clock(now).day;s.lastWeekly=Math.floor((now/86400000+3)/7);
 assert.equal(durableTick(s,now),false);s.flags.matchBets=[{settled:false,end:now-1}];assert.equal(durableTick(s,now),true);
 s.flags.matchBets=[];s.dream='bigman';s.dreamTier=0;s.job={id:'tech'};s.story.at=now-12001;assert.equal(durableTick(s,now),true);
});
test('ordinary attended work and needs stay eligible for periodic persistence',()=>{
 const p=fixture(),s=p.state,now=Date.now();Game.goPlace(p,'hub');
 s.job={id:'tech',rank:0,grade:0,perf:55,shifts:0,lastDay:-1};s.shift={start:now-60000,last:now-1000,worked:1,tasks:0,wins:0};
 s.needsAt=now;s.lastDaily=Game.clock(now).day;s.lastWeekly=Math.floor((now/86400000+3)/7);
 Object.assign(p,{bot:true,roomPlace:'hub',lastKey:'shift',dirty:false});
 const shard=Object.assign(Object.create(Shard.prototype),{players:new Map([[1,p]]),stats:{},policy:null});
 shard.slowTick();assert.equal(p.dirty,true);assert.ok(s.shift.worked>1);
});
