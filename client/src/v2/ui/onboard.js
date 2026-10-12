// Create your character, choose two traits and select a starter home.
import { h, ic } from './dom.js';
import { G } from '../store.js';
import { stylist } from './stylist.js';

export function onboardScreen(ui, { preview, username, studio }) {
  return new Promise((resolve) => {
    const C = G.cat; const background=C.origins[G.state.birthOrigin]||C.origins.hustler; let look = { ...C.defaultLook.m, skin: 5 }; let name = username; const traits = []; let dream = null; let home = background.homes[0]; let step = 0; let sty = null;
    const steps = h('div.ob-steps', null, ...[0, 1, 2, 3].map(() => h('i')));
    const backBtn = h('button.btn.ghost.sm', { onclick: () => go(step - 1) }, ic('caret-left'));
    const panel = h('div.ob-panel');
    const nameIn = h('input.ob-name', { value: name, maxLength: 16, placeholder: 'Your name', oninput: (e) => (name = e.target.value) });
    const top = h('div.ob-top', null, backBtn, steps);
    const el = h('div.screen.ob', null, top, panel); ui.append(el);
    const nextBtn = (label, ok, fn) => h('button.btn.primary.wide', { disabled: !ok, onclick: fn, style: { marginTop: '10px', flex: 'none' } }, label);
    function go(i) {
      step = Math.max(0, Math.min(3, i)); steps.querySelectorAll('i').forEach((x, k) => x.classList.toggle('on', k <= step)); backBtn.style.visibility = step ? 'visible' : 'hidden';
      if (sty) { sty.el.remove(); sty = null; } panel.hidden = step === 0; nameRow.hidden = step !== 0;
      studio.setFrame(step === 0 ? 'edit' : 'side');
      if (step === 0) sty = stylist(el, { mode: 'create', look, onPreview: (l) => { look = l; preview(l); }, onSave: (l) => { look = l; go(1); }, saveLabel: 'Next' });
      else draw();
    }
    const nameRow = h('div.ob-namerow', null, h('label', null, 'Name'), nameIn);
    el.append(nameRow);
    function draw() {
      panel.innerHTML = '';
      if (step === 1) {
        panel.append(h('h2', null, 'Pick 2 traits'), h('div.muted', null, 'Traits change how fast you learn and what you enjoy.'), h('div.scroll', null, h('div.opts', null, ...Object.entries(C.traits).map(([k, t]) => h('button.opt' + (traits.includes(k) ? '.on' : ''), { onclick: () => { const i = traits.indexOf(k); if (i >= 0) traits.splice(i, 1); else { if (traits.length >= 2) traits.shift(); traits.push(k); } draw(); } }, h('div.oe', null, t.ic), h('div.on1', null, t.name), h('div.od', null, t.desc))))),
          nextBtn(`Next (${traits.length}/2)`, traits.length === 2, () => go(2)));
      } else if(step===2){
        const revealed=el.dataset.birthRevealed==='yes';
        panel.append(h('h2',null,'Birth lottery'),h('p.muted',null,'Your starting family is chance. Your choices shape the life you build.'),h('div.birth-card',{'aria-live':'polite'},revealed?h('div',null,h('div.birth-symbol',null,ic(background.ic)),h('h3',null,background.name),h('strong',null,'GH₵'+(background.cash+background.momo).toLocaleString()),h('ul',null,...background.perks.map(p=>h('li',null,p)))):h('div',null,h('div.birth-symbol',null,ic('dice-five')),h('p',null,'Discover your starting background'))),nextBtn(revealed?'Choose your first home':'Roll the birth lottery',true,()=>{if(revealed)return go(3);el.dataset.birthRevealed='yes';draw();}));
      } else {
        const opt = (k, e, t, d) => h('button.opt' + (home === k ? '.on' : ''), { onclick: () => { home = k; draw(); } }, h('div.oe', null, e), h('div.on1', null, t), h('div.od', null, d));
        panel.append(h('h2', null, `Your background: ${background.name}`), h('div.muted', null, `You rolled ${background.name}. Choose your first neighbourhood. Your first week is covered; you can move, change careers or buy a home as your life grows.`),
          h('div.scroll', null, h('div.opts', null, ...background.homes.map(k=>{const home=C.homes[k];return opt(k,'icon:house',home.name,`${home.area} · GH₵${home.rent.toLocaleString()}/week · ${home.toilet==='own'?'Private':'Shared'} bathroom`);}))),
          nextBtn('Move into Accra', true, () => { el.remove(); resolve({ name: (name || username).trim().slice(0, 16), look, traits, dream, home }); }));
      }
    }
    preview(look); go(0);
  });
}
