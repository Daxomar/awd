// Stage 7 events against an isolated local *_security database: admin scheduling, discovery, RSVP capacity,
// real-presence attendance that survives disconnects, results, player hosting limits, reports and cancellation.
import assert from 'node:assert/strict';
assert.notEqual(process.env.NODE_ENV, 'production', 'Do not run fixture mutation against a production environment.');
const url = new URL(process.env.DATABASE_URL || 'postgres://invalid/invalid');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.endsWith('_security'), 'Isolated local *_security database required');
process.env.ADMIN_KEY = 'events-integration-' + Date.now().toString(36);
const {pool, migrate} = await import('../src/db.js'), Game = await import('../src/game/rules.js'), Events = await import('../src/events.js');
const players = new Map(), sent = [], checks = [], tag = Date.now().toString(36), KEY = process.env.ADMIN_KEY;
const shard = {players, byAcct: id => players.get(id), send: (p, m) => sent.push({acct: p.acct, ...m}), report: () => {}, strike: () => {}};
async function player(suffix, place = 'circle', age = '2 days') {
  const acct = +(await pool.query(`insert into accounts(username,pass,created_at) values($1,'unused-mock-account',now()-$2::interval) returning id`, ['ev' + tag + suffix, age])).rows[0].id;
  const state = Game.newState({id: acct, u: 'ev' + tag + suffix}); state.onboarded = true; state.home = 'nima'; state.place = place; state.flags.bornAt = Date.now();
  await pool.query('insert into players(id,state) values($1,$2)', [acct, JSON.stringify(state)]);
  const p = {acct, name: state.name, state, bot: false, gone: false}; players.set(acct, p); return p;
}
const row = async id => (await pool.query('select * from game_events where id=$1', [id])).rows[0];
const seconds = async (id, acct) => (await pool.query('select seconds from event_attendance where event=$1 and acct=$2', [id, acct])).rows[0]?.seconds || 0;
try {
  await migrate(); await Events.migrateEvents(); await Events.migrateEvents();
  const now = Date.now();
  assert.equal((await Events.adminAct(shard, 'wrong', {op: 'create'})).error, 'forbidden'); assert.equal((await Events.adminList('')).error, 'forbidden');
  const spec = {kind: 'meetup', title: 'Jamestown community meetup', description: 'Meet neighbours.', venue: 'n:jtown', startsAt: now - 30000, minutes: 60, capacity: 2};
  const made = await Events.adminAct(shard, KEY, {op: 'create', spec}); assert.ok(made.ok && made.id, made.error); const id = made.id;
  checks.push('administrator schedules an event with an admin key only; migration is idempotent');

  const a = await player('a', 'n:jtown'), b = await player('b', 'n:jtown'), c = await player('c', 'n:jtown');
  let list = await Events.list(shard, a); const ev = list.rows.find(e => e.id === id);
  assert.ok(ev && ev.official && ev.venueName && ev.going === 0); checks.push('players discover the event with real counts');
  assert.ok((await Events.rsvp(shard, a, {id, on: true})).ok); assert.ok((await Events.rsvp(shard, b, {id, on: true})).ok);
  assert.match((await Events.rsvp(shard, c, {id, on: true})).error, /full/); assert.ok((await Events.rsvp(shard, a, {id, on: true})).ok, 'repeat RSVP is idempotent');
  checks.push('RSVP respects capacity and is idempotent');

  await Events.tick(shard, now); assert.equal((await row(id)).status, 'live'); assert.ok(sent.some(m => m.t === 'event_live' && m.acct === a.acct));
  await Events.tick(shard, now + 30000);
  assert.equal(await seconds(id, a.acct), 30); assert.equal(await seconds(id, b.acct), 30); assert.equal(await seconds(id, c.acct), 0, 'capacity also bounds counted attendees');
  players.delete(b.acct); await Events.tick(shard, now + 60000);
  assert.equal(await seconds(id, a.acct), 60); assert.equal(await seconds(id, b.acct), 30, 'a disconnected player is not counted');
  players.set(b.acct, b); await Events.tick(shard, now + 90000); assert.equal(await seconds(id, b.acct), 60, 'reconnecting continues the same attendance record');
  list = await Events.list(shard, b); assert.equal(list.rows.find(e => e.id === id).here, 3, 'presence shows real people at the venue');
  checks.push('attendance is measured from real presence, persisted in SQL and consistent across disconnect/reconnect');

  await pool.query("update game_events set ends_at=now()-interval '1 second' where id=$1", [id]); await Events.tick(shard, now + 120000);
  const ended = await row(id); assert.equal(ended.status, 'ended'); assert.equal(ended.results.attendees, 2); assert.equal(ended.results.rewardStatus, 'none');
  await Events.finish(id); assert.equal((await row(id)).results.attendees, 2, 'results are written once');
  checks.push('ending persists results once');

  const young = await player('y', 'home', '1 hour');
  const houseSpec = {kind: 'house', title: 'Small house gathering', startsAt: now + 10 * 60000, minutes: 60, capacity: 4, visibility: 'public'};
  assert.match((await Events.host(shard, young, {spec: houseSpec})).error, /first day/);
  const h = await player('h', 'home'); const r = await Events.host(shard, h, {spec: houseSpec}); assert.ok(r.ok, r.error);
  assert.match((await Events.host(shard, h, {spec: houseSpec})).error, /upcoming event/);
  checks.push('player hosting needs an established account and one upcoming event at a time');
  const hid = r.id;
  await pool.query("update game_events set starts_at=now()-interval '1 minute' where id=$1", [hid]); await Events.tick(shard, now + 150000);
  assert.equal(Events.homePass(h.acct, a), true, 'a live public house gathering admits eligible visitors');
  a.state.flags.blocked = [h.acct]; assert.equal(Events.homePass(h.acct, a), false); a.state.flags.blocked = [];
  checks.push('a live house gathering grants visit passes to eligible, unblocked players only');

  assert.match((await Events.cancel(shard, a, {id: hid})).error, /Only the host/);
  for (const x of [a, b, c]) await Events.report(shard, x, {id: hid, reason: 'spam'});
  await Events.report(shard, a, {id: hid, reason: 'again'});
  const hr = await row(hid); assert.equal(hr.status, 'suspended'); assert.equal(hr.reports, 3, 'one report per player');
  assert.equal((await Events.list(shard, a)).rows.some(e => e.id === hid), false, 'suspended events are hidden from players');
  assert.ok((await Events.list(shard, h)).rows.some(e => e.id === hid), 'the host still sees their suspended event');
  assert.ok((await Events.adminAct(shard, KEY, {op: 'restore', id: hid})).ok); assert.equal((await row(hid)).status, 'live');
  await Events.rsvp(shard, b, {id: hid, on: true}); sent.length = 0;
  assert.ok((await Events.cancel(shard, h, {id: hid, reason: 'Rain'})).ok); assert.equal((await row(hid)).status, 'cancelled');
  assert.ok(sent.some(m => m.t === 'event_cancelled' && m.acct === b.acct));
  await Events.tick(shard, now + 180000); assert.equal(Events.homePass(h.acct, a), false, 'a cancelled gathering stops admitting visitors');
  checks.push('reports suspend a player event for moderator review; admin restore; host cancellation notifies RSVPs and closes the home');
  console.log(JSON.stringify({passed: checks.length, checks}, null, 2));
} finally { await pool.end(); }
