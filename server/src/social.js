// Player-to-player layer: MoMo transfers and money requests, direct messages, player search/profiles, Forbes list,
// and top-up credits. Money between players always goes through the `credits` table so it is delivered exactly once,
// even when the receiver is offline or on another shard (claimed with UPDATE … RETURNING).
import crypto from 'node:crypto';
import { withMoney } from './account-money.js';
import { secret } from './secrets.js';
import { pool } from './db.js';
import { moderate, BLOCK_MSG } from './filter.js';
import * as D from './game/data.js';
import * as Game from './game/rules.js';

export async function migrateSocial() {
  await pool.query(`
  create table if not exists phone_games(id bigserial primary key,a int not null references accounts(id),b int not null references accounts(id),an text not null,bn text not null,kind text not null,status text not null default 'pending',state jsonb not null,updated timestamptz default now());
  create index if not exists phone_games_a on phone_games(a,updated desc);
  create index if not exists phone_games_b on phone_games(b,updated desc);
  create table if not exists credits (id bigserial primary key, to_id int not null, from_id int, from_name text, amount bigint not null, fee int default 0,
    note text, kind text not null default 'transfer', at timestamptz default now(), claimed boolean default false);
  create index if not exists credits_unclaimed on credits (to_id) where not claimed;
  create index if not exists credits_from on credits (from_id, at desc);
  create index if not exists credits_to on credits (to_id, at desc);
  create table if not exists dms (id bigserial primary key, from_id int not null, to_id int not null, text text not null, kind text default 'text', amount int, status text,
    at timestamptz default now(), read boolean default false);
  create index if not exists dms_pair on dms (least(from_id, to_id), greatest(from_id, to_id), id desc);
  create index if not exists dms_to on dms (to_id, read);
  create table if not exists dm_links(a int not null,b int not null,initiator int not null,status text not null default 'pending',primary key(a,b));
  insert into dm_links(a,b,initiator,status) select least(from_id,to_id),greatest(from_id,to_id),min(from_id),'accepted' from dms group by least(from_id,to_id),greatest(from_id,to_id) on conflict do nothing;
  create table if not exists topups (id bigserial primary key, acct int not null, pack text not null, ghs int not null, coins int not null, ref text unique, status text default 'pending', at timestamptz default now());
  `);
}

// ---------- fees and limits (MoMo-like) ----------
export const FEE = (a) => Math.max(1, Math.min(15, Math.round(a * 0.0075)));
export const MAX_SEND = 50000;                                      // per transfer
export const dailyCap = (s) => 3000 + 600 * (s.rep || 0);            // outgoing per Accra day
export const MIN_AGE_H = 6;                                          // hours of play before you can send (anti-alt / anti-RMT)
const dayOf = (now) => Math.floor(now / 86400000);

export async function acctByName(name) {
  const n = String(name || '').trim().replace(/^@/, ''); if (!/^[a-zA-Z0-9_]{3,16}$/.test(n)) return null;
  const r = await pool.query('select id, username, banned from accounts where lower(username)=lower($1)', [n]); return r.rows[0] || null;
}
const blocked = (s, acct) => Array.isArray(s.flags.blocked) && s.flags.blocked.includes(acct);

// sender side (synchronous checks + debit) — returns an error string or the debit record
export function checkSend(p, amount, now) {
  const s = p.state; const a = Math.round(+amount || 0);
  if (!s.onboarded) return 'Finish setting up your life first.';
  if (!(a >= 1)) return 'Enter an amount.'; if (a > MAX_SEND) return `Max GH₵${MAX_SEND.toLocaleString()} per transfer.`;
  const ageH = (now - (s.flags.bornAt || s.created)) / 3600000; if (ageH < MIN_AGE_H && !p.dev) return `New MoMo wallets can send after ${MIN_AGE_H} hours in Accra.`;
  if (s.flags.jailUntil > now) return 'You can\'t send money from police cells.';
  const d = dayOf(now); if (!s.xfer || s.xfer.day !== d) s.xfer = { day: d, out: 0, n: 0 };
  if (s.xfer.out + a > dailyCap(s)) return `Daily MoMo limit is GH₵${dailyCap(s).toLocaleString()} (grows with your reputation). Left today: GH₵${Math.max(0, dailyCap(s) - s.xfer.out).toLocaleString()}.`;
  if (s.xfer.n >= 30) return 'Too many transfers today.';
  const fee = FEE(a); if (s.momo < a + fee) return `Not enough in MoMo. You need GH₵${(a + fee).toLocaleString()} (incl. GH₵${fee} fee). Cash in at a MoMo agent.`;
  return { a, fee };
}

