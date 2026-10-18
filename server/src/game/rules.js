// Server-authoritative life simulation. Every cedi and every need change happens here, never on the client.
import { cleanText } from '../filter.js';
import { createHmac } from 'node:crypto';
import { CFG } from '../config.js';
import * as D from './data.js';
import * as ST from './story.js';
import * as W from './wardrobe.js';
import { onboardingDraft, transitionOnboarding } from './onboarding.js';
import { matchBoard, validateBet, makeBet, settleBets } from './matches.js';
import { enterLocal, updateStreetReturn } from '../street-world.js';
import { discoverable } from './discovery.js';
import {WORKPLACES} from '../../../shared/workplaces.js';
import {taskView,beginTask,tickTask} from './work-tasks.js';
import * as Life from './life-progression.js';
import * as Career from './careers.js';
import * as Profile from './profile.js';
import * as HomeAccess from './home-access.js';
import * as LE from './life-events.js';
import {flag} from '../admin/flags.js';
export const WARD = W;
export const DATA = D;

// ---------- geography (same projection as tools/buildmap.py) ----------
const LAT0 = 5.556, LON0 = -0.2, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574;
export const proj = ([lat, lon]) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
export const LOC = {}; for (const [id, l] of Object.entries(D.LOCATIONS)) { const [x, z] = proj(l.ll); LOC[id] = { ...l, id, x, z }; }
export const HOME_POS = {}; for (const [id, h] of Object.entries(D.HOMES)) { const [x, z] = proj(h.ll); HOME_POS[id] = { x, z }; }
const NEAR = 45; // metres: you must physically be at a place to use it
const near = (p, x, z, r = NEAR) => (p.x - x) ** 2 + (p.z - z) ** 2 <= r * r;
// v2 place model: a player is always "in" one place (a location id, 'home', 'visit:<acct>') or on the road (null).
// Position (p.x/p.z) is kept in sync for distance-based fares.
export function goPlace(p, place, pos, from) {
  const s = p.state; s.place = place;
  const P = pos || (place === 'home' ? HOME_POS[s.home] : LOC[place]); if (P) { p.x = P.x; p.z = P.z; }
  enterLocal(s,from);
  if(s.onboarded&&(LOC[place]||place==='home')){
    s.discovery||={visited:{}};s.discovery.visited||={};
    if(place==='home'&&Object.keys(s.discovery.visited).some(id=>LOC[id]&&!LOC[id].estate))s.discovery.returned=true;
    if(LOC[place]&&!LOC[place].estate)s.discovery.visited[place]=true;
  }
}
export const placeName = (s, place) => (place === 'home' ? (s.home ? D.HOMES[s.home].name : 'Home') : LOC[place] ? LOC[place].name : '');
const at = (p, id) => p.state.place === id;

// ---------- Accra time (GMT, no DST) ----------
export const clock = (now = Date.now()) => { const d = new Date(now); return { h: d.getUTCHours() + d.getUTCMinutes() / 60, wd: d.getUTCDay(), day: Math.floor(now / 86400000) }; };
const inWindow = (h, [a, b]) => (b > 24 ? h >= a || h < b - 24 : h >= a && h < b);
export function isOpen(loc, now = Date.now()) {
  return true; // 24/7 Accra life: venues are open at any time
}
export function dumsorNow(now = Date.now(), policy) { const { h, wd } = clock(now); const w = D.DUMSOR[wd]; if (!w) return false; if (policy === 'light' && h >= w[0] + 1.5) return false; return h >= w[0] && h < w[1]; }
// real seconds an action takes (Sims-style compression, as fast as Lagos Life's feel)
export const realSecs = (min, sleep) => (sleep ? Math.min(36, 10 + 0.055 * min) : Math.min(28, 4 + 0.11 * min));

// ---------- state ----------
// bring any saved state (older schema, partial, corrupted) up to the current shape
export function migrate(saved, acct) {
  const base = newState(acct); if (!saved || typeof saved !== 'object') return base;
  if ((saved.v || 1) < 2) { base.name = saved.name || base.name; return base; } // pre-sim prototype saves: fresh life
  const out = { ...base, ...saved };
  out.birthOrigin = saved.birthOrigin || ({nepo: 'dbee', susu: 'hustler', lapo: 'hustler', dbee: 'dbee', hustler: 'hustler'}[saved.origin]) || birthOrigin(acct.id);
  if (out.origin === 'nepo') out.origin = 'dbee';
  if (out.origin === 'susu' || out.origin === 'lapo') out.origin = 'hustler';
  for (const k of ['n', 'skills', 'stats', 'wk', 'flags', 'owned', 'items', 'biz', 'land', 'gigRest', 'rel', 'cnt', 'dc', 'story', 'daily', 'dreamProgress']) out[k] = { ...base[k], ...(saved[k] && typeof saved[k] === 'object' ? saved[k] : {}) };
  delete out.flags.daddyPays;
  for (const k of ['traits', 'moodlets', 'ledger', 'dreamsDone']) if (!Array.isArray(out[k])) out[k] = [];
  for (const k of ['inbox', 'goals']) if (!Array.isArray(out.story[k])) out.story[k] = []; out.story = { seen: {}, inbox: [], goals: [], at: 0 }; out.daily = { day: -1, list: [], streak: 0, lastFull: -1 };
  if (!Array.isArray(out.daily.list)) out.daily.list = []; if (!Array.isArray(out.dc.visits)) out.dc.visits = [];
  for (const k in out.n) if (!Number.isFinite(out.n[k])) out.n[k] = base.n[k];
  if (!Number.isFinite(out.cash)) out.cash = 0; if (!Number.isFinite(out.momo)) out.momo = 0;
  if (out.home && !D.HOMES[out.home]) out.home = 'nima'; if (out.job && !D.CAREERS[out.job.id]) out.job = null;
  if (out.busy && out.busy.loc && out.busy.loc !== 'home' && !LOC[out.busy.loc]) out.busy = null;
  if (!out.wardrobe || typeof out.wardrobe !== 'object') out.wardrobe = {};
  out.wardrobe.jersey = true; out.wardrobe.jerseyaway = true;
  if (!Array.isArray(out.phones)) out.phones = [];
  if (out.look && !W.WEAR[out.look.top]) out.look = W.cleanLook({ body: out.look.body, skin: out.look.skinTone }, {});
  // Unit syntax preserves only a candidate; SQL admission must authorize it.
  const pendingTrip=out.place===null&&out.busy?.travel&&Number.isFinite(out.busy.end)&&Number.isFinite(out.busy.travel.x)&&Number.isFinite(out.busy.travel.z);
  if (out.place !== 'home' && !LOC[out.place] && !/^unit:awd-[a-z]+-(?:commercial-)?\d{2}$/.test(out.place||'') && !pendingTrip) out.place = out.home ? 'home' : 'circle';
  if (out.place === 'home' && !out.home) out.place = 'circle';
  if (!out.friends || typeof out.friends !== 'object') out.friends = {};
  if(!out.onboarded)out.onboarding=onboardingDraft(out);
  return out;
}
export function newState(acct) {
  return { v: 2, name: acct.u, birthOrigin: birthOrigin(acct.id), created: Date.now(), onboarded: false, look: null, wardrobe: {}, phones: [], cash: 0, momo: 0,
    n: { hunger: 80, energy: 85, fun: 70, social: 60, hygiene: 75, bladder: 70 }, needsAt: Date.now(),
    skills: Object.fromEntries(Object.keys(D.SKILLS).map((k) => [k, 0])), traits: [], dream: null, origin: null,
    home: null, rentPaidUntil: 0, arrears: 0, owned: {}, items: {}, food: 0, fuel: 0, car: null,
    job: null, busy: null, shift: null, biz: {}, land: {}, loan: null, gigRest: {}, moodlets: [], sick: null, neglect: 0,
    rep: 0, xp: 0, stats: { earned: 0, shifts: 0, meals: 0, gigs: 0, promos: 0 }, wk: { inc: 0 }, ledger: [], flags: {}, lastWeekly: 0, lastDaily: 0, lastRent: 0, pos: null,
    place: null, friends: {}, rel: {}, cnt: {}, dc: { day: -1, cnt: {}, visits: [] }, story: { seen: {}, inbox: [], goals: [], at: 0 }, dreamTier: 0, dreamProgress: {}, dreamsDone: [], daily: { day: -1, list: [], streak: 0, lastFull: -1 } };
}
export const netWorth = (s) => Math.round((s.cash || 0) + (s.momo || 0) + (s.flags?.fixed?.amount || 0) + (s.life?.businessAssets||0) - (s.loan ? s.loan.owed : 0) + Object.keys(s.biz).reduce((a, k) => a + D.BUSINESSES[k].price * 0.6, 0) + Object.values(s.land).reduce((a, l) => a + l.value, 0) + (s.car ? D.CARS[s.car].price * 0.7 : 0) + Object.keys(s.owned).reduce((a, k) => a + (D.HOMES[k].buy || 0) * 0.85, 0));
export const me = (s, now, policy) => ({ t: 'me', heat: Math.round(s.heat || 0), n: Object.fromEntries(Object.entries(s.n).map(([k, v]) => [k, Math.round(v)])), cash: s.cash, momo: s.momo, mood: mood(s), busy: s.busy, shift: s.shift && { start: s.shift.start, worked: Math.round(s.shift.worked * 10) / 10, wins: s.shift.wins,tasks:s.shift.tasks,assignment:taskView(s) }, job: s.job, sick: s.sick, food: s.food, home: s.home, rep: s.rep, xp: s.xp, moodlets: s.moodlets.map((m) => [m.label, m.v]), dumsor: dumsorNow(now, policy), jail: s.flags.jailUntil > now ? s.flags.jailUntil : 0 });
export function catalog() {
  const strip = (a) => { const fx = {}; const hrs = (a.min || 10) / 60; for (const k in a.needs || {}) fx[k] = Math.round(a.needs[k] * hrs); for (const k in a.inst || {}) if (k !== 'food') fx[k] = (fx[k] || 0) + a.inst[k]; if (a.sleep) fx.energy = a.restore || 100;
    return { id: a.id, label: a.label, ic: a.ic, min: a.min, cost: a.cost, earn: a.earn ? [a.earn.base, a.earn.per || 0, a.earn.skill || null] : null, mg: a.mg, crime: a.crime ? Math.round(a.crime.catch * 100) : 0, crimeSkill:a.crime?.skill, open: a.open, days: a.days, req: a.req, tags: a.tags, opens: a.opens, sleep: a.sleep, rest: a.rest, fx, skill: a.skill ? Object.keys(a.skill) : null, food: a.inst && a.inst.food, rep: a.rep, cures: a.cures }; };
  return { locs: Object.values(LOC).map((l) => ({ id: l.id, name: l.name, area: l.area, neighbourhood:l.neighbourhood, estate:l.estate, ic: l.ic, x: Math.round(l.x), z: Math.round(l.z), open: l.open, days: l.days, blurb: l.blurb,discovery:discoverable(l), acts: l.acts.map(strip) })),
    homes: Object.fromEntries(Object.entries(D.HOMES).map(([k, h]) => [k, { ...h, x: Math.round(HOME_POS[k].x), z: Math.round(HOME_POS[k].z) }])), homeActs: Object.values(HOME_ACTS).map(strip),
    careers: Object.fromEntries(Object.entries(D.CAREERS).map(([id,{mg,...c}])=>[id,{...c,workplace:{x:WORKPLACES[id].x,z:WORKPLACES[id].z,label:WORKPLACES[id].label}}])),
    courses: Object.fromEntries(Object.values(Career.COURSES).map(c=>[c.id,Career.publicCourse(c)])), careerReqs: Career.CAREER_REQS, autowork: Career.AUTO, session: Career.SESSION, transport: D.TRANSPORT, rush: D.RUSH, cars: D.CARS, traits: D.TRAITS, dreams: D.DREAMS, origins: D.ORIGINS, skills: D.SKILLS, items: ITEMS, biz: D.BUSINESSES, lands: D.LANDS, repTitles: REP_TITLES, promoSkill: D.PROMO_SKILL, promoShifts: D.PROMO_SHIFTS,
    allDreams: { ...D.DREAMS, ...ST.DREAM_INFO }, dreamTiers: Object.fromEntries(Object.entries(ST.DREAM_TIERS).map(([k, t]) => [k, t.map((x) => x[0])])), tierReward: ST.TIER_REWARD, contacts: ST.CONTACTS,
    storyArcs: ST.STORY_ARCS, storyMissions: ST.STORY_MISSIONS,
    missions: Object.fromEntries(ST.MISSIONS.map((m) => [m.id, m.label])), missionReward: ST.MISSION_REWARD, streakBonus: ST.STREAK_BONUS, wear: W.WEAR, uniform: W.UNIFORM, skinTones: W.SKIN, hairColors: W.HAIR_COLORS, defaultLook: W.DEFAULT_LOOK };
}
export const view = (s) => ({
  ...s,
  phones: (s.phones || []).map(({ fake, ...r }) => r),
  ledger: s.ledger.slice(-20),
  cnt: undefined,
  story: {
    dream: s.dream,
    chapter: s.story?.chapter || 1,
    step: s.story?.step || 1,
    missionId: s.story?.missionId || null,
    completedMissions: s.story?.completedMissions || [],
    completedChapters: s.story?.completedChapters || [],
    completedEncounters: s.story?.completedEncounters || [],
    activeMission: ST.activeStoryMission(s, { at: s.place, place: s.place, now: Date.now() }),
    inbox: (s.story?.inbox || []).slice(-30),
    goals: (s.story?.goals || []).map(({ id, label, until, from }) => ({ id, label, until, from }))
  }
});
export const publicStatus = (p) => (p.state.busy ? p.state.busy.ic : p.state.shift ? 'icon:briefcase' : '');
const lvl = (s, k) => Math.floor(s.skills[k] || 0);
const has = (s, t) => s.traits.includes(t);
const toast = (m, k = '') => ({ t: 'toast', m, k });

