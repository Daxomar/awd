// Tap another player in the room → their card: friendship, socials, send money, message, report.
import { h, ic, sheet, cedi } from './dom.js';
import { G } from '../store.js';
import { net } from '../net.js';
import { portrait } from './portrait.js';

export const SOCIALS = [['wave', 'icon:hand-waving', 'Wave', 0], ['chat', 'icon:chat-circle-dots', 'Chat', 0], ['joke', 'icon:smiley', 'Joke', 0], ['compliment', 'icon:star', 'Praise', 3], ['gist', 'icon:chat-circle-dots', 'Gist', 8], ['dance', 'icon:person-simple-dance', 'Dance', 10], ['hug', 'icon:smiley', 'Hug', 25], ['flirt', 'icon:smiley', 'Flirt', 35], ['askout', 'icon:envelope', 'Ask out', 70], ['propose', 'icon:diamond', 'Propose', 120]];
export const LEVELS = [[0, 'Stranger'], [10, 'Acquaintance'], [30, 'Friend'], [70, 'Good friend'], [120, 'Best friend']];
export const level = (pts) => LEVELS.filter(([t]) => pts >= t).pop()[1];
export function openPerson(pid, name, act) {
  const body = h('div.sheet-body', null, h('div.muted.center', { style: { padding: '30px' } }, 'Loading…'));
  const sh = sheet(body, { title: name, sub: 'In this place with you' });
  const off = net.on('profile', (m) => { if (m.p.name.toLowerCase() !== name.toLowerCase()) return; off(); render(m.p); });
  net.send({ t: 'profile', name });
  function render(p) {
    const pts = p.friend || 0; const next = LEVELS.find(([t]) => t > pts);
    const card = h('div.pcard', null, portrait(p.look,name,'pav'),
      h('div.grow', null, h('div', { style: { font: '800 19px var(--disp)' } }, '@' + p.name), h('div.muted', { style: { fontSize: '13px' } }, [p.title, p.job].filter(Boolean).join(' · ')), h('div.muted', { style: { fontSize: '12.5px' } }, p.car ? ` ${p.car}` : ` ${p.home}`)));
    const fr = h('div', { style: { margin: '2px 0 14px' } }, h('div.row', { style: { justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 } }, h('span', null, 'icon:handshake ' + level(pts)), h('span.muted', null, next ? `${pts}/${next[0]}` : `${pts}`)), h('div.fbar', null, h('i', { style: { width: Math.min(100, next ? (pts / next[0]) * 100 : 100) + '%' } })));
    const socs = h('div.socials', null, ...SOCIALS.map(([k, e, l, min]) => h('button.soc' + (pts < min ? '.locked' : ''), { onclick: () => { if (k === 'chat') { sh.close(); return act.message(p.name); } if (pts < min) return act.toast(`Get to ${min} friendship first.`, 'bad'); net.send({ t: 'social', id: pid, kind: k }); act.socialFx && act.socialFx(pid, k); sh.close(); } }, h('span.se', null, e), l)));
    const btns = h('div.row', { style: { gap: '8px', marginTop: '14px' } },
      h('button.btn.gold.grow', { onclick: () => { sh.close(); act.sendMoney(p.name); } }, ic('hand-coins'), 'Send money'),
      h('button.btn.grow', { onclick: () => { sh.close(); act.message(p.name); } }, ic('chat-circle-text'), 'Message'));
    const games = h('button.btn.dark.wide', { style: { marginTop: '10px' }, onclick: () => { sh.close(); act.oware(pid, p.name); } }, ' Challenge to Oware');
    const foot = h('div.row', { style: { gap: '8px', marginTop: '10px' } },
      h('button.btn.ghost.sm.grow', { onclick: () => { net.send({ t: 'report', id: pid, reason: 'Reported from player card' }); sh.close(); } }, ic('flag'), 'Report'),
      h('button.btn.ghost.sm.grow', { onclick: () => { net.send({ t: 'block', name: p.name, on: !p.blocked }); sh.close(); } }, ic('prohibit'), p.blocked ? 'Unblock' : 'Block'));
    const b2 = h('div.sheet-body', null, card, fr, h('div.section', { style: { marginTop: '0' } }, 'Do something'), socs, btns, games, foot);
    body.replaceWith(b2);
  }
}
