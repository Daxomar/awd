"""Accra We Dey character pipeline: parametric footwear.

Shoes are lofted from cross-sections along each foot (heel to toe), which gives
clean, low-poly silhouettes that read well from the game camera. Closed styles
(sneakers, loafers, boots, heels) loft an upper with an ankle opening; open
styles (slides, ahenema) are a sole plus straps over the instep. Boots add a
shaft around the ankle and heels a post under the heel. In the rest pose the
foot is flat, so heels read as pumps with a slim heel post.
"""
import math

import bmesh
import bpy
import numpy as np

STATIONS = [0.0, 0.18, 0.40, 0.62, 0.80, 0.92, 1.0]
SNEAKER_W = [0.034, 0.040, 0.044, 0.047, 0.044, 0.036, 0.020]
# style: sole thickness, half-widths and upper heights (metres) at STATIONS, ankle opening,
# straps (t ranges) for open shoes, shaft top height (boots), heel post height, colours
STYLES = {
    'sneakers': {'sole': 0.026, 'width': SNEAKER_W, 'top': [0.088, 0.085, 0.080, 0.072, 0.056, 0.046, 0.034],
                 'opening': 0.40, 'upper': '#f4f4f2', 'sole_col': '#f0f0ea'},
    'loafers': {'sole': 0.016, 'width': [w * 0.97 for w in SNEAKER_W], 'top': [0.070, 0.066, 0.060, 0.053, 0.044, 0.035, 0.026],
                'opening': 0.47, 'upper': '#17150f', 'sole_col': '#3a2a1e'},
    'boots': {'sole': 0.030, 'width': [w + 0.003 for w in SNEAKER_W], 'top': [0.098, 0.094, 0.088, 0.075, 0.058, 0.046, 0.034],
              'opening': 0.30, 'shaft': 0.21, 'upper': '#17150f', 'sole_col': '#1a1410'},
    'heels': {'sole': 0.010, 'width': [w * 0.9 for w in SNEAKER_W], 'top': [0.060, 0.050, 0.044, 0.044, 0.040, 0.032, 0.024],
              'opening': 0.58, 'heel': 0.055, 'upper': '#17150f', 'sole_col': '#17150f'},
    'slides': {'sole': 0.016, 'width': [w + 0.004 for w in SNEAKER_W], 'top': [0.060, 0.064, 0.064, 0.056, 0.044, 0.034, 0.024],
               'straps': [(0.46, 0.66)], 'upper': '#17150f', 'sole_col': '#2a2a2a'},
    'ahenema': {'sole': 0.026, 'width': [w + 0.006 for w in SNEAKER_W], 'top': [0.060, 0.064, 0.064, 0.056, 0.044, 0.034, 0.024],
                'straps': [(0.42, 0.52), (0.58, 0.70)], 'upper': '#6b4f2f', 'sole_col': None},
}
CLOSED = ('sneakers', 'loafers', 'boots')


def _interp(t, values):
    return float(np.interp(t, STATIONS, values))


def srgb(hex_colour):
    c = np.array([int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    return tuple(np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4))


def foot_frame(J, side):
    ankle = np.array(J[f'foot.{side}____head'])
    tip = np.array(J[f'toe3-3.{side}____tail'])
    forward = tip - ankle
    forward[2] = 0
    forward /= np.linalg.norm(forward)
    heel = ankle - forward * 0.072
    heel[2] = 0
    toe = np.array([tip[0], tip[1], 0.0]) + forward * 0.012
    lateral = np.cross(forward, [0, 0, 1])
    lateral *= np.sign(lateral[0] * ankle[0])   # away from the body midline
    return heel, toe, forward, lateral, ankle


def loft(bm, rings, closed=True):
    faces = []
    for a, b in zip(rings, rings[1:]):
        n = len(a)
        for i in range(n if closed else n - 1):
            faces.append(bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])))
    if closed:
        faces.append(bm.faces.new(list(reversed(rings[0]))))
        faces.append(bm.faces.new(rings[-1]))
    return faces


class FootWriter:
    def __init__(self, bm, obj):
        self.bm = bm
        self.deform = bm.verts.layers.deform.verify()
        self.group = {g.name: g.index for g in obj.vertex_groups}

    def vert(self, p, weights):
        v = self.bm.verts.new((float(p[0]), float(p[1]), float(p[2])))
        for name, w in weights.items():
            if w > 0:
                v[self.deform][self.group[name]] = w
        return v


