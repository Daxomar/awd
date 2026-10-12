// Phone apps. Each app: { id, name, icon (Phosphor fill), bg, open(win, arg), badge?, dock? }.
import { h, ic, icf, cedi, ago, mins, vibrate } from '../ui/dom.js';
import { G, money, lvl, repTitle, accraNow, loc } from '../store.js';
import { net } from '../net.js';
import { LEVELS, level } from '../ui/people.js';
import { iosAlert, iosConfirm } from './phone.js';
import { phoneGames } from './games.js';
import { portrait } from '../ui/portrait.js';

const grad = (a, b) => `linear-gradient(160deg, ${a}, ${b})`;
const cell = (o) => h('button.cell' + (o.ic ? '' : '.noic'), { onclick: o.onclick }, o.ic instanceof Node ? o.ic : o.ic ? h('div.ci', { style: { background: o.icbg || '#8e8e93' } }, typeof o.ic === 'string' && o.ic.length <= 3 && !/^[a-z]/.test(o.ic) ? o.ic : icf(o.ic)) : null, h('div.cm', null, h('div.c1', null, o.t), o.s ? h('div.c2', null, o.s) : null), o.r != null ? h('div.cr', null, o.r) : null, o.onclick && o.chev !== false ? ic('caret-right', 'chev') : null);
const group = (title, ...cells) => h('div', null, title ? h('div.group-h', null, title) : null, h('div.group', null, ...cells));
const seg = (opts, cur, on) => h('div.seg-i', null, ...opts.map(([k, l]) => h('button' + (k === cur ? '.on' : ''), { onclick: () => on(k) }, l)));
const AT_AGENT = () => ['momo', 'bank', 'mall', 'circle'].includes(G.state.place);

