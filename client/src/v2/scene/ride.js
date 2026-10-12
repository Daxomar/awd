// The ride: a chase camera behind your trotro / taxi / Bolt / car / okada (or behind you on foot) rolling through a
// procedural Accra street. Street segments recycle ahead of you; traffic, hawkers and pedestrians are pooled.
// Drawn with its own scene + perspective camera through Stage.override, so the city/room scenes are untouched.
import * as THREE from 'three';
import { bake, VC } from './bake.js';
import { makeItem, mat, T, floorMaterial } from './kit.js';
import { Avatar } from './avatars.js';
import { applyPose } from './poses.js';

const SEG = 40, NSEG = 6, ROAD = 3.6, GUT = 0.6, XB = 7.8; // segment length, road half-width, gutter, building line
const LANE = 1.8; // centre of your lane (Ghana drives on the right); oncoming lane is -LANE
let _s = 1; const rnd = () => (_s = (_s * 16807) % 2147483647) / 2147483647; const pick = (a) => a[Math.floor(rnd() * a.length)];
const rr = (a, b) => a + rnd() * (b - a);

// ------------------------------------------------------------------ shared materials
const WIN = new THREE.MeshStandardMaterial({ color: '#3a4d5c', roughness: 0.25, metalness: 0.3, emissive: '#ffd27a', emissiveIntensity: 0 });
let ROADM, DIRTM, SIGNM, BOARDM;
const SHOPS = [
  ['GOD FIRST ENTERPRISE', 'Provisions · Cold drinks', '#c8102e'], ['AUNTIE AFIA CHOP BAR', 'Fufu · Banku · Omo tuo', '#0e7a4e'], ['BLESSED HANDS SALON', 'Braids · Wigs · Pedicure', '#7b2d8e'],
  ['PSALM 23 PHONES', 'Repairs · Screens · Unlocking', '#1f4fa8'], ['NYAME NE HENE SPARE PARTS', 'Toyota · Nissan · Kia', '#17150f'], ['SIKA MPƆ ELECTRICALS', 'Fans · Bulbs · Sockets', '#e76f51'],
  ['NO WEAPON FORMED FASHION', 'Ladies & gents wear', '#b5179e'], ['ABUSUA CHEMICAL SELLER', 'Licensed · Open daily', '#2a9d8f'], ['CHALE WOTE BARBERING', 'Low cut · Fade · Waves', '#264653'],
  ['ONYAME BEKYERE VENTURES', 'Cement · Iron rods · Roofing', '#6b4f2f'], ['MAAME ESI WAAKYE', 'Morning till it finish', '#f2b632'], ['JESUS WINS PRINTING', 'Banners · Stickers · Flyers', '#1d4ed8'],
  ['GOOD NEWS TAILORING', 'Kaba & slit specialist', '#9d0208'], ['ADOM CAR WASH', 'Wash · Vacuum · Polish', '#0077b6'], ['FAITH COLD STORE', 'Fish · Chicken · Turkey tail', '#023e8a'],
  ['EBENEZER WELDING WORKS', 'Gates · Burglar proof', '#3a3a3a'], ['DIVINE FAVOUR LODGE', 'Rooms · AC · Wi-Fi', '#5a189a'], ['OBAAPA BEAUTY PALACE', 'Nails · Lashes · Make-up', '#d63384'],
  ['KWAKU ANANSE BOOKSHOP', 'Exercise books · Pens', '#2b9348'], ['GRACE SPOT', 'Cold Club · Kebab · Music', '#111111'], ['MIGHTY MOMO POINT', 'Cash in · Cash out · Airtime', '#ffb703'],
  ['ODO FIE FURNITURE', 'Beds · Sofas · Wardrobes', '#7f5539'], ['TECH WIZ LAPTOPS', 'Sales · Repairs · Accessories', '#0b090a'], ['MERCY TRAVEL & TOURS', 'Visa · Tickets · Hajj', '#006b3f'],
  ['HOLY GHOST FIRE CHURCH', 'Sunday 7am · Friday vigil', '#4361ee'], ['WOFA ATTA MECHANIC', 'Engine · Gearbox · Spraying', '#6c757d'], ['SWEET MOTHER KENKEY', 'Ga kenkey · Fante kenkey', '#ca6702'],
  ['EXCELLENT GLASS & ALUMINIUM', 'Windows · Doors · Mirrors', '#457b9d'], ['ALHAJI TEXTILES', 'Wax print · Kente · Lace', '#e63946'], ['YAA ASANTEWAA PHARMACY', 'Prescriptions · Baby care', '#2d6a4f'],
  ['BIG BOSS VULCANISER', 'Tyres · Wheel balancing', '#212529'], ['NANA AMA FRESH JUICE', 'Sobolo · Asaana · Pineapple', '#9c6644'],
];
const BOARDS = [['DREAM ESTATES', 'Own your house small small', '#0e7a4e', '#fcd116'], ['KEEP ACCRA CLEAN', 'Don’t dump rubbish in the gutters', '#1d4ed8', '#ffffff'], ['SUSU SAVINGS', 'Save small, chop big later', '#7b2d8e', '#ffd166'],
  ['STOP GALAMSEY', 'Protect our rivers and forests', '#006b3f', '#ffffff'], ['SPEED KILLS', 'Drive with sense. Arrive alive.', '#c8102e', '#ffffff'], ['ACCRA WE DEY', 'Hustle hard. Enjoy your life.', '#17150f', '#fcd116'],
  ['PRAISE NIGHT', 'This Friday · 8pm · All welcome', '#f77f00', '#17150f'], ['KENKEY EXPRESS', 'Hot kenkey to your door', '#fcd116', '#17150f']];
