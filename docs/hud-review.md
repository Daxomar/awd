# Phase 2: playable HUD and interaction review

15 October 2026. Baseline: `bd87dd1` (Phase 1 onboarding). Local production client,
cookie authentication and an isolated PostgreSQL/Redis test stack were used.
Phase 3 map work and the final character-art phase have not begun.

## Audit and action inventory

The baseline was captured in the actual game before changing the HUD. Six need
rings, mood, reputation, sound, career/daily/gem chips and a scrolling row of
objects competed with the scene. The permanent Shop control duplicated the
phone. Several controls were smaller than a comfortable mobile touch target.

The joystick was absent because a visibility check matched the permanently
mounted, **hidden** phone. Object menus closed before a server reply, leaving
rejections without a retry context. Abandoned player-profile requests retained
listeners. NPC selection could choose an unrelated doorway. Travel could retain
an old room label; a refreshed journey did not restore the ride presentation.

| Existing capability | Entry after this change |
| --- | --- |
| Identity, mood, reputation, needs | Portrait → character status; individual need → explanation and existing matching activities |
| Cash + MoMo, top-ups, transfers | Wallet → existing MoMo app; no duplicated banking interface |
| Home, map, transport | Bottom controls and location strip; existing destination IDs, fares and transport sheets |
| Furniture, food, rest, bathroom, entertainment | Tap object or Interact → existing room zones and action cards |
| Doors, home/street/estate navigation | Tap doorway or choose its Interact option, then confirm movement |
| Wardrobe and venue careers | Interact → Wardrobe / Jobs here / Start shift, as previously permitted |
| Current activity and cancellation | Confirmed progress indicator; Stop only where existing rules permit |
| City and nearby chat | Chat control; existing channel, delivery and unread behavior |
| Nearby players | Tap player or Interact → player card; existing friendship thresholds |
| Wave, talk, joke, praise, gist, dance, hug, flirt, ask out, propose | Player card; server confirmation/error and pending state |
| Private messages, money, Oware, block/report | Player card → existing systems; no additional private profile fields |
| Jobs, shops, property, businesses, banking, health, games and other apps | Entire existing phone application registry retained |
| Daily goals, gem hunt, illness, power outage, housing status | Character status panel; existing app/map routes |
| Sound and tutorial | Character status → Sound settings / Quick tour |

## Implementation and visual system

`main.js` still owns the existing scene/network lifecycle. `hud-state.js` derives
presentation from canonical state: needs, mood, wallet, current location and
activity timestamps. `hud.js` renders compact identity/wallet/location controls,
five bottom controls, expandable character details and progress. Open need
buttons are patched during updates so keyboard focus survives server refreshes.

`game-ui.css` scopes the world UI to `.game-ui`, applied only after onboarding.
Forest green `#245b43`, chalk `#fcfaf2`, brass `#dfbc5f` and dark green text form
one restrained palette. Existing Outfit/Bricolage typography and Phosphor icons
remain. Borders, shallow shadows and short transform/opacity transitions provide
depth. No framework, dependency, font, asset or paid service was added.

`venue.js` reuses real zone/action mappings in contextual sheets. The selected
object/player has an owned ground ring, released when dismissed or changing room.
The Interact sheet contains room objects/exits plus actual players present; it
replaces the permanent scrolling action strip. Costs and effects remain visible
before submission. Buttons disable while waiting, with an inline error and retry
when rejected. `activity-requests.js` installs one subscription group, matches
existing busy/minigame acknowledgments and bounds missing replies. No client
balance, inventory, relationship or reward is fabricated.

`overlays.js` centralizes visible overlay ownership, keyboard trapping and visual
viewport sizing. World picking, movement and wheel input respect visible menus.
Hidden handset elements no longer block the joystick. Sheets support Escape,
focus restoration, outside dismissal and drag dismissal. Closing layers become
inert immediately while still guarding world input during their exit animation.

The existing handset and every app remain. Explicit Phone home / Back to Accra
controls provide reliable exits at short heights. Phone and alert key handlers
are released on close; closing a handset cancels its pending confirmation.
Notification banners are keyboard operable and hidden/non-focusable after expiry.
Phone unread indicators still come from existing message state.

Travel retains the compact HUD, shows the existing ride progress and restores
confirmed travel on reload. Interact and the map explain that they are available
on arrival. Arrival updates the location from actual state rather than a previous
room label. The map itself and travel rules have not changed.

## Bugs fixed and review findings

- Hidden phone incorrectly disabled the joystick; visible-overlay ownership fixes it.
- World input could reach the canvas around menus, especially in landscape.
- Activity menus closed before confirmation; rejected actions now retain context.
- Player profile requests lacked complete early-close/timeout cleanup.
- Nearby NPC routing could select a doorway instead of a supported facility.
  A neighborhood resident now offers the existing city-chat entry, without
  pretending there is an NPC conversation system.
- Travel location and restored ride presentation could become stale.
- The shared confirmation helper resolved dismissal before the chosen answer,
  treating Yes/Play as false. It now resolves the chosen answer first.
- During implementation, review caught a phone Games CSS-name collision, an
  offscreen notification tab target and a reload callback shadowing browser
  location. These were corrected before final verification.
- Ask-out uses the existing server's personal confirmation message; proposal uses
  its room event. Neither is presented as acceptance by the other player.

## Verification

Client unit suite: **13 passed** (six focused HUD/action-controller tests plus
existing character/session/onboarding tests). Server suite: **44 passed**.
Production client build passed. Backend gameplay source and schemas are unchanged.

Actual production-mode Chromium gameplay used two newly created disposable local
accounts. Starting balances came through normal onboarding. A single new test
account received a controlled low-energy condition to exercise critical and
recovering indicators; existing accounts and saved balances were not edited.

