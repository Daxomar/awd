"""Accra We Dey character pipeline, stage 4: the shared 67-bone game skeleton.

Bone names follow the convention the game already uses (Hips, Spine, Spine1,
Spine2, Neck, Head, LeftArm, LeftHandIndex1, ...), so procedural poses and
existing lookups keep working. Bones are placed on the MakeHuman joints of the
stylized body and weights are the authored MakeHuman weights summed into the
game bones, limited to four influences for glTF/Three.js.
"""
import bpy
import numpy as np
from mathutils import Vector

FINGERS = {'Thumb': 1, 'Index': 2, 'Middle': 3, 'Ring': 4, 'Pinky': 5}


def game_bone_specs(J):
    """Return [(name, head, tail, parent, roll_source)] in armature space."""
    j = lambda name: Vector(J[name])  # noqa: E731
    specs = [
        ('Hips', j('spine05____head'), j('spine04____head'), None, 'spine05'),
        ('Spine', j('spine04____head'), j('spine02____head'), 'Hips', 'spine04'),
        ('Spine1', j('spine02____head'), j('spine01____head'), 'Spine', 'spine02'),
        ('Spine2', j('spine01____head'), j('neck01____head'), 'Spine1', 'spine01'),
        ('Neck', j('neck01____head'), j('head____head'), 'Spine2', 'neck01'),
        ('Head', j('head____head'), j('head____tail'), 'Neck', 'head'),
        ('HeadTop_End', j('head____tail'), j('head____tail') + Vector((0, 0, 0.05)), 'Head', 'head'),
    ]
    for side, s, mh in (('Left', 'L', 'l'), ('Right', 'R', 'r')):
        p = lambda name: j(f'{name}.{s}____head')  # noqa: E731
        t = lambda name: j(f'{name}.{s}____tail')  # noqa: E731
        eye_dir = (t('eye') - p('eye')).normalized()
        specs.append((f'{side}Eye', p('eye'), p('eye') + eye_dir * 0.02, 'Head', f'eye.{s}'))
        specs += [
            (f'{side}Shoulder', p('clavicle'), p('upperarm01'), 'Spine2', f'clavicle.{s}'),
            (f'{side}Arm', p('upperarm01'), p('lowerarm01'), f'{side}Shoulder', f'upperarm02.{s}'),
            (f'{side}ForeArm', p('lowerarm01'), p('wrist'), f'{side}Arm', f'lowerarm01.{s}'),
            (f'{side}Hand', p('wrist'), p('finger3-1'), f'{side}ForeArm', f'wrist.{s}'),
        ]
        for finger, n in FINGERS.items():
            heads = [p(f'finger{n}-{k}') for k in (1, 2, 3)] + [t(f'finger{n}-3')]
            tip = heads[3] + (heads[3] - heads[2]).normalized() * 0.012
            heads.append(tip)
            parent = f'{side}Hand'
            for k in range(4):
                name = f'{side}Hand{finger}{k + 1}'
                specs.append((name, heads[k], heads[k + 1], parent, f'finger{n}-{min(k + 1, 3)}.{s}'))
                parent = name
        ball = sum((p(f'toe{n}-1') for n in range(1, 6)), Vector()) / 5
        toe_tip = t('toe3-3')
        specs += [
            (f'{side}UpLeg', p('upperleg01'), p('lowerleg01'), 'Hips', f'upperleg02.{s}'),
            (f'{side}Leg', p('lowerleg01'), p('foot'), f'{side}UpLeg', f'lowerleg01.{s}'),
            (f'{side}Foot', p('foot'), ball, f'{side}Leg', f'foot.{s}'),
            (f'{side}ToeBase', ball, toe_tip, f'{side}Foot', f'toe3-1.{s}'),
            (f'{side}Toe_End', toe_tip, toe_tip + (toe_tip - ball).normalized() * 0.02, f'{side}ToeBase', f'toe3-1.{s}'),
        ]
    return specs


