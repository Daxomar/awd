# Stage 1 — compact, interactive city presentation

Local implementation and authenticated acceptance pass. Exact-commit CI is
pending. This checkpoint does not mark the whole master program complete.

## Features and systems reused

The default city view now uses fifteen authored neighborhood compositions,
55 real destination buildings and 115 subordinate background buildings. Eight
legacy home templates retain separate positions. Courtyard wings, commercial
frontages, apartments, gardens, offices, landmark silhouettes, connected corridors,
curbs, entrance paths, roof forms and glazing create a readable city presentation.
Estate/street entrances use gateways rather than pretending to be new houses.

Direct building taps and the existing icon/directory flow lead to the same real
destinations, transport choices and room interactions. Hover/focus names, filters,
presence and the complete destination directory remain. The camera frames a
neighborhood instead of magnifying one roof. The Region/City view switch fits in
the existing toolbar rather than covering short-screen gameplay.

The original 68-district OSM map, all 77,171 roads and its compiled building data
remain intact. Geographic geometry is loaded only on request and released when
returning to the compact view. A cancelled load cannot install a hidden geographic
scene after returning. Failed geographic fetches offer retry and compact return.

`shared/world-locations.js` specifies each stable ID, geographic/playable position,
type, opening schedule, server entry authority, ownership category, activities,
visual family, navigation destination and instance policy. Display positions never
enter fare calculations, database ownership or saved player coordinates. Capacity
and missing mappings fail explicitly so future content needs an authored mapping.

Reuse: CityKit batching, existing landmarks, geographic rendering/LOD, destination
catalogue, public-room/estate/home rules, map filters, DOM sheets, ad rendering,
cookie auth and travel. No rendering framework, asset download or paid service.
Original procedural geometry uses existing project code. Geographic attribution
and the existing OSM licence remain visible in geographic mode.

## Exact files and database compatibility

- `shared/world-locations.js`
- `client/src/v2/scene/city/compact.js`
- `client/src/v2/scene/map.js`
- `client/src/v2/scene/city/map.css`
- `client/src/v2/main.js` — map framing and building selection only
- `client/package.json`, `client/test/compact-city.test.js`
- `tools/master-world-browser-test.py`
- `tools/city-map-browser-test.py`, `tools/city-map-resources-test.py` — explicitly
  select geographic mode for their original geographic assertions, retaining them
- This checkpoint, validation/measurement files, screenshots and program log

**No database/schema migration or saved-data conversion.** All 55 destination IDs
and original coordinates, eight homes, birth values, salaries, vehicle prices and
transport settings compare exactly with Stage 0's public baseline. Character
production files, including concurrent human scripts, are excluded.

## Validation and evidence

[Validation record](validation.json). Client: **79 passed**, including five new
tests; server: **73 passed**. Production build passes: main JS **565.15 kB /
204.82 kB gzip**. Existing tests remain. New tests cover all live mappings, original
travel/economy invariants, connected topology, real destination activities, bounded
geometry, independent disposal and ray picking for every public building.

An isolated authenticated browser fixture exercises all 55 destination previews,
six neighborhood frames, compact/geographic switching and five viewport sizes.
The final browser record passes direct canvas building selection and complete
map disposal: all 53 referenced geometries and 23 instance buffers released, no
remaining map children and the active room retained. All five viewports pass
without horizontal overflow, with toolbar touch targets at least 44�44 CSS pixels.
There are zero page errors.

Before: [normal city](../stage0/city-normal.jpg), [overview](../stage0/city-overview.jpg).
After: [normal city](city-normal.jpg), [overview](city-overview.jpg), [Nima](nima.jpg),
[Osu](osu.jpg), [Airport Residential](airport-residential.jpg),
[East Legon](east-legon.jpg), [Trasacco](trasacco.jpg), [Jamestown](jamestown.jpg),
[original geographic view](geographic-map.jpg), [public destination](public-destination.jpg).
Five layout captures are named `mobile-<width>x<height>.jpg` in this directory.
Screenshots were opened and inspected; the too-close initial district frame was
corrected, and later captures wait for the actual camera transition to finish.

## Performance, regressions and fixes

The [raw browser record](browser.json) contains measured geometry, mesh counts,
construction time and renderer counters. Before, the map allocated 68,670,948
geometry bytes. The compact scene uses 377,400 bytes (71 mesh objects; 15 sampled draw calls /
52,202 triangles). Its measured construction is 72.70 ms. It and avoids geographic dataset
construction during normal entry. This is geometry memory, not total browser/GPU
memory. Wide geographic mode remains expensive when explicitly requested.

The QA host uses software-rendered Chromium, .5 WebGL pixel ratio, paced updates
and sampled draws with shadows off for final captures. Game/network clocks remain
real. Baseline captures used .5 device scale; later DOM captures use scale 1.
Page-to-map timings also include room/avatar loading and screenshots and are not
comparable cold-load benchmarks across those diagnostic settings. No phone FPS,
production scale or universal visual-quality certification is claimed.

Review found and fixed retained geographic memory after switching back, stale home
pin coordinates across modes, a too-close district camera, the extra short-screen
overlay and street/estate buildings falsely resembling additional homes. Geometry
ownership remains local to each city kit; releasing one does not release the other
city kit, avatar or active room. A new snapshot assertion initially distinguished
JSON `0` from internal `-0`; it now compares the actual JSON wire format.

## Limits, approval and next stage

This is a compact schematic destination presentation connected to existing rooms
and neighborhood instances, not continuous free walking across the whole metro.
Background architecture is explicitly decorative. Legacy housing templates are
not new purchasable individual units. Those are Stage 2. Third-person exploration,
ambient traffic/NPCs and final physical-device performance remain later stages.
Existing ad prices/eligibility and travel economics are unchanged.

No approval boundary was crossed. Stage 2 can begin after this stage's final
browser/CI acceptance passes; it must reuse transactional ownership infrastructure
and keep legacy home ownership separate from the new finite property units.
