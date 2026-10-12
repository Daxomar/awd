// Paid billboards: real businesses rent in-game billboards at real Accra junctions.
// Flow: advertiser submits artwork + weeks → Paystack checkout (GHS, MoMo or card) → paid → owner approves → live in game.
// Without PAYSTACK_SECRET the flow falls back to manual payment (owner marks paid in /admin).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { pool } from './db.js';
import { secret } from './secrets.js';
import { safeEqual } from './security.js';

const LAT0 = 5.556, LON0 = -0.2, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574;
const proj = (lat, lon) => [Math.round((lon - LON0) * KX), Math.round(-(lat - LAT0) * KZ)];
// ROTATION model (what makes billboards pay): every rotating board carries up to CAP ads, each on screen 15 s in turn,
// priced per ad per week. Exclusive boards (airport) carry one advertiser at a time at a premium.
// yaw = direction the face looks (radians, 0 = +z/south)
export const CAP = +(process.env.AD_CAP || 40), ROTATE_S = 15;
export const SLOTS = [
  { id: 'circle', name: 'Kwame Nkrumah Interchange (Circle)', ll: [5.5712, -0.2142], price: 1200, tier: 'MEGA', yaw: 2.4 },
  { id: 'oxford', name: 'Oxford Street, Osu', ll: [5.5590, -0.1826], price: 1200, tier: 'MEGA', yaw: 1.6 },
  { id: 'airportcity', name: 'Airport City roundabout', ll: [5.6010, -0.1758], price: 1200, tier: 'MEGA', yaw: 3.1 },
  { id: 'accramall', name: 'Tetteh Quarshie / Accra Mall', ll: [5.6215, -0.1740], price: 1000, tier: 'MEGA', yaw: 2.0 },
  { id: 'makola', name: 'Makola Market', ll: [5.5490, -0.2080], price: 800, tier: 'Standard', yaw: 0.8 },
  { id: 'kaneshie', name: 'Kaneshie First Light', ll: [5.5675, -0.2340], price: 800, tier: 'Standard', yaw: 1.2 },
  { id: 'labadi', name: 'Labadi Beach Road', ll: [5.5615, -0.1500], price: 800, tier: 'Standard', yaw: 3.6 },
  { id: 'legon', name: 'East Legon, A&C Mall road', ll: [5.6330, -0.1630], price: 800, tier: 'Standard', yaw: 1.0 },
  { id: 'stadium', name: 'Accra Sports Stadium', ll: [5.5525, -0.1915], price: 800, tier: 'Standard', yaw: 4.4 },
  { id: 'jamestown', name: 'Jamestown Lighthouse', ll: [5.5335, -0.2118], price: 500, tier: 'Community', yaw: 0.2 },
  { id: 'kotoka_arr', name: 'Kotoka Airport · Arrivals', ll: [5.6035, -0.1700], price: 3500, tier: 'Exclusive', exclusive: true, yaw: 3.4 },
  { id: 'kotoka_dep', name: 'Kotoka Airport · Departures', ll: [5.6048, -0.1688], price: 3500, tier: 'Exclusive', exclusive: true, yaw: 3.4 },
].map((s) => { const [x, z] = proj(...s.ll); return { ...s, x, z }; });
const AUTO_APPROVE = process.env.AUTO_APPROVE === '1';
const SLOT = Object.fromEntries(SLOTS.map((s) => [s.id, s]));
const DIR = path.resolve(process.env.ADS_DIR || './uploads/ads'); fs.mkdirSync(DIR, { recursive: true });
const PAYSTACK = secret('PAYSTACK_SECRET');
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:8080';
const ADMIN_KEY = secret('ADMIN_KEY');
const WEEK = 7 * 86400000;

export async function migrateAds() {
  await pool.query(`create table if not exists ad_orders (
    id bigserial primary key, slot text not null, title text not null, url text, contact text not null, email text,
    weeks int not null check (weeks between 1 and 12), amount int not null, status text not null default 'pending_payment',
    ref text unique, starts bigint, ends bigint, note text, created_at timestamptz default now());
  create index if not exists ad_orders_slot on ad_orders (slot, ends);`);
}
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const okUrl = (u) => { if (!u) return ''; try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href.slice(0, 300) : ''; } catch { return ''; } };

