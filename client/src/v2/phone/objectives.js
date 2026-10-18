import { h } from '../ui/dom.js';
import { G } from '../store.js';
import { net } from '../net.js';

export function milestones(win, act) {
  let error = '', pending = false, timer, category = 'intro';
  const load = () => net.send({ t: 'objective_status' });
  const offs = [
    net.on('objectives', () => { clearTimeout(timer); pending = false; error = ''; win.refresh(); }),
    net.on('objective_error', m => { clearTimeout(timer); pending = false; error = m.error; win.refresh(); })
  ];
  win.onclose = () => { clearTimeout(timer); offs.forEach(off => off()); };

  win.page('Your own pace', () => {
    const list = (G.objectives || []).filter(d => (d.category || 'intro') === category);

    const segmentTabs = h('div.seg-i', null,
      ...[['intro', 'Getting started'], ['long', 'Long-term']].map(([id, label]) =>
        h('button' + (category === id ? '.on' : ''), {
          onclick: () => { category = id; win.refresh(); },
          'aria-pressed': String(category === id)
        }, label)
      )
    );

    const cards = list.map(d => {
      const badge = d.claimed
        ? h('span.mc-badge.claimed', null, 'Claimed')
        : d.completed
        ? h('span.mc-badge.completed', null, '✓ Complete')
        : h('span.mc-badge.available', null, 'Available');

      const claimBtn = d.completed && !d.claimed
        ? h('button.ibtn.wide.green', {
            style: { height: '42px', marginTop: '4px' },
            disabled: pending,
            onclick: () => {
              pending = net.send({ t: 'objective_claim', id: d.id });
              if (!pending) error = 'Reconnect before claiming your milestone.';
              else timer = setTimeout(() => { pending = false; error = 'No confirmation yet. Check progress before retrying.'; win.refresh(); }, 15000);
              win.refresh();
            }
          }, `Claim milestone (+${d.xp} XP)`)
        : !d.completed
        ? h('button.ibtn.wide.gray', {
            style: { height: '40px', marginTop: '4px' },
            onclick: () => next(d)
          }, d.action === 'home' ? 'Return to the world' : 'Open ' + (d.action === 'meet' ? 'Meet' : d.action === 'explore' ? 'Explore' : d.action))
        : null;

      return h('div.milestone-card', null,
        h('div.mc-head', null,
          h('div.mc-title', null, d.title),
          badge
        ),
        h('p.mc-desc', null, d.description),
        h('div.mc-reward', null, `+${d.xp} XP${d.badge ? ' · ' + d.badge + ' badge' : ''}`),
        claimBtn
      );
    });

    return h('div', null,
      h('p', { style: { padding: '0 4px', fontSize: '13.5px', color: '#55695d', lineHeight: 1.45, margin: '2px 0 10px' } },
        'Optional ideas for discovery, friendship and everyday life. Choose any order, or keep exploring. Rewards are one-time XP and badges.'
      ),
      error ? h('p', { role: 'status', style: { color: '#c53030', fontSize: '13px', margin: '4px 0 8px' } }, error) : null,
      segmentTabs,
      h('div.group', null, ...cards),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' } },
        h('button.ibtn.wide.gray', { disabled: pending, onclick: load }, 'Check progress'),
        h('button.ibtn.wide', { onclick: () => act.phone('goals') }, 'Your aspirations')
      )
    );
  });

  load();

  function next(d) {
    if (d.action === 'home') { act.closePhone(); act.nav('home'); }
    else if (d.action === 'map') { act.closePhone(); act.map(); }
    else act.phone(d.action);
  }
}
