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


def curve(table, t):
    """Piecewise-linear lookup in a gait table [(percent, degrees), ...], wrapping at 100 %."""
    t = (t % 1.0) * 100
    for (t0, v0), (t1, v1) in zip(table, table[1:]):
        if t0 <= t <= t1:
            return v0 + (v1 - v0) * (t - t0) / (t1 - t0)
    return table[-1][1]


# Sagittal joint angles over one gait cycle from left heel strike (degrees; + = hip flexion,
# knee flexion, ankle dorsiflexion), rounded from published normal-walking averages
# (Winter, Biomechanics and Motor Control of Human Movement). The right leg is half a cycle on.
WALK_HIP = [(0, 26), (12, 22), (30, 6), (50, -10), (60, -4), (72, 14), (86, 28), (100, 26)]
WALK_KNEE = [(0, 4), (13, 16), (36, 4), (50, 8), (62, 38), (73, 60), (86, 28), (96, 5), (100, 4)]
WALK_ANKLE = [(0, 0), (8, -6), (30, 7), (48, 10), (62, -15), (72, -4), (86, 2), (100, 0)]
RUN_HIP = [(0, 32), (18, 8), (34, -14), (46, -6), (62, 22), (78, 46), (90, 40), (100, 32)]
RUN_KNEE = [(0, 22), (13, 40), (34, 16), (46, 44), (62, 98), (76, 86), (90, 38), (100, 22)]
RUN_ANKLE = [(0, 2), (13, 16), (34, -24), (48, -10), (76, 6), (100, 2)]


def legs(t, hip, knee, ankle):
    out = {}
    for side, phase in (('Left', 0.0), ('Right', 0.5)):
        u = t + phase
        out[side + 'UpLeg'] = [(X, -curve(hip, u))]
        out[side + 'Leg'] = [(X, curve(knee, u))]
        out[side + 'Foot'] = [(X, -curve(ankle, u))]
    return out


def walk(rig, duration=1.08, samples=24):
    """In-place walk built from real gait curves: heel strike, loading, roll-over and toe-off,
    with the pelvis highest over the standing leg and lowest at each heel strike, a sideways
    weight shift onto the standing leg, pelvis rotation with a counter-rotating chest, and
    relaxed arms swinging against the legs with the elbow bending as each arm comes forward."""
    def pose(t):
        a = 2 * math.pi * t
        key = legs(t, WALK_HIP, WALK_KNEE, WALK_ANKLE)
        arm = math.cos(a)                       # +: left arm back (left leg forward)
        key.update({
            'LeftArm': [(X, 16 * arm)], 'RightArm': [(X, -16 * arm)],
            'LeftForeArm': [(X, -(8 + 16 * max(0.0, -arm)))], 'RightForeArm': [(X, -(8 + 16 * max(0.0, arm)))],
            'Hips': [(Z, 4.5 * arm), (Y, -2.5 * math.sin(a))],
            'Spine': [(Z, -2.0 * arm), (Y, 1.2 * math.sin(a))], 'Spine1': [(Z, -1.5 * arm)],
            'Spine2': [(Z, -2.5 * arm), (X, -2.0)],
            'Neck': [(Z, 2.0 * arm)], 'Head': [(Z, 1.5 * arm), (X, 2.0), (Y, -1.0 * math.sin(a))],
            'hips': (0.014 * math.sin(a), 0, -0.010 - 0.016 * math.cos(4 * math.pi * t)),
        })
        return key
    return bake_clip(rig, 'walk', [(duration * i / samples, pose(i / samples)) for i in range(samples)], duration)


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


