// Actual PostgreSQL transactions on a fresh schema in a disposable loopback DB.
// This suite never reads the regular awd database or contacts payment providers.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';

assert.notEqual(process.env.NODE_ENV, 'production', 'Production fixture mutation is forbidden.');
const url = new URL(process.env.DATABASE_URL || 'postgres://invalid/invalid');
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && /^\/[a-z0-9_]+_security$/.test(url.pathname),
  'Use an explicitly configured disposable loopback *_security database.');
const schema = 'property_qa_' + crypto.randomBytes(8).toString('hex');
const admin = new pg.Pool({connectionString: url.href, max: 1, connectionTimeoutMillis: 30000});
await admin.query(`create schema ${schema}`); // Generated lowercase hex identifier, never user input.
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = url.href;
const {pool, migrate, savePlayers, loadPlayer} = await import('../src/db.js');
const Game = await import('../src/game/rules.js');
const Social = await import('../src/social.js');
const Life = await import('../src/life-service.js');
const {PropertyService} = await import('../src/property-service.js');

const checks = [], players = new Map(), notices = [];
const shard = {
  players, byAcct: id => players.get(id),
  send() {}, deliverCredit: id => notices.push(id), deliverDm() {},
  toRoom() {}, after() {}, fault() {}
};
const wallet = p => p.state.cash + p.state.momo;
async function player(suffix) {
  const name = 'pq' + crypto.randomBytes(4).toString('hex') + suffix;
  const id = (await pool.query('insert into accounts(username,pass,created_at) values($1,$2,now()-interval \'2 days\') returning id',
    [name, 'disposable-unusable-password'])).rows[0].id;
  const state = Game.newState({id, u: name});
  const origin = Game.DATA.ORIGINS[state.birthOrigin];
  Object.assign(state, {onboarded: true, origin: state.birthOrigin, home: origin.homes[0],
    cash: 5000000, momo: 5000000, place: 'circle', rentPaidUntil: Date.now() + 7 * 86400000});
  state.flags.bornAt = Date.now() - 2 * 86400000;
  const p = {acct: id, id, name, state, leaseToken: crypto.randomUUID(), roomSerial: 0, room: null, rx: 0, rz: 0};
  await savePlayers([{id, state, worth: Game.netWorth(state)}]);
  players.set(id, p);
  return p;
}
const action = (p, op, args = {}, key = crypto.randomUUID()) =>
  Life.handle(shard, p, {t: 'life_action', key, op, ...args});
function successful(result) {assert.ok(!result.error, result.error); return result;}

