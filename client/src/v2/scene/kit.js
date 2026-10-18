// Furniture & prop kit for the cutaway rooms: chunky, rounded, flat-coloured "toy diorama" pieces built procedurally.
//   floorMaterial(kind, color, w, d)  → MeshStandardMaterial for the floor slab (canvas textures, ~0.6 m tiles)
//   makeItem(kind, {color, label})    → { obj, size:[w,d], use:[{x,z,y?,face?,pose}], acts?, walkable?, label? }
// Item-local frame: origin = floor centre of the footprint, front faces +z. Use-point `face` is added to the item yaw
// (default π: the person faces the item). Seats use face 0 when the seat faces +z (back of the chair at -z).
// A kind may carry parameters after a colon, e.g. 'low_wall:6' (length), 'pool:4,3', 'airport_seats:5', 'curtain:2.4'.
// Every item's meshes are merged per material (a typical item is 3–8 draw calls). Spinning parts (fans) are kept
// separate and listed in obj.userData.spin = [{ obj, axis, speed }] for an optional animation hook.
import * as THREE from 'three';
import { EnvironmentCache } from './environment-resources.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const PI = Math.PI, HP = Math.PI / 2;
// ------------------------------------------------------------------ deterministic random
let _seed = 1;
const rnd = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };
const seed = (s) => { _seed = Math.abs(Math.floor(s)) % 2147483646 + 1; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

// ------------------------------------------------------------------ palette
export const C = {
  wood: '#a87449', woodD: '#6f4a2e', woodL: '#d3a46e', white: '#f3f0e8', cream: '#efe4cc', black: '#24272b', dark: '#33373d', steel: '#a9b1b8', chrome: '#d6dadf',
  red: '#d43d33', blue: '#2f6fd1', green: '#2e9a58', yellow: '#f2c230', orange: '#ec8a2f', teal: '#2a9d8f', purple: '#7a4fb5', pink: '#e86a92', gold: '#d9a93a',
  gRed: '#ce1126', gGold: '#fcd116', gGreen: '#006b3f', skin: '#7e4c33', foam: '#ecd38a', leaf: '#3f9a4a', leafD: '#2c7238', clay: '#b0603a', water: '#3fb4d8', glass: '#a9d8ea',
};

// ------------------------------------------------------------------ caches
const templateGeometries=new WeakSet();
const MC = new EnvironmentCache(96), GC = new EnvironmentCache(160), TC = new EnvironmentCache(48);
export function trimKitCaches() { MC.trim(); TC.trim(); GC.trim(); }
export function kitCacheStats() { return {materials:MC.size,textures:TC.size,templates:GC.size}; }
export function mat(color, o = {}) {
  const key = color + '|' + (o.r ?? 0.82) + '|' + (o.m ?? 0) + '|' + (o.e || '') + '|' + (o.ei ?? 1) + '|' + (o.map ? o.map.uuid : '') + '|' + (o.op ?? 1) + '|' + (o.side || 0) + '|' + (o.flat ? 1 : 0) + '|' + !!o.vertex;
  let m = MC.get(key); if (m) return m;
  m = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.82, metalness: o.m ?? 0, flatShading: !!o.flat, vertexColors: !!o.vertex });
  if (o.e) { m.emissive = new THREE.Color(o.e); m.emissiveIntensity = o.ei ?? 1; if (o.map && o.emap !== false) m.emissiveMap = o.map; }
  if (o.map) m.map = o.map;
  if (o.op != null && o.op < 1) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; }
  if (o.side) m.side = THREE.DoubleSide;
  MC.set(key, m); return m;
}
const geo = (key, f) => { let g = GC.get(key); if (!g) { g = f();templateGeometries.add(g); GC.set(key, g); } return g; };
const RB = (w, h, d, r) => { r = Math.max(0, Math.min(r, Math.min(w, h, d) / 2 - 0.002)); return r <= 0.004 ? geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)) : geo(`rb${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 1, r)); };
const CY = (rt, rb, h, seg = 16, open = false) => geo(`c${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
const SP = (r, ws = 12, hs = 8) => geo(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const TO = (r, t, seg = 16, arc = PI * 2) => geo(`t${r},${t},${seg},${arc}`, () => new THREE.TorusGeometry(r, t, 6, seg, arc));
const IC = (r, det = 0) => geo(`i${r},${det}`, () => new THREE.IcosahedronGeometry(r, det));
const PL = (w, h) => geo(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h));

// ------------------------------------------------------------------ canvas textures
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function tex(key, w, h, draw, rep = [1, 1]) {
  let t = TC.get(key); if (t) return t;
  t = new THREE.CanvasTexture(canvas(w, h, draw)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4;
  TC.set(key, t); return t;
}
const shade = (hex, f) => { const c = new THREE.Color(hex); if (f >= 0) c.lerp(new THREE.Color('#ffffff'), f); else c.multiplyScalar(1 + f); return '#' + c.getHexString(); };
function noise(x, w, h, base, amt, n = 4000, size = 2) { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { x.fillStyle = shade(base, (rnd() - 0.5) * amt); x.fillRect(rnd() * w, rnd() * h, size, size); } }
function star(x, cx, cy, r, col) { x.fillStyle = col; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -HP + (i * PI) / 5, rr = i % 2 ? r * 0.4 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); }

export const T = {
  fabric: (color='#798c83') => tex('linen'+color,128,128,(x,w,h)=>{noise(x,w,h,color,.075,900,1);x.strokeStyle='rgba(255,255,255,.09)';x.lineWidth=1;for(let i=0;i<w;i+=4){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(w,i);x.stroke();}}),
  kente: (v = 0) => tex('kente' + v, 256, 256, (x, w, h) => {
    seed(7 + v); const sets = [[C.gGold, C.gGreen, C.gRed, '#1d1d1d'], ['#f0b323', '#1f4fa8', '#c8102e', '#111'], ['#e9a53b', '#5b2c83', '#2e8b57', '#1b1b1b']][v % 3];
    x.fillStyle = sets[0]; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { x.fillStyle = sets[1 + (i % 3)]; x.fillRect(i * 32 + 4, 0, 6, h); x.fillRect(i * 32 + 14, 0, 3, h); }
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { if ((r + c) % 2) continue; x.fillStyle = sets[1 + ((r + c) % 3)]; x.fillRect(c * 64 + 6, r * 64 + 8, 52, 48); x.fillStyle = sets[0]; for (let k = 0; k < 4; k++) x.fillRect(c * 64 + 10, r * 64 + 14 + k * 11, 44, 4); x.fillStyle = sets[3]; x.fillRect(c * 64 + 28, r * 64 + 8, 8, 48); }
  }),
  wax: (c1 = '#1f5fa8', c2 = '#f2b632', c3 = '#e2462f') => tex('wax' + c1 + c2 + c3, 256, 256, (x, w, h) => {
    seed(c1.length + c2.charCodeAt(1)); x.fillStyle = c1; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const cx = i * 64 + 32 + (j % 2) * 32, cy = j * 64 + 32; x.fillStyle = c2; x.beginPath(); x.arc(cx % w, cy, 22, 0, PI * 2); x.fill(); x.fillStyle = c3; x.beginPath(); x.arc(cx % w, cy, 11, 0, PI * 2); x.fill(); x.fillStyle = c1; x.beginPath(); x.arc(cx % w, cy, 4, 0, PI * 2); x.fill();
      x.strokeStyle = c3; x.lineWidth = 4; x.beginPath(); x.arc((cx + 32) % w, cy + 32, 14, 0.3, 2.6); x.stroke(); }
  }),
  stripes: (cols, n = 8, vertical = true) => tex('st' + cols.join() + n + vertical, 256, 256, (x, w, h) => { for (let i = 0; i < n; i++) { x.fillStyle = cols[i % cols.length]; if (vertical) x.fillRect((i * w) / n, 0, w / n + 1, h); else x.fillRect(0, (i * h) / n, w, h / n + 1); } }),
  flag: () => tex('flag', 192, 128, (x) => { x.fillStyle = C.gRed; x.fillRect(0, 0, 192, 43); x.fillStyle = C.gGold; x.fillRect(0, 43, 192, 42); x.fillStyle = C.gGreen; x.fillRect(0, 85, 192, 43); star(x, 96, 64, 19, '#111'); }),
  woven: () => tex('woven', 128, 128, (x) => { x.fillStyle = '#b8894d'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#d2a465' : '#9c6f39'; x.fillRect(i * 16 + 1, j * 16 + 1, 14, 14); } }),
  net: () => tex('net', 128, 128, (x) => { x.clearRect(0, 0, 128, 128); x.strokeStyle = '#2f6b5a'; x.lineWidth = 3; for (let i = -128; i < 256; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke(); x.beginPath(); x.moveTo(i + 128, 0); x.lineTo(i, 128); x.stroke(); } }),
  books: () => tex('books', 256, 128, (x, w, h) => { seed(3); x.fillStyle = '#3b2a1f'; x.fillRect(0, 0, w, h); let px = 2; while (px < w - 6) { const bw = 7 + rnd() * 12, bh = h * (0.7 + rnd() * 0.28); x.fillStyle = pick(['#c0392b', '#2e86c1', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22', '#ecf0f1', '#16a085', '#d35400', '#34495e']); x.fillRect(px, h - bh, bw, bh); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(px + 2, h - bh + 8, bw - 4, 3); px += bw + 1; } }),
  keys: () => tex('keys', 256, 32, (x) => { x.fillStyle = '#f7f7f2'; x.fillRect(0, 0, 256, 32); x.fillStyle = '#222'; for (let i = 0; i < 36; i++) { x.fillRect(i * 7.1, 0, 1, 32); if ([0, 1, 3, 4, 5].includes(i % 7)) x.fillRect(i * 7.1 + 4.5, 0, 4, 19); } }),
  screen: (kind = 'show') => tex('scr' + kind, 256, 160, (x, w, h) => {
    seed(kind.length * 13);
    if (kind === 'match') { x.fillStyle = '#2f9e47'; x.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#2a8f40' : '#33a84c'; x.fillRect(i * 32, 0, 32, h); } x.strokeStyle = '#e8ffe8'; x.lineWidth = 3; x.strokeRect(10, 12, w - 20, h - 24); x.beginPath(); x.moveTo(w / 2, 12); x.lineTo(w / 2, h - 12); x.stroke(); x.beginPath(); x.arc(w / 2, h / 2, 22, 0, PI * 2); x.stroke(); x.strokeRect(10, h / 2 - 30, 30, 60); x.strokeRect(w - 40, h / 2 - 30, 30, 60);
      for (let i = 0; i < 14; i++) { x.fillStyle = i < 7 ? '#ffd23f' : '#e63946'; x.beginPath(); x.arc(30 + rnd() * (w - 60), 25 + rnd() * (h - 50), 4, 0, PI * 2); x.fill(); } x.fillStyle = '#fff'; x.beginPath(); x.arc(w * 0.56, h * 0.45, 3, 0, PI * 2); x.fill();
      x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(8, 6, 82, 18); x.fillStyle = '#fff'; x.font = 'bold 13px sans-serif'; x.fillText('HOM 1 - 1 AWY', 12, 20); }
    else if (kind === 'code') { x.fillStyle = '#1e2230'; x.fillRect(0, 0, w, h); for (let i = 0; i < 13; i++) { let px = 10 + (i % 4) * 10; while (px < w - 30 && rnd() > 0.2) { const lw = 10 + rnd() * 40; x.fillStyle = pick(['#7fd1ff', '#ffcb6b', '#c792ea', '#c3e88d', '#f78c6c', '#89ddff']); x.fillRect(px, 10 + i * 11, lw, 5); px += lw + 6; } } }
    else if (kind === 'film') { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f6a35b'); gr.addColorStop(0.6, '#c2456b'); gr.addColorStop(1, '#3a1d4f'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd98a'; x.beginPath(); x.arc(w * 0.7, h * 0.45, 26, 0, PI * 2); x.fill(); x.fillStyle = '#1b1027'; x.fillRect(0, h * 0.72, w, h); x.beginPath(); x.ellipse(w * 0.32, h * 0.7, 18, 34, 0, 0, PI * 2); x.fill(); x.beginPath(); x.arc(w * 0.32, h * 0.38, 12, 0, PI * 2); x.fill(); }
    else if (kind === 'atm') { x.fillStyle = '#1b5fb3'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.fillText('WELCOME', 70, 50); x.font = '14px sans-serif'; x.fillText('Insert card', 88, 80); for (let i = 0; i < 3; i++) { x.fillStyle = '#4c8ee0'; x.fillRect(16, 96 + i * 20, 60, 14); x.fillRect(180, 96 + i * 20, 60, 14); } }
    else if (kind === 'board') { x.fillStyle = '#121418'; x.fillRect(0, 0, w, h); x.font = 'bold 13px monospace'; const rows = [['KUMASI', '14:30', 'ON TIME'], ['TAMALE', '15:05', 'BOARDING'], ['LAGOS', '15:40', 'ON TIME'], ['TAKORADI', '16:10', 'DELAYED'], ['ABIDJAN', '16:55', 'ON TIME'], ['LOME', '17:20', 'GATE 3']];
      x.fillStyle = '#fff'; x.fillText('DEPARTURES', 8, 18); rows.forEach((r, i) => { x.fillStyle = '#ffcc33'; x.fillText(r[0], 8, 42 + i * 19); x.fillText(r[1], 110, 42 + i * 19); x.fillStyle = r[2] === 'DELAYED' ? '#ff6b5b' : '#7dff8a'; x.fillText(r[2], 170, 42 + i * 19); }); }
    else if (kind === 'runway') { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8fd0f0'); gr.addColorStop(0.62, '#d9f0f7'); gr.addColorStop(0.63, '#6f7a74'); gr.addColorStop(1, '#4b544f'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; for (let i = 0; i < 8; i++) x.fillRect(i * 34, h * 0.82, 18, 3);
      x.fillStyle = '#f4f6f8'; x.beginPath(); x.ellipse(150, 52, 54, 7, -0.12, 0, PI * 2); x.fill(); x.beginPath(); x.moveTo(140, 52); x.lineTo(118, 78); x.lineTo(132, 78); x.lineTo(166, 52); x.fill(); x.beginPath(); x.moveTo(196, 44); x.lineTo(206, 26); x.lineTo(212, 26); x.lineTo(206, 46); x.fill(); x.fillStyle = '#c8102e'; x.fillRect(100, 52, 90, 2); }
    else if (kind === 'news') { x.fillStyle = '#20314f'; x.fillRect(0, 0, w, h); x.fillStyle = '#c8102e'; x.fillRect(0, h - 34, w, 34); x.fillStyle = '#fff'; x.font = 'bold 15px sans-serif'; x.fillText('BREAKING: CEDI RALLIES', 10, h - 12); x.fillStyle = '#e9c46a'; x.fillRect(150, 22, 80, 80); x.fillStyle = '#4a2e1f'; x.beginPath(); x.arc(190, 52, 18, 0, PI * 2); x.fill(); x.fillRect(166, 72, 48, 30); }
    else { const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#3a86ff'); gr.addColorStop(1, '#8338ec'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = '#ffbe0b'; x.beginPath(); x.arc(70, 80, 30, 0, PI * 2); x.fill(); x.fillStyle = '#fb5607'; x.fillRect(130, 50, 80, 60); x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(20, h - 28, w - 40, 10); }
  }),
  text: (text, bg = '#c8102e', fg = '#fff', w = 512, h = 128) => tex('tx' + text + bg + fg + w + h, w, h, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    const lines = String(text).split('\n'); const fs = Math.min(h * 0.72 / lines.length, 90);
    x.font = `800 ${fs}px "Outfit Variable", system-ui, sans-serif`; lines.forEach((l, i) => x.fillText(l.toUpperCase(), w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.05, w * 0.92));
  }),
  scribble: () => tex('scrib', 256, 128, (x, w, h) => { seed(5); x.fillStyle = '#fbfbf7'; x.fillRect(0, 0, w, h); x.strokeStyle = '#2c4fb0'; x.lineWidth = 2; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(14, 18 + i * 17); for (let k = 0; k < 18; k++) x.lineTo(14 + k * 9 + rnd() * 5, 18 + i * 17 + (rnd() - 0.5) * 6); x.stroke(); } x.strokeStyle = '#c8102e'; x.beginPath(); x.arc(205, 64, 26, 0, PI * 2); x.stroke(); x.beginPath(); x.moveTo(185, 64); x.lineTo(225, 64); x.moveTo(205, 44); x.lineTo(205, 84); x.stroke(); }),
  speaker: () => tex('spk', 64, 64, (x) => { x.fillStyle = '#1b1c1f'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#2a2c30'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.beginPath(); x.arc(4 + i * 8, 4 + j * 8, 2, 0, PI * 2); x.fill(); } }),
  tilesWall: (c = '#dfeff5') => tex('tw' + c, 128, 128, (x) => { x.fillStyle = shade(c, -0.18); x.fillRect(0, 0, 128, 128); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = shade(c, (i + j) % 2 ? 0.05 : -0.02); x.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); } }, [1, 1]),
  chevron: () => tex('chev', 256, 64, (x) => { for (let i = -64; i < 256; i += 32) { x.fillStyle = '#dc2626'; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 16, 0); x.lineTo(i + 32, 64); x.lineTo(i + 16, 64); x.fill(); x.fillStyle = '#facc15'; x.beginPath(); x.moveTo(i + 16, 0); x.lineTo(i + 32, 0); x.lineTo(i + 48, 64); x.lineTo(i + 32, 64); x.fill(); } }),
  taxiBadge: () => tex('taxib', 128, 128, (x) => { x.fillStyle = '#f59e0b'; x.beginPath(); x.arc(64, 64, 58, 0, PI * 2); x.fill(); x.strokeStyle = '#1f2937'; x.lineWidth = 5; x.stroke(); x.fillStyle = '#1f2937'; x.font = 'bold 22px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('GPRTU', 64, 46); x.font = 'bold 15px system-ui, sans-serif'; x.fillText('ACCRA', 64, 76); star(x, 64, 98, 7, '#dc2626'); }),
};

// ------------------------------------------------------------------ floor materials
const FLOOR_UNIT = { tiles: 1.2, checker: 1.2, terrazzo: 2.4, wood: 1.6, concrete: 3, sand: 3, grass: 3, carpet: 2, lino: 1.8, dirt: 3, pavers: 1.2, asphalt: 4, stone: 1.8, court: 2 };
const FLOOR_BASE = { tiles: '#e9e2d4', checker: '#e9e2d4', terrazzo: '#d9d2c6', wood: '#b78456', concrete: '#b9b6ae', sand: '#e8d3a2', grass: '#7cb760', carpet: '#8a3b3b', lino: '#c59a6a', dirt: '#b77a4f', pavers: '#b9a993', asphalt: '#55585c', stone: '#c9bba3', court: '#c46a3c' };
const FLOOR_DRAW = {
  tiles: (x, w, h, c) => { x.fillStyle = shade(c, -0.22); x.fillRect(0, 0, w, h); const n = 2, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = shade(c, (rnd() - 0.5) * 0.06); x.fillRect(i * s + 3, j * s + 3, s - 6, s - 6); x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(i * s + 6, j * s + 6, s * 0.5, 4); } },
  checker: (x, w, h, c) => { const s = w / 2; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? shade(c, -0.35) : shade(c, 0.1); x.fillRect(i * s, j * s, s, s); } x.strokeStyle = shade(c, -0.5); x.lineWidth = 2; x.strokeRect(0, 0, w, h); },
  terrazzo: (x, w, h, c) => { x.fillStyle = c; x.fillRect(0, 0, w, h); for (let i = 0; i < 1400; i++) { x.fillStyle = pick([shade(c, -0.35), shade(c, 0.3), '#8a6a52', '#6d7f8c', '#b45a3c', '#f4f1ea']); const r = 1 + rnd() * 3.2; x.beginPath(); x.ellipse(rnd() * w, rnd() * h, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, PI * 2); x.fill(); } x.fillStyle = shade(c, -0.25); x.fillRect(0, 0, w, 2); x.fillRect(0, 0, 2, h); },
  wood: (x, w, h, c) => { const n = 4, s = w / n; for (let i = 0; i < n; i++) { const b = shade(c, (rnd() - 0.5) * 0.18); x.fillStyle = b; x.fillRect(i * s, 0, s, h); x.strokeStyle = shade(b, -0.12); x.lineWidth = 1; for (let k = 0; k < 5; k++) { x.beginPath(); const gx = i * s + rnd() * s; x.moveTo(gx, 0); x.bezierCurveTo(gx + 6, h * 0.3, gx - 6, h * 0.6, gx + 3, h); x.stroke(); } x.fillStyle = shade(c, -0.35); x.fillRect(i * s, 0, 2, h); x.fillRect(i * s, ((i * 0.37) % 1) * h, s, 2); } },
  concrete: (x, w, h, c) => { noise(x, w, h, c, 0.12, 6000, 2); x.fillStyle = shade(c, -0.2); x.fillRect(0, 0, w, 2); x.fillRect(0, 0, 2, h); },
  sand: (x, w, h, c) => { noise(x, w, h, c, 0.14, 9000, 2); for (let i = 0; i < 40; i++) { x.fillStyle = shade(c, -0.25); x.beginPath(); x.arc(rnd() * w, rnd() * h, 1.5, 0, PI * 2); x.fill(); } x.strokeStyle = shade(c, 0.12); x.lineWidth = 2; for (let i = 0; i < 6; i++) { x.beginPath(); const y = rnd() * h; x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y); x.stroke(); } },
  grass: (x, w, h, c) => { noise(x, w, h, c, 0.2, 5000, 3); x.strokeStyle = shade(c, -0.2); for (let i = 0; i < 500; i++) { const px = rnd() * w, py = rnd() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * 4, py - 5); x.stroke(); } },
  carpet: (x, w, h, c) => { noise(x, w, h, c, 0.08, 6000, 2); },
  lino: (x, w, h, c) => { x.fillStyle = c; x.fillRect(0, 0, w, h); const s = w / 2; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const cx = i * s + s / 2, cy = j * s + s / 2; x.fillStyle = shade(c, -0.22); x.beginPath(); x.moveTo(cx, cy - s * 0.46); x.lineTo(cx + s * 0.46, cy); x.lineTo(cx, cy + s * 0.46); x.lineTo(cx - s * 0.46, cy); x.closePath(); x.fill();
      x.fillStyle = '#2f5d8a'; x.beginPath(); x.arc(cx, cy, s * 0.2, 0, PI * 2); x.fill(); x.fillStyle = shade(c, 0.35); x.beginPath(); x.arc(cx, cy, s * 0.12, 0, PI * 2); x.fill(); x.fillStyle = '#8c3b2a'; for (let k = 0; k < 4; k++) { const a = k * HP; x.beginPath(); x.arc(cx + Math.cos(a) * s * 0.32, cy + Math.sin(a) * s * 0.32, s * 0.05, 0, PI * 2); x.fill(); } }
    x.strokeStyle = shade(c, 0.25); x.lineWidth = 3; x.strokeRect(1, 1, w - 2, h - 2); },
  dirt: (x, w, h, c) => { noise(x, w, h, c, 0.2, 7000, 3); for (let i = 0; i < 60; i++) { x.fillStyle = shade(c, (rnd() - 0.3) * 0.5); x.beginPath(); x.arc(rnd() * w, rnd() * h, 1 + rnd() * 3, 0, PI * 2); x.fill(); } },
  pavers: (x, w, h, c) => { x.fillStyle = shade(c, -0.35); x.fillRect(0, 0, w, h); const s = w / 4; for (let j = 0; j < 4; j++) for (let i = -1; i < 4; i++) { const ox = (j % 2) * s * 0.5; x.fillStyle = shade(pick([c,c,shade(c,.05),shade(c,-.07)]), (rnd() - 0.5) * 0.1); x.beginPath(); x.roundRect(i * s + ox + 2, j * s + 2, s - 4, s - 4, 5); x.fill(); } },
  asphalt: (x, w, h, c) => { noise(x, w, h, c, 0.18, 9000, 2); },
  stone: (x, w, h, c) => { x.fillStyle = shade(c, -0.3); x.fillRect(0, 0, w, h); const s = w / 3; for (let j = 0; j < 3; j++) for (let i = -1; i < 3; i++) { x.fillStyle = shade(c, (rnd() - 0.5) * 0.18); x.fillRect(i * s + (j % 2) * s * 0.5 + 3, j * s + 3, s - 6, s - 6); } },
  court: (x, w, h, c) => { noise(x, w, h, c, 0.08, 3000, 2); },
};
export function floorMaterial(kind = 'tiles', color, w = 8, d = 8) {
  if (!FLOOR_DRAW[kind]) kind = 'tiles';
  const c = color || FLOOR_BASE[kind]; const key = 'floor' + kind + c;
  seed(kind.length * 31 + c.charCodeAt(2));
  const base = tex(key, 256, 256, (x, W, H) => FLOOR_DRAW[kind](x, W, H, c));
  const t = base.clone(); t.needsUpdate = true; const u = FLOOR_UNIT[kind]; t.repeat.set(w / u, d / u);
  return new THREE.MeshStandardMaterial({ map: t, roughness: kind === 'tiles' || kind === 'checker' ? 0.55 : kind === 'terrazzo' ? 0.6 : 0.9, metalness: 0 });
}

// ------------------------------------------------------------------ builder
const M = (m) => (typeof m === 'string' ? mat(m) : m);
export class B {
  constructor() { this.g = new THREE.Group(); this.spin = []; }
  add(geom, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { const o = new THREE.Mesh(geom, M(m)); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); this.g.add(o); return o; }
  box(w, h, d, m, x = 0, y = 0, z = 0, r = 0.02, ry = 0) { return this.add(RB(w, h, d, r), m, x, y + h / 2, z, 0, ry, 0); } // y = bottom
  bc(w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0, r = 0.015) { return this.add(RB(w, h, d, r), m, x, y, z, rx, ry, rz); } // centred
  cyl(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 16) { return this.add(CY(rt, rb, h, seg), m, x, y + h / 2, z); } // y = bottom
  cc(rt, rb, h, m, x, y, z, rx = 0, ry = 0, rz = 0, seg = 12) { return this.add(CY(rt, rb, h, seg), m, x, y, z, rx, ry, rz); } // centred
  sph(r, m, x, y, z, sx = 1, sy = 1, sz = 1, ws = 12, hs = 8) { return this.add(SP(r, ws, hs), m, x, y, z, 0, 0, 0, sx, sy, sz); }
  // a straight bar between two points (thin cylinder)
  bar(a, b, r, m, seg = 8) { const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b); const len = va.distanceTo(vb); const o = new THREE.Mesh(CY(r, r, len, seg), M(m)); o.position.copy(va).add(vb).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize()); this.g.add(o); return o; }
  plane(w, h, m, x, y, z, rx = 0, ry = 0, rz = 0) { const o = this.add(PL(w, h), m, x, y, z, rx, ry, rz); return o; }
  keep(o) { o.userData.keep = true; return o; }
  done(size, use, extra = {}) { const obj = finalize(this.g); if (this.spin.length) obj.userData.spin = this.spin; return { obj, size, use, ...extra }; }
}
// merge meshes per material (and shadow flag) into one geometry each
function finalize(g) {
  g.updateMatrixWorld(true); const groups = new Map(); const out = new THREE.Group(); const keep = [];
  for (const m of g.children.slice()) {
    if (!m.isMesh || m.userData.keep || m.userData.liveScreen || Array.isArray(m.material)) { keep.push(m); continue; }
    const plain = !m.material.map && !m.material.transparent && !m.material.emissive.getHex() && !m.material.flatShading && m.material.side === THREE.FrontSide;
    const surface = plain ? mat('#ffffff', {r:m.material.metalness > .3 ? .38 : .85, m:m.material.metalness > .3 ? .5 : 0, vertex:true}) : m.material;
    const k = surface.uuid + (m.userData.noShadow ? 'n' : ''); if (!groups.has(k)) groups.set(k, { mat: surface, ns: !!m.userData.noShadow, list: [] });
    let gg = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); gg.applyMatrix4(m.matrix);
    for (const a of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(a)) gg.deleteAttribute(a);
    if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
    if (plain) { const colors = new Float32Array(gg.attributes.position.count * 3), c=m.material.color; for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}gg.setAttribute('color',new THREE.BufferAttribute(colors,3)); }
    gg.morphAttributes = {}; groups.get(k).list.push(gg);
    // Template geometry belongs to GC; standalone authored pieces have no cache owner.
    if (!templateGeometries.has(m.geometry)) m.geometry.dispose();
  }
  for (const { mat: mm, ns, list } of groups.values()) { const merged = list.length === 1 ? list[0] : mergeGeometries(list, false); for (const l of list) if (l !== merged) l.dispose(); const mesh = new THREE.Mesh(merged, mm); if (ns) mesh.userData.noShadow = true; out.add(mesh); }
  for (const k of keep) out.add(k);
  return out;
}
// use-point helpers
const U = { sit: (x, z, y = 0.45, face = 0, pose = 'sit') => ({ x, z, y, face, pose }), stand: (x, z, face = PI, pose = 'stand') => ({ x, z, face, pose }), work: (x, z, face = PI) => ({ x, z, face, pose: 'work' }) };

