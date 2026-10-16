# Phase 8 — interconnected life systems

16 October 2026. Local implementation and validation milestone. No public
deployment, live payment activation, Phase 6/7 implementation or Phase 9.
Character art and the Blender pipeline are a separate, concurrent workstream.

## 1. Initial gameplay audit

See [the pre-implementation audit](audit.md) for the verified system matrix,
dependency diagram and compatibility/economy contract. The baseline was 9434241.
[The inventory](initial-inventory.json) records the existing schema and catalogue:
19 careers, ten skills, eight home types, ten passive investments, household
items, existing destinations/actions and the twelve introductory objectives.

The main gaps were financial actions acknowledged before periodic persistence,
lost career history, passive investments without an operating model, no escrow
market, and relationships whose consent/status was not durably coordinated.

## 2. Existing systems reused

Retained the room/shard architecture, real server clock, physical workplace
assignments, schedules, salary and promotion tables, six needs, traits, skill
growth, inventories, property IDs, rent/ownership rules, old investments,
transport, phone games, DMs, blocking, cookies, account leases, First Friend,
advertising and Paystack. The original twelve milestone IDs/rewards remain.

## 3. Architecture changes

Added small ES modules rather than a replacement engine or application framework:

- `life-progression`: additive career/reputation/legal state and bounded events.
- `life-journal`: permanent financial/life facts and action receipts.
- `life-game`: transactions around existing consequential game rules.
- `business-model` / `life-business`: bounded demand and durable operations.
- `life-commerce`: controlled existing-phone escrow and existing seller credits.
- `life-social`: consent, exclusive partners and shared activity sessions.
- `life-service`: authenticated dispatch, idempotency and scoped phone summaries.
- Client `phone/life`: Business, Trade, People, Finances and career development.

Player JSON remains authoritative alongside the new operation tables. The journal
is an audit trail, not a migration to event sourcing. Financial consequences,
receipts, inventory changes and player state commit together. Normal needs and
movement retain the existing lightweight lifecycle.

## 4. Careers

All 19 careers retain their five ranks, four grades, skill requirements, schedules,
pay bands, attendance and physical assignments. The career view explains the next
promotion requirements and current progress. Completed assignments and paid
shifts build bounded professional/workplace reputation and recorded history.

Changing jobs retains the previous career's grade, rank, performance and shifts;
reapplying to the same job cannot reset it. A job cannot be changed during a
shift/activity. Top rank no longer displays undefined next-rank requirements.
Existing salary/grade/promotion values are unchanged.

Reconnection retains recorded attended minutes/completed assignments and pauses
unattended work. It clears an incomplete assignment and resets its attendance
clock; offline time earns no salary, skill or performance. A completed salary is
committed before acknowledgement and cannot be claimed a second time.
Normal attended work and needs now mark state for the existing 30-second batch
save even when a tick emits no action result. This fixes a verified gap where
uninterrupted attendance could remain unsaved until the next explicit action.
Financial completions still commit immediately; a crash may lose up to one normal
save interval of nonfinancial progress, never create an extra salary.

## 5. Skills

Preserved all ten field names and their 0–10 bounds, existing diminishing growth,
traits, career gates and activities. Development explains each skill's existing
effect. Relevant existing skills also modestly affect managed business demand;
business sales give at most 0.1 raw growth per settlement before the normal skill
growth formula. A client cannot submit an arbitrary level or earned experience.

## 6. Business ownership

New managed operations coexist with all ten old Invest products. Two operations
per owner, one of each type; no legacy business conversion or confiscation.

| Operation | Startup, including GH₵30 reserve | Unit cost | Suggested / maximum price | Initial capacity | Open-period expense |
| --- | ---: | ---: | ---: | ---: | ---: |
| Provision stall, Makola | 450 | 8 | 12 / 16 | 80 | 2 |
| Small food joint, existing food venues | 900 | 12 | 22 / 30 | 60 | 3 |
| Phone-accessory counter, Circle/Oxford | 1,500 | 25 | 40 / 55 | 40 | 4 |

These are game-money operations managed through the existing phone and existing
locations. They do not add autonomous NPC customers, store interiors or walking
shopkeepers. Customer demand is explicitly labelled simulated in the UI.

## 7. Operations and statements

Owners buy wholesale stock, choose a bounded whole-cedi selling price, open/close,
fund reserves, settle, withdraw and earn one expansion. Demand depends on price,
location, relevant skill, business reputation, opening hours, stock and a stable
business/period noise value. No stock means no sales; an open empty shop still
pays operating costs. Insufficient reserve pauses trading. Closing retains cash
and stock. Expansion requires 25 actual sales and operating profit of at least
half the startup cost, plus the displayed expansion cost.

