// Accra diorama: landmarks retain real place coordinates and the coastline.
// Major roads are schematic; this is a simulation map rather than a navigation map.
import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { makeItem, mat, T } from './kit.js';
import { bake } from './bake.js';

const COLS = 8, ROWS = 11, PITCH = 8, BLOCK = 1.8, K = 0.09; // grid, block pitch (map units), kit metres → map units
const BM = BLOCK / K; // block size in metres (plot builders work in metres)
const W = COLS * PITCH, H = ROWS * PITCH;
const cx = (c) => (c - (COLS - 1) / 2) * PITCH, cz = (r) => (r - (ROWS - 1) / 2) * PITCH;
const BOUNDS = { x0: -W / 2, x1: W / 2, z0: -H / 2, z1: H / 2 + 6 };
const COAST = new Set(['bukom', 'lighthouse', 'canoes', 'h:jtown', 'kenkey', 'castle', 'hotel', 'labadi']);
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
let R = rng(7); const pick = (a) => a[Math.floor(R() * a.length)]; const rr = (a, b) => a + R() * (b - a);
const AREA_COL = { Circle: ['#e9d8b4', '#f1c6a0', '#d9e4c8', '#f3e3a6'], 'Accra Central': ['#f1d2a8', '#e8c39b', '#efe0c0', '#f2b58c'], Jamestown: ['#f0c9a2', '#e5ad84', '#f4dcb6', '#9fc7d6'], Osu: ['#f7f1e3', '#f2d6d6', '#d6e8f0', '#fbe7b5'],
  Ridge: ['#f4f1ea', '#e3ece4', '#dfe7f1'], La: ['#f6e1c2', '#c9e3d9', '#f2c9b8'], Nima: ['#e7cfa6', '#d9b98d', '#ecdcb9', '#c7d9b5'], Labone: ['#f4efe6', '#e3efe7'], Legon: ['#efe7d6', '#e6e0f1', '#dce9dc'], Airport: ['#eef1f4', '#e2e9ef'],
  'Tetteh Quarshie': ['#eef0f3', '#f1e6d6'], Spintex: ['#f1ece2', '#e6eef0'], 'Korle Bu': ['#efe6d8', '#e2eadf'], 'East Legon': ['#f6f1e7', '#e9efe9'], Kaneshie: ['#ead7b3', '#e3c497'], Trasacco: ['#fbf8f1'], 'Airport Residential': ['#f6f3ec', '#e8efe8'], Labadi: ['#f6e1c2', '#c9e3d9'] };
const ROOF = ['#b5523b', '#8f3f2f', '#c8693f', '#6d7177', '#9a5b3e', '#4f6b5c'];

// ------------------------------------------------------------------ layout: real positions → grid blocks
const MAP_SCALE=.0065;
function layout(cat) {
  const items=[...cat.locs.map(l=>({id:l.id,x:l.x,z:l.z,area:l.area})),...Object.entries(cat.homes).map(([k,h])=>({id:'h:'+k,x:h.x,z:h.z,area:h.area,home:true}))];
  return {out:new Map(items.map(it=>[it.id,{...it,px:it.x*MAP_SCALE,pz:it.z*MAP_SCALE}]))};
}

