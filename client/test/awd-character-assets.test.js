// Contract checks for the Blender-built character assets (characters/ pipeline).
// Parses the GLB JSON chunk directly so the test needs no WebGL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WEAR } from '../../server/src/game/wardrobe.js';
import { sliderInfluence, SLIDERS } from '../src/character-lab/awd-runtime.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSETS = join(ROOT, 'client', 'public', 'assets', 'characters', 'prototype');
const EXPRESSION_MORPHS = ['blink', 'jawOpen', 'smile', 'frown', 'mouthO', 'browUp', 'browDown', 'browInnerUp', 'squint'];
const GAME_BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'RightForeArm', 'LeftHandMiddle1', 'RightToeBase', 'LeftToe_End'];
const TRIANGLE_BUDGET = [30000, 15000, 5000];

function glbJson(file) {
  const data = readFileSync(file);
  assert.equal(data.readUInt32LE(0), 0x46546c67, `${file} is not a GLB`);
  const length = data.readUInt32LE(12);
  return JSON.parse(data.subarray(20, 20 + length).toString('utf8'));
}
const morphNames = (doc) => new Set(doc.meshes.flatMap((m) => m.extras?.targetNames || []));

for (const sex of ['male', 'female']) {
  for (const lod of [0, 1, 2]) {
    const file = join(ASSETS, `awd_${sex}_prototype_lod${lod}.glb`);
    test(`${sex} LOD${lod} keeps the game skeleton, clips and slider morphs`, { skip: !existsSync(file) }, () => {
      const doc = glbJson(file);
      const joints = doc.skins[0].joints.map((i) => doc.nodes[i].name);
      assert.equal(joints.length, 67);
      for (const bone of GAME_BONES) assert.ok(joints.includes(bone), `missing bone ${bone}`);
      assert.deepEqual(doc.animations.map((a) => a.name).sort(), ['idle', 'walk', 'wave']);
      const morphs = morphNames(doc);
      for (const slider of Object.keys(SLIDERS)) assert.ok(morphs.has(slider), `missing slider morph ${slider}`);
      for (const key of EXPRESSION_MORPHS) assert.equal(morphs.has(key), lod === 0, `expression ${key} at LOD${lod}`);
      const tris = doc.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + doc.accessors[p.indices].count / 3, 0);
      assert.ok(tris <= TRIANGLE_BUDGET[lod], `LOD${lod} has ${tris} triangles (budget ${TRIANGLE_BUDGET[lod]})`);
      for (const name of ['AWD_Brows', 'AWD_Lashes']) {
        const mat = doc.materials.find((m) => m.name === name);
        if (mat) assert.equal(mat.alphaMode, 'MASK', `${name} must be alpha-tested`);
      }
    });
  }
}

test('slider influence maps saved defaults to the unmorphed mesh and ends to ±1', () => {
  for (const [name, d] of Object.entries(SLIDERS)) {
    assert.equal(sliderInfluence(name, d), 0);
    assert.equal(sliderInfluence(name, 1), 1);
    assert.equal(sliderInfluence(name, 0), -1);
    assert.equal(sliderInfluence(name, undefined), 0, 'missing values fall back to the default');
  }
  assert.equal(sliderInfluence('build', 7), 1, 'out-of-range values are clamped');
});

test('manifest covers every wardrobe id and points at existing assets', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'characters', 'manifest.json'), 'utf8'));
  for (const [id, item] of Object.entries(WEAR)) {
    assert.ok(manifest.appearance[item.slot]?.[id], `manifest is missing ${item.slot}:${id}`);
  }
  for (const entry of Object.values(manifest.appearance).flatMap((slot) => Object.values(slot))) {
    for (const asset of Object.values(entry.assets)) assert.ok(existsSync(join(ROOT, asset.asset)), `missing ${asset.asset}`);
  }
});