def mh_to_game(bone):
    """Map one MakeHuman deform bone to the game bone that receives its weight."""
    base, _, s = bone.partition('.')
    side = {'L': 'Left', 'R': 'Right'}.get(s, '')
    if base in ('root', 'spine05') or base == 'pelvis':
        return 'Hips'
    if base in ('spine04', 'spine03'):
        return 'Spine'
    if base in ('spine02', 'breast'):
        return 'Spine1'
    if base == 'spine01':
        return 'Spine2'
    if base.startswith('neck'):
        return 'Neck'
    if base == 'eye':
        return side + 'Eye'
    if base == 'clavicle':
        return side + 'Shoulder'
    if base in ('shoulder01', 'upperarm01', 'upperarm02'):
        return side + 'Arm'
    if base.startswith('lowerarm'):
        return side + 'ForeArm'
    if base in ('wrist',) or base.startswith('metacarpal'):
        return side + 'Hand'
    if base.startswith('finger'):
        n, k = base[6:].split('-')
        finger = {v: f for f, v in FINGERS.items()}[int(n)]
        return f'{side}Hand{finger}{k}'
    if base.startswith('upperleg'):
        return side + 'UpLeg'
    if base.startswith('lowerleg'):
        return side + 'Leg'
    if base == 'foot':
        return side + 'Foot'
    if base.startswith('toe'):
        return side + 'ToeBase'
    return 'Head'   # head, jaw and every facial bone


def build_game_rig(ctx, name='AWD_Rig'):
    J = ctx['joints']
    mh = ctx['mh_rig'].data
    data = bpy.data.armatures.new(name)
    rig = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    specs = game_bone_specs(J)
    for bname, head, tail, parent, roll_from in specs:
        eb = data.edit_bones.new(bname)
        eb.head, eb.tail = head, tail
        if roll_from in mh.bones:
            eb.align_roll(mh.bones[roll_from].z_axis)
    for bname, _, _, parent, _ in specs:
        if parent:
            data.edit_bones[bname].parent = data.edit_bones[parent]
            data.edit_bones[bname].use_connect = False
    for bname in [s[0] for s in specs]:
        eb = data.edit_bones[bname]
        eb.use_deform = not bname.endswith(('Toe_End', 'HeadTop_End')) and not bname[-1] == '4'
    bpy.ops.object.mode_set(mode='OBJECT')
    data.display_type = 'OCTAHEDRAL'
    rig['awd_rig_version'] = 1
    return rig


def convert_weights(obj, rig, max_influences=4):
    """Sum MakeHuman groups into game groups, keep the 4 largest and normalise."""
    names = [g.name for g in obj.vertex_groups]
    target = {n: mh_to_game(n) for n in names}
    game_names = sorted({v for v in target.values()} & {b.name for b in rig.data.bones})
    count = len(obj.data.vertices)
    weights = np.zeros((count, len(game_names)))
    column = {n: i for i, n in enumerate(game_names)}
    index_to_name = {g.index: g.name for g in obj.vertex_groups}
    for v in obj.data.vertices:
        for ge in v.groups:
            game = target[index_to_name[ge.group]]
            if game in column:
                weights[v.index, column[game]] += ge.weight
    order = np.argsort(-weights, axis=1)
    trimmed = np.zeros_like(weights)
    rows = np.arange(count)[:, None]
    keep = order[:, :max_influences]
    trimmed[rows, keep] = weights[rows, keep]
    total = trimmed.sum(axis=1, keepdims=True)
    missing = np.flatnonzero(total[:, 0] <= 1e-8)
    if len(missing):
        raise ValueError(f'{obj.name}: {len(missing)} vertices have no game weight')
    trimmed /= total
    obj.vertex_groups.clear()
    for name in game_names:
        group = obj.vertex_groups.new(name=name)
        col = trimmed[:, column[name]]
        for vid in np.flatnonzero(col > 1e-4):
            group.add([int(vid)], float(col[vid]), 'REPLACE')
    for mod in obj.modifiers:
        if mod.type == 'ARMATURE':
            mod.object = rig
    obj.parent = rig
    return game_names
