"""Accra We Dey street kit: the buildings and street furniture that fill neighbourhood streets (Blender 5.2).

Original low-poly models of an Accra residential street: walled compound houses with corrugated roofs and
black polytanks, two-storey shop blocks with balconies and roller shutters, container shops, wooden
kiosks, an open chop bar, neem and coconut palm trees, a wooden electricity pole with its transformer,
a vendor umbrella stall and a trotro. Everything is generated here; no downloaded meshes or textures.

Each asset is a few meshes named kit_<asset>__<material>, one per material, with the origin at the centre
of its footprint on the ground and the front facing Blender -Y (three.js +Z). Meshes made from the 'tint'
material are white so the game paints each copy in its own wall colour (client/src/v2/scene/street-kit.js).

Run in Blender's Python console / MCP:  AWD_ROOT = r'<repo>'; exec(open(AWD_ROOT + r'/world/scripts/build_street_kit.py').read())
or headless:  blender --background --factory-startup --python world/scripts/build_street_kit.py
Writes client/public/assets/world/street-kit.glb and world/export/street-kit.json.
"""
import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = globals().get('AWD_ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_GLB = os.path.join(ROOT, 'client', 'public', 'assets', 'world', 'street-kit.glb')
OUT_JSON = os.path.join(ROOT, 'world', 'export', 'street-kit.json')

PALETTE = {   # sRGB; 'tint' is white and painted per copy by the game
    'tint': '#ffffff', 'roof': '#8f969a', 'rust': '#9a5a3a', 'dark': '#22262a', 'glass': '#3c5560', 'metal': '#6d7579',
    'gate': '#2d5d8a', 'tank': '#141414', 'wood': '#7a5434', 'trunk': '#6e5638', 'leaf': '#4d7f3a', 'palm': '#5f8f3c',
    'concrete': '#bdb6a6', 'accent': '#d94f2a', 'awning': '#2f8f5b', 'yellow': '#f2c230', 'white': '#efede6',
    'red': '#c8102e', 'blue': '#2b6cb0', 'bench': '#8a5a2c', 'shutter': '#9aa3a8', 'sign': '#f4efe0',
}
SHINY = ('glass', 'metal', 'roof', 'shutter')


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)


def material(key):
    name = 'kit_' + key
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = lin(PALETTE[key])
        bsdf.inputs['Roughness'].default_value = 0.35 if key in SHINY else 0.85
        bsdf.inputs['Metallic'].default_value = 0.6 if key in ('metal', 'roof', 'shutter') else 0.0
    return m


def kit_collection():
    coll = bpy.data.collections.get('AWD_StreetKit')
    if coll is None:
        coll = bpy.data.collections.new('AWD_StreetKit')
        bpy.context.scene.collection.children.link(coll)
    return coll


class Asset:
    """Accumulates primitives per material, then makes one mesh object per material."""

    def __init__(self, name):
        self.name, self.parts = name, {}

    def bm(self, key):
        return self.parts.setdefault(key, bmesh.new())

    @staticmethod
    def frame(at, rot_x=0.0, rot_y=0.0, rot_z=0.0):
        return (Matrix.Translation(Vector(at)) @ Matrix.Rotation(rot_z, 4, 'Z') @ Matrix.Rotation(rot_y, 4, 'Y')
                @ Matrix.Rotation(rot_x, 4, 'X'))

    def box(self, key, size, at=(0, 0, 0), rot_x=0.0, rot_y=0.0, rot_z=0.0):
        bm = self.bm(key)
        geom = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.transform(bm, matrix=self.frame(at, rot_x, rot_y, rot_z) @ Matrix.Diagonal((*size, 1)), verts=geom['verts'])

    def cyl(self, key, r1, r2, h, at=(0, 0, 0), segs=12, rot_x=0.0, rot_y=0.0, rot_z=0.0):
        bm = self.bm(key)
        geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=h)
        bmesh.ops.transform(bm, matrix=self.frame(at, rot_x, rot_y, rot_z), verts=geom['verts'])

    def ball(self, key, r, at=(0, 0, 0), scale=(1, 1, 1)):
        bm = self.bm(key)
        geom = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
        bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(at)) @ Matrix.Diagonal((*scale, 1)), verts=geom['verts'])

    def gable_roof(self, key, w, d, rise, at, overhang=0.35, thickness=0.06):
        """Two pitched sheets meeting at a ridge along x, over a w x d plan, eaves at height at.z."""
        x0, y0, z0 = at
        half = d / 2 + overhang
        pitch = math.atan2(rise, d / 2)
        slope = half / math.cos(pitch)
        for side in (-1, 1):
            cy = y0 + side * half / 2
            cz = z0 + rise - (half / 2) * math.tan(pitch)
            self.box(key, (w + overhang * 2, slope, thickness), at=(x0, cy, cz), rot_x=-side * pitch)

    def build(self):
        objs = []
        for key, bm in self.parts.items():
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            mesh = bpy.data.meshes.new(f'kit_{self.name}__{key}')
            bm.to_mesh(mesh)
            bm.free()
            mesh.materials.append(material(key))
            obj = bpy.data.objects.new(mesh.name, mesh)
            obj['tint'] = key == 'tint'
            kit_collection().objects.link(obj)
            objs.append(obj)
        return objs


