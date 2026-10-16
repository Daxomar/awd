# Accra We Dey character pipeline

Blender-built, game-ready characters for Accra We Dey. Everything is generated
by reproducible scripts from CC0 anatomy plus original procedural artwork, then
exported to glTF and validated in Three.js 0.180 with the game's renderer
settings. The live game draws every player and NPC with these assets
(`client/src/v2/scene/awd-avatar.js`); see `docs/prototype-report.md` for status.

## Layout

| Path | Contents |
|---|---|
| `scripts/` | Blender pipeline modules (`awd_*.py`) and `build_prototype.py` |
| `source/` | Editable `.blend` files (textures linked relatively from `textures/`) |
| `textures/` | Original procedural textures (iris, brows, lashes, hair, fabrics) |
| `export/` | Exported GLBs, LODs, modular parts and per-export reports |
| `previews/` | Review renders captured from the Three.js lab, plus runtime stats |
| `docs/` | `game-contract.md`, `art-bible.md`, `prototype-report.md` |
| `tools/` | `capture_lab.py` (renders and stats), `build-manifest.mjs` |
| `manifest.json` | Appearance id → asset map, rig, morphs, clips, measurements |

Runtime copies live in `client/public/assets/characters/prototype/` (tracked);
`export/*.glb` are build outputs and are not committed. The
validation page is `client/character-lab.html` (`client/src/character-lab/`).

## In the game

* `client/src/v2/scene/avatars.js` loads the catalogue, both LOD1 base bodies and
  the fallback outfit (tee, jeans, slides, `lowcut`/`puff`) at boot, then
  `new Avatar(look)` returns an `AwdAvatar` with the old `Character` API
  (`root`, `model`, `mixer`, `play`, `gesture`, `update(dt, speed)`, `setLook`,
  `dispose`) plus `ready`, which resolves once the outfit is attached.
* Other parts load on first use and are cached for the session; a restyle keeps
  the old outfit until the new one has loaded, and the undressed body is never
  shown. The studio asks for LOD0 (`new Avatar(look, { lod: 0 })`) for blinking
  and expressions; rooms, rides and portraits use LOD1.
* Substitutions (`resolveParts`): `full` replaces top and bottom; volume hair
  under a hat becomes `lowcut`; an id not built for a body falls back to the
  default outfit for that slot.
* `client/public/assets/characters/prototype/catalogue.json` (written by
  `build-manifest.mjs`) lists the part files and a content hash per GLB. The
  server caches GLBs as immutable, so the runtime requests `file?v=<hash>`;
  rerun `build-manifest.mjs` after every export.
* Classic procedural avatars remain the fallback when the assets fail to load,
  and can be forced with `?avatars=classic` or
  `localStorage['awd.avatars'] = 'classic'`.

## Rebuild

Prerequisites: Blender 5.2 and the MakeHuman CC0 sources in
`.local/human-source` (`python tools/fetch-human.py`).

In Blender's Python console or through the Blender MCP:

```python
AWD_ROOT = r'C:\path\to\awd3'
exec(open(AWD_ROOT + r'\characters\scripts\build_prototype.py').read())
stage_body('male')      # body, face, expressions, game rig, skin (~15 s); or 'female'
stage_dress('fade')     # hair ('twa' for the female), tee, jeans, sneakers, clips, slider morphs (~1 min)
stage_save_export()     # .blend, LOD0-2 GLBs, parts, report (~35 s)
stage_library()         # every hair id for this body (+ beards for male), LOD0/LOD1 parts (~1 min)
stage_base_export()     # undressed body LOD0-2 with body regions (~1 min)
stage_wardrobe()        # every wardrobe id for this body, LOD0/LOD1 parts (~12 min)
```

Headless alternative (no MCP), for example after a Blender restart:

```bash
blender --background --factory-startup --python characters/tools/run_stages.py -- male body,dress,export,base,library,wardrobe
```

Then copy the exports to the client and refresh the manifest:

```bash
cp characters/export/*.glb client/public/assets/characters/prototype/
```

```bash
cp characters/export/parts/*.glb client/public/assets/characters/prototype/parts/
```

```bash
node characters/tools/build-manifest.mjs
```

## Validate

Start Vite (`cd client && npm run dev`), open
`http://127.0.0.1:5173/character-lab.html?lod=0&cam=three_quarter`, or capture
everything headlessly:

```bash
python characters/tools/capture_lab.py male_prototype
```

Lab parameters: `body=m|f`, `lod=0|1|2`, slider values such as `build=0..1`, `n=<instances>`, `clip=idle|walk|run|wave|agree|shake|sad|dance`,
`tone=1..8`, `expr=happy|sad|angry|surprised|concerned|laughing|talking|blinking`,
`cam=front|three_quarter|side|back|game|face|grid|gridback`, `t=<freeze seconds>`, `hud=1`,
`hair=<id>`, `beard=<id>`, `hairs=<id,…>` or `beards=<id,…>` (one character per
style, parts attached at runtime), `base=1` (undressed body dressed from parts:
`top|bottom|full|shoes|hat|glasses|neck=<id>`), `items=slot:id,…` (one character per
catalogue item), `cam=gridfull|gridfeet`. Capture sets: `--set=hair`, `--set=wear`.
`window.__LAB` exposes `measure()`, `churnTest()`, `setTone()`,
`setExpression()` and `play()` for automated checks.

## Licences

* Anatomy, macro targets and skin weights: MakeHuman Community assets, CC0 1.0
  (see `client/public/assets/models/LICENSE-human.md`).
* Textures, garments, hair, shoes, teeth, eyes, expressions and animation:
  original work generated by the scripts in this folder.
* No third-party character meshes, rigs, textures or animations are used.