// ------------------------------------------------------------------ shared sub-assemblies
function chairMono(b, color = C.white, x = 0, z = 0, ry = 0) {
  const g = new B(); const m = mat(color, { r: 0.55 });
  g.box(0.46, 0.05, 0.44, m, 0, 0.41, 0, 0.02);
  for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) g.add(RB(0.05, 0.44, 0.05, 0.015), m, lx * 1.06, 0.21, lz * 1.06, lz > 0 ? -0.07 : 0.07, 0, lx > 0 ? 0.07 : -0.07);
  g.bc(0.44, 0.42, 0.045, m, 0, 0.68, -0.22, -0.14, 0, 0, 0.02);
  for (const s of [-1, 1]) { g.bc(0.045, 0.04, 0.4, m, s * 0.225, 0.66, -0.02); g.bc(0.04, 0.22, 0.04, m, s * 0.225, 0.55, 0.16); }
  return attach(b, g, x, z, ry);
}
function chairWood(b, color = C.wood, x = 0, z = 0, ry = 0) {
  const g = new B(); const m = mat(color);
  g.box(0.44, 0.05, 0.42, m, 0, 0.42, 0, 0.015);
  for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.17], [0.19, 0.17]]) g.box(0.045, 0.42, 0.045, m, lx, 0, lz, 0.01);
  for (const s of [-1, 1]) g.box(0.045, 0.5, 0.045, m, s * 0.19, 0.47, -0.18, 0.01);
  g.box(0.42, 0.12, 0.035, m, 0, 0.8, -0.18, 0.01); g.box(0.42, 0.06, 0.03, m, 0, 0.62, -0.18, 0.01);
  return attach(b, g, x, z, ry);
}
function attach(b, g, x, z, ry, y = 0) { const grp = new THREE.Group(); for (const c of g.g.children.slice()) grp.add(c); grp.position.set(x, y, z); grp.rotation.y = ry; grp.updateMatrix(); for (const c of grp.children.slice()) { c.applyMatrix4(grp.matrix); b.g.add(c); } return b; }
function tableTop(b, w, d, h, top, leg, x = 0, z = 0, r = 0.03) { b.box(w, 0.05, d, top, x, h - 0.05, z, r); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.05, h - 0.05, 0.05, leg, x + sx * (w / 2 - 0.07), 0, z + sz * (d / 2 - 0.07), 0.01); }
function pot(b, r, h, m, x, y, z, lid = true) { b.cyl(r, r * 0.92, h, m, x, y, z, 18); b.add(TO(r, 0.012, 18), mat(C.steel, { r: 0.4, m: 0.6 }), x, y + h, z, HP); if (lid) { b.cyl(r * 0.98, r * 0.98, 0.02, m, x, y + h, z, 18); b.sph(0.03, C.dark, x, y + h + 0.04, z); } for (const s of [-1, 1]) b.bc(0.06, 0.025, 0.03, C.dark, x + s * (r + 0.02), y + h * 0.85, z); }
function plate(b, x, y, z, food = '#e0a33a', r = 0.11) { b.cyl(r, r * 0.8, 0.025, C.white, x, y, z, 14); if (food) b.sph(r * 0.65, food, x, y + 0.025, z, 1, 0.45, 1, 10, 6); }
function bottle(b, x, y, z, col = '#2e7d32', h = 0.28) { b.cyl(0.035, 0.035, h * 0.65, mat(col, { r: 0.25 }), x, y, z, 8); b.cyl(0.012, 0.03, h * 0.35, mat(col, { r: 0.25 }), x, y + h * 0.65, z, 8); }
function leafClump(b, x, y, z, s = 1, col = C.leaf) { b.add(IC(0.28 * s, 0), mat(col, { flat: true }), x, y, z, 0.3, 0.5, 0, 1, 0.8, 1); b.add(IC(0.2 * s, 0), mat(shade(col, -0.18), { flat: true }), x + 0.12 * s, y + 0.1 * s, z - 0.08 * s, 0.6, 0.2, 0.3); b.add(IC(0.18 * s, 0), mat(shade(col, 0.12), { flat: true }), x - 0.12 * s, y + 0.12 * s, z + 0.06 * s, 0.1, 1.1, 0.4); }
function pile(b, cx, cy, cz, r, col, n = 9, s = 0.05) { seed(cx * 100 + cz * 37 + n); const m = mat(col, { r: 0.55 }); let k = 0; for (let ring = 0; k < n; ring++) { const cnt = Math.max(1, 6 - ring * 2), rr = Math.max(0, r - ring * s * 1.4); for (let i = 0; i < cnt && k < n; i++, k++) { const a = (i / cnt) * PI * 2 + ring; b.sph(s, m, cx + Math.cos(a) * rr, cy + s * 0.8 + ring * s * 1.3, cz + Math.sin(a) * rr, 1, 0.9, 1, 8, 6); } } }
function signPanel(b, text, bg, fg, w, h, x, y, z, ry = 0) { const t = T.text(text, bg, fg, 512, Math.round((512 * h) / w)); const o = b.add(RB(w, h, 0.04, 0.01), mat('#ffffff', { map: t, e: '#ffffff', ei: 0.18, r: 0.7 }), x, y, z, 0, ry, 0); return o; }
function frame(b, x, y, z, w = 0.5, h = 0.4, kind = 'show') { b.box(w + 0.06, h + 0.06, 0.03, C.woodD, x, y - (h + 0.06) / 2, z, 0.005); b.plane(w, h, mat('#ffffff', { map: T.screen(kind), r: 0.6 }), x, y, z + 0.017); }

// ------------------------------------------------------------------ items
const K = {};
// --- sleeping
K.mattress = (o) => { const b = new B(); b.box(1.35, 0.2, 1.95, mat(C.foam, { r: 0.95 }), 0, 0, 0, 0.06); b.box(1.37, 0.03, 1.97, mat('#fff', { map: T.wax(o.color || '#1f6fb8', '#f4c542', '#e34b32') }), 0, 0.19, 0, 0.012);
  b.box(0.6, 0.12, 0.34, C.white, -0.3, 0.21, -0.72, 0.05); b.box(0.6, 0.12, 0.34, '#f1e4c8', 0.32, 0.21, -0.74, 0.05); b.box(1.3, 0.06, 0.7, mat('#fff', { map: T.kente(1) }), 0, 0.21, 0.55, 0.03);
  return b.done([1.4, 2.0], [U.sit(-0.3, 0.05, 0.22, 0, 'lie'), U.sit(0.3, 0.05, 0.22, 0, 'lie')]); };
K.bed = (o) => { const b = new B(); const wd = mat(o.color || C.woodD); b.box(1.62, 0.28, 2.05, wd, 0, 0.1, 0, 0.03); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.08, 0.12, 0.08, wd, sx * 0.74, 0, sz * 0.95, 0.01);
  b.box(1.52, 0.2, 1.95, C.white, 0, 0.36, 0.02, 0.06); b.box(1.56, 0.05, 1.25, mat('#fff', { map: T.fabric(o.sheet || '#718782') }), 0, 0.54, 0.38, 0.02); b.box(1.56, 0.02, 0.15, mat('#fff', { map: T.kente(0) }), 0, 0.585, -0.2, 0.005);
  b.box(0.62, 0.14, 0.36, '#f5efe2', -0.37, 0.56, -0.74, 0.06); b.box(0.62, 0.14, 0.36, '#f5efe2', 0.37, 0.56, -0.74, 0.06);
  b.box(1.72, 1.05, 0.1, wd, 0, 0, -1.04, 0.04); b.box(1.5, 0.5, 0.04, shade(o.color || C.woodD, 0.18), 0, 0.5, -0.99, 0.02); b.box(1.72, 0.55, 0.08, wd, 0, 0, 1.04, 0.03);
  return b.done([1.75, 2.15], [U.sit(-0.36, 0.06, 0.58, 0, 'lie'), U.sit(0.36, 0.06, 0.58, 0, 'lie')]); };
K.bunk = (o) => { const b = new B(); const m = mat(o.color || C.steel, { r: 0.5, m: 0.4 }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.03, 0.03, 1.85, m, sx * 0.47, 0, sz * 0.97, 8);
  for (const y of [0.3, 1.38]) { b.box(1.0, 0.06, 2.0, m, 0, y, 0, 0.01); b.box(0.92, 0.14, 1.9, mat(C.foam), 0, y + 0.06, 0, 0.04); b.box(0.94, 0.03, 1.2, mat('#fff', { map: T.wax('#2a7f62', '#f6d04d', '#d1495b') }), 0, y + 0.19, 0.35, 0.01); b.box(0.5, 0.1, 0.3, C.white, 0, y + 0.2, -0.75, 0.04); }
  b.box(1.0, 0.04, 0.04, m, 0, 1.62, 0.97); b.box(1.0, 0.04, 0.04, m, 0, 1.62, -0.97); for (let i = 0; i < 4; i++) b.box(0.32, 0.03, 0.03, m, 0.55, 0.35 + i * 0.32, 0.6); b.cyl(0.02, 0.02, 1.5, m, 0.4, 0, 0.6, 6); b.cyl(0.02, 0.02, 1.5, m, 0.7, 0, 0.6, 6);
  return b.done([1.05, 2.05], [U.sit(0, 0.06, 0.5, 0, 'lie')]); };
K.hospital_bed = (o) => { const b = new B(); const m = mat(C.chrome, { r: 0.35, m: 0.5 }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.cyl(0.025, 0.025, 0.5, m, sx * 0.42, 0.06, sz * 0.92, 6); b.sph(0.05, C.dark, sx * 0.42, 0.05, sz * 0.92); }
  b.box(0.95, 0.08, 1.95, m, 0, 0.5, 0, 0.02); b.box(0.9, 0.14, 1.9, '#e9f1f4', 0, 0.56, 0, 0.05); b.box(0.92, 0.04, 1.1, o.color || '#7fb7d8', 0, 0.69, 0.35, 0.015); b.box(0.5, 0.1, 0.32, C.white, 0, 0.7, -0.74, 0.04);
  b.box(0.95, 0.6, 0.05, '#cfe3ec', 0, 0.5, -1.0, 0.02); b.box(0.95, 0.35, 0.05, '#cfe3ec', 0, 0.5, 1.0, 0.02); for (const s of [-1, 1]) b.box(0.03, 0.18, 0.9, m, s * 0.48, 0.72, -0.2, 0.01);
  b.cyl(0.015, 0.015, 1.7, m, 0.62, 0, -0.85, 6); b.cyl(0.18, 0.18, 0.02, m, 0.62, 0, -0.85, 5); b.box(0.12, 0.2, 0.05, mat('#e6f6ff', { op: 0.75, r: 0.2 }), 0.62, 1.45, -0.85, 0.02);
  return b.done([1.1, 2.05], [U.sit(0, 0.05, 0.7, 0, 'lie')]); };
K.sunbed = (o) => { const b = new B(); const wd = mat(C.woodL); b.box(0.7, 0.06, 1.9, wd, 0, 0.26, 0.05, 0.02); for (const sx of [-1, 1]) for (const sz of [-0.8, 0.85]) b.box(0.05, 0.26, 0.05, wd, sx * 0.3, 0, sz); b.bc(0.7, 0.06, 0.6, wd, 0, 0.45, -0.75, 0.6, 0, 0);
  b.box(0.66, 0.06, 1.3, mat('#fff', { map: T.stripes([o.color || '#2a9d8f', '#f6f1e6'], 6, true) }), 0, 0.32, 0.3, 0.03); b.bc(0.66, 0.06, 0.6, mat('#fff', { map: T.stripes([o.color || '#2a9d8f', '#f6f1e6'], 6, true) }), 0, 0.5, -0.72, 0.6, 0, 0);
  return b.done([0.75, 1.95], [U.sit(0, 0.15, 0.36, 0, 'lie')]); };
// --- storage
K.wardrobe = (o) => { const b = new B(); const c = o.color || C.wood; b.box(1.2, 2.0, 0.6, c, 0, 0.05, 0, 0.03); b.box(1.24, 0.06, 0.62, shade(c, -0.25), 0, 2.02, 0, 0.02); for (const s of [-1, 1]) { b.box(0.56, 1.7, 0.03, shade(c, 0.1), s * 0.29, 0.22, 0.3, 0.02); b.box(0.03, 0.2, 0.03, C.gold, s * 0.04, 1.05, 0.33, 0.01); } b.box(1.16, 0.15, 0.03, shade(c, -0.15), 0, 0.06, 0.3, 0.01);
  b.box(0.45, 0.25, 0.35, '#8c5a3c', -0.25, 2.05, 0, 0.03); return b.done([1.25, 0.65], [U.stand(0, 0.75)]); };
K.chest = (o) => { const b = new B(); const c = o.color || '#3d6fa3'; b.box(0.9, 0.42, 0.5, c, 0, 0, 0, 0.04); b.box(0.92, 0.12, 0.52, shade(c, -0.15), 0, 0.42, 0, 0.04); for (const x of [-0.3, 0.3]) b.box(0.06, 0.55, 0.53, C.steel, x, 0, 0, 0.01); b.box(0.1, 0.1, 0.03, C.gold, 0, 0.32, 0.26); return b.done([0.95, 0.55], [U.stand(0, 0.65)]); };
K.bookshelf = (o) => { const b = new B(); const c = o.color || C.wood; const w = o.arg || 0.9; b.box(w, 1.8, 0.32, c, 0, 0, 0, 0.02); const bk = mat('#fff', { map: T.books() }); for (let i = 0; i < 4; i++) { b.box(w - 0.06, 0.03, 0.28, shade(c, -0.2), 0, 0.12 + i * 0.42, 0.03, 0.005); b.plane(w - 0.08, 0.36, bk, 0, 0.33 + i * 0.42, 0.165); }
  return b.done([w + 0.05, 0.36], [U.stand(0, 0.6)]); };
K.library_shelf = (o) => K.bookshelf({ ...o, arg: 1.8, color: o.color || '#7a5234' });
K.shop_shelf = (o) => { const b = new B(); const c = o.color || C.white; const w = o.arg || 1.6; b.box(w, 1.9, 0.4, c, 0, 0, 0, 0.02); seed(w * 10); for (let i = 0; i < 4; i++) { b.box(w - 0.06, 0.03, 0.36, shade(c, -0.15), 0, 0.15 + i * 0.44, 0.03, 0.005); for (let x = -w / 2 + 0.14; x < w / 2 - 0.1; x += 0.2 + rnd() * 0.06) { const h = 0.12 + rnd() * 0.2; b.box(0.15, h, 0.22, pick(['#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#8ecae6', '#ffb703', '#d62828', '#6a4c93']), x, 0.18 + i * 0.44, 0.05, 0.01); } }
  return b.done([w + 0.05, 0.45], [U.stand(0, 0.7)]); };
K.medicine_shelf = (o) => K.shop_shelf({ ...o, color: '#e9f2f5' });
K.display_case = (o) => { const b = new B(); const w = o.arg || 1.6; b.box(w, 0.75, 0.6, o.color || C.white, 0, 0, 0, 0.02); b.box(w, 0.32, 0.6, mat(C.glass, { op: 0.35, r: 0.1 }), 0, 0.76, 0, 0.01).userData.noShadow = true; b.box(w, 0.03, 0.62, C.chrome, 0, 1.08, 0, 0.005);
  seed(w * 7); for (let x = -w / 2 + 0.15; x < w / 2 - 0.1; x += 0.24) { b.box(0.09, 0.015, 0.17, C.black, x, 0.77, 0, 0.005); b.plane(0.075, 0.15, mat('#fff', { map: T.screen(pick(['show', 'film', 'code'])), e: '#fff', ei: 0.4 }), x, 0.787, 0, -HP); }
  return b.done([w + 0.05, 0.65], [U.stand(0, 0.7)]); };
// --- seating
K.plastic_chair = (o) => { const b = new B(); chairMono(b, o.color || C.white); return b.done([0.5, 0.5], [U.sit(0, 0.03, 0.46)]); };
K.wooden_chair = (o) => { const b = new B(); chairWood(b, o.color || C.wood); return b.done([0.48, 0.48], [U.sit(0, 0.03, 0.47)]); };
K.office_chair = (o) => { const b = new B(); const c = o.color || C.black; b.cyl(0.25, 0.25, 0.04, C.dark, 0, 0.02, 0, 5); b.cyl(0.03, 0.03, 0.38, C.chrome, 0, 0.04, 0, 8); b.box(0.48, 0.08, 0.46, c, 0, 0.4, 0, 0.04); b.bc(0.44, 0.5, 0.07, c, 0, 0.78, -0.22, -0.1, 0, 0, 0.04); return b.done([0.5, 0.5], [U.sit(0, 0.03, 0.48)]); };
K.stool = (o) => { const b = new B(); const c = o.color || C.woodL; b.cyl(0.18, 0.17, 0.06, c, 0, 0.34, 0, 14); for (let i = 0; i < 3; i++) { const a = (i * PI * 2) / 3; b.add(CY(0.025, 0.03, 0.36, 6), mat(shade(c, -0.15)), Math.cos(a) * 0.11, 0.17, Math.sin(a) * 0.11, Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15); } return b.done([0.38, 0.38], [U.sit(0, 0.02, 0.4)]); };
K.bar_stool = (o) => { const b = new B(); const c = o.color || C.red; b.cyl(0.2, 0.2, 0.25, C.chrome, 0, 0, 0, 10); b.cyl(0.03, 0.03, 0.5, C.chrome, 0, 0.2, 0, 6); b.cyl(0.19, 0.19, 0.08, c, 0, 0.7, 0, 14); b.add(TO(0.15, 0.012, 12), C.chrome, 0, 0.32, 0, HP); return b.done([0.4, 0.4], [U.sit(0, 0.02, 0.78)]); };
K.wooden_bench = (o) => { const b = new B(); const c = o.color || '#3f7fbf'; const L = o.arg || 1.6; b.box(L, 0.06, 0.36, c, 0, 0.4, 0, 0.02); for (const sx of [-1, 1]) { b.box(0.06, 0.4, 0.3, shade(c, -0.15), sx * (L / 2 - 0.12), 0, 0, 0.01); } b.box(L - 0.3, 0.05, 0.05, shade(c, -0.2), 0, 0.15, 0);
  const n = Math.max(1, Math.round(L / 0.6)); const use = []; for (let i = 0; i < n; i++) use.push(U.sit(-L / 2 + (L / n) * (i + 0.5), 0.02, 0.46)); return b.done([L, 0.4], use); };
K.pew = (o) => { const b = new B(); const c = o.color || '#8a5a36'; const L = o.arg || 2.2; b.box(L, 0.07, 0.42, c, 0, 0.4, 0.02, 0.02); b.bc(L, 0.5, 0.06, c, 0, 0.78, -0.2, -0.12, 0, 0, 0.02); for (const sx of [-1, 1]) b.box(0.07, 0.95, 0.5, shade(c, -0.15), sx * L / 2, 0, 0, 0.02); b.box(L, 0.05, 0.12, shade(c, -0.1), 0, 0.85, -0.3, 0.01);
  const n = Math.round(L / 0.65); const use = []; for (let i = 0; i < n; i++) use.push(U.sit(-L / 2 + (L / n) * (i + 0.5), 0.05, 0.47)); return b.done([L + 0.1, 0.55], use); };
K.sofa = (o) => { const b = new B(); const c = o.color || '#b5543a'; const L = o.arg || 2.0; b.box(L, 0.24, 0.85, shade(c, -0.25), 0, 0.06, 0, 0.05); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.03, 0.03, 0.06, C.woodD, sx * (L / 2 - 0.08), 0, sz * 0.35, 6);
  const n = L > 1.5 ? (L > 2.4 ? 3 : 2) : 1; const cw = (L - 0.36) / n; for (let i = 0; i < n; i++) b.box(cw - 0.02, 0.16, 0.66, c, -L / 2 + 0.18 + cw * (i + 0.5), 0.29, 0.08, 0.06);
  b.bc(L - 0.1, 0.5, 0.22, c, 0, 0.66, -0.32, -0.12, 0, 0, 0.08); for (const sx of [-1, 1]) b.box(0.18, 0.62, 0.85, c, sx * (L / 2 - 0.09), 0.06, 0, 0.07);
  b.bc(0.38, 0.32, 0.1, mat('#fff', { map: T.kente(o.k || 0) }), -L / 2 + 0.42, 0.62, -0.14, -0.3, 0.2, 0, 0.04);
  const use = []; for (let i = 0; i < n; i++) use.push(U.sit(-L / 2 + 0.18 + cw * (i + 0.5), 0.06, 0.46)); return b.done([L, 0.9], use); };
K.armchair = (o) => K.sofa({ ...o, arg: 1.0 });
K.vip_sofa = (o) => { const r = K.sofa({ ...o, color: o.color || '#6b2fa0', arg: o.arg || 2.6, k: 2 }); return r; };
K.beach_chair = (o) => { const b = new B(); const wd = mat(C.woodL); const cl = mat('#fff', { map: T.stripes([o.color || '#e63946', '#fff4e0', '#1d3557'], 6, false), side: true });
  b.bar([-0.28, 0, 0.35], [-0.28, 0.85, -0.35], 0.022, wd); b.bar([0.28, 0, 0.35], [0.28, 0.85, -0.35], 0.022, wd); b.bar([-0.28, 0, -0.3], [-0.28, 0.4, 0.3], 0.022, wd); b.bar([0.28, 0, -0.3], [0.28, 0.4, 0.3], 0.022, wd);
  b.bc(0.54, 0.02, 0.5, cl, 0, 0.36, 0.1, 0.25, 0, 0, 0.005); b.bc(0.54, 0.02, 0.55, cl, 0, 0.62, -0.25, -0.95, 0, 0, 0.005); return b.done([0.65, 0.8], [U.sit(0, 0.12, 0.36)]); };
K.airport_seats = (o) => { const b = new B(); const n = o.arg || 4; const c = o.color || '#2f6fd1'; const L = n * 0.55; b.box(L + 0.1, 0.06, 0.08, C.chrome, 0, 0.3, -0.05, 0.01); for (const x of [-L / 2 + 0.1, L / 2 - 0.1]) b.box(0.06, 0.3, 0.45, C.chrome, x, 0, -0.05, 0.01);
  const use = []; for (let i = 0; i < n; i++) { const x = -L / 2 + 0.275 + i * 0.55; b.box(0.5, 0.07, 0.46, c, x, 0.38, 0.02, 0.03); b.bc(0.5, 0.48, 0.06, c, x, 0.7, -0.22, -0.12, 0, 0, 0.03); if (i) b.box(0.05, 0.22, 0.4, C.chrome, x - 0.275, 0.45, 0.0, 0.01); use.push(U.sit(x, 0.04, 0.46)); }
  return b.done([L + 0.1, 0.55], use); };
K.cinema_seats = (o) => K.airport_seats({ ...o, color: o.color || '#b3202a' });
K.stadium_seats = (o) => { const b = new B(); const rows = o.arg || 3, L = o.arg2 || 5; const cols = [o.color || '#d62828', '#f2c230', '#2f6fd1']; const use = [];
  for (let r = 0; r < rows; r++) { const y = r * 0.45, z = (rows / 2 - r - 0.5) * 0.85; b.box(L, y + 0.45, 0.85, '#a7a39b', 0, 0, z, 0.01); b.box(L, 0.04, 0.85, '#bdb8ae', 0, y + 0.45, z, 0.005);
    for (let i = 0; i < Math.floor(L / 0.55); i++) { const x = -L / 2 + 0.3 + i * 0.55; b.box(0.42, 0.06, 0.36, cols[(r + i) % 3 === 0 ? 0 : r % 3], x, y + 0.48, z + 0.05, 0.02); b.bc(0.42, 0.28, 0.05, cols[r % 3], x, y + 0.72, z - 0.15, -0.1); if (i % 2 === 0) use.push(U.sit(x, z + 0.08, y + 0.53)); } }
  return b.done([L, rows * 0.85], use); };
// --- tables
K.plastic_table = (o) => { const b = new B(); const c = o.color || C.white; tableTop(b, 0.8, 0.8, 0.72, mat(c, { r: 0.55 }), mat(c, { r: 0.55 })); return b.done([0.85, 0.85], [U.stand(0, 0.7)]); };
K.chop_table = (o) => { // plastic table with 4 monobloc chairs (front, right, left, back)
  const b = new B(); const c = o.color || C.white; tableTop(b, 0.8, 0.8, 0.72, mat(o.top || c, { r: 0.55 }), mat(c, { r: 0.55 }));
  if (o.cloth !== false) b.box(0.84, 0.02, 0.84, mat('#fff', { map: T.wax(o.cw || '#c8102e', '#f6d04d', '#1d6f42') }), 0, 0.72, 0, 0.005);
  plate(b, 0.12, 0.74, 0.18, '#c96b2c'); plate(b, -0.15, 0.74, -0.12, '#8c5a2b'); b.cyl(0.03, 0.03, 0.18, mat('#bfe6ff', { op: 0.6, r: 0.1 }), 0.25, 0.74, -0.2, 8);
  const cc = o.chair || c; chairMono(b, cc, 0, 0.62, PI); chairMono(b, cc, 0.62, 0, -HP); chairMono(b, cc, -0.62, 0, HP); chairMono(b, cc, 0, -0.62, 0);
  return b.done([1.7, 1.7], [U.sit(0, 0.65, 0.46, PI), U.sit(0.65, 0, 0.46, -HP), U.sit(-0.65, 0, 0.46, HP), U.sit(0, -0.65, 0.46, 0)]); };
K.coffee_table = (o) => { const b = new B(); const c = o.color || C.woodD; b.box(1.1, 0.06, 0.6, c, 0, 0.36, 0, 0.03); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.05, 0.36, 0.05, c, sx * 0.48, 0, sz * 0.24, 0.01); b.box(0.98, 0.03, 0.5, shade(c, 0.15), 0, 0.1, 0, 0.01); b.cyl(0.12, 0.08, 0.06, mat('#f0e6d2'), 0.25, 0.42, 0, 12); pile(b, 0.25, 0.44, 0, 0.04, C.orange, 4, 0.035); b.box(0.22, 0.02, 0.15, C.black, -0.25, 0.42, 0.05, 0.005);
  return b.done([1.15, 0.65], [U.stand(0, 0.6)]); };
K.dining_table = (o) => { const b = new B(); const c = o.color || C.wood; b.box(1.6, 0.06, 0.9, c, 0, 0.72, 0, 0.03); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.07, 0.72, 0.07, shade(c, -0.15), sx * 0.7, 0, sz * 0.36, 0.01);
  b.box(0.4, 0.01, 0.85, mat('#fff', { map: T.kente(0) }), 0, 0.78, 0, 0.004); plate(b, -0.4, 0.78, 0.25, '#d1495b'); plate(b, 0.4, 0.78, 0.25, '#e09f3e'); plate(b, -0.4, 0.78, -0.25, null); plate(b, 0.4, 0.78, -0.25, null); b.cyl(0.13, 0.1, 0.12, mat('#d7b56d'), 0, 0.78, 0, 12); pile(b, 0, 0.84, 0, 0.06, C.orange, 5, 0.045);
  const cc = o.chair || c; chairWood(b, cc, -0.4, 0.62, PI); chairWood(b, cc, 0.4, 0.62, PI); chairWood(b, cc, -0.4, -0.62, 0); chairWood(b, cc, 0.4, -0.62, 0);
  return b.done([1.7, 1.75], [U.sit(-0.4, 0.66, 0.47, PI), U.sit(0.4, 0.66, 0.47, PI), U.sit(-0.4, -0.66, 0.47, 0), U.sit(0.4, -0.66, 0.47, 0)]); };
K.desk = (o) => { const b = new B(); const c = o.color || C.woodL; b.box(1.2, 0.05, 0.6, c, 0, 0.72, 0, 0.02); b.box(0.04, 0.72, 0.56, shade(c, -0.15), -0.58, 0, 0, 0.01); b.box(0.4, 0.72, 0.56, shade(c, -0.08), 0.38, 0, 0, 0.01); for (let i = 0; i < 3; i++) b.box(0.36, 0.2, 0.02, shade(c, 0.1), 0.38, 0.06 + i * 0.22, 0.28, 0.01);
  return b.done([1.25, 0.65], [U.work(-0.15, 0.6)]); };
