# Stage 2 compatibility contract

Implementation blueprint; no property feature is claimed complete here. This
contract records the integration decisions before new ownership code is written.

## Preserve legacy assets

Keep `state.home`, `owned`, `items`, rent advances, arrears and the existing home
purchase path unchanged. No automatic conversion of per-player tier ownership
into finite shared units. Personal groceries, fuel, vehicles and clothing do not
transfer with a unit. An explicitly selected new primary residence must not
silently terminate an existing rent obligation. The UI must disclose that.

New finite catalogue units, ownership, primary selections, unique furnishing
assets, listings and immutable transactions use additive SQL tables. No existing
table or row is removed. All financial actions reuse the current account
reservation, PostgreSQL locks, exact-payload receipts and life journal.

## Ownership and resale

Lock the requesting player, property, active listing and installed assets in a
consistent order. A resale debits the buyer, changes the unit owner, transfers
included unique furnishings, moves excluded furnishings into seller storage,
closes the listing and inserts one durable seller credit in one transaction.
Deliver the existing credit mechanism only after commit. Do not rewrite an
offline seller's JSON. Replay returns the original receipt without repeating
credits, ownership or notifications. Freeze alterations while listed. Reject
listing a primary residence until explicit relocation. Reject selecting a listed
unit as primary. Retain asking/base/estimate/actual price as distinct values.

## Rooms and home actions

Saved unit locations are candidates, never access grants. Before welcome and
arrival, resolve access from SQL. Use room bases containing unit ID and monotonic
access revision, isolating a new owner from stale seller/tour rooms even if Redis
invalidation is missed. Ephemeral room capabilities are account/session-bound
and expire; renew in a bounded worker and fail closed on denial/unavailability.
Every consequential unit action must reread locked ownership/listing/revision.

Reuse `msg.home` and `homeSpec` for authorized interior rendering. Supply an
explicit unit name, template, furnishings, theme, permitted actions and exit.
Tours do not grant owner-only progression or furniture controls. Keep character
loading and production untouched. Existing server movement validation remains.

Add an explicit trusted residence context to home-action eligibility/power checks.
Persist an immutable snapshot of verified comfort and bed/AC/fridge benefits on
started activities. Completion uses that snapshot. Do not temporarily overwrite
and restore legacy `home/items`: returned state, exceptions and delayed completion
could otherwise leak synthetic ownership. Old busy records retain legacy behavior.

Unit travel must use existing geographic coordinates, fare/rush logic and timers,
with access rechecked at arrival. The compact map is only display geography.
Preserve saved `place:null` while valid travel is pending; ordinary migration
currently resets unknown/null locations. Keep an explicit legacy-home option.

## Pricing boundary

Only four existing purchase prices are available: Osu GH₵1,600,000, Airport
Residential GH₵3,200,000, East Legon GH₵4,200,000 and Trasacco GH₵25,000,000.
Those values must remain unchanged. Nima, Jamestown, Kaneshie, Labadi and new
commercial units have no approved purchase prices. Their purchase price stays
nullable/disabled pending reviewed configuration. Do not derive a rent multiple
or silently add affordable-house prices as an economic rebalance. Disposable
local integration fixtures may configure explicit test prices; these are not
production defaults or natural progression evidence.

## Acceptance gate

Require two-player actual inspection/timed travel/tour/purchase/furnishing/
renovation/listing/transfer/reload evidence and database races. Test exact replay,
lost receipt, uncertain commit, offline credit, furnished/unfurnished conservation,
primary/listing races, expiry/cancellation/relisting, access revocation during
travel and inside, missed Redis invalidation, forged IDs/revisions/capabilities,
per-unit benefits without legacy-item leakage, and five portrait/landscape layouts.
No public deployment, real payments or production migration is authorized.
