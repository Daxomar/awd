"""Build the Accra We Dey prototype character from scratch inside Blender.

Usage from the Blender MCP or Blender's Python console:
    AWD_ROOT = r'...\\awd3'
    exec(open(AWD_ROOT + r'\\characters\\scripts\\build_prototype.py').read())
    stage_body('male'); stage_dress(); stage_save_export()

Stages are separate because a full build takes a few minutes on a modest laptop.
"""
import json
import time
from pathlib import Path

import bpy

ROOT = Path(globals().get('AWD_ROOT'))
SCRIPTS = ROOT / 'characters' / 'scripts'
MODULES = ['awd_human.py', 'awd_textures.py', 'awd_face.py', 'awd_expressions.py', 'awd_rig.py',
           'awd_skin.py', 'awd_hair.py', 'awd_clothes.py', 'awd_shoes.py', 'awd_anim.py', 'awd_export.py', 'awd_morphs.py',
           'awd_preview.py', 'awd_hair_volume.py', 'awd_beard.py', 'awd_regions.py', 'awd_wardrobe.py',
           'awd_accessories.py']
G = {'AWD_ROOT': str(ROOT), '__name__': 'awd_pipeline'}
for _module in MODULES:
    exec(compile((SCRIPTS / _module).read_text(), _module, 'exec'), G)
STATE = bpy.app.driver_namespace.setdefault('awd_state', {})
PREFIXES = ('AWD_Body', 'AWD_Eye', 'AWD_Brows', 'AWD_Lashes', 'AWD_Teeth', 'AWD_Tongue', 'AWD_Rig',
            'AWD_Hair', 'AWD_Top', 'AWD_Bottom', 'AWD_Shoes', 'AWD_Full', '_tmp', 'H_')


def clean_scene():
    for obj in list(bpy.data.objects):
        if obj.name.startswith(PREFIXES):
            bpy.data.objects.remove(obj, do_unlink=True)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    for mesh in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(mesh)
    for coll in (bpy.data.meshes, bpy.data.armatures):
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)


def collection(name, objects):
    coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    for obj in objects:
        for other in list(obj.users_collection):
            other.objects.unlink(obj)
        coll.objects.link(obj)
    return coll


def stage_body(sex='male'):
    t = time.time()
    clean_scene()
    ctx = G['build_body'](sex)
    face = G['build_face'](ctx, G)
    teeth, tongue = face['mouth']
    expressive = [ctx['body'], face['brows'], face['lashes'], teeth, tongue]
    G['build_expressions'](ctx, expressive)
    rig = G['build_game_rig'](ctx)
    for obj in expressive + face['eyes']:
        G['convert_weights'](obj, rig)
    ctx['rig'] = rig
    G['bake_skin_colours'](ctx, [ctx['body']])
    ctx['body'].data.materials.clear()
    ctx['body'].data.materials.append(G['skin_material'](5))
    regions, body_co = G['compute_regions'](ctx)
    G['write_attribute'](ctx['body'], regions)
    STATE['regions'] = (regions, body_co)
    ctx['mh_rig'].hide_viewport = ctx['mh_rig'].hide_render = True
    collection('AWD_Source', [ctx['mh_rig']])
    collection('AWD_Character', [rig] + expressive + face['eyes'])
    STATE.update(ctx=ctx, face=face, parts=expressive + face['eyes'], sex=sex)
    return {'seconds': round(time.time() - t, 1), 'objects': [o.name for o in STATE['parts']]}


def stage_dress(hair='fade'):
    t = time.time()
    ctx = STATE['ctx']
    for obj in list(bpy.data.objects):
        if obj.name.startswith(('AWD_Hair', 'AWD_Top', 'AWD_Bottom', 'AWD_Shoes', 'AWD_Full')):
            bpy.data.objects.remove(obj, do_unlink=True)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    hair_obj = G['build_short_hair'](ctx, G, hair)
    garments = [G['tee'](ctx, G), G['jeans'](ctx, G), G['build_shoe'](ctx, G, 'sneakers')]
    collection('AWD_Hair', [hair_obj])
    collection('AWD_Wardrobe', garments)
    clips = G['build_library'](ctx['rig'])
    morph = G['build_body_morphs'](ctx, STATE['parts'] + [hair_obj] + garments, STATE['sex'])
    STATE.update(hair=hair_obj, garments=garments, morph=morph)
    return {'seconds': round(time.time() - t, 1), 'clips': [c.name for c in clips],
            'garments': [g.name for g in garments]}


