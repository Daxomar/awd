# Phase 1: onboarding review — 15 October 2026

This milestone changes onboarding only. Character anatomy, rigging, clothes,
animation, HUD, map and neighborhood redesign remain deferred. Existing
Three.js/DOM architecture, accounts, homes and currency rules are retained.
No paid service, external asset or database schema migration was introduced.

## Confirmed defects and causes

| Finding | Evidence and cause | Repair |
| --- | --- | --- |
| Character choices disappeared after refresh | Before patch, the browser selected Woman/bust 0.8 and revealed Dbee. Reload returned to Man/bust 0.45. Appearance existed only in the creator closure until final submission. | Save draft appearance, display name and traits in server JSON checkpoints. Resume them before drawing the creator. |
| The lottery reveal was not a saved action | Browser frame capture found no request when Roll was tapped. The old button changed `dataset.birthRevealed`; a refresh lost reveal progress. The existing HMAC assignment itself was stable. | A correlated `roll` request persists the reveal timestamp before acknowledgment. Animation displays that same assignment. |
| Onboarding stopped reconnecting | Closing the socket during setup yielded `connected:false`, no retry timer and `holding:true`. Reconnect was gated by releasing held gameplay packets, which happens only after onboarding. | A welcomed connection reconnects during setup. Clear obsolete held room packets; update the player ID after reconnect. |
| Submission could leave a permanent wait | Code audit found the creator removed before submission, a listener attached after sending, and an unbounded wait for success with no recoverable failure panel. | Register request listeners before sending, serialize requests, use 10-second deadlines, reject interrupted waits, and retain the active screen with a retryable error. Authentication/bootstrap waits are bounded too. |
| Completion did not explicitly enter the first room | `after()` handled movement/arrival but not `onboarded`. | Enter the chosen home room after durable completion, once; duplicate completion does not re-enter or reset position. |
| A save/disconnect race could wait on itself | Leave-time save looked up a mutable account-save map after replacing its entry. | Capture the pending onboarding task before starting the leave save. Test disconnect during a deferred checkpoint save. |

A real WebGL-disabled browser test also caught an undefined-scene comparison
in the new fallback's cleanup. It was corrected and the fallback journey rerun
successfully. Landscape screenshot review found the preview centered behind the
side panel; both preview cameras now use the visible presentation area's center.

## Resulting journey

**Welcome → Character setup → Birth lottery → Starting home → Enter Accra.**

The current creator is retained inside a new mobile presentation. It has a name
field, full-body framing, drag-to-turn and zoom, two trait choices, clear back
navigation, progress and saving indicators. Panels respect safe-area insets and
visual viewport resize; controls remain reachable with a shorter viewport.

A rounded Three.js die uses the existing renderer and an isolated, disposable
scene. Its reveal lasts about 1.45 seconds. Reduced motion skips the spin. A CSS
3D die supports setup when WebGL cannot start. If the city renderer is unavailable,
setup can still finish and save; the game shows an explicit reload action instead
of pretending a non-WebGL city is playable.

Hustler uses green presentation, Dbee uses gold, with distinct copy, savings and
eligible areas. Existing homes appear as selectable illustrated cards showing
neighborhood, home type, bathroom and later weekly rent. The illustrations are
original schematic previews, not photographs or exact architectural plans. The
arrival confirmation names the chosen area and explains tapping around the home
and using the phone. The existing first-play tutorial still follows entry.

## Authority, persistence and compatibility

- HMAC birth assignment remains **75% Hustler / 25% Dbee**, saved before the first
  welcome response. Hustler remains **GH₵800**, Dbee **GH₵25,000**. A submitted die
  face or background has no authority. There is no reroll purchase or reroll reward.
- `state.onboarding` is versioned JSON: step, revision, draft name/look/traits,
  readiness, reveal timestamp and selected eligible home. Existing unfinished
  records without it start at Welcome; existing completed records enter the game.
- Mutation revisions reject stale requests. Required stages and eligible homes
  are checked on the server. The old one-shot command cannot skip checkpoints in
  production. Legacy development load tools remain supported outside production.
- Each checkpoint is acknowledged **after** PostgreSQL saves it. Account leases,
  active-save guards and leave/flush ordering prevent concurrent initialization
  and stale overwrites. Failed saves restore the prior live state; the UI can retry.
- Repeated rolls return the saved assignment/reveal. Repeated completion returns
  the existing life and cannot add starting funds or reset spent funds.
- Reload/reconnect uses server state. A reload during the spin shows the saved
  result; a reload after home choice returns to the arrival confirmation. A lost
  final acknowledgment resumes the completed game instead of granting funds again.
- Character edits autosave after a short pause. **Saved** means acknowledged by
  the server. Refresh restores the last acknowledged draft; edits still marked
  Saving, or made while offline, must reach the server before closing the tab.
  No localStorage value controls progress, background, home or currency.