K.laptop_desk = (o) => { const b = new B(); const c = o.color || '#f2efe8'; b.box(1.2, 0.05, 0.62, c, 0, 0.72, 0, 0.02); for (const sx of [-1, 1]) b.box(0.05, 0.72, 0.56, shade(c, -0.12), sx * 0.57, 0, 0, 0.01);
  b.box(0.36, 0.018, 0.25, '#9aa1a8', -0.05, 0.77, 0.04, 0.008); b.bc(0.36, 0.24, 0.015, '#9aa1a8', -0.05, 0.89, -0.09, -0.25); b.plane(0.32, 0.2, mat('#000', { map: T.screen('code'), e: '#ffffff', ei: 0.8 }), -0.05, 0.89, -0.081, -0.25).userData.noShadow = true;
  b.cyl(0.04, 0.035, 0.1, mat('#e8e2d4'), 0.38, 0.77, -0.1, 10); b.box(0.15, 0.05, 0.2, C.black, 0.35, 0.77, 0.1, 0.01); b.cyl(0.02, 0.02, 0.3, C.dark, -0.45, 0.77, -0.15, 6); b.bc(0.18, 0.05, 0.1, C.yellow, -0.4, 1.08, -0.14, 0.4, 0, 0.3);
  const g = new B(); g.cyl(0.25, 0.25, 0.04, C.dark, 0, 0.02, 0, 5); g.cyl(0.03, 0.03, 0.38, C.chrome, 0, 0.04, 0, 8); g.box(0.48, 0.08, 0.46, o.chair || '#2a3b5c', 0, 0.4, 0, 0.04); g.bc(0.44, 0.5, 0.07, o.chair || '#2a3b5c', 0, 0.78, -0.22, -0.1, 0, 0, 0.04); attach(b, g, -0.05, 0.62, PI);
  return b.done([1.25, 1.35], [U.sit(-0.05, 0.64, 0.49, PI, 'type')]); };
K.classroom_desk = (o) => { const b = new B(); const c = o.color || C.woodL; const m = mat(C.dark, { r: 0.5, m: 0.3 }); b.box(1.1, 0.05, 0.42, c, 0, 0.72, -0.05, 0.015); b.box(1.1, 0.04, 0.3, c, 0, 0.42, 0.48, 0.015); b.bc(1.1, 0.25, 0.04, c, 0, 0.7, 0.66, 0.15);
  for (const sx of [-1, 1]) { b.box(0.04, 0.72, 0.04, m, sx * 0.5, 0, -0.2, 0.005); b.box(0.04, 0.42, 0.04, m, sx * 0.5, 0, 0.6, 0.005); b.box(0.04, 0.04, 0.85, m, sx * 0.5, 0.08, 0.2, 0.005); }
  b.box(0.2, 0.015, 0.28, '#f7f4ec', -0.25, 0.77, -0.05, 0.003); b.box(0.2, 0.015, 0.28, '#e7f0fb', 0.25, 0.77, -0.08, 0.003);
  return b.done([1.15, 1.05], [U.sit(-0.27, 0.5, 0.46, PI, 'type'), U.sit(0.27, 0.5, 0.46, PI, 'type')]); };
K.bench_table = (o) => { const b = new B(); const c = o.color || '#6c8f3f'; const L = 1.8; b.box(L, 0.06, 0.7, c, 0, 0.72, 0, 0.02); for (const sx of [-1, 1]) b.box(0.06, 0.72, 0.6, shade(c, -0.2), sx * (L / 2 - 0.12), 0, 0, 0.01); for (const sz of [-1, 1]) { b.box(L, 0.05, 0.3, shade(c, -0.08), 0, 0.42, sz * 0.62, 0.015); for (const sx of [-1, 1]) b.box(0.05, 0.42, 0.05, shade(c, -0.2), sx * (L / 2 - 0.15), 0, sz * 0.62); }
  plate(b, -0.4, 0.78, 0.18, '#d9822b'); plate(b, 0.4, 0.78, 0.18, '#c0392b'); plate(b, 0, 0.78, -0.18, '#e9c46a'); return b.done([L, 1.6], [U.sit(-0.4, 0.66, 0.46, PI), U.sit(0.4, 0.66, 0.46, PI), U.sit(-0.4, -0.66, 0.46, 0), U.sit(0.4, -0.66, 0.46, 0)]); };
K.banquet_table = (o) => { const b = new B(); const cl = o.color || '#f7f1e3'; b.cyl(0.75, 0.75, 0.68, cl, 0, 0.06, 0, 20); b.cyl(0.78, 0.78, 0.05, cl, 0, 0.72, 0, 20); b.cyl(0.79, 0.79, 0.06, mat('#fff', { map: T.kente(0) }), 0, 0.62, 0, 20); b.cyl(0.1, 0.12, 0.25, mat(C.glass, { op: 0.5 }), 0, 0.77, 0, 10); leafClump(b, 0, 1.08, 0, 0.6, '#e86a92');
  const use = []; for (let i = 0; i < 4; i++) { const a = HP + i * HP, x = Math.cos(a) * 1.0, z = Math.sin(a) * 1.0; const g = new B(); chairWood(g, '#e8dcc0'); g.box(0.46, 0.4, 0.05, mat('#f7f1e3'), 0, 0.5, -0.2, 0.02); attach(b, g, x, z, Math.atan2(-x, -z)); plate(b, x * 0.55, 0.77, z * 0.55, i % 2 ? '#e09f3e' : null); use.push(U.sit(x, z, 0.47, Math.atan2(-x, -z))); }
  return b.done([2.4, 2.4], use); };
K.buffet_table = (o) => { const b = new B(); b.box(2.2, 0.75, 0.7, mat(o.color || '#f7f1e3'), 0, 0, 0, 0.02); b.box(2.24, 0.12, 0.74, mat('#fff', { map: T.kente(2) }), 0, 0.55, 0, 0.01); for (let i = 0; i < 4; i++) { const x = -0.78 + i * 0.52; b.box(0.4, 0.08, 0.3, C.chrome, x, 0.75, 0, 0.02); b.cc(0.18, 0.18, 0.4, mat(C.chrome, { r: 0.3, m: 0.6 }), x, 0.85, 0, 0, 0, HP, 12); }
  b.add(IC(0.12, 0), mat('#e63946', { flat: true }), 0.95, 0.85, 0.18); return b.done([2.25, 0.75], [U.work(0, 0.7)]); };
// --- electronics
K.tv = (o) => { const b = new B(); b.box(1.4, 0.48, 0.45, o.color || C.woodD, 0, 0.04, 0, 0.03); for (const sx of [-1, 1]) b.box(0.05, 0.04, 0.4, C.dark, sx * 0.6, 0, 0, 0.01); b.box(0.6, 0.18, 0.02, shade(o.color || C.woodD, 0.2), -0.3, 0.12, 0.225, 0.01); b.box(0.3, 0.08, 0.2, C.black, 0.35, 0.52, 0.02, 0.01); b.box(0.22, 0.06, 0.15, '#5a5f66', 0.38, 0.06, 0.1, 0.01);
  b.box(0.3, 0.03, 0.18, C.black, 0, 0.52, -0.05, 0.01); b.box(0.05, 0.12, 0.04, C.black, 0, 0.55, -0.05); b.box(1.15, 0.68, 0.05, C.black, 0, 0.64, -0.05, 0.02); b.plane(1.08, 0.61, mat('#000', { map: T.screen(o.screen || 'match'), e: '#ffffff', ei: 0.85 }), 0, 0.98, -0.022).userData.liveScreen = o.screen || 'match';
  return b.done([1.45, 0.5], [U.stand(0, 1.6)]); };
K.big_screen = (o) => { const b = new B(); const W = o.arg || 2.6; b.box(W + 0.15, W * 0.6, 0.12, C.black, 0, 0.9, 0, 0.03); b.plane(W, W * 0.56, mat('#000', { map: T.screen(o.screen || 'match'), e: '#ffffff', ei: 0.95 }), 0, 0.9 + W * 0.3, 0.065).userData.liveScreen = o.screen || 'match'; for (const sx of [-1, 1]) b.box(0.1, 0.9, 0.3, C.dark, sx * W * 0.35, 0, 0, 0.02); b.box(W * 0.75, 0.08, 0.35, C.dark, 0, 0.0, 0, 0.02);
  b.box(0.5, 0.4, 0.4, C.black, -W / 2 - 0.25, 0, 0.05, 0.03); b.plane(0.3, 0.3, mat('#fff', { map: T.speaker() }), -W / 2 - 0.25, 0.2, 0.26); return b.done([W + 0.8, 0.45], [U.stand(0, 2.5)]); };
K.standing_fan = (o) => { const b = new B(); const c = o.color || C.white; b.cyl(0.18, 0.2, 0.05, c, 0, 0, 0, 16); b.cyl(0.02, 0.025, 1.05, C.chrome, 0, 0.05, 0, 8); b.box(0.12, 0.14, 0.18, c, 0, 1.06, -0.05, 0.04);
  b.add(TO(0.22, 0.012, 20), mat(C.chrome, { r: 0.4, m: 0.4 }), 0, 1.13, 0.1); for (let i = 0; i < 6; i++) b.bar([0, 1.13, 0.1], [Math.cos(i) * 0.22, 1.13 + Math.sin(i) * 0.22, 0.1], 0.004, C.chrome, 4);
  const bl = new B(); for (let i = 0; i < 3; i++) bl.bc(0.07, 0.17, 0.01, mat(o.blade || '#7cc6e8', { op: 0.85 }), Math.sin((i * PI * 2) / 3) * 0.1, Math.cos((i * PI * 2) / 3) * 0.1, 0, 0, 0, -(i * PI * 2) / 3); bl.sph(0.04, c, 0, 0, 0.01);
  const blades = finalize(bl.g); blades.position.set(0, 1.13, 0.09); b.keep(blades); b.g.add(blades); b.spin.push({ obj: blades, axis: 'z', speed: 14 });
  return b.done([0.45, 0.45], [U.stand(0, 0.6)]); };
K.ceiling_fan = (o) => { const b = new B(); b.cyl(0.015, 0.015, 0.35, C.chrome, 0, 2.3, 0, 6); b.cyl(0.11, 0.12, 0.1, o.color || '#f0ebe0', 0, 2.22, 0, 14); const bl = new B(); for (let i = 0; i < 3; i++) { const a = (i * PI * 2) / 3; bl.bc(0.55, 0.012, 0.11, mat(o.color || '#e9e2d1'), Math.cos(a) * 0.33, 0, Math.sin(a) * 0.33, 0, -a, 0); }
  const blades = finalize(bl.g); blades.position.set(0, 2.22, 0); b.keep(blades); b.g.add(blades); b.spin.push({ obj: blades, axis: 'y', speed: 9 }); return b.done([0.1, 0.1], [U.stand(0, 0.5)], { walkable: true }); };
K.ac = (o) => { const b = new B(); b.box(0.92, 0.3, 0.22, C.white, 0, 2.0, 0.12, 0.06); b.box(0.8, 0.03, 0.02, '#c9ced3', 0, 2.06, 0.235, 0.01); b.box(0.06, 0.02, 0.01, '#5be37b', 0.36, 2.2, 0.232).material = mat('#5be37b', { e: '#5be37b', ei: 1 }); return b.done([0.95, 0.25], [U.stand(0, 0.8)], { walkable: true }); };
K.fridge = (o) => { const b = new B(); const c = o.color || '#e9ecef'; b.box(0.66, 1.62, 0.66, mat(c, { r: 0.4 }), 0, 0.02, 0, 0.05); b.box(0.64, 0.02, 0.02, '#b7bec5', 0, 1.1, 0.33, 0.005); b.box(0.035, 0.32, 0.04, C.chrome, -0.26, 1.2, 0.35, 0.01); b.box(0.035, 0.45, 0.04, C.chrome, -0.26, 0.55, 0.35, 0.01); b.box(0.16, 0.2, 0.01, mat('#fff', { map: T.wax() }), 0.1, 1.3, 0.335);
  b.box(0.2, 0.06, 0.12, C.black, 0, 1.64, 0, 0.02); return b.done([0.7, 0.7], [U.work(0, 0.75)]); };
K.chest_freezer = (o) => { const b = new B(); const c = o.color || C.white; b.box(1.1, 0.82, 0.65, mat(c, { r: 0.4 }), 0, 0.03, 0, 0.05); b.box(1.12, 0.08, 0.67, mat(c, { r: 0.4 }), 0, 0.82, 0, 0.04); b.box(0.25, 0.04, 0.04, '#9aa1a8', 0, 0.75, 0.34, 0.01); b.box(0.12, 0.05, 0.01, '#d62828', 0.4, 0.6, 0.33, 0.005); return b.done([1.15, 0.7], [U.work(0, 0.7)]); };
K.cooler = (o) => { const b = new B(); const c = o.color || '#1f6fd1'; b.box(0.62, 0.38, 0.4, c, 0, 0, 0, 0.06); b.box(0.64, 0.09, 0.42, C.white, 0, 0.38, 0, 0.04); b.box(0.3, 0.03, 0.06, C.white, 0, 0.47, 0, 0.015); for (const s of [-1, 1]) b.box(0.03, 0.06, 0.12, C.white, s * 0.32, 0.3, 0, 0.01); return b.done([0.65, 0.45], [U.work(0, 0.6)]); };
K.speaker = (o) => { const b = new B(); const c = o.color || '#1b1c1f'; b.box(0.58, 1.15, 0.52, c, 0, 0, 0, 0.04); const gr = mat('#2b2d31', { r: 0.95 }); for (const [y, r] of [[0.32, 0.2], [0.78, 0.15]]) { b.cc(r + 0.025, r + 0.025, 0.03, mat(C.chrome, { r: 0.4, m: 0.5 }), 0, y, 0.26, HP, 0, 0, 20); b.cc(r, r, 0.03, gr, 0, y, 0.27, HP, 0, 0, 20); b.cc(r * 0.3, r * 0.3, 0.04, C.dark, 0, y, 0.28, HP, 0, 0, 10); }
  b.cc(0.04, 0.05, 0.04, mat('#f5b700', { e: '#f5b700', ei: 0.5 }), 0, 1.0, 0.27, HP); b.box(0.5, 0.05, 0.02, mat('#2ec4f1', { e: '#2ec4f1', ei: 1 }), 0, 1.07, 0.262, 0.01); b.box(0.22, 0.04, 0.08, C.dark, 0, 1.15, 0, 0.01); for (const sx of [-1, 1]) b.sph(0.03, C.dark, sx * 0.22, 0.03, 0.2);
  return b.done([0.6, 0.55], [U.work(0, 0.6)]); };
K.generator = (o) => { const b = new B(); const c = o.color || '#d62828'; const fr = mat(C.dark, { r: 0.5, m: 0.4 }); for (const sx of [-1, 1]) { b.bar([sx * 0.33, 0.04, -0.25], [sx * 0.33, 0.04, 0.25], 0.02, fr); b.bar([sx * 0.33, 0.04, 0.25], [sx * 0.33, 0.56, 0.25], 0.02, fr); b.bar([sx * 0.33, 0.04, -0.25], [sx * 0.33, 0.56, -0.25], 0.02, fr); b.bar([sx * 0.33, 0.56, -0.25], [sx * 0.33, 0.56, 0.25], 0.02, fr); }
  b.box(0.6, 0.28, 0.42, mat('#4a4f55', { r: 0.6, m: 0.3 }), 0, 0.05, 0, 0.03); b.box(0.5, 0.2, 0.42, mat(c, { r: 0.45 }), -0.03, 0.38, 0, 0.06); b.cyl(0.05, 0.05, 0.05, C.black, 0.12, 0.58, 0, 10); b.box(0.16, 0.16, 0.02, mat(C.yellow), -0.05, 0.13, 0.215, 0.01); b.cc(0.07, 0.07, 0.2, mat('#6d7278', { m: 0.5, r: 0.4 }), 0.24, 0.2, 0.05, HP, 0, 0);
  return b.done([0.72, 0.55], [U.work(0, 0.6)]); };
// --- kitchen & bath
K.gas_cooker = (o) => { const b = new B(); const tb = mat(o.color || C.woodL); tableTop(b, 0.95, 0.5, 0.72, tb, tb); b.box(0.85, 0.02, 0.45, mat('#fff', { map: T.wax('#d1495b', '#f4e9cd', '#2a9d8f') }), 0, 0.72, 0, 0.005);
  b.box(0.62, 0.09, 0.36, mat(C.chrome, { r: 0.3, m: 0.6 }), -0.1, 0.74, 0, 0.02); for (const x of [-0.25, 0.05]) b.add(TO(0.07, 0.012, 14), C.black, x, 0.84, 0, HP); pot(b, 0.13, 0.15, mat('#c9ccd0', { r: 0.35, m: 0.6 }), -0.25, 0.85, 0); b.cyl(0.11, 0.09, 0.06, mat('#c9ccd0', { m: 0.6, r: 0.4 }), 0.05, 0.85, 0, 14); b.box(0.3, 0.03, 0.04, C.black, 0.25, 0.86, 0, 0.01);
  b.cyl(0.13, 0.13, 0.42, mat(o.cyl || '#2e7bd1', { r: 0.4 }), 0.3, 0, 0.0, 14); b.sph(0.13, mat(o.cyl || '#2e7bd1', { r: 0.4 }), 0.3, 0.42, 0, 1, 0.5, 1); b.cyl(0.03, 0.03, 0.08, C.chrome, 0.3, 0.46, 0, 8); b.bar([0.3, 0.52, 0], [0.1, 0.8, 0], 0.01, C.black, 4);
  return b.done([1.0, 0.55], [U.work(-0.1, 0.62)]); };
K.coal_pot = (o) => { const b = new B(); const mt = mat('#4d5258', { r: 0.6, m: 0.4 }); b.cyl(0.2, 0.14, 0.18, mt, 0, 0, 0, 10); b.cyl(0.13, 0.19, 0.12, mt, 0, 0.18, 0, 10); b.cyl(0.18, 0.18, 0.02, mat('#ff7a1a', { e: '#ff5a00', ei: 1.4 }), 0, 0.3, 0, 12).userData.noShadow = true;
  pot(b, 0.17, 0.16, mat('#8b8f94', { r: 0.4, m: 0.6 }), 0, 0.32, 0); const st = new B(); st.cyl(0.15, 0.14, 0.05, C.woodL, 0, 0.2, 0, 10); for (let i = 0; i < 3; i++) st.cyl(0.02, 0.02, 0.2, C.woodD, Math.cos(i * 2.1) * 0.1, 0, Math.sin(i * 2.1) * 0.1, 5); attach(b, st, 0, 0.5, 0);
  return b.done([0.45, 0.45], [U.sit(0, 0.5, 0.25, PI, 'sit')]); };
K.sink_counter = (o) => { const b = new B(); const c = o.color || C.white; b.box(1.2, 0.86, 0.6, c, 0, 0, 0, 0.02); b.box(1.24, 0.05, 0.64, mat('#fff', { map: T.tilesWall('#cfe8ef') }), 0, 0.86, 0, 0.01); b.box(0.5, 0.04, 0.38, mat(C.chrome, { r: 0.3, m: 0.6 }), -0.2, 0.89, 0.03, 0.03); b.box(0.44, 0.02, 0.32, '#8aa4b0', -0.2, 0.915, 0.03, 0.01);
  b.cyl(0.015, 0.015, 0.22, C.chrome, -0.2, 0.91, -0.22, 6); b.bar([-0.2, 1.12, -0.22], [-0.2, 1.1, -0.1], 0.013, C.chrome, 6); for (const sx of [-1, 1]) b.box(0.56, 0.7, 0.02, shade(c, -0.06), sx * 0.29, 0.08, 0.3, 0.01); for (let i = 0; i < 3; i++) b.cyl(0.1, 0.1, 0.02, C.white, 0.3, 0.91 + i * 0.022, 0, 14);
  return b.done([1.25, 0.65], [U.work(-0.2, 0.62)]); };
K.kitchen_counter = (o) => { const b = new B(); const c = o.color || '#8fbfa6'; const L = o.arg || 1.8; b.box(L, 0.86, 0.6, c, 0, 0, 0, 0.02); b.box(L + 0.04, 0.05, 0.64, mat('#fff', { map: T.tilesWall('#f1ece0') }), 0, 0.86, 0, 0.01); const n = Math.round(L / 0.6); for (let i = 0; i < n; i++) { b.box(L / n - 0.04, 0.68, 0.02, shade(c, 0.1), -L / 2 + (L / n) * (i + 0.5), 0.1, 0.3, 0.01); b.box(0.12, 0.025, 0.03, C.chrome, -L / 2 + (L / n) * (i + 0.5), 0.68, 0.32, 0.005); }
  pot(b, 0.15, 0.2, mat('#b33a2c', { r: 0.5 }), -L / 2 + 0.3, 0.91, 0); b.box(0.35, 0.03, 0.25, C.woodL, 0.1, 0.91, 0.05, 0.01); pile(b, 0.1, 0.92, 0.05, 0.05, '#e63946', 4, 0.035); b.cyl(0.05, 0.05, 0.2, mat('#d4a017'), L / 2 - 0.2, 0.91, -0.15, 8); b.cyl(0.06, 0.05, 0.12, '#2a9d8f', L / 2 - 0.35, 0.91, -0.1, 10);
  return b.done([L + 0.05, 0.65], [U.work(0, 0.62)]); };
K.bucket_shower = (o) => { const b = new B(); const tw = mat('#fff', { map: T.tilesWall(o.color || '#9fd3e6') }); b.box(1.1, 0.06, 1.1, tw, 0, 0, 0, 0.01); b.box(1.1, 1.5, 0.08, tw, 0, 0, -0.51, 0.01); b.box(0.08, 1.5, 1.1, tw, -0.51, 0, 0, 0.01); b.cyl(0.04, 0.04, 0.01, C.chrome, 0.1, 0.06, 0.1, 10);
  b.cyl(0.19, 0.16, 0.36, mat('#2f7fd8', { r: 0.4 }), -0.25, 0.06, -0.25, 16); b.cyl(0.17, 0.17, 0.01, mat('#7cc9ec', { r: 0.1 }), -0.25, 0.38, -0.25, 16); b.add(TO(0.19, 0.012, 16, PI), '#1f5fa8', -0.25, 0.42, -0.25, 0, 0, 0); b.cyl(0.1, 0.07, 0.07, mat('#e63946', { r: 0.4 }), 0.25, 0.06, -0.3, 12); b.box(0.12, 0.05, 0.07, '#f4d35e', 0.3, 0.06, -0.12, 0.02); b.box(0.1, 0.04, 0.06, '#f4a6c0', -0.3, 0.75, -0.44, 0.015);
  return b.done([1.15, 1.15], [U.stand(0.15, 0.15, 0.4)]); };
K.shower = (o) => { const b = new B(); const tw = mat('#fff', { map: T.tilesWall(o.color || '#dfeff5') }); b.box(1.0, 0.08, 1.0, C.white, 0, 0, 0, 0.02); b.box(1.0, 2.1, 0.08, tw, 0, 0, -0.46, 0.01); b.box(0.08, 2.1, 1.0, tw, -0.46, 0, 0, 0.01);
  b.cyl(0.015, 0.015, 1.2, C.chrome, -0.3, 0.8, -0.4, 6); b.cc(0.08, 0.06, 0.03, C.chrome, -0.3, 2.0, -0.32, 0.4); b.bar([-0.3, 2.0, -0.4], [-0.3, 2.02, -0.33], 0.012, C.chrome); b.box(0.04, 1.9, 0.9, mat(C.glass, { op: 0.3, r: 0.1 }), 0.48, 0.08, -0.03, 0.01).userData.noShadow = true; b.box(0.12, 0.05, 0.08, '#f4a6c0', -0.38, 1.0, -0.38, 0.02);
  return b.done([1.05, 1.05], [U.stand(0.0, 0.05, 0.4)]); };
K.toilet = (o) => { const b = new B(); const w = mat(C.white, { r: 0.3 }); b.cyl(0.13, 0.16, 0.36, w, 0, 0, 0.02, 14); b.add(CY(0.19, 0.17, 0.08, 16), w, 0, 0.38, 0.05, 0, 0, 0, 1, 1, 1.2); b.add(CY(0.19, 0.19, 0.025, 16), mat('#f0f0f0'), 0, 0.43, 0.05, 0, 0, 0, 1, 1, 1.2); b.box(0.4, 0.38, 0.18, w, 0, 0.36, -0.24, 0.04); b.box(0.42, 0.04, 0.2, w, 0, 0.74, -0.24, 0.02); b.box(0.06, 0.02, 0.03, C.chrome, 0.12, 0.78, -0.2);
  b.cyl(0.06, 0.06, 0.1, C.white, 0.35, 0, -0.2, 10); return b.done([0.5, 0.7], [U.sit(0, 0.03, 0.43)]); };
K.wash_basin = (o) => { const b = new B(); const al = mat('#bfc5ca', { r: 0.35, m: 0.6 }); b.cyl(0.36, 0.26, 0.2, al, -0.2, 0, 0, 18); b.cyl(0.33, 0.33, 0.01, mat('#a6d3e3', { r: 0.1 }), -0.2, 0.17, 0, 18); b.cyl(0.3, 0.22, 0.18, al, 0.45, 0, 0.1, 18); for (let i = 0; i < 5; i++) b.cyl(0.11, 0.09, 0.02, C.white, 0.45, 0.18 + i * 0.02, 0.1, 12); pile(b, -0.25, 0.15, 0.05, 0.1, '#ffffff', 5, 0.04);
  const st = new B(); st.cyl(0.15, 0.14, 0.05, C.woodL, 0, 0.2, 0, 10); for (let i = 0; i < 3; i++) st.cyl(0.02, 0.02, 0.2, C.woodD, Math.cos(i * 2.1) * 0.1, 0, Math.sin(i * 2.1) * 0.1, 5); attach(b, st, 0.1, 0.55, 0);
  return b.done([1.2, 0.8], [U.sit(0.1, 0.55, 0.25, PI)]); };
K.water_dispenser = (o) => { const b = new B(); b.box(0.32, 0.95, 0.32, C.white, 0, 0, 0, 0.03); b.cyl(0.14, 0.14, 0.42, mat('#8fd3f4', { op: 0.65, r: 0.1 }), 0, 0.95, 0, 14); b.box(0.04, 0.05, 0.04, '#2f6fd1', -0.06, 0.7, 0.17); b.box(0.04, 0.05, 0.04, '#d62828', 0.06, 0.7, 0.17); return b.done([0.36, 0.36], [U.work(0, 0.5)]); };
K.barrel = (o) => { const b = new B(); const c = o.color || '#2f6fd1'; b.cyl(0.3, 0.3, 0.9, mat(c, { r: 0.5 }), 0, 0, 0, 16); for (const y of [0.25, 0.65]) b.add(TO(0.3, 0.02, 16), mat(shade(c, -0.15)), 0, y, 0, HP); b.cyl(0.08, 0.08, 0.03, mat(shade(c, -0.2)), 0.12, 0.9, 0, 8); return b.done([0.62, 0.62], [U.work(0, 0.55)]); };
K.bucket = (o) => { const b = new B(); const c = o.color || '#e63946'; b.cyl(0.16, 0.13, 0.3, mat(c, { r: 0.4 }), 0, 0, 0, 14); b.add(TO(0.16, 0.008, 14, PI), C.dark, 0, 0.3, 0); return b.done([0.34, 0.34], [U.work(0, 0.45)], { walkable: false }); };
K.jerrycans = (o) => { const b = new B(); const cs = ['#f2c230', '#2f6fd1', '#f2c230']; for (let i = 0; i < 3; i++) { b.box(0.3, 0.42, 0.18, mat(cs[i], { r: 0.5 }), -0.34 + i * 0.34, 0, (i % 2) * 0.06, 0.03); b.cyl(0.035, 0.035, 0.06, mat(shade(cs[i], -0.3)), -0.42 + i * 0.34, 0.42, (i % 2) * 0.06, 8); } return b.done([1.0, 0.3], [U.work(0, 0.45)]); };
K.crate_stack = (o) => { const b = new B(); const cs = [o.color || '#d62828', '#f2c230', '#1d6f42']; for (let k = 0; k < (o.arg || 3); k++) { const y = k * 0.3; const c = cs[k % 3]; b.box(0.48, 0.28, 0.34, mat(c, { r: 0.5 }), 0, y, 0, 0.02); b.box(0.42, 0.03, 0.28, mat(shade(c, -0.35)), 0, y + 0.27, 0, 0.005); if (k === (o.arg || 3) - 1) for (let i = 0; i < 6; i++) bottle(b, -0.15 + (i % 3) * 0.15, y + 0.28, -0.07 + Math.floor(i / 3) * 0.14, i % 2 ? '#6b3e1e' : '#2a7d2e', 0.2); } return b.done([0.5, 0.36], [U.work(0, 0.5)]); };
// --- study / work
K.whiteboard = (o) => { const b = new B(); const W = o.arg || 2.0; b.box(W + 0.08, 1.08, 0.04, C.chrome, 0, 0.9, 0.04, 0.01); b.plane(W, 1.0, mat('#fff', { map: T.scribble(), r: 0.35 }), 0, 1.44, 0.065); b.box(W * 0.6, 0.03, 0.08, C.chrome, 0, 0.9, 0.08, 0.005); return b.done([W, 0.1], [U.work(0, 0.6)], { walkable: true }); };
K.lectern = (o) => { const b = new B(); const c = o.color || C.woodD; b.box(0.5, 0.06, 0.4, c, 0, 0, 0, 0.02); b.box(0.12, 0.95, 0.12, c, 0, 0.05, 0, 0.02); b.bc(0.55, 0.06, 0.4, c, 0, 1.08, 0, 0.3); b.cyl(0.008, 0.008, 0.3, C.dark, 0.15, 1.1, -0.1, 4); b.sph(0.025, C.dark, 0.15, 1.42, -0.1); return b.done([0.55, 0.45], [{ x: 0, z: -0.45, face: 0, pose: 'work' }]); };
K.pulpit = (o) => { const b = new B(); const c = o.color || '#7a4a2a'; b.box(1.0, 1.05, 0.6, c, 0, 0, 0, 0.04); b.box(1.1, 0.06, 0.7, shade(c, -0.15), 0, 1.05, 0, 0.02); b.box(0.5, 0.8, 0.02, mat(o.cloth || '#6a1b9a'), 0, 0.2, 0.31, 0.005); b.box(0.5, 0.1, 0.025, mat(C.gold), 0, 0.2, 0.315, 0.005); b.bc(0.06, 0.4, 0.06, mat(C.gold, { m: 0.5, r: 0.4 }), 0, 0.68, 0.32); b.bc(0.25, 0.06, 0.06, mat(C.gold, { m: 0.5, r: 0.4 }), 0, 0.75, 0.32);
  b.cyl(0.008, 0.008, 0.25, C.dark, 0.3, 1.1, -0.1, 4); b.sph(0.025, C.dark, 0.3, 1.37, -0.05); b.box(0.3, 0.04, 0.22, '#3a2a1a', -0.1, 1.11, 0, 0.01); return b.done([1.1, 0.7], [{ x: 0, z: -0.65, face: 0, pose: 'work' }]); };
