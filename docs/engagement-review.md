# Interim milestone: gameplay engagement, advertising and payments

16 October 2026. Stages A–H implemented in the existing Three.js/vanilla JS,
Node, PostgreSQL and Redis architecture. Cost of assets and test services: GH₵0.
No public deployment. Phase 6 has not begun. Character art is developed separately
and was not changed by this milestone.

## 1. Initial audit

[Audit](engagement-audit.md) and [machine-readable inventory](engagement-inventory.json)
record the baseline: 55 authoritative destinations, eight neighbourhoods, eight
estates, 19 careers and 12 advertising placements. The 68 geographic map districts
are scenery, not 68 playable destinations. Existing food, services, recreation,
shops and social actions were substantial but poorly discoverable. Salaried work
already used authoritative attendance; stale minigame catalogue fields and three
employment-only gig minigames needed retirement. Payments had separate legacy ad
and wallet paths, without a shared attempt ledger or durable reconciliation.

## 2. Preserved features and data

Destination/action IDs, original ad IDs/prices, purchased campaigns, salaries,
career records, skills, birth probabilities, GH₵800/25,000 starts, balances,
wardrobe/look fields, homes, property, private messages, phone games and Oware
remain compatible. Existing cookie authentication, origins, rate limits, private
room rules, transaction boundaries and multiplayer room lifecycle remain.

The regular local database was checked before and after restarting with additive
migrations: 103 accounts and players, 11 money-ledger rows, 11 credit rows, zero
top-ups/ad orders/home ownership rows. Account records and hashes of saved
financial, career, wardrobe, home and appearance fields captured by the check matched; historical
transaction rows matched. No test fixtures or mocked provider ran on that database.
The original birth seed was retained. This is a local preservation check, not a
claim to have migrated a production database or legacy production campaigns.

## 3. Exploration

Phone → **Explore** lists real destinations, their purpose, usable activities,
hours, costs and entrance/travel context. Makola, Labadi, UG, Vibes and Jamestown
are public gathering suggestions with actual **this-server** presence. Private
interiors and fake online counts are excluded.

Eight authored neighbourhood activities cover Nima conversation, Jamestown
harbour stories, Kaneshie price comparison, Labadi movement, Osu photography,
Airport Residential language exchange, East Legon study and Trasacco gardens.
They use existing server-timed needs/skill actions, with no new cash faucet.
All eight are checked for valid actions, timing and cooldown. Existing home,
street, estate, travel and service interactions remain. Scenic buildings do not
promise invented interiors. See [exploration details](exploration-engagement.md).

## 4. Employment

All 19 careers now expose three differentiated assignments at existing workplace
furniture. Attendance unlocks assignments at 0/10/20 real minutes; work at the
correct station takes 90/120/150 server-measured seconds. Leaving interrupts it.
Stable shift/task IDs prevent repeated completion. Task quality affects skill,
performance and satisfaction; tasks award no cash directly. The Jobs app displays
the assignment and existing schedule/pay information without recurring popups.

Original salaries, grades, promotion requirements and hourly attendance pay remain.
Three employment-only gig IDs retain rest/workday limits but become timed actions:
GH₵62 base, the old two-star midpoint, plus existing skill/fatigue scaling. This
normalization was documented before implementation and needs economy review before
production. Dance, boxing, Oware and phone games remain. Existing reconnect policy
still ends unattended active shifts. See [job mechanics/economy](employment-engagement.md).

## 5. Billboards

Original 12 placements and paid inventory survive. Frames are approximately
1.8 times the previous width, camera-facing where suitable, with brighter readable
artwork and emissive illumination. Two approved simulated commercial forecourt
billboards add Madina and Tema at GH₵800/week. No road, entrance, landmark or
interaction target is intentionally occupied. Placement metadata is shared and
persisted; the server determines price, capacity and availability.

## 6. Ground advertising

Three approved commercial/event surfaces: Accra Mall GH₵800/week, Oxford Street
courtyard GH₵1,200/week and Airport hotel forecourt GH₵1,000/week. Each has a stable
ID, coordinates, defined 6×3 m catalogue area, symbolic map rendering, price and
rental duration. This rents ad space; land ownership is unchanged.

Horizontal faces have clearance, borders, polygon offset and a readable elevated
camera orientation. Geographic tests exclude roads, water, green/protected areas,
homes, landmarks and generated buildings, with symbolic separation from billboards.
The in-location preview temporarily zooms closer and restores normal map controls.

