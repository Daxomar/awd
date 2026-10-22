// Stage 11: administrator roles and least-privilege permissions. Pure data so it can be unit tested and
// shown to the dashboard; the server checks these on every protected operation.
export const PERMISSIONS = {
  'overview.read': 'See the overview metrics',
  'players.read': 'Search players and open an account overview',
  'players.records': 'See a player’s money journal and gameplay records',
  'players.edit': 'Edit player saved data, state, wallet and attributes',
  'reports.read': 'Read player reports',
  'reports.resolve': 'Close or dismiss player reports',
  'moderation.note': 'Add support, review or appeal notes',
  'moderation.suspend': 'Suspend or lift a suspension',
  'moderation.ban': 'Ban or unban an account',
  'economy.read': 'Monitor currency creation, sinks, transfers and reconciliation',
  'ads.read': 'See advertising inventory, campaigns and revenue',
  'ads.moderate': 'Suspend, take down or clear advertising campaigns',
  'ads.placements': 'Pause or resume bookings on a placement',
  'payments.read': 'Review payment orders, attempts and receipts',
  'payments.verify': 'Ask the payment provider to re-verify a payment',
  'events.manage': 'Schedule, cancel and restore events',
  'world.manage': 'Send announcements and change feature flags',
  'ops.read': 'See server, database, Redis and worker health',
  'audit.read': 'Read the administrator audit log',
  'admins.manage': 'Grant, change or remove administrator roles',
};
const ALL = Object.keys(PERMISSIONS);
export const ROLES = {
  owner: {name: 'Owner', perms: ALL},
  ops: {name: 'Operations administrator', perms: ['overview.read', 'players.read', 'players.records', 'players.edit', 'reports.read', 'reports.resolve', 'moderation.note', 'moderation.suspend',
    'economy.read', 'ads.read', 'ads.moderate', 'ads.placements', 'events.manage', 'world.manage', 'ops.read', 'audit.read']},
  moderator: {name: 'Moderator', perms: ['overview.read', 'players.read', 'reports.read', 'reports.resolve', 'moderation.note', 'moderation.suspend',
    'moderation.ban', 'ads.read', 'ads.moderate', 'events.manage']},
  support: {name: 'Support analyst', perms: ['overview.read', 'players.read', 'players.records', 'reports.read', 'moderation.note']},
  finance: {name: 'Finance reviewer', perms: ['overview.read', 'players.read', 'players.records', 'economy.read', 'ads.read', 'payments.read', 'payments.verify']},
};
export const isRole = r => typeof r === 'string' && Object.hasOwn(ROLES, r);
export const can = (role, perm) => isRole(role) && ROLES[role].perms.includes(perm);
export const permsOf = role => (isRole(role) ? [...ROLES[role].perms] : []);
// Operations that change who can act or remove a player from the game ask for the password again.
export const REAUTH = new Set(['moderation.ban', 'admins.manage']);
