# Stage 12 — release gates

Status of every release gate in brief section 12, with the evidence behind it. "Open" means the game must not be
publicly released, or real money must not be enabled, until the owner closes it. Nothing here was deployed.

## 12.7 Real-money gates (live Paystack)

| Gate | Status | Evidence / what remains |
| --- | --- | --- |
| Valid merchant configuration | **Open** | Needs the owner's Paystack live key, business verification and settlement account. No key is configured. |
| Correct callback origin | Ready to verify | Callbacks are built from `PUBLIC_URL` (`https://accrawedey.world` in production); the mock refuses non-loopback origins. Verify once the live key exists. |
| Verified webhook handling | Done in test | HMAC-SHA512 signature check, then server-to-server verification before fulfilment (`payments-integration.js`, journey H/K). |
| Duplicate-payment protection | Done in test | Unique references, purchase keys, `payment_events` primary key, duplicate charges flagged for review and shown in the admin Payments view. |
| Reconciliation testing | Done in test | 60-second reconciliation worker with provider verification; worker health shown in admin Operations. Live provider behaviour unverified. |
| Refund procedures | **Open** | Refund and review cases are listed in the admin console, but refunds are paid through the Paystack dashboard by the owner. A written refund policy and timeline is needed. |
| Customer receipt verification | Partly done | Paystack sends the customer receipt; an admin receipt outbox exists. A real receipt has never been observed. |
| Administrative support procedures | Done | Admin console (Stage 11) with payments, refund cases, re-verification, audit; `docs/admin-dashboard.md`. |
| Content moderation | Done | Automated advert checks, moderator review, suspension and take-down (Stages 10–11); privacy and community rules page. |
| Legal and policy review | **Open** | `client/public/privacy.html` describes actual behaviour but has not had legal review (Ghana Data Protection Act 2012 registration, consumer and advertising rules). |

Test-mode and mock success are not live merchant certification.

## 12.8 Privacy and moderation

Player-facing page: `/privacy.html`, linked from sign-up, Settings and the advertising page. It lists what is kept,
why, for how long and who can see it, and the community rules. Controls that exist: reports (players, posts,
events), blocking, discovery opt-in/out, romance opt-out, suspensions and bans with reasons and appeals, advert
review and suspension, event moderation, profile visibility settings, staff access by role with an append-only
audit log. Retention implemented: sign-in sessions (7 days / 24 h idle), admin sessions (8 h / 30 min idle), ad
exposure detail (90 days), daily activity rows (about 13 months). Monitoring is limited to day-level activity
counts; no IP addresses are stored in the audit log and staff never see message text.

Open: account deletion is a manual owner process, not self-service; legal review of the page.

## 12.5 Security

Covered by automated tests: authentication and sessions (`security-e2e.js`, `security.test.js`), admin access and
roles (`admin-integration.js`, 46 checks), WebSocket origin, message size and rate limits, payment webhooks and
verification, media upload decoding and size limits, external link vetting (`ads-vetting.test.js`), commerce,
property and vehicle transfer transactions (`property-db.test.js`, `vehicle-db.test.js`), auto-work and salary
idempotency, life-event bounds, economy transactions with rollback (`security-e2e.js`). An independent review of
the admin code found no critical or high issues; its medium findings were fixed (Stage 11 checkpoint).
No load test was run against production.

## 12.1 Multiplayer

One process is one city shard. Players in the same shard share rooms, presence, movement, appearance, friendship,
dating, shared activities, home visits, trading and events. Across shards only city chat, announcements, money
transfers, direct messages, gem drops and session revocation travel (Redis); **players on different shards do
not see each other in rooms**. Account leases prevent the same account playing on two connections. Reconnects
resume durable state (journeys N).

## 12.3 Performance

Device tiers and budgets (targets; not yet measured on phones):

| Tier | Example devices | Auto quality | Budget |
| --- | --- | --- | --- |
| Low | 2–4 GB RAM, 4 cores (entry Android common in Ghana) | Battery saver: ≤0.85 pixel ratio, no shadows, 4 ambient people | 30 fps in a neighbourhood, JS heap < 200 MB |
| Mid | 4–6 GB RAM | Balanced: ≤1.15 pixel ratio, 1024 px shadows | 30 fps |
| High | 8 GB+, desktop | Sharp: ≤1.5 (phone) / 2 (desktop) pixel ratio, shadows | 30 fps phones, 60 fps desktop |

Adaptive quality: Settings → Graphics (Auto, Battery saver, Balanced, Sharp). In Auto, a frame-time governor steps
quality down when frames average above 45 ms for 4 s. Desktop diagnostics are in `perf.json`. **No phone frame
rate has been measured**; that needs real low and mid-tier phones before release.

## 12.4 Loading and network resilience

Existing and verified: loading screen with progress, cookie sessions surviving reloads, socket reconnect with a
fresh session check, idempotency keys for durable actions (`life_requests`), payment return that retries on 429 and
network errors, render loop paused in background tabs, immutable caching of hashed assets. No financial or
ownership action is acknowledged before it is committed. Open: low-bandwidth profiling on a real 3G connection.
