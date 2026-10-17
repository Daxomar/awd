// Stage 5: Career System 2.0 — courses, qualifications, compressed work sessions and
// bounded auto-work. Pure rules on a player state; callers persist through the existing
// durable game transaction. Course content is original and fictional: no real-world
// professional certification is claimed or conferred.

// ---------- time compression (documented model) ----------
// One fictional 8-hour shift == one active work session of the career's three workplace
// assignments (about 3–4 real minutes) == one paid shift per real calendar day, the same
// daily cap as before. Salary values are unchanged (see docs/master/stage5/salary-proposal.md).
export const SESSION = Object.freeze({tasks: 3, taskSeconds: [40, 55, 70], legacyMinutes: 60});
export const AUTO = Object.freeze({payShare: 0.7, perf: 4, shiftCredit: 0.5, catchUpDays: 3, maxSpendCap: 500, results: 10});

// ---------- courses ----------
// q: [prompt, [choices], correct index]. Answers never leave the server.
const C = (id, name, at, cost, objective, q, extra = {}) => ({id, name, at, cost, objective, questions: q, pass: q.length - 1, cooldownMin: 10, ...extra});
export const COURSES = Object.freeze(Object.fromEntries([
  C('finlit', 'Basic Financial Literacy', 'ug', 0, 'Read a simple budget and recognise safe money habits.', [
    ['Ama earns GH₵400 a week and spends GH₵420. What should she review first?', ['Her largest regular expenses', 'Borrowing to cover the gap every week', 'Nothing; it is close enough'], 0],
    ['A stranger texts that your account is blocked and asks for your PIN. You…', ['Send the PIN quickly', 'Ignore it and contact your bank through official channels', 'Reply asking who they are'], 1],
    ['Why keep an emergency fund?', ['To cover unexpected costs without new debt', 'To lend to friends', 'To pay for luxuries'], 0],
  ]),
  C('custserv', 'Customer Service Essentials', 'ug', 0, 'Handle a busy counter politely and record problems properly.', [
    ['A customer is upset about a long queue. The best first step?', ['Acknowledge the wait and explain the next step', 'Tell them to come back tomorrow', 'Serve them before everyone else'], 0],
    ['You cannot solve a complaint yourself. You…', ['Promise a fix you cannot give', 'Record it and pass it to the right person with a reference', 'Close it without notes'], 1],
    ['A customer shares private details out loud in a queue. You…', ['Repeat them back loudly to confirm', 'Move the conversation somewhere more private', 'Write them on the public board'], 1],
  ]),
  C('teller', 'Teller Training (Gold Coast Bank)', 'bank', 60, 'Run a fictional teller counter: counting, records and refusing unsafe requests.', [
    ['Your till is GH₵20 short at closing. You…', ['Recount and report the difference', 'Cover it from tips', 'Adjust the record to match'], 0],
    ['A caller claiming to be head office asks for a customer balance. You…', ['Give it if they sound official', 'Follow the verification procedure first', 'Ask a colleague to give it'], 1],
    ['A withdrawal slip signature does not match. You…', ['Pay out anyway', 'Hold the transaction and follow the checking procedure', 'Sign it yourself'], 1],
  ], {requires: ['finlit', 'custserv']}),
  C('techfund', 'Technical Fundamentals', 'hub', 0, 'Understand files, versions and careful changes.', [
    ['Before changing a shared configuration you should…', ['Make a backup or a copy first', 'Edit it live and see', 'Delete the old one'], 0],
    ['A program crashes only sometimes. A good first step is…', ['Collect the error messages and steps that cause it', 'Reinstall the computer', 'Ignore it'], 0],
    ['Why use version control?', ['To track and undo changes safely', 'To make files larger', 'To hide changes from the team'], 0],
  ]),
  C('codeprac', 'Practical Coding Simulation', 'hub', 120, 'Fix a fictional bug: read, reproduce, test, then change.', [
    ['A total shows 105 instead of 100. The loop adds item 0 twice. The fix is to…', ['Start the second pass at item 1 or remove the duplicate add', 'Subtract 5 at the end', 'Round the result'], 0],
    ['After fixing a bug you should…', ['Add a test that would have caught it', 'Ship without checking', 'Delete the old tests'], 0],
    ['Your change breaks another feature in testing. You…', ['Investigate before merging', 'Merge anyway', 'Turn off the other feature quietly'], 0],
  ], {requires: ['techfund'], skill: {coding: 1}}),
  C('foodsafe', 'Kitchen Hygiene Basics', 'chopbar', 0, 'Keep food safe in a busy chop bar kitchen.', [
    ['Raw fish and cooked rice should be…', ['Stored and handled separately', 'Kept in the same bowl', 'Covered with the same cloth'], 0],
    ['A customer mentions a groundnut allergy. You…', ['Tell the cook and check the order', 'Serve the usual dish', 'Ignore it'], 0],
    ['Before handling food you…', ['Wash your hands', 'Wipe them on your apron', 'Start straight away'], 0],
  ]),
  C('roadsafe', 'Road Safety & Passenger Care', 'cars', 0, 'Drive and carry passengers responsibly in a fictional fleet.', [
    ['Your passenger asks you to speed. You…', ['Keep a safe speed and explain', 'Speed to please them', 'Stop and argue'], 0],
    ['You feel very tired before a shift. You…', ['Rest before driving', 'Drink energy drinks and drive', 'Drive slower with the radio loud'], 0],
    ['At a crossing with pedestrians you…', ['Stop and let them cross', 'Hoot and go', 'Speed up'], 0],
  ]),
  C('safety', 'Public Safety Orientation', 'police', 0, 'Fictional community-safety duties: calm, records, fairness.', [
    ['Two traders argue loudly. The first step is…', ['Calm both and listen to each side', 'Pick the louder person', 'Leave'], 0],
    ['Every incident should be…', ['Recorded accurately', 'Kept in memory only', 'Shared on social media'], 0],
    ['A person is treated unfairly because of where they live. You…', ['Treat everyone by the same rules', 'Follow the crowd', 'Do nothing'], 0],
  ]),
  C('office', 'Office Administration', 'ama', 0, 'Keep files, schedules and public records in order.', [
    ['Two meetings share one slot. You…', ['Ask both organisers and reschedule one', 'Delete one quietly', 'Double-book the room'], 0],
    ['A visitor asks for another person’s file. You…', ['Check they are authorised first', 'Hand it over', 'Read it to them'], 0],
    ['Incoming letters should be…', ['Logged with a date and reference', 'Stacked anywhere', 'Thrown away after reading'], 0],
  ]),
  C('teach', 'Teaching Practice', 'ug', 80, 'Plan and deliver a short fictional tutorial.', [
    ['Most of the class failed one question. You…', ['Re-explain that topic another way', 'Move on quickly', 'Blame the students'], 0],
    ['A good lesson starts with…', ['A clear objective', 'A surprise test', 'No plan'], 0],
    ['A student is struggling quietly. You…', ['Check in privately and offer help', 'Point it out to the class', 'Ignore them'], 0],
  ], {requires: ['custserv']}),
  C('wardcare', 'Ward Support Orientation', 'ridge', 0, 'Fictional hospital support: rosters, supplies and privacy. No clinical training.', [
    ['A patient record is left on a public bench. You…', ['Return it to the ward office', 'Read it', 'Leave it'], 0],
    ['Expired supplies should be…', ['Separated and reported', 'Mixed with new stock', 'Used first'], 0],
    ['A visitor asks for a patient’s diagnosis. You…', ['Refer them to the ward in charge', 'Tell them', 'Guess'], 0],
  ]),
  C('hospadmin', 'Hospital Administration (fictional)', 'korlebu', 250, 'Run fictional outpatient administration responsibly.', [
    ['Two appointments share a slot. You…', ['Have reception contact both patients', 'Cancel one silently', 'Ignore it'], 0],
    ['Records requests are handled by…', ['Following the records procedure', 'Whoever asks first', 'Email to anyone'], 0],
    ['A long queue builds. You…', ['Triage by the posted process and inform the queue', 'Close the desk', 'Serve friends first'], 0],
  ], {requires: ['wardcare']}),
  C('media', 'Media Basics', 'radio', 50, 'Prepare a fair, accurate short radio segment.', [
    ['Before broadcasting a claim you…', ['Check it with a reliable source', 'Read it as received', 'Exaggerate it'], 0],
    ['A caller insults another guest. You…', ['Moderate politely and move on', 'Join in', 'Play it again'], 0],
    ['Using a song in a broadcast needs…', ['The station’s licence or permission', 'Nothing', 'A shout-out'], 0],
  ]),
  C('aviation', 'Aviation Ground Safety (fictional)', 'airport', 300, 'Follow fictional airside safety and passenger procedures.', [
    ['An unattended bag is found. You…', ['Report it and keep people back', 'Open it', 'Move it to lost property'], 0],
    ['Before boarding closes you…', ['Follow the checklist and count', 'Rush everyone', 'Skip the count'], 0],
    ['A passenger is distressed. You…', ['Stay calm and get the right help', 'Ignore them', 'Argue'], 0],
  ], {requires: ['custserv']}),
  C('lead', 'Leadership & Management', 'ug', 400, 'Lead a fictional team: delegation, fairness and honest reporting.', [
    ['A target will be missed. You…', ['Report early with a recovery plan', 'Hide it', 'Blame the team'], 0],
    ['Two staff members disagree. You…', ['Hear both and decide by clear criteria', 'Side with your friend', 'Ignore it'], 0],
    ['Good delegation means…', ['Clear task, authority and check-ins', 'Dumping work', 'Doing everything yourself'], 0],
  ], {experienceRank: 2}),
].map(c => [c.id, Object.freeze(c)])));

