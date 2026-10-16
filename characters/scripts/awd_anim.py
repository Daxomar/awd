"""Accra We Dey character pipeline, stage 8: original keyframed animation clips.

Clips are authored as rotations about intuitive armature axes, relative to each
bone's parent (X = character's left, Y = backwards, Z = up), layered on a
shared relaxed base pose, then converted to bone-local quaternions. Locomotion
is in place: the game moves characters from server positions, so no root
motion is baked. Every looping clip ends on its first pose.
"""
import math

import bpy
from mathutils import Quaternion, Vector

FPS = 30
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)


def mirror(spec):
    """Mirror a Left-side rotation list to the Right side (flip Y and Z rotations)."""
    return [(axis, -deg if axis in (Y, Z) else deg) for axis, deg in spec]


def sided(left_specs):
    out = {}
    for bone, spec in left_specs.items():
        out['Left' + bone] = spec
        out['Right' + bone] = mirror(spec)
    return out


FINGER_CURL = {f'Hand{f}{k}': [(X if f != 'Thumb' else Z, c)]
               for f, c0 in (('Index', 14), ('Middle', 18), ('Ring', 22), ('Pinky', 26), ('Thumb', 6))
               for k, c in ((1, c0), (2, c0 + 6), (3, c0 + 4))}

# Relaxed standing base pose (from the A-pose rest): arms down by the sides,
# forearms hanging with a soft bend, fingers loosely curled.
RELAXED = {**sided({'Arm': [(Y, 28), (X, 9)], 'ForeArm': [(X, 34), (Z, -8)], 'Hand': [(X, 8)], 'Shoulder': [(Y, 3)]}),
           **sided(FINGER_CURL)}


def q_spec(spec):
    q = Quaternion()
    for axis, deg in spec:
        q = Quaternion(Vector(axis), math.radians(deg)) @ q
    return q


def local_quat(rig, bone, q_arm):
    rest = rig.data.bones[bone].matrix_local.to_quaternion()
    return rest.inverted() @ q_arm @ rest


def new_action(rig, name):
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action
    return action


def bake_clip(rig, name, keys, duration, base=RELAXED, loop=True):
    """keys: [(time_s, {bone: [(axis, deg), ...], 'hips': (x, y, z)})]. Missing bones use base."""
    action = new_action(rig, name)
    # Key every bone: the glTF exporter samples all bones per clip, and unkeyed
    # bones would otherwise inherit whatever pose the previous clip left behind.
    bones = [pb.name for pb in rig.pose.bones]
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    if loop:
        keys = keys + [(duration, keys[0][1])]
    hips_rest = rig.data.bones['Hips'].matrix_local.to_quaternion()
    for t, key in keys:
        frame = 1 + round(t * FPS)
        for bone in bones:
            pb = rig.pose.bones[bone]
            pb.rotation_quaternion = local_quat(rig, bone, q_spec(key.get(bone, [])) @ q_spec(base.get(bone, [])))
            pb.keyframe_insert('rotation_quaternion', frame=frame)
        hips = rig.pose.bones['Hips']
        hips.location = hips_rest.inverted() @ Vector(key.get('hips', (0, 0, 0)))
        hips.keyframe_insert('location', frame=frame)
    action['awd_duration'] = duration
    action['awd_loop'] = loop
    action.use_frame_range = True
    action.frame_start, action.frame_end = 1, 1 + round(duration * FPS)
    return action


def idle(rig):
    """4 s breathing idle with a slow weight shift and a glance."""
    def k(breath, shift, look):
        return {
            'Spine1': [(X, -1.2 * breath)], 'Spine2': [(X, -1.4 * breath)],
            'LeftShoulder': [(Y, -1.0 * breath)], 'RightShoulder': [(Y, 1.0 * breath)],
            'Hips': [(Y, 1.6 * shift)], 'Spine': [(Y, -1.0 * shift)],
            'LeftUpLeg': [(Y, -1.6 * shift)], 'RightUpLeg': [(Y, -1.6 * shift)],
            'Neck': [(Z, 4 * look), (Y, -0.8 * shift)], 'Head': [(Z, 3 * look), (X, -1.5 * breath)],
            'hips': (0.008 * shift, 0, -0.004 * abs(shift)),
        }
    keys = [(0.0, k(0, 0, 0)), (1.0, k(1, 0.6, 0.2)), (2.0, k(0, 1, 0.6)), (3.0, k(1, 0.4, 0.1))]
    return bake_clip(rig, 'idle', keys, 4.0)


def walk(rig, duration=1.0, stride=1.0):
    """In-place walk cycle sampled at eight phases (contact, down, passing, up per foot)."""
    def pose(phase):
        a = 2 * math.pi * phase
        swing = math.sin(a)                     # +: left leg forward
        lift_l = max(0.0, math.sin(a - 1.2))    # knee lift while the leg swings through
        lift_r = max(0.0, -math.sin(a - 1.2))
        return {
            'LeftUpLeg': [(X, -24 * stride * swing - 6 * lift_l)], 'RightUpLeg': [(X, 24 * stride * swing - 6 * lift_r)],
            'LeftLeg': [(X, 8 + 46 * lift_l + 6 * max(0, -swing))], 'RightLeg': [(X, 8 + 46 * lift_r + 6 * max(0, swing))],
            'LeftFoot': [(X, -8 * swing + 10 * lift_l - 4)], 'RightFoot': [(X, 8 * swing + 10 * lift_r - 4)],
            'LeftArm': [(X, 22 * stride * swing)], 'RightArm': [(X, -22 * stride * swing)],
            'LeftForeArm': [(X, -10 * max(0, -swing))], 'RightForeArm': [(X, -10 * max(0, swing))],
            'Hips': [(Z, 5 * swing), (Y, 2 * math.cos(a))], 'Spine': [(Z, -3 * swing)],
            'Spine2': [(Z, -4 * swing), (X, -3)], 'Neck': [(Z, 2 * swing)], 'Head': [(Z, 1 * swing), (X, 2)],
            'hips': (0.006 * math.cos(a), 0, -0.012 - 0.018 * math.cos(2 * a)),
        }
    return bake_clip(rig, 'walk', [(duration * i / 8, pose(i / 8)) for i in range(8)], duration)


def wave(rig):
    """Friendly one-shot wave with the right hand (2 s)."""
    up = {'RightArm': [(Y, 30), (X, -55), (Z, -20)], 'RightForeArm': [(X, -95), (Z, 10)], 'RightHand': [(X, -10)],
          'Spine2': [(Z, 4)], 'Head': [(Z, -4), (Y, 2)]}
    keys = [(0.0, {})]
    for i, t in enumerate((0.45, 0.7, 0.95, 1.2, 1.45)):
        k = {b: list(v) for b, v in up.items()}
        k['RightForeArm'] = k['RightForeArm'] + [(Y, 18 if i % 2 else -18)]
        keys.append((t, k))
    keys.append((2.0, {}))
    return bake_clip(rig, 'wave', keys, 2.0, loop=False)


def build_library(rig):
    bpy.context.scene.render.fps = FPS
    clips = [idle(rig), walk(rig), wave(rig)]
    rig.animation_data.action = bpy.data.actions['idle']
    return clips
