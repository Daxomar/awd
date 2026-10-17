// Stage 12.2 economy balance report. A seeded Monte Carlo cadence model over the live catalogue values: careers,
// course fees, rent and advances, tax bands, trotro fares, food and data bands, auto-work rules, the real bounded
// business demand function, life-event loss caps, property and vehicle prices. It changes NO game value; the
// proposal it informs is for owner approval. Run from server/: node loadtest/stage12-economy.mjs
import fs from 'node:fs';
import * as D from '../src/game/data.js';
import * as Game from '../src/game/rules.js';
import {COURSES, CAREER_REQS, AUTO} from '../src/game/careers.js';
import {MODELS, PERIOD, demandPeriod} from '../src/game/business-model.js';
import {RULES as LIFE} from '../src/game/life-events.js';

const DAYS = 90, TRIALS = 200, BASE = Date.UTC(2026, 9, 19);
const MEAL = 20, OFFLINE_MEAL = 22, DATA = 8, KM = 6;
const FARE = Math.round((D.TRANSPORT.trotro.base + D.TRANSPORT.trotro.perKm * KM) * 2);   // return trip to work
const ENTRY_PROPERTY = 5000, VITZ = D.CARS.vitz.price;
// Play styles: which weekdays the player is online, whether they work shifts, run a stall or use auto-work.
const STYLES = {
  employment: {online: [0, 1, 2, 3, 4, 5], work: true, business: false, auto: false, eventsPerDay: 1},
  business: {online: [0, 1, 2, 3, 4, 5, 6], work: false, business: true, auto: false, eventsPerDay: 1},
  social: {online: [1, 3, 5], work: false, business: false, auto: false, eventsPerDay: 1.5},
  mixed: {online: [0, 1, 2, 3, 4, 5], work: true, business: true, auto: false, eventsPerDay: 1},
  casual: {online: [2, 5], work: true, business: false, auto: false, eventsPerDay: 0.5},
  autowork: {online: [5], work: true, business: false, auto: true, eventsPerDay: 0.5},
};
// Career a new player realistically starts in: the best-paid entry rank whose rank-0 courses are free.
function entryCareer() {
  const free = Object.entries(D.CAREERS).filter(([id]) => (CAREER_REQS[id]?.[0] || []).every(c => !COURSES[c]?.cost));
  return free.sort((a, b) => b[1].ranks[0][1] - a[1].ranks[0][1])[0][0];
}
const rng = seed => () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
const tax = weekly => { let inc = weekly, t = 0; for (const [w, r] of D.TAX_BANDS) { const part = w == null ? inc : Math.min(inc, w); t += part * r; inc -= part; if (inc <= 0) break; } return Math.round(t); };

