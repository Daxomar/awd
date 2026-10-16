"""Accra We Dey character pipeline: turntable preview renders for review.

Renders front, side, back, three-quarter and game-camera views of everything in
the scene with a neutral three-point light setup close to the game's daylight.
"""
import math
from pathlib import Path

import bpy
from mathutils import Vector

VIEWS = {
    # name: (azimuth degrees around the character, elevation degrees, distance factor)
    'front': (0, 4, 1.0),
    'three_quarter': (35, 6, 1.0),
    'side': (90, 4, 1.0),
    'back': (180, 4, 1.0),
    'game': (25, 48, 2.6),   # elevated third-person camera used in rooms and streets
    'face': (12, 2, 0.32),
}


def ensure_rig():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    world = scene.world or bpy.data.worlds.new('AWD_Preview_World')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (0.62, 0.66, 0.72, 1)
    bg.inputs[1].default_value = 0.55
    for name, energy, rot, color, size in [
        ('AWD_Key', 3.2, (52, 0, -38), (1.0, 0.95, 0.88), 0.6),
        ('AWD_Fill', 1.1, (65, 0, 62), (0.85, 0.9, 1.0), 2.0),
        ('AWD_Rim', 2.4, (60, 0, 170), (1.0, 0.98, 0.95), 0.3),
    ]:
        light = bpy.data.objects.get(name)
        if not light:
            light = bpy.data.objects.new(name, bpy.data.lights.new(name, 'SUN'))
            scene.collection.objects.link(light)
        light.data.energy = energy
        light.data.color = color
        light.data.angle = math.radians(size * 10)
        light.rotation_euler = [math.radians(a) for a in rot]
    if not bpy.data.objects.get('AWD_Floor'):
        mesh = bpy.data.meshes.new('AWD_Floor')
        s = 4
        mesh.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
        floor = bpy.data.objects.new('AWD_Floor', mesh)
        scene.collection.objects.link(floor)
        mat = bpy.data.materials.new('AWD_Floor')
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (0.42, 0.40, 0.37, 1)
        bsdf.inputs['Roughness'].default_value = 0.9
        mesh.materials.append(mat)
    cam = bpy.data.objects.get('AWD_Camera')
    if not cam:
        cam = bpy.data.objects.new('AWD_Camera', bpy.data.cameras.new('AWD_Camera'))
        scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 70
    return cam


def frame_camera(cam, view, height, centre_x=0.0):
    az, el, dist = VIEWS[view]
    z = {'face': 0.925, 'game': 0.5}.get(view, 0.52)
    target = Vector((centre_x, 0, height * z))
    radius = height * 2.15 * dist
    a, e = math.radians(az), math.radians(el)
    cam.location = target + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * radius
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()


def render_views(out_dir, prefix, views=('front', 'three_quarter', 'side', 'back', 'game', 'face'),
                 height=1.76, size=(540, 860), centre_x=0.0, samples=24):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    cam = ensure_rig()
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.eevee.taa_render_samples = samples
    paths = []
    for view in views:
        frame_camera(cam, view, height, centre_x)
        path = out / f'{prefix}_{view}.png'
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        paths.append(str(path))
    return paths
