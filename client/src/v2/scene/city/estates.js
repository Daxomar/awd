// Two large features on the city map, both instanced so a whole field costs a handful of draw calls.
//
//  * Player estates: block after block of small plot houses in neat rows on their own green land, the way
//    a city of player-owned property reads from above. Colours are per plot, deterministic per city.
//  * The advertising field: live adverts (the ones booked on the city billboards, /api/billboards) laid
//    flat on the ground in a grid, so the map carries a visible sea of real artwork. Free ground shows
//    the house advert. This only displays adverts that are already live; it books and counts nothing.
//
// Everything is positioned in map metres inside CompactCity's group, beside the Blender landmarks.
import * as THREE from 'three';
import { prepareTexture, houseAdTexture } from '../billboard-face.js';
import { SCALE } from './geography.js';

// The map's own units are not metres: a landmark group of metre-sized parts is worn at 4*SCALE.
// These fields are drawn in metres and worn three times that, so a block reads as a district.
export const FIELD_SCALE = 4 * SCALE * 3;
export const widthOf = (f) => f.cols * f.gap * FIELD_SCALE;

export const PLOT = { cols: 26, rows: 14, gap: 17, w: 9.5, d: 8, h: 7 };
export const AD = { cols: 13, rows: 9, gap: 34, w: 30, d: 17 };
const WALLS = ['#f6d7a7', '#f2b5a0', '#bfe0c8', '#cfe0f5', '#f7e3b0', '#e6cdf0', '#ffd9c2', '#c9ecee'];
const ROOFS = ['#b2503c', '#8c5a3c', '#5d7f6b', '#9a6b4f'];
const UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3(1, 0, 0);

// Deterministic per city, so every player sees the same estate.
function seeded(text) {
  let s = [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// The ground every mapped place sits on, in map metres.
export function cityBounds(locations) {
  const xs = locations.map((l) => l.playable.x), zs = locations.map((l) => l.playable.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();

// The ground under a field, as a single instance: every mesh on the map is instanced and disposed alike.
function slab(w, d, colour, x, y, z) {
  const mesh = instanced(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: colour, roughness: 1 }), 1);
  mesh.setMatrixAt(0, _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(RIGHT, -Math.PI / 2), _s.set(1, 1, 1)));
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function instanced(geometry, material, count) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.userData.decorative = true; mesh.receiveShadow = true;
  return mesh;
}

// Rows of player plot houses on a green field, with a lane through the middle.
export function buildPlots(origin, seed = 'awd') {
  const rnd = seeded(seed + ':plots'), group = new THREE.Group();
  group.name = 'player-estates';
  const { cols, rows, gap, w, d, h } = PLOT, n = cols * rows;
  const width = cols * gap, depth = rows * gap;
  group.add(slab(width + gap, depth + gap, '#9fcf86', width / 2, 0.2, depth / 2));
  const walls = instanced(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ roughness: 0.9 }), n);
  const roofs = instanced(new THREE.ConeGeometry(w * 0.82, h * 0.55, 4), new THREE.MeshStandardMaterial({ roughness: 0.9 }), n);
  const yards = instanced(new THREE.PlaneGeometry(gap - 3.5, gap - 3.5), new THREE.MeshStandardMaterial({ color: '#e8f0dd', roughness: 1 }), n);
  let i = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++, i++) {
      const x = c * gap + (c >= cols / 2 ? 6 : 0), z = r * gap + (r >= rows / 2 ? 6 : 0);
      _q.identity();
      walls.setMatrixAt(i, _m.compose(_p.set(x, h / 2 + 0.3, z), _q, _s));
      walls.setColorAt(i, _c.set(WALLS[Math.floor(rnd() * WALLS.length)]));
      _q.setFromAxisAngle(UP, Math.PI / 4);
      roofs.setMatrixAt(i, _m.compose(_p.set(x, h + 0.3 + h * 0.275, z), _q, _s));
      roofs.setColorAt(i, _c.set(ROOFS[Math.floor(rnd() * ROOFS.length)]));
      _q.setFromAxisAngle(RIGHT, -Math.PI / 2);
      yards.setMatrixAt(i, _m.compose(_p.set(x, 0.35, z), _q, _s));
    }
  }
  for (const mesh of [walls, roofs, yards]) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; group.add(mesh); }
  group.position.set(origin.x, 0, origin.z);
  group.scale.setScalar(FIELD_SCALE);
  group.userData.size = { width: width * FIELD_SCALE, depth: depth * FIELD_SCALE };
  return group;
}

// A field of adverts lying flat on the ground: one instanced tile per distinct artwork.
export function buildAdField(origin, slots, renderer, loader = new THREE.TextureLoader()) {
  const group = new THREE.Group(); group.name = 'advert-field';
  const { cols, rows, gap, w, d } = AD, n = cols * rows;
  const width = cols * gap, depth = rows * gap;
  group.add(slab(width + gap, depth + gap, '#8fb4c9', width / 2, 0.15, depth / 2));
  const now = Date.now();
  const art = [...new Set((slots || []).flatMap((s) => (s.live || []).filter((a) => +a.ends > now).map((a) => a.img)).filter(Boolean))].slice(0, 10);
  const house = prepareTexture(houseAdTexture(), renderer);
  const buckets = art.length + 1, per = Math.ceil(n / buckets);
  const geometry = new THREE.PlaneGeometry(w, d);
  for (let b = 0; b < buckets; b++) {
    const count = Math.min(per, n - b * per); if (count <= 0) break;
    const texture = b === 0 ? house : prepareTexture(loader.load(art[b - 1]), renderer);
    const mesh = instanced(geometry, new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }), count);
    for (let k = 0; k < count; k++) {
      const idx = b * per + k, c = idx % cols, r = Math.floor(idx / cols);
      _q.setFromAxisAngle(RIGHT, -Math.PI / 2);
      mesh.setMatrixAt(k, _m.compose(_p.set(c * gap, 0.4 + (idx % 3) * 0.01, r * gap), _q, _s));
    }
    mesh.instanceMatrix.needsUpdate = true; group.add(mesh);
  }
  group.position.set(origin.x, 0, origin.z);
  group.scale.setScalar(FIELD_SCALE);
  group.userData.size = { width: width * FIELD_SCALE, depth: depth * FIELD_SCALE };
  group.userData.house = house;
  return group;
}

export function disposeField(group) {
  if (!group) return;
  const house = group.userData.house;
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.dispose?.();   // InstancedMesh: releases its buffers and tells listeners
    o.geometry.dispose();
    for (const m of [o.material].flat()) { if (m.map && m.map !== house) m.map.dispose?.(); m.dispose(); }
  });
  house?.dispose?.();
  group.removeFromParent();
}
