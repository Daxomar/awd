// Stage 8 personal life events: the server offers a situation; the player chooses; the server decides the outcome.
import {h,ic,sheet,closeSheets} from './dom.js';
import {G} from '../store.js';
import {net} from '../net.js';

const CAT = {neighbourhood: ['warning', 'Neighbourhood'], career: ['briefcase', 'Career'], social: ['users', 'Friends'], business: ['storefront', 'Business'],
  property: ['house-line', 'Home'], financial: ['wallet', 'Money'], discovery: ['compass', 'Discovery'], community: ['hand-heart', 'Community']};

export function activeLifeEvent() {
  const a = G.state?.lifeEvents?.active;
  return a && a.expires > Date.now() ? a : null;
}

export function openLifeEvent() {
  const a = activeLifeEvent(); if (!a) return;
  closeSheets();
  const [icon, label] = CAT[a.cat] || ['sparkle', 'Life'];
  const mins = Math.max(1, Math.round((a.expires - Date.now()) / 60000));
  let pending = false;
  const status = h('p.context-state', {role: 'status'});
  const body = h('div.sheet-body.life-event', null,
    h('p.life-event-cat', null, ic(icon), ' ', label),
    h('p', null, a.text),
    h('div.life-event-choices', null, ...a.choices.map(c => h('button.btn.wide', {onclick: () => {
      if (pending) return; pending = true; status.textContent = 'Deciding…';
      if (!net.send({t: 'lifeevent', choice: c.id})) { pending = false; status.textContent = 'Reconnect before deciding. The event waits for you.'; }
    }}, h('strong', null, c.label), c.hint ? h('small', null, c.hint) : null))),
    status,
    h('button.btn.ghost.wide', {onclick: () => s.close()}, 'Decide later'),
    h('p.muted.life-event-note', null, `Ignoring this is safe: in about ${mins} min it ends with no loss. Only cash in your pocket can ever be at risk — never MoMo, savings or property.`));
  const s = sheet(body, {title: a.title, sub: 'Something is happening'});
  const off = net.on('life_event_result', () => { off(); s.close(); });
}

export function showLifeResult(m) {
  closeSheets();
  sheet(h('div.sheet-body.life-event', null, h('p', null, m.text),
    m.effects?.length ? h('ul.life-event-effects', null, ...m.effects.map(e => h('li', null, e))) : null,
    h('button.btn.primary.wide', {onclick: () => closeSheets()}, 'OK')), {title: m.title, sub: 'What happened'});
}
