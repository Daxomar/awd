import * as THREE from 'three';
import { SCALE, seeded } from './geography.js';
import { FAMILIES } from './districts.js';

const WALLS = ['#dfd5bd', '#d6bba2', '#c4c6b3', '#e6d8c2', '#bdc9c4', '#c8b69c'];
const ROOFS = ['#9c6350', '#aa7258', '#736d64', '#596c65', '#9a8d75', '#667b83'];
const dummy = new THREE.Object3D(), color = new THREE.Color();
// Every batch owns its instance buffers; the kit alone owns shared templates.
export class CityKit {
  constructor() {
    this.geometries = { box: new THREE.BoxGeometry(1, 1, 1), hip: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), tree: new THREE.IcosahedronGeometry(1, 0), cylinder: new THREE.CylinderGeometry(.5, .5, 1, 8) };
    this.geometries.hip.rotateY(Math.PI / 4);
    const triangle = new THREE.Shape([new THREE.Vector2(-.5, 0), new THREE.Vector2(.5, 0), new THREE.Vector2(0, 1)]);
    this.geometries.gable = new THREE.ExtrudeGeometry(triangle, { depth: 1, bevelEnabled: false }); this.geometries.gable.translate(0, -.5, -.5);
    const star=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.21:.5;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?star.lineTo(x,y):star.moveTo(x,y);}star.closePath();
    this.geometries.star=new THREE.ExtrudeGeometry(star,{depth:1,bevelEnabled:false});this.geometries.star.translate(0,0,-.5);
    this.material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .91 });
    this.disposed = false;
  }
  batch() { return new Parts(this); }
  dispose() { if (this.disposed) return; this.disposed = true; for (const g of Object.values(this.geometries)) g.dispose(); this.material.dispose(); }
}
export class Parts {
  constructor(kit) { this.kit = kit; this.items = new Map(); }
  add(kind, x, y, z, w, h, d, tint, angle = 0) {
    if (!this.items.has(kind)) this.items.set(kind, []);
    this.items.get(kind).push({ x, y, z, w, h, d, tint, angle });
  }
  box(x, y, z, w, h, d, tint, angle = 0) { this.add('box', x, y + h / 2, z, w, h, d, tint, angle); }
  finish() {
    const group = new THREE.Group();
    for (const [kind, list] of this.items) {
      const mesh = new THREE.InstancedMesh(this.kit.geometries[kind], this.kit.material, list.length);
      list.forEach((p, i) => {
        dummy.position.set(p.x * SCALE, p.y * SCALE, p.z * SCALE); dummy.scale.set(p.w * SCALE, p.h * SCALE, p.d * SCALE); dummy.rotation.set(0, p.angle, 0); dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(p.tint));
      });
      mesh.computeBoundingSphere(); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    }
    this.items.clear(); return group;
  }
}
export function disposeBatch(group) {
  // InstancedMesh.dispose releases the instance GPU buffers, not shared templates.
  group.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
  group.removeFromParent(); group.clear();
}
export function buildingBase(parts, p) {
  const r = seeded(p.seed), f = FAMILIES[p.family];
  const wall = r() < .60 ? f.wall : WALLS[Math.floor(r() * WALLS.length)];
  parts.box(p.x,-.7,p.z,p.w+9,.8,p.d+11,f.ground,p.angle);
  // Court houses are U-shaped, so the overview preserves actual negative space.
  const local = (x, z) => [p.x + x * Math.cos(p.angle) + z * Math.sin(p.angle), p.z - x * Math.sin(p.angle) + z * Math.cos(p.angle)];
  const block = (x, z, w, d) => { const [a, b] = local(x, z); parts.box(a, 0, b, w, p.h, d, wall, p.angle); };
  if (f.courtyard && p.w > 18) {
    block(0, -p.d * .32, p.w, p.d * .36); block(-p.w * .33, p.d * .14, p.w * .34, p.d * .58); block(p.w * .33, p.d * .14, p.w * .34, p.d * .58);
    // Separate wing roofs retain courtyard visibility from the city camera.
    for (const [x, z, w, d] of [[0, -p.d * .32, p.w, p.d * .36], [-p.w * .33, p.d * .14, p.w * .34, p.d * .58], [p.w * .33, p.d * .14, p.w * .34, p.d * .58]]) {
      const [a, b] = local(x, z); parts.box(a, p.h, b, w + 1.4, 1.5, d + 1.4, ROOFS[Math.floor(r() * ROOFS.length)], p.angle);
    }
  } else {
    block(0, 0, p.w, p.d);
    const roofColor = ROOFS[Math.floor(r() * ROOFS.length)];
    if (p.roof === 'flat') parts.box(p.x, p.h, p.z, p.w + 1, 1.5, p.d + 1, '#c7c2b2', p.angle);
    else {const pitch=f.warehouse ? .12 : .34;parts.add(p.roof === 'gable' ? 'gable' : 'hip', p.x, p.h + Math.min(p.w, p.d) * pitch/2, p.z, p.w + 3, Math.min(p.w, p.d) * pitch, p.d + 3, roofColor, p.angle);}
  }
}
export function buildingDetail(parts, p) {
  const r = seeded(p.seed), f = FAMILIES[p.family], c = Math.cos(p.angle), s = Math.sin(p.angle);
  const box = (x, y, z, w, h, d, tint) => parts.box(p.x + x * c + z * s, y, p.z - x * s + z * c, w, h, d, tint, p.angle);
  // Two facades, varied window rhythm, continuous commercial ground-floor shade.
  if (!f.courtyard || p.w <= 18) {
    const rows = Math.min(p.floors, 5), cols = Math.min(4, Math.floor(p.w / 6));
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const y = 2 + row * (p.h - 3) / rows, x = (col + .5) * p.w / cols - p.w / 2;
      box(x, y, p.d / 2 + .3, f.glass ? p.w / cols - 1.5 : 2.3, f.glass ? 4.8 : 2.5, .7, f.glass ? '#698d9b' : '#526d73');
    }
    for (let row = 1; row < rows; row++) box(0, row * p.h / rows, p.d / 2 + .6, p.w + 1, .7, 2.2, '#e5dfcf');
    box(-p.w * .22, 0, p.d / 2 + .6, 2.8, 4, .8, '#5b675f');
  }
  if (f.frontage) {
    box(0, 5, p.d / 2 + 3, p.w + 2, .9, 5, r() < .5 ? '#527e71' : '#be9263');
    box(p.w * .25, 0, p.d / 2 + 6, p.w * .38, 2.8, 3.6, '#b29b78');
  }
  if (f.boundary) {
    const w = p.w + 15, d = p.d + 17;
    box(0, 0, -d / 2, w, 3.5, 1.2, '#c7c4b3'); box(-w / 2, 0, 0, 1.2, 3.5, d, '#c7c4b3'); box(w / 2, 0, 0, 1.2, 3.5, d, '#c7c4b3');
    box(-w * .3, 0, d / 2, w * .4, 3.5, 1.2, '#c7c4b3'); box(w * .3, 0, d / 2, w * .4, 3.5, 1.2, '#c7c4b3');
    box(0, 0, d / 2, w * .2, 3.2, 1, '#637269');
  }
  if (f.warehouse) for (let x = -p.w * .3; x <= p.w * .31; x += p.w * .3) box(x, 0, p.d / 2 + .5, 6, 7, 1, '#728588');
  if (p.floors > 4) box(0, p.h + 1.5, 0, p.w * .35, 4, p.d * .35, '#acb6ad');
  else if (r() < .34) box(p.w * .2, p.h + 1.5, -p.d * .2, 3.8, 3, 3.8, '#56635c');
  if (r() < f.trees) {
    const x = p.x + (p.w / 2 + 7) * c, z = p.z - (p.w / 2 + 7) * s;
    tree(parts, x, z, 10 + r() * 7, r());
  }
}
export function tree(parts, x, z, height = 14, variant = 0) {
  parts.box(x, 0, z, 1.4, height * .6, 1.4, '#806b4b');
  parts.add('tree', x, height * .78, z, height * .6, height * .5, height * .6, variant < .5 ? '#6b8d64' : '#7e9b68');
}
