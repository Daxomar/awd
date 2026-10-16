"""Accra We Dey character pipeline: parametric footwear.

Shoes are lofted from cross-sections along each foot (heel to toe), which gives
clean, low-poly silhouettes that read well from the game camera. Proportions per
style live in STYLES; slides, ahenema, loafers, heels and boots reuse the loft
with different profiles.
"""
import math

import bmesh
import bpy
import numpy as np

STATIONS = [0.0, 0.18, 0.40, 0.62, 0.80, 0.92, 1.0]
# style: sole thickness, half-widths and upper heights (metres) at STATIONS
STYLES = {
    'sneakers': {'sole': 0.026, 'width': [0.034, 0.040, 0.044, 0.047, 0.044, 0.036, 0.020],
                 'top': [0.088, 0.085, 0.080, 0.072, 0.056, 0.046, 0.034], 'opening': 0.40},
}


def _interp(t, values):
    return float(np.interp(t, STATIONS, values))


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
    return heel, toe, forward, lateral


def loft(bm, rings):
    faces = []
    for a, b in zip(rings, rings[1:]):
        n = len(a)
        for i in range(n):
            faces.append(bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])))
    faces.append(bm.faces.new(list(reversed(rings[0]))))
    faces.append(bm.faces.new(rings[-1]))
    return faces


def build_shoe(ctx, G, style='sneakers', upper_colour=(0.85, 0.85, 0.83), sole_colour=(0.94, 0.94, 0.91),
               steps=16, around=18):
    S = STYLES[style]
    J, rig = ctx['joints'], ctx['rig']
    for stale in (bpy.data.objects.get(f'AWD_Shoes_{style}'), bpy.data.meshes.get(f'AWD_Shoes_{style}')):
        if stale is not None:
            stale.name = stale.name + '_stale'
    mesh = bpy.data.meshes.new(f'AWD_Shoes_{style}')
    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for side in ('Left', 'Right'):
        for bone in ('Foot', 'ToeBase'):
            obj.vertex_groups.new(name=side + bone)
    group = {g.name: g.index for g in obj.vertex_groups}
    bm = bmesh.new()
    deform = bm.verts.layers.deform.verify()
    sole_faces = set()
    for side, s in (('Left', 'L'), ('Right', 'R')):
        heel, toe, fwd, lat = foot_frame(J, s)
        length = np.linalg.norm(toe - heel)

        def ring(t, z0, z1, extra, sq):
            w = _interp(t, S['width']) + extra
            centre = heel + fwd * length * t - lat * 0.006 * math.sin(math.pi * min(t / 0.9, 1))
            toe_w = float(np.clip((t - 0.62) / 0.18, 0, 1))
            verts = []
            for i in range(around):
                a = 2 * math.pi * i / around
                c, sn = math.cos(a), math.sin(a)
                cs = math.copysign(abs(c) ** (2 / sq), c)
                ss = math.copysign(abs(sn) ** (2 / sq), sn)
                p = centre + lat * w * cs
                v = bm.verts.new((p[0], p[1], (z0 + z1) / 2 + (z1 - z0) / 2 * ss))
                v[deform][group[side + 'Foot']] = 1 - toe_w
                if toe_w > 0:
                    v[deform][group[side + 'ToeBase']] = toe_w
                verts.append(v)
            return verts

        ts = [(i / (steps - 1)) ** 0.9 for i in range(steps)]
        sole_faces.update(loft(bm, [ring(t, 0.0, S['sole'], 0.004, 6.0) for t in ts]))
        upper = loft(bm, [ring(t, S['sole'] - 0.004, _interp(t, S['top']), 0.0, 3.2) for t in ts])
        opening = []
        for f in upper:
            if len(f.verts) != 4:
                continue
            c = f.calc_center_median()
            t = float(np.dot(np.array(c[:]) - heel, fwd) / length)
            if t < S['opening'] and c.z > _interp(t, S['top']) - 0.016:
                opening.append(f)
        bmesh.ops.delete(bm, geom=opening, context='FACES_ONLY')
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        f.smooth = True
        f.material_index = 1 if f in sole_faces else 0
        for loop in f.loops:
            x, y, z = loop.vert.co
            loop[uv].uv = (x * 6 + y * 3, z * 6)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(G['_material'](f'AWD_Shoe_{style}_upper', upper_colour, 0.55))
    mesh.materials.append(G['_material'](f'AWD_Shoe_{style}_sole', sole_colour, 0.75))
    obj.parent = rig
    obj.modifiers.new('Armature', 'ARMATURE').object = rig
    obj['awd_slot'], obj['awd_id'] = 'shoes', style
    obj['awd_hides'] = [p.index for p in ctx['body'].data.polygons if p.center.z < max(S['top']) - 0.015]
    return obj
