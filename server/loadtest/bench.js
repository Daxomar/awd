// Pure-CPU benchmark of the shard tick (no network): node loadtest/bench.js <players>
const { Shard } = await import('../src/shard.js');
const s = new Shard(null);
const HOT = [[0, 0], [400, -300], [-900, 500], [1500, 800]];
const N = +process.argv[2] || 2000; let sent = 0;
for (let i = 0; i < N; i++) {
  const h = HOT[i % 4], sp = i % 5 === 0 ? 1500 : 120;
  const ws = { send: (b) => { sent += b.length || 0; }, getBufferedAmount: () => 0, end() {} };
  const p = { id: s.nextId++, acct: -i, name: 'b' + i, ws, state: { look: {}, n: {} }, x: h[0] + (Math.random() - 0.5) * sp, z: h[1] + (Math.random() - 0.5) * sp, yaw: 0, anim: 1, seen: new Set(), mv: true, bot: true };
  s.players.set(p.id, p); s.grid.insert(p);
}
s.tick(); sent = 0;
const t0 = performance.now(), K = 20;
for (let k = 0; k < K; k++) { for (const p of s.players.values()) { p.x += Math.random() - 0.5; p.z += Math.random() - 0.5; p.mv = true; s.grid.move(p); } s.tick(); }
console.log(N, 'players · avg tick', ((performance.now() - t0) / K).toFixed(1), 'ms · out/tick', (sent / K / 1024).toFixed(0) + 'KB');
process.exit(0);
