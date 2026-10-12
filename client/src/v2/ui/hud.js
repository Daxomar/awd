// Heads-up display: identity + place + money on top, needs rings and mood, quest chips, the activity bar,
// venue zones and the bottom navigation.
import { h, ic, icf, cedi, DAYS } from './dom.js';
import {portrait} from './portrait.js';
import { G, money, accraClock, NEED_IC, NEED_COL, repTitle } from '../store.js';

export function buildHud(ui, act) {
  const ringSvg = (k) => `<svg viewBox="0 0 38 38" width="38" height="38"><circle cx="19" cy="19" r="16.5" fill="none" stroke="#efe5d2" stroke-width="3.5"/><circle class="rv" cx="19" cy="19" r="16.5" fill="none" stroke="${NEED_COL[k]}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="103.7" stroke-dashoffset="0"/></svg>`;
  const needs = h('div.needs', null, ...Object.keys(NEED_IC).map((k) => { const n = h('button.need', { 'data-k': k, onclick: () => act.needs(), 'aria-label': k }); n.innerHTML = ringSvg(k); n.append(h('span', null, ic(NEED_IC[k]))); return n; }));
  const moodEl = h('button.mood', { onclick: () => act.needs() }, h('span.face', null, 'icon:smiley'), h('span.mv', null, '0'));
  const badge = h('button.me-badge', { onclick: () => act.me() }, h('div.ring'), h('div.ini'), h('div.lvl', null, '0'));
  const placeName = h('div.place-name', null, '…'), placeMeta = h('div.place-meta');
  const moneyEl = h('button.money', { onclick: () => act.wallet() }, h('span.mt.tnum', null, 'GH₵0'), h('span.plus', { onclick: (e) => { e.stopPropagation(); act.topup(); } }, ic('plus')));
  const chips = h('div.chips'); const busy = h('div.busy', { hidden: true });
  const top = h('div.hud', null, h('div.hud-top', null, badge, h('button.place-box', { onclick: () => act.map() }, placeName, placeMeta), moneyEl), h('div.row', { style: { gap: '6px' } }, needs, moodEl));
  const zones = h('div.zones'); const chatlog = h('div.chatlog');
  const navBtn = (id, icon, label) => h('button', { 'data-nav': id, onclick: () => act.nav(id) }, ic(icon), label, h('span.badge', { hidden: true }));
  const nav = h('div.nav', null, navBtn('home', 'house', 'Home'), navBtn('map', 'map-trifold', 'Map'), h('button.phone-btn', { 'data-nav': 'phone', onclick: () => act.nav('phone') }, h('div.pb', { 'aria-label': 'Phone' }, icf('device-mobile'), h('span.badge', { hidden: true }))), navBtn('shop', 'shopping-bag', 'Shop'), navBtn('chat', 'chat-circle-dots', 'Chat'));
  const chatInput = h('input', { placeholder: 'Say something…', maxLength: 160, enterkeyhint: 'send' });
  const chatbar = h('form.chatbar', { hidden: true, onsubmit: (e) => { e.preventDefault(); const t = chatInput.value.trim(); if (t) act.say(t); chatInput.value = ''; chatbar.hidden = true; chatInput.blur(); } }, chatInput, h('button.btn.primary', { type: 'submit' }, ic('paper-plane-right')));
  const bottom = h('div.bottom', null, busy, zones, chatbar, nav);
  ui.append(top, chips, chatlog, bottom);
  const H = { top, zones, nav, chips, busy, chatbar, chatInput, chatlog, bottom,
    toggleChat() { chatbar.hidden = !chatbar.hidden; if (!chatbar.hidden) chatInput.focus(); },
    setNav(id) { nav.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('on', b.dataset.nav === id)); },
    badge(id, n) { const b = nav.querySelector(`[data-nav="${id}"] .badge`); if (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; } },
    stats() {
      const s = G.state; if (!s) return; const n = s.n || {};
      for (const el of needs.children) { const k = el.dataset.k, v = Math.max(0, Math.min(100, n[k] || 0)); el.querySelector('.rv').setAttribute('stroke-dashoffset', String(103.7 * (1 - v / 100))); el.classList.toggle('low', v < 20); }
      const m = s.mood ?? 0; moodEl.querySelector('.face').replaceChildren(ic(m > 15 ? 'smiley' : m > -15 ? 'smiley-meh' : 'smiley-sad')); moodEl.querySelector('.mv').textContent = (m > 0 ? '+' : '') + m;
      moneyEl.querySelector('.mt').textContent = cedi(money(), true);
      const lookKey=JSON.stringify(s.look);if(badge.lookKey!==lookKey){badge.lookKey=lookKey;badge.querySelector('.ini').replaceChildren(portrait(s.look,s.name,'hud-portrait'));} badge.querySelector('.ini').style.cssText = 'width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font:600 19px var(--disp);color:#fff;background:var(--green)';
      badge.querySelector('.lvl').textContent = s.rep || 0;
      const mc = m > 15 ? '#22c55e' : m > -15 ? '#ffc83d' : '#d7263d'; badge.querySelector('.ring').style.background = `conic-gradient(${mc} ${Math.round((m + 100) / 2)}%, #efe5d2 0)`; badge.querySelector('.ring').style.cssText += ';mask:radial-gradient(circle,transparent 24px,#000 25px);-webkit-mask:radial-gradient(circle,transparent 24px,#000 25px)';
    },
    clock() { const c = accraClock(); placeName.textContent = G.placeName || (G.state && G.state.busy && G.state.busy.travel ? 'On the road' : 'Accra'); placeMeta.innerHTML = ''; placeMeta.append(`${DAYS[c.wd]} ${String(c.hh).padStart(2, '0')}:${String(c.mm).padStart(2, '0')}`, h('span', null, '·'), h('span.dot', {style:{background:G.connected === false ? '#b55b35' : '#23745c'}}), G.connected === false ? 'Reconnecting…' : `${(G.online || 1).toLocaleString()} online`, ...(G.state && G.state.dumsor ? [h('span', { style: { color: '#d7263d' } }, '·  Dumsor')] : [])); },
    // busy / shift progress bar
    progress() {
      const s = G.state; const b = s && s.busy; const sh = s && s.shift;
      if (b && !b.travel) { const t = Date.now() + (G.offset || 0); const f = Math.max(0, Math.min(1, (t - b.start) / (b.end - b.start))); if (busy.hidden || busy.dataset.id !== b.id + b.start) { busy.hidden = false; busy.dataset.id = b.id + b.start; busy.innerHTML = ''; busy.append(h('div.bi', null, b.ic || ''), h('div.grow', null, h('div.bl', null, b.label || (b.mg ? 'Mini-game' : 'Busy')), h('div.bar', null, h('i'))), b.sleep || b.mg ? null : h('button.bx', { onclick: () => act.cancel(), 'aria-label': 'Stop' }, ic('x'))); } busy.querySelector('.bar i').style.width = (f * 100).toFixed(1) + '%'; }
      else if (sh) { const t = Date.now() + (G.offset || 0); const f = Math.min(1, (t - sh.start) / 3600000); if (busy.hidden || busy.dataset.id !== 'shift') { busy.hidden = false; busy.dataset.id = 'shift'; busy.innerHTML = ''; busy.append(h('div.bi', null, ''), h('div.grow', null, h('div.bl.shl'), h('div.bar', null, h('i'))), h('button.bx', { onclick: () => act.work() }, ic('briefcase'))); } busy.querySelector('.shl').textContent = `At work · ${Math.round((1 - f) * 60)} min left`; busy.querySelector('.bar i').style.width = (f * 100).toFixed(1) + '%'; }
      else if (!busy.hidden) { busy.hidden = true; busy.dataset.id = ''; }
    },
    quests() {
      chips.innerHTML = ''; const s = G.state; if (!s) return;
      if (G.gem) chips.append(h('button.qchip.gem', { onclick: () => act.gem() }, h('span.qi', null, 'icon:diamond'), h('span', null, `Gem hunt · GH₵${G.gem.prize}`, h('br'), h('span.muted', { style: { fontWeight: 600 } }, G.gem.area ? `Somewhere in ${G.gem.area}` : 'Hidden in Accra'))));
      const d = s.daily; if (d && d.list && d.list.length) { const done = d.list.filter((x) => x.done).length; chips.append(h('button.qchip', { onclick: () => act.goals() }, h('span.qi', null, done === d.list.length ? 'icon:check-circle' : 'icon:target'), h('span', null, `Today ${done}/${d.list.length}`, d.streak ? ` · ${d.streak}` : ''))); }
      const g = null; if (g) chips.append(h('button.qchip', { onclick: () => act.goals() }, h('span.qi', null, 'icon:map-pin'), h('span', null, g.label.length > 34 ? g.label.slice(0, 33) + '…' : g.label)));
      if (s.job && !s.shift) { const c = G.cat.careers[s.job.id]; chips.append(h('button.qchip', { onclick: () => act.work() }, h('span.qi', null, c.ic), h('span', null, c.ranks[s.job.rank][0], h('br'), h('span.muted', { style: { fontWeight: 600 } }, 'Start shift')))); }
      if (s.sick) chips.append(h('button.qchip', { onclick: () => act.needs() }, h('span.qi', null, 'icon:first-aid'), h('span', null, s.sick.kind || 'Sick', h('br'), h('span', { style: { color: '#d7263d' } }, 'See a doctor'))));
      if (!s.home) chips.append(h('button.qchip', { onclick: () => act.app('houses') }, h('span.qi', null, 'icon:house'), h('span', null, 'No home', h('br'), h('span', { style: { color: '#d7263d' } }, 'Find a room'))));
    },
    chatLine(name, text) { const d = h('div', null, h('b', null, name), text); chatlog.append(d); while (chatlog.children.length > 5) chatlog.firstChild.remove(); setTimeout(() => d.remove(), 12000); },
  };
  return H;
}
