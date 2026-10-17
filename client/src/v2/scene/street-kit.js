// Fills a neighbourhood street plan (shared/local-streets.js) with the Blender street kit
// (world/scripts/build_street_kit.py -> /assets/world/street-kit.glb): container shops, kiosks, shop blocks
// and chop bars on the frontage lots, walled compound houses and two-storey blocks filling the blocks
// between streets, neem or coconut palms, electricity poles along the roads, vendor umbrellas and parked
// trotros. One InstancedMesh per kit mesh, so a whole 88 m neighbourhood costs a few dozen draw calls.
// Placement is deterministic per street, so every player sees the same neighbourhood.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { segmentProjection } from '../../../../shared/local-streets.js';

const KIT_URL = '/assets/world/street-kit.glb';
const WALLS = ['#f2e3c6', '#e8c9a0', '#cfe0d5', '#d9e4ef', '#f0d0c8', '#e9e1a9', '#c9d8b6', '#efe9df', '#f3d9b1', '#d7cbe6'];
// Footprints (x by z, metres) of the kit models, for fitting lots.
export const FOOTPRINT = { compound: [8, 7], storey: [6, 5], container: [6, 2.4], kiosk: [2.6, 2], chopbar: [5, 4] };
const FRONTAGE = ['container', 'kiosk', 'storey', 'chopbar', 'container', 'storey'];

let kitPromise = null;
export function loadStreetKit() {
  if (!kitPromise) {
    kitPromise = new GLTFLoader().loadAsync(KIT_URL).then((gltf) => {
      const parts = new Map();   // asset -> [{geometry, material, tint}]
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const [asset] = o.name.replace(/^kit_/, '').split('__');
        if (!parts.has(asset)) parts.set(asset, []);
        parts.get(asset).push({ geometry: o.geometry.clone().applyMatrix4(o.matrixWorld), material: o.material, tint: !!o.userData.tint });
      });
      return parts;
    });
    kitPromise.catch(() => { kitPromise = null; });
  }
  return kitPromise;
}