function atlas() {
  if (SIGNM) return;
  // 2 × 16 shop signs (512×128 each) and 2 × 4 billboards (512×256 each)
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 2048; const x = cv.getContext('2d');
  SHOPS.forEach(([name, sub, bg], i) => { const ox = (i % 2) * 512, oy = Math.floor(i / 2) * 128;
    x.fillStyle = bg; x.fillRect(ox, oy, 512, 128); x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(ox, oy, 512, 8); x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(ox, oy + 120, 512, 8);
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 44px "Outfit Variable", system-ui, sans-serif'; x.fillText(name, ox + 256, oy + 50, 488);
    x.font = '600 26px system-ui, sans-serif'; x.fillStyle = bg === '#fcd116' || bg === '#ffb703' || bg === '#f2b632' ? '#17150f' : '#ffe9a8'; x.fillText(sub, ox + 256, oy + 96, 470); });
  SIGNM = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 0.7, emissive: '#ffffff', emissiveIntensity: 0.05 }); SIGNM.map.colorSpace = THREE.SRGBColorSpace; SIGNM.map.anisotropy = 4;
  const cb = document.createElement('canvas'); cb.width = 1024; cb.height = 1024; const y = cb.getContext('2d');
  BOARDS.forEach(([t, sub, bg, fg], i) => { const ox = (i % 2) * 512, oy = Math.floor(i / 2) * 256;
    const g = y.createLinearGradient(ox, oy, ox + 512, oy + 256); g.addColorStop(0, bg); g.addColorStop(1, shade(bg, -0.35)); y.fillStyle = g; y.fillRect(ox, oy, 512, 256);
    y.fillStyle = fg; y.textAlign = 'left'; y.textBaseline = 'alphabetic'; y.font = '900 66px "Outfit Variable", system-ui, sans-serif'; y.fillText(t, ox + 28, oy + 120, 460);
    y.font = '600 30px system-ui, sans-serif'; y.globalAlpha = 0.92; y.fillText(sub, ox + 28, oy + 176, 460); y.globalAlpha = 1; y.fillStyle = fg; y.fillRect(ox + 28, oy + 200, 90, 8);
    y.fillStyle = '#ce1126'; y.fillRect(ox + 424, oy + 210, 60, 10); y.fillStyle = '#fcd116'; y.fillRect(ox + 424, oy + 220, 60, 10); y.fillStyle = '#006b3f'; y.fillRect(ox + 424, oy + 230, 60, 10); });
  BOARDM = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cb), roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.05 }); BOARDM.map.colorSpace = THREE.SRGBColorSpace; BOARDM.map.anisotropy = 4;
  ROADM = floorMaterial('asphalt', '#55595e', ROAD * 2, SEG); DIRTM = floorMaterial('dirt', '#b98058', 120, SEG); ROADM.userData.flat = DIRTM.userData.flat = true;
}
function shade(hex, f) { const c = new THREE.Color(hex); if (f >= 0) c.lerp(new THREE.Color('#ffffff'), f); else c.multiplyScalar(1 + f); return '#' + c.getHexString(); }
// plane whose UVs cover one slot of an atlas (cols × rows)
function slotPlane(w, h, slot, cols, rows) { const g = new THREE.PlaneGeometry(w, h); const u0 = (slot % cols) / cols, v1 = 1 - Math.floor(slot / cols) / rows, du = 1 / cols, dv = 1 / rows; const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * du, v1 - dv + uv.getY(i) * dv); return g; }

