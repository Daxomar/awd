import { sow, legal, Oware } from '../src/oware.js';
const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n, x); if (!c) process.exitCode = 1; };
// capture: A plays pit 5 with 1 seed into pit 6 holding 1 → 2 → capture 2
let b = [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 3]; let r = sow(b, 5, 0); ok('capture 2', r.captured === 2 && r.board[6] === 0, JSON.stringify(r));
// chain capture backwards
b = [0, 0, 0, 0, 0, 2, 2, 1, 0, 0, 0, 4]; r = sow(b, 5, 0); ok('chain capture', r.captured === 5, JSON.stringify(r));
// grand slam forbidden
b = [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0]; r = sow(b, 5, 0); ok('grand slam blocked', r.captured === 0, JSON.stringify(r));
// skip origin with 12+ seeds
b = Array(12).fill(0); b[0] = 12; r = sow(b, 0, 0); ok('skip origin', r.board[0] === 0 && r.board.reduce((a, c) => a + c, 0) === 12, JSON.stringify(r.board));
// must feed
b = [0, 0, 0, 0, 1, 3, 0, 0, 0, 0, 0, 0]; ok('must feed', JSON.stringify(legal(b, 0)) === '[5]', JSON.stringify(legal(b, 0)));
// full game vs AI with a fake shard: random legal moves for the human
const sent = []; const shard = { send: (p, m) => sent.push(m), toRoom() {} };
const st = () => ({ cash: 500, momo: 0, ledger: [], stats: { earned: 0 }, wk: { inc: 0 }, cnt: {}, dc: { day: -1, cnt: {}, visits: [] } });
const O = new Oware(shard); const A = { id: 1, name: 'ama', state: st() };
O.practice(A); let g = [...O.games.values()][0]; let guard = 0;
while (!g.over && guard++ < 400) { if (g.turn === 0) { const L = legal(g.board, 0); O.move(A, { id: g.id, pit: L[Math.floor(Math.random() * L.length)] }); } else O.aiTurn(g); }
ok('game finishes', !!g.over, `moves=${guard} store=${g.store} winner=${g.over && g.over.winner}`);
ok('seed conservation', g.store[0] + g.store[1] + g.board.reduce((a, c) => a + c, 0) === 48);
process.exit();
