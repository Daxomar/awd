# Immersive world transformation: technical audit and roadmap

Audit date: 14 October 2026. Starting revision: `c6462fc`. This continues the
existing game. Findings below come from code inspection, executed tests and local
renders, rather than the feature claims in the README. The first implementation
milestone is deliberately smaller than the full seven-phase mission.

## A. Current architecture

| Layer | Current implementation | Assessment |
| --- | --- | --- |
| Browser | Vite 6.4, Three.js 0.180, plain ES modules and DOM UI | Keep. No framework replacement is needed. |
| Character pipeline | MakeHuman-derived GLBs, runtime geometry/morph fitting, shared animation skeleton | Keep and repair. There is enough authored anatomy and rig data to avoid a replacement. |
| Scenes | Orthographic stage, cutaway rooms, generic street/estate rooms, separate city overview | Useful hybrid foundation; streets are still room instances. |
| Game server | uWebSockets, room-based Shard, authoritative JS rules | Preserve room transport and introduce larger streets incrementally. |
| Persistence | PostgreSQL accounts, opaque hashed sessions, JSON player state, social/game tables | Preserve schemas and saved characters. Transfers use database transactions. |
| Cross-shard | Redis pub/sub, account leases and shared rate limits | Existing communication infrastructure is reusable. |
| Deployment | Docker Compose game/PostgreSQL/Redis/Caddy, Linux CI workflow | Linux CI build, stack startup and smoke checks passed on 15 October after correcting mount parsing. Local Docker Desktop remains unverified. |

`main.js` connects through `net.js`, receives `welcome`, runs onboarding when
needed, binds room/UI listeners and releases buffered packets. A wardrobe change
sends `look`; server wardrobe rules clean it and broadcast the accepted state.
`World.enter()` builds the room and instantiates avatars from saved looks.

There is **no `client/legacy/` directory** in this checkout. Retired binary/open
world protocol and grid modules remain in the server, but the active v2 path uses
JSON messages and room membership. Do not mistake unused AOI code for active
distance-based interest management. Most source is compact, handwritten-style
JavaScript; error handling ranges from structured transaction rollback to older
catch-and-log or ignored rendering failures. There is no configured linter or
automated representative-device performance suite.

## B. Character findings

Relevant files: `scene/avatars.js`, `character.js`, `human.js`, `poses.js`,
`studio.js`, `ui/stylist.js`, `tools/build-human.py`, `build-character-models.py`
and `export-player-models.py`.

- The live game loads `rpm_lo.glb`, `clips.json` and both anatomy GLBs. Dressed
  `*-player.glb` files are portable review exports, **not the live avatar source**.
- Male/female source surfaces are distinct. Nine body/face controls deform them;
  height scales the root. The runtime fits a 67-bone animation skeleton to source
  joints. A wholesale body replacement is not justified by this audit.
- Garments mainly reuse clipped regions of the anatomical surface, offset along
  normals. Skirts, footwear and accessories are partly procedural. These are not
  independently authored, fully tailored garment meshes. This explains tight
  chest detail and poor cloth silhouettes, even when the rig is numerically valid.
- The baseline male tee showed exaggerated chest detail, an abrupt waist seam and
  stiff open hands. Faces have eye/brow/lip detail but no complete expression rig.
  Hairstyle geometry and foot/hand shaping still need dedicated art passes.
- Imported animations, fitted bind poses and procedural pose overrides coexist.
  Walking, idle, sitting, raised arms and gender switching must be checked as a
  matrix; a valid GLB or finite vertex alone does not prove attractive deformation.
- Before this milestone, geometry eviction simply deleted a cache entry without
  releasing GPU resources; temporary replaced geometry and skeleton textures also
  lacked complete lifecycle cleanup. Material/texture caches remain a separate
  follow-up because they have different sharing and ownership rules.

Baseline at 430×860, identical tee/jeans/sneakers/fade test looks: male 25,508
triangles, female 25,362, eight meshes each. The harness reported ten visible draw
calls including its floor. These counts are **not** total-game shadow-pass costs
or proof of 30 FPS on a phone. Initial uncompressed avatar inputs total roughly
5.55 MB before JS/fonts and scene content; both sexes are currently loaded upfront.

## C. World and map

Relevant files: `scene/map.js`, `bake.js`, `room.js`, `kit.js`, `neighbourhood.js`,
`homes.js`, `venues.js`, `world.js`, `stage.js`, `screens.js`, `audio.js`.

- Existing locations have real geographic coordinates, transformed into game/map
  metres. The **currently shipped road file is marked `schematic`**, with ten
  routes and one coastline; the loader's OSM attribution branch does not mean
  detailed OSM data is actually shipped.