def run(rig, duration=0.72, samples=24):
    """In-place run from running gait curves: short stance, flight phase, high heel recovery,
    bent pumping arms and a forward lean; the body is lowest mid-stance and highest in flight."""
    def pose(t):
        a = 2 * math.pi * t
        key = legs(t, RUN_HIP, RUN_KNEE, RUN_ANKLE)
        arm = math.cos(a)
        key.update({
            'LeftArm': [(X, 34 * arm), (Y, -8)], 'RightArm': [(X, -34 * arm), (Y, 8)],
            'LeftForeArm': [(X, -(78 + 14 * max(0.0, -arm)))], 'RightForeArm': [(X, -(78 + 14 * max(0.0, arm)))],
            'LeftHand': [(X, 6)], 'RightHand': [(X, 6)],
            'Hips': [(Z, 6 * arm), (X, -4)], 'Spine': [(X, 5), (Z, -3 * arm)], 'Spine1': [(X, 2)],
            'Spine2': [(X, 3), (Z, -5 * arm)], 'Neck': [(X, -5)], 'Head': [(X, -3), (Z, 2 * arm)],
            'hips': (0.008 * math.sin(a), 0, -0.035 + 0.028 * math.cos(4 * math.pi * (t - 0.42))),
        })
        return key
    return bake_clip(rig, 'run', [(duration * i / samples, pose(i / samples)) for i in range(samples)], duration)


def agree(rig):
    """Nod: three soft nods and back (1.8 s, one shot)."""
    keys = [(0.0, {})]
    for i, t in enumerate((0.3, 0.55, 0.8, 1.05, 1.3, 1.55)):
        down = i % 2 == 0
        keys.append((t, {'Head': [(X, 13 if down else -3)], 'Neck': [(X, 5 if down else 0)], 'Spine2': [(X, 1.5)]}))
    keys.append((1.8, {}))
    return bake_clip(rig, 'agree', keys, 1.8, loop=False)


def shake(rig):
    """Head shake: no-no with a small shoulder shrug (2.4 s, one shot)."""
    keys = [(0.0, {})]
    for i, t in enumerate((0.3, 0.6, 0.9, 1.2, 1.5, 1.8)):
        side = 1 if i % 2 == 0 else -1
        keys.append((t, {'Head': [(Z, 20 * side)], 'Neck': [(Z, 8 * side)],
                         'LeftShoulder': [(Y, -4)], 'RightShoulder': [(Y, 4)]}))
    keys.append((2.4, {}))
    return bake_clip(rig, 'shake', keys, 2.4, loop=False)


def sad(rig):
    """Dejected slump: head drops, chest folds, shoulders roll forward, then recovers (3 s)."""
    slump = {'Head': [(X, 20)], 'Neck': [(X, 10)], 'Spine2': [(X, 9)], 'Spine1': [(X, 5)], 'Spine': [(X, 3)],
             'LeftShoulder': [(Z, -7)], 'RightShoulder': [(Z, 7)], 'LeftArm': [(X, -4)], 'RightArm': [(X, -4)],
             'hips': (0, 0, -0.01)}
    sigh = {k: [(axis, deg * 1.12) for axis, deg in v] if isinstance(v, list) else v for k, v in slump.items()}
    keys = [(0.0, {}), (0.7, slump), (1.6, sigh), (2.4, slump), (3.0, {})]
    return bake_clip(rig, 'sad', keys, 3.0, loop=False)


def dance(rig, duration=2.0):
    """Looping azonto-style groove: bouncing knees, alternating forearm swings, torso twist."""
    def pose(phase):
        a = 2 * math.pi * phase
        bounce = 0.5 + 0.5 * math.cos(2 * a)         # two bounces per bar
        sway = math.sin(a)
        return {
            'LeftUpLeg': [(X, -10 * bounce), (Y, -3 * sway)], 'RightUpLeg': [(X, -10 * bounce), (Y, -3 * sway)],
            'LeftLeg': [(X, 22 * bounce)], 'RightLeg': [(X, 22 * bounce)],
            'LeftFoot': [(X, -10 * bounce)], 'RightFoot': [(X, -10 * bounce)],
            'LeftArm': [(X, -40 - 18 * sway), (Y, -12)], 'RightArm': [(X, -40 + 18 * sway), (Y, 12)],
            'LeftForeArm': [(X, -70 + 15 * sway)], 'RightForeArm': [(X, -70 - 15 * sway)],
            'LeftHand': [(Z, 10 * sway)], 'RightHand': [(Z, 10 * sway)],
            'Hips': [(Z, 10 * sway), (Y, 4 * sway)], 'Spine': [(Z, -6 * sway), (X, 4 * bounce)],
            'Spine2': [(Z, -8 * sway)], 'Neck': [(X, -3 + 6 * bounce)], 'Head': [(Z, 6 * sway), (Y, -3 * sway)],
            'hips': (0.02 * sway, 0, -0.035 * bounce),
        }
    return bake_clip(rig, 'dance', [(duration * i / 16, pose(i / 16)) for i in range(16)], duration)


