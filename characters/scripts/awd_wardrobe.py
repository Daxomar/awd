"""Accra We Dey character pipeline, stage E: the wardrobe (tops, bottoms, full outfits).

Each catalogue id (server/src/game/wardrobe.js WEAR) is a recipe. Upper and
fitted garments are shells from awd_clothes.shell(); anything that hangs free
of the legs (skirts, dresses, kaftan and fugu tails, peplums, jacket skirts) is
a loft of elliptical rings whose weights blend from `Hips` to the nearest leg,
so legs stay inside while walking. Details (folded collars, hood, tie, chest
patches, tricolour trim) are added in the same mesh. `hides` lists the body
regions (awd_regions) a garment covers completely, for runtime skin culling.
Requires awd_clothes.py, awd_regions.py, awd_textures.py and awd_face.py.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

UPPER = ('chest', 'belly', 'upperarm')
LONG_SLEEVE = ('chest', 'belly', 'upperarm', 'elbow', 'forearm')
LEGS = ('pelvis', 'thigh', 'knee', 'shin')

# id: sleeve, collar, hem, extra ease, fabric, default colour, extras, hidden regions
TOPS = {
    'tee': ('short', 'crew', 'normal', 0.0, 'jersey', '#f4f4f2', (), UPPER),
    'flagtee': ('short', 'crew', 'normal', 0.0, 'jersey', '#17150f', ('flag',), UPPER),
    'singlet': ('none', 'scoop', 'normal', -0.002, 'jersey', '#f4f4f2', (), ('belly',)),
    'crop': ('short', 'scoop', 'crop', -0.002, 'jersey', '#f4f4f2', (), ('chest',)),
    'polo': ('short', 'collar', 'normal', 0.002, 'pique', '#f4f4f2', (), UPPER),
    'hoodie': ('long', 'crew', 'normal', 0.008, 'fleece', '#f4f4f2', ('hood',), LONG_SLEEVE),
    'jersey': ('short', 'v', 'normal', 0.003, 'mesh', '#f4f4f2', ('trim', 'star'), UPPER),
    'jerseyaway': ('short', 'v', 'normal', 0.003, 'mesh', '#f2b632', ('trim', 'star'), UPPER),
    'ankara': ('short', 'collar', 'normal', 0.004, 'ankara', '#e76f51', (), UPPER),
    'kenteshirt': ('short', 'collar', 'normal', 0.004, 'kente', '#f2b632', (), UPPER),
    'fugu': ('wide', 'v', 'tunic', 0.014, 'fugu', '#1f3f8f', (), UPPER),
    'office': ('long', 'collar', 'normal', 0.002, 'cotton', '#f4f4f2', ('tie',), LONG_SLEEVE),
    'kaftan': ('long', 'v', 'kaftan', 0.010, 'cotton', '#c2a878', (), LONG_SLEEVE),
    'suit': ('long', 'jacket', 'jacket', 0.012, 'twill', '#1d2433', ('shirt',), LONG_SLEEVE),
    'kaba': ('puff', 'scoop', 'peplum', 0.002, 'ankara', '#e76f51', (), UPPER),
    'blouse': ('short', 'collar', 'normal', 0.003, 'cotton', '#f4f4f2', (), UPPER),
}
# id: kind, hem, ease or flare, fabric, colour, hidden regions (skirts use the loft)
BOTTOMS = {
    'jeans': ('pants', 'ankle', 0.0, 'denim', '#2b3a55', LEGS),
    'shorts': ('pants', 'shorts', 0.004, 'twill', '#2b3a55', ('pelvis', 'thigh')),
    'joggers': ('pants', 'jogger', 0.004, 'fleece', '#17150f', LEGS),
    'chinos': ('pants', 'ankle', 0.001, 'twill', '#c2a878', LEGS),
    'suitpants': ('pants', 'ankle', 0.002, 'twill', '#1d2433', LEGS),
    'ankarapants': ('pants', 'ankle', 0.003, 'ankara', '#e76f51', LEGS),
    'slit': ('skirt', 'long', 0.04, 'ankara', '#e76f51', ('pelvis', 'thigh')),
    'mini': ('skirt', 'mini', 0.03, 'twill', '#f4f4f2', ('pelvis',)),
    'pencil': ('skirt', 'knee', -0.005, 'twill', '#17150f', ('pelvis', 'thigh')),
    'kenteskirt': ('skirt', 'long', 0.05, 'kente', '#f2b632', LEGS),
}
# id: (sleeve, collar), skirt hem, flare, fabric, colour, hidden regions
FULL = {
    'sundress': (('none', 'scoop'), 'knee', 0.10, 'cotton', '#f4f4f2', ('belly', 'pelvis', 'thigh')),
    'ankaradress': (('short', 'crew'), 'knee', 0.12, 'ankara', '#e76f51', ('chest', 'belly', 'upperarm', 'pelvis', 'thigh')),
    'kentedress': (('none', 'scoop'), 'long', 0.06, 'kente', '#f2b632', ('belly', 'pelvis', 'thigh', 'knee', 'shin')),
    'bodycon': (('none', 'scoop'), 'knee', -0.005, 'jersey', '#17150f', ('belly', 'pelvis', 'thigh')),
    'kentecloth': (('none', 'toga'), 'long', 0.12, 'kente', '#f2b632', ('belly', 'pelvis', 'thigh', 'knee', 'shin')),
}
# Trouser cut: 1 is a loose, baggy leg; lower is straighter. Female cuts are a little slimmer.
BAGGY = {'jeans': 1.0, 'ankarapants': 1.0, 'joggers': 0.9, 'shorts': 1.0, 'chinos': 0.8, 'suitpants': 0.6}
# Regions of the trousers underneath that a top's tail covers completely (see awd-runtime.js).
COVERS = {'kaftan': ('pelvis', 'thigh', 'knee'), 'tunic': ('pelvis',)}   # kaftan hem: 12 cm under the knee
SLEEVE = {'none': None, 'short': 0.48, 'puff': 0.42, 'wide': 0.90, 'long': 1.93}
COLLAR_DIP = {'crew': 0.035, 'v': 0.085, 'scoop': 0.06, 'collar': 0.03, 'jacket': 0.20, 'toga': 0.06}


def srgb(hex_colour):
    c = np.array([int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    return tuple(np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4))


def smooth01(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def material(G, kind, colour, item):
    """Per-item fabric material (names start with AWD_Fabric_: tinted by the slot colour)."""
    image = G['ankara_texture']() if kind == 'ankara' else (
        bpy.data.images.get(f'awd_fabric_{kind}') or G['fabric_texture'](kind))
    mat = G['_material'](f'AWD_Fabric_{kind}_{item}', srgb(colour), 0.6 if kind == 'mesh' else 0.85, image)
    next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE').extension = 'REPEAT'
    return mat


def print_material(G, kind, roughness=0.6):
    """Fixed artwork; names start with AWD_Print_ so the runtime never tints them."""
    image = bpy.data.images.get(f'awd_print_{kind}') or G['print_texture'](kind)
    return G['_material'](f'AWD_Print_{kind}', (1.0, 1.0, 1.0), roughness, image)


class Writer:
    """Adds geometry to a garment; weights default to the nearest body vertices."""

    def __init__(self, ctx, obj):
        self.obj = obj
        body = ctx['body']
        body_co = np.array([v.co[:] for v in body.data.vertices])
        self.tree = KDTree(len(body_co))
        for i, c in enumerate(body_co):
            self.tree.insert(c, i)
        self.tree.balance()
        names = {g.index: g.name for g in body.vertex_groups}
        self.body_w = [{names[ge.group]: ge.weight for ge in v.groups} for v in body.data.vertices]
        self.groups = {g.name: g.index for g in obj.vertex_groups}
        self.bm = bmesh.new()
        self.bm.from_mesh(obj.data)
        self.deform = self.bm.verts.layers.deform.verify()
        self.uv = self.bm.loops.layers.uv.active or self.bm.loops.layers.uv.new('UVMap')

    def vert(self, p, weights=None):
        v = self.bm.verts.new(Vector(p))
        if weights is None:
            weights = {}
            for _, i, d in self.tree.find_n(Vector(p), 3):
                for name, w in self.body_w[i].items():
                    weights[name] = weights.get(name, 0.0) + w / max(d, 1e-4)
        total = sum(weights.values()) or 1.0
        for name, w in sorted(weights.items(), key=lambda kv: -kv[1])[:4]:
            if name not in self.groups:
                self.groups[name] = self.obj.vertex_groups.new(name=name).index
            v[self.deform][self.groups[name]] = w / total
        return v

    def face(self, verts, uvs, material_index=0):
        f = self.bm.faces.new(verts)
        f.material_index = material_index
        f.smooth = True
        for loop, uv in zip(f.loops, uvs):
            loop[self.uv].uv = uv
        return f

    def quad_strip(self, rows, material_index=0, v_scale=8.0):
        for k, ((a0, a1), (b0, b1)) in enumerate(zip(rows, rows[1:])):
            self.face([a0, a1, b1, b0], [(0, k / v_scale), (1, k / v_scale), (1, (k + 1) / v_scale), (0, (k + 1) / v_scale)],
                      material_index)

    def finish(self):
        self.bm.normal_update()
        self.bm.to_mesh(self.obj.data)
        self.bm.free()


def material_slot(obj, mat):
    names = [m.name for m in obj.data.materials]
    if mat.name not in names:
        obj.data.materials.append(mat)
        names.append(mat.name)
    return names.index(mat.name)


def section(body_co, z, band=0.012):
    """Half-widths and centre of the lower body (both legs together) at height z."""
    sel = body_co[:0]
    while len(sel) < 8:   # the shin is coarse: widen the band until it holds vertices
        sel = body_co[(np.abs(body_co[:, 2] - z) < band) & (np.abs(body_co[:, 0]) < 0.30)]
        band *= 1.6
    sel = sel[np.abs(sel[:, 0]) <= np.percentile(np.abs(sel[:, 0]), 96) + 1e-6]
    return np.abs(sel[:, 0]).max(), (sel[:, 1].max() - sel[:, 1].min()) / 2, (sel[:, 1].min() + sel[:, 1].max()) / 2


def skirt(ctx, W, top_z, hem_z, ease, flare, follow=0.6, rings=9, seg=28, slit=None, a_line=True, mat=0, gap=0.006,
          cover=None, clear=None, rise=0.5, tuck=0.0, flush_z=None, room=0.014):
    """Lofted skirt or tunic tail from top_z to hem_z, added into W.

    Each ring is a radius per direction around its centre: an ellipse around the body section
    plus ease and flare, never narrower than `cover` (the shirt hem the tail hangs from) and
    always enclosing `clear(z)`, circles (x, y, r) such as the trouser legs worn underneath. A
    ring may not be more than `rise` metres per metre narrower than the ring below it, so
    the cloth flares out gradually instead of stepping over the legs; a_line also keeps each
    ring at least as wide as the one above. gap is the least distance from the body.
    tuck pulls the top ring in so it hides under the shirt hem it starts inside; a ring at
    flush_z (just under that hem) then brings the tail out level with the shirt.
    Returns radius(angle) of the top ring and its centre y, for blending the shirt into it."""
    J = ctx['joints']
    knee_z = J['lowerleg01.L____head'][2]
    hips = {side: (np.array(J[f'upperleg01.{s}____head']), np.array(J[f'foot.{s}____head'])) for side, s in (('Left', 'L'), ('Right', 'R'))}
    body_co = np.array([v.co[:] for v in ctx['body'].data.vertices])
    bvh = rest_bvh(ctx['body'])   # awd_clothes
    angles = np.array([2 * math.pi * j / seg for j in range(seg)])
    dirs = np.column_stack((np.sin(angles), -np.cos(angles)))   # 0 = front
    if cover is not None:
        ca, cb = np.abs(cover[:, 0]).max(), (cover[:, 1].max() - cover[:, 1].min()) / 2
    zs, centres, radii = [], [], []
    for i in range(rings + 1):
        t = i / rings
        z = top_z + (hem_z - top_z) * t
        a, b, cy = section(body_co, z)
        a, b = a + ease + flare * t ** 1.3, b * 0.92 + ease + flare * 0.8 * t ** 1.3
        if cover is not None:
            a, b = max(a, ca + 0.004), max(b, cb + 0.004)
        r = a * b / np.hypot(b * dirs[:, 0], a * dirs[:, 1])
        for x, y, rad in (clear(z) if clear else []):   # support of each leg circle per direction
            r = np.maximum(r, dirs @ np.array([x, y - cy]) + rad + room)   # room for the thighs to swing
        zs.append(z)
        centres.append(cy)
        radii.append(r)
    for i in range(rings - 1, -1, -1):   # flare up from the widest ring instead of stepping out
        radii[i] = np.maximum(radii[i], radii[i + 1] - rise * (zs[i] - zs[i + 1]))
    if a_line:
        for i in range(1, rings + 1):
            radii[i] = np.maximum(radii[i], radii[i - 1])
    top = np.append(radii[0], radii[0][0])
    if tuck and flush_z is not None and flush_z > zs[1]:   # emerge flush just under the shirt hem
        zs.insert(1, flush_z)
        centres.insert(1, centres[0])
        radii.insert(1, radii[0] + 0.001)
    radii[0] = radii[0] - tuck
    rows = []
    for z, cy, r in zip(zs, centres, radii):
        t = (top_z - z) / (top_z - hem_z)
        ring = []
        for (dx, dy), rad in zip(dirs, r):
            p = np.array([dx * rad, cy + dy * rad, z])
            hit = bvh.find_nearest(Vector(p))
            if hit[0] is not None and np.dot(p - np.array(hit[0][:]), np.array(hit[1][:])) < gap:
                p = np.array(hit[0][:]) + np.array(hit[1][:]) * gap
            ring.append(W.vert(p, tail_weights(p, z, top_z, knee_z, hips, follow)))
        rows.append((ring, z))
    for (r0, z0), (r1, z1) in zip(rows, rows[1:]):
        for j in range(seg):
            ang = 2 * math.pi * (j + 0.5) / seg
            if slit and math.sin(ang) > 0.55 and math.cos(ang) > -0.2 and z1 < slit:
                continue   # side slit on the character's left front
            k = (j + 1) % seg
            u0, u1 = j / seg * 4, (j + 1) / seg * 4
            W.face([r0[j], r1[j], r1[k], r0[k]], [(u0, z0 / 0.22), (u0, z1 / 0.22), (u1, z1 / 0.22), (u1, z0 / 0.22)], mat)

    def radius(angle):
        return float(np.interp(angle % (2 * math.pi), np.append(angles, 2 * math.pi), top))
    return radius, centres[0]


def tail_weights(p, z, top_z, knee_z, hips, follow):
    """Skin weights for a hanging tail or skirt vertex: hips at the top, then increasingly
    carried by the legs (each vertex by the legs in proportion to how near it is to each),
    so a striding leg pushes the cloth in front of it instead of walking through it. Below the
    knee part of that follows the shin. follow is the leg share reached 12 cm under the top."""
    lw = follow * smooth01(top_z, top_z - 0.12, z)
    if lw <= 0:
        return {'Hips': 1.0}
    near = {}
    for side, (hip, foot) in hips.items():
        axis = hip + (foot - hip) * (hip[2] - z) / (hip[2] - foot[2])
        near[side] = 1.0 / (float(np.sum((p[:2] - axis[:2]) ** 2)) + 0.0004) ** 3   # sharp: in front of a leg = that leg
    total = sum(near.values())
    shin = 0.35 * smooth01(knee_z, knee_z - 0.15, z)
    weights = {'Hips': 1 - lw}
    for side, w in near.items():
        weights[f'{side}UpLeg'] = lw * w / total * (1 - shin)
        if shin:
            weights[f'{side}Leg'] = lw * w / total * shin
    return weights


def flare_into(verts, ring, hem_z, height=0.16):
    """Widen a shirt's lower torso smoothly into a tail's top ring, so a tunic or kaftan reads
    as one cloth flaring from the waist instead of a shirt with a drum-shaped skirt under it."""
    radius, cy = ring
    for v in verts:
        x, y, z = v.co
        if abs(x) > 0.24 or z > hem_z + height:
            continue
        d = np.array([x, y - cy])
        r = float(np.linalg.norm(d))
        if r < 1e-6:
            continue
        u = d / r
        edge = radius(math.atan2(u[0], -u[1]))
        w = float(smooth01(hem_z + height, hem_z, z))
        fold = 0.004 if v.is_boundary else 0.0   # the turned-back hem stays inside the cloth
        target = r + (edge - fold - r) * w
        if target > r:
            v.co.x, v.co.y = u[0] * target, cy + u[1] * target


def surface_points(bvh, xs, zs, offset, front=True):
    """Points on the front (or back) of the body at the given x/z, pushed out by offset."""
    pts = []
    for x, z in zip(xs, zs):
        hit = bvh.ray_cast(Vector((x, -0.5 if front else 0.5, z)), Vector((0, 1 if front else -1, 0)), 1.0)
        if hit[0] is not None:
            pts.append(np.array(hit[0][:]) + np.array(hit[1][:]) * offset)
    return pts


def outer_points(layers, xs, zs):
    """Front points on the outermost of several (bvh, offset) layers, e.g. the body and the
    garment, so details sit on the cloth where it bridges away from the body."""
    pts = []
    for x, z in zip(xs, zs):
        hits = [p for bvh, offset in layers for p in surface_points(bvh, [x], [z], offset)]
        if hits:
            pts.append(min(hits, key=lambda p: p[1]))
    return pts


def collar_band(ctx, W, collar_z, height=0.022, fold=0.026, gap=0.006):
    """Folded shirt collar: stands up from the neckline, turns down, open at the front.

    The stand sits gap outside the neck, measured by casting out from the neck axis, so
    it follows the actual neck instead of a fixed ring that a thicker neck swallows."""
    neck = np.array(ctx['joints']['neck01____head'])
    bvh = rest_bvh(ctx['body'])   # awd_clothes
    pts = []
    for j in range(24):
        ang = 2 * math.pi * j / 24
        out = np.array([math.sin(ang), -math.cos(ang), 0.0])
        p = neck + out * np.array([0.064, 0.060, 0.0])
        p[2] = collar_z(p) + 0.004
        centre = np.array([neck[0], neck[1], p[2]])
        hit = bvh.ray_cast(Vector(centre), Vector(out), 0.2)   # from inside: first hit is the neck
        if hit[0] is not None:
            p = np.array(hit[0][:]) + out * gap
            p[2] = collar_z(p) + 0.004
        pts.append(p)
    ring = []
    for p in pts:
        out = (p - neck) * np.array([1, 1, 0])
        out /= np.linalg.norm(out)
        ring.append((W.vert(p), W.vert(p + np.array([0, 0, height])), W.vert(p + out * 0.018 + np.array([0, 0, height - fold]))))
    for j in range(24):
        if abs(pts[j][0]) < 0.014 and pts[j][1] < neck[1]:
            continue
        a, b = ring[j], ring[(j + 1) % 24]
        W.face([a[0], b[0], b[1], a[1]], [(j / 24, 0), ((j + 1) / 24, 0), ((j + 1) / 24, 0.1), (j / 24, 0.1)])
        W.face([a[1], b[1], b[2], a[2]], [(j / 24, 0.1), ((j + 1) / 24, 0.1), ((j + 1) / 24, 0.2), (j / 24, 0.2)])


def neckline_test(collar_z, keep=None):
    """Is a shell vertex on the open neckline edge (not a cuff, hem or armhole)?"""
    keep = keep or (lambda p: True)   # e.g. leave a sleeveless armhole's edge alone

    def on_neckline(v):
        p = np.array(v.co[:])
        return v.is_boundary and abs(p[0]) < 0.16 and abs(p[2] - collar_z(p)) < 0.012 and keep(p)
    return on_neckline


def neckline(ctx, obj, on_neckline, n=72):
    """The shell's neckline as a smooth closed curve around the neck axis: angles theta
    (0 at the front, out = (sin, -cos)), horizontal radius r and height z per angle."""
    neck = np.array(ctx['joints']['neck01____head'])
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    edge = [np.array(v.co[:]) for v in bm.verts if on_neckline(v)]
    bm.free()
    if len(edge) < 8:
        return None
    rel = np.array(edge)[:, :2] - neck[:2]
    ang = np.arctan2(rel[:, 0], -rel[:, 1])
    order = np.argsort(ang)
    ang, rad, zs = ang[order], np.linalg.norm(rel, axis=1)[order], np.array(edge)[order, 2]
    theta = np.linspace(-math.pi, math.pi, n, endpoint=False)
    r = np.interp(theta, ang, rad, period=2 * math.pi)
    z = np.interp(theta, ang, zs, period=2 * math.pi)
    r = sum(np.roll(r, k) for k in range(-2, 3)) / 5
    z = sum(np.roll(z, k) for k in range(-1, 2)) / 3
    return theta, r, z


def neckband(ctx, W, obj, collar_z, width=0.011, mat=0, n=72, keep=None):
    """A finished band over the neckline of crew, V and scoop necks.

    The raw shell edge follows body topology and reads as torn; real tops have a rib or
    facing there. Samples the shell's neckline around the neck axis, smooths it, and lays a
    band with a rolled lip on the cloth just below it."""
    neck = np.array(ctx['joints']['neck01____head'])
    on_neckline = neckline_test(collar_z, keep)
    line = neckline(ctx, obj, on_neckline, n)
    if line is None:
        return
    theta, r, z = line
    bvh, skin = rest_bvh(obj), rest_bvh(ctx['body'])   # awd_clothes; the shell before its edge is trimmed
    # Trim the raw edge (and its turned-back rim) under the band so no spike pokes above it.
    rim = {v for v in W.bm.verts if on_neckline(v)}
    rim |= {e.other_vert(v) for v in list(rim) for e in v.link_edges if e.calc_length() < 0.008}
    for v in rim:
        t = math.atan2(v.co.x - neck[0], -(v.co.y - neck[1]))
        v.co.z = min(v.co.z, float(np.interp(t, theta, z, period=2 * math.pi)) - 0.0015)
    up = np.array([0.0, 0.0, 1.0])
    rows = []
    edge = [np.array(bvh.find_nearest(Vector(np.array([neck[0], neck[1], zk])
                                                 + np.array([math.sin(t), -math.cos(t), 0.0]) * rk))[0][:])
            for t, rk, zk in zip(theta, r, z)]
    for k, loc in enumerate(edge):
        out = np.array([loc[0] - neck[0], loc[1] - neck[1], 0.0])
        out /= max(np.linalg.norm(out), 1e-9)
        nrm = np.array(skin.find_nearest(Vector(loc))[1][:])   # body normals stay smooth on narrow straps
        # Step away from the edge along the cloth (across the curve, within the surface): on a
        # flat strap top, dropping straight down landed on the wrong side and crimped the band.
        across = np.cross(nrm, edge[(k + 1) % n] - edge[k - 1])
        across /= max(np.linalg.norm(across), 1e-9)
        if across @ (out - up) < 0:
            across = -across
        low = np.array(bvh.find_nearest(Vector(loc + across * width))[0][:])
        low_n = np.array(skin.find_nearest(Vector(low))[1][:])
        rows.append((W.vert(loc - nrm * 0.002 + up * 0.002), W.vert(loc + nrm * 0.0028 + up * 0.002),
                     W.vert(np.array(low[:]) + low_n * 0.0028)))
    for k in range(n):
        a, b = rows[k], rows[(k + 1) % n]
        u0, u1 = k / n * 12, (k + 1) / n * 12
        W.face([a[0], b[0], b[1], a[1]], [(u0, 0), (u1, 0), (u1, 0.02), (u0, 0.02)], mat)
        W.face([a[1], b[1], b[2], a[2]], [(u0, 0.02), (u1, 0.02), (u1, 0.07), (u0, 0.07)], mat)


def chest_patch(W, layers, centre, size, mat):
    """A print laid on the garment front, e.g. the flag or a star badge."""
    xs = np.linspace(centre[0] - size[0] / 2, centre[0] + size[0] / 2, 5)
    zs = np.linspace(centre[1] - size[1] / 2, centre[1] + size[1] / 2, 5)
    verts = [[W.vert(outer_points(layers, [x], [z])[0]) for x in xs] for z in zs]
    for i in range(4):
        for j in range(4):
            W.face([verts[i][j], verts[i][j + 1], verts[i + 1][j + 1], verts[i + 1][j]],
                   [(j / 4, i / 4), ((j + 1) / 4, i / 4), ((j + 1) / 4, (i + 1) / 4), (j / 4, (i + 1) / 4)], mat)


def hood(ctx, W, obj, collar_z, rows=9, cols=18):
    """A hood lying folded on the upper back, sewn to the back half of the neckline.

    A closed pouch: an inner layer resting on the garment and an outer layer that rises a
    little above the neckline, then falls about 20 cm down the back, narrowing to a fold."""
    neck = np.array(ctx['joints']['neck01____head'])
    line = neckline(ctx, obj, neckline_test(collar_z), 72)
    if line is None:
        return
    theta, _, z = line
    cloth, body = rest_bvh(obj), rest_bvh(ctx['body'])   # awd_clothes

    def surface(t, height):
        out = np.array([math.sin(t), -math.cos(t), 0.0])
        centre = np.array([neck[0], neck[1], height])
        for bvh, gap in ((cloth, 0.003), (body, 0.014)):   # above the neckline only the body is there
            hit = bvh.ray_cast(Vector(centre), Vector(out), 0.3)
            if hit[0] is not None:
                return np.array(hit[0][:]) + out * gap, out
        return centre + out * 0.09, out
    layers = []
    for depth in (0.0, 1.0):   # inner, outer
        grid = []
        for i in range(rows + 1):
            s = i / rows
            row = []
            for j in range(cols + 1):
                t0 = math.pi * (0.56 + 0.88 * j / cols)
                t = math.pi + (t0 - math.pi) * (1 - 0.55 * s)
                u = (t0 - math.pi) / (0.44 * math.pi)   # -1 .. 1 across the hood
                drop = 0.21 * s * s * (0.55 + 0.45 * math.cos(u * math.pi / 2))   # U-shaped fold
                base_z = float(np.interp(t0, theta, z, period=2 * math.pi))
                p, out = surface(t, base_z + 0.05 * math.sin(math.pi * s) - drop)
                puff = (0.004 + 0.06 * math.sin(math.pi * s) ** 0.7 * (1 - 0.45 * s)) * (0.6 + 0.4 * math.cos(u * math.pi / 2))
                row.append(W.vert(p + out * depth * puff))
            grid.append(row)
        layers.append(grid)
    inner, outer = layers
    for i in range(rows):
        for j in range(cols):
            uv = [(j / cols, i / rows), ((j + 1) / cols, i / rows), ((j + 1) / cols, (i + 1) / rows), (j / cols, (i + 1) / rows)]
            W.face([outer[i][j], outer[i][j + 1], outer[i + 1][j + 1], outer[i + 1][j]], uv)
            W.face([inner[i][j], inner[i + 1][j], inner[i + 1][j + 1], inner[i][j + 1]], uv)
    for i in range(rows):   # close the sides and the fold
        for j, flip in ((0, False), (cols, True)):
            quad = [inner[i][j], inner[i + 1][j], outer[i + 1][j], outer[i][j]]
            W.face(quad[::-1] if flip else quad, [(0, i / rows), (0, (i + 1) / rows), (0.05, (i + 1) / rows), (0.05, i / rows)])
    for j in range(cols):
        W.face([inner[rows][j], inner[rows][j + 1], outer[rows][j + 1], outer[rows][j]],
               [(j / cols, 1), ((j + 1) / cols, 1), ((j + 1) / cols, 1.05), (j / cols, 1.05)])


def tie(ctx, W, layers, R, mat):
    top = ctx['joints']['neck01____head'][2] - 0.035
    zs = np.linspace(top, R['waist_z'] + 0.02, 9)
    widths = np.interp(zs, [zs[-1], zs[-1] + 0.05, top - 0.02, top], [0.0, 0.085, 0.045, 0.035])
    pts = outer_points(layers, np.zeros(len(zs)), zs)
    W.quad_strip([(W.vert(p - np.array([w / 2, 0, 0])), W.vert(p + np.array([w / 2, 0, 0]))) for p, w in zip(pts, widths)], mat)


# ---------------------------------------------------------------- recipes

def collar_fn(R, collar):
    dip = COLLAR_DIP[collar]
    width = {'v': 0.035, 'jacket': 0.05, 'scoop': 0.075}.get(collar, 0.05)

    def shape(x):
        return max(0.0, 1 - abs(x) / width) if collar in ('v', 'jacket') else math.exp(-(x / width) ** 2)

    def collar_z(p):
        z = R['neck_z'] - 0.022 - dip * smooth01(R['chest_y'] - 0.01, R['chest_y'] - 0.07, p[1]) * shape(p[0])
        if collar == 'toga':   # one-shoulder drape: the right shoulder is bare
            z -= 0.30 * max(0.0, -p[0] - 0.02)
        return z
    return collar_z


def armhole_fn(J, R):
    """Sleeveless armhole: an ellipse in the side (x, z) plane around each shoulder joint,
    leaving a strap about 5 cm wide over the shoulder. Negative inside the hole."""
    sx, sz = abs(J['upperarm01.L____head'][0]), J['upperarm01.L____head'][2]
    a, b, cz = sx - 0.12, 0.115, sz - 0.025

    def field(p):
        return math.hypot((abs(p[0]) - sx) / a, (p[2] - cz) / b) - 1.0
    return field


def clamp_straps(W, collar_z, armhole):
    """Where a strap's neckline and armhole meet, each edge vertex snapped to one cut only and
    the other left a spike: keep every vertex under the neckline and outside the armhole."""
    for v in W.bm.verts:
        p = np.array(v.co[:])
        p[2] = min(p[2], collar_z(p) - 0.001)
        for _ in range(15):
            if armhole(p) >= 0:
                break
            p[0] -= math.copysign(0.001, p[0])
        v.co = Vector(p)


def build_top(ctx, G, item, sleeve, collar, hem, ease_extra, fabric, colour, extras, hides, name=None):
    R = G['regions'](ctx)
    J = ctx['joints']
    c = R['centre']
    collar_z = collar_fn(R, collar)
    hem_z = R['waist_z'] + 0.05 if hem == 'crop' else R['waist_z'] + 0.01 if hem == 'peplum' else R['hip_z'] - 0.035
    torso = (R['arm'] < 0.5) & (c[:, 2] > hem_z) & np.array([p[2] < collar_z(p) for p in c])
    armhole = armhole_fn(J, R)
    if sleeve == 'none':
        if collar == 'toga':
            torso &= ~((np.abs(c[:, 0]) > 0.10) & (c[:, 2] > R['neck_z'] - 0.20) & (R['arm'] > 0.15))
            sleeves = (R['arm'] >= 0.5) & (R['sleeve'] < 0.35) & (c[:, 0] > 0)
        else:   # a cut armhole leaves a strap over the shoulder instead of torn flaps
            torso &= np.array([armhole(p) > 0 for p in c])
            sleeves = np.zeros(len(c), bool)
    else:
        sleeves = (R['arm'] >= 0.5) & (R['sleeve'] < SLEEVE[sleeve])
    cuts = [G['cut'](lambda p: p[2] - hem_z, True), G['cut'](lambda p: p[2] - collar_z(p), True)]
    if sleeve == 'none' and collar != 'toga':
        cuts.append(G['cut'](armhole))
    if SLEEVE.get(sleeve):
        upper = R['waist_z'] + 0.12
        for s, sign in (('L', 1), ('R', -1)):
            t = G['sleeve_param'](J, s)
            cuts.append(G['cut'](lambda p, t=t, sign=sign: (t(p) - SLEEVE[sleeve]) if p[0] * sign > 0.12 and p[2] > upper else 1.0))
    flare = {'wide': 0.035, 'puff': 0.012}.get(sleeve, 0.0)
    loose = (0.004 if ctx['sex'] == 'male' else 0.0015) + ease_extra

    def ease(p):
        arm = abs(p[0]) > 0.17
        e = 0.0075 + loose * (1 - G['_smoothstep'](R['waist_z'], R['neck_z'] - 0.1, p[2])) + 0.002 * arm
        if arm and flare:
            e += flare * min(1.0, (abs(p[0]) - 0.17) / 0.12)
        return e + ease_extra * 0.5 + 0.007 * (1 - G['_smoothstep'](R['hip_z'] + 0.02, R['hip_z'] + 0.09, p[2]))
    trim = print_material(G, 'tricolour') if 'trim' in extras else None
    envelope = {'window': 2, 'sigma': 1.2} if ctx['sex'] == 'female' else {'window': 5}
    seat_top = R['hip_z'] + 0.08   # hems hang off the seat instead of tucking under it
    obj = G['shell'](ctx, name or f'AWD_Top_{item}', torso | sleeves, ease, material(G, fabric, colour, item),
                     smooth=14, cuts=cuts, envelope=envelope, trim=trim,
                     shape=lambda bm: (G['drape_down'](bm, ctx, hem_z, seat_top, slope=0.3, front=False),
                                       G['bridge_front'](bm, ctx, lo=hem_z - 0.01, hi=seat_top, back=True)))
    # Details sit 16 mm off the body or 4 mm off the shirt, whichever is further out.
    layers = [(G['rest_bvh'](ctx['body']), 0.016), (G['rest_bvh'](obj), 0.004)]
    shirt = np.array([v.co[:] for v in obj.data.vertices])
    W = Writer(ctx, obj)
    if sleeve == 'none' and collar != 'toga':
        clamp_straps(W, collar_z, armhole)
    tails = {'tunic': (R['hip_z'] - 0.17, 0.04, 0.85, 6), 'kaftan': (R['knee_z'] - 0.12, 0.06, 0.95, 10),
             'peplum': (R['waist_z'] - 0.11, 0.05, 0.3, 5), 'jacket': (R['hip_z'] - 0.10, 0.01, 0.6, 5)}
    if hem in tails:
        bottom, tail_flare, follow, rings = tails[hem]   # clear of the baggy trouser legs underneath
        hem_band = shirt[(np.abs(shirt[:, 0]) < 0.22) & (shirt[:, 2] < hem_z + 0.04)]   # torso, not the sleeves
        W.bm.verts.ensure_lookup_table()
        shell_verts = list(W.bm.verts)
        # Starts 5 cm up inside the shirt so a striding leg cannot open a gap at the hem.
        ring = skirt(ctx, W, hem_z + 0.05, bottom, 0.012 + ease_extra, tail_flare, follow=follow, rings=rings, gap=0.02,
                     tuck=0.006, flush_z=hem_z - 0.006, room=0.04,
                     cover=hem_band, clear=G['trouser_clearance'](ctx, 1.0 if ctx['sex'] == 'male' else 0.75))
        flare_into(shell_verts, ring, hem_z)
    if collar == 'collar':
        collar_band(ctx, W, collar_z)
    elif collar in ('crew', 'v', 'scoop'):
        neckband(ctx, W, obj, collar_z, mat=1 if trim is not None else 0,
                 keep=(lambda p: armhole(p) > 0.12) if sleeve == 'none' else None)
    if 'hood' in extras:
        hood(ctx, W, obj, collar_z)
    if 'tie' in extras:
        tie(ctx, W, layers, R, material_slot(obj, G['_material']('AWD_Print_tie', (0.03, 0.05, 0.12), 0.5)))
    chest_z = J['spine01____head'][2]
    if 'flag' in extras:
        chest_patch(W, layers, (0.0, chest_z - 0.03), (0.13, 0.085), material_slot(obj, print_material(G, 'flag')))
    if 'star' in extras:
        chest_patch(W, layers, (0.075, chest_z + 0.02), (0.045, 0.045), material_slot(obj, print_material(G, 'star')))
    W.finish()
    if 'shirt' in extras:   # suit: shirt and tie visible in the jacket's V, merged into one object
        inner = build_top(ctx, G, item + 'shirt', 'long', 'collar', 'normal', 0.0, 'cotton', '#f4f4f2', ('tie',), (),
                          name=f'_tmp_{item}_shirt')
        merge(obj, inner)
    obj['awd_slot'], obj['awd_id'] = 'top', item
    obj['awd_hides_regions'] = G['mask'](*hides) if hides else 0
    # Trouser regions a long tail covers end to end, hidden at runtime under the robe.
    obj['awd_covers_regions'] = G['mask'](*COVERS.get(hem, ()))
    return obj


def merge(obj, other):
    offset = len(obj.data.materials)
    for m in other.data.materials:
        obj.data.materials.append(m)
    for p in other.data.polygons:
        p.material_index += offset
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.from_mesh(other.data)   # both start as body copies, so vertex groups share indices
    bm.to_mesh(obj.data)
    bm.free()
    bpy.data.objects.remove(other, do_unlink=True)


def empty_garment(ctx, name, mat):
    """An empty garment object carrying the body's vertex groups and the rig."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for g in ctx['body'].vertex_groups:
        obj.vertex_groups.new(name=g.name)
    mesh.materials.append(mat)
    mesh.uv_layers.new(name='UVMap')
    obj.parent = ctx['rig']
    obj.modifiers.new('Armature', 'ARMATURE').object = ctx['rig']
    return obj