def louvres(a, x, y, z, w=0.9, h=1.0):
    """Glass louvre window on a wall facing -Y: dark frame and slanted blades."""
    a.box('dark', (w + 0.08, 0.06, h + 0.08), at=(x, y - 0.02, z))
    for k in range(6):
        a.box('glass', (w, 0.02, h / 7), at=(x, y - 0.05, z - h / 2 + h * (k + 0.5) / 6), rot_x=-0.5)


def compound():
    """Walled compound house: 2.2 m wall with a blue metal gate, the house roof and a polytank above it."""
    a = Asset('compound')
    W, D, H = 8.0, 7.0, 2.2
    for size, at in (((W, 0.22, H), (0, -D / 2, H / 2)), ((W, 0.22, H), (0, D / 2, H / 2)),
                     ((0.22, D, H), (-W / 2, 0, H / 2)), ((0.22, D, H), (W / 2, 0, H / 2))):
        a.box('tint', size, at=at)
    a.box('concrete', (W + 0.1, D + 0.1, 0.12), at=(0, 0, H + 0.06))   # wall coping (hollow box top, reads as a rim)
    a.box('gate', (2.6, 0.12, 2.0), at=(-1.2, -D / 2 - 0.08, 1.0))
    for k in range(9):
        a.box('dark', (0.04, 0.14, 1.9), at=(-2.4 + k * 0.3, -D / 2 - 0.1, 1.0))
    a.box('tint', (6.2, 4.6, 3.0), at=(0.4, 0.8, 1.5))   # the house inside the wall
    louvres(a, 1.5, 0.8 - 2.3, 2.4)
    louvres(a, -1.0, 0.8 - 2.3, 2.4)
    a.gable_roof('roof', 6.2, 4.6, 0.9, (0.4, 0.8, 3.0), overhang=0.45)
    a.cyl('concrete', 0.08, 0.08, 1.8, at=(3.1, 2.6, 3.1), segs=6)
    a.box('concrete', (1.3, 1.3, 0.1), at=(3.1, 2.6, 4.05))
    a.cyl('tank', 0.55, 0.6, 1.3, at=(3.1, 2.6, 4.75), segs=14)   # black polytank on its stand
    a.cyl('tank', 0.2, 0.2, 0.12, at=(3.1, 2.6, 5.45), segs=10)
    return a.build()