// public: slots with what's live now and when each is next free
export async function listSlots() {
  const now = Date.now();
  const r = await pool.query(`select id, slot, title, url, starts, ends from ad_orders where status='approved' and ends > $1 order by starts`, [now]);
  return SLOTS.map((s) => {
    const mine = r.rows.filter((a) => a.slot === s.id); const live = mine.filter((a) => +a.starts <= now && +a.ends > now).map((a) => ({ id: +a.id, title: a.title, url: a.url, img: `/ads/${a.id}.jpg`, ends: +a.ends }));
    const nextFree = s.exclusive ? mine.reduce((t, a) => Math.max(t, +a.ends), now) : live.length >= CAP ? Math.min(...live.map((a) => a.ends)) : now;
    return { id: s.id, name: s.name, x: s.x, z: s.z, yaw: s.yaw, price: s.price, tier: s.tier, exclusive: !!s.exclusive, cap: s.exclusive ? 1 : CAP, onAir: live.length, rotate: ROTATE_S, nextFree, live };
  });
}

// advertiser submits artwork; returns a payment link (Paystack) or manual instructions
export async function createOrder(b) {
  const s = Object.hasOwn(SLOT,b.slot) && SLOT[b.slot]; if (!s) return { error: 'Pick a billboard.' };
  const weeks = Math.max(1, Math.min(12, b.weeks | 0)); const title = clean(b.title, 60); const contact = clean(b.contact, 80); const email = clean(b.email, 120).toLowerCase();
  if (title.length < 2) return { error: 'Add your business name.' }; if (contact.length < 7) return { error: 'Add a phone number we can reach.' };
  if (PAYSTACK && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) return { error: 'A valid email is needed for the payment receipt.' };
  const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(b.image || ''); if (!m) return { error: 'Upload a PNG, JPG or WebP image.' };
  const raw = Buffer.from(m[2], 'base64'); if (raw.length > 4 * 1024 * 1024) return { error: 'Image too large (max 4 MB).' };
  let img; try { img = await sharp(raw, { limitInputPixels: 10e6 }).rotate().resize(1024, 512, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer(); } catch { return { error: 'That image could not be read (maximum 10 megapixels).' }; }
  const amount = s.price * weeks; const ref = 'awd_' + crypto.randomBytes(10).toString('hex');
  const r = await pool.query(`insert into ad_orders (slot, title, url, contact, email, weeks, amount, ref) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`, [s.id, title, okUrl(b.url), contact, email, weeks, amount, ref]);
  const id = +r.rows[0].id; fs.writeFileSync(path.join(DIR, `${id}.jpg`), img);
  if (!PAYSTACK) return { ok: true, id, ref, amount, manual: true, pay: process.env.MANUAL_PAY || 'Payment details will be sent to you by the Accra We Dey team.' };
  const pr = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { authorization: `Bearer ${PAYSTACK}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, amount: amount * 100, currency: 'GHS', reference: ref, callback_url: `${PUBLIC_URL}/advertise.html?ref=${ref}`, channels: ['mobile_money', 'card'], metadata: { ad_id: id, slot: s.id, weeks } }) }).then((x) => x.json()).catch(() => null);
  if (!pr || !pr.status) return { error: 'Payment service unavailable. Try again shortly.' };
  return { ok: true, id, ref, amount, payUrl: pr.data.authorization_url };
}
// put an order on air: rotation boards start now while they have room (else when the earliest ad ends); exclusive boards queue
async function schedule(o) {
  const S = SLOT[o.slot]; const now = Date.now(); let starts = now;
  const live = await pool.query(`select starts, ends from ad_orders where slot=$1 and status='approved' and ends > $2 order by ends`, [o.slot, now]);
  if (S && S.exclusive) starts = live.rows.reduce((t, a) => Math.max(t, +a.ends), now);
  else if (live.rows.length >= CAP) starts = +live.rows[live.rows.length - CAP].ends;
  await pool.query(`update ad_orders set status='approved', starts=$2, ends=$3 where id=$1`, [o.id, starts, starts + o.weeks * WEEK]); return { ok: true, starts };
}
async function markPaid(ref, amountPesewas) {
  const r = await pool.query(`select id, amount, status from ad_orders where ref=$1`, [ref]); const o = r.rows[0]; if (!o) return null;
  if (o.status !== 'pending_payment') return o;
  if (!Number.isSafeInteger(amountPesewas) || amountPesewas !== o.amount * 100) { await pool.query(`update ad_orders set note='payment amount mismatch' where id=$1`, [o.id]); return o; }
  await pool.query(`update ad_orders set status='paid' where id=$1 and status='pending_payment'`, [o.id]);
  if (AUTO_APPROVE) { const full = (await pool.query(`select * from ad_orders where id=$1`, [o.id])).rows[0]; await schedule(full); return { ...o, status: 'approved' }; }
  return { ...o, status: 'paid' };
}
// browser comes back from checkout: verify server-to-server (never trust the redirect alone)
export async function verify(ref) {
  if (!/^awd_[0-9a-f]{20}$/.test(ref || '')) return { error: 'bad ref' };
  if (!PAYSTACK) { const r = await pool.query(`select status from ad_orders where ref=$1`, [ref]); return { status: r.rows[0] ? r.rows[0].status : 'unknown' }; }
  const v = await fetch(`https://api.paystack.co/transaction/verify/${ref}`, { signal: AbortSignal.timeout(10000), headers: { authorization: `Bearer ${PAYSTACK}` } }).then((x) => x.json()).catch(() => null);
  if (v && v.status && v.data && v.data.status === 'success' && v.data.currency === 'GHS' && v.data.reference===ref) { const o = await markPaid(ref, v.data.amount); return { status: o ? o.status : 'unknown' }; }
  return { status: 'pending_payment' };
}
// Paystack webhook: HMAC-SHA512 of the raw body with the secret key
let topupHook = null; export const setTopupHook = (f) => { topupHook = f; };
export async function webhook(rawBody, signature) {
  if (!PAYSTACK) return false;
  const h = crypto.createHmac('sha512', PAYSTACK).update(rawBody).digest('hex');
  if (!safeEqual(h,signature)) return false;
  let ev; try { ev = JSON.parse(rawBody.toString()); } catch { return false; }
  if (ev.event === 'charge.success' && ev.data && ev.data.currency === 'GHS') { if (String(ev.data.reference).startsWith('awt_')) { if (topupHook) await topupHook(ev.data.reference, ev.data.amount); } else await markPaid(ev.data.reference, ev.data.amount); }
  return true;
}
// owner moderation
const adminOk = (k) => !!ADMIN_KEY && safeEqual(k,ADMIN_KEY);
export async function adminList(key) { if (!adminOk(key)) return { error: 'forbidden' }; const r = await pool.query(`select * from ad_orders order by id desc limit 200`); return { rows: r.rows.map((o) => ({ ...o, img: `/ads/${o.id}.jpg` })) }; }
export async function adminAct(key, { id, action }) {
  if (!adminOk(key)) return { error: 'forbidden' };
  const r = await pool.query(`select * from ad_orders where id=$1`, [id | 0]); const o = r.rows[0]; if (!o) return { error: 'not found' };
  if (action === 'markpaid' && o.status === 'pending_payment') await pool.query(`update ad_orders set status='paid' where id=$1`, [o.id]);
  else if (action === 'approve' && (o.status === 'paid')) {
    const r2 = await schedule(o); if (r2.error) return r2;
  } else if (action === 'reject' || action === 'takedown') await pool.query(`update ad_orders set status='rejected', ends=least(coalesce(ends, $2), $2) where id=$1`, [o.id, Date.now()]);
  else return { error: `cannot ${action} an order that is ${o.status}` };
  return { ok: true };
}
export async function adImagePath(id,key='') {
  if(!Number.isSafeInteger(id)||id<1)return null;
  if(!adminOk(key)){
    const row=await pool.query("select 1 from ad_orders where id=$1 and status='approved' and starts<=$2 and ends>$2",[id,Date.now()]);
    if(!row.rowCount)return null;
  }
  const f=path.join(DIR,`${id}.jpg`);return fs.existsSync(f)?f:null;
}