Settlement covers complete six-hour periods only, at most eight periods (48h).
Older missed periods are skipped; reopening cannot mint unbounded offline money.
Unique business/period records prevent duplicate settlement. There is no inactive
business tick loop. Statements show revenue, COGS, gross profit, operating costs,
startup/expansion expenses, net profit, stock purchases and recent cash movements.
Unsold stock is an asset, not revenue. Personal wallets and tills are separate.
Returned operating capital is not counted as earned income; positive operating
profit withdrawals enter the existing income/tax accounting.

## 8. Player commerce

Trade supports genuine tested/repaired Circle phones already present in the game.
Listing removes the exact owned phone into PostgreSQL escrow. A row-locked purchase
debits the buyer's MoMo plus the existing fee, moves that phone and creates one
existing durable seller credit in the same transaction. Delivery can be retried
after disconnect without duplicating the item or payment.

Both accounts must meet the existing six-hour age requirement. Existing MoMo daily
amount/count limits remain. Three open listings, four-phone inventory, 24h expiry,
bounded prices, no self-buying and no banned seller. Owners collect unsold/expired
escrow once. There are no invented gifts, currency cash-out, real-money trading or
generic transfers of unverified inventory. Circle NPC resale is now limited to
eight phones per Accra day, at least one minute apart, closing the instant-repeat
resale loop without editing phone prices.

## 9. Relationships and social activities

Friend requests require meeting in one existing public room and explicit
acceptance. Pending requests expire, unanswered requests are bounded and declined
or removed friendships have a quiet period. Existing reciprocal friendships and
partners are backfilled without resetting points or resurrecting removed rows.

Romance is optional, respects opt-out/blocking and needs mutual friendship and
35 points. Dating/engagement acceptance persists atomically; each account can have
one partner. A proposal consumes an actual owned ring only on acceptance. Either
person can end a relationship or friendship even if the other is offline/busy.
Duplicate ring purchases no longer silently consume money for a boolean item.

Shared conversation/date, an existing menu meal, and existing exercise use actual
venue capabilities and prices. Both participants accept and stay in the original
room for 30 real seconds. Completion charges both accounts together and applies
the existing activity's needs/skill effects. Leaving, reconnecting, blocking,
unavailability or a failed completion cancels without charging. Session/room
identity prevents reconnect rewards. Friendship gain is capped at 30/day; simple
socials are paced per pair. There is no cash reward for messaging or invitations.
DM requests, existing Oware/phone games, reporting and privacy settings remain.

## 10. Crime and policing

Retained abstract existing crime actions, heat, fines, custody and existing bail
rules. Outcomes are server-decided; displayed detection risk is clamped to 5–92%
(high skill could previously make it negative). Loot, fine bands and cooldowns
are unchanged. No victim/target player field is accepted.

Legal history records attempts, detections, actual fines and review expiry. A
detection places a maximum 24h review on new banking/police applications, without
deleting an existing job. Community service at the existing police desk reduces
review by six hours and heat by eight, with a once/day cooldown and no cash.
There are no autonomous patrols, procedural crime instructions or player theft.

## 11. Housing, possessions, needs and finance

Preserved eight home IDs, comfort, advance, ownership, rent, arrears, bed benefit,
loans, savings and offline need floors. Cooking eligibility is checked before
spending groceries/ingredients. A fridge improves stored-grocery hunger recovery
by 10%; AC improves sleep-energy restoration by 10%. Shop descriptions match
these effects. Existing prices are unchanged.

Delivered furniture rebuilds the current home for owner/visitors. Moving between
home types rebuilds the room even though the place string remains `home`. Private
visits require reciprocal accepted, unblocked friendship and the owner at home;
access is checked at departure, arrival and while visiting.

Finances shows cash/MoMo, fixed savings, current housing obligation, arrears, loan,
permanent new transaction history and nonduplicated earlier JSON history. Rejected
actions do not spend money. No complicated medical system was added.

## 12. Long-term objectives

Added twelve optional goals beside the original twelve: career attendance,
promotion, skill development, savings, managed startup/sale/profit, player trade,
mutual friendship, shared activities, home ownership and a vehicle. They read
server state/events and award one-time 15–25 XP/badges, no cash. Introductory and
long-term views are separate tabs; the HUD remains focused on onboarding.
Existing voluntary aspiration currency rewards remain unchanged and now use the
durable transaction path, as do due existing match-prediction outcomes.