// ------------------------------------------------------------------ street segment
const PAINT = ['#e8d9b5', '#f2c4a0', '#bfd8c8', '#d9c2e0', '#f4e1a1', '#c9d6e8', '#e7b7a5', '#f0ebe0', '#a8d5ba', '#f6bd60', '#e0e1dd', '#ffd6a5'];
const CONT = ['#1f6fb8', '#c8102e', '#0e7a4e', '#f2b632', '#7b2d8e', '#e76f51', '#457b9d'];
class Seg {
  constructor() { this.g = new THREE.Group(); }
  box(w, h, d, col, x, y, z, ry = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof col === 'string' ? mat(col) : col); m.position.set(x, y + h / 2, z); m.rotation.y = ry; this.g.add(m); return m; }
  item(kind, o, x, z, ry = 0, y = 0) { const it = makeItem(kind, o); it.obj.position.set(x, y, z); it.obj.rotation.y = ry; this.g.add(it.obj); return it; }
  plane(geo, m, x, y, z, ry = 0, rx = 0) { const p = new THREE.Mesh(geo, m); p.position.set(x, y, z); p.rotation.set(rx, ry, 0); this.g.add(p); return p; }
}
function buildSegment(seed, opts) {
  _s = (seed * 7919) % 2147483646 + 1; atlas(); const S = new Seg();
  // ground: asphalt, laterite shoulders, kerbs and open gutters
  S.plane(new THREE.PlaneGeometry(ROAD * 2, SEG), ROADM, 0, 0, -SEG / 2, 0, -Math.PI / 2);
  for (const sd of [-1, 1]) S.plane(new THREE.PlaneGeometry(60 - ROAD - GUT, SEG), DIRTM, sd * (30 + (ROAD + GUT) / 2), 0, -SEG / 2, 0, -Math.PI / 2);
  for (let z = -3; z > -SEG; z -= 6) S.box(0.14, 0.012, 2.6, '#f2f2f2', 0, 0, z); // centre dashes
  for (const sd of [-1, 1]) {
    S.box(0.1, 0.012, SEG, '#e9e9e9', sd * (ROAD - 0.2), 0, -SEG / 2);
    S.box(GUT, 0.02, SEG, '#4d5a44', sd * (ROAD + GUT / 2), -0.32, -SEG / 2); // drain water
    S.box(0.12, 0.34, SEG, '#9b9a92', sd * (ROAD + 0.06), -0.32, -SEG / 2); S.box(0.16, 0.42, SEG, '#9b9a92', sd * (ROAD + GUT + 0.08), -0.32, -SEG / 2);
    for (let z = 0; z > -SEG; z -= 1.2) S.box(0.2, 0.16, 1.2, (Math.round(-z / 1.2) % 2) ? '#f2f2ee' : '#1d1d1d', sd * (ROAD + GUT + 0.1), 0, z - 0.6); // painted kerb
    if (rnd() < 0.6) S.box(GUT + 0.3, 0.08, 1.6, '#a8a59c', sd * (ROAD + GUT / 2), 0, -rr(6, SEG - 6)); // slab over the drain
  }
  // buildings along both sides
  for (const sd of [-1, 1]) {
    let z = -rr(0, 2); const ry = sd > 0 ? -Math.PI / 2 : Math.PI / 2; // facade faces the road
    while (z > -SEG + 3) {
      const kind = pick(['shop', 'shop', 'shop', 'storey', 'storey', 'container', 'container', 'wall', 'block', 'unfinished']);
      const w = kind === 'container' ? 6.1 : kind === 'wall' ? rr(6, 10) : rr(6.5, 11); if (z - w < -SEG) break; const zc = z - w / 2;
      building(S, kind, sd, zc, w, ry, opts);
      z -= w + rr(0.4, 2.2);
    }
    // shoulder furniture (kept to x ≥ 6.1 so the sidewalk lane stays clear)
    for (let z = -rr(2, 6); z > -SEG + 2; z -= rr(5, 9)) {
      const x = sd * rr(6.3, 7.1); const r = rnd();
      if (r < 0.22) S.item('palm_tree', { arg: rr(4.2, 6.5), lean: rr(0.1, 0.6) }, x, z, rr(0, 6));
      else if (r < 0.34) S.item('tree', { color: pick(['#4b9a4a', '#3f8a42', '#5aa04f']) }, x, z, rr(0, 6), 0);
      else if (r < 0.52) { S.item('umbrella', { color: pick(['#e63946', '#1d4ed8', '#f2b632', '#0e7a4e']) }, x, z, 0); S.item('hawker_stand', { color: pick(['#f2c230', '#e63946', '#2a9d8f']) }, x + sd * 0.1, z - 0.7, ry); }
      else if (r < 0.62) S.item('momo_kiosk', { color: pick(['#ffcc00', '#c8102e', '#1d4ed8']), label: pick(['MOBILE MONEY\nCASH IN · CASH OUT', 'MOMO · AIRTIME\nSIM REGISTRATION']) }, x + sd * 0.2, z, ry);
      else if (r < 0.7) S.item('bin', { color: pick(['#2e7d32', '#1d4ed8']) }, x - sd * 0.2, z);
      else if (r < 0.78) { S.box(0.9, 0.85, 0.6, '#3a6ea5', x, 0, z, 0); S.box(0.95, 0.05, 0.65, '#2a2a2a', x, 0.85, z); } // ice chest
    }
    for (let z = -4 - (sd > 0 ? 0 : 10); z > -SEG; z -= 20) S.item('lamp_post', {}, sd * (ROAD + GUT + 0.35), z, sd > 0 ? Math.PI : 0);
  }
  // occasional billboard behind the buildings, facing oncoming traffic, and a green direction gantry
  if (rnd() < 0.45) { const sd = rnd() < 0.5 ? -1 : 1; const bx = sd * rr(9, 12), bz = -rr(8, 30), slot = Math.floor(rnd() * BOARDS.length);
    for (const s of [-1, 1]) S.box(0.22, 7.2, 0.22, '#4a4f55', bx + s * 2.4, 0, bz); S.box(6.6, 3.4, 0.25, '#2b2f36', bx, 6.2, bz - 0.1);
    S.plane(slotPlane(6.3, 3.1, slot, 2, 4), BOARDM, bx, 7.9, bz + 0.04); }
  if (opts.gantry) { const gz = -SEG / 2; for (const sd of [-1, 1]) S.box(0.25, 6.2, 0.25, '#7d8590', sd * (ROAD + GUT + 0.4), 0, gz); S.box(ROAD * 2 + 2, 0.25, 0.25, '#7d8590', 0, 5.6, gz);
    const tx = T.text(opts.gantry, '#0f6e3a', '#ffffff', 1024, 192); S.plane(new THREE.PlaneGeometry(5.4, 1.0), mat('#ffffff', { map: tx, e: '#ffffff', ei: 0.1 }), 0, 5.2, gz + 0.16); }
  if (opts.rush) for (let z = -rr(4, 10); z > -SEG; z -= rr(10, 16)) S.item('traffic_cone', {}, sd2() * (ROAD - 0.5), z);
  return bake(S.g);
}
const sd2 = () => (rnd() < 0.5 ? -1 : 1);
function building(S, kind, sd, zc, w, ry, opts) {
  const X = (d) => sd * (XB + d); // distance behind the building line
  const paint = pick(PAINT), dirt = shade(paint, -0.32);
  if (kind === 'container') { // container shop: corrugated box, painted sign, goods outside
    const col = pick(CONT); const D = 2.45, H = 2.6; S.box(D, H, w, col, X(D / 2 - 0.5), 0, zc); for (let k = -w / 2 + 0.2; k < w / 2; k += 0.4) S.box(D + 0.03, H - 0.1, 0.06, shade(col, -0.18), X(D / 2 - 0.5), 0.05, zc + k);
    S.box(0.1, 2.0, w * 0.6, '#231f1c', X(-0.52), 0.05, zc); S.plane(slotPlane(w * 0.85, w * 0.85 / 4, Math.floor(rnd() * SHOPS.length), 2, 16), SIGNM, X(-0.57), 2.25, zc, ry);
    for (let i = 0; i < 4; i++) S.box(0.45, rr(0.3, 0.9), 0.45, pick(['#e63946', '#2a9d8f', '#f4a261', '#264653', '#ffb703', '#8338ec']), X(-0.85), 0, zc + rr(-w / 2.5, w / 2.5));
    return;
  }
  if (kind === 'wall') { // compound wall with a gate, mango tree peeking over
    S.box(0.3, 2.3, w, paint, X(0.15), 0, zc); S.box(0.34, 0.5, w, dirt, X(0.15), 0, zc); S.box(0.36, 0.12, w + 0.04, shade(paint, -0.15), X(0.15), 2.3, zc);
    S.box(0.12, 2.0, 2.6, pick(['#1d4ed8', '#0e7a4e', '#3a3a3a', '#7f1d1d']), X(-0.05), 0, zc + rr(-w / 4, w / 4));
    if (rnd() < 0.6) S.item('tree', { color: '#3f8a42' }, X(2.5), zc, 0);
    if (rnd() < 0.5) { const tx = T.text(pick(['POST NO BILL', 'NO URINATING HERE', 'THIS HOUSE IS NOT FOR SALE', 'GOD IS IN CONTROL']), paint, '#9d0208', 512, 96); S.plane(new THREE.PlaneGeometry(3.2, 0.6), mat('#ffffff', { map: tx }), X(-0.01), 1.3, zc - w / 4, ry); }
    return;
  }
  const floors = kind === 'shop' ? 1 : kind === 'storey' || kind === 'unfinished' ? 2 : Math.floor(rr(3, 5)); const FH = 3.1, D = rr(6, 9), H = floors * FH;
  S.box(D, H, w, paint, X(D / 2), 0, zc); S.box(D + 0.04, 0.55, w + 0.04, dirt, X(D / 2), 0, zc); // dirt splash at the bottom
  S.box(D + 0.2, 0.5, w + 0.2, shade(paint, -0.12), X(D / 2), H, zc); // parapet
  if (kind === 'unfinished') for (let k = -w / 2 + 0.3; k <= w / 2; k += w / 3) { S.box(0.3, 1.1, 0.3, '#a9a59a', X(0.4), H + 0.5, zc + k); for (const o of [-0.08, 0.08]) S.box(0.025, 0.7, 0.025, '#5b3a29', X(0.4 + o), H + 1.6, zc + k + o); } // rebar waiting for "next year"
  // ground floor: shop opening, awning, sign
  const openW = Math.min(w - 1.2, rr(3, 5.5)); S.box(0.1, 2.4, openW, '#2b2420', X(-0.04), 0.1, zc);
  for (let i = 0; i < 6; i++) S.box(0.3, rr(0.3, 1.6), rr(0.3, 0.6), pick(['#e63946', '#2a9d8f', '#f4a261', '#264653', '#ffb703', '#8338ec', '#f1faee']), X(0.15), 0.1, zc + rr(-openW / 2.4, openW / 2.4));
  const aw = pick(['#c8102e', '#0e7a4e', '#1d4ed8', '#f2b632', '#6b4f2f']); const awn = S.box(1.6, 0.08, w * 0.9, aw, X(-0.8), 2.75, zc); awn.rotation.z = sd * 0.22;
  S.plane(slotPlane(Math.min(w - 0.6, 5.6), Math.min(w - 0.6, 5.6) / 4, Math.floor(rnd() * SHOPS.length), 2, 16), SIGNM, X(-0.06), 3.35, zc, ry);
  // upper floors: windows that light up at night, balconies on blocks
  for (let f = 1; f < floors; f++) { const n = Math.max(1, Math.floor(w / 2.6)); for (let i = 0; i < n; i++) { const wz = zc - w / 2 + (i + 0.5) * (w / n);
    S.box(0.08, 1.2, 1.1, WIN, X(-0.03), f * FH + 0.9, wz); S.box(0.12, 0.1, 1.3, '#f4f1ea', X(-0.06), f * FH + 0.85, wz); if (kind === 'block' && rnd() < 0.35) S.box(0.8, 0.08, 1.5, '#cfcac0', X(-0.4), f * FH + 0.4, wz); } }
  if (rnd() < 0.5) { S.box(0.9, 0.5, 0.6, '#e9ecef', X(-0.3), floors > 1 ? FH + 2.2 : 2.0, zc + w / 2 - 0.8); } // AC unit
  if (rnd() < 0.35) S.box(1.2, 1.2, 1.2, '#1b1b1b', X(D - 1.5), H + 0.5, zc + rr(-w / 3, w / 3)); // polytank on the roof
}

