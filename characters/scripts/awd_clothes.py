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


def cut(field, vertical=False):
    """Pair a scalar field with its numerical gradient for snap_boundary.

    vertical: snap by moving only in z. Necklines and hems must not slide sideways: on a V
    or scoop neck the field's gradient is mostly horizontal, which threw edge vertices
    sideways into a jagged, spiky neckline."""
    axes = np.eye(3)[2:] if vertical else np.eye(3)

    def grad(p, h=1e-4):
        g = np.zeros(3)
        for e in axes:
            g += e * (field(p + e * h) - field(p - e * h)) / (2 * h)
        return g
    return field, grad


def sleeve_param(J, side):
    sh, el = (np.array(J[f'{b}.{side}____head']) for b in ('upperarm01', 'lowerarm01'))
    axis = el - sh
    return lambda p: float((p - sh) @ axis / (axis @ axis))


def snap_boundary(bm, cuts, iterations=3):
    """Move open-edge vertices onto smooth cut curves so hems and collars are clean.

    cuts: list of (field, gradient) callables; field(p) is 0 on the desired edge."""
    boundary = [v for v in bm.verts if v.is_boundary]
    loop_nb = {v: [e.other_vert(v) for e in v.link_edges if e.is_boundary] for v in boundary}
    for _ in range(iterations):
        # Relax each open edge along itself first: body topology makes the raw cut zigzag.
        relaxed = {v: sum((n.co for n in nb), v.co * 0) / len(nb) for v, nb in loop_nb.items() if len(nb) == 2}
        for v, target in relaxed.items():
            v.co = v.co.lerp(target, 0.5)
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


def rest_bvh(obj):
    """BVH of a mesh's rest (basis) shape. Garments are built on the basis, so the
    evaluated mesh is the wrong reference: once slider and expression keys exist the
    body carries their values (all at 1 after building) and the rig may be posed,
    which shrink-wrapped tops onto an inflated chest and gave them pectoral bumps."""
    me = obj.data
    return BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])


def clearance(bm, ctx, min_gap=0.004):
    """Smoothing and envelopes can pull cloth inside convex anatomy (bust, belly);
    push any vertex nearer than min_gap back out along the body normal."""
    bvh = rest_bvh(ctx['body'])
    for v in bm.verts:
        loc, normal, _, _ = bvh.find_nearest(v.co)
        if loc is not None and (v.co - loc).dot(normal) < min_gap:
            v.co = loc + normal * min_gap