// ---------- requirements by career and rank ----------
// courses: certificates needed to HOLD that rank (rank 0 = entry). Skills keep the
// existing data.js entry requirements and PROMO_SKILL ladder; promotions also keep
// their existing shift counts.
export const CAREER_REQS = Object.freeze({
  trotro: {2: ['roadsafe']}, chef: {0: ['foodsafe']}, trader: {}, fisher: {}, fashion: {}, pastor: {}, boxer: {}, dj: {},
  tech: {0: ['techfund'], 1: ['codeprac'], 3: ['lead'], 4: ['lead']},
  bank: {0: ['finlit', 'custserv', 'teller'], 3: ['lead'], 4: ['lead']},
  nurse: {0: ['wardcare']}, doctor: {0: ['wardcare', 'hospadmin'], 3: ['lead']},
  police: {0: ['safety'], 3: ['lead']}, radio: {1: ['media']}, teacher: {0: ['teach'], 3: ['lead']},
  hotel: {0: ['custserv'], 3: ['lead']}, aviation: {0: ['aviation'], 3: ['lead']},
  civil: {0: ['office'], 3: ['lead']}, ride: {0: ['roadsafe']},
});
export const certs = s => (s.certs ||= {});
export const hasCert = (s, id) => !!certs(s)[id]?.passedAt;
const bestRank = s => Math.max(s.job?.rank || 0, ...Object.values(s.life?.careers?.history || {}).map(h => h.saved?.rank || 0), 0);