// ------------------------------------------------------------------ vehicles
const CAR_COL = { vitz: '#b5172b', corolla: '#c9ccd1', prado: '#1b1f27', gwagon: '#111418' };
function okadaMesh() { const g = new THREE.Group(); const blk = mat('#1b1b1b', { r: 0.6 }), red = mat('#c8102e', { r: 0.4, m: 0.3 }), chrome = mat('#cfd3d8', { r: 0.3, m: 0.8 });
  for (const z of [-0.68, 0.62]) { const wh = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.075, 8, 20), blk); wh.position.set(0, 0.33, z); wh.rotation.y = Math.PI / 2; g.add(wh); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10), chrome); hub.rotation.z = Math.PI / 2; hub.position.set(0, 0.33, z); g.add(hub); }
  const box = (w, h, d, m, x, y, z, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; g.add(b); return b; };
  box(0.2, 0.22, 0.9, red, 0, 0.6, -0.05); box(0.3, 0.2, 0.42, red, 0, 0.78, -0.3); box(0.3, 0.1, 0.8, blk, 0, 0.84, 0.22); box(0.08, 0.08, 0.6, chrome, 0.17, 0.4, 0.35);
  box(0.06, 0.62, 0.06, chrome, 0.1, 0.62, -0.62, -0.35); box(0.06, 0.62, 0.06, chrome, -0.1, 0.62, -0.62, -0.35); box(0.72, 0.05, 0.05, chrome, 0, 1.0, -0.74);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat('#fff7d6', { e: '#fff1b8', ei: 1.4 })); hl.position.set(0, 0.92, -0.8); g.add(hl); box(0.14, 0.06, 0.04, mat('#ff3b3b', { e: '#ff2a2a', ei: 0.8 }), 0, 0.8, 0.64);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; }); return g; }