def bridge_front(bm, ctx, band=0.012, lo=None, hi=None, back=False):
    """Cloth spans hollows across the body instead of dipping in: between pecs and breasts
    at the front, and (back=True) the cleft between the buttocks at the back.

    Per height band, front (or back) vertices are lifted to the upper convex hull of the
    band's depth profile, so no horizontal valley survives on tops, dresses and trousers."""
    J = ctx['joints']
    centre = J['spine05____head'][1]
    lo = J['spine05____head'][2] if lo is None else lo
    hi = J['neck01____head'][2] - 0.03 if hi is None else hi
    sign = -1.0 if back else 1.0

    def depth(v):   # distance in front of (or behind) the spine
        return sign * (centre - v.co.y)
    bands = {}
    for v in bm.verts:
        if lo < v.co.z < hi and depth(v) > 0.02 and abs(v.co.x) < 0.16:
            bands.setdefault(int(v.co.z // band), []).append(v)
    for verts in bands.values():
        hx, hy = _upper_hull([(v.co.x, depth(v)) for v in verts])
        if len(hx) < 2:
            continue
        for v in verts:
            target = float(np.interp(v.co.x, hx, hy))
            if depth(v) < target:
                v.co.y = centre - sign * target


def trouser_cut(bag):
    """Thigh ease and hem radius (metres) for a bagginess from 0 (straight) to 1 (baggy)."""
    return 0.006 + 0.012 * bag, 0.058 + 0.017 * bag


def leg_frame(ctx):
    """Crotch height and, per side, the hip-ankle axis (z -> x, y) and upper-thigh radius."""
    J = ctx['joints']
    body = np.array([v.co[:] for v in ctx['body'].data.vertices])
    centre_line = body[(np.abs(body[:, 0]) < 0.004) & (body[:, 2] < J['spine05____head'][2])]
    crotch_z = float(centre_line[:, 2].min())
    legs = []
    for side, sign in (('L', 1), ('R', -1)):
        hip, ankle = np.array(J[f'upperleg01.{side}____head']), np.array(J[f'foot.{side}____head'])

        def axis_at(z, hip=hip, ankle=ankle):
            return (hip + (ankle - hip) * (hip[2] - z) / (hip[2] - ankle[2]))[:2]
        band = body[(body[:, 0] * sign > 0.01) & (body[:, 0] * sign < 0.24)   # legs, not the hanging hands
                    & (np.abs(body[:, 2] - (crotch_z - 0.03)) < 0.012)]
        r_thigh = float(np.percentile(np.linalg.norm(band[:, :2] - axis_at(crotch_z - 0.03), axis=1), 75))
        legs.append((sign, axis_at, r_thigh))
    return crotch_z, legs


def trouser_clearance(ctx, bag):
    """z -> circles (x, y, radius) of both trouser legs of the baggiest trousers this body
    wears (empty above the crotch), so tunic tails worn over them never let a leg poke through."""
    crotch_z, legs = leg_frame(ctx)
    hem_z = ctx['joints']['foot.L____head'][2] + 0.035
    thigh_ease, hem_radius = trouser_cut(bag)

    def circles(z):
        if z > crotch_z:
            return []
        t = min(1.0, max(0.0, (crotch_z - 0.03 - z) / (crotch_z - 0.03 - hem_z)))
        out = []
        for sign, axis_at, r_thigh in legs:
            top = r_thigh + thigh_ease
            a = axis_at(z)
            out.append((a[0], a[1], max(top + (hem_radius - top) * t, r_thigh)))
        return out
    return circles


def baggy_legs(bm, ctx, hem_z, thigh_ease=0.024, hem_radius=0.086, cuff=False):
    """Trouser legs hang as loose tubes from the thigh instead of following knee and calf.

    Per leg, vertices from the upper thigh down move out radially (in the horizontal plane, from the
    hip-ankle axis) to a radius that tapers linearly from the thigh plus thigh_ease to
    hem_radius at the hem; nothing moves inwards. Inner-leg vertices stop just short of the
    midline so the two legs never cross. cuff keeps the last 10 cm snug (joggers)."""
    crotch_z, legs = leg_frame(ctx)
    for sign, axis_at, r_thigh in legs:
        top_z, top_r = crotch_z - 0.03, r_thigh + thigh_ease
        for v in bm.verts:
            x, y, z = v.co
            if x * sign <= 0 or z > crotch_z + 0.03:
                continue
            a = axis_at(z)
            d = np.array([x, y]) - a
            r = float(np.linalg.norm(d))
            if r < 1e-6:
                continue
            t = min(1.0, max(0.0, (top_z - z) / (top_z - hem_z)))
            target = max(r, top_r + (hem_radius - top_r) * t)
            blend = float(_smoothstep(crotch_z - 0.01, crotch_z - 0.13, z))   # hips and seat keep their fit
            if cuff:
                blend *= float(_smoothstep(hem_z, hem_z + 0.10, z))
            p = a + d / r * (r + (target - r) * blend)
            v.co.x, v.co.y = (max(p[0], 0.006) if sign > 0 else min(p[0], -0.006)), p[1]
        _hang_leg(bm, axis_at, sign, crotch_z, hem_z)


def _upper_hull(prof):
    hull = []
    for q in sorted(prof):
        while len(hull) >= 2 and (hull[-1][0] - hull[-2][0]) * (q[1] - hull[-2][1]) - (hull[-1][1] - hull[-2][1]) * (q[0] - hull[-2][0]) >= 0:
            hull.pop()
        hull.append(q)
    return np.array([h[0] for h in hull]), np.array([h[1] for h in hull])


def _hang_leg(bm, axis_at, sign, crotch_z, hem_z, bins=36):
    """Cloth hanging from the hip spans the hollow under it: per direction around the leg,
    lift the radius profile (height vs distance from the leg axis) onto its upper hull."""
    groups = {}
    for v in bm.verts:
        x, y, z = v.co
        if x * sign <= 0 or z > crotch_z + 0.03 or z < hem_z - 0.005:
            continue
        d = np.array([x, y]) - axis_at(z)
        r = float(np.linalg.norm(d))
        if r > 1e-6:
            k = int((math.atan2(d[1], d[0]) + math.pi) / (2 * math.pi) * bins) % bins
            groups.setdefault(k, []).append((v, d / r, r))
    for members in groups.values():
        hz, hr = _upper_hull([(m[0].co.z, m[2]) for m in members])
        for v, u, r in members:
            target = float(np.interp(v.co.z, hz, hr))
            if target > r:
                p = axis_at(v.co.z) + u * target
                v.co.x, v.co.y = (max(p[0], 0.006) if sign > 0 else min(p[0], -0.006)), p[1]


def drape_down(bm, ctx, lo_z, hi_z, slope=0.18, front=True, bins=48):
    """Tops hang off the seat (and, front=True, the belly) instead of tucking under them.

    Per direction around the torso axis, walking down from hi_z, the cloth may come in
    towards the body by at most `slope` metres per metre of drop. front=False drapes only
    the back half (a fitted bust stays fitted)."""
    cy = ctx['joints']['spine05____head'][1]
    groups = {}
    for v in bm.verts:
        x, y, z = v.co
        if abs(x) > 0.21 or not lo_z - 0.01 <= z <= hi_z:
            continue
        d = np.array([x, y - cy])
        r = float(np.linalg.norm(d))
        ang = math.atan2(x, -(y - cy))   # 0 at the front
        if r < 1e-6:
            continue
        # front=False fades in around the sides; a hard switch left a step at the side seams
        w = 1.0 if front else float(_smoothstep(math.pi / 3, 2 * math.pi / 3, abs(ang)))
        k = int((ang + math.pi) / (2 * math.pi) * bins) % bins
        groups.setdefault(k, []).append((v, d / r, r, w))
    for members in groups.values():
        reach = -1e9
        for v, u, r, w in sorted(members, key=lambda m: -m[0].co.z):
            reach = max(reach, r + slope * v.co.z)
            target = r + (reach - slope * v.co.z - r) * w
            if target > r:
                v.co.x, v.co.y = u[0] * target, cy + u[1] * target


def shell(ctx, name, face_mask, ease, material, smooth=8, hem=0.004, uv='torso', cuts=None, envelope=None, trim=None,
          shape=None, drape=None):
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
    if drape is not None:   # awd_drape: cloth spans the hollows between the body's high points
        hull_drape(bm, ctx, **drape)
        if cuts:
            snap_boundary(bm, cuts, iterations=1)
    clearance(bm, ctx)
    if envelope is not None:
        bridge_front(bm, ctx)
    if shape:   # silhouette pass (e.g. baggy trouser legs), then relax the transition
        shape(bm)
        boundary = np.array([v.is_boundary for v in bm.verts], dtype=float)
        taubin(bm, 2, 1.0 - boundary)
    if hem:
        # Turn the hem back along the surface normal of the edge it starts from: normals taken
        # after extruding lean sideways at an open edge and ruffled curved hems.
        bm.normal_update()
        source = {v: v.normal.copy() for v in bm.verts if v.is_boundary}
        rim = bmesh.ops.extrude_edge_only(bm, edges=[e for e in bm.edges if e.is_boundary])['geom']
        for v in [g for g in rim if isinstance(g, bmesh.types.BMVert)]:
            origin = next((e.other_vert(v) for e in v.link_edges if e.other_vert(v) in source), None)
            if origin is not None:
                v.co = origin.co - source[origin] * hem
        if trim is not None:   # contrasting cuffs and collar on the turned-back hem
            for f in [g for g in rim if isinstance(g, bmesh.types.BMFace)]:
                f.material_index = 1
    bm.normal_update()
    layer = bm.loops.layers.uv.active or bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for loop in f.loops:
            x, y, z = loop.vert.co
            if callable(uv):   # designed prints (football shirts): one artwork over the whole garment
                loop[layer].uv = uv(x, y, z)
            elif uv == 'torso':
                loop[layer].uv = (math.atan2(x, -y) * 0.16 / TILE, z / TILE)
            else:
                loop[layer].uv = ((x + (y if abs(x) > 0.12 else 0)) / TILE, z / TILE)
    if callable(uv):   # faces across the side seam wrap instead of streaking over the artwork
        plain = getattr(uv, 'plain', None)   # a face touching the plain swatch is all swatch (no smear)
        for f in bm.faces:
            if plain and any(tuple(round(c, 6) for c in loop[layer].uv) == plain for loop in f.loops):
                for loop in f.loops:
                    loop[layer].uv = plain
                continue
            us = [loop[layer].uv.x for loop in f.loops]
            if max(us) - min(us) > 0.5:
                for loop in f.loops:
                    if loop[layer].uv.x < 0.5:
                        loop[layer].uv.x += 1.0
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

    cuts = [cut(lambda p: p[2] - hem_z, True), cut(lambda p: p[2] - collar_z(p), True)]
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
    cuts = [cut(lambda p: p[2] - waist_z, True), cut(lambda p: p[2] - hem_z, True)]
    bag = 1.0 if ctx['sex'] == 'male' else 0.75   # same cut as the wardrobe jeans
    obj = shell(ctx, 'AWD_Bottom_jeans', mask, ease, fabric_material(G, 'AWD_Fabric_denim', colour, 'denim', 0.9),
                smooth=14, uv='limb', cuts=cuts,
                shape=lambda bm: baggy_legs(bm, ctx, hem_z, *trouser_cut(bag)))
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
