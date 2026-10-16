"""Accra We Dey character pipeline, stage C: body sliders as morph targets.

Each saved slider (server/src/game/wardrobe.js cleanLook) becomes one shape key
holding its +1 extreme. At runtime the influence is (value - default) scaled to
[-1, 1], so the default look is the unmorphed mesh and negative influences give
the slimmer end. Deltas are computed on the body, then transferred to every
other part (garments, hair, shoes, brows, eyes) from the nearest body vertices,
so clothing follows the body shape exactly.
"""
import numpy as np
from mathutils.kdtree import KDTree

SLIDERS = {'build': 0.5, 'hips': 0.5, 'bust': 0.45, 'waist': 0.5, 'shoulders': 0.5,
           'muscle': 0.5, 'faceWidth': 0.5, 'nose': 0.5, 'lips': 0.5}


def influence(name, value):
    """Map a saved slider value (0..1) to a morph influence (-1..1)."""
    d = SLIDERS[name]
    return (value - d) / (1 - d) if value >= d else (value - d) / d


def _group_sum(obj, prefixes):
    idx = {g.index for g in obj.vertex_groups if g.name.startswith(prefixes)}
    w = np.zeros(len(obj.data.vertices))
    for v in obj.data.vertices:
        for ge in v.groups:
            if ge.group in idx:
                w[v.index] += ge.weight
    return np.clip(w, 0, 1)


def _gauss(x, centre, sigma):
    return np.exp(-((x - centre) / sigma) ** 2)


def _radial(co, a, b, mask, factor):
    """Push vertices away from the segment a-b (a limb axis) by factor-1 of their distance."""
    axis = (b - a) / np.linalg.norm(b - a)
    rel = co - a
    radial = rel - np.outer(rel @ axis, axis)
    return radial * ((factor - 1) * mask)[:, None]


class _Body:
    def __init__(self, ctx):
        body, J = ctx['body'], ctx['joints']
        self.co = np.array([v.co[:] for v in body.data.vertices])
        self.j = lambda n: np.array(J[n])
        self.arms = _group_sum(body, ('LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand'))
        self.legs = _group_sum(body, ('LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot',
                                      'LeftToeBase', 'RightToeBase'))
        self.head = _group_sum(body, ('Head',))
        self.torso = np.clip(1 - self.arms - self.legs - self.head, 0, 1)
        self.centre_y = self.j('spine05____head')[1]
        self.front = self.co[:, 1] < self.centre_y

    def limbs(self, factor_arm, factor_leg):
        co, j, d = self.co, self.j, np.zeros_like(self.co)
        for s in ('L', 'R'):
            side = (co[:, 0] > 0) if s == 'L' else (co[:, 0] < 0)
            for a, b, mask, f in (('upperarm01', 'lowerarm01', self.arms, factor_arm),
                                  ('lowerarm01', 'wrist', self.arms, factor_arm * 0.6 + 0.4),
                                  ('upperleg01', 'lowerleg01', self.legs, factor_leg),
                                  ('lowerleg01', 'foot', self.legs, factor_leg * 0.7 + 0.3)):
                ja, jb = j(f'{a}.{s}____head'), j(f'{b}.{s}____head')
                t = (co - ja) @ (jb - ja) / np.dot(jb - ja, jb - ja)
                d += _radial(co, ja, jb, mask * side * (t > -0.15) * (t < 1.1), f)
        return d


