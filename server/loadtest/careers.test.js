// Stage 5 Career System 2.0: qualifications, courses, compressed sessions and auto-work.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game/rules.js';
import * as Career from '../src/game/careers.js';
import {currentTask} from '../src/game/work-tasks.js';
import {WORKPLACES} from '../../shared/workplaces.js';

const DAY = 86400000, NOON = Date.UTC(2026, 9, 14, 12);   // a Wednesday
function player(place = 'circle') {
  const s = Game.newState({id: 77, u: 'careerqa'});
  Object.assign(s, {onboarded: true, home: 'nima', cash: 2000, momo: 3000, rentPaidUntil: NOON + 30 * DAY, needsAt: NOON, lastDaily: Game.clock(NOON).day, lastWeekly: Math.floor((NOON / DAY + 3) / 7)});
  const p = {state: s, rx: null, rz: null}; Game.goPlace(p, place); return p;
}
const wallet = p => p.state.cash + p.state.momo;
const answersFor = id => Career.COURSES[id].questions.map(([, , right]) => right);
const send = (p, msg, now = NOON) => Game.onMsg(p, msg, {policy: null}, now);

test('all 19 careers have explicit requirements with free entry routes and gated senior roles', () => {
  const careers = Object.keys(Game.catalog().careers);
  assert.equal(careers.length, 19);
  for (const id of careers) assert.ok(Career.CAREER_REQS[id], id);
  const open = careers.filter(id => !Career.CAREER_REQS[id][0] && !Game.DATA.CAREERS[id].req);
  assert.ok(open.length >= 5, 'several entry jobs need no course');
  for (const [career, ranks] of Object.entries(Career.CAREER_REQS)) for (const ids of Object.values(ranks)) for (const id of ids) {
    const c = Career.COURSES[id]; assert.ok(c, `${career} → ${id}`);
    assert.ok(Game.LOC[c.at], `${id} runs at an existing location`);
  }
  for (const id of ['finlit', 'custserv', 'techfund', 'foodsafe', 'roadsafe', 'safety', 'office', 'wardcare']) assert.equal(Career.COURSES[id].cost, 0, `${id} is free`);
  assert.deepEqual(Career.CAREER_REQS.tech[4], ['lead'], 'CTO needs leadership');
  assert.equal(Career.COURSES.lead.experienceRank, 2, 'leadership needs real experience');
  const cat = Game.catalog();
  assert.ok(Object.values(cat.courses).every(c => c.questions.every(q => Object.keys(q).join() === 'prompt,choices')), 'answers never reach the client');
});

test('a new player cannot walk into banking; the guided course route qualifies them', () => {
  const p = player('bank'); p.state.skills.charisma = 2;   // banking's existing skill requirement
  const refused = send(p, {t: 'apply', id: 'bank'});
  assert.equal(refused.t, 'toast'); assert.match(refused.m, /Basic Financial Literacy.*Customer Service.*Teller Training/);
  assert.match(send(p, {t: 'course', id: 'teller', answers: answersFor('teller')}).m, /Basic Financial Literacy first/);
  assert.match(send(p, {t: 'course', id: 'finlit', answers: answersFor('finlit')}).m, /Courses run at/);
  Game.goPlace(p, 'ug');
  for (const id of ['finlit', 'custserv']) assert.equal(send(p, {t: 'course', id, answers: answersFor(id)}).passed, true);
  Game.goPlace(p, 'bank');
  const before = wallet(p);
  const fail = send(p, {t: 'course', id: 'teller', answers: [2, 0, 0]});
  assert.equal(fail.passed, false); assert.equal(wallet(p), before - 60, 'fee charged once at enrolment');
  assert.match(send(p, {t: 'course', id: 'teller', answers: answersFor('teller')}, NOON + 60000).m, /retry in/);
  const pass = send(p, {t: 'course', id: 'teller', answers: answersFor('teller')}, NOON + 11 * 60000);
  assert.equal(pass.passed, true); assert.equal(wallet(p), before - 60, 'no second fee on retry');
  assert.match(send(p, {t: 'course', id: 'teller', answers: answersFor('teller')}).m, /already hold/);
  for (const bad of [null, [0], [0, 0, 9], ['0', 0, 0], [0.5, 0, 0]]) assert.equal(send(p, {t: 'course', id: 'custserv', answers: bad}).t, 'toast');
  assert.equal(send(p, {t: 'apply', id: 'bank'}, NOON + 12 * 60000).t, 'hired');
});

