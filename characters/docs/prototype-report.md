# Stage A–B report: contract, art bible and male prototype (2026-10-16)

## Created, exported and tested

| Item | Status | Evidence |
|---|---|---|
| Game contract audit | done | `docs/game-contract.md` |
| Art bible, budgets, rig/animation/export conventions | done | `docs/art-bible.md` |
| Stylised male body (CC0 anatomy, house proportions) | done | `source/awd_male_prototype.blend` |
| Eyes, brows, upper lashes, teeth, tongue | done | same, `textures/` |
| 9 expression morph targets + 9 recipes | done | lab `expr=…`, `previews/male_prototype_face_*.png` |
| 67-bone game skeleton, authored weights (4 influences) | done | bend test (shoulder, elbow, hip, knee, neck) |
| Skin: one material for 8 tones + baked vertex colour | done | lab crowd: 8 tones, 8 shared materials |
| Hair: `fade` | done (male) | `export/parts/hair_fade_male.glb` |
| Garments: `tee`, `jeans`, `sneakers` | done (male) | `export/parts/*_male.glb` |
| Clips: `idle` 4.03 s, `walk` 1.03 s (in place), `wave` 2.03 s | done | lab `clip=…`, `previews/male_prototype_walk.png` |
| LOD0/1/2 GLBs | done | `export/awd_male_prototype_lod{0,1,2}.glb` |
| Three.js validation harness | done | `client/character-lab.html` |

## Measurements (Three.js 0.180, game renderer settings)

| Check | Result |
|---|---|
| LOD0 | 27,984 triangles, 12 meshes, 2.5 MB, 9 morphs with normals |
| LOD1 | 12,501 triangles, 9 meshes, 1.05 MB |
| LOD2 | 4,368 triangles, 9 meshes, 0.75 MB |
| Skeleton | 67 bones, 54 deforming; one shared skeleton per character at runtime |
| 12 characters, LOD1 | 109 draw calls, 10 geometries (shared), 18 textures, 8 programs |
| Spawn/dispose churn (5 × 6) | geometries 10 → 10, textures stable: pass |
| Independent animation | 8 distinct hip poses across 12 instances at one instant |
| Load errors | none |

Measured with headless and in-app Chromium. These numbers show cost per
character; they are **not** a phone frame-rate measurement, which still needs a
real device.

## Known limitations

* Only the male body exists. The female body, beards, 14 hairstyles, 63 other
  wardrobe items and the remaining clips (`run`, `agree`, `shake`, `sad`,
  `dance`, activity clips) are planned (see `manifest.json` statuses).
* Body sliders (`build`, `hips`, `bust`, …) are not yet morph targets in the
  GLB; the creator would show the default build until Stage C.
* Expressions are deliberately subtle; `happy` reads mainly in the cheeks.
* The fade reads as a dark cap at close range; hair needs normal detail.
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
