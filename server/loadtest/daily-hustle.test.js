import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game/rules.js';
import * as H from '../src/game/daily-hustle.js';
import {paper,occasionOf,PAPER_SIZES} from '../src/game/accra-daily.js';
import {durableActions} from '../src/life-game.js';

const DAY = 86400000, NOW = Date.UTC(2026, 9, 29, 12), today = Math.floor(NOW / DAY);
const player = (id = 901) => { const s = Game.newState({id, u: 'today' + id}); s.onboarded = true; s.home = 'nima'; s.created = 1700000000000 + id; return {acct: id, state: s}; };
const counts = (s, cnt, day = today) => { s.dc = {day, cnt, visits: []}; };
const fillFor = (s, now, day) => { const c = {}; for (const m of H.board(s, now).list) { const d = H.MISSIONS.find((x) => x.id === m.id); c[d.keys[0]] = (c[d.keys[0]] || 0) + d.need; } counts(s, c, day); };
const pay = (s, log = []) => ({earn: (a, why) => { s.momo += a; log.push([a, why]); return a; }, xp: (n) => { s.xp += n; }});

test('mission pool has unique ids, real counters and one mission per category each day', () => {
  assert.equal(new Set(H.MISSIONS.map((m) => m.id)).size, H.MISSIONS.length);
  for (const m of H.MISSIONS) { assert.ok(H.CATEGORIES.some((c) => c.id === m.cat), m.id); assert.ok(m.need >= 1 && m.need <= 3 && m.keys.length && m.label && m.hint, m.id); }
  const locActs = new Set(Object.values(Game.LOC).flatMap((l) => l.acts.map((a) => 'act:' + a.id)));
  for (const m of H.MISSIONS) for (const k of m.keys) if (k.startsWith('act:')) assert.ok(locActs.has(k), `${m.id} counts a real action ${k}`);
  for (const m of H.MISSIONS) for (const k of m.keys) if (k.startsWith('loc:')) assert.ok(Game.LOC[k.slice(4)], `${m.id} counts a real place ${k}`);
  const s = player().state;
  for (let d = 0; d < 30; d++) { const ids = H.dealFor(s, today + d); assert.deepEqual(ids.map((id) => H.MISSIONS.find((m) => m.id === id).cat), ['hustle', 'street', 'linkup']); }
  assert.deepEqual(H.dealFor(s, today), H.dealFor(s, today), 'deterministic per player and day');
});

test('job-only missions are never dealt to a player without a job', () => {
  const s = player().state; s.job = null;
  for (let d = 0; d < 60; d++) assert.ok(!H.dealFor(s, today + d).includes('shift'));
});

test('progress reads only today\'s server counters and cannot be claimed early', () => {
  const s = player().state, first = H.board(s, NOW).list[0];
  assert.equal(H.board(s, NOW).list.every((m) => m.n === 0 && !m.done), true);
  assert.match(H.handle(s, {op: 'claim', id: first.id}, NOW, pay(s)).error, /Finish/);
  const m = H.MISSIONS.find((x) => x.id === first.id); counts(s, {[m.keys[0]]: m.need}, today - 1);
  assert.equal(H.board(s, NOW).list[0].n, 0, 'yesterday\'s counters do not count');
  counts(s, {[m.keys[0]]: m.need + 5}); assert.equal(H.board(s, NOW).list[0].n, m.need, 'progress is capped');
  assert.equal(H.handle(s, {op: 'claim', id: 'invented'}, NOW, pay(s)).error, 'That mission is not on today\'s board.');
});

test('claims pay once, the third claim pays the streak bonus, and money goes through the earn helper', () => {
  const s = player().state, log = []; fillFor(s, NOW, today);
  const ids = H.board(s, NOW).list.map((m) => m.id);
  const r1 = H.handle(s, {op: 'claim', id: ids[0]}, NOW, pay(s, log)); assert.ok(r1.claimed && !r1.bonus);
  assert.match(H.handle(s, {op: 'claim', id: ids[0]}, NOW, pay(s, log)).error, /Already/);
  H.handle(s, {op: 'claim', id: ids[1]}, NOW, pay(s, log));
  const r3 = H.handle(s, {op: 'claim', id: ids[2]}, NOW, pay(s, log));
  assert.equal(r3.bonus.streak, 1); assert.equal(r3.bonus.cash, H.LADDER[0].cash);
  assert.equal(log.length, 4); assert.equal(s.momo, log.reduce((a, [x]) => a + x, 0));
  assert.equal(r3.board.doneToday, true); assert.equal(r3.board.streak, 1);
});