def storey():
    """Two-storey shop block: roller-shutter shop below, balcony and louvres above, tank on the flat roof."""
    a = Asset('storey')
    W, D, F = 6.0, 5.0, 3.0
    a.box('tint', (W, D, F * 2), at=(0, 0, F))
    a.box('concrete', (W + 0.2, D + 0.2, 0.25), at=(0, 0, F * 2 + 0.12))
    a.box('shutter', (2.4, 0.08, 2.4), at=(-1.3, -D / 2 - 0.03, 1.25))
    for k in range(10):
        a.box('metal', (2.4, 0.1, 0.03), at=(-1.3, -D / 2 - 0.05, 0.2 + k * 0.23))
    a.box('dark', (1.0, 0.08, 2.2), at=(1.7, -D / 2 - 0.03, 1.1))
    a.box('sign', (W * 0.9, 0.08, 0.6), at=(0, -D / 2 - 0.08, 2.7))
    a.box('accent', (W * 0.9, 0.09, 0.12), at=(0, -D / 2 - 0.09, 2.95))
    a.box('concrete', (W, 1.3, 0.18), at=(0, -D / 2 - 0.6, F + 0.05))   # balcony slab
    for k in range(13):
        a.box('metal', (0.04, 0.04, 1.0), at=(-W / 2 + 0.25 + k * 0.46, -D / 2 - 1.2, F + 0.6))
    a.box('metal', (W, 0.06, 0.06), at=(0, -D / 2 - 1.2, F + 1.1))
    louvres(a, -1.6, -D / 2, F + 1.6, w=1.2, h=1.1)
    louvres(a, 1.6, -D / 2, F + 1.6, w=1.2, h=1.1)
    a.box('dark', (0.9, 0.08, 2.1), at=(0, -D / 2 - 0.03, F + 1.05))
    a.cyl('tank', 0.5, 0.55, 1.2, at=(1.8, 1.2, F * 2 + 0.85), segs=14)
    a.cyl('white', 0.35, 0.05, 0.12, at=(-1.8, 1.4, F * 2 + 0.6), rot_x=1.0, segs=12)   # satellite dish
    a.cyl('metal', 0.02, 0.02, 0.6, at=(-1.8, 1.4, F * 2 + 0.4), segs=5)
    return a.build()


def container():
    """Shipping-container shop with open front, counter, awning and a sign band."""
    a = Asset('container')
    W, D, H = 6.0, 2.4, 2.6
    a.box('tint', (W, D, H), at=(0, 0, H / 2 + 0.15))
    for k in range(16):
        a.box('tint', (0.06, D + 0.04, H - 0.2), at=(-W / 2 + 0.2 + k * 0.37, 0, H / 2 + 0.15))
    a.box('dark', (W - 0.6, 0.05, H - 0.5), at=(0, -D / 2 - 0.01, H / 2 + 0.1))
    a.box('wood', (W - 0.8, 0.5, 0.08), at=(0, -D / 2 - 0.25, 1.1))
    a.box('awning', (W + 0.4, 1.4, 0.05), at=(0, -D / 2 - 0.6, H + 0.1), rot_x=0.25)
    a.box('sign', (W - 0.4, 0.06, 0.45), at=(0, -D / 2 - 0.05, H + 0.45))
    for x in (-W / 2, W / 2):
        a.box('concrete', (0.4, D, 0.15), at=(x * 0.85, 0, 0.075))
    return a.build()


def kiosk():
    """Small painted wooden kiosk with a serving window and a sheet roof."""
    a = Asset('kiosk')
    W, D, H = 2.6, 2.0, 2.3
    a.box('tint', (W, D, H), at=(0, 0, H / 2 + 0.2))
    a.box('dark', (W * 0.7, 0.05, 0.8), at=(0, -D / 2 - 0.01, 1.6))
    a.box('wood', (W * 0.75, 0.35, 0.06), at=(0, -D / 2 - 0.17, 1.2))
    a.box('roof', (W + 0.6, D + 0.7, 0.05), at=(0, -0.1, H + 0.3), rot_x=0.12)
    a.box('yellow', (W, 0.05, 0.35), at=(0, -D / 2 - 0.03, H + 0.05))
    for x in (-W / 2 + 0.1, W / 2 - 0.1):
        for y in (-D / 2 + 0.1, D / 2 - 0.1):
            a.box('wood', (0.1, 0.1, 0.25), at=(x, y, 0.12))
    return a.build()


