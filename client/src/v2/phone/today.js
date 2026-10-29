// "Today" phone app: the Daily Chale front page, the streak ladder and three daily missions.
import { h, ic, icf, cedi } from '../ui/dom.js';
import { G } from '../store.js';
import { net } from '../net.js';
import { todaySummary, ladderView, missionView } from './today-state.js';

const PENDING_MS = 15000;
const fmtDate = (iso) => { const d = new Date(iso + 'T12:00:00Z'); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); };

export function todayApp(win, act) {
  let board = G.state?.daily || null, pending = null, timer = null, error = '';
  const settle = (msg) => { clearTimeout(timer); pending = null; error = msg || ''; win.refresh(); };
  const offs = [
    net.on('hustle', (m) => { board = m.board; if (G.state) G.state.daily = m.board; settle(''); }),
    net.on('toast', (m) => { if (pending && m.k === 'bad') settle(m.m); }),
  ];
  win.onclose = () => { clearTimeout(timer); offs.forEach((off) => off()); };
  const send = (op, id) => {
    if (pending) return;
    if (!net.send({ t: 'hustle', op, id })) { error = 'Reconnect to update your board.'; win.refresh(); return; }
    pending = op + ':' + (id || ''); timer = setTimeout(() => settle('No answer yet. Check the board before retrying.'), PENDING_MS); win.refresh();
  };

  win.page('Today', () => {
    if (!board) return h('div.empty', null, ic('sun-horizon'), 'Loading today’s board…');
    const sum = todaySummary(board);
    return h('div.today', null, paperCard(board.paper), streakCard(board, sum), error ? h('p.today-error', { role: 'status' }, error) : null,
      h('div.group-h', null, `Today’s missions · ${sum.done}/${sum.total}`),
      ...board.list.map((m) => missionCard(missionView(m), board.rerolls)),
      h('p.today-foot', null, board.rerolls ? 'You can swap one mission today. New board at midnight (Accra time).' : 'New board at midnight (Accra time).'));
  });
  send('status');

  function paperCard(p) {
    if (!p) return null;
    return h('section.today-paper', { 'aria-label': 'The Daily Chale' },
      h('div.today-masthead', null, h('b', null, 'The Daily Chale'), h('span', null, fmtDate(p.date))),
      h('h3', null, p.headline),
      h('div.today-weather', null, icf(/rain|shower|storm|drizzle/i.test(p.weather.sky) ? 'cloud-rain' : /haze|dust/i.test(p.weather.sky) ? 'wind' : 'sun'), h('span', null, `${p.weather.sky} · ${p.weather.high}°C`), h('small', null, p.weather.season)),
      p.occasion ? h('div.today-occasion', null, icf('confetti'), p.occasion) : null,
      h('p.today-tip', null, h('b', null, 'Chale tip: '), p.tip));
  }
  function streakCard(b, sum) {
    const steps = ladderView(b);
    return h('section.today-streak', null,
      h('div.today-streak-top', null, h('div.today-flame' + (sum.streak ? '.lit' : ''), null, icf('fire')),
        h('div', null, h('b', null, sum.streak ? `${sum.streak}-day streak` : 'Start a streak'),
          h('small', null, sum.finished ? 'Done for today. Come back tomorrow.' : sum.atRisk ? 'You missed yesterday. A streak saver will cover it if you finish today.' : 'Finish all three missions to earn today’s bonus.')),
        h('div.today-savers', { title: 'Streak savers' }, icf('shield-check'), String(b.savers || 0))),
      h('ol.today-ladder', null, ...steps.map((s) => h('li.' + s.state + (s.chest ? '.chest' : ''), null, s.chest ? icf('treasure-chest') : h('span', null, s.day), h('small', null, '₵' + s.cash)))));
  }
  function missionCard(m, rerolls) {
    const busy = !!pending;
    return h('article.today-mission.cat-' + m.cat.id, null,
      h('div.today-mission-head', null, h('span.today-cat', null, icf(m.cat.icon), m.cat.name), h('small', null, `+${cedi(m.reward.cash)} · ${m.reward.xp} XP`)),
      h('b', null, m.label), h('p', null, m.hint),
      h('div.today-bar', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': m.need, 'aria-valuenow': m.n }, h('i', { style: { width: m.pct + '%' } })),
      h('div.today-actions', null, h('small', null, m.action === 'claimed' ? 'Claimed' : `${m.n}/${m.need}`),
        m.action === 'claim' ? h('button.ibtn.green', { disabled: busy, onclick: () => send('claim', m.id) }, 'Claim') : null,
        m.action === 'progress' && rerolls > 0 ? h('button.ibtn.gray', { disabled: busy, onclick: () => send('reroll', m.id) }, ic('shuffle'), 'Swap') : null,
        m.action === 'progress' ? h('button.ibtn.gray', { onclick: () => { act.closePhone(); act.nav('map'); } }, ic('navigation-arrow'), 'Go') : null));
  }
}
