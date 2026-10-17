// Stage 7 live events: server-authoritative schedule, RSVP, attendance and results.
// Events use existing venues and activities; attendance is measured from real room presence,
// stored in SQL (so it survives disconnects and restarts) and never inflated.
import crypto from 'node:crypto';
import {pool} from './db.js';
import {moderate} from './filter.js';
import {secret} from './secrets.js';
import {safeEqual} from './security.js';
import * as Game from './game/rules.js';
import {accessOf} from './game/home-access.js';

const MIN = 60000, DAY = 86400000;
const ADMIN_KEY = secret('ADMIN_KEY');
export const adminOk = (k) => !!ADMIN_KEY && typeof k === 'string' && safeEqual(k, ADMIN_KEY);

const KIND_SPECS = {
  oware: {name: 'Oware tournament', venues: ['ug', 'muni', 'n:jtown', 'labadi'], activity: 'Challenge each other to Oware from a player card.'},
  football: {name: 'Football viewing party', venues: ['viewing', 'chopbar', 'stadium'], activity: 'Watch the match together at the venue. (Viewing only, not a playable match.)'},
  beach: {name: 'Beach gathering', venues: ['labadi', 'blackstar'], activity: 'Swim, share palm wine or help a vendor together.'},
  meetup: {name: 'Community meetup', venues: ['ama', 'ug', 'muni', 'n:jtown', 'oxford', 'mall'], activity: 'Meet people and use the venue together.'},
  fashion: {name: 'Fashion showcase', venues: ['kantamanto', 'mall', 'oxford'], activity: 'Show your outfit and shop the stalls.'},
  business: {name: 'Business fair', venues: ['makola', 'hub', 'mall'], activity: 'Meet traders and pitch your business.'},
  music: {name: 'Music promotion', venues: ['radio', 'vibes'], activity: 'Call in, battle or promote music at the venue.'},
  nightlife: {name: 'Nightlife gathering', venues: ['vibes', 'hotel'], activity: 'Party together at the venue.'},
  house: {name: 'House gathering', venues: ['home'], player: true, activity: 'Hang out at the host’s home.'},
};
export const KINDS = Object.fromEntries(Object.entries(KIND_SPECS).map(([id, k]) => [id, {...k, venues: k.venues.filter(v => v === 'home' || Game.LOC[v])}]));
export const LIMITS = {
  player: {leadMin: 5, aheadDays: 7, durMin: 30, durMax: 180, capMin: 2, capMax: 30, upcoming: 1, perWeek: 3, accountAgeMs: DAY},
  admin: {leadMin: -1, aheadDays: 30, durMin: 15, durMax: 360, capMin: 2, capMax: 200},
  reportsToSuspend: 3, rewardXpMax: 25,
};

export async function migrateEvents() {
  await pool.query(`create table if not exists game_events(
      id uuid primary key, kind text not null, title text not null, description text not null default '',
      host_acct int references accounts(id), host_name text not null, venue text not null,
      starts_at timestamptz not null, ends_at timestamptz not null, capacity int not null check(capacity between 1 and 200),
      visibility text not null default 'public' check(visibility in ('public','friends','invite')),
      eligibility jsonb not null default '{}', activity text, reward_xp int not null default 0 check(reward_xp between 0 and 50),
      status text not null default 'scheduled' check(status in ('scheduled','live','ended','cancelled','suspended')),
      cancel_reason text, invited int[] not null default '{}', results jsonb, reports int not null default 0,
      created_by text not null, created_at timestamptz not null default now(), check(ends_at>starts_at));
    create index if not exists game_events_status_time on game_events(status,starts_at);
    create index if not exists game_events_host on game_events(host_acct,created_at);
    create table if not exists event_attendance(event uuid not null references game_events(id), acct int not null references accounts(id),
      rsvp_at timestamptz, first_seen timestamptz, last_seen timestamptz, seconds int not null default 0, primary key(event,acct));
    create table if not exists event_reports(event uuid not null references game_events(id), acct int not null references accounts(id),
      reason text, at timestamptz not null default now(), primary key(event,acct));`);
}

