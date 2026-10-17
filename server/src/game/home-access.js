// Stage 7 home visits: owner-controlled access, invitations, visitor limits and furniture permission.
// Pure rules; the shard supplies who is online, blocks, friendships, passes and current visitor counts.
export const MODES = ['friends', 'invite', 'open', 'closed'];
export const LIMIT = {min: 1, max: 8, default: 6};
export const GUEST_HOME_ACTS = ['toilet', 'tv', 'guitar'];   // never the host's bed, bath, kitchen or gym
export const PASS_MS = 30 * 60000, REMOVAL_MS = 30 * 60000;

export function accessOf(state) {
  const a = state?.homeAccess || {};
  return {
    mode: MODES.includes(a.mode) ? a.mode : 'friends',
    limit: Number.isInteger(a.limit) ? Math.max(LIMIT.min, Math.min(LIMIT.max, a.limit)) : LIMIT.default,
    furniture: a.furniture === 'owner' ? 'owner' : 'guests',
  };
}
export function cleanAccess(input = {}, state = {}) {
  const cur = accessOf(state);
  return {
    mode: MODES.includes(input.mode) ? input.mode : cur.mode,
    limit: Number.isInteger(input.limit) ? Math.max(LIMIT.min, Math.min(LIMIT.max, input.limit)) : cur.limit,
    furniture: input.furniture === 'owner' || input.furniture === 'guests' ? input.furniture : cur.furniture,
  };
}

// ctx: {friends: mutual accepted friendship, blocked: either side blocks, pass: valid invitation or event pass,
//       removed: recently asked to leave, visitors: current visitors (excluding this player), staying: already inside}
export function visitDecision(host, ctx) {
  if (!host?.state?.home || host.state.place !== 'home') return {ok: false, why: 'not-home', m: 'They are not at home.'};
  if (ctx.blocked) return {ok: false, why: 'blocked', m: 'This home is not available to you.'};
  if (ctx.removed && !ctx.pass) return {ok: false, why: 'removed', m: 'The host asked you to leave. You can visit again later if invited.'};
  const a = accessOf(host.state);
  const allowed = ctx.pass || (a.mode === 'open') || (a.mode === 'friends' && ctx.friends);
  if (a.mode === 'closed' && !ctx.pass) return {ok: false, why: 'closed', m: 'This home is closed to visitors right now.'};
  if (!allowed) return {ok: false, why: a.mode === 'invite' ? 'invite' : 'friends', m: a.mode === 'invite' ? 'This home is invitation only.' : 'Home visits need an accepted mutual friendship or an invitation.'};
  if (!ctx.staying && ctx.visitors >= a.limit) return {ok: false, why: 'full', m: 'This home is full right now.'};
  return {ok: true};
}

export function guestMayUse(host, id) {
  return accessOf(host?.state).furniture === 'guests' && GUEST_HOME_ACTS.includes(id);
}
