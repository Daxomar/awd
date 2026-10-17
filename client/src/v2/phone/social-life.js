// Stage 7 social life: community events, public-profile privacy and home guests.
// Everything shown here comes from the server (real RSVPs, real presence); nothing is simulated.
import {h,ic} from '../ui/dom.js';
import {G,loc} from '../store.js';
import {net} from '../net.js';

const row = (title, sub, right, onclick) => h(onclick ? 'button.cell.noic' : 'div.cell.noic', {onclick}, h('div.cm', null, h('div.c1', null, title), sub ? h('div.c2', null, sub) : null), right ? h('div.cr', null, right) : null);
const when = (t) => new Date(t).toLocaleString([], {weekday: 'short', hour: '2-digit', minute: '2-digit'});
const STATUS = {live: 'Happening now', scheduled: 'Upcoming', ended: 'Ended', cancelled: 'Cancelled', suspended: 'Paused for review'};

// ---------------------------------------------------------------- events
export function eventsApp(win, act, focus) {
  let data = null, note = '', tab = 'now';
  const load = () => net.send({t: 'events_list'});
  const offs = [net.on('events', m => { data = m; win.refresh(); }), net.on('event_result', m => { if (m.error) note = m.error; else if (m.reported) note = 'Thanks. Moderators will review this event.'; else note = ''; if (m.list) data = m.list; win.refresh(); }),
    net.on('event_live', load), net.on('event_cancelled', load)];
  const prev = win.onclose; win.onclose = () => { offs.forEach(off => off()); prev && prev(); };
  const go = (e) => { act.closePhone(); if (e.home) net.send({t: 'visit', name: e.home, mode: G.state.car ? 'car' : 'trotro'}); else if (G.state.place === e.venue) act.interact(); else act.place(e.venue); };
  function detail(e) {
    win.page(e.title, () => {
      const cur = data?.rows.find(x => x.id === e.id) || e;
      return h('div', null,
        h('div.group', {style: {padding: '14px'}}, h('strong', null, cur.kindName + (cur.official ? ' · Official' : ` · hosted by @${cur.host}`)),
          h('p', null, cur.description || cur.activity), h('p', {style: {fontSize: '13px', color: '#6d6d72'}}, `${cur.venueName} · ${when(cur.startsAt)}–${new Date(cur.endsAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`),
          h('p', {style: {fontSize: '13px'}}, `${STATUS[cur.status] || cur.status} · ${cur.going}/${cur.capacity} going${cur.status === 'live' ? ` · ${cur.here} here now` : ''}${cur.visibility !== 'public' ? ' · ' + cur.visibility + ' only' : ''}`),
          cur.activity ? h('p', {style: {fontSize: '13px'}}, 'What to do: ' + cur.activity) : null,
          cur.mySeconds ? h('p', {style: {fontSize: '13px'}}, `You attended ${Math.round(cur.mySeconds / 60)} min.`) : null,
          !cur.eligible ? h('p', {style: {color: '#b3261e', fontSize: '13px'}}, cur.why) : null),
        cur.results ? h('div.group', {style: {padding: '14px'}}, h('strong', null, 'Results'), h('p', null, `${cur.results.attendees} attended · ${cur.results.minutes} minutes together`),
          ...(cur.results.top || []).map(t => h('div', {style: {fontSize: '13px'}}, `@${t.name} · ${t.minutes} min`)), cur.results.rewardXp ? h('p', {style: {fontSize: '12px', color: '#6d6d72'}}, `Reward: ${cur.results.rewardXp} XP (${cur.results.rewardStatus})`) : null) : null,
        cur.cancelReason ? h('p', {style: {padding: '0 8px'}}, 'Cancelled: ' + cur.cancelReason) : null,
        note ? h('p', {role: 'status', style: {padding: '0 8px'}}, note) : null,
        ['scheduled', 'live'].includes(cur.status) && !cur.isHost ? h('button.ibtn.wide' + (cur.mine ? '.gray' : '.green'), {disabled: !cur.eligible && !cur.mine, onclick: () => net.send({t: 'event_rsvp', id: cur.id, on: !cur.mine})}, cur.mine ? 'Cancel my RSVP' : 'I’m going') : null,
        cur.status === 'live' ? h('button.ibtn.wide', {onclick: () => go(cur)}, cur.home ? `Visit @${cur.home}’s home` : `Go to ${cur.venueName}`) : null,
        cur.isHost && ['scheduled', 'live', 'suspended'].includes(cur.status) ? h('button.ibtn.wide.red', {onclick: () => net.send({t: 'event_cancel', id: cur.id})}, 'Cancel this event') : null,
        !cur.isHost && !cur.official ? h('button.ibtn.wide.gray', {onclick: () => net.send({t: 'event_report', id: cur.id, reason: 'Reported from Events'})}, 'Report event') : null);
    }, {small: true});
  }
  function hostForm() {
    const kinds = Object.entries(data?.kinds || {}), lim = data?.limits || {durMin: 30, durMax: 180, capMax: 30};
    const d = {kind: 'house', title: '', description: '', venue: '', day: 0, time: '19:00', minutes: 60, capacity: 6, visibility: 'friends', invite: ''};
    win.page('Host an event', () => {
      const k = data?.kinds?.[d.kind];
      if (k && !k.player && !k.venues.includes(d.venue)) d.venue = k.venues[0];
      const field = (label, input) => h('label', {style: {display: 'grid', gap: '4px', margin: '10px 4px'}}, h('span', {style: {fontSize: '13px', color: '#6d6d72'}}, label), input);
      return h('div', null, h('p', {style: {padding: '0 8px', fontSize: '13px'}}, 'Gatherings use real venues and real attendance. One upcoming event at a time, up to three a week. Accounts can host after their first day.'),
        field('Type', h('select', {onchange: e => { d.kind = e.target.value; win.refresh(); }}, ...kinds.map(([id, x]) => h('option', {value: id, selected: id === d.kind}, x.name)))),
        k && !k.player ? field('Venue', h('select', {onchange: e => { d.venue = e.target.value; }}, ...k.venues.map(v => h('option', {value: v, selected: v === d.venue}, loc(v)?.name || v)))) : h('p', {style: {padding: '0 8px', fontSize: '13px'}}, 'At your home. Guests can come in while your event is live.'),
        field('Title', h('input', {maxLength: 60, value: d.title, placeholder: 'e.g. Saturday jollof at mine', oninput: e => { d.title = e.target.value; }})),
        field('Description (optional)', h('textarea', {maxLength: 300, rows: 3, value: d.description, oninput: e => { d.description = e.target.value; }})),
        field('Day', h('select', {onchange: e => { d.day = +e.target.value; }}, ...[0, 1, 2, 3, 4, 5, 6].map(n => h('option', {value: n, selected: n === d.day}, n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : new Date(Date.now() + n * 864e5).toLocaleDateString([], {weekday: 'long'}))))),
        field('Start time (your clock)', h('input', {type: 'time', value: d.time, oninput: e => { d.time = e.target.value; }})),
        field(`Length (${lim.durMin}–${lim.durMax} minutes)`, h('input', {type: 'number', min: lim.durMin, max: lim.durMax, value: d.minutes, oninput: e => { d.minutes = +e.target.value; }})),
        field('Capacity', h('input', {type: 'number', min: 2, max: lim.capMax, value: d.capacity, oninput: e => { d.capacity = +e.target.value; }})),
        field('Who can see it', h('select', {onchange: e => { d.visibility = e.target.value; win.refresh(); }}, ...[['friends', 'Friends'], ['invite', 'Invited players only'], ['public', 'Everyone']].map(([v, l]) => h('option', {value: v, selected: v === d.visibility}, l)))),
        d.visibility === 'invite' ? field('Invite (usernames, comma separated)', h('input', {value: d.invite, oninput: e => { d.invite = e.target.value; }})) : null,
        note ? h('p', {role: 'status', style: {padding: '0 8px'}}, note) : null,
        h('button.ibtn.wide.green', {onclick: () => {
          const [hh, mm] = (d.time || '19:00').split(':').map(Number), start = new Date(); start.setDate(start.getDate() + d.day); start.setHours(hh, mm, 0, 0);
          note = 'Saving…'; net.send({t: 'event_host', spec: {kind: d.kind, venue: d.venue, title: d.title, description: d.description, startsAt: start.getTime(), minutes: d.minutes, capacity: d.capacity, visibility: d.visibility, invite: d.invite.split(',').map(x => x.trim()).filter(Boolean)}});
          const off = net.on('event_result', m => { off(); if (m.ok && m.id) { note = 'Your event is scheduled.'; win.pop(); } });
        }}, 'Schedule event'));
    }, {small: true});
  }
  win.page('Events', () => {
    if (!data) return h('div.empty', null, 'Loading events…');
    const rows = data.rows, pick = {now: rows.filter(e => e.status === 'live'), soon: rows.filter(e => e.status === 'scheduled'), mine: rows.filter(e => e.mine || e.isHost), past: rows.filter(e => ['ended', 'cancelled', 'suspended'].includes(e.status))}[tab];
    return h('div', null,
      h('p', {style: {padding: '0 8px', fontSize: '13px', color: '#6d6d72'}}, 'Community events at real places. Counts are real players; small gatherings are welcome.'),
      h('div.row', {style: {gap: '6px', margin: '0 0 10px'}}, ...[['now', 'Now'], ['soon', 'Upcoming'], ['mine', 'Mine'], ['past', 'Past']].map(([id, l]) => h('button.ibtn.grow' + (tab === id ? '' : '.gray'), {onclick: () => { tab = id; win.refresh(); }}, l))),
      note ? h('p', {role: 'status', style: {padding: '0 8px'}}, note) : null,
      pick.length ? h('div.group', null, ...pick.map(e => row(e.title, `${e.kindName} · ${e.venueName} · ${e.status === 'live' ? `${e.here} here now` : when(e.startsAt)}`, `${e.going}/${e.capacity}${e.mine ? ' ✓' : ''}`, () => detail(e))))
        : h('div.empty', null, tab === 'now' ? 'Nothing is happening right now. Check upcoming events, or host a small gathering.' : tab === 'soon' ? 'No upcoming events yet.' : tab === 'mine' ? 'You have not joined any events.' : 'No recent events.'),
      h('button.ibtn.wide', {onclick: hostForm}, ic('calendar-plus'), ' Host an event'),
      h('button.ibtn.wide.gray', {onclick: load}, 'Refresh'));
  });
  load();
  if (focus) setTimeout(() => { const e = data?.rows.find(x => x.id === focus); if (e) detail(e); }, 1200);
}

