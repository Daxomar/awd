// "Today" board: three daily Accra missions (Hustle, Street, Link-up), one re-roll a day,
// and a 7-day streak ladder that ends in a chest and a streak saver.
// Progress comes only from the server's own daily counters (rules.bump → s.dc.cnt);
// rewards are paid by the caller's earn/xp helpers inside the durable game transaction.
import { paper } from './accra-daily.js';

export const CATEGORIES = [
  { id: 'hustle', name: 'Hustle', icon: 'briefcase' },
  { id: 'street', name: 'Street', icon: 'map-trifold' },
  { id: 'linkup', name: 'Link-up', icon: 'users-three' },
];
const REWARD = { hustle: { cash: 45, xp: 20 }, street: { cash: 30, xp: 15 }, linkup: { cash: 30, xp: 15 } };
const LOCAL_FOOD = ['act:waakye', 'act:waakyeSmall', 'act:kenkey', 'act:fufu', 'act:banku', 'act:redred'];
// keys: daily counters summed for progress; need: target; req: optional eligibility on state.
export const MISSIONS = [
  { id: 'shift', cat: 'hustle', label: 'Clock in', hint: 'Finish one work shift at your job', keys: ['shift'], need: 1, req: (s) => !!s.job },
  { id: 'gigs', cat: 'hustle', label: 'Run two gigs', hint: 'Any gig: fitter, mate, kayayo, washing plates…', keys: ['tag:gig'], need: 2 },
  { id: 'smallsmall', cat: 'hustle', label: 'Small small', hint: 'Two street hustles: hawk, resell, sell water', keys: ['tag:hustle'], need: 2 },
  { id: 'study', cat: 'hustle', label: 'Sharpen up', hint: 'One study session at Legon or Sankofa Hub', keys: ['tag:study'], need: 1 },
  { id: 'makola', cat: 'hustle', label: 'Makola run', hint: 'Do anything at Makola Market', keys: ['loc:makola'], need: 1 },
  { id: 'photo', cat: 'hustle', label: 'Content day', hint: 'One photo shoot in Osu or at the Memorial', keys: ['tag:photo'], need: 1 },
  { id: 'cashin', cat: 'hustle', label: 'Cash in', hint: 'Move your cash into MoMo at an agent', keys: ['cashin'], need: 1 },
  { id: 'trotro', cat: 'street', label: 'Trotro twice', hint: 'Ride a trotro two times today', keys: ['travel:trotro'], need: 2 },
  { id: 'okada', cat: 'street', label: 'Okada dash', hint: 'Hop on one okada. Hold tight', keys: ['travel:okada'], need: 1 },
  { id: 'chop', cat: 'street', label: 'Chop local', hint: 'Waakye, kenkey, fufu, banku or red-red', keys: LOCAL_FOOD, need: 1 },
  { id: 'nightsnack', cat: 'street', label: 'Night snack', hint: 'Kelewele on Oxford Street or a khebab', keys: ['act:kelewele', 'act:khebab', 'act:chickenkhebab'], need: 1 },
  { id: 'tourist', cat: 'street', label: 'Tourist at home', hint: 'Castle, lighthouse, Memorial or court tour', keys: ['tag:tour'], need: 1 },
  { id: 'labadi', cat: 'street', label: 'Labadi vibes', hint: 'Do anything at Labadi Beach', keys: ['loc:labadi'], need: 1 },
  { id: 'dance', cat: 'street', label: 'Dance it out', hint: 'Party, funeral dance or a drum jam', keys: ['tag:dance', 'act:drumjam'], need: 1 },
  { id: 'football', cat: 'street', label: 'Ball time', hint: 'Watch a match at the stadium or viewing centre', keys: ['act:watch', 'act:match'], need: 1 },
  { id: 'workout', cat: 'street', label: 'Sweat small', hint: 'One workout: Bukom, Black Star Square, beach', keys: ['tag:workout'], need: 1 },
  { id: 'chat', cat: 'linkup', label: 'Street gist', hint: 'Send three messages in the street chat', keys: ['chat'], need: 3 },
  { id: 'social', cat: 'linkup', label: 'Link up', hint: 'One social action with another player', keys: ['social'], need: 1 },
  { id: 'dm', cat: 'linkup', label: 'Slide in', hint: 'Send one private message', keys: ['dm'], need: 1 },
  { id: 'gist', cat: 'linkup', label: 'Drop gist', hint: 'Post on Accra Gist', keys: ['gist'], need: 1 },
  { id: 'fellowship', cat: 'linkup', label: 'Fellowship', hint: 'Church service, prayers or Jumu\'ah', keys: ['act:service', 'act:prayer', 'act:pray', 'act:jumah'], need: 1 },
  { id: 'oware', cat: 'linkup', label: 'Oware board', hint: 'Finish one game of oware', keys: ['oware'], need: 1 },
  { id: 'people', cat: 'linkup', label: 'Make people', hint: 'Two social activities anywhere in Accra', keys: ['tag:social'], need: 2 },
];
const BY_ID = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
// Day 7 is the chest; it also grants a streak saver (kept at most MAX_SAVERS).
export const LADDER = [
  { cash: 40, xp: 20 }, { cash: 60, xp: 25 }, { cash: 80, xp: 30 }, { cash: 100, xp: 35 },
  { cash: 120, xp: 40 }, { cash: 150, xp: 45 }, { cash: 300, xp: 80, saver: 1, chest: true },
];
export const MAX_SAVERS = 2;
const REROLLS = 1;

