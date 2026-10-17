# World, movement, clothing and interaction overhaul (2026-10-17)

Owner request: a bigger, better world that the characters really interact with, clothing that fits, a
proper Ghana jersey and kente, human-looking movement, tap-to-walk beside the joystick, and billboards
that stand out. Everything visual was made in Blender (5.2) from original scripts; no third-party
meshes, textures or animations. Budget GH₵0. No balances, prices, odds or saved look fields changed.

## Movement
- `client/src/v2/scene/locomotion.js` drives every person in a room: speed eases in and out (4.2 m/s² up,
  6.5 m/s² down), the body turns at most 7.5 rad/s and slows for sharp turns, paths are followed by
  steering at a point 0.6 m ahead (corners are rounded) and the person brakes to stop on the target.
- The joystick steers directly with sliding collision (`p.steer`) instead of re-planning an A* path every
  110 ms, which made the old movement stutter; the server still hears a position about every 300 ms.
- Tap-to-walk: tap anywhere on the ground. A yellow ring marks the destination; far taps outdoors break
  into a jog; a tap on a roof or yard walks to the nearest reachable street point (up to 12 m away).
  Other players jog to catch up when their updates are far ahead.
- New walk and run cycles (`characters/scripts/awd_anim.py`) are built from published gait curves:
  heel strike, loading, roll-over and toe-off; the pelvis is highest over the standing leg (the old walk
  bobbed upside down, highest at heel strike), shifts onto the standing leg and counter-rotates the chest.

## Interactions
- 19 looping action clips (`ACTION_CLIPS` in `awd_anim.py`): dumbbell curls, shadow boxing, eating,
  drinking, phone, photos, cooking, scrubbing, sweeping, a head load, typing, guitar, drumming, cheering,
  talking, reading, net hauling, fixing, swimming.
- Props (`characters/scripts/awd_props.py` → `awd_props_<sex>.glb`): dumbbells, phone, spoon and a
  plate of jollof, bottle, ladle, a praa broom, spanner, microphone, book, headpan of oranges, guitar and
  djembe, each modelled where it is held in the rest pose and parented to its bone at runtime; the plate
  and headpan stay level.
- `client/src/v2/scene/actions.js` maps every activity id to an action (gym → curls with dumbbells,
  waakye → eating, kayayo → headpan, emcee → microphone…), with an icon fallback for new activities.
  Strolls and jogs walk loops around where they started. Seated poses leave the arms to the clip.
- The server adds the activity id (`act`) to room status broadcasts so everyone in the room sees what
  others are doing. Presentation only; activities, costs and rewards are unchanged.

## Clothing
- `characters/scripts/awd_drape.py`: garments rest on the convex hull of the body part under them
  (torso, pelvis, arms, legs) blended by the body's skin weights, instead of shrink-wrapping the skin.
  Chests, under-busts, abs and knees no longer show through; trousers hang straight from the seat.
  `LOOSE` in `awd_wardrobe.py` sets how far each item hangs (bodycon stays close, jerseys hang free).
- Ghana 2026-inspired football shirts (`characters/tools/make_prints.py`): the home shirt is white with
  Ananse cobweb lines in red, gold, green and blue, kente side panels, the black star and a flag tag, and
  GHANA 10 on the back; the away shirt is sunny yellow with tonal Adinkra marks, green side panels and a
  red collar. No federation crest, maker logo or sponsor. One artwork is mapped round the whole shirt.
- Kente and ankara are now real multicolour cloths: the texture is a colourway mask and the game paints
  it with the player's chosen colour plus two contrasting Ghanaian accents (`awd-runtime.js`).
- Rebuild: `python characters/tools/make_prints.py`, then per body
  `blender --background --factory-startup --python characters/tools/run_stages.py -- male body,dress,export,base,props,wardrobe`
  (and `female`), copy `characters/export/*.glb` and `parts/*.glb` to the runtime folder and run
  `node characters/tools/build-manifest.mjs`.

## World
- Neighbourhood streets (`shared/local-streets.js`, version 2) are 88 × 88 m instead of 40 × 40 m: the
  same plans drawn 2.2× larger with 25 % wider roads, a ring road and about 40 frontages each. The server
  bounds moves to the plan (`STREET_HALF`); saved positions from the old layout are re-validated on entry.
