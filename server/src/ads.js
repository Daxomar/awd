// Paid billboards: real businesses rent in-game billboards at real Accra junctions.
// Flow (Stage 10): standalone /advertise.html → automated checks → Paystack checkout (GHS, MoMo or card) → verified payment →
// automatic activation when every automated check passed; otherwise a disclosed moderator-review state. Admins can suspend.
// Without PAYSTACK_SECRET the flow falls back to manual payment (owner marks paid in /admin).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { pool } from './db.js';
import { secret } from './secrets.js';
import { safeEqual } from './security.js';
import * as Payments from './payments.js';
import {createHash} from 'node:crypto';
import {moderate} from './filter.js';
import {flag} from './admin/flags.js';

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
  create index if not exists ad_orders_slot on ad_orders (slot, ends);
  alter table ad_orders add column if not exists category text;
  alter table ad_orders add column if not exists review text;
  alter table ad_orders add column if not exists image bytea;`);
  await pool.query(`create table if not exists ad_placements(id text primary key,spec jsonb not null,updated_at timestamptz default now());
    create table if not exists ad_reservations(order_id bigint primary key references ad_orders(id),placement text not null references ad_placements(id),
      seat int not null,status text not null,expires bigint not null,created_at timestamptz default now());
    create unique index if not exists ad_exclusive_seat on ad_reservations(placement,seat) where status in ('reserved','payment_pending','active');
    create table if not exists ad_exposures(campaign bigint not null references ad_orders(id),viewer int not null references accounts(id),bucket bigint not null,
      kind text not null check(kind in ('impression','click')),at timestamptz default now(),primary key(campaign,viewer,bucket,kind));
    create table if not exists ad_metrics_daily(campaign bigint not null references ad_orders(id),day date not null,impressions bigint not null default 0,clicks bigint not null default 0,primary key(campaign,day));`);
  await pool.query('alter table ad_placements add column if not exists paused boolean not null default false');
  for(const s of SLOTS)await pool.query('insert into ad_placements(id,spec) values($1,$2) on conflict(id) do update set spec=excluded.spec,updated_at=now()',[s.id,JSON.stringify(s)]);
}
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
// Stage 10 automated checks. They cannot judge every image or claim: anything they cannot clear goes to a disclosed
// moderator review instead of activating, and admins can suspend any campaign after activation.
export const CATEGORIES = { business: 'Business', music: 'Music release', album: 'Album', event: 'Event', fashion: 'Fashion', creator: 'Creator', community: 'Community gathering' };
const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'cutt.ly', 'rebrand.ly', 'shorturl.at', 'tiny.cc', 'rb.gy', 's.id']);
export const LINK_ALLOWLIST = ['accrawedey.world', 'www.accrawedey.world', 'open.spotify.com', 'music.apple.com', 'audiomack.com', 'boomplay.com', 'youtube.com', 'music.youtube.com', 'youtu.be', 'soundcloud.com', 'deezer.com', 'tidal.com',
  'instagram.com', 'tiktok.com', 'facebook.com', 'x.com', 'twitter.com', 'wa.me', 'whatsapp.com', 'linktr.ee', 'eventbrite.com', 'google.com', 'maps.google.com', 'jumia.com.gh', 'tonaton.com', 'meqasa.com'];
const SENSITIVE = /\b(bet|betting|casino|gambl\w*|lotto|forex|crypto|bitcoin|investment returns?|double your money|loan app|weed|marijuana|vape|adult|xxx|sexy|escort|gun|weapon|pharma|slimming|herbal cure)\b/i;
export function vetLink(u) {
  if (!u) return { url: '' };
  let x; try { x = new URL(String(u).trim()); } catch { return { error: 'Enter a full link starting with https://' }; }
  if (x.protocol !== 'https:') return { error: 'Destination links must use https://' };
  if (x.username || x.password || x.port) return { error: 'That link is not allowed (no logins or custom ports).' };
  const host = x.hostname.toLowerCase().replace(/^www\./, '');
  if (/^[\d.]+$/.test(host) || host.includes(':') || !host.includes('.')) return { error: 'Use a named website, not a raw address.' };
  if (SHORTENERS.has(host)) return { error: 'Use the full destination link, not a link shortener.' };
  const url = x.href.slice(0, 300), allowed = LINK_ALLOWLIST.some(d => host === d || host.endsWith('.' + d));
  return allowed ? { url } : { url, review: `Destination ${host} is not on the automatic allowlist; a moderator checks it before activation.` };
}
export function vetCampaign({ title, url, category }) {
  if (!Object.hasOwn(CATEGORIES, category || 'business')) return { error: 'Choose a campaign type.' };
  const t = moderate(title, 60); if (t.blocked) return { error: 'Keep the campaign name respectful.' };
  const link = vetLink(url); if (link.error) return link;
  const review = SENSITIVE.test(title) ? 'This campaign mentions a sensitive category; a moderator checks it before activation.' : link.review || null;
  return { url: link.url, review, category: category || 'business' };
}
const activated = new Set();
export const onActivated = (fn) => activated.add(fn);
const announce = (slot) => setTimeout(() => { for (const fn of activated) try { fn(slot); } catch {} }, 1500);

// public: slots with what's live now and when each is next free
export async function listSlots() {
  const now = Date.now();
  await expireReservations();
  const r = await pool.query(`select id, slot, title, url, starts, ends from ad_orders where status='approved' and ends > $1 order by starts`, [now]);
  const held=(await pool.query("select placement,count(*)::int n,min(expires) as expires from ad_reservations where status in ('reserved','payment_pending','active') group by placement")).rows;
  const paused=new Set((await pool.query('select id from ad_placements where paused')).rows.map(r=>r.id));
  return SLOTS.map((s) => {
    const mine = r.rows.filter((a) => a.slot === s.id); const live = mine.filter((a) => +a.starts <= now && +a.ends > now).map((a) => ({ id: +a.id, title: a.title, url: a.url, img: `/ads/${a.id}.jpg`, ends: +a.ends }));
    const nextFree = s.exclusive ? mine.reduce((t, a) => Math.max(t, +a.ends), now) : live.length >= CAP ? Math.min(...live.map((a) => a.ends)) : now;
    const reservation=held.find(r=>r.placement===s.id),cap=s.exclusive?1:CAP;
    return { ...s, exclusive: !!s.exclusive, cap, onAir: live.length, rotate: ROTATE_S, nextFree:reservation?.n>=cap?Math.max(nextFree,+reservation.expires):nextFree, availability:paused.has(s.id)?'paused':reservation?.n>=cap||nextFree>now?'reserved':'available',paused:paused.has(s.id),live };
  });
}

// advertiser submits artwork; returns a payment link (Paystack) or manual instructions
export async function createOrder(b, acct) {
  const s = Object.hasOwn(SLOT,b.slot) && SLOT[b.slot]; if (!s) return { error: 'Pick a billboard.' };
  const weeks = Math.max(1, Math.min(12, b.weeks | 0)); const title = clean(b.title, 60); const contact = clean(b.contact, 80); const email = clean(b.email, 120).toLowerCase();
  if (title.length < 2) return { error: 'Add your business name.' }; if (contact.length < 7) return { error: 'Add a phone number we can reach.' };
  const vet = vetCampaign({ title, url: b.url, category: b.category }); if (vet.error) return { error: vet.error };
  const unpaid = +(await pool.query("select count(*) n from payment_orders where acct=$1 and type='ad' and status='pending' and purchase_key<>$2 and created_at>now()-interval '1 day'", [acct, String(b.orderKey || '')])).rows[0].n;
  if (unpaid >= 3) return { error: 'You have three unpaid bookings. Pay or cancel one in Your campaigns first.' };
  if (PAYSTACK && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) return { error: 'A valid email is needed for the payment receipt.' };
  const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(b.image || ''); if (!m) return { error: 'Upload a PNG, JPG or WebP image.' };
  const raw = Buffer.from(m[2], 'base64'); if (raw.length > 4 * 1024 * 1024) return { error: 'Image too large (max 4 MB).' };
  // Safe decode and re-encode: supports any dimension (portrait, square, landscape) formatted beautifully to 1024×512.
  let img; try {
    const meta = await sharp(raw, { limitInputPixels: 10e6 }).metadata();
    if (!['png', 'jpeg', 'webp'].includes(meta.format)) return { error: 'Upload a PNG, JPG or WebP image.' };
    if (!meta.width || !meta.height || meta.width < 50 || meta.height < 50) return { error: 'Image is too small.' };
    const ratio = meta.width / meta.height;
    if (ratio >= 1.85 && ratio <= 2.15) {
      img = await sharp(raw, { limitInputPixels: 10e6 }).rotate().resize(1024, 512, { fit: 'cover', position: 'centre' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    } else {
      const bg = await sharp(raw, { limitInputPixels: 10e6 }).rotate().flatten({ background: '#0b1318' }).resize(1024, 512, { fit: 'cover' }).blur(25).modulate({ brightness: 0.45, saturation: 1.15 }).toBuffer();
      const fg = await sharp(raw, { limitInputPixels: 10e6 }).rotate().resize(1024, 512, { fit: 'inside' }).toBuffer();
      img = await sharp(bg).composite([{ input: fg, gravity: 'centre' }]).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    }
  } catch { return { error: 'That image could not be read (maximum 10 megapixels).' }; }
  const amount = s.price * weeks;
  const artwork=createHash('sha256').update(img).update(JSON.stringify({title,url:vet.url,weeks,email,contact,category:vet.category})).digest('hex');
  return Payments.startPayment({acct,type:'ad',key:b.orderKey,amount:amount*100,email,phone:contact,context:{screen:'ads',placement:s.id,weeks,artwork}},async(db,ref)=>{
    const pl=(await db.query('select id,paused from ad_placements where id=$1 for update',[s.id])).rows[0];
    if(pl?.paused)throw Object.assign(new Error('Bookings for this placement are paused. Choose another placement.'),{public:true});
    await expireReservations(db,s.id);
    const reservations=(await db.query("select seat from ad_reservations where placement=$1 and status in ('reserved','payment_pending','active')",[s.id])).rows;
    const legacy=(await db.query("select count(*) n from ad_orders a where slot=$1 and status in ('approved','paid') and (ends is null or ends>$2) and not exists(select 1 from ad_reservations r where r.order_id=a.id)",[s.id,Date.now()])).rows[0];
    const cap=s.exclusive?1:CAP,used=new Set(reservations.map(r=>r.seat));
    if(reservations.length+(+legacy.n)>=cap)throw Object.assign(new Error('This placement is reserved. Choose another or try after it expires.'),{public:true});
    let seat=0;while(used.has(seat))seat++;
    const r=await db.query(`insert into ad_orders(slot,title,url,contact,email,weeks,amount,ref,category,review,image) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,[s.id,title,vet.url,contact,email,weeks,amount,ref,vet.category,vet.review,img]);
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
  // Stage 10: verified payment + every automated check passed → live now (or right after the current exclusive booking).
  if(!o.review&&!flag('ads_auto_activation'))await db.query('update ad_orders set review=$2 where id=$1',[o.id,'Automatic activation is paused by operations; a moderator will review this campaign.']);
  else if(!o.review){const r=await scheduleIn(db,o.id);if(r.ok)announce(o.slot);}
}
// put an order on air: rotation boards start now while they have room (else when the earliest ad ends); exclusive boards queue
async function schedule(o) {
  const db=await pool.connect();
  try{
    await db.query('begin');const r=await scheduleIn(db,o.id);if(!r.ok){await db.query('rollback');return r;}
    await db.query('commit');announce(o.slot);return r;
  }catch(e){await db.query('rollback');throw e;}finally{db.release();}
}
// Runs inside the caller's transaction (payment fulfilment or admin approval).
async function scheduleIn(db,id) {
  {
    let o=(await db.query('select * from ad_orders where id=$1',[id])).rows[0];if(!o)return {error:'Order not found.'};
    await db.query('select id from ad_placements where id=$1 for update',[o.slot]);
    o=(await db.query('select * from ad_orders where id=$1 for update',[o.id])).rows[0];
    if(!['paid','approved'].includes(o.status))return {error:'This order is not awaiting activation.'};
    const reservation=(await db.query('select * from ad_reservations where order_id=$1 for update',[o.id])).rows[0];
    if(reservation&&+reservation.expires<Date.now())await db.query("update ad_reservations set status='reserved',expires=$2 where order_id=$1",[o.id,Date.now()+o.weeks*WEEK]);
    const S=SLOT[o.slot],now=Date.now();let starts=now;
    const live=await db.query("select starts,ends from ad_orders where slot=$1 and status='approved' and ends>$2 order by ends",[o.slot,now]);
    if(S?.exclusive)starts=live.rows.reduce((t,a)=>Math.max(t,+a.ends),now);
    else if(live.rows.length>=CAP)starts=+live.rows[live.rows.length-CAP].ends;
    const ends=starts+o.weeks*WEEK;
    await db.query("update ad_orders set status='approved',starts=$2,ends=$3,review=null where id=$1",[o.id,starts,ends]);
    if(reservation)await db.query("update ad_reservations set status='active',expires=$2 where order_id=$1",[o.id,ends]);
    return {ok:true,starts};
  }
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
export async function adminList(key) { if (!adminOk(key)) return { error: 'forbidden' }; return listOrders(); }
// Stage 11: operations can pause new bookings on a placement; campaigns already booked keep running.
export async function setPlacementPaused(id, paused) {
  const r = await pool.query('update ad_placements set paused=$2, updated_at=now() where id=$1 and paused<>$2 returning id', [id, !!paused]);
  return r.rowCount ? { ok: true } : { error: 'That placement is already in that state or does not exist.', httpStatus: '409 Conflict' };
}
export async function listOrders() { const r = await pool.query(`select * from ad_orders order by id desc limit 200`); return { rows: r.rows.map((o) => ({ ...o, img: `/ads/${o.id}.jpg` })) }; }
export async function adminAct(key, b) {
  if (!adminOk(key)) return { error: 'forbidden' };
  return actOnOrder(b);
}
// Stage 11: the role-checked dashboard never offers 'markpaid' (a status toggle is not provider verification).
export async function actOnOrder({ id, action }, { allowManualPayment = true } = {}) {
  if (action === 'markpaid' && !allowManualPayment) return { error: 'Payments are confirmed only by provider verification.' };
  const r = await pool.query(`select * from ad_orders where id=$1`, [id | 0]); const o = r.rows[0]; if (!o) return { error: 'not found' };
  if (action === 'markpaid' && o.status === 'pending_payment') return Payments.manualAdPayment(o.ref);
  else if (action === 'approve' && ['paid', 'pending_payment'].includes(o.status)) {
    if (o.status === 'pending_payment') await pool.query("update ad_orders set status='paid' where id=$1", [o.id]);
    const r2 = await schedule(o); if (r2.error) return r2;
  } else if (action === 'suspend' && ['approved', 'paid'].includes(o.status)) {
    await pool.query("update ad_orders set status='suspended', note=$2, ends=least(coalesce(ends, $3), $3) where id=$1", [o.id, 'Suspended by moderators', Date.now()]); await pool.query("update ad_reservations set status='cancelled' where order_id=$1", [o.id]); announce(o.slot);
  } else if (action === 'reject' || action === 'takedown') {await pool.query(`update ad_orders set status='rejected', ends=least(coalesce(ends, $2), $2) where id=$1`, [o.id, Date.now()]);await pool.query("update ad_reservations set status='cancelled' where order_id=$1",[o.id]);}
  else return { error: `cannot ${action} an order that is ${o.status}` };
  return { ok: true };
}
export async function adImagePath(id,key='',acct=null,staff=false) {
  if(!Number.isSafeInteger(id)||id<1)return null;
  if(!staff&&!adminOk(key)){
    const row=await pool.query("select 1 from ad_orders a where id=$1 and ((status='approved' and starts<=$2 and ends>$2) or exists(select 1 from payment_orders p where p.type='ad' and p.legacy_id=a.id and p.acct=$3))",[id,Date.now(),acct]);
    if(!row.rowCount)return null;
  }
  const f=path.join(DIR,`${id}.jpg`);
  if(fs.existsSync(f))return f;
  try {
    const row = await pool.query('select image from ad_orders where id=$1 and image is not null', [id]);
    if (row.rows[0]?.image) {
      await fs.promises.writeFile(f, row.rows[0].image);
      return f;
    }
  } catch {}
  return null;
}
export async function expireReservations(db=pool,slot=null){
  await db.query("update ad_reservations set status='expired' where expires<$1 and status in ('reserved','payment_pending','active') and ($2::text is null or placement=$2)",[Date.now(),slot]);
}
export async function campaigns(acct){
  const rows=await pool.query(`select a.id,a.slot,a.title,a.url,a.amount,a.weeks,a.status,a.starts,a.ends,a.note,a.category,a.review,r.status as reservation,r.expires,
    p.status as payment_status,p.review_reason,attempt.checkout_url,attempt.ref,
    coalesce((select sum(impressions) from ad_metrics_daily where campaign=a.id),0) as impressions,
    coalesce((select sum(clicks) from ad_metrics_daily where campaign=a.id),0) as clicks,
    (select count(distinct viewer) from ad_exposures where campaign=a.id and kind='impression' and at>now()-interval '90 days') as unique_viewers
    from ad_orders a join payment_orders p on p.type='ad' and p.legacy_id=a.id
    left join ad_reservations r on r.order_id=a.id left join lateral(select checkout_url,ref from payment_attempts where order_id=p.id order by id desc limit 1) attempt on true
    where p.acct=$1 order by a.id desc limit 100`,[acct]);
  return {rows:rows.rows.map(o=>({...o,id:+o.id,img:`/ads/${o.id}.jpg`,status:o.ends&&+o.ends<Date.now()&&o.status==='approved'?'expired':o.status==='approved'&&+o.starts>Date.now()?'scheduled':o.status==='approved'?'active':o.status==='paid'&&o.review?'in_review':o.status})),estimates:true,uniqueViewerWindowDays:90,categories:CATEGORIES};
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
