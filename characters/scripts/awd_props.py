"""Accra We Dey character pipeline: hand-held and worn props for activity actions (2026-10).

Every prop is modelled in the body's rest pose exactly where it is held: in the grip of a hand (the
palm frame below), on top of the head, or slung in front of the body. The game reads each node's
`awd_bone` and parents it to that bone with the rest-pose offset (client/src/v2/scene/actions.js), so
props follow the hands through every clip. `awd_level` props (plate, headpan) are kept level by the
game. Palm frame: X runs across the palm from the index to the little finger, Y along the fingers,
Z out of the palm; the origin sits where curled fingers close. Original geometry; no external assets.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

COLOURS = {
    'iron': (0.05, 0.05, 0.06), 'chrome': (0.55, 0.56, 0.58), 'rubber': (0.02, 0.02, 0.02),
    'phone': (0.015, 0.015, 0.02), 'screen': (0.10, 0.32, 0.65), 'enamel': (0.85, 0.84, 0.80),
    'jollof': (0.62, 0.16, 0.03), 'green': (0.10, 0.35, 0.08), 'steel': (0.62, 0.63, 0.65),
    'glass': (0.06, 0.22, 0.10), 'label': (0.75, 0.08, 0.05), 'wood': (0.30, 0.16, 0.07),
    'straw': (0.55, 0.42, 0.18), 'band': (0.62, 0.05, 0.05), 'alu': (0.70, 0.71, 0.72),
    'orange': (0.80, 0.42, 0.02), 'cloth': (0.55, 0.10, 0.30), 'drumhead': (0.70, 0.58, 0.40),
    'drumbody': (0.20, 0.09, 0.03), 'paper': (0.88, 0.86, 0.80), 'cover': (0.05, 0.25, 0.45),
    'gold': (0.60, 0.40, 0.08),
}
SHINY = ('chrome', 'steel', 'alu', 'glass', 'screen')


def _mat(G, name):
    return bpy.data.materials.get('AWD_Prop_' + name) or G['_material']('AWD_Prop_' + name, COLOURS[name],
                                                                         0.35 if name in SHINY else 0.7)


class Builder:
    """Collects primitive parts in a local frame into one mesh with several materials."""

    def __init__(self, G, name):
        self.G, self.name = G, name
        self.bm = bmesh.new()
        self.mats = []

    def _add(self, geom_verts, mat, matrix):
        verts = [v for v in geom_verts if isinstance(v, bmesh.types.BMVert)]
        bmesh.ops.transform(self.bm, matrix=matrix, verts=verts)
        if mat not in self.mats:
            self.mats.append(mat)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = self.mats.index(mat)
            f.smooth = True

    def cyl(self, r1, r2, length, mat, at=(0, 0, 0), axis='X', segs=16):
        geom = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=length)
        rot = {'X': Matrix.Rotation(math.pi / 2, 4, 'Y'), 'Y': Matrix.Rotation(-math.pi / 2, 4, 'X'), 'Z': Matrix.Identity(4)}[axis]
        self._add(geom['verts'], mat, Matrix.Translation(Vector(at)) @ rot)

    def box(self, size, mat, at=(0, 0, 0), rot=None):
        geom = bmesh.ops.create_cube(self.bm, size=1.0)
        self._add(geom['verts'], mat, Matrix.Translation(Vector(at)) @ (rot or Matrix.Identity(4)) @ Matrix.Diagonal((*size, 1)))

    def sphere(self, r, mat, at=(0, 0, 0), scale=(1, 1, 1)):
        geom = bmesh.ops.create_uvsphere(self.bm, u_segments=12, v_segments=8, radius=r)
        self._add(geom['verts'], mat, Matrix.Translation(Vector(at)) @ Matrix.Diagonal((*scale, 1)))

    def finish(self, frame, bone, level=False):
        mesh = bpy.data.meshes.new('prop_' + self.name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for m in self.mats:
            mesh.materials.append(_mat(self.G, m))
        old = bpy.data.objects.get('prop_' + self.name)
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        obj = bpy.data.objects.new('prop_' + self.name, mesh)
        obj.matrix_world = frame
        obj['awd_bone'] = bone
        obj['awd_level'] = level
        bpy.context.scene.collection.objects.link(obj)
        return obj


def palm_frame(rig, side):
    """Rest-pose grip frame of a hand (see module docstring)."""
    bones = rig.data.bones
    wrist = bones[side + 'Hand'].head_local
    index, pinky = bones[side + 'HandIndex1'].head_local, bones[side + 'HandPinky1'].head_local
    middle = bones[side + 'HandMiddle1'].head_local
    along = (middle - wrist).normalized()
    across = pinky - index
    across = (across - along * across.dot(along)).normalized()
    normal = along.cross(across).normalized()
    inward = -1 if side == 'Left' else 1   # palms face the thighs in the rest pose
    if normal.x * inward < 0:
        normal = -normal
    grip = middle + normal * 0.022 - along * 0.005
    m = Matrix.Identity(4)
    for c, v in enumerate((across, along, normal, grip)):
        for r in range(3):
            m[r][c] = v[r]
    return m


def build_props(ctx, G):
    rig = ctx['rig']
    out = []
    for side in ('Left', 'Right'):
        b = Builder(G, f'dumbbell_{side[0]}')
        b.cyl(0.015, 0.015, 0.14, 'chrome')
        for x in (-0.085, 0.085):
            b.cyl(0.048, 0.048, 0.03, 'iron', at=(x, 0, 0))
            b.cyl(0.03, 0.03, 0.012, 'rubber', at=(x * 0.78, 0, 0))
        out.append(b.finish(palm_frame(rig, side), side + 'Hand'))
    left, right = palm_frame(rig, 'Left'), palm_frame(rig, 'Right')

    b = Builder(G, 'phone')
    b.box((0.072, 0.15, 0.009), 'phone', at=(0, 0.02, 0.006))
    b.box((0.066, 0.138, 0.002), 'screen', at=(0, 0.02, 0.011))
    out.append(b.finish(right, 'RightHand'))

    b = Builder(G, 'spoon')
    b.cyl(0.005, 0.005, 0.15, 'steel', at=(-0.02, 0, 0))
    b.sphere(0.022, 'steel', at=(-0.105, 0, 0.004), scale=(1.2, 0.8, 0.35))
    out.append(b.finish(right, 'RightHand'))

    b = Builder(G, 'plate')
    b.cyl(0.125, 0.10, 0.018, 'enamel', at=(0, 0.03, 0.03), axis='Z', segs=24)
    b.sphere(0.07, 'jollof', at=(0, 0.03, 0.045), scale=(1.2, 1.0, 0.45))
    b.sphere(0.025, 'green', at=(0.05, 0.06, 0.055), scale=(1.2, 1, 0.5))
    out.append(b.finish(left, 'LeftHand', level=True))

    b = Builder(G, 'bottle')
    b.cyl(0.032, 0.032, 0.17, 'glass', at=(0.02, 0, 0))
    b.cyl(0.033, 0.033, 0.06, 'label', at=(0.03, 0, 0))
    b.cyl(0.032, 0.012, 0.05, 'glass', at=(-0.09, 0, 0))
    b.cyl(0.013, 0.013, 0.012, 'gold', at=(-0.12, 0, 0))
    out.append(b.finish(right, 'RightHand'))

    b = Builder(G, 'ladle')
    b.cyl(0.011, 0.011, 0.36, 'wood', at=(0.12, 0, 0))
    b.sphere(0.05, 'steel', at=(0.31, 0, 0.0), scale=(1, 1, 0.6))
    out.append(b.finish(right, 'RightHand'))

    b = Builder(G, 'broom')   # praa: a bundle of palm-leaf ribs tied near the top, bristles down past the fingers
    b.cyl(0.03, 0.075, 0.62, 'straw', at=(0.25, 0, 0), segs=10)
    b.cyl(0.033, 0.033, 0.03, 'band', at=(-0.02, 0, 0), segs=10)
    out.append(b.finish(right @ Matrix.Rotation(-0.95, 4, 'Z'), 'RightHand'))

    b = Builder(G, 'wrench')
    b.box((0.2, 0.018, 0.008), 'steel', at=(0.03, 0, 0))
    b.cyl(0.024, 0.024, 0.01, 'steel', at=(0.14, 0, 0), axis='Z')
    out.append(b.finish(right, 'RightHand'))

    b = Builder(G, 'mic')
    b.cyl(0.016, 0.012, 0.16, 'phone', at=(0.02, 0, 0))
    b.sphere(0.026, 'chrome', at=(-0.075, 0, 0))
    out.append(b.finish(right, 'RightHand'))

    b = Builder(G, 'book')
    for sign in (-1, 1):
        tilt = Matrix.Rotation(sign * 0.18, 4, 'Y')
        b.box((0.14, 0.2, 0.012), 'paper', at=(sign * 0.072, 0.03, 0.02), rot=tilt)
        b.box((0.145, 0.205, 0.004), 'cover', at=(sign * 0.072, 0.03, 0.012), rot=tilt)
    out.append(b.finish(left, 'LeftHand'))

    bones = rig.data.bones
    crown = max((v.co for v in ctx['body'].data.vertices if abs(v.co.x) < 0.05), key=lambda c: c.z)
    top = Vector((0.0, crown.y, crown.z + 0.012))   # hair sits between scalp and the cloth ring
    b = Builder(G, 'headpan')   # aluminium headpan of oranges on a rolled cloth ring
    b.cyl(0.065, 0.065, 0.025, 'cloth', axis='Z', segs=14)
    b.cyl(0.17, 0.27, 0.11, 'alu', at=(0, 0, 0.07), axis='Z', segs=24)
    for k in range(9):
        a = k * 2 * math.pi / 9
        b.sphere(0.042, 'orange', at=(0.15 * math.cos(a), 0.15 * math.sin(a), 0.135))
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        b.sphere(0.042, 'orange', at=(0.06 * math.cos(a), 0.06 * math.sin(a), 0.16))
    out.append(b.finish(Matrix.Translation(top + Vector((0, 0, 0.005))), 'Head', level=True))

    hips, spine = bones['Hips'].head_local, bones['Spine1'].head_local
    b = Builder(G, 'guitar')   # body over the belly, neck up to the player's left
    b.sphere(0.17, 'wood', scale=(1.0, 0.36, 1.15))
    b.cyl(0.045, 0.045, 0.012, 'phone', at=(0, -0.065, 0.02), axis='Y')
    b.box((0.05, 0.03, 0.46), 'drumbody', at=(0, -0.01, 0.38))
    b.box((0.07, 0.035, 0.12), 'drumbody', at=(0, -0.01, 0.66))
    out.append(b.finish(Matrix.Translation(spine + Vector((-0.02, -0.16, -0.05))) @ Matrix.Rotation(1.1, 4, 'Y'), 'Spine1'))

    b = Builder(G, 'drum')   # djembe slung in front at hip height, head tilted to the player
    b.cyl(0.15, 0.15, 0.02, 'drumhead', axis='Z', segs=20)
    b.cyl(0.15, 0.08, 0.22, 'drumbody', at=(0, 0, -0.12), axis='Z', segs=20)
    b.cyl(0.08, 0.13, 0.2, 'drumbody', at=(0, 0, -0.32), axis='Z', segs=20)
    out.append(b.finish(Matrix.Translation(hips + Vector((0, -0.32, 0.12))) @ Matrix.Rotation(-0.5, 4, 'X'), 'Hips'))
    return out


def export_props(objs, path):
    """Static props in one GLB; node extras keep awd_bone / awd_level."""
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_extras=True, export_animations=False, export_skins=False,
                              export_cameras=False, export_lights=False)
    return path
