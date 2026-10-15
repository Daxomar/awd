import { h, ic } from './dom.js';
import { net } from '../net.js';
import { G } from '../store.js';
import {dialogKeys} from './overlays.js';

export function buildChat(ui, onUnread = () => {}) {
  let channel = 'city', unread = 0, pending = null,offKeys;
  const close=()=>{panel.hidden=true;input.blur();offKeys?.();};
  const history = { city: [], room: [] };
  const title = h('strong', null, 'City chat');
  const info = h('div.chat-context');
  const log = h('div.chat-history', { role: 'log', 'aria-live': 'polite', 'aria-label': 'Chat messages' });
  const input = h('input', { placeholder: 'Message the city', maxLength: 160, enterkeyhint: 'send', 'aria-label': 'Message', autocomplete: 'off' });
  const send = h('button.btn.primary', { type: 'submit', 'aria-label': 'Send message' }, ic('paper-plane-right'));
  const status = h('div.chat-status', { role: 'status' });
  const tabs = h('div.chat-tabs', null, ...[['city', 'City'], ['room', 'Nearby']].map(([id, label]) => h('button', { type: 'button', 'data-channel': id, onclick: () => { channel = id; draw(); } }, label)));
  const panel = h('section.chat-panel', { hidden: true, 'aria-label': 'Player chat' },
    h('div.chat-heading', null, title, h('button.chat-close', { 'aria-label': 'Close chat', onclick:close }, ic('x'))), tabs, info, log,
    h('form.chat-compose', { onsubmit: (e) => {
      e.preventDefault(); const text = input.value.trim(); if (!text || pending) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (!net.send({ t: 'chat', ch: channel, text, clientId: id })) return;
      pending = { id, text }; send.disabled = true; status.textContent = 'Sending…';
      pending.timer = setTimeout(() => finish(false, 'Delivery not confirmed. Your draft is still here.'), 10000);
    } }, input, send), status);
  ui.append(panel);
  function finish(ok, message = '') {
    if (!pending) return; clearTimeout(pending.timer);
    if (ok && input.value.trim() === pending.text) input.value = '';
    pending = null; send.disabled = false; status.textContent = message;
  }
  function draw() {
    title.textContent = channel === 'city' ? 'City chat' : 'Nearby chat';
    info.textContent = channel === 'city' ? 'Everyone online · find your friends with @username' : `${G.placeName || 'On the road'} · only players in your room`;
    input.placeholder = channel === 'city' ? 'Message the city' : 'Message people here';
    tabs.querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b.dataset.channel === channel); b.setAttribute('aria-pressed', String(b.dataset.channel === channel)); });
    log.replaceChildren(...(history[channel].length ? history[channel].map((m) => h('div.chat-message', { class: m.id === G.myId && m.shard === G.shard ? 'mine' : '' }, h('div.chat-byline', null, '@' + m.n, h('time', null, new Date(m.at || Date.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))), h('p', null, m.m))) : [h('p.chat-empty', null, channel === 'city' ? 'Start a conversation. City messages reach players even when they are at home or travelling.' : 'Say hello to the people here. Use City chat or a private message if your friend is elsewhere.')]));
    log.scrollTop = log.scrollHeight;
  }
  net.on('chat', (m) => { const ch = m.ch === 'city' ? 'city' : 'room'; history[ch].push(m); if (history[ch].length > 80) history[ch].shift(); if (panel.hidden && !(m.id === G.myId && m.shard === G.shard)) { unread++; onUnread(unread); } draw(); });
  net.on('chat_ack', (m) => { if (m.clientId === pending?.id) finish(m.ok, m.ok ? 'Sent' : m.m); });
  net.on('room', () => { history.room = []; draw(); });
  net.on('connection', (m) => { status.textContent = m.connected ? 'Connected' : m.terminal ? 'Session ended. Sign in again to chat.' : 'Reconnecting… drafts are kept.'; if (!m.connected) finish(false, status.textContent); });
  const viewport = () => { const v = window.visualViewport; panel.style.bottom = `${Math.max(0, innerHeight - (v?.height || innerHeight) - (v?.offsetTop || 0)) + 12}px`; panel.style.maxHeight = `${Math.max(180, (v?.height || innerHeight) - 32)}px`; };
  window.visualViewport?.addEventListener('resize', viewport); viewport(); draw();
  return {close,toggle() {if(!panel.hidden)return close();panel.hidden=false;offKeys=dialogKeys(panel,close,()=>!panel.hidden);if (!panel.hidden) { unread = 0; onUnread(0); draw(); input.focus(); } else input.blur(); }, get unread() { return unread; }, panel };
}
