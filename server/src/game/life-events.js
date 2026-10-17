// Stage 8 personal life events: occasional, contextual, server-authoritative situations with bounded outcomes.
//
// Fairness rules (documented for players in the event sheet and the checkpoint):
// - Events are only offered while the player is connected and idle (not travelling, working, in custody or busy).
// - At most one open event, at least 20 real minutes apart, at most 3 a day.
// - Ignoring an event is always safe: it expires with a neutral outcome and no loss, online or offline.
// - Losses only ever touch cash carried in the pocket — never MoMo, savings, homes, cars or items — and are capped
//   per event and per day. After any loss, no negative event is offered for 6 hours.
// - Risk is fictional game design: it depends on time, carried cash, skills and recent history, and is identical in
//   every neighbourhood. No real place is treated as more dangerous than another.
const MIN = 60000, HOUR = 3600000;
export const RULES = {checkMs: MIN, chance: 1 / 45, gapMs: 20 * MIN, perDay: 3, calmMs: 6 * HOUR, dailyLossCap: 250, history: 20, newcomerGraceMs: 30 * MIN};

const night = (c) => c.h >= 22 || c.h < 5;
const day = (c) => c.h >= 8 && c.h < 19;
const lvl = (s, k) => Math.floor(s.skills?.[k] || 0);
const pct = (v) => Math.max(0.05, Math.min(0.95, v));
const pocket = (s, share, cap) => Math.max(0, Math.min(cap, Math.round((s.cash || 0) * share)));

