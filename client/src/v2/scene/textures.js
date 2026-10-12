// Fabric, hair and face textures painted on canvas: kente, ankara wax print, fugu stripes, denim, the Black Stars
// jersey, office shirts, suits, and simple stylised faces. Cached by (kind, colours).
import * as THREE from 'three';

const CACHE = new Map();
const mk = (w, h, draw, repeat) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; };
const shade = (hex, f) => { const c = new THREE.Color(hex); if (f > 1) c.lerp(new THREE.Color('#ffffff'), f - 1); else c.multiplyScalar(f); return '#' + c.getHexString(); };
const noise = (x, w, h, a = 0.05) => { const im = x.getImageData(0, 0, w, h); const d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 255 * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(im, 0, 0); };
// contrasting accents for prints
const ACC = { '#e76f51': ['#1f3f8f', '#f2b632', '#fff3d6'], '#1f6fb8': ['#f2b632', '#e76f51', '#fffbe9'], '#0e7a4e': ['#f2b632', '#c8102e', '#fff6dd'], '#7b2d8e': ['#f2b632', '#2a9d8f', '#fff2f9'], '#f2b632': ['#1f3f8f', '#c8102e', '#17150f'], '#c8102e': ['#f2b632', '#17150f', '#fff3e0'] };
const acc = (c) => ACC[c] || ['#f2b632', '#17150f', '#ffffff'];
const P = {
  plain: (x, w, h, c) => { x.fillStyle = c; x.fillRect(0, 0, w, h); noise(x, w, h, 0.012); },
  denim: (x, w, h, c) => { x.fillStyle = c; x.fillRect(0, 0, w, h); x.strokeStyle = shade(c, 1.25); x.globalAlpha = 0.14; x.lineWidth = 1; for (let i = -h; i < w; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); } x.globalAlpha = 1; noise(x, w, h, 0.035); },
  kente: (x, w, h, c) => { // woven strips: each 32px strip alternates warp-faced bands and weft blocks with zigzags
    const base = c, [a1, a2] = [c === '#f2b632' ? '#0e7a4e' : '#f2b632', c === '#c8102e' ? '#17150f' : '#c8102e'];
    x.fillStyle = base; x.fillRect(0, 0, w, h); const sw = 32;
    for (let s = 0; s < w / sw; s++) { const off = (s % 2) * 24;
      for (let y = -48 + off; y < h; y += 48) {
        x.fillStyle = s % 2 ? a1 : a2; x.fillRect(s * sw + 2, y, sw - 4, 20);
        x.fillStyle = '#17150f'; for (let k = 0; k < 4; k++) x.fillRect(s * sw + 4 + k * 7, y + 3 + (k % 2) * 7, 5, 5);
        x.fillStyle = s % 2 ? '#0e7a4e' : '#f2b632'; x.fillRect(s * sw + 2, y + 22, sw - 4, 3); x.fillRect(s * sw + 2, y + 41, sw - 4, 3);
        x.strokeStyle = '#17150f'; x.lineWidth = 2; x.beginPath(); for (let k = 0; k <= 4; k++) x.lineTo(s * sw + 2 + k * 7, y + 30 + (k % 2 ? 6 : 0)); x.stroke(); }
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(s * sw, 0, 2, h); }
    noise(x, w, h, 0.06); },
  ankara: (x, w, h, c) => { const [a, b, d] = acc(c); x.fillStyle = c; x.fillRect(0, 0, w, h);
    for (let gy = 0; gy < h / 64; gy++) for (let gx = 0; gx < w / 64; gx++) { const cx = gx * 64 + (gy % 2) * 32 + 16, cy = gy * 64 + 32;
      x.fillStyle = a; x.beginPath(); x.arc(cx, cy, 22, 0, 7); x.fill(); x.fillStyle = d; x.beginPath(); x.arc(cx, cy, 14, 0, 7); x.fill(); x.fillStyle = b; x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.fill();
      x.strokeStyle = d; x.lineWidth = 3; x.beginPath(); x.moveTo(cx + 26, cy - 26); x.quadraticCurveTo(cx + 38, cy, cx + 26, cy + 26); x.stroke();
      x.fillStyle = b; for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(cx + 36 + Math.cos(k) * 4, cy - 30 + k * 10, 2.5, 0, 7); x.fill(); } }
    noise(x, w, h, 0.05); },
  fugu: (x, w, h, c) => { x.fillStyle = c; x.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 8) { x.fillStyle = (i / 8) % 3 === 0 ? '#f4f1e6' : (i / 8) % 3 === 1 ? shade(c, 0.7) : shade(c, 1.15); x.fillRect(i, 0, 4, h); } noise(x, w, h, 0.07); },
  hair: (x, w, h, c) => { x.fillStyle = c; x.fillRect(0, 0, w, h); x.globalAlpha = 0.28; for (let i = 0; i < 1600; i++) { x.fillStyle = Math.random() < 0.5 ? shade(c, 0.92) : shade(c, 1.008); x.fillRect(Math.random() * w, Math.random() * h, 1, 1); } x.globalAlpha = 1; },
  rows: (x, w, h, c) => { x.fillStyle = shade(c, 0.6); x.fillRect(0, 0, w, h); x.fillStyle = c; for (let i = 0; i < w; i += 16) for (let y = 0; y < h; y += 12) { x.beginPath(); x.ellipse(i + 8, y + 6, 6, 7, 0, 0, 7); x.fill(); } },
  waves: (x, w, h, c) => { x.fillStyle = c; x.fillRect(0, 0, w, h); x.strokeStyle = shade(c, 1.6); x.lineWidth = 2; for (let y = 4; y < h; y += 10) { x.beginPath(); for (let i = 0; i <= w; i += 8) x.lineTo(i, y + Math.sin(i / 8) * 3); x.stroke(); } },
  gold: (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#fff2a8'); g.addColorStop(0.5, '#d4a017'); g.addColorStop(1, '#8a6200'); x.fillStyle = g; x.fillRect(0, 0, w, h); },
};
// textures for the torso of a garment, with front details. Front centre is u = 0.75 (x = 3w/4); v=1 is the top of the canvas.
const C0 = 0.75, C1 = 0.25; // front centre / back centre of a torso texture
const FRONT = {
  // Original game artwork informed by PUMA's March 2026 Ghana kit release.
  jersey: (x, w, h) => ghanaKit(x, w, h, false),
  jerseyaway: (x, w, h) => ghanaKit(x, w, h, true),
  flagtee: (x, w, h, c) => { P.plain(x, w, h, c); ['#c8102e', '#f2b632', '#0e7a4e'].forEach((t, i) => { x.fillStyle = t; x.fillRect(w * 0.12, h * 0.3 + i * 26, w * 0.26, 26); }); star(x, w * C0, h * 0.3 + 39, 14, '#17150f'); },
  office: (x, w, h, c) => { P.plain(x, w, h, c); x.fillStyle = '#8a1c2b'; x.beginPath(); x.moveTo(w * C0 - 10, h * 0.02); x.lineTo(w * C0 + 10, h * 0.02); x.lineTo(w * C0 + 14, h * 0.5); x.lineTo(w * C0, h * 0.58); x.lineTo(w * C0 - 14, h * 0.5); x.closePath(); x.fill(); x.fillStyle = 'rgba(0,0,0,.2)'; for (let y = 0.62; y < 1; y += 0.1) { x.beginPath(); x.arc(w * C0, h * y, 3, 0, 7); x.fill(); } },
  suit: (x, w, h, c) => { P.plain(x, w, h, c); x.fillStyle = '#f4f4f2'; x.beginPath(); x.moveTo(w * C0 - 34, 0); x.lineTo(w * C0 + 34, 0); x.lineTo(w * C0, h * 0.45); x.closePath(); x.fill(); x.fillStyle = '#17150f'; x.fillRect(w * C0 - 6, 0, 12, h * 0.36); x.strokeStyle = shade(c, 0.6); x.lineWidth = 4; x.beginPath(); x.moveTo(w * C0 - 34, 0); x.lineTo(w * C0, h * 0.45); x.lineTo(w * C0 + 34, 0); x.stroke(); x.fillStyle = shade(c, 0.5); x.beginPath(); x.arc(w * C0, h * 0.6, 4, 0, 7); x.fill(); },
  hoodie: (x, w, h, c) => { P.plain(x, w, h, c); x.fillStyle = shade(c, 0.85); x.fillRect(w * C0 - 40, h * 0.62, 80, 46); x.strokeStyle = '#f4f4f2'; x.lineWidth = 3; x.beginPath(); x.moveTo(w * C0 - 10, 0); x.lineTo(w * C0 - 12, h * 0.25); x.moveTo(w * C0 + 10, 0); x.lineTo(w * C0 + 12, h * 0.25); x.stroke(); },
  polo: (x, w, h, c) => { P.plain(x, w, h, c); x.fillStyle = shade(c, 0.8); x.fillRect(w * C0 - 7, 0, 14, h * 0.22); x.fillStyle = '#f4f4f2'; for (let k = 0; k < 2; k++) { x.beginPath(); x.arc(w * C0, h * (0.06 + k * 0.08), 2.5, 0, 7); x.fill(); } },
  kaftan: (x, w, h, c) => { P.plain(x, w, h, c); x.strokeStyle = shade(c, 1.5); x.lineWidth = 3; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(w * C0 - 26 + k * 4, 0); x.lineTo(w * C0 - 26 + k * 4, h * 0.4); x.lineTo(w * C0 + 26 - k * 4, h * 0.4); x.lineTo(w * C0 + 26 - k * 4, 0); x.stroke(); } },
};
function ghanaKit(x, w, h, away) {
  P.plain(x, w, h, away ? '#eabd38' : '#f4f4f2');
  const gradient = x.createLinearGradient(0, h * .28, 0, h);
  gradient.addColorStop(0, away ? '#dbad2e' : '#b82b35'); gradient.addColorStop(.5, '#dfaf2d'); gradient.addColorStop(1, away ? '#aa811d' : '#27784f');
  x.fillStyle = gradient;
  // Woven, stepped chevrons; white shoulders keep the front star legible.
  for (let row = 0; row < 8; row++) for (let col = 0; col < 16; col++) {
    const xx = col * w / 16, yy = h * .3 + row * h / 12, unit = w / 32;
    if (!away && row < 2 && col % 4 > row) continue;
    x.globalAlpha = away ? .42 : .9; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + unit, yy + unit); x.lineTo(xx + unit * 2, yy); x.lineTo(xx + unit * 2, yy + unit * .6); x.lineTo(xx + unit, yy + unit * 1.6); x.lineTo(xx, yy + unit * .6); x.closePath(); x.fill();
  }
  x.globalAlpha = 1; x.fillStyle = away ? '#a5292f' : '#202b27'; x.fillRect(0, 0, w, h * .035);
  star(x, w * C0, h * .21, w * .038, '#161b18');
  x.fillStyle = '#161b18'; x.font = '600 16px sans-serif'; x.textAlign = 'center'; x.fillText('GHANA', w * C1, h * .18); x.font = '600 66px sans-serif'; x.fillText('10', w * C1, h * .4);
}
function star(x, cx, cy, r, col) { x.fillStyle = col; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); }
// pattern kind for a wear item id
export const PATTERN = { kenteshirt: 'kente', kenteskirt: 'kente', kentedress: 'kente', kentecloth: 'kente', stole: 'kente', ankara: 'ankara', kaba: 'ankara', slit: 'ankara', ankarapants: 'ankara', ankaradress: 'ankara', fugu: 'fugu', jeans: 'denim', shorts: 'denim', chain: 'gold' };
export function fabric(item, color, front = false) {
  const key = (front ? 'F:' : 'P:') + item + ':' + color; if (CACHE.has(key)) return CACHE.get(key);
  let t; const kind = PATTERN[item] || 'plain';
  if (front && FRONT[item]) t = mk(512, 512, (x, w, h) => FRONT[item](x, w, h, color));
  else if (front && kind !== 'plain') t = mk(512, 512, (x, w, h) => { P[kind](x, w, h, color); }, true);
  else t = mk(256, 256, (x, w, h) => P[kind](x, w, h, color), true);
  CACHE.set(key, t); return t;
}
export function hairTex(style, color) { const kind = style === 'cornrows' ? 'rows' : style === 'waves' ? 'waves' : 'hair'; const key = 'H:' + kind + color; if (!CACHE.has(key)) CACHE.set(key, mk(128, 128, (x, w, h) => P[kind](x, w, h, color), true)); return CACHE.get(key); }
// stylised face on the head's lat/long texture (front of the face is u = 0.5)
export function faceTex(skin, female, beard) {
  const key = `face:${skin}:${female}:${beard}`; if (CACHE.has(key)) return CACHE.get(key);
  const t = mk(512, 256, (x, w, h) => {
    x.fillStyle = skin; x.fillRect(0, 0, w, h);
    const cx = w * 0.5, ey = h * 0.47, dx = 25;
    x.fillStyle = shade(skin, 0.85); x.beginPath(); x.ellipse(cx, h * 0.62, 10, 7, 0, 0, 7); x.fill(); // nose shadow
    for (const s of [-1, 1]) {
      x.fillStyle = '#bcb3a0'; x.beginPath(); x.ellipse(cx + s * dx, ey, 10, 3.4, 0, 0, 7); x.fill();
      x.fillStyle = '#231b14'; x.beginPath(); x.arc(cx + s * dx, ey, 3.1, 0, 7); x.fill(); x.fillStyle = '#ddd8c4'; x.beginPath(); x.arc(cx + s * dx + 1, ey - 1, .7, 0, 7); x.fill();
      x.strokeStyle = shade(skin, .35); x.lineWidth = female ? 2.2 : 3; x.beginPath(); x.moveTo(cx + s * (dx - 10), ey - 8); x.quadraticCurveTo(cx + s * dx, ey - 11, cx + s * (dx + 11), ey - 7); x.stroke();
      x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx + s * (dx - 10), ey); x.quadraticCurveTo(cx + s * dx, ey - 5, cx + s * (dx + 10), ey); x.stroke();
    }
    x.fillStyle = shade(skin, .66); x.beginPath(); x.ellipse(cx, h * .67, 12, 2.4, 0, 0, 7); x.fill();
    x.strokeStyle = shade(skin, .43); x.lineWidth = 1; x.beginPath(); x.moveTo(cx - 11, h * .67); x.quadraticCurveTo(cx, h * .68, cx + 11, h * .67); x.stroke();
    if (beard === 'stubble') { x.fillStyle = 'rgba(20,12,8,.35)'; for (let i = 0; i < 1400; i++) { const a = Math.random() * Math.PI, r = 50 + Math.random() * 16; const px = cx + Math.cos(a) * r * 1.2, py = h * 0.62 + Math.sin(a) * r * 0.55; x.fillRect(px, py, 1.5, 1.5); } }
  });
  CACHE.set(key, t); return t;
}
