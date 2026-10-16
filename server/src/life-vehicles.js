// Stage 3: player-to-player vehicle resale and cosmetic paint.
// A listed car leaves the seller's saved state and waits in SQL escrow, so an offline
// seller's JSON is never rewritten. The buyer pays through the ordinary goods path
// (car prices exceed MoMo transfer limits) and the seller receives one durable credit,
// all inside the caller's withMoney transaction with its exact-payload receipt.
import * as Game from './game/rules.js';
import * as Social from './social.js';
import {event} from './game/life-progression.js';

// Cosmetic paints. Free: appearance only, no value, reputation or travel effect.
export const PAINTS=Object.freeze({
  factory:{name:'Factory colour',hex:null},pearl:{name:'Pearl white',hex:'#f1efe8'},silver:{name:'Harmattan silver',hex:'#c9ccd1'},
  black:{name:'Midnight black',hex:'#16191f'},red:{name:'Kente red',hex:'#b5172b'},gold:{name:'Black Star gold',hex:'#d9a521'},
  green:{name:'Volta green',hex:'#1f6b45'},blue:{name:'Atlantic blue',hex:'#24508f'},
});
// Anti-laundering band: a used car sells for 40–100% of its catalogue price.
export const PRICE_BAND=Object.freeze({min:0.4,max:1});
export const LISTING_HOURS=72;
const oldEnough=(s,now)=>now-(s.flags.bornAt||s.created)>=Social.MIN_AGE_H*3600000;
export const priceRange=car=>{const c=Game.DATA.CARS[car];return c?{min:Math.ceil(c.price*PRICE_BAND.min),max:Math.floor(c.price*PRICE_BAND.max)}:null;};
export const cleanStyle=style=>({paint:Object.hasOwn(PAINTS,style?.paint)?style.paint:'factory'});

export async function migrateVehicles(db){
  await db.query(`create table if not exists vehicle_listings(
      id bigserial primary key,seller int not null references accounts(id),seller_name text not null,
      car text not null,style jsonb not null default '{}'::jsonb,price bigint not null check(price>0 and price<=10000000),
      status text not null default 'listed' check(status in ('listed','sold','returned')),
      buyer int references accounts(id),credit bigint references credits(id),
      expires_at timestamptz not null,created_at timestamptz not null default now(),closed_at timestamptz);
    create unique index if not exists vehicle_one_open_listing on vehicle_listings(seller) where status='listed';
    create index if not exists vehicle_listings_market on vehicle_listings(status,expires_at,id);`);
}

const idle=(s,now)=>{
  if(s.busy||s.shift)throw Error('Finish your current activity, journey or shift first.');
  if(s.flags.jailUntil>now)throw Error('Vehicle trading is unavailable in custody.');
};