function vehicle(kind, o = {}) { // returns a group whose front faces -z
  const g = new THREE.Group(); let it;
  if (kind === 'trotro') it = makeItem('trotro', { color: o.color || pick(['#f2f0e6', '#f4f4f2', '#e9e4d4']), stripe: o.stripe || pick(['#f2c230', '#1d4ed8', '#c8102e', '#0e7a4e']) });
  else if (kind === 'okada') { const m = okadaMesh(); g.add(m); g.userData.len = 1.8; return g; }
  else it = makeItem('car_display', { color: o.color || (kind === 'taxi' ? '#f4f4f2' : pick(['#c9ccd1', '#1b1f27', '#b5172b', '#f4f4f2', '#2b4a7a', '#6c757d'])) });
  const obj = it.obj; obj.rotation.y = Math.PI / 2; g.add(obj); obj.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  if (kind === 'taxi') { const y = mat('#f4a90c', { r: 0.4, m: 0.2 }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.36, 0.55), y); c.position.set(sx * 0.87, 0.62, sz * 1.42); g.add(c); }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.22), mat('#ffffff', { map: T.text('TAXI', '#f4a90c', '#17150f', 256, 96), e: '#ffd27a', ei: 0.3 })); sign.position.set(0, 1.46, 0.1); g.add(sign); }
  g.userData.len = kind === 'trotro' ? 4.6 : 3.9; return g;
}
const TRAFFIC = ['trotro', 'trotro', 'taxi', 'taxi', 'car', 'car', 'okada', 'trotro'];