- The Blender street kit (`world/scripts/build_street_kit.py`, `world/source/street_kit.blend`,
  `client/public/assets/world/street-kit.glb`, preview `world/previews/street_kit.png`): walled compound
  houses with blue gates and polytanks, two-storey shop blocks with balconies and roller shutters,
  container shops, kiosks, chop bars, neem and coconut palms, electricity poles, vendor umbrellas and
  trotros. `client/src/v2/scene/street-kit.js` places 75–90 of them per neighbourhood deterministically
  (same for every player) with GPU instancing and per-house wall colours; nothing stands on a walkway.
- City-map landmarks (`world/scripts/build_landmarks.py`) replace their procedural stand-ins when a model
  is listed in `client/public/assets/world/landmarks/index.json`.

## Billboards
- `client/src/v2/scene/billboard-face.js`: adverts are drawn unlit and without tone mapping, so the colours
  are exactly what the advertiser uploaded, in a glowing frame, shaped to the artwork (no stretching).
- City map boards are larger, on taller posts, turn to face the camera and grow up to 3.2× as the map
  zooms out, so they stay readable. Exposure accounting is unchanged.
- Every neighbourhood now has two 7.2 × 3.6 m street billboards above the rooftops with flood lights,
  showing the live adverts booked on the nearest city boards (rotating every 12 s) or the house advert.
  They are bonus visibility; impressions are still counted only on the booked placements.

## Verification
- Client `npm test` 101/101 (new `test/world-life.test.js`: easing, turning, wall sliding, activity
  mapping, street fill never on walkways, billboard choice and fit, kente accents). Server `npm test` 112/112.
- In the running game (loopback QA server, desktop Chromium with software rendering): the enlarged Nima
  street with the kit, dumbbell curls, eating in the Ghana home shirt, a green kente dress, an ankara
  shirt, the new walk, a live advert on a street billboard, and tap-to-walk with its marker.
- Not measured: phone frame rate (needs real phones); the larger street adds about 50 instanced draw calls.

## Meeting other players (2026-10-18)

- **Tap a player, talk to them.** The player card now opens with a Message button, so anyone can write to
  anyone. A stranger receives a **message request** (the existing `dm_links` flow): one message arrives,
  and nothing more until they accept. Accepting now makes the two of you **acquaintances**
  (`ACCEPT_POINTS` = 10 friendship, below the Friend level at 30, `server/src/social.js`), so meeting
  people happens by talking instead of by sending a separate friend request. An existing, warmer
  friendship is never lowered, and an offline player's saved state is raised in place.
- **Gestures show on the avatar.** Every social carried `anim: 'agree'` (a nod) or nothing at all, so a
  wave, a joke and a hug all looked the same. Each now has its own clip: wave, handshake, talk, laugh,
  agree, dance, hug. Three are new in `characters/scripts/awd_anim.py` (`handshake`, `hug`, `laugh`), and
  **Shake hands** is a new social anyone can use. Both people play the gesture and are turned to face each
  other first (`world.faceEachOther`), so a wave is never played at someone's back.
- **A livelier neighbourhood.** The crowd budget was written for the old 36 x 30 m street and left the new
  88 m one feeling deserted. `ambientBudget` now scales with ground area and caps per device: a big
  neighbourhood gets up to 9 residents, 2 chatting pairs, 9 parked vehicles and 3 moving ones (battery
  saver keeps the old small numbers). Traffic drives several different streets of the real street graph
  instead of queueing on the longest one, and trotros share the road with cars.
- **The players-online count.** It was accurate — three connected players reported three, five reported
  five — but it counted load-test bots as people and showed a bare "1 player online" when you were the
  only one connected. It now counts real players only, and adds the number of players **active today**
  from `player_activity_days`, cached for a minute: "1 player online · 70 today".

Verified on the loopback QA server: a stranger's first message arrives as a request, accepting it leaves
both players on 10 friendship and lets the next message through; the four social clips load and play on a
player's avatar in the game; a normal-tier neighbourhood builds 10 residents and 3 moving vehicles and the
cars drive along the streets. Not verified: two live players greeting each other side by side, and phone
frame rate.
