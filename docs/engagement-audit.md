# Interim milestone — Stage A audit

Baseline: `6c8dbe1`, 16 October 2026. Phases 1–5 are implemented; Phase 6 and the character pipeline are outside this work. See `engagement-inventory.json` for every authoritative destination, action and career at this baseline.

| System | Existing | Incomplete / required |
|---|---|---|
| Exploration | 55 destination IDs, eight connected neighbourhoods, private homes/estates, meals, shopping, fitness, recreation, education, services and travel | Activity discovery and public gathering counts; geographic map districts are not additional destinations |
| Employment | 19 careers, location and weekday/time attendance, hour-long shifts, skills, performance, grades/promotion and salary | Career catalogue retains six minigame references; gigs launch those minigames independently. Work task RPC currently refuses client performance. Add actual differentiated assignments without replacing records or salary tables |
| Advertising | 12 geographic billboards, rotating/exclusive stock, sanitized raster artwork, moderation, `ad_orders`, paid/manual orders | Tiny rendering, no account ownership for new orders, no ground inventory, concurrency-safe reservations, campaign reporting or exposure measurement |
| Payment | Server initialization with callback, raw SHA512 webhook, server verify, GHS/amount checks, top-up credit transaction and weekly real-money cap | Split ad/top-up logic; no common attempt/event ledger, stable retry, safe context token, provider-ID dedupe or browser-independent reconciliation; ad approval scheduling race |
| Wallet | Server balances, transactional credits/claims and transfers, ledger, account locks | Preserve all existing credit delivery and saved balances; fulfill payments into credits rather than editing live balances |
| Social | Cookie-authenticated sockets, local/city chat, DM request consent/decline, blocking, moderation, cross-shard DM delivery, actual presence | No first-friend opt-in/matching/consent/reply/reward ledger; do not fabricate presence or expose private rooms |
| Objectives | Resumable onboarding, optional aspirations and tutorial | No general persisted discovery milestones or compact next-action list |

## Compatibility and implementation order

Add schema, retain legacy tables/IDs/references, backfill payment records without replaying historical fulfillment. Preserve old unowned ad orders for moderation; only authenticated owners may inspect/manage new ones. Keep purchased land separate from advertising. No birth odds, saved balance, salary or top-up pack changes. Do not remove recreational games (Oware, phone games, dance/boxing). Audit employment-tagged gigs individually before retiring their minigame presentation.

Stages B–H follow payment reliability → ads → discovery → work → social → objectives → validation. No production deployment or destructive production migration.

## Economy proposal before implementation

Keep all salary ranks, grade multipliers, work hours, daily work budget and top-up packs unchanged. Workplace assignments improve existing performance/skills, without adding task cash or enabling the dormant 15% minigame salary bonus. General objectives award small one-time XP/badges only initially; no recurring cash. First-friend cash configuration defaults to **zero**: proposed GH₵1,000 is 125% of the GH₵800 hustler start (4% of GH₵25,000 dbee), and recipient GH₵500 is 62.5% (2%). These are substantial faucet increases and need production economy approval. Model proposed values as deployment configuration, keep disabled while reviewing abuse and inflation.

New ad inventory will use existing weekly price bands and durations; document placement specifications and explicit prices before enabling booking. Prices are real GHS advertising rentals, independent of game-money land ownership.

At the proposed reward ceilings, an account could receive GH₵1,000 for its own first conversation plus up to GH₵1,500 for three eligible welcomes: GH₵2,500 total, 312.5% of a hustler start. GH₵1,000 equals 20 entry trader shifts at the current GH₵50 rate. This is why production cash remains disabled pending an economy and abuse review.