// ---------------------------------------------------------------- public profile settings
const SHOW = [['career', 'Career'], ['achievements', 'Badges and milestones'], ['rep', 'Reputation and title'], ['business', 'Business'], ['possessions', 'Car and owned homes'], ['residence', 'Neighbourhood you live in'], ['worth', 'Net worth']];
const HEADLINES = ['', 'New in Accra', 'Hustling every day', 'Here to make friends', 'Building a business', 'Learning a trade', 'Football fan', 'Oware champion in training', 'Always at the beach', 'Nightlife regular', 'Fashion lover', 'Family first', 'Saving for my own house'];
export function profileSettings(win) {
  let draft = null;
  const off = net.on('profile', m => { if (m.p?.me && m.p.settings && !draft) { draft = structuredClone(m.p.settings); win.refresh(); } });
  const prev = win.onclose; win.onclose = () => { off(); prev && prev(); };
  net.send({t: 'profile', name: G.state.name});
  win.page('Public profile', () => {
    if (!draft) return h('div.empty', null, 'Loading…');
    const badges = G.state.flags?.discoveryBadges || [];
    return h('div', null, h('p', {style: {padding: '0 8px', fontSize: '13px'}}, 'Choose what other players see. Your location, money, email and account details are never shown.'),
      h('div.group', null, ...SHOW.map(([k, label]) => h('label.cell.noic', {style: {minHeight: '48px'}}, h('div.cm', null, h('div.c1', null, label)), h('input', {type: 'checkbox', checked: !!draft.show[k], style: {width: '22px', height: '22px'}, onchange: e => { draft.show[k] = e.target.checked; }})))),
      h('label', {style: {display: 'grid', gap: '4px', margin: '12px 4px'}}, h('span', {style: {fontSize: '13px', color: '#6d6d72'}}, 'Headline'), h('select', {onchange: e => { draft.headline = e.target.value; }}, ...HEADLINES.map(x => h('option', {value: x, selected: x === draft.headline}, x || 'No headline')))),
      h('label', {style: {display: 'grid', gap: '4px', margin: '12px 4px'}}, h('span', {style: {fontSize: '13px', color: '#6d6d72'}}, 'Featured badge'), h('select', {onchange: e => { draft.badge = e.target.value; }}, h('option', {value: ''}, badges.length ? 'None' : 'Earn badges from milestones'), ...badges.map(x => h('option', {value: x, selected: x === draft.badge}, x)))),
      h('label', {style: {display: 'grid', gap: '4px', margin: '12px 4px'}}, h('span', {style: {fontSize: '13px', color: '#6d6d72'}}, 'Profile colour'), h('select', {onchange: e => { draft.accent = e.target.value; }}, ...['kente', 'ocean', 'forest', 'sunset', 'night'].map(x => h('option', {value: x, selected: x === draft.accent}, x[0].toUpperCase() + x.slice(1))))),
      h('button.ibtn.wide.green', {onclick: () => { net.send({t: 'profile_set', ...draft}); win.pop(); }}, 'Save profile'));
  }, {small: true});
}

