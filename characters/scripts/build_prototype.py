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
           'awd_skin.py', 'awd_hair.py', 'awd_clothes.py', 'awd_shoes.py', 'awd_anim.py', 'awd_export.py',
           'awd_preview.py']
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
    STATE.update(hair=hair_obj, garments=garments)
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
        copies = G['prepare_copies'](STATE['parts'], dressed, lod=lod, suffix=f'_lod{lod}')
        path = out / f'awd_{sex}_prototype_lod{lod}.glb'
        G['export_glb'](path, copies, rig, animations=True, morph_normals=(lod == 0))
        reports[path.name] = G['glb_report'](path)
        for obj in copies:
            bpy.data.objects.remove(obj, do_unlink=True)
        for mesh in [m for m in bpy.data.meshes if m.users == 0]:
            bpy.data.meshes.remove(mesh)
    for part in dressed:
        copies = G['prepare_copies']([], [part], lod=0, suffix='_part')
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