K.keyboard_instrument = (o) => { const b = new B(); const fr = mat(C.dark, { m: 0.4, r: 0.5 }); b.bar([-0.4, 0, -0.15], [0.4, 0.75, 0.15], 0.02, fr); b.bar([-0.4, 0, 0.15], [0.4, 0.75, -0.15], 0.02, fr); b.bar([0.4, 0, -0.15], [-0.4, 0.75, 0.15], 0.02, fr); b.bar([0.4, 0, 0.15], [-0.4, 0.75, -0.15], 0.02, fr);
  b.box(1.1, 0.1, 0.32, C.black, 0, 0.76, 0, 0.02); b.plane(1.0, 0.16, mat('#fff', { map: T.keys() }), 0, 0.862, 0.05, -HP); b.box(0.3, 0.02, 0.06, mat('#e63946', { e: '#e63946', ei: 0.6 }), -0.3, 0.86, -0.1, 0.005); return b.done([1.15, 0.4], [{ x: 0, z: -0.45, face: 0, pose: 'work' }]); };
K.drum = (o) => { const b = new B(); const c = o.color || '#8b4a24'; for (const [x, z, s] of [[-0.16, 0, 1], [0.2, 0.08, 0.8]]) { b.cyl(0.18 * s, 0.11 * s, 0.4 * s, c, x, 0, z, 12); b.cyl(0.24 * s, 0.18 * s, 0.35 * s, c, x, 0.4 * s, z, 12); b.cyl(0.24 * s, 0.24 * s, 0.03, '#efe1c2', x, 0.75 * s, z, 14); b.add(TO(0.24 * s, 0.012, 14), C.gGold, x, 0.6 * s, z, HP); }
  return b.done([0.7, 0.5], [{ x: 0, z: -0.5, face: 0, pose: 'work' }]); };
K.guitar_stand = (o) => { const b = new B(); const fr = mat(C.dark, { m: 0.4, r: 0.5 }); b.bar([-0.12, 0, 0.1], [0, 0.6, -0.05], 0.012, fr); b.bar([0.12, 0, 0.1], [0, 0.6, -0.05], 0.012, fr); b.bar([0, 0, -0.18], [0, 0.6, -0.05], 0.012, fr);
  const g = new B(); const gc = o.color || '#c0702b'; g.add(CY(0.18, 0.18, 0.08, 18), gc, 0, 0.25, 0, HP, 0, 0, 1, 1, 1); g.add(CY(0.14, 0.14, 0.08, 18), gc, 0, 0.5, 0, HP); g.cc(0.06, 0.06, 0.085, C.black, 0, 0.33, 0.0, HP); g.box(0.05, 0.55, 0.03, C.woodD, 0, 0.58, 0.02, 0.005); g.box(0.07, 0.14, 0.03, C.black, 0, 1.12, 0.02, 0.01); attach(b, g, 0, 0.0, 0, 0.05);
  const st = new B(); st.cyl(0.17, 0.16, 0.05, C.woodL, 0, 0.42, 0, 12); for (let i = 0; i < 3; i++) st.cyl(0.02, 0.025, 0.42, C.woodD, Math.cos(i * 2.1) * 0.11, 0, Math.sin(i * 2.1) * 0.11, 5); attach(b, st, 0.55, 0.15, 0);
  return b.done([1.0, 0.5], [U.sit(0.55, 0.17, 0.47, 0)]); };
K.dumbbells = (o) => { const b = new B(); const mt = mat('#2a2d32', { r: 0.4, m: 0.5 });
  if (o.arg === 1) { // compact: small rack + one pair on the floor (small rooms)
    b.box(0.7, 0.32, 0.3, C.dark, 0, 0, 0, 0.02); for (let i = 0; i < 3; i++) { b.cc(0.015, 0.015, 0.22, C.chrome, -0.22 + i * 0.22, 0.38, 0, 0, 0, HP); for (const s of [-1, 1]) b.cc(0.05 + i * 0.01, 0.05 + i * 0.01, 0.05, mt, -0.22 + i * 0.22 + s * 0.09, 0.38, 0, 0, 0, HP, 10); }
    return b.done([0.75, 0.35], [{ x: 0, z: 0.6, face: PI, pose: 'squat' }]); }
  b.box(0.7, 0.32, 0.3, C.dark, -0.5, 0, -0.3, 0.02); for (let i = 0; i < 3; i++) { b.cc(0.015, 0.015, 0.22, C.chrome, -0.72 + i * 0.22, 0.38, -0.3, 0, 0, HP); for (const s of [-1, 1]) b.cc(0.05 + i * 0.01, 0.05 + i * 0.01, 0.05, mt, -0.72 + i * 0.22 + s * 0.09, 0.38, -0.3, 0, 0, HP, 10); }
  b.box(0.7, 0.012, 1.6, mat(o.color || '#7b2cbf', { r: 0.9 }), 0.2, 0, 0.1, 0.005); for (const s of [-1, 1]) { b.cc(0.015, 0.015, 0.24, C.chrome, 0.2 + s * 0.22, 0.06, 0.65, 0, 0, HP); for (const t of [-1, 1]) b.cc(0.055, 0.055, 0.05, mt, 0.2 + s * 0.22 + t * 0.09, 0.06, 0.65, 0, 0, HP, 10); }
  return b.done([1.3, 1.6], [{ x: 0.2, z: 0.1, face: 0, pose: 'squat' }], { walkable: false }); };
K.punching_bag = (o) => { const b = new B(); const fr = mat(C.dark, { m: 0.4, r: 0.5 }); b.box(0.5, 0.06, 0.5, fr, 0, 0, -0.35, 0.01); b.cyl(0.04, 0.04, 2.2, fr, 0, 0.06, -0.35, 8); b.bar([0, 2.2, -0.35], [0, 2.2, 0.15], 0.03, fr); b.cyl(0.006, 0.006, 0.4, C.chrome, 0, 1.8, 0.15, 4); b.cyl(0.18, 0.18, 0.95, mat(o.color || '#c1121f', { r: 0.6 }), 0, 0.85, 0.15, 14); b.cyl(0.185, 0.185, 0.1, C.black, 0, 1.4, 0.15, 14);
  return b.done([0.55, 0.85], [{ x: 0, z: 0.65, face: PI, pose: 'guard' }]); };
K.boxing_ring = (o) => { const b = new B(); const S = o.arg || 3.6; b.box(S, 0.4, S, '#2b2f36', 0, 0, 0, 0.02); b.box(S - 0.1, 0.04, S - 0.1, mat(o.color || '#1d4e89', { r: 0.9 }), 0, 0.4, 0, 0.01); b.box(S + 0.04, 0.15, S + 0.04, mat('#fff', { map: T.stripes(['#c8102e', '#f6f6f6'], 12, true) }), 0, 0.25, 0, 0.01);
  const posts = [[-1, -1, '#d62828'], [1, 1, '#1d4ed8'], [1, -1, '#f6f6f6'], [-1, 1, '#f6f6f6']]; for (const [sx, sz, pc] of posts) { b.cyl(0.05, 0.05, 1.2, C.chrome, sx * (S / 2 - 0.1), 0.4, sz * (S / 2 - 0.1), 8); b.box(0.12, 0.6, 0.12, pc, sx * (S / 2 - 0.1), 0.82, sz * (S / 2 - 0.1), 0.03); }
  const rope = ['#c8102e', '#f6f6f6', '#1d4ed8']; const e = S / 2 - 0.1; for (let i = 0; i < 3; i++) { const y = 0.7 + i * 0.28; const m = mat(rope[i]); b.bar([-e, y, -e], [e, y, -e], 0.018, m, 6); b.bar([-e, y, -e], [-e, y, e], 0.018, m, 6); b.bar([e, y, -e], [e, y, e], 0.018, m, 6); b.bar([-e, y, e], [e, y, e], 0.018, m, 6); }
  for (let i = 0; i < 3; i++) b.box(0.6, 0.12, 0.3, '#3a3f47', S / 2 + 0.3, i * 0.13, S / 2 - 0.6 - i * 0.0, 0.01);
  return b.done([S + 0.2, S + 0.2], [{ x: -0.55, z: 0.1, y: 0.42, face: HP, pose: 'guard' }, { x: 0.55, z: -0.1, y: 0.42, face: -HP, pose: 'guard' }]); };
// --- shop / market / food
K.counter = (o) => { const b = new B(); const c = o.color || '#2f6fd1'; const L = o.arg || 2.0; b.box(L, 1.0, 0.6, c, 0, 0, 0, 0.03); b.box(L + 0.08, 0.06, 0.68, o.top || C.woodL, 0, 1.0, 0, 0.02); b.box(L - 0.1, 0.1, 0.02, shade(c, -0.25), 0, 0.05, 0.3, 0.005); b.box(L, 0.05, 0.03, mat(C.gGold), 0, 0.82, 0.305, 0.005);
  if (o.label) signPanel(b, o.label, o.signBg || '#ffffff', o.signFg || c, Math.min(L * 0.7, 1.4), 0.32, 0, 0.5, 0.32);
  return b.done([L + 0.08, 0.7], [U.stand(0, 0.72)]); };
K.bar_counter = (o) => { const b = new B(); const c = o.color || '#3a2a4f'; const L = o.arg || 2.6; b.box(L, 1.05, 0.6, c, 0, 0, 0, 0.03); b.box(L + 0.1, 0.06, 0.7, '#1c1c22', 0, 1.05, 0, 0.02); b.box(L, 0.04, 0.03, mat('#ff4fa3', { e: '#ff4fa3', ei: 1.2 }), 0, 0.9, 0.31, 0.01).userData.noShadow = true;
  seed(L * 9); for (let i = 0; i < 6; i++) bottle(b, -L / 2 + 0.3 + rnd() * (L - 0.6), 1.11, -0.15 + rnd() * 0.1, pick(['#2a7d2e', '#6b3e1e', '#c49a2c', '#1d4ed8', '#9b2226']), 0.3); b.cyl(0.1, 0.08, 0.16, C.chrome, L / 2 - 0.3, 1.11, 0.05, 12);
  const use = []; const n = Math.round(L / 0.85); for (let i = 0; i < n; i++) { const x = -L / 2 + (L / n) * (i + 0.5); const g = new B(); g.cyl(0.2, 0.2, 0.03, C.chrome, 0, 0, 0, 10); g.cyl(0.03, 0.03, 0.72, C.chrome, 0, 0.03, 0, 6); g.cyl(0.19, 0.19, 0.08, o.stool || C.red, 0, 0.72, 0, 14); g.add(TO(0.15, 0.012, 12), C.chrome, 0, 0.3, 0, HP); attach(b, g, x, 0.62, 0); use.push(U.sit(x, 0.62, 0.8, PI)); }
  return b.done([L + 0.1, 1.3], use); };
K.bottle_shelf = (o) => { const b = new B(); const L = o.arg || 1.8; b.box(L, 2.0, 0.35, '#2a2230', 0, 0, 0, 0.02); b.box(L - 0.1, 1.5, 0.02, mat('#7a3cff', { e: '#7a3cff', ei: 0.45 }), 0, 0.4, -0.15, 0.01); seed(L * 4); for (let s = 0; s < 3; s++) { const y = 0.45 + s * 0.5; b.box(L - 0.05, 0.03, 0.3, mat(C.glass, { op: 0.6 }), 0, y, 0, 0.005); for (let x = -L / 2 + 0.12; x < L / 2 - 0.1; x += 0.13) bottle(b, x, y + 0.03, 0, pick(['#2a7d2e', '#6b3e1e', '#c49a2c', '#1d4ed8', '#9b2226', '#e9e2d0']), 0.28 + rnd() * 0.06); }
  b.box(L, 0.4, 0.35, '#1c1c22', 0, 0, 0, 0.02); return b.done([L, 0.4], [U.work(0, 0.55)]); };
K.food_stall = (o) => { const b = new B(); const c = o.color || '#f2c230'; b.box(1.3, 0.85, 0.7, c, 0, 0, 0, 0.03); b.box(1.36, 0.05, 0.76, C.woodL, 0, 0.85, 0, 0.02); b.box(0.9, 0.32, 0.5, mat(C.glass, { op: 0.35, r: 0.1 }), -0.15, 0.9, 0, 0.02).userData.noShadow = true; pile(b, -0.3, 0.9, 0, 0.1, '#d9a35b', 8, 0.06); pile(b, 0.05, 0.9, 0, 0.08, '#c96b2c', 6, 0.05);
  b.cyl(0.02, 0.02, 2.1, C.chrome, 0.55, 0, -0.25, 6); b.add(CY(0.04, 1.15, 0.42, 16, true), mat('#fff', { map: T.stripes([o.umbrella || '#e63946', '#f7f1e3'], 16, true), side: true }), 0.55, 2.05, -0.25); b.sph(0.04, C.white, 0.55, 2.28, -0.25);
  signPanel(b, o.label || 'CHOP', '#ffffff', '#c8102e', 0.9, 0.24, 0, 0.45, 0.36); return b.done([1.4, 0.8], [U.stand(0, 0.75)]); };
K.waakye_pot = (o) => { const b = new B(); const tb = mat('#3f7fbf'); b.box(1.4, 0.7, 0.75, tb, 0, 0, 0, 0.03); b.box(1.45, 0.05, 0.8, mat('#fff', { map: T.wax('#f2c230', '#1d6f42', '#c8102e') }), 0, 0.7, 0, 0.01);
  b.cyl(0.33, 0.3, 0.45, mat('#c5cad0', { r: 0.3, m: 0.6 }), -0.3, 0.75, -0.05, 20); b.add(TO(0.33, 0.02, 20), C.chrome, -0.3, 1.2, -0.05, HP); b.cyl(0.31, 0.31, 0.01, '#6a2a24', -0.3, 1.17, -0.05, 18); b.add(CY(0.3, 0.3, 0.02, 18), mat('#3a7d3a', { r: 0.9 }), -0.3, 1.21, 0.0, 0.5, 0, 0);
  b.cyl(0.18, 0.16, 0.2, mat('#d9534f', { r: 0.4 }), 0.25, 0.75, -0.15, 14); b.cyl(0.16, 0.16, 0.01, '#a33b1c', 0.25, 0.94, -0.15, 14); b.cyl(0.13, 0.12, 0.15, mat('#f2c230', { r: 0.4 }), 0.55, 0.75, -0.2, 14); pile(b, 0.55, 0.87, -0.2, 0.06, '#e8d9b5', 4, 0.045);
  for (let i = 0; i < 5; i++) b.add(RB(0.18, 0.05, 0.12, 0.02), mat(i % 2 ? '#3c8d3a' : '#5aa94a'), 0.2 + (i % 3) * 0.18, 0.77 + Math.floor(i / 3) * 0.05, 0.18, 0, 0.2 * i, 0);
  plate(b, 0.55, 0.75, 0.18, '#8a3324', 0.1); b.box(0.55, 0.26, 0.3, mat('#fff', { map: T.woven() }), 0.45, 0, 0.52, 0.03); return b.done([1.45, 0.8], [U.stand(0, 0.8)]); };
K.chop_bar_pot = (o) => { const b = new B(); for (let i = 0; i < 3; i++) { const a = i * 2.1; b.add(RB(0.22, 0.2, 0.22, 0.04), mat('#8d8478', { flat: true }), Math.cos(a) * 0.3 - 0.3, 0.1, Math.sin(a) * 0.3, 0, a, 0); } b.cyl(0.25, 0.25, 0.02, mat('#ff7a1a', { e: '#ff5a00', ei: 1.2 }), -0.3, 0.01, 0, 12).userData.noShadow = true; for (let i = 0; i < 4; i++) b.cc(0.04, 0.04, 0.6, C.woodD, -0.3 + Math.cos(i) * 0.15, 0.06, Math.sin(i) * 0.15, HP, i * 0.8, 0, 6);
  b.cyl(0.36, 0.3, 0.42, mat('#2c2c2c', { r: 0.5, m: 0.4 }), -0.3, 0.2, 0, 18); b.cyl(0.34, 0.34, 0.01, '#c1440e', -0.3, 0.58, 0, 18); b.cc(0.02, 0.02, 0.7, C.woodL, -0.2, 0.75, 0.05, 0.4, 0, -0.3, 6);
  b.cyl(0.22, 0.18, 0.5, '#7a4a2a', 0.45, 0, 0.0, 16); b.cyl(0.18, 0.18, 0.01, '#f4ead2', 0.45, 0.49, 0, 14); b.cc(0.035, 0.04, 1.4, C.woodL, 0.5, 1.0, 0.05, 0.15, 0, -0.15, 8);
  return b.done([1.4, 0.85], [U.work(0.0, 0.7)]); };
K.kenkey_basket = (o) => { const b = new B(); const st = mat(C.woodD); b.box(0.75, 0.5, 0.75, st, 0, 0, 0, 0.02); b.cyl(0.36, 0.3, 0.25, mat('#fff', { map: T.woven() }), 0, 0.5, 0, 16); seed(4); for (let i = 0; i < 9; i++) { const a = i * 0.7, r = i < 6 ? 0.18 : 0.05; b.sph(0.085, mat('#cdb27c', { r: 0.9 }), Math.cos(a) * r, 0.78 + (i < 6 ? 0 : 0.08), Math.sin(a) * r, 1, 0.8, 1.2, 8, 6); }
  return b.done([0.8, 0.8], [U.stand(0, 0.75)]); };
K.fish_tray = (o) => { const b = new B(); const st = mat(C.woodD); b.box(0.8, 0.55, 0.8, st, 0, 0, 0, 0.02); b.cyl(0.42, 0.38, 0.08, mat('#c9ccd0', { r: 0.3, m: 0.6 }), 0, 0.55, 0, 20); seed(9); for (let i = 0; i < 9; i++) { const a = rnd() * PI * 2, r = rnd() * 0.25; b.add(SP(0.07, 8, 6), mat(i % 3 ? '#9a5a2a' : '#c2873a', { r: 0.6 }), Math.cos(a) * r, 0.66 + (i > 5 ? 0.04 : 0), Math.sin(a) * r, 0, a, 0, 2.2, 0.5, 0.8); }
  b.cyl(0.07, 0.06, 0.07, mat('#c8102e'), 0.3, 0.6, 0.3, 10); return b.done([0.85, 0.85], [U.stand(0, 0.75)]); };
K.grill = (o) => { const b = new B(); const mt = mat('#30343a', { r: 0.5, m: 0.5 }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.02, 0.02, 0.6, mt, sx * 0.4, 0, sz * 0.18, 6); b.box(1.0, 0.22, 0.45, mt, 0, 0.55, 0, 0.04); b.box(0.92, 0.02, 0.38, mat('#ff6a1a', { e: '#ff4800', ei: 1.2 }), 0, 0.72, 0, 0.01).userData.noShadow = true;
  for (let i = 0; i < 8; i++) b.box(0.012, 0.012, 0.4, C.chrome, -0.42 + i * 0.12, 0.78, 0, 0.004); for (let i = 0; i < 3; i++) { b.add(SP(0.09, 10, 6), mat('#8a5a32', { r: 0.6 }), -0.28 + i * 0.28, 0.82, 0, 0, 0.4, 0, 2.0, 0.55, 0.85); b.add(CY(0.0, 0.07, 0.1, 4), mat('#6e4526'), -0.28 + i * 0.28 + 0.2, 0.82, 0, 0, 0.4, HP, 1, 1, 0.4); }
  b.box(0.4, 0.5, 0.3, '#6d4c41', 0.75, 0, 0.05, 0.02); plate(b, 0.75, 0.5, 0.05, '#f4ead2'); return b.done([1.5, 0.55], [U.work(0, 0.65)]); };
K.market_table = (o) => { const b = new B(); const c = o.color || '#8d6e4a'; tableTop(b, 1.6, 0.9, 0.8, mat(c), mat(shade(c, -0.15))); b.box(1.64, 0.02, 0.94, mat('#fff', { map: T.wax('#f2c230', '#2f6fd1', '#c8102e') }), 0, 0.8, 0, 0.005);
  const goods = o.goods || ['#d62828', '#e9d8a6', '#2e8b57', '#d62828', '#7b2d8e', '#f77f00']; goods.slice(0, 6).forEach((g, i) => pile(b, -0.55 + (i % 3) * 0.55, 0.82, -0.2 + Math.floor(i / 3) * 0.4, 0.1, g, 10, g === '#2e8b57' ? 0.035 : 0.055));
  b.cyl(0.18, 0.15, 0.2, mat('#fff', { map: T.woven() }), 0.95, 0, 0.3, 12); pile(b, 0.95, 0.18, 0.3, 0.06, '#e85d04', 5, 0.05); return b.done([1.7, 0.95], [U.stand(0, 0.8)]); };
K.clothes_rack = (o) => { const b = new B(); const L = o.arg || 1.6; const m = mat(C.chrome, { r: 0.35, m: 0.6 }); for (const sx of [-1, 1]) { b.cyl(0.02, 0.02, 1.6, m, sx * L / 2, 0, 0, 6); b.box(0.06, 0.03, 0.5, m, sx * L / 2, 0, 0, 0.01); } b.bar([-L / 2, 1.6, 0], [L / 2, 1.6, 0], 0.015, m);
  seed(L * 13); for (let x = -L / 2 + 0.12; x < L / 2 - 0.08; x += 0.12) { const c = pick(['#e63946', '#2a9d8f', '#f4a261', '#264653', '#e9c46a', '#8338ec', '#3a86ff', '#ffffff', '#ff006e']); const h = 0.65 + rnd() * 0.35; b.bc(0.05, h, 0.42, mat(c), x, 1.56 - h / 2, 0, 0, 0, (rnd() - 0.5) * 0.08, 0.02); }
  return b.done([L + 0.1, 0.55], [U.stand(0, 0.65)]); };
K.bale = (o) => { const b = new B(); b.box(1.5, 0.03, 1.3, mat('#2f5d8a'), 0, 0, 0, 0.01); seed(17); for (let i = 0; i < 22; i++) { const a = rnd() * PI * 2, r = Math.sqrt(rnd()) * 0.55; b.add(IC(0.16 + rnd() * 0.08, 0), mat(pick(['#e63946', '#2a9d8f', '#f4a261', '#264653', '#e9c46a', '#8338ec', '#3a86ff', '#f1faee', '#ff006e', '#6c757d']), { flat: true, r: 0.95 }), Math.cos(a) * r, 0.12 + (0.55 - r) * 0.45 + rnd() * 0.06, Math.sin(a) * r * 0.85, rnd() * 3, rnd() * 3, 0, 1.2, 0.6, 1); }
  return b.done([1.5, 1.3], [{ x: 0, z: 0.9, face: PI, pose: 'squat' }]); };
K.momo_kiosk = (o) => { const b = new B(); const c = o.color || '#ffcc00'; const W = 1.7, D = 1.3, H = 2.25; b.box(W, 0.06, D, '#c9b27a', 0, 0, 0, 0.01); b.box(W, H, 0.08, c, 0, 0, -D / 2 + 0.04, 0.02); for (const s of [-1, 1]) b.box(0.08, H, D, c, s * (W / 2 - 0.04), 0, 0, 0.02);
  b.box(W, 1.0, 0.08, c, 0, 0, D / 2 - 0.04, 0.02); b.box(W, 0.4, 0.08, c, 0, 1.85, D / 2 - 0.04, 0.02); b.box(W + 0.15, 0.08, D + 0.2, '#1d4ed8', 0, H, 0.05, 0.02); b.box(W + 0.1, 0.06, 0.4, C.woodL, 0, 1.0, D / 2 + 0.1, 0.02);
  b.box(W - 0.1, 0.06, 0.03, '#1d4ed8', 0, 0.75, D / 2 + 0.005, 0.005); signPanel(b, o.label || 'MOBILE MONEY\nCASH IN · CASH OUT', '#1d4ed8', '#ffcc00', 1.5, 0.34, 0, 2.05, D / 2 + 0.02); b.box(0.5, 0.3, 0.02, mat('#fff', { map: T.text('AIRTIME', '#ffffff', '#1d4ed8', 256, 128) }), -0.45, 0.3, D / 2 + 0.005, 0.01);
  b.box(0.2, 0.14, 0.03, C.black, 0.4, 1.06, D / 2 + 0.1, 0.01); b.box(0.6, 0.75, 0.4, '#e8e2d4', 0.4, 0.06, -0.35, 0.02); b.box(0.4, 0.4, 0.02, mat('#fff', { map: T.text('SIM\nREG', '#c8102e', '#fff', 128, 128) }), 0.5, 1.3, -D / 2 + 0.085, 0.005);
  return b.done([W, D + 0.3], [U.stand(0, D / 2 + 0.6)]); };
K.atm = (o) => { const b = new B(); const c = o.color || '#2b4f7e'; b.box(0.8, 1.75, 0.6, c, 0, 0, 0, 0.04); b.box(0.7, 0.55, 0.25, '#20242a', 0, 0.9, 0.3, 0.03); b.plane(0.36, 0.24, mat('#000', { map: T.screen('atm'), e: '#ffffff', ei: 0.9 }), 0, 1.2, 0.426).userData.noShadow = true; b.box(0.3, 0.03, 0.2, '#8f99a3', 0, 0.94, 0.4, 0.01); b.box(0.15, 0.02, 0.01, mat('#3dff6e', { e: '#3dff6e' }), 0.2, 1.08, 0.428);
  b.box(0.84, 0.18, 0.62, mat('#f2c230', { e: '#f2c230', ei: 0.35 }), 0, 1.75, 0, 0.03); return b.done([0.85, 0.65], [U.work(0, 0.7)]); };
K.teller_desk = (o) => { const b = new B(); const c = o.color || '#e7dcc7'; const L = o.arg || 2.6; b.box(L, 1.05, 0.6, c, 0, 0, 0, 0.02); b.box(L + 0.06, 0.05, 0.66, '#5a3b26', 0, 1.05, 0, 0.01); b.box(L, 0.7, 0.03, mat(C.glass, { op: 0.3, r: 0.1 }), 0, 1.1, -0.05, 0.005).userData.noShadow = true; for (let i = 0; i <= 2; i++) b.box(0.05, 0.75, 0.05, C.chrome, -L / 2 + (L / 2) * i, 1.08, -0.05, 0.01);
  for (const x of [-L / 4, L / 4]) { b.box(0.38, 0.28, 0.03, C.black, x, 1.15, -0.2, 0.01); b.plane(0.34, 0.22, mat('#000', { map: T.screen('code'), e: '#fff', ei: 0.6 }), x, 1.29, -0.18).userData.noShadow = true; b.box(0.3, 0.02, 0.06, C.dark, x, 1.07, 0.1); }
  b.box(L, 0.08, 0.03, mat('#c9a227'), 0, 0.75, 0.305, 0.005); return b.done([L + 0.06, 0.7], [U.stand(-L / 4, 0.7), U.stand(L / 4, 0.7)]); };
