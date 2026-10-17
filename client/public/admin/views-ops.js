// Stage 11 views: economy monitoring, advertising, payments, world and events, and operational health.
import {h, table, pager, metric, confirmAction, api, num, cedi, pesewas, when, tag} from './ui.js';

const fail = (view, r) => view.replaceChildren(h('p.msg', {role: 'alert', text: r.error}));
const say = (el, r, ok = 'Done.') => { el.className = 'msg' + (r.error ? '' : ' good'); el.textContent = r.error || ok; };
const ago = t => (t ? `${Math.max(0, Math.round((Date.now() - new Date(t)) / 1000))} s ago` : 'never');

export async function economy(view, ctx, days = 7) {
  const r = await api.get('/api/admin/economy', {days}); if (r.error) return fail(view, r);
  const rec = r.reconciliation, created = r.flows.reduce((s, f) => s + Number(f.created), 0), removed = r.flows.reduce((s, f) => s + Number(f.removed), 0);
  view.replaceChildren(h('h1', {text: 'Economy'}),
    h('div.row', {}, [1, 7, 30].map(d => h('button.btn.small' + (d === r.days ? '' : '.ghost'), {onclick: () => economy(view, ctx, d)}, `${d} day${d > 1 ? 's' : ''}`))),
    h('p.note', {text: r.note + ' Balances can only change through gameplay; this dashboard has no balance-editing control.'}),
    h('div.grid', {}, metric(cedi(created), 'Money entering wallets', `All positive journal entries, last ${r.days} days`, true), metric(cedi(-removed), 'Money leaving wallets', 'Rent, costs, fines and purchases'),
      metric(rec.mismatched ? `${rec.mismatched} mismatched` : 'Balanced', 'Ledger reconciliation', `${num(rec.checked)} saved wallets checked against their latest journal balance`),
      metric(num(r.vehicles.n), 'Vehicle resales', cedi(r.vehicles.volume))),
    h('div.cols', {style: 'margin-top:12px'},
      h('div.panel', {}, h('h3', {text: 'Creation and sinks by source'}),
        table([{label: 'Source', get: f => f.bucket}, {label: 'In', num: 1, get: f => cedi(f.created)}, {label: 'Out', num: 1, get: f => cedi(-f.removed)}, {label: 'Entries', num: 1, get: f => num(f.entries)}], r.flows, 'No money movement in this window.')),
      h('div.panel', {}, h('h3', {text: 'Transfers between players'}),
        table([{label: 'Kind', get: t => ({market: 'Marketplace (phones)', vehicle: 'Vehicle resale', property: 'Property sale', p2p: 'MoMo transfers'})[t.kind] || t.kind}, {label: 'Count', num: 1, get: t => num(t.n)}, {label: 'Volume', num: 1, get: t => cedi(t.volume)}], r.transfers, 'No transfers.')),
      h('div.panel', {}, h('h3', {text: 'Property activity'}),
        table([{label: 'Kind', get: p => p.kind.replaceAll('_', ' ')}, {label: 'Count', num: 1, get: p => num(p.n)}, {label: 'Amount', num: 1, get: p => cedi(p.volume)}], r.property, 'No property activity.')),
      h('div.panel', {}, h('h3', {text: 'Unusual single entries (GH₵20,000 or more)'}),
        table([{label: 'When', get: u => when(u.at)}, {label: 'Player', get: u => u.username}, {label: 'Entry', get: u => u.label}, {label: 'Change', num: 1, get: u => cedi(u.delta)}], r.unusual, 'Nothing unusual.')),
      h('div.panel', {}, h('h3', {text: 'Over GH₵50,000 earned in 24 hours'}),
        table([{label: 'Player', get: u => u.username}, {label: 'Earned', num: 1, get: u => cedi(u.earned)}], r.inflow, 'Nobody above the threshold.')),
      rec.mismatched ? h('div.panel', {}, h('h3', {text: 'Reconciliation mismatches'}),
        table([{label: 'Account', get: m => m.acct}, {label: 'Journal', num: 1, get: m => cedi(m.journal)}, {label: 'Wallet', num: 1, get: m => cedi(m.wallet)}], rec.samples)) : null));
}

