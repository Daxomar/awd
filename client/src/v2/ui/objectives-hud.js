// Stage 6 HUD objectives: a compact, collapsible first-session guide on the main game screen.
// Progress and rewards stay on the server (objective_status / objective_claim / story_claim);
// only the open/closed preference is local.
import { h, ic, toast, cedi } from './dom.js';
import { net } from '../net.js';
import { G } from '../store.js';
import { hudRows, currentObjective } from './hud-state.js';
import { openStoryEncounter, openAspirationModal } from './story-dialog.js';

const PREF = 'awd.objectives.open';
const readOpen = () => { try { return localStorage.getItem(PREF) === '1'; } catch { return false; } };
const saveOpen = (v) => { try { localStorage.setItem(PREF, v ? '1' : '0'); } catch {} };
const ICON = { houses: 'house-line', home: 'house', interact: 'hand-tap', meet: 'hand-waving', jobs: 'briefcase', status: 'heartbeat', explore: 'compass', map: 'map-trifold', messages: 'chat-circle-dots', boutique: 't-shirt' };

export function goObjective(d, act) {
  if (!d) return;
  if (d.encounterId || d.activeEncounter) {
    return openStoryEncounter(d.activeEncounter || { id: d.encounterId, title: d.title, text: d.desc });
  }
  if (d.venue) {
    if (d.venue === 'home') return act.nav('home');
    return act.map();
  }
  switch (d.action) {
    case 'home': return act.nav('home');
    case 'map': case 'explore': return act.map();
    case 'interact': return act.nav('interact');
    case 'status': return act.status();
    case 'meet': return act.meet();
    case 'market': case 'boutique': case 'shop': return act.phone('shop');
    case 'bank': case 'momo': return act.wallet();
    case 'houses': case 'jobs': return act.app(d.action);
    case 'goals': case 'story': return act.goals();
    default: return act.phone(d.action || 'goals');
  }
}

