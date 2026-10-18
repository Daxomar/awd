// Stage 6 HUD objectives: a compact, collapsible first-session guide on the main game screen.
// Progress and rewards stay on the server (objective_status / objective_claim / story_claim);
// only the open/closed preference is local.
import { h, ic, toast, cedi } from './dom.js';
import { net } from '../net.js';
import { G, loc } from '../store.js';
import { hudRows, currentObjective } from './hud-state.js';
import { openStoryEncounter, openAspirationModal } from './story-dialog.js';
import { openPlace } from './travel.js';

const PREF = 'awd.objectives.open';
const readOpen = () => { try { return localStorage.getItem(PREF) === '1'; } catch { return false; } };
const saveOpen = (v) => { try { localStorage.setItem(PREF, v ? '1' : '0'); } catch {} };
const ICON = { houses: 'house-line', home: 'house', interact: 'hand-tap', meet: 'hand-waving', jobs: 'briefcase', status: 'heartbeat', explore: 'compass', map: 'map-trifold', messages: 'chat-circle-dots', boutique: 't-shirt' };

export function goObjective(d, act) {
  if (!d) return;

  if (d.finished || d.action === 'aspirations') {
    return openAspirationModal(() => act.refresh?.());
  }

  // 1. Climax encounter / story dilemma
  if (d.encounterId || d.activeEncounter) {
    return openStoryEncounter(d.activeEncounter || { id: d.encounterId, title: d.title, text: d.desc }, () => act.refresh?.());
  }

  const s = G.state;
  const here = s?.place;

  // 2. Direct venue or exploration target (e.g. story missions or specific tasks)
  const rawDest = d.venue || d.target;
  const VENUE_ALIASES = { kaneshie: 'circle', airres: 'airport', jtown: 'kenkey', trasacco: 'hotel', nima: 'circle', legon: 'ug' };
  const destId = VENUE_ALIASES[rawDest] || rawDest;
  if (destId) {
    if (destId === 'home') {
      if (here === 'home') {
        toast('You are at home! Check your in-room items and rest options.', 'good');
        return act.nav('home');
      }
      return openPlace('home', act);
    }
    const targetLoc = loc(destId);
    if (targetLoc) {
      if (here === destId) {
        toast(`You are at ${targetLoc.name}! Check the activities and zones here.`, 'good');
        return act.interact();
      }
      return openPlace(destId, act);
    }
  }

  // 3. Work & Career shifts / jobs
  if (d.action === 'jobs' || ['first_shift', 'first_earning', 'career_five', 'career_promotion'].includes(d.id)) {
    if (s?.job?.id) {
      const career = G.cat?.careers?.[s.job.id];
      const workPlace = career?.at;
      if (workPlace) {
        if (here === workPlace) {
          if (s.shift) return act.work();
          toast(`Starting shift at ${loc(workPlace)?.name || 'work'}...`, 'good');
          return act.jobHere(s.job.id);
        }
        return openPlace(workPlace, act);
      }
    }
    return act.phone('jobs');
  }

  // 4. Milestone & Starter specific IDs
  switch (d.id) {
    case 'first_street':
      if (here === 'home') return act.route?.({ route: 'home' }) || openPlace('circle', act);
      return openPlace('circle', act);
    case 'first_meal':
      if (['kenkey', 'muni', 'chopbar', 'circle'].includes(here)) return act.interact();
      return openPlace('kenkey', act);
    case 'first_market':
      if (['makola', 'kantamanto'].includes(here)) return act.interact();
      return openPlace('makola', act);
    case 'first_trip':
    case 'two_areas':
      if (here === 'oxford') return openPlace('vibes', act);
      return openPlace('oxford', act);
    case 'social_hub':
      if (['vibes', 'labadi', 'circle', 'oxford'].includes(here)) return act.interact();
      return openPlace('vibes', act);
    case 'first_social':
    case 'first_friend':
    case 'meet_try':
      return act.meet();
    case 'first_dm':
      return act.phone('messages');
    case 'first_outfit':
      return act.wardrobe('wardrobe');
    case 'return_home':
      if (here === 'home') return act.nav('home');
      return openPlace('home', act);
    case 'first_home':
    case 'home_ownership':
      return act.phone('houses');
    case 'useful_place':
      if (here && here !== 'home') return act.interact();
      return openPlace('oxford', act);
    case 'needs_check':
      return act.status();
    case 'career_look':
      return act.phone('jobs');
    case 'savings_target':
      return act.phone('bank');
    case 'business_start':
    case 'business_sale':
    case 'business_profit':
      return act.phone('enterprise');
    case 'own_vehicle':
      return openPlace('cars', act);
    case 'player_trade':
      return act.phone('shop');
  }

  // 5. General action mapping
  switch (d.action) {
    case 'home':
      if (here === 'home') return act.nav('home');
      return openPlace('home', act);
    case 'map':
      return act.map();
    case 'explore': {
      const fallbackTarget = d.target && loc(d.target) ? d.target : 'oxford';
      if (here === fallbackTarget) return act.interact();
      return openPlace(fallbackTarget, act);
    }
    case 'interact': return act.interact();
    case 'status': return act.status();
    case 'meet': return act.meet();
    case 'market': case 'boutique': case 'shop': return act.phone('shop');
    case 'bank': return act.phone('bank');
    case 'momo': return act.wallet();
    case 'houses': return act.phone('houses');
    case 'jobs': return act.phone('jobs');
    case 'cars': return openPlace('cars', act);
    case 'enterprise': return act.phone('enterprise');
    case 'goals': case 'story': return act.goals ? act.goals() : act.phone('goals');
    case 'messages': return act.phone('messages');
    default: return act.phone(d.action || 'goals');
  }
}