// ---------- needs ----------
function decayRate(s, k, h) {
  let r = D.NEEDS[k].decay; for (const t of s.traits) { const d = D.TRAITS[t].decay; if (d && d[k]) r *= d[k]; }
  if (k === 'energy' && has(s, 'nightcrawler') && (h >= 20 || h < 4)) r *= 0.6;
  if (s.sick && (k === 'energy' || k === 'fun')) r *= s.sick.level === 'serious' ? 1.6 : 1.25;
  return r;
}
export function decay(s, now) {
  const hrs = Math.min(12, Math.max(0, (now - (s.needsAt || now)) / 3600000)); s.needsAt = now; if (!hrs) return;
  const { h } = clock(now);
  for (const k in D.NEEDS) if (!(s.busy && s.busy.sleep && k === 'energy')) s.n[k] = clamp(s.n[k] - decayRate(s, k, h) * hrs);
}
export function needsEmergency(s,now){const hrs=Math.min(12,Math.max(0,(now-(s.needsAt||now))/3600000));return ['hunger','energy'].some(k=>!(s.busy?.sleep&&k==='energy')&&s.n[k]-decayRate(s,k,clock(now).h)*hrs<=0);}
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
export function mood(s) { const v = Object.values(s.n); let m = (v.reduce((a, b) => a + b, 0) / v.length - 50) * 1.2; for (const ml of s.moodlets) m += ml.v; return clamp(Math.round(m), -100, 100); }
function moodlet(s, id, v, hours, label) { s.moodlets = s.moodlets.filter((m) => m.id !== id); s.moodlets.push({ id, v, until: Date.now() + hours * 3600000, label }); }

// ---------- money ----------
function pay(s, amt, why = 'Payment') { amt = Math.round(amt); if (!Number.isSafeInteger(amt)||amt<0||s.cash + s.momo < amt) return false; const c = Math.min(s.cash, amt); s.cash -= c; s.momo -= amt - c; if (amt > 0) { s.ledger.push([Date.now(), -amt, why]);Life.moneyEvent(s,-amt,why); if (s.ledger.length > 60) s.ledger.shift(); } return true; }
function earn(s, amt, why, toMomo = true) { amt = Math.round(amt); if (!Number.isSafeInteger(amt)||amt <= 0) return 0; if (toMomo) s.momo += amt; else s.cash += amt; s.stats.earned += amt; s.wk.inc += amt; s.ledger.push([Date.now(), amt, why]);Life.moneyEvent(s,amt,why); if (s.ledger.length > 60) s.ledger.shift(); return amt; }
export const earnFor = (s, amt, why) => earn(s, amt, why);
export const spendFor = (s, amt, why) => pay(s, amt, why);
// spending that shows up in the MoMo history
function spend(s, amt, why) { amt = Math.min(s.cash+s.momo,Math.round(amt)); if (!Number.isFinite(amt)||amt <= 0) return 0; pay(s,amt,why);return amt; }
// Street hustles don't scale forever: the same gig pays less each time in an Accra day (loads run out, customers saturate),
// total gig income above a skill-based daily ceiling is heavily discounted, and many players working the same gig
// in the same hour share the demand.
export const CUR = { shard: null };
// skill pace: ~level 3 after a week of focused practice, ~6 after a month, 10 is a months-long mastery goal
const SKILL_RATE = 0.16;
// A body can only work so much in a day: gigs + job share a 12 game-hour budget per Accra day (a shift = 8 h).
export const WORK_DAY = 720;
const workDay = (s, now) => { const day = clock(now).day; if (!s.gd || s.gd.day !== day) s.gd = { day, n: {}, earned: 0, mins: 0 }; s.gd.mins ||= 0; return s.gd; };
function hustleMult(s, id, now, skill) {
  workDay(s, now);
  const n = s.gd.n[id] || 0; s.gd.n[id] = n + 1; let m = Math.pow(0.62, n);
  const cap = 140 + 35 * lvl(s, skill || 'hustle'); if (s.gd.earned > cap) m *= 0.3;
  const sh = CUR.shard; if (sh) { sh.demand ||= new Map(); const k = id + ':' + Math.floor(now / 3600000); const c = (sh.demand.get(k) || 0) + 1; sh.demand.set(k, c); if (sh.demand.size > 4000) sh.demand.clear(); m *= Math.max(0.4, 1 - Math.max(0, c - 25) / 100); }
  return m;
}
function addSkill(s, k, amt) { if (!k || !(k in s.skills)) return 0; let m = 1; for (const t of s.traits) { const sk = D.TRAITS[t].skill; if (sk && sk[k]) m *= sk[k]; } const before = Math.floor(s.skills[k]); m *= SKILL_RATE / (1 + s.skills[k] * 0.32); s.skills[k] = Math.min(10, s.skills[k] + amt * m); return Math.floor(s.skills[k]) > before ? Math.floor(s.skills[k]) : 0; }
export const gainSkill=(s,k,amt)=>addSkill(s,k,amt);
function addXp(s, n) { s.xp += n; while (s.xp >= 100 + s.rep * 60) { s.xp -= 100 + s.rep * 60; s.rep++; } }
export const awardXp=(s,n)=>addXp(s,n);
export const REP_TITLES = [[0, 'New to Accra'], [3, 'Correct Person'], [5, 'Area Boy/Girl'], [8, 'Street Sharp'], [12, 'Hustler'], [16, 'Big Boy/Girl'], [20, 'Area Champion'], [25, 'Chairman'], [30, 'Big Man of Accra'], [40, 'Accra Legend']];

// ---------- onboarding (origin decided server-side, once per account) ----------
function onboard(p, m) {
  const s = p.state; if (s.onboarded) return toast('Already living in Accra.');
  const traits = [...new Set((Array.isArray(m.traits) ? m.traits : []).filter((t) => typeof t==='string'&&Object.hasOwn(D.TRAITS,t)))].slice(0, 2); if (traits.length !== 2) return toast('Pick exactly 2 traits.', 'bad');
  if (m.dream && !D.DREAMS[m.dream] && !ST.STORY_ARCS[m.dream]) return toast('Choose a valid aspiration.', 'bad');
  const origin = s.birthOrigin || birthOrigin(p.acct);
  const start = D.ORIGINS[origin];
  if (!start.homes.includes(m.home)) return toast('Choose one of the homes available for your background.', 'bad');
  const defaultName = p.name || s.name; s.name = (!m.name || m.name === defaultName) ? defaultName : (cleanText(m.name, 16).slice(0, 16) || defaultName); s.traits = traits; s.dream = m.dream || null; s.look = W.cleanLook(m.look || {}, {});
  if (s.dream) { ST.initStory(s, s.dream); }
  s.origin = origin; s.birthOrigin = origin; s.cash = start.cash; s.momo = start.momo;
  s.home = m.home; s.job = null; s.loan = null; delete s.flags.daddyPays;
  s.wardrobe.jersey = true; s.wardrobe.jerseyaway = true;
  s.rentPaidUntil = nextSaturday9(Date.now()+6*86400000); s.onboarded = true; s.flags.bornAt = Date.now();
  goPlace(p, 'home');
  return { t: 'onboarded', origin: s.origin, state: view(s) };
}
export function onboardingProgress(p,m,now=Date.now()) {
  const result=transitionOnboarding(p.state,m,now);
  if(result.error)return {t:'onboarding',id:m.id,ok:false,error:result.error,conflict:!!result.conflict,state:view(p.state)};
  const candidate={...p,state:result.state};
  if(result.finish){
    const done=onboard(candidate,result.finish);
    if(done.t!=='onboarded')return {t:'onboarding',id:m.id,ok:false,error:done.m,state:view(p.state)};
    candidate.state.onboarding.step='complete';candidate.state.onboarding.revision++;
  }
  p.state=candidate.state;
  return {t:'onboarding',id:m.id,ok:true,complete:!!p.state.onboarded,state:view(p.state)};
}
// Stable across reconnects and server restarts, independent of client input.
// Configure BIRTH_SEED in production to keep the roll unpredictable to clients.
export function birthOrigin(acct) {
  const roll = createHmac('sha256', CFG.birthSeed).update(String(acct)).digest().readUInt32BE(0);
  return roll / 4294967296 < .25 ? 'dbee' : 'hustler';
}
function nextSaturday9(now) { const d = new Date(now); const add = (6 - d.getUTCDay() + 7) % 7 || 7; d.setUTCDate(d.getUTCDate() + add); d.setUTCHours(9, 0, 0, 0); return d.getTime(); }

