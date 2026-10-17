import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game/rules.js';
import * as LE from '../src/game/life-events.js';

const HOUR = 3600000;
const player = (id = 900) => { const s = Game.newState({id, u: 'life' + id}); s.onboarded = true; s.home = 'nima'; s.place = 'n:nima'; s.cash = 300; s.momo = 5000; return {acct: id, name: 'life' + id, state: s}; };
const ctx = (over = {}) => ({now: Date.UTC(2026, 9, 17, 23), h: 23, day: 100, place: 'n:nima', street: true, public: true, idle: true, friends: [], ...over});
const always = () => 0;   // deterministic "yes" random source for offers and checks

test('curated definitions cover every category with bounded, documented rules', () => {
  const cats = new Set(Object.values(LE.DEFS).map(d => d.cat));
  for (const c of ['neighbourhood', 'career', 'social', 'business', 'property', 'financial', 'discovery', 'community']) assert.ok(cats.has(c), c);
  assert.ok(Object.values(LE.DEFS).some(d => d.cat === 'business' && d.negative) && Object.values(LE.DEFS).some(d => d.cat === 'business' && !d.negative), 'business opportunity and setback');
  for (const [id, d] of Object.entries(LE.DEFS)) {
    assert.ok(d.title && d.cooldownH >= 24 && d.expireMin > 0 && d.expire && typeof d.eligible === 'function' && typeof d.resolve === 'function', id);
  }
});

test('offers are occasional, need an idle connected player, respect gaps, cooldowns and a daily cap', () => {
  const s = player().state;
  assert.equal(LE.offer(s, ctx({idle: false}), always), null, 'never while busy');
  const c = ctx({h: 12}); const first = LE.offer(s, c, always); assert.ok(first, 'an idle player can get an event');
  assert.equal(LE.offer(s, {...c, now: c.now + 2 * 60000}, always), null, 'one open event at a time');
  s.lifeEvents.active = null;
  assert.equal(LE.offer(s, {...c, now: c.now + 5 * 60000}, always), null, 'minimum gap between events');
  let t = c.now;
  for (let i = 0; i < 5; i++) { t += 25 * 60000; s.lifeEvents.active = null; LE.offer(s, {...c, now: t}, always); }
  assert.equal(s.lifeEvents.today, 3, 'at most three a day');
  assert.ok(Object.values(s.lifeEvents.cooldowns).every(v => v > c.now), 'each offered event starts its cooldown');
  const quiet = player().state; let offered = 0;
  for (let i = 0; i < 600; i++) { quiet.lifeEvents = {...(quiet.lifeEvents || {}), active: null, today: 0, lastAt: 0}; if (LE.offer(quiet, {...c, now: c.now + i * 61000}, Math.random)) offered++; }
  assert.ok(offered < 40, `random offers are rare (${offered} in 600 checks)`);
});

test('the fictional robbery only touches pocket cash, is capped, and is identical in every neighbourhood', () => {
  const d = LE.DEFS.robbery;
  for (const place of ['n:nima', 'n:labadi', 'n:jtown', 'n:osu', 'n:airres']) assert.equal(d.eligible(player().state, ctx({place})), true, place + ' has the same risk');
  assert.equal(d.eligible(player().state, ctx({h: 14})), false, 'not in the daytime');
  const poor = player().state; poor.cash = 20; assert.equal(d.eligible(poor, ctx()), false, 'not when carrying little cash');
  for (const choice of ['hand', 'escape', 'help', 'talk']) for (let i = 0; i < 10; i++) {
    const p = player(); p.state.lifeEvents = {active: {id: 'robbery', at: 0, expires: Infinity, title: d.title, cat: d.cat, choices: d.choices(), ctx: {}}};
    const momo = p.state.momo, before = p.state.cash, home = p.state.home;
    const res = Game.onMsg(p, {t: 'lifeevent', choice}, {policy: {}}, ctx().now);
    assert.equal(res.t, 'life_event_result', choice);
    assert.equal(p.state.momo, momo, 'MoMo is never touched'); assert.equal(p.state.home, home);
    assert.ok(before - p.state.cash <= 200 && p.state.cash >= 0, `${choice} loss is capped`);
  }
});