// ------------------------------------------------------------------ plot builder (metres, origin = block centre)
class P {
  constructor() { this.g = new THREE.Group(); }
  box(w, h, d, col, x, y, z, ry = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof col === 'string' ? mat(col) : col); m.position.set(x, y + h / 2, z); m.rotation.y = ry; this.g.add(m); return m; }
  cyl(rt, rb, h, col, x, y, z, seg = 16) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof col === 'string' ? mat(col) : col); m.position.set(x, y + h / 2, z); this.g.add(m); return m; }
  sph(r, col, x, y, z, sy = 1) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(col)); m.position.set(x, y, z); m.scale.y = sy; this.g.add(m); return m; }
  cone(r, h, col, x, y, z, seg = 4) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(col)); m.position.set(x, y + h / 2, z); if (seg === 4) m.rotation.y = Math.PI / 4; this.g.add(m); return m; }
  item(kind, o, x, z, ry = 0, s = 1, y = 0) { const it = makeItem(kind, o); it.obj.position.set(x, y, z); it.obj.rotation.y = ry; it.obj.scale.setScalar(s); this.g.add(it.obj); return it; }
  sign(text, bg, fg, w, h, x, y, z, ry = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat('#ffffff', { map: T.text(text, bg, fg, 512, Math.round((512 * h) / w)), e: '#ffffff', ei: 0.15 })); m.position.set(x, y, z); m.rotation.y = ry; this.g.add(m); return m; }
  lot(col) { this.box(BM - 1.6, 0.06, BM - 1.6, col, 0, 0.5, 0); }
  house(x, z, w, d, h, wall, roof, flat) { this.box(w, h, d, wall, x, 0.5, z); if (flat) this.box(w + 0.3, 0.35, d + 0.3, '#d9d4c7', x, 0.5 + h, z); else { const r = this.cone(Math.max(w, d) * 0.74, h * 0.45 + 1, roof, x, 0.5 + h, z); r.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); }
    for (let i = 0; i < Math.floor(w / 2.4); i++) this.box(0.9, 1.0, 0.1, '#3a4d5c', x - w / 2 + 1.3 + i * 2.4, 0.5 + Math.min(h - 1.6, 1.4), z + d / 2 + 0.02); }
  tree(x, z, s = 1) { this.cyl(0.25 * s, 0.35 * s, 2.2 * s, '#7a5a3a', x, 0.5, z, 6); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7 * s, 0), mat(pick(['#4f9a4a', '#5aa14f', '#3f8f45']), { flat: true })); c.position.set(x, 0.5 + 3 * s, z); this.g.add(c); }
  palm(x, z, h = 6) { this.item('palm_tree', { arg: h, lean: rr(0.1, 0.5) }, x, z, rr(0, 6)); }
  done(px, pz) { this.g.scale.setScalar(K); this.g.position.set(px, 0, pz); return this.g; }
}
// landmark per place (metres)
const LM = {
  circle(p) { p.lot('#d8d2c4'); p.cyl(6.2, 6.2, 0.1, '#5d6168', 0, 0.5, 0, 32); p.cyl(3.6, 3.6, 0.25, '#7cb760', 0, 0.55, 0, 32); p.cyl(0.6, 0.9, 6, '#ece6d8', 0, 0.8, 0, 8); p.box(2.6, 0.6, 0.6, '#d4a017', 0, 5.6, 0);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const x = Math.cos(a) * 7.6, z = Math.sin(a) * 7.6; if (Math.abs(x) < 7.5 || Math.abs(z) < 7.5) p.box(1.6, 1.8, 1.6, pick(['#1f6fb8', '#c8102e', '#f2b632', '#0e7a4e', '#7b2d8e']), x, 0.5, z, -a); }
    p.sign('PHONES · REPAIRS', '#1f4fa8', '#fcd116', 6, 1.2, 0, 2.6, 7.8); },
  momo(p) { p.lot('#e2d6bd'); p.item('momo_kiosk', {}, 0, 0, 0, 1.8); p.house(-5, -4, 5, 4, 3.2, '#f2c4a0', '#b5523b', true); p.tree(5, -5); },
  muni(p) { food(p, 'WAAKYE', '#f2b632'); }, chopbar(p) { food(p, 'CHOP BAR', '#0e7a4e'); }, kenkey(p) { food(p, 'KENKEY', '#c8693f'); },
  makola(p) { market(p, '#c8102e'); }, kantamanto(p) { market(p, '#1f6fb8', true); },
  oxford(p) { p.lot('#cfc6b2'); for (let i = 0; i < 4; i++) { const x = -6 + i * 4; p.box(3.4, rr(3, 5), 5, pick(['#f7f1e3', '#f2d6d6', '#d6e8f0', '#fbe7b5']), x, 0.5, -4); p.box(3.2, 0.5, 0.2, mat(pick(['#ff4fa3', '#4fd8ff', '#ffd34f', '#8cff6a']), { e: pick(['#ff4fa3', '#4fd8ff', '#ffd34f']), ei: 0.9 }), x, 3.4, -1.4); } p.palm(-6, 4); p.palm(6, 4); p.item('umbrella', { color: '#e63946' }, 0, 4, 0, 1.4); },
  vibes(p) { p.lot('#2b2f36'); p.box(12, 4.5, 9, '#1d1a26', 0, 0.5, -1); p.box(12.2, 0.4, 0.3, mat('#b14cff', { e: '#b14cff', ei: 1.2 }), 0, 4.2, 3.6); p.sign('VIBES', '#1d1a26', '#ff4fa3', 5, 1.2, 0, 3.2, 3.62); p.palm(-6, 6); p.palm(6, 6); },
  hub(p) { tower(p, '#7fb2d6', 10, 'TECH HUB', '#17150f'); }, bank(p) { tower(p, '#d9d4c7', 14, 'BANK', '#0e7a4e', '#d4a017'); }, radio(p) { tower(p, '#f2c4a0', 6, 'FM', '#c8102e'); p.cyl(0.15, 0.25, 14, '#c8102e', 4, 0.5, -3, 6); },
  ama(p) { p.lot('#d8d2c4'); p.box(13, 5, 8, '#f4f1ea', 0, 0.5, -2); for (let i = 0; i < 6; i++) p.cyl(0.35, 0.35, 4.6, '#ffffff', -5 + i * 2, 0.5, 2.3, 8); p.box(13.4, 0.6, 9, '#d9d4c7', 0, 5.5, -1.6); p.item('flag_pole', { arg: 6 }, 5, 6, 0, 1.2); },
  ridge(p) { hospital(p); }, korlebu(p) { hospital(p, true); },
  police(p) { p.lot('#d8d2c4'); p.box(12, 4.5, 8, '#2b4a7a', 0, 0.5, -2); p.box(12.2, 0.6, 8.2, '#f4f1ea', 0, 2.4, -2); p.sign('POLICE', '#2b4a7a', '#ffffff', 5, 1.1, 0, 3.6, 2.02); p.item('flag_pole', { arg: 6 }, 5, 5, 0, 1.2); },
  memorial(p) { p.lot('#7cb760'); p.box(10, 0.3, 10, '#e6dfcf', 0, 0.55, 0); p.item('statue', {}, 0, -1, 0, 1.6); p.item('fountain', {}, 0, 4, 0, 1.4); p.tree(-6, -6); p.tree(6, -6); },
  blackstar(p) { p.lot('#e6dfcf'); p.item('star_arch', { arg: 9 }, 0, -2, 0, 1.4); for (let i = -2; i <= 2; i++) p.item('flag_pole', { arg: 5 }, i * 3, 5, 0, 1.1); },
  castle(p) { p.lot('#e8d3a2'); p.item('castle_wall', { arg: 12, arg2: 4 }, 0, -4, 0, 1.1); p.item('castle_wall', { arg: 8, arg2: 4 }, -6.2, 0, Math.PI / 2, 1.1); p.box(4, 8, 4, '#f4f1ea', 5, 0.5, -3); p.item('cannon', {}, 2, 3, 0, 1.5); p.item('cannon', {}, -2, 3, 0, 1.5); },
  lighthouse(p) { p.lot('#e8d3a2'); p.item('lighthouse', { arg: 9 }, 0, -1, 0, 1.3); p.house(-5, 5, 4, 3, 2.5, '#f0c9a2', '#8f3f2f'); },
  bukom(p) { p.lot('#cfc6b2'); p.box(13, 2.5, 13, '#8a6a45', 0, 0.5, 0); p.box(11, 2.6, 11, '#2b2f36', 0, 0.5, 0); p.item('boxing_ring', {}, 0, 0, 0, 1.6, 2.8); p.sign('BUKOM', '#c8102e', '#ffffff', 5, 1, 0, 2.2, 6.55); },
  canoes(p) { sand(p); for (let i = 0; i < 4; i++) p.item('canoe', { color: pick(['#d7263d', '#ffc83d', '#0e7a4e', '#2f6bff']) }, -5 + i * 3.4, 2, 0.3 + i * 0.15, 1); p.item('fishing_net', {}, 4, -4, 0, 2); },
  labadi(p) { sand(p); // the demolished beachfront: rubble, a bulldozer, torn umbrellas, warning tape
    for (let i = 0; i < 9; i++) { const b = p.box(rr(1, 3), rr(0.4, 1.4), rr(1, 3), pick(['#9a958a', '#b5ab97', '#7d776d', '#c9b89a']), rr(-6, 6), 0.5, rr(-6, 4)); b.rotation.set(rr(-0.3, 0.3), rr(0, 3), rr(-0.3, 0.3)); }
    for (let i = 0; i < 5; i++) { const b = p.box(0.2, 0.2, rr(2, 3.5), pick(['#8a6a45', '#6f4a2e']), rr(-6, 6), 0.6, rr(-6, 4)); b.rotation.set(0, rr(0, 3), rr(-0.2, 0.2)); }
    const ex = new P(); ex.box(3.4, 1.4, 2.2, '#f2b632', 0, 0.8, 0); ex.box(1.6, 1.6, 1.8, '#f2b632', -0.6, 2.2, 0); ex.box(1.4, 1.2, 1.6, '#2b3a55', -0.6, 2.4, 0.05); ex.box(3.8, 0.8, 2.6, '#2b2b2b', 0, 0, 0); const arm = ex.box(0.5, 0.5, 4, '#f2b632', 1.4, 3.2, 0); arm.rotation.set(0, Math.PI / 2, -0.5); ex.g.position.set(4, 0.5, -3); ex.g.rotation.y = -0.6; p.g.add(ex.g);
    p.item('umbrella', { color: '#e63946' }, -5, 5, 0, 1.2).obj.rotation.z = 1.1; p.item('umbrella', { color: '#1d4ed8' }, -2, -5, 0, 1.2).obj.rotation.x = 1.3;
    for (let i = 0; i < 6; i++) p.box(0.15, 1.0, 0.15, '#d9d4c7', -7.5 + i * 3, 0.5, 7.4); p.box(15, 0.18, 0.06, mat('#fcd116', { e: '#fcd116', ei: 0.2 }), 0, 1.25, 7.4);
    p.sign('DEMOLISHED · OCT 2026', '#fcd116', '#17150f', 6, 1.1, 0, 2.2, 7.5); },
  funeral(p) { p.lot('#e2d6bd'); for (const [x, z] of [[-4, -3], [4, -3], [0, 3]]) p.item('canopy', { arg: 6, arg2: 4.4, colors: ['#c8102e', '#111111'] }, x, z, 0, 1); for (let i = 0; i < 12; i++) p.item('plastic_chair', { color: '#c8102e' }, -6 + (i % 6) * 2.2, 5.5 + Math.floor(i / 6) * 1.2, Math.PI, 1); },
  church(p) { p.lot('#d8d2c4'); p.box(9, 5, 12, '#f4f1ea', 0, 0.5, -1); p.cone(7, 3, '#8f3f2f', 0, 5.5, -1); p.box(3, 9, 3, '#f4f1ea', 0, 0.5, 5.2); p.cone(2.2, 4, '#8f3f2f', 0, 9.5, 5.2); p.box(0.3, 2, 0.3, '#d4a017', 0, 13.3, 5.2); p.box(1.2, 0.3, 0.3, '#d4a017', 0, 14.3, 5.2); },
  mosque(p) { p.lot('#e2d6bd'); p.box(10, 4.5, 10, '#f4f1ea', 0, 0.5, -1); p.sph(4, '#0e7a4e', 0, 5, -1, 1.1); p.cyl(0.9, 1.1, 13, '#f4f1ea', 6, 0.5, 4, 10); p.cone(1.2, 2.4, '#0e7a4e', 6, 13.5, 4, 10); },
  stadium(p) { p.lot('#d8d2c4'); const bowl = new THREE.Mesh(new THREE.CylinderGeometry(8, 7, 4, 32, 1, true), mat('#d9d4c7', { side: true })); bowl.position.y = 2.5; bowl.scale.z = 0.75; p.g.add(bowl); p.cyl(6.6, 6.6, 0.15, '#4c9a3f', 0, 0.55, 0, 32).scale.z = 0.72; p.box(7, 0.05, 0.12, '#ffffff', 0, 0.7, 0); },
  viewing(p) { p.lot('#e2d6bd'); p.box(12, 0.25, 9, '#cfc6b2', 0, 0.5, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(0.3, 4, 0.3, '#6d7177', sx * 5.8, 0.5, sz * 4.3); p.box(13, 0.3, 10, '#c8102e', 0, 4.5, 0); p.item('big_screen', { arg: 5 }, 0, -3.5, 0, 1, 0.5); for (let i = 0; i < 3; i++) p.box(9, 0.5, 0.5, '#8a6a45', 0, 0.5, i * 1.8); },
  mall(p) { p.lot('#8d9096'); p.box(14, 5, 9, '#eef0f3', 0, 0.5, -3); p.box(14.2, 0.6, 9.2, '#c8102e', 0, 5.5, -3); p.sign('ACCRA MALL', '#c8102e', '#ffffff', 6, 1.2, 0, 3.6, 1.52); for (let i = 0; i < 6; i++) p.item('car_display', { color: pick(['#c9ccd1', '#1b1f27', '#b5172b', '#f4f4f2']) }, -6 + i * 2.4, 5, Math.PI / 2, 0.5, 0.5); },
  ug(p) { p.lot('#a9c97d'); p.box(6, 6, 6, '#f4ede0', 0, 0.5, -2); p.cone(4.4, 3.2, '#b5523b', 0, 6.5, -2); p.box(1.8, 10, 1.8, '#f4ede0', 0, 0.5, 3); p.cone(1.5, 2, '#b5523b', 0, 10.5, 3); p.tree(-6, 5); p.tree(6, 5); p.tree(-6, -6); p.tree(6, -6); },
  airport(p) { p.lot('#8d9096'); p.box(14, 4, 6, '#e2e9ef', 0, 0.5, -4); p.box(14.4, 0.4, 6.4, '#1f6fb8', 0, 4.5, -4); p.cyl(0.7, 0.9, 9, '#e2e9ef', 6, 0.5, 3, 10); p.cyl(1.6, 1.2, 1.6, '#3a4d5c', 6, 9.5, 3, 10); const pl = planeMesh(); pl.position.set(-2, 1.4, 4); pl.scale.setScalar(4.5); pl.rotation.y = 0.4; p.g.add(pl); },
  hotel(p) { sand(p, '#e8d3a2'); p.box(12, 7, 5, '#f4f1ea', 0, 0.5, -5); for (let f = 0; f < 3; f++) p.box(12.2, 0.3, 5.6, '#d9d4c7', 0, 2.5 + f * 2, -4.8); p.box(7, 0.2, 4, mat('#3fb4d8', { r: 0.2 }), -2, 0.55, 3); p.palm(5, 2); p.palm(6, 6); p.palm(-7, 6); },
  cars(p) { p.lot('#8d9096'); for (let i = 0; i < 8; i++) p.item('car_display', { color: pick(['#c9ccd1', '#1b1f27', '#b5172b', '#f4f4f2', '#2b4a7a']) }, -5 + (i % 4) * 3.4, -3 + Math.floor(i / 4) * 5, Math.PI / 2, 0.75, 0.5); for (let i = 0; i < 6; i++) p.box(0.1, 0.1, 15, pick(['#c8102e', '#fcd116', '#0e7a4e']), -7 + i * 3, 4.6, 0); p.sign('CARS', '#17150f', '#fcd116', 4, 1, 0, 2.5, 7.6); },
  // homes
  'h:nima'(p) { compound(p, '#e7cfa6'); }, 'h:jtown'(p) { sand(p, '#e8d3a2'); p.house(-3, -2, 7, 5, 2.6, '#f0c9a2', '#8f3f2f'); p.item('canoe', { color: '#ffc83d' }, 3, 4, 0.4, 1); },
  'h:kaneshie'(p) { compound(p, '#ead7b3'); }, 'h:labadi'(p) { p.lot('#e2d6bd'); p.house(0, -1, 9, 7, 3.2, '#f6e1c2', '#b5523b', true); p.palm(-6, 5); },
  'h:osu'(p) { p.lot('#d8d2c4'); p.house(0, -2, 10, 8, 9, '#f7f1e3', null, true); p.palm(-6, 5); p.palm(6, 5); },
  'h:airres'(p) { p.lot('#a9c97d'); p.house(0, -2, 11, 8, 12, '#f6f3ec', null, true); p.tree(-6, 6); },
  'h:legon'(p) { p.lot('#a9c97d'); wall(p, '#f6f1e7'); p.house(0, -1, 10, 8, 5.5, '#f6f1e7', '#4f6b5c'); },
  'h:trasacco'(p) { p.lot('#a9c97d'); wall(p, '#fbf8f1'); p.house(-1, -2, 12, 8, 6, '#fbf8f1', null, true); p.box(5, 0.2, 3, mat('#3fb4d8', { r: 0.2 }), 2, 0.55, 5); p.palm(-6, 5); },
};
function food(p, label, col) { p.lot('#e2d6bd'); p.box(9, 3.6, 6, '#f4e1a1', 0, 0.5, -4); const aw = p.box(9.4, 0.25, 3, col, 0, 3.4, -0.4); aw.rotation.x = 0.25; p.sign(label, col, '#ffffff', 5, 1.1, 0, 4.9, -0.98);
  for (let i = 0; i < 3; i++) { p.item('umbrella', { color: pick(['#e63946', '#1d4ed8', '#f2b632']) }, -5 + i * 5, 5, 0, 1.2); p.box(1.6, 1.0, 1.0, '#f4f4f2', -5 + i * 5, 0.5, 5); } }