// ---------- actions ----------
function canDo(s, p, loc, a, now, residence) {
  if (s.busy) return 'You are busy.'; if (s.shift) return 'You are at work.';
  if (!s.onboarded) return 'Finish creating your Accra life first.';
  if (loc && !at(p, loc.id)) return `Go to ${loc.name} first.`;
  if (loc && !isOpen(loc, now)) return `${loc.name} is closed now.`;
  const { h, wd } = clock(now);
  if (a.tags && a.tags.includes('eat') && a.open && !inWindow(h, a.open)) return `Only ${a.open[0]}:00–${a.open[1] % 24}:00.`;
  if (a.req) { if (a.req.flag && !s.flags[a.req.flag]) return 'Not available.'; if (a.req.item && !(residence?.items||s.items)[a.req.item]) return `Needs ${a.req.item}.`; for (const k in a.req.skill || {}) if (lvl(s, k) < a.req.skill[k]) return `Needs ${D.SKILLS[k]} ${a.req.skill[k]}.`; }
  if (s.flags.jailUntil > now) return `You are in police cells for ${Math.ceil((s.flags.jailUntil - now) / 60000)} more min.`;
  if (a.pitch && (s.flags.mvp || 0) < 100) return `Your MVP is ${Math.round(s.flags.mvp || 0)}% done. Build it at the hub first.`;
  if (a.pitch && s.flags.lastPitch && now - s.flags.lastPitch < 7 * 86400000) return 'Investors take a week to reply. Pitch again next week.';
  if (a.rest && (s.gigRest[a.id] || 0) > now) return `Rest ${Math.ceil((s.gigRest[a.id] - now) / 60000)} min before doing this again.`;
  if (s.sick && s.sick.level === 'serious' && a.earn) return 'You are too sick to work. See a doctor.';
  return null;
}
function price(s, a, policy) { let c = a.cost || 0; if (policy === 'food' && a.tags && a.tags.includes('eat')) c *= 0.75; return Math.round(c); }
function startAction(p, loc, a, now, policy, residence) {
  const s = p.state; const err = canDo(s, p, loc, a, now, residence); if (err) return toast(err, 'bad');
  if (a.opens) return { t: 'open', what: a.opens, loc: loc && loc.id };
  if ((a.earn || a.mg) && a.tags && a.tags.includes('gig')) workDay(s, now).mins += a.min || 60;
  if (a.mg) { s.busy = { id: a.id, ic: a.ic, loc: loc.id, mg: a.mg, start: now, end: now + 180000 }; return { t: 'mg', id: a.mg, act: a.id }; }
  const c = price(s, a, policy); if (c && !pay(s, c, a.label)) return toast(`You need GH₵${c}.`, 'bad');
  s.busy = { id: a.id, ic: a.ic, label: a.label, loc: loc ? loc.id : 'home', start: now, end: now + realSecs(a.min || 10, a.sleep) * 1000, min: a.min || 10, sleep: !!a.sleep };
  return { t: 'busy', busy: s.busy, cost: c };
}
function finishAction(p, now) {
  const s = p.state, b = s.busy; s.busy = null;
  const a = b.loc === 'home' ? HOME_ACTS[b.id] : (LOC[b.loc].acts.find((x) => x.id === b.id) || {});
  const hrs = (a.min || 10) / 60, out = { t: 'done', id: b.id, gains: {} };
  const homeQ = b.loc === 'home' ? b.homeBenefits?.comfort ?? D.HOMES[s.home || 'nima'].comfort : 1;
  for (const k in a.needs || {}) { let d = a.needs[k] * hrs; if (d > 0) d *= homeQ; for (const t of s.traits) { const tf = D.TRAITS[t].tagFun; if (k === 'fun' && tf && a.tags) for (const tag of a.tags) if (tf[tag]) d += tf[tag]; } s.n[k] = clamp(s.n[k] + d); out.gains[k] = Math.round(d); }
  for (const k in a.inst || {}) { if (k === 'food') { s.food = Math.min(18, s.food + a.inst.food); continue; } s.n[k] = clamp(s.n[k] + a.inst[k]); out.gains[k] = (out.gains[k] || 0) + a.inst[k]; }
  for (const k in a.skill || {}) { const up = addSkill(s, k, a.skill[k] * hrs); if (up) out.levelUp = [k, up]; }
  if (a.earn) { const e = a.earn; let amt = e.base + (e.per || 0) * lvl(s, e.skill); if (e.var) amt *= 1 - e.var / 2 + Math.random() * e.var; if (has(s, 'hustler') && a.tags.includes('hustle')) amt *= 1.15; if (a.tags.includes('gig') || a.tags.includes('hustle')) { amt *= hustleMult(s, a.id, now, e.skill); s.gd.earned += amt; if (amt < (e.base || 20) * 0.5) out.tired = true; } out.earned = earn(s, amt, a.label); s.stats.gigs++; }
  if (a.rest) s.gigRest[a.id] = now + a.rest * 60000;
  if (a.crime) { const c = a.crime; s.heat = s.heat || 0; const pCatch = Math.max(.05,Math.min(0.92, c.catch + s.heat / 250 - lvl(s, c.skill) * 0.03)); out.crimeRisk=pCatch;s.heat = Math.min(200, s.heat + 30);
    if (Math.random() > pCatch) { if (c.loot) out.earned = earn(s, (c.loot[0] + Math.random() * (c.loot[1] - c.loot[0])) * (a.sakawa && s.flags.juju ? 1.8 : 1) * (a.sakawa ? Math.max(0.3, 1 - (s.cnt['act:sakawa'] || 0) * 0.02) : 1), a.sakawa ? 'Fictional deal proceeds' : 'Fictional street proceeds', false);
      if (a.sakawa && s.flags.juju && Math.random() < 0.15) { const lost = Math.round((s.cash + s.momo) * 0.2); spend(s, lost, 'Strange misfortune'); out.juju = lost; } if (c.reward) for (const k in c.reward) s.n[k] = clamp(s.n[k] + c.reward[k]); out.crime = 'ok'; }
    else { out.crime = 'caught'; const mins = Math.round(Math.min(30, 8 + s.heat / 10)); s.flags.jailUntil = now + mins * 60000; s.flags.bailReview=now+120000; s.busy=null; s.shift=null; out.jail = mins; const fine = Math.min(s.cash + s.momo, 150 + Math.round(s.heat * 3)); spend(s, fine, 'Game offence fine'); out.fine = fine; s.rep = Math.max(0, s.rep - 2); goPlace(p, 'police'); out.place = 'police'; } }
  if (a.tags && a.tags.includes('eat')) s.stats.meals++;
  if (a.rep) s.rep += a.rep; if (a.moodlet) moodlet(s, a.moodlet, a.moodV ?? 12, 6, a.moodL || a.label);
  if (a.tags && a.tags.includes('spicy')) {
    const drama = Math.random() < 0.35;
    if (drama) {
      const taxiTab = Math.min(s.cash || 0, 40 + Math.floor(Math.random() * 40));
      if (taxiTab > 0) {
        spend(s, taxiTab, 'Morning-after Bolt & breakfast tab');
        out.spicyTab = taxiTab;
      }
      moodlet(s, 'spicyDrama', -4, 4, 'Accra hookup morning drama');
      out.spicy = 'drama';
    } else {
      s.rep = (s.rep || 0) + 1;
      moodlet(s, 'spicyRomance', 16, 8, 'Sweet Accra romantic connection');
      out.spicy = 'romance';
    }
  }
  if (a.cures && s.sick && (a.cures === 'serious' || s.sick.level === 'mild')) { s.sick = null; out.cured = true; }
  if (a.mvp) { s.flags.mvp = Math.min(100, (s.flags.mvp || 0) + 6 + lvl(s, 'coding') * 1.6); out.mvp = Math.round(s.flags.mvp); }
  if (a.pitch) { s.flags.lastPitch = now; const round = s.flags.round || 0; const R = [['Pre-seed', 60000], ['Seed', 300000], ['Series A', 1500000]][round];
    const need = [5, 7, 9][round] || 99; const score = lvl(s, 'coding') * 0.55 + lvl(s, 'charisma') * 0.45 + (s.rep / 20) + Math.random() * 2.5 - 1.2;
    if (R && score >= need) { const amt = Math.round(R[1] * (0.7 + Math.random() * 0.6) / 1000) * 1000; out.earned = earn(s, amt, `${R[0]} funding`); s.flags.round = round + 1; s.flags.funded = true; s.flags.mvp = 35; out.round = R[0]; addXp(s, 200); }
    else { out.pitch = 'no'; s.flags.mvp = Math.max(70, s.flags.mvp - 10); } }
  if (b.sleep) { s.n.energy = clamp(s.n.energy + (a.restore || 100) * homeQ * ((b.homeBenefits?.bed??s.items.bed) ? 1.25 : 1)*((b.homeBenefits?.ac??s.items.ac)?1.1:1)); }
  if(b.id==='cook'&&b.storedGroceries&&(b.homeBenefits?.fridge??s.items.fridge))s.n.hunger=clamp(s.n.hunger+Math.max(0,out.gains.hunger||0)*.1);
  if(a.crime)Life.legalOutcome(s,{action:a.id,risk:out.crimeRisk,caught:out.crime==='caught',fine:out.fine||0},now);
  if(b.id==='community_service'){const legal=Life.life(s).legal;legal.reviewUntil=Math.max(now,(legal.reviewUntil||now)-6*3600000);s.heat=Math.max(0,(s.heat||0)-8);Life.event(s,'community_service',{},now);}
  bump(s, 'act:' + b.id); bump(s, 'loc:' + b.loc); for (const t of a.tags || []) bump(s, 'tag:' + t);
  addXp(s, 3 + Math.round(hrs * 4));
  return out;
}
// actions available at your own home (needs the home location)
export const HOME_ACTS = {
  sleep: { id: 'sleep', label: 'Sleep', ic: 'icon:bed', min: 480, sleep: true, needs: { hunger: -2, bladder: -3 }, tags: ['sleep'] },
  nap: { id: 'nap', label: 'Nap (2h)', ic: 'icon:bed', min: 120, sleep: true, restore: 30, tags: ['sleep'] },
  bath: { id: 'bath', label: 'Bath', ic: 'icon:shower', min: 20, inst: { hygiene: 100 }, tags: ['bathe'] },
  toilet: { id: 'toilet', label: 'Toilet', ic: 'icon:toilet', min: 8, inst: { bladder: 100 }, tags: ['toilet'] },
  cook: { id: 'cook', label: 'Cook jollof', ic: 'icon:cooking-pot', min: 45, needs: { hunger: 140 }, skill: { cooking: 0.6 }, tags: ['eat', 'cook'], req: { item: 'gas' } },
  tv: { id: 'tv', label: 'Watch TV', ic: 'icon:television', min: 90, needs: { fun: 30, energy: 4 }, req: { item: 'tv' }, power: true, tags: ['tv', 'relax'] },
  code: { id: 'code', label: 'Code side projects', ic: 'icon:laptop', min: 120, needs: { fun: -4 }, skill: { coding: 0.8 }, req: { item: 'laptop' }, tags: ['code'] },
  guitar: { id: 'guitar', label: 'Practise highlife guitar', ic: 'icon:guitar', min: 60, needs: { fun: 14 }, skill: { music: 0.7 }, req: { item: 'guitar' }, tags: ['music'] },
  workout: { id: 'workout', label: 'Home workout', ic: 'icon:barbell', min: 45, needs: { energy: -14, hygiene: -16, fun: 6 }, skill: { fitness: 0.6 }, req: { item: 'dumbbells' }, tags: ['workout'] },
};
// Stage 7: a visitor may use a few of the host's things (toilet, TV, guitar) when the host allows guests to.
function guestHomeAction(p, id, now, shard) {
  const s = p.state, host = shard?.byAcct?.(+s.place.slice(6));
  if (!host || host.state.place !== 'home' || !host.state.home) return toast('Your host is not at home.', 'bad');
  if (!HomeAccess.guestMayUse(host, id)) return toast('The host keeps that for themselves.', 'bad');
  const r = homeAction(p, id, now, { canAct: true, place: s.place, items: host.state.items || {}, template: host.state.home });
  if (r.t === 'busy') s.busy.guestOf = host.acct;
  return r;
}
export function homeAction(p, id, now, residence) {
  const s = p.state, a = Object.hasOwn(HOME_ACTS,id)&&HOME_ACTS[id]; if (!a || !(residence||s.home)) return toast('No home.', 'bad');
  if (residence ? !residence.canAct||s.place!==(residence.place||'unit:'+residence.unit) : !at(p, 'home')) return toast('Go to your authorized home first.', 'bad');
  const error=canDo(s,p,null,a,now,residence);if(error)return toast(error,'bad');
  const items=residence?.items||s.items,template=D.HOMES[residence?.template||s.home];
  if (a.power && dumsorNow(now) && template.power !== 'estate' && !items.solar && !(items.gen && s.fuel > 0)) return toast('Dumsor! No light. Generator or solar needed.', 'bad');
  const stored=id==='cook'&&s.food>0;
  if (stored) s.food--; else if (id === 'cook' && !pay(s, 18,'Cooking ingredients')) return toast('Ingredients cost GH₵18.', 'bad');
  const r=startAction(p,null,a,now,undefined,residence);if(r.t==='busy'){
    s.busy.storedGroceries=stored;
    if(residence)s.busy.homeBenefits={unit:residence.unit,revision:residence.revision,template:residence.template,comfort:template.comfort,bed:!!items.bed,ac:!!items.ac,fridge:!!items.fridge};
  }return r;
}

