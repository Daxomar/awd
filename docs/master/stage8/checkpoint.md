# Stage 8 — personal life events and consequences

Local implementation and browser acceptance pass. Exact-commit CI pending. No approval needed: all money
amounts are small, bounded, and only ever taken from cash carried in the pocket.

## Features completed

- **Server-authoritative engine** (`server/src/game/life-events.js`): the server offers, validates and
  resolves every event; the client only displays the offer and sends the chosen option.
- **Ten curated events across every category**: robbery on a quiet street (neighbourhood), a chance to
  impress at work (career), a friend asks for a loan (social dilemma), a supplier deal (business
  opportunity), a missing delivery (business setback), a leaking roof (property), a MoMo agent's
  mistake (financial surprise), money on the ground and a local recommendation (positive discoveries),
  a community clean-up (community opportunity).
- **Each definition** has a stable ID, category, eligibility from real circumstances (time of day,
  place type, carried cash, job, accepted friends, businesses, home), cooldown (24–96 h), expiry time,
  decision options with honest hints, outcome rules with skill modifiers (fitness, charisma, hustle),
  need/mood effects (existing needs and moodlets), financial limits, persistence in the save and an
  expiry text.
- **Robbery (fictional, abstract)**: hand over some cash, try to get away (fitness), shout for help, talk
  your way out (charisma). Outcomes touch only pocket cash (≤ 30–40%, ≤ GH₵150–200), energy, a
  temporary "shaken" mood, reputation and history. MoMo, savings, homes, vehicles and items are never at
  risk. No player can target another player. No real-world instructions.
- **Contextual, non-stigmatising risk**: robbery is possible only at night (22:00–05:00 Accra time) on a
  street with at least GH₵60 carried, and the risk is identical in every neighbourhood.
- **Frequency and fairness**: offered only while connected and idle (not travelling, working, in custody,
  sick or busy); checked once a minute with a 1-in-45 chance; ≥ 20 minutes apart; ≤ 3 a day; one open
  event at a time. Ignoring an event — online or offline — expires neutrally with no loss. After any
  loss, no negative event for 6 hours; losses are capped at GH₵250 a day. "Decide later" keeps the
  event until it expires; a HUD reminder shows while it is open.
- **Life-system integration**: needs and moodlets, skills, reputation, legal standing (heat), job
  performance, friendship points, finances (MoMo/cash via the ledger), businesses (one daily settlement
  ×1.25 / ×1.15 / ×0.7, then the modifier is consumed), a scheduled friend-loan repayment after 24 h,
  the life journal (`life_event`), My Life → Recent life events. Decisions run as durable game
  transactions; due repayments and expiries trigger the durable tick.

## Exact files

Server: `src/game/life-events.js` (new), `src/game/rules.js` (tick hook, `lifeevent` action, outcome
application, business modifier), `src/life-game.js` (durable action and tick trigger),
`loadtest/life-events.test.js` (new), `package.json`.
Client: `src/v2/ui/life-event.js` (new), `src/v2/ui/hud.js` (reminder), `src/v2/main.js`,
`src/v2/phone/apps.js` (history), `src/v2/ui/game-ui.css`. Tools: `tools/life-events-browser-test.py`.

## Database changes

None. New saved-state field `lifeEvents` (absent = none).

## Tests

| Suite | Result |
| --- | --- |
| Server `npm test` (6 new life-event tests) | 100 / 100 pass |
| Client `npm test` and build | 89 / 89 pass; build passes |
| Journey F (browser; open events placed in the disposable DB while offline) | 10 / 10 checks |

Journey F: an open robbery survived a disconnect and waited on the HUD; choosing "Hand over some cash"
took GH₵90 of GH₵300 pocket cash with MoMo unchanged, saved the decision and started the calm period;
an event that expired while offline ended neutrally with no money change; a friend loan moved GH₵50
once and saved the 24-hour repayment; My Life lists the history; no page errors.

## Known limitations

- Ten events is a starting set; adding more is a data change in `life-events.js`.
- The friend-loan repayment is paid by the game on the friend's behalf (no money leaves the other
  player).
- Event times shown in the sheet use the device clock against the server's expiry time.

## Next stage

Stage 9 (ambient city life and business frontage).
