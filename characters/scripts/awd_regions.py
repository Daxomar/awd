"""Accra We Dey character pipeline: body regions for runtime skin culling.

Every body vertex belongs to one region. The body GLB carries the region id in
a custom float attribute `_awd_region`; every garment records the regions it
covers completely in `awd_hides_regions` (a bit mask). At runtime a body
triangle is dropped when all three of its vertices lie in hidden regions, so
skin never pokes through clothes and covered skin is not drawn. Region bounds
are conservative: a garment only hides a region it covers end to end.
"""
import numpy as np
from mathutils.kdtree import KDTree

REGIONS = ['head', 'neck', 'chest', 'belly', 'pelvis', 'upperarm', 'elbow', 'forearm', 'hand',
           'thigh', 'knee', 'shin', 'ankle', 'foot']
BIT = {name: i for i, name in enumerate(REGIONS)}
ATTRIBUTE = '_awd_region'


def mask(*names):
    return sum(1 << BIT[n] for n in names)


def _param(co, a, b):
    axis = b - a
    return (co - a) @ axis / float(axis @ axis)


def compute_regions(ctx):
    """Region id per body vertex from the game-bone weights and limb positions."""
    body, J = ctx['body'], ctx['joints']
    co = np.array([v.co[:] for v in body.data.vertices])
    names = {g.index: g.name for g in body.vertex_groups}
    dominant = []
    for v in body.data.vertices:
        best = max(v.groups, key=lambda ge: ge.weight, default=None)
        dominant.append(names[best.group] if best else 'Hips')
    j = lambda n: np.array(J[n])  # noqa: E731
    hip_z, neck_z = j('upperleg01.L____head')[2], j('neck01____head')[2]
    region = np.zeros(len(co), dtype=np.int32)
    for i, bone in enumerate(dominant):
        p = co[i]
        s = 'L' if p[0] > 0 else 'R'
        if bone.startswith('Head') or bone.endswith('Eye'):
            r = 'head'
        elif bone == 'Neck' or (bone.startswith('Spine') and p[2] > neck_z - 0.07):
            r = 'neck'
        elif bone in ('Spine1', 'Spine2') or bone.endswith('Shoulder') and p[2] < neck_z - 0.07 and abs(p[0]) < 0.12:
            r = 'chest'
        elif bone == 'Spine' or (bone == 'Hips' and p[2] > hip_z + 0.03):
            r = 'belly'
        elif bone == 'Hips':
            r = 'pelvis'
        elif bone.endswith('Shoulder') or bone.endswith('Arm') and not bone.endswith('ForeArm'):
            t = _param(p, j(f'upperarm01.{s}____head'), j(f'lowerarm01.{s}____head'))
            r = 'upperarm' if t < 0.40 else 'elbow'
        elif bone.endswith('ForeArm'):
            r = 'forearm'
        elif 'Hand' in bone:
            r = 'hand'
        elif bone.endswith('UpLeg'):
            r = 'thigh' if _param(p, j(f'upperleg01.{s}____head'), j(f'lowerleg01.{s}____head')) < 0.55 else 'knee'
        elif bone.endswith('Leg'):
            r = 'shin' if _param(p, j(f'lowerleg01.{s}____head'), j(f'foot.{s}____head')) < 0.5 else 'ankle'
        else:
            r = 'foot'
        region[i] = BIT[r]
    return region, co


def write_attribute(obj, values):
    attr = obj.data.attributes.get(ATTRIBUTE) or obj.data.attributes.new(ATTRIBUTE, 'FLOAT', 'POINT')
    attr.data.foreach_set('value', values.astype(np.float32))


def transfer_regions(regions, body_co, obj):
    """Nearest full-resolution vertex region for a decimated or edited body copy."""
    tree = KDTree(len(body_co))
    for i, c in enumerate(body_co):
        tree.insert(c, i)
    tree.balance()
    values = np.array([regions[tree.find(v.co)[1]] for v in obj.data.vertices])
    write_attribute(obj, values)
    return values