// ---------- careers: 1-real-hour shifts, available 24/7 anytime ----------
function shiftWindowOk(c, now) { return true; }
function startShift(p, now) {
  const s = p.state, j = s.job; if (!j) return toast('No job. Apply first.', 'bad');
  const c = D.CAREERS[j.id], loc = LOC[c.at]; if (s.busy || s.shift) return toast('Busy.', 'bad');
  if (!at(p, loc.id)) return toast(`Go to ${loc.name} to start your shift.`, 'bad');
  if (!shiftWindowOk(c, now)) return toast(c.night ? 'Shifts here are 20:00–04:00 on work nights.' : 'Shifts run 06:00–22:00 on work days.', 'bad');
  if (j.lastDay === clock(now).day) return toast('You already worked today. Come back tomorrow.', 'bad');
  if (s.sick && s.sick.level === 'serious') return toast('Too sick to work.', 'bad');
  workDay(s, now).mins += 480;
  s.shift = { start: now, worked: 0, last: now, perf0: j.perf, tasks: 0, wins: 0, tone: 'normal' };
  return { t: 'shift', shift: {...s.shift,assignment:taskView(s)}, title: c.ranks[j.rank][0], pay: shiftPay(s, now) };
}
function shiftPay(s, now, policy) { const j = s.job, c = D.CAREERS[j.id]; return Math.round(c.ranks[j.rank][1] * (1 + 0.05 * j.grade) * (policy === 'wages' ? 1.1 : 1)); }
function tickShift(p, now, policy) {
  const s = p.state, sh = s.shift, j = s.job, c = D.CAREERS[j.id], loc = LOC[c.at];
  const dt = (now - sh.last) / 60000; sh.last = now;
  if (at(p, loc.id)) sh.worked += dt; // you only get paid for time actually at work
  const task=tickTask(p,c,now);if(task?.completed){addSkill(s,task.skill,.12);if(task.quality)sh.wins=(sh.wins||0)+1;Life.workCompleted(s,{id:task.completed,correct:task.quality},now);}
  const m = mood(s); let perfH = (0.6 + m / 80) * 7 + 0.6 * lvl(s, c.skill); for (const t of s.traits) if (D.TRAITS[t].work) perfH *= 1 + D.TRAITS[t].work;
  j.perf = clamp(j.perf + perfH * dt / 60, 0, 100);
  for (const [k, v] of [['energy', -5], ['fun', -5], ['hygiene', -3]]) s.n[k] = clamp(s.n[k] + v * dt / 60);
  addSkill(s, c.skill, 2.2 * dt / 60);
  if ((sh.completedTasks?.length || 0) >= Career.SESSION.tasks) return endShift(p, now, policy, true);
  if (now - sh.start >= Career.SESSION.legacyMinutes * 60000) return endShift(p, now, policy);
  return null;
}
function endShift(p, now, policy, session = false) {
  const s = p.state, sh = s.shift, j = s.job, c = D.CAREERS[j.id]; s.shift = null;
  // A completed work session stands for the whole fictional shift: apply the rest of the
  // hour's performance, skill and need effects that the legacy attendance model accrued.
  if (session) { const rest = Math.max(0, 60 - sh.worked) / 60; const m = mood(s); let perfH = (0.6 + m / 80) * 7 + 0.6 * lvl(s, c.skill); for (const t of s.traits) if (D.TRAITS[t].work) perfH *= 1 + D.TRAITS[t].work;
    j.perf = clamp(j.perf + perfH * rest, 0, 100); addSkill(s, c.skill, 2.2 * rest); for (const [k, v] of [['energy', -5], ['fun', -5], ['hygiene', -3]]) s.n[k] = clamp(s.n[k] + v * rest); sh.worked = 60; }
  const frac = Math.min(1, sh.worked / 60); if (frac < 0.1) return toast('You barely worked. No pay today.', 'bad');
  const stars = sh.wins >= 3 ? 1.15 : 1; const amt = shiftPay(s, now, policy) * Math.max(0.25, frac) * stars;
  const got = earn(s, amt, `${c.ranks[j.rank][0]} shift`); j.shifts++; j.lastDay = clock(now).day; s.stats.shifts++; addXp(s, 25);
  const out = { t: 'shiftDone', pay: got, perf: Math.round(j.perf), stars: stars > 1 }; bump(s, 'shift');
  // promotions: perf 100 → grade up; grade 4 + requirements → rank up
  if (j.perf >= 100) {
    if (j.grade < 3) { j.grade++; j.perf = 60; out.grade = j.grade + 1; }
    else if (j.rank < 4 && j.shifts >= D.PROMO_SHIFTS[j.rank] && lvl(s, c.skill) >= D.PROMO_SKILL[j.rank] && !Career.missingFor(s, j.id, j.rank + 1).length) { j.rank++; j.grade = 0; j.perf = 45; j.shifts = 0; s.stats.promos++; moodlet(s, 'promoted', 30, 24, 'Promoted!'); out.promoted = c.ranks[j.rank][0]; out.newPay = shiftPay(s, now, policy); s.rep += 5; }
    else if(j.rank<4) { j.perf = 99; const courses = Career.missingFor(s, j.id, j.rank + 1).map(m => m.label); out.needs = `${c.name}: need ${D.PROMO_SHIFTS[j.rank]} shifts at this rank and ${D.SKILLS[c.skill]} ${D.PROMO_SKILL[j.rank]}${courses.length ? ' and ' + courses.join(', ') : ''}`; }
  }
  Life.shiftCompleted(s,sh.worked,got,out.promoted,now);
  return out;
}
function apply(p, id, now) {
  const s = p.state, c = D.CAREERS[id]; if (!c) return toast('Unknown job.', 'bad'); const loc = LOC[c.at];
  if (!at(p, loc.id)) return toast(`Apply in person at ${loc.name}.`, 'bad');
  if(s.busy||s.shift)return toast('Finish your current activity or shift before changing careers.','bad');
  if(s.job?.id===id)return toast('You already hold this job. Your experience is retained.');
  const restriction=Life.employmentRestriction(s,id,now);if(restriction)return toast(restriction,'bad');
  for (const k in c.req || {}) if (lvl(s, k) < c.req[k]) return toast(`Needs ${D.SKILLS[k]} ${c.req[k]}.`, 'bad');
  const prior0=Life.careerRecord(s,id)?.saved, missing=Career.missingFor(s,id,prior0?.rank||0);
  if(missing.length)return toast(`Qualify first: ${missing.map(m=>m.label).join(', ')}. Open Jobs to find the course.`, 'bad');
  Life.rememberCareer(s);const prior=Life.careerRecord(s,id)?.saved;
  s.job = prior?{...prior,id}:{ id, rank: 0, grade: 0, perf: 60, shifts: 0, since: now, lastDay: -1 };
  Life.event(s,'career_hired',{career:id,returning:!!prior},now);
  return { t: 'hired', job: s.job, title: c.ranks[s.job.rank][0], pay: c.ranks[s.job.rank][1] };
}