Phone → **My Ads** provides catalogue, PNG/JPEG/WebP upload, duration, real-GHS price,
preview, checkout, saved campaign status, checkout resumption, verified-failure retry,
unpaid cancellation and reports. Uploads are ≤4 MB and ≤10 megapixels, decoded and
re-encoded to 1024×512 JPEG. SVG/HTML are rejected and metadata is stripped. Pending
artwork is owner/admin-only. Thirty-minute holds and a partial unique seat index
prevent overlapping exclusive rentals. Payment awaits moderation before activation;
expiry releases the surface. Late charges enter refund review. No automatic refund
is promised. See [inventory/lifecycle](advertising-inventory.md).

## 7. Campaign reporting

Sampling requires an active campaign, loaded image, front face, complete viewport
containment, ≥400 CSS pixels, two of three clear city/UI sight lines and ≥2 seconds
continuous visibility. Preview, hidden tab, phone/sheet and brief exposure do not
count. Sampling is capped at 2 Hz and two candidates per sample. Below-target terrain
is excluded before expensive triangle tests; actual above-target occluders remain.

The server checks an authenticated live player, active campaign and placement,
thresholds and rate limits. Campaign/viewer/15-minute uniqueness prevents duplicate
impressions/clicks. Daily totals persist; viewer deduplication records have a 90-day
retention cutoff. Reports expose aggregate impressions, clicks and 90-day unique
viewers. They are **estimates**, not fraud-proof analytics or guaranteed delivery.
Clicks mean opening the campaign panel, not sponsor conversions.

The authenticated mock-campaign browser journey measured **one impression, one
click and one unique viewer**. These are local QA events, not real audience reach.

## 8. Callback and return context