test('an active work session takes about three minutes, pays the existing shift wage once per day', () => {
  const p = player('hub'), s = p.state; s.certs = {techfund: {passedAt: 1}};
  assert.equal(send(p, {t: 'apply', id: 'tech'}).t, 'hired');
  const w = WORKPLACES.tech; p.rx = w.x; p.rz = w.z;
  const before = wallet(p);
  assert.equal(send(p, {t: 'work', op: 'start'}).t, 'shift');
  let now = NOON;
  for (let i = 0; i < 3; i++) {
    const task = currentTask(s); assert.ok(task, `assignment ${i} is ready immediately`);
    assert.equal(send(p, {t: 'work', op: 'beginTask', id: task.id, choice: task.best}, now).t, 'worktask');
    now += task.seconds * 1000 + 500; Game.tick(p, now, {policy: null});
  }
  assert.equal(s.shift, null, 'the session ends after three assignments');
  const minutes = (now - NOON) / 60000;
  assert.ok(minutes >= 2 && minutes <= 5, `session took ${minutes.toFixed(1)} real minutes`);
  assert.equal(wallet(p) - before, Math.round(150 * 1.15), 'existing GH₵150 intern wage with the all-correct bonus');
  assert.equal(s.job.shifts, 1); assert.ok(s.job.perf > 60, 'performance reflects a whole shift');
  assert.equal(send(p, {t: 'work', op: 'start'}, now + 1000).t, 'toast', 'no second paid session the same day');
  Game.tick(p, now + 2000, {policy: null}); assert.equal(wallet(p) - before, 173);
});

test('auto-work settles bounded, cheaper and slower shifts and never duplicates a day', () => {
  const p = player('hub'), s = p.state; s.certs = {techfund: {passedAt: 1}};
  send(p, {t: 'apply', id: 'tech'});
  assert.equal(send(p, {t: 'autowork', enabled: true, mode: 'trotro', maxSpend: 100}).t, 'st');
  assert.equal(s.autowork.enabled, true); assert.equal(s.autowork.maxSpend, 100);
  Game.tick(p, NOON + 60000, {policy: null});
  assert.equal(s.autowork.results.length, 0, 'nothing settles before the work window closes');
  const evening = Date.UTC(2026, 9, 14, 22, 30);
  const out = Game.tick(p, evening, {policy: null});
  const r = s.autowork.results[0];
  assert.equal(r.status, 'worked'); assert.ok(r.fare > 0 && r.fare <= 100);
  assert.equal(r.wage, Math.round(150 * Career.AUTO.payShare));
  const autoLedger = () => s.ledger.filter(([, , why]) => /auto-shift|Auto-work transport/.test(why)).reduce((n, [, amt]) => n + amt, 0);
  assert.equal(autoLedger(), r.wage - r.fare, 'wage and fare are journaled');
  assert.equal(s.job.shifts, 0.5, 'auto shifts progress more slowly');
  assert.ok(JSON.stringify(out).includes('autowork_done'));
  Game.tick(p, evening + 60000, {policy: null}); Game.tick(p, evening + 3600000, {policy: null});
  assert.equal(autoLedger(), r.wage - r.fare, 'the same day never settles twice');

  // Ten days offline: catch-up is capped at three days and skips the career's days off.
  const back = evening + 10 * DAY, auto10 = autoLedger();
  Game.tick(p, back, {policy: null});
  assert.equal(s.autowork.results.length, 4, 'one earlier day plus at most three catch-up days');
  assert.ok(s.autowork.results.slice(0, 3).every(x => x.day > Game.clock(back).day - 3));
  assert.ok(autoLedger() - auto10 <= 3 * 105, 'catch-up pays at most three auto shifts');

  // Fare limits and an actively worked day are respected.
  s.autowork.maxSpend = 1;
  Game.tick(p, back + DAY, {policy: null});
  assert.match(s.autowork.results[0].status, /over your GH₵1 limit|day off/);
  s.autowork.maxSpend = 100; s.job.lastDay = Game.clock(back + 2 * DAY).day;
  Game.tick(p, back + 2 * DAY, {policy: null});
  assert.match(s.autowork.results[0].status, /worked this day yourself|day off/);
  // Working actively today must not cancel auto shifts owed for earlier days.
  const today = Game.clock(back + 5 * DAY).day; s.job.lastDay = today; s.autowork.lastDay = today - 3;
  Game.tick(p, back + 5 * DAY, {policy: null});
  const recent = s.autowork.results.filter(x => x.day > today - 3);
  assert.ok(recent.filter(x => x.day < today).every(x => !/yourself/.test(x.status)), 'earlier days still settle after an active shift today');
  assert.match(recent.find(x => x.day === today).status, /yourself/, 'today itself is not paid twice');
  assert.equal(send(p, {t: 'autowork', enabled: false}).t, 'st'); assert.equal(s.autowork.enabled, false);
  const off = s.autowork.results.length; Game.tick(p, back + 3 * DAY, {policy: null}); assert.equal(s.autowork.results.length, off, 'disabled auto-work settles nothing');
  assert.equal(Career.cleanAutowork({enabled: true, maxSpend: 999999, mode: 'car'}, Game.DATA.TRANSPORT).maxSpend, Career.AUTO.maxSpendCap);
  assert.equal(Career.cleanAutowork({enabled: true, mode: 'car'}, Game.DATA.TRANSPORT).mode, 'trotro', 'auto-work never drives a car it may not own');
});