export async function ads(view, ctx, state = {filter: 'all', page: 1}) {
  const r = await api.get('/api/admin/ads', state); if (r.error) return fail(view, r);
  const out = h('p.msg', {role: 'status'});
  const act = async (c, action) => {
    const v = await confirmAction({title: `${action[0].toUpperCase() + action.slice(1)} “${c.title}”`, danger: action !== 'approve',
      text: action === 'approve' ? 'Puts a paid campaign that is waiting for review on air.' : 'Takes the campaign off the boards now. Any refund is handled separately.'}); if (!v) return;
    const res = await api.post('/api/admin/ads', {id: c.id, action, reason: v.reason}); say(out, res); if (!res.error) ads(view, ctx, state);
  };
  const pause = async (s) => {
    const v = await confirmAction({title: `${s.paused ? 'Resume' : 'Pause'} bookings on ${s.name}`, text: 'Campaigns already booked keep running.'}); if (!v) return;
    const res = await api.post('/api/admin/ads', {op: 'placement', id: s.id, paused: !s.paused, reason: v.reason}); say(out, res); if (!res.error) ads(view, ctx, state);
  };
  const statusTag = c => { const now = Date.now(); return c.status === 'approved' ? (+c.ends <= now ? tag('expired', 'mute') : +c.starts > now ? tag('scheduled', 'info') : tag('live', 'ok'))
    : c.status === 'paid' && c.review ? tag('in review', 'warn') : tag(c.status.replaceAll('_', ' '), ['suspended', 'rejected'].includes(c.status) ? 'bad' : 'mute'); };
  view.replaceChildren(h('h1', {text: 'Advertising'}), out,
    h('div.grid', {}, metric(pesewas(r.revenue.month), 'Revenue, 30 days', 'Verified payments only', true), metric(pesewas(r.revenue.total), 'Revenue, all time'),
      metric(num(r.impressions.impressions), 'Estimated impressions, 30 days', r.note), metric(num(r.impressions.clicks), 'Link opens, 30 days'),
      ...r.status.map(s => metric(num(s.n), s.state.replaceAll('_', ' ')))),
    h('h2', {text: 'Campaigns'}),
    h('div.row', {}, r.campaigns.filters.map(f => h('button.btn.small' + (f === state.filter ? '' : '.ghost'), {onclick: () => ads(view, ctx, {filter: f, page: 1})}, f.replaceAll('_', ' ')))),
    h('div', {style: 'height:10px'}),
    table([{label: '', get: c => h('img.thumb', {src: c.img, alt: '', loading: 'lazy'})}, {label: 'Campaign', get: c => h('div', {}, h('b', {text: c.title}), h('div.muted', {text: `#${c.id} · ${c.slot} · ${c.category || 'business'} · ${c.weeks} wk`}), c.review ? h('div.muted', {text: 'Review: ' + c.review}) : null)},
      {label: 'Status', get: statusTag}, {label: 'Paid', get: c => c.payment || '—'}, {label: 'Impressions', num: 1, get: c => num(c.impressions)}, {label: 'Price', num: 1, get: c => cedi(c.amount)},
      {label: '', get: c => ctx.can('ads.moderate') ? h('div.row', {},
        c.status === 'paid' && h('button.btn.small', {onclick: () => act(c, 'approve')}, 'Approve'),
        ['approved', 'paid'].includes(c.status) && !(c.ends && +c.ends <= Date.now()) && h('button.btn.ghost.small', {onclick: () => act(c, 'suspend')}, 'Suspend'),
        !['rejected', 'suspended', 'cancelled'].includes(c.status) && h('button.btn.ghost.small', {onclick: () => act(c, 'takedown')}, 'Take down')) : ''}],
    r.campaigns.rows, 'No campaigns in this list.'), pager(r.campaigns, page => ads(view, ctx, {...state, page})),
    h('h2', {text: 'Placements'}),
    table([{label: 'Placement', get: s => h('div', {}, h('b', {text: s.name}), h('div.muted', {text: `${s.type === 'ground' ? 'Ground panel' : s.tier + ' billboard'} · ${s.exclusive ? 'exclusive' : 'shared rotation'}`}))},
      {label: 'Price / week', num: 1, get: s => cedi(s.price)}, {label: 'On air', num: 1, get: s => `${s.onAir} / ${s.cap}`},
      {label: 'Bookings', get: s => s.paused ? tag('paused', 'warn') : tag(s.availability, s.availability === 'available' ? 'ok' : 'info')},
      {label: '', get: s => ctx.can('ads.placements') ? h('button.btn.ghost.small', {onclick: () => pause(s)}, s.paused ? 'Resume bookings' : 'Pause bookings') : ''}], r.placements),
    h('h2', {text: 'Refund and review cases'}),
    table([{label: 'Order', get: x => `#${x.id} (campaign ${x.campaign})`}, {label: 'Title', get: x => x.title}, {label: 'Amount', num: 1, get: x => pesewas(x.amount)}, {label: 'Payment', get: x => x.status}, {label: 'Reason', get: x => x.review_reason}], r.refunds, 'No refund or review cases.'),
    h('p.note', {text: 'Refunds are paid back through the payment provider by the owner; this console records the case but never moves money.'}));
}

