# Administrator dashboard

The admin console is a separate web application at `/admin.html`. It is not part of the in-game phone, and it is
not linked from the game. It works on a laptop or a phone browser.

Every request is checked on the server: the console hides sections a role cannot use only for convenience. Signing
in with a game account that has no administrator role gives no access, even with the right password.

## First owner

There is no web page that can create the first administrator. From a shell with access to the database:

```bash
cd server
npm run admin:grant -- <game-username> owner "Initial owner"
```

The account must already exist in the game. In Docker: `docker compose exec game node admin-grant.js <username> owner "Initial owner"`.
Use the role `none` to remove access. Every grant is written to the audit log as `server-shell`.

After that, owners grant or change roles from **Administrators** in the console (password re-entry required).
Owners cannot change their own access; ask another owner (or use the shell).

## Roles

| Role | Can do |
| --- | --- |
| Owner | Everything, including managing administrators and reading the audit log |
| Operations administrator | Overview, players, reports, notes, suspensions, economy, advertising moderation and placements, events, announcements and feature flags, server health, audit log |
| Moderator | Overview, players, reports, notes, suspensions, bans and unbans, advertising moderation, events |
| Support analyst | Overview, players (including the money journal), reports, notes and appeal records |
| Finance reviewer | Overview, players (including the money journal), economy, advertising figures, payments and provider re-verification |

No role can change a player's balance: the console has no balance control. Only an owner can act against
another owner's account.

## Sessions and safety

- Admin sessions use their own `HttpOnly`, `SameSite=Strict` cookie, last at most 8 hours and end after 30 idle
  minutes. Signing out ends the session on the server. Changing someone's role ends their sessions.
- Every write needs the session's CSRF token and a same-origin JSON request.
- Bans, unbans and administrator changes ask for your password again.
- Every change needs a reason. Changes and refused attempts go to the audit log, which the database refuses to
  edit or delete.
- Sign-in is limited to 20 attempts per IP and 5 per username every 15 minutes. Writes are limited to 60 a
  minute per administrator.

## Sections

- **Overview**: registered players, daily/weekly/monthly active players, players online across shards, sign-ins,
  city entries, new and returning players, retention by signup week, operating businesses, property
  transactions and live advertising. Each figure shows its definition. Activity figures start when this version
  was deployed (shown on the page); earlier history was never recorded and is not estimated.
- **Players**: search by username or account number, filter (banned, suspended, staff, reported), page through
  results, and open an account: wallet, home, job, holdings, message counts (never message text), activity,
  reports and moderation history. Support and finance roles also see the money journal; opening it is audited.
  Actions: note, appeal record, suspend (1 hour to 90 days; signs the player out at once), lift suspension, ban,
  unban. Saved player data is always kept.
- **Reports**: open and closed player reports, close as actioned or dismissed with a reason; event reports.
- **Economy**: money entering and leaving wallets by source, transfers between players (marketplace, vehicles,
  property, MoMo), property activity, unusual single entries (GH₵20,000+), players earning over GH₵50,000 in a
  day, and ledger reconciliation (saved wallet against the latest journal balance).
- **Advertising**: verified revenue, estimated impressions, campaigns by status with artwork, approve a campaign
  waiting for review, suspend or take down a campaign, pause or resume new bookings on a placement, and refund or
  review cases. Eligible paid campaigns still go live automatically; nothing requires manual approval unless
  automatic checks hold it or operations turns automatic activation off.
- **Payments**: orders, attempts, verification state, duplicate-charge signals, receipts waiting, and a
  **Re-verify** button that asks the provider again. Nothing in the console marks a payment as paid or moves
  money; refunds are paid through the provider by the owner.
- **World & events**: feature flags (life events, player-hosted events, automatic advertising activation), each
  read by the server and applied on every shard within 10 seconds; announcements to every online player; and
  scheduling, cancelling or restoring events with fixed event types and venues (no free-form code or geometry).
- **Operations**: connections against capacity, shards, event-loop delay, database and Redis latency, memory,
  server and client error counts, game request faults, background workers (last success and failures),
  payments awaiting reconciliation and recent incidents. These counters cover the current server process.
- **Audit log**: filter by administrator or action.

The older `x-admin-key` header still works for the advertising and events endpoints so existing scripts keep
working; each use is audited as `legacy-key`. Prefer named administrator accounts.