export function buildObjectives(act) {
  let open = readOpen(), view = { label: '', rows: [] }, known = null;
  const pending = new Set();
  const el = h('section.objectives-hud', { hidden: true, 'aria-label': 'Objectives' });

  function claim(d) {
    if (pending.has(d.id)) return;
    if (!net.send({ t: 'objective_claim', id: d.id })) return toast('Reconnect before claiming.', 'bad');
    pending.add(d.id); setTimeout(() => { pending.delete(d.id); draw(); }, 15000); draw();
  }

  function claimStory(id) {
    if (pending.has(id)) return;
    if (!net.send({ t: 'story_claim', id })) return toast('Reconnect before claiming.', 'bad');
    pending.add(id); setTimeout(() => { pending.delete(id); draw(); }, 10000); draw();
  }

  function row(d) {
    const state = d.claimed ? 'claimed' : d.completed ? 'ready' : 'open';
    return h('div.obj-row', { 'data-state': state },
      h('span.obj-mark', { 'aria-hidden': 'true' }, ic(d.claimed ? 'check-circle' : d.completed ? 'gift' : 'circle')),
      h('div.obj-text', null,
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '5px' } },
          h('strong', null, d.title),
          h('span.mission-tag.side', null, 'SIDE')
        ),
        h('small', null, d.claimed ? `Done · ${d.xp} XP earned` : d.description)
      ),
      d.claimed ? null : d.completed ? h('button.obj-btn.claim', { disabled: pending.has(d.id), onclick: () => claim(d) }, `Claim ${d.xp} XP`) :
        h('button.obj-btn', { 'aria-label': 'Go: ' + d.title, onclick: () => goObjective(d, act) }, 'Go'));
  }

  function draw() {
    const s = G.state;
    const curObj = currentObjective(view);
    const storyMission = s?.story?.activeMission;
    const noDream = s?.onboarded && !s?.dream;

    // 1. If player has no aspiration set, show the prominent aspiration prompt
    if (noDream) {
      el.hidden = false;
      const head = h('div.obj-head', null,
        h('button.obj-toggle', {
          'aria-expanded': 'false',
          onclick: () => openAspirationModal(() => act.refresh())
        },
          h('span.obj-icon', { 'aria-hidden': 'true', style: { background: '#fef3c7', color: '#b45309' } }, ic('sparkle')),
          h('span.obj-copy', null,
            h('small', null, 'Your Calling in Accra'),
            h('strong', null, 'Choose Your Accra Dream')
          ),
          ic('caret-right')
        ),
        h('button.obj-btn.claim', {
          onclick: () => openAspirationModal(() => act.refresh())
        }, 'Choose')
      );
      el.replaceChildren(head);
      return;
    }

    // 2. If an active story mission exists, it takes top spotlight on the HUD beacon!
    if (storyMission) {
      el.hidden = false;
      const isReady = storyMission.ready;
      const isClimax = storyMission.isClimax && !isReady;
      const arcTitle = storyMission.arcTitle || 'Accra Story';
      const chNum = storyMission.chapter || 1;

      const actButton = isReady
        ? h('button.obj-btn.claim', {
            disabled: pending.has(storyMission.id),
            onclick: () => claimStory(storyMission.id)
          }, 'Claim')
        : isClimax
        ? h('button.obj-btn.claim', {
            onclick: () => openStoryEncounter(storyMission.activeEncounter, () => act.refresh())
          }, 'Decide')
        : h('button.obj-btn', {
            'aria-label': 'Go: ' + storyMission.title,
            onclick: () => goObjective(storyMission, act)
          }, 'Go');

      const head = h('div.obj-head', null,
        h('button.obj-toggle', {
          'aria-expanded': String(open),
          'aria-controls': 'obj-panel',
          onclick: () => { open = !open; saveOpen(open); draw(); }
        },
          h('span.obj-icon', { 'aria-hidden': 'true', style: isReady ? { background: '#fef3c7', color: '#b45309' } : null },
            ic(isReady ? 'gift' : isClimax ? 'lightning' : ICON[storyMission.action] || 'target')
          ),
          h('span.obj-copy', null,
            h('span.mission-pill.main', null, '★ MAIN STORY'),
            h('small', null, `${arcTitle} · Ch. ${chNum}`),
            h('strong', null, isReady ? 'Ready to Claim: ' + storyMission.title : isClimax ? 'Dilemma: ' + storyMission.title : storyMission.title)
          ),
          ic(open ? 'caret-up' : 'caret-down')
        ),
        actButton
      );

      // Detail card inside expanded panel
      const storyDetailCard = h('div.obj-story-card', {
        style: {
          background: '#fff',
          borderRadius: '10px',
          padding: '10px 12px',
          margin: '6px 0 8px',
          border: '1px solid #e3dec3'
        }
      },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            h('span.mission-pill.main', null, '★ MAIN'),
            h('small', { style: { fontWeight: '700', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' } },
              storyMission.chapterTitle || `Chapter ${chNum}`
            )
          ),
          storyMission.reward ? h('small', { style: { color: '#0e7a4e', fontWeight: '600' } },
            `+${cedi(storyMission.reward.cash || 0)} · +${storyMission.reward.xp || 0} XP`
          ) : null
        ),
        h('strong', { style: { display: 'block', fontSize: '13px', color: '#1d3b31', marginBottom: '4px' } }, storyMission.title),
        h('p', { style: { fontSize: '12px', color: '#556b62', margin: '0 0 8px', lineHeight: '1.4' } }, storyMission.description),
        isClimax && storyMission.activeEncounter ? h('button.btn.primary.wide', {
          style: { minHeight: '36px', fontSize: '12px', padding: '0 12px' },
          onclick: () => openStoryEncounter(storyMission.activeEncounter, () => act.refresh())
        }, `Encounter: ${storyMission.activeEncounter.title}`) : null
      );

      const panel = open ? h('div.obj-panel', { id: 'obj-panel' },
        h('div.obj-section-title.main', null, ic('star'), ' Main Story Mission'),
        storyDetailCard,
        ...(view.rows.length ? [
          h('div.obj-section-title.side', null, ic('briefcase'), ' Side Missions & Street Hustles'),
          ...view.rows.map(row)
        ] : []),
        h('button.obj-more', { onclick: () => act.phone('goals') }, 'Story chapters & roadmap', ic('caret-right'))
      ) : null;

      el.replaceChildren(head, ...(panel ? [panel] : []));
      return;
    }

    // 3. Fallback to onboarding / starter milestone objective if no story mission
    el.hidden = !curObj;
    if (!curObj) return;

    const done = view.rows.filter(d => d.completed).length, total = view.rows.length;
    const head = h('div.obj-head', null,
      h('button.obj-toggle', {
        'aria-expanded': String(open),
        'aria-controls': 'obj-panel',
        onclick: () => { open = !open; saveOpen(open); draw(); }
      },
        h('span.obj-icon', { 'aria-hidden': 'true' }, ic(curObj.completed ? 'gift' : ICON[curObj.action] || 'target')),
        h('span.obj-copy', null,
          h('span.mission-pill.side', null, '💼 SIDE HUSTLE'),
          h('small', null, `${view.label} · ${done}/${total}`),
          h('strong', null, curObj.completed ? 'Ready to claim: ' + curObj.title : curObj.title)
        ),
        h('span.obj-bar', {
          role: 'progressbar',
          'aria-label': 'Objectives progress',
          'aria-valuemin': '0',
          'aria-valuemax': String(total),
          'aria-valuenow': String(done)
        }, h('i', { style: { width: (total ? done / total * 100 : 0) + '%' } })),
        ic(open ? 'caret-up' : 'caret-down')
      ),
      curObj.completed
        ? h('button.obj-btn.claim', { disabled: pending.has(curObj.id), onclick: () => claim(curObj) }, 'Claim')
        : h('button.obj-btn', { 'aria-label': 'Go: ' + curObj.title, onclick: () => goObjective(curObj, act) }, 'Go')
    );

    const panel = open ? h('div.obj-panel', { id: 'obj-panel' },
      h('div.obj-section-title.side', null, ic('briefcase'), ' Side Missions & Milestones'),
      ...view.rows.map(row),
      h('button.obj-more', { onclick: () => act.phone('milestones') }, 'All milestones', ic('caret-right'))
    ) : null;

    el.replaceChildren(head, ...(panel ? [panel] : []));
  }

  function update(rows) {
    view = hudRows(rows);
    const done = new Set((rows || []).filter(d => d.completed).map(d => d.id));
    if (known) for (const d of view.rows) if (done.has(d.id) && !known.has(d.id)) {
      toast(`Objective complete: ${d.title}. Claim ${d.xp} XP.`, 'good');
      el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
    }
    for (const d of rows || []) if (d.claimed && pending.has(d.id)) {
      pending.delete(d.id);
      toast(`+${d.xp} XP${d.badge ? ' · ' + d.badge + ' badge' : ''}`, 'gold');
      const nextUnfinished = (rows || []).find(r => !r.claimed && !r.completed);
      if (nextUnfinished) {
        setTimeout(() => {
          toast(`Next Side Step: ${nextUnfinished.title} — ${nextUnfinished.description}`, 'good');
          el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
        }, 1200);
      }
    }
    known = done;
    draw();
  }

  return { el, update, refresh: () => draw() };
}