function market(p, col, bale) { p.lot('#c9b89a'); for (let i = 0; i < 9; i++) { const x = -5 + (i % 3) * 5, z = -5 + Math.floor(i / 3) * 5; p.item('umbrella', { color: pick([col, '#f2b632', '#0e7a4e', '#e63946', '#1d4ed8']) }, x, z, 0, 1.5); p.item(bale ? 'bale' : 'market_table', {}, x + 0.6, z + 0.4, 0, 1.3); } }
function tower(p, col, h, label, bg, top = null) { p.lot('#d8d2c4'); p.box(9, h, 9, col, 0, 0.5, -1); for (let f = 1; f < h / 3; f++) p.box(9.2, 0.25, 9.2, '#ffffff', 0, 0.5 + f * 3, -1); if (top) p.box(9.4, 0.8, 9.4, top, 0, 0.5 + h, -1); p.sign(label, bg, '#ffffff', 4, 1, 0, 2.2, 3.52); p.tree(-6, 6); p.tree(6, 6); }
function hospital(p, big) { p.lot('#d8d2c4'); p.box(big ? 14 : 12, big ? 8 : 6, 8, '#f4f6f8', 0, 0.5, -2); p.box(1, 4, 0.2, '#d62828', 0, (big ? 8 : 6) - 4.5, 2.05); p.box(4, 1, 0.2, '#d62828', 0, (big ? 8 : 6) - 3, 2.05); p.box(5, 0.2, 3, '#c9ccd1', 4, 0.5, 5); }
function sand(p, col = '#ead9ae') { p.box(BM - 1.6, 0.06, BM - 1.6, col, 0, 0.5, 0); }
function wall(p, col) { for (const [x, z, w, d] of [[0, -7.6, 15.2, 0.4], [0, 7.6, 15.2, 0.4], [-7.6, 0, 0.4, 15.2], [7.6, 0, 0.4, 15.2]]) p.box(w, 1.8, d, col, x, 0.5, z); p.box(3, 1.7, 0.45, '#1d4ed8', 0, 0.5, 7.6); }
function compound(p, col) { p.lot('#d9b98d'); p.house(-3.5, -3.5, 7, 5, 2.7, col, '#6d7177'); p.house(4, -3, 5, 6, 2.7, col, '#6d7177'); p.house(-2, 4, 9, 4, 2.7, col, '#6d7177'); p.cyl(0.8, 0.8, 1.6, '#1b1b1b', 5, 0.5, 5); }
function filler(p, area, seed) {
  R = rng(seed); const pal = AREA_COL[area] || AREA_COL.Osu; const tall = ['Ridge', 'Airport', 'Airport Residential', 'Tetteh Quarshie'].includes(area);
  if (R() < 0.05) { p.lot('#a9c97d'); for (let i = 0; i < 5; i++) p.tree(rr(-6, 6), rr(-6, 6), rr(0.8, 1.2)); return; }
  p.lot(pick(['#e2d6bd', '#d8d2c4', '#ddd3bd']));
  const n = Math.floor(rr(3, 5)); const spots = [[-4, -4], [4, -4], [-4, 4], [4, 4]].sort(() => R() - 0.5);
  for (let i = 0; i < n; i++) { const [x, z] = spots[i]; const hh = tall && R() < 0.5 ? rr(7, 14) : rr(2.6, 6); p.house(x, z, rr(6, 8), rr(6, 8), hh, pick(pal), pick(ROOF), hh > 6 || R() < 0.35); }
  if (n < 4) { const [x, z] = spots[3]; R() < 0.5 ? p.tree(x, z) : p.palm(x, z, rr(5, 7)); }
}
function planeMesh() { const g = new THREE.Group(); const w = mat('#f4f6f8', { r: 0.5 }); const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.4, 3, 8), w); body.rotation.z = Math.PI / 2; g.add(body); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 1.8), w)); const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.04), mat('#0e7a4e')); tail.position.set(-0.75, 0.22, 0); g.add(tail); return g; }

