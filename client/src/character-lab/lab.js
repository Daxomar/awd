// Character lab: validates the Blender-exported AWD character GLBs in Three.js with
// the game's renderer settings (scene/stage.js). Query parameters:
//   lod=0|1|2  n=instances  clip=idle|walk|wave  tone=1..8  expr=<expression>
//   cam=front|three_quarter|side|back|game|face  t=<seconds to freeze at>  hud=1
//   body=m|f  build|hips|bust|waist|shoulders|muscle|faceWidth|nose|lips|height=<0..1>
//   hair=<id> beard=<id>  hairs=<id,id,...> or beards=<id,id,...> (one character per style)
//   base=1: undressed body dressed from parts (top|bottom|full|shoes|hat|glasses|neck=<id>);
//   items=slot:id,slot:id,... one character per catalogue item over the default outfit
// window.__LAB exposes stats and controls for automated checks.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AwdTemplate, AwdCharacter, SKIN, EXPRESSIONS, SLIDERS } from '../v2/scene/awd-runtime.js';

const q = new URLSearchParams(location.search);
const lod = Number(q.get('lod') ?? 0);
const beardList = q.get('beards')?.split(',').filter(Boolean);
const itemList = q.get('items')?.split(',').filter(Boolean).map((s) => s.split(':'));
const base = q.has('base') || !!itemList;
const SLOTS = ['hair', 'beard', 'top', 'bottom', 'full', 'shoes', 'hat', 'glasses', 'neck'];
const NONE = new Set(['bald', 'nobeard', 'nohat', 'noglasses', 'nochain']);
const styles = q.get('hairs')?.split(',').filter(Boolean) || beardList?.map(() => q.get('hair') || '') || itemList?.map(() => '');
const count = styles ? styles.length : Math.max(1, Math.min(40, Number(q.get('n') ?? 1)));
const clip = q.get('clip') || 'idle', expr = q.get('expr') || 'neutral', view = q.get('cam') || 'three_quarter';
const freeze = q.has('t') ? Number(q.get('t')) : null;
const sex = q.get('body') === 'f' ? 'female' : 'male';
const sliders = Object.fromEntries(Object.keys(SLIDERS).concat('height').filter((k) => q.has(k)).map((k) => [k, Number(q.get(k))]));
const LAB = (window.__LAB = { ready: false, errors: [], stats: {} });
addEventListener('error', (e) => LAB.errors.push(String(e.message)));

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f6efe2');
scene.add(new THREE.HemisphereLight('#fff6e8', '#7d7366', 1.15));
const key = new THREE.DirectionalLight('#fff1dc', 2.1);
key.position.set(6, 10, 7);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
scene.add(key);
const fill = new THREE.DirectionalLight('#cfe0ff', 0.45);
fill.position.set(-20, 12, 10);
scene.add(fill);
const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: '#efe3cf', roughness: 1 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);

const VIEWS = {
  front: [0, 0.95, 4.2, 0.95], three_quarter: [2.2, 1.0, 3.6, 0.95], side: [4.2, 0.95, 0, 0.95],
  back: [0, 0.95, -4.2, 0.95], game: [3.4, 5.2, 6.2, 0.9], face: [0.25, 1.62, 0.85, 1.6],
  grid: [0.6, 1.62, 2.6, 1.45], gridback: [-0.6, 1.62, -2.6, 1.45], gridfull: [0.5, 1.1, 4.4, 0.85],
  gridfeet: [0.4, 0.55, 2.2, 0.15],
};
function frame() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  const [x, y, z, ty] = VIEWS[view] || VIEWS.three_quarter;
  const spread = count > 1 && !view.startsWith('grid') ? 1 + Math.sqrt(count) * 0.55 : 1;
  camera.position.set(x * spread, y * (view === 'game' ? spread : 1), z * spread);
  camera.lookAt(0, ty, 0);
  camera.updateProjectionMatrix();
}
addEventListener('resize', frame);

const characters = [];
const clock = new THREE.Clock();
let template = null;
const loader = new GLTFLoader();
const parts = new Map();
const partUrl = (slot, id) => `/assets/characters/prototype/parts/${slot}_${id}_${sex}${lod > 0 ? '_lod1' : ''}.glb`;
function loadPart(slot, id) {
  const url = partUrl(slot, id);
  if (!parts.has(url)) parts.set(url, loader.loadAsync(url).then((g) => new AwdTemplate(g)));
  return parts.get(url);
}
async function dressParts(c, hair, beard, extra = {}) {
  const outfit = { ...(base ? { hair: sex === 'male' ? 'fade' : 'twa', top: 'tee', bottom: 'jeans', shoes: 'sneakers' } : {}),
    ...Object.fromEntries(SLOTS.filter((k) => q.get(k)).map((k) => [k, q.get(k)])), ...extra };
  if (hair) outfit.hair = hair;
  if (beard) outfit.beard = beard;
  if (outfit.full) { delete outfit.top; delete outfit.bottom; c.detachSlot('top'); c.detachSlot('bottom'); }
  for (const slot of SLOTS) {
    const id = outfit[slot];
    if (!id) continue;
    if (NONE.has(id)) c.detachSlot(slot);
    else c.attachPart(slot, await loadPart(slot, id));
  }
}

