// Build characters/manifest.json: the machine-readable map from saved appearance
// ids (server/src/game/wardrobe.js) to Blender-built assets, with export measurements.
// Usage: node characters/tools/build-manifest.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WEAR, SKIN, HAIR_COLORS, UNIFORM } from '../../server/src/game/wardrobe.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXPORT = join(ROOT, 'characters', 'export');
const RUNTIME = 'client/public/assets/characters/prototype';
const PART = /^(hair|top|bottom|full|shoes|hat|glasses|neck|beard)_([a-z]+)_(male|female)\.glb$/;

function report(sex) {
  const file = join(EXPORT, `awd_${sex}_prototype_report.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}
const reports = { male: report('male'), female: report('female') };

function rigBones() {
  const bones = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End', 'LeftEye', 'RightEye'];
  for (const side of ['Left', 'Right']) {
    bones.push(...['Shoulder', 'Arm', 'ForeArm', 'Hand'].map((b) => side + b));
    for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (let k = 1; k <= 4; k++) bones.push(`${side}Hand${f}${k}`);
    bones.push(...['UpLeg', 'Leg', 'Foot', 'ToeBase', 'Toe_End'].map((b) => side + b));
  }
  return bones;
}

function bodyEntry(sex) {
  const r = reports[sex];
  const lods = Object.fromEntries([0, 1, 2].map((lod) => {
    const name = `awd_${sex}_prototype_lod${lod}.glb`, d = r[name];
    return [lod, d ? { asset: `${RUNTIME}/${name}`, bytes: d.bytes, triangles: d.triangles, meshes: d.meshes } : null];
  }));
  return {
    status: r[`awd_${sex}_prototype_lod0.glb`] ? 'prototype' : 'planned', rig: 'awd_adult_v1',
    height: sex === 'male' ? 1.76 : 1.68, source: `characters/source/awd_${sex}_prototype.blend`, lods,
  };
}

function appearanceMap() {
  const built = {};
  for (const [sex, r] of Object.entries(reports)) {
    for (const [file, d] of Object.entries(r)) {
      const m = file.match(PART);
      if (m) (built[m[2]] ??= {})[sex[0]] = { asset: `${RUNTIME}/parts/${file}`, bytes: d.bytes, triangles: d.triangles };
    }
  }
  const out = {};
  for (const [id, item] of Object.entries(WEAR)) {
    const bodies = item.g === 'u' ? ['m', 'f'] : [item.g], assets = built[id] || {};
    const status = bodies.every((b) => assets[b]) ? 'done' : Object.keys(assets).length ? 'partial' : 'planned';
    (out[item.slot] ??= {})[id] = { name: item.name, bodies, price: item.price, colours: item.colors || null, status, assets };
  }
  return out;
}

const appearance = appearanceMap();
const manifest = {
  version: 1,
  generated: new Date().toISOString().slice(0, 10),
  pipeline: { build: 'characters/scripts/build_prototype.py', capture: 'characters/tools/capture_lab.py', lab: 'client/character-lab.html' },
  units: { length: 'm', up: '+Y', forward: '+Z', fps: 30 },
  licences: { anatomy: 'MakeHuman Community base mesh, targets and weights, CC0 1.0', artwork: 'Original procedural textures and geometry, Accra We Dey' },
  rigs: { awd_adult_v1: { bones: 67, names: rigBones(), nonDeforming: ['HeadTop_End', '*Toe_End', '*Hand*4'], rest: 'relaxed A-pose' } },
  bodies: { m: bodyEntry('male'), f: bodyEntry('female') },
  materials: {
    AWD_Skin: { tint: 'SKIN[look.skin] x 1/0.9 into baseColor; COLOR_0 holds AO and tonal detail', tones: SKIN },
    'AWD_Hair_*': { tint: 'look.hairCol x 1/0.78', colours: HAIR_COLORS, alpha: 'MASK 0.5 for fades' },
    AWD_Brows: { tint: 'look.hairCol x 1/0.78', alpha: 'MASK 0.45' },
    'AWD_Fabric_*': { tint: 'slot colour (topCol, bottomCol, fullCol)' },
    'AWD_Shoe_*_upper': { tint: 'look.shoesCol' },
  },
  morphs: ['blink', 'jawOpen', 'smile', 'frown', 'mouthO', 'browUp', 'browDown', 'browInnerUp', 'squint'],
  expressions: {
    neutral: {}, happy: { smile: 0.85, squint: 0.35, browUp: 0.15 }, sad: { frown: 0.8, browInnerUp: 0.8, squint: 0.1 },
    angry: { browDown: 1, frown: 0.35, squint: 0.45 }, surprised: { browUp: 1, jawOpen: 0.35, mouthO: 0.35 },
    concerned: { browInnerUp: 0.75, frown: 0.3, browDown: 0.15 }, laughing: { smile: 1, jawOpen: 0.55, squint: 0.7, browUp: 0.2 },
    talking: { jawOpen: 0.3, mouthO: 0.2 }, blinking: { blink: 1 },
  },
  animations: {
    idle: { loop: true, status: 'done' }, walk: { loop: true, inPlace: true, status: 'done' }, wave: { loop: false, status: 'done' },
    run: { loop: true, status: 'planned' }, agree: { loop: false, status: 'planned' }, shake: { loop: false, status: 'planned' },
    sad: { loop: false, status: 'planned' }, dance: { loop: true, status: 'planned' },
  },
  uniforms: Object.keys(UNIFORM),
  appearance,
};
writeFileSync(join(ROOT, 'characters', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const counts = {};
for (const slot of Object.values(appearance)) for (const e of Object.values(slot)) counts[e.status] = (counts[e.status] || 0) + 1;
console.log('manifest written', counts);
