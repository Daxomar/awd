# Stage 4 — camera, movement and immersive interiors

Local implementation and authenticated two-player acceptance pass. Exact-commit CI
pending. This checkpoint does not mark the whole master program complete.

## Features completed

- **Two camera modes.** The existing overhead (isometric, orthographic) camera stays the
  default. A new third-person follow camera (perspective) sits behind the player. A
  round camera button on the right of the HUD switches modes (`aria-pressed`, labelled
  for screen readers). The preference is saved per browser (`awd.camera`) and restored.
- **Where it works.** Homes, finite property units, venue interiors, neighbourhood
  streets and estates. The city map, rides (their own chase camera), the stylist studio
  and custody cells always use their existing cameras; the button hides or explains.
- **Third-person behaviour.** Follows the player with smoothing (snaps when the OS asks
  for reduced motion); drag orbits, pinch/wheel zooms within per-scene limits; joystick
  movement is relative to the camera; per-scene framing (streets higher and farther with
  a 56° lens; interiors steeper with a 70° lens); seated or lying players tilt the view
  down. Doorway transitions keep the chosen mode and start the camera behind the player.
- **Interiors fixed for a real third-person view.** Cutaway rooms had only back and left
  walls. In follow mode the open front and right sides are closed, the camera is clamped
  inside the room, a raycast pulls it in front of furniture and buildings (floors, roads
  and roofs never block), and walls on the camera side fade so the player stays visible.
  Extra walls and faded materials are disposed with the room.
- **Movement contract** (`scene/movement.js`): animation-independent states (idle, walk,
  run, turn, sit, interact, passenger, gestures) mapped to available clips with an idle
  fallback. Running is permitted outdoors at near-full joystick tilt (up to 3.2 m/s with
  the run clip from the character set); interiors always walk. Tap-to-move, pathfinding,
  server movement validation, remote interpolation (`rmv`) and fares/timers are unchanged.
- Name tags and bubbles behind the camera are hidden instead of mirrored.

## Existing systems reused

Room nav grid and pathfinding, `rmv` movement relay, avatar clips from the character
pipeline (via the existing avatar API; no character files changed), HUD layout tokens.

## Exact files

`client/src/v2/scene/stage.js`, `scene/room.js`, `scene/world.js`, `scene/movement.js` (new),
`src/v2/main.js`, `src/v2/ui/game-ui.css`, `test/movement.test.js` (new), `package.json`,
`tools/camera-browser-test.py` (new). No server or database change.

## Tests

| Suite | Result |
| --- | --- |
| Client `npm test` (4 new movement/camera tests) | 88 / 88 pass; build passes |
| Server `npm test` | 85 / 85 pass |
| Journey H, two authenticated players (`tools/camera-browser-test.py`) | 18 / 18 checks pass |
| Camera button at 375×812, 390×844, 430×932, 390×530, 844×390 | on screen, 44–48 px, no overlaps |

Journey H: both players in the same Nima street → overhead default → switch to third
person (preference saved) → joystick moves the player and the camera follows → the
second player sees the new position → enter home (walls enclosed, camera inside the room
at four orbit angles with a 6.5 m request, camera-side walls faded) → walk and sit on
furniture → leave to the street (mode kept) → back to overhead → map stays overhead → no
page errors. Evidence: `h1`–`h7` screenshots, `journey-h.json`, `camera-toggle-layouts.json`.

## Performance

Follow mode adds one short raycast per frame against the current room and per-frame
opacity updates on at most four walls. No phone FPS claim (SwiftShader only).

## Known limitations

- Remote players are shown walking even when their owner runs (the movement relay
  carries positions, not speed).
- Streets end at the authored neighbourhood edge; the horizon beyond is sky. The
  planned Blender world overhaul addresses distant scenery.
- Orbit and zoom are touch/mouse only; there is no keyboard orbit binding yet.

## Next stage

Stage 5 (employment and career system 2.0).
