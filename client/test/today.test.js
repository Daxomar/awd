import test from 'node:test';
import assert from 'node:assert/strict';
import {todaySummary,chipText,ladderView,missionView} from '../src/v2/phone/today-state.js';

const ladder = Array.from({length: 7}, (_, i) => ({cash: 40 + i * 20, xp: 20, chest: i === 6}));
const board = (over = {}) => ({list: [{id: 'gigs', cat: 'hustle', n: 2, need: 2, done: true, claimed: false}, {id: 'trotro', cat: 'street', n: 1, need: 2, done: false, claimed: false}, {id: 'chat', cat: 'linkup', n: 3, need: 3, done: true, claimed: true}], streak: 3, step: 3, ladder, rerolls: 1, doneToday: false, ...over});

test('summary and HUD chip reflect only the server board', () => {
  assert.deepEqual(todaySummary(board()), {done: 2, total: 3, claimable: 1, streak: 3, atRisk: false, finished: false});
  assert.equal(chipText(board()), 'Today 2/3 · claim');
  assert.equal(chipText(board({doneToday: true})), 'Today done · 3-day streak');
  assert.equal(chipText({list: []}), ''); assert.equal(todaySummary(null).total, 0); assert.equal(todaySummary({streak: -5}).streak, 0);
});

test('ladder marks past, next and today-completed steps without inventing progress', () => {
  assert.deepEqual(ladderView(board()).map((s) => s.state), ['done', 'done', 'done', 'next', 'later', 'later', 'later']);
  assert.deepEqual(ladderView(board({doneToday: true, step: 2})).map((s) => s.state), ['done', 'done', 'done', 'later', 'later', 'later', 'later']);
  assert.equal(ladderView(board()).at(-1).chest, true); assert.deepEqual(ladderView({}), []);
});

test('mission view clamps progress and picks the right action', () => {
  const [a, b, c] = board().list.map(missionView);
  assert.equal(a.action, 'claim'); assert.equal(a.pct, 100); assert.equal(a.cat.id, 'hustle');
  assert.equal(b.action, 'progress'); assert.equal(b.pct, 50); assert.equal(c.action, 'claimed');
  const odd = missionView({cat: 'invented', n: 9, need: 0}); assert.equal(odd.need, 1); assert.equal(odd.n, 1); assert.equal(odd.cat.id, 'hustle');
});