- Repetitive filler shares one generator, with district palettes and a small
  height variation. This provides density but weak district identity. Landmarks
  are individually recognizable approximations, not faithful surveyed models.
- Static batching reduces draw calls, but large merged batches load at startup
  and have coarse culling bounds. There is no district chunk streaming or map LOD.
  Pins reveal names on hover/focus; marker clustering is still absent.
- Homes already connect to `n:<home>` streets and `e:<home>` owned-house estates.
  Street vendors have opening hours and simple patrol/gesture behavior. These
  streets reuse one layout rather than a polished district-specific neighborhood.
- Rooms have a local navigation grid, object picking and activity use points.
  TV animation and synthesized street/music audio exist. Synthesized sound is
  original game audio, not a recording of Accra.
- Warm day/night lighting follows Accra/GMT. Device DPR/shadow defaults exist, but
  there is no user-facing graphics budget and no measured low-end device baseline.

## D. Gameplay and compatibility

Relevant files: `server/src/game/{rules,data,city-content,wardrobe,matches,phone-games}.js`,
`social.js`, `oware.js`, `civic.js`, `gist.js`, `phone/apps.js`, `phone/games.js`.

Working foundations include careers/ranks/skills, needs, transport quotes and
arrival, rent and ownership, furniture, businesses, phone trading, friendships,
relationships, message requests/private threads, Oware and server-owned phone game
moves, match predictions, crime risk/fines/custody and account safety controls.
All 36 existing server tests passed during this audit. This does not verify every
content action or all concurrent multiplayer cases.

Businesses are mainly purchase-and-income systems; inventory, customer demand,
player employment and competition are not a connected simulation yet. Crime
primarily uses server-generated outcomes and custody rather than witnesses and
NPC pursuit. Neighborhood gatherings and player commerce need explicit shared
state and protections. Existing story/daily fields have compatibility baggage;
active migration clears scripted story objectives. Do not reintroduce forced
story progression or daily chores.

Birth uses HMAC(account ID, birth seed), with 25% Dbee and 75% Hustler. A sample
of IDs 1–10,000 under the development seed produced 2,503 Dbee / 7,497 Hustler.
This supports the configured distribution; repeated results on one account are
expected. Persistence and legacy background migration are covered by regression
tests. Starting funds remain GH₵800 / GH₵25,000; eligible homes remain two / three,
with no assigned career. This milestone changes none of those values or rolls.
The reveal is currently immediate and can be improved without rerolling.

Optional real-money wallet credits already exist beside in-game prediction stakes.
Their currency relationship requires review before any public monetary launch.
This mission introduces no payment dependency, gambling feature or monetization
change; removing or changing existing monetization requires the user's approval.

## E. Multiplayer and performance concerns

Room membership limits frequent broadcasts to a relevant group, normally capped
at 25. Redis carries city chat, private deliveries, credit notices and revocations.
Account leases, queued mutable requests and transactional transfers already
protect important state. Movement messages are throttled and coordinate-bounded,
but normal walking does not undergo server-side obstacle/path validation. Larger
streets therefore need authoritative traversable areas and relevancy sectors.

Remote avatars walk toward received targets; transitions, late packets and
reconnects need repeatable two-browser journeys as streets become more complex.
The active protocol does not synchronize arbitrary animation graphs or NPC world
simulation. Existing load-test scripts include development-token helpers; they
must not be presented as production-cookie tests without adaptation.

Priorities: stop resource growth during customization/transitions, separate map
chunks, budget avatar animation and shadows, reduce eager downloads, then measure
frame time, draw calls, memory and network traffic on named physical Android
devices. Software WebGL browser automation checks functionality, not phone FPS.

## F. Free asset and animation workflow

