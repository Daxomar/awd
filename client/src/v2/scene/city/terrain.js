import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SCALE, roadWidth, arterial, seeded } from './geography.js';
import { tree } from './kit.js';

class Ribbons {
  constructor() { this.positions = []; this.colors = []; this.color = new THREE.Color(); }
  segment(a, b, width, y, tint) {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz); if (len < 1) return;
    const x = -dz / len * width / 2, z = dx / len * width / 2;
    const q = [[a[0] + x, a[1] + z], [b[0] + x, b[1] + z], [b[0] - x, b[1] - z], [a[0] - x, a[1] - z]];
    this.color.set(tint);
    for (const k of [0, 1, 2, 0, 2, 3]) { this.positions.push(q[k][0] * SCALE, y * SCALE, q[k][1] * SCALE); this.colors.push(this.color.r, this.color.g, this.color.b); }
  }
  finish() {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3)); geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true; return mesh;
  }
}
export function polygonMesh(rings, color, y = 0, basic = false) {
  const path = ring => ring.map(([x, z]) => new THREE.Vector2(x * SCALE, -z * SCALE));
  const shape = new THREE.Shape(path(rings[0])); for (const hole of rings.slice(1)) shape.holes.push(new THREE.Path(path(hole)));
  const material=basic?new THREE.MeshBasicMaterial({color}):new THREE.MeshStandardMaterial({color,roughness:.94});
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape),material); mesh.rotation.x = -Math.PI / 2; mesh.position.y = y * SCALE; mesh.receiveShadow = !basic; return mesh;
}
export function buildTerrain(data, kit) {
  const group = new THREE.Group(), [x0, x1, z0, z1] = data.boundsMeters;
  const base = polygonMesh([[[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]]], '#b7bd9b', -3); group.add(base);
  const ribbons = new Ribbons(), road = new Ribbons(), props = kit.batch(), localBatches = new Map(), localRoads = new THREE.Group();
  for (const g of data.green) group.add(polygonMesh(g.rings, '#97ab83', -1.7));
  // Natural-water polygons are real geometry; no ocean-colored rectangular mask.
  for (const rings of [...data.sea, ...data.water.map(w => w.rings)]) group.add(polygonMesh(rings, '#73aeb4', -.5,true));
  for (const shore of data.coast) for (let i = 1; i < shore.length; i++) {
    ribbons.segment(shore[i - 1], shore[i], 65, -.1, '#d7c8a5'); ribbons.segment(shore[i - 1], shore[i], 10, .1, '#b9d0c1');
  }
  const lamps = [], roadLabels = [];
  for (const route of data.roads) {
    const width = roadWidth(route.kind) * 1.4, major = arterial(route.kind), rng = seeded(route.osm);
    if (major && route.name && route.p.length > 4) roadLabels.push({ name: route.name, p: route.p[Math.floor(route.p.length / 2)], priority: /motorway|trunk|primary/.test(route.kind) ? 2 : 1 });
    for (let i = 1; i < route.p.length; i++) {
      const a = route.p[i - 1], b = route.p[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!major) {
        const key = `${Math.floor((a[0]+b[0])/6000)},${Math.floor((a[1]+b[1])/6000)}`;
        if (!localBatches.has(key)) localBatches.set(key,new Ribbons());
        localBatches.get(key).segment(a,b,width,1.1,'#a59f8e'); continue;
      }
      if (major) road.segment(a, b, width + 6, .7, '#d3cbb6');
      road.segment(a, b, width, 1.1, major ? '#777f79' : '#a59f8e');
      if (/motorway|trunk/.test(route.kind)) road.segment(a, b, 2.5, 1.3, '#9eae83');
      else if (/primary|secondary/.test(route.kind) && length > 45) {
        const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
        for (let t = 12; t < length - 10; t += 40) road.segment([a[0] + dx * t, a[1] + dz * t], [a[0] + dx * (t + 11), a[1] + dz * (t + 11)], .7, 1.4, '#e3d7ae');
      }
      if (major && length > 120 && rng() < .14) lamps.push({ a, b, width });
    }
  }
  // Original low-cost environmental silhouettes, fixed to sourced corridors.
  for (const { a, b, width } of lamps.slice(0, 600)) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / length, uz = (b[1] - a[1]) / length;
    const x = (a[0] + b[0]) / 2 - uz * (width / 2 + 3), z = (a[1] + b[1]) / 2 + ux * (width / 2 + 3);
    props.box(x, 0, z, 1.4, 18, 1.4, '#7f8270'); props.box(x, 18, z, 5, 1.5, 2, '#d5ccaa');
  }
  // Park silhouettes use actual green polygons; buildings are excluded there.
  for (const g of data.green) {
    const ring = g.rings[0], random = seeded(g.osm); if (ring.length < 4) continue;
    for (let i = 0; i < ring.length - 1; i += Math.max(1, Math.floor(ring.length / 5))) {
      const p = ring[i]; if (random() < .7) tree(props, p[0], p[1], 17 + random() * 10, random());
    }
  }
  for (const feature of data.features) if (feature.kind === 'runway') for (let i = 1; i < feature.p.length; i++) {
    road.segment(feature.p[i - 1], feature.p[i], 60, 1.6, '#78837f'); road.segment(feature.p[i - 1], feature.p[i], 1.5, 1.8, '#e6ded0');
  }
  group.add(ribbons.finish(), road.finish(), props.finish());
  // Water and green areas can contain hundreds of polygons. Batch by material
  // before exposing them to the renderer; source geometries are then reclaimed.
  const buckets = new Map(); group.updateMatrixWorld(true);
  for (const mesh of [...group.children]) if (mesh.isMesh && !mesh.isInstancedMesh) {
    const key = mesh.material.type+':'+mesh.material.color.getHexString() + ':' + mesh.material.vertexColors;
    if (!buckets.has(key)) buckets.set(key, { material: mesh.material, geometries: [] });
    const bucket = buckets.get(key); bucket.geometries.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    mesh.geometry.dispose(); if (mesh.material !== bucket.material) mesh.material.dispose(); group.remove(mesh);
  }
  for (const bucket of buckets.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(bucket.geometries), bucket.material); mesh.receiveShadow = true; group.add(mesh);
    for (const g of bucket.geometries) g.dispose();
  }
  for (const batch of localBatches.values()) localRoads.add(batch.finish());
  const waterMaterial=[...buckets.values()].find(b=>b.material.isMeshBasicMaterial)?.material;
  group.add(localRoads); return { group, roadLabels, localRoads,waterMaterial };
}
export function disposeTerrain(group) {
  group.traverse(o => { if (o.isMesh && !o.isInstancedMesh) { o.geometry.dispose(); o.material.dispose(); } else if (o.isInstancedMesh) o.dispose(); }); group.removeFromParent(); group.clear();
}
