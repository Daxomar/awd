// Gig mini-games: a 25-second tap game themed per job. Server checks duration and pays by stars (0–3).
import { h, ic, vibrate } from './dom.js';
const THEMES = {
  trotro: { title: 'Trotro fares', hint: 'Collect passenger fares. Avoid red checkpoint markers.', good: ['icon:user', 'icon:coins'], bad: ['icon:warning'] },
  waakye: { title: 'Lunch rush', hint: 'Serve the plates. Avoid red spoiled orders.', good: ['icon:bowl-food', 'icon:fork-knife'], bad: ['icon:x-circle'] },
  azonto: { title: 'Azonto session', hint: 'Catch the music notes. Avoid red off-beat markers.', good: ['icon:music-notes'], bad: ['icon:x-circle'] },
  bughunt: { title: 'Fix the bugs', hint: 'Find the bugs. Leave the green checks alone.', good: ['icon:bug'], bad: ['icon:check-circle'] },
  boxing: { title: 'Pad work', hint: 'Hit the targets. Avoid incoming punches.', good: ['icon:target'], bad: ['icon:hand-fist'] },
  bolu: { title: 'Bolt pickups', hint: 'Collect riders. Avoid red road hazards.', good: ['icon:user', 'icon:map-pin'], bad: ['icon:warning'] },
};
export function playMinigame(ui, id, onDone) {
  const T = THEMES[id] || THEMES.trotro; const DUR = 24000; let score = 0, miss = 0, done = false; const t0 = performance.now();
  const field = h('div.mg-field'); const sc = h('div.mg-score', null, '0'); const bar = h('i', { style: { width: '100%' } });
  const el = h('div.mg', null, h('div.mg-head', null, h('div.mg-title', null, T.title), sc), h('div.mg-time', null, bar), field, h('div.mg-hint', null, T.hint));
  ui.append(el);
  const spawn = () => {
    if (done) return; const bad = Math.random() < 0.22; const e = (bad ? T.bad : T.good)[Math.floor(Math.random() * (bad ? T.bad : T.good).length)];
    const r = field.getBoundingClientRect(); const t = h('button.mg-t' + (bad ? '.bad' : ''), null, e); t.style.left = 40 + Math.random() * (r.width - 80) + 'px'; t.style.top = 40 + Math.random() * (r.height - 80) + 'px';
    t.onpointerdown = () => { if (done) return; if (bad) { score = Math.max(0, score - 2); miss++; vibrate(40); t.style.background = '#ffb3b3'; } else { score++; vibrate(8); t.style.background = '#c9f2d8'; } sc.textContent = score; t.onpointerdown = null; setTimeout(() => t.remove(), 120); };
    field.append(t); const life = Math.max(650, 1300 - (performance.now() - t0) / 30); setTimeout(() => t.remove(), life);
    setTimeout(spawn, Math.max(330, 700 - (performance.now() - t0) / 60));
  };
  spawn(); setTimeout(spawn, 350);
  const iv = setInterval(() => { const f = 1 - (performance.now() - t0) / DUR; bar.style.width = Math.max(0, f * 100) + '%'; if (f <= 0) finish(); }, 100);
  function finish() {
    if (done) return; done = true; clearInterval(iv); const stars = score >= 30 ? 3 : score >= 20 ? 2 : score >= 10 ? 1 : 0;
    field.innerHTML = ''; field.append(h('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' } }, h('div', null, h('div', { style: { fontSize: '32px' }, 'aria-label': `${stars} of 3 stars` }, ...[0,1,2].map(i => h('span', { style: { color: i < stars ? 'var(--gold-d)' : '#c5ccc3' } }, ic('star')))), h('div', { style: { font: '800 26px var(--disp)', margin: '8px 0' } }, `${score} points`), h('button.btn.primary', { onclick: () => { el.remove(); onDone(stars); } }, 'Collect pay'))));
  }
}