// Each definition: id, category, title, weight, cooldown (hours), negative (can cost something), expireMin,
// eligible(s,c), text(s,c,ctx), choices(s,c,ctx) -> [{id,label,hint}], resolve(s,c,ctx,choice,rnd) -> outcome.
export const DEFS = {
  robbery: {
    cat: 'neighbourhood', title: 'Trouble on a quiet street', weight: 1, cooldownH: 48, negative: true, expireMin: 4,
    eligible: (s, c) => c.street && night(c) && (s.cash || 0) >= 60,
    text: () => 'Two strangers block your way on a dark stretch and demand the cash in your pocket. (Fictional game event — MoMo, savings and property are never at risk.)',
    choices: () => [
      {id: 'hand', label: 'Hand over some cash', hint: 'Lose part of your pocket cash, stay safe'},
      {id: 'escape', label: 'Try to get away', hint: 'Fitness helps'},
      {id: 'help', label: 'Shout for help', hint: 'People nearby may step in'},
      {id: 'talk', label: 'Talk your way out', hint: 'Charisma helps'}],
    resolve(s, c, x, choice, rnd) {
      const hand = pocket(s, 0.3, 150), stress = {id: 'shaken', v: -12, h: 6, label: 'Shaken by a street incident'};
      if (choice === 'hand') return {cash: -hand, mood: stress, needs: {energy: -5}, text: `You handed over GH₵${hand} and walked away safely.`};
      if (choice === 'escape') return rnd() < pct(0.35 + lvl(s, 'fitness') * 0.06) ? {needs: {energy: -15}, skill: ['fitness', 0.1], mood: {id: 'escaped', v: 4, h: 3, label: 'Got away'}, text: 'You ran and lost them in the crowd. Out of breath but safe.'}
        : {cash: -pocket(s, 0.4, 200), needs: {energy: -18}, mood: stress, text: 'They caught up and took some of your pocket cash.'};
      if (choice === 'help') return rnd() < 0.6 ? {rep: 1, needs: {social: 6}, mood: {id: 'helped', v: 5, h: 4, label: 'Neighbours had your back'}, text: 'People came out and the strangers left. Nothing was taken.'}
        : {cash: -hand, mood: stress, text: `Nobody came in time. You lost GH₵${hand}.`};
      return rnd() < pct(0.3 + lvl(s, 'charisma') * 0.07) ? {cash: -pocket(s, 0.1, 50), skill: ['charisma', 0.1], text: 'You talked them down to almost nothing.'}
        : {cash: -hand, mood: stress, text: `The talk did not work. You lost GH₵${hand}.`};
    },
    expire: 'You stepped back into a lit area and the moment passed. Nothing was taken.',
  },
  career: {
    cat: 'career', title: 'A chance to impress', weight: 1, cooldownH: 24, expireMin: 15,
    eligible: (s) => !!s.job,
    text: () => 'Your supervisor messages: someone is off sick and they need a hand with a short extra task today.',
    choices: () => [{id: 'yes', label: 'Help out', hint: 'Tiring, but your boss will remember'}, {id: 'no', label: 'Politely decline', hint: 'No effect'}],
    resolve(s, c, x, choice, rnd) {
      if (choice !== 'yes') return {text: 'You declined. Your supervisor understood.'};
      return {perf: 6, needs: {energy: -10}, earn: 20 + Math.round(rnd() * 40), mood: {id: 'useful', v: 6, h: 6, label: 'Valued at work'}, text: 'You covered the task. Your performance went up and you got a small thank-you payment.'};
    },
    expire: 'Someone else covered the task.',
  },
  friend_loan: {
    cat: 'social', title: 'A friend needs help', weight: 1, cooldownH: 72, expireMin: 30,
    eligible: (s, c) => c.friends.length > 0 && (s.cash || 0) + (s.momo || 0) >= 40,
    context: (s, c, rnd) => { const f = c.friends[Math.floor(rnd() * c.friends.length)]; return {friend: f.acct, name: f.name, amount: Math.min(50, (s.cash || 0) + (s.momo || 0))}; },
    text: (s, c, x) => `@${x.name} is short this week and asks to borrow GH₵${x.amount}, promising to pay you back tomorrow.`,
    choices: () => [{id: 'lend', label: 'Lend the money', hint: 'Repaid automatically in 24 hours'}, {id: 'advise', label: 'Help them budget instead', hint: 'Charisma'}, {id: 'no', label: 'Say no kindly', hint: 'No cost'}],
    resolve(s, c, x, choice) {
      if (choice === 'lend') return {pay: x.amount, friend: [x.friend, 5], pending: {amount: x.amount, label: `Repayment from @${x.name}`, hours: 24}, mood: {id: 'generous', v: 5, h: 8, label: 'Helped a friend'}, text: `You lent @${x.name} GH₵${x.amount}. It comes back tomorrow.`};
      if (choice === 'advise') return {friend: [x.friend, 2], skill: ['charisma', 0.1], text: 'You sat down together and made a plan. They were grateful.'};
      return {mood: {id: 'awkward', v: -3, h: 3, label: 'Awkward conversation'}, text: 'You said no kindly. It was a little awkward.'};
    },
    expire: 'Your friend sorted it out another way.',
  },
  supplier_deal: {
    cat: 'business', title: 'A supplier makes an offer', weight: 1, cooldownH: 48, expireMin: 30,
    eligible: (s) => Object.keys(s.biz || {}).length > 0 && (s.cash || 0) + (s.momo || 0) >= 100,
    text: () => 'A supplier offers you a bulk discount on stock today only — it should lift tomorrow’s business takings.',
    choices: () => [{id: 'buy', label: 'Buy the stock (GH₵100)', hint: 'Business takings ×1.25 at the next daily settlement'}, {id: 'haggle', label: 'Ask for credit', hint: 'Hustle helps'}, {id: 'no', label: 'Not this time', hint: 'No effect'}],
    resolve(s, c, x, choice, rnd) {
      if (choice === 'buy') return {pay: 100, flag: ['bizBoost', 1.25, 30], text: 'Stock bought. Your next daily takings get a boost.'};
      if (choice === 'haggle') return rnd() < pct(0.25 + lvl(s, 'hustle') * 0.07) ? {flag: ['bizBoost', 1.15, 30], skill: ['hustle', 0.15], text: 'They agreed to credit. A smaller boost, no cost.'} : {text: 'They would not give credit. No harm done.'};
      return {text: 'You passed on the offer.'};
    },
    expire: 'The offer went to another trader.',
  },
  supplier_setback: {
    cat: 'business', title: 'A delivery went missing', weight: 1, cooldownH: 72, negative: true, expireMin: 30,
    eligible: (s) => Object.keys(s.biz || {}).length > 0,
    text: () => 'Your manager calls: today’s delivery never arrived. You can replace it or ride out a slow day.',
    choices: () => [{id: 'replace', label: 'Replace the stock (GH₵60)', hint: 'No dip in takings'}, {id: 'wait', label: 'Accept a slow day', hint: 'Next daily takings ×0.7'}],
    resolve(s, c, x, choice) {
      if (choice === 'replace' && (s.cash || 0) + (s.momo || 0) >= 60) return {pay: 60, text: 'You replaced the stock. Business as usual.'};
      return {flag: ['bizDip', 0.7, 30], text: 'You accepted a slow day. Your next daily takings will be lower.'};
    },
    expire: 'Your manager found the delivery after all.',
  },
  leak: {
    cat: 'property', title: 'Water through the ceiling', weight: 1, cooldownH: 72, negative: true, expireMin: 30,
    eligible: (s, c) => c.place === 'home' && !!s.home,
    text: (s) => s.owned?.[s.home] === true ? 'Rain found a gap in your roof. Water is dripping onto the floor.' : 'Rain found a gap in the roof. Water is dripping onto the floor of your rented room.',
    choices: (s) => [
      ...(s.owned?.[s.home] === true ? [] : [{id: 'landlord', label: 'Call the landlord', hint: 'Free, but uncomfortable until fixed'}]),
      {id: 'diy', label: 'Patch it yourself', hint: 'Tiring'},
      {id: 'fundi', label: `Pay a fundi (GH₵${s.owned?.[s.home] === true ? 80 : 40})`, hint: 'Quick and clean'}],
    resolve(s, c, x, choice) {
      const fee = s.owned?.[s.home] === true ? 80 : 40;
      if (choice === 'landlord' && s.owned?.[s.home] !== true) return {mood: {id: 'leaky', v: -6, h: 8, label: 'Leaky roof'}, text: 'The landlord will fix it later today. It is uncomfortable until then.'};
      if (choice === 'fundi' && (s.cash || 0) + (s.momo || 0) >= fee) return {pay: fee, text: 'The fundi patched it in no time.'};
      return {needs: {energy: -12, hygiene: -8}, mood: {id: 'handy', v: 4, h: 6, label: 'Fixed it myself'}, text: 'You patched the roof yourself. Tiring, but satisfying.'};
    },
    expire: 'The rain stopped and the drip dried up.',
  },
  agent_error: {
    cat: 'financial', title: 'A MoMo agent’s mistake', weight: 1, cooldownH: 96, expireMin: 15,
    eligible: (s, c) => c.public && day(c),
    text: () => 'A MoMo agent hands you GH₵40 too much in change and has not noticed.',
    choices: () => [{id: 'return', label: 'Give it back', hint: 'Reputation'}, {id: 'keep', label: 'Keep it', hint: 'Small gain, some risk to your standing'}],
    resolve(s, c, x, choice) {
      if (choice === 'return') return {rep: 2, mood: {id: 'honest', v: 8, h: 8, label: 'Did the right thing'}, text: 'The agent thanked you and told everyone in the queue.'};
      return {cash: 40, heat: 15, rep: -1, text: 'You kept GH₵40. Someone might have noticed.'};
    },
    expire: 'The agent counted again and noticed the mistake.',
  },
  street_find: {
    cat: 'discovery', title: 'Something on the ground', weight: 1, cooldownH: 48, expireMin: 10,
    eligible: (s, c) => c.public,
    context: (s, c, rnd) => ({amount: 10 + Math.round(rnd() * 20)}),
    text: (s, c, x) => `You spot GH₵${x.amount} folded on the ground near a stall.`,
    choices: () => [{id: 'vendor', label: 'Hand it to the stall owner', hint: 'Reputation'}, {id: 'keep', label: 'Pocket it', hint: 'Small gain'}],
    resolve(s, c, x, choice) {
      if (choice === 'vendor') return {rep: 1, needs: {social: 5}, text: 'The stall owner knew who dropped it and thanked you.'};
      return {cash: x.amount, text: `You kept GH₵${x.amount}.`};
    },
    expire: 'Someone else picked it up.',
  },
  hidden_spot: {
    cat: 'discovery', title: 'A local recommendation', weight: 1, cooldownH: 24, expireMin: 15,
    eligible: (s, c) => c.public && !night(c),
    text: () => 'A friendly vendor points you to a quiet corner nearby with the best view and a cold drink.',
    choices: () => [{id: 'go', label: 'Take a short break there', hint: 'Fun and mood'}, {id: 'later', label: 'Maybe later', hint: 'No effect'}],
    resolve(s, c, x, choice) {
      if (choice !== 'go') return {text: 'You thanked them and moved on.'};
      return {needs: {fun: 15, energy: 4}, mood: {id: 'discovered', v: 6, h: 6, label: 'Found a hidden gem'}, text: 'A small break you did not know you needed.'};
    },
    expire: 'The vendor got busy with customers.',
  },
  cleanup: {
    cat: 'community', title: 'Community clean-up', weight: 1, cooldownH: 48, expireMin: 20,
    eligible: (s, c) => c.public && day(c),
    text: () => 'Neighbours are clearing a gutter and sweeping the street. They wave you over.',
    choices: () => [{id: 'join', label: 'Join in', hint: 'Tiring, social, reputation'}, {id: 'skip', label: 'Wave back and carry on', hint: 'No effect'}],
    resolve(s, c, x, choice) {
      if (choice !== 'join') return {text: 'You waved back and carried on.'};
      return {needs: {energy: -10, social: 15, hygiene: -8}, rep: 2, mood: {id: 'community', v: 7, h: 8, label: 'Helped the neighbourhood'}, text: 'The street looks better and people know your name now.'};
    },
    expire: 'The clean-up finished without you.',
  },
};

