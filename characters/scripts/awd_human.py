"""Accra We Dey character pipeline, stage 1: the stylized, rigged adult body.

Builds an adult body in Blender from the MakeHuman Community CC0 base mesh, the
African young-adult macro targets and the authored default skin weights, then
applies the AWD house stylization (slightly larger head and eyes, softened
surface). The result is rigged to the full MakeHuman skeleton, including facial
bones. Later stages bake expressions from it and transfer it to the game rig.

Run inside Blender (paths come from AWD_ROOT, set by the caller):
    exec(open(AWD_ROOT + '/characters/scripts/awd_human.py').read())
    build_body('male')
"""
import json
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(globals().get('AWD_ROOT') or Path(__file__).resolve().parents[2])
SRC = ROOT / '.local' / 'human-source'
HEIGHT = {'male': 1.76, 'female': 1.68}

# AWD house style. Values were tuned against front, side and game-camera renders.
STYLE = {
    'head_scale': 1.09,      # head-to-body ratio about 1:6.9 instead of 1:7.5
    'eye_scale': 1.15,       # larger, more readable eyes from the game camera
    'eye_radius': 0.024,     # metres of falloff around each eyeball centre
    'hand_scale': 1.05,
    'smooth_passes': 6,      # Taubin passes that soften muscle noise on the body
    'cheek_fullness': 0.0045,
    'nose_scale': 0.94,
}
# Radial thickness per MakeHuman bone, applied through its authored skin weights.
# The young African macro targets are lean; the house style adds appealing mass.
THICKNESS = {
    'male': {'upperarm01': 1.14, 'upperarm02': 1.12, 'lowerarm01': 1.08, 'lowerarm02': 1.05,
             'shoulder01': 1.12, 'neck01': 1.12, 'neck02': 1.10, 'upperleg01': 1.05,
             'upperleg02': 1.06, 'lowerleg01': 1.06},
    'female': {'upperarm01': 1.04, 'upperarm02': 1.04, 'upperleg01': 1.04, 'upperleg02': 1.04,
               'lowerleg01': 1.03},
}
# Torso width (x) and chest projection (metres, forward) by sex.
TORSO = {'male': {'chest_width': 1.07, 'chest_forward': 0.010, 'waist_width': 0.98, 'hip_width': 0.93},
         'female': {'chest_width': 1.0, 'chest_forward': 0.0, 'waist_width': 0.96, 'hip_width': 1.0}}

_SKEL = {}


def read_obj():
    verts, uvs, faces, group = [], [], [], ''
    for line in (SRC / 'base.obj').read_text().splitlines():
        s = line.split()
        if not s:
            continue
        if s[0] == 'v':
            verts.append([float(a) for a in s[1:4]])
        elif s[0] == 'vt':
            uvs.append([float(a) for a in s[1:3]])
        elif s[0] == 'g':
            group = s[1]
        elif s[0] == 'f':
            corners = []
            for c in s[1:]:
                parts = c.split('/')
                corners.append((int(parts[0]) - 1, int(parts[1]) - 1 if len(parts) > 1 and parts[1] else -1))
            faces.append((group, corners))
    return np.array(verts, dtype=np.float64), np.array(uvs, dtype=np.float64), faces


def apply_target(verts, name):
    for line in (SRC / name).read_text().splitlines():
        s = line.split()
        if not s or s[0].startswith('#'):
            continue
        verts[int(s[0])] += [float(a) for a in s[1:4]]


def to_blender(verts):
    """MakeHuman is Y-up, +Z forward. Blender characters face -Y with Z up."""
    return np.column_stack((verts[:, 0], -verts[:, 2], verts[:, 1]))


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def joint_positions(verts):
    return {name: verts[ids].mean(axis=0) for name, ids in _SKEL['joints'].items()}


def joint(verts, name):
    return verts[_SKEL['joints'][name]].mean(axis=0)


def bone_weights(weights, prefix, count):
    """Summed authored weight of all MakeHuman bones whose names start with prefix."""
    w = np.zeros(count)
    for bone, entries in weights.items():
        if bone.split('.')[0] == prefix:
            for vid, value in entries:
                w[vid] += value
    return w


def thicken(verts, weights, sex):
    """Push vertices away from each limb bone's axis in proportion to its weight."""
    for prefix, factor in THICKNESS[sex].items():
        for side in ('L', 'R', None):
            name = f'{prefix}.{side}' if side else prefix
            if f'{name}____head' not in _SKEL['joints']:
                continue
            a, b = joint(verts, f'{name}____head'), joint(verts, f'{name}____tail')
            w = np.zeros(len(verts))
            for vid, value in weights.get(name, []):
                w[vid] = value
            axis = (b - a) / np.linalg.norm(b - a)
            rel = verts - a
            radial = rel - np.outer(rel @ axis, axis)
            verts += radial * ((factor - 1) * w)[:, None]


