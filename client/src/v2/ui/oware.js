// Oware board (Abapa). Your pits are always the bottom row; sowing runs counter-clockwise.
import { h, ic, cedi, vibrate, sheet } from './dom.js';
import { net } from '../net.js';

let cur = null;
const CSS = `.ow{position:absolute;inset:0;z-index:45;background:radial-gradient(120% 80% at 50% 30%,#3b2a1c,#1b130c);display:flex;flex-direction:column;padding:calc(var(--safe-t) + 14px) 14px calc(var(--safe-b) + 16px);color:#fff}
.ow-top{display:flex;align-items:center;gap:10px}.ow-top .t{flex:1;font:800 20px var(--disp)}.ow-x{width:40px;height:40px;border-radius:13px;background:rgba(255,255,255,.12);display:grid;place-items:center;font-size:18px;color:#fff}
.ow-pl{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.08);border-radius:16px;padding:10px 12px;margin:10px 0}.ow-pl .nm{flex:1;font-weight:700}.ow-pl .sc{font:800 26px var(--disp);color:#ffc83d}.ow-pl.turn{box-shadow:0 0 0 2px #ffc83d inset}
.ow-board{flex:1;display:flex;align-items:center;justify-content:center}
.ow-wood{width:100%;max-width:440px;border-radius:30px;padding:16px 12px;background:linear-gradient(180deg,#a8703f,#7a4a24 55%,#6b3f1e);box-shadow:inset 0 3px 0 rgba(255,255,255,.25),inset 0 -6px 0 rgba(0,0,0,.25),0 18px 40px rgba(0,0,0,.5)}
.ow-row{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin:6px 0}
.ow-pit{aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 50% 40%,#4b2a12,#2e180a 70%);box-shadow:inset 0 5px 10px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.18);position:relative;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:2px;padding:9px;transition:transform .12s}
.ow-pit i{width:8px;height:8px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#f5ead2,#b9a27a)}
.ow-pit b{position:absolute;bottom:-3px;right:-3px;min-width:20px;height:20px;border-radius:10px;background:#17150f;color:#ffc83d;font:800 11px/20px var(--disp);text-align:center;padding:0 4px}
.ow-pit.can{box-shadow:inset 0 5px 10px rgba(0,0,0,.6),0 0 0 3px #ffc83d;cursor:pointer}.ow-pit.can:active{transform:scale(.92)}
.ow-pit.hit{animation:owhit .6s}@keyframes owhit{50%{box-shadow:inset 0 5px 10px rgba(0,0,0,.6),0 0 0 4px #ff4f8b}}
.ow-mid{height:10px}.ow-info{text-align:center;font-weight:600;color:#e8d9c2;min-height:22px;margin:10px 0}
.ow-res{position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.55)}.ow-res>div{background:var(--paper);color:var(--ink);border-radius:26px;padding:24px 20px;text-align:center;width:min(320px,88%)}`;
export function owareView(ui, m) {
  if (!document.getElementById('owcss')) document.head.append(h('style', { id: 'owcss', html: CSS }));
  if (!cur || cur.id !== m.id) { if (cur) cur.el.remove(); cur = { id: m.id, el: h('div.ow') }; ui.append(cur.el); }
  const me = m.you, them = 1 - me; const myTurn = m.turn === me && !m.over;
  const pit = (i) => { const n = m.board[i]; const can = myTurn && Math.floor(i / 6) === me && n > 0; const el = h('button.ow-pit' + (can ? '.can' : '') + (m.last && m.last.last === i ? '.hit' : ''), { onclick: () => { if (!can) return; vibrate(10); net.send({ t: 'oware_move', id: m.id, pit: i }); } });
    for (let k = 0; k < Math.min(n, 14); k++) el.append(h('i')); if (n) el.append(h('b', null, n)); return el; };
  // my row left→right = my pits in sowing order; their row is reversed so the board reads counter-clockwise
  const myRow = [0, 1, 2, 3, 4, 5].map((k) => me * 6 + k), theirRow = [5, 4, 3, 2, 1, 0].map((k) => them * 6 + k);
  const secs = Math.max(0, Math.round((m.deadline - (Date.now() + (window.__G ? window.__G.offset || 0 : 0))) / 1000));
  const info = m.over ? '' : myTurn ? `Your move · ${secs}s` : `${m.names[them]} is thinking…`;
  const lastTxt = m.last && m.last.captured ? `${m.last.side === me ? 'You' : m.names[them]} captured ${m.last.captured}!` : '';
  cur.el.innerHTML = '';
  cur.el.append(h('div.ow-top', null, h('div.t', null, 'Oware', m.pot ? h('span', { style: { color: '#ffc83d', fontSize: '15px', marginLeft: '8px' } }, `Pot ${cedi(m.pot)}`) : h('span', { style: { color: '#e8d9c2', fontSize: '14px', marginLeft: '8px', fontWeight: 600 } }, 'Practice')),
      h('button.ow-x', { onclick: (e) => { if (m.over) return close(); const b = e.currentTarget; if (b.dataset.arm) return net.send({ t: 'oware_resign', id: m.id }); b.dataset.arm = 1; b.style.background = '#d7263d'; b.title = 'Tap again to resign'; setTimeout(() => { delete b.dataset.arm; b.style.background = ''; }, 2500); } }, ic(m.over ? 'x' : 'flag'))),
    h('div.ow-pl' + (m.turn === them && !m.over ? '.turn' : ''), null, h('div', { style: { fontSize: '22px' } }, ic(m.ai ? 'cpu' : 'user')), h('div.nm', null, m.names[them]), h('div.sc', null, m.store[them])),
    h('div.ow-board', null, h('div.ow-wood', null, h('div.ow-row', null, ...theirRow.map(pit)), h('div.ow-mid'), h('div.ow-row', null, ...myRow.map(pit)))),
    h('div.ow-info', null, lastTxt || info),
    h('div.ow-pl' + (myTurn ? '.turn' : ''), null, h('div', { style: { fontSize: '22px' } }, ic('user')), h('div.nm', null, 'You'), h('div.sc', null, m.store[me])),
    h('div', { style: { textAlign: 'center', fontSize: '12.5px', color: '#bfae93' } }, 'Tap a glowing pit to sow. Land on 2 or 3 in their row to capture. First to 25 wins.'));
  if (m.over) { const W = m.over.winner; const won = W === me; cur.el.append(h('div.ow-res', null, h('div', null, h('div', { style: { fontSize: '56px' } }, W < 0 ? 'icon:handshake' : won ? 'icon:trophy' : 'icon:circle'), h('div', { style: { font: '800 26px var(--disp)', margin: '8px 0' } }, W < 0 ? 'Draw!' : won ? 'You win!' : 'You lost'), h('div.muted', { style: { marginBottom: '16px' } }, m.over.forfeit != null ? (won ? 'Your opponent left or ran out of time.' : 'You resigned or ran out of time.') : `${m.store[me]} – ${m.store[them]}`, won && m.over.prize ? h('div', { style: { color: 'var(--green)', fontWeight: 800, marginTop: '6px' } }, `+${cedi(m.over.prize)}`) : null), h('button.btn.primary.wide', { onclick: close }, 'Done')))); }
  clearTimeout(cur.t); if (!m.over) cur.t = setTimeout(() => cur && cur.id === m.id && owareView(ui, m), 1000);
}
function close() { if (cur) { clearTimeout(cur.t); cur.el.remove(); cur = null; } }
export function owareChallenge(pid, name, act) {
  const s = sheet(h('div.sheet-body', null, h('p.muted', { style: { margin: '0 0 12px' } }, 'Ghana’s classic. Winner takes the pot (5% house fee). Practice is free.'), h('div.list', null, ...[0, 20, 50, 100, 200].map((st) => h('button.li', { onclick: () => { net.send({ t: 'oware_invite', id: pid, stake: st }); s.close(); } }, h('div.lt', null, st ? 'icon:wallet' : 'icon:handshake'), h('div.lm', null, h('div.l1', null, st ? `Play for ${cedi(st)}` : 'Friendly game'), h('div.l2', null, st ? `Pot ${cedi(st * 2)}` : 'No money involved')))))), { title: `Challenge ${name}`, sub: 'Oware' });
}
