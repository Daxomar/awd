// Stage 11 admin console helpers. All text goes in through textContent (never innerHTML), so names, report text and
// campaign titles written by players cannot inject markup.
export function h(tag, attrs = {}, ...kids) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}
export const cedi = n => (n == null || n === '' ? '—' : 'GH₵' + Math.round(Number(n)).toLocaleString('en-GH'));
export const pesewas = n => cedi(Number(n || 0) / 100);
export const num = n => (n == null ? '—' : Number(n).toLocaleString('en-GH'));
export const when = t => (t ? new Date(typeof t === 'string' && /^\d+$/.test(t) ? +t : t).toLocaleString() : '—');
export const day = t => (t ? new Date(t).toLocaleDateString() : '—');
export const tag = (text, kind = 'mute') => h('span.tag.' + kind, {text});

export function table(cols, rows, empty = 'Nothing to show.') {
  if (!rows.length) return h('div.empty', {text: empty});
  return h('div.scroll', {}, h('table.table', {},
    h('thead', {}, h('tr', {}, cols.map(c => h('th', {class: c.num ? 'num' : null, scope: 'col', text: c.label})))),
    h('tbody', {}, rows.map(r => h('tr', {}, cols.map(c => { const v = c.get(r); return h('td', {class: c.num ? 'num' : null}, v instanceof Node ? v : String(v ?? '—')); }))))));
}
export function pager(data, go) {
  const pages = Math.max(1, Math.ceil((data.total || 0) / (data.limit || 25)));
  return h('div.pager', {}, `Page ${data.page} of ${pages} · ${num(data.total)} total`,
    h('button.btn.ghost.small', {disabled: data.page <= 1, onclick: () => go(data.page - 1)}, 'Previous'),
    h('button.btn.ghost.small', {disabled: data.page >= pages, onclick: () => go(data.page + 1)}, 'Next'));
}
export const metric = (value, label, detail, hero = false) => h('div.metric' + (hero ? '.hero' : ''), {}, h('div.v', {text: value}), h('div.k', {text: label}), detail ? h('div.d', {text: detail}) : null);

// Sensitive operations go through this dialog: it always asks for a reason, and for a password when the server requires one.
export function confirmAction({title, text, fields = [], danger = false, password = false}) {
  const dlg = document.getElementById('confirm'), box = document.getElementById('cFields'), msg = document.getElementById('cMsg');
  document.getElementById('cTitle').textContent = title; document.getElementById('cText').textContent = text || '';
  msg.textContent = ''; box.textContent = '';
  const inputs = {};
  for (const f of [...fields, {name: 'reason', label: 'Reason (recorded in the audit log)', type: 'textarea', min: 5}, ...(password ? [{name: 'password', label: 'Your password', type: 'password'}] : [])]) {
    const el = f.type === 'textarea' ? h('textarea', {name: f.name, maxlength: 500, required: true}) : f.type === 'select'
      ? h('select', {name: f.name}, f.options.map(([v, t]) => h('option', {value: v, selected: f.value !== undefined && String(v) === String(f.value), text: t})))
      : h('input', {name: f.name, type: f.type || 'text', required: f.required !== false, min: f.minValue, max: f.maxValue, value: f.value, autocomplete: f.type === 'password' ? 'current-password' : 'off'});
    inputs[f.name] = {el, f}; box.append(h('label', {}, f.label, el));
  }
  const go = document.getElementById('cGo'); go.className = 'btn' + (danger ? ' danger' : '');
  return new Promise(resolve => {
    const done = () => {
      if (dlg.returnValue !== 'go') return resolve(null);
      const out = {};
      for (const [k, {el, f}] of Object.entries(inputs)) out[k] = f.type === 'number' ? Number(el.value) : el.value;
      if ((out.reason || '').trim().length < 5) { msg.textContent = 'Give a reason of at least 5 characters.'; dlg.returnValue = ''; dlg.showModal(); dlg.addEventListener('close', done, {once: true}); return; }
      resolve(out);
    };
    dlg.returnValue = ''; dlg.addEventListener('close', done, {once: true}); dlg.showModal();
    (Object.values(inputs)[0]?.el || go).focus();
  });
}

// API client: the CSRF token from the session goes on every write; a 401 means the session ended.
export const api = {
  csrf: null, onSignedOut: () => {},
  async call(path, {method = 'GET', body, query} = {}) {
    const url = path + (query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)) : '');
    let res;
    try {
      res = await fetch(url, {method, credentials: 'same-origin', cache: 'no-store',
        headers: method === 'GET' ? {} : {'content-type': 'application/json', 'x-admin-csrf': api.csrf || ''}, body: body ? JSON.stringify(body) : undefined});
    } catch { return {error: 'The server could not be reached. Check your connection and try again.'}; }
    if (res.status === 401 && !path.endsWith('/session')) { api.onSignedOut('Your admin session ended. Sign in again.'); return {error: 'Signed out.'}; }
    if (res.status === 429) return {error: 'Too many requests. Wait a minute and try again.'};
    let data; try { data = await res.json(); } catch { data = {}; }
    if (!res.ok && !data.error) data.error = `The server could not complete this (${res.status}).`;
    return data;
  },
  get: (path, query) => api.call(path, {query}),
  post: (path, body) => api.call(path, {method: 'POST', body}),
};
