// Authentic Ghanaian NPC Dialogues & Street Interactions
import { h, ic, sheet, closeSheets, toast } from './dom.js';
import { net } from '../net.js';
import { G, loc } from '../store.js';
import { openZone } from './venue.js';

const DIALOGUES = {
  'aboki': {
    title: 'Aboki Suya & Grill',
    greeting: 'Salam brother! The khebab dey hot! Beef dey, sausage dey, everything seasoned with authentic suya pepper.',
    advice: 'Late night hunger? My grill dey fire till midnight. Plenty pepper dey give good energy for hustle!',
    secret: 'If you dey walk Accra street at night, hold small change for pocket, keep your big money inside MoMo so Kwashe Boys no go stress you.',
    goodsLabel: 'Buy Hot Khebab'
  },
  'fanyogo': {
    title: 'FanYogo Vendor',
    greeting: 'FanYogo! FanIce! Cold refreshing yogurt and ice cream to cool down the Accra sun!',
    advice: 'When the heat inside town dey pull your energy down, one cold FanYogo go give you sweet energy boost!',
    secret: 'Trotros be the cheapest way to travel Accra. Walk to the nearest trotro stop on your map to save your cedis.',
    goodsLabel: 'Buy Cold FanYogo'
  },
  'ama': {
    title: 'Neighbour Ama',
    greeting: 'Charley, how you dey? The Accra sun today no be small o! Hope life dey move well for you.',
    advice: 'Always check your needs from your portrait. If hunger or tiredness catch you, your work satisfaction go drop.',
    secret: 'If your work shift dey feel long, you can use XP to rush it finish sharp sharp! Time is money in Accra.'
  },
  'kofi': {
    title: 'Waiter Kofi',
    greeting: 'Welcome boss! Table is set for you. We get cold Malt, chilled Guinness, and hot tilapia with banku.',
    advice: 'Take a seat and relax! Eating good food restores your hunger and mood to 100%.',
    secret: 'Check your Phone for daily jobs. Once you work a shift, your daily salary drops straight into your MoMo wallet.',
    goodsLabel: 'See Menu & Order'
  },
  'boateng': {
    title: 'Officer Boateng',
    greeting: 'Yes, citizen? Greater Accra Police Service on patrol. Make sure you dey keep the peace and stay law-abiding.',
    advice: 'Watch your surroundings at night. Kwashe street boys like targeting people who walk alone in dark areas with full pockets.',
    secret: 'Bank of Ghana and local banks allow fixed savings. Deposit your extra cedis in the Bank app to earn daily interest.'
  },
  'pastor': {
    title: 'Pastor Mensah',
    greeting: 'God bless you richly my friend! May your daily hustle in Accra bring plenty harvest and blessings.',
    advice: 'Whenever life feels heavy or stressful, come together with people. Fellowship and social chats restore the spirit.',
    secret: 'Meet real people in City Chat! Real players are all across Accra—you can message them and play Oware together.'
  },
  'dj': {
    title: 'DJ Sly',
    greeting: 'Yo! The baseline dey vibrate the whole venue! Which hit track you wan make I drop next?',
    advice: 'If you want boost your Fun and Dance skill, the dance floor is open all night. Feel the rhythm!',
    secret: 'Vibes Lounge is where musicians and artists meet. Build your Music and Charisma skills to unlock superstar dreams.'
  },
  'kojo': {
    title: 'Salesman Kojo',
    greeting: 'Chief! Step inside! We get the best quality products in town with proper warranty and discount!',
    advice: 'Always compare prices before buying. You can also trade with other players in the Market app on your phone.',
    secret: 'You can start your own business through the Enterprise app once you have capital. Passive income is real wealth.',
    goodsLabel: 'Check Catalogue'
  },
  'adwoa': {
    title: 'Adwoa (Reception)',
    greeting: 'Akwaaba! Welcome to our establishment. How can I assist your stay in Accra today?',
    advice: 'Need a comfortable place to rest? Our rooms offer high-energy recovery so you wake up refreshed.',
    secret: 'You can buy or rent homes across different Accra neighbourhoods using the Houses app on your phone.'
  }
};

