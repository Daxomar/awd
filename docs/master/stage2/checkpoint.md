# Stage 2 — purchasable buildings and the property economy

Local implementation and authenticated two-player acceptance pass. Exact-commit
CI is pending. This checkpoint does not mark the whole master program complete.
Started by Codex (backend, phone screen, database suite); integrated, wired into
the live game, fixed and verified by Claude after the handover on 2026-10-16.

## Features completed

- **Finite catalogue.** 18 SQL units (`world_properties`): two per existing home
  template plus two commercial units, at stable IDs `awd-<home>-NN` and
  `awd-<home>-commercial-NN`, each with neighbourhood, world position, class,
  template interior, finish, upgrades, revision and last sale price. Catalogue
  size is configurable (1–4 per template).
- **Ownership separate from legacy homes.** `state.home`, `owned`, `items`, rent
  and the original home purchase path are untouched. Players may own several units
  and choose one as primary (`property_residences`) without ending existing rent.
- **Inspection and tours.** The Property phone app (Explore / My units / Storage)
  shows location, class, interior, base price, estimate, asking price, last sale,
  owner status, finish and furnishing. Unowned catalogue units and live listings
  can be toured; travel uses the existing geographic fare and real journey timer.
  Tours render the real furnished room without owner actions or furnishing.
- **Unit rooms in the live game.** A unit place is only a candidate until SQL
  grants access. Rooms are keyed by unit and access revision (`prop:<unit>@<rev>`),
  so a sale, listing change or delisting isolates stale tours. Access is resolved
  at login, on arrival and by a 10-second lease renewed from SQL in the shard tick;
  ownership changes recheck occupants immediately and fail closed (walk out).
- **Furnishing and renovation.** Supported furniture is bought as unique SQL assets
  (`property_furnishings`), installed per unit, stored and reinstalled. Three
  predefined free cosmetic finishes. The room re-renders in place with new furniture
  and finish. Owner home activities inside a unit use the unit's own furniture
  through an immutable benefit snapshot; legacy items never leak into units.
- **Resale.** Owners list with asking price, 24/48/72-hour expiry and furnished or
  unfurnished sale (exact asset IDs snapshotted). Purchase atomically debits the
  buyer, transfers the unit, moves included assets to the buyer and excluded ones to
  seller storage, closes the listing and inserts one durable seller credit, all in
  one transaction with the existing receipts and journal. Cancellation, expiry and
  relisting are supported; listing freezes furnishing, finish and primary changes.
- **Valuation** keeps base, estimate, asking and actual transaction prices
  distinct; furnishing spend does not raise the estimate.
- **World discovery.** Every neighbourhood street offers *Property in this area*,
  opening the catalogue filtered to that neighbourhood. Inside a unit, *Manage
  property* / *Property details* opens its page.

## Existing systems reused

`withMoney` account reservation, PostgreSQL row locks, `life_requests` exact-payload
receipts, life journal, `credits` + `Social.claim` delivery, `Game.travel` fares and
timers, `homeSpec` interiors, room/shard presence, phone window framework.

## Exact files

Server: `src/game/property-model.js`, `src/property-store.js`, `src/property-service.js`,
`src/property-context.js`, `src/properties.js`, `src/life-service.js`, `src/life-game.js`,
`src/game/rules.js` (unit place candidates, residence context for home actions),
`src/shard.js` (unit rooms, admission, lease renewal, change rechecks),
`test/property-model.test.js`, `loadtest/property-rules.test.js`,
`loadtest/property-db.test.js`, `loadtest/property-fixtures.js`, `package.json`.
Client: `src/v2/phone/property.js`, `src/v2/phone/property.css`, `src/v2/phone/apps.js`,
`src/v2/scene/property-room.js`, `src/v2/scene/world.js`, `src/v2/ui/venue.js`,
`src/v2/main.js`, `test/property-room.test.js`, `package.json`.
Tools/CI: `tools/property-browser-test.py`, `.github/workflows/ci.yml`.
Docs: `docs/master/property-compatibility.md`, this folder, `program.md`, `work-items.json`.

## Database changes

