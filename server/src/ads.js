// Paid billboards: real businesses rent in-game billboards at real Accra junctions.
// Flow: advertiser submits artwork + weeks → Paystack checkout (GHS, MoMo or card) → paid → owner approves → live in game.
// Without PAYSTACK_SECRET the flow falls back to manual payment (owner marks paid in /admin).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { pool } from './db.js';
import { secret } from './secrets.js';
import { safeEqual } from './security.js';
import * as Payments from './payments.js';
import {createHash} from 'node:crypto';

// ROTATION model (what makes billboards pay): every rotating board carries up to CAP ads, each on screen 15 s in turn,
// priced per ad per week. Exclusive boards (airport) carry one advertiser at a time at a premium.
// yaw = direction the face looks (radians, 0 = +z/south)
export const CAP = +(process.env.AD_CAP || 40), ROTATE_S = 15;
import {AD_PLACEMENTS as SLOTS} from '../../shared/ad-placements.js';
export {SLOTS};
const SLOT = Object.fromEntries(SLOTS.map((s) => [s.id, s]));
const DIR = path.resolve(process.env.ADS_DIR || './uploads/ads'); fs.mkdirSync(DIR, { recursive: true });
const PAYSTACK = secret('PAYSTACK_SECRET');
const ADMIN_KEY = secret('ADMIN_KEY');
const WEEK = 7 * 86400000;

export async function migrateAds() {
  await pool.query(`create table if not exists ad_orders (
    id bigserial primary key, slot text not null, title text not null, url text, contact text not null, email text,
    weeks int not null check (weeks between 1 and 12), amount int not null, status text not null default 'pending_payment',
    ref text unique, starts bigint, ends bigint, note text, created_at timestamptz default now());
  create index if not exists ad_orders_slot on ad_orders (slot, ends);`);
  await pool.query(`create table if not exists ad_placements(id text primary key,spec jsonb not null,updated_at timestamptz default now());
    create table if not exists ad_reservations(order_id bigint primary key references ad_orders(id),placement text not null references ad_placements(id),
      seat int not null,status text not null,expires bigint not null,created_at timestamptz default now());
    create unique index if not exists ad_exclusive_seat on ad_reservations(placement,seat) where status in ('reserved','payment_pending','active');
    create table if not exists ad_exposures(campaign bigint not null references ad_orders(id),viewer int not null references accounts(id),bucket bigint not null,
      kind text not null check(kind in ('impression','click')),at timestamptz default now(),primary key(campaign,viewer,bucket,kind));
    create table if not exists ad_metrics_daily(campaign bigint not null references ad_orders(id),day date not null,impressions bigint not null default 0,clicks bigint not null default 0,primary key(campaign,day));`);
  for(const s of SLOTS)await pool.query('insert into ad_placements(id,spec) values($1,$2) on conflict(id) do update set spec=excluded.spec,updated_at=now()',[s.id,JSON.stringify(s)]);
}
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const okUrl = (u) => { if (!u) return ''; try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href.slice(0, 300) : ''; } catch { return ''; } };

// public: slots with what's live now and when each is next free
export async function listSlots() {
  const now = Date.now();
  await expireReservations();
  const r = await pool.query(`select id, slot, title, url, starts, ends from ad_orders where status='approved' and ends > $1 order by starts`, [now]);
  const held=(await pool.query("select placement,count(*)::int n,min(expires) as expires from ad_reservations where status in ('reserved','payment_pending','active') group by placement")).rows;
  return SLOTS.map((s) => {
    const mine = r.rows.filter((a) => a.slot === s.id); const live = mine.filter((a) => +a.starts <= now && +a.ends > now).map((a) => ({ id: +a.id, title: a.title, url: a.url, img: `/ads/${a.id}.jpg`, ends: +a.ends }));
    const nextFree = s.exclusive ? mine.reduce((t, a) => Math.max(t, +a.ends), now) : live.length >= CAP ? Math.min(...live.map((a) => a.ends)) : now;
    const reservation=held.find(r=>r.placement===s.id),cap=s.exclusive?1:CAP;
    return { ...s, exclusive: !!s.exclusive, cap, onAir: live.length, rotate: ROTATE_S, nextFree:reservation?.n>=cap?Math.max(nextFree,+reservation.expires):nextFree, availability:reservation?.n>=cap||nextFree>now?'reserved':'available',live };
  });
}

