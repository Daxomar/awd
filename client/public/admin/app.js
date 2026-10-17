// Stage 11 admin console shell. Tabs are filtered by the signed-in role only for convenience: the server checks
// the same permission on every request, so a hidden tab is never the protection.
import {h, api} from './ui.js';
import * as People from './views-people.js';
import * as Ops from './views-ops.js';

const TABS = [
  ['overview', 'Overview', 'overview.read', People.overview], ['players', 'Players', 'players.read', People.players],
  ['reports', 'Reports', 'reports.read', People.reports], ['economy', 'Economy', 'economy.read', Ops.economy],
  ['ads', 'Advertising', 'ads.read', Ops.ads], ['payments', 'Payments', 'payments.read', Ops.payments],
  ['world', 'World & events', ['world.manage', 'events.manage'], Ops.world], ['ops', 'Operations', 'ops.read', Ops.ops],
  ['audit', 'Audit log', 'audit.read', People.auditLog], ['admins', 'Administrators', 'admins.manage', People.admins],
];
const $ = id => document.getElementById(id);
let ctx = null;

function signedOut(message = '') {
  ctx = null; api.csrf = null;
  $('shell').hidden = true; $('who').hidden = true; $('signin').hidden = false;
  $('signinMsg').textContent = message; $('pass').value = '';
  $('user').focus();
}
const allowedTabs = () => TABS.filter(([, , p]) => [p].flat().some(x => ctx.can(x)));
function start(session) {
  api.csrf = session.csrf;
  const perms = new Set(session.admin.perms);
  ctx = {admin: session.admin, can: p => perms.has(p)};
  $('signin').hidden = true; $('shell').hidden = false; $('who').hidden = false;
  $('who').replaceChildren(h('span', {}, h('b', {text: session.admin.name}), ` · ${session.admin.roleName}`),
    h('button.btn.ghost.small', {onclick: signOut}, 'Sign out'));
  // Clicking the section you are already in (e.g. from a player opened inside Reports) goes back to its list.
  $('tabs').replaceChildren(...allowedTabs().map(([id, label]) => h('a', {href: '#' + id, 'data-tab': id, text: label,
    onclick: () => { if (location.hash === '#' + id) route(); }})));
  route();
}
async function route() {
  if (!ctx) return;
  const tabs = allowedTabs(), want = location.hash.slice(1), tab = tabs.find(([id]) => id === want) || tabs[0];
  for (const a of $('tabs').children) {
    if (a.dataset.tab === tab[0]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const view = $('view');
  view.replaceChildren(h('p.muted', {text: 'Loading…'}));
  try { await tab[3](view, ctx); } catch { view.replaceChildren(h('p.msg', {role: 'alert', text: 'This section could not be shown. Reload and try again.'})); }
  view.focus({preventScroll: true});
}
async function signOut() {
  await api.post('/api/admin/logout', {});
  signedOut('Signed out.');
}

api.onSignedOut = signedOut;
window.addEventListener('hashchange', route);
$('signinForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.submitter; if (btn) btn.disabled = true;
  const r = await api.post('/api/admin/session', {username: $('user').value.trim(), password: $('pass').value});
  if (btn) btn.disabled = false;
  if (r.error) { $('signinMsg').textContent = r.error; $('pass').value = ''; return; }
  start(r);
});
const existing = await api.get('/api/admin/session');
if (existing.error) signedOut(); else start(existing);