def build_bottom(ctx, G, item, kind, hem, ease_extra, fabric, colour, hides):
    R = G['regions'](ctx)
    c = R['centre']
    waist_z = R['hip_z'] + 0.045
    mat = material(G, fabric, colour, item)
    if kind == 'pants':
        hem_z = {'ankle': R['ankle_z'] + 0.035, 'shorts': R['knee_z'] + 0.08, 'jogger': R['ankle_z'] + 0.05}[hem]
        mask = (R['arm'] < 0.5) & (c[:, 2] < waist_z) & (c[:, 2] > hem_z)

        def ease(p):
            lower = 1 - G['_smoothstep'](R['ankle_z'], R['knee_z'], p[2])
            if hem == 'jogger':
                lower *= G['_smoothstep'](hem_z, hem_z + 0.12, p[2])   # cuffed: snug at the ankle
            return 0.0085 + 0.010 * lower - 0.003 * G['_smoothstep'](R['hip_z'] - 0.03, R['hip_z'] + 0.03, p[2]) + ease_extra
        bag = BAGGY[item] * (1.0 if ctx['sex'] == 'male' else 0.75)

        def shape(bm):
            G['bridge_front'](bm, ctx, lo=R['hip_z'] - 0.14, hi=waist_z, back=True)   # seat spans the cleft
            G['baggy_legs'](bm, ctx, hem_z, *G['trouser_cut'](bag), cuff=hem == 'jogger')
        obj = G['shell'](ctx, f'AWD_Bottom_{item}', mask, ease, mat, smooth=14, uv='limb',
                         cuts=[G['cut'](lambda p: p[2] - waist_z, True), G['cut'](lambda p: p[2] - hem_z, True)], shape=shape)
    else:
        obj = empty_garment(ctx, f'AWD_Bottom_{item}', mat)
        W = Writer(ctx, obj)
        hem_z = {'mini': R['hip_z'] - 0.22, 'knee': R['knee_z'] - 0.02, 'long': R['ankle_z'] + 0.03}[hem]
        tight = ease_extra < 0
        skirt(ctx, W, waist_z, hem_z, 0.009, ease_extra, follow=0.85 if tight else 0.6, rings=10 if hem == 'long' else 7,
              slit=(R['knee_z'] + 0.06) if item == 'slit' else None, a_line=not tight)
        W.finish()
    obj['awd_slot'], obj['awd_id'] = 'bottom', item
    obj['awd_hides_regions'] = G['mask'](*hides)
    return obj


def build_full(ctx, G, item, top, hem, flare, fabric, colour, hides):
    sleeve, collar = top
    obj = build_top(ctx, G, item, sleeve, collar, 'normal', -0.002 if item == 'bodycon' else 0.004, fabric, colour, (), (),
                    name=f'AWD_Full_{item}')
    R = G['regions'](ctx)
    hem_z = R['knee_z'] - 0.02 if hem == 'knee' else R['ankle_z'] + 0.02
    W = Writer(ctx, obj)
    skirt(ctx, W, R['hip_z'] + 0.02, hem_z, 0.010 + (0.008 if item == 'kentecloth' else 0.0), flare,
          follow=0.85 if flare < 0 else 0.6, rings=10 if hem == 'long' else 8, a_line=flare >= 0)
    W.finish()
    obj['awd_slot'], obj['awd_id'] = 'full', item
    obj['awd_hides_regions'] = G['mask'](*hides)
    return obj


def build_garment(ctx, G, item):
    if item in TOPS:
        return build_top(ctx, G, item, *TOPS[item])
    if item in BOTTOMS:
        return build_bottom(ctx, G, item, *BOTTOMS[item])
    return build_full(ctx, G, item, *FULL[item])