test('losses are capped per day and followed by a calm period without negative events', () => {
  const s = player().state; s.cash = 5000; const c = ctx();
  let total = 0;
  for (let i = 0; i < 4; i++) { s.lifeEvents = {...LE.stateOf(s), active: {id: 'robbery', at: c.now, expires: Infinity, title: 'x', cat: 'neighbourhood', choices: LE.DEFS.robbery.choices(), ctx: {}}}; const r = LE.decide(s, c, 'hand'); total += -(r.out.cash || 0); s.cash += r.out.cash || 0; }
  assert.ok(total <= LE.RULES.dailyLossCap, `daily loss cap holds (${total})`);
  assert.ok(s.lifeEvents.calmUntil > c.now, 'calm period after a loss');
  s.lifeEvents.active = null; s.lifeEvents.lastAt = 0; s.lifeEvents.today = 0; s.lifeEvents.cooldowns = {};
  const offered = LE.offer(s, {...c, now: c.now + HOUR}, always);
  assert.ok(!offered || !LE.DEFS[offered.id].negative, 'no negative event during the calm period');
});

test('ignoring an event expires neutrally, online or offline, and survives save/load', () => {
  const p = player(), c = ctx({street: false, place: 'home', public: false}); p.state.place = 'home';
  LE.offer(p.state, c, always); const a = p.state.lifeEvents.active; assert.ok(a);
  const saved = JSON.parse(JSON.stringify(p.state));
  const loaded = Game.migrate(saved, {id: p.acct, u: p.name});
  assert.equal(loaded.lifeEvents.active.id, a.id, 'an open event survives disconnect and reload');
  const cash = loaded.cash, momo = loaded.momo;
  const r = LE.settle(loaded, a.expires + 1);
  assert.equal(loaded.lifeEvents.active, null); assert.equal(loaded.cash, cash); assert.equal(loaded.momo, momo);
  assert.equal(loaded.lifeEvents.history[0].choice, 'expired'); assert.equal(r.notes.length, 1, 'the player is told what happened');
  assert.equal(LE.decide(loaded, {...c, now: a.expires + 2}, 'yes').error, 'There is nothing to decide right now.');
});

test('outcomes connect to careers, friendships, finances and businesses through the server', () => {
  const now = ctx().now, shard = {policy: {}};
  const w = player(); w.state.job = {id: 'tech', rank: 0, perf: 50, shifts: 0};
  w.state.lifeEvents = {active: {id: 'career', at: now, expires: now + 600000, title: 'x', cat: 'career', choices: LE.DEFS.career.choices(), ctx: {}}};
  const r = Game.onMsg(w, {t: 'lifeevent', choice: 'yes'}, shard, now);
  assert.equal(w.state.job.perf, 56); assert.ok(r.effects.some(e => /performance/.test(e)));
  assert.match(Game.onMsg(w, {t: 'lifeevent', choice: 'yes'}, shard, now).m, /nothing to decide/, 'a decision applies once');

  const f = player(901); f.state.friends = {902: {accepted: true, n: 'kofi', pts: 30}};
  f.state.lifeEvents = {active: {id: 'friend_loan', at: now, expires: now + 600000, title: 'x', cat: 'social', choices: LE.DEFS.friend_loan.choices(), ctx: {friend: 902, name: 'kofi', amount: 50}}};
  const wallet = f.state.cash + f.state.momo;
  Game.onMsg(f, {t: 'lifeevent', choice: 'lend'}, shard, now);
  assert.equal(f.state.cash + f.state.momo, wallet - 50); assert.equal(f.state.friends[902].pts, 35); assert.equal(f.state.lifeEvents.pending.length, 1);
  assert.equal(Game.lifeEventDue(f.state, now + 23 * HOUR), false); assert.equal(Game.lifeEventDue(f.state, now + 25 * HOUR), true);
  assert.equal(LE.settle(f.state, now + 25 * HOUR).paid[0].amount, 50, 'the loan comes back as a scheduled repayment');

  const b = player(903); b.state.biz = {kiosk: {at: now, seen: now}};
  b.state.lifeEvents = {active: {id: 'supplier_setback', at: now, expires: now + 600000, title: 'x', cat: 'business', choices: LE.DEFS.supplier_setback.choices(), ctx: {}}};
  Game.onMsg(b, {t: 'lifeevent', choice: 'wait'}, shard, now);
  assert.equal(b.state.flags.bizDip.m, 0.7, 'a setback lowers exactly one upcoming business settlement');
  assert.ok(b.state.lifeEvents.calmUntil > now, 'a setback counts as a loss for the calm period');
});
