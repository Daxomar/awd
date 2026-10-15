import { h, ic } from './dom.js';
import { G } from '../store.js';

const STEPS = [
  { target: '.joy', icon: 'person-simple-walk', title: 'Make yourself at home', text: 'Drag the thumbstick to walk, or tap a clear patch of ground. Drag the scene to look around and pinch to zoom.' },
  { target: '[data-nav="interact"]', icon: 'hand-tap', title: 'Use the world around you', text: 'Tap furniture or a venue worker to see what you can do. Interact lists the objects, exits and activities available here.' },
  { target: '.player-status', icon: 'heart', title: 'Look after yourself', text: 'Tap your portrait to open your needs. Choose a need for details and relevant activities. Costs and benefits appear before starting an activity.' },
  { target: '[data-nav="map"]', icon: 'map-trifold', title: 'Find your Accra', text: 'Open the map to discover places and see where people are. Choose a destination, compare fares and travel by foot, trotro, taxi or Bolt.' },
  { target: '[data-nav="chat"]', icon: 'chat-circle-dots', title: 'Meet real people', text: 'City chat reaches everyone, including friends at other places. Nearby chat reaches your room. Your phone’s Contacts app lets you find a username and send a private message.' },
  { target: '[data-nav="phone"]', icon: 'device-mobile', title: 'Take it from here', text: 'Your phone holds jobs, money, homes and Contacts. Dress your character from Wardrobe at home. There is no story to follow; you choose your next move.' },
];

export function showTutorial(ui, force = false) {
  const key = `awd_tour_v2:${G.state?.name || 'player'}`;
  try { if (!force && localStorage.getItem(key)) return; } catch {}
  if (ui.querySelector('.tutorial')) return;
  let step = 0, highlighted = null;
  const card = h('section.tutorial', { role: 'dialog', 'aria-label': 'Quick tour' });
  const finish = () => { highlighted?.classList.remove('tour-target'); card.remove(); try { localStorage.setItem(key, 'done'); } catch {} };
  function draw() {
    highlighted?.classList.remove('tour-target'); const s = STEPS[step]; highlighted = ui.querySelector(s.target); highlighted?.classList.add('tour-target');
    card.replaceChildren(h('div.tour-top', null, h('span', null, 'GETTING STARTED'), h('button', { onclick: finish, 'aria-label': 'Skip tour' }, 'Skip', ic('x'))),
      h('div.tour-title', null, ic(s.icon), h('h2', null, s.title)), h('p', null, s.text),
      h('div.tour-footer', null, h('span', null, `${step + 1} / ${STEPS.length}`), h('div.row.gap', null, step ? h('button.btn.ghost.sm', { onclick: () => { step--; draw(); } }, 'Back') : null,
        h('button.btn.primary.sm', { onclick: () => { if (++step >= STEPS.length) finish(); else draw(); } }, step === STEPS.length - 1 ? 'Explore Accra' : 'Next', ic('arrow-right')))));
  }
  ui.append(card); draw();
}