The browser checks exercise:

- 375×812, 390×844, 430×932, 390×530 and 844×390 layouts, reachable controls,
  needs panels and reliable handset dismissal;
- actual Bed actions, rejected server action, confirmed Nap/Bath completion,
  supported cancellation and real needs recovery;
- canvas/UI isolation, joystick recovery, repeated phone/profile opening with
  stable listener counts, disconnect and reconnect;
- two-player discovery, confirmed wave, city chat delivery, private message
  request and recipient unread badge;
- existing home → neighborhood → Trotro → Circle journey, confirmed fare debit
  and correct arrival location.

The existing onboarding browser regression suite covers both birth outcomes,
character/trait saving, lottery persistence, eligible homes, reload/disconnect
recovery, rejected selection, idempotent finish and real signup/login.

Follow-up browser checks also passed canvas Bed picking, reduced motion,
status focus retention across live updates, keyboard phone opening/closing,
handset confirmation cancellation (without submitting a bank transaction),
landscape dock access and an incoming menu interrupting an existing canvas drag.
A real friendly Oware invitation was accepted in both player sessions.

Extended Windows runs encountered local database connection and screenshot
capture timeouts. The harness now waits for rendered controls and loaded message
threads, and resumes social/travel checks separately when needed. Notification
keyboard handling is exercised on an actual incoming message in the receive turn,
so its normal 4.2-second lifetime cannot expire between slow automation commands.
This is not a multiplayer load/performance certification.

The final social/travel repeat verifies private-message delivery, a real unread
badge, keyboard opening of the received message, a confirmed travel debit and
arrival after reloading during the journey. The needs panel suppresses room
facilities while travelling or viewing the map.

The repository's [Linux container verification workflow](https://github.com/Daxomar/awd/actions?query=branch%3Amain)
runs client/server tests, dependency audits, the production build, full Compose
startup, authenticated container smoke journeys and proxy health. The exact run
result accompanies the pushed milestone. Local Docker Desktop remains unavailable;
no local container or physical-device performance claim is made.

## Screenshot evidence

These are actual local gameplay captures, not component mockups. Baseline images
were taken before the UI edits. Screenshots were opened and visually inspected.
The unchanged city/character appearance remains visible; this milestone is UI.

| Before | Finished gameplay |
| --- | --- |
| [Original crowded HUD](images/hud/before-home.png) | [Compact HUD](images/hud/hud-390x844.png) |
| [Original handset](images/hud/before-phone.png) | [Handset with explicit return controls](images/hud/phone-390x844.png) |

Additional reviewed screenshots: [needs](images/hud/needs-375x812.png),
[selected bed](images/hud/bed-selected.png),
[activity progress](images/hud/activity-progress.png),
[nearby player](images/hud/nearby-player.png),
[city chat](images/hud/two-player-chat.png),
[private message](images/hud/private-message.png),
[travel](images/hud/on-the-road.png), [arrival](images/hud/venue-arrival.png),
[short viewport](images/hud/hud-390x530.png) and
[landscape phone](images/hud/phone-844x390.png).

## Limits and scope

Software-rendered desktop Chromium verifies behavior/layout, not physical mobile
FPS. Safe-area and visual-viewport hooks are implemented; a physical iPhone/Android
keyboard, browser chrome and device-notch check remains necessary. Emulated short
heights do not reproduce every OS keyboard behavior. Existing phone apps were
preserved and their integration exercised; this is not an exhaustive re-audit of
every app or later-phase gameplay system. The short test ride finished during
reload: live transport and the correct post-reload arrival were verified; a
screenshot of restoration before arrival was not captured. Existing protocol errors do not have
request IDs, so contextual activity submission is deliberately serialized.

No onboarding redesign, map content, character meshes/rigs/clothing, economic
mechanics, live account balances, database schemas, deployment configuration or
server gameplay rules were changed. The short first-play tour points at the new
controls. No public deployment was performed.

## Files changed

- `client/package.json` — include HUD unit tests.
- `client/src/v2/main.js` — integrate controls, confirmations and input ownership.
- `client/src/v2/ui/hud.js`, `hud-state.js`, `game-ui.css` — HUD/state/tokens/layout.
- `client/src/v2/ui/activity-requests.js`, `overlays.js` — confirmation and overlays.
- `client/src/v2/ui/venue.js`, `people.js` — contextual objects and public players.
- `client/src/v2/ui/dom.js`, `chat.js`, `tutorial.js` — sheets, feedback and entry integration.
- `client/src/v2/phone/phone.js` — existing handset navigation and alert lifecycle.
- `client/src/v2/scene/world.js` — selection feedback and NPC context routing only.
- `client/test/game-ui.test.js` — derived-state and action-lifecycle regression tests.
- `server/loadtest/hud-fixtures.js` — guarded disposable local fixtures only.
- `tools/hud-browser-test.py` — actual two-player browser journeys.
- `docs/hud-review.md`, `docs/immersive-world-audit.md`, `docs/images/hud/` — report, roadmap and reviewed evidence.


## Follow-up: online status and player count

Restored the live player count beneath the location, within the existing header
height. A green connection dot and `N players online` show confirmed presence;
`Offline` replaces the count on disconnect. Reconnection waits for a fresh
presence update instead of showing a stale count. The initial loading state is
`Online · checking players…`. Counts use the existing server `places` messages;
no new subscriptions, analytics tracking, backend or schema changes were added.
Total visits were omitted following the user's clarification.

Verification: 13 client unit tests and production build passed. A focused browser
journey verified actual 1 → 2 → 1 player changes across two disposable sessions,
offline/reconnect status, and all five target viewports. The
[updated header screenshot](images/hud/online-status.png) was visually inspected.
The main HUD browser journey also now guards count visibility and offline status.