# ---------------------------------------------------------------- activity actions (2026-10)
# Looping actions the game plays while a player does something (client/src/v2/scene/actions.js picks the
# clip and the prop for each activity). They layer on the relaxed base pose; seated, kneeling and lying
# poses still place legs and hips (poses.js leaves the arms to the clip). Rig conventions, checked by
# render: arm forward = -X on both sides; arm out to the side = -Y (left) / +Y (right); elbow flexion
# = -X on the forearm, which in this A-pose rig bends out to the side unless the forearm also turns
# inwards about Z (-Z left / +Z right), so fore() couples the two.

def cycle(rig, name, duration, pose, samples=16):
    """Bake a looping clip from pose(phase) with phase in [0, 1)."""
    return bake_clip(rig, name, [(duration * i / samples, pose(i / samples)) for i in range(samples)], duration)


def wave01(phase, shift=0.0):
    """0..1..0 once per cycle, smooth."""
    return 0.5 - 0.5 * math.cos(2 * math.pi * (phase - shift))


def arm(side, forward=0.0, out=0.0):
    return [(X, -forward), (Y, -out if side == 'Left' else out)]


def fore(side, flex, inward=0.5):
    """Elbow flexion in degrees; inward brings the hand in front of the body instead of out to the side."""
    return [(X, -flex), (Z, -inward * flex if side == 'Left' else inward * flex)]


def arms(left=(0, 0, 0, 0.5), right=(0, 0, 0, 0.5)):
    """(forward, out, flex, inward) per side."""
    out = {}
    for side, (fw, ab, fl, inw) in (('Left', left), ('Right', right)):
        out[side + 'Arm'] = arm(side, fw, ab)
        out[side + 'ForeArm'] = fore(side, fl, inw)
    return out


def lift(rig):
    """Alternating dumbbell curls: elbows pinned to the sides, a small lean into each rep."""
    def pose(t):
        l, r = wave01(t), wave01(t, 0.5)
        k = arms((8 * l, 4, 15 + 115 * l, 0.35), (8 * r, 4, 15 + 115 * r, 0.35))
        k.update({'LeftHand': [(X, -15 * l)], 'RightHand': [(X, -15 * r)], 'Spine': [(X, 2), (Z, 2 * (l - r))],
                  'Spine2': [(X, -2)], 'Head': [(X, -3)], 'hips': (0, 0, -0.004 * (l + r))})
        return k
    return cycle(rig, 'lift', 2.4, pose)


def box(rig):
    """Shadow boxing: guard up, alternating jabs and crosses with a little bounce."""
    def pose(t):
        jab, cross = max(0.0, math.sin(2 * math.pi * t)) ** 2, max(0.0, -math.sin(2 * math.pi * t)) ** 2
        k = arms((50 + 35 * jab, 14 - 10 * jab, 125 - 115 * jab, 0.45), (50 + 35 * cross, 14 - 10 * cross, 125 - 115 * cross, 0.45))
        k.update({'Spine': [(X, 6), (Z, 14 * (cross - jab))], 'Head': [(X, 4)],
                  'LeftUpLeg': [(X, -8)], 'RightUpLeg': [(X, 8)], 'LeftLeg': [(X, 12)], 'RightLeg': [(X, 12)],
                  'hips': (0, 0, -0.02 - 0.012 * abs(math.sin(4 * math.pi * t)))})
        return k
    return cycle(rig, 'box', 1.3, pose)


