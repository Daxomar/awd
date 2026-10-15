// The handset: frame, status bar, Dynamic Island, springboard with widgets + app grid + dock, app windows with
// iOS-style navigation, and notification banners (inside the phone and over the game when the phone is down).
import { h, ic, icf, cedi, clockStr, vibrate } from '../ui/dom.js';
import { G, accraNow, money } from '../store.js';
import {dialogKeys} from '../ui/overlays.js';
import './phone.css';
import '../ui/phone-refined.css';

const SIG = `<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>`;
const WIFI = `<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3C13.5 1.5 10.9.4 8 .4S2.5 1.5.5 3.4l1.2 1.3C3.4 3.1 5.6 2.2 8 2.2zm0 3.6c1.4 0 2.7.5 3.7 1.4l1.2-1.3C11.6 4.7 9.9 4 8 4s-3.6.7-4.9 1.9l1.2 1.3c1-.9 2.3-1.4 3.7-1.4zM8 9.4c-.6 0-1.1.2-1.5.6L8 11.6l1.5-1.6c-.4-.4-.9-.6-1.5-.6z" fill="currentColor"/></svg>`;
const BATT = (p) => `<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="${Math.max(2, 20 * p)}" height="9" rx="2" fill="${p < 0.2 ? '#ff3b30' : 'currentColor'}"/><path d="M25 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" fill="currentColor" opacity=".45"/></svg>`;
// generic Accra-at-dusk wallpaper (no landmarks reproduced, just a skyline mood)
const WALL = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1b4f"/><stop offset=".38" stop-color="#b8456b"/><stop offset=".62" stop-color="#ff9a52"/><stop offset=".78" stop-color="#ffd27a"/></linearGradient><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9f5a"/><stop offset="1" stop-color="#3a2346"/></linearGradient></defs><rect width="390" height="844" fill="url(#s)"/><circle cx="250" cy="560" r="70" fill="#ffe3a0" opacity=".95"/><g fill="#3b1f3f" opacity=".55"><rect x="0" y="560" width="40" height="120"/><rect x="44" y="530" width="30" height="150"/><rect x="78" y="575" width="52" height="105"/><rect x="134" y="500" width="26" height="180"/><rect x="164" y="548" width="44" height="132"/><rect x="300" y="520" width="36" height="160"/><rect x="340" y="560" width="50" height="120"/></g><g fill="#2a1630"><path d="M0 640h390v204H0z"/><path d="M60 640c4-60 8-90 10-120M70 520c-20-6-36 2-46 10M70 520c18-10 36-8 46 2M70 520c-6-14-20-22-34-22M70 520c8-14 24-18 36-14" stroke="#2a1630" stroke-width="5" fill="none"/><path d="M330 640c-3-50-6-80-8-104M322 536c-18-6-32 0-42 8M322 536c16-9 32-7 42 2M322 536c-4-13-17-20-30-20M322 536c7-12 21-15 32-11" stroke="#2a1630" stroke-width="5" fill="none"/></g><rect y="640" width="390" height="204" fill="url(#w)" opacity=".35"/><g fill="#ffd27a" opacity=".8"><rect x="20" y="700" width="4" height="4"/><rect x="90" y="680" width="4" height="4"/><rect x="180" y="720" width="4" height="4"/><rect x="260" y="690" width="4" height="4"/><rect x="350" y="710" width="4" height="4"/></g></svg>`);

