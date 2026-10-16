"""Accra We Dey character pipeline, stage 9: game-ready GLB export.

Exports are made from temporary copies so the editable .blend keeps every
layer: body faces hidden by the outfit are deleted (shape keys survive bmesh
edits), LOD copies drop expression keys and are decimated, and alpha-tested
materials are fixed up to glTF MASK after export.
"""
import json
import struct
from pathlib import Path

import bmesh
import bpy

ALPHA_MASK = {'AWD_Brows': 0.45, 'AWD_Lashes': 0.35}
LOD_RATIO = {'AWD_Body': 0.42, 'AWD_Top': 0.45, 'AWD_Bottom': 0.45, 'AWD_Hair': 0.6, 'AWD_Shoes': 0.6}


def copy_object(obj, name):
    dup = obj.copy()
    dup.data = obj.data.copy()
    dup.name = dup.data.name = name
    if 'awd_hides' in dup:
        del dup['awd_hides']
    bpy.context.scene.collection.objects.link(dup)
    return dup


def delete_faces(obj, indices):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    doomed = set(indices)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index in doomed], context='FACES')
    bm.to_mesh(obj.data)
    bm.free()


def decimate(obj, ratio):
    mod = obj.modifiers.new('LOD', 'DECIMATE')
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_move_to_index(modifier='LOD', index=0)
    bpy.ops.object.modifier_apply(modifier='LOD')


def prepare_copies(parts, garments, lod=0, suffix=''):
    """parts: body-side objects; garments: outfit objects with awd_hides. Returns export copies."""
    hidden = set()
    for g in garments:
        hidden |= set(g.get('awd_hides', []))
    copies = []
    for obj in parts + garments:
        dup = copy_object(obj, obj.name + suffix)
        for mod in [m for m in dup.modifiers if m.type != 'ARMATURE']:
            dup.modifiers.remove(mod)
        if obj.name.startswith('AWD_Body'):
            delete_faces(dup, hidden)
        if lod:
            if obj.name.startswith(('AWD_Lashes', 'AWD_Tongue', 'AWD_Teeth')):
                bpy.data.objects.remove(dup, do_unlink=True)
                continue
            prefix = next((p for p in LOD_RATIO if obj.name.startswith(p)), None)
            ratio = LOD_RATIO.get(prefix, 1.0) * (0.35 if lod == 2 else 1.0)
            if dup.data.shape_keys:
                dup.shape_key_clear()
            if ratio < 1.0:
                decimate(dup, ratio)
        copies.append(dup)
    return copies


def export_glb(path, objects, rig, animations=True, morph_normals=False):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objects + [rig]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True, export_yup=True,
        export_apply=False, export_skins=True, export_morph=True, export_morph_normal=morph_normals,
        export_animations=animations, export_animation_mode='ACTIONS', export_force_sampling=True,
        export_optimize_animation_size=True, export_def_bones=False, export_extras=True,
        export_cameras=False, export_lights=False, export_image_format='AUTO')
    fix_materials(path)
    return path


def read_glb(path):
    data = Path(path).read_bytes()
    json_len = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + json_len]), data[20 + json_len:]


def write_glb(path, doc, rest):
    text = json.dumps(doc, separators=(',', ':')).encode()
    text += b' ' * ((-len(text)) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(text) + len(rest))
    out += struct.pack('<II', len(text), 0x4E4F534A) + text + rest
    Path(path).write_bytes(out)


def fix_materials(path):
    """glTF MASK for alpha-tested cards and fades; double-sided cloth."""
    doc, rest = read_glb(path)
    for mat in doc.get('materials', []):
        name = mat.get('name', '')
        cutoff = ALPHA_MASK.get(name)
        if name.startswith('AWD_Hair_') and name.endswith('fade'):
            cutoff = 0.5
        if cutoff is not None:
            mat['alphaMode'] = 'MASK'
            mat['alphaCutoff'] = cutoff
            mat['doubleSided'] = True
        elif mat.get('alphaMode') == 'BLEND':
            mat.pop('alphaMode')
        if name.startswith('AWD_Fabric'):
            mat['doubleSided'] = True
    write_glb(path, doc, rest)


def glb_report(path):
    doc, _ = read_glb(path)
    tris = sum(doc['accessors'][p['indices']]['count'] // 3 for m in doc.get('meshes', [])
               for p in m['primitives'] if 'indices' in p)
    return {'bytes': Path(path).stat().st_size, 'meshes': len(doc.get('meshes', [])), 'triangles': tris,
            'materials': [m['name'] for m in doc.get('materials', [])],
            'animations': [a['name'] for a in doc.get('animations', [])],
            'joints': len(doc['skins'][0]['joints']) if doc.get('skins') else 0,
            'morphs': sorted({n for m in doc.get('meshes', []) for n in m.get('extras', {}).get('targetNames', [])}),
            'images': len(doc.get('images', []))}