def eat(rig):
    """Plate held at the belly in the left hand, spoon from plate to mouth in the right."""
    def pose(t):
        b = wave01(t) ** 1.5
        k = arms((22, 6, 85, 0.55), (25 + 18 * b, 4, 70 + 75 * b, 0.55 + 0.1 * b))
        k.update({'RightHand': [(X, -10 * b)], 'Head': [(X, 14 - 18 * b)], 'Neck': [(X, 6 - 6 * b)], 'Spine2': [(X, 3)]})
        return k
    return cycle(rig, 'eat', 2.6, pose)


def drink(rig):
    """Bottle at the side, raised to the mouth for a long sip, lowered again."""
    def pose(t):
        b = min(1.0, max(0.0, (wave01(t) - 0.15) / 0.7))
        k = arms(right=(20 + 28 * b, 4, 40 + 100 * b, 0.55))
        k.update({'Head': [(X, -14 * b)], 'Neck': [(X, -6 * b)], 'Spine2': [(X, -3 * b)]})
        return k
    return cycle(rig, 'drink', 3.2, pose)


def phone_use(rig):
    """Phone at chest height in the right hand, thumb scrolling, head bowed; a glance up now and then."""
    def pose(t):
        g = max(0.0, math.sin(2 * math.pi * t)) ** 6
        s = math.sin(8 * math.pi * t)
        k = arms((10, 4, 70, 0.6), (14, 4, 100, 0.55))
        k.update({'RightHand': [(X, -12 + 4 * s)], 'Head': [(X, 20 - 24 * g), (Z, 6 * g)], 'Neck': [(X, 8 - 8 * g)]})
        return k
    return cycle(rig, 'phone_use', 4.0, pose)


def photo(rig):
    """Phone held up at eye level in both hands, framing a shot, a small shift of the weight."""
    def pose(t):
        s = math.sin(2 * math.pi * t)
        k = arms((62, 8, 105, 0.62), (62, 8, 105, 0.62))
        k.update({'Spine': [(Z, 6 * s)], 'Head': [(X, -4), (Z, 4 * s)], 'hips': (0.01 * s, 0, 0)})
        return k
    return cycle(rig, 'photo', 3.0, pose)


def cook(rig):
    """Stirring a pot with a ladle in slow circles, the other hand resting at the waist."""
    def pose(t):
        a = 2 * math.pi * t
        k = arms((10, 22, 50, -0.2), (34 + 8 * math.sin(a), 6 + 8 * math.cos(a), 65 + 10 * math.cos(a), 0.3))
        k.update({'RightHand': [(X, 20)], 'Spine': [(X, 8)], 'Spine2': [(X, 4)], 'Head': [(X, 16)]})
        return k
    return cycle(rig, 'cook', 2.2, pose)


def scrub(rig):
    """Washing at waist height: both hands rubbing back and forth, shoulders working."""
    def pose(t):
        s = math.sin(2 * math.pi * t)
        k = arms((36 + 10 * s, 6, 60, 0.5), (36 - 10 * s, 6, 60, 0.5))
        k.update({'RightHand': [(X, 25)], 'LeftHand': [(X, 25)], 'Spine': [(X, 16), (Z, 4 * s)], 'Spine2': [(X, 8)],
                  'Head': [(X, 14)], 'LeftUpLeg': [(X, -6)], 'RightUpLeg': [(X, -6)], 'LeftLeg': [(X, 10)], 'RightLeg': [(X, 10)],
                  'hips': (0, 0.01, -0.02)})
        return k
    return cycle(rig, 'scrub', 1.2, pose)


