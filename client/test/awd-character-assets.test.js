// Contract checks for the Blender-built character assets (characters/ pipeline).
// Parses the GLB JSON chunk directly so the test needs no WebGL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WEAR } from '../../server/src/game/wardrobe.js';
import * as THREE from 'three';
import { sliderInfluence, SLIDERS, AwdTemplate, AwdCharacter } from '../src/v2/scene/awd-runtime.js';
import { resolveParts } from '../src/v2/scene/awd-avatar.js';

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
      assert.deepEqual(doc.animations.map((a) => a.name).sort(), ['agree', 'dance', 'idle', 'run', 'sad', 'shake', 'walk', 'wave']);
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
    for (const asset of Object.values(entry.assets)) {
      for (const path of [asset.asset, asset.lod1].filter(Boolean)) assert.ok(existsSync(join(ROOT, path)), `missing ${path}`);
    }
  }
});

test('every catalogue part shares the game skeleton and follows the body sliders', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'characters', 'manifest.json'), 'utf8'));
  const entries = Object.entries(manifest.appearance).flatMap(([slot, items]) => Object.entries(items).map(([id, e]) => [slot, id, e]));
  let checked = 0;
  for (const [slot, id, entry] of entries) {
    for (const [body, asset] of Object.entries(entry.assets)) {
      for (const [lod, path] of [[0, asset.asset], [1, asset.lod1]]) {
        if (!path) continue;
        const doc = glbJson(join(ROOT, path));
        const label = `${slot}:${id}:${body}:lod${lod}`;
        assert.equal(doc.skins[0].joints.length, 67, `${label} skeleton`);
        const morphs = morphNames(doc);
        for (const slider of Object.keys(SLIDERS)) assert.ok(morphs.has(slider), `${label} missing ${slider}`);
        if (slot === 'beard' && lod === 0) assert.ok(morphs.has('jawOpen'), `${label} must open with the jaw`);
        if (['top', 'bottom', 'full'].includes(slot)) {
          const hides = doc.nodes.map((n) => n.extras?.awd_hides_regions).filter((v) => v !== undefined);
          assert.ok(hides.length && hides.every((v) => Number.isInteger(v) && v >= 0), `${label} must declare covered regions`);
        }
        checked++;
      }
    }
  }
  assert.ok(checked >= 40, `only ${checked} part files checked`);
});

// Vertex positions of the GLB's meshes (glTF axes: +Y up, +Z towards the character's front).
function glbPositions(file, meshFilter = () => true) {
  const data = readFileSync(file);
  const length = data.readUInt32LE(12);
  const doc = JSON.parse(data.subarray(20, 20 + length).toString('utf8'));
  const bin = data.subarray(20 + length + 8);
  const out = [];
  for (const prim of doc.meshes.filter(meshFilter).flatMap((m) => m.primitives)) {
    const acc = doc.accessors[prim.attributes.POSITION];
    const view = doc.bufferViews[acc.bufferView];
    const stride = view.byteStride || 12, start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    for (let i = 0; i < acc.count; i++) out.push([0, 1, 2].map((k) => bin.readFloatLE(start + i * stride + k * 4)));
  }
  return out;
}

test('tops drape over the chest instead of shrink-wrapping an inflated one', () => {
  // Regression: garments were fitted against the evaluated body (every slider and expression
  // key at 1), which left the kaftan 4 cm proud of the pecs with pectoral-shaped bumps.
  const MAX_GAP = 0.028;
  for (const sex of ['male', 'female']) {
    const body = glbPositions(join(ASSETS, `awd_${sex}_base_lod0.glb`), (m) => m.name.startsWith('AWD_Body'));
    const height = Math.max(...body.map((p) => p[1]));
    const frontAt = (pts, y) => Math.max(...pts.filter((p) => Math.abs(p[1] - y) < 0.02 && Math.abs(p[0]) < 0.15).map((p) => p[2]));
    let chestY = height * 0.62;
    for (let y = chestY; y < height * 0.82; y += 0.01) if (frontAt(body, y) > frontAt(body, chestY)) chestY = y;
    for (const [id, item] of Object.entries(WEAR)) {
      const file = join(ASSETS, 'parts', `top_${id}_${sex}.glb`);
      if (item.slot !== 'top' || !existsSync(file)) continue;
      const gap = frontAt(glbPositions(file), chestY) - frontAt(body, chestY);
      assert.ok(gap > 0 && gap < MAX_GAP, `${sex} ${id} stands ${(gap * 100).toFixed(1)} cm off the chest`);
    }
  }
});

