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
from mathutils.bvhtree import BVHTree
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


def skirt(ctx, W, top_z, hem_z, ease, flare, follow=0.6, rings=9, seg=28, slit=None, a_line=True, mat=0):
    """Lofted skirt or tunic tail from top_z to hem_z, added into W."""
    knee_z = ctx['joints']['lowerleg01.L____head'][2]
    body_co = np.array([v.co[:] for v in ctx['body'].data.vertices])
    bvh = BVHTree.FromObject(ctx['body'], bpy.context.evaluated_depsgraph_get())
    rows, prev = [], None
    for i in range(rings + 1):
        t = i / rings
        z = top_z + (hem_z - top_z) * t
        a, b, cy = section(body_co, z)
        a, b = a + ease + flare * t ** 1.3, b * 0.92 + ease + flare * 0.8 * t ** 1.3
        if a_line and prev:
            a, b = max(a, prev[0]), max(b, prev[1])
        prev = (a, b)
        ring = []
        for j in range(seg):
            ang = 2 * math.pi * j / seg
            p = np.array([math.sin(ang) * a, cy - math.cos(ang) * b, z])
            hit = bvh.find_nearest(Vector(p))
            if hit[0] is not None and np.dot(p - np.array(hit[0][:]), np.array(hit[1][:])) < 0.006:
                p = np.array(hit[0][:]) + np.array(hit[1][:]) * 0.006
            lw = min(1.0, abs(p[0]) / (a * 0.7)) * t * follow
            leg = ('Left' if p[0] > 0 else 'Right') + ('UpLeg' if z > knee_z else 'Leg')
            ring.append(W.vert(p, {'Hips': 1 - lw, leg: lw} if lw > 0 else {'Hips': 1.0}))
        rows.append((ring, z))
    for (r0, z0), (r1, z1) in zip(rows, rows[1:]):
        for j in range(seg):
            ang = 2 * math.pi * (j + 0.5) / seg
            if slit and math.sin(ang) > 0.55 and math.cos(ang) > -0.2 and z1 < slit:
                continue   # side slit on the character's left front
            k = (j + 1) % seg
            u0, u1 = j / seg * 4, (j + 1) / seg * 4
            W.face([r0[j], r1[j], r1[k], r0[k]], [(u0, z0 / 0.22), (u0, z1 / 0.22), (u1, z1 / 0.22), (u1, z0 / 0.22)], mat)


def surface_points(bvh, xs, zs, offset, front=True):
    """Points on the front (or back) of the body at the given x/z, pushed out by offset."""
    pts = []
    for x, z in zip(xs, zs):
        hit = bvh.ray_cast(Vector((x, -0.5 if front else 0.5, z)), Vector((0, 1 if front else -1, 0)), 1.0)
        if hit[0] is not None:
            pts.append(np.array(hit[0][:]) + np.array(hit[1][:]) * offset)
    return pts


def collar_band(ctx, W, collar_z, height=0.022, fold=0.026):
    """Folded shirt collar: stands up from the neckline, turns down, open at the front."""
    neck = np.array(ctx['joints']['neck01____head'])
    pts = []
    for j in range(24):
        ang = 2 * math.pi * j / 24
        p = neck + np.array([math.sin(ang) * 0.064, -math.cos(ang) * 0.060, 0.0])
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


def chest_patch(W, bvh, centre, size, mat, offset=0.016):
    """A print laid on the garment front, e.g. the flag or a star badge."""
    xs = np.linspace(centre[0] - size[0] / 2, centre[0] + size[0] / 2, 5)
    zs = np.linspace(centre[1] - size[1] / 2, centre[1] + size[1] / 2, 5)
    verts = [[W.vert(surface_points(bvh, [x], [z], offset)[0]) for x in xs] for z in zs]
    for i in range(4):
        for j in range(4):
            W.face([verts[i][j], verts[i][j + 1], verts[i + 1][j + 1], verts[i + 1][j]],
                   [(j / 4, i / 4), ((j + 1) / 4, i / 4), ((j + 1) / 4, (i + 1) / 4), (j / 4, (i + 1) / 4)], mat)