// ---------- claims: credit any unclaimed money into a live player ----------
export async function claim(p) {
  if(p.bot||p.claiming||p.owareActive||p.pending||p.gistPending||!p.state.onboarded)return [];p.claiming=true;
  try {
    if(p.moneyTask)await p.moneyTask;
    if(p.gone)return [];
    if(!(await pool.query('select 1 from credits where to_id=$1 and not claimed limit 1',[p.acct])).rowCount)return [];
    if(p.moneyTask)await p.moneyTask;
    if(p.gone||p.pending||p.gistPending||p.owareActive)return [];
    return await withMoney(p,async(db,state)=>{
      const rows=(await db.query('update credits set claimed=true where to_id=$1 and not claimed returning id,from_name,amount,note,kind',[p.acct])).rows;
      const out=[];
      for(const c of rows){
        const amt=+c.amount;state.momo+=amt;
        const why=c.kind==='topup'?'Wallet top-up':c.kind==='refund'?'Transfer reversed':`From @${c.from_name}`;
        state.ledger.push([Date.now(),amt,why+(c.note?` · ${c.note}`:'')]);if(state.ledger.length>60)state.ledger.shift();
        if(c.kind==='transfer'){state.stats.received=(state.stats.received||0)+amt;Game.bump(state,'recv');}
        out.push({t:'money_in',id:+c.id,amount:amt,from:c.from_name,note:c.note,kind:c.kind,momo:state.momo});
      }
      return out;
    })||[];
  }finally{p.claiming=false;}
}

// Debit, outgoing credit and ledger commit together, including request ownership.
export async function send(shard,p,msg){
  if(p.gistPending)return {t:'send_res',ok:false,m:'Wait for your Gist request to finish.'};
  let recipient;
  try {
    const result=await withMoney(p,async(db,s)=>{
      const now=Date.now(),to=await acctByName(msg.to);
      if(!to||to.banned)return {t:'send_res',ok:false,m:'No MoMo wallet with that username.'};
      if(to.id===p.acct)return {t:'send_res',ok:false,m:"You can't send money to yourself."};
      const chk=checkSend({...p,state:s},msg.amount,now);
      if(typeof chk==='string')return {t:'send_res',ok:false,m:chk};
      const note=msg.note?moderate(String(msg.note),60):{text:''};
      if(note.blocked)return {t:'send_res',ok:false,m:BLOCK_MSG[note.blocked]||'Note blocked.'};
      if(msg.req){
        const req=(await db.query("select * from dms where id=$1 and to_id=$2 and from_id=$3 and kind='req' for update",[msg.req|0,p.acct,to.id])).rows[0];
        if(!req||req.status==='paid'||req.amount!==chk.a)return {t:'send_res',ok:false,m:'That money request cannot be paid.'};
        await db.query("update dms set status='paid' where id=$1",[req.id]);
      }
      s.momo-=chk.a+chk.fee;s.xfer.out+=chk.a;s.xfer.n++;
      s.ledger.push([now,-(chk.a+chk.fee),`To @${to.username}`+(note.text?` · ${note.text}`:'')]);if(s.ledger.length>60)s.ledger.shift();
      const id=+(await db.query("insert into credits(to_id,from_id,from_name,amount,fee,note,kind) values($1,$2,$3,$4,$5,$6,'transfer') returning id",[to.id,p.acct,p.name,chk.a,chk.fee,note.text||null])).rows[0].id;
      await db.query("insert into ledger(from_id,to_id,amount,kind) values($1,$2,$3,'p2p')",[p.acct,to.id,chk.a]);
      await db.query("insert into dms(from_id,to_id,text,kind,amount) values($1,$2,$3,'paid',$4)",[p.acct,to.id,note.text||'Sent you money',chk.a]);
      Game.bump(s,'sent');s.stats.sent=(s.stats.sent||0)+chk.a;recipient=to.id;
      return {t:'send_res',ok:true,id,to:to.username,amount:chk.a,fee:chk.fee,momo:s.momo,ref:'AWD'+String(id).padStart(8,'0')};
    });
    if(result?.ok)shard.deliverCredit(recipient);
    return result||{t:'send_res',ok:false,m:'Account disconnected.'};
  }catch(e){console.error('[send]',e.code||'transaction failed');return {t:'send_res',ok:false,m:'MoMo network is busy. Try again.'};}
}

