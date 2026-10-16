"""Accra We Dey character pipeline, stage 6: modular hairstyles.

Short styles (lowcut, fade, waves, twa, cornrows) are shells lifted off the
scalp of the body mesh, so they fit every head exactly and inherit its skin
weights. Each has an original procedural texture; colour comes from the
material base colour factor (the saved hairCol), so one texture serves every
colour. Fades use alpha masking (glTF MASK) for the gradual taper.
"""
import math

import bmesh
import bpy
import numpy as np

SHORT = {
    # style: (crown thickness m, side thickness m, fade start above eye m, fade end above eye m, texture)
    'lowcut': (0.0045, 0.0030, None, None, 'coily'),
    'fade': (0.0060, 0.0012, 0.004, 0.040, 'coily'),
    'waves': (0.0040, 0.0028, None, None, 'waves'),
    'twa': (0.0110, 0.0080, None, None, 'coily'),
    'cornrows': (0.0055, 0.0050, None, None, 'cornrows'),
}


def _smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def head_frame(ctx):
    J = ctx['joints']
    eyes = [np.array(J[f'eye.{s}____head']) for s in ('L', 'R')]
    eye = (eyes[0] + eyes[1]) / 2
    return {'eye': eye, 'top': np.array(J['head____tail']),
            'centre': np.array([0.0, eye[1] + 0.085, eye[2] + 0.015])}


def scalp_angle(p, F):
    """0 at the forehead, pi at the back of the head."""
    d = p[..., :2] - F['centre'][:2]
    return np.arccos(np.clip(-d[..., 1] / np.maximum(np.linalg.norm(d, axis=-1), 1e-9), -1, 1))


def hairline(p, F):
    theta = scalp_angle(p, F)
    temple = np.exp(-((theta - 0.62) / 0.18) ** 2)
    return F['eye'][2] + 0.050 - 0.084 * _smoothstep(0.30 * math.pi, 0.97 * math.pi, theta) - 0.006 * temple


def is_ear(p, F):
    return (np.abs(p[..., 0]) > 0.064) & (p[..., 2] < F['eye'][2] + 0.026) & (p[..., 1] > F['eye'][1] + 0.035)


def _hair_image(G, kind, fade):
    w, h = 512, 256
    rng = np.random.default_rng({'coily': 21, 'waves': 22, 'cornrows': 23}[kind])
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    u, v = (xx + 0.5) / w, (yy + 0.5) / h
    dots = np.ones((h, w))
    if kind == 'coily':
        tone = np.zeros((h, w))
        for _ in range(2600):
            cx, cy, r = rng.random() * w, rng.random() * h, 1.2 + rng.random() * 2.2
            d = np.hypot(((xx - cx + w / 2) % w) - w / 2, yy - cy)
            tone = np.maximum(tone, np.exp(-((d - r) / 0.7) ** 2) * (0.6 + 0.4 * rng.random()))
        albedo, dots = 0.55 + 0.45 * tone, tone
    elif kind == 'waves':
        ripple = 0.5 + 0.5 * np.sin(v * 2 * math.pi * 26 + np.sin(u * 2 * math.pi * 6) * 1.4)
        albedo = 0.45 + 0.4 * ripple + rng.random((h, w)) * 0.25
    else:  # cornrows: parallel raised braids running front to back
        phase = (u * 18) % 1.0
        braid = np.exp(-((phase - 0.5) / 0.28) ** 2)
        weave = 0.5 + 0.5 * np.sin((v * 90 + (u * 18).astype(int) * 0.5) * math.pi)
        albedo = 0.25 + 0.65 * braid * (0.7 + 0.3 * weave)
    alpha = np.ones((h, w))
    if kind == 'cornrows':   # partings between rows show the scalp
        alpha = (braid > 0.22).astype(float)
    if fade:
        density = _smoothstep(0.0, 1.0, v)
        alpha = ((rng.random((h, w)) * 0.35 + dots * 0.65) > 1.0 - density).astype(float)
    rgba = np.stack([albedo, albedo, albedo, alpha], axis=-1)
    name = f'awd_hair_{kind}' + ('_fade' if fade else '')
    return G['save_image'](name, np.clip(rgba, 0, 1), alpha=bool(fade) or kind == 'cornrows')


def hair_material(G, style, colour=(0.008, 0.006, 0.006)):
    _, _, fade_start, _, kind = SHORT[style]
    name = f'awd_hair_{kind}' + ('_fade' if fade_start is not None else '')
    image = bpy.data.images.get(name) or _hair_image(G, kind, fade=fade_start is not None)   # generation is slow; reuse
    masked = fade_start is not None or kind == 'cornrows'
    mat = G['_material'](f'AWD_Hair_{style}', colour, 0.6, image, alpha_clip=0.5 if masked else None)
    next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE').extension = 'REPEAT'
    return mat


def build_short_hair(ctx, G, style):
    crown, side, fade_start, fade_end, kind = SHORT[style]
    F = head_frame(ctx)
    body = ctx['body']
    centres = np.array([p.center[:] for p in body.data.polygons])
    keep = (centres[:, 2] > hairline(centres, F)) & ~is_ear(centres, F)
    obj = body.copy()
    obj.data = body.data.copy()
    obj.name = obj.data.name = f'AWD_Hair_{style}'
    obj.modifiers.clear()
    obj.shape_key_clear()
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep[f.index]], context='FACES')
    G['snap_boundary'](bm, [G['cut'](lambda p: float(p[2] - hairline(p, F)))])   # clean hairline
    bm.normal_update()
    top_z, low, eye_z = F['top'][2], F['eye'][2] - 0.04, F['eye'][2]
    for vert in bm.verts:
        z = vert.co.z
        thickness = side + (crown - side) * _smoothstep(eye_z - 0.01, top_z - 0.03, z)
        if fade_start is not None:
            thickness *= 0.6 + 0.4 * _smoothstep(eye_z + fade_start, eye_z + fade_end, z)
        vert.co += vert.normal * thickness
    uv = bm.loops.layers.uv.active or bm.loops.layers.uv.new('UVMap')
    for face in bm.faces:
        for loop in face.loops:
            x, y, z = loop.vert.co
            if kind == 'cornrows':
                loop[uv].uv = (0.5 + x / 0.16, (y - F['centre'][1]) / 0.25 + 0.5)
                continue
            theta = math.atan2(x, -(y - F['centre'][1]))
            if fade_start is not None:
                v = min(max((z - (eye_z + fade_start)) / (fade_end - fade_start), 0.0), 1.0)
            else:
                v = (z - low) / (top_z - low)
            loop[uv].uv = (theta / (2 * math.pi) * 3 + 0.5, 0.02 + 0.96 * min(max(v, 0.0), 1.0))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.materials.clear()
    obj.data.materials.append(hair_material(G, style))
    obj.parent = ctx.get('rig') or ctx['mh_rig']
    obj.modifiers.new('Armature', 'ARMATURE').object = obj.parent
    obj['awd_slot'] = 'hair'
    obj['awd_id'] = style
    return obj