export function makeApps(act) {
  // ------------------------------------------------------------------ Messages
  const messages = { id: 'messages', name: 'Messages', icon: 'chat-circle', bg: grad('#5ef27a', '#2fbf4f'), dock: true, white: true, badge: () => (G.unreadDm || 0),
    open(win, arg) {
      let threads = null; const off = net.on('dm_threads', (m) => { threads = m.rows; win.refresh(); }); win.onclose = off; net.send({ t: 'dm_threads' });
      win.page('Messages', () => {
        const rows = [];
        for (const t of threads || []) rows.push({ at: t.at, el: h('button.cell', { onclick: () => dmThread(win, t.with) }, portrait(t.look,t.with), h('div.cm', null, h('div.c1', { style: { fontWeight: 600 } }, '@' + t.with + (t.request?' · Request':'')), h('div.c2', null, t.kind === 'req' ? ` Money request · ${cedi(t.amount)}` : t.kind === 'paid' ? ` Sent ${cedi(t.amount)}` : (t.mine ? 'You: ' : '') + t.text)), h('div.cr', { style: { flexDirection: 'column', alignItems: 'flex-end', fontSize: '13px' } }, ago(t.at), t.unread ? h('span', { style: { minWidth: '20px', height: '20px', borderRadius: '10px', background: '#0a84ff', color: '#fff', fontSize: '12px', fontWeight: 700, display: 'grid', placeItems: 'center' } }, t.unread) : null)) });
        rows.sort((a, b) => b.at - a.at);
        return h('div', null, h('div.search', { onclick: () => act.phone('contacts') }, ic('magnifying-glass'), h('span', null, 'New message to a player…')), rows.length ? h('div.group', null, ...rows.map((r) => r.el)) : h('div.empty', null, ic('chat-circle-dots'), 'No messages yet'));
      }, { action: ['New', () => act.phone('contacts')] });
      if (arg && arg.dm) dmThread(win, arg.dm);
    } };
  function dmThread(win, name) {
    let data = null, pending = null, sendButton = null; const offs = [net.on('dm_request_answer',m=>{if(m.from.toLowerCase()===name.toLowerCase())net.send({t:'dm_thread',with:name});}),net.on('dm_thread', (m) => { if (m.with.toLowerCase() === name.toLowerCase()) { if(data?.request?.status==='accepted'&&m.request?.status==='pending')m.request={...m.request,status:'accepted'};data = m; win.refresh(); } }), net.on('dm_in', (m) => { if (m.from.toLowerCase() === name.toLowerCase() && data) { data.rows.push(m.m); win.refresh(); net.send({ t: 'dm_thread', with: name }); } }), net.on('dm_sent', (m) => { if (data && m.m.to.toLowerCase() === name.toLowerCase()) { data.rows.push(m.m); win.refresh(); net.send({t:'dm_thread',with:name}); } })];
    const prevClose = win.onclose; win.onclose = () => { offs.forEach((f) => f()); prevClose && prevClose(); };
    net.send({ t: 'dm_thread', with: name });
    const input = h('input', { placeholder: 'Private message', maxLength: 400, enterkeyhint: 'send' });
    const finish = (ok, message) => { if (!pending) return; clearTimeout(pending.timer); if (ok && input.value.trim() === pending.text) input.value = ''; pending = null; sendButton.disabled = false; if (message) act.toast(message, ok ? 'good' : 'bad'); };
    offs.push(net.on('dm_ack', (m) => { if (m.clientId === pending?.id) finish(m.ok, m.ok ? '' : m.m); }), net.on('connection', (m) => { if (!m.connected) finish(false, 'Connection lost. Your draft is kept.'); }));
    const send = () => { const text = input.value.trim(); if (!text || pending) return; if(data?.request&&data.request.status!=='accepted')return act.toast('Wait for the message request to be accepted.','bad'); const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`; if (!net.send({ t: 'dm', to: name, text, clientId: id })) return; pending = { id, text, timer: setTimeout(() => finish(false, 'Delivery not confirmed. Your draft is kept.'), 15000) }; sendButton.disabled = true; };
    const v = win.page('@' + name, () => {
      if (!data) return h('div.empty', null, 'Loading…'); const out = h('div.chat');
      out.append(portrait(data.look,name,'thread-portrait'));
      if(data.request?.status==='pending')out.append(h('div.message-request',null,h('b',null,data.request.incoming?'Message request':'Waiting for acceptance'),h('p',null,data.request.incoming?'Accept to chat privately with this player.':'They will receive your first message as a request.'),...(data.request.incoming?[h('button.ibtn',{onclick:()=>net.send({t:'dm_answer',name,yes:true})},'Accept'),h('button.ibtn.gray',{onclick:()=>net.send({t:'dm_answer',name,yes:false})},'Decline')]:[])));
      if(data.request?.status==='declined')out.append(h('p',null,'Message request declined.'));
      let lastT = 0; for (const m of data.rows) {
        if (m.at - lastT > 15 * 60000) out.append(h('div.bub-time', null, new Date(m.at).toUTCString().slice(17, 22))); lastT = m.at;
        if (m.kind === 'req') out.append(h('div.moneycard' + (m.mine ? '.out' : ''), null, h('div.mc-n', null, m.mine ? 'You requested' : `@${name} requests`), h('div.mc-a', null, cedi(m.amount)), h('div.mc-n', null, m.text), !m.mine && m.status !== 'paid' ? h('button.ibtn', { onclick: () => sendFlow(win, name, m.amount, m.id) }, 'Pay') : h('div.mc-n', { style: { marginTop: '6px', fontWeight: 700 } }, m.status === 'paid' ? '✓ Paid' : 'Pending')));
        else if (m.kind === 'paid') out.append(h('div.moneycard' + (m.mine ? '.out' : ''), null, h('div.mc-n', null, m.mine ? 'You sent' : `@${name} sent you`), h('div.mc-a', null, cedi(m.amount)), h('div.mc-n', null, m.text)));
        else out.append(h('div.bub.' + (m.mine ? 'out' : 'in'), null, m.text));
      }
      if (data.blocked) out.append(h('div.bub-time', null, 'You blocked this person'));
      setTimeout(() => { const b = win.cur && win.cur.body; if (b) b.scrollTop = b.scrollHeight; }, 0); return out;
    }, { small: true, action: ['Profile', () => profilePage(win, name)] });
    const comp = h('form.composer', { onsubmit: (e) => { e.preventDefault(); send(); } }, h('button.plus', { type: 'button', onclick: () => win.phone.openApp('games',{with:name}) }, ic('game-controller')), input, (sendButton = h('button.send', { type: 'submit', 'aria-label': 'Send private message' }, ic('arrow-up'))));
    const close = win.onclose; win.onclose = () => { if(pending) clearTimeout(pending.timer); close(); };
    v.wrap.append(comp); v.nb.style.background = 'rgba(249,249,249,.94)';
  }
  function moneyChooser(win, name) {
    win.page('Money', () => group(null, cell({ ic: 'paper-plane-tilt', icbg: '#34c759', t: `Send money to @${name}`, onclick: () => sendFlow(win, name) }), cell({ ic: 'hand-coins', icbg: '#0a84ff', t: `Request money from @${name}`, onclick: () => requestFlow(win, name) })), { small: true });
  }
  // ------------------------------------------------------------------ MoMo
  function amountPage(win, title, sub, max, onOk, preset) {
    let v = preset ? String(preset) : ''; let note = '';
    const noteIn = h('input', { placeholder: 'Reference (optional)', maxLength: 60, style: { width: '100%', height: '44px', borderRadius: '12px', border: '0', padding: '0 12px', fontSize: '16px', background: '#fff' }, oninput: (e) => (note = e.target.value) });
    const p = win.page(title, () => {
      const n = +v || 0; const fee = n ? Math.max(1, Math.min(15, Math.round(n * 0.0075))) : 0;
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) => h('button', { style: k ? null : { background: 'transparent' }, onclick: () => { if (!k) return; v = k === '⌫' ? v.slice(0, -1) : (v + k).replace(/^0+/, '').slice(0, 6); win.refresh(); } }, k));
      return h('div', null, h('div.amount-big.tnum', null, 'GH₵' + (n ? n.toLocaleString() : '0')), h('div.amount-sub', null, sub(n, fee)), h('div', { style: { margin: '12px 0' } }, noteIn), h('div.keypad', null, ...keys), h('button.ibtn.wide.green', { style: { marginTop: '14px', height: '52px' }, disabled: !n || (max && n > max), onclick: () => onOk(n, note, fee) }, 'Continue'));
    }, { small: true });
    return p;
  }
  function sendFlow(win, name, preset, reqId) {
    if (!name) return pickPerson(win, 'Send to', (n) => sendFlow(win, n));
    amountPage(win, `To @${name}`, (n, fee) => (n ? `Fee ${cedi(fee)} · total ${cedi(n + fee)} · MoMo ${cedi(G.state.momo)}` : `MoMo balance ${cedi(G.state.momo)}`), 0, (n, note, fee) => {
      win.page('Confirm', () => h('div', null, h('div.receipt', null, h('div', { style: { fontSize: '13px', color: '#8e8e93' } }, 'You are sending'), h('div.amount-big', { style: { fontSize: '42px', margin: '6px 0' } }, cedi(n)), h('div', { style: { fontWeight: 600, fontSize: '17px' } }, `to @${name}`), note ? h('div', { style: { color: '#8e8e93', marginTop: '4px' } }, `“${note}”`) : null,
        h('div.group', { style: { margin: '16px 0 0', textAlign: 'left', background: '#f2f2f7' } }, cell({ t: 'Fee', r: cedi(fee) }), cell({ t: 'Total', r: cedi(n + fee) }), cell({ t: 'From', r: 'MoMo wallet' }))),
        h('div.muted', { style: { fontSize: '12.5px', margin: '12px 4px', color: '#8e8e93' } }, 'In-game money only. Never buy or sell game money for real cash — scammers target that. Accra We Dey staff will never ask for your password.'),
        h('button.ibtn.wide.green', { style: { height: '52px' }, onclick: (e) => { e.currentTarget.disabled = true; const off = net.on('send_res', (r) => { off(); if (!r.ok) { act.toast(r.m, 'bad'); win.pop(); return; } vibrate([20, 30, 20]); receipt(win, r, note); }); net.send({ t: 'send', to: name, amount: n, note, req: reqId }); } }, 'Send now')), { small: true });
    }, preset);
  }
  function receipt(win, r, note) {
    win.page('Sent', () => h('div.receipt', null, h('div.tick', null, ic('check')), h('div', { style: { fontSize: '15px', color: '#8e8e93' } }, 'Money sent'), h('div.amount-big', { style: { fontSize: '40px', margin: '4px 0' } }, cedi(r.amount)), h('div', { style: { fontWeight: 600 } }, `to @${r.to}`), note ? h('div', { style: { color: '#8e8e93' } }, `“${note}”`) : null,
      h('div.group', { style: { margin: '16px 0 14px', textAlign: 'left', background: '#f2f2f7' } }, cell({ t: 'Fee', r: cedi(r.fee) }), cell({ t: 'New balance', r: cedi(r.momo) }), cell({ t: 'Ref', r: r.ref })), h('button.ibtn.wide', { onclick: () => { win.stack.splice(1); win.pop(); } }, 'Done')), { small: true });
  }
  function requestFlow(win, name) {
    if (!name) return pickPerson(win, 'Request from', (n) => requestFlow(win, n));
    amountPage(win, `From @${name}`, () => 'They’ll get a request in Messages', 0, (n, note) => { net.send({ t: 'dm', to: name, req: true, amount: n, text: note || 'Please send me money' }); act.toast(`Request sent to @${name}`, 'good'); win.stack.splice(1); win.pop(); });
  }
  function pickPerson(win, title, onPick) {
    let q = '', rows = []; const off = net.on('find', (m) => { rows = m.rows; win.refresh(); });
    const input = h('input', { placeholder: 'Username', autocapitalize: 'off', oninput: (e) => { q = e.target.value; if (q.length >= 2) net.send({ t: 'find', q }); else { rows = []; win.refresh(); } } });
    const friends = Object.values(G.state.friends || {}).sort((a, b) => b.pts - a.pts);
    const v = win.page(title, () => h('div', null, h('div.search', null, ic('magnifying-glass'), input),
      rows.length ? group('Players', ...rows.map((r) => cell({ ic: portrait(r.look,r.name), icbg: r.online ? '#34c759' : '#8e8e93', t: '@' + r.name, s: [r.job, r.online ? 'Online' : null].filter(Boolean).join(' · '), onclick: () => { off(); onPick(r.name); } }))) : null,
      friends.length ? group('Friends', ...friends.slice(0, 30).map((f) => cell({ ic: portrait(f.look,f.n), icbg: '#ff9f0a', t: '@' + f.n, s: level(f.pts), onclick: () => { off(); onPick(f.n); } }))) : h('div.empty', null, ic('users'), 'Search a username')), { small: true });
    setTimeout(() => input.focus(), 50); return v;
  }
  const momo = { id: 'momo', name: 'MoMo', icon: 'wallet', bg: grad('#ffd84d', '#f5a700'), dock: true,
    open(win, arg) {
      let hist = null; const off = net.on('momo_hist', (m) => { hist = m.rows; win.refresh(); }); win.onclose = off; net.send({ t: 'momo_hist' });
      win.page('MoMo', () => {
        const s = G.state; const led = (s.ledger || []).slice().reverse();
        return h('div', null,
          h('div.wallet', null, h('div.wl', null, 'Wallet balance'), h('div.wa.tnum', null, cedi(s.momo)), h('div.wn', null, `Cash in hand ${cedi(s.cash)} · ${repTitle()}`)),
          h('div.qa', null, h('button', { onclick: () => sendFlow(win) }, ic('paper-plane-tilt'), 'Send'), h('button', { onclick: () => requestFlow(win) }, ic('hand-coins'), 'Request'), h('button', { onclick: () => cashPage(win) }, ic('storefront'), 'Cash in/out'), h('button', { onclick: () => topupPage(win) }, ic('plus-circle'), 'Top up')),
          hist && hist.length ? group('Transfers', ...hist.slice(0, 12).map((x) => cell({ ic: x.out ? 'icon:circle' : 'icon:circle', icbg: x.out ? '#ff9f0a' : '#34c759', t: x.kind === 'topup' ? 'Wallet top-up' : (x.out ? 'To ' : 'From ') + '@' + x.who, s: `${ago(x.at)} · ${x.ref}${x.note ? ' · ' + x.note : ''}`, r: (x.out ? '−' : '+') + cedi(x.amount).replace('GH₵', '₵') }))) : null,
          group('Recent activity', ...(led.length ? led.slice(0, 25).map(([t, a, why]) => cell({ t: why, s: ago(t), r: h('span', { style: { color: a > 0 ? '#34c759' : '#000', fontWeight: 600 } }, (a > 0 ? '+' : '−') + cedi(Math.abs(a)).replace('GH₵', '₵')) })) : [cell({ t: 'No transactions yet' })])));
      });
      if (arg === 'send') sendFlow(win); else if (arg && arg.send) sendFlow(win, arg.send); else if (arg === 'topup') topupPage(win); else if (arg === 'cash') cashPage(win);
    } };
  function cashPage(win) {
    win.page('Cash in / out', () => { const at = AT_AGENT(); const s = G.state;
      return h('div', null, h('div.group-h', null, at ? 'You are at a MoMo point' : 'Find a MoMo agent'),
        at ? group(null, cell({ ic: 'arrow-circle-down', icbg: '#34c759', t: `Cash in ${cedi(s.cash)}`, s: 'Cash → MoMo (free)', onclick: () => { net.send({ t: 'bank', op: 'cashin' }); act.toast('Cashed in to MoMo', 'good'); } }), cell({ ic: 'arrow-circle-up', icbg: '#ff9f0a', t: 'Cash out GH₵100', s: '1% agent fee', onclick: () => net.send({ t: 'bank', op: 'cashout', amount: 100 }) }), cell({ ic: 'arrow-circle-up', icbg: '#ff9f0a', t: 'Cash out GH₵500', s: '1% agent fee', onclick: () => net.send({ t: 'bank', op: 'cashout', amount: 500 }) }))
          : h('div.group', { style: { padding: '14px', fontSize: '15px' } }, 'Cash in and out at a MoMo agent: Blessed MoMo Agent (Circle), Kwame Nkrumah Circle, Accra Mall or the bank in Ridge. Cash in your pocket can be stolen if you pass out — MoMo is safer.', h('button.ibtn.wide', { style: { marginTop: '12px' }, onclick: () => { act.closePhone(); act.place('momo'); } }, 'Go to the MoMo agent')));
    }, { small: true });
  }
  function topupPage(win) {
    let P = null; fetch('/api/packs').then((r) => r.json()).then((j) => { P = j; win.refresh(); }).catch(() => {});
    win.page('Top up', () => { if (!P) return h('div.empty', null, 'Loading…');
      return h('div', null, h('div', { style: { color: '#6d6d72', fontSize: '14px', margin: '4px 2px 12px' } }, `Add game money with Mobile Money or card (Paystack). Max GH₵${P.cap} real money per week. Game money has no cash value.`),
        h('div.group', null, ...P.packs.map((k) => cell({ ic: 'icon:wallet', icbg: '#ffcc00', t: `${cedi(k.coins)} game money`, s: `${k.label}${k.tag ? ' · ' + k.tag : ''}`, r: h('span.ibtn' + (P.live ? '' : '.gray'), { style: { height: '34px', fontSize: '14px' } }, `GH₵${k.ghs}`), chev: false, onclick: () => { if (!P.live) return act.toast('Top-ups are not live on this server yet.', 'bad'); iosAlert({ title: 'Receipt email', text: 'Paystack sends your receipt here.', input: 'Email address', buttons: [['Cancel', false], ['Continue', true]] }).then((email) => { if (!email) return; const off = net.on('topup', (r) => { off(); if (r.payUrl) location.href = r.payUrl; else act.toast(r.error || 'Could not start payment', 'bad'); }); net.send({ t: 'topup', pack: k.id, email }); }); } }))),
        !P.live ? h('div', { style: { color: '#8e8e93', fontSize: '13px', textAlign: 'center' } }, 'Top-ups switch on when the server has a Paystack key.') : null);
    }, { small: true });
  }
  // ------------------------------------------------------------------ Gist
  const gist = { id: 'gist', name: 'Accra Gist', icon: 'megaphone-simple', bg: grad('#1d9bf0', '#0b5fae'), dock: true, white: true,
    open(win) {
      let mode = 'latest', rows = null, news = []; const load = () => net.send({ t: 'gist_feed', mode });
      const offs = [net.on('gist_feed', (m) => { if (m.mode === mode) { rows = m.rows; news = m.news || []; win.refresh(); } }), net.on('gist_follow', (m) => { if (rows) for (const r of rows) if (r.u === m.target) r.fol = m.following; act.toast(m.following ? 'Following. Their posts show in your Following tab.' : 'Unfollowed.', m.following ? 'good' : ''); win.refresh(); }), net.on('gist_posted', load), net.on('gist_liked', (m) => { const r = rows && rows.find((x) => x.id === m.id); if (r && !r.liked) { r.liked = true; r.l++; win.refresh(); } })]; win.onclose = () => offs.forEach((f) => f());
      load();
      const v = win.page('Accra Gist', () => h('div', null, seg([['latest', 'Latest'], ['trending', 'Trending'], ['following', 'Following'], ['me', 'Me']], mode, (k) => { mode = k; rows = null; win.refresh(); load(); }),
        mode === 'latest' ? h('div', null, ...news.map((n) => h('div', null, h('button.newscard', { onclick: () => { if (n.place) { act.closePhone && act.closePhone(); act.place(n.place); } } }, h('div.nk', null, h('span', null, n.ic, ' ACCRA NEWS'), h('span', null, ago(n.at))), h('div.nt', null, n.t), h('div.nd', null, n.d), n.place ? h('div.ng', null, 'Tap to go there →') : null), n.url ? h('a.news-source', { href:n.url, target:'_blank', rel:'noopener noreferrer' }, n.source || 'Read source') : null))) : null,
        !rows ? h('div.empty', null, 'Loading…') : !rows.length ? h('div.empty', null, ic('megaphone'), mode === 'following' ? 'You don’t follow anybody yet. Tap Follow on a post in Latest.' : 'Nothing yet. Be the first to gist!') : h('div', { style: { margin: '0 -16px' } }, ...rows.map((p) => h('div.post', null, portrait(p.look,p.n), h('div.grow', null, h('div.prow', null, h('span.pn', null, p.n), ' ', h('span.pf', null, `· ${ago(p.at)}`), !p.me && p.u ? h('button.fol' + (p.fol ? '.on' : ''), { onclick: () => net.send({ t: 'gist_follow', u: p.u }) }, p.fol ? 'Following' : 'Follow') : null), h('div.pf', null, p.f), h('div.pt', null, p.t),
          h('div.pa', null, h('button' + (p.liked ? '.liked' : ''), { onclick: () => net.send({ t: 'gist_like', id: p.id }) }, icf('heart'), p.l), p.me ? h('button', { onclick: () => net.send({ t: 'gist_del', id: p.id }) }, ic('trash'), 'Delete') : h('button', { onclick: () => net.send({ t: 'gist_report', id: p.id }) }, ic('flag'), 'Report'))))))));
      const fab = h('button.fab', { onclick: () => compose() }, ic('feather')); v.wrap.append(fab);
      function compose() { const ta = h('textarea', { maxLength: 280, placeholder: 'Wetin dey happen?', style: { width: '100%', height: '160px', border: '0', borderRadius: '14px', padding: '14px', fontSize: '17px', resize: 'none', outline: 'none' } });
        win.page('New post', () => h('div', null, ta, h('div', { style: { color: '#8e8e93', fontSize: '13px', margin: '8px 2px 14px' } }, 'Be nice. No links, numbers, or selling game money.'), h('button.ibtn.wide', { onclick: () => { const t = ta.value.trim(); if (t.length < 2) return; net.send({ t: 'gist_post', text: t }); win.pop(); mode = 'latest'; } }, 'Post')), { small: true }); setTimeout(() => ta.focus(), 50); }
    } };
  // ------------------------------------------------------------------ Jobs
  const jobs = { id: 'jobs', name: 'Jobs', icon: 'briefcase', bg: grad('#ff9f0a', '#e8590c'), dock: true,
    open(win) {
      win.page('Jobs', () => {
        const s = G.state; const C = G.cat.careers; const out = h('div');
        if (s.job) { const c = C[s.job.id]; const j = s.job; const pay = c.ranks[j.rank][1]; const atWork = s.place === c.at; const today = Math.floor(accraNow() / 864e5) === j.lastDay;
          out.append(h('div.group', { style: { padding: '16px' } }, h('div', { style: { fontSize: '13px', color: '#8e8e93' } }, `${c.name} · ${loc(c.at).name}`), h('div', { style: { font: '700 24px var(--disp)', margin: '2px 0' } }, `${c.ic} ${c.ranks[j.rank][0]}`), h('div', { style: { fontSize: '15px' } }, `${cedi(Math.round(pay * (1 + 0.05 * j.grade)))} per 1-hour shift · Grade ${j.grade + 1}/4`),
            h('div', { style: { margin: '10px 0 4px', fontSize: '13px', color: '#6d6d72' } }, `Performance ${Math.round(j.perf)}%`), h('div.fbar', null, h('i', { style: { width: j.perf + '%', background: '#34c759' } })),
            j.rank < 4 ? h('div', { style: { fontSize: '13px', color: '#6d6d72', marginTop: '8px' } }, `Next: ${c.ranks[j.rank + 1][0]} (${cedi(c.ranks[j.rank + 1][1])}) · needs ${G.cat.promoShifts[j.rank]} shifts (${j.shifts} done) and ${G.cat.skills[c.skill]} ${G.cat.promoSkill[j.rank]} (you: ${lvl(c.skill)})`) : null,
            h('div', { style: { fontSize: '13px', color: '#6d6d72', marginTop: '4px' } }, `Work days: ${c.days.map((d) => 'SMTWTFS'[d]).join(' ')} · ${c.night ? '20:00–04:00' : '06:00–22:00'}`),
            h('div.row', { style: { gap: '8px', marginTop: '12px' } }, s.shift ? h('button.ibtn.grow', { disabled: true }, 'On shift now') : today ? h('button.ibtn.grow.gray', { disabled: true }, 'Done for today') : atWork ? h('button.ibtn.green.grow', { onclick: () => { net.send({ t: 'work', op: 'start' }); act.closePhone(); } }, 'Start shift') : h('button.ibtn.grow', { onclick: () => { act.closePhone(); act.place(c.at); } }, 'Go to work'), h('button.ibtn.red', { onclick: () => { iosConfirm('Quit your job?', 'You lose your rank and progress at this job.', 'Quit', true).then((ok) => ok && net.send({ t: 'work', op: 'quit' })); } }, 'Quit'))));
        }
        out.append(h('div.group-h', null, s.job ? 'Other careers' : 'Careers in Accra'));
        out.append(h('div.group', null, ...Object.entries(C).filter(([id]) => !s.job || s.job.id !== id).map(([id, c]) => { const reqs = Object.entries(c.req || {}); const ok = reqs.every(([k, v]) => lvl(k) >= v);
          return cell({ ic: c.ic, icbg: ok ? '#f2f2f7' : '#f2f2f7', t: `${c.ranks[0][0]} · ${c.name}`, s: `${cedi(c.ranks[0][1])}/shift → up to ${cedi(c.ranks[4][1])} · ${loc(c.at).name}${reqs.length ? ' · needs ' + reqs.map(([k, v]) => `${G.cat.skills[k]} ${v}`).join(', ') : ''}`, onclick: () => careerPage(win, id) }); })));
        return out;
      });
    } };
  function careerPage(win, id) {
    const c = G.cat.careers[id]; const s = G.state;
    win.page(c.name, () => { const reqs = Object.entries(c.req || {}); const ok = reqs.every(([k, v]) => lvl(k) >= v); const at = s.place === c.at;
      return h('div', null, group('Ladder', ...c.ranks.map(([t, p], i) => cell({ ic: String(i + 1), icbg: i === 0 ? '#34c759' : '#c7c7cc', t, r: cedi(p) + '/shift' }))),
        group('Details', cell({ t: 'Where', r: loc(c.at).name }), cell({ t: 'Skill', r: G.cat.skills[c.skill] }), cell({ t: 'Days', r: c.days.map((d) => 'SMTWTFS'[d]).join(' ') }), ...reqs.map(([k, v]) => cell({ t: `Needs ${G.cat.skills[k]} ${v}`, r: lvl(k) >= v ? '✓' : `you: ${lvl(k)}` }))),
        h('div', { style: { color: '#6d6d72', fontSize: '13px', margin: '0 4px 12px' } }, 'Apply in person at the workplace. Shifts are one real hour and pay into MoMo.'),
        at ? h('button.ibtn.wide.green', { disabled: !ok, onclick: () => { net.send({ t: 'apply', id }); win.pop(); } }, s.job ? 'Switch to this job' : 'Apply now') : h('button.ibtn.wide', { onclick: () => { act.closePhone(); act.place(c.at); } }, `Go to ${loc(c.at).name}`));
    }, { small: true });
  }
  // ------------------------------------------------------------------ Goals
  const goals = { id: 'goals', name: 'Aspirations', icon: 'target', bg: grad('#31554b', '#16382e'),
    open(win) { win.page('Your own pace', () => {
      const s = G.state, d = G.cat.allDreams[s.dream], tiers = G.cat.dreamTiers[s.dream] || [];
      return h('div', null, group(null, cell({ ic: 'compass', t: d?.name || 'A life of your choosing', s: 'Explore, work, create a home and meet other players. Aspirations are optional, with no story deadlines.' })),
        ...tiers.map((t, i) => group(null, cell({ ic: i < s.dreamTier ? 'check-circle' : 'circle', t, s: i < s.dreamTier ? 'Completed' : `Milestone · ${cedi(G.cat.tierReward[i][0])}` }))),
        h('button.ibtn.wide', { onclick: () => dreamPicker(win) }, s.dream ? 'Change aspiration' : 'Choose an aspiration'), s.dream ? h('button.ibtn.wide', { onclick: () => net.send({ t: 'pickdream', id: 'none' }) }, 'Pause aspiration') : null);
    }); } };
  function dreamPicker(win) { win.page('New dream', () => group(null, ...Object.entries(G.cat.allDreams).filter(([k]) => !G.state.dreamsDone.includes(k)).map(([k, d]) => cell({ ic: d.ic, icbg: '#f2f2f7', t: d.name, s: d.desc, onclick: () => { net.send({ t: 'pickdream', id: k }); win.pop(); } }))), { small: true }); }
  // ------------------------------------------------------------------ property & shopping
  const houses = { id: 'houses', name: 'Houses', icon: 'house-line', bg: grad('#30d158', '#0e7a4e'),
    open(win) { win.page('Houses', () => { const s = G.state; const H = G.cat.homes;
      return h('div', null, h('div', { style: { color: '#6d6d72', fontSize: '14px', margin: '0 2px 10px' } }, 'Rent is weekly (Saturday 09:00). Landlords want advance. Better homes restore more energy and impress people.'),
        h('div.group', null, ...Object.entries(H).map(([id, x]) => { const cur = s.home === id; const owned = s.owned && s.owned[id]; const adv = x.rent * (x.advance || 0);
          return cell({ ic: cur ? 'icon:key' : 'icon:house', icbg: cur ? '#34c759' : '#f2f2f7', t: x.name, s: `${cedi(x.rent)}/week · ${x.toilet} toilet · ${x.power === 'estate' ? 'estate power' : 'ECG grid'}${x.buy ? ' · buy ' + cedi(x.buy, true) : ''}`, r: cur ? 'Home' : owned ? 'Owned' : '', onclick: cur ? null : () => homePage(win, id) }); })));
    }); } };
  function homePage(win, id) {
    const x = G.cat.homes[id];
    win.page(x.name, () => { const adv = x.rent * (x.advance || 0); return h('div', null, group(null, cell({ t: 'Area', r: x.area }), cell({ t: 'Rent', r: cedi(x.rent) + '/week' }), x.advance ? cell({ t: 'Advance', r: `${x.advance} weeks · ${cedi(adv)}` }) : null, cell({ t: 'Comfort', r: 'icon:circle'.repeat(Math.round(x.comfort * 4 - 2)) }), cell({ t: 'Toilet', r: x.toilet }), cell({ t: 'Power', r: x.power === 'estate' ? 'Estate (no dumsor)' : 'ECG grid' })),
      x.advance ? h('button.ibtn.wide.green', { disabled: money() < adv, onclick: () => { net.send({ t: 'buy', kind: 'home', id }); act.closePhone(); } }, money() < adv ? `Need ${cedi(adv)}` : `Rent · pay ${cedi(adv)}`) : null,
      x.buy ? h('button.ibtn.wide', { style: { marginTop: '10px' }, disabled: money() < x.buy, onclick: () => { net.send({ t: 'buy', kind: 'home', id, buy: true }); act.closePhone(); } }, `Buy · ${cedi(x.buy)}`) : null); }, { small: true });
  }
  const cars = { id: 'cars', name: 'Cars', icon: 'car-profile', bg: grad('#5e5ce6', '#3634a3'),
    open(win) { win.page('Cars', () => { const s = G.state; return h('div', null, group('Daily rental',cell({t:s.rental?.until>accraNow()?'Toyota Vitz rental active':'Rent a Toyota Vitz',s:s.rental?.until>accraNow()?`Until ${new Date(s.rental.until).toUTCString()}`:'GH₵350 for 24 hours · pick up at Correct Cars',onclick:()=>net.send({t:'rentcar'})})), s.car ? group('Your car', cell({ ic: 'icon:circle', icbg: '#34c759', t: G.cat.cars[s.car].name, s: `Fuel ${s.fuel || 0} L`, r: '' })) : null,
      group('Correct Cars, Spintex', ...Object.entries(G.cat.cars).map(([id, c]) => { const trade = s.car ? Math.round(G.cat.cars[s.car].price * 0.6) : 0; const cost = Math.max(0, c.price - trade);
        return cell({ ic: 'icon:car', icbg: '#f2f2f7', t: c.name, s: `${cedi(c.price)}${trade ? ` · ${cedi(cost)} after trade-in` : ''} · +${c.rep} rep`, r: s.car === id ? 'Yours' : h('span.ibtn' + (money() >= cost ? '' : '.gray'), { style: { height: '32px', fontSize: '14px' } }, 'Buy'), chev: false, onclick: s.car === id ? null : () => { if (money() < cost) return act.toast(`You need ${cedi(cost)}`, 'bad'); iosConfirm(`Buy ${c.name} for ${cedi(cost)}?`).then((ok) => ok && net.send({ t: 'buy', kind: 'car', id })); } }); })),
      s.car ? h('button.ibtn.wide', { onclick: () => net.send({ t: 'buy', kind: 'fuel' }) }, 'Buy fuel · 5 L for GH₵85') : null); }); } };
  const shop = { id: 'shop', name: 'Shop', icon: 'shopping-bag-open', bg: grad('#bf5af2', '#8e2bc9'),
    open(win) { win.page('Shop', () => { const s = G.state; const IC = { gas: 'icon:fire', fridge: 'icon:circle', tv: 'icon:television', laptop: 'icon:laptop', dslr: 'icon:camera', speaker: 'icon:circle', guitar: 'icon:guitar', dumbbells: 'icon:barbell', bed: 'icon:bed', ac: 'icon:circle', gen: 'icon:circle', solar: 'icon:sun', ring: 'icon:diamond' };
      const WHY = { gas: 'Cook at home (cheap meals)', fridge: 'Food keeps longer', tv: 'Watch TV at home', laptop: 'Code side projects, freelance, startup', dslr: 'Photo gigs on Oxford St', speaker: 'DJ funerals for money', guitar: 'Practise music at home', dumbbells: 'Work out at home', bed: '+25% sleep energy', ac: 'Sleep better', gen: 'Light during dumsor', solar: 'Never worry about dumsor', ring: 'Propose to your partner' };
      return h('div', null, h('div', { style: { color: '#6d6d72', fontSize: '14px', margin: '0 2px 10px' } }, 'Delivered to your home. New furniture shows up in your room.'),
        h('div.group', null, ...Object.entries(G.cat.items).map(([id, [name, price]]) => { const own = s.items[id];
          return cell({ ic: IC[id] || 'icon:circle', icbg: '#f2f2f7', t: name, s: WHY[id] || '', r: own && id !== 'ring' ? '✓ Owned' : h('span.ibtn' + (money() >= price ? '' : '.gray'), { style: { height: '32px', fontSize: '14px' } }, cedi(price, true)), chev: false, onclick: own && id !== 'ring' ? null : () => { if (money() < price) return act.toast(`You need ${cedi(price)}`, 'bad'); net.send({ t: 'buy', kind: 'item', id }); } }); })));
    }); } };
  const invest = { id: 'invest', name: 'Invest', icon: 'chart-line-up', bg: grad('#34c759', '#248a3d'),
    open(win) { win.page('Invest', () => { const s = G.state; const B = G.cat.biz, L = G.cat.lands; const own = Object.keys(s.biz || {});
      return h('div', null, own.length ? h('button.ibtn.wide', { style: { margin: '4px 0 6px' }, onclick: () => net.send({ t: 'bizcheck' }) }, ' Call your managers') : null,
        h('div', { style: { color: '#6d6d72', fontSize: '13px', margin: '4px 2px 0' } }, 'Businesses pay daily at 18:00. Check on them every few days or the managers “chop” the money.'),
        group('Businesses', ...Object.entries(B).filter(([, b]) => !b.hidden).map(([id, b]) => cell({ ic: b.ic, icbg: '#f2f2f7', t: b.name, s: `${cedi(b.price)} · ~${cedi(b.pay)}/day`, r: s.biz[id] ? '✓ Yours' : h('span.ibtn' + (money() >= b.price ? '' : '.gray'), { style: { height: '32px', fontSize: '14px' } }, 'Buy'), chev: false, onclick: s.biz[id] ? null : () => { if (money() < b.price) return act.toast(`You need ${cedi(b.price)}`, 'bad'); iosConfirm(`Buy ${b.name} for ${cedi(b.price)}?`).then((ok) => ok && net.send({ t: 'buy', kind: 'biz', id })); } }))),
        group('Land', ...Object.entries(L).map(([id, l]) => cell({ ic: 'icon:map-trifold', icbg: '#f2f2f7', t: l.name, s: s.land[id] ? `Worth ${cedi(s.land[id].value)}${s.land[id].disputed ? ' · in court' : ''}` : `${cedi(l.price)} · grows ~${Math.round(l.g * 52 * 100)}%/yr · landguard risk`, r: s.land[id] ? '✓' : h('span.ibtn' + (money() >= l.price ? '' : '.gray'), { style: { height: '32px', fontSize: '14px' } }, 'Buy'), chev: false, onclick: s.land[id] ? null : () => { if (money() < l.price) return act.toast(`You need ${cedi(l.price)}`, 'bad'); iosConfirm(`Buy ${l.name}?`).then((ok) => ok && net.send({ t: 'buy', kind: 'land', id })); } }))));
    }); } };
  const bank = { id: 'bank', name: 'Bank', icon: 'bank', bg: grad('#64d2ff', '#0071a4'),
    open(win) { win.page('Gold Coast Bank', () => { const s = G.state; const L = s.loan;
      return h('div', null, s.flags.fixed?group('Fixed savings',cell({t:cedi(s.flags.fixed.amount),s:`Matures ${new Date(s.flags.fixed.until).toUTCString().slice(0,16)} · simulated 12% annual interest`}),cell({t:accraNow()>=s.flags.fixed.until?'Withdraw principal + interest':'Withdraw principal now',s:accraNow()<s.flags.fixed.until?'Early withdrawal earns no interest':null,onclick:()=>net.send({t:'bank',op:'withdrawFixed'})})):group('28-day fixed savings',...[100,1000,5000].map(amount=>cell({t:cedi(amount),s:'Simulated 12% annual interest · principal available for early withdrawal',onclick:()=>net.send({t:'bank',op:'fixed',amount})}))), L ? group('Your loan', cell({ t: L.lender, r: cedi(L.owed) + ' owed' }), cell({ t: 'Weekly repayment', r: cedi(L.weekly) }), cell({ t: 'Next due', r: new Date(L.next).toUTCString().slice(0, 11) })) : null,
        L ? h('button.ibtn.wide', { disabled: money() < L.owed, onclick: () => net.send({ t: 'bank', op: 'repay' }) }, `Clear loan · ${cedi(L.owed)}`) : group('Loans', ...[1000, 5000, 20000].map((a) => cell({ ic: 'icon:circle', icbg: '#0a84ff', t: `Borrow ${cedi(a)}`, s: `Repay ${cedi(Math.round(a * 1.18))} over 8 weeks · needs a job`, onclick: () => { iosConfirm(`Borrow ${cedi(a)}? You repay ${cedi(Math.round(a * 1.18))}.`).then((ok) => ok && net.send({ t: 'bank', op: 'loan', amount: a })); } }))),
        h('div', { style: { color: '#6d6d72', fontSize: '13px', margin: '8px 4px' } }, 'Missed repayments add 10% penalty. Max loan is half your net worth.'));
    }); } };
  // ------------------------------------------------------------------ people
  const forbes = { id: 'forbes', name: 'Forbes', icon: 'crown-simple', bg: grad('#2c2c2e', '#000'),
    open(win) { let rows = null; const off = net.on('forbes', (m) => { rows = m.rows; win.refresh(); }); win.onclose = off; net.send({ t: 'forbes' });
      win.page('Richest in Accra', () => !rows ? h('div.empty', null, 'Loading…') : h('div.group', null, ...rows.map((r) => cell({ ic: r.rank <= 3 ? ['icon:trophy', 'icon:circle', 'icon:circle'][r.rank - 1] : String(r.rank), icbg: r.rank <= 3 ? '#fff4cc' : '#e5e5ea', t: '@' + r.name, s: [r.job, r.car].filter(Boolean).join(' · '), r: cedi(r.worth, true), onclick: () => profilePage(win, r.name) })))); } };
  const contacts = { id: 'contacts', name: 'Contacts', icon: 'address-book', bg: grad('#a1a1a6', '#636366'),
    open(win, arg) { pickPersonContacts(win); if (arg) profilePage(win, arg); } };
  function pickPersonContacts(win) {
    let q = '', rows = []; const off = net.on('find', (m) => { rows = m.rows; win.refresh(); }); win.onclose = off;
    const input = h('input', { placeholder: 'Find a player by username', autocapitalize: 'off', oninput: (e) => { q = e.target.value; if (q.length >= 2) net.send({ t: 'find', q }); else { rows = []; win.refresh(); } } });
    win.page('Contacts', () => { const friends = Object.values(G.state.friends || {}).sort((a, b) => b.pts - a.pts); const C = G.cat.contacts;
      return h('div', null, h('div.search', null, ic('magnifying-glass'), input),
        rows.length ? group('Players', ...rows.map((r) => cell({ ic: portrait(r.look,r.name), icbg: r.online ? '#34c759' : '#8e8e93', t: '@' + r.name, s: [r.job, r.online ? 'Online now' : null].filter(Boolean).join(' · '), onclick: () => profilePage(win, r.name) }))) : null,
        friends.length ? group(`Friends (${friends.length})`, ...friends.map((f) => cell({ ic: portrait(f.look,f.n), icbg: '#ff9f0a', t: '@' + f.n, s: `${level(f.pts)} · ${f.pts} pts`, onclick: () => profilePage(win, f.n) }))) : h('div', { style: { color: '#8e8e93', fontSize: '14px', margin: '8px 4px' } }, 'Meet people at places around Accra. Tap them to chat, joke, dance — friendship grows.'));
    });
  }
  function profilePage(win, name) {
    let p = null; const off = net.on('profile', (m) => { if (m.p.name.toLowerCase() === name.toLowerCase()) { p = m.p; win.refresh(); } }); net.send({ t: 'profile', name });
    const prev = win.onclose; win.onclose = () => { off(); prev && prev(); };
    win.page('@' + name, () => { if (!p) return h('div.empty', null, 'Loading…'); if (p.fresh) return h('div.empty', null, ic('user'), 'This player is just getting started.');
      const D = G.cat.allDreams[p.dream] || {};
      return h('div', null, h('div', { style: { textAlign: 'center', margin: '6px 0 16px' } }, portrait(p.look,name,'profile-portrait'), h('div', { style: { font: '700 22px var(--disp)' } }, '@' + p.name), h('div', { style: { color: '#8e8e93' } }, p.title + (p.online ? ' ·  online' : '')), p.partner ? h('div', { style: { color: '#ff2d55', fontWeight: 600, marginTop: '4px' } }, ` with @${p.partner}`) : null),
        p.me ? null : h('div.row', { style: { gap: '8px', marginBottom: '14px' } }, h('button.ibtn.grow', { onclick: () => dmThread(win, p.name) }, ic('chat-circle-text'), 'Message'), h('button.ibtn.green.grow', { onclick: () => sendFlow(win, p.name) }, ic('paper-plane-tilt'), 'Send')),
        group(null, cell({ t: 'Net worth', r: cedi(p.worth, true) }), cell({ t: 'Job', r: p.job || 'Unemployed' }), cell({ t: 'Lives at', r: p.home }), p.car ? cell({ t: 'Drives', r: p.car }) : null, p.biz ? cell({ t: 'Businesses', r: p.biz }) : null, cell({ t: 'Dream', r: `${D.ic || ''} ${D.name || '—'} (${p.dreamTier}/5)` }), cell({ t: 'Reputation', r: p.rep }), p.me ? null : cell({ t: 'Friendship', r: `${level(p.friend)} · ${p.friend}` })),
        p.me ? null : h('div', null, p.online && p.friend >= 10 ? h('button.ibtn.wide', { style: { marginBottom: '10px' }, onclick: () => { net.send({ t: 'visit', name: p.name, mode: G.state.car ? 'car' : 'trotro' }); act.closePhone(); } }, ' Visit their house') : null,
          h('div.row', { style: { gap: '8px' } }, h('button.ibtn.gray.grow', { onclick: () => { net.send({ t: 'block', name: p.name, on: !p.blocked }); p.blocked = !p.blocked; win.refresh(); } }, p.blocked ? 'Unblock' : 'Block'), h('button.ibtn.gray.grow', { style: { color: '#ff3b30' }, onclick: () => { net.send({ t: 'report', name: p.name, reason: 'Reported from profile' }); } }, 'Report'))));
    }, { small: true });
  }
  // ------------------------------------------------------------------ me
  const life = { id: 'life', name: 'My Life', icon: 'user-circle', bg: grad('#ff6482', '#d1365a'),
    open(win) { win.page('My Life', () => { const s = G.state; 
      return h('div', null, portrait(s.look,s.name,'profile-portrait'), h('div.group', { style: { padding: '16px' } }, h('div', { style: { font: '700 24px var(--disp)' } }, s.name), h('div', { style: { color: '#8e8e93' } }, `${repTitle()} · reputation ${s.rep}`), h('div', { style: { marginTop: '4px', fontSize: '14px' } }, s.traits.map((t) => `${G.cat.traits[t].ic} ${G.cat.traits[t].name}`).join('  ·  '))),
        group('Skills', ...Object.entries(G.cat.skills).map(([k, n]) => { const v = s.skills[k] || 0; return h('div.cell.noic', null, h('div.cm', null, h('div.row', { style: { justifyContent: 'space-between' } }, h('span.c1', null, n), h('span.c2', null, `Level ${Math.floor(v)}`)), h('div.fbar', null, h('i', { style: { width: (v % 1) * 100 + '%', background: '#0a84ff' } })))); })),
        group('Stats', cell({ t: 'Total earned', r: cedi(s.stats.earned) }), cell({ t: 'Shifts worked', r: s.stats.shifts }), cell({ t: 'Gigs done', r: s.stats.gigs }), cell({ t: 'Meals eaten', r: s.stats.meals }), cell({ t: 'Home meals stored', r: s.food || 0 }), cell({ t: 'Days in Accra', r: Math.max(1, Math.ceil((accraNow() - (s.flags.bornAt || s.created)) / 864e5)) })));
    }); } };
  const health = { id: 'health', name: 'Health', icon: 'heartbeat', bg: grad('#ff453a', '#d70015'),
    open(win) { win.page('Health', () => { const s = G.state; const N = { hunger: 'Hunger', energy: 'Energy', fun: 'Fun', social: 'Social', hygiene: 'Hygiene', bladder: 'Bladder' };
      const TIP = { hunger: 'Eat at a chop bar, waakye joint, or cook at home.', energy: 'Sleep at home. Better beds restore more.', fun: 'Beach, party, TV, palm wine.', social: 'Chat with people, church, viewing centre.', hygiene: 'Bathe at home.', bladder: 'Use the toilet — don’t wait!' };
      return h('div', null, s.sick ? h('div.group', { style: { padding: '14px', background: '#fff1f0' } }, h('div', { style: { fontWeight: 700, color: '#d70015' } }, ` ${s.sick.kind} (${s.sick.level})`), h('div', { style: { fontSize: '14px', marginTop: '4px' } }, 'See a doctor: Ridge Hospital (paid) or Korle Bu (NHIS ward is free, long wait).')) : null,
        group('Needs', ...Object.entries(N).map(([k, n]) => { const v = Math.round(s.n[k] || 0); return h('div.cell.noic', null, h('div.cm', null, h('div.row', { style: { justifyContent: 'space-between' } }, h('span.c1', null, n), h('span.c2', null, v + '%')), h('div.fbar', null, h('i', { style: { width: v + '%', background: v < 20 ? '#ff3b30' : v < 50 ? '#ff9f0a' : '#34c759' } })), v < 50 ? h('div.c2', null, TIP[k]) : null)); })),
        s.moodlets && s.moodlets.length ? group('Feelings', ...s.moodlets.map(([l, v]) => cell({ t: l, r: (v > 0 ? '+' : '') + v }))) : null);
    }); } };
  // ------------------------------------------------------------------ misc
  const police = {id:'police',name:'Police',icon:'shield-check',bg:grad('#365b53','#173b34'),open(win){
    const timer=setInterval(()=>win.refresh(),1000),prev=win.onclose;win.onclose=()=>{clearInterval(timer);prev?.();};
    win.page('Police & custody',()=>{const f=G.state.flags||{},now=accraNow(),until=G.state.jail??f.jailUntil??0,held=until>now;
      return h('div',null,group(null,cell({t:held?'In custody':'No active custody',s:held?`Release in ${Math.ceil((until-now)/60000)} min`:'Your movements are unrestricted.'})),
        held?h('div',null,h('div.group',{style:{padding:'16px'}},'Custody is a game consequence. You can stay connected, message friends and play phone games.'),
          h('button.ibtn.wide',{disabled:now<(f.bailReview||0),onclick:()=>net.send({t:'jail',op:'bail'})},now<(f.bailReview||0)?`Free bail review in ${Math.ceil((f.bailReview-now)/1000)}s`:'Request free bail'),
          group('Cell activities',...[['rest','Rest'],['meal','Have a meal'],['washroom','Use washroom'],['read','Read'],['chat','Talk with cellmates']].map(([op,t])=>cell({t,onclick:()=>net.send({t:'jail',op})})))):null,
        h('div.group',{style:{padding:'16px',fontSize:'13px'}},'These game rules and fines do not describe Ghanaian legal procedure.'));
    });}};
  const civic={id:'civic',name:'Community',icon:'buildings',bg:grad('#365b53','#173b34'),open(win){let data=null;const off=net.on('ballot',m=>{data=m;win.refresh();}),timer=setInterval(()=>net.send({t:'ballot'}),15000);win.onclose=()=>{off();clearInterval(timer);};net.send({t:'ballot'});win.page('Community ballot',()=>data?h('div',null,h('div.group',{style:{padding:'16px'}},'What should the community focus on? This weekly game poll counts real player votes. You can change your choice; one vote per account.'),group(null,...data.rows.map(r=>cell({t:r.name,s:`${r.votes} votes`,r:data.mine===r.id?'Selected':'Vote',onclick:()=>net.send({t:'ballot',choice:r.id})})))):h('div.empty',null,'Loading ballot…'));}};
  const games = { id: 'games', name: 'Games', icon: 'game-controller', bg: grad('#ff9f0a', '#ff375f'), isNew: true,
    open(win,arg) { phoneGames(win,act,arg); } };
  const boutique = { id: 'boutique', name: 'Boutique', icon: 'coat-hanger', bg: grad('#ff6482', '#bf5af2'), isNew: true, open() { act.closePhone(); act.wardrobe('boutique'); } };
  const map = { id: 'map', name: 'Bolt', icon: 'navigation-arrow', bg: grad('#3a3a3c', '#111'), open() { act.closePhone(); act.nav('map'); } };
  const settings = { id: 'settings', name: 'Settings', icon: 'gear-six', bg: grad('#8e8e93', '#636366'), dock: true,
    open(win) { win.page('Settings', () => { const f = G.state.flags || {};
      return h('div', null, group(null, h('label.cell.noic', null, h('div.cm', null, h('div.c1', null, 'Romance'), h('div.c2', null, 'Allow flirting and dating requests')), h('input', { type: 'checkbox', checked: !f.flirtOff, style: { width: '24px', height: '24px' }, onchange: (e) => { net.send({ t: 'settings', flirtOff: !e.target.checked }); f.flirtOff = !e.target.checked; } }))),
        group(null, cell({ ic: 'megaphone', icbg: '#ff9f0a', t: 'Advertise your business', s: 'Put your brand on billboards across Accra', onclick: () => window.open('/advertise.html', '_blank') }), cell({ ic: 'question', icbg: '#0a84ff', t: 'How to play', onclick: () => win.phone.openApp('help') }), cell({ ic: 'shield-check', icbg: '#34c759', t: 'Safety', s: 'Never trade game money for real money. Report anyone who asks for nudes, money or personal info.' })),
        group(null, cell({ t: h('span', { style: { color: '#ff3b30' } }, 'Log out'), onclick: () => act.logout(), chev: false })), h('div', { style: { color: '#8e8e93', fontSize: '12px', textAlign: 'center' } }, 'Accra We Dey · 18+ · v2'));
    }); } };
  const help = { id: 'help', name: 'Help', icon: 'lifebuoy', bg: grad('#0a84ff', '#0040dd'),
    open(win) { win.page('How to play', () => h('div', null, h('button.ibtn.wide', { onclick: () => act.tutorial() }, 'Start the quick tour'), ...[['Your needs', 'The six rings at the top are Hunger, Energy, Fun, Social, Hygiene and Bladder. Keep them up or bad things happen (fainting, falling sick, public disgrace).'], ['Places', 'Open the Map, tap a place, choose a trotro, okada or taxi. Each place has zones along the bottom — tap one to see what you can do there.'], ['Money', 'Street hustles pay small and get tired. A job pays per 1-hour shift (real time) and promotions raise it. Businesses and land grow wealth over weeks.'], ['People', 'Tap other players to chat, joke, dance. Friendship unlocks more. Send money and messages from your phone.'], ['Free play', 'There is no scripted storyline. Choose your own work, friends, home and optional aspirations. City chat reaches everyone; Nearby reaches your room.'], ['Rent', 'Rent is due every Saturday 09:00. Two missed weeks and you are out.']].map(([t, d]) => h('div.group', { style: { padding: '14px' } }, h('div', { style: { fontWeight: 700, marginBottom: '4px' } }, t), h('div', { style: { fontSize: '15px', color: '#3a3a3c' } }, d))))); } };
  const ads = { id: 'ads', name: 'My Ads', icon: 'presentation-chart', bg: grad('#ffd60a', '#ff9f0a'), isNew: true, open(win) { win.page('My Ads', () => h('div', null, h('div.group', { style: { padding: '16px' } }, h('div', { style: { fontWeight: 700, fontSize: '17px' } }, 'Advertise in Accra We Dey'), h('div', { style: { fontSize: '15px', color: '#3a3a3c', margin: '6px 0 12px' } }, 'Your artwork on billboards across the city map. Ads rotate every 15 seconds on shared boards; airport boards are exclusive. Pay with MoMo or card.'), h('button.ibtn.wide', { onclick: () => window.open('/advertise.html', '_blank') }, 'Book a billboard')))); } };
  return [messages, momo, gist, jobs, goals, games, boutique, houses, cars, shop, invest, bank, forbes, contacts, life, health, police, civic, map, ads, help, settings].map((a) => ({ ...a, dock: ['messages', 'momo', 'gist', 'jobs'].includes(a.id) }));
}