def shape_torso(verts, weights, sex):
    spec = TORSO[sex]
    chest = sum(bone_weights(weights, p, len(verts)) for p in ('spine01', 'spine02', 'breast', 'clavicle'))
    waist = sum(bone_weights(weights, p, len(verts)) for p in ('spine03', 'spine04'))
    hips = sum(bone_weights(weights, p, len(verts)) for p in ('spine05', 'pelvis', 'root'))
    hips += 0.6 * bone_weights(weights, 'upperleg01', len(verts))
    verts[:, 0] *= (1 + (spec['chest_width'] - 1) * np.clip(chest, 0, 1)
                    + (spec['waist_width'] - 1) * np.clip(waist, 0, 1)
                    + (spec['hip_width'] - 1) * np.clip(hips, 0, 1))
    front = verts[:, 1] < joint(verts, 'spine01____head')[1]
    breast = bone_weights(weights, 'breast', len(verts)) + 0.5 * bone_weights(weights, 'spine01', len(verts))
    verts[:, 1] -= spec['chest_forward'] * np.clip(breast, 0, 1) * front


def stylize_face(verts):
    """Fuller cheeks and a slightly refined nose, measured from facial landmarks."""
    eyes = [joint(verts, f'eye.{s}____head') for s in ('L', 'R')]
    eye_mid = (eyes[0] + eyes[1]) / 2
    centre = joint(verts, 'head____head') * 0.45 + joint(verts, 'head____tail') * 0.55
    centre[1] = eye_mid[1] + 0.07
    for eye in eyes:
        cheek = eye + np.array([np.sign(eye[0]) * 0.012, -0.004, -0.038])
        d = np.linalg.norm(verts - cheek, axis=1)
        out = verts - centre
        out /= np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-9)
        verts += out * (STYLE['cheek_fullness'] * np.exp(-(d / 0.028) ** 2))[:, None]
    face = (np.abs(verts[:, 0]) < 0.02) & (verts[:, 2] < eye_mid[2] - 0.01) & (verts[:, 2] > eye_mid[2] - 0.06)
    tip = verts[face][np.argmin(verts[face][:, 1])]
    nose_base = tip + np.array([0, 0.018, 0.004])
    d = np.linalg.norm(verts - nose_base, axis=1)
    fall = np.exp(-(d / 0.022) ** 2)
    scale = np.array([1.0, STYLE['nose_scale'], STYLE['nose_scale']])
    verts += (verts - nose_base) * (scale - 1) * fall[:, None]


def stylize(verts, body_ids, faces_body, weights, sex):
    """Apply the house proportions to every vertex so helpers and joints follow."""
    thicken(verts, weights, sex)
    shape_torso(verts, weights, sex)
    head_pivot = joint(verts, 'head____head')
    neck_low = joint(verts, 'neck01____head')[2]
    head_mask = smoothstep(neck_low + 0.35 * (head_pivot[2] - neck_low), head_pivot[2] + 0.02, verts[:, 2])
    head_mask *= (np.abs(verts[:, 0]) < 0.22)
    verts += (verts - head_pivot) * ((STYLE['head_scale'] - 1) * head_mask)[:, None]
    for side in ('L', 'R'):
        centre = joint(verts, f'eye.{side}____head')
        d = np.linalg.norm(verts - centre, axis=1)
        fall = np.exp(-(d / STYLE['eye_radius']) ** 2) * (verts[:, 1] < centre[1] + 0.012)
        verts += (verts - centre) * ((STYLE['eye_scale'] - 1) * fall)[:, None]
    stylize_face(verts)
    for side in ('L', 'R'):
        wrist = joint(verts, f'wrist.{side}____head')
        elbow = joint(verts, f'lowerarm01.{side}____head')
        axis = (wrist - elbow) / np.linalg.norm(wrist - elbow)
        rel = verts - wrist
        along = rel @ axis
        lateral = np.linalg.norm(rel - np.outer(along, axis), axis=1)
        mask = smoothstep(-0.02, 0.02, along) * (lateral < 0.09)
        verts += rel * ((STYLE['hand_scale'] - 1) * mask)[:, None]
    taubin_smooth(verts, body_ids, faces_body)


def taubin_smooth(verts, body_ids, faces_body):
    """Soften muscle and skin noise on the torso and limbs, keeping the face crisp."""
    neighbours = [set() for _ in range(len(verts))]
    for corners in faces_body:
        ids = [c[0] for c in corners]
        for i, a in enumerate(ids):
            neighbours[a].add(ids[i - 1])
            neighbours[a].add(ids[(i + 1) % len(ids)])
    ids = np.array(body_ids)
    nb = [np.array(sorted(neighbours[i])) for i in ids]
    chin = joint(verts, 'jaw____tail')[2] - 0.01
    frozen = verts[ids, 2] > chin
    for side in ('L', 'R'):
        frozen |= np.linalg.norm(verts[ids] - joint(verts, f'wrist.{side}____head'), axis=1) < 0.13
    frozen |= verts[ids, 2] < 0.10
    weight = np.where(frozen, 0.0, 1.0)
    for _ in range(STYLE['smooth_passes']):
        for factor in (0.45, -0.47):
            mean = np.array([verts[n].mean(axis=0) for n in nb])
            verts[ids] += (mean - verts[ids]) * (factor * weight)[:, None]


