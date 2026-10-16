# Stage A–F report: contract, art bible, prototypes, hair, beards, wardrobe and game integration (2026-10-16)

## Created, exported and tested

| Item | Status | Evidence |
|---|---|---|
| Game contract audit | done | `docs/game-contract.md` |
| Art bible, budgets, rig/animation/export conventions | done | `docs/art-bible.md` |
| Stylised male body (CC0 anatomy, house proportions) | done | `source/awd_male_prototype.blend` |
| Stylised female body, same pipeline and rig | done | `source/awd_female_prototype.blend` |
| 9 body-slider morphs (`build hips bust waist shoulders muscle faceWidth nose lips`), followed by every garment, hair and shoe part; `height` as root scale | done | lab `build=…`, `previews/*_sliders_{slim,full}.png` |
| Eyes, brows, upper lashes, teeth, tongue | done | same, `textures/` |
| 9 expression morph targets + 9 recipes | done | lab `expr=…`, `previews/male_prototype_face_*.png` |
| 67-bone game skeleton, authored weights (4 influences) | done | bend test (shoulder, elbow, hip, knee, neck) |
| Skin: one material for 8 tones + baked vertex colour | done | lab crowd: 8 tones, 8 shared materials |
| Hair: `fade` (male), `twa` (female) | done | `parts/hair_fade_male.glb`, `parts/hair_twa_female.glb` |
| Garments: `tee`, `jeans`, `sneakers` | done (both bodies) | `parts/*_{male,female}.glb` |
| Hair library: all 15 saved ids for each body that may wear them (7 male, 13 female; `bald` has no mesh), LOD0 + LOD1 | done | `parts/hair_<id>_<sex>[_lod1].glb`, `previews/*_hair_*.png` |
| Beards: `stubble` (soft blended shadow), `goatee`, `fullbeard`; carry expression and slider morphs | done | `parts/beard_<id>_male[_lod1].glb`, `previews/male_hair_beards*.png` |
| Runtime part attachment by bone name onto the shared body skeleton (`attachPart`, `detachSlot`) | done | lab `hair=`, `hairs=`, `beards=` |
| Wardrobe: every remaining catalogue id for each body that may wear it (33 male, 40 female): tops incl. kaba with peplum, fugu and kaftan tails, suit (jacket over shirt and tie), office shirt and tie, Ghana flag tee, original Black Stars-style jerseys with tricolour trim; trousers, shorts, joggers, skirts (slit, mini, pencil, kente wrap); dresses and the kente cloth; slides, ahenema, loafers, heels, boots; cap, bucket, kufi; shades, specs; gold chain, beads, kente stole | done | `parts/<slot>_<id>_<sex>[_lod1].glb`, `previews/*_wear_*.png` |
| Undressed base bodies (LOD0–2) with a `_awd_region` vertex attribute; every garment declares `awd_hides_regions`; runtime culls covered skin | done | `awd_<sex>_base_lod{0,1,2}.glb`, lab `base=1`, `items=` |
| Clips: `idle` 4.03 s, `walk` 1.03 s and `run` 0.7 s (in place, loop), `wave` 2.03 s, `agree` 1.8 s, `shake` 2.4 s, `sad` 3 s, `dance` 2 s (loop); every clip keys every bone | done | lab `clip=…`, base and dressed GLBs |
| LOD0/1/2 GLBs | done | `awd_{male,female}_prototype_lod{0,1,2}.glb` |
| Three.js validation harness | done | `client/character-lab.html` |
| Game integration: every `Avatar` (players, NPCs, rides, studio, phone portraits) is an `AwdAvatar` with the old `Character` API; lazy cached parts; classic fallback | done | `client/src/v2/scene/awd-avatar.js`, `avatars.js`, `chartest.html`, `v2test.html` |

## Measurements (Three.js 0.180, game renderer settings)

