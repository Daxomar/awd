"""Accra We Dey character pipeline, stage 2: eyes, lashes, brows, teeth and tongue.

Requires awd_human.py and awd_textures.py to be executed into the same namespace.
All parts are skinned to the MakeHuman face bones so expressions move them.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector


def _material(name, color, roughness=0.5, image=None, alpha_clip=None):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    for node in [n for n in nodes if n.type in ('TEX_IMAGE', 'MIX')]:
        nodes.remove(node)
    if image:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = image
        tex.extension = 'EXTEND' if alpha_clip is not None else 'REPEAT'
        mix = nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs['A'].default_value = (*color, 1)
        links.new(tex.outputs['Color'], mix.inputs['B'])
        links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
        if alpha_clip is not None:
            links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    if alpha_clip is not None:
        mat.surface_render_method = 'DITHERED'
        mat['awd_alpha_cutoff'] = alpha_clip
    return mat


def _skin_to(obj, rig, groups):
    for name, weight in groups:
        group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
        group.add(list(range(len(obj.data.vertices))), weight, 'REPLACE')
    obj.parent = rig
    obj.modifiers.new('Armature', 'ARMATURE').object = rig


def build_eyes(ctx, G):
    mat = _material('AWD_Eye', (1.0, 1.0, 1.0), 0.08, G['iris_texture']())
    eyes = []
    for side in ('l', 'r'):
        helper, verts = G['build_helper'](ctx, [f'helper-{side}-eye'], f'_tmp_eye_{side}')
        centre = verts.mean(axis=0)
        radius = float(np.linalg.norm(verts - centre, axis=1).mean()) * 0.96
        bpy.data.objects.remove(helper, do_unlink=True)
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=18, v_segments=12, radius=radius)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
        for v in bm.verts:  # gentle corneal bulge on the forward (-Y) pole
            v.co.y -= radius * 0.08 * max(0.0, -v.co.y / radius) ** 6
        uv = bm.loops.layers.uv.new('UVMap')
        for f in bm.faces:
            for loop in f.loops:
                co = loop.vert.co
                k = 1.0 if co.y < 0 else 1.9   # the back of the eye maps to plain sclera
                loop[uv].uv = (0.5 + co.x / (2 * radius) * k, 0.5 + co.z / (2 * radius) * k)
        mesh = bpy.data.meshes.new(f'AWD_Eye_{side.upper()}')
        bm.to_mesh(mesh)
        bm.free()
        mesh.transform(Matrix.Translation(Vector(centre)))
        mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
        mesh.materials.append(mat)
        obj = bpy.data.objects.new(mesh.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        _skin_to(obj, ctx['mh_rig'], [(f'eye.{side.upper()}', 1.0)])
        obj['awd_eye_radius'] = radius
        eyes.append(obj)
    return eyes


def build_lashes(ctx, G):
    image = G['strand_alpha']('awd_lash_alpha', size=(256, 48), strands=220, seed=11, lean=0.25,
                              thickness=1.3, density_falloff=False)
    mat = _material('AWD_Lashes', (0.035, 0.025, 0.02), 0.6, image, alpha_clip=0.35)
    groups = [f'helper-{s}-eyelashes-2' for s in ('l', 'r')]   # upper lashes only (stylised)
    obj, _ = G['build_helper'](ctx, groups, 'AWD_Lashes')
    eye = {s: np.array(ctx['joints'][f'eye.{s}____head']) for s in ('L', 'R')}
    me = obj.data
    layer = me.uv_layers['UVMap']
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = np.array(me.vertices[me.loops[li].vertex_index].co)
            rel = co - (eye['L'] if co[0] > 0 else eye['R'])
            layer.data[li].uv = (0.5 + abs(rel[0]) / 0.05, min(max((np.linalg.norm(rel) - 0.0125) / 0.009, 0.02), 0.98))
    me.materials.append(mat)
    return obj


def build_brows(ctx, G):
    """Brow cards cut from the forehead surface, floating just above the skin."""
    image = G['brow_alpha']()
    mat = _material('AWD_Brows', (0.016, 0.012, 0.010), 0.75, image, alpha_clip=0.45)
    body = ctx['body']
    J = ctx['joints']
    eyes = [np.array(J[f'eye.{s}____head']) for s in ('L', 'R')]
    radius = 0.0175

    def arch(x, eye):
        t = (abs(x) - abs(eye[0])) / 0.026
        return eye[2] + radius * 1.18 + 0.0045 * (1 - t * t) - 0.004 * max(t, 0)

    keep = set()
    for poly in body.data.polygons:
        c = np.array(poly.center)
        for eye in eyes:
            if np.sign(c[0]) != np.sign(eye[0]) or c[1] > eye[1]:
                continue
            t = (abs(c[0]) - abs(eye[0])) / 0.026
            if -0.78 < t < 1.05 and abs(c[2] - arch(c[0], eye)) < 0.0068 * (1 - 0.35 * max(t, 0)):
                keep.add(poly.index)
    obj = body.copy()
    obj.data = body.data.copy()
    obj.name = obj.data.name = 'AWD_Brows'
    obj.modifiers.clear()
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * 0.0009
    bm.to_mesh(obj.data)
    bm.free()
    me = obj.data
    layer = me.uv_layers.active
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = np.array(me.vertices[me.loops[li].vertex_index].co)
            eye = eyes[0] if co[0] > 0 else eyes[1]
            layer.data[li].uv = (((abs(co[0]) - abs(eye[0])) / 0.026 + 0.78) / 1.83,
                                 0.5 + (co[2] - arch(co[0], eye)) / 0.0124)
    me.materials.clear()
    me.materials.append(mat)
    obj.parent = ctx['mh_rig']
    obj.modifiers.new('Armature', 'ARMATURE').object = ctx['mh_rig']
    return obj


def _teeth_arc(bm, deform, group, centre, radius, z0, z1, span=150, segments=14, depth=0.0045):
    """A smooth row of teeth: a curved band seen from the front, rounded at the biting edge."""
    rows = []
    for zi, z in enumerate((z0, (z0 + z1) / 2, z1)):
        for inner in (False, True):
            ring = []
            for i in range(segments + 1):
                a = math.radians(-span / 2 + span * i / segments)
                r = radius - (depth if inner else 0) - 0.0012 * (zi == 1)
                v = bm.verts.new((centre[0] + math.sin(a) * r, centre[1] - math.cos(a) * r, z))
                v[deform][group] = 1.0
                ring.append(v)
            rows.append(ring)
    outer = rows[0::2]
    inner = rows[1::2]
    for strip in (outer, inner[::-1]):
        for a, b in zip(strip, strip[1:]):
            for i in range(segments):
                bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
    for ring_a, ring_b in ((outer[0], inner[0]), (outer[-1], inner[-1])):
        for i in range(segments):
            bm.faces.new((ring_a[i + 1], ring_a[i], ring_b[i], ring_b[i + 1]))


def build_mouth(ctx, G):
    """Clean arched teeth rows (upper on the head, lower on the jaw) and a recessed tongue."""
    _, upper = G['build_helper'](ctx, ['helper-upper-teeth'], '_tmp_upper')
    _, lower = G['build_helper'](ctx, ['helper-lower-teeth'], '_tmp_lower')
    for name in ('_tmp_upper', '_tmp_lower'):
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    mesh = bpy.data.meshes.new('AWD_Teeth')
    obj = bpy.data.objects.new('AWD_Teeth', mesh)
    bpy.context.scene.collection.objects.link(obj)
    head, jaw = obj.vertex_groups.new(name='head').index, obj.vertex_groups.new(name='jaw').index
    bm = bmesh.new()
    deform = bm.verts.layers.deform.verify()
    for verts, group in ((upper, head), (lower, jaw)):
        front = verts[:, 1].min()
        radius = max(0.026, (verts[:, 0].max() - verts[:, 0].min()) / 2 * 0.95)
        centre = (0.0, front + radius)
        _teeth_arc(bm, deform, group, centre, radius, verts[:, 2].min() + 0.0015, verts[:, 2].max())
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
    mesh.materials.append(_material('AWD_Teeth', (0.86, 0.83, 0.76), 0.3))
    obj.parent = ctx['mh_rig']
    obj.modifiers.new('Armature', 'ARMATURE').object = ctx['mh_rig']
    tongue, _ = G['build_helper'](ctx, ['helper-tongue'], 'AWD_Tongue')
    tongue.data.transform(Matrix.Translation((0, 0.009, -0.004)))   # sit behind the teeth
    tongue.data.materials.append(_material('AWD_Tongue', (0.55, 0.22, 0.22), 0.45))
    return obj, tongue


def build_face(ctx, G):
    return {'eyes': build_eyes(ctx, G), 'lashes': build_lashes(ctx, G),
            'brows': build_brows(ctx, G), 'mouth': build_mouth(ctx, G)}
