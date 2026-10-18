"""Accra We Dey — landmark models for the city map (original work, Blender 5.2, headless).

Builds low-poly, flat-shaded GLB models of the city's landmark destinations in the same metre units and footprints
the map's procedural fallbacks use (client/src/v2/scene/city/landmarks.js), so each model drops into the same spot.
Game coordinates: x east, y up, z south (toward the viewer). Everything is generated from code here: no downloaded
meshes, textures or references are embedded.

Run (from the repo root):
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup \
      --python world/scripts/build_landmarks.py -- [--only blackstar,circle] [--previews]
Outputs: client/public/assets/world/landmarks/<id>.glb, world/export/landmarks.json, world/previews/<id>.png
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'client', 'public', 'assets', 'world', 'landmarks')
PREVIEWS = os.path.join(ROOT, 'world', 'previews')
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ONLY = next((a.split('=', 1)[1] if '=' in a else argv[argv.index(a) + 1] for a in argv if a.startswith('--only')), '')
ONLY = set(filter(None, ONLY.split(',')))
WANT_PREVIEWS = '--previews' in argv

# Palette: sRGB hex, converted to linear for Blender (glTF stores linear factors; three.js shows them as sRGB).
PALETTE = {
    'stone': '#e2d9c3', 'stone_dark': '#b9ae94', 'plaza': '#d1c6ad', 'marble': '#eeeae0', 'concrete': '#c9c6ba',
    'white': '#f2efe6', 'cream': '#e9dcc0', 'black': '#23262a', 'gold': '#e2b23c', 'red': '#ce1126', 'green': '#0b7a3e',
    'flag_gold': '#fcd116', 'roof_red': '#a9533c', 'roof_tile': '#b0614a', 'rust': '#8d5a3c', 'zinc': '#8d9496',
    'asphalt': '#4b4f52', 'lane': '#e8e4d2', 'grass': '#6f9a5b', 'pitch': '#4f9b4c', 'water': '#5d97a8', 'glass': '#6f9fb3',
    'trunk': '#8a6f4e', 'leaf': '#4e8a43', 'bronze': '#8a6a3d', 'stripe_red': '#c0392b', 'teal': '#2f7f86',
    'umbrella_red': '#d2462f', 'umbrella_yellow': '#f0c330', 'umbrella_blue': '#2e78b7', 'canoe_a': '#d64a2c', 'canoe_b': '#2b8a5a',
    'steel': '#9aa3a6', 'sand': '#d9c49a', 'dome': '#e9e4d6', 'dome_gold': '#d8a93c', 'brick': '#b46a4b', 'terracotta': '#c47b52',
}


def srgb_to_linear(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)


MATERIALS = {}


def material(name):
    if name not in MATERIALS:
        m = bpy.data.materials.new('awd_' + name); m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = srgb_to_linear(PALETTE[name])
        bsdf.inputs['Roughness'].default_value = 0.35 if name in ('glass', 'water') else 0.85
        bsdf.inputs['Metallic'].default_value = 0.4 if name in ('steel', 'zinc') else 0.0
        MATERIALS[name] = m
    return MATERIALS[name]


def g2b(x, y, z):
    """Game (x east, y up, z south) → Blender (x east, y north, z up)."""
    return Vector((x, -z, y))


class Landmark:
    """Collects geometry per material into bmeshes, then writes one mesh object per material."""

    def __init__(self, lid):
        self.id = lid; self.bms = {}

    def bm(self, mat):
        if mat not in self.bms:
            self.bms[mat] = bmesh.new()
        return self.bms[mat]

    @staticmethod
    def place(x, y, z, angle=0.0):
        return Matrix.Translation(g2b(x, y, z)) @ Matrix.Rotation(angle, 4, 'Z')

    def box(self, x, y, z, w, h, d, mat, angle=0.0):
        """Box with its base at height y (like the map's parts.box)."""
        m = self.place(x, y + h / 2, z, angle) @ Matrix.Diagonal((w, d, h, 1.0))
        bmesh.ops.create_cube(self.bm(mat), size=1.0, matrix=m)

    def cyl(self, x, y, z, r, h, mat, segments=12, r_top=None, angle=0.0):
        m = self.place(x, y + h / 2, z, angle)
        bmesh.ops.create_cone(self.bm(mat), cap_ends=True, cap_tris=False, segments=segments, radius1=r, radius2=r if r_top is None else r_top, depth=h, matrix=m)

    def dome(self, x, y, z, r, mat, segments=16, rings=8, squash=1.0):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings * 2, radius=r)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context='VERTS')
        bmesh.ops.scale(bm, vec=Vector((1, 1, squash)), verts=bm.verts)
        bmesh.ops.translate(bm, vec=g2b(x, y, z), verts=bm.verts)
        self._merge(bm, mat)

    def prism(self, points, y, h, mat, x=0.0, z=0.0, angle=0.0, upright=False):
        """Extrude a 2D outline (game x/z, or x/y when upright) by h."""
        bm = bmesh.new()
        if upright:   # outline in the x/y plane, thickness along z
            bottom = [bm.verts.new((px, -h / 2, py)) for px, py in points]
            top = [bm.verts.new((px, h / 2, py)) for px, py in points]
        else:
            bottom = [bm.verts.new((px, -pz, 0)) for px, pz in points]
            top = [bm.verts.new((px, -pz, h)) for px, pz in points]
        bm.faces.new(bottom[::-1]); bm.faces.new(top)
        n = len(points)
        for i in range(n):
            bm.faces.new((bottom[i], bottom[(i + 1) % n], top[(i + 1) % n], top[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bmesh.ops.transform(bm, matrix=self.place(x, y, z, angle), verts=bm.verts)
        self._merge(bm, mat)

    def _merge(self, bm, mat):
        me = bpy.data.meshes.new('tmp'); bm.to_mesh(me); bm.free()
        self.bm(mat).from_mesh(me); bpy.data.meshes.remove(me)

    # ---- reusable details -------------------------------------------------------------------
    def palm(self, x, z, h=24, s=1.0):
        self.cyl(x, 0, z, 1.1 * s, h, 'trunk', segments=6, r_top=0.7 * s)
        for i in range(7):
            a = i * 2 * math.pi / 7
            m = self.place(x + math.cos(a) * 5 * s, h - 1.2, z + math.sin(a) * 5 * s, -a) @ Matrix.Rotation(0.42, 4, 'Y') @ Matrix.Diagonal((11 * s, 2.6 * s, 0.5, 1))
            bmesh.ops.create_cube(self.bm('leaf'), size=1.0, matrix=m)

    def flag(self, x, z, h=26, w=9):
        self.cyl(x, 0, z, 0.35, h, 'steel', segments=6)
        for i, c in enumerate(('red', 'flag_gold', 'green')):
            self.box(x + w / 2 + 0.4, h - 2 - (i + 1) * 1.6, z, w, 1.6, 0.3, c)
        self.star(x + w / 2 + 0.4, h - 2 - 2 * 1.6 - 0.8 + 0.8, z + 0.2, 1.3, 0.4, 'black')

    def star(self, x, y, z, r, depth, mat, upright=True):
        pts = []
        for i in range(10):
            a = math.pi / 2 + i * math.pi / 5; rr = r if i % 2 == 0 else r * 0.42
            pts.append((math.cos(a) * rr, math.sin(a) * rr))
        self.prism(pts, y, depth, mat, x=x, z=z, upright=upright)

    def tube(self, x, y, z, r, length, mat, segments=12, r_top=None):
        """Cylinder lying along game x, resting on height y."""
        m = self.place(x, y + r, z) @ Matrix.Rotation(math.pi / 2, 4, 'Y')
        bmesh.ops.create_cone(self.bm(mat), cap_ends=True, cap_tris=False, segments=segments, radius1=r, radius2=r if r_top is None else r_top, depth=length, matrix=m)

    def ring(self, x, y, z, radius, width, h, mat, segments=24, arc=2 * math.pi, start=0.0):
        """Flat ring (road deck) made of trapezoid segments."""
        seg_len = 2 * math.pi * radius / segments * (arc / (2 * math.pi)) * 1.04
        for i in range(segments):
            a = start + (i + 0.5) * arc / segments
            self.box(x + math.cos(a) * radius, y, z + math.sin(a) * radius, seg_len, h, width, mat, angle=math.pi / 2 - a)

    def write(self, collection):
        objs = []
        for mat, bm in self.bms.items():
            me = bpy.data.meshes.new(f'{self.id}_{mat}')
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
            bm.to_mesh(me); bm.free()
            me.materials.append(material(mat))
            ob = bpy.data.objects.new(f'{self.id}_{mat}', me); collection.objects.link(ob); objs.append(ob)
        self.bms = {}
        return objs


# ---- landmark builders (footprints follow the map fallbacks; z+ faces the default camera) ---------------------
def blackstar(L):
    """Independence Arch with the Black Star Gate on Black Star Square."""
    L.box(0, 0, 0, 150, 1, 120, 'plaza')
    L.box(0, 1, -2, 96, 0.4, 70, 'stone_dark')
    for sx in (-1, 1):                                   # the two great piers
        L.box(sx * 30, 1, 0, 16, 50, 22, 'stone')
        L.box(sx * 30, 1, 0, 18, 4, 24, 'stone_dark')
        for k in range(3):                               # vertical recesses
            L.box(sx * 30 + (k - 1) * 4.5, 10, 11.1, 2.2, 34, 0.6, 'stone_dark')
    L.box(0, 51, 0, 78, 17, 24, 'stone')                 # lintel
    L.box(0, 56, 12.2, 66, 4, 0.6, 'black')              # inscription band
    L.box(0, 68, 0, 30, 3, 16, 'stone')
    L.star(0, 84, 0, 15, 5, 'black')                     # the black star
    for z in (-44, -50, -56):                            # grandstand rows behind the square
        L.box(0, 0, z, 130 - (z + 44) * -1.5, (z + 44) * -0.8 + 6, 6, 'stone_dark')
    L.box(0, 0, -60, 50, 16, 8, 'cream'); L.box(0, 16, -60, 54, 2, 12, 'roof_red')
    for x in (-66, -58, 58, 66):
        L.flag(x, 44)
    for x in (-62, 62):
        L.palm(x, 30); L.palm(x, -30)


def memorial(L):
    """Kwame Nkrumah Memorial Park: mausoleum, pools, museum."""
    L.box(0, 0, 0, 132, 1.2, 132, 'grass')
    L.box(0, 1.2, 0, 96, 0.6, 96, 'marble')
    for sx in (-1, 1):                                   # reflecting pools either side of the approach
        L.box(sx * 24, 1.6, 22, 22, 0.5, 50, 'water'); L.box(sx * 24, 1.2, 22, 25, 0.8, 53, 'stone_dark')
    L.box(0, 1.8, -10, 40, 3, 40, 'stone_dark')          # plinth steps
    L.box(0, 4.8, -10, 32, 3, 32, 'marble')
    # The mausoleum: a tapering shaft, broad at the top like an upturned sword, cut level and crowned with a star.
    for i, (h, s) in enumerate(((10, 1.0), (10, 1.18), (10, 1.36), (8, 1.5))):
        y = 7.8 + sum(hh for hh, _ in ((10, 1.0), (10, 1.18), (10, 1.36), (8, 1.5))[:i])
        L.box(0, y, -10, 18 * s, h, 18 * s, 'marble')
    L.box(0, 45.8, -10, 30, 1.6, 30, 'stone_dark')
    L.star(0, 52, -10, 5, 1.5, 'black')
    L.box(0, 1.8, 40, 10, 2.4, 10, 'stone_dark'); L.cyl(0, 4.2, 40, 2, 7, 'bronze', 8)   # statue on its pedestal
    L.box(-34, 1.2, -40, 30, 9, 18, 'cream'); L.dome(-34, 10.2, -40, 8, 'dome_gold', 12, 4, 0.7)   # museum
    for x in (-52, 52):
        for z in (-48, 48):
            L.palm(x, z, 22)


def lighthouse(L):
    """Jamestown lighthouse beside the old fort."""
    L.box(0, 0, 0, 90, 1, 70, 'sand')
    stripes = ['white', 'stripe_red', 'white', 'stripe_red', 'white']
    for i, c in enumerate(stripes):
        L.cyl(0, 1 + i * 9, 0, 7.5 - i * 0.6, 9, c, 8, 7.5 - (i + 1) * 0.6)
    L.cyl(0, 46, 0, 6.8, 1.2, 'black', 8)                # gallery
    L.cyl(0, 47.2, 0, 3.6, 5, 'glass', 8)                # lantern room
    L.cyl(0, 52.2, 0, 4.4, 2.2, 'stripe_red', 8, 0.6)    # cap
    L.box(-24, 1, 14, 30, 12, 26, 'cream')               # fort walls with crenellations
    for i in range(7):
        L.box(-37 + i * 4.4, 13, 27.2, 2.4, 2, 1.6, 'cream')
    L.box(-24, 13, 14, 12, 7, 10, 'white'); L.box(-24, 20, 14, 13, 1, 11, 'roof_red')
    for i, x in enumerate((14, 22, 30)):                 # canoes on the beach
        L.box(x, 1, 24 - i * 3, 3, 1.6, 14, 'canoe_a' if i % 2 == 0 else 'canoe_b', 0.25)


def circle(L):
    """Kwame Nkrumah Interchange: ground roundabout, elevated ring and a through flyover."""
    L.cyl(0, 0, 0, 78, 1.2, 'concrete', 32)
    L.cyl(0, 1.2, 0, 70, 0.3, 'asphalt', 32)
    L.cyl(0, 1.5, 0, 44, 1.2, 'grass', 24)
    L.cyl(0, 2.7, 0, 3, 34, 'white', 8)                  # central obelisk
    L.star(0, 40, 0, 4, 1, 'black')
    L.ring(0, 18, 0, 56, 14, 2.4, 'asphalt', 28)         # elevated ring deck
    L.ring(0, 20.4, 0, 62.6, 0.8, 1.2, 'lane', 28)
    L.ring(0, 20.4, 0, 49.4, 0.8, 1.2, 'lane', 28)
    for i in range(10):                                  # ring columns
        a = i * 2 * math.pi / 10
        L.cyl(math.cos(a) * 56, 1.2, math.sin(a) * 56, 2, 16.8, 'concrete', 8)
    for side in (-1, 1):                                 # the through flyover on the diagonal
        L.box(0, 27, 0, 190, 2.6, 15, 'asphalt', -0.35)
        L.box(0, 29.6, 0, 190, 1.1, 0.8, 'lane', -0.35)
    for t in (-80, -45, 45, 80):
        x, z = math.cos(-0.35) * t, -math.sin(-0.35) * t
        L.box(x, 1, z, 4, 26, 8, 'concrete', -0.35)
    for sx in (-1, 1):
        L.box(sx * 92, 0, 0, 10, 26, 16, 'concrete', -0.35)   # ramps' abutments


def castle(L):
    """Osu Castle: white walls, corner bastions, keep and tower above the sea."""
    L.box(0, 0, 0, 120, 1, 100, 'sand')
    L.box(0, 1, 0, 90, 22, 70, 'white')
    L.box(0, 1, 0, 60, 22.4, 44, 'cream')                # inner court roofline
    for sx in (-1, 1):
        for sz in (-1, 1):                               # angled bastions
            L.box(sx * 45, 1, sz * 35, 18, 24, 18, 'white', math.pi / 4)
            L.box(sx * 45, 25, sz * 35, 19, 1.2, 19, 'stone_dark', math.pi / 4)
    for i in range(10):
        L.box(-40 + i * 9, 23, 35.5, 4, 2.2, 1.6, 'white')   # crenellations
    L.box(18, 1, -18, 20, 44, 20, 'white'); L.box(18, 45, -18, 22, 2, 22, 'stone_dark')   # tower
    for k in range(3):
        L.box(18, 14 + k * 10, -7.9, 4, 5, 0.6, 'black')
    for i in range(4):
        L.box(-30 + i * 14, 6, 35.3, 4, 6, 0.6, 'black')   # gun ports
    L.flag(18, -18, 64, 8)


def stadium(L):
    """Accra Sports Stadium: oval bowl, main-stand roof and floodlights."""
    L.box(0, 0, 0, 150, 1, 118, 'concrete')
    L.box(0, 1, 0, 100, 0.4, 62, 'pitch')
    L.box(0, 1.4, 0, 0.8, 0.1, 62, 'lane'); L.cyl(0, 1.4, 0, 9, 0.1, 'lane', 20); L.cyl(0, 1.45, 0, 8.2, 0.12, 'pitch', 20)
    for i in range(6):                                   # stepped oval stands
        r = 1.0 + i * 0.07
        for j in range(24):
            a = j * 2 * math.pi / 24
            x, z = math.cos(a) * 58 * r, math.sin(a) * 42 * r
            L.box(x, 1, z, 17 * r, 3 + i * 3, 7, 'stone' if i % 2 else 'stone_dark', math.pi / 2 - a)
    L.box(0, 22, -54, 96, 1.4, 22, 'zinc')               # main stand roof
    for x in (-40, -15, 15, 40):
        L.cyl(x, 1, -62, 0.9, 21, 'steel', 6)
    for sx in (-1, 1):
        for sz in (-1, 1):
            L.cyl(sx * 70, 1, sz * 52, 1.3, 46, 'steel', 6)
            L.box(sx * 70, 46, sz * 52, 10, 5, 2, 'lane', math.atan2(sz, sx))


def market(L, kantamanto=False):
    """Makola / Kantamanto: rows of zinc-roofed stalls, umbrellas, and a market hall."""
    L.box(0, 0, 0, 150, 0.8, 130, 'concrete')
    roofs = ['rust', 'zinc', 'roof_red']
    for a in range(-3, 4):
        for b in range(-2, 3):
            x, z = a * 18, b * 20 + 8
            k = (a + b + 6) % 3
            L.box(x, 0.8, z, 13, 3.4, 11, 'cream' if k else 'stone')
            L.box(x, 4.2, z, 15, 0.5, 13, roofs[k], 0.0)
            L.box(x, 4.7, z - 3, 15, 0.4, 7, roofs[(k + 1) % 3])
    umbrellas = ['umbrella_red', 'umbrella_yellow', 'umbrella_blue']
    for i in range(14 if not kantamanto else 22):
        x = -66 + (i * 37) % 132; z = -55 + (i * 23) % 110
        L.cyl(x, 0.8, z, 0.25, 4.5, 'steel', 5); L.cyl(x, 5.3, z, 4.2, 1.4, umbrellas[i % 3], 8, 0.4)
    if kantamanto:                                       # clothing racks along the lanes
        for i in range(12):
            L.box(-60 + i * 11, 0.8, 58, 8, 3, 1, ['red', 'teal', 'flag_gold', 'green'][i % 4])
    else:                                                # the market hall with a saw-tooth roof
        L.box(-48, 0.8, -52, 46, 14, 22, 'cream')
        for i in range(5):
            L.prism([(-4.6, 0), (4.6, 0), (4.6, 5), (-4.6, 0.6)], 14.8, 22, 'zinc', x=-66 + i * 9.2, z=-41, upright=True)
    for sx in (-1, 1):
        L.box(sx * 82, 0, 0, 16, 18, 110, 'stone_dark' if sx < 0 else 'cream')
        L.box(sx * 82, 18, 0, 18, 1, 112, 'roof_red')


def mosque(L):
    """National Mosque: prayer hall with a great dome, smaller domes and four minarets."""
    L.box(0, 0, 0, 130, 1, 120, 'plaza')
    L.box(0, 1, -6, 74, 20, 64, 'white')
    L.box(0, 21, -6, 76, 1.5, 66, 'gold')
    L.cyl(0, 22.5, -6, 17, 6, 'white', 20)
    L.dome(0, 28.5, -6, 17, 'dome', 20, 8, 1.0)
    L.cyl(0, 45, -6, 1, 5, 'gold', 8)
    for sx in (-1, 1):
        for sz in (-1, 1):
            L.dome(sx * 24, 22.5, -6 + sz * 20, 7, 'dome', 14, 5, 1.0)
            L.cyl(sx * 46, 1, -6 + sz * 40, 3.4, 48, 'white', 10)      # minaret
            L.cyl(sx * 46, 36, -6 + sz * 40, 5, 1.6, 'gold', 10)       # balcony
            L.cyl(sx * 46, 49, -6 + sz * 40, 3.4, 6, 'dome_gold', 10, 0.2)
    for i in range(7):
        L.box(-27 + i * 9, 1, 26.2, 4.4, 13, 0.8, 'teal')               # arched windows (as tall panels)
    L.box(0, 1, 44, 40, 0.6, 24, 'water')


def airport(L):
    """Kotoka International Airport (KIA) Terminal 3: iconic sweeping wave roof, two-level departures/arrivals
    viaduct, glazed curtain walls with structural mullions, boarding bridges (jetways), detailed ATC tower,
    Ghana-livery airliner with boarding bridge, ground service vehicles, runway threshold, and landscaped forecourt."""
    # 1. Main Tarmac & Runway Apron
    L.box(0, 0, 0, 260, 1.2, 160, 'asphalt')

    # Runway strip on the far side (z = -62)
    L.box(0, 1.2, -62, 258, 0.1, 26, 'asphalt')
    # Runway threshold piano keys / markings
    for i in range(14):
        L.box(-115 + i * 4.2, 1.3, -62, 2.4, 0.05, 18, 'lane')
        L.box(60 + i * 4.2, 1.3, -62, 2.4, 0.05, 18, 'lane')
    # Runway centerline dashes
    for i in range(7):
        L.box(-45 + i * 15, 1.3, -62, 9, 0.05, 1.4, 'lane')
    # Apron yellow taxiway lead-in lines
    for i in range(8):
        L.box(-90 + i * 26, 1.25, -34, 18, 0.04, 0.9, 'flag_gold')
        L.box(-90 + i * 26, 1.25, -20, 14, 0.04, 0.9, 'flag_gold')

    # 2. Terminal 3 Main Building (x: -50 to 65, z: -10 to 20)
    # Concrete foundation podium
    L.box(8, 1.2, 4, 140, 2.4, 40, 'concrete')

    # Ground Floor: Arrivals hall with tinted glass
    L.box(8, 3.6, 4, 136, 6.0, 36, 'glass')
    # Structural columns & entrance frames along arrivals
    for i in range(13):
        x = -54 + i * 10.3
        L.box(x, 1.2, 22.2, 1.6, 8.4, 1.6, 'steel')
        L.box(x, 1.2, -14.2, 1.6, 8.4, 1.6, 'steel')

    # Second Floor: Departures grand concourse (high ceiling glass curtain wall)
    L.box(8, 9.6, 4, 134, 8.4, 34, 'glass')
    for i in range(13):
        x = -54 + i * 10.3
        L.box(x, 9.6, 21.2, 1.2, 8.4, 1.2, 'white')
        L.box(x, 9.6, -13.2, 1.2, 8.4, 1.2, 'white')

    # Signature Undulating Wave Roof of Terminal 3
    # Curved aerodynamic roof canopy spanning from z = -18 to z = 32 (overhanging the viaduct)
    for i in range(18):
        t = i / 17.0
        z_pos = -18 + t * 48
        y_pos = 18.2 + math.sin(t * math.pi) * 4.6 + (1 - t) * 1.5
        L.box(8, y_pos, z_pos, 148, 1.4, 3.2, 'white')
        if i % 3 == 0:  # Glass skylight strips along the wave roof
            L.box(8, y_pos + 0.3, z_pos, 110, 0.6, 1.2, 'glass')

    # Front terminal canopy fascia with gold/black signage band
    L.box(8, 17.5, 30.5, 120, 2.2, 1.0, 'black')
    L.box(8, 18.2, 31.1, 108, 0.8, 0.4, 'gold')
    # Ghana national colors badge at center of terminal entrance
    L.box(8, 18.2, 31.4, 14, 1.4, 0.2, 'flag_gold')
    L.box(8, 19.1, 31.5, 14, 0.4, 0.2, 'red')
    L.box(8, 17.3, 31.5, 14, 0.4, 0.2, 'green')
    L.star(8, 18.2, 31.7, 0.55, 0.1, 'black')

    # 3. Departures Viaduct (Elevated Drop-off Road & Ground Arrivals)
    L.box(8, 9.6, 32, 134, 1.6, 12, 'asphalt')
    L.box(8, 11.2, 37.6, 134, 1.2, 0.8, 'concrete')
    L.box(8, 11.2, 26.4, 134, 1.2, 0.8, 'concrete')
    # Viaduct support columns underneath
    for i in range(9):
        L.cyl(-48 + i * 14, 1.2, 32, 1.5, 8.4, 'concrete', 10)
    # West approach ramp (rising from y = 1.2 to 9.6)
    for i in range(6):
        h = 1.2 + (i + 1) * 1.4
        L.box(-64 - i * 5.5, 1.2, 32, 5.5, h, 12, 'concrete')
    # East exit ramp (sloping back down to ground)
    for i in range(6):
        h = 9.6 - (i + 1) * 1.4
        L.box(80 + i * 5.5, 1.2, 32, 5.5, max(1.2, h), 12, 'concrete')
    # Ground level arrivals lane in front
    L.box(8, 1.2, 44, 140, 0.1, 10, 'lane')

    # 4. Passenger Boarding Bridges (Aero-Bridges / Jetways) on airside (z < 0)
    for gx in (-38, 2, 42):
        L.box(gx, 9.6, -18, 5, 4.5, 8, 'glass')
        L.box(gx - 4, 7.5, -26, 3.2, 3.4, 12, 'white', 0.18)
        L.box(gx - 4, 7.5, -26, 3.4, 1.8, 11.8, 'glass', 0.18)
        L.box(gx - 7, 6.2, -33, 4.4, 4.0, 4.0, 'concrete')
        L.box(gx - 7, 6.4, -35.2, 3.6, 3.6, 1.2, 'black')
        L.cyl(gx - 4, 1.2, -26, 0.8, 6.0, 'steel', 8)
        L.box(gx - 4, 1.2, -26, 3.0, 1.2, 1.4, 'black')

    # 5. Parked Modern Airliner (Ghanaian Commercial Jet at Gate 1)
    # Fuselage (52m long, radius 3.2)
    L.tube(-48, 4.2, -40, 3.2, 52, 'white', 16)
    # Aerodynamic nose cone (tapered)
    L.tube(-18, 4.2, -40, 3.2, 8, 'white', 16, r_top=0.5)
    # Cockpit windshield band
    L.box(-23.5, 6.2, -40, 3.2, 1.2, 4.2, 'glass')
    # Passenger windows strip along fuselage
    for w in range(16):
        L.box(-68 + w * 2.8, 5.8, -43.25, 1.2, 0.9, 0.2, 'glass')
        L.box(-68 + w * 2.8, 5.8, -36.75, 1.2, 0.9, 0.2, 'glass')

    # Swept Wings (44m span)
    L.box(-48, 4.6, -40, 14, 0.9, 44, 'white', 0.12)
    # Winglet wingtips
    L.box(-54, 7.5, -62.5, 2.2, 3.2, 0.4, 'red', 0.3)
    L.box(-54, 7.5, -17.5, 2.2, 3.2, 0.4, 'red', -0.3)

    # Turbofan Jet Engines on pylons under the wings
    for s_wing in (-1, 1):
        ez = -40 + s_wing * 11
        L.box(-46, 3.8, ez, 4.2, 1.6, 0.6, 'steel')
        L.tube(-46, 2.2, ez, 2.1, 7.5, 'steel', 12)
        L.tube(-41.5, 2.2, ez, 2.1, 1.8, 'black', 12, r_top=0.4)

    # Tail assembly: Ghana Tricolor Vertical Fin
    L.box(-70, 7.4, -40, 7.5, 3.2, 0.8, 'green', -0.32)
    L.box(-71, 10.6, -40, 6.2, 3.2, 0.7, 'flag_gold', -0.32)
    L.star(-71, 12.2, -39.5, 0.8, 0.2, 'black')
    L.star(-71, 12.2, -40.5, 0.8, 0.2, 'black')
    L.box(-72, 13.8, -40, 5.0, 3.0, 0.6, 'red', -0.32)
    # Horizontal stabilizers
    L.box(-69, 7.6, -40, 6.0, 0.6, 18, 'white')

    # Landing gear (nose & main)
    L.cyl(-26, 1.2, -40, 0.4, 3.0, 'steel', 6)
    L.cyl(-26, 1.2, -40, 1.0, 1.2, 'black', 8)
    for s_gear in (-1, 1):
        L.cyl(-48, 1.2, -40 + s_gear * 3.5, 0.5, 3.0, 'steel', 6)
        L.cyl(-48, 1.2, -40 + s_gear * 3.5, 1.3, 1.4, 'black', 8)

    # Apron Ground Support Equipment (GSE)
    L.box(-30, 1.2, -33, 4.2, 2.0, 2.6, 'flag_gold')
    L.box(-31, 2.2, -33, 2.2, 1.6, 2.4, 'glass')
    for t_idx in (1, 2):
        tx = -30 - t_idx * 5.5
        L.box(tx, 1.2, -33, 3.6, 1.2, 2.2, 'steel')
        L.box(tx, 2.4, -33, 2.8, 1.0, 1.8, 'red' if t_idx == 1 else 'teal')

    # 6. Detailed Air Traffic Control (ATC) Tower (KIA iconic tower)
    L.box(100, 1.2, 38, 22, 2.0, 22, 'concrete')
    L.box(100, 3.2, 38, 18, 5.0, 18, 'glass')
    L.cyl(100, 8.2, 38, 6.2, 38, 'concrete', 12, r_top=4.8)
    L.cyl(100, 46.2, 38, 6.8, 1.4, 'steel', 12)
    L.cyl(100, 47.6, 38, 5.2, 7.0, 'glass', 12, r_top=7.8)
    L.cyl(100, 54.6, 38, 8.4, 1.6, 'concrete', 12)
    L.dome(100, 56.2, 38, 2.8, 'dome', 14, 6, 1.0)
    L.cyl(100, 59.0, 38, 0.3, 9.0, 'steel', 6)
    L.cyl(100, 68.0, 38, 0.45, 1.2, 'red', 6)

    # 7. Landscaped Entrance Forecourt & Roundabout
    L.ring(8, 1.2, 62, 16, 6, 0.1, 'asphalt', 24)
    L.cyl(8, 1.2, 62, 12.8, 0.8, 'grass', 20)
    L.cyl(8, 2.0, 62, 3.4, 2.4, 'marble', 12)
    L.flag(8, 62, 26, 8)
    L.flag(-4, 62, 20, 6)
    L.flag(20, 62, 20, 6)

    for p_x in (-60, -40, -20, 36, 56, 76):
        L.palm(p_x, 62, 22, 0.9)
    for p_z in (48, 68):
        L.palm(-65, p_z, 20, 0.85)
        L.palm(80, p_z, 20, 0.85)

    L.box(-28, 1.2, 52, 16, 3.2, 1.8, 'stone_dark')
    L.box(-28, 4.4, 52, 18, 1.2, 2.0, 'flag_gold')


def ug(L):
    """University of Ghana, Balme Library: white walls, red-tiled roofs, clock tower and arcades."""
    L.box(0, 0, 0, 140, 1, 110, 'grass')
    L.box(0, 1, 30, 110, 0.4, 24, 'plaza')
    for sx in (-1, 1):
        L.box(sx * 40, 1, -10, 26, 20, 90, 'white')
        L.prism([(-15, 0), (15, 0), (0, 9)], 21, 94, 'roof_tile', x=sx * 40, z=-10 + 47, upright=True)
        for k in range(6):
            L.box(sx * 40 + sx * 13.3, 3, -48 + k * 15, 0.6, 8, 5, 'black')
    L.box(0, 1, -50, 54, 22, 26, 'white')
    L.prism([(-28, 0), (28, 0), (0, 9)], 23, 28, 'roof_tile', x=0, z=-50 + 14, upright=True)
    L.box(0, 1, 14, 16, 52, 16, 'white')                 # clock tower
    L.box(0, 53, 14, 18, 2, 18, 'roof_tile'); L.cyl(0, 55, 14, 9, 10, 'roof_tile', 4, 0.5, angle=math.pi / 4)
    L.cyl(0, 40, 22.1, 3.2, 0.4, 'cream', 16)
    for i in range(9):
        L.box(-36 + i * 9, 1, 26.5, 1.4, 8, 1.4, 'white')   # arcade columns
    L.box(0, 9, 26.5, 76, 2, 3, 'roof_tile')
    for x in (-62, 62):
        L.palm(x, 40, 22)


def mall(L):
    L.box(0, 0, 0, 150, 1, 120, 'asphalt')
    L.box(0, 1, -10, 130, 20, 70, 'cream')
    L.box(0, 21, -10, 134, 2, 74, 'roof_red')
    L.box(0, 1, 25.2, 60, 14, 0.8, 'glass')
    L.box(0, 15, 25.6, 70, 4, 1.2, 'teal')
    for i in range(6):
        L.box(-50 + i * 20, 1, 46, 9, 0.1, 18, 'lane')
    for x in (-66, 66):
        L.palm(x, 40)


def hotel(L):
    L.box(0, 0, 0, 130, 1, 110, 'grass')
    for f in range(6):
        L.box(0, 1 + f * 6, -20, 90, 6, 26, 'white' if f % 2 == 0 else 'cream')
        L.box(0, 1 + f * 6 + 4, -6.3, 88, 0.6, 3, 'stone_dark')
    L.box(0, 37, -20, 94, 1.5, 30, 'roof_red')
    L.box(0, 1, 26, 40, 0.5, 18, 'water'); L.box(0, 1, 26, 44, 0.3, 22, 'stone')
    for x in (-50, -30, 30, 50):
        L.palm(x, 30, 22)


def church(L):
    L.box(0, 0, 0, 110, 1, 110, 'plaza')
    L.box(0, 1, -6, 30, 20, 70, 'cream')
    L.prism([(-17, 0), (17, 0), (0, 12)], 21, 72, 'roof_tile', x=0, z=-6 + 36, upright=True)
    L.box(0, 1, 34, 14, 40, 14, 'cream')
    L.cyl(0, 41, 34, 9.5, 20, 'roof_tile', 4, 0.2, angle=math.pi / 4)
    L.box(0, 1, 41.2, 5, 9, 0.6, 'black')
    for k in range(5):
        L.box(15.3, 7, -32 + k * 13, 0.6, 7, 3, 'glass'); L.box(-15.3, 7, -32 + k * 13, 0.6, 7, 3, 'glass')


def bukom(L):
    L.box(0, 0, 0, 120, 1, 100, 'concrete')
    L.box(0, 1, -5, 76, 14, 60, 'brick')
    for i in range(9):                                   # barrel roof
        a = -1.2 + i * 0.3
        L.box(0, 15 + math.cos(a) * 9, -5 + math.sin(a) * 31, 80, 1.2, 7, 'zinc')
    L.box(0, 1, 25.6, 20, 9, 0.6, 'black')
    L.box(0, 10.5, 25.8, 50, 3, 0.8, 'flag_gold')


BUILDERS = {'blackstar': blackstar, 'memorial': memorial, 'lighthouse': lighthouse, 'circle': circle, 'castle': castle,
            'stadium': stadium, 'makola': market, 'kantamanto': lambda L: market(L, kantamanto=True), 'mosque': mosque,
            'airport': airport, 'ug': ug, 'mall': mall, 'hotel': hotel, 'church': church, 'bukom': bukom}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATERIALS.clear()


def export(lid, objs):
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    path = os.path.join(OUT, f'{lid}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_materials='EXPORT', export_normals=True, export_texcoords=False, export_cameras=False, export_lights=False)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)
    return {'id': lid, 'file': f'assets/world/landmarks/{lid}.glb', 'bytes': os.path.getsize(path), 'triangles': tris, 'materials': len(objs)}


def preview(lid, objs):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24; scene.cycles.device = 'CPU'
    scene.render.resolution_x = 640; scene.render.resolution_y = 480; scene.render.film_transparent = False
    world = bpy.data.worlds.new('w'); world.use_nodes = True; world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.82, 0.86, 1); world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    scene.world = world
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (math.radians(50), 0, math.radians(35)); scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); cam.data.type = 'ORTHO'; cam.data.ortho_scale = 210
    cam.location = (190, -190, 160); cam.rotation_euler = (math.radians(58), 0, math.radians(45)); scene.collection.objects.link(cam); scene.camera = cam
    scene.render.filepath = os.path.join(PREVIEWS, f'{lid}.png')
    bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(OUT, exist_ok=True); os.makedirs(PREVIEWS, exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'world', 'export'), exist_ok=True)
    manifest_path = os.path.join(ROOT, 'world', 'export', 'landmarks.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    for lid, build in BUILDERS.items():
        if ONLY and lid not in ONLY:
            continue
        reset()
        col = bpy.data.collections.new(lid); bpy.context.scene.collection.children.link(col)
        L = Landmark(lid); build(L); objs = L.write(col)
        manifest[lid] = export(lid, objs)
        if WANT_PREVIEWS:
            preview(lid, objs)
        print(f'[landmarks] {lid}: {manifest[lid]["triangles"]} triangles, {manifest[lid]["bytes"] // 1024} KB', flush=True)
    json.dump(manifest, open(manifest_path, 'w'), indent=1)


main()
