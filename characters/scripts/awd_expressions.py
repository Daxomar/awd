"""Accra We Dey character pipeline, stage 3: facial expression shape keys.

Expressions are exported as glTF morph targets, which Three.js plays cheaply.
Eyelids and the jaw use the authored MakeHuman face bones; mouth and brow
shapes use smooth displacement fields measured from facial landmarks, so the
same recipe works on every face variant. Complex expressions are recipes that
mix these base keys at runtime (see EXPRESSIONS).
"""
import math

import bpy
import numpy as np
from mathutils import Matrix, Vector

BASE_KEYS = ['blink', 'jawOpen', 'smile', 'frown', 'mouthO', 'browUp', 'browDown', 'browInnerUp', 'squint']

# Runtime recipes: expression name -> {base key: weight}. Talking animates jawOpen/mouthO.
EXPRESSIONS = {
    'neutral': {},
    'happy': {'smile': 0.85, 'squint': 0.35, 'browUp': 0.15},
    'sad': {'frown': 0.8, 'browInnerUp': 0.8, 'squint': 0.1},
    'angry': {'browDown': 1.0, 'frown': 0.35, 'squint': 0.45},
    'surprised': {'browUp': 1.0, 'jawOpen': 0.35, 'mouthO': 0.35},
    'concerned': {'browInnerUp': 0.75, 'frown': 0.3, 'browDown': 0.15},
    'laughing': {'smile': 1.0, 'jawOpen': 0.55, 'squint': 0.7, 'browUp': 0.2},
    'talking': {'jawOpen': 0.3, 'mouthO': 0.2},
    'blinking': {'blink': 1.0},
}

BONE_KEYS = {
    'blink': [('orbicularis03.L', (1, 0, 0), 30), ('orbicularis03.R', (1, 0, 0), 30),
              ('orbicularis04.L', (1, 0, 0), -9), ('orbicularis04.R', (1, 0, 0), -9)],
    'jawOpen': [('jaw', (1, 0, 0), 16)],
}


def landmarks(ctx):
    J = ctx['joints']
    co = np.array([v.co[:] for v in ctx['body'].data.vertices])
    eyes = {s: np.array(J[f'eye.{s}____head']) for s in ('L', 'R')}
    eye_z = (eyes['L'][2] + eyes['R'][2]) / 2
    band = (np.abs(co[:, 0]) < 0.004) & (co[:, 2] < eye_z - 0.04) & (co[:, 2] > eye_z - 0.10)
    upper_lip = co[band][np.argmin(co[band][:, 1])]
    lips = (co[:, 1] < upper_lip[1] + 0.022) & (np.abs(co[:, 2] - (upper_lip[2] - 0.006)) < 0.007)
    lips &= np.abs(co[:, 0]) < 0.04
    corner = co[lips][np.argmax(np.abs(co[lips, 0]))]
    cx = abs(corner[0])
    return {'eyes': eyes,
            'mouth': np.array([0.0, upper_lip[1] + 0.004, upper_lip[2] - 0.006]),
            'corners': {'L': np.array([cx, corner[1], corner[2]]), 'R': np.array([-cx, corner[1], corner[2]])},
            'face_y': eyes['L'][1] + 0.035}


def gauss(co, centre, radius):
    return np.exp(-(np.linalg.norm(co - centre, axis=1) / radius) ** 2)