export async function vehicleAction(db,s,p,msg,now){
  if(msg.op==='vehicle_paint'){
    if(!s.car)throw Error('You need your own car to repaint it.');
    if(!Object.hasOwn(PAINTS,msg.paint))throw Error('Choose a supported paint.');
    idle(s,now);s.carStyle=cleanStyle({paint:msg.paint});event(s,'vehicle_paint',{car:s.car,paint:msg.paint},now);
    return {message:`${PAINTS[msg.paint].name} applied. Paint is cosmetic and does not change the car's value.`};
  }
  if(msg.op==='vehicle_list'){
    idle(s,now);
    if(!s.car)throw Error('You do not own a car to sell.');
    if(!oldEnough(s,now))throw Error(`Vehicle resale opens after ${Social.MIN_AGE_H} hours in Accra.`);
    const range=priceRange(s.car);
    if(!Number.isSafeInteger(msg.price)||msg.price<range.min||msg.price>range.max)throw Error(`Ask between GH₵${range.min.toLocaleString('en-GH')} and GH₵${range.max.toLocaleString('en-GH')} for this model.`);
    const car=s.car,style=cleanStyle(s.carStyle);
    const row=(await db.query(`insert into vehicle_listings(seller,seller_name,car,style,price,expires_at,created_at)
      values($1,$2,$3,$4,$5,to_timestamp($6/1000.0),to_timestamp($7/1000.0)) returning id`,[p.acct,p.name,car,JSON.stringify(style),msg.price,now+LISTING_HOURS*3600000,now])).rows[0];
    s.car=null;s.carStyle=null;   // the car waits in escrow; fuel and rentals stay with the player
    event(s,'vehicle_listed',{listing:+row.id,car,amount:msg.price},now);
    return {listing:+row.id,message:`${Game.DATA.CARS[car].name} held in escrow for ${LISTING_HOURS} hours. Collect it any time before it sells.`};
  }
  if(!Number.isSafeInteger(msg.id)||msg.id<1)throw Error('Choose a valid vehicle listing.');
  const row=(await db.query(`select l.*,a.banned,pl.state as seller_state from vehicle_listings l
    join accounts a on a.id=l.seller join players pl on pl.id=l.seller where l.id=$1 for update of l`,[msg.id])).rows[0];
  if(!row)throw Error('Vehicle listing not found.');
  if(row.status!=='listed')throw Error('This vehicle listing is already closed.');
  if(msg.op==='vehicle_cancel'){
    if(row.seller!==p.acct)throw Error('Only the seller can collect this car.');
    idle(s,now);if(s.car)throw Error('You already have a car. Sell or trade it before collecting this one.');
    s.car=row.car;s.carStyle=cleanStyle(row.style);
    await db.query("update vehicle_listings set status='returned',closed_at=to_timestamp($2/1000.0) where id=$1",[row.id,now]);
    event(s,'vehicle_returned',{listing:+row.id,car:row.car},now);
    return {message:`${Game.DATA.CARS[row.car].name} returned from escrow.`};
  }
  if(msg.op!=='vehicle_buy'||row.seller===p.acct)throw Error('Choose another player’s available car.');
  if(row.expires_at.getTime()<=now)throw Error('This listing has expired. Its owner can collect the car.');
  idle(s,now);
  if(row.banned||!oldEnough(s,now)||!oldEnough(row.seller_state,now))throw Error(`Both trading accounts must be eligible and at least ${Social.MIN_AGE_H} hours old.`);
  if(s.car)throw Error('You already own a car. Sell it or trade it in at Correct Cars first.');
  const price=Number(row.price),name=Game.DATA.CARS[row.car]?.name||'Car';
  if(!Game.spendFor(s,price,`Used ${name} from @${row.seller_name}`))throw Error(`You need GH₵${price.toLocaleString('en-GH')} to buy this car.`);
  s.car=row.car;s.carStyle=cleanStyle(row.style);   // no reputation bonus: resale must not farm rep
  const credit=(await db.query("insert into credits(to_id,from_id,from_name,amount,fee,kind,note) values($1,$2,$3,$4,0,'vehicle','Vehicle resale') returning id",[row.seller,p.acct,p.name,price])).rows[0].id;
  await db.query("insert into ledger(from_id,to_id,amount,kind) values($1,$2,$3,'vehicle')",[p.acct,row.seller,price]);
  await db.query("update vehicle_listings set status='sold',buyer=$2,credit=$3,closed_at=to_timestamp($4/1000.0) where id=$1",[row.id,p.acct,credit,now]);
  event(s,'vehicle_purchase',{listing:+row.id,car:row.car,amount:price,seller:row.seller},now);
  return {message:`${name} is yours. The seller's payment is durably queued.`,creditTo:row.seller};
}

export async function vehicleView(db,acct,s,now=Date.now()){
  const rows=(await db.query(`select id,seller,seller_name,car,style,price,status,expires_at from vehicle_listings
    where (status='listed' and (expires_at>to_timestamp($2/1000.0) or seller=$1)) or (seller=$1 and status='sold' and closed_at>now()-interval '7 days')
    order by id desc limit 50`,[acct,now])).rows;
  return {
    car:s.car?{id:s.car,name:Game.DATA.CARS[s.car].name,catalogue:Game.DATA.CARS[s.car].price,style:cleanStyle(s.carStyle),range:priceRange(s.car)}:null,
    paints:Object.entries(PAINTS).map(([id,x])=>({id,...x})),
    listings:rows.map(r=>({id:+r.id,seller:r.seller_name,mine:r.seller===acct,car:r.car,name:Game.DATA.CARS[r.car]?.name||'Car',
      catalogue:Game.DATA.CARS[r.car]?.price||null,style:cleanStyle(r.style),price:Number(r.price),status:r.status,
      expiresAt:new Date(r.expires_at).getTime(),expired:new Date(r.expires_at).getTime()<=now})),
    note:'Used cars keep their model and paint. Condition and mileage are not simulated. Buying a used car gives no reputation bonus.',
  };
}
