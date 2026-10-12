// Optional player-driven milestones. No NPC stories or timed obligations.
export const DREAM_TIERS = {
  bigman: [['Get any job', (s) => !!s.job], ['Get promoted once', (s) => s.stats.promos >= 1], ['Reach rank 3 in a career', (s) => s.job && s.job.rank >= 2], ['Net worth GH₵150,000', (s, c) => c.worth >= 150000], ['Top rank of any career', (s) => s.job && s.job.rank >= 4]],
  landlord: [['Save GH₵5,000', (s) => s.cash + s.momo >= 5000], ['Rent a self-contain or better', (s) => ['labadi', 'osu', 'airres', 'legon', 'trasacco'].includes(s.home)], ['Own a plot of land', (s) => Object.keys(s.land).length > 0], ['Net worth GH₵1,000,000', (s, c) => c.worth >= 1000000], ['Own your own house', (s) => Object.keys(s.owned).length > 0]],
  star: [['Music level 2', (s) => s.skills.music >= 2], ['Perform at Vibes Lounge', (s, c) => c.cnt('act:battle') >= 1], ['Music level 6', (s) => s.skills.music >= 6], ['Work as a DJ or radio host (rank 2+)', (s) => s.job && ['dj', 'radio'].includes(s.job.id) && s.job.rank >= 1], ['Music level 10', (s) => s.skills.music >= 10]],
  chale: [['Send five private messages', (s, c) => c.cnt('dm') >= 5], ['Join twenty conversations', (s, c) => c.cnt('chat') >= 20], ['Make a friend', (s) => Object.values(s.friends || {}).some(f => f.pts >= 30)], ['Build a close friendship', (s) => Object.values(s.friends || {}).some(f => f.pts >= 70)], ['Get engaged', (s) => !!s.flags.engaged]],
  unicorn: [['Coding level 3', (s) => s.skills.coding >= 3], ['Finish your MVP', (s) => (s.flags.mvp || 0) >= 100 || (s.flags.round || 0) > 0], ['Raise pre-seed', (s) => (s.flags.round || 0) >= 1], ['Raise seed', (s) => (s.flags.round || 0) >= 2], ['Raise Series A', (s) => (s.flags.round || 0) >= 3]],
  mogul: [['Own a business', (s) => Object.keys(s.biz).length >= 1], ['Own 3 businesses', (s) => Object.keys(s.biz).length >= 3], ['Business profit GH₵20,000 total', (s, c) => c.cnt('bizIncome') >= 20000], ['Own a trotro', (s) => !!s.biz.trotro], ['Own a share of a club', (s) => !!s.biz.club]],
  politician: [['Reputation 10', (s) => s.rep >= 10], ['Make five acquaintances', (s) => Object.values(s.friends || {}).filter(f => f.pts >= 10).length >= 5], ['Reputation 25', (s) => s.rep >= 25], ['Donate GH₵10,000 to your community', (s, c) => c.cnt('donate') >= 10000], ['Reputation 40', (s) => s.rep >= 40]],
  saint: [['Go to church or mosque 3 times', (s, c) => c.cnt('loc:church') + c.cnt('loc:mosque') >= 3], ['Build a good reputation', (s) => s.rep >= 10], ['Help other players five times', (s, c) => c.cnt('sent') >= 5], ['Build three friendships', (s) => Object.values(s.friends || {}).filter(f => f.pts >= 30).length >= 3], ['Donate GH₵50,000', (s, c) => c.cnt('donate') >= 50000]],
};
export const DREAM_INFO = {
  mogul: { name: 'Business Mogul', ic: 'icon:buildings', desc: 'Build an empire of businesses across Accra.' },
  politician: { name: 'The Honourable', ic: 'icon:circle', desc: 'Earn respect across Accra.' },
  saint: { name: 'Good Samaritan', ic: 'icon:circle', desc: 'Stay clean, help your people, keep the faith.' },
};
export const TIER_REWARD = [[150, 3], [400, 5], [1500, 8], [5000, 12], [15000, 20]];


// Empty compatibility fields for older clients.
export const CONTACTS = {}, MISSIONS = [], MISSION_REWARD = 0, STREAK_BONUS = [], BEATS = [];