## 13. Hustler/Dbee economic simulations

[Reproducible results and assumptions](economy-simulation.json): 300 runs, 28 days,
30 deterministic trials per start/playstyle. Natural GH₵800/GH₵25,000 totals,
unchanged first eligible homes (Nima/Osu), entry Tech wage GH₵150, valid weekdays,
no promotions/top-ups/social cash/speculative player demand. Employment attends
five shifts/week, business three, social two, mixed four, casual two visits/shifts.
The model includes basic food/data, capped offline meals, rent, salary tax and
the actual bounded provision-demand function. Missed rent is counted without
simulating eviction/relocation. It is a budget stress test, not a full needs model.
Both starting wallets afford the GH₵28 basic meal/data benchmark immediately;
the simulation also records later days below that cost. The GH₵960 Jamestown
advance benchmark is an upgrade from Nima and a cheaper option than Dbee's Osu
start; it is not presented as a Dbee housing upgrade.

| Style | Hustler mean wallet after 28d | Dbee mean wallet | Hustler mean missed rents |
| --- | ---: | ---: | ---: |
| Employment | 794.00 | 19,034.00 | 0 |
| Business | 1.87 | 17,943.47 | 1.83 |
| Social | 2.00 | 17,234.00 | 3 |
| Mixed | 350.60 | 18,543.47 | 0.27 |
| Casual | 561.60 | 18,801.60 | 0 |

The economy is **not claimed balanced**. The wealth gap remains large; a small
stall supplements employment and cannot replace it at these costs. Daily return
food costs are harsh for low-income social/business play. Dbee premium rent draws
down capital despite profitable trading. Housing affordability, stock, salary,
outflows, operating profit, days below meal cost and equal-cohort concentration
are included in the JSON. Equal-sized cohorts are not the game's birth odds or a
real player wealth-distribution estimate. The simulation excludes startup rent
advance and discretionary spending, so it is not a promise of player outcomes.

## 14. Additive database migrations

New tables: `life_events`, `life_requests`, `life_businesses`,
`life_business_events`, `life_listings`, `life_relations`, `life_partners`,
`life_shared`, `life_shared_members`. New columns `taxable`/`terms` are additive.
Indexes cover own-account history, market status/expiry, business owner,
relationships and active shared sessions. Migrations are idempotent; the legacy
relationship import tolerates absent/malformed old fields and uses conflict-safe
inserts. No existing IDs, balances, birth values or Paystack schemas are replaced.

[Local save compatibility](save-compatibility.json) passes: complete-record hashes
and counts match before/after migration across fifteen protected tables, including
all 103 accounts and 103 saved players. Full player JSON, appearance, possessions,
birth fields and financial records were compared; only player update metadata
was excluded. There are zero invalid wallets. The original local preview on
port 8080 now runs Phase 8 using its existing session and birth secret files.

See [deployment/operations notes](operations.md). Rolling back code must retain
these tables and escrow/credits; dropping them would destroy owned possessions
and audit facts and is not authorized. Backups and a reviewed release window
remain required for public deployment.

## 15. Transaction security

Existing cookie/origin/rate/account-lease controls remain. Financial actions clone
state and reserve the live account, wait for an in-flight save, lock PostgreSQL
rows, validate ownership/eligibility, persist events and state, then acknowledge.
Multi-account operations reserve participants and lock player rows in ID order.
Wallet checks reject negative/nonfinite amounts. An error rolls back state,
inventory, stock and financial facts together.

New actions require UUID receipts bound to the exact payload; ordinary updated
gameplay requests also carry receipts. Reusing a key with another payload fails.
The phone retains an unconfirmed action per account and offers safe retry after
timeout/reload. Legacy clients retain existing semantic guards. If COMMIT succeeds
but its reply is lost, the account is disconnected for canonical reload; stale
memory cannot flush over the committed result. A transient session-verification
failure disconnects with retry code 1013; a verified invalid/revoked session still
ends with terminal 4003. No request proceeds without fresh authentication.

## 16. Multiplayer behavior

Preserved presence, room movement, DMs, cross-shard credit delivery and all phone
games. Trade can use offline sellers through durable existing credits; social
activities require live co-location in one shard. No offline peer JSON overwrite.
One bounded shared-activity worker runs per shard, every two seconds with at most
100 candidates. Account queues are bounded; status reads wait behind an existing
transaction rather than causing a deliberate phone action to fail. Failed joins
release their account lease and remove partial presence entries.

## 17. Automated tests