function spawn(n) {
  const cols = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < n; i++) {
    const look = {
      skin: n === 1 ? Number(q.get('tone') || 5) : (i % 8) + 1,
      hairCol: ['#141010', '#3a2416', '#6b3e1f', '#8e1b1b'][i % 4],
      topCol: ['#f4f4f2', '#c8102e', '#1f6fb8', '#0e7a4e', '#f2b632'][i % 5],
      bottomCol: ['#2b3a55', '#17150f', '#3d5a80'][i % 3],
      ...sliders,
    };
    const c = new AwdCharacter(template, look);
    c.root.position.set((i % cols - (cols - 1) / 2) * 0.85, 0, -Math.floor(i / cols) * 0.9);
    c.play(n > 1 ? ['idle', 'walk', 'wave'][i % 3] : clip, 0);
    c.setExpression(n > 1 ? Object.keys(EXPRESSIONS)[i % 9] : expr);
    if (n > 1) c.mixer.setTime(i * 0.37);
    scene.add(c.root);
    characters.push(c);
  }
}
function clear() { for (const c of characters.splice(0)) c.dispose(); }

function measure() {
  renderer.render(scene, camera);
  let tris = 0, meshes = 0, colourAttr = false;
  const morphs = new Set(), bones = new Set();
  for (const c of characters) for (const m of c.meshes) {
    meshes++;
    tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
    Object.keys(m.morphTargetDictionary || {}).forEach((k) => morphs.add(k));
    if (m.material.name === 'AWD_Skin' && m.geometry.attributes.color && m.material.vertexColors) colourAttr = true;
    m.skeleton.bones.forEach((b) => bones.add(b.name));
  }
  const n = Math.max(1, characters.length), info = renderer.info;
  return {
    instances: characters.length, meshesPerCharacter: meshes / n, trianglesPerCharacter: Math.round(tris / n),
    drawCalls: info.render.calls, renderedTriangles: info.render.triangles, geometries: info.memory.geometries,
    textures: info.memory.textures, programs: info.programs.length,
    clips: Object.fromEntries(Object.entries(template.clips).map(([k, v]) => [k, +v.duration.toFixed(3)])),
    morphs: [...morphs].sort(), skinVertexColours: colourAttr, bones: bones.size,
    materials: [...new Set(characters.flatMap((c) => c.meshes.map((m) => m.material.name)))],
  };
}

// Spawn and dispose repeatedly; shared geometry and textures must stay stable.
function churnTest(rounds = 5, n = 6) {
  const before = { ...renderer.info.memory };
  for (let r = 0; r < rounds; r++) { spawn(n); renderer.render(scene, camera); clear(); }
  spawn(1);
  renderer.render(scene, camera);
  const after = { ...renderer.info.memory };
  return { before, after, stable: after.geometries <= before.geometries + 1 && after.textures <= before.textures + 1 };
}

loader.loadAsync(`/assets/characters/prototype/awd_${sex}_${base ? 'base' : 'prototype'}_lod${lod}.glb`).then(async (gltf) => {
  template = new AwdTemplate(gltf);
  frame();
  spawn(count);
  if (styles) {
    await Promise.all(characters.map((c, i) => {
      c.root.position.set((i - (styles.length - 1) / 2) * 0.5, 0, 0);
      c.setLook({ ...c.look, skin: 5, hairCol: '#141010', topCol: '#f4f4f2' });
      c.mixer.stopAllAction();
      c.current = null;
      c.play('idle', 0);
      c.mixer.setTime(freeze ?? 0.4);
      c.setExpression(expr);
      return dressParts(c, styles[i], beardList ? beardList[i] : q.get('beard'), itemList ? { [itemList[i][0]]: itemList[i][1] } : {});
    }));
  } else await Promise.all(characters.map((c) => dressParts(c, q.get('hair'), q.get('beard'))));
  if (freeze !== null) for (const c of characters) { c.mixer.setTime(freeze); c.applyMorphs(0); }
  LAB.stats = measure();
  Object.assign(LAB, {
    spawn, clear, characters, churnTest, measure, SKIN,
    setTone: (t) => characters.forEach((c) => c.setLook({ ...c.look, skin: t })),
    setExpression: (e) => characters.forEach((c) => c.setExpression(e)),
    play: (name) => characters.forEach((c) => c.play(name, 0)),
    ready: true,
  });
  document.getElementById('hud').textContent = q.has('hud') ? JSON.stringify(LAB.stats, null, 1) : '';
}).catch((e) => { LAB.errors.push(String(e?.stack || e)); });

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (freeze === null) for (const c of characters) c.update(dt);
  renderer.render(scene, camera);
});
