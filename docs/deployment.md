# Docker deployment and account security

The Compose stack runs the game, PostgreSQL, Redis and Caddy. Only Caddy publishes host ports. PostgreSQL and Redis use a private internal network and persistent volumes; the game runs as the unprivileged `node` user with a read-only filesystem, dropped capabilities and a writable ads volume. The application database role owns its tables but is not a PostgreSQL superuser. Redis requires a password and preserves state in AOF storage.

## Start locally

Install a working Docker Engine/Desktop with Linux containers and Compose, plus Python 3 for secret initialization. From the repository root:

```sh
python tools/init-docker-secrets.py
docker compose up --build -d --wait
docker compose ps
```

Open **http://localhost:8080**. If the existing development server occupies port 8080, set `HTTP_PORT=8090` and `PUBLIC_URL=http://localhost:8090` in `.env`. Use the configured hostname consistently: origins are checked exactly. This container is in production mode even locally; URL tokens, development teleports and bot keys are disabled.

`docker compose down` stops the stack and keeps data. Do not use `down -v` unless you intend to erase its database, Redis and uploads. Existing native-development accounts are not automatically imported into this separate Docker database. To migrate them, take a PostgreSQL backup and restore it into the Docker database during a maintenance window; preserve the birth seed and verify the restored accounts before opening traffic.

The secret initializer preserves existing files and generates independent cryptographically random keys/passwords. `.secrets/` and `.env` are excluded from Git and the Docker build context. Compose mounts individual secrets as files. Keep the parent directory private; files need to be readable by the respective container users. On shared Windows hosts, restrict the `.secrets` directory ACL to the deployment operator and Docker's service. Compose secrets are file mounts, not an encrypted vault.

## Publish with HTTPS

Point your domain's DNS to the server and allow inbound TCP 80 and 443. Set these **non-secret** values in `.env`, replacing the example domain:

```dotenv
SITE_ADDRESS=game.example.com
PUBLIC_URL=https://game.example.com
BIND_ADDRESS=0.0.0.0
HTTP_PORT=80
HTTPS_PORT=443
```

Recreate the stack with `docker compose up --build -d --wait`. Caddy obtains and renews certificates and redirects HTTP to HTTPS. A publicly accessible HTTP origin is refused by the application. Local loopback HTTP is permitted for development/CI; it does not set Secure cookies. Real HTTPS uses `__Host-awd_session; Secure; HttpOnly; SameSite=Strict; Path=/`.

Do not expose the game container's port directly when `TRUST_PROXY=1`. Caddy overwrites `X-Real-IP`; the application trusts that header only in this private proxy configuration. A different load balancer requires matching origin and trusted-proxy configuration. Each shard needs a unique `SHARD_ID`, shared PostgreSQL/Redis, and the same secrets and `REDIS_NAMESPACE`. Separate environments must use different Redis instances or namespaces.

Production refuses missing/default-length session and birth secrets, `DEV`, and `BOT_KEY`. The admin key is in `.secrets/admin_key`; use it only on `/admin.html` over HTTPS and do not paste it into chat. It is kept in page memory, not browser storage. Put an optional Paystack key in `.secrets/paystack_secret` and recreate the game service. Keep top-ups disabled until webhook configuration and real payment/refund operations have been verified. Authenticated payment events must match currency, reference and exact expected amount; cap breaches are marked `refund_required` for operator review.

## Account and abuse controls

- Passwords: 12–128 characters for new accounts/changes, salted scrypt hashes, bounded hashing concurrency, common-password rejection. Existing shorter passwords and legacy scrypt hashes still log in and upgrade their hashes.
- Registration: strict usernames, case-insensitive name collision prevention, calendar-valid adult birth date and explicit agreement. New accounts store an adult attestation rather than the full birth date. This is self-attestation, not verified identity or age.
- Sessions: random 256-bit identifiers, hashes stored in PostgreSQL, seven-day absolute expiry, 24-hour inactivity expiry, up to five sessions per account. No production credentials in URLs, localStorage or JSON responses. Open sockets are rechecked every 30 seconds and closed immediately when local logout is processed; revocations also cross Redis to other shards.
- Settings → Account security: change password using the current password, or log out every device. Password changes revoke all sessions. An expired/revoked session returns the player to login.
- Origin/CSRF protection: same-origin JSON writes and WebSocket upgrades, Strict cookies, no wildcard CORS. Content Security Policy, framing prohibition, MIME sniffing protection and no-referrer headers cover built pages.
- Limits: shared Redis limits for auth/IP/username, signup, handshakes, ad submissions, admin and payment verification. Packet size, nesting, prototype keys, invalid-message and burst limits protect WebSockets. Production fails closed when the security limiter is unavailable.
- Gameplay: one active account per shared Redis namespace, bounded in-flight requests, server-calculated work performance, validated economy requests, blocking/moderation, private card hands and message-request ownership. Transfers, credit claims and top-up fulfillment persist transactionally; failed transactions do not change live balances.