def hood(ctx, W):
    """A relaxed hood resting on the upper back."""
    centre = np.array(ctx['joints']['neck01____head']) + np.array([0.0, 0.075, 0.03])
    rows, cols = 6, 16
    grid = []
    for i in range(rows + 1):
        th = math.pi * 0.5 * i / rows
        grid.append([W.vert(centre + np.array([-math.cos(math.pi * (0.15 + 0.7 * j / cols)) * math.cos(th) * 0.13,
                                               (0.35 + 0.65 * math.sin(th)) * 0.06,
                                               math.sin(math.pi * (0.15 + 0.7 * j / cols)) * math.cos(th) * 0.066]))
                     for j in range(cols + 1)])
    for i in range(rows):
        for j in range(cols):
            W.face([grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]],
                   [(j / cols, i / rows), ((j + 1) / cols, i / rows), ((j + 1) / cols, (i + 1) / rows), (j / cols, (i + 1) / rows)])


def tie(ctx, W, bvh, R, mat):
    top = ctx['joints']['neck01____head'][2] - 0.035
    zs = np.linspace(top, R['waist_z'] + 0.02, 9)
    widths = np.interp(zs, [zs[-1], zs[-1] + 0.05, top - 0.02, top], [0.0, 0.085, 0.045, 0.035])
    pts = surface_points(bvh, np.zeros(len(zs)), zs, 0.016)
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


def build_top(ctx, G, item, sleeve, collar, hem, ease_extra, fabric, colour, extras, hides, name=None):
    R = G['regions'](ctx)
    J = ctx['joints']
    c = R['centre']
    collar_z = collar_fn(R, collar)
    hem_z = R['waist_z'] + 0.05 if hem == 'crop' else R['waist_z'] + 0.01 if hem == 'peplum' else R['hip_z'] - 0.035
    torso = (R['arm'] < 0.5) & (c[:, 2] > hem_z) & np.array([p[2] < collar_z(p) for p in c])
    if sleeve == 'none':
        torso &= ~((np.abs(c[:, 0]) > 0.10) & (c[:, 2] > R['neck_z'] - 0.20) & (R['arm'] > 0.15))
        sleeves = (R['arm'] >= 0.5) & (R['sleeve'] < 0.35) & (c[:, 0] > 0) if collar == 'toga' else np.zeros(len(c), bool)
    else:
        sleeves = (R['arm'] >= 0.5) & (R['sleeve'] < SLEEVE[sleeve])
    cuts = [G['cut'](lambda p: p[2] - hem_z), G['cut'](lambda p: p[2] - collar_z(p))]
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
    obj = G['shell'](ctx, name or f'AWD_Top_{item}', torso | sleeves, ease, material(G, fabric, colour, item),
                     smooth=14, cuts=cuts, envelope=envelope, trim=trim)
    bvh = BVHTree.FromObject(ctx['body'], bpy.context.evaluated_depsgraph_get())
    W = Writer(ctx, obj)
    tails = {'tunic': (R['hip_z'] - 0.17, 0.04, 0.3, 6), 'kaftan': (R['knee_z'] - 0.12, 0.06, 0.5, 10),
             'peplum': (R['waist_z'] - 0.11, 0.05, 0.3, 5), 'jacket': (R['hip_z'] - 0.10, 0.01, 0.3, 5)}
    if hem in tails:
        bottom, tail_flare, follow, rings = tails[hem]
        skirt(ctx, W, hem_z + 0.03, bottom, 0.012 + ease_extra, tail_flare, follow=follow, rings=rings)
    if collar == 'collar':
        collar_band(ctx, W, collar_z)
    if 'hood' in extras:
        hood(ctx, W)
    if 'tie' in extras:
        tie(ctx, W, bvh, R, material_slot(obj, G['_material']('AWD_Print_tie', (0.03, 0.05, 0.12), 0.5)))
    chest_z = J['spine01____head'][2]
    if 'flag' in extras:
        chest_patch(W, bvh, (0.0, chest_z - 0.03), (0.13, 0.085), material_slot(obj, print_material(G, 'flag')))
    if 'star' in extras:
        chest_patch(W, bvh, (0.075, chest_z + 0.02), (0.045, 0.045), material_slot(obj, print_material(G, 'star')))
    W.finish()
    if 'shirt' in extras:   # suit: shirt and tie visible in the jacket's V, merged into one object
        inner = build_top(ctx, G, item + 'shirt', 'long', 'collar', 'normal', 0.0, 'cotton', '#f4f4f2', ('tie',), (),
                          name=f'_tmp_{item}_shirt')
        merge(obj, inner)
    obj['awd_slot'], obj['awd_id'] = 'top', item
    obj['awd_hides_regions'] = G['mask'](*hides) if hides else 0
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
        obj = G['shell'](ctx, f'AWD_Bottom_{item}', mask, ease, mat, smooth=14, uv='limb',
                         cuts=[G['cut'](lambda p: p[2] - waist_z), G['cut'](lambda p: p[2] - hem_z)])
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