// ---------------------------------------------------------------- home guests
const MODES = [['friends', 'Mutual friends can drop in'], ['invite', 'Invitation only'], ['open', 'Open house (anyone online)'], ['closed', 'Closed to visitors']];
export function homeGuests(win, act) {
  const a = {mode: 'friends', limit: 6, furniture: 'guests', ...(G.state.homeAccess || {})};
  win.page('Guests at home', () => {
    const atHome = G.state.place === 'home', guests = atHome ? act.roomPeople?.() || [] : [];
    return h('div', null, h('p', {style: {padding: '0 8px', fontSize: '13px'}}, 'You decide who can come in. Blocked players can never visit. Guests can use your toilet, TV and guitar only if you allow it; never your bed, bath or kitchen.'),
      h('div.group', null, ...MODES.map(([v, l]) => h('label.cell.noic', {style: {minHeight: '48px'}}, h('div.cm', null, h('div.c1', null, l)), h('input', {type: 'radio', name: 'home-mode', checked: a.mode === v, style: {width: '22px', height: '22px'}, onchange: () => { a.mode = v; }})))),
      h('label', {style: {display: 'grid', gap: '4px', margin: '12px 4px'}}, h('span', {style: {fontSize: '13px', color: '#6d6d72'}}, 'Most visitors at once (1–8)'), h('input', {type: 'number', min: 1, max: 8, value: a.limit, oninput: e => { a.limit = Math.round(+e.target.value); }})),
      h('label.cell.noic', {style: {minHeight: '48px'}}, h('div.cm', null, h('div.c1', null, 'Guests may use toilet, TV and guitar')), h('input', {type: 'checkbox', checked: a.furniture === 'guests', style: {width: '22px', height: '22px'}, onchange: e => { a.furniture = e.target.checked ? 'guests' : 'owner'; }})),
      h('button.ibtn.wide.green', {onclick: () => { net.send({t: 'homeaccess', ...a}); act.toast('Home settings saved.', 'good'); }}, 'Save home settings'),
      h('div.group-h', null, atHome ? `Visiting now (${guests.length})` : 'Visitors'),
      atHome ? (guests.length ? h('div.group', null, ...guests.map(g => row('@' + g.n, 'In your home', h('span', {style: {color: '#b3261e'}}, 'Ask to leave'), () => net.send({t: 'home_remove', name: g.n})))) : h('div.empty', null, 'Nobody is visiting right now. Invite someone from their player card or Contacts.'))
        : h('div.empty', null, 'Go home to see and manage visitors.'));
  }, {small: true});
}