// ------------------------------------------------------------------ the ride scene
export class Ride {
  constructor(stage) { this.stage = stage; this.active = false; }
  start({ mode, look, car, to, rush, hour, onLine }) {
    if (this.active) this.stop();
    atlas(); this.mode = mode; this.rush = !!rush; this.onLine = onLine || (() => {}); this.t = 0; this.yawOff = 0; this.drag0 = 0;
    const sc = this.scene = new THREE.Scene(); const cam = this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 600);
    // sky + light by hour
    const h = hour; const night = h < 5.8 || h > 18.8, dusk = !night && (h < 7.2 || h > 17.4); this.night = night;
    const top = night ? '#0b1026' : dusk ? '#4a5a9a' : '#4fa8e0', bot = night ? '#2a3152' : dusk ? '#f6a86b' : '#d6eef5';
    sc.background = new THREE.Color(bot); sc.fog = new THREE.Fog(bot, night ? 25 : 45, night ? 120 : 175);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { a: { value: new THREE.Color(top) }, b: { value: new THREE.Color(bot) } },
      vertexShader: 'varying float vy; void main(){ vy = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 a; uniform vec3 b; varying float vy; void main(){ gl_FragColor = vec4(mix(b, a, smoothstep(0.0, 0.5, vy)), 1.0); }' }));
    this.sky = sky; sc.add(sky);
    sc.add(new THREE.HemisphereLight(night ? '#8fa0ff' : '#fff4e2', night ? '#2a2230' : '#8a6b52', night ? 0.85 : 1.15));
    const sun = this.sun = new THREE.DirectionalLight(night ? '#9fb0ff' : dusk ? '#ffc58a' : '#fff1dc', night ? 0.35 : dusk ? 1.6 : 2.3); sun.castShadow = !night;
    sun.shadow.mapSize.set(1024, 1024); const s = sun.shadow.camera; s.left = -22; s.right = 22; s.top = 22; s.bottom = -22; s.near = 1; s.far = 120; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sc.add(sun, sun.target);
    WIN.emissiveIntensity = night ? 0.9 : dusk ? 0.25 : 0; SIGNM.emissiveIntensity = night ? 0.45 : 0.05; BOARDM.emissiveIntensity = night ? 0.5 : 0.05;
    // street
    this.to = to; this.segs = []; this.segSeed = Math.floor(Math.random() * 1e6); this.nextSeg = 0;
    for (let i = 0; i < NSEG; i++) this.addSeg();
    // me
    const walk = mode === 'walk'; this.speedT = { walk: 1.45, trotro: 10, okada: 12.5, taxi: 12, bolu: 12, car: 13 }[mode] || 10; this.speed = walk ? 1.45 : this.speedT * 0.6;
    this.me = new THREE.Group(); sc.add(this.me); this.meX = walk ? 5.2 : mode === 'okada' ? 0.7 : LANE; this.me.position.set(this.meX, 0, 0);
    this.people = [];
    if (walk) { this.av = new Avatar(look); this.me.add(this.av.root); this.av.root.rotation.y = Math.PI; this.av.play('walk', 0); this.people.push({ av: this.av, pose: null }); }
    else { const v = vehicle(mode === 'bolu' ? 'car' : mode, mode === 'car' ? { color: CAR_COL[car] || '#c9ccd1' } : mode === 'bolu' ? { color: '#2b2f36' } : {}); this.me.add(v); this.veh = v;
      if (mode === 'okada') { const rider = new Avatar({ body: 'm', top: '#f2b632', bottom: '#2b3a55', skinTone: 6 }); rider.root.position.set(0, 0.74, -0.12); rider.root.rotation.y = Math.PI; v.add(rider.root);
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), mat('#c8102e', { r: 0.3 })); helmet.position.set(0, 0.86, 0.02); rider.root.add(helmet);
        this.av = new Avatar(look); this.av.root.position.set(0, 0.76, 0.32); this.av.root.rotation.y = Math.PI; v.add(this.av.root); this.people.push({ av: rider, pose: 'sit' }, { av: this.av, pose: 'sit' }); }
      if (night) { const hl = new THREE.SpotLight('#fff1c8', 60, 45, 0.5, 0.6, 1.6); hl.position.set(0, 1.0, -2.2); hl.target.position.set(0, 0, -20); v.add(hl, hl.target); } }
    if (night) { this.glow = new THREE.PointLight('#ffcf8a', 18, 26, 1.4); sc.add(this.glow); }
    // traffic: same direction (ahead of you) and oncoming
    this.traffic = [];
    const nSame = this.rush ? 5 : 3, nOn = this.rush ? 6 : 4;
    for (let i = 0; i < nSame; i++) this.addCar(1, -14 - i * (this.rush ? 11 : 26) - Math.random() * 6);
    for (let i = 0; i < nOn; i++) this.addCar(-1, -20 - i * 30 - Math.random() * 20);
    // pedestrians and hawkers
    const LOOKS = [{ body: 'f', top: '#e76f51', bottom: '#2b3a55' }, { body: 'm', top: '#f4f4f2', bottom: '#2b3a55' }, { body: 'f', top: '#7b2d8e', bottom: '#7b2d8e' }, { body: 'm', top: '#0e7a4e', bottom: '#c2a878' }, { body: 'f', top: '#1f6fb8', bottom: '#17150f' }, { body: 'm', top: '#c8102e', bottom: '#2b3a55' }, { body: 'f', top: '#f2b632', bottom: '#2b3a55' }, { body: 'm', top: '#151515', bottom: '#151515' }];
    this.peds = [];
    for (let i = 0; i < (walk ? 8 : 6); i++) { const lk = { ...LOOKS[i % LOOKS.length], skinTone: 4 + (i % 5) }; const av = new Avatar(lk); sc.add(av.root); const p = { av, dir: Math.random() < 0.5 ? -1 : 1, x: (i % 2 ? 1 : -1) * rr2(4.9, 6.0), z: -8 - i * 9, v: rr2(1.1, 1.5), hawker: i % 3 === 2 };
      if (p.hawker) { const tray = new THREE.Group(); tray.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.08, 16), mat('#c9ccd1', { r: 0.3, m: 0.6 }))); for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), mat(['#f4f4f2', '#e63946', '#fcd116', '#2a9d8f'][k % 4])); b.position.set(Math.cos(k) * 0.18, 0.09, Math.sin(k) * 0.18); tray.add(b); } tray.position.y = 1.86; av.root.add(tray); }
      av.play(p.hawker && this.rush ? 'idle' : 'walk', 0); p.walking = !(p.hawker && this.rush); this.peds.push(p); this.people.push({ av, pose: null }); }
    this.line = 0; this.stopT = 0;
    this.active = true; this.stage.override = { scene: sc, camera: cam }; this.place(0);
  }
  addSeg() { const i = this.nextSeg++; const gantry = i % 3 === 1 ? `${this.to.toUpperCase()}  ↑` : null; const g = buildSegment(this.segSeed + i, { gantry, rush: this.rush }); g.position.z = -i * SEG + SEG; this.scene.add(g); this.segs.push(g); }
  addCar(dir, z) { const kind = TRAFFIC[Math.floor(Math.random() * TRAFFIC.length)]; const v = vehicle(kind); v.rotation.y = dir > 0 ? 0 : Math.PI; this.scene.add(v);
    const c = { v, dir, kind, z, x: dir > 0 ? (kind === 'okada' ? 3.0 : LANE) : -LANE + (kind === 'okada' ? -0.7 : 0), sp: dir > 0 ? rr2(6, 11) : rr2(9, 15), ph: Math.random() * 6 };
    if (kind === 'okada') { const r = new Avatar({ body: 'm', top: ['#f2b632', '#1f6fb8', '#151515'][Math.floor(Math.random() * 3)], bottom: '#2b3a55', skinTone: 6 }); r.root.position.set(0, 0.74, -0.12); r.root.rotation.y = Math.PI; v.add(r.root); this.people.push({ av: r, pose: 'sit' }); c.rider = r; }
    this.traffic.push(c); return c; }
  drag(dx) { this.yawOff = Math.max(-1.3, Math.min(1.3, this.yawOff - dx * 0.006)); this.drag0 = 2.5; }
  place(dt) {
    const me = this.me.position; const walk = this.mode === 'walk';
    // camera: behind and above, gentle drift; drag to look around (springs back)
    if (this.drag0 > 0) this.drag0 -= dt; else this.yawOff *= Math.pow(0.4, dt);
    const [dist, hgt] = { walk: [3.8, 2.0], okada: [5.4, 2.9], trotro: [9.6, 4.3] }[this.mode] || [8.2, 3.6]; const a = this.yawOff + Math.sin(this.t * 0.13) * 0.16 + (walk ? 0.12 : 0.1);
    const cam = this.camera; cam.position.set(me.x + Math.sin(a) * dist, hgt + Math.sin(this.t * 1.7) * (walk ? 0.03 : 0.015), me.z + Math.cos(a) * dist);
    cam.lookAt(me.x - Math.sin(a) * 4, walk ? 1.25 : 1.3, me.z - Math.cos(a) * 4);
    if (Math.abs(cam.aspect - innerWidth / innerHeight) > 0.001) { cam.aspect = innerWidth / innerHeight; cam.fov = cam.aspect < 0.8 ? 64 : 50; cam.updateProjectionMatrix(); }
    this.sky.position.copy(cam.position);
    this.sun.position.set(me.x + 14, 26, me.z + 8); this.sun.target.position.set(me.x, 0, me.z - 6); this.sun.target.updateMatrixWorld();
    if (this.glow) this.glow.position.set(me.x - 1, 5, me.z - 6);
  }
  update(dt) {
    if (!this.active) return; this.t += dt; const me = this.me.position; const walk = this.mode === 'walk';
    // target speed: rush-hour go-slow, trotro bus stops, car-following
    let target = this.speedT;
    if (this.rush && !walk && this.mode !== 'okada') target *= 0.25 + 0.75 * Math.max(0, Math.sin(this.t * 0.45));
    if (this.mode === 'trotro') { this.stopT -= dt; if (this.stopT < -16) { this.stopT = 3.5; this.onLine('stop'); } if (this.stopT > 0) target = 0; }
    if (!walk && this.mode !== 'okada') { let gap = 1e9; for (const c of this.traffic) if (c.dir > 0 && Math.abs(c.x - this.meX) < 1.4 && c.z < me.z) gap = Math.min(gap, me.z - c.z - (c.v.userData.len + this.veh.userData.len) / 2); if (gap < 40) target = Math.min(target, Math.max(0, (gap - 3.5) * 0.9)); }
    this.speed += (target - this.speed) * Math.min(1, dt * (target < this.speed ? 2.2 : 0.8)); me.z -= this.speed * dt;
    if (this.mode === 'okada') { this.meX = 0.7 + Math.sin(this.t * 0.6) * 0.25; me.x = this.meX; this.veh.rotation.z = -Math.cos(this.t * 0.6) * 0.06; }
    if (this.veh) { this.veh.position.y = Math.abs(Math.sin(this.t * 9)) * 0.015 * Math.min(1, this.speed / 5); this.veh.rotation.x = Math.sin(this.t * 2.3) * 0.004; }
    if (this.av && walk) this.av.update(dt, this.speed);
    // recycle segments behind the camera
    for (const g of this.segs) if (g.position.z - SEG > me.z + 12) { this.scene.remove(g); g.traverse((m) => { if (m.isMesh) m.geometry.dispose(); }); this.segs.splice(this.segs.indexOf(g), 1); this.addSeg(); break; }
    // traffic
    for (const c of this.traffic) {
      if (c.dir > 0) { let sp = c.sp; if (this.rush) sp *= 0.2 + 0.8 * Math.max(0, Math.sin(this.t * 0.45 + c.ph)); if (!this.rush && !walk && this.mode !== 'okada') sp = Math.max(sp, this.speedT * 1.02); c.z -= sp * dt;
        // keep a gap to the car in front of it
        for (const o of this.traffic) if (o !== c && o.dir > 0 && Math.abs(o.x - c.x) < 1.2 && o.z < c.z && c.z - o.z < 6.5) c.z = o.z + 6.5;
        if (c.z > me.z + 1 || c.z < me.z - 170) { c.z = me.z - rr2(90, 150); } }
      else { c.z += c.sp * (this.rush ? 0.45 : 1) * dt; if (c.z > me.z + 14) c.z = me.z - rr2(120, 180); }
      c.v.position.set(c.x, 0, c.z);
    }
    // pedestrians
    for (const p of this.peds) {
      if (p.walking) p.z += p.dir * p.v * dt; if (p.z > me.z + 12 || p.z < me.z - 110) { p.z = me.z - rr2(25, 95); p.x = (Math.random() < 0.5 ? -1 : 1) * rr2(4.9, 6.0); if (p.hawker && this.rush) p.x = rr2(-0.25, 0.25); }
      p.av.root.position.set(p.x, 0, p.z); p.av.root.rotation.y = p.walking ? (p.dir > 0 ? 0 : Math.PI) : (p.x > 0 ? -Math.PI / 2 : Math.PI / 2);
      if (Math.abs(p.z - me.z) < 60) p.av.update(dt, p.v);
    }
    for (const q of this.people) if (q.pose) { q.av.update(dt, 0); applyPose(q.av, q.pose); }
    this.place(dt);
  }
  stop() {
    if (!this.active) return; this.active = false; this.stage.override = null;
    for (const q of this.people) { q.av.root.userData.av = true; q.av.dispose(); }
    const free = (o) => { if (o.userData.av) return; if (o.isMesh && !o.isSkinnedMesh) o.geometry.dispose(); for (const c of o.children) free(c); };
    for (const g of this.segs) free(g); for (const c of this.traffic) free(c.v); if (this.veh) free(this.veh); this.sky.geometry.dispose(); this.sky.material.dispose(); this.veh = null; this.av = null; this.scene = null; this.segs = []; this.traffic = []; this.peds = []; this.people = [];
  }
}
const rr2 = (a, b) => a + Math.random() * (b - a);