def chopbar():
    """Open-sided chop bar: posts, a sheet roof, a serving table, two benches and a coal pot."""
    a = Asset('chopbar')
    W, D, H = 5.0, 4.0, 2.6
    for x in (-W / 2, W / 2):
        for y in (-D / 2, D / 2):
            a.box('wood', (0.14, 0.14, H), at=(x, y, H / 2))
    a.gable_roof('rust', W, D, 0.7, (0, 0, H), overhang=0.4)
    a.box('tint', (W, 0.12, 1.0), at=(0, D / 2, 0.5))
    a.box('wood', (2.4, 0.8, 0.08), at=(0, 0.6, 0.85))
    for y in (-0.6, 0.1):
        a.box('bench', (2.6, 0.3, 0.06), at=(0, y - 0.6, 0.45))
        for x in (-1.1, 1.1):
            a.box('bench', (0.06, 0.25, 0.45), at=(x, y - 0.6, 0.22))
    a.cyl('dark', 0.25, 0.22, 0.35, at=(-1.6, 1.3, 0.2), segs=10)
    a.box('sign', (2.6, 0.06, 0.45), at=(0, -D / 2 - 0.1, H + 0.05))
    return a.build()


def neem():
    a = Asset('neem')
    a.cyl('trunk', 0.18, 0.24, 3.0, at=(0, 0, 1.5), segs=8)
    for x, y, z, r in ((0, 0, 3.6, 1.7), (1.0, 0.3, 3.2, 1.2), (-0.9, -0.4, 3.3, 1.3), (0.2, -0.9, 3.9, 1.1), (-0.3, 0.9, 4.0, 1.1)):
        a.ball('leaf', r, at=(x, y, z), scale=(1, 1, 0.75))
    return a.build()


def palm():
    a = Asset('palm')
    for k in range(6):   # gently leaning trunk in segments
        a.cyl('trunk', 0.16, 0.14, 1.1, at=(0.02 * k * k, 0, 0.55 + k * 1.05), segs=7, rot_y=0.04 * k)
    top = (0.7, 0, 6.4)
    for k in range(9):
        ang = k * 2 * math.pi / 9
        a.box('palm', (2.6, 0.45, 0.05), at=(top[0] + 1.2 * math.cos(ang), 1.2 * math.sin(ang), top[2] - 0.35), rot_z=ang, rot_y=-0.45)
    a.ball('trunk', 0.3, at=top)
    return a.build()


def pole():
    """Wooden electricity pole with a crossarm, insulators and a pole-mounted transformer."""
    a = Asset('pole')
    a.cyl('wood', 0.11, 0.14, 8.0, at=(0, 0, 4.0), segs=8)
    a.box('wood', (1.8, 0.12, 0.12), at=(0, 0, 7.6))
    for x in (-0.8, 0, 0.8):
        a.cyl('white', 0.05, 0.05, 0.2, at=(x, 0, 7.75), segs=6)
    a.box('metal', (0.6, 0.5, 0.8), at=(0, 0.35, 6.2))
    return a.build()


def umbrella():
    """Vendor stall: a big two-colour umbrella over a table and crates."""
    a = Asset('umbrella')
    a.cyl('metal', 0.03, 0.03, 2.4, at=(0, 0, 1.2), segs=6)
    for k in range(8):
        ang = k * math.pi / 4
        a.box('red' if k % 2 else 'yellow', (1.25, 0.95, 0.04), at=(0.62 * math.cos(ang), 0.62 * math.sin(ang), 2.25), rot_z=ang, rot_y=0.32)
    a.box('wood', (1.4, 0.8, 0.06), at=(0, 0, 0.8))
    for x in (-0.6, 0.6):
        a.box('wood', (0.06, 0.7, 0.8), at=(x, 0, 0.4))
    a.box('blue', (0.5, 0.4, 0.35), at=(0.9, 0.3, 0.17))
    a.box('accent', (0.5, 0.4, 0.35), at=(0.9, -0.3, 0.17))
    return a.build()


