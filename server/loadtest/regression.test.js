import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game/rules.js';
import { Shard } from '../src/shard.js';
import { pool } from '../src/db.js';
import { cleanLook } from '../src/game/wardrobe.js';
import { checkSend } from '../src/social.js';
import { VENUES } from '../../client/src/v2/scene/venues.js';
import { streetSpec,extraVenue } from '../../client/src/v2/scene/neighbourhood.js';
import { homeSpec } from '../../client/src/v2/scene/homes.js';

const cat = Game.catalog();
function player(id = 1) { const p = { id, acct: id, name: `player${id}`, state: Game.newState({ id, u: `player${id}` }), x: 0, z: 0, chatAt: 0, chatBurst: 0, bot: true }; Game.onMsg(p, { t: 'onboard', traits: ['hustler', 'detty'], home: cat.origins[p.state.birthOrigin].homes[0], look: { top: 'jersey' } }, { policy: null }, Date.now()); return p; }

test('all public venues and neighbourhoods expose valid, reachable activity zones', () => {
  let actions = 0;
  for (const loc of cat.locs) {
    const spec = loc.neighbourhood||loc.estate?streetSpec(loc.area,!!loc.estate):extraVenue(loc.id)||VENUES[loc.id]; assert.ok(spec, `${loc.id}: layout exists`);
    const exposed = new Set();
    for (const z of spec.zones) { assert.ok(spec.items[z.item], `${loc.id}/${z.id}: physical anchor`); for (const id of z.acts) { assert.ok(loc.acts.some(a => a.id === id), `${loc.id}: unknown activity ${id}`); exposed.add(id); } }
    for (const a of loc.acts) { assert.ok(exposed.has(a.id), `${loc.id}: missing activity ${a.id}`); actions++; }
  }
  assert.ok(actions > 100);
});
test('every home tier exposes owned furniture actions', () => {
  const items = Object.fromEntries(Object.keys(cat.items).map(k => [k, true]));
  for (const home of Object.keys(cat.homes)) {
    const spec = homeSpec(home, items); assert.ok(spec.zones.length >= 6);
    for (const z of spec.zones) { assert.ok(spec.items[z.item]); for (const id of z.acts) assert.ok(cat.homeActs.some(a => a.id === id), `${home}/${id}`); }
  }
});
test('the background roll leaves new players free to choose careers without debt or plot', () => {
  const p = player(); assert.equal(p.state.onboarded, true); assert.equal(p.state.dream, null); assert.ok(cat.origins[p.state.birthOrigin].homes.includes(p.state.home)); assert.equal(p.state.loan, null); assert.equal(p.state.cash + p.state.momo, cat.origins[p.state.birthOrigin].cash + cat.origins[p.state.birthOrigin].momo);
  for (let hour = 1; hour <= 48; hour++) { for (const k in p.state.n) p.state.n[k] = 90; const out = Game.tick(p, Date.now() + hour * 3600000, { policy: null }); const list = out?.t === 'multi' ? out.list : [out]; assert.ok(list.every(m => !['msg', 'missions', 'streak'].includes(m?.t))); }
  assert.deepEqual(p.state.story.inbox, []); assert.deepEqual(p.state.daily.list, []);
});
test('old narrative obligations are retired without deleting possessions', () => {
  const p = player(); p.state.story.inbox = [{ id: 'mum_hello', ans: null }]; p.state.story.goals = [{ id: 'late', until: 0 }]; p.state.items.tv = true;
  const next = Game.migrate(p.state, { u: p.name }); assert.deepEqual(next.story.inbox, []); assert.deepEqual(next.story.goals, []); assert.equal(next.items.tv, true); assert.equal(next.momo, p.state.momo);
  p.state = next; const before = next.cash + next.momo; Game.onMsg(p, { t: 'reply', id: 'mum_hello', i: 0 }, {}, Date.now()); assert.equal(next.cash + next.momo, before);
});
test('both 2026 kits are free and validated for both body types', () => {
  for (const body of ['m', 'f']) for (const top of ['jersey', 'jerseyaway']) { const look = cleanLook({ body, top }); assert.equal(look.top, top); assert.equal(cat.wear[top].price, 0); }
  assert.match(cat.transport.bolu.name, /^Bolt\b/);
});