def field(name, co, L):
    """Displacement (n, 3) for one base key at rest positions co."""
    d = np.zeros_like(co)
    front = (co[:, 1] < L['face_y']).astype(float)
    eyes, corners, mouth = L['eyes'], L['corners'], L['mouth']
    if name == 'smile':
        for s, c in corners.items():
            side = np.sign(c[0])
            d += (gauss(co, c, 0.015) * front)[:, None] * np.array([0.005 * side, 0.007, 0.0115])
            cheek = eyes[s] + np.array([side * 0.024, -0.004, -0.030])
            d += (gauss(co, cheek, 0.02) * front)[:, None] * np.array([0.0006 * side, -0.002, 0.004])
        d[:, 0] += co[:, 0] * 0.07 * gauss(co, mouth, 0.03) * front
    elif name == 'frown':
        for c in corners.values():
            w = gauss(co, c + np.array([0, 0, -0.004]), 0.018) * front
            d += w[:, None] * np.array([-0.0012 * np.sign(c[0]), -0.0008, -0.0085])
    elif name == 'mouthO':
        w = gauss(co, mouth, 0.026) * front
        d[:, 0] -= co[:, 0] * 0.28 * w
        d[:, 1] -= 0.0045 * w
    elif name in ('browUp', 'browDown', 'browInnerUp'):
        for e in eyes.values():
            side = np.sign(e[0])
            inner = e + np.array([-side * 0.016, -0.004, 0.026])
            mid = e + np.array([0.0, -0.002, 0.028])
            fore = front * (co[:, 2] > e[2] + 0.006)
            if name == 'browUp':
                d += (gauss(co, mid, 0.03) * fore)[:, None] * np.array([0, 0, 0.0085])
            elif name == 'browDown':
                d += (gauss(co, inner, 0.022) * fore)[:, None] * np.array([-side * 0.0022, -0.0018, -0.0065])
                d += (gauss(co, mid, 0.026) * fore)[:, None] * np.array([0, 0, -0.0018])
            else:
                d += (gauss(co, inner, 0.02) * fore)[:, None] * np.array([side * 0.0008, 0, 0.0085])
    elif name == 'squint':
        for e in eyes.values():
            lower = (co[:, 2] < e[2] - 0.002) * front
            d += (gauss(co, e + np.array([0, -0.012, -0.010]), 0.013) * lower)[:, None] * np.array([0, 0, 0.0024])
            cheek = e + np.array([np.sign(e[0]) * 0.01, -0.008, -0.026])
            d += (gauss(co, cheek, 0.02) * front)[:, None] * np.array([0, -0.0006, 0.002])
    return d


def ensure_basis(obj):
    if not obj.data.shape_keys:
        obj.shape_key_add(name='Basis', from_mix=False)


def add_field_key(obj, name, L):
    ensure_basis(obj)
    key = obj.data.shape_keys.key_blocks.get(name) or obj.shape_key_add(name=name, from_mix=False)
    base = np.array([v.co[:] for v in obj.data.vertices])
    key.data.foreach_set('co', (base + field(name, base, L)).ravel())


def reset_pose(rig):
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()


def rotate_bone(rig, bone, axis, degrees):
    """Rotate a pose bone about a world axis through its head (rig sits unscaled at the origin)."""
    pb = rig.pose.bones[bone]
    head = pb.head.copy()
    rot = Matrix.Translation(head) @ Matrix.Rotation(math.radians(degrees), 4, Vector(axis)) @ Matrix.Translation(-head)
    pb.matrix = rot @ pb.matrix
    bpy.context.view_layer.update()


def add_bone_key(objs, rig, name):
    reset_pose(rig)
    for bone, axis, deg in BONE_KEYS[name]:
        rotate_bone(rig, bone, axis, deg)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objs:
        ensure_basis(obj)
        posed = np.array([v.co[:] for v in obj.evaluated_get(depsgraph).data.vertices])
        key = obj.data.shape_keys.key_blocks.get(name) or obj.shape_key_add(name=name, from_mix=False)
        key.data.foreach_set('co', posed.ravel())
    reset_pose(rig)


def build_expressions(ctx, face_objects):
    """face_objects: meshes that carry expression keys (body, brows, lashes, teeth, tongue)."""
    L = landmarks(ctx)
    for obj in face_objects:
        ensure_basis(obj)
        for kb in obj.data.shape_keys.key_blocks:
            kb.value = 0.0
    for name in BONE_KEYS:
        add_bone_key(face_objects, ctx['mh_rig'], name)
    for name in BASE_KEYS:
        if name in BONE_KEYS:
            continue
        for obj in face_objects:
            if not obj.name.startswith(('AWD_Teeth', 'AWD_Tongue')):
                add_field_key(obj, name, L)
    return L