const venueName = (e) => e.venue.startsWith('home:') ? `@${e.host_name}’s home` : Game.LOC[e.venue]?.name || e.venue;
const newcomer = (s, now) => { const born = s?.flags?.bornAt || s?.created; return Number.isFinite(born) && now - born <= 7 * DAY; };
export function visibleTo(e, p) {
  if (e.host_acct === p.acct) return true;
  if (e.status === 'suspended') return false;
  if (e.visibility === 'friends') return !!p.state.friends?.[e.host_acct]?.accepted;
  if (e.visibility === 'invite') return (e.invited || []).includes(p.acct);
  return true;
}
export function eligibility(e, p, now = Date.now()) {
  const el = e.eligibility || {};
  if (!p.state?.onboarded) return 'Finish arriving in Accra first.';
  if (el.newcomers && !newcomer(p.state, now)) return 'This event is for players in their first week.';
  if (el.minRep && (p.state.rep || 0) < el.minRep) return `Needs reputation ${el.minRep}.`;
  if ((p.state.flags?.blocked || []).includes(e.host_acct)) return 'You have blocked the host.';
  return null;
}
function present(shard, e) {
  const out = [], host = e.venue.startsWith('home:') ? +e.venue.slice(5) : null;
  for (const o of shard.players.values()) {
    if (o.bot || o.gone || !o.state?.onboarded) continue;
    const pl = o.state.place;
    if (host ? (o.acct === host && pl === 'home') || pl === 'visit:' + host : pl === e.venue) out.push(o);
  }
  return out;
}

// ---------- creation ----------
export function cleanSpec(spec = {}, {admin = false, host = null, now = Date.now()} = {}) {
  const L = admin ? LIMITS.admin : LIMITS.player, kind = KINDS[spec.kind];
  if (!kind || (kind.player && admin)) return {error: 'Choose an event type.'};
  const title = moderate(String(spec.title || ''), 60), description = moderate(String(spec.description || ''), 300);
  if (title.blocked || description.blocked) return {error: 'Keep the title and description respectful.', blocked: title.blocked || description.blocked};
  if (title.text.trim().length < 4) return {error: 'Give the event a title of at least 4 characters.'};
  let venue = String(spec.venue || '');
  if (kind.player) { if (!host?.state?.home) return {error: 'You need a home to host a house gathering.'}; venue = 'home:' + host.acct; }
  else if (!kind.venues.includes(venue)) return {error: `${kind.name} can use: ${kind.venues.map(v => Game.LOC[v].name).join(', ')}.`};
  const start = Number(spec.startsAt), minutes = Math.round(Number(spec.minutes));
  if (!Number.isFinite(start) || start < now + L.leadMin * MIN || start > now + L.aheadDays * DAY) return {error: `Start between ${Math.max(0, L.leadMin)} minutes and ${L.aheadDays} days from now.`};
  if (!Number.isInteger(minutes) || minutes < L.durMin || minutes > L.durMax) return {error: `Duration must be ${L.durMin}–${L.durMax} minutes.`};
  const capacity = Math.round(Number(spec.capacity));
  const capMax = kind.player ? Math.min(L.capMax, accessOf(host.state).limit + 1) : L.capMax;
  if (!Number.isInteger(capacity) || capacity < L.capMin || capacity > capMax) return {error: `Capacity must be ${L.capMin}–${capMax}.`};
  if (!kind.player && !Game.isOpen(Game.LOC[venue], start)) return {error: `${Game.LOC[venue].name} is closed at that time.`};
  const visibility = ['public', 'friends', 'invite'].includes(spec.visibility) ? spec.visibility : 'public';
  const eligibility = admin ? {...(spec.eligibility?.newcomers ? {newcomers: true} : {}), ...(Number.isInteger(spec.eligibility?.minRep) && spec.eligibility.minRep > 0 ? {minRep: Math.min(1000, spec.eligibility.minRep)} : {})} : {};
  const rewardXp = admin && Number.isInteger(spec.rewardXp) ? Math.max(0, Math.min(LIMITS.rewardXpMax, spec.rewardXp)) : 0;
  return {kind: spec.kind, title: title.text.trim(), description: description.text.trim(), venue, startsAt: start, endsAt: start + minutes * MIN, capacity, visibility, eligibility, rewardXp, activity: kind.activity};
}
async function insert(db, c, host, createdBy, invited = []) {
  const id = crypto.randomUUID();
  await db.query(`insert into game_events(id,kind,title,description,host_acct,host_name,venue,starts_at,ends_at,capacity,visibility,eligibility,activity,reward_xp,invited,created_by)
    values($1,$2,$3,$4,$5,$6,$7,to_timestamp($8/1000.0),to_timestamp($9/1000.0),$10,$11,$12,$13,$14,$15,$16)`,
  [id, c.kind, c.title, c.description, host?.acct || null, host?.name || 'Accra We Dey', c.venue, c.startsAt, c.endsAt, c.capacity, c.visibility, JSON.stringify(c.eligibility), c.activity, c.rewardXp, invited, createdBy]);
  return id;
}
export async function host(shard, p, msg, now = Date.now()) {
  if (p.state.flags?.muteUntil > now || p.state.flags?.jailUntil > now) return {t: 'event_result', error: 'You cannot host events right now.'};
  const c = cleanSpec(msg.spec, {host: p, now});
  if (c.error) { if (c.blocked) shard.strike?.(p, c.blocked, msg.spec?.title); return {t: 'event_result', error: c.error}; }
  const names = Array.isArray(msg.spec?.invite) ? msg.spec.invite.slice(0, 20).map(n => String(n).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16)).filter(Boolean) : [];
  const db = await pool.connect();
  try {
    await db.query('begin'); await db.query('select pg_advisory_xact_lock(7403,$1)', [p.acct]);
    const age = (await db.query('select created_at from accounts where id=$1', [p.acct])).rows[0];
    if (!age || now - new Date(age.created_at).getTime() < LIMITS.player.accountAgeMs) { await db.query('rollback'); return {t: 'event_result', error: 'Accounts can host events after their first day.'}; }
    const counts = (await db.query(`select count(*) filter (where status in ('scheduled','live')) as upcoming, count(*) filter (where created_at>now()-interval '7 days') as week from game_events where host_acct=$1`, [p.acct])).rows[0];
    if (+counts.upcoming >= LIMITS.player.upcoming) { await db.query('rollback'); return {t: 'event_result', error: 'You already have an upcoming event. Finish or cancel it first.'}; }
    if (+counts.week >= LIMITS.player.perWeek) { await db.query('rollback'); return {t: 'event_result', error: 'You can host up to 3 events a week.'}; }
    const invited = names.length ? (await db.query('select id from accounts where username=any($1::text[]) and not banned and id<>$2', [names, p.acct])).rows.map(r => r.id) : [];
    const id = await insert(db, c, p, 'player:' + p.acct, invited);
    await db.query('insert into event_attendance(event,acct,rsvp_at) values($1,$2,now())', [id, p.acct]);
    await db.query('commit');
    for (const acct of invited) { const o = shard.byAcct(acct); if (o) shard.send(o, {t: 'event_invite', id, title: c.title, from: p.name}); }
    return {t: 'event_result', ok: true, id, list: await list(shard, p)};
  } catch (e) { await db.query('rollback').catch(() => {}); throw e; } finally { db.release(); }
}

