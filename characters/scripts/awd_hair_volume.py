"""Accra We Dey character pipeline, stage D: volume, strand and wig hairstyles.

Every style starts from a scalp cap (a short shell from awd_hair.py) so no scalp
shows through, then adds its own geometry in the same mesh and material:

* afro, puff, bun, duku: offset spheres shaped by the hairline;
* twists, locs, braids: tapered tubes grown from roots on the cap, bent by
  gravity and pushed out of the head and body (rest pose);
* bob, bonestraight: lofted wig sheets with a face opening.

Hair near the head follows `Head`; anything below the neck blends to `Spine2`
so long hair rides the torso instead of swinging through the shoulders.
Requires awd_hair.py, awd_face.py, awd_textures.py and awd_morphs.py in the
same namespace.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

DOWN = np.array([0.0, 0.0, -1.0])

# style: (cap shell, texture kind, tint source)
VOLUME_STYLES = {
    'afro': ('twa', 'coily', 'hair'),
    'puff': ('lowcut', 'coily', 'hair'),
    'bun': ('lowcut', 'coily', 'hair'),
    'twists': ('lowcut', 'twist', 'hair'),
    'locs': ('lowcut', 'loc', 'hair'),
    'braids': ('lowcut', 'braid', 'hair'),
    'bob': ('lowcut', 'straight', 'hair'),
    'bonestraight': ('lowcut', 'straight', 'hair'),
    'duku': ('lowcut', 'ankara', 'hat'),
}
STRANDS = {
    # style: (count, length range m, radius m, segments, sides, droop, min root spacing m)
    'twists': (75, (0.035, 0.060), 0.0062, 4, 5, 0.32, 0.018),
    'locs': (60, (0.15, 0.22), 0.0068, 6, 5, 0.62, 0.020),
    'braids': (72, (0.30, 0.40), 0.0050, 7, 4, 0.66, 0.017),
}


class Head:
    """Ellipsoid fit of the rest-pose head plus the scalp frame from awd_hair."""

    def __init__(self, ctx):
        body, J = ctx['body'], ctx['joints']
        self.F = head_frame(ctx)
        co = np.array([v.co[:] for v in body.data.vertices])
        head = _group_sum(body, ('Head',)) > 0.5
        sel = co[head & (co[:, 2] > self.F['eye'][2] - 0.02) & ~is_ear(co, self.F)]
        lo, hi = sel.min(axis=0), sel.max(axis=0)
        self.c = (lo + hi) / 2
        self.r = (hi - lo) / 2
        self.neck_z = J['neck01____head'][2]
        self.eye = self.F['eye']
        self.bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())

    def surface(self, d):
        d = d / np.linalg.norm(d)
        return self.c + d / math.sqrt(float(np.sum((d / self.r) ** 2)))

    def above_hairline(self, p):
        return float(p[2] - hairline(p, self.F))

    def push_out(self, p, margin):
        q = (p - self.c) / (self.r + margin)
        n = np.linalg.norm(q)
        if n < 1.0:
            p = self.c + (p - self.c) / max(n, 1e-6)
        hit = self.bvh.find_nearest(Vector(p))
        if hit[0] is not None:
            loc, normal = np.array(hit[0][:]), np.array(hit[1][:])
            if np.dot(p - loc, normal) < margin:
                p = loc + normal * margin
        # keep the face clear: nothing hangs in front of the eyes and mouth
        if p[1] < self.eye[1] + 0.02 and abs(p[0]) < 0.075 and p[2] < self.eye[2] + 0.03:
            p = p.copy()
            p[0] = math.copysign(0.075, p[0] if p[0] else 1.0)
        return p


class MeshWriter:
    """Adds weighted, UV-mapped geometry to an existing hair object's bmesh."""

    def __init__(self, obj, head):
        self.obj, self.head = obj, head
        self.bm = bmesh.new()
        self.bm.from_mesh(obj.data)
        self.deform = self.bm.verts.layers.deform.verify()
        self.uv = self.bm.loops.layers.uv.active or self.bm.loops.layers.uv.new('UVMap')
        groups = {g.name: g.index for g in obj.vertex_groups}
        self.head_g, self.spine_g = groups['Head'], groups['Spine2']

    def vert(self, p):
        v = self.bm.verts.new(Vector(p))
        w = float(np.clip((p[2] - (self.head.neck_z - 0.12)) / 0.15, 0, 1))
        v[self.deform][self.head_g] = w
        if w < 1:
            v[self.deform][self.spine_g] = 1 - w
        return v

    def face(self, verts, uvs):
        f = self.bm.faces.new(verts)
        for loop, uv in zip(f.loops, uvs):
            loop[self.uv].uv = uv
        f.smooth = True
        return f

    def finish(self):
        self.bm.normal_update()
        self.bm.to_mesh(self.obj.data)
        self.bm.free()