// Small deterministic random generator per street.
export function seeded(text) {
  let s = [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

const nearestRoad = (graph, x, z) => graph.segments.reduce((best, s) => {
  const p = segmentProjection([x, z], s.from, s.to), d = p.distance - s.width / 2;
  return d < best.d ? { d, x: p.x, z: p.z } : best;
}, { d: Infinity });

// Every placement for one street: [{asset, x, z, rot, scale, colour?}]. Nothing is placed on the walkable
// band of a road (width/2 + 1.25 m) or the central court.
export function planStreet(graph, style = 'urban') {
  const rnd = seeded(graph.id + ':v2'), out = [], half = graph.w / 2, taken = [], court = graph.court;
  const free = (x, z, r) => Math.abs(x) < half - r && Math.abs(z) < half - r && !taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + r);
  const inCourt = (x, z, pad) => Math.abs(x - court.x) < court.w / 2 + pad && Math.abs(z - court.z) < court.d / 2 + pad;
  const wall = () => WALLS[Math.floor(rnd() * WALLS.length)];
  const put = (asset, x, z, r, rot, scale, colour) => { taken.push({ x, z, r }); out.push({ asset, x, z, rot, scale, colour }); };
  // Frontage lots: shops and kiosks facing the road (role lots keep their own buildings).
  for (const lot of graph.lots) {
    taken.push({ x: lot.x, z: lot.z, r: Math.max(lot.w, lot.d) / 2 + 0.6 });
    if (lot.role !== 'scenery') continue;
    const asset = FRONTAGE[Math.floor(rnd() * FRONTAGE.length)], [fw, fd] = FOOTPRINT[asset];
    out.push({ asset, x: lot.x, z: lot.z, rot: lot.rot, scale: Math.min(1.15, lot.w / fw, (lot.d + 0.6) / fd), colour: wall() });
  }
  // Blocks between streets: compounds and storey blocks on a jittered grid, facing their nearest road.
  // Largest building that fits first: half its depth (plus the 1.25 m walkway) clear of the nearest road edge.
  const BLOCKS = [['compound', 3.8, 3.6], ['storey', 2.8, 2.9], ['kiosk', 1.4, 1.5]];
  for (let gx = -half + 5; gx <= half - 5; gx += 7) {
    for (let gz = -half + 5; gz <= half - 5; gz += 7) {
      const x = gx + (rnd() - 0.5) * 1.6, z = gz + (rnd() - 0.5) * 1.6, road = nearestRoad(graph, x, z);
      if (inCourt(x, z, 4)) continue;
      const fit = BLOCKS.find(([, gap, r]) => road.d >= gap + 1.25 && free(x, z, r) && (rnd() < 0.85 || gap < 3));
      if (fit) put(fit[0], x, z, fit[2], Math.atan2(road.x - x, road.z - z), 0.95 + rnd() * 0.12, wall());
    }
  }
  // Trees in the gaps that are left.
  const tree = () => (rnd() < (style === 'coastal' ? 0.75 : 0.25) ? 'palm' : 'neem');
  for (let k = 0; k < 140; k++) {
    const x = (rnd() * 2 - 1) * (half - 3), z = (rnd() * 2 - 1) * (half - 3);
    if (nearestRoad(graph, x, z).d < 2.4 || inCourt(x, z, 1) || !free(x, z, 1.8)) continue;
    put(tree(), x, z, 1.8, rnd() * Math.PI * 2, 0.85 + rnd() * 0.35);
  }
  // Along every road: electricity poles, vendor umbrellas and the odd parked trotro, just off the walkway.
  for (const s of graph.segments) {
    const dx = s.to[0] - s.from[0], dz = s.to[1] - s.from[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    const at = (t, off, side) => [s.from[0] + ux * t - uz * off * side, s.from[1] + uz * t + ux * off * side];
    for (let t = 6; t < len - 6; t += 13) {
      const [x, z] = at(t, s.width / 2 + 1.6, Math.floor(t / 13) % 2 ? 1 : -1);
      if (!inCourt(x, z, 0) && free(x, z, 0.5)) put('pole', x, z, 0.5, Math.atan2(ux, uz), 1);
    }
    if (rnd() < 0.7) {
      const [x, z] = at(len * (0.25 + rnd() * 0.5), s.width / 2 + 2.6, rnd() < 0.5 ? 1 : -1);
      if (!inCourt(x, z, 0) && free(x, z, 1.4)) put('umbrella', x, z, 1.4, rnd() * 6.28, 1);
    }
    if (len > 26 && rnd() < 0.35) {
      const [x, z] = at(len * (0.3 + rnd() * 0.4), s.width / 2 + 2.8, rnd() < 0.5 ? 1 : -1);
      if (!inCourt(x, z, 2) && free(x, z, 3.3)) put('trotro', x, z, 3.3, Math.atan2(ux, uz) + Math.PI / 2, 1);
    }
  }
  return out;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();

// Builds the instanced street group (async: the kit loads once per session).
export async function buildStreetKit(graph, style, { shadows = true } = {}) {
  const parts = await loadStreetKit();
  const plan = planStreet(graph, style), byAsset = new Map(), group = new THREE.Group();
  group.name = 'street-kit';
  for (const p of plan) { if (!byAsset.has(p.asset)) byAsset.set(p.asset, []); byAsset.get(p.asset).push(p); }
  for (const [asset, list] of byAsset) {
    for (const part of parts.get(asset) || []) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      list.forEach((p, i) => {
        _q.setFromAxisAngle(_up, p.rot); _p.set(p.x, 0, p.z); _s.setScalar(p.scale);
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
        if (part.tint) mesh.setColorAt(i, _c.set(p.colour || '#efe9df'));
      });
      mesh.castShadow = shadows && !['umbrella', 'pole'].includes(asset); mesh.receiveShadow = true;
      mesh.userData.decorative = true; mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }
  group.userData.plan = plan;
  return group;
}

// Free the per-street instancing buffers (geometry and materials belong to the shared kit).
export function disposeStreetKit(group) {
  group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  group.removeFromParent();
}