export function stateOf(s) {
  const e = s.lifeEvents && typeof s.lifeEvents === 'object' ? s.lifeEvents : {};
  return {active: e.active || null, history: Array.isArray(e.history) ? e.history : [], cooldowns: e.cooldowns || {}, pending: Array.isArray(e.pending) ? e.pending : [],
    lastAt: e.lastAt || 0, checkAt: e.checkAt || 0, calmUntil: e.calmUntil || 0, dayKey: e.dayKey ?? -1, today: e.today || 0, lossDay: e.lossDay ?? -1, lost: e.lost || 0};
}

// c: {now, h, day, place, street, public, idle, friends:[{acct,name}]}
export function offer(s, c, rnd = Math.random) {
  const L = stateOf(s), now = c.now;
  if (L.active || !c.idle || now < L.checkAt) return null;
  // Stage 12: a brand-new player gets half an hour to find their feet before any random event interrupts them.
  if (s.flags?.bornAt && now - s.flags.bornAt < RULES.newcomerGraceMs) return null;
  L.checkAt = now + RULES.checkMs;
  if (L.dayKey !== c.day) { L.dayKey = c.day; L.today = 0; }
  s.lifeEvents = L;
  if (L.today >= RULES.perDay || now - L.lastAt < RULES.gapMs || rnd() >= RULES.chance) return null;
  const pool = Object.entries(DEFS).filter(([id, d]) => (L.cooldowns[id] || 0) <= now && !(d.negative && now < L.calmUntil) && d.eligible(s, c));
  if (!pool.length) return null;
  const [id, d] = pool[Math.floor(rnd() * pool.length)];
  const ctx = d.context ? d.context(s, c, rnd) : {};
  L.active = {id, at: now, expires: now + d.expireMin * MIN, title: d.title, cat: d.cat, text: d.text(s, c, ctx), choices: d.choices(s, c, ctx), ctx, place: c.place};
  L.lastAt = now; L.today++; L.cooldowns = {...L.cooldowns, [id]: now + d.cooldownH * HOUR};
  return L.active;
}

