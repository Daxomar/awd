// Stage 11 views: overview metrics, players, reports, audit log and administrator roles.
import {h, table, pager, metric, confirmAction, api, num, cedi, when, day, tag} from './ui.js';

const fail = (view, r) => view.replaceChildren(h('p.msg', {role: 'alert', text: r.error}));
const say = (el, r, ok = 'Done.') => { el.className = 'msg' + (r.error ? '' : ' good'); el.textContent = r.error || ok; };

export async function overview(view) {
  const r = await api.get('/api/admin/overview'); if (r.error) return fail(view, r);
  const m = r.metrics, d = r.definitions, max = Math.max(1, ...r.daily.map(x => x.active));
  view.replaceChildren(
    h('h1', {text: 'Overview'}),
    h('p.note', {text: r.collectedSince ? `Player activity has been collected since ${when(r.collectedSince)}. Earlier days are not shown because they were never recorded.` : 'Activity collection has not started.'}),
    h('div.grid', {},
      metric(num(m.online), 'Online now', d.online, true), metric(num(m.dau), 'Daily active', d.dau), metric(num(m.wau), 'Weekly active', d.wau),
      metric(num(m.mau), 'Monthly active', d.mau), metric(num(m.registered), 'Registered players', d.registered),
      metric(`${num(m.newToday)} / ${num(m.newWeek)}`, 'New today / 7 days', d.newRegistrations), metric(num(m.returning), 'Returning today', d.returning),
      metric(num(m.sessions), 'Sign-ins today', d.sessions), metric(num(m.visits), 'City entries today', d.visits),
      metric(num(m.activeBusinesses), 'Operating businesses', d.activeBusinesses), metric(num(m.propertyTransactions), 'Property transactions (7 d)', d.propertyTransactions),
      metric(num(m.activeCampaigns), 'Live ad campaigns', d.activeCampaigns)),
    h('div.cols', {},
      h('div.panel', {}, h('h3', {text: 'Daily active players, last 14 days'}),
        h('div.bar', {role: 'img', 'aria-label': r.daily.map(x => `${day(x.day)}: ${x.active}`).join(', ')}, r.daily.map(x => h('i', {style: `height:${Math.round(100 * x.active / max)}%`, title: `${day(x.day)}: ${x.active} active, ${x.registrations} new, ${x.sessions} sign-ins`})))),
      h('div.panel', {}, h('h3', {text: 'Retention by signup week'}), h('p.note', {text: d.retention}),
        table([{label: 'Week', get: x => day(x.week)}, {label: 'Signups', num: 1, get: x => x.size},
          ...[1, 7, 30].map(n => ({label: `Day ${n}`, num: 1, get: x => (x['eligible' + n] ? Math.round(100 * x['day' + n] / x['eligible' + n]) + '%' : 'not yet')}))], r.retention, 'No cohorts measured yet.'))));
}

export async function players(view, ctx, state = {q: '', status: 'all', page: 1}) {
  const r = await api.get('/api/admin/players', state); if (r.error) return fail(view, r);
  const q = h('input.grow', {type: 'search', value: state.q, placeholder: 'Username or account number', 'aria-label': 'Search players', maxlength: 16});
  const st = h('select', {'aria-label': 'Filter'}, r.filters.map(f => h('option', {value: f, selected: f === state.status, text: f})));
  const go = page => players(view, ctx, {q: q.value, status: st.value, page});
  view.replaceChildren(h('h1', {text: 'Players'}),
    h('form.row', {onsubmit: e => { e.preventDefault(); go(1); }}, q, st, h('button.btn', {type: 'submit'}, 'Search')),
    h('div', {style: 'height:12px'}),
    table([{label: '#', get: p => p.id}, {label: 'Player', get: p => h('a', {href: '#', onclick: e => { e.preventDefault(); player(view, ctx, p.id); }, text: p.username})},
      {label: 'Status', get: p => p.banned ? tag('banned', 'bad') : p.suspended_until && new Date(p.suspended_until) > new Date() ? tag('suspended', 'warn') : p.online ? tag('online', 'ok') : tag('active', 'mute')},
      {label: 'Net worth', num: 1, get: p => cedi(p.worth)}, {label: 'Last active', get: p => day(p.last_active)}, {label: 'Joined', get: p => day(p.created_at)}], r.rows, 'No players match.'),
    pager(r, go));
}

