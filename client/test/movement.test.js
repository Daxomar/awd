import test from 'node:test';
import assert from 'node:assert/strict';
import {locomotion, joystickSpeed, clipFor, savedCameraMode, saveCameraMode, followSupported, RUN_THRESHOLD, WALK_SPEED} from '../src/v2/scene/movement.js';

test('players run only outdoors and only near full joystick tilt', () => {
  assert.equal(locomotion(joystickSpeed(1, true), true), 'run');
  assert.equal(locomotion(joystickSpeed(0.4, true), true), 'walk');
  assert.equal(locomotion(joystickSpeed(1, false), false), 'walk', 'interiors never run');
  assert.ok(joystickSpeed(1, false) < RUN_THRESHOLD);
  assert.ok(joystickSpeed(0, true) > 0 && joystickSpeed(0, true) < WALK_SPEED);
  assert.equal(joystickSpeed(9, true), joystickSpeed(1, true), 'tilt is clamped');
});

test('movement states fall back to idle when a character set lacks a clip', () => {
  assert.equal(clipFor('run', new Set(['idle', 'walk', 'run'])), 'run');
  assert.equal(clipFor('run', new Set(['idle', 'walk'])), 'idle');
  assert.equal(clipFor('interact', new Set(['idle', 'agree'])), 'agree');
  assert.equal(clipFor('unknown-state', new Set(['idle'])), 'idle');
});

test('camera preference persists, defaults to overhead and survives blocked storage', () => {
  const store = new Map(), storage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v)};
  assert.equal(savedCameraMode(storage), 'iso');
  saveCameraMode('follow', storage); assert.equal(savedCameraMode(storage), 'follow');
  saveCameraMode('nonsense', storage); assert.equal(savedCameraMode(storage), 'iso');
  const blocked = {getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }};
  assert.equal(savedCameraMode(blocked), 'iso');
  assert.doesNotThrow(() => saveCameraMode('follow', blocked));
});

test('third person is offered only in rooms that can support it', () => {
  const spec = {w: 6, d: 6};
  assert.equal(followSupported({spec, view: 'room'}), true);
  assert.equal(followSupported({spec, view: 'map'}), false, 'the city map stays overhead');
  assert.equal(followSupported({spec, view: 'room', custody: true}), false, 'custody cells stay overhead');
  assert.equal(followSupported({spec, view: 'room', ride: true}), false, 'rides have their own chase camera');
  assert.equal(followSupported({spec, view: 'room', studio: true}), false, 'the stylist keeps its studio camera');
  assert.equal(followSupported({view: 'room'}), false);
});