export async function payments(view, ctx, state = {filter: 'all', type: '', page: 1}) {
  const r = await api.get('/api/admin/payments', state); if (r.error) return fail(view, r);
  const out = h('p.msg', {role: 'status'}), s = r.summary;
  const verify = async ref => { const res = await api.post('/api/admin/payments', {ref}); say(out, res, res.error ? '' : `${ref}: ${res.result?.status || 'unknown'}. ${res.note}`); if (!res.error) payments(view, ctx, state); };
  view.replaceChildren(h('h1', {text: 'Payments'}), h('p.note', {text: r.note}), out,
    h('div.grid', {}, metric(r.simulated ? 'Simulated' : r.live ? 'Connected' : 'Not connected', 'Payment provider', r.simulated ? 'Local QA checkout only; no real money' : r.live ? 'Live verification available' : 'Payments are not live; nothing can be charged', true),
      metric(num(s.pending), 'Pending'), metric(num(s.fulfilled), 'Fulfilled'), metric(num(s.review), 'Needs review'), metric(num(s.unresolved), 'Unresolved after checks'),
      metric(num(s.duplicate), 'Possible duplicate charges', 'Orders with more than one provider charge'), metric(num(s.receiptsQueued), 'Receipts waiting to send')),
    h('div.row', {style: 'margin-top:12px'}, r.filters.map(f => h('button.btn.small' + (f === state.filter ? '' : '.ghost'), {onclick: () => payments(view, ctx, {...state, filter: f, page: 1})}, f)),
      h('select', {'aria-label': 'Type', onchange: e => payments(view, ctx, {...state, type: e.target.value, page: 1})}, [['', 'All types'], ['ad', 'Advertising'], ['topup', 'Top-ups']].map(([v, t]) => h('option', {value: v, selected: v === state.type, text: t})))),
    h('div', {style: 'height:10px'}),
    table([{label: 'Order', get: o => `#${o.id} · ${o.type}`}, {label: 'Player', get: o => o.username || '—'}, {label: 'Amount', num: 1, get: o => pesewas(o.amount)},
      {label: 'Status', get: o => tag(o.status, o.fulfilled_at ? 'ok' : o.status === 'review' ? 'bad' : 'warn')}, {label: 'Created', get: o => when(o.created_at)},
      {label: 'Attempts', get: o => h('div', {}, (o.attempts || []).map(a => h('div.muted', {text: `${a.ref} · ${a.status}${a.verified ? ' · verified' : ''}${a.failure ? ' · ' + a.failure : ''}`})))},
      {label: 'Charges', num: 1, get: o => o.charges > 1 ? tag(String(o.charges), 'bad') : num(o.charges)},
      {label: 'Receipt', get: o => o.receipt ? (o.receipt.sent ? 'sent' : 'queued') : '—'},
      {label: '', get: o => ctx.can('payments.verify') && !o.fulfilled_at && o.attempts?.length ? h('button.btn.ghost.small', {onclick: () => verify(o.attempts.at(-1).ref)}, 'Re-verify') : ''}],
    r.rows, 'No payment orders in this list.'), pager(r, page => payments(view, ctx, {...state, page})));
}

