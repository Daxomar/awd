"""Accra We Dey character pipeline, stage D: facial hair (male ids stubble, goatee, fullbeard).

Beards are cut from the face surface of the body, so they keep the body's skin
weights, expression keys and slider keys: a beard opens with the jaw, smiles
with the mouth and widens with `faceWidth`. Lips and nostrils stay clear.
`nobeard` needs no asset.
"""
import bmesh
import bpy
import numpy as np

BEARDS = {
    # style: (thickness at chin m, thickness at sideburn m, region, texture)
    'stubble': (0.0005, 0.0004, 'full', 'stubble'),
    'goatee': (0.0045, 0.0030, 'goatee', 'coily'),
    'fullbeard': (0.0085, 0.0030, 'full', 'coily'),
}


def beard_mask(ctx, centres, region):
    J = ctx['joints']
    L = landmarks(ctx)   # awd_expressions: eyes, mouth, corners
    eye = (L['eyes']['L'] + L['eyes']['R']) / 2
    mouth, corner_x = L['mouth'], abs(L['corners']['L'][0])
    chin_z = J['jaw____tail'][2]
    x, y, z = centres[:, 0], centres[:, 1], centres[:, 2]
    face = (y < eye[1] + 0.05) & (z < eye[2] - 0.03) & (z > chin_z - 0.035)
    face &= ~((z < chin_z + 0.01) & (y > eye[1] + 0.035))          # stay off the throat
    lips = (np.abs(x) < corner_x + 0.003) & (np.abs(z - mouth[2]) < 0.0085)
    nose = (np.abs(x) < 0.022) & (z > mouth[2] + 0.017)
    cheeks_high = (np.abs(x) > 0.03) & (z > mouth[2] + 0.028)        # leave the upper cheek bare
    mask = face & ~lips & ~nose & ~cheeks_high
    if region == 'goatee':
        mask &= (np.abs(x) < corner_x + 0.008) & (z < mouth[2] + 0.017)
    return mask


def build_beard(ctx, G, style):
    chin_t, side_t, region, kind = BEARDS[style]
    body = ctx['body']
    centres = np.array([p.center[:] for p in body.data.polygons])
    keep = beard_mask(ctx, centres, region)
    obj = body.copy()
    obj.data = body.data.copy()
    obj.name = obj.data.name = f'AWD_Beard_{style}'
    obj.modifiers.clear()
    for attr in list(obj.data.color_attributes):
        obj.data.color_attributes.remove(attr)
    bpy.context.scene.collection.objects.link(obj)
    chin_z = ctx['joints']['jaw____tail'][2]
    # Offset every shape key (basis, expressions, sliders) by the same normal push so
    # the beard keeps its thickness while the face animates.
    keys = obj.data.shape_keys.key_blocks if obj.data.shape_keys else []
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep[f.index]], context='FACES')
    bm.normal_update()
    layers = [bm.verts.layers.shape.get(k.name) for k in keys]
    uv = bm.loops.layers.uv.active
    for v in bm.verts:
        t = float(np.clip((v.co.z - chin_z) / 0.06, 0, 1))
        push = v.normal * (chin_t + (side_t - chin_t) * t)
        v.co += push
        for layer in layers:
            if layer is not None:
                v[layer] += push
    for f in bm.faces:
        for loop in f.loops:
            x, _, z = loop.vert.co
            loop[uv].uv = (x * 12, z * 12)
    bm.to_mesh(obj.data)
    bm.free()
    if kind == 'stubble':
        mat = G['_material']('AWD_Beard_stubble', (0.008, 0.006, 0.006), 0.8, G['stubble_alpha'](), alpha_clip=0.0)
    else:
        mat = G['_material'](f'AWD_Beard_{style}', (0.008, 0.006, 0.006), 0.7, bpy.data.images.get('awd_hair_coily') or G['_hair_image'](G, 'coily', False))
    next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE').extension = 'REPEAT'
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    obj.parent = ctx['rig']
    obj.modifiers.new('Armature', 'ARMATURE').object = ctx['rig']
    obj['awd_slot'], obj['awd_id'], obj['awd_tint'] = 'beard', style, 'hair'
    return obj
