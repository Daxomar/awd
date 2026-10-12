// v2 E2E: two players → onboard → travel to Circle → same room → move relay → socials → MoMo transfer → DM → request money
import WebSocket from 'ws';
const BASE = 'http://127.0.0.1:8080';
const post = (p, b) => fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n, x); if (!c) process.exitCode = 1; };
async function client(name) {
  const u = name + Math.floor(Math.random() * 1e5); const sign = await post('/api/signup', { username: u, password: 'chale12345', dob: '1995-03-06', agree: true });
  const ws = new WebSocket(`ws://127.0.0.1:8080/ws?token=${sign.token}`); const q = []; let waiters = [];
  ws.on('message', (d) => { const m = JSON.parse(d.toString()); const w = waiters.find((w) => w.f(m)); if (w) { waiters = waiters.filter((x) => x !== w); w.r(m); } else q.push(m); });
  await new Promise((r) => ws.on('open', r));
  const c = { u, ws, q, send: (m) => ws.send(JSON.stringify(m)),
    wait: (f, ms = 10000) => new Promise((r, j) => { const i = q.findIndex(f); if (i >= 0) return r(q.splice(i, 1)[0]); const w = { f, r }; waiters.push(w); setTimeout(() => { waiters = waiters.filter((x) => x !== w); j(new Error(u + ' timeout; last=' + q.slice(-5).map((m) => m.t).join(','))); }, ms); }) };
  c.welcome = await c.wait((m) => m.t === 'welcome'); return c;
}
const A = await client('ama'), B = await client('kofi');
for (const [c, n] of [[A, 'Ama'], [B, 'Kofi']]) { c.send({ t: 'onboard', name: n, traits: ['hustler', 'sweetmouth'], dream: 'chale', look: { body: n === 'Ama' ? 'f' : 'm', skinTone: 5 }, home: (c.welcome.state.birthOrigin==='dbee'?'osu':'nima') }); const o = await c.wait((m) => m.t === 'onboarded'); ok('onboard ' + n, o.state.place === 'home', `origin=${o.origin} momo=${o.state.momo}`); }
const rA = await A.wait((m) => m.t === 'room'); ok('home room', rA.key.startsWith('home:') && rA.home && rA.home.mine, rA.key + ' ' + rA.name);
await B.wait((m) => m.t === 'room');
for (const c of [A, B]) c.send({ t: 'travel', to: 'circle', mode: 'trotro' });
const tb = await A.wait((m) => m.t === 'busy'); ok('travel start', !!tb.busy.travel, `fare=${tb.cost} secs=${Math.round((tb.busy.end - tb.busy.start) / 1000)}`);
const ar = await A.wait((m) => m.t === 'arrived' || (m.t === 'multi' && m.list.some((x) => x.t === 'arrived')), 40000); ok('arrived', true);
const room = await A.wait((m) => m.t === 'room' && m.place === 'circle', 40000); ok('circle room', room.key === 'circle#0', room.key + ' people=' + room.people.length);
await B.wait((m) => m.t === 'room' && m.place === 'circle', 40000);
const join = await A.wait((m) => m.t === 'rjoin', 40000).catch(() => null); const bInA = join ? join.e : room.people[0]; ok('see other player', !!bInA, bInA && bInA.n);
B.send({ t: 'rmv', x: 1.5, z: -0.5, it: 3, zn: 'preacher' }); const mv = await A.wait((m) => m.t === 'rmv'); ok('move relay', mv.x === 1.5 && mv.it === 3, JSON.stringify(mv));
B.send({ t: 'chat', text: 'Chale how far?' }); const ch = await A.wait((m) => m.t === 'chat'); ok('room chat', ch.ch === 'room' && ch.m === 'Chale how far?');
A.send({ t: 'social', id: bInA.id, kind: 'chat' }); const sd = await A.wait((m) => m.t === 'social_done' || m.t === 'toast'); const si = await B.wait((m) => m.t === 'social_in'); ok('social', sd.t === 'social_done' && si.kind === 'chat', `pts=${sd.pts} ${sd.level}`);
A.send({ t: 'social', id: bInA.id, kind: 'flirt' }); const fl = await A.wait((m) => m.t === 'toast'); ok('flirt gated', /closer/.test(fl.m), fl.m);
// money
const momoA0 = A.welcome.state.momo; A.send({ t: 'send', to: B.u, amount: 50, note: 'for waakye' }); const sr = await A.wait((m) => m.t === 'send_res'); ok('send money', sr.ok, JSON.stringify(sr));
const mi = await B.wait((m) => m.t === 'money_in'); ok('money arrives', mi.amount === 50 && mi.from === A.u, JSON.stringify(mi));
A.send({ t: 'send', to: B.u, amount: 999999 }); const big = await A.wait((m) => m.t === 'send_res'); ok('send limit', !big.ok, big.m);
A.send({ t: 'send', to: A.u, amount: 5 }); const self = await A.wait((m) => m.t === 'send_res'); ok('no self send', !self.ok, self.m);
A.send({ t: 'send', to: 'nobody_here_x', amount: 5 }); const nob = await A.wait((m) => m.t === 'send_res'); ok('unknown user', !nob.ok, nob.m);
// DMs
A.send({ t: 'dm', clientId: 'e2e-message', to: B.u, text: 'Did you get it?' }); await A.wait((m) => m.t === 'dm_sent'); const dmi = await B.wait((m) => m.t === 'dm_in'); ok('dm', dmi.m.text === 'Did you get it?', dmi.from);
const da = await A.wait((m) => m.t === 'dm_ack' && m.clientId === 'e2e-message'); ok('private delivery acknowledgement', da.ok);
await new Promise((r) => setTimeout(r, 800)); A.send({ t: 'dm', to: B.u, text: 'send me nudes' }); const blk = await A.wait((m) => m.t === 'toast'); ok('dm moderation', /block|not allowed|can't|Message/i.test(blk.m), blk.m);
B.send({t:'dm_answer',name:A.u,yes:true}); await B.wait(m=>m.t==='dm_thread');
B.send({ t: 'dm', to: A.u, req: true, amount: 20, text: 'transport' }); const rq = await A.wait((m) => m.t === 'dm_in'); ok('money request', rq.m.kind === 'req' && rq.m.amount === 20);
B.send({ t: 'dm_threads' }); const th = await B.wait((m) => m.t === 'dm_threads'); ok('threads', th.rows.length >= 1 && th.rows[0].with === A.u, JSON.stringify(th.rows[0]));
B.send({ t: 'dm_thread', with: A.u }); const t2 = await B.wait((m) => m.t === 'dm_thread'); ok('thread', t2.rows.length >= 3, t2.rows.map((r) => r.kind).join(','));
A.send({ t: 'momo_hist' }); const h = await A.wait((m) => m.t === 'momo_hist'); ok('momo history', h.rows[0].out && h.rows[0].amount === 50, h.rows[0].ref);
A.send({ t: 'profile', name: B.u }); const pr = await A.wait((m) => m.t === 'profile'); ok('profile', pr.p.online && pr.p.friend > 0, `${pr.p.title} · ${pr.p.home} · friend ${pr.p.friend}`);
A.send({ t: 'find', q: B.u.slice(0, 4) }); const fd = await A.wait((m) => m.t === 'find'); ok('find', fd.rows.some((r) => r.name === B.u));
A.send({ t: 'forbes' }); const fb = await A.wait((m) => m.t === 'forbes'); ok('forbes', fb.rows.length > 0, fb.rows[0].name + ' ' + fb.rows[0].worth);
A.send({ t: 'act', loc: 'circle', id: 'purewater', zn: 'stall' }); const bz = await A.wait((m) => m.t === 'busy'); const rst = await B.wait((m) => m.t === 'rst'); ok('activity broadcast', rst.st === bz.busy.ic && rst.zn === 'stall', JSON.stringify(rst));
B.send({ t: 'block', name: A.u }); await B.wait((m) => m.t === 'toast'); A.send({ t: 'dm', to: B.u, text: 'hello?' }); const bl = await A.wait((m) => m.t === 'toast' || m.t === 'dm_sent'); ok('block', bl.t === 'toast', bl.m);
A.q.length = 0; const pl = await A.wait((m) => m.t === 'places', 8000); ok('place counts', pl.c.circle >= 2, JSON.stringify(pl));
// Circle phone market: board → buy (tested) → fix → sell
A.send({ t: 'cancel' }); await new Promise((r) => setTimeout(r, 300)); A.q.length = 0;
A.send({ t: 'phone', op: 'board' }); const pb = await A.wait((m) => m.t === 'phones'); ok('phone board', Object.keys(pb.board).length === 6 && pb.board.spork.buy > 0, `spork ${pb.board.spork.buy}/${pb.board.spork.sell}`);
A.send({ t: 'phone', op: 'buy', m: 'button', test: true }); const pbuy = await A.wait((m) => m.t === 'phones' || m.t === 'toast'); ok('phone buy', pbuy.t === 'phones' && pbuy.stock.length === 1 && pbuy.stock[0].fake === undefined, pbuy.msg || pbuy.m);
const pid = pbuy.stock && pbuy.stock[0] && pbuy.stock[0].id; A.send({ t: 'phone', op: 'fix', id: pid }); const pfix = await A.wait((m) => m.t === 'phones' || m.t === 'toast'); ok('phone fix', pfix.t === 'phones' && pfix.stock[0].fixed, pfix.msg || pfix.m);
A.send({ t: 'phone', op: 'sell', id: pid }); const psell = await A.wait((m) => m.t === 'phones' || m.t === 'toast'); ok('phone sell', psell.t === 'phones' && psell.stock.length === 0 && typeof psell.profit === 'number', psell.msg);
ok('no fake leak in state', !JSON.stringify(psell.state.phones || []).includes('fake'));
// Gist: post, follow, following feed, pinned news
await new Promise((r) => setTimeout(r, 300)); A.send({ t: 'gist_post', text: 'Circle phone market is mad today' }); await A.wait((m) => m.t === 'gist_posted' || m.t === 'toast');
B.send({ t: 'gist_feed', mode: 'latest' }); const gf = await B.wait((m) => m.t === 'gist_feed'); const ap = gf.rows.find((r) => r.n === A.u); ok('gist latest + news', !!ap && gf.news && gf.news[0].id === 'labadi-2026-10', ap && ap.t);
B.send({ t: 'gist_follow', u: ap.u }); const gfo = await B.wait((m) => m.t === 'gist_follow'); ok('gist follow', gfo.following === true);
B.send({ t: 'gist_feed', mode: 'following' }); const gff = await B.wait((m) => m.t === 'gist_feed' && m.mode === 'following'); ok('following feed', gff.rows.length >= 1 && gff.rows.every((r) => r.n === A.u && r.fol));
B.send({ t: 'gist_follow', u: ap.u }); const gun = await B.wait((m) => m.t === 'gist_follow'); ok('gist unfollow', gun.following === false);
A.ws.close(); B.ws.close(); setTimeout(() => process.exit(), 300);
