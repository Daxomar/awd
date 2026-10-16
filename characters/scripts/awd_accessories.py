"""Accra We Dey character pipeline, stage E: hats, glasses and neck pieces.

Hats are fitted to the head ellipsoid (awd_hair_volume.Head) with room for short
hair; glasses are placed from the eye joints; neck pieces follow paths on the
body pushed clear of tops. All are skinned from the nearest body vertices
(awd_wardrobe.Writer) and hide no skin. Tinted materials follow the runtime
naming rules: AWD_Hat_* (hatCol), AWD_Fabric_* on a neck item (neckCol);
AWD_Metal_*, AWD_Lens_* and AWD_Print_* keep their own colours.
"""
import math

import bpy
import numpy as np
from mathutils import Vector

HATS = {'cap': '#f4f4f2', 'bucket': '#f4f4f2', 'kufi': '#f4f4f2'}
GLASSES = ('shades', 'specs')
NECK = ('chain', 'beads', 'stole')


def _obj(ctx, G, name, mat):
    obj = G['empty_garment'](ctx, name, mat)
    return obj, G['Writer'](ctx, obj)


def _hat_grid(W, rows, mat=0, u_scale=1.0, v_scale=1.0, closed=True):
    cols = len(rows[0]) - (0 if closed else 1)
    for i in range(len(rows) - 1):
        for j in range(cols):
            k = (j + 1) % len(rows[0])
            W.face([rows[i][j], rows[i][k], rows[i + 1][k], rows[i + 1][j]],
                   [(j / cols * u_scale, i * v_scale), ((j + 1) / cols * u_scale, i * v_scale),
                    ((j + 1) / cols * u_scale, (i + 1) * v_scale), (j / cols * u_scale, (i + 1) * v_scale)], mat)


def build_hat(ctx, G, item):
    head = G['Head'](ctx)
    mat = G['_material'](f'AWD_Hat_{item}', G['srgb'](HATS[item]), 0.8, bpy.data.images.get('awd_fabric_cotton') or
                         G['fabric_texture']('cotton'))
    obj, W = _obj(ctx, G, f'AWD_Hat_{item}', mat)
    c, r = head.c, head.r + 0.014
    head_w = {'Head': 1.0}
    cols = 28

    def ring(z, extra=0.0, scale=1.0):
        t = min(0.999, max(-0.999, (z - c[2]) / r[2]))
        k = math.sqrt(1 - t * t) * scale
        return [W.vert(c + np.array([math.sin(a) * (r[0] * k + extra), -math.cos(a) * (r[1] * k + extra) + 0.004, z - c[2]]),
                       head_w) for a in (2 * math.pi * j / cols for j in range(cols))]
    if item == 'kufi':
        zs = [c[2] + r[2] * f for f in (0.20, 0.45, 0.65)]
        rows = [ring(z, 0.002) for z in zs]
        _hat_grid(W, rows, v_scale=0.3)
        top = W.vert(np.array([c[0], c[1] + 0.004, zs[-1] + 0.004]), head_w)
        for j in range(cols):
            W.face([rows[-1][j], rows[-1][(j + 1) % cols], top], [(0, 0), (0.1, 0), (0.05, 0.1)])
    else:
        start = 0.22 if item == 'cap' else 0.30
        zs = [c[2] + r[2] * f for f in np.linspace(start, 0.96, 6)]
        rows = [ring(z) for z in zs]
        _hat_grid(W, rows, v_scale=0.3)
        top = W.vert(np.array([c[0], c[1] + 0.004, c[2] + r[2] * 1.0]), head_w)
        for j in range(cols):
            W.face([rows[-1][j], rows[-1][(j + 1) % cols], top], [(0, 0), (0.1, 0), (0.05, 0.1)])
        base = rows[0]
        if item == 'cap':   # stiff front brim
            front = [j for j in range(cols) if math.cos(2 * math.pi * j / cols) > 0.35]
            outer = []
            for j in front:
                p = np.array(base[j].co[:])
                d = (p - c) * np.array([1, 1, 0])
                d /= np.linalg.norm(d)
                outer.append(W.vert(p + d * 0.07 + np.array([0, -0.02, -0.012]), head_w))
            for k in range(len(front) - 1):
                W.face([base[front[k]], base[front[k + 1]], outer[k + 1], outer[k]], [(0, 0), (1, 0), (1, 1), (0, 1)])
        else:               # bucket: sloping brim all round
            outer = []
            for v in base:
                p = np.array(v.co[:])
                d = (p - c) * np.array([1, 1, 0])
                d /= np.linalg.norm(d)
                outer.append(W.vert(p + d * 0.05 + np.array([0, 0, -0.025]), head_w))
            _hat_grid(W, [base, outer])
    W.finish()
    obj['awd_slot'], obj['awd_id'], obj['awd_hides_regions'] = 'hat', item, 0
    return obj