def sweep(rig):
    """Sweeping with a short Ghanaian broom: bent at the waist, broom swept side to side."""
    def pose(t):
        s = math.sin(2 * math.pi * t)
        k = arms((14, 8, 50, 0.3), (32, 6 + 22 * s, 20, 0.2))
        k.update({'Spine': [(X, 34), (Z, -8 * s)], 'Spine1': [(X, 10)], 'Spine2': [(X, 6)], 'Head': [(X, -12)],
                  'RightHand': [(X, 10)], 'LeftUpLeg': [(X, -14)], 'RightUpLeg': [(X, -14)], 'LeftLeg': [(X, 18)],
                  'RightLeg': [(X, 18)], 'hips': (0.02 * s, 0.03, -0.05)})
        return k
    return cycle(rig, 'sweep', 1.4, pose)


def carry(rig):
    """A headpan load steadied with the right hand, the left arm swinging; the body sways gently."""
    def pose(t):
        s = math.sin(2 * math.pi * t)
        k = arms((-10 * s, 4, 15, 0.3), (10, 150, 75, 0.7))
        k.update({'Spine': [(Z, 2 * s)], 'Neck': [(X, -4)], 'Head': [(X, -4), (Z, -2 * s)], 'hips': (0.012 * s, 0, 0)})
        return k
    return cycle(rig, 'carry', 2.0, pose)


def type_(rig):
    """Typing: forearms forward on the keys, hands patting quickly, small head moves to the screen."""
    def pose(t):
        a = 2 * math.pi * t
        l, r = math.sin(6 * a), math.sin(6 * a + 1.7)
        k = arms((22, 6, 80 + 4 * l, 0.45), (22, 6, 80 + 4 * r, 0.45))
        k.update({'LeftHand': [(X, 6 + 8 * l)], 'RightHand': [(X, 6 + 8 * r)],
                  'Head': [(X, 10 + 3 * math.sin(a)), (Z, 5 * math.sin(a))], 'Spine2': [(X, 4)]})
        return k
    return cycle(rig, 'type', 3.0, pose, samples=24)


def guitar(rig):
    """Highlife guitar: left hand along the neck shifting chords, right hand strumming over the body."""
    def pose(t):
        s, c = math.sin(4 * math.pi * t), math.sin(math.pi * t)
        k = arms((40, 28, 100 + 6 * c, 0.1), (18, 4, 80 + 14 * s, 0.75))
        k.update({'RightHand': [(X, 10 * s)], 'Head': [(X, 14), (Z, 10)], 'Spine': [(Z, 3 * c)],
                  'hips': (0, 0, -0.006 * abs(s))})
        return k
    return cycle(rig, 'guitar', 2.0, pose)


def drum(rig):
    """Hand drumming: alternating strikes on a drum at hip height, shoulders and head in the groove."""
    def pose(t):
        l, r = max(0.0, math.sin(4 * math.pi * t)), max(0.0, -math.sin(4 * math.pi * t))
        k = arms((28 - 10 * l, 10, 70 - 26 * l, 0.5), (28 - 10 * r, 10, 70 - 26 * r, 0.5))
        k.update({'LeftHand': [(X, -30 + 40 * l)], 'RightHand': [(X, -30 + 40 * r)], 'Spine': [(X, 10)],
                  'Head': [(X, 6 + 6 * (l + r)), (Z, 6 * (l - r))], 'hips': (0, 0, -0.008 * (l + r))})
        return k
    return cycle(rig, 'drum', 1.0, pose)


def cheer(rig):
    """Supporting a team: clapping in front of the chest, then both fists up, then clapping again."""
    def pose(t):
        up = max(0.0, math.sin(2 * math.pi * t)) ** 3
        clap = abs(math.sin(10 * math.pi * t)) * (1 - up)
        inward = (0.55 + 0.2 * clap) * (1 - up)
        side = (50 + 100 * up, 8 + 10 * up, 85 - 45 * up, inward)
        k = arms(side, side)
        k.update({'Head': [(X, -8 * up)], 'Spine2': [(X, -6 * up)], 'hips': (0, 0, 0.02 * up)})
        return k
    return cycle(rig, 'cheer', 2.4, pose, samples=24)