export async function world(view, ctx) {
  const [w, e] = await Promise.all([ctx.can('world.manage') ? api.get('/api/admin/world') : null, ctx.can('events.manage') ? api.get('/api/admin/events') : null]);
  if (w?.error) return fail(view, w); if (e?.error) return fail(view, e);
  const out = h('p.msg', {role: 'status'}), parts = [h('h1', {text: 'World and events'}), out];
  if (w) {
    const flip = async f => {
      const v = await confirmAction({title: `${f.enabled ? 'Turn off' : 'Turn on'}: ${f.name}`, text: f.detail, danger: f.enabled}); if (!v) return;
      const res = await api.post('/api/admin/world', {op: 'flag', key: f.key, enabled: !f.enabled, version: f.version, reason: v.reason}); say(out, res); if (!res.error) world(view, ctx);
    };
    const text = h('input.grow', {maxlength: 200, placeholder: 'Message shown to every player now online', 'aria-label': 'Announcement'});
    const announce = async () => {
      const v = await confirmAction({title: 'Send announcement', text: `“${text.value}” goes to every player online on every shard.`}); if (!v) return;
      const res = await api.post('/api/admin/world', {op: 'announce', text: text.value, reason: v.reason}); say(out, res, `Sent to ${res.delivered} players on this shard (and other shards).`); if (!res.error) world(view, ctx);
    };
    parts.push(h('h2', {text: 'Feature flags'}), h('p.note', {text: 'Each flag is read by the server; changes reach every shard within 10 seconds.'}),
      table([{label: 'Feature', get: f => h('div', {}, h('b', {text: f.name}), h('div.muted', {text: f.detail}))}, {label: 'State', get: f => f.enabled ? tag('on', 'ok') : tag('off', 'bad')},
        {label: 'Last change', get: f => f.updatedBy ? `${f.updatedBy}, ${when(f.updatedAt)}` : 'default'}, {label: '', get: f => h('button.btn.ghost.small', {onclick: () => flip(f)}, f.enabled ? 'Turn off' : 'Turn on')}], w.flags),
      h('h2', {text: 'Announcements'}), h('div.row', {}, text, h('button.btn', {onclick: announce}, 'Send')),
      table([{label: 'When', get: a => when(a.at)}, {label: 'By', get: a => a.actor_name}, {label: 'Message', get: a => a.text}], w.announcements, 'No announcements yet.'));
  }
  if (e) parts.push(...eventsPanel(view, ctx, e, out));
  view.replaceChildren(...parts);
}
function eventsPanel(view, ctx, e, out) {
  const kinds = Object.entries(e.kinds).filter(([, k]) => !k.player);
  const kind = h('select', {'aria-label': 'Event type'}, kinds.map(([id, k]) => h('option', {value: id, text: k.name})));
  const venue = h('select', {'aria-label': 'Venue'});
  const fill = () => venue.replaceChildren(...(e.kinds[kind.value]?.venues || []).map(v => h('option', {value: v, text: e.venueNames?.[v] || v})));
  kind.addEventListener('change', fill); fill();
  const f = {title: h('input', {maxlength: 60, required: true}), description: h('input', {maxlength: 300}), start: h('input', {type: 'datetime-local', required: true}),
    minutes: h('input', {type: 'number', value: 60, min: 15, max: 360}), capacity: h('input', {type: 'number', value: 20, min: 2, max: 200}), newcomers: h('input', {type: 'checkbox'})};
  const create = async ev => {
    ev.preventDefault();
    const spec = {kind: kind.value, venue: venue.value, title: f.title.value, description: f.description.value, startsAt: new Date(f.start.value).getTime(),
      minutes: +f.minutes.value, capacity: +f.capacity.value, eligibility: {newcomers: f.newcomers.checked}};
    const res = await api.post('/api/admin/events', {op: 'create', spec}); say(out, res, 'Event scheduled.'); if (!res.error) world(view, ctx);
  };
  const change = async (row, op) => {
    const v = await confirmAction({title: `${op === 'cancel' ? 'Cancel' : 'Restore'} “${row.title}”`, danger: op === 'cancel', text: op === 'cancel' ? 'Players who RSVPed are told it was cancelled.' : ''}); if (!v) return;
    const res = await api.post('/api/admin/events', {op, id: row.id, reason: v.reason}); say(out, res); if (!res.error) world(view, ctx);
  };
  return [h('h2', {text: 'Scheduled events'}),
    h('form.panel', {onsubmit: create}, h('div.cols', {}, h('label', {}, 'Type', kind), h('label', {}, 'Venue', venue), h('label', {}, 'Title', f.title), h('label', {}, 'Description', f.description),
      h('label', {}, 'Starts', f.start), h('label', {}, 'Minutes', f.minutes), h('label', {}, 'Capacity', f.capacity), h('label', {}, h('span', {}, f.newcomers, ' First-week players only'))),
    h('div.row.end', {}, h('button.btn', {type: 'submit'}, 'Schedule event'))),
    h('div', {style: 'height:10px'}),
    table([{label: 'When', get: x => `${when(x.starts_at)} → ${when(x.ends_at)}`}, {label: 'Event', get: x => h('div', {}, h('b', {text: x.title}), h('div.muted', {text: `${e.kinds[x.kind]?.name || x.kind} at ${e.venueNames?.[x.venue] || x.venue} · host ${x.host_name}`}))},
      {label: 'Status', get: x => tag(x.status, x.status === 'live' ? 'ok' : x.status === 'scheduled' ? 'info' : ['cancelled', 'suspended'].includes(x.status) ? 'bad' : 'mute')},
      {label: 'Going / attended', num: 1, get: x => `${x.going} / ${x.attended}`}, {label: 'Reports', num: 1, get: x => (x.report_rows || []).length},
      {label: '', get: x => ['scheduled', 'live'].includes(x.status) ? h('button.btn.ghost.small', {onclick: () => change(x, 'cancel')}, 'Cancel') : x.status === 'suspended' ? h('button.btn.ghost.small', {onclick: () => change(x, 'restore')}, 'Restore') : ''}],
    e.rows, 'No events yet.')];
}

