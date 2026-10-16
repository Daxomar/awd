# Stage A–D report: contract, art bible, prototypes, hair and beards (2026-10-16)

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
| Clips: `idle` 4.03 s, `walk` 1.03 s (in place), `wave` 2.03 s | done | lab `clip=…`, `previews/male_prototype_walk.png` |
| LOD0/1/2 GLBs | done | `awd_{male,female}_prototype_lod{0,1,2}.glb` |
| Three.js validation harness | done | `client/character-lab.html` |

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

* 42 wardrobe ids (tops, bottoms, full outfits, shoes, hats, glasses, neck)
  and the remaining clips (`run`, `agree`, `shake`, `sad`, `dance`, activity
  clips) are planned; `manifest.json` tracks every id.
* Hair is glossy near-black at close range; strand styles read well, the afro's
  front edge shows a small step, and `waves` differs from `lowcut` mainly in
  texture. Long strand styles hang in the rest pose and are skinned to
  `Head`/`Spine2`; there is no secondary motion.
* The male tee still shows some chest contour; tops are reworked in Stage E.
* Morph normals are not exported (they added about 1.1 MB at LOD0); shading
  under strong expressions is slightly approximate.
* The female tee collar edge still shows small steps in close-ups.
* Facial ambient occlusion still darkens under the female jaw slightly, which
  can read as shadow on the chin in close-ups.
* Expressions are deliberately subtle; `happy` reads mainly in the cheeks.
* Sneakers are plain uppers (no branding by design; laces planned).
* LOD2 still uses nine draw calls; one atlased mesh is planned.
* The live game still uses the procedural avatar (`character.js`); nothing in
  the game imports these assets yet.

## Integration plan (for a controlled merge, coordinated with Codex)

1. Add an `AwdCharacter`-based avatar behind a client flag in
   `client/src/v2/scene/avatars.js` (`loadAvatars` keeps the current path as the
   fallback). `client/src/character-lab/awd-runtime.js` is the starting point.
2. Load bodies lazily per sex and LOD; load parts per slot id from
   `manifest.json` (`appearance[slot][id].assets[m|f]`), binding each part's
   skinned meshes to the body skeleton by bone name.
3. Hide covered body faces per outfit (the dressed export already removes them;
   modular runtime needs the per-part face lists).
4. Keep `look` validation, `normalizeLook`, `fitLook`, uniforms and the server
   unchanged. Unbuilt ids fall back to the current procedural avatar.
5. `Character.play/gesture/update` names stay the same; `poses.js` works as is
   (same bone names). Re-base `Hips` translation for the female rig the same way
   `fitAnatomyRig` does today.
6. Use LOD1 in rooms and streets, LOD0 in the fitting room and portraits, LOD2
   beyond about 15 m or above a crowd threshold.

No saved data, catalogue, prices or server code change in any of these steps.