export async function player(view, ctx, id) {
  const r = await api.get('/api/admin/player', {id}); if (r.error) return fail(view, r);
  const a = r.account, out = h('p.msg', {role: 'status'});
  const act = async (kind, opts) => {
    const v = await confirmAction(opts); if (!v) return;
    const res = await api.post('/api/admin/moderate', {acct: id, kind, ...v}); say(out, res);
    if (!res.error) setTimeout(() => player(view, ctx, id), 600);
  };
  const suspended = a.suspended_until && new Date(a.suspended_until) > new Date();
  const editData = async () => {
    const careerOpts = [['none', 'None / Unemployed'], ...(r.careers || []).map(c => [c.id, c.name])];
    const homeOpts = [['none', 'None'], ...(r.homes || []).map(h => [h.id, `${h.name} (${h.area})`])];
    const v = await confirmAction({
      title: `Edit player data: ${a.username}`,
      text: 'Changes are saved atomically to PostgreSQL, logged in the audit trail, and synchronised live if online.',
      fields: [
        {name: 'cash', label: 'Cash balance (GH₵)', type: 'number', minValue: 0, value: Math.round(Number(a.cash) || 0)},
        {name: 'momo', label: 'MoMo balance (GH₵)', type: 'number', minValue: 0, value: Math.round(Number(a.momo) || 0)},
        {name: 'xp', label: 'Experience points (XP)', type: 'number', minValue: 0, value: Math.round(Number(a.xp) || 0)},
        {name: 'rep', label: 'Reputation (Rep)', type: 'number', value: Math.round(Number(a.rep) || 0)},
        {name: 'jobId', label: 'Career / Job', type: 'select', options: careerOpts, value: a.job || 'none'},
        {name: 'jobRank', label: 'Job rank (0-based index)', type: 'number', minValue: 0, maxValue: 10, value: Number(a.job_rank) || 0},
        {name: 'home', label: 'Home neighborhood', type: 'select', options: homeOpts, value: a.home || 'none'},
        {name: 'title', label: 'Player title', type: 'text', required: false, value: a.title || ''},
        {name: 'adult_verified', label: 'Adult attested', type: 'select', options: [['yes', 'Yes (18+)'], ['no', 'No']], value: a.adult_verified ? 'yes' : 'no'},
      ]
    });
    if (!v) return;
    const res = await api.post('/api/admin/player/edit', {
      acct: id,
      cash: v.cash,
      momo: v.momo,
      xp: v.xp,
      rep: v.rep,
      jobId: v.jobId === 'none' ? '' : v.jobId,
      jobRank: v.jobRank,
      home: v.home === 'none' ? '' : v.home,
      title: v.title,
      adult_verified: v.adult_verified === 'yes',
      reason: v.reason
    });
    say(out, res, 'Player data saved and persisted.');
    if (!res.error) setTimeout(() => player(view, ctx, id), 600);
  };
  const actions = [
    ctx.can('players.edit') && h('button.btn.primary', {onclick: editData}, 'Edit player data'),
    ctx.can('moderation.note') && h('button.btn.ghost', {onclick: () => act('note', {title: `Add a note to ${a.username}`, text: 'Notes are visible to staff only.'})}, 'Add note'),
    ctx.can('moderation.note') && h('button.btn.ghost', {onclick: () => act('appeal', {title: `Record an appeal or review for ${a.username}`})}, 'Record appeal'),
    ctx.can('moderation.suspend') && !suspended && h('button.btn', {onclick: () => act('suspend', {title: `Suspend ${a.username}`, text: 'They are signed out now and cannot sign in until the suspension ends.', danger: true,
      fields: [{name: 'hours', label: 'Hours (1–2160)', type: 'number', minValue: 1, maxValue: 2160, value: 24}]})}, 'Suspend'),
    ctx.can('moderation.suspend') && suspended && h('button.btn.ghost', {onclick: () => act('unsuspend', {title: `Lift the suspension on ${a.username}`})}, 'Lift suspension'),
    ctx.can('moderation.ban') && !a.banned && h('button.btn.danger', {onclick: () => act('ban', {title: `Ban ${a.username}`, text: 'Banning ends every session and blocks sign-in. Their saved data is kept.', danger: true, password: true})}, 'Ban'),
    ctx.can('moderation.ban') && a.banned && h('button.btn.ghost', {onclick: () => act('unban', {title: `Unban ${a.username}`, password: true})}, 'Unban'),
  ];
  view.replaceChildren(
    h('p', {}, h('a', {href: '#', onclick: e => { e.preventDefault(); players(view, ctx); }, text: '← All players'})),
    h('h1', {text: `${a.username} `}, a.banned ? tag('banned', 'bad') : suspended ? tag('suspended until ' + when(a.suspended_until), 'warn') : r.online ? tag('online', 'ok') : null),
    h('div.row', {}, actions), out,
    h('div.cols', {style: 'margin-top:12px'},
      h('div.panel', {}, h('h3', {text: 'Account'}), h('dl.kv', {},
        ...[['Account', a.id], ['Joined', when(a.created_at)], ['Adult attested', a.adult_verified ? 'yes' : 'no'], ['Cash', cedi(a.cash)], ['MoMo', cedi(a.momo)],
          ['XP', num(a.xp)], ['Rep', num(a.rep)], ['Net worth', cedi(a.worth)], ['Origin', a.origin], ['Job', a.job ? `${a.job} (rank ${Number(a.job_rank || 0) + 1})` : 'Unemployed'],
          ['Home', a.home], ['Title', a.title], ['Last saved', when(a.updated_at)],
          ['Businesses', r.holdings.businesses], ['Properties', r.holdings.properties], ['Messages sent / received', `${num(r.messages.sent)} / ${num(r.messages.received)}`],
          ['Reports filed', r.reportsFiled], ['Staff role', r.staff ? `${r.staff.role}${r.staff.active ? '' : ' (inactive)'}` : 'none']]
          .flatMap(([k, v]) => [h('dt', {text: k}), h('dd', {text: v ?? '—'})]))),
      h('div.panel', {}, h('h3', {text: 'Moderation history'}),
        table([{label: 'When', get: m => when(m.at)}, {label: 'Action', get: m => m.kind + (m.until ? ' until ' + when(m.until) : '')}, {label: 'By', get: m => m.actor_name}, {label: 'Reason', get: m => m.reason}], r.moderation, 'No moderation history.')),
      h('div.panel', {}, h('h3', {text: 'Reports about this player'}),
        table([{label: 'When', get: x => when(x.at)}, {label: 'Report', get: x => x.text}, {label: 'Status', get: x => x.status}], r.reports, 'No reports.')),
      r.money ? h('div.panel', {}, h('h3', {text: 'Money journal (latest 40)'}),
        table([{label: 'When', get: x => when(x.at)}, {label: 'Entry', get: x => x.label}, {label: 'Change', num: 1, get: x => cedi(x.delta)}, {label: 'Balance', num: 1, get: x => cedi(x.balance)}], r.money, 'No money entries.')) : null),
    h('p.note', {text: 'Passwords, payment details and message text are never shown here. Opening the money journal is recorded in the audit log.'}));
}