// ---------- discovery, RSVP, cancellation, reports ----------
function view(shard, e, p, now) {
  const why = eligibility(e, p, now), live = e.status === 'live';
  return {id: e.id, kind: e.kind, kindName: KINDS[e.kind]?.name || e.kind, title: e.title, description: e.description, host: e.host_name, official: !e.host_acct,
    isHost: e.host_acct === p.acct, venue: e.venue, venueName: venueName(e), home: e.venue.startsWith('home:') ? e.host_name : null,
    startsAt: new Date(e.starts_at).getTime(), endsAt: new Date(e.ends_at).getTime(), capacity: e.capacity, visibility: e.visibility, status: e.status,
    activity: e.activity, going: +e.going, attended: +e.attended, here: live ? present(shard, e).length : 0, mine: !!e.mine, mySeconds: e.my_seconds || 0,
    eligible: !why, why, results: e.results, cancelReason: e.cancel_reason, rewardXp: e.reward_xp};
}
export async function list(shard, p, now = Date.now()) {
  const rows = (await pool.query(`select e.*, (select count(*) from event_attendance a where a.event=e.id and a.rsvp_at is not null) as going,
      (select count(*) from event_attendance a where a.event=e.id and a.first_seen is not null) as attended, m.rsvp_at as mine, m.seconds as my_seconds
    from game_events e left join event_attendance m on m.event=e.id and m.acct=$1
    where e.status in ('scheduled','live') or (e.status in ('ended','cancelled') and e.ends_at>now()-interval '2 days') or (e.host_acct=$1 and e.status='suspended')
    order by case e.status when 'live' then 0 when 'scheduled' then 1 else 2 end, e.starts_at limit 80`, [p.acct])).rows;
  return {t: 'events', rows: rows.filter(e => visibleTo(e, p)).map(e => view(shard, e, p, now)), kinds: Object.fromEntries(Object.entries(KINDS).map(([id, k]) => [id, {name: k.name, venues: k.venues, player: !!k.player, activity: k.activity}])), limits: LIMITS.player};
}
export async function rsvp(shard, p, msg, now = Date.now()) {
  if (!/^[0-9a-f-]{36}$/.test(msg.id || '') || typeof msg.on !== 'boolean') return {t: 'event_result', error: 'Choose an event.'};
  const db = await pool.connect();
  try {
    await db.query('begin');
    const e = (await db.query('select * from game_events where id=$1 for update', [msg.id])).rows[0];
    if (!e || !visibleTo(e, p) || !['scheduled', 'live'].includes(e.status)) { await db.query('rollback'); return {t: 'event_result', error: 'This event is not open for RSVP.'}; }
    if (msg.on) {
      const why = eligibility(e, p, now); if (why) { await db.query('rollback'); return {t: 'event_result', error: why}; }
      const going = +(await db.query('select count(*) n from event_attendance where event=$1 and rsvp_at is not null and acct<>$2', [e.id, p.acct])).rows[0].n;
      if (going >= e.capacity) { await db.query('rollback'); return {t: 'event_result', error: 'This event is full.'}; }
      await db.query('insert into event_attendance(event,acct,rsvp_at) values($1,$2,now()) on conflict(event,acct) do update set rsvp_at=coalesce(event_attendance.rsvp_at,now())', [e.id, p.acct]);
    } else {
      if (e.host_acct === p.acct) { await db.query('rollback'); return {t: 'event_result', error: 'Hosts cancel their event instead.'}; }
      await db.query('update event_attendance set rsvp_at=null where event=$1 and acct=$2', [e.id, p.acct]);
    }
    await db.query('commit');
  } catch (e) { await db.query('rollback').catch(() => {}); throw e; } finally { db.release(); }
  return {t: 'event_result', ok: true, list: await list(shard, p)};
}
async function cancelRow(shard, id, reason, byAcct = null) {
  const e = (await pool.query(`update game_events set status='cancelled',cancel_reason=$2 where id=$1 and status in ('scheduled','live','suspended') ${byAcct ? 'and host_acct=$3' : ''} returning *`, byAcct ? [id, reason, byAcct] : [id, reason])).rows[0];
  if (e) await notify(shard, e, {t: 'event_cancelled', id, title: e.title, reason});
  return e;
}
export async function cancel(shard, p, msg) {
  if (!/^[0-9a-f-]{36}$/.test(msg.id || '')) return {t: 'event_result', error: 'Choose an event.'};
  const reason = moderate(String(msg.reason || 'Cancelled by the host'), 120).text || 'Cancelled by the host';
  const e = await cancelRow(shard, msg.id, reason, p.acct);
  return e ? {t: 'event_result', ok: true, list: await list(shard, p)} : {t: 'event_result', error: 'Only the host can cancel this event.'};
}
export async function report(shard, p, msg) {
  if (!/^[0-9a-f-]{36}$/.test(msg.id || '')) return {t: 'event_result', error: 'Choose an event.'};
  const reason = moderate(String(msg.reason || ''), 200).text || 'Reported from Events';
  const e = (await pool.query('select * from game_events where id=$1', [msg.id])).rows[0];
  if (!e || !visibleTo(e, p) || e.host_acct === p.acct) return {t: 'event_result', error: 'You cannot report this event.'};
  const first = await pool.query('insert into event_reports(event,acct,reason) values($1,$2,$3) on conflict do nothing returning event', [e.id, p.acct, reason]);
  if (first.rowCount) {
    shard.report?.(p.acct, 'event:' + e.id, reason);
    // Enough independent reports pause a player-hosted event until a moderator reviews it.
    await pool.query(`update game_events set reports=reports+1, status=case when host_acct is not null and reports+1>=$2 and status in ('scheduled','live') then 'suspended' else status end where id=$1`, [e.id, LIMITS.reportsToSuspend]);
  }
  return {t: 'event_result', ok: true, reported: true, list: await list(shard, p)};
}
async function notify(shard, e, msg) {
  const rows = (await pool.query('select acct from event_attendance where event=$1 and rsvp_at is not null', [e.id])).rows;
  for (const r of rows) { const o = shard.byAcct(r.acct); if (o) shard.send(o, msg); }
}

