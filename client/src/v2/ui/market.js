// Circle's Tiptoe Lane phone market: today's prices on the tables, your bag of phones, test / fix / flip.
import { h, sheet, cedi, vibrate } from './dom.js';
import { G } from '../store.js';

export function openPhoneMarket(net, act) {
  let data = null, test = true;
  const body = h('div.sheet-body.pm');
  const off = net.on('phones', (m) => { data = m; if (m.state) { G.state = m.state; act.refresh(); } if (m.msg) { act.toast(m.msg, m.k); vibrate(m.k === 'bad' ? [30, 40, 30] : 12); } draw(); });
  const s = sheet(body, { title: 'Tiptoe Lane phones', sub: 'Circle · buy UK-used, test it, fix it, flip it', tall: true, onclose: off });
  net.send({ t: 'phone', op: 'board' });
  const send = (o) => net.send({ t: 'phone', ...o });
  function draw() {
    body.innerHTML = '';
    if (!data) return body.append(h('div.muted', null, 'Checking the tables…'));
    const there = G.state.place === 'circle'; const money = (G.state.cash || 0) + (G.state.momo || 0);
    body.append(h('div.pm-tip', null, h('b', null, 'How Circle works: '), 'buy low on the tables, pay the fitter to fix the screen, sell when the price is high. Prices change every day. Untested phones are cheaper, but some boxes have soap inside.'));
    body.append(h('label.pm-test', null, h('input', { type: 'checkbox', checked: test, onchange: (e) => { test = e.target.checked; draw(); } }), h('span', null, 'Pay the tester ', h('b', null, cedi(20)), ' before buying')));
    body.append(h('div.section', null, 'On the tables today'));
    const rows = h('div.pm-list');
    for (const [k, b] of Object.entries(data.board)) {
      const cost = b.buy + (test ? 20 : 0); const margin = Math.round(((b.sell * 0.835 - cost) / cost) * 100);
      rows.append(h('div.pm-row', null, h('div.pm-ic', null, b.ic), h('div.grow', null, h('div.pm-nm', null, b.name, b.hot ? h('span.pm-hot', null, ' Demand') : null), h('div.pm-sub', null, `Table ${cedi(b.buy)} · resale up to ${cedi(b.sell)}`, h('span.' + (margin >= 0 ? 'up' : 'down'), null, ` ${margin >= 0 ? '+' : ''}${margin}%`))),
        h('button.btn.sm' + (money >= cost && there ? '.primary' : ''), { disabled: !there || money < cost || data.stock.length >= 4, onclick: () => send({ op: 'buy', m: k, test }) }, `Buy ${cedi(cost)}`)));
    }
    body.append(rows);
    body.append(h('div.section', null, `Your bag · ${data.stock.length}/4`));
    if (!data.stock.length) body.append(h('div.muted.pm-empty', null, 'No phones yet. Buy one on the tables, fix it, then sell it back for profit.'));
    for (const ph of data.stock) { const b = data.board[ph.m]; const fixCost = Math.round(({ button: 90, spork: 950, hot: 1350, galaxi: 1900, ifone11: 3300, ifone13: 7900 }[ph.m] || 1000) * 0.08); const pr = ph.value - ph.paid;
      body.append(h('div.pm-row.mine', null, h('div.pm-ic', null, b.ic), h('div.grow', null, h('div.pm-nm', null, b.name, ph.fixed ? h('span.pm-ok', null, 'Fixed') : null),
        h('div.pm-cond', null, h('i', { style: { width: ph.cond + '%', background: ph.cond > 75 ? 'var(--green)' : ph.cond > 55 ? 'var(--gold)' : '#d64545' } })), h('div.pm-sub', null, `${ph.cond}% condition · paid ${cedi(ph.paid)} · `, h('span.' + (pr >= 0 ? 'up' : 'down'), null, `${pr >= 0 ? '+' : ''}${cedi(pr)}`))),
        h('div.pm-acts', null, ph.fixed ? null : h('button.btn.sm.ghost', { disabled: !there, onclick: () => send({ op: 'fix', id: ph.id }) }, `Fix ${cedi(fixCost)}`), h('button.btn.sm.gold', { disabled: !there, onclick: () => send({ op: 'sell', id: ph.id }) }, `Sell ${cedi(ph.value)}`)))); }
    if (!there) body.append(h('div.pm-tip.warn', null, 'You are not at Circle. Travel there to trade.'));
  }
  draw(); return s;
}