1. Preserve the bundled MakeHuman base, targets, source weights and look schema.
   [MakeHuman's licence](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md)
   distinguishes AGPL application code from CC0 bundled graphical assets. Record
   the particular source, licence and modifications for every new asset.
2. Use Blender to inspect topology and bind poses, tailor a small compatible
   wardrobe, transfer weights/morphs and export efficient GLB. Keep intermediate
   authoring files separate from runtime downloads; validate GLBs and inspect them
   in the game's lighting and poses before acceptance.
3. Prefer original/CC0 animations for a publicly shareable asset pipeline.
   [Adobe's Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)
   allows free commercial game use with an Adobe ID; Mixamo is not open-source.
   Check raw redistribution restrictions before adding clips to the public repo.
   Audit the provenance of existing RPM/animation inputs before a commercial
   release; no blanket clearance is inferred from the MakeHuman licence.
4. For future map data, use offline extracts with
   [OSM/ODbL attribution](https://www.openstreetmap.org/copyright) and derivative
   database obligations, not unlicensed tracing of proprietary maps or a paid API.

No external character/animation asset is introduced by milestone 1.

## G. Ordered roadmap and acceptance gates

**Priority update, 15 October 2026:** the user has moved character art, rigging,
clothing and animation work to the final development phase. The active Phase 1
is now onboarding only; its fixes and evidence are in [onboarding-review.md](onboarding-review.md).
The table below records the original audit sequence, not authorization to proceed
to deferred character/HUD/map work.

| Phase | Existing files to evolve | Deliverable and acceptance |
| --- | --- | --- |
| 1a: current milestone | `character.js`, `human.js`, `room.js`; small cache/fit helpers | Shared geometry ownership, smoother shirt fit; unit and browser stress/pose checks, actual-game visual review. |
| 1b: remaining character art | model builders, `poses.js`, `character.js` | Hand/wrist and foot measurements, corrected anatomy/bind/pose causes, tailored starter garments, hair/face refinement; both bodies at morph extremes, walk/sit/greet/dance inspected. |
| 2: creator/onboarding | `stylist.js`, `studio.js`, `onboard.js`, tutorial | Full-body framing/zoom/rotation, organized controls, transitions/reduced motion, animated deterministic birth reveal; persisted looks survive reconnects. |
| 3: scene quality/budgets | `stage.js`, `room.js`, `kit.js`, materials/audio | Consistent daylight/night/interior materials, graphics settings and lifecycle checks; instrument CPU/GPU/frame-time budgets. Compact expandable HUD in `hud.js`/CSS, preserve phone apps. |
| 4: district map | `map.js`, `bake.js`, road data/tools | Jamestown/Circle/East Legon rules, geography, chunk culling/LOD, cached assets and clustered markers; existing destination/travel IDs retained. |
| 5: one neighborhood | `neighbourhood.js`, `world.js`, `room.js`, shard movement | A polished Jamestown street from an existing home, compound/shop/food/MoMo/barber/transport interactions, return-home path, server-valid movement and two-player presence. |
| 6: emergent systems | authoritative rules, `social.js`, phone apps and Shard | Businesses/customers/commerce, invitations/gatherings and fictional crime consequences connected to existing progression; targeted abuse/replay/concurrency tests. |
| 7: release gate | tests, CI, deployment docs, profiling | Physical Android performance matrix, multiplayer soak/reconnect, data/asset provenance, restore/security and container checks. Production deployment remains separately authorized. |

Phase 3's HUD/render instrumentation can move earlier if it obstructs the street
playtest. No destructive migration, framework replacement or simultaneous whole
city rebuild is required by this roadmap.

## H. First milestone and evidence

The first patch repairs geometry ownership and shirt fitting, not the entire
character art direction. Shared live geometry is retained; idle geometry is
bounded and disposed, discarded generated pieces are released and avatar
skeleton/mixer cleanup is explicit. Room cleanup respects avatar ownership.
Shirts bridge fine anatomical detail and have a lower regular hem; tight singlets,
bodycon and cropped waist behavior retain their selected style.

Validation commands:

```sh
cd client
npm test
npm run build
cd ../server
npm test
cd ..
python tools/character-integrity-test.py
python tools/character-game-test.py
```

Browser artifacts and numerical observations live in `.local/mission-audit/`.
They are local review evidence, not committed golden baselines. Hands, hair,
garment tailoring, animation quality and phone performance remain open phase-1
work; no claim of a fully polished character or completed transformation is made.

Completed milestone checks (15 October): three client tests and all 36 server
tests passed; production build passed. Browser stress verified 48 body/shape/outfit/
pose combinations for normalized weights and finite, bounded vertices. Forty
customization changes retained two live references and at most 16 idle cache
entries; the final 20 samples held a constant 146 GPU geometries in this harness.
This is a bounded-resource observation, **not a measured FPS improvement**.
Both portable player GLBs were regenerated and reloaded, and all four anatomy/
player GLBs passed Khronos glTF validation with zero errors/warnings (informational
unused-UV notices remain). Creator male/female and street screenshots were rendered
and inspected. A disposable production-cookie account completed body switching,
saved bust customization, home-to-street-to-home transitions and reload persistence.
Creator framing still crowds the feet near the editor panel; that is phase-2 work.

The [Linux CI run for cf49b04](https://github.com/Daxomar/awd/actions/runs/38658631703)
also passed the container build, stack startup, production-cookie/WebSocket smoke
test, proxy health and dependency audits. No public deployment was performed.
