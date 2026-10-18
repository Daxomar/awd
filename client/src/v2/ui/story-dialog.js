// Accra Story & Encounter Dialogue Modal
import { h, ic, sheet, closeSheets, toast } from './dom.js';
import { net } from '../net.js';
import { G } from '../store.js';

export function openStoryEncounter(enc, onResolved) {
  if (!enc) return;
  closeSheets();

  let pending = false;
  const status = h('p.context-state', { role: 'status' });

  const choices = (enc.choices || []).map(c => {
    return h('button.btn.wide', {
      style: { textAlign: 'left', marginBottom: '8px', padding: '12px 14px' },
      onclick: () => {
        if (pending) return;
        pending = true;
        status.textContent = 'Deciding…';
        if (!net.send({ t: 'story_choice', encounterId: enc.id, choiceId: c.id })) {
          pending = false;
          status.textContent = 'Reconnect before deciding.';
        }
      }
    },
      h('div', null, h('strong', { style: { display: 'block', color: 'var(--ink, #12241e)' } }, c.label)),
      c.hint ? h('small', { style: { display: 'block', color: 'var(--ink2, #5a7369)', marginTop: '3px' } }, c.hint) : null
    );
  });

  const body = h('div.sheet-body.story-encounter', null,
    enc.speaker ? h('div.story-speaker', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '6px 10px', background: '#f5f3eb', borderRadius: '8px' } },
      ic('user-circle'),
      h('strong', { style: { fontSize: '13px', color: '#85581a' } }, enc.speaker)
    ) : null,
    h('p', { style: { fontSize: '15px', lineHeight: '1.45', margin: '0 0 16px' } }, enc.text),
    h('div.story-choices', null, ...choices),
    status,
    h('button.btn.ghost.wide', { style: { marginTop: '8px' }, onclick: () => s.close() }, 'Decide later')
  );

  const s = sheet(body, { title: enc.title, sub: 'Accra Story Climax' });

  const off = net.on('story_choice_result', (m) => {
    off();
    s.close();
    showStoryOutcome(m);
    onResolved?.(m);
  });
}

export function showStoryOutcome(m) {
  closeSheets();
  const body = h('div.sheet-body.story-outcome', null,
    h('div', { style: { textAlign: 'center', margin: '8px 0 16px' } },
      h('span', { style: { display: 'inline-block', fontSize: '32px', marginBottom: '8px' } }, '✨'),
      h('p', { style: { fontSize: '15px', lineHeight: '1.5', color: 'var(--ink, #12241e)' } }, m.note || 'You handled the situation.')
    ),
    h('button.btn.primary.wide', { onclick: () => closeSheets() }, 'Continue Story')
  );
  sheet(body, { title: m.encounter?.title || 'What Happened', sub: 'Accra Story' });
}

export function openAspirationModal(onSelected) {
  closeSheets();
  const arcs = [
    { id: 'landlord', name: 'East Legon Landlord', tag: 'From Jamestown Compound to Trasacco Villa', ic: 'house-line', color: '#d97706', desc: 'Climb from a leaking compound room to owning sprawling estates, commercial arcades, and luxury Trasacco mansions.' },
    { id: 'star', name: 'Afrobeats Hitmaker', tag: 'From Bedroom Freestyles to Afrochella Headline', ic: 'microphone', color: '#ec4899', desc: 'Rise from late-night bedroom recordings to packing out Vibes Lounge, topping the airwaves, and headlining Detty December.' },
    { id: 'mogul', name: 'Makola Business Mogul', tag: 'From Pavement Table to Conglomerate', ic: 'storefront', color: '#10b981', desc: 'Turn thrift bale hunting into a commercial freight empire, a trotro fleet, and high-stakes retail conglomerate.' },
    { id: 'unicorn', name: 'Osu Tech Founder', tag: 'From Cafeteria Coding to Silicon Accra Unicorn', ic: 'laptop', color: '#6366f1', desc: 'Build tech products on iced Milo, raise venture capital in Airport Residential, survive Dumsor crashes, and hit a $100M valuation.' },
    { id: 'bigman', name: 'High Society Borga', tag: 'From Heathrow Arrival to King of Accra', ic: 'crown', color: '#f59e0b', desc: 'Step off the flight with foreign currency, handle family black tax demands, cruise in a Prado, and cement your reign in Accra high society.' },
  ];

  const cards = arcs.map(a => {
    return h('button.aspiration-card', {
      style: {
        display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: '10px',
        border: '1px solid #e2ddd0', borderRadius: '12px', background: '#fff', cursor: 'pointer'
      },
      onclick: () => {
        net.send({ t: 'pickdream', id: a.id });
        toast(`Aspiration chosen: ${a.name}! Chapter 1 begins.`, 'good');
        closeSheets();
        onSelected?.(a.id);
      }
    },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' } },
        h('span', { style: { color: a.color, fontSize: '18px' } }, ic(a.ic)),
        h('strong', { style: { fontSize: '15px', color: '#12241e' } }, a.name)
      ),
      h('div', { style: { fontSize: '12px', fontWeight: '600', color: a.color, marginBottom: '6px' } }, a.tag),
      h('p', { style: { fontSize: '12px', color: '#556b62', margin: 0, lineHeight: '1.4' } }, a.desc)
    );
  });

  const body = h('div.sheet-body.aspiration-picker', null,
    h('p', { style: { fontSize: '14px', color: '#4a5d54', marginBottom: '16px' } },
      'Every hustler, trader and dreamer in Accra is chasing something. Choose your path to unlock your personalized story chapters, missions, and rewards.'
    ),
    ...cards
  );

  sheet(body, { title: 'Choose Your Accra Dream', sub: 'Your Life Path' });
}