export async function reports(view, ctx, state = {status: 'open', page: 1}) {
  const r = await api.get('/api/admin/reports', state); if (r.error) return fail(view, r);
  const out = h('p.msg', {role: 'status'});
  const resolve = async (x, outcome) => {
    const v = await confirmAction({title: outcome === 'actioned' ? 'Close as actioned' : 'Dismiss report', text: `“${x.text.slice(0, 120)}”`}); if (!v) return;
    const res = await api.post('/api/admin/reports', {id: x.id, outcome, reason: v.reason}); say(out, res); if (!res.error) reports(view, ctx, state);
  };
  view.replaceChildren(h('h1', {text: 'Reports'}),
    h('div.row', {}, r.filters.map(f => h('button.btn.small' + (f === state.status ? '' : '.ghost'), {onclick: () => reports(view, ctx, {status: f, page: 1})}, f))), out,
    table([{label: 'When', get: x => when(x.at)}, {label: 'From', get: x => x.reporter_name || x.reporter}, {label: 'About', get: x => x.target_acct ? h('a', {href: '#', onclick: e => { e.preventDefault(); player(view, ctx, x.target_acct); }, text: x.target_name || x.target}) : x.target},
      {label: 'Report', get: x => x.text}, {label: 'Status', get: x => x.status === 'open' ? tag('open', 'warn') : `${x.status} by ${x.handled_by}`},
      {label: '', get: x => x.status === 'open' && ctx.can('reports.resolve') ? h('div.row', {}, h('button.btn.small', {onclick: () => resolve(x, 'actioned')}, 'Actioned'), h('button.btn.ghost.small', {onclick: () => resolve(x, 'dismissed')}, 'Dismiss')) : ''}],
    r.rows, 'No reports in this list.'), pager(r, page => reports(view, ctx, {...state, page})),
    h('h2', {text: 'Event reports'}), table([{label: 'When', get: x => when(x.at)}, {label: 'Event', get: x => x.title}, {label: 'Reason', get: x => x.reason}], r.eventReports, 'No event reports.'));
}