for (const sex of ['male', 'female']) {
  for (const lod of [0, 1, 2]) {
    const file = join(ASSETS, `awd_${sex}_base_lod${lod}.glb`);
    test(`${sex} base LOD${lod} carries body regions for runtime culling`, { skip: !existsSync(file) }, () => {
      const doc = glbJson(file);
      const body = doc.meshes.find((m) => m.name.startsWith('AWD_Body'));
      assert.ok(body, 'body mesh missing');
      assert.ok('_AWD_REGION' in body.primitives[0].attributes || '_awd_region' in body.primitives[0].attributes, 'region attribute missing');
      assert.equal(doc.skins[0].joints.length, 67);
      assert.ok(!doc.meshes.some((m) => /AWD_(Hair|Top|Bottom|Shoes)/.test(m.name)), 'base body must be undressed');
    });
  }
}

// Game integration (awd-avatar.js): saved looks map to existing part files with documented fallbacks.
const CATALOGUE = JSON.parse(readFileSync(join(ASSETS, 'catalogue.json'), 'utf8'));
const partExists = (file) => existsSync(join(ASSETS, file));

test('catalogue lists a runtime part for every wearable id and body', () => {
  for (const [id, item] of Object.entries(WEAR)) {
    const entry = CATALOGUE.slots[item.slot]?.[id];
    assert.ok(entry !== undefined, `${item.slot}:${id} missing from catalogue`);
    if (entry === null) continue;
    for (const body of item.g === 'u' ? ['m', 'f'] : [item.g]) {
      assert.ok(entry[body] && partExists(entry[body]), `${id} (${body}) has no runtime file`);
      assert.ok(partExists(entry[body].replace('_lod1.glb', '.glb')), `${id} (${body}) has no LOD0 file`);
    }
  }
});

test('resolveParts dresses a look in one file per slot', () => {
  const parts = resolveParts(CATALOGUE, { hair: 'locs', beard: 'goatee', top: 'fugu', bottom: 'chinos', shoes: 'ahenema', hat: 'nohat', glasses: 'shades', neck: 'chain' }, 'm');
  assert.deepEqual(parts, {
    hair: 'parts/hair_locs_male_lod1.glb', beard: 'parts/beard_goatee_male_lod1.glb', shoes: 'parts/shoes_ahenema_male_lod1.glb', hat: null,
    glasses: 'parts/glasses_shades_male_lod1.glb', neck: 'parts/neck_chain_male_lod1.glb', full: null,
    top: 'parts/top_fugu_male_lod1.glb', bottom: 'parts/bottom_chinos_male_lod1.glb',
  });
  for (const file of Object.values(parts).filter(Boolean)) assert.ok(partExists(file), file);
});

test('resolveParts: full outfits replace top and bottom; LOD0 uses the full-detail files', () => {
  const parts = resolveParts(CATALOGUE, { hair: 'bun', top: 'tee', bottom: 'jeans', full: 'kentedress', shoes: 'heels' }, 'f', 0);
  assert.equal(parts.full, 'parts/full_kentedress_female.glb');
  assert.equal(parts.top, null);
  assert.equal(parts.bottom, null);
  assert.equal(parts.beard, null, 'female bodies never wear a beard');
});

test('resolveParts: hats swap volume hair for lowcut and keep short styles', () => {
  assert.equal(resolveParts(CATALOGUE, { hair: 'afro', hat: 'cap', top: 'tee', bottom: 'jeans', shoes: 'slides' }, 'm').hair, 'parts/hair_lowcut_male_lod1.glb');
  assert.equal(resolveParts(CATALOGUE, { hair: 'fade', hat: 'cap', top: 'tee', bottom: 'jeans', shoes: 'slides' }, 'm').hair, 'parts/hair_fade_male_lod1.glb');
  assert.equal(resolveParts(CATALOGUE, { hair: 'bald', hat: 'nohat', top: 'tee', bottom: 'jeans', shoes: 'slides' }, 'm').hair, null);
});