export async function ops(view) {
  const r = await api.get('/api/admin/ops'); if (r.error) return fail(view, r);
  const ok = (good, label) => tag(label, good ? 'ok' : 'bad');
  const shards = Object.entries(r.shards || {});
  view.replaceChildren(h('h1', {text: 'Operations'}), h('p.note', {text: `Counters below cover this server process since ${when(r.since)} (uptime ${Math.round(r.uptimeS / 60)} min).`}),
    h('div.grid', {}, metric(`${num(r.online)} / ${num(r.capacity)}`, 'Connections / capacity', `Shard ${r.shard}`, true), metric(`${r.lagMs} ms`, 'Event-loop delay', 'Above 50 ms players notice lag'),
      metric(r.db.ok ? `${r.db.ms} ms` : 'down', 'Database', r.db.ok ? `pool ${r.db.pool.total} open, ${r.db.pool.waiting} waiting` : r.db.code),
      metric(r.redis.ok ? `${r.redis.ms} ms` : r.redis.status, 'Redis', r.redis.ok ? 'ready' : 'Rate limits fall back to memory only outside production'),
      metric(`${r.memoryMb.rss} MB`, 'Memory (RSS)', `heap ${r.memoryMb.heap} MB`), metric(num(r.counters.http5xx), 'Server errors (5xx)', `${num(r.counters.http4xx)} client errors (4xx)`),
      metric(num(r.faults), 'Game request faults'), metric(num(r.payments.unresolved), 'Payments awaiting reconciliation', `Provider ${r.payments.provider}; last check ${when(r.payments.last_check)}`)),
    h('div.cols', {style: 'margin-top:12px'},
      h('div.panel', {}, h('h3', {text: 'Shards'}), table([{label: 'Shard', get: ([id]) => id}, {label: 'Players', num: 1, get: ([, n]) => num(n)}], shards, 'Redis is unavailable, so other shards are not visible.')),
      h('div.panel', {}, h('h3', {text: 'Background workers'}),
        table([{label: 'Worker', get: ([n]) => n}, {label: 'Health', get: ([, w]) => ok(!w.lastFailure || w.lastOk > w.lastFailure, w.lastFailure && !(w.lastOk > w.lastFailure) ? 'failing' : 'ok')},
          {label: 'Last success', get: ([, w]) => ago(w.lastOk)}, {label: 'Runs / failures', num: 1, get: ([, w]) => `${w.runs} / ${w.failures}`}], Object.entries(r.workers), 'No worker has run yet.')),
      h('div.panel', {}, h('h3', {text: 'Recent incidents'}),
        table([{label: 'When', get: i => when(i.at)}, {label: 'Source', get: i => i.source}, {label: 'Code', get: i => i.code}], r.incidents, 'No incidents since start.'))));
}