def trotro():
    """A minibus trotro: boxy body, Mercedes 207 sloped nose, yellow commercial stripe, wheels, headlights, luggage rack with cargo."""
    a = Asset('trotro')
    L, W, H = 5.2, 2.0, 2.3
    # Main white body
    a.box('white', (L, W, H - 0.5), at=(0, 0, 0.45 + (H - 0.5) / 2))
    # Mercedes 207 front sloped hood & bumper
    a.box('white', (1.0, W - 0.1, 0.65), at=(L / 2 + 0.45, 0, 0.78))
    a.box('dark', (0.1, W * 0.5, 0.35), at=(L / 2 + 0.96, 0, 0.75))
    a.box('dark', (0.2, W + 0.1, 0.22), at=(L / 2 + 0.96, 0, 0.42))
    a.box('dark', (0.2, W + 0.1, 0.22), at=(-L / 2 - 0.05, 0, 0.42))
    # Headlights
    for y in (-W / 2 + 0.25, W / 2 - 0.25):
        a.box('yellow', (0.05, 0.28, 0.18), at=(L / 2 + 0.98, y, 0.78))
    # Number plates (Ghana commercial yellow)
    a.box('yellow', (0.05, 0.52, 0.14), at=(L / 2 + 1.07, 0, 0.42))
    a.box('yellow', (0.05, 0.52, 0.14), at=(-L / 2 - 0.16, 0, 0.42))
    # Windows
    a.box('glass', (L - 1.2, W + 0.04, 0.6), at=(-0.3, 0, 1.75))
    a.box('glass', (0.08, W - 0.25, 0.65), at=(L / 2 + 0.02, 0, 1.68))
    a.box('glass', (0.08, W - 0.35, 0.55), at=(-L / 2 - 0.01, 0, 1.72))
    # Commercial yellow waist stripe & red accent line
    a.box('yellow', (L + 0.04, W + 0.04, 0.32), at=(0, 0, 1.15))
    a.box('red', (L + 0.05, W + 0.05, 0.08), at=(0, 0, 0.95))
    # Wheels with rims
    for x in (-1.6, 1.7):
        for y in (-W / 2, W / 2):
            a.cyl('dark', 0.38, 0.38, 0.26, at=(x, y, 0.38), rot_x=math.pi / 2, segs=12)
            a.cyl('metal', 0.22, 0.22, 0.28, at=(x, y, 0.38), rot_x=math.pi / 2, segs=10)
    # Roof luggage rack & cargo
    a.box('metal', (L - 0.4, 1.8, 0.12), at=(-0.2, 0, H + 0.06))
    a.box('metal', (L - 0.4, 0.06, 0.2), at=(-0.2, 0.88, H + 0.16))
    a.box('metal', (L - 0.4, 0.06, 0.2), at=(-0.2, -0.88, H + 0.16))
    # Cargo on roof
    a.box('red', (0.8, 0.7, 0.32), at=(-1.0, 0.2, H + 0.26))
    a.box('yellow', (0.7, 0.6, 0.28), at=(-1.1, -0.4, H + 0.24))
    a.box('white', (0.9, 0.8, 0.25), at=(0.3, -0.1, H + 0.22))
    a.cyl('dark', 0.36, 0.36, 0.22, at=(1.4, 0.2, H + 0.22), segs=12)
    return a.build()


ASSETS = {'compound': compound, 'storey': storey, 'container': container, 'kiosk': kiosk, 'chopbar': chopbar,
          'neem': neem, 'palm': palm, 'pole': pole, 'umbrella': umbrella, 'trotro': trotro}


def main():
    for o in [o for o in bpy.data.objects if o.name.startswith('kit_')]:
        bpy.data.objects.remove(o, do_unlink=True)
    for m in [m for m in bpy.data.meshes if m.name.startswith('kit_')]:
        bpy.data.meshes.remove(m)   # rebuilds keep the exact kit_<asset>__<material> names
    report, objs = {}, []
    for name, make in ASSETS.items():
        made = make()
        objs += made
        report[name] = {'meshes': [o.name for o in made], 'triangles': sum(len(p.vertices) - 2 for o in made for p in o.data.polygons)}
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    layer = bpy.context.view_layer.layer_collection.children['AWD_StreetKit']
    bpy.context.view_layer.active_layer_collection = layer
    bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', use_active_collection=True, export_yup=True, export_apply=True,
                              export_extras=True, export_animations=False, export_cameras=False, export_lights=False)
    # Lay the kit out in a row for review in the viewport (the export above has every asset at the origin).
    for i, name in enumerate(ASSETS):
        for o in objs:
            if o.name.startswith(f'kit_{name}__'):
                o.location.x = i * 10.0
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump({'assets': report, 'bytes': os.path.getsize(OUT_GLB)}, f, indent=1)
    return report


RESULT = main()
