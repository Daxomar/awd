// Accra We Dey - In-Game Player Guide & Tutorial Reference
import { h, ic, sheet, closeSheets } from './dom.js';

export function openAccraGuide(act) {
  closeSheets();
  let currentTab = 'basics';

  const content = h('div.sheet-body.guide-body');

  function render() {
    const tabs = [
      { id: 'basics', label: 'Controls & Movement', icon: 'person-simple-walk' },
      { id: 'interact', label: 'Interactions', icon: 'hand-tap' },
      { id: 'needs', label: 'Needs & Health', icon: 'heart' },
      { id: 'money', label: 'Making Cedis', icon: 'money' },
      { id: 'travel', label: 'Getting Around', icon: 'map-trifold' },
      { id: 'safety', label: 'Night & Safety', icon: 'shield-check' }
    ];

    const tabNav = h('div.guide-tabs', {
      style: {
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        paddingBottom: '8px',
        marginBottom: '14px',
        borderBottom: '1px solid #e5e7eb',
        WebkitOverflowScrolling: 'touch'
      }
    },
      ...tabs.map(t => h('button.guide-tab-btn', {
        style: {
          padding: '6px 12px',
          borderRadius: '20px',
          border: '1px solid ' + (currentTab === t.id ? '#0e7a4e' : '#e5e7eb'),
          background: currentTab === t.id ? '#0e7a4e' : '#f9fafb',
          color: currentTab === t.id ? '#fff' : '#374151',
          fontSize: '12px',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          cursor: 'pointer'
        },
        onclick: () => { currentTab = t.id; render(); }
      }, ic(t.icon), ' ' + t.label))
    );

    let panel = null;

    if (currentTab === 'basics') {
      panel = h('div.guide-panel', null,
        guideCard('🕹️ Walking & Moving', 'Use the floating on-screen joystick at bottom-left to walk smoothly in any direction. Alternatively, tap any clear spot on the ground to jog directly there.'),
        guideCard('👀 Looking Around & Zoom', 'Drag the 3D scene with your finger to rotate the camera around your character. Pinch with two fingers to zoom in close or pull back to see the whole street.'),
        guideCard('📍 HUD & Objectives', 'The top HUD shows your money, time, and current objectives. Tapping on empty ground automatically minimizes the HUD so you enjoy an unobstructed view!')
      );
    } else if (currentTab === 'interact') {
      panel = h('div.guide-panel', null,
        guideCard('⚡ Proximity Interaction Button', 'As you walk close to any vendor, doorway, food stall, or workstation, a floating action button automatically appears at the bottom of your screen! Just tap it to interact instantly.'),
        guideCard('🗣️ Talking to Residents (NPCs)', 'Tap any resident in Accra—from Neighbour Ama to the Aboki grill seller and Waiter Kofi! Greet them with \"Charlie how far?\" to boost your Social and Mood, ask for local tips, or purchase hot street food.'),
        guideCard('🛋️ Using Furniture & Items', 'Tap beds, chairs, stoves, and desks. Tapping a bed lets you rest; tapping a stall opens its menu; tapping a workstation starts your task!')
      );
    } else if (currentTab === 'needs') {
      panel = h('div.guide-panel', null,
        guideCard('❤️ How You Dey? (Your Needs)', 'Tap your portrait at top-left to check your needs: Hunger, Energy, Social, Hygiene, and Fun. Keeping these high boosts your mood and career satisfaction.'),
        guideCard('🍲 Hunger & Energy', 'Eat waakye, kenkey, or jollof at chop bars to restore Hunger. Sleep in your bed at home or in an apartment to recharge your Energy.'),
        guideCard('🎉 Social & Fun', 'Chat with players in City Chat, greet residents, or visit Vibes Lounge and Labadi Beach for music and dance battles!')
      );
    } else if (currentTab === 'money') {
      panel = h('div.guide-panel', null,
        guideCard('💼 Jobs & 3-Minute Shifts', 'Open Jobs on your phone to find careers matching your skills. Work shifts take around 3 minutes. Need to finish immediately? Use XP to rush complete your shift!'),
        guideCard('💰 Getting Paid', 'Salaries and gigs pay out directly into your Mobile Money (MoMo) wallet. You can check your balance anytime from the MoMo app.'),
        guideCard('📈 Skills & Enterprises', 'Train your Coding at Osu Tech Hub or Balme Library, Music at Vibes Lounge, or Hustle at Makola. Once you have capital, start a business in the Enterprise app for passive income!')
      );
    } else if (currentTab === 'travel') {
      panel = h('div.guide-panel', null,
        guideCard('🗺️ City Map', 'Tap the Map button at the bottom nav to view all of Greater Accra—from Jamestown and Osu to Airport Residential and Legon.'),
        guideCard('🚶 Walking (Free)', 'Walking takes zero cedis and lets you explore street life along the way.'),
        guideCard('🚐 Trotros & Taxis', 'Trotros are fast and very cheap! Taxis and Bolt provide private, high-speed direct transport anywhere in the city.')
      );
    } else if (currentTab === 'safety') {
      panel = h('div.guide-panel', null,
        guideCard('⚠️ Kwashe Street Boys (Night Robbers)', 'Watch out after dark! Street gangs operate in unlit areas and may rob players carrying loose cash. Keep your money safe!'),
        guideCard('📱 Safe Banking', 'Deposit excess cash into your MoMo wallet or Bank account. Money in the bank or MoMo cannot be stolen during street robberies.'),
        guideCard('🚓 Police & Protection', 'Stay near well-lit venues and police patrol spots if you are out late in the city.')
      );
    }

    content.replaceChildren(tabNav, panel,
      h('button.btn.primary.wide', { style: { marginTop: '16px' }, onclick: () => closeSheets() }, 'Back to Accra')
    );
  }

  render();
  sheet(content, { title: 'How to Play', sub: 'Accra We Dey Guide' });
}

function guideCard(title, text) {
  return h('div.guide-card', {
    style: {
      background: '#faf9f5',
      border: '1px solid #e9e5d6',
      borderRadius: '10px',
      padding: '12px 14px',
      marginBottom: '10px'
    }
  },
    h('strong', { style: { display: 'block', color: 'var(--ink, #12241e)', fontSize: '14px', marginBottom: '4px' } }, title),
    h('p', { style: { margin: 0, fontSize: '13px', color: 'var(--ink2, #475a52)', lineHeight: '1.45' } }, text)
  );
}
