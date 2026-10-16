# Phase 5 connectivity audit

Baseline: `c07bce9`, 16 October 2026. No public deployment.

The current home → street → estate routes use `street` messages and server
`Game.onMsg()`. The client walks to a zone before sending the transition;
the server restricts free transitions to the existing home/neighbourhood/estate
relationship. `World.enter()` currently rebuilds a single cutaway scene on each
room message. Eight neighbourhoods have distinct Phase 4 compositions but no
connected street graph or spatial segment lifecycle.

Local player coordinates (`rx/rz`, ±20) are separate from geographic fare
coordinates (`x/z`). `rmv` messages synchronize local targets within one room.
Rooms retain their existing `n:<home>#<capacity-instance>`, `e:<home>#…` and
private `home:<account>` identities. No global visibility exists between rooms.
Joining/reloading currently resets local positions to scene spawns. Estate
directories load only server-owned properties in pages of twelve.

Distant movement uses `travel`, validates transport, funds, custody, maximum
walking distance and current activity, and stores a timed journey in player
state. Presence leaves during travel and returns on authoritative arrival.
Reload resumes the stored journey. Home visits additionally require an online
acquaintance. Venue activity checks depend on authoritative location and opening
hours, not the scene drawn by the browser.

Implementation boundary: authored compact local graphs stay within the existing
±20 coordinate range and share one existing neighbourhood room. No new catalogue
destination, fare rule, capacity model, AOI backend or migration is needed.
Road/sidewalk continuity and collision data remain present while a bounded set
of detailed segment scenery is loaded. Existing Phase 4 props/materials and room
interiors are reused. Optional saved local-position/return metadata will be
validated and have safe defaults for older saves.

Venue frontages lead to existing timed walking/transport choices. Their return
routes also use normal travel. These are condensed wayfinding connections;
there will be no free instant cross-district or cross-venue teleport. Source
geographic fare coordinates remain unchanged. The map remains the metropolitan
navigation layer. Only local segments within a neighbourhood connect seamlessly.

Baseline screenshots and repeated cold/warm software-render samples use
`tools/street-performance-test.py`. Initial captures encountered local database/
session timeouts; the completed baseline was subsequently captured from a clean
archived build of `c07bce9` on a separate local port. Its code is the baseline,
although that successful capture occurred after working-tree edits had begun.
Makola, Vibes, Jamestown and East Legon are sampled separately, with first-render
compilation distinguished from repeated frames. Physical-phone FPS is unmeasured.