def body_deltas(ctx, sex):
    B = _Body(ctx)
    co, j = B.co, B.j
    hip_z, waist_z = j('upperleg01.L____head')[2], j('spine03____head')[2]
    chest_z, neck_z = j('spine01____head')[2], j('neck01____head')[2]
    shoulder_z = j('upperarm01.L____head')[2]
    out = {}

    d = B.limbs(1.12, 1.09)
    band = B.torso * _gauss(co[:, 2], (hip_z + neck_z) / 2, 0.30)
    d[:, 0] += co[:, 0] * 0.12 * band
    d[:, 1] += (co[:, 1] - B.centre_y) * 0.12 * band
    out['build'] = d

    d = np.zeros_like(co)
    band = _gauss(co[:, 2], hip_z, 0.12) * (1 - B.arms) * (co[:, 2] < waist_z + 0.05)
    d[:, 0] += co[:, 0] * 0.13 * band
    d[:, 1] += (co[:, 1] - B.centre_y) * 0.06 * band * ~B.front
    out['hips'] = d

    d = np.zeros_like(co)
    amount = 0.032 if sex == 'female' else 0.012
    for s in (1, -1):
        w = np.exp(-((co[:, 0] - s * 0.085) / 0.06) ** 2) * _gauss(co[:, 2], chest_z - 0.02, 0.055) * B.front * B.torso
        d[:, 1] -= amount * w
        d[:, 2] -= amount * 0.25 * w
    out['bust'] = d

    d = np.zeros_like(co)
    band = _gauss(co[:, 2], waist_z, 0.09) * B.torso
    d[:, 0] += co[:, 0] * 0.14 * band
    d[:, 1] += (co[:, 1] - B.centre_y) * 0.10 * band
    out['waist'] = d

    d = np.zeros_like(co)
    d[:, 0] += co[:, 0] * 0.10 * _gauss(co[:, 2], shoulder_z, 0.07) * (np.abs(co[:, 0]) > 0.06) * (1 - B.head)
    out['shoulders'] = d

    d = B.limbs(1.10, 1.05)
    d[:, 1] -= 0.010 * _gauss(co[:, 2], chest_z, 0.08) * B.front * B.torso
    out['muscle'] = d

    d = np.zeros_like(co)
    d[:, 0] = co[:, 0] * 0.10 * B.head
    out['faceWidth'] = d

    eyes = [j(f'eye.{s}____head') for s in ('L', 'R')]
    eye_z = (eyes[0][2] + eyes[1][2]) / 2
    face_front = co[:, 1] < eyes[0][1]
    nose = np.exp(-(co[:, 0] / 0.02) ** 2) * _gauss(co[:, 2], eye_z - 0.03, 0.018) * face_front * B.head
    d = np.zeros_like(co)
    d[:, 0] += co[:, 0] * 0.18 * nose
    d[:, 1] -= 0.003 * nose
    out['nose'] = d

    lips = np.exp(-(co[:, 0] / 0.03) ** 4) * _gauss(co[:, 2], eye_z - 0.052, 0.011) * face_front * B.head
    d = np.zeros_like(co)
    d[:, 1] -= 0.0025 * lips
    d[:, 2] += (co[:, 2] - (eye_z - 0.052)) * 0.25 * lips
    out['lips'] = d
    return out, co


def transfer(deltas, body_co, obj, k=4):
    """Inverse-distance blend of the nearest body deltas onto another mesh's vertices."""
    tree = KDTree(len(body_co))
    for i, c in enumerate(body_co):
        tree.insert(c, i)
    tree.balance()
    co = np.array([v.co[:] for v in obj.data.vertices])
    ids, weights = [], []
    for c in co:
        hits = tree.find_n(c, k)
        w = np.array([1 / max(h[2], 1e-4) for h in hits])
        ids.append([h[1] for h in hits])
        weights.append(w / w.sum())
    ids, weights = np.array(ids), np.array(weights)
    return {name: (d[ids] * weights[..., None]).sum(axis=1) for name, d in deltas.items()}, co


def add_keys(obj, deltas, base):
    if not obj.data.shape_keys:
        obj.shape_key_add(name='Basis', from_mix=False)
    for name, d in deltas.items():
        key = obj.data.shape_keys.key_blocks.get(name) or obj.shape_key_add(name=name, from_mix=False)
        key.slider_min, key.slider_max = -1.0, 1.0
        key.data.foreach_set('co', (base + d).ravel())


def build_body_morphs(ctx, parts, sex):
    """Add slider keys to the body and transfer them to every part in `parts`."""
    deltas, body_co = body_deltas(ctx, sex)
    add_keys(ctx['body'], deltas, body_co)
    for obj in parts:
        if obj is not ctx['body']:
            part_deltas, co = transfer(deltas, body_co, obj)
            add_keys(obj, part_deltas, co)
    return deltas, body_co
