// Stage 3 vehicle resale on actual PostgreSQL transactions in a fresh schema of a
// disposable loopback *_security database. Never reads the regular awd database.
//   DATABASE_URL=postgres://awd@127.0.0.1:55432/awd_security NODE_ENV=test BIRTH_SEED=... node loadtest/vehicle-db.test.js
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';

assert.notEqual(process.env.NODE_ENV, 'production', 'Production fixture mutation is forbidden.');
const url = new URL(process.env.DATABASE_URL || 'postgres://invalid/invalid');
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && /^\/[a-z0-9_]+_security$/.test(url.pathname),
  'Use an explicitly configured disposable loopback *_security database.');
const schema = 'vehicle_qa_' + crypto.randomBytes(8).toString('hex');
const admin = new pg.Pool({connectionString: url.href, max: 1, connectionTimeoutMillis: 30000});
await admin.query(`create schema ${schema}`); // Generated lowercase hex identifier, never user input.
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = url.href;
const {pool, migrate, savePlayers, loadPlayer} = await import('../src/db.js');
const Game = await import('../src/game/rules.js');
const Social = await import('../src/social.js');
const Life = await import('../src/life-service.js');
const {priceRange} = await import('../src/life-vehicles.js');

const checks = [], players = new Map();
const shard = {players, byAcct: id => players.get(id), send() {}, deliverCredit() {}, deliverDm() {}, toRoom() {}, after() {}, fault() {}};
const wallet = p => p.state.cash + p.state.momo;
async function player(suffix, car = null) {
  const name = 'vq' + crypto.randomBytes(4).toString('hex') + suffix;
  const id = (await pool.query("insert into accounts(username,pass,created_at) values($1,$2,now()-interval '2 days') returning id",
    [name, 'disposable-unusable-password'])).rows[0].id;
  const state = Game.newState({id, u: name});
  const origin = Game.DATA.ORIGINS[state.birthOrigin];
  Object.assign(state, {onboarded: true, origin: state.birthOrigin, home: origin.homes[0], car,
    cash: 2000000, momo: 2000000, place: 'circle', rentPaidUntil: Date.now() + 7 * 86400000});
  state.flags.bornAt = Date.now() - 2 * 86400000;
  const p = {acct: id, id, name, state, leaseToken: crypto.randomUUID(), roomSerial: 0, room: null, rx: 0, rz: 0};
  await savePlayers([{id, state, worth: Game.netWorth(state)}]);
  players.set(id, p);
  return p;
}
const action = (p, op, args = {}, key = crypto.randomUUID()) => Life.handle(shard, p, {t: 'life_action', key, op, ...args});
const ok = r => {assert.ok(!r.error, r.error); return r;};
const open = id => pool.query("select * from vehicle_listings where seller=$1 and status='listed'", [id]).then(r => r.rows[0]);