export class Phone {
  constructor(ui, apps) {
    this.ui = ui; this.apps = apps; this.open = false; this.win = null; this.notifTimer = null;
    this.back = h('div.phone-back', { hidden: true, onpointerdown: (e) => { if (e.target === this.back) this.close(); } });
    this.island = h('div.island'); this.status = h('div.statusbar'); this.home = h('div.springboard', { style: { backgroundImage: `url("${WALL}")` } });
    this.ind = h('div.homeind'); const hit = h('div.homehit', { onclick: () => (this.win ? this.closeApp() : this.close()) });
    this.screen = h('div.screen-ph', null, this.home, this.status, this.island, this.ind, hit);
    this.handset = h('div.handset', null, h('i.btn-side.b1'), h('i.btn-side.b2'), h('i.btn-side.b3'), h('i.btn-side.b4'), this.screen);
    const controls=h('div.phone-return',null,h('button',{'aria-label':'Phone home',onclick:()=>this.closeApp()},ic('squares-four'),'Phone home'),h('button',{'aria-label':'Put phone away',onclick:()=>this.close()},ic('device-mobile-slash'),'Back to Accra'));
    this.back.setAttribute('role','dialog');this.back.setAttribute('aria-label','Your phone');this.back.setAttribute('aria-modal','true');this.back.append(this.handset,controls);ui.append(this.back);
    // swipe up from the bottom edge = home
    let y0 = null; this.screen.addEventListener('pointerdown', (e) => { const r = this.screen.getBoundingClientRect(); if (e.clientY > r.bottom - 34) y0 = e.clientY; });
    this.screen.addEventListener('pointerup', (e) => { if (y0 != null && y0 - e.clientY > 40) { this.win ? this.closeApp() : this.close(); } y0 = null; });
    this.banner=h('div.notif',{hidden:true,role:'button',tabIndex:-1,'aria-label':'Open notification',onkeydown:e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();this.banner.onclick?.();}}}); ui.append(this.banner);
    setInterval(() => this.tickStatus(), 1000 * 10); this.tickStatus();
  }
  tickStatus() {
    const t = clockStr(accraNow()); const dark = !!(this.win && !this.win.el.classList.contains('darkapp'));
    this.status.className = 'statusbar' + (dark ? ' dark' : ''); this.ind.className = 'homeind' + (dark ? ' dark' : '');
    const batt = Math.max(0.12, ((G.state && G.state.n && G.state.n.energy) || 70) / 100);
    this.status.innerHTML = `<span class="tnum">${t}</span><span class="sr">${SIG}${WIFI}${BATT(batt)}</span>`;
  }
  show(appId, arg) {
    if (!this.open) { this.previousFocus=document.activeElement;this.offKeys=dialogKeys(this.back,()=>this.win?this.closeApp():this.close(),()=>this.open&&!document.querySelector('.sheet-back,.ios-alert'));this.open = true; this.back.hidden = false;this.back.inert=false;this.back.removeAttribute('aria-hidden');requestAnimationFrame(() => {this.back.classList.add('in');this.back.querySelector('.phone-return button').focus({preventScroll:true});}); this.renderHome(); vibrate(10); }
    if (appId) this.openApp(appId, arg);this.onchange?.();
  }
  close() { if (!this.open) return;this.cancelAlerts(); const w = this.win; this.win = null; if(w){w.closed=true;w.onclose?.();} this.offKeys?.();this.back.classList.remove('in');this.back.inert=true;this.back.setAttribute('aria-hidden','true');this.open = false; setTimeout(() => { w?.el.remove(); if (!this.open) { this.back.hidden = true; this.home.classList.remove('behind'); } }, 360); this.onclose?.();this.onchange?.();if(this.previousFocus?.isConnected)this.previousFocus.focus({preventScroll:true}); }
  badgeOf(a) { return a.badge ? a.badge() : 0; }
  renderHome() {
    const s = G.state; if (!s) return; const t = accraNow(); const d = new Date(t);
    
    const widgets = h('div.widgets', null,
      h('div.widget', { onclick: () => this.openApp('momo') }, h('div.wt', null, 'MoMo wallet'), h('div.ws', null, 'Balance'), h('div.wbig.tnum', { style: { fontSize: money() >= 1e6 ? '26px' : '30px' } }, cedi(money(), true)), h('div.ws', null, `Cash ${cedi(s.cash, true)} · MoMo ${cedi(s.momo, true)}`)),
      h('div.widget', { onclick: () => this.openApp('goals') }, h('div.wt', null, 'Today'), h('div.ws', null, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] + ' ' + d.getUTCDate()), h('div.wbig', null, clockStr(t)), h('div.ws', null, 'Accra time · GMT')));
    const grid = this.apps.filter((a) => !a.dock && !a.hidden);
    const appBtn = (a) => { const b = this.badgeOf(a); return h('button.app', { onclick: (e) => this.openApp(a.id, null, e.currentTarget) }, h('div.ico', { style: { background: a.bg } }, a.emoji ? h('span', { style: { fontSize: '30px' } }, a.emoji) : icf(a.icon)), h('div.an', null, a.name), b ? h('div.ab', null, b > 99 ? '99+' : b) : null, a.isNew ? h('div.new', null, 'NEW') : null); };
    const pages = h('div.pages', null, h('div.page', null, widgets, h('div.apps', null, ...grid.slice(0, 12).map(appBtn))), grid.length > 12 ? h('div.page', null, h('div.apps', { style: { marginTop: '10px' } }, ...grid.slice(12).map(appBtn))) : null);
    const dots = h('div.dots', null, h('i.on'), grid.length > 12 ? h('i') : null);
    pages.addEventListener('scroll', () => { const i = Math.round(pages.scrollLeft / pages.clientWidth); dots.querySelectorAll('i').forEach((d2, k) => d2.classList.toggle('on', k === i)); });
    this.home.innerHTML = ''; this.home.append(pages, dots, h('div.dock', null, ...this.apps.filter((a) => a.dock).map(appBtn)));
  }
  openApp(id, arg, fromEl) {
    const a = this.apps.find((x) => x.id === id); if (!a) return; if (!this.open) return this.show(id, arg);
    if (this.win) { this.win.closed=true;this.win.onclose?.();this.win.el.remove(); }
    const el = h('div.appwin' + (a.white ? '.white' : '') + (a.darkapp ? '.darkapp' : ''));
    if (fromEl) { const r = fromEl.getBoundingClientRect(), R = this.screen.getBoundingClientRect(); el.style.setProperty('--ox', `${r.left + r.width / 2 - R.left}px`); el.style.setProperty('--oy', `${r.top + r.height / 2 - R.top}px`); }
    this.screen.insertBefore(el, this.status); this.home.classList.add('behind');
    const win = (this.win = new AppWin(this, el, a)); try { a.open(win, arg); } catch (e) { console.error(e); win.page(a.name, () => h('div.empty', null, 'Something went wrong.')); }
    this.tickStatus(); vibrate(6);
  }
  cancelAlerts(){for(const alert of this.back.querySelectorAll('.ios-alert'))alert.dispatchEvent(new Event('cancel'));}
  closeApp() { this.cancelAlerts();const w = this.win; if (!w) return; this.win = null; w.closed = true; w.el.classList.add('closing'); this.home.classList.remove('behind'); setTimeout(() => w.el.remove(), 240); this.renderHome(); this.tickStatus(); w.onclose && w.onclose(); }
  refresh() { if (this.win && this.win.refresh) this.win.refresh(); else if (this.open && !this.win) this.renderHome(); }
  // iOS-style banner; tap → open the app
  notify({ app, title, body, icon, bg, arg }) {
    const A = this.apps.find((x) => x.id === app) || {}; const b = this.banner; b.innerHTML = '';
    b.append(h('div.ni', { style: { background: bg || A.bg || '#34c759' } }, icon ? h('span', { style: { fontSize: '20px' } }, icon) : icf(A.icon || 'bell')), h('div.nm', null, h('div.nh', null, h('span', null, (A.name || 'Accra').toUpperCase()), h('span', null, 'now')), h('div.nt', null, title), body ? h('div.nb', null, body) : null));
    const dismiss=()=>{b.classList.remove('in');b.tabIndex=-1;setTimeout(()=>{if(!b.classList.contains('in'))b.hidden=true;},400);};
    b.onclick = () => { dismiss();this.show(app, arg); };
    if (this.open) { b.style.top = 'calc(var(--safe-t) + 60px)'; } else b.style.top = '';
    b.hidden=false;b.tabIndex=0;b.classList.add('in'); vibrate([10, 40, 10]); clearTimeout(this.notifTimer); this.notifTimer = setTimeout(dismiss, 4200);
    this.island.classList.add('live'); setTimeout(() => this.island.classList.remove('live'), 1600);
  }
}
// an app window: iOS navigation stack with large titles
export class AppWin {
  constructor(phone, el, app) { this.phone = phone; this.el = el; this.app = app; this.stack = []; }
  page(title, render, opts = {}) {
    const nb = h('div.navbar'); const body = h('div.appbody'); const tab = opts.tabs ? h('div.tabbar') : null;
    const backLbl = this.stack.length ? this.stack[this.stack.length - 1].title : null;
    nb.append(h('div.nb-row', null, backLbl ? h('button.back', { onclick: () => this.pop() }, ic('caret-left'), (opts.small ? backLbl.length > 8 : backLbl.length > 14) ? 'Back' : backLbl) : h('button.back', { onclick: () => this.phone.closeApp() }, ic('caret-left'), 'Home'), opts.action ? h('button.nb-act', { onclick: opts.action[1] }, opts.action[0]) : h('span')),
      opts.small ? h('div.nb-mid', null, title) : h('h1', null, title));
    if (opts.small) nb.style.paddingBottom = '10px';
    const view = { title, render, opts, nb, body, tab };
    if (this.cur) this.cur.wrap.remove();
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, animation: this.stack.length ? 'fadeup .2s' : '' } }, nb, body, tab);
    view.wrap = wrap; this.el.append(wrap); this.stack.push(view); this.cur = view; this.draw(); return view;
  }
  draw() { const v = this.cur; if (!v) return; const st = v.body.scrollTop; v.body.innerHTML = ''; const c = v.render(v); if (c) v.body.append(c); v.body.scrollTop = st; }
  pop() { const v = this.stack.pop(); v.wrap.remove(); this.cur = this.stack[this.stack.length - 1]; if (this.cur) { this.el.append(this.cur.wrap); this.draw(); } else this.phone.closeApp(); }
  refresh() { if (!this.closed) this.draw(); }
}
// iOS-style alerts inside the handset (falls back to the game screen if the phone is closed)
export function iosAlert({ title, text, buttons = [['OK', 'ok']], input }) {
  return new Promise((res) => {
    const host = document.querySelector('.phone-back:not([hidden]) .screen-ph') || document.getElementById('ui');
    const inp = input ? h('input', { placeholder: input, type: input.toLowerCase().includes('email') ? 'email' : 'text', style: { width: '100%', height: '34px', borderRadius: '8px', border: '.5px solid #c7c7cc', padding: '0 8px', fontSize: '15px', marginTop: '10px', background: '#fff' } }) : null;
    const back = h('div.ios-alert', {role:'dialog','aria-modal':'true','aria-label':title, style: { position: 'absolute', inset: '0', zIndex: 80, background: 'rgba(0,0,0,.3)', display: 'grid', placeItems: 'center', animation: 'fadeup .15s' } });
    let settled=false;const previous=document.activeElement;const done=(v)=>{if(settled)return;settled=true;offKeys();back.remove();if(previous?.isConnected)previous.focus({preventScroll:true});res(v);};
    const offKeys=dialogKeys(back,()=>done(null));back.addEventListener('cancel',()=>done(null),{once:true});
    back.append(h('div', { style: { width: '270px', borderRadius: '14px', background: 'rgba(242,242,247,.97)', overflow: 'hidden', textAlign: 'center', fontFamily: '-apple-system, var(--body)', color: '#000' } },
      h('div', { style: { padding: '18px 16px 14px' } }, h('div', { style: { fontWeight: 600, fontSize: '17px' } }, title), text ? h('div', { style: { fontSize: '13px', marginTop: '4px', lineHeight: 1.35 } }, text) : null, inp),
      h('div', { style: { display: 'flex', borderTop: '.5px solid rgba(60,60,67,.3)' } }, ...buttons.map(([l, v, style], i) => h('button', { style: { flex: 1, height: '44px', fontSize: '17px', color: style === 'destructive' ? '#ff3b30' : '#007aff', fontWeight: i === buttons.length - 1 ? 600 : 400, borderLeft: i ? '.5px solid rgba(60,60,67,.3)' : '0' }, onclick: () => done(inp ? (v ? inp.value.trim() : null) : v) }, l)))));
    host.append(back); if (inp) setTimeout(() => inp.focus(), 50);
  });
}
export const iosConfirm = (title, text, yes = 'Confirm', danger) => iosAlert({ title, text, buttons: [['Cancel', false], [yes, true, danger ? 'destructive' : '']] });
