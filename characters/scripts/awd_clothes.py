"""Accra We Dey character pipeline, stage 7: fitted garments and shoes.

Garments are shells lifted from the body surface, so they fit each body and
inherit its skin weights. Each shell is smoothed (cloth bridges skin detail),
offset by an ease that varies along the body, given a turned-back hem for
visible thickness, and UV-mapped by world-scale projection so prints keep a
constant size. The body faces a garment covers are recorded so the runtime can
hide them and avoid clipping.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

TILE = 0.22   # metres of fabric per texture repeat
FINGER_NAMES = ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')


def _smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def vertex_weights(obj, names):
    idx = {g.name: g.index for g in obj.vertex_groups}
    wanted = {idx[n] for n in names if n in idx}
    w = np.zeros(len(obj.data.vertices))
    for v in obj.data.vertices:
        for ge in v.groups:
            if ge.group in wanted:
                w[v.index] += ge.weight
    return w


def regions(ctx):
    """Per-vertex region fields shared by every garment recipe."""
    body, J = ctx['body'], ctx['joints']
    co = np.array([v.co[:] for v in body.data.vertices])
    arm_bones = [f'{s}{b}' for s in ('Left', 'Right') for b in ('Arm', 'ForeArm', 'Hand')]
    arm_bones += [f'{s}Hand{f}{k}' for s in ('Left', 'Right') for f in FINGER_NAMES for k in (1, 2, 3)]
    arm = vertex_weights(body, arm_bones)
    sleeve = np.zeros(len(co))   # 0 at the shoulder joint, 1 at the elbow, 2 at the wrist
    for s in ('L', 'R'):
        sh, el, wr = (np.array(J[f'{b}.{s}____head']) for b in ('upperarm01', 'lowerarm01', 'wrist'))
        side = np.sign(sh[0]) == np.sign(co[:, 0])
        upper = (co - sh) @ (el - sh) / np.dot(el - sh, el - sh)
        lower = 1 + (co - el) @ (wr - el) / np.dot(wr - el, wr - el)
        sleeve = np.where(side, np.where(upper < 1, upper, lower), sleeve)
    faces = body.data.polygons
    vid = [list(p.vertices) for p in faces]
    return {'co': co, 'centre': np.array([p.center[:] for p in faces]),
            'arm': np.array([arm[v].mean() for v in vid]), 'sleeve': np.array([sleeve[v].mean() for v in vid]),
            'hip_z': J['spine05____head'][2], 'waist_z': J['spine04____head'][2],
            'neck_z': J['neck01____head'][2], 'knee_z': J['lowerleg01.L____head'][2],
            'ankle_z': J['foot.L____head'][2], 'chest_y': J['spine01____head'][1]}


def taubin(bm, passes, mask):
    verts = list(bm.verts)
    nb = [[e.other_vert(v).index for e in v.link_edges] for v in verts]
    co = np.array([v.co[:] for v in verts])
    for _ in range(passes):
        for f in (0.5, -0.52):
            mean = np.array([co[n].mean(axis=0) if n else co[i] for i, n in enumerate(nb)])
            co += (mean - co) * (f * mask)[:, None]
    for v, c in zip(verts, co):
        v.co = c


def cut(field):
    """Pair a scalar field with its numerical gradient for snap_boundary."""
    def grad(p, h=1e-4):
        return np.array([(field(p + e * h) - field(p - e * h)) / (2 * h) for e in np.eye(3)])
    return field, grad


def sleeve_param(J, side):
    sh, el = (np.array(J[f'{b}.{side}____head']) for b in ('upperarm01', 'lowerarm01'))
    axis = el - sh
    return lambda p: float((p - sh) @ axis / (axis @ axis))


def snap_boundary(bm, cuts, iterations=3):
    """Move open-edge vertices onto smooth cut curves so hems and collars are clean.

    cuts: list of (field, gradient) callables; field(p) is 0 on the desired edge."""
    boundary = [v for v in bm.verts if v.is_boundary]
    for _ in range(iterations):
        for v in boundary:
            p = np.array(v.co[:])
            values = [abs(f(p)) for f, _ in cuts]
            f, grad = cuts[int(np.argmin(values))]
            g = grad(p)
            n2 = float(g @ g)
            if n2 > 1e-12:
                v.co = p - f(p) * g / n2


def chest_envelope(bm, ctx, step=0.025, ease=0.004, window=5, sigma=2.5):
    """Fabric bridges the chest instead of following pectoral and sternum contours.

    Mirrors client/src/v2/scene/garment-fit.js: per height band, find the torso's
    width and front-most depth, then lay front vertices on a smooth arched profile."""
    J = ctx['joints']
    centre = J['spine05____head'][1]
    lo, hi = J['spine05____head'][2] - 0.04, J['neck01____head'][2] - 0.025
    verts = [v for v in bm.verts if lo < v.co.z < hi and abs(v.co.x) < 0.2]
    # Measure the real body, not the smoothed shell: smoothing flattens the bust, and the
    # clearance pass would then push only the apex out, leaving a shrink-wrapped valley.
    bins = {}
    for v in ctx['body'].data.vertices:
        x, y, z = v.co
        if lo < z < hi and abs(x) < 0.2:
            b = bins.setdefault(int(z // step), [0.06, 0.04])
            b[0] = max(b[0], abs(x))
            b[1] = max(b[1], centre - y)
    for v in verts:
        if centre - v.co.y < 0.015:
            continue   # back half keeps its shape
        sample = v.co.z / step
        acc = np.zeros(3)
        for k in range(int(sample) - window, int(sample) + window + 1):
            if k in bins:
                w = math.exp(-(((k + 0.5 - sample) / sigma) ** 2))
                acc += (bins[k][0] * w, bins[k][1] * w, w)
        if not acc[2]:
            continue
        width, front = acc[0] / acc[2], acc[1] / acc[2]
        shape = max(0.0, 1 - (v.co.x / (width * 1.12)) ** 4) ** 0.25
        blend = float(_smoothstep(0, 1, (hi - v.co.z) / 0.09) * _smoothstep(0, 1, (v.co.z - lo) / 0.08))
        target = centre - (front + ease) * shape
        v.co.y += (target - v.co.y) * blend


def clearance(bm, ctx, min_gap=0.004):
    """Smoothing and envelopes can pull cloth inside convex anatomy (bust, belly);
    push any vertex nearer than min_gap back out along the body normal."""
    bvh = BVHTree.FromObject(ctx['body'], bpy.context.evaluated_depsgraph_get())
    for v in bm.verts:
        loc, normal, _, _ = bvh.find_nearest(v.co)
        if loc is not None and (v.co - loc).dot(normal) < min_gap:
            v.co = loc + normal * min_gap


def bridge_front(bm, ctx, band=0.012):
    """Cloth spans hollows across the chest (cleavage, between pecs) instead of dipping in.

    Per height band, front vertices are lifted to the upper convex hull of the band's
    front profile, so no horizontal valley survives on tops and dresses."""
    J = ctx['joints']
    centre = J['spine05____head'][1]
    lo, hi = J['spine05____head'][2], J['neck01____head'][2] - 0.03
    bands = {}
    for v in bm.verts:
        fwd = centre - v.co.y
        if lo < v.co.z < hi and fwd > 0.02 and abs(v.co.x) < 0.16:
            bands.setdefault(int(v.co.z // band), []).append(v)
    for verts in bands.values():
        pts = sorted((v.co.x, centre - v.co.y) for v in verts)
        hull = []
        for p in pts:   # upper hull (monotone chain)
            while len(hull) >= 2 and (hull[-1][0] - hull[-2][0]) * (p[1] - hull[-2][1]) - (hull[-1][1] - hull[-2][1]) * (p[0] - hull[-2][0]) >= 0:
                hull.pop()
            hull.append(p)
        if len(hull) < 2:
            continue
        hx, hy = np.array([h[0] for h in hull]), np.array([h[1] for h in hull])
        for v in verts:
            target = float(np.interp(v.co.x, hx, hy))
            if centre - v.co.y < target:
                v.co.y = centre - target


def shell(ctx, name, face_mask, ease, material, smooth=8, hem=0.004, uv='torso', cuts=None, envelope=None, trim=None):
    body = ctx['body']
    obj = body.copy()
    obj.data = body.data.copy()
    obj.name = obj.data.name = name
    obj.modifiers.clear()
    obj.shape_key_clear()
    for attr in list(obj.data.color_attributes):
        obj.data.color_attributes.remove(attr)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not face_mask[f.index]], context='FACES')
    bm.verts.index_update()
    if cuts:
        snap_boundary(bm, cuts)
    boundary = np.array([v.is_boundary for v in bm.verts], dtype=float)
    taubin(bm, smooth, 1.0 - 0.6 * boundary)
    if envelope:
        chest_envelope(bm, ctx, **envelope)
        taubin(bm, 3, 1.0 - boundary)
    if cuts:
        snap_boundary(bm, cuts, iterations=1)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * float(ease(np.array(v.co[:])))
    clearance(bm, ctx)
    if envelope is not None:
        bridge_front(bm, ctx)
    if hem:
        rim = bmesh.ops.extrude_edge_only(bm, edges=[e for e in bm.edges if e.is_boundary])['geom']
        bm.normal_update()
        for v in [g for g in rim if isinstance(g, bmesh.types.BMVert)]:
            v.co -= v.normal * hem
        if trim is not None:   # contrasting cuffs and collar on the turned-back hem
            for f in [g for g in rim if isinstance(g, bmesh.types.BMFace)]:
                f.material_index = 1
    bm.normal_update()
    layer = bm.loops.layers.uv.active or bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for loop in f.loops:
            x, y, z = loop.vert.co
            if uv == 'torso':
                loop[layer].uv = (math.atan2(x, -y) * 0.16 / TILE, z / TILE)
            else:
                loop[layer].uv = ((x + (y if abs(x) > 0.12 else 0)) / TILE, z / TILE)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.materials.clear()
    obj.data.materials.append(material)
    if trim is not None:
        obj.data.materials.append(trim)
    obj.data.polygons.foreach_set('use_smooth', [True] * len(obj.data.polygons))
    obj.parent = ctx['rig']
    obj.modifiers.new('Armature', 'ARMATURE').object = ctx['rig']
    return obj


def fabric_material(G, name, colour, kind='jersey', roughness=0.85):
    mat = G['_material'](name, colour, roughness, G['fabric_texture'](kind))
    next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE').extension = 'REPEAT'
    return mat


def body_cover(*masks):
    """Indices of body faces fully hidden by a garment (for runtime culling)."""
    covered = np.zeros(len(masks[0]), dtype=bool)
    for m in masks:
        covered |= m
    return np.flatnonzero(covered).tolist()


# ---------------------------------------------------------------- recipes

def tee(ctx, G, colour=(0.85, 0.86, 0.82), sleeve_len=0.48):
    R = regions(ctx)
    c = R['centre']
    front = c[:, 1] < R['chest_y'] - 0.02
    collar = R['neck_z'] - 0.022 - 0.035 * front * np.exp(-(c[:, 0] / 0.05) ** 2)
    torso = (R['arm'] < 0.5) & (c[:, 2] > R['hip_z'] - 0.035) & (c[:, 2] < collar)
    sleeves = (R['arm'] >= 0.5) & (R['sleeve'] < sleeve_len)

    def ease(p):
        loose = 0.004 if ctx['sex'] == 'male' else 0.0015
        # The hem zone sits over the jeans waistband: keep it clearly outside it.
        over_waistband = 0.007 * (1 - _smoothstep(R['hip_z'] + 0.02, R['hip_z'] + 0.09, p[2]))
        return 0.0075 + loose * (1 - _smoothstep(R['waist_z'], R['neck_z'] - 0.1, p[2])) + 0.002 * (abs(p[0]) > 0.17) + over_waistband

    J = ctx['joints']
    hem_z = R['hip_z'] - 0.035

    def collar_z(p):
        front = _smoothstep(R['chest_y'] - 0.01, R['chest_y'] - 0.07, p[1])
        return R['neck_z'] - 0.022 - 0.035 * front * np.exp(-(p[0] / 0.05) ** 2)

    cuts = [cut(lambda p: p[2] - hem_z), cut(lambda p: p[2] - collar_z(p))]
    for side in ('L', 'R'):
        t = sleeve_param(J, side)
        sign = 1 if side == 'L' else -1
        upper = R['waist_z'] + 0.12   # sleeve hems only exist on the upper body
        cuts.append(cut(lambda p, t=t, sign=sign: (t(p) - sleeve_len) if p[0] * sign > 0.12 and p[2] > upper else 1.0))
    obj = shell(ctx, 'AWD_Top_tee', torso | sleeves, ease, fabric_material(G, 'AWD_Fabric_tee', colour, 'jersey'),
                smooth=14, cuts=cuts,
                envelope={'window': 2, 'sigma': 1.2} if ctx['sex'] == 'female' else {'window': 5})
    obj['awd_slot'], obj['awd_id'] = 'top', 'tee'
    obj['awd_hides'] = body_cover(torso & (c[:, 2] < collar - 0.012), sleeves & (R['sleeve'] < sleeve_len - 0.06))
    return obj


def jeans(ctx, G, colour=(0.10, 0.15, 0.27)):
    R = regions(ctx)
    c = R['centre']
    hem_z = R['ankle_z'] + 0.035
    mask = (R['arm'] < 0.5) & (c[:, 2] < R['hip_z'] + 0.045) & (c[:, 2] > hem_z)

    def ease(p):
        waistband = 0.003 * _smoothstep(R['hip_z'] - 0.03, R['hip_z'] + 0.03, p[2])   # snug under tops
        return 0.0085 + 0.010 * (1 - _smoothstep(R['ankle_z'], R['knee_z'], p[2])) - waistband

    waist_z = R['hip_z'] + 0.045
    cuts = [cut(lambda p: p[2] - waist_z), cut(lambda p: p[2] - hem_z)]
    obj = shell(ctx, 'AWD_Bottom_jeans', mask, ease, fabric_material(G, 'AWD_Fabric_denim', colour, 'denim', 0.9),
                smooth=14, uv='limb', cuts=cuts)
    obj['awd_slot'], obj['awd_id'] = 'bottom', 'jeans'
    obj['awd_hides'] = body_cover(mask & (c[:, 2] > hem_z + 0.03) & (c[:, 2] < R['hip_z'] + 0.03))
    return obj


def sneakers(ctx, G, colour=(0.85, 0.85, 0.83)):
    R = regions(ctx)
    c = R['centre']
    top = R['ankle_z'] + 0.045
    mask = c[:, 2] < top
    obj = shell(ctx, 'AWD_Shoes_sneakers', mask, lambda p: 0.0065 + 0.004 * (p[2] < 0.03),
                G['_material']('AWD_Shoe_upper', colour, 0.55), smooth=6, hem=0.003, uv='limb')
    obj.data.materials.append(G['_material']('AWD_Shoe_sole', (0.93, 0.93, 0.9), 0.7))
    for v in obj.data.vertices:   # flatten the underside into a sole
        if v.co.z < 0.03:
            v.co.z = 0.0 if v.co.z <= 0.012 else 0.03 + (v.co.z - 0.03) * 0.15
    for poly in obj.data.polygons:
        if poly.center.z < 0.026:
            poly.material_index = 1
    obj['awd_slot'], obj['awd_id'] = 'shoes', 'sneakers'
    obj['awd_hides'] = body_cover(mask & (c[:, 2] < top - 0.02))
    return obj
