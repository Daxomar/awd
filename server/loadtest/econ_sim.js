// Economy simulation: drive the real rules engine with a fake clock.
// "grinder" = online 12 h/day, always doing the best-paying gig available (teleports, so travel is free: worst case).
// "casual"  = online ~1.5 h/day: one job shift + a couple of gigs + meals.
import * as G from '../src/game/rules.js';
import * as D from '../src/game/data.js';
const shard = { policy: null, grid: { move() {} } };
function mk(origin) {
  const s = G.newState({ u: 'sim' }); s.onboarded = true; s.origin = origin; s.traits = ['hustler', 'techguru']; s.dream = 'bigman'; s.home = 'nima'; s.cash = 200; s.momo = 600; s.food = 0;
  s.rentPaidUntil = 0; s.lastWeekly = 0; return { id: 1, x: 0, z: 0, state: s };
}
let now = Date.UTC(2026, 9, 12, 6, 0); // Monday 06:00 Accra
const step = (p, ms) => { const end = now + ms; while (now < end) { now += 1000 * 20; G.tick(p, now, shard); } };
const at = (p, id) => { const L = G.LOC[id]; p.x = L.x; p.z = L.z; p.state.place = id; };
const SPEND = {}; const track = (k, before, s) => { const d = before - (s.cash + s.momo); if (d > 0) SPEND[k] = (SPEND[k] || 0) + d; };
function act(p, loc, id) { const b0 = p.state.cash + p.state.momo; try { return act0(p, loc, id); } finally { track(loc + '/' + id, b0, p.state); } }
function act0(p, loc, id) { at(p, loc); const r = G.onMsg(p, { t: 'act', loc, id }, shard, now); if (!r || r.t !== 'busy') { if (globalThis.DBG && r) DBG.add(r.m || r.t); return false; } step(p, r.busy.end - now + 1000); return true; }
const home = (p, id) => { const hp = G.HOME_POS[p.state.home || 'nima']; p.x = hp.x; p.z = hp.z; p.state.place = 'home'; const r = G.onMsg(p, { t: 'act', home: true, id }, shard, now); if (r && r.busy) { step(p, r.busy.end - now + 1000); return true; } return false; };
const eat = (p) => { if (p.state.n.hunger < 55) act(p, 'kenkey', 'kenkey') || act(p, 'chopbar', 'redred') || act(p, 'muni', 'waakyeSmall') || act(p, 'korlebu', 'hospfood'); };
const care = (p) => { const n = p.state.n; eat(p);
  if (p.state.sick) act(p, p.state.sick.level === 'serious' && p.state.cash + p.state.momo >= 500 ? 'ridge' : 'korlebu', p.state.sick.level === 'serious' ? (p.state.cash + p.state.momo < 500 ? 'nhis' : 'treatment') : 'checkup2');
  if (n.hygiene < 40) home(p, 'bath'); if (n.bladder < 35) home(p, 'toilet');
  if (n.fun < 35) act(p, 'oxford', 'stroll'); if (n.social < 35) act(p, 'muni', 'gistMuni') || act(p, 'circle', 'preacher'); };
const gigs = [];
for (const [lid, l] of Object.entries(D.LOCATIONS)) for (const a of l.acts) if (a.earn && a.tags.includes('gig') && !a.req) gigs.push([lid, a.id, a]);
function run(kind, days) {
  const p = mk('susu'); const s = p.state; const start = s.cash + s.momo; const log = [];
  for (let d = 0; d < days; d++) {
    const day0 = now, earned0 = s.stats.earned, worth0 = s.cash + s.momo;
    // job shift (apply to trotro on day 0)
    if (!s.job) { at(p, 'circle'); G.onMsg(p, { t: 'apply', id: 'trotro' }, shard, now); }
    step(p, 2 * 3600000); // 08:00
    at(p, 'circle'); const sh = G.onMsg(p, { t: 'work', op: 'start' }, shard, now); if (sh && sh.t === 'shift') step(p, 3600000 + 30000);
    care(p); const hours = kind === 'grinder' ? 11 : 0.6; if (s.shift === null && s.job) {} const until = now + hours * 3600000;
    while (now < until) {
      care(p); if (s.n.energy < 25) { const hp = G.HOME_POS.nima; p.x = hp.x; p.z = hp.z; p.state.place = 'home'; const r = G.onMsg(p, { t: 'act', home: true, id: 'nap' }, shard, now); if (r && r.busy) step(p, r.busy.end - now + 1000); }
      let did = false; for (const [lid, id] of gigs.sort(() => Math.random() - 0.5)) { if (act(p, lid, id)) { did = true; break; } }
      if (!did) step(p, 5 * 60000);
    }
    eat(p); const hp = G.HOME_POS.nima; p.x = hp.x; p.z = hp.z; p.state.place = 'home'; const sl = G.onMsg(p, { t: 'act', home: true, id: 'sleep' }, shard, now); if (sl && sl.busy) step(p, sl.busy.end - now + 1000);
    { const b0 = s.cash + s.momo; if (kind === 'casual') { now = day0 + 86400000; G.onJoin(p, now); } else step(p, Math.max(0, day0 + 86400000 - now)); track('overnight(rent/tax/data/hospital)', b0, s); }
    if (globalThis.DBG) { console.log('day', d + 1, [...DBG].slice(0, 6), 'busy', JSON.stringify(s.busy), 'n', JSON.stringify(s.n), 'sick', JSON.stringify(s.sick), 'home', s.home, 'jail', s.flags.jailUntil > now); DBG.clear(); }
    log.push([d + 1, Math.round(s.stats.earned - earned0), Math.round(s.cash + s.momo - worth0), Math.round(s.cash + s.momo)]);
  }
  console.log('SPEND', JSON.stringify(Object.fromEntries(Object.entries(SPEND).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v)])))); for (const k in SPEND) delete SPEND[k];
  console.log(`\n== ${kind} ==  day | earned | net change | balance`); for (const l of log) console.log(l.join('\t'));
  console.log('job', s.job && D.CAREERS[s.job.id].ranks[s.job.rank][0], 'perf', Math.round(s.job?.perf), 'skills', JSON.stringify(Object.fromEntries(Object.entries(s.skills).filter(([, v]) => v >= 1).map(([k, v]) => [k, +v.toFixed(1)]))));
}
run('casual', +process.argv[2] || 21); now = Date.UTC(2026, 9, 12, 6, 0); run('grinder', +process.argv[2] || 21);