function chatShard() {
  const s = Object.create(Shard.prototype); s.players = new Map(); s.stats = { outBytes: 0 }; s.bus = { messages: [], publish(ch, m) { this.messages.push([ch, m]); } };
  s.send = (p, m) => p.received.push(m);
  for (let i = 1; i <= 3; i++) { const p = player(i); p.received = []; p.state.onboarded = true; s.players.set(i, p); }
  const room = { members: new Set([s.players.get(1), s.players.get(2)]) }; for (const p of room.members) p.room = room;
  return s;
}
test('City chat reaches different homes and acknowledges delivery', () => {
  const s = chatShard(), a = s.players.get(1); s.chat(a, { ch: 'city', text: 'Meet at Circle', clientId: 'one' });
  for (const p of s.players.values()) assert.ok(p.received.some(m => m.t === 'chat' && m.m === 'Meet at Circle'));
  assert.ok(a.received.some(m => m.t === 'chat_ack' && m.ok && m.clientId === 'one')); assert.equal(s.bus.messages.length, 1);
});
test('Nearby chat stays in its room; travel fails explicitly', () => {
  const s = chatShard(); s.chat(s.players.get(1), { text: 'Hello here' }); assert.equal(s.players.get(2).received[0].ch, 'room'); assert.equal(s.players.get(3).received.length, 0);
  const a = s.players.get(3); s.chat(a, { ch: 'room', text: 'Anybody?', clientId: 'travel' }); assert.ok(a.received.some(m => m.t === 'chat_ack' && !m.ok));
});
test('blocked senders are excluded on local and cross-shard City delivery', () => {
  const s = chatShard(), b = s.players.get(2); b.state.flags.blocked = [1]; s.chat(s.players.get(1), { ch: 'city', text: 'hello' }); assert.equal(b.received.length, 0);
  s.fromBus('awd:city', { t: 'chat', acct: 1, ch: 'city', m: 'remote', id: 9 }); assert.equal(b.received.length, 0); assert.ok(s.players.get(3).received.some(m => m.m === 'remote'));
});
test('minigames and regular activities return a result for every catalog action', () => {
  let count = 0;
  for (const loc of cat.locs) for (const a of loc.acts) {
    const p = player(); p.state.cash = 1e6; p.state.momo = 1e6; p.state.food = 20; p.state.skills = Object.fromEntries(Object.keys(p.state.skills).map(k => [k, 10])); p.state.items = Object.fromEntries(Object.keys(cat.items).map(k => [k, true])); Game.goPlace(p, loc.id);
    const response = Game.onMsg(p, { t: 'act', loc: loc.id, id: a.id }, { policy: null }, Date.now());
    assert.ok(response && response.t, `${loc.id}/${a.id} has no response`); count++;
  }
  assert.ok(count > 100);
});


test('body dimensions validate, persist through outfit changes and reject invalid values', () => {
  for (const body of ['m', 'f']) {
    const look = cleanLook({body, build:.8, hips:.7, bust:1, height:.3, top:'jerseyaway'});
    assert.deepEqual([look.build,look.hips,look.bust,look.height],[.8,.7,1,.3]);
    assert.deepEqual(cleanLook({...look,top:'tee'}).bust,1);
    const bad = cleanLook({body,build:99,hips:-5,bust:NaN,height:'bad'});
    assert.deepEqual([bad.build,bad.hips,bad.bust,bad.height],[1,0,.45,.5]);
  }
});


test('cross-shard private delivery checks the recipient live block and friends-only settings', () => {
  const s=Object.create(Shard.prototype), p=player(20), received=[];
  s.byAcct=(id)=>id===20?p:null; s.send=(o,m)=>received.push(m);
  const msg={acct:20,m:{t:'dm_in',from:'sender',fromAcct:30,m:{text:'Hello'}}};
  p.state.flags.blocked=[30]; s.fromBus('awd:dm',msg); assert.equal(received.length,0);
  p.state.flags.blocked=[];p.state.flags.dmFriends=true;s.fromBus('awd:dm',msg);assert.equal(received.length,0);
  p.state.friends[30]={pts:30,n:'sender'};s.fromBus('awd:dm',msg);assert.equal(received.length,1);
});

test('aspirations can be changed or paused without replaying completed milestones', () => {
  const p = player(); const ids = Object.keys(cat.dreamTiers);
  p.state.dream = ids[0]; p.state.dreamTier = 2;
  Game.onMsg(p, {t:'pickdream',id:ids[1]}, {}, Date.now());
  assert.equal(p.state.dream, ids[1]); assert.equal(p.state.dreamTier, 0);
  Game.onMsg(p, {t:'pickdream',id:ids[0]}, {}, Date.now());
  assert.equal(p.state.dreamTier, 2);
  Game.onMsg(p, {t:'pickdream',id:'none'}, {}, Date.now());
  assert.equal(p.state.dream, null);
  Game.onMsg(p, {t:'pickdream',id:ids[0]}, {}, Date.now());
  assert.equal(p.state.dreamTier, 2);
  const restored=Game.migrate(p.state,{id:p.acct,u:p.name});
  assert.equal(restored.dreamProgress[ids[0]], 2);
});
test('legacy backgrounds and default account names survive migration and onboarding', () => {
  const p = player(); const old={...p.state,origin:'nepo'}; delete old.birthOrigin;
  assert.equal(Game.migrate(old,{id:99,u:'player99'}).birthOrigin,'dbee');
  const named={id:99,acct:99,name:'qa12345678',state:Game.newState({id:99,u:'qa12345678'})};
  const result=Game.onMsg(named,{t:'onboard',name:named.name,traits:['hustler','detty'],home:cat.origins[named.state.birthOrigin].homes[0]}, {}, Date.now());
  assert.equal(result.t,'onboarded'); assert.equal(named.state.name,named.name);
});


test('failed persistence leaves live state dirty for a later retry', async () => {
  const p=player();p.bot=false;p.dirty=true;const shard=Object.create(Shard.prototype);
  shard.players=new Map([[p.id,p]]);shard.byAcctMap=new Map([[p.acct,p]]);
  const query=pool.query;pool.query=async()=>{throw Error('database offline');};
  try { await assert.rejects(shard.flush(),/database offline/);assert.equal(p.dirty,true); }
  finally { pool.query=query; }
});

test('sending MoMo money succeeds for onboarded players without arbitrary hour locks and supports cash auto-deposit', () => {
  const p = player();
  p.state.momo = 50;
  p.state.cash = 200;
  p.state.onboarded = true;
  // newly created account
  p.state.flags.bornAt = Date.now();
  const chk = checkSend(p, 100, Date.now());
  assert.equal(typeof chk, 'object');
  assert.equal(chk.a, 100);
  assert.equal(chk.fee, 1);
  assert.equal(p.state.momo, 101); // 51 cash auto-deposited into MoMo (50 + 51 = 101)
  assert.equal(p.state.cash, 149); // 200 - 51 = 149
});