// ---------- direct messages ----------
export async function dm(shard, p, msg) {
  const now = Date.now(); const s = p.state;
  if (s.flags.muteUntil > now) return { t: 'toast', k: 'bad', m: 'You are muted right now.' };
  if (now - (p.dmAt || 0) < 700) return { t: 'toast', k: 'bad', m: 'Slow down small.' }; p.dmAt = now;
  const to = await acctByName(msg.to); if (!to || to.banned) return { t: 'toast', k: 'bad', m: 'User not found.' }; if (to.id === p.acct) return null;
  const live = shard.byAcct(to.id);
  const recipient = live ? live.state : (await pool.query('select state from players where id=$1', [to.id])).rows[0]?.state;
  if (blocked(s, to.id) || recipient && (blocked(recipient, p.acct) || recipient.flags?.dmFriends && !(recipient?.friends?.[p.acct]?.pts >= 30))) return { t: 'toast', k: 'bad', m: 'This person is not receiving your messages.' };
  let kind = 'text', amount = null, text;
  if (msg.req) { kind = 'req'; amount = Math.round(+msg.amount || 0); if (!(amount >= 1 && amount <= MAX_SEND)) return { t: 'toast', k: 'bad', m: 'Enter an amount to request.' }; const n = moderate(String(msg.text || ''), 60); if (n.blocked) return { t: 'toast', k: 'bad', m: BLOCK_MSG[n.blocked] }; text = n.text || 'Please send me money'; }
  else { const m = moderate(String(msg.text || ''), 400); if (m.blocked) { shard.strike(p, m.blocked, msg.text); return { t: 'toast', k: 'bad', m: BLOCK_MSG[m.blocked] || 'Message blocked.' }; } text = m.text; if (!text) return null; }
  const db=await pool.connect();let r,request=false;
  try {
    await db.query('begin');const a=Math.min(p.acct,to.id),b=Math.max(p.acct,to.id);
    await db.query('insert into dm_links(a,b,initiator,status) values($1,$2,$3,$4) on conflict do nothing',[a,b,p.acct,recipient?.friends?.[p.acct]?.pts>=30?'accepted':'pending']);
    const link=(await db.query('select * from dm_links where a=$1 and b=$2 for update',[a,b])).rows[0];
    if(link.status==='declined'){await db.query('rollback');return {t:'toast',k:'bad',m:'This message request was declined.'};}
    if(link.status==='pending') {
      const count=+(await db.query("select count(*) from dms where least(from_id,to_id)=$1 and greatest(from_id,to_id)=$2 and kind<>'paid'",[a,b])).rows[0].count;
      if(link.initiator!==p.acct||count>0){await db.query('rollback');return {t:'toast',k:'bad',m:'Wait for the message request to be accepted.'};}request=true;
    }
    r=await db.query(`insert into dms (from_id, to_id, text, kind, amount) values ($1,$2,$3,$4,$5) returning id, extract(epoch from at)*1000 as at`, [p.acct, to.id, text, kind, amount]);await db.query('commit');
  }catch(e){await db.query('rollback');throw e;}finally{db.release();}
  const row = { id: +r.rows[0].id, from: p.name, to: to.username, text, kind, amount, at: +r.rows[0].at, mine: true, request };
  shard.deliverDm(to.id, { t: 'dm_in', m: { ...row, mine: false }, from: p.name, fromAcct: p.acct });
  Game.bump(s, 'dm'); s.n.social = Math.min(100,s.n.social + 6); p.dirty = true;
  return { t: 'dm_sent', m: row };
}
export async function threads(p) {
  const r = await pool.query(`select distinct on (other) other, d.id, d.text, d.kind, d.amount, d.from_id, extract(epoch from d.at)*1000 as at, a.username, pl.state->'look' as look, link.status as request_status, link.initiator
      from (select *, case when from_id=$1 then to_id else from_id end as other from dms where from_id=$1 or to_id=$1) d join accounts a on a.id=d.other left join players pl on pl.id=d.other left join dm_links link on link.a=least(d.from_id,d.to_id) and link.b=greatest(d.from_id,d.to_id)
      order by other, d.id desc`, [p.acct]);
  const unread = await pool.query(`select from_id, count(*)::int n from dms where to_id=$1 and not read group by from_id`, [p.acct]);
  const U = Object.fromEntries(unread.rows.map((x) => [x.from_id, x.n]));
  const blk = p.state.flags.blocked || [];
  return { t: 'dm_threads', rows: r.rows.filter((x) => !blk.includes(x.other)).sort((a, b) => b.id - a.id).slice(0, 60).map((x) => ({ with: x.username, look:x.look, request:x.request_status==='pending'&&x.initiator!==p.acct, text: x.text, kind: x.kind, amount: x.amount, mine: x.from_id === p.acct, at: +x.at, unread: U[x.other] || 0 })) };
}
export async function thread(p, name) {
  const o = await acctByName(name); if (!o) return { t: 'toast', k: 'bad', m: 'User not found.' };
  const r = await pool.query(`select id, from_id, text, kind, amount, status, extract(epoch from at)*1000 as at from dms where (from_id=$1 and to_id=$2) or (from_id=$2 and to_id=$1) order by id desc limit 60`, [p.acct, o.id]);
  await pool.query(`update dms set read=true where to_id=$1 and from_id=$2 and not read`, [p.acct, o.id]);
  const link=(await pool.query('select * from dm_links where a=$1 and b=$2',[Math.min(p.acct,o.id),Math.max(p.acct,o.id)])).rows[0];
  const look=(await pool.query("select state->'look' as look from players where id=$1",[o.id])).rows[0]?.look;
  return { t: 'dm_thread', with: o.username, look, request: link&&{status:link.status,incoming:link.initiator!==p.acct}, blocked: blocked(p.state, o.id), rows: r.rows.reverse().map((x) => ({ id: +x.id, text: x.text, kind: x.kind, amount: x.amount, status: x.status, mine: x.from_id === p.acct, at: +x.at })) };
}
export async function answerDm(shard,p,m){
 const other=await acctByName(m.name);if(!other)return {t:'toast',k:'bad',m:'Player not found.'};
 const r=await pool.query("update dm_links set status=$4 where a=$1 and b=$2 and initiator=$3 and status='pending' returning *",[Math.min(p.acct,other.id),Math.max(p.acct,other.id),other.id,m.yes?'accepted':'declined']);
 if(!r.rows.length)return {t:'toast',k:'bad',m:'This request is no longer pending.'};
 shard.deliverDm(other.id,{t:'dm_request_answer',from:p.name,fromAcct:p.acct,yes:!!m.yes});return thread(p,other.username);
}
export async function unreadCount(p) { const r = await pool.query(`select count(*)::int n from dms where to_id=$1 and not read`, [p.acct]); return r.rows[0].n; }
export async function block(p, name, on) {
  const o = await acctByName(name); if (!o) return null; const f = p.state.flags; f.blocked = (f.blocked || []).filter((x) => x !== o.id); if (on) f.blocked.push(o.id); p.dirty = true;
  return { t: 'toast', k: 'good', m: on ? `Blocked @${o.username}. They can't message you.` : `Unblocked @${o.username}.` };
}
export const isBlockedBy = (state, acct) => blocked(state, acct);