export async function suggestions(view, ctx, state = {status: 'open', page: 1}) {
  const r = await api.get('/api/admin/suggestions', state); if (r.error) return fail(view, r);
  const out = h('p.msg', {role: 'status'});
  const resolve = async (x, outcome) => {
    const v = await confirmAction({title: outcome === 'planned' ? 'Mark as Planned' : outcome === 'reviewed' ? 'Mark as Reviewed' : 'Dismiss suggestion', text: `“${x.text.slice(0, 120)}”`}); if (!v) return;
    const res = await api.post('/api/admin/suggestions', {id: x.id, outcome, reason: v.reason}); say(out, res); if (!res.error) suggestions(view, ctx, state);
  };
  view.replaceChildren(h('h1', {text: 'Player Suggestions & Feature Requests'}),
    h('p.note', {text: 'Suggestions and feature ideas submitted by players across Accra.'}),
    h('div.row', {}, r.filters.map(f => h('button.btn.small' + (f === state.status ? '' : '.ghost'), {onclick: () => suggestions(view, ctx, {status: f, page: 1})}, f))), out,
    table([
      {label: 'When', get: x => when(x.at)},
      {label: 'Player', get: x => x.acct ? h('a', {href: '#', onclick: e => { e.preventDefault(); player(view, ctx, x.acct); }, text: x.player_name || ('Player #' + x.acct)}) : 'Anonymous'},
      {label: 'Category', get: x => tag(x.category || 'feature', x.category === 'feature' ? 'ok' : 'mute')},
      {label: 'Suggestion', get: x => x.text},
      {label: 'Status', get: x => x.status === 'open' ? tag('open', 'warn') : x.status === 'planned' ? tag('planned', 'ok') : tag(x.status, 'mute')},
      {label: 'Handled by', get: x => x.handled_by ? `${x.handled_by}${x.admin_note ? ': ' + x.admin_note : ''}` : '—'},
      {label: '', get: x => ctx.can('reports.resolve') ? h('div.row', {},
        x.status !== 'planned' ? h('button.btn.small', {onclick: () => resolve(x, 'planned')}, 'Plan') : null,
        x.status !== 'reviewed' ? h('button.btn.ghost.small', {onclick: () => resolve(x, 'reviewed')}, 'Review') : null,
        x.status !== 'dismissed' ? h('button.btn.ghost.small', {onclick: () => resolve(x, 'dismissed')}, 'Dismiss') : null
      ) : ''}
    ], r.rows, 'No suggestions in this list.'),
    pager(r, page => suggestions(view, ctx, {...state, page}))
  );
}

