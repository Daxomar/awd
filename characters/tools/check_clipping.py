"""Measure skin poking through clothes while the character moves (headless Blender).

Usage:
    blender --background --factory-startup characters/source/awd_male_wardrobe.blend \
        --python characters/tools/check_clipping.py -- [out.json] [frames per clip]

For every wardrobe garment (AWD_W_top_*, bottom_*, full_*), every animation clip and a few
frames of it, the posed body and garment are evaluated. A body vertex counts as poking
through when it lies under the garment (a ray along its normal reaches the garment's inside)
but is not covered: it sits outside the cloth surface by more than TOLERANCE. Body regions
the runtime hides under that garment (awd_hides_regions) are skipped, as are the face, hands
and feet. Tops and full outfits are also checked against the baggiest trousers (joggers or
jeans) worn under them, since a striding leg can push the trousers out through a robe.
Prints and writes per garment the worst depth and the clip, frame and region where it happens.
"""
import json
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = Path(args[0]) if args else ROOT / 'characters' / 'previews' / 'wip' / 'clipping.json'
FRAMES = int(args[1]) if len(args) > 1 else 6
TOLERANCE = 0.002   # metres of skin outside the cloth that still reads as covered
SKIP = {'head', 'hand', 'foot'}

G = {'AWD_ROOT': str(ROOT), '__name__': 'awd_pipeline'}
exec(compile((ROOT / 'characters' / 'scripts' / 'awd_regions.py').read_text(), 'awd_regions.py', 'exec'), G)

body = next(o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('AWD_Body'))
rig = bpy.data.objects['AWD_Rig']
joints = json.loads(next(o for o in bpy.data.objects if o.name.endswith('_MHRig'))['awd_joints'])
region, _ = G['compute_regions']({'body': body, 'joints': joints})
names = G['REGIONS']
for o in bpy.data.objects:   # rest look: slider and expression keys at 0
    if o.type == 'MESH' and o.data.shape_keys:
        for k in o.data.shape_keys.key_blocks:
            k.value = 0.0
rig.data.pose_position = 'POSE'
garments = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(('AWD_W_top_', 'AWD_W_bottom_', 'AWD_W_full_'))]
clips = [a for a in bpy.data.actions if a.name in ('idle', 'walk', 'run', 'wave', 'agree', 'shake', 'sad', 'dance')]
scene = bpy.context.scene
rig.animation_data_create()


def evaluated(obj):
    ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    co = [v.co.copy() for v in me.vertices]
    nrm = [v.normal.copy() for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    ev.to_mesh_clear()
    return co, nrm, polys


trousers = bpy.data.objects.get('AWD_W_bottom_joggers') or bpy.data.objects.get('AWD_W_bottom_jeans')


def pokes(inner, mask, tree, label):
    """Inner-layer vertices (skin or trousers) sitting outside the garment's cloth."""
    co, nrm, _ = evaluated(inner)
    found = []
    for i in np.flatnonzero(mask):
        p, n = co[i], nrm[i]
        hit = tree.ray_cast(p - n * 0.02, n, 0.035)   # cloth just around this point? (short: thin limbs)
        if hit[0] is not None:
            depth = (p - hit[0]).dot(n)   # > 0: outside the cloth
            if depth > TOLERANCE:
                found.append((depth, label(i), p))
    return found


report = {}
for g in garments:
    hides = int(g.get('awd_hides_regions', 0))
    visible = np.array([names[r] not in SKIP and not (hides >> int(r)) & 1 for r in region])
    worst = {'depth': 0.0}
    count = 0
    under = trousers if trousers and g.name.startswith(('AWD_W_top_', 'AWD_W_full_')) else None
    for o in (g, under):   # exported parts are saved hidden, and hidden objects are not posed
        if o is not None:
            o.hide_viewport = False
            o.hide_set(False)
    for action in clips:
        rig.animation_data.action = action
        start, end = (int(x) for x in action.frame_range)
        for frame in np.linspace(start, end, FRAMES, endpoint=False).astype(int):
            scene.frame_set(int(frame))
            gco, _, gpolys = evaluated(g)
            tree = BVHTree.FromPolygons(gco, gpolys)
            found = pokes(body, visible, tree, lambda i: names[int(region[i])])
            if under is not None:
                found += pokes(under, np.ones(len(under.data.vertices), bool), tree, lambda i: under.name)
            count += len(found)
            for depth, where, p in found:
                if depth > worst['depth']:
                    worst = {'depth': round(depth, 4), 'clip': action.name, 'frame': int(frame),
                             'region': where, 'at': [round(c, 3) for c in p]}
    for o in (g, under):
        if o is not None:
            o.hide_viewport = True
    report[g.name] = {'poke_samples': count, **worst}
    print(g.name, report[g.name], flush=True)
OUT.write_text(json.dumps(report, indent=1))
print('CLIPPING DONE', OUT)
