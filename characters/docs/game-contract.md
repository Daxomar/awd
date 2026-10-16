# Character game contract (audited 2026-10-16)

What the live game expects from a character today. The Blender pipeline must
fit this contract; nothing here was changed by the character work.

## Sources inspected

| Concern | File |
|---|---|
| Look schema, catalogue, uniforms, defaults, validation | `server/src/game/wardrobe.js` (`WEAR`, `UNIFORM`, `DEFAULT_LOOK`, `cleanLook`) |
| Runtime avatar build (procedural clothes, hair, fitted rig) | `client/src/v2/scene/character.js`, `human.js`, `garment-fit.js` |
| Asset loading, legacy/NPC look normalisation | `client/src/v2/scene/avatars.js` (`loadAvatars`, `normalizeLook`) |
| Procedural poses | `client/src/v2/scene/poses.js` (`POSES`, `applyPose`, `applyModelWalk`) |
| Animation triggers | `client/src/v2/scene/room.js` (walk/idle/anim), `world.js` (`gesture`, `animOther`) |
| Server emotes and social animations | `server/src/shard.js` (`emote` whitelist, social `anim`) |
| Fitting room / creator preview | `client/src/v2/scene/studio.js`, `ui/stylist.js`, `ui/portrait.js` |
| Live assets | `client/public/assets/models/rpm_lo.glb` (67-bone skeleton), `accra-male.glb`, `accra-female.glb`, `assets/anim/clips.json` |

## 1. Appearance fields (saved, server-validated)

`look = { body, skin, hair, hairCol, beard, top, topCol, bottom, bottomCol, full?, fullCol?, shoes, shoesCol, hat, hatCol?, glasses, neck, neckCol?, build, hips, bust, height, waist, shoulders, muscle, faceWidth, nose, lips }`

* `body`: `'m' | 'f'`. Female forces `beard = 'nobeard'`.
* `skin`: integer 1–8 (legacy alias `skinTone`).
* Sliders `build hips bust height waist shoulders muscle faceWidth nose lips`: 0–1 in 0.05 steps; default 0.5 (`bust` 0.45).
* Slot ids must exist in `WEAR` with matching slot and gender (`g: 'm'|'f'|'u'`); priced items must be owned. Colours must be in the item palette, otherwise the first palette colour is used.
* `full` replaces `top` and `bottom` when present.

## 2–6. Catalogue (ids are the contract; never rename)

| Slot | Ids |
|---|---|
| Skin tones | 1 `#f3cfb0`, 2 `#e2b08a`, 3 `#c68a5f`, 4 `#a26a45`, 5 `#7d4b2e`, 6 `#5f3621`, 7 `#472616`, 8 `#33190d` |
| Hair (15) | lowcut, fade, waves (m), afro, twists, locs, cornrows, bald, puff (f), bun (f), twa (f), braids (f), bob (f), bonestraight (f), duku (f) |
| Hair colours | `#141010 #3a2416 #6b3e1f #b5651d #d9a441 #8e1b1b #e8e2d6 #6b2d8c` |
| Beard (m) | nobeard, stubble, goatee, fullbeard |
| Tops (16) | tee, flagtee, singlet (m), crop (f), polo, hoodie, jersey, jerseyaway, ankara, kenteshirt, fugu (m), office, kaftan (m), suit, kaba (f), blouse (f) |
| Bottoms (10) | jeans, shorts, joggers, chinos, suitpants, ankarapants, slit (f), mini (f), pencil (f), kenteskirt (f) |
| Full outfits (5) | sundress (f), ankaradress (f), kentedress (f), bodycon (f), kentecloth (m) |
| Shoes (6) | slides, sneakers, ahenema, loafers, heels (f), boots |
| Hats | nohat, cap, bucket, kufi (m) |
| Glasses | noglasses, shades, specs |
| Neck | nochain, chain, beads, stole |

Starter (price 0) items, shop items (thrift, mall, tailor) and the automatic
work uniforms (`UNIFORM`: police, nurse, doctor, chef, bank, civil, tech, trotro,
ride, hotel, aviation, boxer, fisher, pastor, radio, dj, teacher, trader,
fashion) are all combinations of the ids above. Gym and sleep outfits are
likewise applied by the client through `fitLook`. **New art must therefore cover
ids, not outfits.**

## 7. Animation states

| State | Trigger today | Clip name the new library must provide |
|---|---|---|
| Standing | `room.js` `play(p.anim \|\| 'idle')` | `idle` |
| Moving | `room.js` `play('walk')`; speed scales `walk.timeScale` | `walk` (in place) |
| Running | clip exists (`run`), not triggered by current code | `run` |
| Emotes | server whitelist `agree, shake, dance, sad, wave` (`wave` is drawn with `agree`) | `agree`, `shake`, `dance`, `sad`, `wave` |
| Social actions | `rsocial.anim`: `agree` or `dance` | same names |
| Activity poses | `applyPose`: stand, sit, type, sit_floor, lie, work, lean, squat, pray, cheer, guard, wade | procedural today; optional clips `sit_idle`, `type`, `lie`, `work`, `squat`, `pray`, `cheer`, `guard` |

`poses.js` aims bones in world space and is rig-agnostic, so it keeps working on
any skeleton that uses the bone names below.

## 8. Dimensions

Adult male 1.76 m; the female is rendered at 0.955 × (about 1.68 m). `height`
scales the root by 0.94–1.06. Ground at y = 0, facing +Z (glTF/Three.js).

## 9. Attachment points and bone names

The live skeleton (`rpm_lo.glb`, 67 bones) uses Mixamo-style names:
`Hips Spine Spine1 Spine2 Neck Head HeadTop_End LeftEye RightEye
{Left,Right}{Shoulder,Arm,ForeArm,Hand} {Left,Right}Hand{Thumb,Index,Middle,Ring,Pinky}{1-4}
{Left,Right}{UpLeg,Leg,Foot,ToeBase,Toe_End}`.
Code depends on `Hips` (pose placement and clip re-basing), `Head`,
`*HandMiddle1`, `*ToeBase`, `*Toe_End` and the limb names above. Hats, glasses
and hair are skinned to `Head`; necklaces to `Spine2`; shoes to `Foot`/`ToeBase`.

## 10. Multiplayer

* Remote looks arrive as saved `look` objects (`e.lk`) plus an optional work/gym
  `fit`; `fitLook` merges them. `restyle` swaps looks live.
* Movement is server-authoritative; clients interpolate positions and play
  `walk` while moving, so clips must be in place (no root motion).
* Emotes are whitelisted and rate-limited server-side; no new network messages
  are needed for character art.
* Geometry is shared through `GeometryCache` keyed by look; materials are cached
  by key. New assets must keep sharing and per-avatar disposal safe.
