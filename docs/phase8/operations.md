# Phase 8 operations

This is a local implementation milestone, not permission for public deployment.
Back up PostgreSQL and preserve existing session/birth/payment secrets. Keep
production cookie authentication and real-payment enablement controls unchanged.

Startup calls existing migrations, then the additive life modules after accounts,
players and existing social/credits tables exist. Stagger shard startup when
possible: simultaneous DDL can deadlock; existing startup retries handle that
without serving a half-migrated game. No legacy table is truncated or replaced.

Nine new tables hold life events/receipts, managed operations/events, phone escrow,
mutual relations/partners and shared sessions/membership. New foreign keys refer
to existing account IDs. New indexes serve own history, ownership, expiry and
bounded shared-session queries. The legacy friendship import is conflict-safe and
does not reinsert a removed friendship on restart. Existing Paystack/ad tables and
fulfilment APIs are unchanged.

Do not drop life tables on code rollback. Listed phones are owned escrow and
completed trades reference durable existing credits. Resolve/return escrow under
a reviewed maintenance procedure before disabling the marketplace. Preserve audit
and action receipts; no destructive down migration is supplied.

Business settlement is lazy, six-hour periods, eight periods maximum. Idle owners
do not allocate timers. Shared activity reconciliation is one bounded shard task,
not one timer per participant. Existing account serialization/row locking remains.
Set unique SHARD_ID values for simultaneous instances. Redis is transient and
does not hold sole copies of financial or relationship state.

PostgreSQL connection wait defaults to the existing 5,000 ms. Optional
`PG_CONNECT_TIMEOUT_MS` is clamped to 500–30,000 ms; the contended local QA host
uses 30,000. The existing 10,000 ms statement timeout is unchanged. This option
does not permit an unverified game session to continue. Verified invalid/revoked
sessions still terminate; verifier outages disconnect and retry authentication.

If a financial COMMIT reply is lost, the live account is marked uncertain and
disconnected. Its stale in-memory state is excluded from periodic/leave saves.
Reconnection loads PostgreSQL and the stored action receipt before safe retry.
Do not clear this guard or manually resubmit a new action key to hide an error.

Browser QA needs only disposable loopback accounts. `phase8-fixtures.js` refuses
production/non-loopback/non-`awd_security` databases. Credentials/cookies are stored
only in ignored `.local`. `age-businesses` verifies fixture account ownership and
ages only business periods; it does not grant money. `replace-role` replaces one
test fixture reference without deleting an account or altering other fixtures.

Run all server/client suites, the five database integration scripts, audits and
the production build. The CI workflow also builds the full Docker stack and runs
cookie-authenticated HTTP/WebSocket/proxy smoke checks. Do not claim Windows
Docker or public deployment validation from a Vite build alone.