| Check | Result |
|---|---|
| LOD0 (m / f) | 27,984 / 28,064 triangles, 12 meshes, 2.49 / 2.47 MB, 18 morphs (9 expressions + 9 sliders) |
| LOD1 (m / f) | 12,502 / 12,531 triangles, 9 meshes, 1.27 / 1.24 MB, 9 slider morphs |
| LOD2 (m / f) | 4,369 / 4,381 triangles, 9 meshes, 0.85 / 0.83 MB, 9 slider morphs |
| Parts | tee 3.6–3.8k, jeans 2.7–2.8k, sneakers 2.1k triangles; 0.12–0.33 MB each |
| Hair LOD0 / LOD1 | shells 448–456 / 224; afro 1470; puff, bun, bob, bonestraight, duku 1.1–1.9k / 0.5–0.9k; twists 3823 / 1911; locs 4348 / 2173; braids 4768 / 2384 |
| Beards LOD0 / LOD1 | stubble 1948 / 1168, goatee 1520 / 911, full 1948 / 1167 |
| Hair grid (13 styles + bald attached at runtime) | every character keeps one shared skeleton; no load errors |
| Skeleton | 67 bones, 54 deforming; one shared skeleton per character at runtime |
| 12 characters, LOD1 | 109 draw calls, 10 geometries (shared), 18 textures, 8 programs |
| Spawn/dispose churn (5 × 6) | geometries 10 → 10, textures stable: pass |
| Independent animation | 8 distinct hip poses across 12 instances at one instant |
| Load errors | none |

Measured with headless and in-app Chromium. These numbers show cost per
character; they are **not** a phone frame-rate measurement, which still needs a
real device.

## Known limitations

* Kente, fugu and Ankara are original value patterns tinted by the saved
  colour, so kente reads in one hue plus black rather than multicolour.
* Heels are pumps with a slim heel post: the rest pose keeps the foot flat.
* Hats are sized for short hair; volume styles under a hat clip unless the
  runtime swaps them for `lowcut` while a hat is worn (recommended).
* The suit (shirt + jacket) is about 10k triangles at LOD0, 5k at LOD1.
* Skirts and long robes follow the legs through weights only; no cloth
  simulation, so very wide strides can show the inner skirt surface.
* Hair is glossy near-black at close range; strand styles read well, the afro's
  front edge shows a small step, and `waves` differs from `lowcut` mainly in
  texture. Long strand styles hang in the rest pose and are skinned to
  `Head`/`Spine2`; there is no secondary motion.
* Morph normals are not exported (they added about 1.1 MB at LOD0); shading
  under strong expressions is slightly approximate.
* The female tee collar edge still shows small steps in close-ups.
* Facial ambient occlusion still darkens under the female jaw slightly, which
  can read as shadow on the chin in close-ups.
* Expressions are deliberately subtle; `happy` reads mainly in the cheeks.
* Sneakers are plain uppers (no branding by design; laces planned).
* LOD2 still uses nine draw calls; one atlased mesh is planned. The game does
  not switch to LOD2 by distance yet.
* Male tops still show some chest contour; it is most visible on the light
  `kaftan` (the chest envelope needs a looser window for tunic tops).
* Activity clips (`sit_idle`, `type`, `phone_use`) are not authored: sitting,
  lying and working use the existing procedural `poses.js` on the new rig.
* At LOD1 (rooms, rides, portraits) faces have no expression or blink morphs;
  the studio uses LOD0.

## Game integration (Stage F)

| Check | Result |
|---|---|
| API parity | `root`, `model`, `mixer`, `skeleton`, `actions`, `look`, `curName`, `native`, `play`, `gesture`, `update(dt, speed)`, `setLook`, `dispose`; `poses.js` works unchanged |
| Rooms (`v2test.html`) | players, friends, walkers and NPCs dressed from saved looks; `sit`, `sit_floor`, `lie`, `work` and bench poses correct |
| Crowd (`chartest.html`, 12 looks) | 118 draw calls incl. shadows, no load errors |
| Walk speed | clip authored for 1.4 m/s, time-scaled from the room speed; `run` above 2.4 m/s |
| Gestures | `agree`/`shake` play once and return to the base clip; `dance` loops |
| Portraits | `portrait.js` awaits `avatar.ready`; dressed head shots rendered |
| Spawn/dispose churn (10 × 3 varied looks) | geometries 33 → 33, textures 51 → 51 once parts are cached |
| Boot download | 3.76 MB (2.23 MB gzip) vs 5.55 MB (2.88 MB gzip) for the classic avatar |
| Fallback | `?avatars=classic` or failed asset load uses `character.js`; tested |
| Unit tests | `client/test/awd-character-assets.test.js`: catalogue coverage, `resolveParts` substitutions, revision hashes |

No saved data, catalogue, prices or server code changed: the avatar reads the
same `look` fields through `normalizeLook`/`fitLook`. Phone frame rate has not
been measured; the numbers above come from desktop Chromium and need a device
check before release.