def normalise_height(verts, body_ids, sex):
    verts[:, 2] -= verts[body_ids, 2].min()
    verts *= HEIGHT[sex] / np.ptp(verts[body_ids, 2])


def build_body(sex='male', name=None):
    _SKEL.clear()
    _SKEL.update(json.loads((SRC / 'default.mhskel').read_text()))
    weights = json.loads((SRC / 'default_weights.mhw').read_text())['weights']
    verts, uvs, faces = read_obj()
    apply_target(verts, f'african-{sex}-young.target')
    verts = to_blender(verts)

    body_faces = [c for g, c in faces if g == 'body']
    body_ids = sorted({c[0] for corners in body_faces for c in corners})
    normalise_height(verts, body_ids, sex)
    stylize(verts, body_ids, body_faces, weights, sex)
    normalise_height(verts, body_ids, sex)
    J = joint_positions(verts)

    name = name or f'AWD_Body_{sex}'
    remap = {old: i for i, old in enumerate(body_ids)}
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(verts[i]) for i in body_ids], [],
                     [[remap[c[0]] for c in corners] for corners in body_faces])
    uv_layer = mesh.uv_layers.new(name='UVMap')
    loop = 0
    for corners in body_faces:
        for _, t in corners:
            uv_layer.data[loop].uv = uvs[t] if t >= 0 else (0, 0)
            loop += 1
    mesh.attributes.new('mh_index', 'INT', 'POINT').data.foreach_set('value', body_ids)
    mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    arm = build_mh_armature(J, name + '_MHRig')
    for bone, entries in weights.items():
        group = obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
        for vid, w in entries:
            if vid in remap:
                group.add([remap[vid]], w, 'REPLACE')
    obj.parent = arm
    obj.modifiers.new('Armature', 'ARMATURE').object = arm
    obj['awd_sex'] = sex
    obj['awd_source'] = f'MakeHuman Community base.obj + african-{sex}-young.target, CC0'
    obj['awd_style'] = json.dumps(STYLE)
    arm['awd_joints'] = json.dumps({k: [round(float(x), 5) for x in v] for k, v in J.items()})
    return {'body': obj, 'mh_rig': arm, 'joints': J, 'verts': verts, 'uvs': uvs, 'faces': faces,
            'weights': weights, 'sex': sex}


def build_helper(ctx, groups, name, bones=None):
    """Create a mesh from MakeHuman helper groups (eyes, lashes, teeth, tongue).

    Helpers keep their authored UVs and are skinned with the default weights, so
    they follow the face bones exactly like the body surface does."""
    verts, uvs = ctx['verts'], ctx['uvs']
    faces = [c for g, c in ctx['faces'] if g in groups]
    ids = sorted({c[0] for corners in faces for c in corners})
    remap = {old: i for i, old in enumerate(ids)}
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(verts[i]) for i in ids], [], [[remap[c[0]] for c in corners] for corners in faces])
    layer = mesh.uv_layers.new(name='UVMap')
    loop = 0
    for corners in faces:
        for _, t in corners:
            layer.data[loop].uv = uvs[t] if t >= 0 else (0, 0)
            loop += 1
    mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for bone, entries in ctx['weights'].items():
        if bones and bone.split('.')[0] not in bones:
            continue
        hits = [(remap[v], w) for v, w in entries if v in remap]
        if hits:
            group = obj.vertex_groups.new(name=bone)
            for vid, w in hits:
                group.add([vid], w, 'REPLACE')
    obj.parent = ctx['mh_rig']
    obj.modifiers.new('Armature', 'ARMATURE').object = ctx['mh_rig']
    return obj, np.array([verts[i] for i in ids])


def build_mh_armature(J, name):
    data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    bones = _SKEL['bones']
    for bname, spec in bones.items():
        eb = data.edit_bones.new(bname)
        eb.head = Vector(J[spec['head']])
        eb.tail = Vector(J[spec['tail']])
        if (eb.tail - eb.head).length < 1e-4:
            eb.tail = eb.head + Vector((0, 0, 0.01))
    for bname, spec in bones.items():
        eb = data.edit_bones[bname]
        if spec['parent']:
            eb.parent = data.edit_bones[spec['parent']]
        plane = _SKEL['planes'].get(spec.get('rotation_plane'))
        if plane:
            p1, p2, p3 = (Vector(J[j]) for j in plane)
            normal = (p2 - p1).cross(p3 - p2)
            if normal.length > 1e-6:
                eb.align_roll(normal.normalized())
    bpy.ops.object.mode_set(mode='OBJECT')
    data.display_type = 'STICK'
    return arm
