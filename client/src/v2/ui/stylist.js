// Look editor used for character creation, the home wardrobe and the boutique.
// mode 'create' → free items only · 'wardrobe' → what you own · 'boutique' → everything, try on and buy.
import { h, ic, cedi, vibrate } from './dom.js';
import { G } from '../store.js';

export const WEAR_IC = { tee: 'icon:t-shirt', flagtee: 'icon:flag', singlet: 'icon:circle', crop: 'icon:circle', polo: 'icon:t-shirt', hoodie: 'icon:circle', jersey: 'icon:soccer-ball', ankara: 'icon:t-shirt', kenteshirt: 'icon:circle', fugu: 'icon:circle', office: 'icon:t-shirt', kaftan: 'icon:circle', suit: 'icon:circle', kaba: 'icon:t-shirt', blouse: 'icon:circle',
  jeans: 'icon:circle', shorts: 'icon:circle', joggers: 'icon:circle', chinos: 'icon:circle', suitpants: 'icon:circle', ankarapants: 'icon:circle', slit: 'icon:t-shirt', mini: 'icon:circle', pencil: 'icon:t-shirt', kenteskirt: 'icon:circle',
  sundress: 'icon:t-shirt', ankaradress: 'icon:t-shirt', kentedress: 'icon:circle', bodycon: 'icon:circle', kentecloth: 'icon:circle',
  slides: 'icon:circle', sneakers: 'icon:sneaker', ahenema: 'icon:circle', loafers: 'icon:sneaker', heels: 'icon:circle', boots: 'icon:circle',
  lowcut: 'icon:circle', fade: 'icon:circle', waves: 'icon:circle', afro: 'icon:plant', twists: 'icon:circle', locs: 'icon:circle', cornrows: 'icon:circle', bald: 'icon:circle', puff: 'icon:circle', bun: 'icon:circle', twa: 'icon:star', braids: 'icon:circle', bob: 'icon:circle', bonestraight: 'icon:circle', duku: 'icon:circle',
  nobeard: 'icon:smiley', stubble: 'icon:circle', goatee: 'icon:circle', fullbeard: 'icon:circle', nohat: 'icon:circle', cap: 'icon:circle', bucket: 'icon:circle', kufi: 'icon:mosque', noglasses: 'icon:circle', shades: 'icon:circle', specs: 'icon:circle', nochain: 'icon:circle', chain: 'icon:circle', beads: 'icon:circle', stole: 'icon:graduation-cap' };