def talk(rig):
    """Conversation: open-handed gestures that rise and fall with the words, a weight shift."""
    def pose(t):
        a = 2 * math.pi * t
        g1, g2 = max(0.0, math.sin(a)), max(0.0, math.sin(a + 2.4))
        k = arms((10 + 14 * g2, 6, 30 + 45 * g2, 0.3), (12 + 18 * g1, 6, 40 + 50 * g1, 0.3))
        k.update({'RightHand': [(Z, 40 * g1)], 'LeftHand': [(Z, -40 * g2)],
                  'Head': [(X, -3 + 5 * math.sin(2 * a)), (Z, 6 * math.sin(a))], 'Spine': [(Y, 1.5 * math.sin(a))],
                  'hips': (0.01 * math.sin(a), 0, 0)})
        return k
    return cycle(rig, 'talk', 3.4, pose)


def read(rig):
    """Open book held in both hands at the chest, head down reading; a page turn each cycle."""
    def pose(t):
        turn = max(0.0, math.sin(2 * math.pi * (t - 0.75))) ** 8
        k = arms((24, 6, 95, 0.55), (24 + 6 * turn, 6, 95 - 15 * turn, 0.55 + 0.2 * turn))
        k.update({'Head': [(X, 24), (Z, -4 * turn)], 'Neck': [(X, 8)]})
        return k
    return cycle(rig, 'read', 4.0, pose)


def pull(rig):
    """Hauling a fishing net or rope: reach forward, then pull back with the whole body."""
    def pose(t):
        p = wave01(t)
        side = (70 - 50 * p, 8, 10 + 60 * p, 0.3)
        k = arms(side, side)
        k.update({'Spine': [(X, 20 - 26 * p)], 'Head': [(X, -6)], 'LeftUpLeg': [(X, -18)], 'RightUpLeg': [(X, 8)],
                  'LeftLeg': [(X, 20)], 'RightLeg': [(X, 14)], 'hips': (0, 0.02 - 0.05 * p, -0.03)})
        return k
    return cycle(rig, 'pull', 2.2, pose)


def fix(rig):
    """Working with a spanner on something low: bent forward, the right hand turning, the left steadying."""
    def pose(t):
        s = math.sin(2 * math.pi * t)
        k = arms((36, 8, 40, 0.4), (40, 6, 50 + 10 * s, 0.4))
        k.update({'RightHand': [(Z, 30 * s)], 'Spine': [(X, 30)], 'Spine2': [(X, 8)], 'Head': [(X, -6)],
                  'LeftUpLeg': [(X, -10)], 'RightUpLeg': [(X, -10)], 'LeftLeg': [(X, 16)], 'RightLeg': [(X, 16)],
                  'hips': (0, 0.02, -0.04)})
        return k
    return cycle(rig, 'fix', 1.6, pose)


def swim(rig):
    """Front crawl arms at the surface (the game sets the body waist-deep in the water)."""
    def pose(t):
        a = 2 * math.pi * t
        k = arms((90 + 80 * math.sin(a), 10, 20 + 20 * max(0, math.cos(a)), 0.2),
                 (90 - 80 * math.sin(a), 10, 20 + 20 * max(0, -math.cos(a)), 0.2))
        k.update({'Spine': [(X, 10), (Z, 10 * math.sin(a))], 'Head': [(Z, 20 * math.sin(a)), (X, -10)]})
        return k
    return cycle(rig, 'swim', 1.6, pose)


ACTION_CLIPS = (lift, box, eat, drink, phone_use, photo, cook, scrub, sweep, carry, type_, guitar, drum, cheer, talk,
                read, pull, fix, swim)


