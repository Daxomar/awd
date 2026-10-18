// Place sheet (from the map) with transport choices, and the ride screen while you travel.
import { h, ic, sheet, cedi } from './dom.js';
import { G, loc, isOpen, hours, accraClock, accraNow } from '../store.js';

export function myPos() {
  const s = G.state; const pl = s && s.place;
  if (pl === 'home' && s.home && G.cat.homes[s.home]) return G.cat.homes[s.home];
  const l = pl && loc(pl); if (l) return l; return loc('circle');
}
// mirrors server rules.tripQuote: time depends on mode + distance + weekday rush hour; fares surge for Bolt/okada in rush
export function isRush() { const { h, wd } = accraClock(); return wd >= 1 && wd <= 5 && (G.cat.rush || [[6.5, 9.5], [16.5, 19.5]]).some(([a, b]) => h >= a && h < b); }
export function quote(dest, mode) {
  const T = G.cat.transport[mode]; const from = myPos(); const km = Math.hypot(dest.x - from.x, dest.z - from.z) / 1000 * 1.3; const rush = isRush();
  const fare = Math.round((T.base + T.perKm * km) * (rush ? T.surge || 1 : 1));
  const secs = Math.max(5, Math.round(Math.min(mode === 'walk' ? 120 : 75, (T.sb + T.sk * km) * (rush ? T.rush || 1 : 1))));
  // "real" Accra minutes shown for flavour (game seconds ≈ compressed travel)
  const realMin = Math.max(2, Math.round((km / (mode === 'walk' ? 5 : mode === 'okada' ? 28 : 22)) * 60 * (rush && mode !== 'walk' ? (T.rush || 1) * 1.6 : 1)));
  return { km, fare, secs, rush, realMin, tooFar: T.maxKm ? km > T.maxKm : false };
}
const MODES = ['walk', 'trotro', 'okada', 'taxi', 'bolu', 'car'];
export function openPlace(id, act, options={}) {
  const s = G.state; const isHome = id === 'home'; const l = isHome ? null : loc(id);
  const dest = isHome ? (s.home ? { ...G.cat.homes[s.home], name: G.cat.homes[s.home].name } : null) : l; if (!dest) return act.toast('You have no home yet. Check the Houses app.', 'bad');
  const here = s.place === id; const open = isHome || isOpen(l); const people = isHome ? 0 : G.places[id] || 0;
  const hasCar=s.car || (s.rental?.until>accraNow()); let sel = options.mode==='walk'?'walk':hasCar ? 'car' : 'trotro';
  const ridesEl = h('div.rides'); const goBtn = h('button.btn.primary.wide');
  const draw = () => {
    ridesEl.innerHTML = '';
    const qs = {}; for (const m of MODES) if (m !== 'car' || hasCar) qs[m] = quote(dest, m);
    const fastest = Math.min(...Object.entries(qs).filter(([, q]) => !q.tooFar).map(([, q]) => q.secs)); const cheapest = Math.min(...Object.entries(qs).filter(([m, q]) => !q.tooFar && m !== 'walk').map(([, q]) => q.fare));
    if (qs[sel] && qs[sel].tooFar) sel = hasCar ? 'car' : 'trotro';
    for (const m of Object.keys(qs)) { const T = G.cat.transport[m]; const q = qs[m];
      const badge = q.tooFar ? h('div.rb.off', null, 'Too far') : q.secs === fastest ? h('div.rb.fast', null, 'Fastest') : m !== 'walk' && q.fare === cheapest ? h('div.rb.cheap', null, 'Cheapest') : null;
      ridesEl.append(h('button.ride' + (sel === m ? '.sel' : ''), { disabled: q.tooFar, onclick: () => { sel = m; draw(); } }, badge, h('div.re', null, T.ic), h('div.rn', null, m === 'bolu' ? 'Bolt' : T.name.replace(' (drop)', '')), h('div.rp', null, q.fare ? cedi(q.fare) : 'Free'), h('div.rt', null, q.tooFar ? `${q.km.toFixed(1)} km` : `${q.secs}s · ~${q.realMin} min`))); }
    const q = qs[sel]; const T = G.cat.transport[sel];
    noteEl.innerHTML = ''; noteEl.append(h('span', null, `${q.km.toFixed(1)} km · `, T.note || '')); if (q.rush) noteEl.append(h('span.rush', null, '  Rush hour: traffic is heavy' + (T.surge > 1 ? `, ${T.name.replace(' (drop)', '')} fares surging` : '')));
    goBtn.textContent = here ? 'You are here' : `Go · ${q.fare ? cedi(q.fare) : 'Free'} · ${q.secs}s`; goBtn.disabled = here || !!(s.busy) || !!s.shift || q.tooFar;
  };
  const noteEl = h('div.ride-note');
  goBtn.onclick = () => { act.travel(id, sel, dest.name); sh.close(); };
  const preview = isHome ? [] : l.acts.slice(0, 8);
  const hasSpicy = !isHome && l.acts?.some(a => a.tags?.includes('spicy'));
  const hasCrime = !isHome && l.acts?.some(a => a.tags?.includes('crime'));
  const isHotspot = people >= 2;
  const body = h('div.sheet-body', null,
    h('div.place-hero', null, h('div.ph', null, isHome ? 'icon:house' : l.ic), h('div.grow', null,
      h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } },
        h('span.status.' + (open ? 'open' : 'closed'), null, open ? 'Open' : 'Closed'),
        isHome ? null : h('span.pill', null, hours(l.open)),
        people ? h('span.pill', null, h('span.dot'), `${people} here`) : null,
        isHotspot ? h('span.pill', { style: { background: '#fef3c7', color: '#b45309', fontWeight: '700' } }, '🔥 Hotspot') : null,
        hasSpicy ? h('span.pill', { style: { background: '#fdf2f8', color: '#be185d', fontWeight: '700' } }, '🌶️ Nightlife') : null,
        hasCrime ? h('span.pill', { style: { background: '#fef2f2', color: '#b91c1c', fontWeight: '700' } }, '⚠️ High-Risk') : null
      ),
      h('div.muted', { style: { fontSize: '13.5px', marginTop: '6px' } }, isHome ? `${G.cat.homes[s.home].area} · your place` : l.blurb))),
    preview.length ? h('div', null, h('div.section', null, 'Things to do & opportunities'), h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } }, ...preview.map((a) => {
      const isSpicy = a.tags?.includes('spicy');
      const isCrime = a.tags?.includes('crime');
      const isGig = a.tags?.includes('gig');
      const style = isSpicy ? { background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8' }
        : isCrime ? { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }
        : isGig ? { background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }
        : {};
      return h('span.pill', { style }, (isSpicy ? '🌶️ ' : isCrime ? '⚠️ ' : (a.ic ? a.ic + ' ' : '')), a.label.length > 28 ? a.label.slice(0, 27) + '…' : a.label);
    }))) : null,
    h('div.section', null, 'How you dey go?'), ridesEl, noteEl, goBtn);
  draw(); const sh = sheet(body, { title: isHome ? 'Home' : l.name, sub: isHome ? dest.name : l.area });
  return sh;
}
// ---------- ride screen: 3D chase-cam ride (scene/ride.js) + route card + live chatter
export function rideScreen(ui, { mode, to, from, start, end, rush, ride, look, car, paint }) {
  const T = G.cat.transport[mode] || {}; const hh = accraClock().h;
  ride.start({ mode, look, car, paint, to, rush, hour: hh });
  const bar = h('i'); const eta = h('span.tnum');
  const ov = h('div.ridescreen', null,
    h('div.ride-top', null, h('div.row', { style: { justifyContent: 'space-between', marginBottom: '6px' } }, h('div.row', { style: { gap: '6px' } }, h('span.pill', null, T.ic || 'icon:bus', ' ', (T.name || mode).replace(' (drop)', '')), rush ? h('span.pill.rushp', null, ' Rush hour') : null), eta),
      h('div.ride-route', null, h('div.grow', null, h('div.muted', { style: { fontSize: '12.5px' } }, 'From ' + (from || 'here')), h('div.to', null, to))), h('div.ride-bar', null, bar)),
    h('div.ride-hint', null, 'Drag to look around'));
  ui.append(ov);
  const tick = setInterval(() => { const t = Date.now() + (G.offset || 0); const f = Math.max(0, Math.min(1, (t - start) / (end - start))); bar.style.width = (f * 100).toFixed(1) + '%'; eta.textContent = `${Math.max(0, Math.ceil((end - t) / 1000))}s`; }, 200);
  return () => { clearInterval(tick); ride.stop(); ov.remove(); };
}