// ---------- Stage 5: courses and auto-work ----------
function takeCourse(p, msg, now) {
  const s = p.state, course = Career.COURSES[String(msg.id)];
  if (!course) return toast('Unknown course.', 'bad');
  if (s.busy || s.shift) return toast('Finish your current activity first.', 'bad');
  if (!at(p, course.at)) return toast(`Courses run at ${LOC[course.at].name}. Go there to take it.`, 'bad');
  const blocked = Career.courseEligibility(s, course.id, (k) => lvl(s, k)); if (blocked) return toast(blocked, 'bad');
  const rec = Career.certs(s)[course.id] || {};
  if (course.cost && !rec.paid) { if (rec.retryAt > now) return toast(`You can retry in ${Math.ceil((rec.retryAt - now) / 60000)} min.`, 'bad'); }
  if (course.cost && !rec.paid && !pay(s, course.cost, `Course fee: ${course.name}`)) return toast(`The course fee is GH₵${course.cost}.`, 'bad');
  if (course.cost) Career.certs(s)[course.id] = { ...(Career.certs(s)[course.id] || { attempts: 0 }), paid: true };
  const r = Career.gradeCourse(s, course.id, msg.answers, now); if (r.error) return toast(r.error, 'bad');
  if (r.passed) { addXp(s, 30); Life.event(s, 'course_passed', { course: course.id, score: r.score }, now); bump(s, 'course:' + course.id); }
  return { t: 'course_result', id: course.id, passed: r.passed, score: r.score, of: r.of, retryAt: Career.certs(s)[course.id].retryAt || null, state: view(s) };
}
function setAutowork(p, msg, now) {
  const s = p.state; if (!s.job) return toast('Get a job before setting up auto-work.', 'bad');
  const clean = Career.cleanAutowork(msg, D.TRANSPORT), old = s.autowork || {};
  s.autowork = { ...clean, since: old.enabled && clean.enabled ? old.since : clock(now).day, lastDay: old.lastDay ?? clock(now).day - 1, results: old.results || [] };
  return { t: 'st', state: view(s) };
}
// Settle completed work windows (offline catch-up capped at three days). Auto shifts never
// interrupt the player, never replace an active shift that day and pay 70% of the shift wage.
export function autoworkDue(s, now) { const aw = s.autowork; if (!aw?.enabled || !s.job) return false; const c = D.CAREERS[s.job.id], h = clock(now).h; return Career.dueAutoDays(aw, clock(now).day, c?.night ? false : h >= 22).length > 0; }
function settleAutowork(p, now, policy) {
  const s = p.state, aw = s.autowork; if (!aw?.enabled || !s.job || s.shift) return null;
  const c = D.CAREERS[s.job.id]; if (!c) return null;
  const days = Career.dueAutoDays(aw, clock(now).day, c.night ? false : clock(now).h >= 22); if (!days.length) return null;
  let paid = 0;
  for (const d of days) {
    aw.lastDay = d; const wd = new Date(d * 86400000).getUTCDay(), j = s.job; let status = 'worked', fare = 0, wage = 0;
    if (j.lastDay === d) status = 'you worked this day yourself';
    else if (!c.days.includes(wd)) status = 'day off';
    else if (s.flags.jailUntil > d * 86400000 + 6 * 3600000) status = 'in custody';
    else if (s.sick?.level === 'serious') status = 'too sick';
    else if (Career.missingFor(s, j.id, j.rank).length) status = 'missing qualification';
    else if (!s.home) status = 'no home to commute from';
    else {
      const from = HOME_POS[s.home], to = LOC[c.at], km = Math.hypot(to.x - from.x, to.z - from.z) / 1000 * 1.3, q = tripQuote(aw.mode, km, d * 86400000 + 8 * 3600000, policy);
      fare = q.tooFar ? Infinity : q.fare * 2;
      if (fare > aw.maxSpend) status = q.tooFar ? 'transport cannot reach' : `round-trip fare GH₵${fare} is over your GH₵${aw.maxSpend} limit`;
      else if (fare && !pay(s, fare, `Auto-work transport (${D.TRANSPORT[aw.mode].name})`)) status = 'could not afford transport';
      else { wage = earn(s, shiftPay(s, now) * Career.AUTO.payShare, `${c.ranks[j.rank][0]} auto-shift`); j.perf = clamp(j.perf + Career.AUTO.perf, 0, 99); j.shifts += Career.AUTO.shiftCredit; addSkill(s, c.skill, 0.5); addXp(s, 10); s.stats.shifts++; paid += wage; }
    }
    if (status !== 'worked') fare = 0;
    aw.results = [{ day: d, status, wage, fare }, ...(aw.results || [])].slice(0, Career.AUTO.results);
    Life.event(s, 'autowork', { day: d, status, wage, fare }, now);
  }
  return paid ? { t: 'autowork_done', paid, results: aw.results.slice(0, days.length) } : { t: 'st', state: view(s) };
}

// ---------- property, purchases, travel, money ----------
export const ITEMS = { gas: ['Gas cooker', 900], fridge: ['Fridge', 4200], tv: ['Flat-screen TV', 3200], laptop: ['Laptop', 7500], dslr: ['DSLR camera', 9800], speaker: ['Big speaker', 2100], guitar: ['Guitar', 1500], dumbbells: ['Dumbbells', 600], bed: ['Orthopedic mattress', 3800], ac: ['Air conditioner', 9500], gen: ['"Tiger" generator', 3200], solar: ['Solar kit + batteries', 38000], ring: ['Engagement ring', 12000] };
function buy(p, m, now) {
  if(p.state.flags.jailUntil>now&&m.kind==='home')return toast('You can move after release from custody.','bad');
  const s = p.state;
  if (m.kind === 'item') { const it = ITEMS[m.id]; if (!it) return null; if (s.items[m.id]) return toast('Already owned.'); if (!pay(s, it[1], it[0])) return toast(`Need GH₵${it[1]}.`, 'bad'); s.items[m.id] = true; if (m.id === 'gen') s.fuel = 5; return { t: 'bought', what: it[0] }; }
  if (m.kind === 'biz') { const b = D.BUSINESSES[m.id]; if (!b || s.biz[m.id]) return null; if (!pay(s, b.price, b.name)) return toast(`Need GH₵${b.price}.`, 'bad'); s.biz[m.id] = { at: now, seen: now }; return { t: 'bought', what: b.name }; }
  if (m.kind === 'land') { const l = D.LANDS[m.id]; if (!l || s.land[m.id]) return null; if (!pay(s, l.price, l.name)) return toast(`Need GH₵${l.price}.`, 'bad'); s.land[m.id] = { value: l.price, paid: l.price, reg: false }; return { t: 'bought', what: l.name }; }
  if (m.kind === 'car') { const c = D.CARS[m.id]; if (!c) return null; const trade = s.car ? D.CARS[s.car].price * 0.6 : 0; if(s.car===m.id)return toast('You already own this vehicle.'); if (!pay(s, Math.max(0, c.price - trade),'Vehicle: '+c.name)) return toast('Not enough money.', 'bad'); s.car = m.id; s.rep += c.rep; return { t: 'bought', what: c.name }; }
  if (m.kind === 'home') { if (!Object.hasOwn(D.HOMES, m.id)) return toast('Choose a valid home.', 'bad'); const h = D.HOMES[m.id]; if(s.owned[m.id]===true){s.home=m.id;goPlace(p,'home');return {t:'moved',home:m.id,place:'home',state:view(s)};} if(s.home===m.id&&!m.buy)return toast('You already rent this home.'); const cost = m.buy ? h.buy : h.rent * h.advance; if (!cost || !pay(s, cost,(m.buy?'Home purchase: ':'Rent advance: ')+h.name)) return toast(`Landlord wants GH₵${cost} (${m.buy ? 'price' : h.advance + ' weeks advance'}).`, 'bad'); s.home = m.id; if (m.buy) s.owned[m.id] = true; else s.rentPaidUntil = nextSaturday9(now) + (h.advance - 1) * 7 * 86400000; s.arrears = 0; delete s.flags.daddyPays; goPlace(p, 'home'); return { t: 'moved', home: m.id, place: 'home', state:view(s) }; }
  if (m.kind === 'wear') { const it = W.WEAR[m.id]; if (!it || !it.price) return null; if (s.wardrobe[m.id]) return toast('You already own that.'); const g = (s.look && s.look.body) || 'm'; if (it.g !== 'u' && it.g !== g) return toast('That one is not for your body type.', 'bad'); if (!pay(s, it.price, it.name)) return toast(`You need GH₵${it.price.toLocaleString()}.`, 'bad'); s.wardrobe[m.id] = true; bump(s, 'boughtWear'); return { t: 'bought', what: it.name, wear: m.id, state: view(s) }; }
  if (m.kind === 'fuel') { if (!pay(s, 85,'Fuel, 5 litres')) return toast('Fuel is GH₵85 for 5 L.', 'bad'); s.fuel += 5; return { t: 'bought', what: '5 L fuel' }; }
  return null;
}
// ---------- Circle phone market (Tiptoe Lane): buy "UK used", test it, fix it at the fitter, flip it ----------
export const PHONES = { button: ['Itell button phone', 90, 'icon:circle'], spork: ['Tekno Spork 10', 950, 'icon:device-mobile'], hot: ['Infinit Hot 30', 1350, 'icon:device-mobile'], galaxi: ['Samsang Galaxi A14', 1900, 'icon:device-mobile'], ifone11: ['iFone 11 “UK used”', 3300, 'icon:circle'], ifone13: ['iFone 13 Pro Max', 7900, 'icon:circle'] };
export function phoneBoard(now) { const day = clock(now).day;
  return Object.fromEntries(Object.entries(PHONES).map(([k, [name, base, ic]]) => { const f = 0.85 + hash(k + day) * 0.3; return [k, { name, ic, buy: Math.round((base * f * 0.82) / 5) * 5, sell: Math.round((base * (0.86 + hash(k + day + 's') * 0.42)) / 5) * 5, hot: hash(k + day + 'h') > 0.78 }]; })); }