def grid_surface(W, rows, cols, point, keep, u_scale=4.0, v_scale=6.0):
    """rows x cols lat-long grid; point(i, j) -> xyz; keep(face centre) filters faces."""
    verts = [[None] * (cols + 1) for _ in range(rows + 1)]
    for i in range(rows + 1):
        for j in range(cols + 1):
            verts[i][j] = W.vert(point(i, j)) if j < cols else verts[i][0]
    for i in range(rows):
        for j in range(cols):
            quad = [verts[i][j], verts[i][j + 1], verts[i + 1][j + 1], verts[i + 1][j]]
            centre = sum((np.array(v.co[:]) for v in quad), np.zeros(3)) / 4
            if keep(centre):
                u0, u1, v0, v1 = j / cols * u_scale, (j + 1) / cols * u_scale, i / rows * v_scale, (i + 1) / rows * v_scale
                W.face(quad, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    return verts


def dome(W, head, centre, radii, offset, keep, rows=18, cols=32, noise=0.0, seed=3):
    """Closed-pole sphere volume; offset(d, base) adds thickness along each direction."""
    rng = np.random.default_rng(seed)
    bumps = rng.normal(size=(rows + 1, cols)) * noise
    top = W.vert(centre + np.array([0, 0, radii[2]]) * 1.0 + np.array([0, 0, offset(np.array([0, 0, 1.0]), centre)]))

    def point(i, j):
        theta = math.pi * (i + 1) / (rows + 2)
        phi = 2 * math.pi * j / cols
        d = np.array([math.sin(theta) * math.sin(phi), -math.sin(theta) * math.cos(phi), math.cos(theta)])
        base = centre + d * radii
        return base + d * (offset(d, base) + bumps[i, j % cols])
    verts = grid_surface(W, rows, cols, point, keep, u_scale=6, v_scale=3)
    ring = verts[0]
    for j in range(cols):
        centre_face = (np.array(ring[j].co[:]) + np.array(ring[j + 1].co[:])) / 2
        if keep(centre_face):
            W.face([ring[j + 1], ring[j], top], [(0, 0), (0.1, 0), (0.05, 0.05)])


def sample_roots(cap, count, spacing, seed, keep):
    rng = np.random.default_rng(seed)
    faces = [(np.array(p.center[:]), np.array(p.normal[:]), p.area) for p in cap.data.polygons]
    areas = np.array([a for _, _, a in faces])
    roots = []
    for k in rng.choice(len(faces), size=count * 14, p=areas / areas.sum()):
        c, n, _ = faces[k]
        if keep(c) and all(np.linalg.norm(c - r) > spacing for r, _ in roots):
            roots.append((c, n))
        if len(roots) >= count:
            break
    return roots


def tube(W, points, radius, sides, taper=0.3, v_len=0.04):
    """Tapered tube along points (parallel-transport frames) with a closed tip."""
    pts = [np.array(p) for p in points]
    t = pts[1] - pts[0]
    t /= np.linalg.norm(t)
    ref = np.array([0.0, 0.0, 1.0]) if abs(t[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    nrm = np.cross(t, ref)
    nrm /= np.linalg.norm(nrm)
    lengths = [0.0] + list(np.cumsum([np.linalg.norm(b - a) for a, b in zip(pts, pts[1:])]))
    total = max(lengths[-1], 1e-6)
    rings = []
    for k, p in enumerate(pts):
        t_new = pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]
        t_new /= max(np.linalg.norm(t_new), 1e-9)
        nrm = nrm - t_new * np.dot(nrm, t_new)
        nrm /= max(np.linalg.norm(nrm), 1e-9)
        side = np.cross(t_new, nrm)
        r = radius * (1 - taper * (lengths[k] / total) ** 2)
        ring = [W.vert(p + (nrm * math.cos(2 * math.pi * s / sides) + side * math.sin(2 * math.pi * s / sides)) * r)
                for s in range(sides)]
        rings.append((ring, lengths[k] / v_len))
    for (a, va), (b, vb) in zip(rings, rings[1:]):
        for s in range(sides):
            W.face([a[s], a[(s + 1) % sides], b[(s + 1) % sides], b[s]],
                   [(s / sides, va), ((s + 1) / sides, va), ((s + 1) / sides, vb), (s / sides, vb)])
    end = pts[-1] - pts[-2]
    tip = W.vert(pts[-1] + end / max(np.linalg.norm(end), 1e-9) * radius * 0.6)
    last, vl = rings[-1]
    for s in range(sides):
        W.face([last[s], last[(s + 1) % sides], tip], [(s / sides, vl), ((s + 1) / sides, vl), (0.5, vl + 0.1)])


def grow(head, root, normal, length, segments, droop, margin):
    p, d = np.array(root), np.array(normal)
    back = np.array([0.0, 1.0, 0.0])
    pts = [p.copy()]
    for _ in range(segments):
        d = d * (1 - droop) + DOWN * droop + back * 0.08
        d /= np.linalg.norm(d)
        p = head.push_out(p + d * (length / segments), margin)
        pts.append(p.copy())
    return pts


# ---------------------------------------------------------------- builders

def _afro(W, head):
    def offset(d, p):
        h = head.above_hairline(p)
        return 0.006 + 0.052 * float(np.clip((h + 0.005) / 0.05, 0, 1)) ** 0.8 + 0.012 * max(d[2], 0)

    def keep(c):
        return head.above_hairline(head.surface(c - head.c)) > -0.004 and not is_ear(c, head.F)
    dome(W, head, head.c + np.array([0, 0.006, 0.012]), head.r, offset, keep, rows=20, cols=36, noise=0.0025)


def _band(W, centre, radius, thickness, axis='z', sides=6, segments=20):
    pts = []
    for k in range(segments + 1):
        a = 2 * math.pi * k / segments
        ring = np.array([math.cos(a), math.sin(a), 0.0]) if axis == 'z' else np.array([math.cos(a), 0.0, math.sin(a)])
        pts.append(centre + ring * radius)
    tube(W, pts, thickness, sides, taper=0.0, v_len=0.02)


def _puff(W, head):
    top = head.c + np.array([0.0, 0.03, head.r[2] * 0.82])
    dome(W, head, top, np.array([0.072, 0.068, 0.062]), lambda d, p: 0.0, lambda c: True, rows=14, cols=24, noise=0.002)
    _band(W, top - np.array([0, 0.0, 0.045]), 0.05, 0.008)


def _bun(W, head):
    back = head.c + np.array([0.0, head.r[1] * 0.95 + 0.01, head.r[2] * 0.45])
    dome(W, head, back, np.array([0.046, 0.042, 0.044]), lambda d, p: 0.0, lambda c: True, rows=12, cols=20, noise=0.0015)
    _band(W, back - np.array([0, 0.03, 0.0]), 0.032, 0.006, axis='y')


def _strands(W, head, cap, style):
    count, (l0, l1), radius, segments, sides, droop, spacing = STRANDS[style]
    rng = np.random.default_rng(len(style))
    roots = sample_roots(cap, count, spacing, seed=7, keep=lambda p: head.above_hairline(p) > 0.006)
    for root, normal in roots:
        length = l0 + (l1 - l0) * rng.random()
        # Short twists stand slightly proud of the scalp; long strands leave it almost
        # tangentially so gravity lays them along the head instead of fanning out.
        out = normal * (0.45 if style == 'twists' else 0.12) + np.array([0, 0.05, -0.15 if style != 'twists' else 0.05])
        pts = grow(head, root, out / np.linalg.norm(out), length, segments, droop, radius + 0.003)
        tube(W, pts, radius * (0.85 + 0.3 * rng.random()), sides, taper=0.25 if style != 'braids' else 0.45)


def _wig(W, head, style):
    long = style == 'bonestraight'
    z_top = head.c[2] + head.r[2] * 0.93
    z_bot = head.neck_z - (0.20 if long else -0.035)
    rows, cols = (22 if long else 12), 32
    bangs = head.eye[2] + (0.045 if style == 'bob' else 0.06)
    chin = head.eye[2] - 0.08

    def radius_at(z):
        t = float(np.clip((z - head.c[2]) / head.r[2], -0.6, 0.999))
        k = math.sqrt(1 - t * t)
        return head.r[0] * k, head.r[1] * k

    def point(i, j):
        z = z_top + (z_bot - z_top) * (i / rows) ** (1.15 if long else 1.0)
        phi = 2 * math.pi * j / cols
        a, b = radius_at(z)
        flare = 0.010 + 0.022 * (i / rows) if not long else 0.008 + 0.012 * (i / rows)
        p = np.array([head.c[0] + (a + flare) * math.sin(phi), head.c[1] - (b + flare) * math.cos(phi) + 0.004, z])
        if long and z < head.neck_z:
            # Below the neck the hair hangs as a straight panel between the shoulder blades:
            # keep it narrow and only let the back push it backwards, never sideways.
            p[0] = head.c[0] + (p[0] - head.c[0]) * 0.75
            hit = head.bvh.find_nearest(Vector(p))
            if hit[0] is not None:
                p[1] = max(p[1], hit[0][1] + 0.012)
            return p
        return head.push_out(p, 0.008)

    def keep(c):
        phi = math.atan2(c[0] - head.c[0], -(c[1] - head.c[1]))
        if abs(phi) < math.radians(52) and c[2] < bangs:
            return False
        return not (long and c[2] < chin and abs(phi) < math.radians(125))
    ring = grid_surface(W, rows, cols, point, keep, u_scale=5, v_scale=(5 if long else 2))[0]
    crown = W.vert(np.array([head.c[0], head.c[1] + 0.004, z_top + 0.014]))
    for j in range(cols):
        W.face([ring[j + 1], ring[j], crown], [(0, 0), (0.1, 0), (0.05, 0.05)])


def _duku(W, head):
    def offset(d, p):
        return 0.016 + 0.012 * max(d[2], 0) + 0.006 * max(d[1], 0)

    def keep(c):
        return head.above_hairline(head.surface(c - head.c)) > -0.012
    dome(W, head, head.c + np.array([0, 0.004, 0.006]), head.r, offset, keep, rows=16, cols=28)
    top = head.c + np.array([0.0, -0.012, head.r[2] + 0.03])
    for side in (-1, 1, 0):
        centre = top + np.array([side * 0.045, 0.008 * abs(side), -0.01 * abs(side)])
        radii = np.array([0.045, 0.03, 0.03]) if side else np.array([0.035, 0.035, 0.04])
        dome(W, head, centre, radii, lambda d, p: 0.0, lambda c: True, rows=8, cols=14)


BUILDERS = {'afro': _afro, 'puff': _puff, 'bun': _bun, 'duku': _duku}


def build_volume_hair(ctx, G, style):
    cap_style, kind, tint = VOLUME_STYLES[style]
    head = Head(ctx)
    cap = G['build_short_hair'](ctx, G, cap_style)
    cap.name = cap.data.name = f'AWD_Hair_{style}'
    W = MeshWriter(cap, head)
    if style in STRANDS:
        _strands(W, head, cap, style)
    elif style in ('bob', 'bonestraight'):
        _wig(W, head, style)
    else:
        BUILDERS[style](W, head)
    W.finish()
    if kind == 'ankara':
        image, colour = G['ankara_texture'](), (0.20, 0.04, 0.27)   # wardrobe default duku colour #7b2d8e
    elif kind == 'coily':
        image, colour = bpy.data.images.get('awd_hair_coily') or G['_hair_image'](G, 'coily', False), (0.008, 0.006, 0.006)
    else:
        image, colour = G['strand_texture'](kind), (0.008, 0.006, 0.006)
    name = f'AWD_Hair_{style}' if tint == 'hair' else f'AWD_Headwrap_{style}'
    mat = G['_material'](name, colour, 0.8 if kind == 'ankara' else 0.6, image)
    next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE').extension = 'REPEAT'
    cap.data.materials.clear()
    cap.data.materials.append(mat)
    cap['awd_slot'], cap['awd_id'], cap['awd_tint'] = 'hair', style, tint
    return cap