K.reception_desk = (o) => { const b = new B(); const c = o.color || '#f2efe8'; const L = o.arg || 2.2; b.box(L, 1.05, 0.65, c, 0, 0, 0, 0.04); b.box(L + 0.1, 0.05, 0.4, o.top || C.woodD, 0, 1.05, 0.15, 0.02); b.box(L - 0.2, 0.08, 0.02, mat(o.accent || '#2a9d8f'), 0, 0.6, 0.33, 0.005); b.box(0.42, 0.3, 0.03, C.black, -0.3, 0.76, -0.1, 0.01); b.plane(0.38, 0.24, mat('#000', { map: T.screen('code'), e: '#fff', ei: 0.6 }), -0.3, 0.91, -0.08).userData.noShadow = true;
  b.cyl(0.08, 0.07, 0.12, '#e76f51', L / 2 - 0.25, 1.1, 0.15, 10); leafClump(b, L / 2 - 0.25, 1.3, 0.15, 0.4); return b.done([L + 0.1, 0.7], [U.stand(0, 0.75)]); };
K.police_desk = (o) => { const b = new B(); const L = o.arg || 2.2; b.box(L, 1.05, 0.6, '#1f3b73', 0, 0, 0, 0.03); b.box(L + 0.08, 0.06, 0.68, C.woodD, 0, 1.05, 0, 0.02); b.box(L, 0.08, 0.03, '#e8e8e8', 0, 0.8, 0.305, 0.005); b.box(0.45, 0.04, 0.32, '#2e4a2b', -0.3, 1.11, 0.05, 0.01); b.box(0.42, 0.01, 0.3, '#f7f4ec', -0.3, 1.15, 0.05, 0.003); b.cc(0.005, 0.005, 0.16, '#1d4ed8', -0.15, 1.16, 0.1, HP, 0, 0.5);
  b.box(0.18, 0.06, 0.12, C.black, 0.4, 1.11, 0.0, 0.01); signPanel(b, o.label || 'CHARGE OFFICE', '#e8e8e8', '#1f3b73', 1.3, 0.28, 0, 0.45, 0.31); return b.done([L + 0.08, 0.7], [U.stand(0, 0.72)]); };
K.cell_bars = (o) => { const b = new B(); const L = o.arg || 2.4; const m = mat('#3a3f47', { m: 0.5, r: 0.4 }); for (let x = -L / 2; x <= L / 2 + 1e-3; x += 0.14) b.cyl(0.018, 0.018, 2.2, m, x, 0, 0, 6); for (const y of [0.05, 1.1, 2.15]) b.box(L + 0.06, 0.06, 0.06, m, 0, y, 0, 0.01);
  b.box(1.4, 0.06, 0.4, C.woodD, -L / 2 + 0.85, 0.42, -0.9, 0.01); for (const sx of [-1, 1]) b.box(0.05, 0.42, 0.35, C.dark, -L / 2 + 0.85 + sx * 0.6, 0, -0.9); b.box(0.06, 0.25, 0.06, C.gold, L / 2 - 0.5, 1.0, 0.04);
  return b.done([L, 0.15], [U.stand(0, 0.6)]); };
K.prayer_mats = (o) => { const b = new B(); const n = o.arg || 3; const cols = ['#1d6f42', '#8c1c13', '#1d3d8c', '#6b2fa0']; const use = []; for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 0.85; b.box(0.7, 0.015, 1.2, mat('#fff', { map: T.stripes([cols[i % 4], shade(cols[i % 4], 0.3), cols[i % 4], C.gGold], 8, false) }), x, 0, 0, 0.005); b.box(0.5, 0.012, 0.25, mat(C.gGold), x, 0.015, -0.42, 0.005); use.push({ x, z: 0.2, y: 0, face: PI, pose: 'pray' }); }
  return b.done([n * 0.85, 1.2], use, { walkable: true }); };
// --- outdoor & dressing
K.rug = (o) => { const b = new B(); const [w, d] = o.dims || [2.0, 1.4]; b.box(w, 0.015, d, mat('#fff', { map: o.kente === true ? T.kente(o.k || 1) : T.fabric(o.color||['#c7b89b','#aab4a0','#bfa991'][o.k||0]), r: 0.95 }), 0, 0, 0, 0.005); b.box(w + 0.04, 0.01, d + 0.04, mat(o.color || '#3b2a1f'), 0, 0, 0, 0.003); return b.done([w, d], [{ x: 0, z: 0, y: 0.02, face: 0, pose: 'sit_floor' }], { walkable: true }); };
K.plant = (o) => { const b = new B(); const pc = o.color || C.clay; b.cyl(0.2, 0.15, 0.36, mat(pc), 0, 0, 0, 12); b.add(TO(0.2, 0.025, 12), mat(shade(pc, -0.1)), 0, 0.36, 0, HP); b.cyl(0.18, 0.18, 0.02, '#4a2f20', 0, 0.34, 0, 12);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; b.add(SP(0.1, 8, 6), mat(i % 2 ? C.leaf : C.leafD, { flat: true }), Math.cos(a) * 0.14, 0.75 + (i % 3) * 0.12, Math.sin(a) * 0.14, 0.4 * Math.sin(a), a, 0.5 * Math.cos(a), 0.7, 2.6, 0.3); } b.cyl(0.015, 0.02, 0.4, C.leafD, 0, 0.36, 0, 5);
  return b.done([0.42, 0.42], [U.stand(0, 0.5)]); };
K.floor_lamp = (o) => { const b = new B(); b.cyl(0.16, 0.18, 0.04, C.dark, 0, 0, 0, 14); b.cyl(0.015, 0.015, 1.45, C.dark, 0, 0.04, 0, 6); b.cyl(0.13, 0.2, 0.28, mat(o.color || '#f6e7c8', { e: '#ffcf80', ei: 0.5 }), 0, 1.4, 0, 14); return b.done([0.38, 0.38], [U.stand(0, 0.5)]); };
K.mirror = (o) => { const b = new B(); b.box(0.66, 1.06, 0.04, o.color || C.gold, 0, 0.85, 0.03, 0.03); b.box(0.58, 0.98, 0.02, mat('#dff3fb', { r: 0.05, m: 0.6 }), 0, 0.89, 0.055, 0.01); return b.done([0.66, 0.1], [U.stand(0, 0.6)], { walkable: true }); };
K.wall_shelf = (o) => { const b = new B(); const L = o.arg || 1.0; b.box(L, 0.04, 0.25, o.color || C.woodL, 0, 1.55, 0.13, 0.01); seed(L * 5); for (let x = -L / 2 + 0.1; x < L / 2; x += 0.16) b.box(0.1, 0.12 + rnd() * 0.12, 0.1, pick(['#e63946', '#2a9d8f', '#f4a261', '#f1faee', '#e9c46a']), x, 1.59, 0.13, 0.02); return b.done([L, 0.25], [U.stand(0, 0.5)], { walkable: true }); };
K.picture = (o) => { const b = new B(); frame(b, 0, 1.6, 0.03, o.arg || 0.6, (o.arg || 0.6) * 0.75, o.screen || 'film'); return b.done([0.6, 0.06], [U.stand(0, 0.5)], { walkable: true }); };
K.wall_clock = (o) => { const b = new B(); b.cc(0.17, 0.17, 0.04, C.black, 0, 2.05, 0.03, HP, 0, 0, 20); b.cc(0.15, 0.15, 0.045, C.white, 0, 2.05, 0.035, HP, 0, 0, 20); b.bc(0.015, 0.11, 0.01, C.black, 0, 2.09, 0.06); b.bc(0.08, 0.015, 0.01, C.black, 0.035, 2.05, 0.062); return b.done([0.3, 0.05], [U.stand(0, 0.5)], { walkable: true }); };
K.poster = (o) => { const b = new B(); b.box(0.7, 0.95, 0.01, mat('#fff', { map: T.text(o.label || 'JESUS\nIS LORD', o.color || '#c8102e', '#fff', 256, 340), e: '#fff', ei: 0.1 }), 0, 1.2, 0.02, 0.003); return b.done([0.7, 0.05], [U.stand(0, 0.5)], { walkable: true }); };
K.calendar = (o) => K.poster({ ...o, label: o.label || '2026\nCALENDAR', color: o.color || '#1d6f42' });
K.window_curtain = (o) => { const b = new B(); const W = o.arg || 1.4; const cm = mat('#fff', { map: T.fabric(o.color || '#8e9a7b'), r: 0.95 }); b.cc(0.015, 0.015, W + 0.5, C.woodD, 0, 2.22, 0.12, 0, 0, HP, 6); for (const s of [-1, 1]) for (let k = 0; k < 3; k++) b.box(0.13, 1.4, 0.05, cm, s * (W / 2 + 0.05 + k * 0.1), 0.82, 0.1 + (k % 2) * 0.03, 0.02);
  return b.done([W + 0.6, 0.15], [U.stand(0, 0.6)], { walkable: true }); };
K.curtain = (o) => { const b = new B(); const L = o.arg || 2.0; const cm = mat('#fff', { map: T.wax(o.color || '#1f6fb8', '#f4c542', '#e34b32'), r: 0.95 }); b.cc(0.015, 0.015, L, C.chrome, 0, 2.15, 0, 0, 0, HP, 6); const n = Math.round(L / 0.16); for (let i = 0; i < n; i++) b.box(0.15, 2.0, 0.04, cm, -L / 2 + 0.08 + i * (L / n), 0.12, (i % 2) * 0.05 - 0.025, 0.015);
  for (const s of [-1, 1]) b.cyl(0.015, 0.015, 2.15, C.chrome, s * L / 2, 0, 0, 6); return b.done([L, 0.15], [U.stand(0, 0.5)]); };
K.low_wall = (o) => { const b = new B(); const L = o.arg || 2; const c = o.color || '#e8dfc9'; b.box(L, 0.6, 0.22, c, 0, 0, 0, 0.02); b.box(L + 0.04, 0.06, 0.28, shade(c, -0.2), 0, 0.6, 0, 0.01); for (let x = -L / 2; x <= L / 2 + 1e-3; x += Math.max(1, L / Math.ceil(L / 2))) b.box(0.28, 0.75, 0.28, shade(c, -0.08), x, 0, 0, 0.02);
  if (o.arg2 !== 0) b.box(L, 0.08, 0.24, mat(o.trim || C.gGreen), 0, 0.15, 0, 0.005); return b.done([L, 0.3], [U.stand(0, 0.5)]); };
K.kerb = (o) => { const b = new B(); const L = o.arg || 2; for (let i = 0; i < Math.round(L / 0.5); i++) b.box(0.48, 0.14, 0.2, i % 2 ? '#f2f2f2' : '#1b1b1b', -L / 2 + 0.25 + i * 0.5, 0, 0, 0.02); return b.done([L, 0.2], [U.stand(0, 0.5)]); };
K.fence = (o) => { const b = new B(); const L = o.arg || 2; const m = mat(o.color || '#2d6a4f', { m: 0.3, r: 0.6 }); for (let x = -L / 2; x <= L / 2 + 1e-3; x += 0.16) b.box(0.03, 1.1, 0.03, m, x, 0, 0, 0.005); for (const y of [0.1, 1.0]) b.box(L, 0.05, 0.04, m, 0, y, 0, 0.01); return b.done([L, 0.1], [U.stand(0, 0.5)]); };
K.hedge = (o) => { const b = new B(); const L = o.arg || 2; b.box(L, 0.6, 0.45, mat('#3f8f46', { r: 0.95 }), 0, 0, 0, 0.15); seed(L * 3); for (let x = -L / 2 + 0.2; x < L / 2; x += 0.35) b.add(IC(0.2, 0), mat(rnd() > 0.7 ? '#e86a92' : '#4aa651', { flat: true }), x, 0.6, (rnd() - 0.5) * 0.15, rnd(), rnd(), 0, 1, 0.7, 1); return b.done([L, 0.45], [U.stand(0, 0.5)]); };
// a drooping, V-folded, serrated palm frond along +z (cached)
const frondGeo = () => geo('frond', () => {
  const n = 14, Lf = 1.6, W = 0.32, pos = [], idx = [];
  for (let i = 0; i <= n; i++) { const t = i / n; const w = W * Math.pow(Math.sin(PI * Math.min(1, t * 1.15 + 0.04)), 0.8) * (i % 2 ? 1 : 0.62); const y = Lf * (0.32 * t - 0.95 * t * t); const z = Lf * t * (1 - 0.12 * t);
    pos.push(-w, y - w * 0.35, z, 0, y + 0.02, z, w, y - w * 0.35, z); }
  for (let i = 0; i < n; i++) { const a = i * 3; idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; });
K.palm_tree = (o) => { const b = new B(); const h = o.arg || 3.6; seed(h * 7); let x = 0; const n = 8; const lean = o.lean ?? 0.35;
  for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; const x0 = lean * t0 * t0, x1 = lean * t1 * t1; const sh = i % 2 ? '#9a7650' : '#83633f'; const r = 0.13 - i * 0.007;
    const seg = b.add(CY(r * 0.88, r, h / n + 0.02, 8), mat(sh, { flat: true }), (x0 + x1) / 2, (t0 + t1) / 2 * h, 0, 0, 0, -(x1 - x0) / (h / n)); seg.rotation.order = 'XYZ'; x = x1; }
  const top = [x, h, 0]; const fm = [mat('#3f9a4a', { side: true, r: 0.8 }), mat('#2f7d3a', { side: true, r: 0.8 }), mat('#5aae4f', { side: true, r: 0.8 })];
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(frondGeo(), fm[i % 3]); m.position.set(top[0], top[1] + 0.05, top[2]); m.rotation.order = 'YXZ'; m.rotation.set(-0.25 + rnd() * 0.35 - (i % 2) * 0.25, (i / 10) * PI * 2 + rnd() * 0.25, 0); const s = 0.85 + rnd() * 0.3; m.scale.set(s, s, s); b.g.add(m); }
  b.add(CY(0.0, 0.16, 0.35, 8), mat('#6f8f3a', { flat: true }), top[0], top[1] + 0.12, 0);
  for (let i = 0; i < 4; i++) b.sph(0.085, '#6b4a22', top[0] + Math.cos(i * 1.7) * 0.13, h - 0.12, Math.sin(i * 1.7) * 0.13); return b.done([0.5, 0.5], [U.stand(0, 0.6)]); };
K.tree = (o) => { const b = new B(); b.cyl(0.12, 0.16, 1.5, '#7a5a3a', 0, 0, 0, 7); leafClump(b, 0, 2.0, 0, 2.4, o.color || '#4b9a4a'); leafClump(b, 0.4, 1.7, 0.3, 1.5, '#3f8a42'); return b.done([0.5, 0.5], [U.stand(0, 0.6)]); };
K.umbrella = (o) => { const b = new B(); b.cyl(0.025, 0.025, 2.2, C.chrome, 0, 0, 0, 6); b.add(CY(0.04, 0.95, 0.42, 16, true), mat('#fff', { map: T.stripes([o.color || '#e63946', '#f7f1e3'], 16, true), side: true }), 0, 2.14, 0); b.sph(0.05, C.white, 0, 2.37, 0); b.cyl(0.25, 0.25, 0.08, '#d0d0d0', 0, 0, 0, 12); return b.done([0.3, 0.3], [U.stand(0, 0.5)], { walkable: true }); };
K.canopy = (o) => { const b = new B(); const W = o.arg || 4, D = o.arg2 || 4; const cols = o.colors || [o.color || '#c8102e', '#111111']; for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.04, 0.04, 2.5, C.chrome, sx * W / 2, 0, sz * D / 2, 6);
  // Four pitched panels fit the actual rectangular footprint. Scaling a rotated
  // cone stretched narrow canopies beyond their posts and over nearby players.
  const corners=[[-W/2,2.5,-D/2],[W/2,2.5,-D/2],[W/2,2.5,D/2],[-W/2,2.5,D/2]],vertices=[],uv=[];
  for(let i=0;i<4;i++){vertices.push(...corners[i],0,3.15,0,...corners[(i+1)%4]);uv.push(0,0,.5,1,1,0);}
  const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));roof.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));roof.computeVertexNormals();
  b.g.add(new THREE.Mesh(roof,mat('#fff',{map:T.stripes(cols,8,true),side:true})));
  for (const sz of [-1, 1]) b.box(W, 0.25, 0.02, mat('#fff', { map: T.stripes(cols, Math.round(W * 3), true) }), 0, 2.27, sz * D / 2, 0.005); for (const sx of [-1, 1]) b.box(0.02, 0.25, D, mat('#fff', { map: T.stripes(cols, Math.round(D * 3), true) }), sx * W / 2, 2.27, 0, 0.005);
  return b.done([W, D], [U.stand(0, 0)], { walkable: true }); };
K.awning = (o) => { const b = new B(); const W = o.arg || 3; b.bc(W, 0.04, 1.0, mat('#fff', { map: T.stripes([o.color || '#2a9d8f', '#f7f1e3'], Math.round(W * 4), true) }), 0, 2.45, 0.5, 0.25); b.box(W, 0.2, 0.02, mat('#fff', { map: T.stripes([o.color || '#2a9d8f', '#f7f1e3'], Math.round(W * 4), true) }), 0, 2.1, 0.98, 0.005); for (const s of [-1, 1]) b.cyl(0.02, 0.02, 2.3, C.chrome, s * W / 2, 0, 0.98, 6);
  return b.done([W, 0.1], [U.stand(0, 1.2)], { walkable: true }); };
K.canoe = (o) => { const b = new B(); const L = o.arg || 5.2, W = 1.15; const shape = new THREE.Shape(); shape.moveTo(-L / 2, 0); shape.quadraticCurveTo(-L * 0.3, W / 2, 0, W / 2); shape.quadraticCurveTo(L * 0.3, W / 2, L / 2, 0); shape.quadraticCurveTo(L * 0.3, -W / 2, 0, -W / 2); shape.quadraticCurveTo(-L * 0.3, -W / 2, -L / 2, 0);
  const hull = (s, y, h, m) => { const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 10 }); g.rotateX(-HP); const o2 = b.add(g, m, 0, y, 0, 0, 0, 0, s, 1, s); return o2; };
  const base = o.color || '#f7f1e3'; hull(0.8, 0.04, 0.2, mat('#5a3b26')); hull(1.0, 0.18, 0.42, mat(base)); hull(1.012, 0.3, 0.07, mat(C.gRed)); hull(1.012, 0.38, 0.05, mat(C.gGold)); hull(1.012, 0.44, 0.05, mat(C.gGreen)); hull(0.93, 0.56, 0.05, mat('#5a3b26'));
  for (const x of [-1.2, 0, 1.2]) b.box(0.12, 0.05, W * 0.85, C.woodL, x, 0.56, 0, 0.01); b.cyl(0.03, 0.03, 1.3, C.woodD, L / 2 - 0.5, 0.5, 0, 6); b.box(0.4, 0.26, 0.01, mat('#fff', { map: T.flag(), side: true }), L / 2 - 0.3, 1.55, 0, 0.003);
  signPanel(b, o.label || 'GOD DEY', '#f7f1e3', '#c8102e', 1.4, 0.18, -0.4, 0.3, W * 0.47 + 0.02);
  return b.done([L, W], [U.sit(-0.6, 0.0, 0.6, 0), { x: 0, z: W / 2 + 0.45, face: PI, pose: 'work' }]); };
K.fishing_net = (o) => { const b = new B(); seed(23); for (let i = 0; i < 10; i++) { const a = rnd() * PI * 2, r = rnd() * 0.55; b.add(IC(0.25 + rnd() * 0.12, 1), mat('#2f6b5a', { flat: true, r: 0.95 }), Math.cos(a) * r, 0.1, Math.sin(a) * r * 0.7, rnd(), rnd(), 0, 1.3, 0.45, 1); }
  for (let i = 0; i < 8; i++) b.sph(0.06, '#f77f00', -0.6 + i * 0.17, 0.06 + (i % 2) * 0.12, 0.42 - (i % 3) * 0.1); b.bar([0.6, 0.05, 0.1], [1.6, 0.05, 0.6], 0.015, '#d9c39a'); return b.done([1.5, 1.1], [{ x: 0.1, z: 0.85, face: PI, pose: 'squat' }]); };
K.fountain = (o) => { const b = new B(); const R = o.arg || 1.3; b.cyl(R, R + 0.05, 0.45, '#d8d2c4', 0, 0, 0, 24); b.cyl(R - 0.12, R - 0.12, 0.02, mat(C.water, { r: 0.1, e: '#1d7fa8', ei: 0.25 }), 0, 0.4, 0, 24); b.cyl(0.18, 0.25, 0.9, '#d8d2c4', 0, 0.4, 0, 12); b.cyl(0.55, 0.3, 0.15, '#d8d2c4', 0, 1.25, 0, 16); b.cyl(0.5, 0.5, 0.02, mat(C.water, { r: 0.1 }), 0, 1.38, 0, 16);
  b.add(CY(0.05, 0.35, 0.7, 12, true), mat('#bfeaff', { op: 0.55, r: 0.1, e: '#7fd0ff', ei: 0.2 }), 0, 1.75, 0).userData.noShadow = true; b.cyl(0.04, 0.04, 0.4, mat('#bfeaff', { op: 0.6 }), 0, 1.4, 0, 8);
  return b.done([R * 2 + 0.1, R * 2 + 0.1], [U.stand(0, R + 0.4), U.stand(R + 0.4, 0, PI / 2 + PI)]); };
K.statue = (o) => { const b = new B(); b.box(1.0, 1.1, 1.0, '#e6dfcf', 0, 0, 0, 0.02); b.box(1.15, 0.12, 1.15, '#cfc6b2', 0, 1.1, 0, 0.02); const br = mat(o.color || '#6d5838', { m: 0.6, r: 0.45 }); b.cyl(0.18, 0.28, 1.2, br, 0, 1.22, 0, 8); b.sph(0.22, br, 0, 2.6, 0, 1, 1.15, 1); b.bc(0.14, 0.8, 0.14, br, 0.32, 2.4, 0, 0, 0, -0.7); b.sph(0.12, br, 0.62, 2.78, 0); b.bc(0.9, 0.12, 0.3, br, 0, 2.2, 0, 0, 0, 0.1);
  signPanel(b, o.label || 'FREEDOM', '#e6dfcf', '#5a4a2f', 0.8, 0.2, 0, 0.6, 0.51); return b.done([1.15, 1.15], [U.stand(0, 0.95)]); };
K.star_arch = (o) => { const b = new B(); const W = o.arg || 5; const c = '#f1ede4'; for (const s of [-1, 1]) b.box(0.9, 3.6, 0.9, c, s * (W / 2 - 0.45), 0, 0, 0.02); b.box(W, 0.9, 0.9, c, 0, 3.6, 0, 0.02); b.box(W + 0.2, 0.12, 1.0, '#d9d2c3', 0, 4.5, 0, 0.01);
  const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = HP + (i * PI) / 5, r = i % 2 ? 0.25 : 0.62; i ? st.lineTo(Math.cos(a) * r, Math.sin(a) * r) : st.moveTo(Math.cos(a) * r, Math.sin(a) * r); } const sg = new THREE.ExtrudeGeometry(st, { depth: 0.2, bevelEnabled: false }); b.add(sg, '#141414', 0, 5.25, -0.1);
  for (const s of [-1, 1]) b.box(0.6, 0.6, 0.02, mat('#fff', { map: T.flag() }), s * (W / 2 - 0.45), 2.4, 0.46, 0.003); return b.done([W, 0.9], [U.stand(0, 1.2)]); };
K.lighthouse = (o) => { const b = new B(); const H = o.arg || 6; const n = 6; for (let i = 0; i < n; i++) { const r0 = 0.95 - (i * 0.35) / n, r1 = 0.95 - ((i + 1) * 0.35) / n; b.cyl(r1, r0, H / n, i % 2 ? C.white : '#d62828', 0, (i * H) / n, 0, 18); } b.cyl(0.85, 0.85, 0.1, C.dark, 0, H, 0, 18); b.cyl(0.42, 0.42, 0.6, mat('#fff7c2', { e: '#ffd75e', ei: 0.9, op: 0.85 }), 0, H + 0.1, 0, 12).userData.noShadow = true; b.cyl(0.05, 0.5, 0.4, '#d62828', 0, H + 0.7, 0, 12);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; b.cyl(0.012, 0.012, 0.35, C.dark, Math.cos(a) * 0.8, H + 0.1, Math.sin(a) * 0.8, 4); } b.add(TO(0.8, 0.015, 24), C.dark, 0, H + 0.45, 0, HP); b.box(0.6, 1.2, 0.2, '#5a3b26', 0, 0, 0.88, 0.02);
  return b.done([1.9, 1.9], [U.stand(0, 1.35)]); };
K.cannon = (o) => { const b = new B(); const wd = mat('#5a3b26'); b.box(0.6, 0.35, 1.0, wd, 0, 0.12, 0, 0.03); for (const sx of [-1, 1]) for (const sz of [-0.35, 0.35]) b.cc(0.15, 0.15, 0.08, wd, sx * 0.34, 0.15, sz, 0, 0, HP, 10); b.cc(0.16, 0.12, 1.5, mat('#2b2b2b', { m: 0.6, r: 0.4 }), 0, 0.6, 0.35, HP - 0.15, 0, 0, 12); b.sph(0.17, mat('#2b2b2b', { m: 0.6, r: 0.4 }), 0, 0.5, -0.38);
  return b.done([0.75, 1.3], [U.stand(0.6, 0.2, -HP)]); };
K.flag_pole = (o) => { const b = new B(); const H = o.arg || 4.2, f = Math.min(1, H / 4.2); b.cyl(0.2 * f, 0.25 * f, 0.25, '#cfc6b2', 0, 0, 0, 10); b.cyl(0.03, 0.04, H, C.chrome, 0, 0.2, 0, 8); b.box(0.9 * f, 0.6 * f, 0.015, mat('#fff', { map: T.flag(), side: true }), 0.47 * f, H + 0.2 - 0.75 * f, 0, 0.002); b.sph(0.06, C.gold, 0, H + 0.22, 0); return b.done([0.5, 0.5], [U.stand(0, 0.6)]); };
K.kite = (o) => { const b = new B(); const k = new THREE.Shape(); k.moveTo(0, 0.45); k.lineTo(0.3, 0); k.lineTo(0, -0.6); k.lineTo(-0.3, 0); k.closePath(); b.add(new THREE.ShapeGeometry(k), mat('#fff', { map: T.stripes([o.color || '#e63946', C.gGold, C.gGreen], 3, false), side: true }), 0, 4.2, 0, -0.3, 0.6, 0.2).userData.noShadow = true;
  b.bar([0, 3.6, 0], [0.9, 0.9, 1.2], 0.004, '#f0f0f0'); for (let i = 0; i < 4; i++) b.box(0.08, 0.04, 0.01, ['#e63946', '#f2c230', '#2a9d8f', '#e63946'][i], 0.05 * i, 3.55 - i * 0.18, 0, 0.004); return b.done([0.2, 0.2], [{ x: 1.0, z: 1.5, face: PI + 0.6, pose: 'cheer' }], { walkable: true }); };
