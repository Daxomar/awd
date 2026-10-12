// Shared fictional fixtures. Results are server-only until full time; these are game-money predictions.
import { createHmac } from 'node:crypto';
const ROUND = 20 * 60000;
const FIXTURES = [
  ['Ghana Premier League', 'Hearts of Oak', 'Asante Kotoko'],
  ['Premier League', 'Arsenal', 'Chelsea'],
  ['La Liga', 'Real Madrid', 'Barcelona'],
  ['Champions League', 'Liverpool', 'Bayern Munich'],
  ['Ghana Premier League', 'Great Olympics', 'Medeama'],
  ['International friendly', 'Ghana', 'Senegal'],
];
const ODDS = { home: 2.3, draw: 3.2, away: 2.3 };
function result(id) {
  const digest = createHmac('sha256', process.env.MATCH_SEED || process.env.SESSION_SECRET || 'local-match-seed').update(id).digest();
  const home = digest[0] % 5, away = digest[1] % 5;
  return { home, away, winner: home > away ? 'home' : home < away ? 'away' : 'draw' };
}
export function fixture(round, index, now) {
  const [league, home, away] = FIXTURES[(round * 3 + index) % FIXTURES.length];
  const start = round * ROUND + 4 * 60000, end = round * ROUND + 16 * 60000, id = `${round}:${index}`;
  const status = now < start ? 'upcoming' : now < end ? 'live' : 'finished';
  return { id, league, home, away, start, end, status, odds: ODDS, simulated: true,
    minute: Math.min(90, Math.max(0, Math.floor((now - start) / (end - start) * 90))),
    score: status === 'finished' ? result(id) : null };
}
export function matchBoard(now = Date.now()) {
  const round = Math.floor(now / ROUND);
  return [0, 1, 2].map(i => fixture(round, i, now)).concat([0, 1, 2].map(i => fixture(round + 1, i, now)));
}
export function validateBet(state, place, message, now) {
  if (place !== 'viewing' && !String(place).startsWith('n:')) return 'Visit a viewing centre first.';
  if (!state.onboarded || state.busy || state.shift || state.flags.jailUntil > now) return 'Finish your current activity first.';
  const match = matchBoard(now).find(m => m.id === message.match);
  if (!match || match.status !== 'upcoming') return 'Predictions close at kick-off.';
  if (!Object.hasOwn(ODDS, message.pick)) return 'Choose home, draw or away.';
  if (!Number.isInteger(message.stake) || message.stake < 5 || message.stake > 100) return 'Choose a game-money stake between GH₵5 and GH₵100.';
  if ((state.flags.matchBets || []).some(b => b.match === match.id)) return 'You already predicted this fixture.';
  if ((state.flags.matchBets || []).filter(b => !b.settled).length >= 6) return 'Wait for your open predictions to settle.';
  return null;
}
export function makeBet(message, now) {
  const match = matchBoard(now).find(m => m.id === message.match);
  return { match: match.id, title: `${match.home} v ${match.away}`, pick: message.pick, stake: message.stake, odds: ODDS[message.pick], end: match.end, at: now, settled: false };
}
export function settleBets(state, now, credit) {
  let changed = false;
  for (const bet of state.flags.matchBets || []) {
    if (bet.settled || now < bet.end) continue;
    const score = result(bet.match);
    bet.settled = true; bet.score = score; bet.payout = bet.pick === score.winner ? Math.round(bet.stake * bet.odds) : 0;
    if (bet.payout) credit(bet.payout, `Match prediction: ${bet.title}`);
    changed = true;
  }
  if (changed) state.flags.matchBets = state.flags.matchBets.slice(-30);
  return changed;
}
