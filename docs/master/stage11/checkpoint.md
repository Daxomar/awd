# Stage 11 — secure developer and administrator dashboard

Local implementation, API integration and browser acceptance pass against the loopback QA server. A CI step now
runs the admin integration against a live server; its first CI run is pending. Nothing was deployed. No balance,
salary, price, birth amount or player asset was changed.

## Completed
- **Separate application**: `/admin.html` with its own script and stylesheet (`client/public/admin/`), not linked
  from the game or the phone. Served with `noindex` and the strict CSP (no inline script).
- **Server-side authorization on every operation** (`server/src/admin/routes.js`): rate limit → admin session →
  role permission → CSRF token for writes → password re-entry for bans and administrator changes. Denied attempts
  are audited. Hidden tabs are a convenience only; the integration test calls forbidden routes directly.
- **Sessions** (`session.js`): separate `HttpOnly`, `SameSite=Strict` cookie (`__Host-` on HTTPS), stored
  hashed, 8 h absolute / 30 min idle, at most 3 per administrator, ended on sign-out, role change, password change
  and sign-out-everywhere. A game session never opens the admin API; a player without a role gets no session.
  Five wrong passwords on a sensitive action end the session.
- **Roles** (`roles.js`): owner, operations, moderator, support analyst, finance reviewer with least privilege
  (only finance and owners see payments; only moderators and owners ban; only owners manage administrators or
  act against staff accounts; no permission anywhere changes a balance). There is always at least one owner.
  The first owner is granted from a shell (`npm run admin:grant`); no web route can create one.
- **Audit** (`store.js`): `admin_audit` records actor, role, action, target, reason, detail and outcome for every
  change, refusal and sign-in. Database triggers refuse UPDATE, DELETE and TRUNCATE. Privileged actions are
  recorded before they run (fail closed) and failures add a second entry.
- **Overview metrics** (`metrics.js`) from stored data only, each with a definition: registered, DAU/WAU/MAU
  (distinct accounts per server date, so refreshes never count twice), online across shards, sign-ins, city
  entries, new and returning players, retention by signup week (only cohorts after collection began), operating
  businesses, property transactions, live campaigns, and a 14-day series. Activity collection
  (`player_activity_days`, `daily_counters`) starts at deployment and the page says so; no history is invented.
- **Players**: paged search and status filters, account overview (no password hashes, tokens, payment details or
  message text; money journal only for support/finance/owner and audited), reports, moderation history, notes,
  appeals, suspensions (sign-out at once; game login shows the end time), bans and unbans. Reports filed in game
  (`player:ID:name`, `gist:ID`, `auto:…`) now store the reported account (`reports.target_acct`, back-filled).
- **Economy**: money created and removed by source (journal-label buckets, documented as an inference), player
  transfers by kind, property and vehicle activity, unusual entries, high daily earners, and ledger
  reconciliation of saved wallets against the latest journal balance (cached 60 s). No balance control exists.
- **Advertising**: verified revenue, impression estimates, campaigns by status (paged), approve held campaigns,
  suspend or take down, pause/resume bookings per placement (honoured by the booking page and the server), and
  refund/review cases. Eligible paid campaigns still activate automatically.
- **Payments**: orders, attempts, verification, duplicate-charge signals, receipts queued; the only action is
  provider re-verification. The console cannot mark a payment paid (`markpaid` refused on the role path).
- **World and events**: three server-read feature flags (life events, player-hosted events, automatic ad
  activation) with optimistic versioning, refreshed on every shard within 10 s; announcements to all shards;
  event scheduling with fixed types and venues (shown by name), cancel and restore.
- **Operations**: connections and capacity, shards, event-loop delay, PostgreSQL and Redis latency, pool,
  memory, 4xx/5xx counters, game faults, background workers (payment and introduction reconciliation, flag
  refresh, activity), payments awaiting reconciliation (provider shown as "simulated" in QA), recent incidents.
- **Compatibility**: the older `x-admin-key` calls for ads and events still work, with their own 10/min limit,
  and are audited as `legacy-key`.

## Files
Server: `src/admin/{roles,flags,ops,store,session,metrics,players,routes}.js` (new), `admin-grant.js` (new),
`src/index.js`, `src/auth.js`, `src/db.js`, `src/ads.js`, `src/events.js`, `src/shard.js`, `src/game/rules.js`,
`package.json`, `loadtest/admin-roles.test.js`, `loadtest/admin-integration.js`, `loadtest/admin-fixtures.js`
(new), `loadtest/security-e2e.js`. Client: `public/admin.html` (replaced), `public/admin/*` (new),
`public/advertise.html` (paused placements). Tools: `tools/admin-browser-test.py`. Docs:
`docs/admin-dashboard.md`. Build: `Dockerfile` (grant script), `.github/workflows/ci.yml` (admin step).

## Database (additive only)
Tables `admin_users`, `admin_sessions`, `admin_audit` (+ append-only triggers), `moderation_actions`,
`player_activity_days`, `daily_counters`, `admin_meta`, `feature_flags`, `admin_announcements`. Columns
`accounts.suspended_until`, `reports.status/handled_by/handled_at/resolution/target_acct`,
`ad_placements.paused`. Back-fill sets only the new `reports.target_acct`.

## Tests
- Server `npm test` 111/111 (7 new admin unit tests: role matrix and least privilege, session expiry, cookie and
  CSRF binding, flags, telemetry redaction). Client 90/90 and build.
- Admin integration 46/46 against the QA server, and 43/43 against a Redis-less server as CI runs it:
  unauthenticated and ordinary-player denial, game cookie refused, role restrictions, CSRF/cross-origin/form
  posts refused, suspension sign-out and login message, password re-entry, owner and staff protection, wallet
  untouched, audit entries and refusals, audit immutability, no payment marking, concurrent flag and report
  changes (one 200, one 409), pagination, status filter, safe 400/404 errors, record visibility by role,
  idle expiry, role change and sign-out ending sessions, repeated wrong passwords ending a session, real metrics
  and telemetry.
- Journey I 17/17 (desktop and 390 px phone width, no page errors or CSP violations): screenshots in this folder.
- Regression: events integration, ads integration, first-friend integration, journey H 14/14, security-e2e core.

## Review
An independent security review found no critical or high issues. Fixed from it: staff lockout by moderators,
legacy-key throttling, re-authentication guessing, report linking, audit fail-closed, prototype-key filters,
last-owner race, TRUNCATE guard, login lockout keyed per IP, admin session clean-up and revocation, cached
reconciliation, suspended accounts on the development token path.

## Limitations and follow-ups
- Activity metrics begin at deployment; retention needs 1/7/30 days of data before it shows percentages.
- Operations counters are per process (each shard shows its own); there is no external metrics store (GH₵0).
- Ops and moderators still see a player's wallet figures in the account overview (not the journal).
- `loadtest/security-e2e.js` has an optional `ADMIN_KEY_FILE` block that books an anonymous ad; it has been stale
  since Stage 10 made booking require sign-in (not run in CI). The rest of that test passes.
- The audit table is append-only through triggers; a separate database role without DDL rights would harden it
  further in production.
- Live Paystack remains disabled until the owner provides a key and approves.
