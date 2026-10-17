# Stage 7 — social life, player identity and community events

Local implementation, integration and two-player browser acceptance pass. Exact-commit CI pending.
No rewards are paid by events: an admin may record an XP reward on an event, which is reported as
"pending approval" in the results and never credited.

## Features completed

- **Public profile with owner control** (`server/src/game/profile.js`): career, badges/milestones,
  reputation and title, business, car and owned homes, neighbourhood and net worth are each toggled by
  the owner (possessions, residence and net worth are private by default). Presentation: a preset
  headline, featured earned badge and profile colour (fixed lists, no free text to moderate). The
  profile never contains live location, balances, email, credentials or payment data — the old card
  exposed an online player's current place to anyone; that is removed. Settings: My Life → Public
  profile, or "Choose what others see" on your own profile.
- **In-world social actions**: the tap-a-player card keeps socials, message, money, Oware, report and
  block, and adds headline/badge, **Invite to my home** (when you are home), **Ask to leave my home**
  (for your guests) and **Full profile** — no phone menus needed for nearby actions.
- **Home visits and gatherings** (`server/src/game/home-access.js`, shard visit rules):
  - Owner modes: mutual friends can drop in (previous behaviour, still the default), invitation only,
    open house, closed.
  - Invitations: a 30-minute pass sent to an online player who accepts or declines; the pass works
    regardless of friendship but never through a block.
  - Visitor limit 1–8 (default 6); guests already inside are not counted when reconnecting.
  - Furniture permission: guests may use the host's toilet, TV and guitar if allowed; never bed, bath,
    kitchen or gym (server-enforced, including in a disconnect/reconnect).
  - Removal: the host can ask a guest to leave; that guest cannot walk back in for 30 minutes unless
    re-invited. Blocking or the host leaving still evicts guests, as before.
  - Home & guests page: My Life → Guests at home, or Houses → Guests & visits.
- **Live events** (`server/src/events.js`): ID, type, name, description, host (official or player),
  existing venue, start/end, capacity, visibility (public/friends/invite), eligibility (first-week
  players, minimum reputation; admin only), suggested activity from the venue's real capabilities,
  status (scheduled → live → ended, cancelled, suspended), cancellation reason, reports and persisted
  results (attendees, minutes together, top attendees). Event types: Oware tournament, football viewing
  party (viewing only — no playable match is promised), beach gathering, community meetup, fashion
  showcase, business fair, music promotion, nightlife gathering, house gathering.
  - Attendance is measured every 30 s from real room presence at the venue (or in the host's home),
    stored in SQL, bounded by capacity, and survives disconnects and server restarts.
  - Events app: Now / Upcoming / Mine / Past with real "going" and "here now" counts, RSVP, go to the
    venue, results, report, host form, and cancel for hosts. Notifications when an RSVP'd event starts,
    is cancelled, or you are invited.
- **Player-hosted events**: at an existing venue for its type, or a house gathering at your own home
  (which also admits eligible guests while live). Limits: account older than a day, one upcoming
  event, three per week, 5 minutes to 7 days ahead, 30–180 minutes, capacity 2–30 (house: visitor
  limit + host), moderated title/description, no media uploads or broadcasts. Three independent
  reports pause a player event until a moderator reviews it.
- **Administration**: `/api/admin/events` (GET list with reports, POST create/cancel/restore) behind
  the existing `ADMIN_KEY` and admin rate limit, and an Events section on `/admin.html` (text-only
  rendering of player content).

## Exact files

Server: `src/events.js` (new), `src/game/profile.js` (new), `src/game/home-access.js` (new),
`src/shard.js` (visit rules, invitations, removal, event routing and 30 s tick), `src/social.js`
(public profile), `src/game/rules.js` (`profile_set`, `homeaccess`, guest furniture),
`src/life-game.js` (durable actions), `src/index.js` (migration, admin routes),
`loadtest/social-life.test.js` (new), `loadtest/events-integration.js` (new), `loadtest/life.test.js`,
`package.json`, `.github/workflows/ci.yml`.
Client: `src/v2/phone/social-life.js` (new: Events app, profile settings, home guests),
`src/v2/phone/apps.js`, `src/v2/ui/people.js`, `src/v2/main.js`, `public/admin.html`.
Tools: `tools/events-browser-test.py` (new).

## Database changes

Additive tables: `game_events`, `event_attendance`, `event_reports` (created if missing). New saved-state
fields `profile` and `homeAccess` (absent = defaults). No existing data changed.

## Tests

| Suite | Result |
| --- | --- |
| Server `npm test` (4 new tests + home-access cases in the life suite) | 94 / 94 pass |
| Events integration (`*_security` DB) | 8 / 8 checks |
| Client `npm test` and build | 89 / 89 pass; build passes |
| Journey E (two browsers, real server, DB and tick) | 15 / 15 checks, no page errors |

Journey E: the admin API refuses a missing key; an admin schedules a meetup in Jamestown; a player finds
it live in Events, RSVPs, travels there; attendance reached 91 s, stayed 91 s while the browser was
closed, and continued to 151 s after reconnecting; the RSVP persisted. Another player saw career and
reputation but not net worth or location until the owner chose to show net worth. The owner invited
the other player home from their profile, saw them in Guests at home, asked them to leave, and the
removed guest could not walk straight back in.

## Regressions found and fixed

- The profile card leaked an online player's current place. Removed.
- A settings message named `profile` would have collided with the existing profile request. Renamed
  `profile_set`.

## Known limitations

- Invitation passes and removals are kept in server memory (30 minutes); a server restart clears them
  (guests then fall back to the owner's mode).
- Event start times are entered in the player's local clock; venue opening hours are checked in Accra
  time for public venues.
- Event XP rewards are recorded but not credited until approved.
- The local QA server needs `QA_ADMIN_KEY` set to run the admin journey (`.local` only).

## Approvals

Optional: approve crediting recorded event XP rewards (no cash). Nothing else needed.

## Next stage

Stage 8 (personal life events and consequences).