// advertiser submits artwork; returns a payment link (Paystack) or manual instructions
export async function createOrder(b, acct) {
  const s = Object.hasOwn(SLOT,b.slot) && SLOT[b.slot]; if (!s) return { error: 'Pick a billboard.' };
  const weeks = Math.max(1, Math.min(12, b.weeks | 0)); const title = clean(b.title, 60); const contact = clean(b.contact, 80); const email = clean(b.email, 120).toLowerCase();
  if (title.length < 2) return { error: 'Add your business name.' }; if (contact.length < 7) return { error: 'Add a phone number we can reach.' };
  if (PAYSTACK && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) return { error: 'A valid email is needed for the payment receipt.' };
  const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(b.image || ''); if (!m) return { error: 'Upload a PNG, JPG or WebP image.' };
  const raw = Buffer.from(m[2], 'base64'); if (raw.length > 4 * 1024 * 1024) return { error: 'Image too large (max 4 MB).' };
  let img; try { img = await sharp(raw, { limitInputPixels: 10e6 }).rotate().resize(1024, 512, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer(); } catch { return { error: 'That image could not be read (maximum 10 megapixels).' }; }
  const amount = s.price * weeks;
  const artwork=createHash('sha256').update(img).update(JSON.stringify({title,url:okUrl(b.url),weeks,email,contact})).digest('hex');
  return Payments.startPayment({acct,type:'ad',key:b.orderKey,amount:amount*100,email,phone:contact,context:{screen:'ads',placement:s.id,weeks,artwork}},async(db,ref)=>{
    await db.query('select id from ad_placements where id=$1 for update',[s.id]);
    await expireReservations(db,s.id);
    const reservations=(await db.query("select seat from ad_reservations where placement=$1 and status in ('reserved','payment_pending','active')",[s.id])).rows;
    const legacy=(await db.query("select count(*) n from ad_orders a where slot=$1 and status in ('approved','paid') and (ends is null or ends>$2) and not exists(select 1 from ad_reservations r where r.order_id=a.id)",[s.id,Date.now()])).rows[0];
    const cap=s.exclusive?1:CAP,used=new Set(reservations.map(r=>r.seat));
    if(reservations.length+(+legacy.n)>=cap)throw Object.assign(new Error('This placement is reserved. Choose another or try after it expires.'),{public:true});
    let seat=0;while(used.has(seat))seat++;
    const r=await db.query(`insert into ad_orders(slot,title,url,contact,email,weeks,amount,ref) values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,[s.id,title,okUrl(b.url),contact,email,weeks,amount,ref]);
    const id=+r.rows[0].id;await fs.promises.writeFile(path.join(DIR,`${id}.jpg`),img);
    await db.query("insert into ad_reservations(order_id,placement,seat,status,expires) values($1,$2,$3,'payment_pending',$4)",[id,s.id,seat,Date.now()+30*60000]);return id;
  });
}
export async function fulfillPayment(db,order){
  const o=(await db.query('select * from ad_orders where id=$1 for update',[order.legacy_id])).rows[0];
  if(!o||o.amount*100!==+order.amount)return {review:'Advertising order missing or amount changed'};
  const reservation=(await db.query('select * from ad_reservations where order_id=$1 for update',[o.id])).rows[0];
  if(reservation && (reservation.expires<Date.now()||!['reserved','payment_pending','active'].includes(reservation.status)))return {review:'Advertising reservation expired; refund/review required'};
  if(o.status==='pending_payment')await db.query("update ad_orders set status='paid' where id=$1",[o.id]);
  else if(!['paid','approved'].includes(o.status))return {review:'Advertising order closed; refund/review required'};
  if(reservation)await db.query("update ad_reservations set status='reserved',expires=$2 where order_id=$1",[o.id,Date.now()+o.weeks*WEEK]);
}
// put an order on air: rotation boards start now while they have room (else when the earliest ad ends); exclusive boards queue
async function schedule(o) {
  const db=await pool.connect();
  try{
    await db.query('begin');await db.query('select id from ad_placements where id=$1 for update',[o.slot]);
    o=(await db.query('select * from ad_orders where id=$1 for update',[o.id])).rows[0];
    if(o.status!=='paid'){await db.query('rollback');return {error:'This order is not awaiting approval.'};}
    const reservation=(await db.query('select * from ad_reservations where order_id=$1 for update',[o.id])).rows[0];
    if(reservation&&(!['reserved','payment_pending'].includes(reservation.status)||+reservation.expires<Date.now())){await db.query('rollback');return {error:'Reservation expired. Review payment/refund before approval.'};}
    const S=SLOT[o.slot],now=Date.now();let starts=now;
    const live=await db.query("select starts,ends from ad_orders where slot=$1 and status='approved' and ends>$2 order by ends",[o.slot,now]);
    if(S?.exclusive)starts=live.rows.reduce((t,a)=>Math.max(t,+a.ends),now);
    else if(live.rows.length>=CAP)starts=+live.rows[live.rows.length-CAP].ends;
    const ends=starts+o.weeks*WEEK;
    await db.query("update ad_orders set status='approved',starts=$2,ends=$3 where id=$1",[o.id,starts,ends]);
    if(reservation)await db.query("update ad_reservations set status='active',expires=$2 where order_id=$1",[o.id,ends]);
    await db.query('commit');return {ok:true,starts};
  }catch(e){await db.query('rollback');throw e;}finally{db.release();}
}
// browser comes back from checkout: verify server-to-server (never trust the redirect alone)
export async function verify(ref) {
  return Payments.verifyPayment(ref);
}
// Paystack webhook: HMAC-SHA512 of the raw body with the secret key
export async function webhook(rawBody, signature) {
  return Payments.webhook(rawBody,signature);
}
// owner moderation
const adminOk = (k) => !!ADMIN_KEY && safeEqual(k,ADMIN_KEY);
export async function adminList(key) { if (!adminOk(key)) return { error: 'forbidden' }; const r = await pool.query(`select * from ad_orders order by id desc limit 200`); return { rows: r.rows.map((o) => ({ ...o, img: `/ads/${o.id}.jpg` })) }; }
export async function adminAct(key, { id, action }) {
  if (!adminOk(key)) return { error: 'forbidden' };
  const r = await pool.query(`select * from ad_orders where id=$1`, [id | 0]); const o = r.rows[0]; if (!o) return { error: 'not found' };
  if (action === 'markpaid' && o.status === 'pending_payment') return Payments.manualAdPayment(o.ref);
  else if (action === 'approve' && (o.status === 'paid')) {
    const r2 = await schedule(o); if (r2.error) return r2;
  } else if (action === 'reject' || action === 'takedown') {await pool.query(`update ad_orders set status='rejected', ends=least(coalesce(ends, $2), $2) where id=$1`, [o.id, Date.now()]);await pool.query("update ad_reservations set status='cancelled' where order_id=$1",[o.id]);}
  else return { error: `cannot ${action} an order that is ${o.status}` };
  return { ok: true };
}
export async function adImagePath(id,key='',acct=null) {
  if(!Number.isSafeInteger(id)||id<1)return null;
  if(!adminOk(key)){
    const row=await pool.query("select 1 from ad_orders a where id=$1 and ((status='approved' and starts<=$2 and ends>$2) or exists(select 1 from payment_orders p where p.type='ad' and p.legacy_id=a.id and p.acct=$3))",[id,Date.now(),acct]);
    if(!row.rowCount)return null;
  }
  const f=path.join(DIR,`${id}.jpg`);return fs.existsSync(f)?f:null;
}
export async function expireReservations(db=pool,slot=null){
  await db.query("update ad_reservations set status='expired' where expires<$1 and status in ('reserved','payment_pending','active') and ($2::text is null or placement=$2)",[Date.now(),slot]);
}
export async function campaigns(acct){
  const rows=await pool.query(`select a.id,a.slot,a.title,a.url,a.amount,a.weeks,a.status,a.starts,a.ends,a.note,r.status as reservation,r.expires,
    p.status as payment_status,p.review_reason,attempt.checkout_url,attempt.ref,
    coalesce((select sum(impressions) from ad_metrics_daily where campaign=a.id),0) as impressions,
    coalesce((select sum(clicks) from ad_metrics_daily where campaign=a.id),0) as clicks,
    (select count(distinct viewer) from ad_exposures where campaign=a.id and kind='impression' and at>now()-interval '90 days') as unique_viewers
    from ad_orders a join payment_orders p on p.type='ad' and p.legacy_id=a.id
    left join ad_reservations r on r.order_id=a.id left join lateral(select checkout_url,ref from payment_attempts where order_id=p.id order by id desc limit 1) attempt on true
    where p.acct=$1 order by a.id desc limit 100`,[acct]);
  return {rows:rows.rows.map(o=>({...o,id:+o.id,img:`/ads/${o.id}.jpg`,status:o.ends&&+o.ends<Date.now()&&o.status==='approved'?'expired':o.status})),estimates:true,uniqueViewerWindowDays:90};
}
export async function cancelOrder(acct,id){
  if(!Number.isSafeInteger(id)||id<1)return {error:'Invalid campaign.'};
  const db=await pool.connect();try{
    await db.query('begin');
    const p=(await db.query("select * from payment_orders where acct=$1 and type='ad' and legacy_id=$2 for update",[acct,id])).rows[0];
    if(!p||p.fulfilled_at||p.status==='review'){await db.query('rollback');return {error:'Paid or disputed campaigns require owner review to cancel/refund.'};}
    await db.query("update payment_orders set status='cancelled' where id=$1",[p.id]);
    await db.query("update ad_orders set status='cancelled' where id=$1 and status='pending_payment'",[id]);
    await db.query("update ad_reservations set status='cancelled' where order_id=$1",[id]);
    await db.query('commit');return {ok:true};
  }catch(e){await db.query('rollback');throw e;}finally{db.release();}
}
export async function retryOrder(acct,id){
  if(!Number.isSafeInteger(id)||id<1)return {error:'Invalid campaign.'};
  const row=(await pool.query("select p.*,a.email,a.contact from payment_orders p join ad_orders a on p.type='ad' and p.legacy_id=a.id where p.acct=$1 and a.id=$2",[acct,id])).rows[0];
  if(!row||!['pending','failed'].includes(row.status))return {error:'This campaign has no retryable payment.'};
  return Payments.startPayment({acct,type:'ad',key:row.purchase_key,amount:+row.amount,email:row.email,phone:row.contact,context:row.context},()=>{throw Error('Saved advertising order disappeared');});
}
export async function exposure(acct,b){
  const id=Number(b.campaign),kind=b.kind==='click'?'click':'impression';
  if(!Number.isSafeInteger(id)||id<1)return {error:'Invalid campaign.'};
  if(kind==='impression'&&(!(b.seconds>=2&&b.seconds<=60)||!(b.pixels>=400&&b.pixels<=1e7)))return {error:'Insufficient measured exposure.'};
  const db=await pool.connect();try{
    await db.query('begin');
    const o=(await db.query("select id from ad_orders where id=$1 and slot=$2 and status='approved' and starts<=$3 and ends>$3 for share",[id,b.placement,Date.now()])).rows[0];
    if(!o){await db.query('rollback');return {error:'Campaign is not active.'};}
    const inserted=await db.query('insert into ad_exposures(campaign,viewer,bucket,kind) values($1,$2,$3,$4) on conflict do nothing returning campaign',[id,acct,Math.floor(Date.now()/900000),kind]);
    if(inserted.rowCount)await db.query(`insert into ad_metrics_daily(campaign,day,impressions,clicks) values($1,current_date,$2,$3)
      on conflict(campaign,day) do update set impressions=ad_metrics_daily.impressions+excluded.impressions,clicks=ad_metrics_daily.clicks+excluded.clicks`,[id,kind==='impression'?1:0,kind==='click'?1:0]);
    await db.query('commit');return {ok:true,counted:!!inserted.rowCount};
  }catch(e){await db.query('rollback');throw e;}finally{db.release();}
}
