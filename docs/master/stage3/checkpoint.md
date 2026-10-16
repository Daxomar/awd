# Stage 3 — vehicle ownership, customization and resale

Local implementation and authenticated two-player acceptance pass. Exact-commit
CI is pending. This checkpoint does not mark the whole master program complete.

## Audit of the existing vehicle system (unchanged)

One car per player in saved state (`state.car`), four catalogue models (Toyota Vitz
GH₵95,000, Corolla GH₵180,000, Prado GH₵1.1M, G-Wagon GH₵4.5M), new purchase at
Correct Cars with a 60% trade-in and a one-time reputation bonus, fuel, a 24-hour
Vitz rental, and the `car` travel mode. None of these rules, prices or the trade-in
changed. The game has no condition, mileage or vehicle physics; none were invented.

## Features completed

- **Player car market** (phone app *Car market*, also linked from *Cars*): your car,
  paint, sell-to-players form and every live player listing.
- **Escrow listing.** Listing moves the car out of the seller's saved state into
  SQL escrow (`vehicle_listings`) with its paint, so an offline seller's saved game is
  never rewritten and a listed car cannot be driven or listed twice. 72-hour expiry;
  the seller collects an unsold or expired car at any time.
- **Atomic purchase.** The buyer pays through the ordinary goods path (car prices
  exceed MoMo's GH₵50,000 transfer cap). In one transaction the buyer is debited,
  receives the car with its paint, the listing closes and one durable seller credit
  is written; delivered through the existing claim path, offline or online.
- **Safeguards.** Exact-payload receipts and row locks; one open listing per seller
  (unique index); both accounts eligible and at least six hours old; busy, travelling,
  working or jailed players cannot trade; a buyer must not already own a car; forged
  IDs rejected. **Anti-laundering price band:** a used car sells for 40–100% of its
  catalogue price. **No reputation bonus** on resale, so trading cannot farm rep.
- **Cosmetic customization.** Eight allowlisted free paints (including factory). Paint
  shows on your car on every drive (ride scene) and transfers with a sale. It has no
  effect on value, reputation or travel.

## Existing systems reused

Phone escrow listing pattern (`life-commerce.js`), `withMoney`, `life_requests`
receipts, life journal, `credits`/`Social.claim`, `ledger`, the generic life phone
screen, ride scene vehicle colours.

## Exact files

Server: `src/life-vehicles.js` (new), `src/life-service.js` (section, ops, migration),
`loadtest/vehicle-db.test.js` (new), `loadtest/vehicle-fixtures.js` (new, QA only).
Client: `src/v2/phone/life.js` (car market screen), `src/v2/phone/apps.js` (app and
link), `src/v2/scene/ride.js`, `src/v2/ui/travel.js`, `src/v2/main.js` (paint on rides).
Tools/CI: `tools/vehicle-browser-test.py`, `.github/workflows/ci.yml`.

## Database changes

Additive: `vehicle_listings` (+ one-open-listing-per-seller unique index and a market
index). New saved-state field `carStyle` (absent = factory colour). No existing row,
balance or car is converted.

## Tests executed

| Suite | Result |
| --- | --- |
| Server `npm test` | 85 / 85 pass |
| Client `npm test` | 84 / 84 pass; production build passes |
| `loadtest/vehicle-db.test.js`, real loopback PostgreSQL 17, fresh schema | 8 / 8 checks pass |
| Journey E, two authenticated players in the browser | 9 / 9 checks pass ([journey-e.json](journey-e.json)) |

Database checks: allowlisted owner-only paint; price band (71,999 and 180,001 rejected
for a Corolla, non-integers and strings rejected); escrow once with receipt replay;
forged/self/non-seller/second-car purchases rejected; two simultaneous buyers → one
transfer with paint, one debit, no rep, one offline credit; offline claim exactly
once; cancel and expiry return the car and close the listing; busy/custody blocked;
migration rerun preserves listings; every wallet change reconciles to the journal.

Journey E: seller repaints a Vitz Black Star gold → lists at GH₵40,000 (car leaves
the garage) → buyer sees the listing (58% below new) → buys → owns the gold Vitz →
drives it (gold car rendered on the road) → seller credit claimed once. Journal shows
buyer −40,000 and seller +40,000 exactly once.

Evidence: `e1-seller-car-market.jpg`, `e2-buyer-listing.jpg`, `e3-driving-gold-vitz.jpg`.

## Known limitations

- One car per player remains the existing rule; a buyer with a car must sell or trade
  it first. Multi-car garages would be a separate, approval-gated change.
- No listing fee (no new currency sink was introduced without approval).
- The QA fixture grants a car and funds only to generated `p8*` accounts in the
  disposable database; production has no such path.

## Approval needed

None for activation. Optional: approve a small marketplace fee as a currency sink.

## Next stage

Stage 4 (camera, movement and immersive interiors) can begin.