const dayOf = (now) => Math.floor(now / 86400000);
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const seedOf = (s) => String(s.created || 0);
function choose(s, day, cat, salt, avoid = []) {
  const pool = MISSIONS.filter((m) => m.cat === cat && (!m.req || m.req(s)) && !avoid.includes(m.id));
  return pool.length ? pool[hash(`${seedOf(s)}:${day}:${cat}:${salt}`) % pool.length].id : null;
}
export function dealFor(s, day) { return CATEGORIES.map((c) => choose(s, day, c.id, 0)).filter(Boolean); }

function clean(d) {
  const o = d && typeof d === 'object' ? d : {}; const int = (v, min = 0) => (Number.isSafeInteger(v) && v >= min ? v : null);
  return { day: int(o.day, -1) ?? -1, list: Array.isArray(o.list) ? o.list.filter((id) => typeof id === 'string' && BY_ID[id]).slice(0, 3) : [],
    claimed: Array.isArray(o.claimed) ? o.claimed.filter((id) => typeof id === 'string' && BY_ID[id]) : [],
    rerolls: int(o.rerolls) ?? 0, streak: int(o.streak) ?? 0, lastFull: int(o.lastFull, -1) ?? -1, freezes: Math.min(MAX_SAVERS, int(o.freezes) ?? 0) };
}
// Returns today's normalized record without mutating the saved one.
export function today(s, now = Date.now()) {
  const day = dayOf(now), d = clean(s.daily);
  if (d.day === day && d.list.length) return d;
  return { ...d, day, list: dealFor(s, day), claimed: [], rerolls: 0 };
}
export function progress(s, id, day) {
  const m = BY_ID[id]; if (!m) return 0; const c = s.dc && s.dc.day === day && s.dc.cnt ? s.dc.cnt : {};
  return Math.min(m.need, m.keys.reduce((a, k) => a + (Number(c[k]) || 0), 0));
}
// The streak still counts if yesterday was completed, or the day before with a saver in hand.
export function liveStreak(d, day) {
  if (d.lastFull >= day - 1) return { streak: d.streak, atRisk: false };
  if (d.lastFull === day - 2 && d.freezes > 0) return { streak: d.streak, atRisk: true };
  return { streak: 0, atRisk: false };
}
export function board(s, now = Date.now()) {
  const d = today(s, now), day = d.day, live = liveStreak(d, day), doneToday = d.lastFull === day;
  const list = d.list.map((id) => { const m = BY_ID[id], n = progress(s, id, day);
    return { id, cat: m.cat, label: m.label, hint: m.hint, n, need: m.need, done: n >= m.need, claimed: d.claimed.includes(id), reward: REWARD[m.cat] }; });
  const step = doneToday ? (d.streak - 1) % LADDER.length : live.streak % LADDER.length;
  return { day, list, streak: live.streak, atRisk: live.atRisk, savers: d.freezes, rerolls: Math.max(0, REROLLS - d.rerolls),
    doneToday, step, ladder: LADDER.map(({ cash, xp, chest }) => ({ cash, xp, chest: !!chest })), paper: paper(now) };
}
function award(d, day) {
  let saverUsed = false;
  if (d.lastFull === day - 1) d.streak += 1;
  else if (d.lastFull === day - 2 && d.freezes > 0) { d.freezes -= 1; d.streak += 1; saverUsed = true; }
  else d.streak = 1;
  d.lastFull = day; const prize = LADDER[(d.streak - 1) % LADDER.length];
  if (prize.saver) d.freezes = Math.min(MAX_SAVERS, d.freezes + prize.saver);
  return { prize, saverUsed };
}
// msg: { op: 'status' | 'claim' | 'reroll', id }. pay: { earn(amount, why), xp(n) }.
export function handle(s, msg, now, pay) {
  const d = today(s, now), day = d.day, op = String(msg && msg.op || 'status'), id = String(msg && msg.id || '');
  const out = { t: 'hustle' };
  if (op === 'claim') {
    if (!d.list.includes(id)) return { error: 'That mission is not on today\'s board.' };
    if (d.claimed.includes(id)) return { error: 'Already claimed.' };
    const m = BY_ID[id]; if (progress(s, id, day) < m.need) return { error: 'Finish the mission first.' };
    d.claimed = [...d.claimed, id]; const r = REWARD[m.cat];
    out.claimed = { id, cash: pay.earn(r.cash, `Today: ${m.label}`), xp: r.xp }; pay.xp(r.xp);
    if (d.list.every((x) => d.claimed.includes(x)) && d.lastFull !== day) {
      const { prize, saverUsed } = award(d, day);
      out.bonus = { streak: d.streak, cash: pay.earn(prize.cash, prize.chest ? `Streak chest: day ${d.streak}` : `Streak day ${d.streak}`), xp: prize.xp, chest: !!prize.chest, saver: !!prize.saver, saverUsed };
      pay.xp(prize.xp);
    }
  } else if (op === 'reroll') {
    const at = d.list.indexOf(id);
    if (at < 0) return { error: 'That mission is not on today\'s board.' };
    if (d.claimed.includes(id)) return { error: 'You already claimed that one.' };
    if (d.rerolls >= REROLLS) return { error: 'No re-roll left today. New board at midnight.' };
    const next = choose(s, day, BY_ID[id].cat, d.rerolls + 1, d.list);
    if (!next) return { error: 'Nothing else to swap in today.' };
    d.list = d.list.map((x, i) => (i === at ? next : x)); d.rerolls += 1; out.rerolled = { from: id, to: next };
  } else if (op !== 'status') return { error: 'Unknown request.' };
  s.daily = d;
  out.board = board(s, now);
  return out;
}