// ---------- people ----------
const title = (s) => { let t = Game.REP_TITLES[0][1]; for (const [r, n] of Game.REP_TITLES) if ((s.rep || 0) >= r) t = n; return t; };
export function card(s, online) {
  const j = s.job && D.CAREERS[s.job.id];
  return { name: s.name, look: s.look, job: j ? j.ranks[s.job.rank][0] : null, jobIc: j ? j.ic : null, home: s.home && D.HOMES[s.home] ? D.HOMES[s.home].name : 'No fixed address', owns: Object.keys(s.owned || {}).map((k) => D.HOMES[k] && D.HOMES[k].name).filter(Boolean),
    car: s.car && D.CARS[s.car] ? D.CARS[s.car].name : null, rep: s.rep || 0, title: title(s), worth: Game.netWorth(s), dream: s.dream, dreamTier: s.dreamTier || 0, traits: s.traits, since: s.flags.bornAt || s.created,
    biz: Object.keys(s.biz || {}).length, partner: s.flags.partnerName || null, online: !!online, place: online && online.place ? online.place : null };
}
export async function find(shard, q) {
  q = String(q || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16); if (q.length < 2) return { t: 'find', rows: [] };
  const r = await pool.query(`select a.id, a.username, p.worth, p.state->'look' as look, p.state->'job' as job, p.state->>'rep' as rep from accounts a left join players p on p.id=a.id where a.username ilike $1 and not a.banned order by length(a.username), a.username limit 15`, [q + '%']);
  return { t: 'find', rows: r.rows.map((x) => { const j = x.job && D.CAREERS[x.job.id]; return { name: x.username, look: x.look, job: j ? j.ranks[x.job.rank][0] : null, online: !!shard.byAcct(x.id) }; }) };
}
export async function profile(shard, p, name) {
  const a = await acctByName(name); if (!a) return { t: 'toast', k: 'bad', m: 'User not found.' };
  const live = shard.byAcct(a.id); let s = live ? live.state : null;
  if (!s) { const r = await pool.query('select state from players where id=$1', [a.id]); s = r.rows[0] && r.rows[0].state; }
  if (!s || !s.onboarded) return { t: 'profile', p: { name: a.username, fresh: true, online: !!live } };
  const c = card(s, live); c.name = a.username; const f = p.state.friends && p.state.friends[a.id];
  return { t: 'profile', p: { ...c, friend: f ? f.pts : 0, blocked: blocked(p.state, a.id), me: a.id === p.acct } };
}
let forbesCache = { at: 0, rows: [] };
export async function forbes() {
  if (Date.now() - forbesCache.at > 30000) {
    const r = await pool.query(`select a.username, p.worth, p.state->'job' as job, p.state->>'car' as car, p.state->'look' as look from players p join accounts a on a.id=p.id where not a.banned and (p.state->>'onboarded')::boolean order by p.worth desc limit 50`);
    forbesCache = { at: Date.now(), rows: r.rows.map((x, i) => { const j = x.job && D.CAREERS[x.job.id]; return { rank: i + 1, name: x.username, worth: +x.worth, job: j ? j.ranks[x.job.rank][0] : null, car: x.car && D.CARS[x.car] ? D.CARS[x.car].name : null, look: x.look }; }) };
  }
  return { t: 'forbes', rows: forbesCache.rows };
}
export async function history(p) {
  const r = await pool.query(`select c.id, c.amount, c.fee, c.note, c.kind, extract(epoch from c.at)*1000 as at, c.from_id, c.from_name, a.username as to_name from credits c left join accounts a on a.id=c.to_id
      where (c.to_id=$1 or c.from_id=$1) order by c.id desc limit 40`, [p.acct]);
  return { t: 'momo_hist', rows: r.rows.map((x) => ({ id: +x.id, ref: 'AWD' + String(x.id).padStart(8, '0'), out: x.from_id === p.acct, who: x.from_id === p.acct ? x.to_name : x.from_name, amount: +x.amount, fee: x.fee, note: x.note, kind: x.kind, at: +x.at })) };
}

