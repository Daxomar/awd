# Stage 0 — verified repository baseline

16 October 2026. Complete for starting Stage 1. Baseline HEAD
`6d61381f6255e06f46395cf08079fa9d453d2285`, branch `main`. Only `.claude/`
was untracked before this program; character changes had been committed by the
parallel workstream. No character source/runtime/assets were edited by this audit.

## Findings and feature inventory

| System | State | Evidence / required redesign |
| --- | --- | --- |
| Authentication, rate limits, leases, authoritative actions | Working and verified | Current server suite; existing production-cookie authenticated QA session |
| Phase 8 journal, business/trade/relationships | Working and verified | Current rule tests plus [exact-code integration/browser/Docker record](../../phase8/validation.json); not claimed re-executed in this audit |
| Careers | Working but requiring redesign | 19 catalogue careers; attended-hour salary and saved assignment history verified in Phase 8; new training/short work/auto-work missing |
| Geographic city | Working but requiring redesign | Authenticated screenshots and diagnostics; 68 districts, 77,171 roads, 65,560 decorative buildings |
| Public destinations and local streets | Working but requiring redesign | 55 authoritative IDs; rooms/actions/estates retain existing entry rules; most scenery not interactive |
| Homes and furniture | Working but requiring redesign | Eight legacy templates; existing rental/ownership/items; no finite shared property-unit market |
| Multiple legacy home tiers | Partially implemented | `state.owned` can retain tiers, active `state.home`; not transferable individual units |
| Property tours, renovation packages and resale | Missing | No unit catalogue, listings or furnished ownership transfer |
| Vehicles and travel | Working but requiring redesign | Four vehicle tiers; one selected legacy `state.car`, automatic trade-in; no peer resale/cosmetics |
| Elevated camera and local movement | Working but requiring redesign | Existing orthographic Stage and room navigation; no complete third-person mode |
| HUD introductory objectives | Partially implemented | Existing compact objective hint and phone view; discovery must be tested/reworked under Stage 6 |
| First Friend and DM consent | Working but requiring redesign | Existing backend/phone, one-time protections; real discovery HUD flow remains to implement |
| Dating/shared activities/private visits | Working and verified | Phase 8 real-cookie journeys and integration record; gatherings and privacy profiles remain |
| Community event scheduling and attendance | Missing | Match predictions/venue activities are not a general events platform |
| Contextual personal life events | Missing | Existing story/daily scaffolding does not satisfy persistent curated contextual decisions |
| Ambient street activity | Partially implemented | Existing limited vendor/screen effects; no bounded city-wide ambient schedule/pool |
| Player business frontage | Missing | Three durable numerical operation types; phone management, no public frontage |
| Ads/payment transactions | Working but requiring redesign | Existing signed provider verification, reservations, receipts, exposure estimates and integration evidence |
| Standalone advertising checkout | Partially implemented | `/advertise.html` is currently a signpost into Phone → My Ads, not actual standalone checkout |
| Eligible automatic ad activation | Missing | Current booking separates payment verification from manual artwork approval |
| Separate administration | Partially implemented | `/admin.html` only lists ad orders using a shared admin key; no scoped roles/audit/operations dashboard |
| Physical-phone and large population performance | Missing validation | Desktop software rendering does not establish device FPS or scale |

## Existing systems reused and exact files

The [program integration guide/checklist](../program.md) maps dependency order and
entry points. [inventory.json](inventory.json) records exact destination IDs,
original metre coordinates, economy tables/hash, aggregate ownership and all 44
database table counts. Existing Phase 8 additive life tables are present. No schema
or saved-player record was changed. No live payment or production request was made.

Audit artifacts: this checkpoint, `inventory.json`, `browser.json`, `home.jpg`,
`city-normal.jpg`, `city-overview.jpg`, `docs/master/program.md`, the user brief
copy and `tools/master-inventory.mjs` / `tools/master-world-browser-test.py`.
The browser helper uses an existing isolated disposable fixture, not a real player.
Its audit journey is read-only; normal authenticated persistence remains enabled.

## Tests and actual gameplay evidence

- Current client tests: **74 passed, 0 failed/skipped**.
- Current server tests: **73 passed, 0 failed/skipped**.
- Production build passed: main JS **553.21 kB / 200.50 kB gzip**.
- Authenticated home/map capture passed with **zero page errors**.
- Existing baseline screenshot inspected: tiny repetitive buildings dominate;
  important destination icons and arterial corridors remain available.
- No regression discovered in baseline tests. Initial command-output directory
  was missing; created it and reran both suites before recording passes.

Evidence: [home](home.jpg), [normal map](city-normal.jpg),
[overview](city-overview.jpg), [raw browser measurements](browser.json).

## Performance and limits

On this local Windows desktop using Chromium/SwiftShader, pixel ratio .5 and
paced rendering: map ready **7,869.10 ms**, geometry **68,670,948 bytes**, scene
meshes **2,152**, visible meshes **373**, sampled render **64 calls / 401,772
triangles**. Cold page-to-map journey **36.888 s**, including authentication,
character/room loading and screenshot time; not isolated scene-load duration.
No physical-phone FPS, production capacity or indefinite memory-leak claim.

## Approval and next step

No approval needed for the non-destructive compact presentation. Stage 1 can
begin. Preserve all 63 venue/home-template anchors and keep original geography
available. Pricing, wages, travel and saved state are outside this visual change.
Later stages must still meet the owner's explicit economic/release boundaries.
