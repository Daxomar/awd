import test from 'node:test';
import assert from 'node:assert/strict';
import { stepPerson, approach, turnTowards, ACCEL } from '../src/v2/scene/locomotion.js';
import { actionFor, ACTIVITY_ACTION, ROAM, CLIP_PROPS } from '../src/v2/scene/actions.js';
import { planStreet } from '../src/v2/scene/street-kit.js';
import { ambientBudget, BASE_AREA, populationFor } from '../src/v2/scene/ambient.js';
import { SOCIALS } from '../src/v2/ui/people.js';
import { nearestSlots } from '../src/v2/scene/street-boards.js';
import { fitSize } from '../src/v2/scene/billboard-face.js';
import { clothAccents } from '../src/v2/scene/awd-runtime.js';
import { STREET_IDS, streetGraph, isStreetPoint } from '../../shared/local-streets.js';

const person = (x = 0, z = 0) => ({ x, z, yaw: 0, path: [], speed: 1.45, pose: 'stand' });
const open = () => true;

test('walking eases in, follows the path round corners and stops on the target', () => {
  const p = person(); p.path = [[0, 4], [4, 4]];
  let arrived = false; p.onArrive = () => { arrived = true; };
  stepPerson(p, 1 / 30, open);
  assert.ok(p.vel > 0 && p.vel <= ACCEL / 30 + 1e-9, 'starts slowly instead of at full pace');
  let peak = 0;
  for (let i = 0; i < 600 && p.path.length; i++) { stepPerson(p, 1 / 30, open); peak = Math.max(peak, p.vel); }
  assert.ok(arrived, 'arrives');
  assert.ok(peak <= p.speed + 1e-9 && peak > 1.2, 'reaches walking pace without exceeding it');
  assert.ok(Math.hypot(p.x - 4, p.z - 4) < 1e-6, 'stops exactly on the target');
  assert.equal(p.vel, 0);
});

test('turning is limited to a human rate and a sharp turn slows the walk', () => {
  const yaw = turnTowards(0, Math.PI, 1 / 30);
  assert.ok(Math.abs(yaw) > 0 && Math.abs(yaw) <= 7.5 / 30 + 1e-9);
  const p = person(); p.vel = 1.45; p.yaw = 0; p.path = [[0, -5]];   // target directly behind
  stepPerson(p, 1 / 30, open);
  assert.ok(p.vel < 1.45, 'brakes to pivot');
  assert.equal(approach(0, 2, 0.1), ACCEL * 0.1);
});

test('joystick steering slides along walls instead of stopping dead', () => {
  const p = person(); p.steer = { dx: 1, dz: 1, speed: 1.45 }; p.vel = 1.45; p.yaw = Math.PI / 4;
  const wall = (x, z) => z < 0.5;   // cannot go further in +z
  for (let i = 0; i < 30; i++) stepPerson(p, 1 / 30, wall);
  assert.ok(p.x > 0.5, 'keeps moving along the wall');
  assert.ok(p.z < 0.5, 'never enters the wall');
});

test('activities map to visible actions with the right props', () => {
  assert.deepEqual(actionFor('train'), { action: 'lift', clip: 'lift', props: ['dumbbell_L', 'dumbbell_R'] });
  assert.equal(actionFor('waakye').clip, 'eat');
  assert.deepEqual(actionFor('emcee'), { action: 'emcee', clip: 'talk', props: ['mic'] });
  assert.equal(actionFor('kayayo').props[0], 'headpan');
  assert.equal(actionFor('somethingnew', 'icon:device-mobile').clip, 'phone_use');
  assert.equal(actionFor('sleep', 'icon:bed'), null);
  assert.ok(ROAM.jog > ROAM.stroll);
  for (const [id, action] of Object.entries(ACTIVITY_ACTION)) assert.equal(actionFor(id).action, action, id);
  for (const props of Object.values(CLIP_PROPS)) assert.ok(props.length > 0);
});

test('every neighbourhood is filled with buildings that never block a street or the court', () => {
  for (const id of STREET_IDS) {
    const g = streetGraph(id), style = id === 'jtown' || id === 'labadi' ? 'coastal' : 'urban', plan = planStreet(g, style);
    assert.deepEqual(plan, planStreet(g, style), 'deterministic');
    const blocks = plan.filter((p) => p.asset === 'compound' || p.asset === 'storey');
    assert.ok(blocks.length >= 9 && plan.length >= 60, `${id}: ${blocks.length} houses, ${plan.length} placements`);
    for (const p of plan) {
      assert.ok(Math.abs(p.x) < g.w / 2 && Math.abs(p.z) < g.d / 2);
      if (['pole', 'umbrella', 'trotro'].includes(p.asset)) continue;   // street furniture stands just off the walkway
      assert.equal(isStreetPoint(g, p.x, p.z), false, `${id} ${p.asset} at ${p.x.toFixed(1)},${p.z.toFixed(1)} sits on the walkway`);
    }
  }
});

test('street billboards show the nearest boards with live adverts first', () => {
  const now = Date.now(), live = [{ id: 'a', img: '/x.png', ends: now + 1e6 }];
  const slots = [{ id: 'far-live', x: 900, z: 0, live }, { id: 'near-free', x: 10, z: 0, live: [] }, { id: 'near-live', x: 50, z: 0, live }];
  assert.deepEqual(nearestSlots(slots, 0, 0, 2, now).map((s) => s.id), ['near-live', 'far-live']);
  const [w, h] = fitSize(4, 2, 1);
  assert.ok(Math.abs(w * h - 2) < 1e-9 && w / h <= 3.2 + 1e-9, 'keeps the board area and clamps very wide art');
});

test('kente and ankara colourways pick two contrasting accents', () => {
  for (const primary of ['#f2b632', '#0e7a4e', '#c8102e', '#1f6fb8']) {
    const accents = clothAccents(primary);
    assert.equal(accents.length, 2); assert.ok(!accents.includes(primary));
  }
});

test('a bigger neighbourhood gets more street life, within a device cap', () => {
  const small = ambientBudget({}, 'normal', BASE_AREA), big = ambientBudget({}, 'normal', 88 * 88);
  assert.ok(big.walkers > small.walkers && big.moving > small.moving, 'the 88 m street is busier than the old one');
  assert.ok(big.walkers <= 9 && big.moving <= 3 && big.parked <= 9, 'still capped for phones');
  const low = ambientBudget({}, 'low', 88 * 88);
  assert.ok(low.walkers <= small.walkers && low.moving <= 1, 'battery saver stays small whatever the size');
  assert.equal(populationFor(2, big).moving, 0, 'no traffic in the small hours');
  assert.ok(populationFor(13, big).walkers >= populationFor(23, big).walkers, 'quieter at night');
});

test('every social a player can pick has its own animation on the server', async () => {
  const server = await import('../../server/src/shard.js');
  for (const [kind] of SOCIALS) {
    const s = server.SOCIALS[kind];
    assert.ok(s, `server is missing the ${kind} social`);
    assert.ok(s.anim || s.request, `${kind} has no gesture to play`);
  }
  assert.equal(server.SOCIALS.wave.anim, 'wave', 'waving must look like a wave, not a nod');
  assert.equal(server.SOCIALS.handshake.anim, 'handshake');
  assert.equal(server.SOCIALS.hug.anim, 'hug');
  assert.ok(SOCIALS.find(([k, , , min]) => k === 'handshake' && min === 0), 'anyone can shake hands');
});
