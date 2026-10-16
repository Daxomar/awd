import crypto from 'node:crypto';
import * as Game from './game/rules.js';
import {life,event} from './game/life-progression.js';
import {MODELS,PERIOD,periodsToSettle,demandPeriod} from './game/business-model.js';

export async function migrateBusinesses(db){
  await db.query(`create table if not exists life_businesses(id bigserial primary key,owner int not null references accounts(id),type text not null,location text not null,operating boolean not null default false,price int not null,stock int not null default 0 check(stock>=0),till bigint not null default 30 check(till>=0),level int not null default 0,reputation int not null default 0,last_period bigint not null,created_at timestamptz not null default now(),unique(owner,type));
    alter table life_businesses add column if not exists taxable bigint not null default 0;
    create index if not exists life_business_owner on life_businesses(owner,id);
    create table if not exists life_business_events(id bigserial primary key,business bigint not null references life_businesses(id),key text not null,kind text not null,units int not null default 0,revenue bigint not null default 0,cogs bigint not null default 0,expense bigint not null default 0,cash bigint not null default 0,at timestamptz not null default now(),unique(business,key));`);
}
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export async function businessEvent(db,b,key,kind,x={}){
  await db.query(`insert into life_business_events(business,key,kind,units,revenue,cogs,expense,cash) values($1,$2,$3,$4,$5,$6,$7,$8)`,[b.id,key,kind,x.units||0,x.revenue||0,x.cogs||0,x.expense||0,x.cash||0]);
}
export async function settleBusiness(db,b,s,now=Date.now()){
  const m=MODELS[b.type],{end,periods,skipped}=periodsToSettle(+b.last_period,now);let units=0,profit=0;
  for(const period of periods){
    const mid=period*PERIOD+PERIOD/2,noise=crypto.createHash('sha256').update(`${b.id}:${period}`).digest().readUInt32BE(0)/4294967296;
    const sale=demandPeriod(b,m,{hour:new Date(mid).getUTCHours(),open:Game.isOpen(Game.LOC[b.location],mid),noise,skill:s.skills[m.skill]});
    if(sale.paused)b.operating=false;
    b.stock-=sale.units;b.till=+b.till+sale.revenue-sale.expense;
    b.taxable=Math.max(0,+(b.taxable||0)+sale.revenue-sale.cogs-sale.expense);
    if(sale.units)b.reputation=Math.min(100,b.reputation+1);
    units+=sale.units;profit+=sale.revenue-sale.cogs-sale.expense;
    await businessEvent(db,b,'period:'+period,'settlement',sale);
  }
  if(end>+b.last_period){b.last_period=end;await db.query('update life_businesses set stock=$2,till=$3,reputation=$4,last_period=$5,operating=$6,taxable=$7 where id=$1',[b.id,b.stock,b.till,b.reputation,b.last_period,b.operating,b.taxable]);}
  if(units||profit){const l=life(s);l.business.sales+=units;l.business.profit+=profit;Game.gainSkill(s,m.skill,Math.min(.1,units*.01));event(s,'business_settlement',{business:+b.id,units,profit,skipped},now);}
  return {periods:periods.length,skipped};
}
export async function businessAction(db,s,acct,msg,now){
  const op=msg.op;
  if(op==='business_create'){
    const m=MODELS[msg.type];if(!Object.hasOwn(MODELS,msg.type||'')||!m.locations.includes(msg.location))throw Error('Choose a supported business and existing location.');
    if((await db.query('select 1 from life_businesses where owner=$1',[acct])).rowCount>=2)throw Error('Manage at most two businesses.');
    if((await db.query('select 1 from life_businesses where owner=$1 and type=$2',[acct,msg.type])).rowCount)throw Error('You already operate this business type.');
    if(!Game.spendFor(s,m.startup,`${m.name} startup (including GH₵30 reserve)`))throw Error('Not enough game money for startup.');
    const b=(await db.query('insert into life_businesses(owner,type,location,price,last_period,till) values($1,$2,$3,$4,$5,$6) returning *',[acct,msg.type,msg.location,m.price,Math.floor(now/PERIOD),m.reserve])).rows[0];
    await businessEvent(db,b,msg.key,'startup',{expense:m.startup-m.reserve,cash:m.reserve});life(s).business.created++;event(s,'business_created',{business:+b.id,type:msg.type},now);return {business:+b.id,message:'Business created. Buy stock and review pricing before opening.'};
  }
  if(!integer(msg.id,1,Number.MAX_SAFE_INTEGER))throw Error('Choose your business.');
  const b=(await db.query('select * from life_businesses where id=$1 and owner=$2 for update',[msg.id,acct])).rows[0];if(!b)throw Error('Business not found.');
  await settleBusiness(db,b,s,now);const m=MODELS[b.type];
  if(op==='business_stock'){
    if(!integer(msg.quantity,1,m.capacity*(b.level?2:1)-b.stock))throw Error('Quantity exceeds available stock capacity.');
    const cost=msg.quantity*m.unit;if(!Game.spendFor(s,cost,`${m.name} wholesale inventory`))throw Error('Not enough game money for stock.');
    b.stock+=msg.quantity;await db.query('update life_businesses set stock=$2 where id=$1',[b.id,b.stock]);await businessEvent(db,b,msg.key,'inventory',{units:msg.quantity,cash:-cost});
  }else if(op==='business_configure'){
    if(!integer(msg.price,m.unit,m.maxPrice)||typeof msg.operating!=='boolean')throw Error('Choose a valid whole-cedi price and operating state.');
    await db.query('update life_businesses set price=$2,operating=$3 where id=$1',[b.id,msg.price,msg.operating]);await businessEvent(db,b,msg.key,msg.operating?'opened':'closed');
  }else if(op==='business_withdraw'){
    if(!integer(msg.amount,1,+b.till))throw Error('Withdraw only cash available in the till.');
    const income=Math.min(+(b.taxable||0),msg.amount),capital=msg.amount-income;
    await db.query('update life_businesses set till=till-$2,taxable=taxable-$3 where id=$1',[b.id,msg.amount,income]);
    Game.earnFor(s,income,`${m.name} profit withdrawal`);
    if(capital){s.momo+=capital;event(s,'money',{delta:capital,label:`${m.name} capital returned`,balance:s.cash+s.momo},now);}
    await businessEvent(db,b,msg.key,'withdrawal',{cash:-msg.amount});
  }else if(op==='business_fund'){
    if(!integer(msg.amount,1,10000)||!Game.spendFor(s,msg.amount,`${m.name} operating reserve`))throw Error('Choose an affordable reserve amount.');
    await db.query('update life_businesses set till=till+$2 where id=$1',[b.id,msg.amount]);await businessEvent(db,b,msg.key,'capital',{cash:msg.amount});
  }else if(op==='business_expand'){
    const totals=(await db.query('select coalesce(sum(units) filter(where kind=\'settlement\'),0) units,coalesce(sum(revenue-cogs-expense) filter(where kind=\'settlement\'),0) profit from life_business_events where business=$1',[b.id])).rows[0];
    if(b.level||+totals.units<25||+totals.profit<m.startup/2)throw Error('Expansion needs 25 sales and operating net profit of half the startup cost.');
    if(!Game.spendFor(s,m.expand,`${m.name} expansion`))throw Error('Not enough game money to expand.');
    await db.query('update life_businesses set level=1 where id=$1',[b.id]);await businessEvent(db,b,msg.key,'expansion',{expense:m.expand});
  }else if(op!=='business_settle')throw Error('Unknown business action.');
  return {business:+b.id,message:'Business saved.'};
}
export async function businessesView(db,acct,s,now){
  const rows=(await db.query('select * from life_businesses where owner=$1 order by id for update',[acct])).rows;
  for(const b of rows){b.window=await settleBusiness(db,b,s,now);b.id=+b.id;b.till=+b.till;
    b.statement=(await db.query(`select coalesce(sum(revenue),0) revenue,coalesce(sum(cogs),0) cogs,coalesce(sum(expense),0) expenses,coalesce(sum(-cash) filter(where kind='inventory'),0) inventory_purchases,coalesce(sum(revenue-cogs-expense) filter(where kind='settlement'),0) operating_profit from life_business_events where business=$1`,[b.id])).rows[0];
    for(const k in b.statement)b.statement[k]=+b.statement[k];b.statement.gross_profit=b.statement.revenue-b.statement.cogs;b.statement.net_profit=b.statement.gross_profit-b.statement.expenses;
    b.transactions=(await db.query('select kind,units,revenue,cogs,expense,cash,at from life_business_events where business=$1 order by id desc limit 20',[b.id])).rows;
  }
  life(s).businessAssets=rows.reduce((total,b)=>total+b.till+b.stock*MODELS[b.type].unit,0);
  return {models:MODELS,rows,periodHours:6,offlineHours:48,simulatedDemand:true};
}
export async function refreshBusinessAssets(db,s,acct){
  const rows=(await db.query('select type,till,stock from life_businesses where owner=$1',[acct])).rows;
  life(s).businessAssets=rows.reduce((n,b)=>n+(+b.till)+b.stock*MODELS[b.type].unit,0);
}