// Bound an outcome before it touches the save: pocket-cash losses only, per-event and per-day caps.
export function bound(s, out, c) {
  const L = stateOf(s), o = {...out};
  if (L.lossDay !== c.day) { L.lossDay = c.day; L.lost = 0; }
  if (o.cash < 0) { const room = Math.max(0, RULES.dailyLossCap - L.lost); o.cash = -Math.min(-o.cash, room, s.cash || 0, 200); L.lost += -o.cash; }
  if (o.cash > 0) o.cash = Math.min(o.cash, 60);
  if (o.earn) o.earn = Math.max(0, Math.min(60, Math.round(o.earn)));
  if (o.pay) o.pay = Math.max(0, Math.min(100, Math.round(o.pay)));
  if (o.rep) o.rep = Math.max(-2, Math.min(2, o.rep));
  if (o.heat) o.heat = Math.max(0, Math.min(20, o.heat));
  s.lifeEvents = L;
  return o;
}

export function decide(s, c, choice, rnd = Math.random) {
  const L = stateOf(s), a = L.active;
  if (!a) return {error: 'There is nothing to decide right now.'};
  if (c.now >= a.expires) return {error: 'That moment has passed.'};
  if (!a.choices.some(x => x.id === choice)) return {error: 'Choose one of the options.'};
  const d = DEFS[a.id];
  const out = bound(s, d.resolve(s, c, a.ctx || {}, choice, rnd), c);
  const negative = (out.cash || 0) < 0 || out.flag?.[0] === 'bizDip' || (out.mood?.v || 0) < -5;
  const L2 = stateOf(s);
  L2.active = null;
  if (negative) L2.calmUntil = c.now + RULES.calmMs;
  L2.history = [{id: a.id, title: a.title, cat: a.cat, at: c.now, choice, text: out.text, cash: (out.cash || 0) + (out.earn || 0) - (out.pay || 0)}, ...L2.history].slice(0, RULES.history);
  if (out.pending) L2.pending = [...L2.pending, {amount: out.pending.amount, label: out.pending.label, due: c.now + out.pending.hours * HOUR}].slice(-5);
  s.lifeEvents = L2;
  return {out, def: d, active: a};
}

// Neutral expiry (never a loss) and due repayments. Returns messages for the player.
export function settle(s, now) {
  const L = stateOf(s), notes = [], paid = [];
  if (L.active && now >= L.active.expires) {
    const d = DEFS[L.active.id];
    L.history = [{id: L.active.id, title: L.active.title, cat: L.active.cat, at: now, choice: 'expired', text: d?.expire || 'The moment passed.', cash: 0}, ...L.history].slice(0, RULES.history);
    notes.push(d?.expire || 'The moment passed.'); L.active = null;
  }
  const due = L.pending.filter(p => p.due <= now);
  if (due.length) { L.pending = L.pending.filter(p => p.due > now); for (const p of due) paid.push(p); }
  s.lifeEvents = L;
  return {notes, paid};
}
export function due(s, now) {
  const L = s.lifeEvents;
  return !!(L && (L.active && now >= L.active.expires || (L.pending || []).some(p => p.due <= now)));
}