// ---------- house gathering passes (read by the shard's visit rules) ----------
const liveHomes = new Map();   // host acct -> live house event row
export function homePass(hostAcct, visitor) {
  const e = liveHomes.get(hostAcct);
  return !!(e && Date.now() < new Date(e.ends_at).getTime() && visibleTo(e, visitor) && !eligibility(e, visitor));
}

// ---------- schedule and attendance tick ----------
let lastTick = 0;
export async function tick(shard, now = Date.now()) {
  const elapsed = lastTick ? Math.min(60, Math.max(0, Math.round((now - lastTick) / 1000))) : 0; lastTick = now;
  const started = (await pool.query("update game_events set status='live' where status='scheduled' and starts_at<=now() and ends_at>now() returning *")).rows;
  for (const e of started) await notify(shard, e, {t: 'event_live', id: e.id, title: e.title, venue: e.venue, venueName: venueName(e), home: e.venue.startsWith('home:') ? e.host_name : null});
  const ended = (await pool.query("update game_events set status='ended' where status in ('scheduled','live') and ends_at<=now() returning id")).rows;
  for (const e of ended) await finish(e.id);
  const live = (await pool.query("select * from game_events where status='live'")).rows;
  liveHomes.clear();
  for (const e of live) {
    if (e.venue.startsWith('home:')) liveHomes.set(+e.venue.slice(5), e);
    if (!elapsed) continue;
    const people = present(shard, e).filter(o => visibleTo(e, o) && !eligibility(e, o, now));
    if (!people.length) continue;
    const known = new Set((await pool.query('select acct from event_attendance where event=$1 and first_seen is not null', [e.id])).rows.map(r => r.acct));
    let room = e.capacity - known.size; const ids = [];
    for (const o of people) if (known.has(o.acct)) ids.push(o.acct); else if (room > 0) { room--; ids.push(o.acct); }
    if (ids.length) await pool.query(`insert into event_attendance(event,acct,first_seen,last_seen,seconds) select $1,x,now(),now(),$3 from unnest($2::int[]) as x
      on conflict(event,acct) do update set first_seen=coalesce(event_attendance.first_seen,now()),last_seen=now(),seconds=event_attendance.seconds+$3`, [e.id, ids, elapsed]);
  }
}
export async function finish(id) {
  const e = (await pool.query('select reward_xp from game_events where id=$1', [id])).rows[0];
  const rows = (await pool.query('select u.username as name,a.seconds from event_attendance a join accounts u on u.id=a.acct where a.event=$1 and a.seconds>=60 order by a.seconds desc', [id])).rows;
  const results = {attendees: rows.length, minutes: Math.round(rows.reduce((n, r) => n + r.seconds, 0) / 60), top: rows.slice(0, 5).map(r => ({name: r.name, minutes: Math.round(r.seconds / 60)})),
    rewardXp: e?.reward_xp || 0, rewardEligible: rows.filter(r => r.seconds >= 600).length, rewardStatus: e?.reward_xp ? 'pending approval' : 'none'};
  await pool.query('update game_events set results=$2 where id=$1 and results is null', [id, JSON.stringify(results)]);
  return results;
}