There is no email verification, MFA or automated forgotten-password recovery yet. Account recovery requires a separately designed proof-of-ownership process; do not reset passwords based only on a username. Browser mini-game scores remain client reports, with server-side timing, reward, rest and work-day limits. These controls do not make the game bot-proof or provide DDoS protection at the hosting network.

## Data protection and operations

Passwords are hashed; HTTPS protects data in transit. Private messages are access-controlled but are **not end-to-end encrypted**. Database volumes, ad contacts, old birth dates and backups require host/provider disk encryption and restricted operator access. Existing dates of birth are preserved by migration; remove legacy dates only through an approved retention migration. Public character appearances, usernames, estates and wealth rankings are intentional game features.

Back up PostgreSQL and uploaded ads, keep backups encrypted outside the server, and test restoration. Keep `.secrets` separately protected and recoverable. Never commit database dumps or share production logs containing user content. Rotate a compromised database/admin/payment credential promptly; changing a secret file alone does not change PostgreSQL's stored password. Birth seed changes affect future rolls, so preserve the original seed. Session signing-secret rotation does not revoke opaque sessions; use the sessions table to revoke them during an incident.

Monitor failed logins, rate-limit responses, session/lease failures, database errors, payment `refund_required` orders and moderation reports. Update base images and dependencies regularly. A managed edge/WAF can add network-level abuse protection. Have an independent security review before launching real-money features.

## Validation

### Interim engagement milestone configuration

The [16 October Linux verification for 6f4d85d](https://github.com/Daxomar/awd/actions/runs/38870198475)
passed client/server tests, 34 PostgreSQL transaction scenarios, dependency audits,
production build, complete Docker startup, authenticated smoke and proxy health.
It used disposable CI services; no public deployment occurred.

Startup adds payment, advertising reservation/metrics, introduction and milestone
tables after the existing account, ad and social schema. Legacy references and
paid status are backfilled without replaying credits. Back up and test on a
staging copy before any approved production rollout. Application rollback must
retain these ledgers and paid reservations; no destructive down migration is run.

The default `FIRST_FRIEND_REWARDS_ENABLED=0` leaves introductions available with
no cash reward. Enabling the proposed configurable GH₵1,000/500 rewards requires
the economy review in `engagement-audit.md`. `PAYMENT_ADMIN_EMAIL` is optional and
queues administrative receipt copies only; an operator-supplied delivery worker
is still needed. Paystack retains the customer's required receipt email.

Configure the provider webhook to `/api/paystack/webhook` on the exact HTTPS
`PUBLIC_URL`. The runtime reconciles payments once a minute, checking each
unresolved reference at most every ten minutes. A manual run is available with
`docker compose exec game node reconcile-payments.js`. Monitor
`payment_orders.review_reason`, review attempts and the receipt outbox; perform
refunds through the provider and preserve all audit records. Callback navigation
alone never authorizes fulfillment. Do not enable real checkout before merchant,
carrier authorization, customer receipts and refund procedures pass staging.

The transaction integration scripts refuse production mode and require a
loopback database ending in `_security`. Never point fixtures or the mocked
browser provider at an existing game database. See `engagement-review.md` for
scope, validation and remaining release checks. No public deployment is implied.

```sh
cd server
npm test
npm audit --omit=dev
cd ../client
npm audit
npm run build
```

`server/loadtest/security-e2e.js` targets a production-mode local server and a separate local database whose name ends in `_security`; it refuses other database names. Set `DATABASE_URL` and `SECURITY_BASE` explicitly and use a separate Redis namespace. The test creates disposable accounts and changes their passwords/balances. It checks registration, cookies, origins, malformed requests, revocation, throttling, transfer persistence and replay protection.

GitHub CI also builds and starts the complete Docker stack on Linux and runs `tools/docker-smoke.mjs` inside its fresh game container. During initial implementation, the local Windows Docker engine could not start because its Linux backend was unavailable. On 15 October 2026, the [Linux verification run for cf49b04](https://github.com/Daxomar/awd/actions/runs/38658631703) passed: dependency audits, server/client tests, production build, complete Docker startup, authenticated cookie/WebSocket smoke test and proxy health check. CI caught and verified a fix for unquoted commas in Compose tmpfs mount strings. Local Docker Desktop operation remains unverified; Linux CI now confirms the packaged stack starts and passes its smoke checks. This is not a production deployment or a load/security certification.
