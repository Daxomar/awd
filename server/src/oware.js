// Oware (Abapa rules), Ghana's national board game, as a PvP mini-game with small stakes, or practice vs the computer.
// Board: pits 0–5 belong to player A (left→right on their side), 6–11 to player B. Sowing is counter-clockwise (index+1).
import * as Game from './game/rules.js';
import * as Gist from './gist.js';

export const STAKES = [0, 20, 50, 100, 200];
const MOVE_MS = 60000, HOUSE = 0.05;
const own = (side, i) => (side === 0 ? i >= 0 && i < 6 : i >= 6 && i < 12);
const sideSum = (b, side) => b.slice(side * 6, side * 6 + 6).reduce((a, c) => a + c, 0);
// returns { board, captured, last } without mutating the input
export function sow(board, pit, side) {
  const b = board.slice(); let n = b[pit]; b[pit] = 0; let i = pit;
  while (n > 0) { i = (i + 1) % 12; if (i === pit) continue; b[i]++; n--; }
  let cap = 0; const before = b.slice(); let j = i;
  while (!own(side, j) && (b[j] === 2 || b[j] === 3)) { cap += b[j]; b[j] = 0; j = (j + 11) % 12; }
  // grand slam: capturing every seed of the opponent is not allowed — the sow happens, the capture doesn't
  if (cap && sideSum(b, 1 - side) === 0) return { board: before, captured: 0, last: i };
  return { board: b, captured: cap, last: i };
}
export function legal(board, side) {
  const pits = []; for (let k = 0; k < 6; k++) { const p = side * 6 + k; if (board[p] > 0) pits.push(p); }
  // must feed an empty opponent if you can
  if (sideSum(board, 1 - side) === 0) { const feeding = pits.filter((p) => sideSum(sow(board, p, side).board, 1 - side) > 0); return feeding; }
  return pits;
}
// simple AI: maximise capture, avoid leaving 1s/2s on own side that the opponent can take next
function aiMove(board, side) {
  const moves = legal(board, side); let best = moves[0], bs = -1e9;
  for (const p of moves) { const r = sow(board, p, side); let worst = 0; for (const q of legal(r.board, 1 - side)) worst = Math.max(worst, sow(r.board, q, 1 - side).captured); const sc = r.captured * 2 - worst + Math.random() * 0.8; if (sc > bs) { bs = sc; best = p; } }
  return best;
}
export class Oware {
  constructor(shard) { this.shard = shard; this.games = new Map(); this.invites = new Map(); this.nextId = 1; setInterval(() => this.timeouts(), 5000); }
  view(g, forSide) { return { t: 'oware', id: g.id, board: g.board, store: g.store, turn: g.turn, you: forSide, names: g.names, stake: g.stake, pot: g.pot, deadline: g.deadline, over: g.over || null, last: g.lastMove ?? null, ai: !!g.ai }; }
  send(g) { for (const s of [0, 1]) { const p = g.p[s]; if (p && !p.gone) this.shard.send(p, this.view(g, s)); } }
  busy(p) { return [...this.games.values()].some((g) => !g.over && g.p.includes(p)); }
  practice(p) {
    if (this.busy(p)) return this.shard.send(p, { t: 'toast', k: 'bad', m: 'Finish your current game first.' });
    const g = this.start(p, null, 0); g.ai = true; g.names[1] = 'Auntie Muni (computer)'; this.send(g);
  }
  invite(p, m) {
    const o = this.shard.players.get(m.id | 0); const stake = STAKES.includes(m.stake | 0) ? m.stake | 0 : 0;
    if (!o || o === p || o.room !== p.room) return this.shard.send(p, { t: 'toast', k: 'bad', m: 'They need to be in the same place as you.' });
    if (this.busy(p) || this.busy(o)) return this.shard.send(p, { t: 'toast', k: 'bad', m: 'Someone is already in a game.' });
    if (stake && p.state.cash + p.state.momo < stake) return this.shard.send(p, { t: 'toast', k: 'bad', m: `You need GH₵${stake} to stake.` });
    const id = this.nextId++; this.invites.set(id, { id, from: p, to: o, stake, at: Date.now() });
    this.shard.send(o, { t: 'oware_invite', id, from: p.name, fromId: p.id, stake });
    this.shard.send(p, { t: 'toast', m: ` Challenged ${o.name} to Oware${stake ? ` for GH₵${stake}` : ''}. Waiting…` });
  }
  answer(p, m) {
    const inv = this.invites.get(m.id | 0); this.invites.delete(m.id | 0);
    if (!inv || inv.to !== p || Date.now() - inv.at > 120000) return this.shard.send(p, { t: 'toast', m: 'That challenge expired.' });
    const a = inv.from; if (a.gone) return;
    if (!m.yes) return this.shard.send(a, { t: 'toast', m: `${p.name} declined the Oware challenge.` });
    if (this.busy(a) || this.busy(p) || a.moneyBusy || p.moneyBusy) return this.shard.send(p, { t: 'toast', k: 'bad', m: 'Someone is already in a game or saving their wallet.' });
    const S = inv.stake;
    if (S && (a.state.cash + a.state.momo < S || p.state.cash + p.state.momo < S)) { for (const x of [a, p]) this.shard.send(x, { t: 'toast', k: 'bad', m: 'Not enough money for the stake.' }); return; }
    if (S) for (const x of [a, p]) { Game.spendFor(x.state, S, 'Oware stake'); x.dirty = true; }
    const g = this.start(a, p, S); this.send(g); this.shard.toRoom(a.room, { t: 'rsocial', a: a.id, b: p.id, kind: 'oware', ic: 'icon:dice-five', anim: 'agree' });
  }
  start(a, b, stake) {
    a.owareActive=true;if(b)b.owareActive=true;
    const g = { id: this.nextId++, p: [a, b], names: [a.name, b ? b.name : ''], board: Array(12).fill(4), store: [0, 0], turn: Math.random() < 0.5 ? 0 : 1, stake, pot: stake * 2, deadline: Date.now() + MOVE_MS, started: Date.now() };
    this.games.set(g.id, g); if (!b) setTimeout(() => this.aiTurn(g), 900); return g;
  }
  move(p, m) {
    const g = this.games.get(m.id | 0); if (!g || g.over) return; const side = g.p[0] === p ? 0 : g.p[1] === p ? 1 : -1;
    if (side < 0 || g.turn !== side) return this.shard.send(p, { t: 'toast', m: 'Not your turn.' });
    const pit = m.pit | 0; if (!legal(g.board, side).includes(pit)) return this.shard.send(p, { t: 'toast', k: 'bad', m: 'You can’t play that pit.' });
    this.apply(g, side, pit);
  }
  apply(g, side, pit) {
    const r = sow(g.board, pit, side); g.board = r.board; g.store[side] += r.captured; g.lastMove = { side, pit, captured: r.captured, last: r.last };
    g.turn = 1 - side; g.deadline = Date.now() + MOVE_MS;
    // end conditions: majority, or the next player has no legal move (remaining seeds go to the player who can still move)
    if (g.store[0] > 24 || g.store[1] > 24 || (g.store[0] === 24 && g.store[1] === 24)) return this.finish(g);
    if (!legal(g.board, g.turn).length) { g.store[side] += g.board.reduce((a, c) => a + c, 0); g.board = Array(12).fill(0); return this.finish(g); }
    this.send(g); if (!g.p[1] && g.turn === 1) setTimeout(() => this.aiTurn(g), 1100);
  }
  aiTurn(g) { if (g.over || g.turn !== 1 || g.p[1]) return; this.apply(g, 1, aiMove(g.board, 1)); }
  finish(g, forfeit = null) {
    if(g.over)return;
    g.over = { winner: forfeit != null ? 1 - forfeit : g.store[0] > g.store[1] ? 0 : g.store[1] > g.store[0] ? 1 : -1, forfeit };
    const W = g.over.winner;
    if (g.pot) { if (W < 0) for (const x of g.p) { if (x) { Game.earnFor(x.state, g.stake, 'Oware stake back'); x.dirty = true; } } else { const prize = Math.round(g.pot * (1 - HOUSE)); const wp = g.p[W]; if (wp) { Game.earnFor(wp.state, prize, 'Oware win'); wp.dirty = true; g.over.prize = prize; if (prize >= 100 && !wp.gone) Gist.post(wp, ` Just won GH₵${prize} at Oware against @${g.names[1 - W]}. Who's next?`, true).catch(() => {}); } } }
    for (const x of g.p) if (x) { x.owareActive=false;Game.bump(x.state, 'oware'); if (g.p.indexOf(x) === W) Game.bump(x.state, 'owareWin'); }
    this.send(g); setTimeout(() => this.games.delete(g.id), 30000);
  }
  leave(p) { for (const g of this.games.values()) if (!g.over && g.p.includes(p)) this.finish(g, g.p.indexOf(p)); }
  resign(p, m) { const g = this.games.get(m.id | 0); if (g && !g.over && g.p.includes(p)) this.finish(g, g.p.indexOf(p)); }
  timeouts() { const now = Date.now(); for (const g of this.games.values()) if (!g.over && now > g.deadline) { if (!g.p[1] && g.turn === 1) this.aiTurn(g); else this.finish(g, g.turn); } for (const [id, i] of this.invites) if (now - i.at > 120000) this.invites.delete(id); }
}
