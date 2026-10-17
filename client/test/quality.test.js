import test from 'node:test';
import assert from 'node:assert/strict';
import {TIERS, ORDER, savedQuality, saveQuality, lowEnd, autoTier, resolveTier, pixelRatio, Governor, stepDown} from '../src/v2/scene/quality.js';
import {ambientBudget} from '../src/v2/scene/ambient.js';

const memory = () => { const m = new Map(); return {getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v))}; };

test('graphics preference is per browser, defaults to Auto and ignores unknown values', () => {
  const s = memory();
  assert.equal(savedQuality(s), 'auto');
  saveQuality('saver', s); assert.equal(savedQuality(s), 'saver');
  saveQuality('ultra', s); assert.equal(savedQuality(s), 'auto');
  assert.equal(savedQuality({getItem() { throw Error('blocked'); }}), 'auto', 'private mode falls back to Auto');
});

test('Auto picks by device class; an explicit choice always wins', () => {
  assert.equal(lowEnd({deviceMemory: 2}), true); assert.equal(lowEnd({hardwareConcurrency: 8, deviceMemory: 8}), false);
  assert.equal(autoTier({mobile: true, low: true}), 'saver');
  assert.equal(autoTier({mobile: true, low: false}), 'balanced');
  assert.equal(autoTier({mobile: false, low: false}), 'sharp');
  assert.equal(resolveTier('sharp', {mobile: true, low: true}), 'sharp');
  assert.equal(resolveTier('auto', {mobile: true, low: false}), 'balanced');
});

test('lower tiers render fewer pixels, drop shadows and thin the street crowd', () => {
  const phone = {mobile: true, devicePixelRatio: 3};
  assert.ok(pixelRatio('saver', phone) < pixelRatio('balanced', phone) && pixelRatio('balanced', phone) < pixelRatio('sharp', phone));
  assert.equal(pixelRatio('sharp', {mobile: true, devicePixelRatio: 1}), 1, 'never above the screen’s own ratio');
  assert.equal(TIERS.saver.shadows, false); assert.equal(TIERS.sharp.shadows, true);
  const low = ambientBudget({deviceMemory: 16, hardwareConcurrency: 16}, TIERS.saver.crowd), normal = ambientBudget({deviceMemory: 2}, TIERS.sharp.crowd);
  assert.ok(low.walkers + low.parked < normal.walkers + normal.parked, 'the setting overrides the device guess');
  assert.deepEqual(ambientBudget({deviceMemory: 2}), ambientBudget({deviceMemory: 2}, 'low'), 'without a setting the device class decides');
});

test('the governor steps down once after sustained slow frames, never during warm-up or for a single hitch', () => {
  const run = (g, from, to, ms) => { let n = 0; for (let t = from; t < to; t += ms) if (g.sample(t, ms)) n++; return n; };
  assert.equal(run(new Governor(), 0, 9900, 80), 0, 'no step during the 10 s warm-up, however slow');
  const smooth = new Governor(); let n = 0;
  for (let t = 0; t < 30000; t += 33) if (smooth.sample(t, t % 2000 < 33 ? 500 : 33)) n++;
  assert.equal(n, 0, 'smooth play with an occasional hitch keeps quality');
  const slow = new Governor();
  assert.equal(run(slow, 0, 16000, 70), 1, 'sustained ~14 fps steps down once');
  assert.equal(run(slow, 16000, 40000, 70), 0, 'then waits 30 s before another step');
  assert.equal(slow.sample(50000, 5000), false, 'a background-tab gap is ignored');
  assert.equal(stepDown('sharp'), 'balanced'); assert.equal(stepDown('saver'), 'saver'); assert.deepEqual(ORDER, ['saver', 'balanced', 'sharp']);
});
