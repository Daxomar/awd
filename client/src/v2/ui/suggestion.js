// Suggestion / feature request modal and gentle prompt popup.
import { h, ic, sheet, closeSheets } from './dom.js';
import { net } from '../net.js';

export const CATEGORIES = [
  ['feature', '✨ New Feature', 'Ideas for new gameplay or mechanics'],
  ['improvement', '🛠️ Improvement', 'Changes to make existing features better'],
  ['world', '🏙️ Map & Places', 'New locations, buildings or atmosphere'],
  ['quest', '📖 Story & Jobs', 'Missions, gigs or life aspirations'],
  ['other', '💬 General Feedback', 'Anything else on your mind']
];

export function openSuggestionModal(act) {
  closeSheets();
  let category = 'feature';
  let sending = false;

  const desc = h('p.context-hint', null, 'Help build Accra We Dey! Tell the developers what you want improved, what new features you want, or ideas you have.');

  const cats = h('div.suggestion-cats', { role: 'radiogroup', 'aria-label': 'Suggestion category' },
    ...CATEGORIES.map(([id, label]) => {
      return h('button.suggestion-cat' + (id === category ? '.on' : ''), {
        type: 'button',
        role: 'radio',
        'aria-checked': String(id === category),
        onclick: () => {
          category = id;
          cats.querySelectorAll('.suggestion-cat').forEach(b => {
            b.classList.toggle('on', b.dataset.cat === category);
            b.setAttribute('aria-checked', String(b.dataset.cat === category));
          });
        },
        'data-cat': id
      }, label);
    })
  );

  const counter = h('span.suggestion-count', null, '0 / 500');
  const textarea = h('textarea.suggestion-input', {
    placeholder: 'Write what you would love to see improved or added in Accra We Dey…',
    maxLength: 500,
    rows: 4,
    'aria-label': 'Suggestion text',
    oninput: () => {
      counter.textContent = `${textarea.value.length} / 500`;
    }
  });

  const error = h('p.context-error', { role: 'alert', hidden: true });
  const status = h('p.context-state', { role: 'status' });
  const submitBtn = h('button.btn.primary.wide', {
    type: 'submit',
    onclick: (e) => {
      e.preventDefault();
      if (sending) return;
      const text = textarea.value.trim();
      if (text.length < 5) {
        error.hidden = false;
        error.textContent = 'Please write at least a few words (5 characters) for your suggestion.';
        return;
      }
      sending = true;
      error.hidden = true;
      submitBtn.disabled = true;
      status.textContent = 'Sending your suggestion…';

      const offAck = net.on('suggestion_ack', () => {
        offAck();
        clearTimeout(timer);
        sending = false;
        status.textContent = 'Thank you! Your suggestion has been sent to our team.';
        try { localStorage.setItem('awd_suggest_submitted', String(Date.now())); } catch {}
        setTimeout(() => {
          sh.close();
        }, 1500);
      });

      const timer = setTimeout(() => {
        offAck();
        sending = false;
        submitBtn.disabled = false;
        status.textContent = '';
        error.hidden = false;
        error.textContent = 'Could not confirm delivery. Check your connection and try again.';
      }, 8000);

      net.send({ t: 'suggestion', category, text });
    }
  }, ic('paper-plane-right'), ' Submit suggestion');

  const form = h('form.suggestion-form', { onsubmit: (e) => e.preventDefault() },
    desc,
    h('label.suggestion-label', null, 'Category'),
    cats,
    h('div.suggestion-field-head', null, h('label.suggestion-label', null, 'Your suggestion'), counter),
    textarea,
    error,
    status,
    submitBtn
  );

  const sh = sheet(h('div.sheet-body', null, form), {
    title: 'Suggest an improvement or feature',
    sub: 'Shape the future of Accra We Dey'
  });

  setTimeout(() => textarea.focus(), 150);
  return sh;
}

export function promptSuggestionPopup(act) {
  closeSheets();
  const body = h('div.sheet-body.suggestion-prompt', null,
    h('p', null, 'We want to make Accra We Dey the best experience possible for you. What features do you want to see? What should be improved or added?'),
    h('button.btn.primary.wide', {
      onclick: () => {
        try { localStorage.setItem('awd_suggest_prompt_seen', String(Date.now())); } catch {}
        openSuggestionModal(act);
      }
    }, ic('lightbulb'), ' Share a suggestion'),
    h('button.btn.ghost.wide', {
      onclick: () => {
        try { localStorage.setItem('awd_suggest_prompt_seen', String(Date.now())); } catch {}
        sh.close();
      }
    }, 'Maybe later')
  );

  const sh = sheet(body, {
    title: '💡 What would you like to see?',
    sub: 'Player ideas & feedback'
  });
  return sh;
}

export function checkSuggestionPrompt(act) {
  try {
    const lastSeen = Number(localStorage.getItem('awd_suggest_prompt_seen') || 0);
    const submitted = Number(localStorage.getItem('awd_suggest_submitted') || 0);
    const now = Date.now();
    // Prompt if never seen or after 14 days if not submitted
    if (!lastSeen || (!submitted && now - lastSeen > 14 * 86400000)) {
      setTimeout(() => {
        if (!document.querySelector('.sheet-back') && !document.querySelector('.auth')) {
          promptSuggestionPopup(act);
        }
      }, 45000);
    }
  } catch {}
}