K.track = (o) => { const b = new B(); const L = o.arg || 6, n = 3; b.box(L, 0.012, n * 0.9, '#c0503a', 0, 0, 0, 0.003); for (let i = 0; i <= n; i++) b.box(L, 0.006, 0.05, C.white, 0, 0.012, -n * 0.45 + i * 0.9, 0.001); return b.done([L, n * 0.9], [{ x: 0, z: 0, face: -HP, pose: 'stand' }], { walkable: true }); };
K.goalpost = (o) => { const b = new B(); const W = o.arg || 3; const m = mat(C.white, { r: 0.4 }); for (const s of [-1, 1]) { b.cyl(0.05, 0.05, 1.8, m, s * W / 2, 0, 0, 8); b.bar([s * W / 2, 1.8, 0], [s * W / 2, 0, -0.8], 0.02, m); } b.bar([-W / 2, 1.8, 0], [W / 2, 1.8, 0], 0.05, m); b.box(W, 1.8, 0.01, mat('#fff', { map: T.net(), op: 0.7, side: true }), 0, 0, -0.5, 0.001).rotation.x = -0.4; return b.done([W, 0.9], [U.stand(0, 1.0)]); };
K.ticket_booth = (o) => { const b = new B(); const c = o.color || '#c8102e'; b.box(1.4, 2.2, 1.2, c, 0, 0, 0, 0.04); b.box(0.9, 0.6, 0.04, mat(C.glass, { op: 0.4 }), 0, 1.1, 0.6, 0.01).userData.noShadow = true; b.box(1.6, 0.12, 1.4, '#222', 0, 2.2, 0, 0.02); signPanel(b, o.label || 'TICKETS', '#ffffff', c, 1.2, 0.3, 0, 1.92, 0.62); b.box(1.0, 0.05, 0.3, C.woodL, 0, 1.05, 0.72, 0.01); return b.done([1.45, 1.3], [U.stand(0, 1.15)]); };
K.sea = (o) => { const b = new B(); const L = o.arg || 10, D = o.arg2 || 2.5; b.box(L, 0.02, D, mat('#3fb4d8', { op: 0.82, r: 0.15, e: '#1b6f9a', ei: 0.15 }), 0, 0.04, 0, 0.005).userData.noShadow = true; for (let i = 0; i < 3; i++) b.box(L, 0.025, 0.12 + i * 0.03, mat('#f4fbff', { op: 0.8 }), 0, 0.045, -D / 2 + 0.1 + i * 0.5, 0.01).userData.noShadow = true;
  return b.done([L, D], [{ x: 0, z: D * 0.25, y: -0.75, face: PI * 0.25, pose: 'wade' }, { x: 1.2, z: D * 0.3, y: -0.75, face: -0.4, pose: 'wade' }], { walkable: true }); };
K.pool = (o) => { const b = new B(); const W = o.arg || 4, D = o.arg2 || 3; const rim = mat('#f1ece2'); b.box(W + 0.5, 0.14, 0.25, rim, 0, 0, -D / 2 - 0.125, 0.02); b.box(W + 0.5, 0.14, 0.25, rim, 0, 0, D / 2 + 0.125, 0.02); b.box(0.25, 0.14, D, rim, -W / 2 - 0.125, 0, 0, 0.02); b.box(0.25, 0.14, D, rim, W / 2 + 0.125, 0, 0, 0.02);
  b.box(W, 0.03, D, mat('#fff', { map: T.tilesWall('#4fc3e8'), e: '#2a9fd6', ei: 0.25, r: 0.15 }), 0, 0.06, 0, 0.003); b.box(W, 0.02, D, mat('#7fdcff', { op: 0.45, r: 0.05 }), 0, 0.1, 0, 0.003).userData.noShadow = true; for (const s of [-0.18, 0.18]) { b.bar([W / 2 - 0.4 + s, 0, D / 2 - 0.05], [W / 2 - 0.4 + s, 0.55, D / 2 + 0.08], 0.018, C.chrome); }
  return b.done([W + 0.5, D + 0.5], [{ x: -W * 0.2, z: 0, y: -0.75, face: 0.6, pose: 'wade' }, { x: W * 0.2, z: -D * 0.15, y: -0.75, face: -0.8, pose: 'wade' }]); };
// --- party / nightlife
K.dj_booth = (o) => { const b = new B(); b.box(1.8, 1.0, 0.7, '#1c1c22', 0, 0, 0, 0.03); b.box(1.8, 0.06, 0.03, mat(o.color || '#00e5ff', { e: o.color || '#00e5ff', ei: 1.5 }), 0, 0.6, 0.36, 0.01).userData.noShadow = true; b.box(1.9, 0.05, 0.75, '#2a2a33', 0, 1.0, 0, 0.02);
  for (const x of [-0.5, 0.5]) { b.box(0.45, 0.06, 0.4, C.dark, x, 1.05, 0, 0.02); b.cyl(0.16, 0.16, 0.02, C.black, x, 1.11, 0, 18); b.cyl(0.04, 0.04, 0.025, mat('#e63946', { e: '#e63946', ei: 0.5 }), x, 1.12, 0, 8); } b.box(0.3, 0.07, 0.35, C.black, 0, 1.05, 0, 0.02); b.box(0.32, 0.02, 0.22, '#9aa1a8', 0.0, 1.13, -0.2, 0.01);
  signPanel(b, o.label || 'DJ', '#1c1c22', '#ff4fa3', 0.8, 0.25, 0, 0.3, 0.37); return b.done([1.9, 0.75], [{ x: 0, z: -0.65, face: 0, pose: 'work' }]); };
K.dance_floor = (o) => { const b = new B(); const W = o.arg || 3, D = o.arg2 || 3; const cols = ['#ff4fa3', '#7a3cff', '#00e5ff', '#ffd23f']; const s = 0.75; for (let i = 0; i < Math.round(W / s); i++) for (let j = 0; j < Math.round(D / s); j++) { const c = cols[(i * 3 + j * 2) % 4]; b.box(s - 0.04, 0.03, s - 0.04, mat(c, { e: c, ei: 0.55, r: 0.3 }), -W / 2 + s * (i + 0.5), 0, -D / 2 + s * (j + 0.5), 0.005).userData.noShadow = true; }
  b.box(W + 0.06, 0.02, D + 0.06, '#111', 0, 0, 0, 0.005); return b.done([W, D], [U.stand(-0.4, 0.2, PI * 0.75), U.stand(0.5, -0.3, PI * 1.2), U.stand(0.3, 0.7, PI), U.stand(-0.6, -0.6, PI * 0.5)], { walkable: true }); };
K.bottle_table = (o) => { const b = new B(); b.cyl(0.3, 0.3, 0.04, mat('#1c1c22', { r: 0.3 }), 0, 1.0, 0, 18); b.cyl(0.04, 0.04, 1.0, C.chrome, 0, 0, 0, 8); b.cyl(0.25, 0.25, 0.03, C.chrome, 0, 0, 0, 14); b.cyl(0.12, 0.1, 0.18, mat(C.chrome, { m: 0.7, r: 0.25 }), 0, 1.04, 0, 12); bottle(b, 0.03, 1.1, 0, '#c49a2c', 0.3); bottle(b, -0.18, 1.04, 0.1, '#2a7d2e', 0.3);
  b.cyl(0.006, 0.006, 0.15, C.chrome, 0.03, 1.4, 0, 4); b.sph(0.05, mat('#fff3b0', { e: '#ffd23f', ei: 2 }), 0.03, 1.56, 0); return b.done([0.6, 0.6], [U.stand(0, 0.55)]); };
K.disco_ball = (o) => { const b = new B(); b.cyl(0.006, 0.006, 0.4, C.chrome, 0, 2.3, 0, 4); b.add(IC(0.22, 1), mat('#d6dadf', { m: 0.9, r: 0.15, flat: true, e: '#7a3cff', ei: 0.15 }), 0, 2.15, 0); return b.done([0.1, 0.1], [U.stand(0, 0.5)], { walkable: true }); };
K.mic_stand = (o) => { const b = new B(); b.cyl(0.15, 0.15, 0.03, C.dark, 0, 0, 0, 12); b.cyl(0.012, 0.012, 1.45, C.dark, 0, 0.03, 0, 6); b.bar([0, 1.45, 0], [0, 1.55, 0.15], 0.01, C.dark); b.cc(0.025, 0.02, 0.12, C.black, 0, 1.58, 0.2, 0.9); return b.done([0.32, 0.32], [{ x: 0, z: 0.45, face: PI, pose: 'work' }]); };
K.radio_desk = (o) => { const b = new B(); const c = o.color || '#2a2d34'; b.box(2.2, 0.06, 1.0, c, 0, 0.74, 0, 0.03); b.box(2.0, 0.74, 0.1, shade(c, -0.2), 0, 0, -0.1, 0.02); b.box(0.7, 0.06, 0.45, '#191b20', 0, 0.8, -0.15, 0.02); for (let i = 0; i < 8; i++) b.box(0.03, 0.02, 0.06, mat(i % 3 ? '#e9e9e9' : '#ff4f4f', { e: i % 3 ? '#000' : '#ff4f4f' }), -0.28 + i * 0.08, 0.86, -0.15, 0.005);
  for (const [x, z, f] of [[-0.6, -0.3, 0.6], [0.6, -0.3, 0.6], [0, 0.35, -0.6]]) { b.bar([x, 0.8, z], [x, 1.1, z + f * 0.1], 0.012, C.dark); b.bar([x, 1.1, z + f * 0.1], [x, 1.12, z + f * 0.35], 0.012, C.dark); b.cc(0.045, 0.04, 0.16, C.black, x, 1.13, z + f * 0.42, HP); }
  for (const x of [-0.85, 0.85]) { b.box(0.45, 0.32, 0.03, C.black, x, 0.8, -0.38, 0.01); b.plane(0.4, 0.26, mat('#000', { map: T.screen('news'), e: '#fff', ei: 0.6 }), x, 0.96, -0.364).userData.noShadow = true; }
  b.add(TO(0.08, 0.015, 12, PI), C.black, -0.6, 0.85, 0.05, 0, 0, 0); signPanel(b, o.label || 'ON AIR', '#c8102e', '#ffffff', 0.6, 0.2, 0, 0.45, -0.04);
  const ch = (x, z, ry) => { const g = new B(); g.cyl(0.25, 0.25, 0.04, C.dark, 0, 0.02, 0, 5); g.cyl(0.03, 0.03, 0.38, C.chrome, 0, 0.04, 0, 8); g.box(0.48, 0.08, 0.46, '#c8102e', 0, 0.4, 0, 0.04); g.bc(0.44, 0.5, 0.07, '#c8102e', 0, 0.78, -0.22, -0.1, 0, 0, 0.04); attach(b, g, x, z, ry); };
  ch(-0.6, -0.85, 0); ch(0.6, -0.85, 0); ch(0, 0.9, PI);
  return b.done([2.3, 2.3], [U.sit(-0.6, -0.82, 0.49, 0, 'type'), U.sit(0.6, -0.82, 0.49, 0, 'type'), U.sit(0, 0.87, 0.49, PI, 'type')]); };
// --- civic / funeral / transport
K.coffin = (o) => { const b = new B(); const c = o.color || '#f7f1e3'; b.box(1.0, 0.5, 2.2, '#4a3324', 0, 0, 0, 0.02); b.box(1.04, 0.1, 2.24, mat('#fff', { map: T.kente(0) }), 0, 0.42, 0, 0.01); const sh = new THREE.Shape(); sh.moveTo(-0.3, -1.0); sh.lineTo(0.3, -1.0); sh.lineTo(0.38, 0.55); sh.lineTo(0.25, 1.0); sh.lineTo(-0.25, 1.0); sh.lineTo(-0.38, 0.55); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }); g.rotateX(-HP); b.add(g, mat(c, { r: 0.35 }), 0, 0.52, 0); b.box(0.66, 0.03, 1.7, mat(C.gold, { m: 0.6, r: 0.3 }), 0, 0.96, 0.05, 0.01); b.box(0.08, 0.02, 0.5, mat(C.gold, { m: 0.6, r: 0.3 }), 0, 0.98, -0.3, 0.005); b.box(0.3, 0.02, 0.08, mat(C.gold, { m: 0.6, r: 0.3 }), 0, 0.98, -0.42, 0.005);
  for (const [x, z] of [[-0.55, -1.0], [0.55, -1.0], [-0.55, 1.0], [0.55, 1.0]]) { b.cyl(0.15, 0.12, 0.25, '#f7f1e3', x, 0, z, 10); leafClump(b, x, 0.4, z, 0.55, pick(['#e63946', '#f2f2f2', '#f2c230'])); }
  return b.done([1.3, 2.4], [U.stand(0.9, 0.2, -HP), U.stand(-0.9, 0.2, HP)]); };
K.portrait_stand = (o) => { const b = new B(); b.bar([0, 0, -0.2], [0, 1.6, 0], 0.02, C.woodD); b.bar([-0.3, 0, 0.2], [0, 1.6, 0], 0.02, C.woodD); b.bar([0.3, 0, 0.2], [0, 1.6, 0], 0.02, C.woodD); b.box(0.7, 0.9, 0.04, C.gold, 0, 0.95, 0.12, 0.01); b.box(0.6, 0.8, 0.02, '#2b2b2b', 0, 1.0, 0.145, 0.005);
  b.sph(0.13, '#5a3524', 0, 1.5, 0.16, 1, 1.2, 0.3); b.box(0.36, 0.3, 0.02, '#141414', 0, 1.06, 0.16, 0.05); b.box(0.4, 0.08, 0.01, mat('#fff', { map: T.text('REST IN PEACE', '#141414', '#fcd116', 256, 64) }), 0, 1.0, 0.165); return b.done([0.7, 0.45], [U.stand(0, 0.7)]); };
K.trotro = (o) => {
  const b = new B(); const c = o.color || '#f4f1ea'; const L = 4.8, W = 2.0;
  const stripeCol = o.stripe || '#f59e0b'; const plateText = o.plate || 'GR 4821 - 24';
  const sloganText = o.label || o.slogan || 'NYAME NHYIRA'; const destText = o.dest || 'CIRCLE · MADINA';

  // 1. Lower chassis & wheels (commercial 16-inch steel rims with rubber tyres)
  b.box(L - 0.4, 0.22, W - 0.2, '#1a1c20', 0, 0.18, 0, 0.04);
  for (const [x, z] of [[1.48, 1], [1.48, -1], [-1.52, 1], [-1.52, -1]]) {
    b.cc(0.38, 0.38, 0.26, '#181a1d', x, 0.38, z * (W / 2 - 0.1), HP, 0, 0, 16);
    b.cc(0.22, 0.22, 0.27, '#94a3b8', x, 0.38, z * (W / 2 - 0.1), HP, 0, 0, 12);
    b.cc(0.08, 0.08, 0.28, '#24272b', x, 0.38, z * (W / 2 - 0.1), HP, 0, 0, 8);
  }
  // Rear mudflaps with Ghana flag colors
  for (const s of [-1, 1]) {
    b.box(0.04, 0.28, 0.3, mat('#1e293b'), -1.95, 0.22, s * (W / 2 - 0.1), 0.01);
    b.box(0.045, 0.06, 0.26, mat('#dc2626'), -1.95, 0.32, s * (W / 2 - 0.1), 0.005);
    b.box(0.045, 0.06, 0.26, mat('#facc15'), -1.95, 0.24, s * (W / 2 - 0.1), 0.005);
    b.box(0.045, 0.06, 0.26, mat('#16a34a'), -1.95, 0.16, s * (W / 2 - 0.1), 0.005);
  }

  // 2. Main Body & Classic 207 / Sprinter Cab
  b.box(L, 0.65, W, mat(c, { r: 0.5 }), 0, 0.35, 0, 0.16);
  b.box(L + 0.02, 0.34, W + 0.02, mat(stripeCol, { r: 0.55 }), 0, 0.62, 0, 0.08);
  b.box(L + 0.03, 0.07, W + 0.03, mat('#dc2626'), 0, 0.98, 0, 0.02);
  b.box(L - 0.1, 0.95, W - 0.06, mat(c, { r: 0.5 }), -0.15, 1.0, 0, 0.14);

  // Front sloped bonnet (Mercedes 207/307 style)
  b.bc(0.9, 0.48, W - 0.16, mat(c, { r: 0.5 }), 1.85, 0.72, 0, 0, 0, -0.15, 0.12);
  b.box(0.04, 0.32, 0.92, '#18181b', L / 2 + 0.01, 0.68, 0, 0.02);
  for (let g = 0; g < 3; g++) b.box(0.045, 0.025, 0.82, C.chrome, L / 2 + 0.015, 0.6 + g * 0.08, 0, 0.005);
  b.cyl(0.06, 0.06, 0.05, C.chrome, L / 2 + 0.02, 0.68, 0, 8, null, HP);

  // Headlights & indicators
  for (const s of [-1, 1]) {
    b.box(0.04, 0.18, 0.26, mat('#fffbeb', { e: '#fef3c7', ei: 1.1 }), L / 2 + 0.01, 0.68, s * 0.68, 0.02);
    b.box(0.045, 0.18, 0.1, mat('#f97316', { e: '#ea580c', ei: 0.9 }), L / 2 + 0.01, 0.68, s * 0.84, 0.015);
  }
  b.box(0.14, 0.22, W + 0.06, '#27272a', L / 2 + 0.03, 0.36, 0, 0.04);
  for (const s of [-1, 1]) b.box(0.16, 0.26, 0.14, '#18181b', L / 2 + 0.04, 0.36, s * 0.55, 0.02);

  // Ghanaian Commercial Yellow Plates
  signPanel(b, plateText, '#f59e0b', '#111827', 0.56, 0.15, L / 2 + 0.11, 0.36, 0, HP);
  signPanel(b, plateText, '#f59e0b', '#111827', 0.56, 0.15, -L / 2 - 0.08, 0.38, 0, -HP);

  // Windows & Glazing
  const gl = mat('#1e293b', { r: 0.15, m: 0.4 });
  b.bc(0.04, 0.68, W - 0.26, gl, 1.48, 1.42, 0, 0, 0, 0.36, 0.04);
  b.bar([1.52, 1.18, -0.3], [1.46, 1.55, -0.1], 0.015, '#18181b');
  b.bar([1.52, 1.18, 0.2], [1.46, 1.55, 0.4], 0.015, '#18181b');
  b.box(0.04, 0.58, W - 0.35, gl, -L / 2 + 0.02, 1.35, 0, 0.03);
  for (let i = 0; i < 4; i++) b.box(0.82, 0.54, 0.03, gl, -1.65 + i * 0.94, 1.35, -W / 2 - 0.005, 0.02);
  for (let i = 0; i < 3; i++) b.box(0.82, 0.54, 0.03, gl, -1.65 + i * 0.94, 1.35, W / 2 + 0.005, 0.02);

  // 3. Side Sliding Door & Trotro Mate Perch
  b.box(1.02, 1.32, 0.06, '#18181b', 0.72, 0.42, W / 2 - 0.02, 0.02);
  b.box(0.85, 0.12, 0.65, '#334155', 0.72, 0.68, W / 2 - 0.45, 0.03);
  b.box(0.85, 0.45, 0.1, '#334155', 0.72, 0.92, W / 2 - 0.72, 0.03);
  b.bar([1.2, 0.45, W / 2 + 0.03], [1.2, 1.65, W / 2 + 0.03], 0.02, '#94a3b8');
  b.bar([0.22, 0.45, W / 2 + 0.03], [0.22, 1.65, W / 2 + 0.03], 0.02, '#94a3b8');
  b.box(0.95, 0.06, 0.22, '#27272a', 0.72, 0.32, W / 2 + 0.08, 0.015);

  // Side mirrors
  for (const s of [-1, 1]) {
    b.bar([1.4, 1.25, s * (W / 2 - 0.02)], [1.4, 1.25, s * (W / 2 + 0.22)], 0.016, '#18181b');
    b.box(0.08, 0.28, 0.14, '#18181b', 1.4, 1.25, s * (W / 2 + 0.24), 0.02);
    b.box(0.02, 0.24, 0.11, C.chrome, 1.37, 1.25, s * (W / 2 + 0.24), 0.01);
  }

  // 4. Rear Safety & Ghanaian Road Regulations
  b.box(0.14, 0.22, W + 0.04, '#27272a', -L / 2 - 0.03, 0.36, 0, 0.03);
  b.plane(W - 0.2, 0.12, mat('#fff', { map: T.chevron() }), -L / 2 - 0.11, 0.48, 0, -HP, 0);
  for (const s of [-1, 1]) {
    b.box(0.04, 0.34, 0.12, mat('#dc2626', { e: '#b91c1c', ei: 0.8 }), -L / 2 - 0.02, 0.95, s * 0.86, 0.02);
    b.box(0.045, 0.1, 0.12, mat('#f97316', { e: '#ea580c', ei: 0.8 }), -L / 2 - 0.02, 0.82, s * 0.86, 0.015);
  }

  // 5. Authentic Slogans & Destination Boards
  signPanel(b, sloganText, '#18181b', '#facc15', 1.45, 0.24, -L / 2 - 0.01, 1.35, 0, -HP);
  signPanel(b, destText, '#18181b', '#facc15', 1.35, 0.22, 1.48, 1.88, 0, HP);
  signPanel(b, sloganText, stripeCol, '#18181b', 1.9, 0.22, -0.65, 0.62, W / 2 + 0.025);
  signPanel(b, sloganText, stripeCol, '#18181b', 1.9, 0.22, -0.65, 0.62, -W / 2 - 0.025, PI);

  // 6. Heavy-Duty Steel Roof Rack & Loaded Accra Luggage
  const rk = mat('#334155', { m: 0.6, r: 0.4 });
  for (const s of [-1, 1]) b.bar([-2.0, 2.06, s * 0.85], [1.3, 2.06, s * 0.85], 0.024, rk);
  for (let i = 0; i < 6; i++) b.bar([-1.9 + i * 0.64, 2.06, -0.85], [-1.9 + i * 0.64, 2.06, 0.85], 0.018, rk);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.bar([-1.8 + i * 1.0, 1.95, s * 0.85], [-1.8 + i * 1.0, 2.06, s * 0.85], 0.02, rk);
  b.box(0.75, 0.38, 0.65, mat('#d97706', { r: 0.9 }), -1.2, 2.15, 0.15, 0.08);
  b.box(0.65, 0.32, 0.55, mat('#b45309', { r: 0.9 }), -1.4, 2.15, -0.35, 0.07);
  b.box(0.62, 0.36, 0.58, mat('#fff', { map: T.wax('#dc2626', '#facc15', '#2563eb') }), -0.4, 2.16, 0.2, 0.06);
  b.box(0.85, 0.26, 0.72, mat('#2563eb', { r: 0.7 }), 0.5, 2.14, -0.1, 0.08);
  b.cc(0.36, 0.36, 0.22, '#181a1d', 0.4, 2.14, 0.42, 0, 0, 0, 14);
  b.cc(0.2, 0.2, 0.23, '#94a3b8', 0.4, 2.14, 0.42, 0, 0, 0, 10);
  b.bar([-1.6, 2.38, -0.85], [-1.0, 2.38, 0.85], 0.012, '#facc15');
  b.bar([-0.6, 2.38, -0.85], [-0.2, 2.38, 0.85], 0.012, '#dc2626');
  b.bar([0.2, 2.32, -0.85], [0.8, 2.32, 0.85], 0.012, '#16a34a');

  return b.done([L, W], [{ x: 0.72, z: W / 2 + 0.52, face: PI, pose: 'stand' }, { x: -0.5, z: W / 2 + 0.55, face: PI, pose: 'cheer' }]);
};

K.taxi = (o) => {
  const b = new B(); const L = 3.95, W = 1.76;
  const bodyCol = o.color || '#f4f4f2'; const fenderCol = '#f59e0b'; const plateText = o.plate || 'GW 1928 - 25';
  const bm = mat(bodyCol, { r: 0.35, m: 0.3 }), fm = mat(fenderCol, { r: 0.35, m: 0.3 }), gl = mat('#1e293b', { r: 0.15, m: 0.4 });

  b.box(L - 0.3, 0.2, W - 0.2, '#18181b', 0, 0.16, 0, 0.03);
  for (const [x, z] of [[1.22, 1], [1.22, -1], [-1.22, 1], [-1.22, -1]]) {
    b.cc(0.33, 0.33, 0.24, '#18181b', x, 0.33, z * (W / 2 - 0.08), HP, 0, 0, 16);
    b.cc(0.18, 0.18, 0.25, C.chrome, x, 0.33, z * (W / 2 - 0.08), HP, 0, 0, 10);
    b.cc(0.06, 0.06, 0.26, '#18181b', x, 0.33, z * (W / 2 - 0.08), HP, 0, 0, 6);
  }
  b.box(2.2, 0.58, W, bm, -0.05, 0.26, 0, 0.16);
  b.bc(1.9, 0.54, W - 0.14, bm, -0.22, 1.08, 0, 0, 0, 0, 0.18);
  b.box(0.95, 0.56, W, fm, 1.45, 0.26, 0, 0.18);
  b.box(0.9, 0.08, W - 0.24, bm, 1.42, 0.78, 0, 0.06);
  b.box(0.95, 0.56, W, fm, -1.45, 0.26, 0, 0.18);
  b.box(0.85, 0.08, W - 0.24, bm, -1.42, 0.78, 0, 0.06);

  b.bc(0.04, 0.46, W - 0.28, gl, 0.78, 1.06, 0, 0, 0, 0.52, 0.02);
  b.bc(0.04, 0.42, W - 0.28, gl, -1.22, 1.06, 0, 0, 0, -0.45, 0.02);
  for (const s of [-1, 1]) {
    b.box(0.78, 0.38, 0.02, gl, 0.2, 0.9, s * (W / 2 - 0.055), 0.02);
    b.box(0.72, 0.38, 0.02, gl, -0.68, 0.9, s * (W / 2 - 0.055), 0.02);
    b.plane(0.24, 0.24, mat('#fff', { map: T.taxiBadge() }), -0.15, 0.58, s * (W / 2 + 0.01), s > 0 ? 0 : PI);
    b.box(0.12, 0.03, 0.02, C.chrome, -0.18, 0.72, s * (W / 2 + 0.01), 0.005);
    b.box(0.12, 0.03, 0.02, C.chrome, 0.32, 0.72, s * (W / 2 + 0.01), 0.005);
    b.box(0.06, 0.08, 0.12, '#18181b', 0.65, 0.88, s * (W / 2 + 0.08), 0.01);
  }
  b.box(0.04, 0.18, 0.68, '#18181b', L / 2 + 0.01, 0.54, 0, 0.01);
  b.cyl(0.04, 0.04, 0.05, C.chrome, L / 2 + 0.015, 0.54, 0, 8, null, HP);
  for (const s of [-1, 1]) {
    b.box(0.04, 0.12, 0.28, mat('#fffbeb', { e: '#fef3c7', ei: 1.2 }), L / 2 + 0.01, 0.62, s * 0.62, 0.02);
    b.box(0.04, 0.12, 0.26, mat('#dc2626', { e: '#b91c1c', ei: 0.8 }), -L / 2 - 0.01, 0.64, s * 0.62, 0.02);
  }
  b.box(0.1, 0.14, W + 0.02, '#27272a', L / 2 + 0.02, 0.34, 0, 0.02);
  b.box(0.1, 0.14, W + 0.02, '#27272a', -L / 2 - 0.02, 0.34, 0, 0.02);
  signPanel(b, plateText, '#f59e0b', '#111827', 0.48, 0.13, L / 2 + 0.08, 0.34, 0, HP);
  signPanel(b, plateText, '#f59e0b', '#111827', 0.48, 0.13, -L / 2 - 0.08, 0.34, 0, -HP);

  // Illuminated Taxi Roof Sign
  b.box(0.52, 0.16, 0.24, mat('#f59e0b', { e: '#f59e0b', ei: 0.6, r: 0.3 }), -0.15, 1.42, 0, 0.04);
  signPanel(b, 'TAXI', '#f59e0b', '#111827', 0.42, 0.12, -0.15, 1.42, 0.125);
  signPanel(b, 'TAXI', '#f59e0b', '#111827', 0.42, 0.12, -0.15, 1.42, -0.125, PI);

  return b.done([L, W], [{ x: 0.1, z: W / 2 + 0.45, face: PI, pose: 'stand' }]);
};