export function missingFor(s, careerId, rank, {skills = {}, skillName = k => k, level = () => 0} = {}) {
  const out = [];
  for (const id of CAREER_REQS[careerId]?.[rank] || []) if (!hasCert(s, id)) {
    const c = COURSES[id];out.push({type: 'course', id, label: c.name, at: c.at, cost: c.cost});
  }
  if (rank === 0) for (const [k, v] of Object.entries(skills)) if (level(k) < v) out.push({type: 'skill', id: k, label: `${skillName(k)} ${v}`});
  return out;
}
export function courseEligibility(s, id, level = () => 0) {
  const c = COURSES[id]; if (!c) return 'Unknown course.';
  if (hasCert(s, id)) return 'You already hold this certificate.';
  for (const r of c.requires || []) if (!hasCert(s, r)) return `Complete ${COURSES[r].name} first.`;
  for (const [k, v] of Object.entries(c.skill || {})) if (level(k) < v) return `Needs ${k} skill ${v}.`;
  if (c.experienceRank && bestRank(s) < c.experienceRank) return 'Needs experience at rank 3 or higher in any career.';
  return null;
}
export const publicCourse = c => ({id: c.id, name: c.name, at: c.at, cost: c.cost, objective: c.objective, pass: c.pass,
  requires: c.requires || [], skill: c.skill || {}, experienceRank: c.experienceRank || 0,
  questions: c.questions.map(([prompt, choices]) => ({prompt, choices}))});

// Grade a submitted attempt. Returns {passed, score, error}. The caller charges the fee.
export function gradeCourse(s, id, answers, now) {
  const c = COURSES[id], rec = (certs(s)[id] ||= {attempts: 0});
  if (rec.retryAt > now) return {error: `You can retry in ${Math.ceil((rec.retryAt - now) / 60000)} min. Review the objective meanwhile.`};
  if (!Array.isArray(answers) || answers.length !== c.questions.length || answers.some(a => !Number.isInteger(a) || a < 0 || a > 3))
    return {error: 'Answer every question.'};
  const score = c.questions.reduce((n, [, , right], i) => n + (answers[i] === right ? 1 : 0), 0), passed = score >= c.pass;
  rec.attempts++; rec.lastScore = score;
  if (passed) { rec.passedAt = now; delete rec.retryAt; } else rec.retryAt = now + c.cooldownMin * 60000;
  return {passed, score, of: c.questions.length};
}

// ---------- auto-work ----------
export function cleanAutowork(input, transport) {
  const a = input && typeof input === 'object' ? input : {};
  return {enabled: a.enabled === true, mode: Object.hasOwn(transport, a.mode) && a.mode !== 'car' ? a.mode : 'trotro',
    maxSpend: Number.isInteger(a.maxSpend) ? Math.max(0, Math.min(AUTO.maxSpendCap, a.maxSpend)) : 60};
}
// Days whose auto shift may settle: completed work windows since the last settlement,
// never more than AUTO.catchUpDays, never before the player enabled it.
export function dueAutoDays(aw, today, closedToday) {
  const last = Math.max(aw.lastDay ?? -1, (aw.since ?? today) - 1), end = closedToday ? today : today - 1, out = [];
  for (let d = Math.max(last + 1, end - AUTO.catchUpDays + 1); d <= end; d++) out.push(d);
  return out;
}
