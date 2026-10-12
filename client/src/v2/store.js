// Client-side mirror of the server state + derived helpers. The server is authoritative; this only renders.
export const G = {
  state: null, cat: null, myId: null, place: null, placeName: '', room: null, online: 0, places: {}, gem: null, gemsFound: 0,
  unreadDm: 0, dev: false, ev: {},
  on(t, f) { (this.ev[t] ||= []).push(f); return () => (this.ev[t] = this.ev[t].filter((x) => x !== f)); },
  emit(t, d) { for (const f of this.ev[t] || []) { try { f(d); } catch (e) { console.error('[store ' + t + ']', e); } } },
};
export const money = () => (G.state ? (G.state.cash || 0) + (G.state.momo || 0) : 0);
export const lvl = (k) => Math.floor((G.state && G.state.skills[k]) || 0);
export const has = (it) => !!(G.state && G.state.items && G.state.items[it]);
export function repTitle(rep = G.state ? G.state.rep : 0) { let t = ''; for (const [r, n] of (G.cat && G.cat.repTitles) || []) if (rep >= r) t = n; return t; }
export const loc = (id) => G.cat && G.cat.locs.find((l) => l.id === id);
export const accraNow = () => Date.now() + (G.offset || 0);
export function accraClock(t = accraNow()) { const d = new Date(t); return { h: d.getUTCHours() + d.getUTCMinutes() / 60, wd: d.getUTCDay(), hh: d.getUTCHours(), mm: d.getUTCMinutes(), day: Math.floor(t / 864e5) }; }
const inWin = (h, [a, b]) => (b > 24 ? h >= a || h < b - 24 : h >= a && h < b);
export function isOpen(l, t = accraNow()) { const { h, wd } = accraClock(t); if (!inWin(h, l.open)) return false; let w = wd; if (l.open[1] > 24 && h < l.open[1] - 24) w = (wd + 6) % 7; return !l.days || l.days.includes(w); }
export const hours = (o) => (o[0] === 0 && o[1] === 24 ? 'Open 24 hours' : `${String(o[0]).padStart(2, '0')}:00 – ${String(o[1] % 24).padStart(2, '0')}:00`);
// why an action can't be done right now (client preview; server re-checks)
export function actBlock(a, l) {
  const s = G.state; if (!s) return 'Loading'; const { h, wd } = accraClock();
  if (l && !isOpen(l)) return 'Closed now';
  if (a.days && !a.days.includes(wd)) return 'Not today';
  if (a.open && !inWin(h, a.open)) return `${a.open[0]}:00–${a.open[1] % 24}:00`;
  if (a.req) { if (a.req.flag && !s.flags[a.req.flag]) return 'Locked'; if (a.req.item && !s.items[a.req.item]) return `Needs ${(G.cat.items[a.req.item] || [a.req.item])[0]}`; for (const k in a.req.skill || {}) if (lvl(k) < a.req.skill[k]) return `${G.cat.skills[k]} ${a.req.skill[k]}`; }
  if (a.rest && s.gigRest && s.gigRest[a.id] > Date.now()) return `Rest ${Math.ceil((s.gigRest[a.id] - Date.now()) / 60000)}m`;
  return null;
}
// needs/effects summary for an action card
export function actEffects(a) {
  const out = []; const full = (G.cat && G.cat.actsFull && G.cat.actsFull[a.id]) || null; return out.concat(full || []);
}
export const NEED_IC = { hunger: 'icon:bowl-food', energy: 'icon:lightning', fun: 'icon:confetti', social: 'icon:chat-circle-dots', hygiene: 'icon:shower', bladder: 'icon:toilet' };
export const NEED_COL = { hunger: '#ff8a3d', energy: '#ffc83d', fun: '#ff4f8b', social: '#2f6bff', hygiene: '#13a89b', bladder: '#7c5cff' };
export const TAG_COL = { eat: '#ff8a3d', gig: '#0e7a4e', hustle: '#0e7a4e', social: '#2f6bff', party: '#ff4f8b', nightlife: '#7c5cff', dance: '#ff4f8b', crime: '#17150f', health: '#13a89b', shop: '#7c5cff', study: '#2f6bff', code: '#2f6bff', workout: '#d7263d', sport: '#d7263d', relax: '#13a89b', tour: '#ff8a3d', civic: '#4a4438', toilet: '#7c5cff', sleep: '#1d2236', bathe: '#13a89b', music: '#ff4f8b', luxury: '#d9a00f', travel: '#2f6bff', photo: '#ff8a3d', pitch: '#7c5cff', cook: '#ff8a3d', tv: '#2f6bff', games: '#d9a00f' };
export const actColor = (a) => { for (const t of a.tags || []) if (TAG_COL[t]) return TAG_COL[t]; return '#4a4438'; };