def stage_save_export():
    t = time.time()
    ctx, sex = STATE['ctx'], STATE['sex']
    rig = ctx['rig']
    src = ROOT / 'characters' / 'source' / f'awd_{sex}_prototype.blend'
    src.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(src))
    bpy.ops.file.make_paths_relative()   # portable: textures resolve from characters/textures
    bpy.ops.wm.save_mainfile()
    out = ROOT / 'characters' / 'export'
    reports = {}
    dressed = [STATE['hair']] + STATE['garments']
    for lod in (0, 1, 2):
        copies = G['prepare_copies'](STATE['parts'], dressed, lod=lod, suffix=f'_lod{lod}', morph=STATE['morph'])
        path = out / f'awd_{sex}_prototype_lod{lod}.glb'
        G['export_glb'](path, copies, rig, animations=True, morph_normals=False)
        reports[path.name] = G['glb_report'](path)
        for obj in copies:
            bpy.data.objects.remove(obj, do_unlink=True)
        for mesh in [m for m in bpy.data.meshes if m.users == 0]:
            bpy.data.meshes.remove(mesh)
    for part in dressed:
        copies = G['prepare_copies']([], [part], lod=0, suffix='_part', morph=STATE['morph'])
        path = out / 'parts' / f"{part['awd_slot']}_{part['awd_id']}_{sex}.glb"
        G['export_glb'](path, copies, rig, animations=False)
        reports[path.name] = G['glb_report'](path)
        for obj in copies:
            bpy.data.objects.remove(obj, do_unlink=True)
        for mesh in [m for m in bpy.data.meshes if m.users == 0]:
            bpy.data.meshes.remove(mesh)
    (out / f'awd_{sex}_prototype_report.json').write_text(json.dumps(reports, indent=2))
    bpy.ops.wm.save_mainfile()
    return {'seconds': round(time.time() - t, 1), 'blend': str(src), 'reports': reports}


# Saved hair ids per body (server/src/game/wardrobe.js: g 'u' items go to both).
HAIR_IDS = {'male': ['lowcut', 'fade', 'waves', 'afro', 'twists', 'locs', 'cornrows'],
            'female': ['lowcut', 'fade', 'afro', 'twists', 'locs', 'cornrows', 'puff', 'bun', 'twa', 'braids', 'bob',
                       'bonestraight', 'duku']}
BEARD_IDS = ['stubble', 'goatee', 'fullbeard']   # male only; nobeard and bald need no asset


def _export_part(obj, sex, reports, out):
    for lod in (0, 1):
        copies = G['prepare_copies']([], [obj], lod=lod, suffix=f'_l{lod}', morph=STATE['morph'])
        name = f"{obj['awd_slot']}_{obj['awd_id']}_{sex}" + ('' if lod == 0 else '_lod1') + '.glb'
        path = out / name
        G['export_glb'](path, copies, STATE['ctx']['rig'], animations=False)
        reports[name] = G['glb_report'](path)
        for c in copies:
            bpy.data.objects.remove(c, do_unlink=True)
        for mesh in [m for m in bpy.data.meshes if m.users == 0]:
            bpy.data.meshes.remove(mesh)