try {
  await migrate();
  await Social.migrateSocial();
  const properties = new PropertyService(pool, {testMode: true, priceOverrides: {
    'awd-nima-01': 100, 'awd-nima-02': 120, 'awd-jtown-01': 200, 'awd-jtown-02': 220,
    'awd-kaneshie-01': 300, 'awd-kaneshie-02': 320
  }});
  await properties.migrate();
  await Life.migrateLife();
  assert.equal((await pool.query('select current_schema() as name')).rows[0].name, schema);
  const [a, b, c] = await Promise.all(['a', 'b', 'c'].map(player));
  const unit = 'awd-nima-01', spare = 'awd-nima-02', raceUnit = 'awd-jtown-01';
  const getUnit = id => pool.query('select * from world_properties where id=$1', [id]).then(r => r.rows[0]);
  const assets = id => pool.query('select * from property_furnishings where unit=$1 order by id', [id]).then(r => r.rows);
  const listing = id => pool.query("select * from property_listings where unit=$1 and status='listed' order by id desc limit 1", [id]).then(r => r.rows[0]);
  const listed = (id, price, furnished = true) => ({unit: id, price, furnished, durationHours: 24});

  const before = wallet(a), buyKey = crypto.randomUUID();
  const first = successful(await action(a, 'property_buy', {unit}, buyKey));
  assert.equal(wallet(a), before - 100);
  assert.equal((await getUnit(unit)).owner, a.acct);
  assert.equal((await action(a, 'property_buy', {unit}, buyKey)).replayed, true);
  assert.equal(wallet(a), before - 100);
  assert.ok((await action(a, 'property_buy', {unit: spare}, buyKey)).error);
  assert.equal((await getUnit(spare)).owner, null);
  assert.equal((await pool.query("select count(*) n from property_transactions where unit=$1 and kind='catalogue_purchase'", [unit])).rows[0].n, '1');
  checks.push('exact Life.handle receipt replay charges once; changed payload cannot reuse its receipt');

  const raceBalances = [wallet(b), wallet(c)];
  const race = await Promise.all([action(b, 'property_buy', {unit: raceUnit}), action(c, 'property_buy', {unit: raceUnit})]);
  assert.equal(race.filter(r => !r.error).length, 1);
  const raceWinner = race[0].error ? c : b;
  assert.equal((await getUnit(raceUnit)).owner, raceWinner.acct);
  assert.equal(wallet(b) + wallet(c), raceBalances[0] + raceBalances[1] - 200);
  checks.push('simultaneous catalogue buyers acquire one unit with exactly one wallet debit');

  const legacyItems = structuredClone(a.state.items);
  const furnitureBefore = wallet(a);
  successful(await action(a, 'property_furnish', {unit, item: 'gas'}));
  successful(await action(a, 'property_furnish', {unit, item: 'fridge'}));
  let installed = await assets(unit);
  assert.equal(installed.length, 2);
  assert.equal(wallet(a), furnitureBefore - Game.ITEMS.gas[1] - Game.ITEMS.fridge[1]);
  assert.deepEqual(a.state.items, legacyItems);
  const assetIds = installed.map(x => Number(x.id)), gas = installed.find(x => x.item === 'gas');
  assert.ok((await action(a, 'property_furnish', {unit, item: 'gas'})).error);
  successful(await action(a, 'property_store', {unit, asset: Number(gas.id)}));
  successful(await action(a, 'property_install', {unit, asset: Number(gas.id)}));
  assert.ok((await action(a, 'property_install', {unit, asset: Number(gas.id)})).error);
  assert.deepEqual((await assets(unit)).map(x => Number(x.id)), assetIds);
  successful(await action(a, 'property_renovate', {unit, finish: 'coastal'}));
  assert.equal((await getUnit(unit)).finish, 'coastal');
  checks.push('furniture purchase/storage/install retains unique assets and leaves legacy item flags untouched');

  const privateOwner = await properties.resolveAccess(a.acct, unit);
  assert.equal(privateOwner.mine, true);
  assert.equal(await properties.resolveAccess(b.acct, unit), null);
  for (const op of ['furnish', 'store', 'install', 'renovate', 'primary', 'list', 'cancel']) {
    assert.ok((await action(c, 'property_' + op, {...listed(unit, 1000), item: 'tv', asset: Number(gas.id), finish: 'earth', owner: c.acct})).error, op);
  }
  for (const forged of ["awd-nima-01' OR '1'='1", '../awd-nima-01', null, [], 'awd-missing-01']) {
    assert.ok((await action(b, 'property_buy', {unit: forged})).error);
    assert.equal(await properties.resolveAccess(b.acct, forged), null);
  }
  for (const price of [-1, 0, 1.25, '100', true, 1000000001]) {
    assert.ok((await action(a, 'property_list', listed(unit, price))).error);
  }
  checks.push('forged owner/unit/asset requests and invalid prices cannot mutate private property');

  successful(await action(a, 'property_list', listed(unit, 1000)));
  const live = await listing(unit);
  assert.deepEqual(live.included.map(Number).sort((x, y) => x - y), assetIds);
  assert.equal(await properties.resolveAccess(a.acct, unit, Date.now(), {revision: privateOwner.revision}), null);
  const tour = await properties.resolveAccess(b.acct, unit);
  assert.ok(tour && !tour.mine && !tour.canAct && !tour.canFurnish);
  for (const [op, fields] of [
    ['furnish', {item: 'tv'}], ['store', {asset: Number(gas.id)}],
    ['install', {asset: Number(gas.id)}], ['renovate', {finish: 'earth'}], ['primary', {}]
  ]) assert.ok((await action(a, 'property_' + op, {unit, ...fields})).error, op);
  assert.deepEqual((await assets(unit)).map(x => Number(x.id)), assetIds);
  assert.equal((await getUnit(unit)).finish, 'coastal');
  checks.push('active listing freezes primary/furniture/finish mutations and invalidates old access revision');

  const sellerBefore = wallet(a), beforeResale = wallet(b) + wallet(c);
  const keys = [crypto.randomUUID(), crypto.randomUUID()];
  players.delete(a.acct); // Seller truly absent from live shard delivery; credit must stay durable.
  const sales = await Promise.all([action(b, 'property_buy', {unit}, keys[0]), action(c, 'property_buy', {unit}, keys[1])]);
  assert.equal(sales.filter(r => !r.error).length, 1);
  const owner = sales[0].error ? c : b, other = owner === b ? c : b, ownerKey = owner === b ? keys[0] : keys[1];
  assert.equal((await getUnit(unit)).owner, owner.acct);
  assert.equal(wallet(b) + wallet(c), beforeResale - 1000);
  assert.equal(wallet(a), sellerBefore);
  const credits = (await pool.query("select * from credits where to_id=$1 and kind='property'", [a.acct])).rows;
  assert.equal(credits.length, 1);
  assert.equal(Number(credits[0].amount), 1000);
  assert.equal(credits[0].claimed, false);
  assert.equal((await action(owner, 'property_buy', {unit}, ownerKey)).replayed, true);
  assert.equal(wallet(b) + wallet(c), beforeResale - 1000);
  assert.equal((await pool.query("select count(*) n from credits where to_id=$1 and kind='property'", [a.acct])).rows[0].n, '1');
  assert.equal(await properties.resolveAccess(a.acct, unit), null);
  assert.equal(await properties.resolveAccess(other.acct, unit, Date.now(), {revision: tour.revision}), null);
  installed = await assets(unit);
  assert.deepEqual(installed.map(x => Number(x.id)), assetIds);
  assert.ok(installed.every(x => x.owner === owner.acct));
  assert.equal((await getUnit(unit)).finish, 'coastal');
  checks.push('two resale buyers transfer one furnished unit, exact asset IDs and one durable offline seller credit');

  a.state = await loadPlayer(a.acct);
  assert.equal(wallet(a), sellerBefore);
  players.set(a.acct, a);
  assert.equal((await Social.claim(a)).filter(x => x.kind === 'property').length, 1);
  assert.equal(wallet(a), sellerBefore + 1000);
  assert.deepEqual(await Social.claim(a), []);
  assert.equal(wallet(a), sellerBefore + 1000);
  assert.equal((await loadPlayer(a.acct)).cash + (await loadPlayer(a.acct)).momo, sellerBefore + 1000);
  checks.push('seller proceeds survive offline reload and claim exactly once through Social.claim');

  successful(await action(owner, 'property_list', listed(unit, 500, false)));
  const unfurnished = await listing(unit);
  assert.deepEqual(unfurnished.included, []);
  successful(await action(a, 'property_buy', {unit}));
  assert.equal((await getUnit(unit)).owner, a.acct);
  assert.deepEqual(await assets(unit), []);
  const stored = (await pool.query('select * from property_furnishings where id=any($1::bigint[]) order by id', [assetIds])).rows;
  assert.equal(stored.length, 2);
  assert.ok(stored.every(x => x.owner === owner.acct && x.unit === null));
  assert.ok((await action(a, 'property_install', {unit, asset: Number(gas.id)})).error);
  const totalAssets = Number((await pool.query('select count(*) n from property_furnishings')).rows[0].n);
  assert.equal(totalAssets, 2);
  checks.push('unfurnished resale preserves both assets once in seller storage and grants none to buyer');

  successful(await action(a, 'property_buy', {unit: spare}));
  const primaryRace = await Promise.all([
    action(a, 'property_primary', {unit: spare}), action(a, 'property_list', listed(spare, 250))
  ]);
  assert.equal(primaryRace.filter(x => !x.error).length, 1);
  const residence = (await pool.query('select unit from property_residences where acct=$1', [a.acct])).rows[0];
  const raceListing = await listing(spare);
  assert.ok(!(residence?.unit === spare && raceListing));
  if (raceListing) successful(await action(a, 'property_cancel', {unit: spare, listing: Number(raceListing.id)}));
  successful(await action(a, 'property_primary', {unit: spare}));
  assert.ok((await action(a, 'property_list', listed(spare, 250))).error);
  successful(await action(a, 'property_primary', {unit: null}));
  checks.push('primary/list contention cannot expose a primary residence for sale; owner can restore legacy primary');

  successful(await action(a, 'property_list', listed(spare, 250)));
  const expiring = await listing(spare), expiredAccess = await properties.resolveAccess(b.acct, spare);
  await pool.query("update property_listings set expires_at=now()-interval '1 second' where id=$1", [expiring.id]);
  assert.equal(await properties.resolveAccess(b.acct, spare), null);
  assert.ok((await action(b, 'property_buy', {unit: spare})).error);
  successful(await action(a, 'property_list', listed(spare, 260)));
  assert.equal((await pool.query('select status from property_listings where id=$1', [expiring.id])).rows[0].status, 'expired');
  assert.equal(await properties.resolveAccess(b.acct, spare, Date.now(), {revision: expiredAccess.revision}), null);
  const relisted = await listing(spare);
  assert.notEqual(relisted.id, expiring.id);
  assert.ok((await action(a, 'property_cancel', {unit: spare, listing: Number(expiring.id)})).error);
  const cancelKey = crypto.randomUUID();
  successful(await action(a, 'property_cancel', {unit: spare, listing: Number(relisted.id)}, cancelKey));
  assert.equal((await action(a, 'property_cancel', {unit: spare, listing: Number(relisted.id)}, cancelKey)).replayed, true);
  assert.equal(await properties.resolveAccess(b.acct, spare), null);
  successful(await action(a, 'property_list', listed(spare, 270)));
  assert.equal((await pool.query("select count(*) n from property_listings where unit=$1 and status='listed'", [spare])).rows[0].n, '1');
  successful(await action(a, 'property_cancel', {unit: spare}));
  checks.push('expiry revokes tours and purchase; cancel/relist preserves one active listing and fresh revision');

  const stableUnit = await getUnit(unit), stableAssets = await pool.query('select * from property_furnishings order by id');
  const stableWallets = [wallet(a), wallet(b), wallet(c)];
  await properties.migrate();
  await Life.migrateLife();
  assert.deepEqual(await getUnit(unit), stableUnit);
  assert.deepEqual((await pool.query('select * from property_furnishings order by id')).rows, stableAssets.rows);
  assert.deepEqual(await Promise.all([a, b, c].map(async p => {const s = await loadPlayer(p.acct); return s.cash + s.momo;})), stableWallets);
  for (const p of [a, b, c]) {
    const delta = Number((await pool.query("select coalesce(sum((facts->>'delta')::numeric),0) n from life_events where acct=$1 and kind='money'", [p.acct])).rows[0].n);
    assert.equal(10000000 + delta, wallet(p));
  }
  checks.push('migration rerun and reload preserve ownership/assets/wallets; all wallet changes reconcile to journal');
  console.log(JSON.stringify({passed: checks.length, checks, schema, scope: 'Real loopback PostgreSQL, fresh retained disposable schema; funded adversarial fixtures, no production data, provider or economy-balancing claim.'}, null, 2));
} finally {
  await pool.end();
  await admin.end();
  // The unique disposable schema is retained for diagnosis; no recursive drop.
}
