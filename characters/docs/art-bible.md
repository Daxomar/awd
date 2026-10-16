# Accra We Dey character art bible

Stylised realism: believable Ghanaian adults with slightly heroic proportions,
soft surfaces and readable faces. One design language for every body, face,
garment and animation. Original work only; no proprietary game assets.

## Proportions

| Measure | Rule |
|---|---|
| Height | male 1.76 m, female 1.68 m (asset scale; `height` slider ±6 %) |
| Head | 1.09 × anatomical scale, about 6.9 heads tall (realistic is 7.5) |
| Eyes | 1.15 × around the eyeball, upper lashes only, iris 50 % of eyeball radius |
| Hands | 1.05 × for readable gestures from the game camera |
| Male mass | arms +8–14 %, neck +10–12 %, chest width +7 %, hips −7 % |
| Female mass | arms and legs +3–4 %, waist −4 % |
| Surface | 6 Taubin passes soften muscle noise on torso and limbs; face, hands and feet keep detail |

## Face

* Source anatomy: MakeHuman CC0 African young-adult targets. Faces vary through
  landmark-based fields (cheek fullness, nose scale) and the saved `faceWidth`,
  `nose` and `lips` sliders, never one template.
* Eyes: real eyeball geometry with a corneal bulge and a procedural iris; a
  0.16 s blink every 2–5 s keeps them alive.
* Brows and lashes: alpha-tested cards (glTF MASK) tinted with the hair colour.
* Mouth: arched teeth rows on head and jaw, recessed tongue; visible only when
  the jaw opens.

## Expressions (glTF morph targets)

Nine base keys, mixed by recipe at runtime:
`blink jawOpen smile frown mouthO browUp browDown browInnerUp squint`.
Recipes: neutral, happy, sad, angry, surprised, concerned, laughing, talking,
blinking (`characters/scripts/awd_expressions.py`). Eyelids and jaw are baked
from authored MakeHuman face bones; mouth and brows come from smooth
displacement fields measured on each face, so every variant gets the same set.

## Body sliders

The saved sliders are morph targets on every part. Influence is
`(value − default) / (1 − default)` above the default and `(value − default) / default`
below it (default 0.5, `bust` 0.45), so the saved default is the unmorphed mesh.
Garments receive the body's deltas from the nearest body vertices, so they
follow every shape. `height` stays a root scale (0.94–1.06), as in the live game.

## Skin

One material (`AWD_Skin`) for all tones. The game sets the base colour factor
to the saved tone × 1/0.9; a baked vertex colour layer (`COLOR_0`) adds what
should not change with tone: ambient occlusion (gentler on the face), warmer
lips and cheeks, lighter palms, soles and nails. Roughness 0.52, specular 0.45.

## Hair

* Short styles (lowcut, fade, waves, twa, cornrows) are shells lifted off the
  scalp with a snapped, clean hairline; fades use alpha masking.
* Volume and strand styles add geometry to a scalp cap in one mesh and one
  material: domes for afro, puff, bun and duku; tapered tubes grown from roots
  with gravity and head/body collision for twists, locs and braids; lofted
  sheets for bob and bonestraight. Below the neck, weights blend from `Head`
  to `Spine2` so long hair rides the back.
* Cornrows cut partings with alpha masking so scalp shows between rows; the
  duku uses an original Ankara-style print tinted by `hatCol`.
* Beards are cut from the face surface and keep its expression and slider
  morphs; stubble is a soft blended shadow, goatee and full beard are shells.
* One near-white procedural texture per style family; colour comes from the
  saved `hairCol`. No strand simulation; long braids or locs may get 1–2 helper
  bones.

## Clothing

* Garments are shells lifted from the body surface: same skin weights, smooth
  cut lines (hem, collar, sleeve), a turned-back hem for thickness, and a chest
  envelope so tops drape rather than cling.
* World-scale projected UVs (22 cm repeat) keep prints the same size on every
  garment. Original procedural fabrics (jersey, pique, cotton, twill, fleece,
  mesh, denim, kente, Ankara and fugu weaves) tinted by the saved colour.
* Body faces a garment covers are removed for that outfit, which prevents
  clipping and saves triangles.
* Shoes are lofted from foot cross-sections (1.2–2.5k triangles per pair):
  closed uppers with an ankle opening, sandals as sole plus straps, boots with
  a shaft, heels as pumps with a heel post.
* Free-hanging parts (skirts, dresses, kaftan and fugu tails, peplum, jacket
  skirt) are lofted rings weighted from `Hips` to the nearest leg.
* A clearance pass keeps every shell vertex at least 4 mm outside the rest
  body; the chest envelope bridges the bust from the body's real depth.
* Every garment declares the body regions it covers end to end
  (`awd_hides_regions`); the runtime drops body triangles inside them.
* Fixed artwork (flag patch, star badge, tricolour trim, beads, tie) uses
  `AWD_Print_*` materials that are never tinted.

## Budgets (provisional, measured on the prototype)

| Level | Use | Target | Prototype |
|---|---|---|---|
| LOD0 | creator, close-ups | ≤ 30k tris, ≤ 13 draws | 28k tris, 12 meshes, 2.5 MB |
| LOD1 | normal gameplay | 8–15k tris, ≤ 10 draws | 12.5k tris, 9 meshes, 1.25 MB |
| LOD2 | distant multiplayer | ≤ 5k tris | 4.4k tris, 9 meshes, 0.85 MB |
| Skeleton | all | 67 bones (54 deforming), 4 influences | as target |
| Morphs | expressions LOD0; sliders all LODs | 9 + 9 | 18 at LOD0, 9 at LOD1/2 (no morph normals) |
| Textures | per part | 128–512 px PNG | 256–512 px |

LOD2 still spends nine draw calls; merging it into one atlased mesh is the next
optimisation. Numbers come from `characters/export/*_report.json` and the lab
(`characters/previews/*_runtime_stats.json`). Desktop software rendering does
not prove phone frame rates; device testing is still required.

## Skeleton conventions

* Names match the live game (`Hips … LeftHandPinky4 … RightToe_End`).
* Rest pose: relaxed A-pose (arms about 45° down), facing −Y in Blender and +Z
  in glTF. Bone rolls follow the MakeHuman joint planes.
* Non-deforming bones: `HeadTop_End`, `*Toe_End`, `*Hand*4`, kept for name
  compatibility and exported (`export_def_bones=False`).

## Animation conventions

* 30 fps, in place, no root motion. `Hips` translation carries only small
  offsets (bob, sway) around the rest height.
* Every clip keys every bone (the glTF exporter samples all bones per clip).
* Looping clips end on their first pose. Names: `idle`, `walk`, `run`, `agree`,
  `shake`, `sad`, `dance`, `wave`, then activity clips (`sit_idle`, `type`, …).
* Authored as rotations about character axes on a shared relaxed base pose
  (`awd_anim.py`), so new clips stay consistent.

## Export conventions

* glTF 2.0 binary, Y-up, metres, embedded PNG textures, no cameras or lights.
* One file per body and LOD containing body, face parts, rig and clips; one file
  per garment or hair part sharing the same skin joints.
* Alpha-tested materials are post-fixed to `MASK`; cloth is double-sided.
* Source `.blend` files are saved with relative texture paths.