def build_shoe(ctx, G, style='sneakers', steps=16, around=18):
    S = STYLES[style]
    J, rig = ctx['joints'], ctx['rig']
    for stale in (bpy.data.objects.get(f'AWD_Shoes_{style}'), bpy.data.meshes.get(f'AWD_Shoes_{style}')):
        if stale is not None:
            stale.name = stale.name + '_stale'
    mesh = bpy.data.meshes.new(f'AWD_Shoes_{style}')
    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for side in ('Left', 'Right'):
        for bone in ('Foot', 'ToeBase', 'Leg'):
            obj.vertex_groups.new(name=side + bone)
    bm = bmesh.new()
    W = FootWriter(bm, obj)
    sole_faces = set()
    for side, s in (('Left', 'L'), ('Right', 'R')):
        heel, toe, fwd, lat, ankle = foot_frame(J, s)
        length = np.linalg.norm(toe - heel)

        def weights(t):
            toe_w = float(np.clip((t - 0.62) / 0.18, 0, 1))
            return {side + 'Foot': 1 - toe_w, side + 'ToeBase': toe_w}

        def ring(t, z0, z1, extra, sq, arc=(0.0, 2 * math.pi), count=around):
            w = _interp(t, S['width']) + extra
            centre = heel + fwd * length * t - lat * 0.006 * math.sin(math.pi * min(t / 0.9, 1))
            verts = []
            for i in range(count):
                a = arc[0] + (arc[1] - arc[0]) * i / (count if arc[1] - arc[0] >= 2 * math.pi else count - 1)
                c, sn = math.cos(a), math.sin(a)
                cs, ss = math.copysign(abs(c) ** (2 / sq), c), math.copysign(abs(sn) ** (2 / sq), sn)
                p = centre + lat * w * cs
                verts.append(W.vert((p[0], p[1], (z0 + z1) / 2 + (z1 - z0) / 2 * ss), weights(t)))
            return verts

        ts = [(i / (steps - 1)) ** 0.9 for i in range(steps)]
        sole_faces.update(loft(bm, [ring(t, 0.0, S['sole'], 0.004, 6.0) for t in ts]))
        if 'straps' not in S:
            upper = loft(bm, [ring(t, S['sole'] - 0.004, _interp(t, S['top']), 0.0, 3.2) for t in ts])
            opening = [f for f in upper if len(f.verts) == 4 and (lambda c, t: t < S['opening'] and c.z > _interp(t, S['top']) - 0.016)(
                f.calc_center_median(), float(np.dot(np.array(f.calc_center_median()[:]) - heel, fwd) / length))]
            bmesh.ops.delete(bm, geom=opening, context='FACES_ONLY')
        for t0, t1 in S.get('straps', []):
            rows = [ring(t, S['sole'], _interp(t, S['top']) + 0.005, 0.003, 3.0, arc=(0.0, math.pi), count=10)
                    for t in np.linspace(t0, t1, 3)]
            loft(bm, rows, closed=False)
        if 'shaft' in S:
            rows = []
            for k, z in enumerate(np.linspace(S['top'][0] - 0.02, S['shaft'], 5)):
                leg_w = float(np.clip((z - 0.09) / 0.08, 0, 1))
                centre = ankle + fwd * 0.004
                rows.append([W.vert((centre[0] + lat[0] * math.cos(a) * 0.050 + fwd[0] * math.sin(a) * 0.056,
                                     centre[1] + lat[1] * math.cos(a) * 0.050 + fwd[1] * math.sin(a) * 0.056, z),
                                    {side + 'Foot': 1 - leg_w, side + 'Leg': leg_w})
                             for a in (2 * math.pi * i / around for i in range(around))])
            loft(bm, rows, closed=False)
        if 'heel' in S:
            base = heel + fwd * 0.03
            corners = [base + lat * dx + fwd * dy for dx, dy in ((-0.012, -0.012), (0.012, -0.012), (0.012, 0.012), (-0.012, 0.012))]
            bottom = [W.vert((p[0], p[1], -0.0), weights(0.1)) for p in corners]
            top = [W.vert((p[0], p[1], S['heel']), weights(0.1)) for p in corners]
            loft(bm, [bottom, top])
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        f.smooth = True
        f.material_index = 1 if (f in sole_faces and S['sole_col']) else 0
        for loop in f.loops:
            x, y, z = loop.vert.co
            loop[uv].uv = (x * 6 + y * 3, z * 6)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(G['_material'](f'AWD_Shoe_{style}_upper', srgb(S['upper']), 0.5))
    if S['sole_col']:
        mesh.materials.append(G['_material'](f'AWD_Shoe_{style}_sole', srgb(S['sole_col']), 0.75))
    obj.parent = rig
    obj.modifiers.new('Armature', 'ARMATURE').object = rig
    obj['awd_slot'], obj['awd_id'] = 'shoes', style
    obj['awd_hides'] = ([p.index for p in ctx['body'].data.polygons if p.center.z < max(S['top']) - 0.015]
                        if style in CLOSED else [])
    hidden = ('foot', 'ankle') if style == 'boots' else ('foot',) if style in CLOSED else ()
    obj['awd_hides_regions'] = G['mask'](*hidden) if hidden else 0
    return obj