test('resolveParts: ids not built for a body fall back to the default outfit', () => {
  const parts = resolveParts(CATALOGUE, { hair: 'bonestraight', top: 'kaba', bottom: 'slit', full: 'sundress', shoes: 'heels' }, 'm');
  assert.equal(parts.hair, 'parts/hair_lowcut_male_lod1.glb');
  assert.equal(parts.full, null);
  assert.equal(parts.top, 'parts/top_tee_male_lod1.glb');
  assert.equal(parts.bottom, 'parts/bottom_jeans_male_lod1.glb');
  assert.equal(parts.shoes, 'parts/shoes_slides_male_lod1.glb');
  assert.equal(resolveParts(CATALOGUE, { hair: 'puff', top: 'nonexistent', bottom: 'jeans', shoes: 'slides' }, 'f').top, 'parts/top_tee_female_lod1.glb');
});

test('catalogue revisions match the shipped files (cache busting for immutable GLBs)', () => {
  for (const [file, rev] of Object.entries(CATALOGUE.rev)) {
    const hash = createHash('sha1').update(readFileSync(join(ASSETS, file))).digest('hex').slice(0, 10);
    assert.equal(rev, hash, `${file} changed; rerun node characters/tools/build-manifest.mjs`);
  }
  for (const entry of Object.values(CATALOGUE.slots).flatMap((s) => Object.values(s)).filter(Boolean)) {
    for (const file of Object.values(entry)) assert.ok(CATALOGUE.rev[file], `${file} has no revision`);
  }
});

test('a long robe hides the trouser regions it covers; skin culling is unchanged', () => {
  // Two triangles per mesh: one in the pelvis region, one in the shin region.
  const BIT = { pelvis: 4, thigh: 9, shin: 11 };
  const part = (regions, userData) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Array(18).fill(0), 3));
    geometry.setAttribute('_awd_region', new THREE.Float32BufferAttribute(regions.flatMap((r) => [r, r, r]), 1));
    geometry.setIndex([0, 1, 2, 3, 4, 5]);
    return { geometry, userData };
  };
  const body = part([BIT.pelvis, BIT.shin], {});
  const trousers = part([BIT.pelvis, BIT.shin], { awdSlot: 'bottom', awdHides: (1 << BIT.pelvis) | (1 << BIT.shin) });
  const kaftan = { geometry: new THREE.BufferGeometry(), userData: { awdSlot: 'top', awdHides: 0, awdCovers: (1 << BIT.pelvis) | (1 << BIT.thigh) } };
  const character = { meshes: [body, trousers, kaftan], template: { culled: AwdTemplate.prototype.culled } };
  AwdCharacter.prototype.updateCulling.call(character);
  assert.equal(body.geometry.index.count, 0, 'skin under the trousers is hidden');
  assert.deepEqual([...trousers.geometry.index.array], [3, 4, 5], 'only the trouser leg below the robe is drawn');
  character.meshes = [body, trousers];   // robe taken off
  AwdCharacter.prototype.updateCulling.call(character);
  assert.equal(trousers.geometry.index.count, 6, 'trousers are whole again without the robe');
});

test('trouser parts carry body regions; long robes declare what they cover', () => {
  for (const sex of ['male', 'female']) {
    const jeans = glbJson(join(ASSETS, 'parts', `bottom_jeans_${sex}.glb`));
    assert.ok(jeans.meshes[0].primitives.every((p) => '_AWD_REGION' in p.attributes || '_awd_region' in p.attributes), `${sex} jeans regions`);
  }
  const kaftan = glbJson(join(ASSETS, 'parts', 'top_kaftan_male.glb'));
  assert.ok(kaftan.nodes.some((n) => n.extras?.awd_covers_regions > 0), 'kaftan covers the trousers under its tail');
  const tee = glbJson(join(ASSETS, 'parts', 'top_tee_male.glb'));
  assert.ok(!tee.nodes.some((n) => n.extras?.awd_covers_regions > 0), 'a tee hides no trousers');
});

test('looping clips the game holds as states are looped at runtime', () => {
  const runtime = readFileSync(join(ROOT, 'client', 'src', 'v2', 'scene', 'awd-runtime.js'), 'utf8');
  const looped = runtime.match(/const LOOPED = new Set\((\[[^\]]*\])\)/)[1];
  for (const clip of ['idle', 'walk', 'run', 'dance']) assert.ok(looped.includes(`'${clip}'`), `${clip} must loop (room.js holds it as a state)`);
});