# ---------------------------------------------------------------- social gestures (2026-10)
# One-shot clips played when two players interact (client/src/v2/ui/people.js SOCIALS). Both people
# play their own copy facing each other, so a wave is answered by a wave and a handshake meets in the
# middle. Rig conventions are the ones arms() and fore() above encode.


def handshake(rig):
    """Offer the right hand, clasp, two firm shakes, release (2.6 s).

    The upper arm barely swings forward and the elbow carries the reach, so the forearm is level and the
    hand meets the other person's at waist height instead of ending up against the chest."""
    def pose(reach, shake=0.0, lean=0.0):
        k = arms(left=(6, 4, 14, 0.3), right=(16 * reach, 2, (70 + 9 * shake) * reach, 0.48))
        k.update({'RightHand': [(X, -8 * reach), (Z, 10 * reach)], 'Spine': [(X, 5 * lean)],
                  'Spine2': [(X, 3 * lean)], 'Head': [(X, 6 * lean)]})
        return k
    keys = [(0.0, {}), (0.45, pose(0.75, 0, 0.6)), (0.8, pose(1.0, 0, 1.0)), (1.1, pose(1.0, 1.0, 1.0)),
            (1.4, pose(1.0, 0, 1.0)), (1.7, pose(1.0, 1.0, 1.0)), (2.0, pose(1.0, 0, 1.0)), (2.6, {})]
    return bake_clip(rig, 'handshake', keys, 2.6, loop=False)


def hug(rig):
    """Open both arms wide, step in, close them round the other person, hold, release (3 s).

    Only a little inward twist: more and the forearms cross the chest, which reads as folded arms."""
    def pose(open_, close):
        reach = (30 * open_ + 18 * close, 50 * open_ - 32 * close, (22 + 46 * close) * open_, 0.08 + 0.27 * close)
        k = arms(left=reach, right=reach)
        k.update({'Spine': [(X, 7 * close)], 'Spine2': [(X, 4 * close)], 'Head': [(X, 5 * close), (Z, 7 * close)],
                  'hips': (0, -0.05 * close, 0)})
        return k
    keys = [(0.0, {}), (0.5, pose(1.0, 0.0)), (1.0, pose(1.0, 1.0)), (2.0, pose(1.0, 1.0)), (2.5, pose(1.0, 0.15)), (3.0, {})]
    return bake_clip(rig, 'hug', keys, 3.0, loop=False)


def laugh(rig):
    """Head back, shoulders shaking, one hand to the belly (2.2 s)."""
    def pose(amount, shake):
        k = arms(left=(8, 6, 18, 0.5), right=(14 * amount, 3, 48 * amount, 0.62))
        k.update({'Head': [(X, -18 * amount + 4 * shake), (Z, 5 * shake)], 'Neck': [(X, -8 * amount)],
                  'Spine2': [(X, -7 * amount + 3 * shake)], 'Spine': [(X, 5 * amount)],
                  'LeftShoulder': [(Y, -3 * shake)], 'RightShoulder': [(Y, 3 * shake)],
                  'hips': (0, 0, -0.012 * amount)})
        return k
    keys = [(0.0, {}), (0.35, pose(1.0, 1.0)), (0.6, pose(1.0, -1.0)), (0.9, pose(1.0, 1.0)),
            (1.2, pose(1.0, -1.0)), (1.5, pose(0.9, 0.5)), (2.2, {})]
    return bake_clip(rig, 'laugh', keys, 2.2, loop=False)


SOCIAL_CLIPS = (handshake, hug, laugh)

def build_library(rig):
    """Every clip the live game calls (room.js play/anim, world.js gesture, server emotes)."""
    bpy.context.scene.render.fps = FPS
    clips = [idle(rig), walk(rig), run(rig), wave(rig), agree(rig), shake(rig), sad(rig), dance(rig)]
    clips += [make(rig) for make in ACTION_CLIPS]
    clips += [make(rig) for make in SOCIAL_CLIPS]
    rig.animation_data.action = bpy.data.actions['idle']
    return clips