export async function auditLog(view, ctx, state = {page: 1, actor: '', action: ''}) {
  const r = await api.get('/api/admin/audit', state); if (r.error) return fail(view, r);
  const actor = h('input', {value: state.actor, placeholder: 'Administrator', 'aria-label': 'Administrator', maxlength: 16});
  const action = h('input', {value: state.action, placeholder: 'Action prefix, e.g. moderation', 'aria-label': 'Action', maxlength: 40});
  view.replaceChildren(h('h1', {text: 'Audit log'}), h('p.note', {text: 'Append-only: the database refuses edits or deletions of these records.'}),
    h('form.row', {onsubmit: e => { e.preventDefault(); auditLog(view, ctx, {page: 1, actor: actor.value, action: action.value}); }}, actor, action, h('button.btn', {type: 'submit'}, 'Filter')),
    h('div', {style: 'height:12px'}),
    table([{label: 'When', get: x => when(x.at)}, {label: 'Who', get: x => `${x.actor_name}${x.role ? ' (' + x.role + ')' : ''}`}, {label: 'Action', get: x => x.action},
      {label: 'Target', get: x => x.target}, {label: 'Reason', get: x => x.reason}, {label: 'Outcome', get: x => tag(x.outcome, ['ok', 'requested'].includes(x.outcome) ? 'ok' : x.outcome === 'denied' ? 'bad' : 'warn')}], r.rows, 'No audit records match.'),
    pager(r, page => auditLog(view, ctx, {...state, page})));
}

export async function admins(view, ctx) {
  const r = await api.get('/api/admin/admins'); if (r.error) return fail(view, r);
  const out = h('p.msg', {role: 'status'}), roleOpts = Object.entries(r.roles).map(([k, x]) => [k, x.name]);
  const change = async (row) => {
    const v = await confirmAction({title: row ? `Change access for ${row.username}` : 'Grant administrator access', password: true,
      fields: [...(row ? [] : [{name: 'username', label: 'Game username'}]), {name: 'role', label: 'Role', type: 'select', options: [...roleOpts, ...(row ? [['none', 'Remove access']] : [])]}]});
    if (!v) return;
    const res = await api.post('/api/admin/admins', {username: row?.username || v.username, role: v.role === 'none' ? undefined : v.role, active: v.role !== 'none', version: row?.version || 0, reason: v.reason, password: v.password});
    say(out, res); if (!res.error) admins(view, ctx);
  };
  view.replaceChildren(h('h1', {text: 'Administrators'}), h('div.row', {}, h('button.btn', {onclick: () => change(null)}, 'Grant access')), out,
    table([{label: 'Account', get: x => x.username}, {label: 'Role', get: x => r.roles[x.role]?.name || x.role}, {label: 'Status', get: x => x.active ? tag('active', 'ok') : tag('removed', 'mute')},
      {label: 'Granted', get: x => `${when(x.granted_at)}${x.granted_by ? ' by ' + x.granted_by : ''}`}, {label: 'Last seen', get: x => when(x.last_seen)},
      {label: '', get: x => x.acct === ctx.admin.acct ? 'you' : h('button.btn.ghost.small', {onclick: () => change(x)}, 'Change')}], r.rows),
    h('h2', {text: 'What each role can do'}),
    table([{label: 'Role', get: ([, x]) => x.name}, {label: 'Permissions', get: ([, x]) => x.perms.join(', ')}], Object.entries(r.roles)));
}
