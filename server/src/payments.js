// One durable payment path for legacy advertising orders and wallet top-ups.
// Provider bodies are never persisted: keep only non-sensitive reconciliation facts.
import crypto from 'node:crypto';
import { pool } from './db.js';
import { secret } from './secrets.js';
import { safeEqual } from './security.js';
import { CFG } from './config.js';

const PUBLIC = CFG.publicOrigin || 'http://localhost:8080';
// Local QA only: a simulated Paystack (checkout page, signed webhook, verification API) that can never run on a
// public origin. It exercises the same callback, webhook and independent-verification code as the real provider.
export const MOCK = process.env.PAYSTACK_MOCK === '1' && ['localhost', '127.0.0.1'].includes(new URL(PUBLIC).hostname) && !secret('PAYSTACK_SECRET');
const KEY = secret('PAYSTACK_SECRET') || (MOCK ? 'mock-paystack-local-only' : '');
const RETURN_KEY = CFG.secret;
export const live = !!KEY;
const handlers = new Map();
export function registerPayment(type, fulfill) { handlers.set(type, fulfill); }
export const validRef = ref => /^(awd|awt)_[0-9a-f]{20}$/.test(ref || '');
export const validKey = key => typeof key === 'string' && /^[a-zA-Z0-9_-]{12,80}$/.test(key);
export function phoneNumber(value) {
  const n = String(value || '').replace(/[\s()-]/g, '');
  if (!n) return '';
  if (/^0[235][0-9]{8}$/.test(n)) return '+233' + n.slice(1);
  return /^\+233[235][0-9]{8}$/.test(n) ? n : null;
}
export function receiptEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 120 && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email) ? email : null;
}
export function returnToken(ref, expires = Date.now() + 30 * 86400000) {
  if (!RETURN_KEY || !validRef(ref)) throw new Error('Payment return configuration unavailable');
  const data = `${ref}.${expires}`;
  return `${data}.${crypto.createHmac('sha256', RETURN_KEY).update(data).digest('hex')}`;
}
export function readReturn(token, now = Date.now()) {
  const [ref, end, sig, extra] = String(token || '').split('.');
  if (extra || !validRef(ref) || !/^\d{13}$/.test(end || '') || +end < now || +end > now + 31 * 86400000 || !RETURN_KEY) return null;
  const h = crypto.createHmac('sha256', RETURN_KEY).update(`${ref}.${end}`).digest('hex');
  return safeEqual(h, sig || '') ? ref : null;
}
export function providerMatch(order, data) {
  if (!data || data.reference !== order.ref || data.currency !== order.currency || !Number.isSafeInteger(data.amount) || data.amount !== +order.amount) return 'reference, amount or currency mismatch';
  if (data.status !== 'success') return 'not successful';
  if (!providerIdOf(data.id)) return 'provider transaction ID missing or unsafe';
  return null;
}
export function providerIdOf(id){
  if(typeof id==='number'&&(!Number.isSafeInteger(id)||id<1))return null;
  const value=String(id||'');return /^[1-9][0-9]{0,29}$/.test(value)?value:null;
}
export function signatureValid(raw, signature, key = KEY) {
  return !!key && /^[a-f0-9]{128}$/.test(signature || '') && safeEqual(crypto.createHmac('sha512', key).update(raw).digest('hex'), signature);
}
export async function migratePayments() {
  await pool.query(`
    create table if not exists payment_orders (
      id bigserial primary key, acct int references accounts(id), type text not null check(type in ('ad','topup')),
      purchase_key text not null, legacy_id bigint not null, amount bigint not null check(amount>0), currency text not null default 'GHS',
      status text not null default 'pending', context jsonb not null default '{}', fulfilled_at timestamptz, review_reason text,
      created_at timestamptz not null default now(), unique(type,legacy_id), unique(acct,type,purchase_key));
    create table if not exists payment_attempts (
      id bigserial primary key, order_id bigint not null references payment_orders(id), ref text unique not null,
      status text not null default 'created', provider_id text unique, checkout_url text,
      initialized_at timestamptz, verified_at timestamptz, fulfilled_at timestamptz,
      checked_at timestamptz, checks int not null default 0, failure text, created_at timestamptz not null default now());
    create table if not exists payment_events (
      ref text not null, provider_id text not null, event text not null, amount bigint, currency text, status text,
      outcome text not null default 'received', created_at timestamptz not null default now(), primary key(ref,provider_id,event));
    create index if not exists payment_unresolved on payment_attempts(checked_at) where fulfilled_at is null;
    create table if not exists payment_receipt_outbox (
      order_id bigint primary key references payment_orders(id), destination text not null, created_at timestamptz not null default now(), sent_at timestamptz);
    insert into payment_orders(acct,type,purchase_key,legacy_id,amount,status,fulfilled_at,context)
      select null,'ad','legacy_'||id,id,amount*100,case when status in ('paid','approved') then 'fulfilled' else 'pending' end,
      case when status in ('paid','approved') then created_at end,jsonb_build_object('screen','ads','placement',slot,'campaign',id)
      from ad_orders on conflict(type,legacy_id) do nothing;
    insert into payment_orders(acct,type,purchase_key,legacy_id,amount,status,fulfilled_at,context)
      select acct,'topup','legacy_'||id,id,ghs*100,case when status='paid' then 'fulfilled' when status='refund_required' then 'review' else 'pending' end,
      case when status='paid' then at end,jsonb_build_object('screen','momo','pack',pack)
      from topups on conflict(type,legacy_id) do nothing;
    insert into payment_attempts(order_id,ref,status,fulfilled_at)
      select p.id,a.ref,p.status,p.fulfilled_at from payment_orders p join ad_orders a on p.type='ad' and p.legacy_id=a.id where a.ref is not null
      on conflict(ref) do nothing;
    insert into payment_attempts(order_id,ref,status,fulfilled_at)
      select p.id,t.ref,p.status,p.fulfilled_at from payment_orders p join topups t on p.type='topup' and p.legacy_id=t.id where t.ref is not null
      on conflict(ref) do nothing;
  `);
}
const mockTx = new Map();
export function mockCharge(ref, outcome = 'success') {
  const tx = MOCK && mockTx.get(ref); if (!tx) return null;
  tx.status = outcome === 'success' ? 'success' : 'abandoned';
  const raw = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: ref, id: tx.id, amount: tx.amount, currency: 'GHS', status: tx.status } }));
  return { callback: tx.callback, raw, signature: tx.status === 'success' ? crypto.createHmac('sha512', KEY).update(raw).digest('hex') : null };
}
export const mockTransaction = (ref) => (MOCK ? mockTx.get(ref) || null : null);
function mockProvider(url, body) {
  if (url === 'transaction/initialize') { mockTx.set(body.reference, { id: Date.now() * 100 + crypto.randomInt(100), amount: body.amount, email: body.email, status: 'pending', callback: body.callback_url });
    return { status: true, data: { reference: body.reference, authorization_url: `${new URL(PUBLIC).origin}/mock-checkout?ref=${encodeURIComponent(body.reference)}` } }; }
  const m = /^transaction\/verify\/(.+)$/.exec(url), tx = m && mockTx.get(decodeURIComponent(m[1]));
  return tx ? { status: true, data: { reference: decodeURIComponent(m[1]), id: tx.id, amount: tx.amount, currency: 'GHS', status: tx.status } } : { status: false };
}
async function provider(url, body) {
  if (!KEY) return null;
  if (MOCK) return mockProvider(url, body);
  try {
    const r = await fetch(`https://api.paystack.co/${url}`, { method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(10000),
      headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return await r.json();
  } catch { return null; }
}
// Factory executes with the order transaction; repeated keys never make another legacy order.
export async function startPayment({ acct, type, key, amount, context, email, phone }, factory) {
  if (!Number.isSafeInteger(acct) || acct < 1 || !validKey(key) || !Number.isSafeInteger(amount) || amount < 1) return { error: 'Invalid purchase. Reopen the payment screen.' };
  const receipt = receiptEmail(email), number = phoneNumber(phone);
  if (!receipt || number === null) return { error: 'Enter a valid receipt email and Ghana mobile-money number.' };
  const db = await pool.connect(); let row,released=false,committed=false;
  try {
    await db.query('begin'); await db.query('select pg_advisory_xact_lock(7401,$1)', [acct]);
    row = (await db.query(`select o.*,a.ref,a.checkout_url,a.initialized_at,a.status as attempt_status from payment_orders o join payment_attempts a on a.order_id=o.id
      where o.acct=$1 and o.type=$2 and (o.purchase_key=$3 or (o.status='pending' and o.context->>$4=$5)) order by (o.purchase_key=$3) desc,a.id desc limit 1 for update of o,a`, [acct, type, key,type==='ad'?'placement':'pack',context?.[type==='ad'?'placement':'pack']])).rows[0];
    if (row && (+row.amount !== amount || row.context?.placement !== context?.placement || row.context?.pack !== context?.pack)) throw new Error('Purchase changed. Start a new order.');
    if(row?.context?.artwork&&row.context.artwork!==context?.artwork)throw Object.assign(new Error('This booking already contains different artwork or contact details. Cancel the unpaid booking before replacing it.'),{public:true});
    if(row?.type==='ad'){
      const r=(await db.query('select status,expires from ad_reservations where order_id=$1',[row.legacy_id])).rows[0];
      if(r&&['pending','failed'].includes(row.status)&&(+r.expires<Date.now()||!['reserved','payment_pending'].includes(r.status)))throw Object.assign(new Error('Reservation expired. Cancel this unpaid booking in My Ads before starting another.'),{public:true});
    }
    if (!row) {
      const ref = `${type === 'ad' ? 'awd' : 'awt'}_${crypto.randomBytes(10).toString('hex')}`;
      const legacyId = await factory(db, ref);
      row = (await db.query(`insert into payment_orders(acct,type,purchase_key,legacy_id,amount,context) values($1,$2,$3,$4,$5,$6) returning *`, [acct, type, key, legacyId, amount, JSON.stringify({...context,campaign:type==='ad'?legacyId:undefined})])).rows[0];
      await db.query('insert into payment_attempts(order_id,ref) values($1,$2)', [row.id, ref]); row.ref = ref;
    }
    if(row.status==='failed'&&!row.fulfilled_at){
      const failed=(await db.query("select 1 from payment_events where ref=$1 and (event='verified' or event like 'verified_%') and status in ('failed','abandoned') limit 1",[row.ref])).rowCount;
      if(!failed)throw Object.assign(new Error('This payment requires review before another attempt.'),{public:true});
      const ref=`${type==='ad'?'awd':'awt'}_${crypto.randomBytes(10).toString('hex')}`;
      await db.query('insert into payment_attempts(order_id,ref) values($1,$2)',[row.id,ref]);
      await db.query("update payment_orders set status='pending',review_reason=null where id=$1",[row.id]);
      row={...row,ref,status:'pending',checkout_url:null,initialized_at:null};
    }
    // Persist the single initialization claim before calling the external service.
    const claim = KEY && !row.initialized_at && row.status === 'pending';
    if (claim) await db.query("update payment_attempts set initialized_at=now(),status='initializing' where ref=$1", [row.ref]);
    await db.query('commit');
    committed=true;db.release();released=true;
    if (claim) {
      // Server-controlled return: redirect directly back to the game with billboard placement
      const token = returnToken(row.ref), placement = context?.placement ? `&placement=${encodeURIComponent(context.placement)}` : '';
      const back = `${new URL(PUBLIC).origin}/?payment=${encodeURIComponent(token)}${placement}`;
      const response = await provider('transaction/initialize', { email: receipt, amount, currency: 'GHS', reference: row.ref,
        callback_url: back, channels: ['mobile_money', 'card'],
        metadata: { payment_order: row.id, purchase_type: type, cancel_action: back } });
      const url = response?.status && response.data?.reference === row.ref && response.data?.authorization_url;
      let safe = false; try { const u = new URL(url); safe = (u.protocol === 'https:' && u.hostname === 'checkout.paystack.com') || (MOCK && u.origin === new URL(PUBLIC).origin && u.pathname === '/mock-checkout'); } catch {}
      if (safe) {
        await pool.query("update payment_attempts set checkout_url=$2,status='pending',failure=null where ref=$1 and fulfilled_at is null", [row.ref, url]); row.checkout_url = url;
      } else await pool.query("update payment_attempts set status='initialization_unknown',failure='Initialization uncertain; reconcile this reference before retrying' where ref=$1 and fulfilled_at is null", [row.ref]);
    }
    return { ok: true, id: +row.legacy_id, ref: row.ref, amount: amount / 100, status: row.status, payUrl: row.status==='pending'?row.checkout_url:undefined,
      manual: !KEY, ...(!KEY ? { pay: process.env.MANUAL_PAY || 'Await payment instructions from the Accra We Dey team.' } : {}),
      ...(!row.checkout_url && KEY && row.status === 'pending' ? { pending: true, message: 'Checkout is being checked. Keep this reference; do not create another purchase.' } : {}) };
  } catch (e) { if(!committed)await db.query('rollback'); if (e.public || e.message === 'Purchase changed. Start a new order.') return {error:e.message}; throw e; }
  finally { if(!released)db.release(); }
}
export async function finalize(data) {
  if (!validRef(data?.reference)) return { status: 'unknown' };
  const db = await pool.connect();
  try {
    await db.query('begin');
    const row = (await db.query(`select o.*,a.id as attempt_id,a.ref,a.provider_id,a.fulfilled_at as attempt_fulfilled from payment_orders o join payment_attempts a on a.order_id=o.id where a.ref=$1 for update of o,a`, [data.reference])).rows[0];
    if (!row) { await db.query('rollback'); return { status: 'unknown' }; }
    const reason = providerMatch(row, data);
    const providerId = providerIdOf(data.id)||'unknown',facts=[Number.isSafeInteger(data.amount)?data.amount:null,String(data.currency||'').slice(0,8),String(data.status||'').slice(0,40)];
    const event='verified_'+crypto.createHash('sha256').update(JSON.stringify(facts)).digest('hex').slice(0,16);
    await db.query(`insert into payment_events(ref,provider_id,event,amount,currency,status) values($1,$2,$3,$4,$5,$6) on conflict do nothing`, [row.ref, providerId,event,...facts]);
    await db.query('update payment_attempts set checked_at=now(),checks=checks+1,verified_at=now() where id=$1', [row.attempt_id]);
    if (reason) {
      await db.query('update payment_events set outcome=$4 where ref=$1 and provider_id=$2 and event=$3',[row.ref,providerId,event,reason==='not successful'?'not_successful':'mismatch_review']);
      if (reason !== 'not successful' || ['failed','abandoned','reversed'].includes(data.status)) {
        await db.query("update payment_orders set review_reason=$2,status=case when fulfilled_at is null then $3 else status end where id=$1", [row.id, reason, reason==='not successful'?'failed':'review']);
        await db.query('update payment_attempts set failure=$2 where id=$1', [row.attempt_id, reason]);
      }
      const terminal=['failed','abandoned','reversed'].includes(data.status);
      await db.query('commit'); return {status:row.fulfilled_at?(terminal||reason!=='not successful'?'review':'fulfilled'):reason==='not successful'?(terminal?'failed':'pending'):'review'};
    }
    const used = (await db.query('select id from payment_attempts where provider_id=$1 and id<>$2', [providerId, row.attempt_id])).rowCount;
    const otherFulfilled=(await db.query('select id from payment_attempts where order_id=$1 and id<>$2 and fulfilled_at is not null',[row.id,row.attempt_id])).rowCount;
    if (used || otherFulfilled || row.provider_id && row.provider_id !== providerId) {
      await db.query("update payment_orders set review_reason='Additional or reused provider charge: refund/review required' where id=$1", [row.id]);
      await db.query("update payment_events set outcome='refund_review' where ref=$1 and provider_id=$2 and event=$3", [row.ref,providerId,event]);
      if(!used&&!row.provider_id)await db.query("update payment_attempts set provider_id=$2,status='review',failure='Additional charge for fulfilled order' where id=$1",[row.attempt_id,providerId]);
      await db.query('commit'); return {status:'review'};
    }
    if (!row.fulfilled_at) {
      const fulfill = handlers.get(row.type); if (!fulfill) throw new Error('Payment fulfillment unavailable');
      const result = await fulfill(db, row);
      if (result?.review) {
        await db.query("update payment_orders set status='review',review_reason=$2 where id=$1", [row.id,result.review]);
        await db.query("update payment_attempts set provider_id=$2,status='review' where id=$1",[row.attempt_id,providerId]);
        await db.query("update payment_events set outcome='fulfillment_review' where ref=$1 and provider_id=$2 and event=$3",[row.ref,providerId,event]);
        await db.query('commit'); return {status:'review'};
      }
      await db.query("update payment_orders set status='fulfilled',fulfilled_at=now(),review_reason=null where id=$1",[row.id]);
      await db.query("update payment_attempts set provider_id=$2,status='fulfilled',fulfilled_at=now(),failure=null where id=$1",[row.attempt_id,providerId]);
      const adminEmail=receiptEmail(process.env.PAYMENT_ADMIN_EMAIL);
      if(adminEmail)await db.query('insert into payment_receipt_outbox(order_id,destination) values($1,$2) on conflict do nothing',[row.id,adminEmail]);
    } else if (!row.provider_id) await db.query('update payment_attempts set provider_id=$2 where id=$1',[row.attempt_id,providerId]);
    await db.query("update payment_events set outcome='fulfilled' where ref=$1 and provider_id=$2 and event=$3",[row.ref,providerId,event]);
    await db.query('commit'); return { status:'fulfilled' };
  } catch (e) { await db.query('rollback'); throw e; } finally { db.release(); }
}
export async function verifyPayment(ref) {
  if (!validRef(ref)) return { error:'Invalid reference.' };
  const row = (await pool.query('select o.status,o.context,o.acct from payment_orders o join payment_attempts a on a.order_id=o.id where a.ref=$1',[ref])).rows[0];
  if (!row) return {status:'unknown'};
  if (!KEY) return {status:row.status};
  const v = await provider(`transaction/verify/${encodeURIComponent(ref)}`);
  if (v?.status && v.data?.reference===ref) return finalize(v.data);
  await pool.query("update payment_attempts set checked_at=now(),checks=checks+1,failure='Provider verification unavailable' where ref=$1",[ref]);
  return {status:row.status, pending:row.status==='pending'};
}
export async function paymentReturn(token, acct) {
  const ref=readReturn(token); if(!ref)return {error:'Payment return link expired or invalid.'};
  const row=(await pool.query('select o.acct,o.context from payment_orders o join payment_attempts a on a.order_id=o.id where a.ref=$1',[ref])).rows[0];
  if(!row || row.acct!==acct)return {error:'Sign in to the account that made this purchase.'};
  return {...await verifyPayment(ref),ref,context:row.context};
}
// Only the authenticated advertising admin calls this, with provider payments disabled.
export async function manualAdPayment(ref){
  if(KEY)return {error:'Use provider verification while Paystack is enabled.'};
  const db=await pool.connect();try{
    await db.query('begin');
    const o=(await db.query("select o.*,a.ref,a.id as attempt_id from payment_orders o join payment_attempts a on a.order_id=o.id where a.ref=$1 and o.type='ad' for update of o,a",[ref])).rows[0];
    if(!o){await db.query('rollback');return {error:'Payment order not found.'};}
    if(!o.fulfilled_at){
      const result=await handlers.get('ad')?.(db,o);
      if(result?.review){await db.query('rollback');return {error:result.review};}
      if(!handlers.has('ad'))throw Error('Fulfillment unavailable');
      await db.query("update payment_orders set status='fulfilled',fulfilled_at=now() where id=$1",[o.id]);
      await db.query("update payment_attempts set status='manual_fulfilled',fulfilled_at=now() where id=$1",[o.attempt_id]);
      await db.query("insert into payment_events(ref,provider_id,event,amount,currency,status,outcome) values($1,'manual','admin_recorded',$2,'GHS','manual','fulfilled') on conflict do nothing",[ref,o.amount]);
    }
    await db.query('commit');return {ok:true};
  }catch(e){await db.query('rollback');throw e;}finally{db.release();}
}
export async function webhook(raw, signature) {
  if (!signatureValid(raw, signature)) return false;
  let ev; try {ev=JSON.parse(raw.toString());}catch{return false;}
  if(ev.event!=='charge.success'||!validRef(ev.data?.reference))return true;
  const d=ev.data,id=providerIdOf(d.id)||'unknown';
  await pool.query(`insert into payment_events(ref,provider_id,event,amount,currency,status) values($1,$2,'charge.success',$3,$4,$5) on conflict do nothing`,[d.reference,id,Number.isSafeInteger(d.amount)?d.amount:null,String(d.currency||'').slice(0,8),String(d.status||'').slice(0,40)]);
  // A signed notification triggers independent verification; unavailable API yields retry.
  const result=await verifyPayment(ev.data.reference);
  await pool.query("update payment_events set outcome=$3 where ref=$1 and provider_id=$2 and event='charge.success'",[d.reference,id,result.status==='unknown'?'unmatched_review':result.status||'pending']);
  if(result.pending)throw new Error('Verification pending');
  return true;
}
export async function reconcile(limit=20) {
  if(!KEY)return {disabled:true};
  const rows=await pool.query(`select a.ref from payment_attempts a join payment_orders o on o.id=a.order_id
    where a.fulfilled_at is null and a.status<>'review' and (o.status in ('pending','failed') or o.fulfilled_at is not null)
    and (a.checked_at is null or a.checked_at<now()-interval '10 minutes')
    order by a.checked_at nulls first,a.created_at limit $1`,[Math.max(1,Math.min(50,limit))]);
  const out=[];for(const r of rows.rows)out.push({ref:r.ref,...await verifyPayment(r.ref)});return {checked:out};
}
