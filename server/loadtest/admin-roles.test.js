import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLES, PERMISSIONS, can, isRole, REAUTH} from '../src/admin/roles.js';
import {FLAGS, flag, setFlags} from '../src/admin/flags.js';
import {sessionLive, adminCookie, adminToken, csrfFor, ADMIN_COOKIE, IDLE_MS, ABSOLUTE_MS} from '../src/admin/session.js';
import {MOD_ACTIONS, cleanReason} from '../src/admin/players.js';
import * as Ops from '../src/admin/ops.js';

test('every role grants only known permissions, and only the owner manages administrators', () => {
  for (const [id, r] of Object.entries(ROLES)) for (const p of r.perms) assert.ok(Object.hasOwn(PERMISSIONS, p), `${id}: ${p}`);
  assert.deepEqual(Object.keys(ROLES).filter(r => can(r, 'admins.manage')), ['owner']);
  assert.equal(isRole('superuser'), false); assert.equal(can('superuser', 'overview.read'), false); assert.equal(can(undefined, 'overview.read'), false);
});

test('least privilege: payments, bans and records stay with the roles that need them', () => {
  assert.deepEqual(Object.keys(ROLES).filter(r => can(r, 'payments.read')).sort(), ['finance', 'owner']);
  assert.deepEqual(Object.keys(ROLES).filter(r => can(r, 'moderation.ban')).sort(), ['moderator', 'owner']);
  assert.equal(can('support', 'moderation.suspend'), false, 'support analysts write notes, they do not suspend');
  assert.equal(can('finance', 'moderation.note'), false);
  assert.equal(can('moderator', 'economy.read'), false);
  assert.equal(can('ops', 'payments.verify'), false);
  assert.equal(can('moderator', 'players.records'), false, 'money journals are for support, finance and owners');
  // No role anywhere can change a balance: the permission does not exist.
  assert.ok(!Object.keys(PERMISSIONS).some(p => /balance|adjust|credit/.test(p)));
  assert.ok(REAUTH.has('moderation.ban') && REAUTH.has('admins.manage'));
});

test('moderation actions map to the permission that guards them', () => {
  assert.equal(MOD_ACTIONS.note, 'moderation.note'); assert.equal(MOD_ACTIONS.suspend, 'moderation.suspend'); assert.equal(MOD_ACTIONS.ban, 'moderation.ban');
  assert.equal(MOD_ACTIONS.adjust_balance, undefined);
  assert.equal(cleanReason('  spam\u0000 links  '), 'spam  links'); assert.equal(cleanReason(42), ''); assert.equal(cleanReason('x'.repeat(900)).length, 500);
});

test('admin sessions end after 30 idle minutes or 8 hours, whichever comes first', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  assert.equal(sessionLive({expires_at: new Date(now + 3600000), last_seen: new Date(now - 60000)}, now), true);
  assert.equal(sessionLive({expires_at: new Date(now + 3600000), last_seen: new Date(now - IDLE_MS - 1)}, now), false);
  assert.equal(sessionLive({expires_at: new Date(now - 1), last_seen: new Date(now)}, now), false);
  assert.equal(sessionLive(null, now), false);
  assert.equal(ABSOLUTE_MS, 8 * 3600000);
});

test('the admin cookie is HttpOnly and SameSite=Strict, and CSRF tokens are bound to one session', () => {
  const c = adminCookie('a'.repeat(43), Date.now() + 60000);
  assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Strict/); assert.match(c, /Path=\//);
  assert.match(adminCookie('', 0), /Max-Age=0/);
  assert.equal(adminToken(`other=1; ${ADMIN_COOKIE}=${'b'.repeat(43)}`), 'b'.repeat(43));
  assert.equal(adminToken(`${ADMIN_COOKIE}=short`), null);
  assert.notEqual(csrfFor('h1'), csrfFor('h2')); assert.equal(csrfFor('h1'), csrfFor('h1'));
});

test('feature flags default on, follow stored values and ignore unknown keys', () => {
  assert.equal(flag('life_events'), FLAGS.life_events.default);
  setFlags([{key: 'life_events', enabled: false}, {key: 'not_a_flag', enabled: true}]);
  assert.equal(flag('life_events'), false); assert.equal(flag('not_a_flag'), false);
  setFlags([{key: 'life_events', enabled: true}]);
  assert.equal(flag('life_events'), true);
});

test('operational telemetry records worker failures as incidents without detail', async () => {
  await Ops.track('unit-ok', async () => 1);
  await assert.rejects(Ops.track('unit-fail', async () => { throw Object.assign(new Error('secret detail'), {code: 'E_UNIT'}); }));
  const s = Ops.snapshot();
  assert.equal(s.workers['unit-ok'].failures, 0); assert.equal(s.workers['unit-fail'].failures, 1);
  assert.equal(s.incidents[0].code, 'E_UNIT'); assert.ok(!JSON.stringify(s).includes('secret detail'));
});