def stage_library(styles=None, beards=None):
    """Build, morph and export every hair (and, for the male body, beard) part."""
    t = time.time()
    ctx, sex = STATE['ctx'], STATE['sex']
    if 'morph' not in STATE:
        STATE['morph'] = G['body_deltas'](ctx, sex)
    deltas, body_co = STATE['morph']
    out = ROOT / 'characters' / 'export' / 'parts'
    reports, built = {}, []
    styles = HAIR_IDS[sex] if styles is None else styles
    beards = (BEARD_IDS if sex == 'male' else []) if beards is None else beards
    for style in styles:
        old = bpy.data.objects.get(f'AWD_Hair_{style}')
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        obj = G['build_short_hair'](ctx, G, style) if style in G['SHORT'] else G['build_volume_hair'](ctx, G, style)
        part_deltas, co = G['transfer'](deltas, body_co, obj)
        G['add_keys'](obj, part_deltas, co)
        built.append(obj)
    for style in beards:
        old = bpy.data.objects.get(f'AWD_Beard_{style}')
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        built.append(G['build_beard'](ctx, G, style))   # keeps the body's expression and slider keys
    collection('AWD_Library', built)
    for obj in built:
        _export_part(obj, sex, reports, out)
        obj.hide_viewport = obj.hide_render = True
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'characters' / 'source' / f'awd_{sex}_library.blend'))
    bpy.ops.file.make_paths_relative()
    bpy.ops.wm.save_mainfile()
    report = ROOT / 'characters' / 'export' / f'awd_{sex}_library_report.json'
    merged = {**(json.loads(report.read_text()) if report.exists() else {}), **reports}   # partial rebuilds keep the rest
    report.write_text(json.dumps(merged, indent=2))
    return {'seconds': round(time.time() - t, 1),
            'parts': {k: {'tris': v['triangles'], 'kb': v['bytes'] // 1024} for k, v in reports.items()}}


WARDROBE_IDS = {
    'male': ['tee', 'flagtee', 'singlet', 'polo', 'hoodie', 'jersey', 'jerseyaway', 'ankara', 'kenteshirt', 'fugu',
             'office', 'kaftan', 'suit', 'jeans', 'shorts', 'joggers', 'chinos', 'suitpants', 'ankarapants', 'kentecloth',
             'slides', 'sneakers', 'ahenema', 'loafers', 'boots', 'cap', 'bucket', 'kufi', 'shades', 'specs',
             'chain', 'beads', 'stole'],
    'female': ['tee', 'flagtee', 'crop', 'polo', 'hoodie', 'jersey', 'jerseyaway', 'ankara', 'kenteshirt', 'office',
               'suit', 'kaba', 'blouse', 'jeans', 'shorts', 'joggers', 'chinos', 'suitpants', 'ankarapants', 'slit',
               'mini', 'pencil', 'kenteskirt', 'sundress', 'ankaradress', 'kentedress', 'bodycon', 'slides',
               'sneakers', 'ahenema', 'loafers', 'heels', 'boots', 'cap', 'bucket', 'shades', 'specs', 'chain',
               'beads', 'stole'],
}


def _build_item(ctx, item):
    if item in G['STYLES']:
        return G['build_shoe'](ctx, G, item)
    if item in G['HATS'] or item in G['GLASSES'] or item in G['NECK']:
        return G['build_accessory'](ctx, G, item)
    return G['build_garment'](ctx, G, item)


def stage_base_export():
    """Undressed body per LOD (face parts, rig, clips, body regions) for modular dressing."""
    t = time.time()
    sex, out, reports = STATE['sex'], ROOT / 'characters' / 'export', {}
    for lod in (0, 1, 2):
        copies = G['prepare_copies'](STATE['parts'], [], lod=lod, suffix=f'_b{lod}', morph=STATE['morph'],
                                     regions=STATE['regions'])
        path = out / f'awd_{sex}_base_lod{lod}.glb'
        G['export_glb'](path, copies, STATE['ctx']['rig'], animations=True, attributes=True)
        reports[path.name] = G['glb_report'](path)
        for c in copies:
            bpy.data.objects.remove(c, do_unlink=True)
    for mesh in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(mesh)
    report = out / f'awd_{sex}_prototype_report.json'
    report.write_text(json.dumps({**(json.loads(report.read_text()) if report.exists() else {}), **reports}, indent=2))
    return {'seconds': round(time.time() - t, 1), 'base': {k: v['triangles'] for k, v in reports.items()}}


def stage_wardrobe(items=None):
    """Build, morph and export every wardrobe id this body may wear (LOD0 and LOD1 parts)."""
    t = time.time()
    ctx, sex = STATE['ctx'], STATE['sex']
    deltas, body_co = STATE['morph']
    out = ROOT / 'characters' / 'export' / 'parts'
    reports, built, failed = {}, [], {}
    for item in (WARDROBE_IDS[sex] if items is None else items):
        for prefix in ('AWD_Top_', 'AWD_Bottom_', 'AWD_Full_', 'AWD_Shoes_', 'AWD_Hat_', 'AWD_Glasses_', 'AWD_Neck_'):
            old = bpy.data.objects.get(prefix + item)
            if old and old.name not in [o.name for o in STATE.get('garments', [])]:
                bpy.data.objects.remove(old, do_unlink=True)
        try:
            obj = _build_item(ctx, item)
        except Exception as error:   # keep going; the report lists what failed and why
            failed[item] = repr(error)
            continue
        part_deltas, co = G['transfer'](deltas, body_co, obj)
        G['add_keys'](obj, part_deltas, co)
        obj.name = obj.data.name = f"AWD_W_{obj['awd_slot']}_{item}"
        built.append(obj)
    collection('AWD_Wardrobe_Library', built)
    for obj in built:
        _export_part(obj, sex, reports, out)
        obj.hide_viewport = obj.hide_render = True
    report = ROOT / 'characters' / 'export' / f'awd_{sex}_wardrobe_report.json'
    report.write_text(json.dumps({**(json.loads(report.read_text()) if report.exists() else {}), **reports}, indent=2))
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'characters' / 'source' / f'awd_{sex}_wardrobe.blend'))
    bpy.ops.file.make_paths_relative()
    bpy.ops.wm.save_mainfile()
    return {'seconds': round(time.time() - t, 1), 'built': len(built), 'failed': failed,
            'parts': {k: v['triangles'] for k, v in reports.items() if not k.endswith('_lod1.glb')}}