const phoneVal = (s, b, ph) => Math.round(b[ph.m].sell * (0.5 + ph.cond / 200) * (1 + lvl(s, 'hustle') * 0.03));
function phoneOp(p, m, now) {
  const s = p.state; const b = phoneBoard(now); const out = (extra = {}) => ({ t: 'phones', board: b, stock: s.phones.map((ph) => ({ ...ph, fake: undefined, value: phoneVal(s, b, ph) })), state: view(s), ...extra });
  if (m.op === 'board') return out();
  if (s.place !== 'circle') return toast('The phone market is at Circle. Go there first.', 'bad'); if (s.busy && !s.busy.travel) return toast('Finish what you are doing first.', 'bad');
  if (m.op === 'buy') { const it = b[m.m]; if (!it) return null; if (s.phones.length >= 4) return toast('Your bag is full. Sell some phones first (max 4).', 'bad');
    const cost = it.buy + (m.test ? 20 : 0); if (!pay(s, cost, `Bought ${it.name}`)) return toast(`You need GH₵${cost}.`, 'bad');
    const fake = !m.test && Math.random() < 0.12; const ph = { id: Math.random().toString(36).slice(2, 8), m: m.m, cond: Math.round(45 + Math.random() * 45), paid: cost, fake,tested:!!m.test, at: now };
    s.phones.push(ph); addSkill(s, 'hustle', 0.05); bump(s, 'phonebuy');
    return out({ msg: m.test ? `The tester checked it: ${ph.cond}% condition. Clean.` : `You bought it sealed in a box. No testing. Hmm.`, k: '' }); }
  const i = s.phones.findIndex((x) => x.id === m.id); if (i < 0) return toast('That phone is gone.', 'bad'); const ph = s.phones[i];
  if (m.op === 'fix') { if (ph.fake) { s.phones.splice(i, 1); moodlet(s, 'soap', -12, 6, 'Bought a soap bar in a phone box'); return out({ msg: 'The fitter opens it… it’s a bar of soap in a phone box. Ei Circle! You throw it away.', k: 'bad' }); }
    if (ph.fixed) return toast('Already fixed. Sell it.', ''); const cost = Math.round(PHONES[ph.m][1] * 0.08); if (!pay(s, cost, 'Phone repair parts')) return toast(`Parts cost GH₵${cost}.`, 'bad');
    ph.cond = Math.min(98, ph.cond + 18 + lvl(s, 'coding') * 2); ph.fixed = true; ph.paid += cost; addSkill(s, 'coding', 0.08); return out({ msg: `New screen + battery. Now ${ph.cond}% condition.`, k: 'good' }); }
  if (m.op === 'sell') { if (ph.fake) { s.phones.splice(i, 1); moodlet(s, 'soap', -12, 6, 'Bought a soap bar in a phone box'); return out({ msg: 'The buyer opens the box: it’s a bar of soap. Nobody will buy that. You lost it all.', k: 'bad' }); }
    const l=Life.life(s),day=clock(now).day;if(l.phoneSales?.day!==day)l.phoneSales={day,count:0,next:0};
    if(l.phoneSales.count>=8)return toast('Circle buyers have filled their phone demand for today (eight sales).','bad');
    if(now<l.phoneSales.next)return toast('The next Circle buyer is available in a minute.','bad');
    l.phoneSales.count++;l.phoneSales.next=now+60000;
    const amt = phoneVal(s, b, ph); s.phones.splice(i, 1); earn(s, amt, `Sold ${b[ph.m].name}`, false); const profit = amt - ph.paid; addSkill(s, 'hustle', 0.22); addXp(s, 6); bump(s, 'phoneflip'); s.stats.flips = (s.stats.flips || 0) + 1; s.stats.flipProfit = (s.stats.flipProfit || 0) + profit;
    if (profit > 0) moodlet(s, 'flip', 8, 4, 'Flipped a phone for profit');
    return out({ msg: profit >= 0 ? `Sold for GH₵${amt}. Profit GH₵${profit}. Circle business! ` : `Sold for GH₵${amt}. You lost GH₵${-profit}. Market is market.`, k: profit >= 0 ? 'good' : 'bad', profit }); }
  return null;
}
export const isRush = (now) => { const { h, wd } = clock(now); return wd >= 1 && wd <= 5 && D.RUSH.some(([a, b]) => h >= a && h < b); };
export function tripQuote(mode, km, now, policy) {
  const T = D.TRANSPORT[mode]; const rush = isRush(now);
  const fare = Math.round((T.base + T.perKm * km) * (rush ? T.surge : 1) * (policy === 'trotro' && mode === 'trotro' ? 0.5 : 1));
  const secs = Math.round(Math.min(mode === 'walk' ? 120 : 75, (T.sb + T.sk * km) * (rush ? T.rush : 1)));
  return { fare, secs: Math.max(5, secs), rush, tooFar: T.maxKm ? km > T.maxKm : false };
}
export function travel(p, m, now, shard, override) {
  if(p.state.flags.jailUntil>now)return toast('You are in custody. Open Police on your phone to see release options.','bad');
  const s = p.state, mode = D.TRANSPORT[m.mode]; if (m.to === 'home' && !s.home) return toast('You have no home. Rent one in the Houses app.', 'bad'); let dest = override || (m.to === 'home' ? HOME_POS[s.home] : LOC[m.to]); if (!mode || !dest) return toast('Unknown destination.', 'bad');
  if (m.to === s.place) return toast('You are already here.');
  if (s.busy || s.shift) return toast('Busy.', 'bad'); if (m.mode === 'car' && !s.car && !(s.rental?.until>now)) return toast('No car.', 'bad');
  const km = Math.hypot(dest.x - p.x, dest.z - p.z) / 1000 * 1.3; // road factor
  const q = tripQuote(m.mode, km, now, shard.policy); if (q.tooFar) return toast(`That's ${km.toFixed(1)} km. Too far to ${m.mode === 'walk' ? 'walk' : 'go by ' + mode.name.toLowerCase()}.`, 'bad');
  const fare = q.fare;
  if (fare && !pay(s, fare, `${mode.name} fare`)) return toast(`Fare is GH₵${fare}.`, 'bad');
  const secs = q.secs;
  updateStreetReturn(s,s.place,m.to);
  s.busy = { id: 'travel', ic: mode.ic, label: `${mode.name} to ${dest.name || 'home'}`, start: now, end: now + secs * 1000, travel: { x: dest.x, z: dest.z, mode: m.mode, km, to: m.to, from: s.place, rush: q.rush } }; s.place = null;
  return { t: 'busy', busy: s.busy, cost: fare };
}
function bank(p, m) {
  const s = p.state; const agent = at(p, 'momo') || at(p, 'bank') || at(p, 'mall') || at(p, 'circle');
  if(m.op==='fixed'){
    const amount=Number(m.amount);if(!Number.isInteger(amount)||amount<100||amount>1000000)return toast('Choose savings between GH₵100 and GH₵1,000,000.','bad');
    if(s.flags.fixed)return toast('Withdraw your existing savings first.','bad');if(!pay(s,amount,'Fixed savings'))return toast('Not enough money.','bad');s.flags.fixed={amount,until:Date.now()+28*86400000};return {t:'st',state:view(s)};
  }
  if(m.op==='withdrawFixed'){
    const fixed=s.flags.fixed;if(!fixed)return toast('No fixed savings to withdraw.','bad');delete s.flags.fixed;s.momo+=fixed.amount;Life.moneyEvent(s,fixed.amount,'Savings principal returned');const interest=Date.now()>=fixed.until?Math.round(fixed.amount*.12*28/365):0;earn(s,interest,'Savings interest');s.ledger.push([Date.now(),fixed.amount,'Savings principal returned']);return {t:'st',state:view(s)};
  }
  if (m.op === 'cashin') { if (!agent) return toast('Find a MoMo agent.', 'bad'); if (s.cash > 0) bump(s, 'cashin'); s.momo += s.cash; s.cash = 0; return { t: 'st', state: view(s) }; }
  if (m.op === 'cashout') { if (!agent) return toast('Find a MoMo agent.', 'bad'); const a = Math.min(s.momo, Math.max(0, +m.amount || 0)); const fee = Math.ceil(a * 0.01); s.momo -= a; s.cash += a - fee; return { t: 'st', state: view(s) }; }
  if (m.op === 'loan') { if (s.loan) return toast('Clear your current loan first.', 'bad'); if (!s.job) return toast('The bank needs a payslip.', 'bad'); const cap = Math.max(1000, netWorth(s) * 0.5); const a = Math.min(cap, Math.max(100, +m.amount || 0)); s.loan = { owed: Math.round(a * 1.18), weekly: Math.round(a * 1.18 / 8), lender: 'Gold Coast Bank', next: Date.now() + 7 * 86400000 }; s.momo += a; return { t: 'st', state: view(s) }; }
  if (m.op === 'repay') { if (!s.loan) return null; if (!pay(s, s.loan.owed,'Loan cleared')) return toast('Not enough to clear the loan.', 'bad'); s.loan = null; return { t: 'st', state: view(s) }; }
  return null;
}

// ---------- periodic world rules ----------
export function tick(p, now, shard) {
  const s = p.state; if (!s.onboarded) return null; CUR.shard = shard;
  decay(s, now); const out = [];
  if(settleBets(s,now,(amount,label)=>earn(s,amount,label)))out.push({t:'st',state:view(s)});
  s.moodlets = s.moodlets.filter((m) => m.until > now);
  if (s.busy && now >= s.busy.end) {
    if (s.busy.travel) { const t = s.busy.travel; s.busy = null; goPlace(p, t.to, { x: t.x, z: t.z }, t.from); const T = D.TRANSPORT[t.mode] || {}; if (T.hyg) s.n.hygiene = clamp(s.n.hygiene + T.hyg * Math.max(1, t.km)); if (T.energy) s.n.energy = clamp(s.n.energy + T.energy * t.km); if (T.fun) s.n.fun = clamp(s.n.fun + T.fun); if (t.mode === 'walk') addSkill(s, 'fitness', 0.15 * t.km); bump(s, 'travel:' + t.mode);
      if (t.mode === 'okada' && Math.random() < T.risk) { s.n.energy = clamp(s.n.energy - 15); moodlet(s, 'okadacrash', -15, 6, 'Okada scrape'); out.push(toast(' The okada skidded at a junction. Small scratches, big fright. (−15 energy)', 'bad')); }
      else if (t.mode === 'trotro' && s.cash > 60 && Math.random() < 0.03) { const lost = Math.round(s.cash * 0.15); s.cash -= lost; out.push(toast(` Somebody in the trotro dipped into your pocket. −GH₵${lost} cash. Keep your money in MoMo!`, 'bad')); } out.push({ t: 'arrived', place: s.place, name: placeName(s, s.place) }); }
    else if (!s.busy.mg) out.push(finishAction(p, now));
    else if (now > s.busy.end + 60000) s.busy = null; // abandoned minigame
  }
  if (s.shift) { const r = tickShift(p, now, shard.policy); if (r) out.push(r); }
  // failure states
  if (s.n.bladder <= 0) { s.n.bladder = 100; s.n.hygiene = 0; moodlet(s, 'embarrassed', -25, 4, 'Public disgrace'); out.push(toast('Eiii! You couldn’t hold it. Public disgrace. ', 'bad')); }
  if (s.n.energy <= 0 && !(s.busy && s.busy.sleep)) { s.n.energy = 25; if (s.cash > 20 && Math.random() < 0.5) { const lost = Math.round(s.cash * 0.5); s.cash -= lost; out.push(toast(`You passed out on the street. Someone took GH₵${lost}.`, 'bad')); } else out.push(toast('You passed out on the street. Sleep at home!', 'bad')); }
  if (s.n.hunger <= 0) { const bill = Math.min(250, s.cash + s.momo); pay(s, bill,'Hospital recovery'); s.n.hunger = 45; goPlace(p, 'ridge'); out.push({ t: 'arrived', place: 'ridge', name: LOC.ridge.name, forced: true }); out.push(toast(`You fainted from hunger. Ridge Hospital bill GH₵${bill}.`, 'bad')); }
  // hourly sickness check
  const hr = Math.floor(now / 3600000);
  if (s.lastHour !== hr) { s.lastHour = hr; s.heat = Math.max(0, (s.heat || 0) - 8); const low = Object.values(s.n).filter((v) => v < 20).length; s.neglect = Math.max(0, s.neglect + (low >= 3 ? low - 1 : low === 2 ? 0.5 : -1.5)); if (!s.sick && s.neglect >= 10 && Math.random() < Math.min(0.25, (s.neglect - 8) * 0.03)) { s.sick = { level: 'mild', since: now, kind: s.n.hygiene < 20 ? 'Typhoid' : s.n.hunger < 20 ? 'Food poisoning' : 'Malaria' }; out.push(toast(`You feel feverish… ${s.sick.kind}. See a doctor (Ridge or Korle Bu).`, 'bad')); } if (s.sick && s.sick.level === 'mild' && now - s.sick.since > 24 * 3600000) s.sick.level = 'serious'; }
  const autoOut = settleAutowork(p, now, CUR.shard?.policy); if (autoOut) out.push(autoOut);
  // weekly & daily economy (real Accra calendar)
  const c = clock(now);
  if (c.h >= 18 && s.lastDaily !== c.day) { s.lastDaily = c.day; let tot = 0; const notes = [];
    // Stage 8: a supplier deal or setback adjusts exactly one daily settlement, then expires.
    const bizMod = (s.flags.bizBoost?.until > now ? s.flags.bizBoost.m : 1) * (s.flags.bizDip?.until > now ? s.flags.bizDip.m : 1); delete s.flags.bizBoost; delete s.flags.bizDip;
    for (const k in s.biz) { const B = D.BUSINESSES[k], st = s.biz[k]; const idle = (now - (st.seen || st.at)) / 86400000; let m = 0.6 + Math.random() * 0.75; if (idle > 3) m *= 0.35; // absentee owner: the manager "chops" the money
      const r = Math.random(); if (r < 0.04) { m = 0; notes.push(`${B.name}: ${['AMA task force seized goods', 'thieves broke in at night', 'no light all day (dumsor)', 'staff didn’t show up'][Math.floor(Math.random() * 4)]}. No profit today.`); } else if (r < 0.07) { m *= 1.8; notes.push(`${B.name}: busy day, profit up!`); }
      tot += B.pay * m * bizMod; }
    if (tot) { const got = earn(s, tot, 'Business profit'); bump(s, 'bizIncome', got); out.push({ t: 'income', amt: got, notes }); } else if (notes.length) out.push(toast(notes[0], 'bad'));
    if (s.items.phone !== false) spend(s, 8, 'Data bundle'); }
  if (s.rentPaidUntil && now >= s.rentPaidUntil && s.home && !s.owned[s.home]) {
    const h = D.HOMES[s.home]; s.rentPaidUntil += 7 * 86400000;
    if (pay(s, h.rent, 'Rent')) { s.arrears = 0; out.push(toast(`Rent GH₵${h.rent} paid to your landlord.`)); }
    else { s.arrears++; if (s.arrears >= 2) { s.home = null; s.arrears = 0; if (s.place === 'home') goPlace(p, 'circle'); out.push(toast('EVICTED. Two weeks unpaid. Your things are at the gate.', 'bad')); } else out.push(toast(`Rent GH₵${h.rent} unpaid. One more week and you’re out.`, 'bad')); }
  }
  const wk = Math.floor((now / 86400000 + 3) / 7);
  if (s.lastWeekly !== wk) { if (s.lastWeekly) { let inc = s.wk.inc, tax = 0; for (const [w, r] of D.TAX_BANDS) { const part = Math.min(inc, w); tax += part * Math.max(0, r - (shard.policy === 'tax' && r ? 0.05 : 0)); inc -= part; if (inc <= 0) break; } tax = Math.round(tax); if (tax) { pay(s, Math.min(tax, s.cash + s.momo),'Weekly income tax'); out.push(toast(`GRA weekly tax: GH₵${tax}.`)); } for (const k in s.land) { const l = s.land[k]; l.value = Math.round(l.value * (1 + D.LANDS[k].g * (0.6 + Math.random() * 0.8))); if (!l.reg && Math.random() < D.LANDS[k].risk) { l.value = Math.round(l.value * 0.75); out.push(toast(`Landguards hit your ${D.LANDS[k].name}! Value −25%. Register it.`, 'bad')); } } } s.lastWeekly = wk; s.wk = { inc: 0 }; }
  aspirationTick(p, now, out);
  lifeEventTick(p, now, out);
  if (s.loan && now >= s.loan.next) { const due = Math.min(s.loan.weekly, s.loan.owed); if (pay(s, due,'Loan repayment')) { s.loan.owed -= due; s.loan.next += 7 * 86400000; if (s.loan.owed <= 0) s.loan = null; out.push(toast(`Loan repayment GH₵${due}.`)); } else { s.loan.owed = Math.round(s.loan.owed * 1.1); s.loan.next += 86400000; out.push(toast('Loan repayment failed: 10% penalty added.', 'bad')); } }
  if (!out.length) return null;
  return out.length === 1 ? out[0] : { t: 'multi', list: out };
}