K.car_display = (o) => {
  const b = new B(); const c = o.color || '#c8102e'; const L = 4.0, W = 1.78;
  const bm = mat(c, { r: 0.3, m: 0.35 }); const gl = mat('#1e293b', { r: 0.15, m: 0.4 });
  b.box(L, 0.6, W, bm, 0, 0.25, 0, 0.22);
  b.bc(2.0, 0.55, W - 0.12, bm, -0.25, 1.1, 0, 0, 0, 0, 0.2);
  b.bc(0.04, 0.45, W - 0.3, gl, 0.77, 1.08, 0, 0, 0, 0.55);
  b.bc(0.04, 0.42, W - 0.3, gl, -1.26, 1.08, 0, 0, 0, -0.45);
  for (const s of [-1, 1]) {
    b.box(0.8, 0.38, 0.02, gl, 0.2, 0.9, s * (W / 2 - 0.055), 0.02);
    b.box(0.75, 0.38, 0.02, gl, -0.7, 0.9, s * (W / 2 - 0.055), 0.02);
    b.box(0.06, 0.08, 0.12, '#18181b', 0.68, 0.88, s * (W / 2 + 0.08), 0.01);
  }
  for (const [x, z] of [[1.22, 1], [1.22, -1], [-1.25, 1], [-1.25, -1]]) {
    b.cc(0.33, 0.33, 0.24, '#18181b', x, 0.33, z * (W / 2 - 0.08), HP, 0, 0, 16);
    b.cc(0.2, 0.2, 0.25, C.chrome, x, 0.33, z * (W / 2 - 0.08), HP, 0, 0, 10);
  }
  for (const s of [-1, 1]) {
    b.box(0.04, 0.12, 0.3, mat('#fffbeb', { e: '#fef3c7', ei: 1.2 }), L / 2 + 0.01, 0.62, s * 0.6, 0.02);
    b.box(0.04, 0.12, 0.28, mat('#dc2626', { e: '#b91c1c', ei: 0.8 }), -L / 2 - 0.01, 0.65, s * 0.6, 0.02);
  }
  b.box(0.05, 0.12, 0.6, '#d9d9d9', L / 2 + 0.02, 0.33, 0, 0.02);
  signPanel(b, o.plate || 'GR 2026 - 24', '#ffffff', '#111827', 0.48, 0.13, L / 2 + 0.08, 0.33, 0, HP);
  signPanel(b, o.plate || 'GR 2026 - 24', '#ffffff', '#111827', 0.48, 0.13, -L / 2 - 0.08, 0.33, 0, -HP);
  return b.done([L, W], [{ x: 0.1, z: W / 2 + 0.45, face: PI, pose: 'stand' }]);
};
K.traffic_cone = (o) => { const b = new B(); b.box(0.36, 0.04, 0.36, '#e85d04', 0, 0, 0, 0.01); b.cyl(0.03, 0.15, 0.62, '#f77f00', 0, 0.04, 0, 12); b.cyl(0.075, 0.105, 0.12, C.white, 0, 0.3, 0, 12); return b.done([0.36, 0.36], [U.stand(0, 0.45)]); };
K.pure_water = (o) => { const b = new B(); b.cyl(0.42, 0.32, 0.18, mat('#c9ccd0', { m: 0.5, r: 0.35 }), 0, 0.42, 0, 16); b.cyl(0.24, 0.22, 0.42, C.woodL, 0, 0, 0, 10); seed(31); const sm = mat('#fff', { map: T.stripes(['#e8f4ff', '#e8f4ff', '#1d6fd1'], 6, false), r: 0.3 }); for (let i = 0; i < 16; i++) { const a = rnd() * PI * 2, r = rnd() * 0.3; b.add(RB(0.14, 0.04, 0.2, 0.018), sm, Math.cos(a) * r, 0.62 + (0.3 - r) * 0.5 + rnd() * 0.05, Math.sin(a) * r, rnd() * 0.5, rnd() * 3, rnd() * 0.5); }
  for (let i = 0; i < 4; i++) b.box(0.42, 0.22, 0.3, mat('#e8f4ff', { r: 0.4 }), 0.55, i * 0.22, (i % 2) * 0.05 - 0.1, 0.04); return b.done([1.0, 0.85], [U.stand(0, 0.7)]); };
K.ice_cart = (o) => { const b = new B(); b.box(0.9, 0.6, 0.6, C.white, 0, 0.45, 0, 0.06); b.box(0.92, 0.12, 0.62, mat(o.color || '#2f6fd1'), 0, 0.6, 0, 0.02); b.box(0.5, 0.3, 0.01, mat('#fff', { map: T.text('ICE CREAM', '#ffffff', '#2f6fd1', 256, 128) }), 0, 0.63, 0.305, 0.005); for (const s of [-1, 1]) { b.cc(0.25, 0.25, 0.05, C.black, -0.35, 0.25, s * 0.36, HP, 0, 0, 16); b.cc(0.18, 0.18, 0.055, C.chrome, -0.35, 0.25, s * 0.36, HP, 0, 0, 10); }
  b.cc(0.25, 0.25, 0.05, C.black, 0.85, 0.25, 0, HP, 0, 0, 16); b.bar([0.45, 0.6, 0], [0.85, 0.25, 0], 0.02, C.dark); b.bar([0.85, 0.25, 0], [0.75, 1.0, 0], 0.02, C.dark); b.box(0.06, 0.04, 0.5, C.dark, 0.72, 1.0, 0, 0.01); b.box(0.25, 0.05, 0.14, C.black, 0.6, 0.85, 0, 0.02);
  b.cyl(0.02, 0.02, 1.5, C.chrome, -0.3, 1.05, 0, 6); b.add(CY(0.03, 0.75, 0.3, 12, true), mat('#fff', { map: T.stripes(['#2f6fd1', '#ffffff'], 12, true), side: true }), -0.3, 2.45, 0); return b.done([1.3, 0.75], [U.stand(0, 0.7)]); };
K.sign_post = (o) => { const b = new B(); b.cyl(0.04, 0.04, 2.2, '#4a4f55', 0, 0, 0, 8); signPanel(b, o.label || 'ACCRA', o.color || C.gGreen, '#ffffff', 1.3, 0.42, 0, 2.0, 0.05); return b.done([0.3, 0.3], [U.stand(0, 0.5)]); };
K.board_sign = (o) => { const b = new B(); const W = o.arg || 2.4; for (const s of [-1, 1]) b.cyl(0.05, 0.05, 2.6, '#4a4f55', s * W * 0.4, 0, 0, 8); signPanel(b, o.label || 'WELCOME', o.color || '#1d6f42', o.fg || '#ffffff', W, W * 0.28, 0, 2.25, 0.06); return b.done([W, 0.2], [U.stand(0, 0.5)]); };
K.departure_board = (o) => { const b = new B(); b.box(1.9, 1.2, 0.12, C.dark, 0, 1.3, 0.06, 0.03); b.plane(1.8, 1.1, mat('#000', { map: T.screen('board'), e: '#fff', ei: 0.9 }), 0, 1.9, 0.125).userData.noShadow = true; b.cyl(0.04, 0.04, 1.3, C.dark, 0, 0, 0.06, 8); b.box(0.5, 0.04, 0.4, C.dark, 0, 0, 0.06, 0.01); return b.done([1.9, 0.45], [U.stand(0, 0.8)]); };
K.runway_window = (o) => { const b = new B(); const W = o.arg || 4; b.box(W + 0.1, 2.3, 0.1, C.dark, 0, 0.1, 0.05, 0.01); b.plane(W, 2.1, mat('#fff', { map: T.screen('runway'), e: '#ffffff', ei: 0.55 }), 0, 1.25, 0.105).userData.noShadow = true; for (let i = 1; i < 4; i++) b.box(0.05, 2.1, 0.04, C.dark, -W / 2 + (W / 4) * i, 0.2, 0.12, 0.005); return b.done([W, 0.2], [U.stand(0, 0.9)], { walkable: true }); };
K.luggage_carousel = (o) => {
  const b = new B(); const L = o.arg || 3.2, W = o.arg2 || 1.8;
  const steel = mat('#9ca3af', { r: 0.25, m: 0.75 }); const belt = mat('#1f2937', { r: 0.85 });
  b.box(L, 0.22, W, steel, 0, 0, 0, 0.08); b.box(L - 0.24, 0.08, W - 0.24, belt, 0, 0.22, 0, 0.06); b.box(L - 0.9, 0.35, W - 0.9, steel, 0, 0.22, 0, 0.04);
  const colors = ['#b91c1c', '#1d4ed8', '#047857', '#d97706', '#475569'];
  const bags = [[-L / 2 + 0.45, 0.3, -W / 2 + 0.35, 0.15, colors[0]], [0.1, 0.3, -W / 2 + 0.32, -0.1, colors[1]], [L / 2 - 0.45, 0.3, -W / 2 + 0.36, 0.2, colors[2]], [L / 2 - 0.38, 0.3, W / 2 - 0.34, -0.25, colors[3]], [-0.2, 0.3, W / 2 - 0.33, 0.05, colors[4]], [-L / 2 + 0.42, 0.3, W / 2 - 0.35, -0.18, colors[0]]];
  for (const [x, y, z, rot, col] of bags) { b.bc(0.42, 0.22, 0.3, mat(col, { r: 0.4 }), x, y, z, 0, rot, 0, 0.04); b.bc(0.12, 0.02, 0.03, '#111827', x, y + 0.12, z, 0, rot, 0, 0.01); }
  b.cyl(0.025, 0.025, 1.4, steel, 0, 0.55, 0, 8); b.box(0.85, 0.34, 0.06, '#1e3a8a', 0, 1.85, 0, 0.02);
  signPanel(b, o.label || 'BAGGAGE CLAIM\nCAROUSEL 2', '#1e3a8a', '#ffffff', 0.8, 0.3, 0, 1.85, 0.035);
  signPanel(b, o.label || 'BAGGAGE CLAIM\nCAROUSEL 2', '#1e3a8a', '#ffffff', 0.8, 0.3, 0, 1.85, -0.035, PI);
  return b.done([L, W], [U.stand(0, W / 2 + 0.5)]);
};
K.metal_detector = (o) => {
  const b = new B(); const c = o.color || '#475569'; const postM = mat(c, { r: 0.4, m: 0.3 });
  for (const sx of [-0.45, 0.45]) { b.box(0.14, 2.2, 0.55, postM, sx, 0, 0, 0.02); b.box(0.22, 0.03, 0.62, '#1e293b', sx, 0, 0, 0.01); b.box(0.02, 1.8, 0.4, '#0f172a', sx > 0 ? sx - 0.06 : sx + 0.06, 0.2, 0, 0.005); }
  b.box(1.04, 0.22, 0.55, postM, 0, 2.2, 0, 0.02); b.box(0.08, 0.08, 0.02, mat('#22c55e', { e: '#22c55e', ei: 1.2 }), 0, 2.25, 0.28, 0.01); b.box(0.08, 0.08, 0.02, mat('#22c55e', { e: '#22c55e', ei: 1.2 }), 0, 2.25, -0.28, 0.01);
  signPanel(b, 'SECURITY', '#0f172a', '#38bdf8', 0.45, 0.12, 0, 2.25, 0.285);
  return b.done([1.04, 0.55], [{ x: 0, z: 0.6, face: PI, pose: 'stand' }], { walkable: true });
};
K.duty_free = (o) => {
  const b = new B(); const W = o.arg || 2.2; const wood = mat('#1e293b', { r: 0.3 });
  b.box(W, 2.2, 0.45, wood, 0, 0, 0, 0.03); b.box(W, 0.3, 0.48, '#0f172a', 0, 2.2, 0, 0.01);
  signPanel(b, 'DUTY FREE · ACCRA', '#0f172a', '#fbbf24', W - 0.2, 0.22, 0, 2.2, 0.245);
  const cols = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6'];
  for (let s = 0; s < 3; s++) {
    const y = 0.5 + s * 0.55; b.box(W - 0.1, 0.03, 0.38, '#334155', 0, y, 0.02, 0.005);
    for (let i = 0; i < 7; i++) {
      const x = -W / 2 + 0.25 + i * (W - 0.5) / 6;
      b.box(0.12, 0.22, 0.12, mat(cols[(s + i) % cols.length], { r: 0.2, m: 0.4 }), x, y + 0.03, 0.02, 0.02);
      b.cyl(0.025, 0.025, 0.06, C.gold, x, y + 0.25, 0.02, 8);
    }
  }
  return b.done([W, 0.45], [U.stand(0, 0.7)]);
};
K.voting_booth = (o) => { const b = new B(); b.box(0.9, 0.04, 0.6, '#c8c2b4', 0, 0.9, 0, 0.01); for (const sx of [-1, 1]) { b.box(0.03, 0.9, 0.03, C.chrome, sx * 0.42, 0, -0.25); b.box(0.03, 0.9, 0.03, C.chrome, sx * 0.42, 0, 0.25); b.box(0.02, 0.6, 0.6, '#d9d9d9', sx * 0.45, 0.94, 0, 0.005); } b.box(0.9, 0.6, 0.02, '#d9d9d9', 0, 0.94, -0.3, 0.005); b.box(0.5, 0.15, 0.02, mat('#fff', { map: T.text('VOTE', '#1d4ed8', '#fff', 256, 64) }), 0, 1.4, -0.28, 0.003);
  return b.done([0.95, 0.65], [U.work(0, 0.55)]); };
K.ballot_box = (o) => { const b = new B(); b.box(0.9, 0.7, 0.6, C.woodL, 0, 0, 0, 0.02); b.box(0.5, 0.45, 0.45, mat(C.glass, { op: 0.5, r: 0.1 }), 0, 0.7, 0, 0.02).userData.noShadow = true; b.box(0.25, 0.01, 0.03, C.black, 0, 1.16, 0); pile(b, 0, 0.72, 0, 0.1, '#ffffff', 5, 0.05); return b.done([0.95, 0.65], [U.work(0, 0.6)]); };
K.flower_bed = (o) => { const b = new B(); const L = o.arg || 2; b.box(L, 0.25, 0.6, '#cfc6b2', 0, 0, 0, 0.02); b.box(L - 0.1, 0.03, 0.5, '#5b3a24', 0, 0.24, 0, 0.005); seed(L * 11); for (let x = -L / 2 + 0.2; x < L / 2 - 0.1; x += 0.3) leafClump(b, x, 0.45, (rnd() - 0.5) * 0.15, 0.6, pick(['#e86a92', '#f2c230', '#e63946', '#4aa651'])); return b.done([L, 0.6], [U.stand(0, 0.6)]); };
K.palmwine_stand = (o) => { const b = new B(); const tb = mat(C.woodD); tableTop(b, 1.1, 0.6, 0.75, tb, tb); b.cyl(0.18, 0.12, 0.35, mat('#e9e2d0', { op: 0.85 }), -0.3, 0.75, 0, 12); b.cyl(0.16, 0.16, 0.01, '#f3efe5', -0.3, 1.08, 0, 12); for (let i = 0; i < 3; i++) { b.add(SP(0.1, 10, 6, ), mat('#b07a3c'), 0.1 + i * 0.16, 0.8, 0.1, 0, 0, 0, 1, 0.5, 1); } b.sph(0.22, mat('#a0682f'), 0.75, 0.22, 0.2, 1, 1.1, 1); b.cyl(0.05, 0.07, 0.2, '#a0682f', 0.75, 0.44, 0.2, 8);
  return b.done([1.2, 0.7], [U.stand(0, 0.65)]); };
K.lamp_post = (o) => { const b = new B(); b.cyl(0.06, 0.09, 3.4, '#3a3f47', 0, 0, 0, 8); b.bar([0, 3.35, 0], [0.5, 3.45, 0], 0.03, '#3a3f47'); b.box(0.3, 0.1, 0.18, mat('#fff3c4', { e: '#ffd98a', ei: 1.2 }), 0.55, 3.35, 0, 0.03); return b.done([0.3, 0.3], [U.stand(0, 0.5)]); };
K.bin = (o) => { const b = new B(); b.cyl(0.24, 0.2, 0.75, mat(o.color || '#2e7d32', { r: 0.5 }), 0, 0, 0, 14); b.cyl(0.26, 0.26, 0.06, mat(shade(o.color || '#2e7d32', -0.2)), 0, 0.75, 0, 14); return b.done([0.5, 0.5], [U.stand(0, 0.5)]); };
K.bunting = (o) => { const b = new B(); const L = o.arg || 4; const cols = o.colors || [C.gRed, C.gGold, C.gGreen]; b.bar([-L / 2, 2.4, 0], [L / 2, 2.4, 0], 0.006, '#333'); for (let i = 0; i < Math.round(L / 0.3); i++) { const s = new THREE.Shape(); s.moveTo(-0.11, 0); s.lineTo(0.11, 0); s.lineTo(0, -0.24); s.closePath(); const m = b.add(new THREE.ShapeGeometry(s), mat(cols[i % cols.length], { side: true }), -L / 2 + 0.15 + i * 0.3, 2.4 - Math.sin((i / Math.round(L / 0.3)) * PI) * 0.15, 0); m.userData.noShadow = true; }
  return b.done([L, 0.05], [U.stand(0, 0.5)], { walkable: true }); };
K.door_frame = (o) => { const b = new B(); b.box(1.12, 2.22, 0.18, o.color || C.woodD, 0, 0, 0, 0.01); b.box(0.96, 2.12, 0.2, '#1a1c20', 0, 0, 0.01, 0.0); return b.done([1.1, 0.2], [U.stand(0, 0.6)], { walkable: true }); };
K.doormat = (o) => { const b = new B(); b.box(0.9, 0.015, 0.55, mat('#fff', { map: T.stripes([o.color || '#8d5a2b', '#5e3a1a'], 8, true) }), 0, 0, 0, 0.004); return b.done([0.9, 0.55], [U.stand(0, 0)], { walkable: true }); };
K.compound_tap = (o) => { const b = new B(); b.box(0.25, 0.9, 0.25, '#bdb6a8', 0, 0, 0, 0.02); b.bar([0, 0.8, 0.12], [0, 0.8, 0.25], 0.02, C.chrome); b.bar([0, 0.8, 0.25], [0, 0.7, 0.28], 0.018, C.chrome); b.cyl(0.18, 0.15, 0.28, mat('#2f7fd8', { r: 0.4 }), 0, 0, 0.42, 14); b.cyl(0.16, 0.16, 0.01, mat('#7cc9ec', { r: 0.1 }), 0, 0.26, 0.42, 14); return b.done([0.45, 0.75], [U.work(0.2, 0.75)]); };
K.shared_door = (o) => { // "outside" toilet/bath door in a single room: a painted door + a small sign, a door-like nook in the wall
  const b = new B(); b.box(0.9, 2.1, 0.08, o.color || '#2a6f97', 0, 0, 0.04, 0.02); b.box(0.06, 0.06, 0.04, C.gold, 0.32, 1.0, 0.1, 0.01); b.box(0.98, 0.08, 0.12, C.woodD, 0, 2.1, 0.04, 0.01); signPanel(b, o.label || 'BATH · WC', '#ffffff', '#2a6f97', 0.6, 0.18, 0, 1.65, 0.1);
  return b.done([0.95, 0.2], [U.stand(0, 0.55, PI)]); };


// --- venue extras
K.road = (o) => { const b = new B(); const L = o.arg || 10, D = o.arg2 || 3; b.box(L, 0.02, D, mat('#4d5156', { r: 0.95 }), 0, 0, 0, 0.003); for (let x = -L / 2 + 0.4; x < L / 2 - 0.4; x += 1.4) b.box(0.8, 0.006, 0.1, '#f2f2f2', x + 0.4, 0.02, 0, 0.001); b.box(L, 0.006, 0.06, '#f2c230', 0, 0.02, -D / 2 + 0.15, 0.001);
  return b.done([L, D], [U.stand(0, 0)], { walkable: true }); };
K.zebra = (o) => { const b = new B(); const L = o.arg || 3; for (let i = 0; i < 6; i++) b.box(L, 0.008, 0.25, '#f4f4f4', 0, 0.022, -0.75 + i * 0.5, 0.001); return b.done([L, 3], [U.stand(0, 0)], { walkable: true }); };
K.toilet_booth = (o) => { const b = new B(); const c = o.color || '#2a6f97'; b.box(1.2, 2.3, 1.2, c, 0, 0, 0, 0.04); b.box(1.3, 0.1, 1.3, '#e8e2d4', 0, 2.3, 0, 0.02); b.box(0.75, 1.95, 0.04, shade(c, 0.15), 0, 0.05, 0.6, 0.02); b.box(0.06, 0.06, 0.04, C.gold, 0.25, 1.0, 0.63, 0.01);
  signPanel(b, o.label || 'TOILET ₵2', '#ffffff', c, 0.9, 0.24, 0, 2.12, 0.62); b.box(0.5, 0.6, 0.4, C.woodL, 0.9, 0, 0.3, 0.02); b.box(0.3, 0.12, 0.2, '#e8e2d4', 0.9, 0.6, 0.3, 0.02); return b.done([1.6, 1.25], [U.stand(0, 1.0)]); };
K.sacks = (o) => { const b = new B(); seed(41); const sm = mat('#e7dcc0', { r: 0.95 }); for (let i = 0; i < 5; i++) b.add(RB(0.5, 0.3, 0.7, 0.12), i % 2 ? sm : mat('#d9c9a0', { r: 0.95 }), -0.35 + (i % 3) * 0.38, 0.15 + Math.floor(i / 3) * 0.28, (i % 2) * 0.1, 0, rnd() * 0.4, 0);
  for (let i = 0; i < 2; i++) { b.cyl(0.32, 0.24, 0.16, mat('#c9ccd0', { m: 0.5, r: 0.35 }), 0.75, i * 0.17, 0.35, 16); } pile(b, 0.75, 0.32, 0.35, 0.1, '#d62828', 7, 0.05); return b.done([1.6, 1.0], [U.stand(0.2, 0.8)]); };
K.hawker_stand = (o) => { const b = new B(); const tb = mat(C.woodD); tableTop(b, 0.9, 0.55, 0.85, tb, tb); seed(51); for (let i = 0; i < 12; i++) b.box(0.08, 0.02, 0.15, pick(['#e63946', '#2a9d8f', '#f4a261', '#264653', '#ffb703', '#8338ec', '#111']), -0.35 + (i % 6) * 0.14, 0.86, -0.12 + Math.floor(i / 6) * 0.22, 0.008);
  b.box(0.7, 0.6, 0.03, mat('#fff', { map: T.stripes(['#264653', '#e9c46a'], 10, true) }), 0, 0.95, -0.27, 0.01); for (let i = 0; i < 8; i++) b.box(0.1, 0.16, 0.02, pick(['#e63946', '#2a9d8f', '#ffb703', '#8338ec']), -0.27 + (i % 4) * 0.18, 1.05 + Math.floor(i / 4) * 0.25, -0.25, 0.008);
  b.cyl(0.02, 0.02, 2.1, C.chrome, 0.4, 0, -0.2, 6); b.add(CY(0.04, 0.95, 0.38, 14, true), mat('#fff', { map: T.stripes([o.color || '#f2c230', '#1d4ed8'], 14, true), side: true }), 0.4, 2.05, -0.2); return b.done([1.0, 0.65], [U.stand(0, 0.7)]); };
K.consult_desk = (o) => { const b = new B(); const c = o.color || C.woodL; b.box(1.4, 0.05, 0.75, c, 0, 0.72, 0, 0.02); b.box(1.36, 0.6, 0.04, shade(c, -0.12), 0, 0.12, 0.33, 0.01); for (const sx of [-1, 1]) b.box(0.05, 0.72, 0.7, shade(c, -0.15), sx * 0.66, 0, 0, 0.01);
  b.box(0.42, 0.3, 0.03, C.black, -0.3, 0.77, -0.15, 0.01); b.plane(0.38, 0.24, mat('#000', { map: T.screen(o.screen || 'code'), e: '#fff', ei: 0.6 }), -0.3, 0.92, -0.133).userData.noShadow = true; b.box(0.3, 0.02, 0.22, '#f7f4ec', 0.25, 0.77, 0.05, 0.003); b.cyl(0.04, 0.035, 0.1, '#2f6fd1', 0.5, 0.77, -0.2, 8);
  chairWood(b, o.chair || '#2a3b5c', 0, 0.7, PI); const g = new B(); g.cyl(0.25, 0.25, 0.04, C.dark, 0, 0.02, 0, 5); g.cyl(0.03, 0.03, 0.38, C.chrome, 0, 0.04, 0, 8); g.box(0.48, 0.08, 0.46, C.black, 0, 0.4, 0, 0.04); g.bc(0.44, 0.55, 0.07, C.black, 0, 0.8, -0.22, -0.1, 0, 0, 0.04); attach(b, g, 0, -0.68, 0);
  return b.done([1.45, 1.9], [U.sit(0, 0.72, 0.47, PI), U.sit(0, -0.66, 0.49, 0, 'type')]); };
K.chair_row = (o) => { const b = new B(); const n = o.arg || 4; const c = o.color || '#c8102e'; const use = []; for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 0.58; chairMono(b, i % 2 && o.alt ? o.alt : c, x, 0, 0); use.push(U.sit(x, 0.03, 0.46)); } return b.done([n * 0.58, 0.55], use); };
K.castle_wall = (o) => { const b = new B(); const L = o.arg || 6, H = o.arg2 || 2.6; const c = o.color || '#f4f1ea'; b.box(L, H, 0.5, c, 0, 0, 0, 0.03); for (let x = -L / 2 + 0.25; x < L / 2; x += 0.7) b.box(0.4, 0.35, 0.5, c, x, H, 0, 0.02); b.box(L + 0.04, 0.12, 0.54, shade(c, -0.08), 0, 0.0, 0, 0.01);
  for (let x = -L / 2 + 1.2; x < L / 2 - 0.6; x += 2.4) { b.box(0.5, 0.8, 0.04, '#3a2d22', x, 0.9, 0.25, 0.02); for (let k = 0; k < 3; k++) b.cyl(0.012, 0.012, 0.8, C.dark, x - 0.15 + k * 0.15, 0.9, 0.28, 4); } return b.done([L, 0.5], [U.stand(0, 0.7)]); };
K.pullup_bar = (o) => { const b = new B(); const m = mat('#3a3f47', { m: 0.4, r: 0.5 }); for (const s of [-1, 1]) b.cyl(0.05, 0.05, 2.3, m, s * 0.7, 0, 0, 8); b.bar([-0.7, 2.25, 0], [0.7, 2.25, 0], 0.03, C.chrome); b.bar([-0.7, 1.2, 0], [0.7, 1.2, 0], 0.03, C.chrome); b.box(1.8, 0.12, 0.25, '#bfb6a5', 0, 0, 0, 0.02); for (const s of [-1, 1]) b.box(0.25, 0.25, 0.25, '#bfb6a5', s * 0.7, 0, 0, 0.02);
  b.cc(0.03, 0.03, 1.0, C.chrome, 1.4, 0.15, 0.3, 0, 0, HP); for (const t of [-1, 1]) b.cc(0.16, 0.16, 0.06, '#222', 1.4 + t * 0.4, 0.17, 0.3, 0, 0, HP, 14); return b.done([3.0, 0.8], [{ x: 0, z: 0.45, face: PI, pose: 'cheer' }, { x: 1.4, z: 0.75, face: PI, pose: 'squat' }]); };
K.steps = (o) => { const b = new B(); const L = o.arg || 3, n = o.arg2 || 5; const c = '#b9b4aa'; for (let i = 0; i < n; i++) b.box(L, 0.25 * (i + 1), 0.4, i % 2 ? c : shade(c, -0.06), 0, 0, (n / 2 - i - 0.5) * 0.4, 0.01); for (const s of [-1, 1]) b.box(0.08, 0.25 * n + 0.4, n * 0.4, '#8f8b84', s * (L / 2 + 0.04), 0, 0, 0.01);
  return b.done([L + 0.16, n * 0.4], [{ x: 0, z: n * 0.2 + 0.4, face: PI, pose: 'stand' }]); };
K.floodlight = (o) => { const b = new B(); b.cyl(0.08, 0.12, 5.0, '#7d838a', 0, 0, 0, 8); b.box(1.0, 0.7, 0.15, '#3a3f47', 0, 4.9, 0, 0.02); for (let i = 0; i < 6; i++) b.box(0.26, 0.22, 0.02, mat('#fff8d8', { e: '#fff1b0', ei: 1.0 }), -0.33 + (i % 3) * 0.33, 5.0 + Math.floor(i / 3) * 0.3, 0.08, 0.02); return b.done([0.4, 0.4], [U.stand(0, 0.5)]); };
K.acoustic_panel = (o) => { const b = new B(); const L = o.arg || 2.0; for (let i = 0; i < Math.round(L / 0.5); i++) for (let j = 0; j < 3; j++) b.box(0.46, 0.46, 0.06, (i + j) % 2 ? '#3a3f4a' : (o.color || '#c8102e'), -L / 2 + 0.25 + i * 0.5, 0.9 + j * 0.5, 0.04, 0.03); return b.done([L, 0.1], [U.stand(0, 0.5)], { walkable: true }); };
K.phone_table = (o) => { const b = new B(); const c = o.color || C.woodD; b.box(0.5, 0.05, 0.4, c, 0, 0.75, 0, 0.015); b.box(0.06, 0.75, 0.06, c, 0, 0, 0, 0.01); b.box(0.3, 0.05, 0.3, c, 0, 0, 0, 0.01); b.box(0.2, 0.08, 0.2, '#c8102e', 0, 0.8, 0, 0.03); b.cc(0.025, 0.025, 0.22, '#c8102e', 0, 0.92, 0, 0, 0, HP, 8);
  const g = new B(); chairMono(g, '#2f6fd1'); attach(b, g, 0.0, 0.55, PI); return b.done([0.6, 1.0], [U.sit(0, 0.58, 0.46, PI)]); };
