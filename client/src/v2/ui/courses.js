// Stage 5 course screens: a short scenario assessment graded by the server.
import { h, sheet, cedi, closeSheets } from './dom.js';
import { G, loc } from '../store.js';
import { net } from '../net.js';

export const coursesAt = (place) => Object.values(G.cat.courses || {}).filter((c) => c.at === place);
export const certified = (id) => !!G.state.certs?.[id]?.passedAt;

// Why a career rank is locked and what to do next (courses first, then skills).
export function careerNeeds(careerId, rank) {
  const ids = G.cat.careerReqs?.[careerId]?.[rank] || [];
  return ids.filter((id) => !certified(id)).map((id) => G.cat.courses[id]);
}

export function openCourseList(place, act) {
  const list = coursesAt(place);
  sheet(h('div.sheet-body', null,
    h('p', null, 'Short courses with a quick assessment. Certificates unlock careers and promotions. Course content is fictional training for this game.'),
    ...list.map((c) => h('button.btn.wide' + (certified(c.id) ? '' : '.primary'), { onclick: () => { closeSheets(); openCourse(c.id, act); } },
      `${certified(c.id) ? '✓ ' : ''}${c.name} · ${c.cost ? cedi(c.cost) : 'Free'}`))), { title: 'Courses here', sub: loc(place)?.name });
}

export function openCourse(id, act) {
  const c = G.cat.courses?.[id]; if (!c) return;
  const rec = G.state.certs?.[id] || {}, here = G.state.place === c.at, answers = c.questions.map(() => null);
  const status = h('p.context-hint', { role: 'status' });
  const requires = (c.requires || []).filter((r) => !certified(r)).map((r) => G.cat.courses[r].name);
  const submit = h('button.btn.primary.wide', { disabled: true }, rec.paid || !c.cost ? 'Submit answers' : `Pay ${cedi(c.cost)} and submit`);
  const refresh = () => { submit.disabled = !here || answers.some((a) => a === null) || certified(id); };
  const body = h('div.sheet-body', null,
    h('p', null, c.objective),
    h('p.muted', null, `${c.cost ? `Fee ${cedi(c.cost)} (paid once; retries are free)` : 'Free'} · pass with ${c.pass} of ${c.questions.length} · retry after 10 minutes`),
    requires.length ? h('p.context-hint', null, `First complete: ${requires.join(', ')}.`) : null,
    certified(id) ? h('p.context-hint', null, `✓ Certificate earned. Score ${rec.lastScore}/${c.questions.length}.`) : null,
    rec.retryAt > Date.now() ? h('p.context-hint', null, `Retry available after ${new Date(rec.retryAt).toLocaleTimeString()}.`) : null,
    ...c.questions.map((q, i) => h('fieldset.course-q', null, h('legend', null, `${i + 1}. ${q.prompt}`),
      ...q.choices.map((choice, j) => h('label.course-choice', null, h('input', { type: 'radio', name: `${id}-${i}`, value: j, onchange: () => { answers[i] = j; refresh(); } }), h('span', null, choice))))),
    here ? submit : h('button.btn.wide', { onclick: () => { closeSheets(); act.closePhone?.(); act.place(c.at); } }, `Go to ${loc(c.at)?.name || 'the course'} to take it`),
    status);
  submit.onclick = () => { if (submit.disabled) return; submit.disabled = true; status.textContent = 'Marking…'; net.send({ t: 'course', id, answers }); };
  const off = [net.on('course_result', (m) => {
    if (m.id !== id) return; if (m.state) { G.state = m.state; act.refresh?.(); }
    status.textContent = m.passed ? `Passed ${m.score}/${m.of}. Certificate saved.` : `Scored ${m.score}/${m.of}. Review the objective and retry after 10 minutes.`;
  }), net.on('toast', (m) => { if (m.k === 'bad' && status.textContent === 'Marking…') { status.textContent = m.m; refresh(); } })];
  sheet(body, { title: c.name, sub: loc(c.at)?.name, tall: true, onclose: () => off.forEach((f) => f()) });
}
