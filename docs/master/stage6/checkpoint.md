# Stage 6 — first-session objectives and social discovery

Local implementation and authenticated two-player browser acceptance pass. Exact-commit CI pending.
First Friend cash rewards remain disabled (unchanged `FIRST_FRIEND_REWARDS_ENABLED` gate).

## Features completed

- **HUD objectives** (`client/src/v2/ui/objectives-hud.js`): a compact row in the top HUD with icon,
  current objective, progress (`n/9` and bar), a clear **Go** or **Claim** action, and an expandable
  panel listing every first-session objective with its state. Completing one shows a toast and a brief
  highlight; claiming shows the XP/badge. The open/closed preference persists locally; progress and
  claims persist on the server. It sits in the top HUD, clear of the joystick and bottom navigation.
  Once the path is claimed, it hands over to the next long-term goal. The phone Milestones app remains
  for the full list.
- **First-session path** (any order, nonblocking): establish a home, step into the neighbourhood, use a
  local place, say hello to someone (an attempt counts even when nobody is online), explore careers,
  earn first cedis (paid session or gig), check needs, find a gathering place, plus First Friend while
  eligible. Five new objectives reuse real state (`home`, `act:` counters, intro attempts, `stats`,
  a one-time `flags.seen` marker set when Jobs or the status sheet is opened). Same one-time XP claim
  path, no cash, no duplicate rewards.
- **Meet** (`client/src/v2/ui/meet.js`), opened from the HUD objective or the phone Meet app:
  - **Nearby**: real players in the same room instance (already visible there).
  - **Discover**: real online players who explicitly opt in (`intro_profiles.discoverable`, default
    off). No location or room is sent.
  - **Friends**: accepted message contacts with online state.
  - Choose a person → write a hello → send. The recipient sees an offer and accepts or declines; nothing
    is delivered before consent. On acceptance both players' existing Messages conversations open; a
    genuine reply completes First Friend through the unchanged backend.
  - Privacy toggles: "Let other players find me in Discover" and "Pause all introductions".
- **Empty server**: each empty tab says so honestly, offers Retry and suggests open objectives;
  progress is preserved and First Friend can be completed later. No NPC users.

## Abuse protections

Unchanged: first-week eligibility, one active outgoing and incoming introduction, 30 s retry and
5/hour limit, never the same pair twice, decline quiet period, 2-minute consent expiry, 24-hour reply
window, genuine-reply check, one completion per account, host reward caps, banned/muted/jailed and
blocked checks. New: suggested and chosen introductions only reach players in the same room or who
opted into Discover; a chosen player is revalidated on the server; the discovery list is throttled
(2 s) and excludes opted-out, quiet, blocked, banned, already-introduced and already-linked players.

## Exact files

Server: `src/first-friend.js` (discovery lists, chosen introductions, discovery preference),
`src/objectives.js` (five objectives, `FIRST_SESSION`, seen markers), `src/shard.js` (routing,
throttles), `loadtest/first-friend-integration.js`, `loadtest/objectives.test.js`.
Client: `src/v2/ui/objectives-hud.js` (new), `src/v2/ui/meet.js` (new), `src/v2/ui/hud.js`,
`src/v2/ui/hud-state.js` (`hudRows`, `currentObjective`), `src/v2/main.js`,
`src/v2/phone/first-friend.js`, `src/v2/phone/apps.js`, `src/v2/ui/game-ui.css`,
`test/game-ui.test.js`. Tools: `tools/meet-browser-test.py` (new).

## Database changes

Additive: `alter table intro_profiles add column if not exists discoverable boolean not null default false`.
Five new rows in `objective_definitions` (upserted at start-up as before).

## Tests

| Suite | Result |
| --- | --- |
| Server `npm test` | 90 / 90 pass |
| First Friend integration (`*_security` DB) | 14 / 14 checks (3 new) |
| Objectives integration | pass |
| Client `npm test` | Stage 6 tests pass; 1 unrelated failure in `ad-placements.test.js` caused by another session's uncommitted ad-inventory edits (not part of this commit) |
| Journey D (two browsers): HUD objectives, follow + claim, empty server, opt-in Discover, consent, Messages opens, reply completes First Friend | 16 / 16 checks, no page errors |

## Regressions found and fixed

- The intro message whitelist did not route the new discovery request. Fixed.
- A HUD refresh that arrived while the account was saving was dropped, so a completed objective could
  look unfinished until the next event. Bounded client retry added; guidance "seen" markers have their
  own throttle so a routine refresh cannot swallow them.
- `null` text in the Meet sheet. Fixed.

## Known limitations

- The phone Meet app now opens the Meet sheet instead of its old page.
- Introduction offers expire after 2 minutes (existing rule); an offline recipient sees the expired
  state, not a pending one.

## Approvals

None needed. First Friend cash (GH₵1,000/GH₵500) stays disabled.

## Next stage

Stage 7 (profiles, house visits, live events).