const TABS = [['body', 'Body', 'user'], ['hair', 'Hair', 'scissors'], ['top', 'Tops', 't-shirt'], ['bottom', 'Bottoms', 'pants'], ['full', 'Dresses', 'dress'], ['shoes', 'Shoes', 'sneaker'], ['extras', 'Extras', 'sunglasses']];
export function stylist(host, { mode = 'create', look, onPreview, onSave, onBuy, onClose, saveLabel }) {
  const W = G.cat.wear; let L = { ...look }; let tab = 'body';
  const owned = () => (G.state && G.state.wardrobe) || {};
  const can = (id) => W[id].price === 0 || owned()[id];
  const el = h('div.sty'); host.append(el);
  const set = (patch) => { L = { ...L, ...patch }; if (patch.full === null) delete L.full; onPreview(L); draw(); vibrate(6); };
  const items = (slot) => Object.entries(W).filter(([id, w]) => w.slot === slot && (w.g === 'u' || w.g === L.body) && (mode !== 'wardrobe' || can(id)));
  const card = (id, slot) => { const w = W[id]; const on = slot === 'full' ? L.full === id : L[slot] === id && !(L.full && (slot === 'top' || slot === 'bottom')); const lock = !can(id);
    return h('button.sty-card' + (on ? '.on' : '') + (lock ? '.lock' : ''), { onclick: () => { if (lock && mode === 'create') return pickLocked(w); if (slot === 'full') set({ full: id, fullCol: L.fullCol && w.colors && w.colors.includes(L.fullCol) ? L.fullCol : w.colors && w.colors[0] }); else if (slot === 'top' || slot === 'bottom') set({ [slot]: id, [slot + 'Col']: w.colors ? (w.colors.includes(L[slot + 'Col']) ? L[slot + 'Col'] : w.colors[0]) : undefined, full: null }); else set({ [slot]: id, ...(w.colors ? { [slot + 'Col']: w.colors.includes(L[slot + 'Col']) ? L[slot + 'Col'] : w.colors[0] } : {}) }); } },
      h('div.sty-ic', null, (WEAR_IC[id] && WEAR_IC[id] !== 'icon:circle' ? WEAR_IC[id] : 'icon:' + ({top:'t-shirt',bottom:'pants',full:'dress',shoes:'sneaker',hair:'scissors',beard:'user',hat:'baseball-cap',glasses:'sunglasses',neck:'diamond'}[slot] || 'user'))), h('div.sty-nm', null, w.name), w.tag ? h('div.sty-tag', null, w.tag) : null,
      h('div.sty-pr', null, w.price === 0 ? 'Free' : owned()[id] ? 'Owned' : mode === 'create' ? h('span', null, ic('lock-simple'), ' ', cedi(w.price)) : cedi(w.price))); };
  const pickLocked = (w) => { el.querySelector('.sty-hint').textContent = `${w.name} costs ${cedi(w.price)} in the game. Buy it at the boutique once you start earning.`; };
  const swatches = (list, cur, onPick, big) => h('div.sty-sw', null, ...list.map((c) => h('button' + (c === cur ? '.on' : '') + (big ? '.big' : ''), { style: { background: c }, onclick: () => onPick(c), 'aria-label': c })));
  function draw() {
    el.innerHTML = '';
    const tabs = h('div.sty-tabs', null, ...TABS.filter(([k]) => k !== 'full' || L.body === 'f' || mode !== 'create' || items('full').length).filter(([k]) => k !== 'full' || items('full').length).map(([k, l, i]) => h('button' + (tab === k ? '.on' : ''), { onclick: () => { tab = k; draw(); } }, ic(i), l)));
    const body = h('div.sty-body');
    if (tab === 'body') {
      body.append(h('div.sty-lbl', null, 'Body'), h('div.seg', null, ...[['m', 'Man'], ['f', 'Woman']].map(([b, l]) => h('button' + (L.body === b ? '.on' : ''), { onclick: () => { if (L.body === b) return; const D = G.cat.defaultLook[b]; set({ ...D, skin: L.skin, build: L.build, hips: L.hips, height: L.height, bust: L.bust, ...Object.fromEntries(['waist','shoulders','muscle','faceWidth','nose','lips'].map(k=>[k,L[k]])), body: b, full: null }); } }, l))),
        h('div.sty-lbl', null, 'Skin tone'), swatches(Object.values(G.cat.skinTones), G.cat.skinTones[L.skin], (c) => set({ skin: +Object.keys(G.cat.skinTones).find((k) => G.cat.skinTones[k] === c) }), true));
      for (const [key, title, low, high] of [['build', 'Build', 'Slender', 'Fuller'],['shoulders','Shoulders','Narrow','Broad'],['waist','Waist','Narrow','Fuller'],['muscle','Muscle','Softer','Defined'], ['hips', 'Hips', 'Narrow', 'Wide'], ['height', 'Height', 'Shorter', 'Taller'], ...(L.body === 'f' ? [['bust', 'Bust', 'Smaller', 'Fuller']] : []),['faceWidth','Face width','Narrow','Wide'],['nose','Nose','Subtle','Prominent'],['lips','Lips','Subtle','Fuller']]) {
        const input = h('input', { type: 'range', min: 0, max: 1, step: .05, value: L[key] ?? (key === 'bust' ? .45 : .5), 'aria-label': title,
          oninput: (e) => { L = { ...L, [key]: Number(e.target.value) }; onPreview(L); } });
        body.append(h('label.sty-shape', null, h('span.sty-lbl', null, title), input, h('span.sty-range-labels', null, h('span', null, low), h('span', null, high))));
      }
      if (L.body === 'm') body.append(h('div.sty-lbl', null, 'Facial hair'), h('div.sty-grid', null, ...items('beard').map(([id]) => card(id, 'beard'))));
    } else if (tab === 'hair') {
      body.append(h('div.sty-lbl', null, 'Hair colour'), swatches(G.cat.hairColors, L.hairCol, (c) => set({ hairCol: c })), h('div.sty-grid', null, ...items('hair').map(([id]) => card(id, 'hair'))));
      if (L.hair === 'duku') body.append(h('div.sty-lbl', null, 'Headwrap print'), swatches(['#7b2d8e', '#e76f51', '#1f6fb8', '#0e7a4e', '#f2b632', '#c8102e'], L.hatCol, (c) => set({ hatCol: c })));
    } else if (tab === 'extras') {
      for (const [slot, lbl] of [['hat', 'Hats'], ['glasses', 'Glasses'], ['neck', 'Neck']]) { body.append(h('div.sty-lbl', null, lbl), h('div.sty-grid', null, ...items(slot).map(([id]) => card(id, slot)))); const w = W[L[slot]]; if (w && w.colors) body.append(swatches(w.colors, L[slot + 'Col'], (c) => set({ [slot + 'Col']: c }))); }
    } else {
      const slot = tab; const cur = slot === 'full' ? L.full : L.full && (slot === 'top' || slot === 'bottom') ? null : L[slot]; const w = cur && W[cur];
      if (w && w.colors && w.colors.length > 1) body.append(h('div.sty-lbl', null, `${w.name} · colour`), swatches(w.colors, L[slot + 'Col'], (c) => set({ [slot + 'Col']: c })));
      body.append(h('div.sty-grid', null, ...items(slot).map(([id]) => card(id, slot))));
    }
    // footer: price of unowned items being tried on (boutique) and save
    const trying = Object.entries(L).filter(([k, v]) => ['top', 'bottom', 'full', 'shoes', 'hair', 'hat', 'glasses', 'neck'].includes(k) && W[v] && !can(v) && !(L.full && (k === 'top' || k === 'bottom'))).map(([, v]) => v);
    const total = trying.reduce((a, id) => a + W[id].price, 0);
    const foot = h('div.sty-foot', null,
      mode === 'boutique' && trying.length ? h('button.btn.gold.grow', { onclick: () => onBuy(trying, total) }, `Buy ${trying.length} · ${cedi(total)}`) : null,
      onClose ? h('button.btn.ghost', { onclick: onClose }, 'Close') : null,
      h('button.btn.primary.grow', { disabled: !!trying.length, onclick: () => onSave(L) }, saveLabel || 'Wear this'));
    el.append(tabs, body, h('div.sty-hint.muted'), foot);
  }
  draw(); onPreview(L);
  return { el, get look() { return L; }, redraw: draw, set };
}
