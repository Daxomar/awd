# Stage 9 — ambient city life and believable neighbourhoods

Local implementation and browser acceptance pass. Exact-commit CI pending. Performance figures below are
SwiftShader (software) measurements on a desktop and are **not** phone FPS claims.

## Features completed

- **Ambient street life** (`client/src/v2/scene/ambient.js`) on neighbourhood streets (never in homes,
  estates or custody): residents walking junction to junction, two neighbours chatting, kerbside parked
  cars and trotros, and one slow vehicle on the longest straight street that stops for anyone in front of
  it. Residents notice you when you come close (turn and wave). Existing venue staff, schedules and
  patrols are kept; existing street sounds and lighting are unchanged.
- **Scripted, not AI**: fixed rules and timers only. Residents have no name tags, are not counted as
  players, and tapping one says it is a scripted character and points to chat and Meet for real players.
  They never open venue menus.
- **Day/night**: by day 4–6 residents (device budget), conversation and traffic; evening fewer walkers;
  23:00–05:00 one walker, no conversation, no moving traffic.
- **Performance**: device budget (≤ 4 residents on low-memory or ≤ 4-core devices, at most one moving
  vehicle), deterministic per-street placement, distance activation (hidden beyond 28 m), animation LOD
  (every third frame beyond 14 m; hidden people skip skinning entirely), 10 Hz decisions, no runtime
  path search on streets (straight junction-to-junction corridors), one navigation rebuild for parked
  cars, shared kit materials, and full disposal with the room. Measured in journey G: ambient update
  0.08 ms per frame, +21 draw calls, about +30k triangles for the whole street population.
- **Business frontage**: real player businesses at a venue show as sign posts near the entrance (up to
  three, your own first), labelled open/closed from the real operating, stock and opening-hours state.
  Tapping one shows the owner, status and the line "Sales here come from simulated customers in the
  game's demand model. They are not purchases by real players", with Message owner or Manage your
  business. The Business app labels revenue as simulated customers and says your sign is visible.
  No fake customer transactions are created.

## Exact files

Client: `src/v2/scene/ambient.js` (new), `src/v2/scene/world.js` (ambient lifecycle, frontage,
resident taps), `src/v2/scene/room.js` (animation LOD), `src/v2/main.js` (frontage sheet, resident
text), `src/v2/phone/life.js` (simulated-demand labels), `test/game-ui.test.js`.
Server: `src/shard.js` (frontage message, short cache cleared by business actions).
Tools: `tools/ambient-browser-test.py` (new).

## Database changes

None (reads existing `life_businesses`).

## Tests

| Suite | Result |
| --- | --- |
| Client `npm test` (new ambient budget test) and build | 90 / 90 pass; build passes |
| Server `npm test` | 100 / 100 pass |
| Journey G (browser, QA-pinned hour) | 10 / 10 checks, no page errors |

## Regressions found and fixed during the stage

- Connected streets have no single road item, so traffic had no lane; it now follows the longest straight
  run of the street graph, with the car's heading fixed.
- Walkers originally used grid path search (≈12 ms spikes in software rendering); replaced with
  junction-to-junction corridors (0.04–0.08 ms per frame).
- Frontage showed the three oldest businesses and a stale cache right after creating one; now the
  viewer's own and operating businesses come first and business actions clear the cache.

## Known limitations

- Residents use the existing full avatar, the main triangle cost; a dedicated low-poly crowd model would
  allow more people on low-end phones.
- Ambient population is decided when you enter a street (it does not change hour by hour while you stay).
- Frontage is shown at venues; neighbourhood streets do not host player businesses yet.
- Phone frame rate has not been measured on a real device.

## Next stage

Stage 10 (advertising, music promotion and standalone checkout).
