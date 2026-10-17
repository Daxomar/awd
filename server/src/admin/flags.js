// Stage 11: operational feature flags. Every flag here is read by server code (no client-only switches),
// so turning one off really stops that behaviour. Values live in PostgreSQL (admin/store.js) and each
// process refreshes this in-memory copy every few seconds; defaults keep the game working without a database row.
export const FLAGS = {
  life_events: {name: 'Personal life events', default: true, detail: 'Offer new life events to players. Events already offered still resolve.'},
  player_event_hosting: {name: 'Player-hosted events', default: true, detail: 'Let players host new events. Administrator events are unaffected.'},
  ads_auto_activation: {name: 'Automatic advertising activation', default: true, detail: 'Put eligible paid campaigns live straight away. When off, paid campaigns wait for a moderator.'},
};
let current = Object.fromEntries(Object.entries(FLAGS).map(([k, f]) => [k, f.default]));
export const flag = key => (Object.hasOwn(current, key) ? current[key] : false);
export function setFlags(rows) {
  const next = {...current};
  for (const r of rows) if (Object.hasOwn(FLAGS, r.key)) next[r.key] = !!r.enabled;
  current = next;
}
export const flagValues = () => ({...current});
