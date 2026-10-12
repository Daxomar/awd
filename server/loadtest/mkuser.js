// dev helper: create + onboard a user, print its token.  node loadtest/mkuser.js [name] [home] [body]
import WebSocket from 'ws';
const [name = 'dev' + Math.floor(Math.random() * 1e5), home = 'nima', body = 'm'] = process.argv.slice(2);
const r = await fetch('http://127.0.0.1:8080/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: name, password: 'chale-test-12345', dob: '1995-01-01', agree: true }) }).then((x) => x.json());
if (!r.token) { const l = await fetch('http://127.0.0.1:8080/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: name, password: 'chale-test-12345' }) }).then((x) => x.json()); console.log(l.token); process.exit(0); }
const ws = new WebSocket(`ws://127.0.0.1:8080/ws?token=${r.token}`);
ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.t === 'welcome') ws.send(JSON.stringify({ t: 'onboard', name, traits: ['hustler', 'detty'], dream: 'bigman', look: { body, skinTone: 5, top: '#f2b632', bottom: '#2b3a55' }, home })); if (m.t === 'onboarded') { console.log(r.token); ws.close(); process.exit(0); } });
