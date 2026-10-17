// Stage 10: buying and managing advertising happens on the standalone advertising page, not inside the
// fictional phone. The phone keeps a shortcut, a placement list with map previews, and a read-only summary.
import {h,cedi} from '../ui/dom.js';
const open = (path) => window.open(path, '_blank', 'noopener');
const row = (title, detail, fn) => h('button.cell.noic', {onclick: fn}, h('div.cm', null, h('div.c1', null, title), h('div.c2', null, detail)));
const LABEL = {active: 'live', scheduled: 'scheduled', in_review: 'waiting for a moderator', pending_payment: 'awaiting payment', paid: 'activating'};
export function advertising(win, act, arg) {
  let slots = null, mine = null;
  fetch('/api/billboards').then(r => r.json()).then(a => { slots = a.slots || []; act.adInventory(slots); win.refresh(); }).catch(() => { slots = []; win.refresh(); });
  fetch('/api/ads/mine', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'}).then(r => r.json()).then(b => { mine = b.rows || []; win.refresh(); }).catch(() => { mine = []; });
  if (arg?.slot || arg?.placement) open('/advertise.html?placement=' + encodeURIComponent(arg.slot || arg.placement));
  win.page('Advertising', () => h('div', null,
    h('p', {style: {padding: '0 8px'}}, 'Rent a billboard or ground panel in the city. Booking, payment and campaign reports are on the advertising page, which opens in your browser.'),
    h('button.ibtn.wide.green', {onclick: () => open('/advertise.html')}, 'Open the advertising page'),
    mine?.length ? h('div', null, h('div.group-h', null, 'Your campaigns'), h('div.group', null, ...mine.slice(0, 5).map(c => row(c.title, `${LABEL[c.status] || c.status.replaceAll('_', ' ')} · estimated ${Number(c.impressions)} impressions`, () => open('/advertise.html#mine'))))) : null,
    h('div.group-h', null, 'Placements'),
    slots ? h('div.group', null, ...slots.map(s => row(s.name, `${s.type === 'ground' ? 'Ground panel' : s.tier + ' billboard'} · from ${cedi(s.price)} / week · tap to see it on the map`, () => act.previewAd(s, null)))) : h('div.empty', null, 'Loading…')));
}