Additive only, created by the existing startup migration path: `world_properties`,
`property_furnishings`, `property_residences`, `property_listings`,
`property_transactions` (+ indexes, one-open-listing and one-installed-item-per-type
unique indexes). Catalogue rows are inserted with `on conflict do nothing`. No
existing table, row, balance or saved place is removed or converted.

**Pricing boundary preserved.** Only the four existing purchase prices are used
(Osu GH₵1.6M, Airport Residential GH₵3.2M, East Legon GH₵4.2M, Trasacco GH₵25M).
Nima, Jamestown, Kaneshie, Labadi and commercial units stay unpurchasable until
reviewed prices are approved (see approvals below). The browser journey priced one
Nima unit at GH₵5,000 **only in the disposable QA database** via
`loadtest/property-fixtures.js`, which refuses any other database.

## Tests executed

| Suite | Result |
| --- | --- |
| Server `npm test` (includes 12 new property model/rules tests) | 85 / 85 pass |
| Client `npm test` (includes 3 property room tests) | 84 / 84 pass |
| Client production build | pass |
| `loadtest/property-db.test.js`, real loopback PostgreSQL 17, fresh schema | 11 / 11 checks pass |
| `tools/property-browser-test.py`, two authenticated players, clean run on `awd-nima-02` | 16 / 16 checks pass |
| Property screen at 375×812, 390×844, 430×932, 390×530, 844×390 | no horizontal overflow; 44 px minimum touch targets |

Database checks: exact receipt replay, simultaneous catalogue buyers (one debit),
unique assets without legacy-item leakage, forged owner/unit/asset IDs, listing
freezes and revision invalidation, two concurrent resale buyers with exact asset
transfer and one offline seller credit, offline claim exactly once, unfurnished
asset conservation, primary/list contention, expiry/cancel/relist, migration rerun
and wallet-to-journal reconciliation.

Browser journey D (clean run): inspect → buy → taxi into the unit → install mattress
and TV, apply coastal finish (room re-renders live) → owner nap inside the unit →
walk out through the property door → list furnished at GH₵6,000 → second player
tours (no owner actions) → buys → furnishings transfer → former owner loses entry →
buyer reloads inside with ownership → seller credit delivered once. Wallets
reconcile exactly: buyer −6,025 (6,000 + 25 fare); seller −6,026
(−5,000 −3,800 −3,200 −26 fare +6,000). [journey-d.json](journey-d.json).

## Evidence

`d1-inspection.jpg`, `d2-empty-unit.jpg`, `d3-furnished-coastal.jpg`,
`d4-buyer-listing.jpg`, `d5-buyer-tour.jpg`, `d6-new-owner.jpg`,
`street-interact.jpg`, `street-property-listings.jpg`, `layout-*.jpg`, `layouts.json`.

## Regressions found and fixed during integration

- Commercial unit places (`awd-osu-commercial-01`) failed the place pattern in both
  the saved-place migration and room admission; the pattern now accepts them.
- A verified journey starts the ride and closes the phone before its confirmation
  arrives; the closed screen ignored the confirmation and left a stale saved action
  that would offer "retry" on the next open. A closed screen now retires its
  confirmed reference.
- The tour adapter's added door mat had no action list, so "no home activities on
  tour" was not strictly true; it now has an explicit empty list (test fixed).

## Performance

No new per-frame work. Unit rooms reuse existing interiors. The lease renewal is one
indexed SQL read per occupant every ~5 s. No phone FPS claim (SwiftShader only).

## Known limitations

- Purchase prices for Nima, Jamestown, Kaneshie, Labadi and commercial units are
  not configured (approval needed); with natural balances only Dbee-scale players
  can afford the four priced tiers.
- No exterior improvements beyond interior finishes; no structural changes (by design).
- Visitor limits and invitations to owned units belong to Stage 7 (house visits).
- Cross-shard occupancy relies on the 10-second lease rather than a bus broadcast.
- Commercial units can be owned and toured but have no business integration yet (Stage 9).

## Approval needed

Reviewed purchase prices for the five unpriced neighbourhood classes and the two
commercial units. Until approved, they remain unpurchasable in production.

## Next stage

Stage 3 (vehicle resale) can begin: it reuses the same receipts, locks, credits and
listing patterns.
