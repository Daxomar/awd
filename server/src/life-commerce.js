import * as Game from './game/rules.js';
import * as Social from './social.js';
import {life,event} from './game/life-progression.js';

export async function migrateCommerce(db){
  await db.query(`create table if not exists life_listings(id bigserial primary key,seller int not null references accounts(id),seller_name text not null,phone jsonb not null,price int not null check(price>0),status text not null default 'listed',buyer int references accounts(id),credit bigint references credits(id),expires_at timestamptz not null default now()+interval '24 hours',created_at timestamptz not null default now());
    create index if not exists life_listings_market on life_listings(status,expires_at,id);
    create index if not exists life_listings_seller on life_listings(seller,status);
    create unique index if not exists life_phone_escrow on life_listings(seller,(phone->>'id')) where status='listed';`);
}
const oldEnough=(s,now)=>now-(s.flags.bornAt||s.created)>=Social.MIN_AGE_H*3600000;
export async function commerceAction(db,s,p,msg,now){
  if(msg.op==='market_list'){
    if(!oldEnough(s,now))throw Error('Phone resale opens after six hours in Accra.');
    if((await db.query("select 1 from life_listings where seller=$1 and status='listed'",[p.acct])).rowCount>=3)throw Error('Collect or sell an existing listing first (three maximum).');
    const i=s.phones.findIndex(x=>x.id===msg.phone);if(i<0)throw Error('That phone is not in your inventory.');const ph=s.phones[i],model=Game.PHONES[ph.m];
    if(!model||ph.fake||!ph.tested&&!ph.fixed)throw Error('Only tested genuine phones can be listed. Repair older untested phones at Circle first.');
    if(!Number.isSafeInteger(msg.price)||msg.price<1||msg.price>Math.min(50000,model[1]*2))throw Error('Price must be a whole amount within the permitted model range.');
    s.phones.splice(i,1);const row=(await db.query('insert into life_listings(seller,seller_name,phone,price) values($1,$2,$3,$4) returning id',[p.acct,p.name,JSON.stringify(ph),msg.price])).rows[0];
    event(s,'market_listed',{listing:+row.id,model:ph.m},now);return {listing:+row.id,message:'Phone held safely in escrow for 24 hours.'};
  }
  if(!Number.isSafeInteger(msg.id)||msg.id<1)throw Error('Choose a valid listing.');
  const row=(await db.query('select l.*,a.banned,pl.state as seller_state from life_listings l join accounts a on a.id=l.seller join players pl on pl.id=l.seller where l.id=$1 for update of l',[msg.id])).rows[0];if(!row)throw Error('Listing not found.');
  if(row.status!=='listed')throw Error('This listing is already closed.');
  if(msg.op==='market_cancel'){
    if(row.seller!==p.acct)throw Error('Only the seller can collect escrow.');
    if(s.phones.length>=4)throw Error('Make room in your four-phone inventory before collecting.');
    s.phones.push(row.phone);await db.query("update life_listings set status='returned' where id=$1",[row.id]);return {message:'Unsold phone returned to your inventory.'};
  }
  if(msg.op!=='market_buy'||row.seller===p.acct)throw Error('Choose another player’s available listing.');
  if(row.expires_at.getTime()<=now)throw Error('This listing has expired. Its owner can collect the phone.');
  if(row.banned||!oldEnough(s,now)||!oldEnough(row.seller_state,now))throw Error('Both trading accounts must be eligible and at least six hours old.');
  const check=Social.checkSend({...p,state:s},+row.price,now);if(typeof check==='string')throw Error(check);
  if(s.phones.length>=4||s.phones.some(x=>x.id===row.phone.id))throw Error('Make room for a unique phone in your four-phone inventory.');
  s.momo-=check.a+check.fee;
  s.ledger.push([now,-check.a-check.fee,`Phone from @${row.seller_name} (GH₵${check.fee} fee)`]);s.ledger=s.ledger.slice(-60);
  event(s,'money',{delta:-check.a-check.fee,label:`Phone from @${row.seller_name} (GH₵${check.fee} fee)`,balance:s.cash+s.momo},now);
  s.phones.push(row.phone);life(s).commerce.bought++;
  const credit=(await db.query("insert into credits(to_id,from_id,from_name,amount,fee,kind,note) values($1,$2,$3,$4,$5,'market','Phone resale') returning id",[row.seller,p.acct,p.name,row.price,check.fee])).rows[0].id;
  await db.query("insert into ledger(from_id,to_id,amount,kind) values($1,$2,$3,'market')",[p.acct,row.seller,row.price]);
  await db.query("update life_listings set status='sold',buyer=$2,credit=$3 where id=$1",[row.id,p.acct,credit]);
  s.xfer.out+=check.a;s.xfer.n++;
  event(s,'market_purchase',{listing:+row.id,amount:row.price,seller:row.seller},now);
  return {message:'Phone received. The seller’s payment is durably queued.',creditTo:row.seller};
}
export async function marketView(db,acct){
  const rows=(await db.query(`select id,seller,seller_name,price,status,expires_at,phone->>'id' as phone_id,phone->>'m' as model,phone->>'cond' as condition
    from life_listings where (status='listed' and (expires_at>now() or seller=$1)) or (seller=$1 and status='sold') order by id desc limit 50`,[acct])).rows;
  return rows.map(r=>({...r,id:+r.id,modelName:Game.PHONES[r.model]?.[0]||'Phone',fee:Social.FEE(r.price),mine:r.seller===acct,expired:new Date(r.expires_at).getTime()<Date.now()}));
}