// ------------------------------------------------------------------ the map
export class CityMap {
  constructor(stage, uiEl) { this.stage = stage; this.ui = uiEl; this.group = new THREE.Group(); this.group.visible = false; stage.scene.add(this.group); this.pins = new Map(); this.boards = []; this.cars = []; this.built = false; this.filter = 'all'; this.ray = new THREE.Raycaster(); this.labels = []; }
  build(cat) {
    if (this.built) return; this.built = true; this.roadLabels=0; this.cat = cat; const G = this.group; R = rng(7);
    const { out, taken } = layout(cat); this.slots = out;
    // ground: sage land, sea to the south with a beach, asphalt under the whole grid
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 240), new THREE.MeshStandardMaterial({ color: '#c6d6a2', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, -10); ground.receiveShadow = true; G.add(ground);
    const seaZ = H / 2 + 1.8; const sea = new THREE.Mesh(new THREE.PlaneGeometry(W + 200, 120), new THREE.MeshStandardMaterial({ color: '#4fb3c9', roughness: 0.3, metalness: 0.05 })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.05, seaZ + 60); G.add(sea); this.sea = sea;
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(W + 200, 3.2), new THREE.MeshStandardMaterial({ color: '#f2e2b8', roughness: 1 })); beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.0, seaZ + 0.2); beach.receiveShadow = true; G.add(beach);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(W + 200, 0.5), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 })); foam.rotation.x = -Math.PI / 2; foam.position.set(0, -0.03, seaZ + 1.9); G.add(foam); this.foam = foam;
    const stat=new THREE.Group();
    for(const it of out.values()) { const p=new P();R=rng([...it.id].reduce((n,c)=>n+c.charCodeAt(0),7));if(/^[ne]:/.test(it.id)){p.lot('#bccba3');p.tree(0,0);}else if(LM[it.id])LM[it.id](p);else filler(p,it.area,7);stat.add(p.done(it.px,it.pz)); }
    G.add(bake(stat));
    this.mapSource=h('div.map-credit',null,'Accra · schematic map · real place coordinates');this.ui.append(this.mapSource);
    this.terrainReady=fetch('/assets/accra-roads.json').then(r=>{if(!r.ok)throw new Error('Road map unavailable');return r.json();}).then(data=>{
      const coast=data.coast?.[0]?.p;
      if(coast?.length>1){
        const points=coast.map(([x,z])=>new THREE.Vector2(x*MAP_SCALE,-z*MAP_SCALE));
        const shape=new THREE.Shape([new THREE.Vector2(-140,points[0].y),...points,new THREE.Vector2(140,points.at(-1).y),new THREE.Vector2(140,-160),new THREE.Vector2(-140,-160)]);
        this.sea.geometry.dispose();this.sea.geometry=new THREE.ShapeGeometry(shape);this.sea.position.set(0,.005,0);this.sea.rotation.x=-Math.PI/2;beach.visible=false;foam.visible=false;
        const shore=new THREE.Group();for(let i=1;i<coast.length;i++){const a=coast[i-1].map(v=>v*MAP_SCALE),b=coast[i].map(v=>v*MAP_SCALE),dx=b[0]-a[0],dz=b[1]-a[1];const m=new THREE.Mesh(new THREE.BoxGeometry(.55,.016,Math.hypot(dx,dz)),mat('#ead9ae'));m.position.set((a[0]+b[0])/2,.01,(a[1]+b[1])/2);m.rotation.y=Math.atan2(dx,dz);shore.add(m);}G.add(bake(shore));
      }
      const network=new THREE.Group();
      for(const route of data.roads) {const width=['trunk','motorway'].includes(route.kind)?.24:route.kind==='primary'?.17:.12;
        for(let i=1;i<route.p.length;i++){const a=route.p[i-1].map(v=>v*MAP_SCALE),b=route.p[i].map(v=>v*MAP_SCALE),dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.005)continue;
          const m=new THREE.Mesh(new THREE.BoxGeometry(width,.018,length+.02),mat('#6c726f'));m.position.set((a[0]+b[0])/2,.02,(a[1]+b[1])/2);m.rotation.y=Math.atan2(dx,dz);network.add(m);
        }
        if(route.name&&route.p.length>3&&this.roadLabels<14){const q=route.p[Math.floor(route.p.length/2)];const el=h('div.road-label',null,route.name);this.ui.append(el);this.labels.push({el,x:q[0]*MAP_SCALE,z:q[1]*MAP_SCALE});this.roadLabels++;}
      }
      G.add(bake(network));this.populate(data);this.mapSource.textContent=data.source==='schematic'?'Accra · schematic roads · real place coordinates':'Map data © OpenStreetMap contributors · ODbL';
    }).catch(()=>{this.populate({roads:[],coast:[]});this.mapSource.textContent='Accra · schematic map · real place coordinates';});
    // district labels (DOM)
    const byArea = new Map(); for (const s of out.values()) { if (s.home) continue; const a = byArea.get(s.area) || []; a.push(s); byArea.set(s.area, a); }
    for (const [area, list] of byArea) { const x = list.reduce((a, s) => a + s.px, 0) / list.length, z = list.reduce((a, s) => a + s.pz, 0) / list.length; const el = document.createElement('div'); el.className = 'dlabel'; el.textContent = area; this.ui.append(el); this.labels.push({ el, x: x, z: z - PITCH / 2 }); }
  }
  populate(data) {
    if(this.cityFilled)return;this.cityFilled=true;const group=new THREE.Group(),landmarks=[...this.slots.values()],segments=[];
    for(const road of data.roads||[])for(let i=1;i<road.p.length;i++)segments.push([road.p[i-1].map(v=>v*MAP_SCALE),road.p[i].map(v=>v*MAP_SCALE)]);
    const shore=(data.coast?.[0]?.p||[]).map(p=>p.map(v=>v*MAP_SCALE));
    const shoreZ=x=>{for(let i=1;i<shore.length;i++){const a=shore[i-1],b=shore[i];if(x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0]))return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]||1);}return shore.length?shore.reduce((a,b)=>Math.abs(a[0]-x)<Math.abs(b[0]-x)?a:b)[1]:25;};
    const distance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);};
    this.backgroundPlots=0;
    for(let z=-80;z<30;z+=2.8)for(let x=-42;x<50;x+=2.8){if(z>shoreZ(x)-1.1||landmarks.some(p=>Math.hypot(p.px-x,p.pz-z)<2.1)||segments.some(([a,b])=>distance(x,z,a,b)<1.15))continue;
      const nearest=landmarks.reduce((a,b)=>Math.hypot(a.px-x,a.pz-z)<Math.hypot(b.px-x,b.pz-z)?a:b);const plot=new P();filler(plot,nearest.area,Math.round((x+50)*101+(z+90)*907));const built=plot.done(x,z);built.scale.multiplyScalar(1.18);group.add(built);this.backgroundPlots++;}
    this.group.add(bake(group));
  }
  slotOf(id) { const s = this.slots && this.slots.get(id); return s ? [s.px, s.pz] : null; }
  // real metres → map (scaled continuous, used for billboards)
  realToMap(x,z) { return [x*MAP_SCALE,z*MAP_SCALE]; }
  // paid billboards (rotation: everyone sees the same ad at the same time) — sit on the corner of the nearest block
  setBillboards(slots) {
    for (const b of this.boards) this.group.remove(b.root); this.boards = [];
    const tl = new THREE.TextureLoader(); const house = houseAd(); const used = new Set();
    for (const s of slots) {
      let [x, z] = this.realToMap(s.x, s.z); let k = 0; while (used.has(x + ',' + z) && k < 4) { x += PITCH * (k % 2 ? -1 : 1) * (k + 1); k++; } used.add(x + ',' + z);
      const root = new THREE.Group(); const steel = new THREE.MeshStandardMaterial({ color: '#4b5056', metalness: 0.6, roughness: 0.5 });
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), steel); pole.position.y = 0.8; root.add(pole);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.2, 0.1), steel); frame.position.y = 2.15; root.add(frame);
      const m = new THREE.MeshStandardMaterial({ map: house, emissive: '#ffffff', emissiveMap: house, emissiveIntensity: 0.25, roughness: 0.6 });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 1.08), m); face.position.set(0, 2.15, 0.06); root.add(face);
      root.position.set(x - BLOCK / 2 + 0.5, 0.18, z - BLOCK / 2 + 0.5); root.rotation.y = Math.PI / 4; root.scale.setScalar(s.tier === 'MEGA' ? 1.25 : s.exclusive ? 1.15 : 1); root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.group.add(root); this.boards.push({ root, face, slot: s, ads: s.live || [], cur: -1, tex: new Map(), tl, house, seed: [...s.id].reduce((a, c) => a + c.charCodeAt(0), 0) });
    }
  }
  updateBoards() {
    const now = Date.now();
    for (const b of this.boards) { const n = b.ads.length; const ad = n ? b.ads[Math.floor(now / ((b.slot.rotate || 15) * 1000) + b.seed) % n] : null; const id = ad ? ad.id : 0; if (id === b.cur) continue; b.cur = id;
      let t = b.house; if (ad) { t = b.tex.get(ad.id); if (!t) { t = b.tl.load(ad.img); t.colorSpace = THREE.SRGBColorSpace; b.tex.set(ad.id, t); } }
      b.face.material.map = t; b.face.material.emissiveMap = t; b.face.material.needsUpdate = true; b.ad = ad; }
  }
  pickBoard(cx2, cy2) { const ndc = new THREE.Vector2((cx2 / innerWidth) * 2 - 1, -(cy2 / innerHeight) * 2 + 1); this.ray.setFromCamera(ndc, this.stage.camera); for (const b of this.boards) if (this.ray.intersectObject(b.face, false).length) return b; return null; }
  // ---- pins (DOM) ----
  setPins(list, onPick) {
    this.ui.querySelectorAll('.pin').forEach((e) => e.remove()); this.pins.clear(); this.onPick = onPick;
    for (const it of list) { const el = document.createElement('button'); el.className = 'pin small ' + (it.cls || '');el.setAttribute('aria-label',it.name);el.title=it.name; el.append(h('span.pb', null, h('span.pe', null, it.ic), h('span.pl', null, it.name), it.count ? h('span.pc', null, it.count) : null));
      el.addEventListener('click', (e) => { e.stopPropagation(); onPick(it.id); }); this.ui.append(el); const [x, z] = it.xz || this.slotOf(it.id) || [0, 0]; this.pins.set(it.id, { el, x, z, it }); }
  }
  focus(x, z, zoom) { const v = this.stage.view; v.target.set(x, 0, z); if (zoom) v.zoom = zoom; this.stage.applyView(); }
  show(on) {
    this.group.visible = on; this.ui.hidden = !on; const st = this.stage;
    if (on) { st.bounds = [-48,52,-84,36]; st.zoomMin = 10; st.zoomMax = 70; const sc = st.key.shadow.camera; const r = 30; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.far = 140; sc.updateProjectionMatrix(); }
  }
  update(dt) {
    if (!this.group.visible) return; const v = this.stage.view;
    for (const c of this.cars) { c.t += c.v * dt; if (c.t > c.len / 2) c.t -= c.len; if (c.t < -c.len / 2) c.t += c.len; if (c.horiz) { c.m.position.set(c.t, 0.02, c.pos); c.m.rotation.y = c.v > 0 ? 0 : Math.PI; } else { c.m.position.set(c.pos, 0.02, c.t); c.m.rotation.y = c.v > 0 ? -Math.PI / 2 : Math.PI / 2; } }
    const ph = performance.now() / 1800; this.sea.material.color.setHSL(0.53, 0.5, 0.52 + Math.sin(ph) * 0.015); this.foam.position.z = H / 2 + 3.7 + Math.sin(ph * 1.3) * 0.25;
    this.updateBoards();
    // Compact destination icons; optional names and hover/focus reveal the full label.
    const cam = this.stage.camera; const w = innerWidth, hgt = innerHeight; const vec = new THREE.Vector3();
    const list = [...this.pins.values()].sort((a, b) => (b.it.keep ? 1e3 : 0) + (b.it.count || 0) - ((a.it.keep ? 1e3 : 0) + (a.it.count || 0)));
    for (const p of list) { p.el.classList.toggle('small',!this.showNames);vec.set(p.x, 1.2, p.z).project(cam); const sx = (vec.x * 0.5 + 0.5) * w, sy = (-vec.y * 0.5 + 0.5) * hgt; const off = sx < -60 || sx > w + 60 || sy < -40 || sy > hgt + 40; p.el.style.display = off ? 'none' : ''; if (off) continue;
      p.el.style.left = sx + 'px'; p.el.style.top = sy + 'px';       const compact = !this.showNames; p.el.classList.toggle('small', compact); p.el.style.zIndex = p.it.keep ? 3 : compact ? 1 : 2; }
    const showL = v.zoom > 22; for (const l of this.labels) { vec.set(l.x, 0, l.z).project(cam); l.el.style.left = (vec.x * 0.5 + 0.5) * w + 'px'; l.el.style.top = (-vec.y * 0.5 + 0.5) * hgt + 'px'; l.el.style.opacity = showL ? 1 : 0; }
  }
  toMap(x, z) { return this.slots ? this.realToMap(x, z) : [0, 0]; }
}
function houseAd() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#17150f'; x.fillRect(0, 0, 512, 256); const st = ['#d7263d', '#ffc83d', '#0e7a4e', '#ffc83d']; for (let i = 0; i < 24; i++) { x.fillStyle = st[i % 4]; x.fillRect(i * 22, 236, 22, 20); }
  x.fillStyle = '#ffc83d'; x.font = '800 54px "Bricolage Grotesque Variable", system-ui'; x.textAlign = 'center'; x.fillText('YOUR AD HERE', 256, 110);
  x.fillStyle = '#fffdf8'; x.font = '600 24px "Outfit Variable", system-ui'; x.fillText('Seen by players all over Accra', 256, 156); x.fillStyle = '#b9b0a3'; x.font = '600 20px "Outfit Variable", system-ui'; x.fillText('Phone → My Ads', 256, 196);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