// ---------- top-ups (real money → wallet credit), weekly capped ----------
export const PACKS = [
  { id: 'p10', ghs: 10, coins: 600, label: 'Small chop' },
  { id: 'p25', ghs: 25, coins: 1700, label: 'Trotro fare', tag: '+13%' },
  { id: 'p50', ghs: 50, coins: 3800, label: 'Weekend vibes', tag: '+27%' },
  { id: 'p100', ghs: 100, coins: 8500, label: 'Big man', tag: 'Best value' },
];
export const TOPUP_WEEK_CAP = 200; // GH₵ real money per account per week
const PAYSTACK = secret('PAYSTACK_SECRET'), PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:8080';
export const paymentsLive = !!PAYSTACK;
export async function topupInit(acct, packId, email) {
  const pk = PACKS.find((x) => x.id === packId); if (!pk) return { error: 'Pick a pack.' };
  const wk = await pool.query(`select coalesce(sum(ghs),0)::int s from topups where acct=$1 and status='paid' and at > now() - interval '7 days'`, [acct]);
  if (wk.rows[0].s + pk.ghs > TOPUP_WEEK_CAP) return { error: `Weekly top-up limit is GH₵${TOPUP_WEEK_CAP}. Play smart, come back next week.` };
  if (!PAYSTACK) return { error: 'Top-ups are not live yet on this server.', disabled: true };
  if (typeof email!=='string'||email.length>120||!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return { error: 'Enter your email for the receipt.' };
  const ref = 'awt_' + crypto.randomBytes(10).toString('hex');
  await pool.query(`insert into topups (acct, pack, ghs, coins, ref) values ($1,$2,$3,$4,$5)`, [acct, pk.id, pk.ghs, pk.coins, ref]);
  const pr = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { authorization: `Bearer ${PAYSTACK}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, amount: pk.ghs * 100, currency: 'GHS', reference: ref, callback_url: `${PUBLIC_URL}/?topup=${ref}`, channels: ['mobile_money', 'card'], metadata: { acct, pack: pk.id } }) }).then((x) => x.json()).catch(() => null);
  if (!pr || !pr.status) return { error: 'Payment service unavailable. Try again shortly.' };
  return { ok: true, ref, payUrl: pr.data.authorization_url };
}
// called from verify and from the Paystack webhook; idempotent
export async function topupPaid(ref, pesewas, shard) {
  if(!/^awt_[0-9a-f]{20}$/.test(ref||'')||!Number.isSafeInteger(pesewas)||pesewas<1)return false;
  const db=await pool.connect();let acct;
  try {
    await db.query('begin');
    const row=(await db.query("select * from topups where ref=$1 for update",[ref])).rows[0];
    if(!row||row.status!=='pending'||pesewas!==row.ghs*100){await db.query('rollback');return false;}
    await db.query('select pg_advisory_xact_lock($1)',[row.acct]);
    const spent=+(await db.query("select coalesce(sum(ghs),0) as n from topups where acct=$1 and status='paid' and at>now()-interval '7 days'",[row.acct])).rows[0].n;
    if(spent+row.ghs>TOPUP_WEEK_CAP){await db.query("update topups set status='refund_required' where ref=$1",[ref]);await db.query('commit');return false;}
    await db.query("update topups set status='paid' where ref=$1",[ref]);
    await db.query("insert into credits(to_id,from_name,amount,kind) values($1,'Accra We Dey',$2,'topup')",[row.acct,row.coins]);
    await db.query('commit');acct=row.acct;
  }catch(e){await db.query('rollback');throw e;}finally{db.release();}
  shard&&shard.deliverCredit(acct);return true;
}
export async function topupVerify(ref, shard) {
  if (!/^awt_[0-9a-f]{20}$/.test(ref || '')) return { error: 'bad ref' };
  if (!PAYSTACK) return { status: 'disabled' };
  const v = await fetch(`https://api.paystack.co/transaction/verify/${ref}`, { signal: AbortSignal.timeout(10000), headers: { authorization: `Bearer ${PAYSTACK}` } }).then((x) => x.json()).catch(() => null);
  if (v && v.status && v.data && v.data.status === 'success' && v.data.currency === 'GHS' && v.data.reference===ref) { await topupPaid(ref, v.data.amount, shard); const row=(await pool.query('select status from topups where ref=$1',[ref])).rows[0];return {status:row?.status||'unknown'}; }
  return { status: 'pending' };
}
