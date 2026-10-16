// Collapse a group of meshes into a handful of draw calls: every plain coloured material becomes one vertex-coloured
// mesh, everything textured / emissive / double-sided / flat-shaded is merged per material.
// material.userData.flat = true → merged mesh does not cast shadows (ground planes).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 });
export function bake(group, { keepSkinned = true } = {}) {
  group.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(); const rel = new THREE.Matrix4();
  const buckets = new Map(); const meshes = []; const keep = [];
  group.traverse((m) => { if (!m.isMesh) return; if ((keepSkinned && m.isSkinnedMesh) || m.userData.keep) keep.push(m); else meshes.push(m); });
  for (const m of meshes) {
    const mt = m.material; if (Array.isArray(mt)) { keep.push(m); continue; }
    const plain = mt.isMeshStandardMaterial && !mt.map && !mt.transparent && mt.emissive.getHex() === 0 && mt.side !== THREE.DoubleSide && !mt.flatShading && !mt.userData.own;
    const key = plain ? 'vc' : mt.uuid; if (!buckets.has(key)) buckets.set(key, { mat: plain ? VC : mt, list: [] });
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld));
    const authoredColors=mt.vertexColors?g.attributes.color:null;
    for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (plain) { const n = g.attributes.position.count, c = new Float32Array(n * 3), col = mt.color; for (let i = 0; i < n; i++) { c[i * 3] = col.r*(authoredColors?.getX(i)??1); c[i * 3 + 1] = col.g*(authoredColors?.getY(i)??1); c[i * 3 + 2] = col.b*(authoredColors?.getZ(i)??1); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    g.morphAttributes = {}; buckets.get(key).list.push(g);
  }
  for (const c of group.children.slice()) group.remove(c);
  for (const { mat: mm, list } of buckets.values()) { const merged = list.length === 1 ? list[0] : mergeGeometries(list, false); if (list.length > 1) for (const l of list) l.dispose();
    const mesh = new THREE.Mesh(merged, mm); mesh.castShadow = !mm.userData.flat; mesh.receiveShadow = true; group.add(mesh); }
  for (const k of keep) { k.updateMatrixWorld(true); const mw = new THREE.Matrix4().multiplyMatrices(inv, k.matrixWorld); k.matrix.copy(mw); k.matrix.decompose(k.position, k.quaternion, k.scale); group.add(k); }
  return group;
}