## Files changed

| Area | Files |
| --- | --- |
| Presentation | `client/src/v2/ui/onboard.js`, `onboarding.css`, `birth-die.js` |
| Startup, authentication and recovery | `client/src/v2/main.js`, `net.js`, `onboarding-session.js`, `ui/auth.js` |
| Authoritative progression and persistence | `server/src/game/onboarding.js`, `rules.js`, `server/src/shard.js` |
| Regression tests and fixtures | Client/server package test commands, `client/test/onboarding-session.test.js`, `net-onboarding.test.js`, `server/loadtest/onboarding.test.js`, `onboarding-durability.test.js`, `onboarding-fixtures.js` |
| Browser/integration tools | `tools/onboarding-browser-test.py`, `onboarding-fallback-test.py`, updated character/account browser helpers, `tools/docker-smoke.mjs`, `server/loadtest/security-e2e.js` |
| Documentation | This report and the revised priority note in `immersive-world-audit.md` |

## Validation and evidence

- **44 server tests passed**, including both backgrounds, exact starting funds,
  stale/invalid/skipped requests, saved drafts, repeated completion after spending,
  save failure/rollback, save/disconnect ordering and initial-save lease release.
- **7 client tests passed**, including synchronous replies, serialized revisions,
  missing replies, interruption, late acknowledgment and reconnect while holding.
- Production Vite build passed. No new runtime dependency was added.
- Real local production-cookie browser journeys passed for controlled Hustler and
  Dbee fixtures: creator customization, mid-setup refresh, interrupted reveal,
  repeated rolls, invalid home error, offline recovery, persisted home choice,
  completion, gameplay reload, actual signup form and returning-account login.
  An additional browser check confirmed that dirty offline trait edits remain
  selected, save after reconnection and clear the connection error.
- Portrait **375×812, 390×844, 430×932**, landscape **844×390**, and a shortened
  **390×530** viewport passed horizontal overflow/button reachability checks.
  Rendered screenshots were opened and visually inspected, including landscape.
- WebGL disabled: CSS die, all setup stages and persisted completion passed, with
  an explicit city-renderer retry screen afterward. Reduced-motion 3D reveal
  passed without the normal delay (0.15 seconds in this desktop run).
- The existing production security integration suite also passed: cookies,
  origin/body limits, revocation, password changes, throttling, economy rollback
  and replay protection. Its onboarding helper now uses the new protocol.
- The expanded production HTTP/WebSocket smoke passed locally against PostgreSQL
  and Redis: registration, cookies, checkpoints, rejected home, saved roll, home
  room entry, duplicate completion, asset serving and logout revocation.

Screenshots are generated under ignored `.local/onboarding/`. Selected reviewed
captures are also included in `docs/images/onboarding/`: [welcome](images/onboarding/welcome.png),
[creator](images/onboarding/character.png), [traits](images/onboarding/traits.png),
[Hustler](images/onboarding/hustler.png), [Dbee](images/onboarding/dbee.png),
[homes](images/onboarding/homes.png), [landscape](images/onboarding/landscape.png),
[fallback](images/onboarding/fallback.png) and [invalid home](images/onboarding/error.png). These use disposable
local accounts; fixture session cookies remain ignored and must never be shared.

## Reproducing the browser checks

Use a disposable local `awd_security` database, a separate Redis namespace and a
production-mode QA server on port 8082 serving the built client. Keep production
bypass flags absent and provide explicit test secrets. Never point these tools at
a public game or a database containing real players.

In a separate shell, set `DATABASE_URL` to that isolated database and `BIRTH_SEED`
to the QA server's test seed, with `NODE_ENV` unset. From the repository root:

```text
node server/loadtest/onboarding-fixtures.js .local/onboarding/fixtures.json
python tools/onboarding-browser-test.py
python tools/onboarding-fallback-test.py
```

The fixture helper creates new accounts until it finds both outcomes using the
unchanged HMAC rule; it does not rewrite existing players. Reruns need new fixtures.
The HTTP signup checks retain normal throttling; use a fresh disposable Redis
namespace when iterating enough to exhaust the local signup allowance.

## Limits and remaining verification

Desktop Chromium with software WebGL is functional/layout evidence, not measured
Android FPS. Physical iPhone Safari/Android keyboard, browser chrome, GPU context
loss during play, cellular handoff and a multi-server production soak remain
unverified. The short viewport test approximates keyboard space; it is not an
actual iOS keyboard test. The city still requires WebGL, although setup has a
working fallback. Existing character art remains intentionally unchanged. The adapted character-game
and account-security browser helpers were syntax-checked; their entire wider
journeys were not rerun in this milestone.

No production deployment was performed. The local machine cannot run the Linux
Docker backend; the repository CI runs the container build and expanded smoke.
The current commit's CI outcome is recorded separately when available.
