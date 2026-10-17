// Sign up / log in over a live 3D backdrop. 18+ only.
import { h, ic } from './dom.js';

export function authScreen(ui) {
  return new Promise((resolve) => {
    let mode = 'signup';
    const err = h('div.err'); const u = h('input', { autocomplete: 'username', autocapitalize: 'off', maxLength: 16, placeholder: 'e.g. kofi_boateng' }); const p = h('input', { type: 'password', autocomplete: 'new-password', maxLength:128, placeholder: 'At least 12 characters' });
    const dob = h('input', { type: 'date', max: new Date(Date.now() - 18 * 365.25 * 864e5).toISOString().slice(0, 10) }); const agree = h('input', { type: 'checkbox' });
    const dobF = h('div.field', null, h('label', null, 'Date of birth'), dob); const agreeF = h('label.check', null, agree, h('span', null, 'I am 18 or older and I agree to play fair: no harassment, no scams, no selling game money. ', h('a', {href: '/privacy.html', target: '_blank', rel: 'noopener'}, 'Privacy and community rules')));
    const btn = h('button.btn.primary.wide', { type: 'submit' }, 'Start my Accra life');
    const tabs = h('div.tabs', null, h('button.on', { type: 'button', onclick: () => set('signup') }, 'New here'), h('button', { type: 'button', onclick: () => set('login') }, 'I have an account'));
    const set = (m) => { mode = m; tabs.children[0].classList.toggle('on', m === 'signup'); tabs.children[1].classList.toggle('on', m === 'login'); dobF.hidden = agreeF.hidden = m === 'login'; btn.textContent = m === 'signup' ? 'Start my Accra life' : 'Log in'; p.autocomplete = m === 'signup' ? 'new-password' : 'current-password'; err.textContent = ''; };
    const form = h('form.card', { onsubmit: async (e) => { e.preventDefault(); err.textContent = ''; btn.disabled = true;
      try { const body = mode === 'signup' ? { username: u.value.trim(), password: p.value, dob: dob.value, agree: agree.checked } : { username: u.value.trim(), password: p.value };
        const r = await fetch('/api/' + mode, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal:AbortSignal.timeout(15000) }).then((x) => x.json());
        if (r.error) { err.textContent = r.error; btn.disabled = false; return; }
        try { localStorage.removeItem('awd_token'); } catch {} p.value=''; el.remove(); resolve('cookie');
      } catch { err.textContent = 'Network problem. Try again.'; btn.disabled = false; } } },
      tabs, h('div.field', null, h('label', null, 'Username'), u), h('div.field', null, h('label', null, 'Password'), p), dobF, agreeF, err, btn);
    const el = h('div.screen.auth', null, h('div.logo', null, 'Accra', h('span', null, 'We Dey.')), h('div.logo-sub', null, 'Your neighbourhood. Your people. Your Accra. A shared city to make your own.'), form);
    ui.append(el);
  });
}