try {
  await migrate();
  await Social.migrateSocial();
  await Life.migrateLife();
  assert.equal((await pool.query('select current_schema() as name')).rows[0].name, schema);
  const seller = await player('s', 'corolla'), b = await player('b'), c = await player('c'), owner = await player('o', 'vitz');
  assert.deepEqual(priceRange('corolla'), {min: 72000, max: 180000});

  ok(await action(seller, 'vehicle_paint', {paint: 'gold'}));
  assert.deepEqual(seller.state.carStyle, {paint: 'gold'});
  assert.ok((await action(seller, 'vehicle_paint', {paint: 'url(javascript:alert(1))'})).error);
  assert.ok((await action(b, 'vehicle_paint', {paint: 'red'})).error, 'no car, no paint');
  checks.push('paint is allowlisted, owner-only and cosmetic');

  for (const price of [71999, 180001, 0, -5, 1.5, '90000', null]) assert.ok((await action(seller, 'vehicle_list', {price})).error, String(price));
  const repBefore = seller.state.rep, listKey = crypto.randomUUID();
  ok(await action(seller, 'vehicle_list', {price: 90000}, listKey));
  assert.equal(seller.state.car, null);
  assert.equal((await action(seller, 'vehicle_list', {price: 90000}, listKey)).replayed, true);
  assert.equal((await pool.query('select count(*) n from vehicle_listings where seller=$1', [seller.acct])).rows[0].n, '1');
  assert.ok((await action(seller, 'vehicle_list', {price: 90000})).error, 'no car left to list twice');
  assert.equal(seller.state.rep, repBefore);
  const row = await open(seller.acct);
  assert.deepEqual(row.style, {paint: 'gold'});
  checks.push('listing enforces the 40–100% price band, moves the car into escrow once and replays its receipt');

  assert.ok((await action(owner, 'vehicle_buy', {id: Number(row.id)})).error, 'a buyer with a car cannot buy another');
  assert.ok((await action(seller, 'vehicle_buy', {id: Number(row.id)})).error, 'seller cannot buy own car');
  for (const forged of [0, -1, '1', 1.5, 999999999]) assert.ok((await action(b, 'vehicle_buy', {id: forged})).error);
  assert.ok((await action(b, 'vehicle_cancel', {id: Number(row.id)})).error, 'only the seller collects');
  checks.push('forged, self, non-seller and second-car purchases are rejected');

  const sellerBefore = wallet(seller), buyersBefore = wallet(b) + wallet(c), repsBefore = [b.state.rep, c.state.rep];
  const keys = [crypto.randomUUID(), crypto.randomUUID()];
  players.delete(seller.acct);   // seller offline: proceeds must stay durable
  const race = await Promise.all([action(b, 'vehicle_buy', {id: Number(row.id)}, keys[0]), action(c, 'vehicle_buy', {id: Number(row.id)}, keys[1])]);
  assert.equal(race.filter(r => !r.error).length, 1);
  const winner = race[0].error ? c : b, loser = winner === b ? c : b, winKey = winner === b ? keys[0] : keys[1];
  assert.equal(winner.state.car, 'corolla');
  assert.deepEqual(winner.state.carStyle, {paint: 'gold'});
  assert.equal(loser.state.car, null);
  assert.equal(wallet(b) + wallet(c), buyersBefore - 90000);
  assert.deepEqual([b.state.rep, c.state.rep], repsBefore, 'resale grants no reputation');
  assert.equal((await action(winner, 'vehicle_buy', {id: Number(row.id)}, winKey)).replayed, true);
  assert.equal(wallet(b) + wallet(c), buyersBefore - 90000);
  const credits = (await pool.query("select * from credits where to_id=$1 and kind='vehicle'", [seller.acct])).rows;
  assert.equal(credits.length, 1); assert.equal(Number(credits[0].amount), 90000); assert.equal(credits[0].claimed, false);
  assert.equal((await pool.query('select status from vehicle_listings where id=$1', [row.id])).rows[0].status, 'sold');
  checks.push('two simultaneous buyers: one car transfer with its paint, one debit, no rep, one durable offline seller credit');

  seller.state = await loadPlayer(seller.acct);
  assert.equal(wallet(seller), sellerBefore);
  assert.equal(seller.state.car, null);
  players.set(seller.acct, seller);
  assert.equal((await Social.claim(seller)).filter(x => x.kind === 'vehicle').length, 1);
  assert.equal(wallet(seller), sellerBefore + 90000);
  assert.deepEqual(await Social.claim(seller), []);
  assert.equal(wallet(seller), sellerBefore + 90000);
  checks.push('seller proceeds survive offline reload and claim exactly once');

  ok(await action(owner, 'vehicle_list', {price: 40000}));
  const vitz = await open(owner.acct);
  assert.ok((await action(loser, 'vehicle_cancel', {id: Number(vitz.id)})).error);
  ok(await action(owner, 'vehicle_cancel', {id: Number(vitz.id)}));
  assert.equal(owner.state.car, 'vitz');
  assert.ok((await action(loser, 'vehicle_buy', {id: Number(vitz.id)})).error, 'returned listing is closed');
  ok(await action(owner, 'vehicle_list', {price: 40000}));
  const expiring = await open(owner.acct);
  await pool.query("update vehicle_listings set expires_at=now()-interval '1 second' where id=$1", [expiring.id]);
  assert.ok((await action(loser, 'vehicle_buy', {id: Number(expiring.id)})).error, 'expired listing cannot be bought');
  ok(await action(owner, 'vehicle_cancel', {id: Number(expiring.id)}));
  assert.equal(owner.state.car, 'vitz');
  checks.push('cancel and expiry return the car to its seller; closed listings cannot be bought');

  const busy = await player('busy', 'prado');
  busy.state.busy = {id: 'nap', start: Date.now(), end: Date.now() + 60000};
  assert.ok((await action(busy, 'vehicle_list', {price: 500000})).error);
  busy.state.busy = null; busy.state.flags.jailUntil = Date.now() + 60000;
  assert.ok((await action(busy, 'vehicle_list', {price: 500000})).error);
  checks.push('busy and custody players cannot trade');

  const stable = (await pool.query('select * from vehicle_listings order by id')).rows;
  await Life.migrateLife();
  assert.deepEqual((await pool.query('select * from vehicle_listings order by id')).rows, stable);
  for (const p of [seller, b, c, owner]) {
    const delta = Number((await pool.query("select coalesce(sum((facts->>'delta')::numeric),0) n from life_events where acct=$1 and kind='money'", [p.acct])).rows[0].n);
    assert.equal(4000000 + delta, wallet(p), p.name);
  }
  checks.push('migration rerun preserves listings; every wallet change reconciles to the journal');
  console.log(JSON.stringify({passed: checks.length, checks, schema, scope: 'Real loopback PostgreSQL, fresh retained disposable schema; funded fixtures, no production data or economy claim.'}, null, 2));
} finally {
  await pool.end();
  await admin.end();
}
