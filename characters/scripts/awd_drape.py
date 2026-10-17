"""Accra We Dey character pipeline: hull draping for garments (2026-10 rework).

Cloth does not follow anatomy. It rests on the high points of the body and spans everything
in between: the hollow between the pecs or breasts, under the bust, the small of the back,
the dip of the spine, the gap between calf and shin. Shrink-wrapping a shell onto the skin
(even smoothed) shows all of that through the fabric, which read as wet, lumpy clothing.

Here every garment vertex is moved onto the convex hull of the body part under it (torso,
pelvis, upper arm, forearm, thigh-and-shin), along the ray from that part's bone axis, then
blended across parts by the body's own skin weights so shoulders and hips stay continuous.
`loose` sets how far a garment goes from the skin (0) to the hull (1): a tee or jersey hangs
from the chest, a fitted blouse sits between, a bodycon stays near the skin. Requires
awd_clothes.py (rest_bvh, taubin) in the same namespace.
"""
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

# Body part -> (game rig bones whose skin defines it, axis bone head, axis bone tail).
PARTS = {
    'torso': (('Spine', 'Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder', 'LeftBreast', 'RightBreast'),
              'Spine', 'Neck'),
    'pelvis': (('Hips',), 'Hips', 'Spine1'),
    'arm.L': (('LeftArm',), 'LeftArm', 'LeftForeArm'), 'arm.R': (('RightArm',), 'RightArm', 'RightForeArm'),
    'fore.L': (('LeftForeArm',), 'LeftForeArm', 'LeftHand'), 'fore.R': (('RightForeArm',), 'RightForeArm', 'RightHand'),
    'leg.L': (('LeftUpLeg', 'LeftLeg'), 'LeftUpLeg', 'LeftFoot'), 'leg.R': (('RightUpLeg', 'RightLeg'), 'RightUpLeg', 'RightFoot'),
}


def _bone_axis(rig, head, tail):
    bones = rig.data.bones
    a = np.array(bones[head].head_local[:])
    b = np.array(bones[tail].head_local[:]) if tail in bones else np.array(bones[head].tail_local[:])
    return a, b


def _closest_on_segment(p, a, b):
    ab = b - a
    t = np.clip((p - a) @ ab / (ab @ ab), 0.0, 1.0)
    return a + t * ab


class Hulls:
    """Convex hull per body part (rest pose), with membership weights per body vertex."""

    def __init__(self, ctx):
        body, rig = ctx['body'], ctx['rig']
        self.co = np.array([v.co[:] for v in body.data.vertices])
        names = {g.index: g.name for g in body.vertex_groups}
        bone_part = {b: part for part, (bones, _, _) in PARTS.items() for b in bones}
        self.part_names = list(PARTS)
        index = {p: i for i, p in enumerate(self.part_names)}
        w = np.zeros((len(self.co), len(self.part_names)))
        for v in body.data.vertices:
            for ge in v.groups:
                part = bone_part.get(names.get(ge.group))
                if part:
                    w[v.index, index[part]] += ge.weight
        self.weights = w
        dominant = np.argmax(w, axis=1)
        has = w.max(axis=1) > 0.35
        self.axes, self.bvh = {}, {}
        for i, part in enumerate(self.part_names):
            _, head, tail = PARTS[part]
            self.axes[part] = _bone_axis(rig, head, tail)
            pts = self.co[(dominant == i) & has]
            if len(pts) < 12:
                continue
            bm = bmesh.new()
            for p in pts:
                bm.verts.new(Vector(p))
            bmesh.ops.convex_hull(bm, input=bm.verts, use_existing_faces=False)
            for v in [v for v in bm.verts if not v.link_faces]:
                bm.verts.remove(v)
            self.bvh[part] = BVHTree.FromBMesh(bm)
            bm.free()
        self.kd = KDTree(len(self.co))
        for i, c in enumerate(self.co):
            self.kd.insert(c, i)
        self.kd.balance()

    def membership(self, p, k=6):
        """Part weights at a point: the skin weights of the nearest body vertices."""
        acc = np.zeros(len(self.part_names))
        for _, i, d in self.kd.find_n(Vector(p), k):
            acc += self.weights[i] / max(d, 1e-4)
        total = acc.sum()
        return acc / total if total > 0 else acc

    def hull_point(self, part, p):
        """Where the ray from the part's axis through p leaves that part's hull (or None)."""
        bvh = self.bvh.get(part)
        if bvh is None:
            return None
        a, b = self.axes[part]
        c = _closest_on_segment(p, a, b)
        d = p - c
        n = np.linalg.norm(d)
        if n < 1e-6:
            return None
        d /= n
        hit = bvh.ray_cast(Vector(c + d * 0.6), Vector(-d), 0.6)
        return None if hit[0] is None else np.array(hit[0][:])


def hull_drape(bm, ctx, loose=1.0, ease=0.004, parts=None, smooth=6, hulls=None, keep=None):
    """Move garment vertices out onto the part hulls (outwards only), blended by membership.

    parts: restrict to these hull parts (others keep the skin shape); keep(p) -> weight in
    [0, 1] to hold some vertices back (necklines and hems stay on the body)."""
    hulls = hulls or Hulls(ctx)
    allowed = set(parts or hulls.part_names)
    targets = []
    for v in bm.verts:
        p = np.array(v.co[:])
        m = hulls.membership(p)
        acc, total = np.zeros(3), 0.0
        for i, part in enumerate(hulls.part_names):
            if m[i] < 0.05 or part not in allowed:
                continue
            h = hulls.hull_point(part, p)
            if h is None:
                continue
            a, b = hulls.axes[part]
            c = _closest_on_segment(p, a, b)
            out = (p - c) / max(np.linalg.norm(p - c), 1e-6)
            # Outwards only: a vertex already outside the hull keeps its place.
            lift = max(0.0, (h - c) @ out - (p - c) @ out) + ease
            acc += m[i] * (p + out * lift * loose)
            total += m[i]
        target = acc / total if total > 0 else p
        if keep is not None:
            target = p + (target - p) * (1.0 - keep(p))
        targets.append(target)
    for v, t in zip(bm.verts, targets):
        v.co = Vector(t)
    if smooth:
        boundary = np.array([v.is_boundary for v in bm.verts], dtype=float)
        taubin(bm, smooth, 1.0 - 0.7 * boundary)
    return hulls


def _hulls(ctx):
    """Hulls for this body, built once per build session."""
    if '_hulls' not in ctx:
        ctx['_hulls'] = Hulls(ctx)
    return ctx['_hulls']
