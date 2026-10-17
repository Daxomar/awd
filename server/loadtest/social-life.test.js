import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game/rules.js';
import * as Profile from '../src/game/profile.js';
import * as HomeAccess from '../src/game/home-access.js';
import {cleanSpec, KINDS, visibleTo, eligibility} from '../src/events.js';

const player = (id, extra = {}) => { const s = Game.newState({id, u: 'p' + id}); s.onboarded = true; s.home = 'nima'; Object.assign(s, extra); return {acct: id, name: 'p' + id, state: s}; };

test('public profile shows only what the owner chose and never location, balances or account data', () => {
  const p = player(1); p.state.flags.discoveryBadges = ['City explorer'];
  const card = {name: 'p1', look: null, job: 'Intern', jobIc: 'x', rep: 5, title: 'Newcomer', car: 'Car', owns: ['Nima room'], worth: 9999, biz: 1, online: true, place: 'circle', since: 1};
  let v = Profile.publicView(card, p.state);
  assert.equal(v.job, 'Intern'); assert.equal(v.rep, 5); assert.deepEqual(v.badges, ['City explorer']);
  for (const k of ['place', 'worth', 'car', 'owns', 'home', 'settings', 'cash', 'momo', 'email']) assert.equal(k in v, false, k + ' hidden by default');
  p.state.profile = Profile.cleanProfile({show: {possessions: true, residence: true, worth: true, career: false}, headline: 'Football fan', badge: 'City explorer', accent: 'ocean'}, p.state);
  v = Profile.publicView(card, p.state);
  assert.equal(v.car, 'Car'); assert.equal(v.worth, 9999); assert.ok(v.home); assert.equal('job' in v, false); assert.equal(v.headline, 'Football fan'); assert.equal(v.badge, 'City explorer');
  assert.equal('place' in v, false, 'live location is never public');
  const bad = Profile.cleanProfile({headline: '<script>', badge: 'Fake badge', accent: 'neon', show: {career: 'yes'}}, p.state);
  assert.equal(bad.headline, 'Football fan'); assert.equal(bad.badge, 'City explorer'); assert.equal(bad.accent, 'ocean'); assert.equal(bad.show.career, false);
  assert.ok(Profile.publicView(card, p.state, {me: true}).settings, 'the owner sees their settings');
});

test('home access settings are bounded and guests only touch furniture the host allows', () => {
  const host = player(2), now = Date.UTC(2026, 9, 17, 12); host.state.place = 'home'; host.state.items = {tv: true, solar: true};
  assert.deepEqual(HomeAccess.accessOf(host.state), {mode: 'friends', limit: 6, furniture: 'guests'});
  assert.deepEqual(HomeAccess.cleanAccess({mode: 'party', limit: 99, furniture: 'all'}, host.state), {mode: 'friends', limit: 8, furniture: 'guests'});
  assert.equal(HomeAccess.guestMayUse(host, 'sleep'), false); assert.equal(HomeAccess.guestMayUse(host, 'cook'), false);
  const guest = player(3); guest.state.place = 'visit:2'; guest.state.needsAt = now; guest.state.lastDaily = Game.clock(now).day;
  const shard = {byAcct: id => id === 2 ? host : null, policy: {}};
  let r = Game.onMsg(guest, {t: 'act', home: true, id: 'tv'}, shard, now);
  assert.equal(r.t, 'busy', 'a guest may watch the host’s TV'); assert.equal(guest.state.busy.guestOf, 2);
  guest.state.busy = null;
  assert.match(Game.onMsg(guest, {t: 'act', home: true, id: 'sleep'}, shard, now).m, /keeps that/, 'never the host’s bed');
  host.state.homeAccess = {furniture: 'owner'};
  assert.match(Game.onMsg(guest, {t: 'act', home: true, id: 'tv'}, shard, now).m, /keeps that/, 'the host can keep everything private');
  host.state.place = 'circle';
  assert.match(Game.onMsg(guest, {t: 'act', home: true, id: 'tv'}, shard, now).m, /not at home/);
});

test('event specifications use real venues, bounded schedules and moderated text', () => {
  const now = Date.UTC(2026, 9, 17, 12), host = player(4);
  for (const k of Object.values(KINDS)) for (const v of k.venues) assert.ok(v === 'home' || Game.LOC[v], v);
  const base = {kind: 'meetup', title: 'Saturday meetup', venue: 'ug', startsAt: now + 3600000, minutes: 60, capacity: 10};
  assert.equal(cleanSpec(base, {host, now}).venue, 'ug');
  assert.match(cleanSpec({...base, venue: 'vibes'}, {host, now}).error, /can use/);
  assert.match(cleanSpec({...base, startsAt: now + 60000}, {host, now}).error, /Start between/);
  assert.match(cleanSpec({...base, startsAt: now + 8 * 86400000}, {host, now}).error, /Start between/);
  assert.match(cleanSpec({...base, minutes: 600}, {host, now}).error, /Duration/);
  assert.match(cleanSpec({...base, capacity: 500}, {host, now}).error, /Capacity/);
  assert.match(cleanSpec({...base, title: 'Hi'}, {host, now}).error, /title/);
  assert.equal(cleanSpec({...base, rewardXp: 25, eligibility: {newcomers: true}}, {host, now}).rewardXp, 0, 'players cannot attach rewards or eligibility');
  const admin = cleanSpec({...base, rewardXp: 99, eligibility: {newcomers: true}}, {admin: true, now});
  assert.equal(admin.rewardXp, 25); assert.deepEqual(admin.eligibility, {newcomers: true});
  assert.match(cleanSpec({...base, kind: 'house'}, {admin: true, now}).error, /type/, 'house gatherings are player-hosted only');
  const house = cleanSpec({...base, kind: 'house', capacity: 5}, {host, now});
  assert.equal(house.venue, 'home:4');
  assert.match(cleanSpec({...base, kind: 'house', capacity: 20}, {host, now}).error, /Capacity/, 'house capacity follows the home visitor limit');
});

test('event visibility and eligibility', () => {
  const now = Date.now(), host = player(5), friend = player(6), stranger = player(7), veteran = player(8);
  friend.state.friends[5] = {accepted: true}; veteran.state.flags.bornAt = now - 30 * 86400000; veteran.state.created = veteran.state.flags.bornAt;
  const e = {host_acct: 5, status: 'scheduled', visibility: 'friends', invited: [7], eligibility: {}};
  assert.equal(visibleTo(e, friend), true); assert.equal(visibleTo(e, stranger), false); assert.equal(visibleTo(e, host), true);
  assert.equal(visibleTo({...e, visibility: 'invite'}, stranger), true); assert.equal(visibleTo({...e, visibility: 'invite'}, friend), false);
  assert.equal(visibleTo({...e, visibility: 'public', status: 'suspended'}, stranger), false);
  stranger.state.flags.bornAt = now;
  assert.match(eligibility({eligibility: {newcomers: true}}, veteran, now), /first week/); assert.equal(eligibility({eligibility: {newcomers: true}}, stranger, now), null);
  stranger.state.flags.blocked = [5]; assert.match(eligibility({host_acct: 5, eligibility: {}}, stranger, now), /blocked/);
});