Both purchase types initialize a server-controlled callback at the configured
`PUBLIC_URL` origin. A signed, expiring reference token maps to PostgreSQL context:
screen, pack/placement and campaign. The return endpoint checks the signed-in owner.
No arbitrary redirect URL or browser success flag activates a purchase. My Ads
restores the saved campaign; MoMo restores the wallet result and reference.
This follows [Paystack initialization](https://paystack.com/docs/api/transaction/)
and [independent verification](https://paystack.com/docs/payments/verify-payments/).

## 9. PostgreSQL payment architecture

`payment_orders` holds owner, stable purchase key, purchase type, original legacy
ID, exact integer pesewas/GHS, context, status, fulfillment and review reason.
`payment_attempts` preserves every reference, provider transaction ID, checkout,
initialization/verification/fulfillment times and failure/reconciliation facts.
`payment_events` stores minimal sanitized provider observations, including
distinct mismatch facts. No raw provider payload or card details are stored.

Unique keys and transaction/advisory locks prevent repeated-click initialization.
The initialization claim commits before external HTTP and releases its DB connection.
An uncertain response retains its reference. Only a verified failed/abandoned attempt
can create a new reference on the same logical order; original artwork/order remains.
Fulfillment and wallet credits commit atomically. A second provider charge is recorded
for review rather than crediting twice. Existing weekly wallet caps remain.

## 10. Webhook and reconciliation

Raw-body HMAC-SHA512 authentication precedes event processing, followed by server-to-
server verification of reference, success, currency, integer amount and provider ID.
Repeated webhooks/verification are idempotent. Unavailable verification is retryable.
A minute worker, ten-minute per-reference interval and bounded batch reconcile
unresolved payments without browser return. Older unresolved attempts remain checked
after their replacement fulfills, so missing-webhook duplicate charges enter review.
`node reconcile-payments.js` is also packaged in Docker. Review cases require operator
investigation/refund; they do not automatically charge or refund a customer.
See [official webhook guidance](https://paystack.com/docs/payments/webhooks/) and
[implementation details](payments-reliability.md).

## 11. Phone numbers, MoMo and receipts

The form prioritizes a validated Ghana phone number; hosted checkout offers
`mobile_money` and `card`. Paystack collects the actual instrument and customer
authorization. The contact number typed into the game is not charge authorization
and is not a direct-charge instrument. Customer receipt email remains required for
initialization; it is never silently replaced with a shared address. See
[Paystack payment channels](https://paystack.com/docs/payments/payment-channels/).

Optional backend-only `PAYMENT_ADMIN_EMAIL` queues a unique administrative-copy
outbox record on fulfillment. **No email delivery worker is configured**, so this
does not yet send admin copies. Customer provider receipts remain enabled. Keys,
contact fields and receipt destinations are not sent to public reports or logs.

## 12. First-friend introductions

The optional HUD hint and Phone → **Meet** connect an eligible first-week player
to a real online player on this server. The recipient can accept or decline before
the introduction enters the existing private inbox. No fake/NPC/offline fallback.
No candidate means a clear retry/explore alternative. Accepted status and inbox
delivery survive reconnect. Existing blocks, bans, privacy and messaging preferences
apply. Cross-server matching is not added.

## 13. Rewards and abuse controls

Completion requires a subsequent stored recipient text DM, ≥12 letters/digits,
different from the introduction. Client completion flags, short replies and money
requests do not qualify. Uniqueness makes initiating completion and rewards one-time.
Pending requests expire after two minutes; accepted replies have 24 hours. Declined
pairs are not reoffered, quiet periods/opt-out are respected, with 30-second request
cooldown and five/hour limit. Rewarding hosts requires age ≥24 hours, at most one
reward/day and three lifetime. Stored replies are reconciled after interrupted work.

Cash rewards are **disabled by default**. Configurable proposed limits are new
player GH₵1,000 and host GH₵500. GH₵1,000 equals 125% of the hustler start and 4% of
the dbee start; a fully eligible initiating+hosting lifecycle could yield GH₵2,500.
The [economy assessment](engagement-audit.md) therefore requires review before
production activation. Snapshot rules prevent retroactive payout for completed
zero-cash introductions. Multi-account collusion remains possible: this system is
**not abuse-proof**, and no invasive fingerprinting/phone identification was added.

## 14. Objectives

Twelve optional **Milestones** use authoritative visits, trips, completed meals,
accepted messaging, social interaction, work shifts, actual look changes, introductions
and returning home. Rewards are 15–25 XP and three badges, with no cash, streak or
forced order. Unique transactional claims persist through reload and cannot be
claimed through client-reported completion. Existing Aspirations remain. First Friend
respects first-week eligibility and opt-out. See [objective details](objectives-engagement.md).

## 15. Migrations and rollback

Fifteen additive tables: four payment/outbox, four ad inventory/reservation/metrics,
four introduction/reward and three objective tables. Startup ordering respects legacy
ads/social tables. Conflict-safe paid-order backfills never replay old credits.
Existing `ad_orders`, `topups`, `credits` and player JSON stay intact. Optional new
state fields tolerate old saves. Rerunning migrations is tested. Roll back application
code while retaining ledgers and reservations; dropping payment history is not an
automated rollback. No destructive production migration was run. Operational details
and staging requirements are in [deployment.md](deployment.md).

## 16. Automated verification

- Server: **62/62** tests pass, including original economy, onboarding, security,
  street, presence and games regressions plus new behavior.
- Client: **59/59** tests pass (including eight separately committed character
  asset tests); repository CI records the exact final result.
- PostgreSQL integration: **34 scenarios** across payments (9), ads (9), First Friend
  (10) and objectives (6), with mocked provider calls and disposable local accounts.
- Payment checks cover concurrent/repeated initialization, immutable order context,
  owner callback, forged signature, amount/currency mismatch, duplicate fulfillment,
  additional charges, missing webhook, uncertain initialization, retry and late-success
  reconciliation. Ad checks cover invalid upload, ownership, concurrent exclusive
  stock, moderation, expiry, deduplication and legacy migration.
- Introduction checks cover consent, decline/rematch, no candidates, disconnect,
  qualifying reply, one-time completion, reward limits, opt-out and timeout. Objective
  checks cover fake progress, incomplete claims, persistence, unique XP and no cash.
- Production Vite build passes; dependency audits report zero vulnerabilities.
  Linux CI builds and smoke-tests Docker; local Docker Desktop is unavailable.

The [Linux verification run for implementation commit 6f4d85d](https://github.com/Daxomar/awd/actions/runs/38870198475)
passed the exact committed server/client suites, all four PostgreSQL transaction
scripts, dependency audits, production build, Docker build/startup, authenticated
cookie/WebSocket smoke test and proxy health check. This ran against disposable
CI infrastructure and is not a public deployment or physical-device certification.

Commands: `npm test` in both packages; the four `server/loadtest/*-integration.js`
scripts with explicit loopback `*_security` DB; `npm run build` in client. Test
mutations refuse production mode. No real payment or public account was used.

## 17. Authenticated browser checks

`tools/engagement-browser-test.py` drives disposable production-cookie sessions:
real UI login, two live players accepting an introduction, private inbox reply,
one-time XP claim and reload; physical workplace station/walk and a real 90-second
server assignment with no extra cash; home → neighbourhood → authored activity and
milestone; ad upload/preview/mock checkout/signed return/verification/moderation/report;
MoMo form/mock checkout/verified +600 wallet credit once. Page-error collection is clean.
Five viewports check Meet and phone layouts at 375×812, 390×844, 430×932, 390×530 and
844×390. These are local functional/layout checks, not real merchant/carrier tests,
full accessibility certification, a production load test or a full-game pixel regression.
Screens have manual review; no prior pixel baseline exists for these new screens.

## 18. Performance and limits

Final main JS is 528.05 kB (191.59 kB gzip). No new runtime dependency, remote media
request or asset purchase. Measured 390×844 desktop Chromium SwiftShader close-up:
17 placements allocated, one cached campaign texture; visible ads add **two draw
calls and 14 triangles** in that camera (37/278,778 versus 35/278,764 with ads hidden).
Eight repeated map visits held 16 GPU geometries and three textures in the sampled
render context; this is a scoped observation, not a whole-game memory guarantee.

A forced eligible visibility scan measured median 13.5 ms, maximum 133.1 ms across
12 samples on this loaded desktop; cold bounds/geometry tests cause the spike. The
ordinary path skips already-counted campaigns and ineligible/offscreen placements,
and runs at most twice a second. The inspection removed below-ground merged-terrain
triangle tests; expensive cold scans and **physical-phone profiling remain release
checks**. These measurements do not establish phone FPS or city-wide before/after
speed. Metrics and viewport evidence are in `engagement-validation.json`.

## 19. Screenshots and asset provenance

Original generated ad art/geometry are commercially usable project work with no
new third-party asset licence. Existing city sources retain ODbL attribution. See
[environment provenance](../client/public/assets/ENVIRONMENT-ART.md).

| Journey | Evidence |
| --- | --- |
| Consent and private reply | [Consent](images/engagement/social-consent.jpg), [Messages](images/engagement/social-private-reply.jpg) |
| One-time XP | [Claimed milestone](images/engagement/social-milestone-claimed.jpg) |
| Workplace participation | [Station](images/engagement/work-at-station.jpg), [Completed assignment](images/engagement/work-assignment-complete.jpg) |
| Discovery | [Directory](images/engagement/explore-places.jpg), [Neighbourhood](images/engagement/neighbourhood-discovery.jpg) |
| Ground placement | [Artwork preview](images/engagement/ground-artwork-preview.jpg), [Active ground ad](images/engagement/ground-campaign-active.jpg) |
| Campaign and wallet | [Campaign verification](images/engagement/campaign-payment-verified.jpg), [Report](images/engagement/campaign-active-report.jpg), [Wallet verification](images/engagement/wallet-payment-verified.jpg) |
| Mobile layout | [390×844](images/engagement/mobile-390x844.jpg), [Short viewport](images/engagement/mobile-390x530.jpg), [Landscape](images/engagement/mobile-844x390.jpg) |

## 20. Known limitations

Real Paystack merchant setup, live MoMo carrier prompts, real receipt delivery and
refund operations remain untested. Admin copies require an email worker. Existing
unowned legacy campaigns remain admin-managed; no arbitrary player ownership is
assigned. Ad counts are client-assisted estimates. Introductions match within one
server; alternate-account abuse is reduced, not solved. Employment assignments are
bounded authored simulations rather than a full business/delivery economy. Not every
decorative building is enterable. Cold visibility scans and physical-phone profiling
need release attention. Local Windows Docker operation remains unverified.

## 21. Approval boundaries

No approval is needed for the completed local implementation, tests or authorized
repository push. **Public deployment**, production schema rollout/real-money activation,
the documented gig-pay normalization, First Friend cash activation, destructive data
changes and broader economy/monetization changes need review and explicit approval.
No approval has been inferred from elapsed time. No public deployment, real charge,
character-pipeline edit or Phase 6 work occurred.
