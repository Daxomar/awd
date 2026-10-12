// v2 load test: N bots onboard, live in rooms, walk, chat, socialise, do activities and travel between places.
// usage: node loadtest/bots2.js <count> <seconds>
import WebSocket from 'ws';
const N = +(process.argv[2] || 500), SECS = +(process.argv[3] || 60), URL = 'ws://127.0.0.1:8080/ws', KEY = process.env.BOT_KEY || 'loadtest';
const data = await fetch('http://127.0.0.1:8080/api/data').then((r) => r.json());
const LOCS = data.locs.filter((l) => ['circle', 'oxford', 'makola', 'labadi', 'muni', 'mall', 'viewing', 'chopbar'].includes(l.id)).map((l) => l.id);
let conn = 0, fail = 0, bytes = 0, msgs = 0, rooms = 0, travels = 0, acts = 0, socials = 0; const lat = [];
function bot(i) {
  const ws = new WebSocket(`${URL}?bot=${KEY}`); const b = { ws, people: [] }; let pingAt = 0;
  ws.on('open', () => conn++); ws.on('error', () => fail++);
  ws.on('message', (d) => { bytes += d.length; msgs++; const m = JSON.parse(d.toString());
    if (m.t === 'welcome') ws.send(JSON.stringify({ t: 'onboard', name: 'bot' + i, traits: ['hustler', 'detty'], dream: 'bigman', look: { body: i % 2 ? 'f' : 'm', skinTone: 5 }, home: 'nima' }));
    else if (m.t === 'onboarded') { b.ready = true; ws.send(JSON.stringify({ t: 'travel', to: LOCS[i % LOCS.length], mode: 'walk' })); }
    else if (m.t === 'room') { rooms++; b.place = m.place; b.people = m.people.map((p) => p.id); }
    else if (m.t === 'rjoin') b.people.push(m.e.id); else if (m.t === 'rleave') b.people = b.people.filter((x) => x !== m.id);
    else if (m.t === 'pong') lat.push(Date.now() - pingAt); });
  b.step = () => { if (!b.ready || ws.readyState !== 1 || !b.place) return; const r = Math.random();
    if (r < 0.25) ws.send(JSON.stringify({ t: 'rmv', x: (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 6, it: null }));
    else if (r < 0.27) ws.send(JSON.stringify({ t: 'chat', text: 'Chale how far ' + i }));
    else if (r < 0.29 && b.people.length) { socials++; ws.send(JSON.stringify({ t: 'social', id: b.people[Math.floor(Math.random() * b.people.length)], kind: 'chat' })); }
    else if (r < 0.31) { acts++; ws.send(JSON.stringify({ t: 'act', loc: b.place, id: 'toilet', zn: 'x' })); }
    else if (r < 0.315) { travels++; b.place = null; ws.send(JSON.stringify({ t: 'travel', to: LOCS[Math.floor(Math.random() * LOCS.length)], mode: 'walk' })); }
    else if (r < 0.32) { pingAt = Date.now(); ws.send(JSON.stringify({ t: 'ping', c: 1 })); } };
  return b;
}
const bots = []; for (let i = 0; i < N; i++) setTimeout(() => bots.push(bot(i)), i * (4000 / N));
setInterval(() => { for (const b of bots) b.step(); }, 1000);
const t0 = Date.now(); let lastB = 0;
const iv = setInterval(async () => { const el = (Date.now() - t0) / 1000; let h = {}; try { h = await (await fetch('http://127.0.0.1:8080/health')).json(); } catch {}
  const rate = (bytes - lastB) / 5; lastB = bytes; lat.sort((a, b) => a - b);
  console.log(`t=${el.toFixed(0)}s conn=${conn} fail=${fail} online=${h.online} rooms=${h.rooms} tickMs=${h.tickMs} lagMs=${h.lagMs} mem=${h.mem}MB down=${(rate / 1024).toFixed(0)}KB/s per-bot=${(rate / Math.max(1, conn) / 1024).toFixed(2)}KB/s roomMsgs=${rooms} travels=${travels} acts=${acts} socials=${socials} pingP50=${lat[Math.floor(lat.length / 2)]}ms p99=${lat[Math.floor(lat.length * 0.99)]}ms`); lat.length = 0;
  if (el >= SECS) { clearInterval(iv); for (const b of bots) try { b.ws.close(); } catch {} setTimeout(() => process.exit(0), 500); } }, 5000);
