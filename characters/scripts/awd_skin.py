"""Accra We Dey character pipeline, stage 5: skin shading.

One neutral skin material serves all eight saved skin tones: the game sets the
glTF base colour factor to the player's tone, and a baked vertex colour layer
(COLOR_0) supplies everything that should not change with tone - ambient
occlusion in creases, warmer lips and cheeks, lighter palms, soles and nails.
"""
import math

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

# The saved palette (server/src/game/wardrobe.js SKIN). sRGB hex per tone id.
SKIN_TONES = {1: '#f3cfb0', 2: '#e2b08a', 3: '#c68a5f', 4: '#a26a45',
              5: '#7d4b2e', 6: '#5f3621', 7: '#472616', 8: '#33190d'}
# Vertex colour headroom: palms reach 1.0, ordinary skin sits at BASE, so the
# runtime factor is tone / BASE (clamped to 1) to reproduce the saved tone.
BASE = 0.9


def srgb_to_linear(hex_colour):
    c = np.array([int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def tone_factor(tone):
    return np.minimum(srgb_to_linear(SKIN_TONES[tone]) / BASE, 1.0)


def ambient_occlusion(objects, target, rays=24, distance=0.06, seed=3):
    """Per-vertex AO for target against all objects (rest pose), via ray casting."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    trees = [BVHTree.FromObject(o, depsgraph) for o in objects]
    rng = np.random.default_rng(seed)
    dirs = rng.normal(size=(rays, 3))
    dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
    me = target.data
    normals = np.array([v.normal[:] for v in me.vertices])
    co = np.array([v.co[:] for v in me.vertices])
    ao = np.ones(len(co))
    for i, (p, n) in enumerate(zip(co, normals)):
        hemi = dirs * np.sign(dirs @ n)[:, None]
        origin = Vector(p + n * 0.0008)
        blocked = 0.0
        for d in hemi:
            dv = Vector(d)
            for tree in trees:
                hit = tree.ray_cast(origin, dv, distance)
                if hit[0] is not None:
                    blocked += 1 - hit[3] / distance
                    break
        ao[i] = 1 - blocked / rays
    return ao


def tonal_map(ctx, co):
    """Multiplicative RGB tint per vertex, before AO."""
    J = ctx['joints']
    tint = np.full((len(co), 3), BASE)
    def g(centre, radius):
        return np.exp(-(np.linalg.norm(co - np.array(centre), axis=1) / radius) ** 2)
    eyes = [np.array(J[f'eye.{s}____head']) for s in ('L', 'R')]
    mouth_z = eyes[0][2] - 0.052
    lips = np.exp(-(co[:, 0] / 0.024) ** 6) * np.exp(-((co[:, 2] - mouth_z) / 0.0085) ** 4) * (co[:, 1] < eyes[0][1] - 0.01)
    tint *= (1 - lips[:, None] * np.array([0.10, 0.22, 0.20]))
    for e in eyes:
        cheek = e + np.array([np.sign(e[0]) * 0.02, -0.005, -0.03])
        tint *= (1 - (0.05 * g(cheek, 0.025))[:, None] * np.array([-0.4, 0.6, 0.6]))
        lid = e + np.array([0, -0.006, 0.006])
        tint *= (1 - (0.10 * g(lid, 0.014))[:, None])
    for side in ('L', 'R'):
        wrist = np.array(J[f'wrist.{side}____head'])
        tip = np.array(J[f'finger3-3.{side}____tail'])
        axis = (tip - wrist) / np.linalg.norm(tip - wrist)
        hand = (np.linalg.norm(co - wrist, axis=1) < 0.2) & (((co - wrist) @ axis) > -0.01)
        palm_dir = np.array([-np.sign(wrist[0]) * 0.5, -0.25, -0.8])   # A-pose palms face inward-down
        palm_dir /= np.linalg.norm(palm_dir)
        palm = hand * np.clip(((co - wrist) - np.outer((co - wrist) @ axis, axis)) @ palm_dir / 0.012, 0, 1)
        tint = tint * (1 - palm[:, None] * 0.45) + palm[:, None] * 0.45 * np.array([1.0, 0.92, 0.86])
        for n in range(1, 6):
            nail_tip = np.array(J[f'finger{n}-3.{side}____tail'])
            tint = tint * (1 - 0.5 * g(nail_tip, 0.006)[:, None]) + 0.5 * g(nail_tip, 0.006)[:, None] * np.array([1.0, 0.86, 0.82])
    sole = np.clip((0.012 - co[:, 2]) / 0.01, 0, 1)
    tint = tint * (1 - sole[:, None] * 0.5) + sole[:, None] * 0.5 * np.array([1.0, 0.9, 0.84])
    return np.clip(tint, 0, 1)


def bake_skin_colours(ctx, occluders):
    body = ctx['body']
    co = np.array([v.co[:] for v in body.data.vertices])
    ao = ambient_occlusion(occluders, body)
    # Faces read best with gentle occlusion; creases on the body can take more.
    head = np.clip((co[:, 2] - (ctx['joints']['neck03____head'][2] - 0.02)) / 0.04, 0, 1)
    strength = 0.55 * (1 - head) + 0.28 * head
    colour = tonal_map(ctx, co) * (1 - strength * (1 - ao ** 1.2))[:, None]
    attr = body.data.color_attributes.get('Col') or body.data.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    rgba = np.concatenate([colour, np.ones((len(co), 1))], axis=1)
    attr.data.foreach_set('color', rgba.ravel())
    body.data.color_attributes.active_color = attr
    return ao


def skin_material(tone=5):
    mat = bpy.data.materials.get('AWD_Skin') or bpy.data.materials.new('AWD_Skin')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    for n in [n for n in nodes if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL')]:
        nodes.remove(n)
    bsdf = nodes['Principled BSDF']
    attr = nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs['A'].default_value = (*tone_factor(tone), 1)
    links.new(attr.outputs['Color'], mix.inputs['B'])
    links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.52
    bsdf.inputs['Specular IOR Level'].default_value = 0.45
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.0
    mat['awd_tone'] = tone
    return mat


def set_tone(tone):
    mat = bpy.data.materials['AWD_Skin']
    mix = next(n for n in mat.node_tree.nodes if n.type == 'MIX')
    mix.inputs['A'].default_value = (*tone_factor(tone), 1)
    mat['awd_tone'] = tone
