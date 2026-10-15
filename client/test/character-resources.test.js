import test from 'node:test';
import assert from 'node:assert/strict';
import { GeometryCache } from '../src/v2/scene/geometry-cache.js';
import { shirtEnvelope } from '../src/v2/scene/garment-fit.js';

test('eviction disposes idle geometry, retaining all live shared avatars', () => {
  const cache = new GeometryCache(2), disposed = [];
  const make = key => () => ({ skin: { dispose() { disposed.push(key); } } });
  const shared = cache.acquire('shared', make('shared'));
  assert.equal(cache.acquire('shared', () => assert.fail('Duplicate allocation')), shared);
  for (let i = 0; i < 50; i++) { cache.acquire(i, make(i)); cache.release(i); }
  assert.deepEqual(cache.stats(), { entries: 3, active: 1, idle: 2, references: 2 });
  assert.equal(disposed.length, 48); assert.ok(!disposed.includes('shared'));
  cache.release('shared'); assert.equal(cache.stats().references, 1);
  cache.release('shared'); assert.equal(cache.stats().active, 0);
  cache.acquire('last', make('last')); cache.release('last');
  cache.acquire('next', make('next')); cache.release('next');
  assert.equal(disposed.filter(k => k === 'shared').length, 1);
});

test('failed builds preserve the cache; identical geometry is disposed only once', () => {
  const cache = new GeometryCache(0); let count = 0;
  assert.throws(() => cache.acquire('bad', () => { throw Error('build'); }));
  assert.equal(cache.stats().entries, 0);
  const g = { dispose() { count++; } };
  cache.acquire('ok', () => ({ a: g, b: g })); cache.release('ok'); cache.release('ok');
  assert.equal(count, 1);
});

test('garment fitting bridges chest detail, follows body size and leaves unrelated regions alone', () => {
  const rig = { Hips: { y: .9, z: 0 }, Neck: { y: 1.5 } };
  const fit = shirtEnvelope([-.16,1.2,.16, .16,1.2,.16, 0,1.2,.1], [1,1,1], rig);
  const centre = fit([0,1.2,.1], 1);
  assert.ok(centre[2] > .16 && centre[2] <= .18);
  for (const point of [[0,1.2,-.1], [0,1.8,.1]]) assert.deepEqual(fit([...point],1),point);
  assert.deepEqual(fit([.5,1.2,.1],0),[.5,1.2,.1]);
  const full = shirtEnvelope([-.2,1.2,.24, .2,1.2,.24], [1,1], rig);
  assert.ok(full([0,1.2,.1],1)[2] > centre[2], 'Fit must follow the selected body shape');
});