function simulate(origin, style, seed) {
  const o = D.ORIGINS[origin], home = D.HOMES[o.homes[0]], cfg = STYLES[style], rand = rng(seed * 7919 + 17), m = MODELS.provisions;
  const career = D.CAREERS[entryCareer()];
  const L = {created: {salary: 0, business: 0, events: 0}, removed: {food: 0, data: 0, transport: 0, rent: 0, tax: 0, events: 0, stock: 0}};
  let profit = 0, cash = o.cash + o.momo, weekIncome = 0, biz = null, firstBusiness = null, stable = null, property = null, lastOnline = -1, missedRent = 0, hungry = 0;
  const spend = (k, n) => { n = Math.round(n); if (cash < n) return false; cash -= n; L.removed[k] += n; return true; };
  const earn = (k, n) => { n = Math.round(n); cash += n; L.created[k] += n; if (k === 'salary') weekIncome += n; };
  const weeklyEssentials = home.rent + 7 * 3 * MEAL + 6 * FARE + 7 * DATA;
  const trailing = [];
  for (let day = 0; day < DAYS; day++) {
    const wd = day % 7, online = cfg.online.includes(wd) && rand() > 0.1, before = cash;
    if (online) {
      if (lastOnline >= 0 && day - lastOnline > 1) for (let i = 0; i < 3; i++) spend('food', OFFLINE_MEAL);   // capped offline meals on return
      lastOnline = day;
      for (let i = 0; i < 2; i++) if (!spend('food', MEAL)) hungry++;
      spend('data', DATA);
      // Personal life events: at most 3 a day; losses capped at GH₵200 each and GH₵250 a day, then a calm period.
      const events = Math.min(LIFE.perDay, Math.floor(cfg.eventsPerDay + rand()));
      let lost = 0;
      for (let e = 0; e < events; e++) {
        const r = rand();
        if (r < 0.3 && lost < LIFE.dailyLossCap) { const n = Math.min(40 + rand() * 120, LIFE.dailyLossCap - lost, cash); spend('events', n); lost += n; break; }
        if (r > 0.6) earn('events', 20 + rand() * 60);
      }
    }
    if (cfg.work && career.days.includes(wd)) {
      if (online && !cfg.auto) { if (spend('transport', FARE)) earn('salary', career.ranks[0][1]); }
      else if (cfg.auto && !online && day - lastOnline <= AUTO.catchUpDays && cash >= FARE) { spend('transport', FARE); earn('salary', career.ranks[0][1] * AUTO.payShare); }
    }
    if (cfg.business && online && !biz && cash >= m.startup + 10 * m.unit + home.rent) { spend('stock', m.startup + 10 * m.unit); biz = {operating: true, price: m.price, stock: 10, till: m.reserve, reputation: 0, level: 0, location: 'makola', last: Math.floor((BASE + day * 86400000) / PERIOD)}; firstBusiness = day; }
    if (biz && online) {
      const end = Math.floor((BASE + (day + 1) * 86400000) / PERIOD) - 1;
      for (let p = Math.max(biz.last + 1, end - 7); p <= end; p++) {
        const mid = p * PERIOD + PERIOD / 2, out = demandPeriod(biz, m, {hour: new Date(mid).getUTCHours(), open: Game.isOpen(Game.LOC.makola, mid), noise: rand(), skill: 0});
        biz.stock -= out.units; biz.till += out.revenue - out.expense; profit += out.revenue - out.cogs - out.expense;
      }
      biz.last = end;
      const take = Math.max(0, biz.till - m.reserve); earn('business', take); biz.till -= take;   // cash basis: stock purchases are counted as spending
      const refill = Math.min(10 - biz.stock, Math.floor(Math.max(0, cash - home.rent - 90) / m.unit)); if (refill > 0) { spend('stock', refill * m.unit); biz.stock += refill; }
    }
    if (wd === 6) { if (!spend('rent', home.rent)) missedRent++; spend('tax', tax(weekIncome)); weekIncome = 0; }
    trailing.push(cash - before); if (trailing.length > 7) trailing.shift();
    if (stable === null && day >= 6 && cash >= 2 * weeklyEssentials && trailing.reduce((a, b) => a + b, 0) >= 0) stable = day;
    if (property === null && cash >= ENTRY_PROPERTY + 2 * home.rent) property = day;
  }
  const earned = Object.values(L.created).reduce((a, b) => a + b, 0), spent = Object.values(L.removed).reduce((a, b) => a + b, 0);
  return {origin, style, cash, profit, firstBusiness, stable, property, missedRent, hungry, L, earned, spent, weeklyNet: (earned - spent) / (DAYS / 7)};
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const runs = [];
for (const origin of ['hustler', 'dbee']) for (const style in STYLES) for (let t = 0; t < TRIALS; t++) runs.push(simulate(origin, style, t));
const rows = [];
for (const origin of ['hustler', 'dbee']) for (const style in STYLES) {
  const r = runs.filter(x => x.origin === origin && x.style === style), days = k => r.filter(x => x[k] !== null).map(x => x[k]);
  rows.push({origin, style, medianEarnedPerWeek: Math.round(median(r.map(x => x.earned)) / (DAYS / 7)), medianSpentPerWeek: Math.round(median(r.map(x => x.spent)) / (DAYS / 7)),
    medianWeeklyNet: Math.round(median(r.map(x => x.weeklyNet))), wallet: {p10: pct(r.map(x => x.cash), .1), median: median(r.map(x => x.cash)), p90: pct(r.map(x => x.cash), .9)},
    stableShare: Math.round(days('stable').length / r.length * 100), medianStableDay: median(days('stable')), businessShare: Math.round(days('firstBusiness').length / r.length * 100), medianBusinessDay: median(days('firstBusiness')),
    entryPropertyShare: Math.round(days('property').length / r.length * 100), medianPropertyDay: median(days('property')), medianMissedRentWeeks: median(r.map(x => x.missedRent)),
    businessProfitPerWeek: Math.round(median(r.map(x => x.profit)) / (DAYS / 7))});
}
const sum = (k, side) => runs.reduce((s, x) => s + x.L[side][k], 0);
const flows = {created: Object.fromEntries(Object.keys(runs[0].L.created).map(k => [k, Math.round(sum(k, 'created') / runs.length)])),
  removed: Object.fromEntries(Object.keys(runs[0].L.removed).map(k => [k, Math.round(sum(k, 'removed') / runs.length)]))};
const wallets = runs.map(x => x.cash).sort((a, b) => b - a), total = wallets.reduce((a, b) => a + b, 0);
const gini = (() => { const s = [...wallets].sort((a, b) => a - b), n = s.length; let c = 0; s.forEach((v, i) => { c += (2 * (i + 1) - n - 1) * v; }); return c / (n * total); })();
const qualify = Object.entries(D.CAREERS).map(([id, c]) => ({id, name: c.name, entryPay: c.ranks[0][1], topPay: c.ranks.at(-1)[1], courses: (CAREER_REQS[id]?.[0] || []), fee: (CAREER_REQS[id]?.[0] || []).reduce((s, k) => s + (COURSES[k]?.cost || 0), 0)}));
const report = {generated: new Date().toISOString().slice(0, 10), days: DAYS, trials: TRIALS, entryCareer: D.CAREERS[entryCareer()].name, fareReturn: FARE, rows, flows,
  wealth: {gini: Math.round(gini * 100) / 100, top20Share: Math.round(wallets.slice(0, Math.ceil(wallets.length * .2)).reduce((a, b) => a + b, 0) / total * 1000) / 10},
  qualify, prices: {entryProperty: ENTRY_PROPERTY, vitz: VITZ, apartmentFrom: 1600000}, promoShifts: D.PROMO_SHIFTS};
fs.mkdirSync('../docs/master/stage12', {recursive: true});
fs.writeFileSync('../docs/master/stage12/economy-simulation.json', JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify({entry: report.entryCareer, fare: FARE, flows, wealth: report.wealth}));
for (const r of rows) console.log([r.origin, r.style, 'net/wk', r.medianWeeklyNet, 'earn/wk', r.medianEarnedPerWeek, 'spend/wk', r.medianSpentPerWeek, 'wallet', r.wallet.p10, r.wallet.median, r.wallet.p90,
  'stable', r.stableShare + '%', r.medianStableDay, 'biz', r.businessShare + '%', r.medianBusinessDay, r.businessProfitPerWeek, 'prop', r.entryPropertyShare + '%', r.medianPropertyDay, 'rentMiss', r.medianMissedRentWeeks].join(' '));