// Offline "autopilot": while you're away your character still lives (sleeps, eats cheap food, goes to work… not).
// Needs drift toward a floor instead of crashing, and the meals you ate cost money. No surprise hospital bills on login.
export function onJoin(p, now) {
  const s = p.state; if (!s.onboarded) return null;
  if(s.shift&&s.job){
    // Resume only recorded attendance. Offline time cannot complete assignments,
    // advance performance, or turn a brief visit into a fully paid shift.
    const attended=clamp(Number.isFinite(s.shift.worked)?s.shift.worked:0,0,60);
    s.shift.worked=attended;s.shift.last=now;s.shift.start=now-attended*60000;s.shift.activeTask=null;
    Life.event(s,'career_resumed',{career:s.job.id,attendedMinutes:attended},now);
  }else s.shift=null;
  const hrs = Math.max(0, (now - (s.needsAt || now)) / 3600000); s.needsAt = now; if (hrs < 0.25) return null;
  const meals = Math.min(3, Math.floor(hrs / 7)); let ate = 0; for (let i = 0; i < meals; i++) if (pay(s, 22, 'Meals while away')) ate++;
  const floor = { hunger: ate ? 45 : 20, energy: 60, fun: 30, social: 25, hygiene: 35, bladder: 50 };
  for (const k in s.n) { const target = Math.max(floor[k] || 30, Math.min(s.n[k], 70)); s.n[k] = k === 'energy' ? Math.max(s.n[k], Math.min(100, s.n[k] + hrs * 9)) : target; }
  s.busy = s.busy && s.busy.travel ? s.busy : null;
  return hrs > 2 ? { t: 'toast', m: `Welcome back. You were away ${hrs > 48 ? Math.round(hrs / 24) + ' days' : Math.round(hrs) + ' hours'}${ate ? `, spent GH₵${ate * 22} on food` : ''}.`, k: '' } : null;
}
export function interrupt(p, now) { const b = p.state.busy; if (b && !b.travel && !b.mg && !b.sleep) p.state.busy = null; }
export function onMsg(p, msg, shard, now) {
  const s = p.state; CUR.shard = shard;
  // IDs are catalogue keys, never prototype properties. Amounts stay finite.
  for(const key of ['id','loc','to','m','dream','kind','op','mode'])if(['__proto__','constructor','prototype','toString','valueOf','hasOwnProperty','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__','isPrototypeOf','propertyIsEnumerable','toLocaleString'].includes(msg[key]))return toast('Invalid request.','bad');
  if(msg.amount!==undefined&&(!Number.isFinite(msg.amount)||!Number.isSafeInteger(msg.amount)||msg.amount<0))return toast('Enter a valid whole amount.','bad');
  if(msg.t==='work'&&msg.op==='quit')Life.rememberCareer(s);
  if(msg.t==='act'&&LOC[msg.loc]?.acts.find(a=>a.id===msg.id)?.crime&&(msg.target!==undefined||msg.victim!==undefined))return toast('Fictional crime cannot target another player.','bad');
  switch (msg.t) {
    case 'jail': {
      if(!(s.flags.jailUntil>now))return toast('You are not in custody.');
      if(msg.op==='bail') {
        if(now<(s.flags.bailReview||0))return toast(`Free bail review in ${Math.ceil((s.flags.bailReview-now)/1000)} seconds.`,'bad');
        s.flags.jailUntil=0;delete s.flags.bailReview;s.heat=Math.max(0,(s.heat||0)-10);bump(s,'bail');return {t:'st',state:view(s),released:true};
      }
      const actions={rest:{energy:20},meal:{hunger:25},washroom:{bladder:100,hygiene:5},read:{fun:12},chat:{social:12}};
      const gain=actions[msg.op];if(!gain)return toast('Choose a custody activity.','bad');
      if(now-(s.flags.cellActionAt||0)<20000)return toast('Give that activity a moment.','bad');s.flags.cellActionAt=now;
      for(const [k,v]of Object.entries(gain))s.n[k]=clamp(s.n[k]+v);return {t:'st',state:view(s)};
    }
    case 'rentcar': {
      if(!s.onboarded||!at(p,'cars'))return toast('Visit Correct Cars to rent.','bad');if(s.flags.jailUntil>now)return toast('Rent a car after release.','bad');
      if(s.car)return toast('You already own a car.');if(s.rental?.until>now)return toast('Your rental is still active.');if(!pay(s,350,'24-hour car rental'))return toast('You need GH₵350.','bad');s.rental={car:'vitz',until:now+86400000};return {t:'st',state:view(s)};
    }
    case 'matches': return {t:'matches',matches:matchBoard(now),bets:s.flags.matchBets||[],now};
    case 'bet': {
      const err=validateBet(s,s.place,msg,now);if(err)return toast(err,'bad');
      if(!pay(s,msg.stake,'Match prediction'))return toast('Not enough game money.','bad');
      (s.flags.matchBets ||= []).push(makeBet(msg,now));return {t:'matches',matches:matchBoard(now),bets:s.flags.matchBets,state:view(s),now};
    }
    case 'street': {
      if(!s.onboarded||s.busy||s.shift||s.flags.jailUntil>now)return toast('Finish your current activity first.','bad');
      const to=msg.to;
      const district=/^[ne]:/.test(s.place||'')?s.place.slice(2):null;
      if(s.place==='home'&&to==='n:'+s.home || district&&to==='home'&&district===s.home || district&&D.HOMES[district]&&['n:'+district,'e:'+district].includes(to)){
        const from=s.place;goPlace(p,to,undefined,from);return {t:'arrived',place:to,name:placeName(s,to),state:view(s)};
      }
      return toast('Use your home door to reach your neighbourhood.','bad');
    }
    // Older development load tools may use the one-shot command. Public accounts
    // must complete saved checkpoints; a cached old client needs a reload.
    case 'onboard': return !s.onboarded&&(CFG.production||s.onboarding?.started)?toast('Reload the game and finish your saved setup steps.','bad'):onboard(p, msg);
    case 'act': { if (msg.home && s.place?.startsWith('visit:')) return guestHomeAction(p, String(msg.id), now, shard); if (msg.home) return homeAction(p, String(msg.id), now); const loc = LOC[msg.loc]; const a = loc && loc.acts.find((x) => x.id === msg.id); if (!a) return toast('Not available.', 'bad'); return startAction(p, loc, a, now, shard.policy); }
    case 'mgResult': { const b = s.busy; if (!b || !b.mg) return null; s.busy = null; const secs = (now - b.start) / 1000; if (secs < 20) return toast('Too fast.', 'bad'); const stars = Math.max(0, Math.min(3, msg.stars | 0)); const skill = { trotro: 'hustle', waakye: 'cooking', bolu: 'driving', bughunt: 'coding', azonto: 'dance', boxing: 'fitness' }[b.mg]; let amt = (18 + stars * 22) * (1 + lvl(s, skill) * 0.07); amt *= hustleMult(s, b.id, now, skill); s.gd.earned += amt; const got = earn(s, amt, 'Gig'); addSkill(s, skill, 0.3 + stars * 0.25); s.gigRest[b.id] = now + 60 * 60000; s.stats.gigs++; return { t: 'done', id: b.id, earned: got, stars }; }
    case 'work': if(msg.op==='beginTask'){const c=D.CAREERS[s.job?.id];if(!s.shift||!c)return toast('Start your shift at work first.','bad');const error=beginTask(p,msg,c,now);return error?toast(error,'bad'):{t:'worktask',shift:{...s.shift,assignment:taskView(s)}};}return msg.op === 'start' ? startShift(p, now) : msg.op === 'task' && s.shift ? toast('Work performance is calculated by the server.') : msg.op === 'quit' ? ((s.job = null), (s.shift = null), { t: 'st', state: view(s) }) : msg.op === 'end' && s.shift ? ((s.shift = null), { t: 'st', state: view(s) }) : null;
    case 'apply': return apply(p, String(msg.id), now);
    case 'course': return takeCourse(p, msg, now);
    case 'lifeevent': { const r = LE.decide(s, lifeCtx(p, now), String(msg.choice || '')); if (r.error) return toast(r.error, 'bad'); const effects = applyLifeOutcome(p, r.out, r.active, now); return { t: 'life_event_result', id: r.active.id, title: r.active.title, text: r.out.text, effects, state: view(s) }; }
    case 'profile_set': { s.profile = Profile.cleanProfile(msg, s); return { t: 'st', state: view(s), profileSaved: true }; }
    case 'homeaccess': { s.homeAccess = HomeAccess.cleanAccess(msg, s); return { t: 'st', state: view(s), homeAccess: s.homeAccess }; }
    case 'autowork': return setAutowork(p, msg, now);
    case 'buy': return buy(p, msg, now);
    case 'travel': return travel(p, msg, now, shard);
    case 'bank': return bank(p, msg);
    case 'bizcheck': { if (!Object.keys(s.biz).length) return toast('You have no businesses yet.'); for (const k in s.biz) s.biz[k].seen = now; s.n.fun = clamp(s.n.fun - 3); return toast(' You called your managers and checked the books. They know you dey watch.', 'good'); }
    case 'look': if (msg.look && typeof msg.look === 'object') { const next=W.cleanLook(msg.look,s.wardrobe);if(JSON.stringify(next)!==JSON.stringify(s.look))bump(s,'outfit');s.look=next; return { t: 'st', state: view(s), look: true }; } return null;
    case 'cancel': { const b = s.busy; if (b && !b.travel && !b.mg) { s.busy = null; return { t: 'cancelled', id: b.id }; } return null; }
    case 'state': return { t: 'st', state: view(s), mood: mood(s), dumsor: dumsorNow(now, shard.policy) };
    case 'reply': return toast('Accra is now free play. Story conversations have been retired.');
    case 'pickdream': return pickDream(p, String(msg.id));
    case 'story_status': return storyStatus(p, now);
    case 'story_claim': return storyClaim(p, String(msg.id || ''), now);
    case 'story_choice': return storyChoice(p, String(msg.encounterId || ''), String(msg.choiceId || ''), now);
    case 'donate': return donate(p, msg);
    case 'phone': return phoneOp(p, msg, now);
  }
  return null;
}
// =====================================================================================================
// Optional aspirations, driven by the player’s actions. No narrative or deadlines.
// =====================================================================================================
export function bump(s, key, n = 1) {
  s.cnt[key] = (s.cnt[key] || 0) + n;
  const day = clock().day; if (s.dc.day !== day) s.dc = { day, cnt: {}, visits: [] };
  s.dc.cnt[key] = (s.dc.cnt[key] || 0) + n;
}
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
function ctx(p, now) {
  const s = p.state, c = clock(now); const at = s.place && LOC[s.place] ? s.place : null;
  return { now, h: c.h, wd: c.wd, day: c.day, dom: new Date(now).getUTCDate(), ageH: (now - (s.flags.bornAt || s.created)) / 3600000, ageD: (now - (s.flags.bornAt || s.created)) / 86400000, at,
    worth: netWorth(s), dumsor: dumsorNow(now, CUR.shard && CUR.shard.policy), cnt: (k) => s.cnt[k] || 0, dcnt: (k) => (s.dc.day === c.day && s.dc.cnt[k]) || 0, dvisits: s.dc.day === c.day ? s.dc.visits.length : 0, rnd: 0 };
}
// ---------- Stage 8 personal life events (engine in life-events.js) ----------
function lifeCtx(p, now) {
  const s = p.state, c = clock(now), pl = s.place || '', L = LOC[pl];
  const idle = !!(s.onboarded && pl && !s.busy && !s.shift && !(s.flags.jailUntil > now) && !s.sick);
  const friends = Object.entries(s.friends || {}).filter(([, f]) => f && f.accepted).map(([acct, f]) => ({ acct: +acct, name: f.n || 'a friend' }));
  return { now, h: c.h, day: c.day, place: pl, street: pl.startsWith('n:'), public: !!L && !L.estate, idle, friends };
}
function lifeEventTick(p, now, out) {
  const s = p.state, r = LE.settle(s, now);
  for (const n of r.notes) out.push(toast(n));
  for (const d of r.paid) { const got = earn(s, d.amount, d.label); if (got) out.push(toast(`${d.label}: +GH₵${got}.`, 'good')); }
  // Stage 11: operations can pause new offers; anything already offered or running still settles above.
  const a = flag('life_events') ? LE.offer(s, lifeCtx(p, now)) : null; if (a) out.push({ t: 'life_event', event: a });
}
function applyLifeOutcome(p, o, active, now) {
  const s = p.state, fx = [];
  if (o.cash < 0) { const lost = Math.min(s.cash, -o.cash); if (lost > 0) { s.cash -= lost; s.ledger.push([now, -lost, active.title]); Life.moneyEvent(s, -lost, active.title); fx.push(`−GH₵${lost} cash`); } }
  if (o.cash > 0) { const got = earn(s, o.cash, active.title, false); if (got) fx.push(`+GH₵${got} cash`); }
  if (o.earn) { const got = earn(s, o.earn, active.title); if (got) fx.push(`+GH₵${got} MoMo`); }
  if (o.pay && pay(s, o.pay, active.title)) fx.push(`−GH₵${o.pay}`);
  for (const [k, v] of Object.entries(o.needs || {})) if (k in s.n) { s.n[k] = clamp(s.n[k] + v); fx.push(`${k} ${v > 0 ? '+' : ''}${v}`); }
  if (o.mood) { moodlet(s, 'ev_' + o.mood.id, o.mood.v, o.mood.h, o.mood.label); fx.push(o.mood.label); }
  if (o.skill) addSkill(s, o.skill[0], o.skill[1]);
  if (o.rep) { s.rep = Math.max(0, (s.rep || 0) + o.rep); fx.push(`reputation ${o.rep > 0 ? '+' : ''}${o.rep}`); }
  if (o.heat) s.heat = Math.min(200, (s.heat || 0) + o.heat);
  if (o.perf && s.job) { s.job.perf = Math.min(100, (s.job.perf || 0) + o.perf); fx.push(`work performance +${o.perf}`); }
  if (o.friend && s.friends[o.friend[0]]) { s.friends[o.friend[0]].pts = (s.friends[o.friend[0]].pts || 0) + o.friend[1]; fx.push(`friendship +${o.friend[1]}`); }
  if (o.flag) { s.flags[o.flag[0]] = { m: o.flag[1], until: now + o.flag[2] * 3600000 }; fx.push(o.flag[0] === 'bizBoost' ? 'next business takings boosted' : 'next business takings lower'); }
  bump(s, 'lifeevent'); Life.event(s, 'life_event', { id: active.id, category: active.cat, cash: (o.cash || 0) + (o.earn || 0) - (o.pay || 0) }, now);
  return fx;
}
export const lifeEventDue = (s, now) => LE.due(s, now);
function aspirationTick(p, now, out) {
  const s = p.state; if (now - (s.story.at || 0) < 12000) return; s.story.at = now;
  const c = ctx(p, now);
  // visits (for missions and goals)
  if (c.at) { if (s.dc.day !== c.day) s.dc = { day: c.day, cnt: {}, visits: [] }; if (!s.dc.visits.includes(c.at)) s.dc.visits.push(c.at); }
  // dream tiers
  const tiers = s.dream && ST.DREAM_TIERS[s.dream];
  if (tiers && s.dreamTier < tiers.length) { let ok = false; try { ok = tiers[s.dreamTier][1](s, c); } catch {}
    if (ok) { const [cash, rep] = ST.TIER_REWARD[s.dreamTier]; earn(s, cash, 'Dream milestone'); s.rep += rep; s.dreamTier++; out.push({ t: 'dream', tier: s.dreamTier, label: tiers[s.dreamTier - 1][0], cash, rep, done: s.dreamTier >= tiers.length }); if (s.dreamTier >= tiers.length) s.dreamsDone.push(s.dream); } }
}
export function aspirationDue(s,now){
  const tiers=s.dream&&ST.DREAM_TIERS[s.dream];
  if(!tiers||s.dreamTier>=tiers.length||now-(s.story.at||0)<12000)return false;
  try{return !!tiers[s.dreamTier][1](s,ctx({state:s},now));}catch{return false;}
}