// demolition debris: broken blocks, slabs, splintered timber, twisted rebar, a smashed signboard
K.rubble = (o) => { const b = new B(); const S = o.arg || 2.4; seed(o.seed || 71); for (let i = 0; i < 16; i++) { const w = 0.25 + rnd() * 0.6, h = 0.15 + rnd() * 0.35; const m = b.bc(w, h, 0.2 + rnd() * 0.5, pick(['#a39e93', '#b9b2a4', '#8f8a80', '#c9bfae', '#d9cfbd']), (rnd() - 0.5) * S, h / 2 + rnd() * 0.25 * (1 - i / 16), (rnd() - 0.5) * S * 0.7, rnd() * 0.5, rnd() * 3, rnd() * 0.5); }
  for (let i = 0; i < 5; i++) b.bc(0.08, 0.06, 1 + rnd() * 1.2, pick(['#8a6a45', '#6f4a2e', '#a07b52']), (rnd() - 0.5) * S, 0.35 + rnd() * 0.2, (rnd() - 0.5) * S * 0.6, rnd() * 0.4, rnd() * 3, 0.2);
  for (let i = 0; i < 4; i++) b.bar([(rnd() - 0.5) * S, 0.2, (rnd() - 0.5) * S * 0.6], [(rnd() - 0.5) * S, 0.7 + rnd() * 0.6, (rnd() - 0.5) * S * 0.6], 0.012, '#6b3f2a');
  if (o.label) { const sg = b.add(RB(1.4, 0.4, 0.04, 0.01), mat('#fff', { map: T.text(o.label, o.color || '#2a9d8f', '#ffffff', 512, 146) }), 0.2, 0.35, 0.2, -1.1, 0.4, 0.25); }
  b.box(S * 0.9, 0.04, S * 0.6, '#cbbf9f', 0, 0, 0, 0.01); return b.done([S, S * 0.6], [U.stand(0, S * 0.45)]); };
K.excavator = (o) => { const b = new B(); const y = mat('#f2b632', { r: 0.5 }), d = mat('#2b2b2b', { r: 0.7 }); b.box(2.4, 0.5, 1.6, d, 0, 0, 0, 0.08); for (const s of [-1, 1]) b.box(2.5, 0.42, 0.42, '#1b1b1b', 0, 0.02, s * 0.62, 0.12);
  b.box(1.9, 0.75, 1.5, y, -0.15, 0.55, 0, 0.06); b.box(0.8, 0.85, 1.0, y, 0.45, 1.3, -0.15, 0.05); b.box(0.7, 0.62, 0.9, mat('#2a3440', { r: 0.2, m: 0.3 }), 0.5, 1.45, -0.15, 0.03); b.box(0.7, 0.5, 1.45, '#3a3a3a', -0.85, 1.3, 0, 0.05);
  b.bc(1.6, 0.26, 0.26, y, 1.4, 1.75, 0.35, 0, 0, 0.55, 0.05); b.bc(1.3, 0.22, 0.22, y, 2.2, 1.45, 0.35, 0, 0, -0.9, 0.05); b.bc(0.5, 0.45, 0.6, '#3a3a3a', 2.55, 0.65, 0.35, 0, 0, 0.3, 0.04); return b.done([3.4, 1.7], [U.stand(0, 1.2)]); };
K.barrier_tape = (o) => { const b = new B(); const L = o.arg || 4; const n = Math.max(2, Math.round(L / 1.6) + 1); for (let i = 0; i < n; i++) { const x = -L / 2 + (i * L) / (n - 1); b.cyl(0.03, 0.03, 0.95, '#d9d4c7', x, 0, 0, 6); b.cyl(0.1, 0.12, 0.08, '#c8102e', x, 0, 0, 8); }
  b.box(L, 0.08, 0.01, mat('#fff', { map: T.stripes(['#fcd116', '#17150f'], Math.round(L * 6), true) }), 0, 0.84, 0, 0.002); return b.done([L, 0.1], [U.stand(0, 0.5)], { walkable: true }); };
// Circle "Tiptoe Lane" phone stall: glass display case of UK-used phones on a table, a seller's stool behind
K.phone_stall = (o) => { const b = new B(); const c = o.color || '#1f6fb8'; tableTop(b, 1.4, 0.7, 0.8, mat(c), mat(shade(c, -0.25))); b.box(1.36, 0.22, 0.62, mat('#cfe8f2', { op: 0.35, r: 0.1 }), 0, 0.8, 0, 0.01);
  seed(61); for (let i = 0; i < 14; i++) { const x = -0.56 + (i % 7) * 0.19, z = -0.17 + Math.floor(i / 7) * 0.3; b.box(0.08, 0.012, 0.15, '#17150f', x, 0.82, z, 0.004); b.box(0.065, 0.004, 0.125, mat(pick(['#3a86ff', '#ff006e', '#8338ec', '#06d6a0', '#ffbe0b']), { e: pick(['#3a86ff', '#ff006e', '#06d6a0']), ei: 0.5 }), x, 0.832, z, 0.002); }
  b.box(1.2, 0.5, 0.03, mat('#fff', { map: T.text(o.label || 'UK USED\nPHONES', c, '#ffffff', 512, 220) }), 0, 1.25, -0.36, 0.005); for (const sx of [-1, 1]) b.box(0.03, 0.9, 0.03, '#3a3f47', sx * 0.6, 0.8, -0.36, 0.005);
  b.cyl(0.18, 0.15, 0.45, '#c8102e', 0, 0, -0.75, 10); return b.done([1.45, 0.75], [U.stand(0, 0.75)]); };
K.suitcase = (o) => { const b = new B(); b.box(0.42, 0.62, 0.26, mat(o.color || '#2a9d8f', { r: 0.4 }), 0, 0.06, 0, 0.05); b.box(0.2, 0.02, 0.02, C.dark, 0, 0.75, 0, 0.01); for (const s of [-1, 1]) b.cyl(0.012, 0.012, 0.14, C.dark, s * 0.08, 0.68, 0, 4); for (const s of [-1, 1]) b.sph(0.03, C.black, s * 0.15, 0.03, -0.1); return b.done([0.45, 0.3], [U.stand(0, 0.45)]); };
K.mihrab = (o) => { const b = new B(); const c = o.color || '#1d6f42'; b.box(1.6, 2.6, 0.12, '#f4f1ea', 0, 0, 0.06, 0.02); b.box(1.0, 1.9, 0.04, c, 0, 0.15, 0.13, 0.01); b.cc(0.5, 0.5, 0.04, c, 0, 2.05, 0.13, HP, 0, 0, 20); b.box(1.1, 0.12, 0.06, mat(C.gold, { m: 0.5, r: 0.4 }), 0, 0.15, 0.15, 0.01); return b.done([1.6, 0.2], [U.stand(0, 0.8)], { walkable: true }); };
K.minbar = (o) => { const b = new B(); const c = o.color || '#7a4a2a'; for (let i = 0; i < 4; i++) b.box(0.7, 0.22 * (i + 1), 0.35, c, 0, 0, 0.6 - i * 0.35, 0.01); for (const s of [-1, 1]) { b.box(0.06, 1.6, 1.4, shade(c, -0.15), s * 0.38, 0, 0.1, 0.01); } b.box(0.8, 0.5, 0.5, shade(c, -0.1), 0, 1.6, -0.6, 0.03); b.cc(0.3, 0.3, 0.05, C.gold, 0, 2.15, -0.6, 0, 0, 0, 12); return b.done([0.85, 1.6], [U.stand(0.7, 0.4, -HP)]); };
K.ablution = (o) => { const b = new B(); const L = o.arg || 2.4; b.box(L, 0.8, 0.25, '#e4eef0', 0, 0, -0.3, 0.02); b.box(L, 0.08, 0.35, mat('#fff', { map: T.tilesWall('#bfe0dc') }), 0, 0.0, 0.05, 0.01); for (let x = -L / 2 + 0.35; x < L / 2; x += 0.6) { b.bar([x, 0.65, -0.18], [x, 0.65, -0.05], 0.015, C.chrome); b.cyl(0.13, 0.13, 0.3, mat('#fff', { map: T.stripes(['#1d6f42'], 1) }), x, 0, 0.45, 10); }
  b.box(L, 0.35, 0.25, '#cfc6b2', 0, 0, 0.55, 0.02); return b.done([L, 1.1], [U.sit(0, 0.55, 0.35, PI)]); };
K.offering_box = (o) => { const b = new B(); b.box(0.6, 0.8, 0.5, '#6a1b9a', 0, 0, 0, 0.03); b.box(0.64, 0.06, 0.54, C.gold, 0, 0.8, 0, 0.01); b.box(0.3, 0.015, 0.04, C.black, 0, 0.86, 0); b.cyl(0.18, 0.14, 0.1, mat('#fff', { map: T.woven() }), 0.12, 0.86, 0.05, 12); b.box(0.4, 0.3, 0.02, mat('#fff', { map: T.text('SOW A\nSEED', '#6a1b9a', '#fcd116', 128, 96) }), 0, 0.3, 0.255, 0.003); return b.done([0.65, 0.55], [U.work(0, 0.6)]); };
K.notice_board = (o) => { const b = new B(); const W = o.arg || 1.4; b.box(W, 0.9, 0.04, '#b78a5a', 0, 1.0, 0.03, 0.01); seed(W * 17); for (let i = 0; i < 6; i++) b.box(0.3, 0.36, 0.01, pick(['#ffffff', '#fff3b0', '#ffd6d6', '#d6ecff']), -W / 2 + 0.25 + (i % 3) * (W / 3), 1.1 + Math.floor(i / 3) * 0.38, 0.055, 0.002); return b.done([W, 0.1], [U.stand(0, 0.6)], { walkable: true }); };
K.stage = (o) => { const b = new B(); const W = o.arg || 3, D = o.arg2 || 1.6; b.box(W, 0.3, D, mat(o.color || '#6a1b9a'), 0, 0, 0, 0.03); b.box(W + 0.04, 0.04, D + 0.04, C.gold, 0, 0.28, 0, 0.01); return b.done([W, D], [{ x: 0, z: 0, y: 0.32, face: 0, pose: 'cheer' }]); };
K.mannequin = (o) => { const b = new B(); b.cyl(0.18, 0.2, 0.04, C.dark, 0, 0, 0, 12); b.cyl(0.02, 0.02, 0.9, C.chrome, 0, 0.04, 0, 6); b.box(0.36, 0.55, 0.22, mat('#fff', { map: T.wax(o.color || '#7b2d8e', '#f2c230', '#2bb3a0') }), 0, 0.95, 0, 0.08); b.sph(0.1, '#e8e2d4', 0, 1.62, 0); b.cyl(0.04, 0.04, 0.1, '#e8e2d4', 0, 1.48, 0, 6); return b.done([0.4, 0.4], [U.stand(0, 0.6)]); };
K.floor_sign = (o) => { const b = new B(); b.bar([0, 0, -0.25], [0, 1.0, 0], 0.02, C.dark); b.bc(0.6, 0.85, 0.03, mat('#fff', { map: T.text(o.label || 'OPEN', o.color || '#c8102e', '#fff', 256, 360) }), 0, 0.55, 0.12, -0.25); return b.done([0.6, 0.5], [U.stand(0, 0.6)]); };

// tiled half-height partition (bathroom nooks); runs along local x
K.half_wall = (o) => { const b = new B(); const L = o.arg || 1.5, H = o.arg2 || 1.25; const t = T.tilesWall(o.color || '#cfe8ef'); const tm = new THREE.MeshStandardMaterial({ map: t.clone(), roughness: 0.5 }); tm.map.repeat.set(L / 0.6, H / 0.6); tm.map.needsUpdate = true;
  b.box(L, H, 0.12, tm, 0, 0, 0, 0.01); b.box(L + 0.02, 0.05, 0.16, mat('#f4f1ea'), 0, H, 0, 0.01); return b.done([L, 0.14], [U.stand(0, 0.5)]); };
// two-tone painted lower wall (Ghanaian oil-paint dado) — origin at the wall face, runs along local x
K.dado = (o) => { const b = new B(); const L = o.arg || 2, H = o.arg2 || 1.0; const c = o.color || '#6f9f86'; b.box(L, H, 0.02, mat(c, { r: 0.6 }), 0, 0, 0.012, 0.004); b.box(L, 0.05, 0.035, mat(o.trim || '#2f3237', { r: 0.6 }), 0, H - 0.02, 0.02, 0.005); return b.done([L, 0.04], [U.stand(0, 0.5)], { walkable: true }); };
K.path = (o) => { const b = new B(); const L = o.arg || 6, W = o.arg2 || 1.6; b.box(L, 0.02, W, mat('#fff', { map: T.stripes(['#d8cfbf', '#cbc1ae'], Math.max(2, Math.round(L / 0.6)), true) }), 0, 0, 0, 0.004); for (const s of [-1, 1]) b.box(L, 0.05, 0.08, '#b5ab98', 0, 0, s * W / 2, 0.01); return b.done([L, W], [U.stand(0, 0)], { walkable: true }); };
K.pitch_lines = (o) => { const b = new B(); const W = o.arg || 10, D = o.arg2 || 5; const m = mat('#f4f4f4'); b.box(W, 0.012, 0.08, m, 0, 0.01, -D / 2, 0.001); b.box(0.08, 0.012, D, m, 0, 0.01, 0, 0.001); b.add(TO(1.2, 0.04, 32), m, 0, 0.02, 0, HP); b.add(TO(0.01, 0.06, 6), m, 0, 0.02, 0, HP);
  for (let i = 0; i < Math.round(W / 1.5); i++) b.box(1.5, 0.006, D, i % 2 ? '#6fae55' : '#7cb760', -W / 2 + 0.75 + i * 1.5, 0.002, 0, 0.001); return b.done([W, D], [U.stand(0, 0)], { walkable: true }); };
K.reading_table = (o) => { const b = new B(); const c = o.color || '#8a5a36'; b.box(1.8, 0.06, 0.9, c, 0, 0.72, 0, 0.02); for (const sx of [-1, 1]) b.box(0.08, 0.72, 0.7, shade(c, -0.18), sx * 0.8, 0, 0, 0.01);
  for (const [x, z] of [[-0.45, 0.2], [0.45, 0.2], [-0.45, -0.2], [0.45, -0.2]]) { b.box(0.22, 0.03, 0.3, pick(['#c0392b', '#2e86c1', '#27ae60', '#f1c40f']), x, 0.78, z, 0.005); b.box(0.2, 0.01, 0.28, '#f7f4ec', x + 0.02, 0.81, z, 0.002); }
  b.cyl(0.07, 0.08, 0.02, C.dark, 0, 0.78, 0, 10); b.cyl(0.01, 0.01, 0.3, C.dark, 0, 0.78, 0, 4); b.cyl(0.06, 0.1, 0.1, mat('#1d6f42', { e: '#ffd98a', ei: 0.2 }), 0, 1.06, 0, 10);
  const cc = o.chair || C.wood; chairWood(b, cc, -0.45, 0.62, PI); chairWood(b, cc, 0.45, 0.62, PI); chairWood(b, cc, -0.45, -0.62, 0); chairWood(b, cc, 0.45, -0.62, 0);
  return b.done([1.85, 1.75], [U.sit(-0.45, 0.66, 0.47, PI, 'type'), U.sit(0.45, 0.66, 0.47, PI, 'type'), U.sit(-0.45, -0.66, 0.47, 0, 'type'), U.sit(0.45, -0.66, 0.47, 0, 'type')]); };
K.pots = (o) => { const b = new B(); pot(b, 0.2, 0.26, mat('#c5cad0', { r: 0.3, m: 0.6 }), -0.3, 0, 0); pot(b, 0.16, 0.2, mat('#b33a2c', { r: 0.5 }), 0.1, 0, 0.02, false); b.cyl(0.15, 0.15, 0.01, '#c1440e', 0.1, 0.19, 0.02, 14); pot(b, 0.14, 0.18, mat('#c5cad0', { r: 0.3, m: 0.6 }), 0.42, 0, -0.02); return b.done([0.9, 0.42], [U.stand(0, 0.6)], { walkable: true }); };
K.rope = (o) => { const b = new B(); const L = o.arg || 2.4; const n = Math.max(2, Math.round(L / 1.2) + 1); for (let i = 0; i < n; i++) { const x = -L / 2 + (L / (n - 1)) * i; b.cyl(0.14, 0.14, 0.03, C.gold, x, 0, 0, 12); b.cyl(0.025, 0.025, 0.9, mat(C.gold, { m: 0.6, r: 0.3 }), x, 0, 0, 8); b.sph(0.05, C.gold, x, 0.92, 0); if (i) { const x0 = x - L / (n - 1); for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6; b.bar([x0 + (x - x0) * t0, 0.85 - Math.sin(t0 * PI) * 0.18, 0], [x0 + (x - x0) * t1, 0.85 - Math.sin(t1 * PI) * 0.18, 0], 0.025, '#b3202a', 6); } } }
  return b.done([L, 0.3], [U.stand(0, 0.5)]); };
K.fish_smoker = (o) => { const b = new B(); const cl = mat('#a8653f', { r: 0.95 }); b.box(1.6, 0.7, 0.9, cl, 0, 0, 0, 0.06); b.box(0.4, 0.3, 0.02, '#2b1a12', -0.4, 0.15, 0.45, 0.02); b.box(0.4, 0.3, 0.02, '#2b1a12', 0.4, 0.15, 0.45, 0.02); b.box(0.3, 0.2, 0.03, mat('#ff7a1a', { e: '#ff5a00', ei: 1.0 }), -0.4, 0.18, 0.45, 0.02);
  for (let k = 0; k < 2; k++) { b.box(1.5, 0.05, 0.85, '#5d5d5d', 0, 0.7 + k * 0.12, 0, 0.01); seed(70 + k); for (let i = 0; i < 9; i++) b.add(SP(0.07, 8, 6), mat('#7a4a22', { r: 0.6 }), -0.6 + (i % 5) * 0.3, 0.78 + k * 0.12, -0.2 + Math.floor(i / 5) * 0.35, 0, 0.3, 0, 2.0, 0.5, 0.8); }
  b.add(IC(0.3, 1), mat('#d9d6d0', { op: 0.35, flat: true }), 0.1, 1.35, 0, 0, 0, 0, 1.4, 0.8, 1).userData.noShadow = true; return b.done([1.65, 0.95], [U.work(0, 0.75)]); };

// friendly aliases from the brief
K.street_surface=()=>({obj:new THREE.Group(),size:[0,0],use:[U.stand(0,0)],walkable:true});
K.street_road = (o) => { const b=new B(), w=o.arg||34,d=o.arg2||5; b.box(w,.025,d,'#666a69');for(let x=-w/2+1;x<w/2;x+=3)b.box(1.5,.008,.08,'#eadab1',x,.03,0);for(const z of [-d/2,d/2])b.box(w,.07,.2,'#beb5a4',0,0,z);return b.done([w,d],[U.stand(0,0)],{walkable:true}); };
K.street_building = (o) => {
  const b=new B(),w=o.arg||5,d=o.arg2||4,c=o.color||'#eadac0',style=o.style||'compound';
  const modern=['modern','villa','gallery'].includes(style),historic=style==='coastal',H=modern?3.4:2.75,trim=modern?'#6b796f':historic?'#547e85':'#8b6b4c';
  b.box(w,H,d,c,0,0,0,.025);b.box(w+.12,.18,d+.12,trim,0,0,0,.01);
  if(modern){b.box(w+.25,.15,d+.25,'#eee5d4',0,H,0,.015);b.box(w*.6,.26,d*.62,c,-w*.14,H+.15,-d*.16,.015);}
  else {b.bc(w+.35,.12,d*.58,'#a77e5a',0,H+.16,-d*.25,-.18,0,0,.01);b.bc(w+.35,.12,d*.58,'#a77e5a',0,H+.16,d*.25,.18,0,0,.01);}
  b.box(.88,2.05,.07,'#6f5843',0,0,d/2+.04,.01);b.box(.06,.08,.08,'#c9b27b',.3,.95,d/2+.09,.005);
  for(const x of [-w*.3,w*.3]){
    b.box(w*.25,1.15,.075,'#4b7177',x,.85,d/2+.04,.01);
    for(const dx of [-w*.13,w*.13])b.box(.05,1.25,.13,'#eee3ce',x+dx,.8,d/2+.07,.004);
    b.box(w*.28,.06,.18,'#eee3ce',x,.8,d/2+.1,.004);
    b.box(.035,1.15,.09,'#d8d8c7',x,.85,d/2+.1,.003);
    if(historic)for(const sign of [-1,1])for(let y=.9;y<1.95;y+=.18)b.box(.18,.08,.06,trim,x+sign*w*.16,y,d/2+.08,.003);
  }
  b.box(w*.85,.09,.62,trim,0,2.25,d/2+.22,.01);
  for(const x of [-w*.43,w*.43])b.box(.075,2.25,.075,trim,x,0,d/2+.38,.006);
  b.box(w*.85,.035,.65,'#c6b799',0,.012,d/2+.15,.006);
  b.plane(w*.76,.32,mat('#fff',{map:T.text(o.label||'RESIDENCE',trim,'#f3ecdc',256,64)}),0,2.48,d/2+.08);
  return b.done([w,d],[U.stand(0,d/2+.9)]);
};
K.street_gate = (o) => { const b=new B();for(const x of [-1,1])b.box(.18,2.4,.25,'#888477',x,0,0);b.box(2.3,.5,.16,'#29483f',0,2.25,0);b.plane(2.1,.38,mat('#fff',{map:T.text(o.label||'NEIGHBOURHOOD','#29483f')}),0,2.5,.09);return b.done([2.3,.3],[U.stand(0,.7)],{walkable:true}); };
K.khebab_grill = () => { const b=new B();for(const x of [-.55,.55])for(const z of [-.22,.22])b.box(.05,.75,.05,C.steel,x,0,z);b.box(1.3,.2,.65,'#34332d',0,.65,0);b.box(1.2,.06,.55,mat('#e86e26',{e:'#f65413',ei:.65}),0,.85,0);for(let x=-.5;x<=.5;x+=.13){b.bar([x,.94,-.35],[x,.94,.42],.014,C.woodL);for(const z of [-.2,0,.2])b.sph(.055,'#9e5530',x,.96,z,1,.7,1);}const smoke=b.keep(b.sph(.15,mat('#d9d2c4',{op:.18}),0,1.3,0,1,1.4,1));const made=b.done([1.35,.7],[U.work(0,.85)]);made.obj.userData.smoke=smoke;return made; };
K.icecream_bicycle = () => { const b=new B();for(const x of [-.65,.65]){b.add(TO(.36,.035,20),C.black,x,.39,0,0,HP);for(let a=0;a<PI;a+=PI/4)b.bar([x,.39+Math.cos(a)*.34,Math.sin(a)*.34],[x,.39-Math.cos(a)*.34,-Math.sin(a)*.34],.006,C.steel);}b.bar([-.65,.4,0],[0,.95,0],.025,'#bd2e3a');b.bar([0,.95,0],[.65,.4,0],.025,'#bd2e3a');b.bar([-.65,.4,0],[.65,.4,0],.025,'#bd2e3a');b.box(.3,.05,.18,C.black,0,.97,0);b.bar([.65,.4,0],[.5,1.15,0],.025,C.chrome);b.bar([.5,1.15,-.25],[.5,1.15,.25],.02,C.chrome);b.box(.75,.55,.55,'#f5f4e9',-.65,.7,0,.05);b.plane(.65,.35,mat('#fff',{map:T.text('FanYogo','#bd2e3a')}),-.65,.97,.28);return b.done([1.9,.65],[U.work(0,.8)]); };
K.cinema_chair = (o) => K.armchair({...o,color:'#762f3d'});
K.weight_bench = () => {
  const b = new B();
  for (const z of [-.65, .65]) {
    b.box(.8, .06, .12, C.steel, 0, 0, z);
    b.box(.08, .44, .08, C.steel, 0, .06, z);
  }
  b.box(.46, .12, 1.75, '#293238', 0, .48, 0, .04);
  for (const x of [-.6, .6]) {
    b.box(.07, 1.3, .07, C.steel, x, 0, -.65);
    b.box(.25, .06, .5, C.steel, x, 0, -.65);
    b.bar([x, 1.1, -.7], [x, 1.1, -.5], .025, C.chrome);
  }
  b.bar([-1, 1.14, -.6], [1, 1.14, -.6], .025, C.chrome);
  for (const x of [-.82, .82]) b.cc(.23, .23, .12, C.black, x, 1.14, -.6, 0, 0, HP, 16);
  return b.done([2.1, 1.85], [U.sit(0, .45, .6, PI)]);
};
K.treadmill = () => {const b=new B();b.box(.85,.12,1.7,'#262e32',0,.05,0);b.box(.65,.015,1.3,'#171b1c',0,.18,.1);for(const x of [-.4,.4])b.bar([x,.1,-.6],[x,1.1,-.6],.04,C.steel);b.box(.8,.1,.4,'#34434a',0,1.1,-.6);return b.done([.9,1.8],[U.stand(0,.1,.2)]);};
K.kitchen_counter = K.counter;
K.tv_stand = K.tv; K.lectern_stand = K.lectern; K.plane_window = K.runway_window; K.chair = K.plastic_chair; K.table = K.plastic_table; K.bench = K.wooden_bench;

K.room_divider = (o) => {const b=new B(),L=o.arg||2,H=o.arg2||1.05;b.box(L,H,.13,o.color||'#e8dfcd',0,0,0,.012);b.box(L+.06,.06,.19,o.trim||'#836950',0,H,0,.01);b.box(L,.08,.15,o.trim||'#836950',0,0,0,.006);for(const x of [-L/2+.05,L/2-.05])b.box(.065,H+.12,.17,o.trim||'#836950',x,0,0,.008);return b.done([L,.18],[U.stand(0,.5)]);};
K.solar_unit = () => {const b=new B();b.box(.65,.55,.22,'#d7ddd6',0,.25,0,.04);b.box(.28,.09,.025,'#536b64',0,.6,.12,.01);b.box(.62,.06,.22,'#b6bdb2',0,.24,0,.01);return b.done([.7,.25],[U.stand(0,.5)],{walkable:true});};
K.camera_case = () => {const b=new B();b.box(.42,.26,.25,'#65584b',0,0,0,.05);b.box(.26,.12,.13,'#303f3c',0,.26,0,.02);b.cc(.055,.055,.06,'#6b9295',0,.33,.09,HP,0,0,12);return b.done([.5,.3],[U.stand(0,.5)],{walkable:true});};
function finishFurniture(name,o,r){
  const b=new B();let detail=false;
  if(name==='bed'){
    b.box(1.45,.35,.05,mat('#fff',{map:T.fabric(o.sheet||'#718782')}),0,.6,-.98,.025);
    for(const x of [-.46,0,.46])b.sph(.023,'#c6b494',x,.79,-.94,1,1,.35,6,4);
    if(o.upgraded)b.box(1.5,.045,1.9,'#ebe7d9',0,.53,.02,.018);
    detail=true;
  }
  if(['sofa','armchair','vip_sofa'].includes(name)){
    const L=name==='armchair'?1:o.arg||2;
    b.bc(.27,.27,.1,mat('#fff',{map:T.fabric('#bfa784')}),L/2-.3,.61,-.1,-.25,0,.12,.05);
    b.box(L-.1,.018,.03,'#b7a37e',0,.28,.43,.004);detail=true;
  }
  if(['counter','kitchen_counter'].includes(name)){
    const L=o.arg||2,n=Math.max(1,Math.round(L/.6));for(let i=0;i<n;i++){const x=-L/2+(i+.5)*L/n;b.box(L/n-.05,.6,.025,o.color||'#708980',x,.18,.315,.012);b.box(.13,.023,.04,'#b9ad8b',x,.72,.34,.005);}detail=true;
  }
  if(name==='fridge'){b.box(.5,.012,.018,'#b2bbb8',0,.16,.34,.003);for(let i=0;i<4;i++)b.box(.11,.012,.012,'#7e8b85',-.2+i*.13,.12,.34,.002);detail=true;}
  if(name==='toilet'){b.cyl(.155,.155,.008,'#b3c9c4',0,.451,.06,16);detail=true;}
  if(detail)r.obj.add(b.done([0,0],[]).obj);
  return r;
}
export const ITEM_KINDS = Object.keys(K);
export function makeItem(kind, opts = {}) {
  const [name, args] = String(kind).split(':'); const f = K[name];
  const o = { ...opts }; if (args) { const a = args.split(',').map(Number); o.arg = a[0]; if (a.length > 1) o.arg2 = a[1]; }
  if (!f) { console.warn('[kit] unknown item', kind); const b = new B(); b.box(0.5, 0.5, 0.5, '#ff00ff', 0, 0, 0); return b.done([0.5, 0.5], [U.stand(0, 0.6)]); }
  const r = finishFurniture(name,o,f(o)); r.kind = name; return r;
}
