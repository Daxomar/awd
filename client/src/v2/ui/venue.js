// Venue interaction: zone chips along the bottom, and the zone sheet full of action cards (Lagos Life style).
import { h, ic, sheet, cedi, mins } from './dom.js';
import { G, loc, actBlock, actColor, NEED_IC, isOpen } from '../store.js';

const ZONE_EMOJI = { 'ph-bowl-food': 'icon:bowl-food', 'ph-toilet': 'icon:toilet', 'ph-bed': 'icon:bed', 'ph-shower': 'icon:shower', 'ph-cooking-pot': 'icon:cooking-pot', 'ph-television': 'icon:television', 'ph-laptop': 'icon:laptop', 'ph-guitar': 'icon:guitar', 'ph-barbell': 'icon:barbell' };
export function actsFor(place) {
  if (place === 'home') return G.cat.homeActs; const l = loc(place); return l ? l.acts : [];
}
// fill the zone chip row for the current room spec
export function renderZones(el, spec, place, act) {
  el.innerHTML = ''; if (!spec) return;
  const acts = actsFor(place); const byId = Object.fromEntries(acts.map((a) => [a.id, a]));
  const s = G.state; const car = Object.entries(G.cat.careers).find(([, c]) => c.at === place);
  if (car && !place.startsWith('visit')) { const [cid, c] = car; const mine = s.job && s.job.id === cid; el.append(h('button.zone', { onclick: () => act.jobHere(cid) }, h('span.zi', { style: { background: '#17150f' } }, c.ic), mine ? (s.shift ? 'At work' : 'Start shift') : 'Jobs here')); }
  if (place === 'home') el.append(h('button.zone', { onclick: () => act.wardrobe('wardrobe') }, h('span.zi', { style: { background: '#bf5af2' } }, h('i', { class: 'ph-fill ph-coat-hanger' })), 'Wardrobe'));
  for (const z of spec.zones || []) {
    if(z.route){el.append(h('button.zone',{onclick:()=>act.route(z)},h('span.zi',null,ic(z.icon||'person-simple-walk')),z.label));continue;}
    const zacts = z.acts.map((id) => byId[id]).filter(Boolean); if (!zacts.length) continue;
    const col = actColor(zacts[0]); const iconName = (z.icon || 'ph-star').replace(/^ph-/, '');
    const b = h('button.zone', { onclick: () => openZone(z, place, act) }, h('span.zi', { style: { background: col } }, h('i', { class: 'ph-fill ph-' + iconName })), z.label);
    el.append(b);
  }
  if (place.startsWith('visit:')) el.append(h('button.zone', { onclick: () => act.nav('home') }, h('span.zi', { style: { background: '#0e7a4e' } }, 'icon:house'), 'Go home'));
}
export function effectChips(a) {
  const out = []; const fx = a.fx || {};
  if (a.cost) out.push(h('span.tagc.cost', null, cedi(a.cost)));
  if (a.earn) { const [base, per, sk] = a.earn; const lv = sk ? Math.floor(G.state.skills[sk] || 0) : 0; out.push(h('span.tagc.money', null, `+${cedi(base + per * lv)}`)); }
  if (a.mg) out.push(h('span.tagc.money', null, 'Mini-game · earn'));
  for (const k of Object.keys(fx)) { const v = fx[k]; if (!v || !NEED_IC[k]) continue; out.push(h('span.tagc.' + (v > 0 ? 'up' : 'down'), null, `${NEED_IC[k]} ${v > 0 ? '+' : ''}${v}`)); }
  for (const k of a.skill || []) out.push(h('span.tagc', null, `↑ ${G.cat.skills[k]}`));
  if (a.food) out.push(h('span.tagc.up', null, `+${a.food} home meals`));
  if (a.crime) out.push(h('span.tagc.down', null, ` ${a.crime}% risk`));
  if (a.cures) out.push(h('span.tagc.up', null, a.cures === 'serious' ? 'Cures all' : 'Cures mild'));
  if (a.rep) out.push(h('span.tagc.up', null, `+${a.rep} rep`));
  return out;
}
export function actCard(a, place, onGo) {
  const l = place === 'home' ? null : loc(place); const why = actBlock(a, l); const col = actColor(a);
  const dur = a.min ? mins(a.min) : a.opens ? 'Open' : '';
  return h('button.act' + (why ? '.locked' : ''), { onclick: () => onGo(a, why) },
    h('div.row', { style: { gap: '8px', alignItems: 'flex-start' } }, h('div.tile', { style: { background: col + '22' } }, a.ic), why ? h('div.lock', null, why) : h('div.lock', { style: { color: 'var(--ink2)' } }, dur)),
    h('div.lbl', null, a.label), h('div.meta', null, ...effectChips(a)));
}
export function openZone(z, place, act) {
  if(z.route)return act.route(z);
  const acts = actsFor(place); const list = z.acts.map((id) => acts.find((a) => a.id === id)).filter(Boolean);
  const l = place === 'home' ? null : loc(place); const placeTxt = l ? `${l.name}${isOpen(l) ? '' : ' · closed now'}` : 'Home';
  const s = sheet(h('div.sheet-body', null, h('div.acts', null, ...list.map((a) => actCard(a, place, (a2, why) => { if (why) return act.toast(why, 'bad'); s.close(); act.start(a2, z); })))), { title: z.label, sub: placeTxt });
  act.zoneFocus && act.zoneFocus(z);
  return s;
}