export function buildObjectives(act) {
  let open = readOpen(), view = { label: '', rows: [] }, known = null;
  let lastRenderSig = '';
  const pending = new Set();
  const el = h('section.objectives-hud', { hidden: true, 'aria-label': 'Objectives' });

  // Touch and pointer isolation so scrolling inside HUD panel doesn't move 3D camera / scene
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  el.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
  el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

  function claim(d) {
    if (pending.has(d.id)) return;
    if (!net.send({ t: 'objective_claim', id: d.id })) return toast('Reconnect before claiming.', 'bad');
    pending.add(d.id); setTimeout(() => { pending.delete(d.id); draw(true); }, 15000); draw(true);
  }

  function claimStory(id) {
    if (pending.has(id)) return;
    if (!net.send({ t: 'story_claim', id })) return toast('Reconnect before claiming.', 'bad');
    pending.add(id); setTimeout(() => { pending.delete(id); draw(true); }, 10000); draw(true);
  }

  function row(d) {
    const state = d.claimed ? 'claimed' : d.completed ? 'ready' : 'open';
    const isReady = d.completed && !d.claimed;
    return h('div.obj-row', { 'data-state': state },
      h('span.obj-mark', { 'aria-hidden': 'true' }, ic(d.claimed ? 'check-circle' : d.completed ? 'gift' : 'circle')),
      h('div.obj-text', null,
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '5px' } },
          h('strong', null, d.title),
          h('span.mission-tag.side', null, 'SIDE')
        ),
        h('small', null, d.claimed ? `Done · ${d.xp} XP earned` : d.description)
      ),
      d.claimed ? null : isReady ? h('button.obj-btn.claim', { disabled: pending.has(d.id), onclick: () => claim(d) }, `Claim ${d.xp} XP`) :
        h('button.obj-btn', { 'aria-label': 'Go To: ' + d.title, onclick: () => goObjective(d, act) }, 'Go To 📍'));
  }

  function draw(force = false) {
    const s = G.state;
    const curObj = currentObjective(view);
    const storyMission = s?.story?.activeMission;
    const noDream = s?.onboarded && !s?.dream;

    // Signature check to prevent unnecessary DOM recreation while user is scrolling
    const renderSig = JSON.stringify({
      open,
      noDream: !!noDream,
      dream: s?.dream,
      storyId: storyMission?.id,
      storyReady: !!storyMission?.ready,
      storyClimax: !!storyMission?.isClimax,
      encounterId: storyMission?.activeEncounter?.id,
      jobId: s?.job?.id,
      place: s?.place,
      pendingSize: pending.size,
      rows: view.rows.map(r => [r.id, r.completed, r.claimed])
    });

    if (!force && renderSig === lastRenderSig && el.querySelector('.obj-head')) {
      return; // Data has not changed; preserve existing DOM and user scroll position completely!
    }
    lastRenderSig = renderSig;

    // Remember existing scroll position before replacing children
    const existingPanel = el.querySelector('#obj-panel');
    const savedScrollTop = existingPanel ? existingPanel.scrollTop : 0;

    // 1. If player has no aspiration set, show the prominent aspiration prompt
    if (noDream) {
      el.hidden = false;
      const head = h('div.obj-head', null,
        h('button.obj-toggle', {
          'aria-expanded': 'false',
          onclick: () => openAspirationModal(() => act.refresh?.())
        },
          h('span.obj-icon', { 'aria-hidden': 'true', style: { background: '#fef3c7', color: '#b45309' } }, ic('sparkle')),
          h('span.obj-copy', null,
            h('small', null, 'Your Calling in Accra'),
            h('strong', null, 'Choose Your Accra Dream')
          ),
          ic('caret-right')
        ),
        h('button.obj-btn.claim', {
          onclick: () => openAspirationModal(() => act.refresh?.())
        }, 'Choose')
      );
      el.replaceChildren(head);
      return;
    }

    // 2. If an active story mission exists, it takes top spotlight on the HUD beacon!
    if (storyMission) {
      el.hidden = false;
      const isFinished = storyMission.finished;
      const isReady = storyMission.ready;
      const isClimax = storyMission.isClimax && !isReady && !isFinished;
      const arcTitle = storyMission.arcTitle || storyMission.arcName || 'Accra Story';
      const chNum = storyMission.chapter || 5;
      const destName = storyMission.target && loc(storyMission.target) ? loc(storyMission.target).name : null;

      const actButton = isFinished
        ? h('button.obj-btn.claim', {
            onclick: () => openAspirationModal(() => act.refresh?.())
          }, 'Next Dream 🏆')
        : isReady
        ? h('button.obj-btn.claim', {
            disabled: pending.has(storyMission.id),
            onclick: () => claimStory(storyMission.id)
          }, 'Claim')
        : isClimax
        ? h('button.obj-btn.claim', {
            onclick: () => openStoryEncounter(storyMission.activeEncounter, () => act.refresh?.())
          }, 'Decide')
        : h('button.obj-btn', {
            'aria-label': 'Go To: ' + storyMission.title,
            onclick: () => goObjective(storyMission, act)
          }, 'Go To 📍');

      const head = h('div.obj-head', null,
        h('button.obj-toggle', {
          'aria-expanded': String(open),
          'aria-controls': 'obj-panel',
          onclick: () => { open = !open; saveOpen(open); draw(true); }
        },
          h('span.obj-icon', { 'aria-hidden': 'true', style: (isReady || isFinished) ? { background: '#fef3c7', color: '#b45309' } : null },
            ic(isFinished ? 'crown' : isReady ? 'gift' : isClimax ? 'lightning' : ICON[storyMission.action] || 'target')
          ),
          h('span.obj-copy', null,
            h('span.mission-pill.main', null, isFinished ? '★ DREAM CONQUERED' : '★ MAIN STORY'),
            h('small', null, isFinished ? `${arcTitle} Completed` : `${arcTitle} · Ch. ${chNum}`),
            h('strong', null, isFinished ? storyMission.title : isReady ? 'Ready to Claim: ' + storyMission.title : isClimax ? 'Dilemma: ' + storyMission.title : storyMission.title)
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
            h('span.mission-pill.main', null, isFinished ? '★ CONQUERED' : '★ MAIN'),
            h('small', { style: { fontWeight: '700', color: isFinished ? '#10b981' : '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' } },
              storyMission.chapterTitle || (isFinished ? 'All 5 Chapters Complete' : `Chapter ${chNum}`)
            )
          ),
          storyMission.reward ? h('small', { style: { color: '#0e7a4e', fontWeight: '600' } },
            `+${cedi(storyMission.reward.cash || 0)} · +${storyMission.reward.xp || 0} XP`
          ) : null
        ),
        h('strong', { style: { display: 'block', fontSize: '13px', color: '#1d3b31', marginBottom: '4px' } }, storyMission.title),
        h('p', { style: { fontSize: '12px', color: '#556b62', margin: '0 0 8px', lineHeight: '1.4' } }, storyMission.description || storyMission.desc),
        isFinished ? h('button.btn.primary.wide', {
          style: { minHeight: '36px', fontSize: '12px', padding: '0 12px', background: '#0e7a4e' },
          onclick: () => openAspirationModal(() => act.refresh?.())
        }, 'Choose Next Aspiration 🏆') :
        isReady ? h('button.btn.primary.wide', {
          style: { minHeight: '36px', fontSize: '12px', padding: '0 12px', background: '#c58a1c' },
          disabled: pending.has(storyMission.id),
          onclick: () => claimStory(storyMission.id)
        }, `Claim Reward (+${cedi(storyMission.reward?.cash || 0)})`) :
        isClimax && storyMission.activeEncounter ? h('button.btn.primary.wide', {
          style: { minHeight: '36px', fontSize: '12px', padding: '0 12px' },
          onclick: () => openStoryEncounter(storyMission.activeEncounter, () => act.refresh?.())
        }, `Encounter: ${storyMission.activeEncounter.title}`) :
        h('button.btn.primary.wide', {
          style: { minHeight: '36px', fontSize: '12px', padding: '0 12px' },
          onclick: () => goObjective(storyMission, act)
        }, destName ? `Go To ${destName} 📍` : 'Go To Action 📍')
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
      const newPanel = el.querySelector('#obj-panel');
      if (newPanel && savedScrollTop > 0) newPanel.scrollTop = savedScrollTop;
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
        onclick: () => { open = !open; saveOpen(open); draw(true); }
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
        : h('button.obj-btn', { 'aria-label': 'Go To: ' + curObj.title, onclick: () => goObjective(curObj, act) }, 'Go To 📍')
    );

    const panel = open ? h('div.obj-panel', { id: 'obj-panel' },
      h('div.obj-section-title.side', null, ic('briefcase'), ' Side Missions & Milestones'),
      ...view.rows.map(row),
      h('button.obj-more', { onclick: () => act.phone('milestones') }, 'All milestones', ic('caret-right'))
    ) : null;

    el.replaceChildren(head, ...(panel ? [panel] : []));
    const newPanel = el.querySelector('#obj-panel');
    if (newPanel && savedScrollTop > 0) newPanel.scrollTop = savedScrollTop;
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
    draw(true);
  }

  function collapse() {
    if (open) {
      open = false;
      saveOpen(false);
      draw(true);
    }
  }

  return { el, update, refresh: () => draw(false), collapse, isOpen: () => open, toggle: () => { open = !open; saveOpen(open); draw(true); } };
}