test('streak grows on consecutive days, a saver covers one missed day, two missed days reset it', () => {
  const s = player().state;
  const run = (day) => { const now = day * DAY + 3600000; fillFor(s, now, day); let last; for (const m of H.board(s, now).list) last = H.handle(s, {op: 'claim', id: m.id}, now, pay(s)); return last; };
  for (let i = 0; i < 7; i++) run(today + i);
  assert.equal(s.daily.streak, 7); assert.equal(s.daily.freezes, 1, 'day 7 chest grants a saver');
  const missed = H.board(s, (today + 8) * DAY); assert.equal(missed.streak, 7); assert.equal(missed.atRisk, true);
  const r = run(today + 8); assert.equal(r.bonus.saverUsed, true); assert.equal(s.daily.streak, 8); assert.equal(s.daily.freezes, 0);
  assert.equal(H.board(s, (today + 11) * DAY).streak, 0, 'two missed days without a saver end the streak');
  run(today + 11); assert.equal(s.daily.streak, 1);
});

test('one re-roll per day swaps within the same category and survives a save/load', () => {
  const s = player().state; const before = H.board(s, NOW).list;
  const r = H.handle(s, {op: 'reroll', id: before[1].id}, NOW, pay(s));
  assert.notEqual(r.board.list[1].id, before[1].id); assert.equal(r.board.list[1].cat, 'street'); assert.equal(r.board.rerolls, 0);
  assert.match(H.handle(s, {op: 'reroll', id: before[0].id}, NOW, pay(s)).error, /No re-roll/);
  const loaded = Game.migrate(JSON.parse(JSON.stringify(s)), {id: 901, u: 'today901'});
  assert.deepEqual(H.board(loaded, NOW).list.map((m) => m.id), r.board.list.map((m) => m.id));
  assert.equal(H.board(s, NOW + DAY).list.length, 3, 'new board next day');
});

test('corrupt saved daily data is normalized, never trusted', () => {
  const s = player().state; s.daily = {day: 'x', list: [{done: true}, 'invented'], claimed: ['chat', 5], streak: -4, freezes: 99, lastFull: 'yes'};
  const b = H.board(s, NOW); assert.equal(b.list.length, 3); assert.equal(b.streak, 0); assert.ok(b.savers <= H.MAX_SAVERS);
});

test('rules route the hustle message, persist durably and pay through the ledger', () => {
  assert.ok(durableActions.has('hustle'));
  const p = player(), s = p.state; const shard = {policy: null}, now = Date.now(), day = Math.floor(now / DAY);
  const st = Game.onMsg(p, {t: 'hustle', op: 'status'}, shard, now); assert.equal(st.t, 'hustle'); assert.equal(st.board.list.length, 3);
  fillFor(s, now, day); const id = st.board.list[0].id; const before = s.momo;
  const r = Game.onMsg(p, {t: 'hustle', op: 'claim', id}, shard, now); assert.equal(r.t, 'multi');
  assert.ok(s.momo > before); assert.match(s.ledger.at(-1)[2], /^Today:/);
  assert.equal(Game.view(s).daily.list.find((m) => m.id === id).claimed, true);
  assert.equal(Game.onMsg(p, {t: 'hustle', op: 'nonsense'}, shard, now).k, 'bad');
});

test('the Daily Chale paper is stable per day and reflects Accra seasons and holidays', () => {
  assert.deepEqual(paper(NOW), paper(NOW + 3600000)); assert.ok(PAPER_SIZES.headlines >= 20 && PAPER_SIZES.tips >= 10);
  assert.equal(paper(Date.UTC(2026, 0, 10)).weather.season, 'Harmattan'); assert.equal(paper(Date.UTC(2026, 5, 10)).weather.season, 'Major rains');
  assert.match(occasionOf(Date.UTC(2026, 2, 6, 9)), /Independence/); assert.match(occasionOf(Date.UTC(2026, 11, 4, 9)), /Farmers/);
  assert.equal(occasionOf(Date.UTC(2026, 9, 29, 9)), null);
});
