// Stage 7 public profile: the owner chooses which eligible game details other players can see.
// Credentials, email, payments, balances and live location are never part of a public profile.
import * as D from './data.js';

export const SHOW = {
  career: {label: 'Career', default: true},
  achievements: {label: 'Badges and milestones', default: true},
  rep: {label: 'Reputation and title', default: true},
  business: {label: 'Business', default: true},
  possessions: {label: 'Car and owned homes', default: false},
  residence: {label: 'Neighbourhood you live in', default: false},
  worth: {label: 'Net worth', default: false},
};
// Fixed presentation choices keep profiles expressive without free-text moderation load.
export const HEADLINES = ['', 'New in Accra', 'Hustling every day', 'Here to make friends', 'Building a business',
  'Learning a trade', 'Football fan', 'Oware champion in training', 'Always at the beach', 'Nightlife regular',
  'Fashion lover', 'Family first', 'Saving for my own house'];
export const ACCENTS = ['kente', 'ocean', 'forest', 'sunset', 'night'];

export function cleanProfile(input = {}, state = {}) {
  const show = {};
  for (const [k, v] of Object.entries(SHOW)) show[k] = typeof input.show?.[k] === 'boolean' ? input.show[k] : (state.profile?.show?.[k] ?? v.default);
  const headline = HEADLINES.includes(input.headline) ? input.headline : (state.profile?.headline || '');
  const accent = ACCENTS.includes(input.accent) ? input.accent : (state.profile?.accent || 'kente');
  const badges = state.flags?.discoveryBadges || [];
  const badge = input.badge === '' ? '' : badges.includes(input.badge) ? input.badge : (badges.includes(state.profile?.badge) ? state.profile.badge : '');
  return {show, headline, accent, badge};
}

export function settings(state) { return cleanProfile({}, state); }

// What another player may see. `card` is the full internal card from social.card().
export function publicView(card, state, {me = false} = {}) {
  const pr = settings(state), show = pr.show;
  const out = {name: card.name, look: card.look, online: card.online, since: card.since, partner: card.partner,
    headline: pr.headline, accent: pr.accent, badge: pr.badge, dream: card.dream, dreamTier: card.dreamTier, traits: card.traits};
  if (me || show.career) Object.assign(out, {job: card.job, jobIc: card.jobIc});
  if (me || show.rep) Object.assign(out, {rep: card.rep, title: card.title});
  if (me || show.achievements) Object.assign(out, {badges: state.flags?.discoveryBadges || [], promos: state.stats?.promos || 0});
  if (me || show.business) out.biz = card.biz;
  if (me || show.possessions) Object.assign(out, {car: card.car, owns: card.owns});
  if (me || show.residence) out.home = state.home && D.HOMES[state.home] ? D.HOMES[state.home].area || D.HOMES[state.home].name : 'No fixed address';
  if (me || show.worth) out.worth = card.worth;
  if (me) out.settings = pr;
  return out;
}
