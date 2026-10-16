// Contextual object actions and the current room’s Around you options.
import { h, ic, sheet, cedi, mins, closeSheets } from './dom.js';
import {zoneActions} from './hud-state.js';
import { G, loc, actBlock, actColor, NEED_IC, isOpen } from '../store.js';

export function actsFor(place) {
  if (place === 'home') return G.cat.homeActs; const l = loc(place); return l ? l.acts : [];
}
// Fill the reusable options container for the current room.
export function renderZones(el, spec, place, act) {
  el.innerHTML = ''; if (!spec) return;
  const acts = actsFor(place); const byId = Object.fromEntries(acts.map((a) => [a.id, a]));
  const s = G.state; const car = Object.entries(G.cat.careers).find(([, c]) => c.at === place);
  if (car && !place.startsWith('visit')) { const [cid, c] = car; const mine = s.job && s.job.id === cid; el.append(h('button.zone', { onclick: () => act.jobHere(cid) }, h('span.zi', { style: { background: '#17150f' } }, c.ic), mine ? (s.shift ? 'At work' : 'Start shift') : 'Jobs here')); }
  if (place === 'home') el.append(h('button.zone', { onclick: () => act.wardrobe('wardrobe') }, h('span.zi', { style: { background: '#bf5af2' } }, h('i', { class: 'ph-fill ph-coat-hanger' })), 'Wardrobe'));
  for (const z of spec.zones || []) {
    if(z.work){if(s.job?.id===z.work&&s.shift)el.append(h('button.zone',{onclick:()=>openZone(z,place,act)},h('span.zi',null,ic('briefcase')),z.label));continue;}
    if(z.route){el.append(h('button.zone',{onclick:()=>openZone(z,place,act)},h('span.zi',null,ic(z.icon||'person-simple-walk')),z.label));continue;}
    const zacts = z.acts.map((id) => byId[id]).filter(Boolean); if (!zacts.length) continue;
    const col = actColor(zacts[0]); const iconName = (z.icon || 'ph-star').replace(/^ph-/, '');
    const b = h('button.zone', { onclick: () => openZone(z, place, act) }, h('span.zi', { style: { background: col } }, h('i', { class: 'ph-fill ph-' + iconName })), z.label);
    el.append(b);
  }
  const mapped=new Set((spec.zones||[]).flatMap(z=>z.acts||[])),extra=acts.filter(a=>!mapped.has(a.id));
  if(extra.length){const z={id:'local-activities',label:spec.localNetwork?'Neighbourhood gathering spot':'More activities here',icon:'ph-compass',acts:extra.map(a=>a.id)};el.append(h('button.zone',{onclick:()=>openZone(z,place,act)},h('span.zi',null,ic('compass')),z.label));}
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
  if (a.crime) {const risk=Math.max(5,Math.min(92,a.crime+(G.state.heat||0)/2.5-Math.floor(G.state.skills[a.crimeSkill]||0)*3));out.push(h('span.tagc.down',null,`${Math.round(risk)}% game detection risk`));}
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
  if(z.work)return act.workStation(z);
  if(z.route){
    closeSheets();const error=h('p.context-error',{role:'alert',hidden:true});
    const s=sheet(h('div.sheet-body',null,h('p.context-hint',null,z.destination?'Approach this entrance to choose walking or transport. The journey time still applies.':'Move through this doorway.'),h('button.btn.primary.wide',{onclick:()=>{
      if(G.state.busy||G.state.shift||G.connected===false){error.hidden=false;error.textContent=G.connected===false?'Reconnect before moving to another place.':'Finish your current activity first.';return;}
      s.close();act.route(z);
    }},ic('person-simple-walk'),z.label),error),{title:z.label,onclose:()=>act.clearFocus?.()});act.zoneFocus?.(z);return s;
  }
  closeSheets();const list = zoneActions(z,actsFor(place));
  const l = place === 'home' ? null : loc(place); const placeTxt = l ? `${l.name}${isOpen(l) ? '' : ' · closed now'}` : 'Home';
  const error=h('p.context-error',{role:'alert',hidden:true}),status=h('p.context-state',{role:'status'});
  let pending=false;
  const cards=list.map(a=>actCard(a,place,async(a2,why)=>{
    if(pending)return;if(why){error.hidden=false;error.textContent=why;return;}
    pending=true;error.hidden=true;status.textContent='Waiting for confirmation…';cards.forEach(c=>c.disabled=true);
    try{await act.start(a2,z);s.close();}
    catch(e){error.hidden=false;error.textContent=e.message;}
    finally{pending=false;status.textContent='';cards.forEach(c=>c.disabled=false);}
  }));
  const s = sheet(h('div.sheet-body', null,h('div.context-target',null,ic((z.icon||'hand-tap').replace(/^ph-/,'')),h('span',null,'Selected: '+z.label)),h('p.context-hint',null,'Choose an action. Costs and effects are shown before you start.'), h('div.acts', null,...cards),status,error), { title: z.label, sub: placeTxt,onclose:()=>act.clearFocus?.() });
  act.zoneFocus && act.zoneFocus(z);
  return s;
}