function pickDream(p, id) {
  const s = p.state;
  if (id !== 'none' && !ST.DREAM_TIERS[id] && !ST.STORY_ARCS[id]) return toast('Unknown aspiration.', 'bad');
  s.dreamProgress ||= {};
  if (s.dream) s.dreamProgress[s.dream] = s.dreamTier || 0;
  s.dream = id === 'none' ? null : id;
  const tiers = ST.DREAM_TIERS[id] || [];
  s.dreamTier = s.dream ? Math.min(tiers.length, Math.max((s.dreamsDone || []).includes(id) ? tiers.length : 0, Number(s.dreamProgress[id]) || 0)) : 0;
  if (s.dream && id !== 'none') {
    ST.initStory(s, s.dream);
  }
  return { t: 'st', state: view(s) };
}
function storyStatus(p, now) {
  const s = p.state, c = ctx(p, now);
  return {
    t: 'story_status',
    story: s.story,
    active: ST.activeStoryMission(s, c),
    arc: s.dream ? ST.STORY_ARCS[s.dream] : null
  };
}
function storyClaim(p, id, now) {
  const s = p.state;
  if (!s.dream) return toast('Choose an aspiration first.', 'bad');
  const res = ST.claimStoryMission(s, id, now);
  if (res.error) return toast(res.error, 'bad');
  const c = ctx(p, now);
  return {
    t: 'story_claimed',
    mission: res.mission,
    reward: res.reward,
    next: ST.activeStoryMission(s, c),
    state: view(s)
  };
}
function storyChoice(p, encounterId, choiceId, now) {
  const s = p.state;
  const res = ST.resolveStoryChoice(s, encounterId, choiceId, now);
  if (res.error) return toast(res.error, 'bad');
  const c = ctx(p, now);
  return {
    t: 'story_choice_result',
    encounter: res.encounter,
    choice: res.choice,
    note: res.note,
    next: ST.activeStoryMission(s, c),
    state: view(s)
  };
}
function donate(p, msg) {
  const s = p.state; const a = Math.max(0, Math.min(1e7, Math.round(+msg.amount || 0))); if (a < 50) return toast('Minimum donation is GH₵50.', 'bad');
  if (!pay(s, a, 'Community donation')) return toast('Not enough money.', 'bad'); bump(s, 'donate', a); s.rep += Math.floor(a / 2500); moodlet(s, 'donated', 10, 24, 'Gave back');
  return toast(` You donated GH₵${a.toLocaleString()} to a community project in your area. People are talking.`, 'gold');
}
const HEX = /^#[0-9a-f]{6}$/i;
export function sanitizeLook(l) { const o = {}; for (const k of ['skin', 'hairCol', 'top', 'bottom', 'shoes']) if (HEX.test(l[k] || '')) o[k] = l[k]; for (const k of ['body', 'hair', 'outfit']) if (typeof l[k] === 'string') o[k] = cleanText(l[k], 24); if (Number.isFinite(l.skinTone)) o.skinTone = Math.max(1, Math.min(6, l.skinTone | 0)); return o; }
