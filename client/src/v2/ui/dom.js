import {dialogKeys} from './overlays.js';
// Tiny DOM toolkit: h() element builder, money/time formatting, bottom sheets, toasts.
export function h(tag, props, ...kids) {
  const [t, ...cls] = tag.split('.'); const el = document.createElement(t || 'div'); if (cls.length) el.className = cls.join(' ');
  if (props) for (const k in props) { const v = props[k]; if (v == null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v; else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'html') el.innerHTML = v; else if (k in el && k !== 'list' && k !== 'type') el[k] = v; else el.setAttribute(k, v === true ? '' : v); }
  add(el, kids); return el;
}
function add(el, kids) { for (const c of kids) {
  if (c == null || c === false) continue;
  if (Array.isArray(c)) add(el, c);
  else if (c instanceof Node) el.append(c);
  else { const parts = String(c).split(/(icon:[a-z-]+)/g); for (const part of parts) el.append(part.startsWith('icon:') ? ic(part) : document.createTextNode(part)); }
} }
export const ic = (name, cls = '') => h('i', { class: `ph-bold ph-${name.replace(/^(ph-|icon:)/, '')} ${cls}`, 'aria-hidden': 'true' });
export const icf = (name, cls = '') => h('i', { class: `ph-fill ph-${name.replace(/^(ph-|icon:)/, '')} ${cls}`, 'aria-hidden': 'true' });
export const $ = (s, r = document) => r.querySelector(s);
export const cedi = (n, short = false) => { n = Math.round(n || 0); const neg = n < 0; n = Math.abs(n); let s;
  if (short && n >= 1e6) s = (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'; else if (short && n >= 1e4) s = (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k'; else s = n.toLocaleString('en-GH');
  return (neg ? '−' : '') + 'GH₵' + s; };
export const mins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m}m`);
export const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd'; };
export const clockStr = (t) => { const d = new Date(t); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const vibrate = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };

// ---------- bottom sheets ----------
const stack = [];
export function sheet(content, opts = {}) {
  const previousFocus=document.activeElement;
  const back = h('div.sheet-back' + (opts.tall ? '.tall' : ''));
  back.addEventListener('pointerdown',e=>e.stopPropagation());
  const body = h('div.sheet' + (opts.dark ? '.dark' : ''), {role:'dialog','aria-modal':'true','aria-label':opts.title||'Game menu',tabIndex:-1}, h('div.sheet-grip'), opts.title ? h('div.sheet-head', null, h('div.sheet-title', null, opts.title), opts.sub ? h('div.sheet-sub', null, opts.sub) : null, h('button.sheet-x', { onclick: () => close(), 'aria-label': 'Close' }, ic('x'))) : null, content);
  back.append(body); document.getElementById('ui').append(back);
  requestAnimationFrame(() => {back.classList.add('in');body.focus({preventScroll:true});});
  const close = () => { if (back.closing) return; back.closing=true;back.setAttribute('aria-hidden','true');back.inert=true;offKeys();back.classList.remove('in'); setTimeout(() => back.remove(), 260); const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1); opts.onclose && opts.onclose();if(!topSheet()&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true}); };
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  // drag the grip down to dismiss
  let y0 = null; body.querySelector('.sheet-grip').addEventListener('pointerdown', (e) => { y0 = e.clientY; body.setPointerCapture(e.pointerId); });
  body.addEventListener('pointermove', (e) => { if (y0 == null) return; const d = Math.max(0, e.clientY - y0); body.style.transform = `translateY(${d}px)`; });
  body.addEventListener('pointerup', (e) => { if (y0 == null) return; const d = e.clientY - y0; y0 = null; body.style.transform = ''; if (d > 90) close(); });
  const offKeys=dialogKeys(body,close,()=>topSheet()===api);
  const api = { el: body, back, close, set: (c) => { const old = body.querySelector('.sheet-body'); if (old) old.replaceWith(c); } };
  stack.push(api); return api;
}
export const closeSheets = () => { for (const s of [...stack]) s.close(); };
export const topSheet = () => stack[stack.length - 1];

// ---------- toasts ----------
const recentToasts=new Map();
export function toast(m, k = '') {
  if (!m) return; const key=k+':'+m,now=Date.now();if(now-(recentToasts.get(key)||0)<1500)return;recentToasts.set(key,now);if(recentToasts.size>50)for(const [k,t] of recentToasts)if(now-t>10000)recentToasts.delete(k);let box = document.getElementById('toasts'); if (!box) { box = h('div', { id: 'toasts' }); document.getElementById('ui').append(box); } const el = h('div.toast' + (k ? '.' + k : ''), null, m);
  box.append(el); while (box.children.length > 2) box.firstChild.remove();
  requestAnimationFrame(() => el.classList.add('in')); setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, Math.min(6000, 2600 + m.length * 35));
}
// centred celebration card (promotions, dream tiers, gems)
export function celebrate({ icon, title, text, cta = 'Nice!', tone = 'gold', onclose }) {
  const back = h('div.celebrate-back'); const close = () => { back.classList.remove('in'); setTimeout(() => back.remove(), 250); onclose && onclose(); };
  back.append(h('div.celebrate.' + tone, null, h('div.cel-burst'), h('div.cel-icon', null, icon), h('div.cel-title', null, title), text ? h('div.cel-text', null, text) : null, h('button.btn.primary.wide', { onclick: close }, cta)));
  document.getElementById('ui').append(back); requestAnimationFrame(() => back.classList.add('in')); vibrate(30); return close;
}
export function confirmBox({ title, text, yes = 'Yes', no = 'Cancel', danger }) {
  return new Promise((res) => { const s = sheet(h('div.sheet-body.confirm', null, text ? h('p.muted', null, text) : null, h('div.row.gap', null, h('button.btn.ghost.grow', { onclick: () => { res(false);s.close(); } }, no), h('button.btn.grow.' + (danger ? 'danger' : 'primary'), { onclick: () => { res(true);s.close(); } }, yes))), { title, onclose: () => res(false) }); });
}