[Validation](validation.json) contains the actual run outputs and their scope.
The local server suite passes 73 tests; the clean client candidate passes 60 with
zero skips. Existing database regressions pass: payments 9, advertising 9, First
Friend 10 and introductory objectives 6. Phase 8 adds 28 integration scenarios,
including competing buyers, rollback, replay, expired escrow, mutual acceptance,
offline rejection, exclusive partners, room departure, real shared-meal charging,
insufficient funds at completion, lost COMMIT confirmation, loading-account and
internal-queue protection, notification replay and final wallet reconciliation.
That is 195 automated checks, plus the separately reported 300 simulation runs.
Production build passes; client and production-server dependency audits report
zero vulnerabilities. [CI run 38919631137](https://github.com/Daxomar/awd/actions/runs/38919631137)
passes on Phase 8 code commit `243f295918bf8c097a29b0253e9c63f1974c9f84`,
including the full Docker stack, cookie-authenticated HTTP/WebSocket smoke and
proxy health. An earlier integration assertion incorrectly assumed positive net
profit; it was replaced with exact stored-profit reconciliation and a separate
zero-income capital contribution/withdrawal check. The successful run includes
that stronger test. Concurrent character commits are a separate validation scope.

The clean candidate uses committed character assets from 1315e76. Concurrent
uncommitted Blender/runtime/asset-test edits are not weakened or included here.
Existing assertions remain; objective/destination tests explicitly account for
the requested new goals and the single new police-desk action.

## 18. Authenticated browser journeys

Fixtures use production-mode HTTP-only cookies against isolated loopback
PostgreSQL/Redis. The lottery supplies natural birth outcomes; starting wallets
are not boosted. Fixtures start after setup. Two-day wallet age enables trading;
guarded fixture-owned business periods exercise settlement. Salary and shared
activity browser timers use real elapsed time. No real provider requests/payments.
Integration fixtures separately use explicitly funded adversarial states and
expired/ready timestamps; they are not claimed as natural player progression.

| Journey | Actual exercise |
| --- | --- |
| A — Hustler career | Physical application and actual 90-second assignment; sixty real attended minutes pay the unchanged GH₵150 once. Attendance survives reconnect/server restart; skills and professional history persist; two reloads retain one salary and one completed assignment. |
| B — Entrepreneurship | Hustler funds a provision stall, buys stock, configures prices/open state, makes ten simulated sales, reviews expenses and withdraws till cash; reload persists it. |
| C — Commerce | Existing Circle phone purchase, escrow, Dbee buyer pays GH₵101 including GH₵1 fee; seller receives GH₵100 once and both reload inventories/finance. |
| D — Social | Same public room, mutual friendship, actual 30-second conversation, dating acceptance, reload, unilateral breakup and cancellation of another activity on reconnect. |
| E — Crime | Actual fictional pickpocket outcome: detection, GH₵240 fine, separate legal history and saved finance. No random outcome was forced in the browser. |
| F — Housing | Dbee travels, earns actual Circle gig income, returns home, buys/uses a cooker, checks expenses, pays GH₵960 Jamestown advance and sees the room rebuild; reload retains the item. |
| G — Reconnection | Real business contribution with deliberately withheld UI receipt, actual reload and safe same-key retry; completed career reconnect/restart and paid-result reload; shared-session disconnect with no extra reward. |
| H — Dbee | Existing career application, accessory operation/stock/sales/statement, real transport, mutual friendship/shared activity and saved career/business after reload. |

Some existing travel/phone-market actions use their ordinary authenticated game
protocol from the real page; phone management, consent, workplace and housing
interactions use the visible UI. The business fault test withholds only a UI
confirmation; its request, database commit, state broadcast and reload are real.

## 19. Performance and mobile UI

All five requested viewports pass without horizontal overflow: 375×812, 390×844,
430×932, 390×530 and 844×390. Ten repeated Finances open/close cycles keep the
same life subscriptions and 1,199 DOM nodes at start/end (peak 1,200). Browser
event listeners range 130–136 and finish at the initial 133. Forced-GC JS heap
changes from 49,987,796 to 50,145,560 bytes (+157,764); no sustained DOM/listener
growth was observed in this small sample. This is not an indefinite leak proof.
Measured status round trips: median 218.57 ms, nearest-rank p95/max 886.75 ms.

The final integration sample measures 687 PostgreSQL queries: median 0.94 ms,
p95 3.94 ms, max 2,896.01 ms (includes migration/setup queries). Forty-five life
actions: median 13.65 ms, p95 31.08 ms, max 176.54 ms. Two bounded settlement
samples take at most 20.76 ms. These are loopback samples with three main fixture
participants/two competing buyers, not a production-load or multi-shard capacity
certification. Raw measurements are preserved in validation.

Main build chunk: 542.21 kB, 196.77 kB gzip; existing Three/GLTF and icon/font
chunks remain separate. No new rendering/character-art dependency is introduced.
Lazy business settlement, indexed queries and the bounded shared worker avoid
continuous inactive-business simulation. Ordinary gameplay now shares the bounded
account queue so background phone reads cannot discard a travel/activity tap.

This 8 GB Windows host uses Chromium/SwiftShader, sampled low-pixel-ratio rendering
and paced animation callbacks. Later QA disables CSS animation/blur, WebGL shadows
and GPU compositing to avoid saturating the host. Game/network timers stay real.
Early overloaded runs exposed actual save/reconnect/queue defects, which were fixed;
their failures are not counted as passes. **No physical-phone FPS is claimed.**

## 20. Screenshots

Actual running-game evidence is in [the image directory](../images/phase8/).
Representative captures were opened and inspected for readable content, clipping
and misleading state. Small/landscape phone content scrolls inside the handset.
The diagnostics above apply; no design mockups substitute for gameplay.

- [Career and promotion eligibility](../images/phase8/career-promotion-eligibility.jpg), [skills](../images/phase8/skills.jpg).
- [Persistent paid shift](../images/phase8/career-paid-persistent.jpg), [saved career history](../images/phase8/career-persistent-history.jpg).
- [Business setup](../images/phase8/business-setup.jpg), [stock/pricing](../images/phase8/business-stock-and-pricing.jpg), [statement](../images/phase8/business-financial-statement.jpg).
- [Trade escrow](../images/phase8/trade-escrow.jpg), [purchase](../images/phase8/trade-purchase.jpg), [unconfirmed business recovery](../images/phase8/business-unconfirmed-reconnect.jpg).
- [Friend consent](../images/phase8/friendship-consent.jpg), [shared activity](../images/phase8/shared-activity.jpg), [persistent dating](../images/phase8/relationship-persistent.jpg).
- [Crime consequence](../images/phase8/crime-consequence.jpg), [owned appliance](../images/phase8/housing-owned-appliance.jpg), [new home](../images/phase8/housing-new-home.jpg).
- [Long-term objectives](../images/phase8/long-term-objectives.jpg), [Dbee business](../images/phase8/dbee-business.jpg), [small portrait](../images/phase8/mobile-390x530.jpg), [landscape](../images/phase8/mobile-844x390.jpg).

## 21. Exact files changed

See [the explicit Phase 8 file list](changed-files.txt). Concurrent character files
and their uncommitted asset changes are excluded from this milestone's commits.
No external assets or paid services were introduced. Existing Phosphor icons and
fonts retain their existing licences; no new media licence is required. Budget GH₵0.

## 22. Known limitations

- Economic stress results require balancing review; social-only play is not
  financially sustainable under the unchanged recurring-cost model.
- Managed demand is numerical; shops are phone-managed, not staffed by Phase 7 NPCs.
- Commerce supports the existing Circle phone inventory, not every item category.
- Shared meals/exercise use existing eligible public venues; no invented locations.
- Legacy paired gestures use shared-conversation consent; no new paired character
  animation is introduced in this systems milestone.
- Relationship interactions require a current shared shard; DMs/credits retain
  their existing wider delivery. Legacy asymmetric friendships need fresh consent.
- Financial/life audit tables and action receipts need a future retention/archival
  policy as population grows; this release does not erase financial receipts.
- Local contention produced timeouts during early runs. Recovery safeguards and
  bounded configurable connection waits were added; this is not load certification.
- Physical-device, sustained multi-shard/load and real-provider sandbox-release
  checks remain release work. Docker Desktop was unavailable locally; Linux CI
  passed the full container stack on the exact Phase 8 code commit linked above.
- No movement overhaul, autonomous NPCs, character redesign or Phase 9 is included.

## 23. Changes requiring separate approval

Public deployment, live payment activation, destructive migrations and any saved
data incompatibility still require explicit approval. Recommended economy review:
offline meal burden, basic wages versus recurring costs, viability of social and
business-first Hustler paths, phone resale margins, premium rent and long-term
wealth concentration. None of those existing prices/wages/birth odds was silently
changed here. Prior interim GH₵62 gig normalization retains its separate release
review boundary. No extra approval is needed to review or test this local work.