function resolveNpcKey(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('aboki') || n.includes('grill') || n.includes('khebab')) return 'aboki';
  if (n.includes('fanyogo') || n.includes('icecream') || n.includes('vendor')) return 'fanyogo';
  if (n.includes('ama')) return 'ama';
  if (n.includes('kofi') || n.includes('waiter') || n.includes('barman')) return 'kofi';
  if (n.includes('boateng') || n.includes('officer') || n.includes('police')) return 'boateng';
  if (n.includes('pastor') || n.includes('eli') || n.includes('church')) return 'pastor';
  if (n.includes('dj') || n.includes('sly')) return 'dj';
  if (n.includes('kojo') || n.includes('salesman')) return 'kojo';
  if (n.includes('adwoa') || n.includes('reception')) return 'adwoa';
  return 'general';
}

export function openNpcDialog(hit, place, act) {
  closeSheets();
  const name = hit.name || hit.label || 'Accra Resident';
  const key = resolveNpcKey(name);
  const data = DIALOGUES[key] || {
    title: name,
    greeting: 'Ebei! How body? We dey Accra here, we dey push life small small.',
    advice: 'Always check your needs—eat when hungry, rest when tired. A healthy body dey bring good money.',
    secret: 'If you need quick cedis, check Jobs on your phone for shifts and gigs. 3 minutes and your wage drops!'
  };

  const status = h('p.context-state', { role: 'status' });
  let dialogSheet = null;

  function handleGreet() {
    status.textContent = 'Saying hello…';
    net.send({ t: 'chat', text: `Charley how far @${name}! 👋`, ch: 'room' });
    toast(`Greeted ${name}! +5 Social & Mood boost!`, 'good');
    // If player needs social, give immediate local visual feedback
    if (G.state?.n?.social != null) {
      G.state.n.social = Math.min(100, (G.state.n.social || 50) + 5);
      if (G.state.n.fun != null) G.state.n.fun = Math.min(100, (G.state.n.fun || 50) + 4);
      act.refresh?.();
    }
    // Check if player has objective 'meet_try' or 'first_social'
    if (G.objectives?.some(d => ['meet_try', 'first_social'].includes(d.id) && !d.completed)) {
      net.send({ t: 'objective_status', seen: 'meet' });
    }
    setTimeout(() => {
      if (dialogSheet) dialogSheet.close();
      sheet(h('div.sheet-body', null,
        h('div.npc-speech-bubble', { style: { background: '#f5f3eb', padding: '14px', borderRadius: '12px', marginBottom: '16px', borderLeft: '4px solid #0e7a4e' } },
          h('strong', { style: { display: 'block', color: '#0e7a4e', marginBottom: '6px' } }, `${name} smiles:`),
          h('p', { style: { fontSize: '14px', margin: 0, lineHeight: '1.45' } }, `\"Eye bro! Life dey move small small. Good to see you! Hustle dey go on well? Enjoy your stay for Accra!\"`)
        ),
        h('button.btn.primary.wide', { onclick: () => closeSheets() }, 'Take care!')
      ), { title: name, sub: 'Accra Resident' });
    }, 400);
  }

  function handleAdvice() {
    closeSheets();
    sheet(h('div.sheet-body', null,
      h('div.npc-speech-bubble', { style: { background: '#f5f3eb', padding: '14px', borderRadius: '12px', marginBottom: '16px', borderLeft: '4px solid #b45309' } },
        h('strong', { style: { display: 'block', color: '#b45309', marginBottom: '6px' } }, `${name}'s Local Advice:`),
        h('p', { style: { fontSize: '14px', margin: 0, lineHeight: '1.45' } }, `\"${data.advice}\"`)
      ),
      h('button.btn.wide', { onclick: () => act.map() }, ic('map-trifold'), ' Open City Map'),
      h('button.btn.primary.wide', { style: { marginTop: '8px' }, onclick: () => closeSheets() }, 'Thanks for the tip!')
    ), { title: name, sub: 'Local Advice' });
  }

  function handleSecret() {
    closeSheets();
    sheet(h('div.sheet-body', null,
      h('div.npc-speech-bubble', { style: { background: '#f5f3eb', padding: '14px', borderRadius: '12px', marginBottom: '16px', borderLeft: '4px solid #6366f1' } },
        h('strong', { style: { display: 'block', color: '#6366f1', marginBottom: '6px' } }, `Accra Street Wisdom:`),
        h('p', { style: { fontSize: '14px', margin: 0, lineHeight: '1.45' } }, `\"${data.secret}\"`)
      ),
      h('button.btn.primary.wide', { onclick: () => closeSheets() }, 'Got it!')
    ), { title: name, sub: 'Street Wisdom' });
  }

  function handleGoods() {
    closeSheets();
    const z = act.context?.()?.spec?.zones?.find(zone => !zone.route && !zone.work) || null;
    if (z) return openZone(z, place, act);
    return act.interact();
  }

  const choices = [
    h('button.btn.wide', { style: { display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', marginBottom: '8px', padding: '12px' }, onclick: handleGreet },
      ic('chat-circle-dots'),
      h('div', null,
        h('strong', { style: { display: 'block' } }, 'Greet: \"Charlie, how far?\"'),
        h('small', { style: { color: 'var(--ink2, #5a7369)' } }, 'Friendly hello · boosts Social & Mood (+5)')
      )
    ),
    h('button.btn.wide', { style: { display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', marginBottom: '8px', padding: '12px' }, onclick: handleAdvice },
      ic('compass'),
      h('div', null,
        h('strong', { style: { display: 'block' } }, 'Ask for Local Advice & Tips'),
        h('small', { style: { color: 'var(--ink2, #5a7369)' } }, 'Where to find food, work, and stay safe')
      )
    ),
    h('button.btn.wide', { style: { display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', marginBottom: '8px', padding: '12px' }, onclick: handleSecret },
      ic('lightbulb'),
      h('div', null,
        h('strong', { style: { display: 'block' } }, 'Accra Street Secret'),
        h('small', { style: { color: 'var(--ink2, #5a7369)' } }, 'Insight on saving cedis & city life')
      )
    )
  ];

  if (data.goodsLabel) {
    choices.unshift(
      h('button.btn.primary.wide', { style: { display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', marginBottom: '8px', padding: '12px', background: '#0e7a4e' }, onclick: handleGoods },
        ic('shopping-bag'),
        h('div', null,
          h('strong', { style: { display: 'block' } }, data.goodsLabel),
          h('small', { style: { color: '#e0f2fe' } }, 'Open available items & services')
        )
      )
    );
  }

  const body = h('div.sheet-body', null,
    h('div.npc-dialog-top', { style: { display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px', padding: '12px', background: '#faf9f5', borderRadius: '12px', border: '1px solid #eee' } },
      h('div.npc-avatar-badge', { style: { width: '42px', height: '42px', borderRadius: '50%', background: '#0e7a4e', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '20px', flexShrink: 0 } },
        ic('user')
      ),
      h('div', null,
        h('strong', { style: { display: 'block', fontSize: '15px', color: 'var(--ink, #12241e)' } }, name),
        h('p', { style: { fontSize: '13px', margin: '4px 0 0', color: 'var(--ink2, #445950)', lineHeight: '1.4' } }, `\"${data.greeting}\"`)
      )
    ),
    h('h4.panel-heading', { style: { margin: '10px 0 8px' } }, 'Choose interaction'),
    h('div.npc-choices', null, ...choices),
    status
  );

  dialogSheet = sheet(body, { title: name, sub: loc(place)?.name || 'Accra Resident' });
  return dialogSheet;
}