// ---------- administrator API ----------
export async function adminList(key) {
  if (!adminOk(key)) return {error: 'forbidden'};
  const rows = (await pool.query(`select e.*, (select count(*) from event_attendance a where a.event=e.id and a.rsvp_at is not null) as going,
      (select count(*) from event_attendance a where a.event=e.id and a.first_seen is not null) as attended,
      (select coalesce(json_agg(json_build_object('reason',r.reason,'at',r.at)),'[]') from event_reports r where r.event=e.id) as report_rows
    from game_events e order by e.starts_at desc limit 200`)).rows;
  return {rows, kinds: KINDS, limits: LIMITS.admin};
}
export async function adminAct(shard, key, body = {}) {
  if (!adminOk(key)) return {error: 'forbidden'};
  if (body.op === 'create') {
    const c = cleanSpec(body.spec, {admin: true}); if (c.error) return {error: c.error};
    const db = await pool.connect();
    try { await db.query('begin'); const id = await insert(db, c, null, 'admin'); await db.query('commit'); return {ok: true, id}; }
    catch (e) { await db.query('rollback').catch(() => {}); throw e; } finally { db.release(); }
  }
  if (!/^[0-9a-f-]{36}$/.test(body.id || '')) return {error: 'Choose an event.'};
  if (body.op === 'cancel') return (await cancelRow(shard, body.id, moderate(String(body.reason || 'Cancelled by moderators'), 120).text || 'Cancelled by moderators')) ? {ok: true} : {error: 'Event cannot be cancelled.'};
  if (body.op === 'restore') {
    const r = await pool.query("update game_events set status=case when ends_at<=now() then 'ended' when starts_at<=now() then 'live' else 'scheduled' end where id=$1 and status='suspended' returning id", [body.id]);
    return r.rowCount ? {ok: true} : {error: 'Only a suspended event can be restored.'};
  }
  return {error: 'Unknown action.'};
}