def build_glasses(ctx, G, item):
    J = ctx['joints']
    frame_mat = G['_material']('AWD_Metal_frame', (0.02, 0.02, 0.025), 0.35)
    obj, W = _obj(ctx, G, f'AWD_Glasses_{item}', frame_mat)
    lens = None
    if item == 'shades':
        lens = G['material_slot'](obj, G['_material']('AWD_Lens_shades', (0.01, 0.012, 0.015), 0.08))
    radius = 0.0024 if item == 'shades' else 0.0016
    rims = []
    for s in ('L', 'R'):
        eye = np.array(J[f'eye.{s}____head'])
        centre = eye + np.array([0.0, -0.034, 0.003])
        loop = [centre + np.array([math.copysign(abs(math.cos(a)) ** 0.7, math.cos(a)) * 0.025, 0.0,
                                   math.copysign(abs(math.sin(a)) ** 0.8, math.sin(a)) * 0.018])
                for a in (2 * math.pi * k / 16 for k in range(17))]
        G['tube'](W, loop, radius, 5, taper=0.0, v_len=0.05)
        rims.append((centre, loop))
        if lens is not None:
            mid = W.vert(centre + np.array([0, -0.003, 0]))
            ring = [W.vert(p + np.array([0, -0.001, 0])) for p in loop[:-1]]
            for k in range(16):
                W.face([ring[k], ring[(k + 1) % 16], mid], [(0, 0), (1, 0), (0.5, 1)], lens)
        outer = centre + np.array([math.copysign(0.026, eye[0]), 0.0, 0.002])
        temple = [outer, outer + np.array([math.copysign(0.012, eye[0]), 0.03, 0.0]),
                  outer + np.array([math.copysign(0.016, eye[0]), 0.09, -0.006]),
                  outer + np.array([math.copysign(0.012, eye[0]), 0.11, -0.022])]
        G['tube'](W, temple, radius * 0.8, 4, taper=0.0, v_len=0.05)
    (cl, _), (cr, _) = rims
    G['tube'](W, [cl + np.array([-0.024, 0, 0.006]), (cl + cr) / 2 + np.array([0, -0.004, 0.012]),
                  cr + np.array([0.024, 0, 0.006])], radius * 0.9, 4, taper=0.0, v_len=0.05)
    W.finish()
    obj['awd_slot'], obj['awd_id'], obj['awd_hides_regions'] = 'glasses', item, 0
    return obj


def _neck_loop(ctx, bvh, n, clearance):
    J = ctx['joints']
    neck = np.array(J['neck01____head'])
    pts = []
    for k in range(n + 1):
        a = 2 * math.pi * k / n
        front = max(0.0, -math.cos(a))
        p = neck + np.array([math.sin(a) * 0.082, -math.cos(a) * 0.075, -0.035 - 0.10 * front ** 2])
        hit = bvh.find_nearest(Vector(p))
        if hit[0] is not None:
            q, nrm = np.array(hit[0][:]), np.array(hit[1][:])
            if np.dot(p - q, nrm) < clearance:
                p = q + nrm * clearance
        pts.append(p)
    return pts


def _hang(pts):
    """Hanging cloth spans hollows (under the bust or pecs): lift a top-to-bottom front
    path onto the upper hull of its side profile (height vs forward depth)."""
    prof = sorted((float(p[2]), float(-p[1])) for p in pts)
    hull = []
    for q in prof:
        while len(hull) >= 2 and (hull[-1][0] - hull[-2][0]) * (q[1] - hull[-2][1]) - (hull[-1][1] - hull[-2][1]) * (q[0] - hull[-2][0]) >= 0:
            hull.pop()
        hull.append(q)
    hz, hf = np.array([h[0] for h in hull]), np.array([h[1] for h in hull])
    return [np.array([p[0], -max(-p[1], float(np.interp(p[2], hz, hf))), p[2]]) for p in pts]


def build_neck(ctx, G, item):
    bvh = G['rest_bvh'](ctx['body'])
    if item == 'chain':
        mat = G['_material']('AWD_Metal_gold', (0.66, 0.42, 0.04), 0.28)
        mat.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = 1.0
        obj, W = _obj(ctx, G, 'AWD_Neck_chain', mat)
        G['tube'](W, _neck_loop(ctx, bvh, 40, 0.019), 0.0032, 6, taper=0.0, v_len=0.01)
    elif item == 'beads':
        obj, W = _obj(ctx, G, 'AWD_Neck_beads', G['print_material'](G, 'beads', 0.35))
        pts = _neck_loop(ctx, bvh, 36, 0.020)[:-1]
        for i, p in enumerate(pts):
            u = (i + 0.5) / len(pts)
            rows = []
            for lat in range(5):
                th = math.pi * lat / 4
                rows.append([W.vert(p + 0.0058 * np.array([math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th)]))
                             for ph in (2 * math.pi * j / 6 for j in range(6))])
            for a, b in zip(rows, rows[1:]):
                for j in range(6):
                    W.face([a[j], a[(j + 1) % 6], b[(j + 1) % 6], b[j]], [(u, 0), (u, 0), (u, 1), (u, 1)])
    else:   # kente stole over both shoulders, hanging down the front
        R = G['regions'](ctx)
        mat = G['material'](G, 'kente', '#f2b632', 'stole')
        obj, W = _obj(ctx, G, 'AWD_Neck_stole', mat)
        neck_z = R['neck_z']
        for side in (1, -1):
            zs = np.linspace(neck_z - 0.06, R['hip_z'] + 0.06, 9)
            # Clear the loosest tops: tunics stand further off the body towards the hip.
            front = [G['surface_points'](bvh, [side * 0.085], [z], 0.024 + 0.024 * t)[0]
                     for z, t in zip(zs, np.linspace(0, 1, len(zs)))]
            front = _hang(front)
            top = np.array([side * 0.085, front[0][1] + 0.05, neck_z - 0.012])
            back = np.array([side * 0.06, front[0][1] + 0.12, neck_z - 0.04])
            path = [back, top] + front
            rows = []
            for k, p in enumerate(path):
                width = np.array([0.048, 0, 0]) if k > 1 else np.array([0.03, 0.03, 0]) * np.array([1, side, 0])
                rows.append((W.vert(p - width), W.vert(p + width)))
            W.quad_strip(rows, 0, v_scale=4.0)
    W.finish()
    obj['awd_slot'], obj['awd_id'], obj['awd_hides_regions'] = 'neck', item, 0
    return obj


def build_accessory(ctx, G, item):
    if item in HATS:
        return build_hat(ctx, G, item)
    if item in GLASSES:
        return build_glasses(ctx, G, item)
    return build_neck(ctx, G, item)
