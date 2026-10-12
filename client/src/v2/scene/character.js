// Editable GLB anatomy with body morphs, fitted clothes and hair. The animation
// skeleton is fitted to each adult model so its authored proportions are preserved.
// look = { body:'m'|'f', skin:1..8, hair, hairCol, beard, top, topCol, bottom, bottomCol, full?, fullCol?, shoes, shoesCol,
//          hat, hatCol, glasses, neck, neckCol }
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { fabric, hairTex } from './textures.js';
import { humanBody } from './human.js';
import { applyPose } from './poses.js';

export const SKIN = { 1: '#f3cfb0', 2: '#e2b08a', 3: '#c68a5f', 4: '#a26a45', 5: '#7d4b2e', 6: '#5f3621', 7: '#472616', 8: '#33190d' };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SLEEVE = { tee: 'short', flagtee: 'short', polo: 'short', jersey: 'short', ankara: 'short', kenteshirt: 'short', kaba: 'puff', crop: 'short', fugu: 'wide', blouse: 'short', hoodie: 'long', office: 'long', suit: 'long', kaftan: 'long', singlet: 'none', sundress: 'none', ankaradress: 'short', kentedress: 'none', bodycon: 'none', kentecloth: 'none' };
const LONGPANTS = { jeans: 1, joggers: 1, chinos: 1, suitpants: 1, ankarapants: 1 };
const SKIRT = { slit: 'long', mini: 'mini', pencil: 'knee', kenteskirt: 'long', sundress: 'knee', ankaradress: 'flare', kentedress: 'long', bodycon: 'knee', kentecloth: 'robe', kaftan: 'kaftan' };

// ---------- geometry accumulator: one group per material key ----------
class Geo {
  constructor() { this.g = new Map(); }
  grp(k) { let G = this.g.get(k); if (!G) this.g.set(k, (G = { p: [], n: [], uv: [], si: [], sw: [], ix: [] })); return G; }
  v(G, p, n, u, v, w) { G.p.push(p.x, p.y, p.z); G.n.push(n.x, n.y, n.z); G.uv.push(u, v); const ws = w.slice(0, 4); let s = 0; for (const [, x] of ws) s += x; for (let i = 0; i < 4; i++) { const e = ws[i]; G.si.push(e ? e[0] : 0); G.sw.push(e ? e[1] / s : 0); } return G.p.length / 3 - 1; }
  // tube through ring centres; rings: {c, rx, rz, w}; fwd = reference forward; sq = superellipse squareness
  tube(k, rings, o = {}) {
    if (o.smooth !== false && rings.length > 2) rings = smoothRings(rings);
    const G = this.grp(k), seg = o.seg || 20, fwd = o.fwd || V(0, 0, 1), n = o.sq || 2, uS = o.u || 1; let len = 0; const base = G.p.length / 3;
    const fr = rings.map((r, i) => { const a = rings[Math.max(0, i - 1)].c, b = rings[Math.min(rings.length - 1, i + 1)].c; const T = b.clone().sub(a).normalize(); let side = T.clone().cross(fwd); if (side.lengthSq() < 1e-6) side = V(1, 0, 0); side.normalize(); const f2 = side.clone().cross(T).normalize(); return { T, side, f2 }; });
    rings.forEach((r, i) => { if (i) len += r.c.distanceTo(rings[i - 1].c); const { side, f2 } = fr[i];
      for (let s = 0; s <= seg; s++) { const a = (s / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); const cs = Math.sign(ca) * Math.abs(ca) ** (2 / n), sn = Math.sign(sa) * Math.abs(sa) ** (2 / n);
        const breast = o.bust; const x = cs * r.rx; const fullness = breast && sa > 0 ? breast.amount * Math.exp(-(((r.c.y - breast.y) / .105) ** 2)) * (Math.exp(-(((x - breast.x) / breast.width) ** 2)) + Math.exp(-(((x + breast.x) / breast.width) ** 2))) * sa ** 2 : 0;
        const off = (r.oz || 0) * Math.max(0, sa) ** 3 + fullness; const p = r.c.clone().addScaledVector(side, cs * r.rx).addScaledVector(f2, sn * r.rz + off); if (o.crotch && i === 0) p.y -= .06 * Math.abs(ca) ** 2; const prev = rings[Math.max(0,i-1)], next = rings[Math.min(rings.length-1,i+1)], distance = Math.max(.001,prev.c.distanceTo(next.c)); const slope = (Math.abs(cs)*(next.rx-prev.rx)+Math.abs(sn)*(next.rz-prev.rz))/distance; const nn = side.clone().multiplyScalar(cs / r.rx).addScaledVector(f2, sn / r.rz).normalize().addScaledVector(fr[i].T,-slope).normalize();
        if (breast && sa > 0) {
          const dx1=x-breast.x, dx2=x+breast.x, w=breast.width, yy=r.c.y-breast.y;
          const common=breast.amount*Math.exp(-((yy/.105)**2))*sa*sa;
          const gx=common*(-2*dx1/(w*w)*Math.exp(-((dx1/w)**2))-2*dx2/(w*w)*Math.exp(-((dx2/w)**2)));
          const gy=-2*yy/(.105*.105)*fullness;
          nn.x-=gx*nn.z; nn.y-=gy*nn.z; nn.normalize();
        }
        this.v(G, p, nn, (1 - s / seg) * uS, o.vFix ? i / (rings.length - 1) : len * (o.v || 3), r.w); } });
    const row = seg + 1; for (let i = 0; i < rings.length - 1; i++) for (let s = 0; s < seg; s++) { const a = base + i * row + s, b = a + row; G.ix.push(a, b, a + 1, a + 1, b, b + 1); }
    const cap = (i, flip) => { const r = rings[i]; const c = this.v(G, r.c, fr[i].T.clone().multiplyScalar(flip ? 1 : -1), 0.5, 0.5, r.w); for (let s = 0; s < seg; s++) { const a = base + i * row + s; flip ? G.ix.push(c, a, a + 1) : G.ix.push(c, a + 1, a); } };
    if (o.cap0) cap(0, false); if (o.cap1) cap(rings.length - 1, true);
  }
  // ellipsoid with axes (X,Y,Z unit vectors scaled by radii); keep(dir) filters faces by local direction
  ell(k, c, X, Y, Z, w, o = {}) {
    const G = this.grp(k), la = o.lat || 14, lo = o.lon || 20, base = G.p.length / 3; const wf = typeof w === 'function' ? w : () => w;
    for (let i = 0; i <= la; i++) { const th = (i / la) * Math.PI; for (let j = 0; j <= lo; j++) { const ph = (j / lo) * Math.PI * 2; const d = V(Math.sin(th) * Math.sin(ph), Math.cos(th), -Math.sin(th) * Math.cos(ph)); // ph=π → +z (front) → u=0.5
      const p = c.clone().addScaledVector(X, d.x).addScaledVector(Y, d.y).addScaledVector(Z, d.z); const nn = X.clone().multiplyScalar(d.x / X.lengthSq()).addScaledVector(Y, d.y / Y.lengthSq()).addScaledVector(Z, d.z / Z.lengthSq()).normalize();
      this.v(G, p, nn, j / lo * (o.u || 1), 1 - i / la, wf(d)); } }
    const row = lo + 1; for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) { const a = base + i * row + j, b = a + row; if (o.keep) { const th = ((i + 0.5) / la) * Math.PI, ph = ((j + 0.5) / lo) * Math.PI * 2; if (!o.keep(V(Math.sin(th) * Math.sin(ph), Math.cos(th), -Math.sin(th) * Math.cos(ph)))) continue; } G.ix.push(a, a + 1, b, a + 1, b + 1, b); }
  }
  geometries() { const out = {}; for (const [k, G] of this.g) { if (!G.ix.length) continue; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(G.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2)); g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(G.si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(G.sw, 4)); g.setIndex(G.ix); g.computeBoundingSphere(); out[k] = g; } return out; }
}

// Rounded anatomical profiles, including soft joint transitions. Bone weights interpolate
// with the shape so limbs retain their silhouette when the mocap rig bends.
function smoothRings(rings) {
  const out = [], curve = (a, b, c, d, t) => .5 * ((2*b) + (-a+c)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t*t*t);
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[Math.max(0,i-1)], b = rings[i], c = rings[i+1], d = rings[Math.min(rings.length-1,i+2)];
    for (let j = 0; j < 4; j++) {
      const t = j/4, weights = new Map();
      for (const [id,w] of b.w) weights.set(id,(weights.get(id)||0)+w*(1-t));
      for (const [id,w] of c.w) weights.set(id,(weights.get(id)||0)+w*t);
      out.push({ c: b.c.clone().lerp(c.c,t), rx: Math.max(.002,curve(a.rx,b.rx,c.rx,d.rx,t)), rz: Math.max(.002,curve(a.rz,b.rz,c.rz,d.rz,t)), oz: (b.oz||0)*(1-t)+(c.oz||0)*t, w: [...weights].sort((a,b)=>b[1]-a[1]) });
    }
  }
  out.push(rings.at(-1)); return out;
}

// ---------- the body ----------
// B: bone positions (mesh-local), I: bone name → skeleton index
function buildBody(look, B, I) {
  const f = look.body === 'f', geo = new Geo(), w1 = (n) => [[I[n], 1]], w2 = (a, b, t) => [[I[a], 1 - t], [I[b], t]];
  const full = look.full || null, top = full || look.top, bottom = full ? null : look.bottom;
  const sleeve = SLEEVE[top] || 'short', skirt = SKIRT[full] || SKIRT[bottom] || (top === 'kaftan' ? 'kaftan' : null);
  const longPants = !full && LONGPANTS[bottom], shorts = !full && bottom === 'shorts';
  const M = { skin: 'skin', top: 'topF', topP: 'topP', bot: full ? 'topP' : 'botP', shoe: 'shoe' };
  const build = Math.max(0, Math.min(1, Number(look.build ?? .5))), hips = Math.max(0, Math.min(1, Number(look.hips ?? .5))), bust = Math.max(0, Math.min(1, Number(look.bust ?? .45)));
  const mass = .82 + build * .36;
  const inf = 0.007; // cloth sits slightly outside the body
  // ----- torso -----
  const H = B.Hips, S0 = B.Spine, S1 = B.Spine1, S2 = B.Spine2, N = B.Neck;
  const T = f ? { cr: [0.175, 0.12], hip: [0.198, 0.13], wa: [0.142, 0.104], be: [0.15, 0.108], ch: [0.162, 0.125, 0.024], sh: [0.168, 0.102], nk: [0.062, 0.06] }
    : { cr: [0.162, 0.112], hip: [0.172, 0.118], wa: [0.16, 0.11], be: [0.168, 0.113], ch: [0.186, 0.122, 0.008], sh: [0.194, 0.108], nk: [0.07, 0.066] };
  for (const [key, r] of Object.entries(T)) { if (key === 'nk') continue; const shape = ['hip', 'cr'].includes(key) ? .86 + hips * .28 : 1; r[0] *= mass * shape; r[1] *= .9 + build * .2; }
  const R = (c, r, w, g = 0) => ({ c, rx: r[0] + g, rz: r[1] + g, oz: r[2] || 0, w });
  const yC = H.y - 0.075, yHem = H.y + 0.03;
  const torso = [R(V(0, yC, H.z), T.cr, w1('Hips')), R(V(0, H.y, H.z), T.hip, w1('Hips')), R(V(0, S0.y, S0.z), T.wa, w2('Hips', 'Spine', 0.7)), R(V(0, S1.y, S1.z), T.be, w2('Spine', 'Spine1', 0.7)), R(V(0, S2.y, S2.z), T.ch, w2('Spine1', 'Spine2', 0.8)), R(V(0, N.y - 0.065, N.z), T.sh, w1('Spine2')), R(V(0, N.y + 0.005, N.z + 0.005), T.nk, w2('Spine2', 'Neck', 0.5))];
  const breast = f ? { y: S2.y - .048, amount: .022 + bust * .07, x: .055 * mass, width: .045 + bust * .016 } : null;
  const shapeOptions = { seg: 32, smooth: true, bust: breast };
  // split torso into the bottom garment (below the hem) and the top garment (above). A crop top shows the belly.
  const split = (rings, y) => { const lo = [], hi = []; for (let i = 0; i < rings.length; i++) { const r = rings[i]; if (r.c.y <= y) lo.push(r); else hi.push(r); }
    const a = lo[lo.length - 1], b = hi[0]; if (a && b) { const t = (y - a.c.y) / (b.c.y - a.c.y); const m = { c: a.c.clone().lerp(b.c, t), rx: a.rx + (b.rx - a.rx) * t, rz: a.rz + (b.rz - a.rz) * t, oz: 0, w: t < 0.5 ? a.w : b.w }; lo.push(m); hi.unshift(m); } return [lo, hi]; };
  const g = (rs, d) => rs.map((r) => ({ ...r, rx: r.rx + d, rz: r.rz + d }));
  if (full) geo.tube(M.top, g(torso, inf), { ...shapeOptions, vFix: true, cap0: true });
  else { const [lo, hi] = split(torso, yHem); geo.tube(M.bot, g(lo, inf * 0.8), { ...shapeOptions, cap0: false, crotch: true, v: 3 });
    if (top === 'crop') { const [mid, up] = split(hi, S1.y + 0.03); geo.tube(M.skin, mid, { ...shapeOptions, v: 3 }); geo.tube(M.top, g(up, inf), { ...shapeOptions, vFix: true }); }
    else geo.tube(M.top, g(hi, inf).map((r, i) => i === 0 ? { ...r, rx: r.rx + 0.008, rz: r.rz + 0.008 } : r), { ...shapeOptions, vFix: true }); }
  geo.tube(M.skin, [R(V(0, N.y - 0.03, N.z), T.nk, w1('Neck')), R(B.Head.clone().add(V(0, 0.02, 0)), [T.nk[0] * 0.9, T.nk[1] * 0.9], w2('Neck', 'Head', 0.6))]);
  if (['office', 'polo', 'suit', 'kaftan', 'blouse'].includes(top)) geo.tube(M.top, [R(V(0, N.y - 0.035, N.z), [T.nk[0] + 0.02, T.nk[1] + 0.02], w1('Spine2')), R(V(0, N.y + 0.01, N.z + 0.004), [T.nk[0] + 0.012, T.nk[1] + 0.012], w2('Spine2', 'Neck', 0.5))], { seg: 16 });
  if (top === 'hoodie') geo.tube(M.topP, [R(V(0, N.y - 0.03, N.z - 0.01), [0.12, 0.1], w1('Spine2')), R(V(0, N.y + 0.02, N.z - 0.03), [0.1, 0.08], w2('Spine2', 'Neck', 0.5))], { seg: 16 });
  if (top === 'kaba' || top === 'kaftan' && false) geo.tube(M.topP, [R(V(0, S0.y + 0.02, S0.z), [T.wa[0] + 0.012, T.wa[1] + 0.012], w1('Spine')), R(V(0, S0.y - 0.07, S0.z), [T.hip[0] + 0.05, T.hip[1] + 0.05], w1('Hips'))], { seg: 18 }); // peplum
  // ----- arms -----
  for (const s of ['Left', 'Right']) {
    const A = B[s + 'Arm'], F = B[s + 'ForeArm'], Hd = B[s + 'Hand'], sh = B[s + 'Shoulder'];
    const k = (f ? 0.88 : 1) * mass, rA = 0.066 * k, rE = 0.05 * k, rW = 0.036 * k;
    const at = (a, b, t) => a.clone().lerp(b, t);
    const up = [{ c: at(sh, A, 0.55), r: rA * 0.96, w: w2(s + 'Shoulder', s + 'Arm', 0.5) }, { c: A, r: rA, w: w1(s + 'Arm') }, { c: at(A, F, 0.5), r: rA * 0.92, w: w1(s + 'Arm') }, { c: F, r: rE, w: w2(s + 'Arm', s + 'ForeArm', 0.5) }];
    const lo = [{ c: F, r: rE, w: w2(s + 'Arm', s + 'ForeArm', 0.5) }, { c: at(F, Hd, 0.45), r: rE * 0.95, w: w1(s + 'ForeArm') }, { c: Hd, r: rW, w: w2(s + 'ForeArm', s + 'Hand', 0.4) }];
    const ring = (q, d = 0) => ({ c: q.c, rx: q.r + d, rz: q.r + d, w: q.w });
    const fw = V(0, 0, 1);
    if (sleeve === 'none') { geo.tube(M.skin, up.map((q) => ring(q)), { fwd: fw }); }
    else if (sleeve === 'long') geo.tube(M.topP, up.map((q) => ring(q, inf)), { fwd: fw });
    else { // short / puff / wide: sleeve covers the upper half of the upper arm
      const mid = { c: at(A, F, 0.45), r: rA * 0.95, w: w1(s + 'Arm') }; const flare = sleeve === 'wide' ? 0.03 : sleeve === 'puff' ? 0.022 : 0.002;
      geo.tube(M.topP, [ring(up[0], inf), ring(up[1], inf + flare * 0.6), ring(mid, inf + flare)], { fwd: fw });
      geo.tube(M.skin, [ring(mid, -0.004), ring(up[2]), ring(up[3])], { fwd: fw }); }
    geo.tube(sleeve === 'long' ? M.topP : M.skin, lo.map((q) => ring(q, sleeve === 'long' ? inf : 0)), { fwd: fw, cap1: sleeve !== 'long' });
    if (sleeve === 'long') geo.tube(M.skin, [ring(lo[2], -0.002), { c: at(Hd, B[s + 'HandMiddle1'], 0.3), rx: rW * 0.9, rz: rW * 0.9, w: w1(s + 'Hand') }], { fwd: fw });
    // deltoid (bare shoulders only; sleeves start wide enough)
    if (sleeve === 'none') geo.ell(M.skin, A.clone().add(V(0, 0.01, 0)), V(rA * 1.08, 0, 0), V(0, rA * 1.0, 0), V(0, 0, rA * 0.98), w2('Spine2', s + 'Arm', 0.6), { lat: 8, lon: 12 });
  }
  // ----- legs -----
  for (const s of ['Left', 'Right']) {
    const U = B[s + 'UpLeg'], L = B[s + 'Leg'], F = B[s + 'Foot'], k = (f ? 1.06 : 1) * mass * (.92 + hips * .16);
    const at = (a, b, t) => a.clone().lerp(b, t);
    const th = [{ c: U.clone().add(V(0, 0.03, 0)), r: 0.098 * k, w: w2('Hips', s + 'UpLeg', 0.7) }, { c: at(U, L, 0.25), r: 0.094 * k, w: w1(s + 'UpLeg') }, { c: at(U, L, 0.62), r: 0.078 * k, w: w1(s + 'UpLeg') }, { c: L, r: 0.062, w: w2(s + 'UpLeg', s + 'Leg', 0.5) }];
    const ank = F.clone().setY(0.075); const sh = [{ c: L, r: 0.062, w: w2(s + 'UpLeg', s + 'Leg', 0.5) }, { c: at(L, F, 0.3), r: 0.066, w: w1(s + 'Leg') }, { c: at(L, F, 0.72), r: 0.05, w: w1(s + 'Leg') }, { c: ank, r: 0.044, w: w2(s + 'Leg', s + 'Foot', 0.6) }];
    const ring = (q, d = 0) => ({ c: q.c, rx: q.r + d, rz: q.r + d, w: q.w });
    if (longPants) { geo.tube(M.bot, th.map((q) => ring(q, inf)), {}); geo.tube(M.bot, sh.map((q, i) => ring(q, inf + (i === 3 ? 0.012 : 0))), {}); }
    else if (shorts) { const mid = { c: at(U, L, 0.7), r: 0.075, w: w1(s + 'UpLeg') }; geo.tube(M.bot, [ring(th[0], inf + 0.006), ring(th[1], inf + 0.008), ring(mid, inf + 0.01)]); geo.tube(M.skin, [ring(mid, -0.004), ring(th[3])]); geo.tube(M.skin, sh.map((q) => ring(q))); }
    else { geo.tube(M.skin, th.map((q) => ring(q))); geo.tube(M.skin, sh.map((q) => ring(q))); }
    // shoes / feet
    const toe = B[s + 'Toe_End'], heel = F.clone().add(V(0, -0.09, -0.06)); heel.y = 0.0; const fwd = toe.clone().sub(heel); fwd.y = 0; const len = fwd.length(); fwd.normalize(); const sideF = fwd.clone().cross(V(0, 1, 0)).normalize();
    const wF = (d) => (d.z > 0.1 ? w2(s + 'Foot', s + 'ToeBase', 0.7) : w1(s + 'Foot'));
    const shoe = look.shoes || 'slides', c = heel.clone().addScaledVector(fwd, len * 0.5);
    const box = (k2, cy, hgt, wd, ln, keep) => geo.ell(k2, V(c.x, cy, c.z).addScaledVector(fwd, (ln - len) * 0.5 * 0), sideF.clone().multiplyScalar(-wd), V(0, hgt, 0), fwd.clone().multiplyScalar(ln * 0.5), wF, { lat: 8, lon: 14, keep });
    if (shoe === 'slides' || shoe === 'ahenema') { box(M.skin, 0.045, 0.04, 0.048, len * 0.86); box(M.shoe, 0.012, 0.013, 0.056, len * 0.94); geo.tube(M.shoe, [{ c: c.clone().addScaledVector(fwd, len * 0.12).setY(0.045), rx: 0.046, rz: 0.03, w: w1(s + 'Foot') }, { c: c.clone().addScaledVector(fwd, len * 0.22).setY(0.045), rx: 0.046, rz: 0.03, w: w2(s + 'Foot', s + 'ToeBase', 0.5) }], { fwd: V(0, 1, 0), seg: 12 }); }
    else if (shoe === 'heels') { box(M.shoe, 0.06, 0.04, 0.046, len * 0.84); geo.tube(M.shoe, [{ c: heel.clone().addScaledVector(fwd, 0.04).setY(0.0), rx: 0.012, rz: 0.012, w: w1(s + 'Foot') }, { c: heel.clone().addScaledVector(fwd, 0.04).setY(0.07), rx: 0.016, rz: 0.016, w: w1(s + 'Foot') }], { cap0: true, seg: 8 }); }
    else if (shoe === 'boots') { box(M.shoe, 0.05, 0.055, 0.058, len * 0.92); geo.tube(M.shoe, [{ c: F.clone().setY(0.05), rx: 0.05, rz: 0.055, w: w1(s + 'Foot') }, { c: F.clone().add(V(0, 0.06, 0)), rx: 0.047, rz: 0.05, w: w2(s + 'Foot', s + 'Leg', 0.5) }]); }
    else { box(M.shoe, 0.05, 0.052, 0.058, len * 0.92); if (shoe === 'sneakers') box('sole', 0.016, 0.018, 0.062, len * 0.95); }
  }
  // ----- skirts, dresses, kaftan tails -----
  if (skirt) {
    const yTop = skirt === 'kaftan' ? H.y - 0.02 : H.y + 0.02, knee = B.LeftLeg.y, ank = B.LeftFoot.y + 0.04;
    const spec = { mini: [knee + 0.22, 0.2, 0.5], knee: [knee - 0.02, 0.19, 0.6], flare: [knee - 0.04, 0.3, 0.3], long: [ank + 0.02, 0.215, 0.85], robe: [ank, 0.27, 0.4], kaftan: [knee - 0.12, 0.22, 0.55] }[skirt];
    const [yBot, rBot, follow] = spec; const n = 7; const rings = [];
    for (let i = 0; i <= n; i++) { const t = i / n, y = yTop + (yBot - yTop) * t; const rx = T.hip[0] + 0.015 + (rBot - T.hip[0]) * Math.pow(t, skirt === 'flare' ? 1.4 : 1); rings.push({ c: V(0, y, H.z), rx, rz: rx * 0.78, t }); }
    // vertices follow the nearest leg the further down the skirt they are (so legs don't poke through when walking)
    const G = geo.grp(full ? M.top : skirt === 'kaftan' ? M.topP : M.bot), seg = 22, base = G.p.length / 3;
    rings.forEach((r) => { for (let sI = 0; sI <= seg; sI++) { const a = (sI / seg) * Math.PI * 2; const x = Math.cos(a) * r.rx, z = Math.sin(a) * r.rz; const side = x > 0 ? 'Left' : 'Right';
      const lw = Math.min(1, Math.abs(x) / (r.rx * 0.7)) * r.t * follow; const below = r.c.y < knee; const w = [[I.Hips, 1 - lw], [I[side + (below ? 'Leg' : 'UpLeg')], lw]];
      geo.v(G, V(x, r.c.y, r.c.z + z), V(Math.cos(a), 0.15, Math.sin(a)).normalize(), sI / seg * 2, (1 - r.t) * 2, w); } });
    const row = seg + 1; for (let i = 0; i < n; i++) for (let sI = 0; sI < seg; sI++) { const a = base + i * row + sI, b = a + row; G.ix.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  // ----- head -----
  const HC = BASE.human.native?B.Head.clone().add(V(0,.045,.008)):BASE.headCenter.clone(), hr = [0.096, 0.12, 0.105];
  hairAndExtras(geo, look, B, I, HC, hr, f);
  const parts = { ...geo.geometries(), face: faceGeometry(f), eyes: BASE.eyeGeometry, teeth: BASE.teethGeometry, hands: BASE.handGeometry };
  if (!f && ['stubble','goatee','fullbeard'].includes(look.beard)) parts.beard = beardGeometry(look.beard);
  if (['lowcut', 'fade', 'waves', 'twa', 'cornrows'].includes(look.hair)) parts.hair = scalp(look.hair);
  const anatomical=humanBody(BASE.human,look,B,I);
  // Retain garment skirts, shoes and accessories; the continuous mesh supplies anatomy and fitted clothes.
  for(const key of ['skin','topF','topP','botP','face','eyes','teeth','hands','beard']) {
    if(skirt&&['topF','topP','botP'].includes(key)&&parts[key]) {
      const old=parts[key], pos=old.attributes.position, indices=[];
      for(let i=0;i<old.index.count;i+=3){const ids=[old.index.getX(i),old.index.getX(i+1),old.index.getX(i+2)];if(ids.every(id=>pos.getY(id)<=H.y+.035))indices.push(...ids);}
      if(indices.length){const g=old.clone();g.setIndex(indices);parts['skirt'+key]=g;}
    }
    delete parts[key];
  }
  if(['lowcut','fade','waves','twa','cornrows'].includes(look.hair))delete parts.hair;
  const result={...parts,...anatomical};
  // A slightly fuller head and a visible neck balance the adult silhouette. Apply
  // the same transform to hair, eyes and accessories so customisation stays aligned.
  if(!BASE.human.native)for(const geometry of Object.values(result)){const p=geometry.attributes.position,ids=geometry.attributes.skinIndex,w=geometry.attributes.skinWeight;
    for(let i=0;i<p.count;i++){let influence=0;for(let k=0;k<4;k++)if(ids.array[i*4+k]===I.Head)influence+=w.array[i*4+k];if(!influence)continue;
      p.setXYZ(i,p.getX(i)*(1+.12*influence),B.Head.y+(p.getY(i)-B.Head.y)*(1+.10*influence)+.035*influence,B.Head.z+(p.getZ(i)-B.Head.z)*(1+.10*influence));}
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
  }
  return result;
}
function faceGeometry(female) {
  if (!female) return BASE.headGeometry;
  if (BASE.femaleHead) return BASE.femaleHead;
  const g=BASE.headGeometry.clone(), p=g.getAttribute('position'), cy=BASE.headCenter.y;
  for(let i=0;i<p.count;i++) { const y=p.getY(i), t=Math.max(0,Math.min(1,(cy+.025-y)/.13)); p.setXYZ(i,p.getX(i)*(1-.12*t),y+.008*t,p.getZ(i)); }
  g.computeVertexNormals();g.computeBoundingSphere();BASE.femaleHead=g;return g;
}
function beardGeometry(style) {
  const g=BASE.headGeometry.clone(), p=g.getAttribute('position'), index=g.index, cy=BASE.headCenter.y, indices=[];
  const keep=(id)=> { const x=p.getX(id),y=p.getY(id),z=p.getZ(id);
    if (y<cy-.112 || y>cy+.008 || z<.035) return false;
    if (style==='goatee' && Math.abs(x)>.038) return false;
    // Leave the lips and the centre of the upper cheeks visible.
    if (Math.abs(x)<.028 && y>cy-.052 && y<cy-.022) return false;
    return y<cy-.012 || Math.abs(x)>.045;
  };
  for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(ids.every(keep)) indices.push(...ids);}
  for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)*1.012,p.getY(i),p.getZ(i)+.002);
  g.setIndex(indices);g.computeBoundingSphere();return g;
}
function scalp(style) {
  const g = BASE.headGeometry.clone(), p = g.getAttribute('position'), center = BASE.headCenter;
  const indices = [], index = g.index;
  const keep = (i) => { const y = p.getY(i), z = p.getZ(i); const front = z > center.z + .02;
    return y > center.y + (front ? .06 : style === 'fade' ? .04 : -.012); };
  for (let i = 0; i < index.count; i += 3) { const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2); if (keep(a) && keep(b) && keep(c)) indices.push(a, b, c); }
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * 1.025, center.y + (p.getY(i) - center.y) * 1.025, center.z + (p.getZ(i) - center.z) * 1.025);
  g.setIndex(indices); g.computeBoundingSphere(); return g;
}
function hairAndExtras(geo, look, B, I, HC, hr, f) {
  const wH = [[I.Head, 1]], h = look.hair || 'lowcut';
  const shell = (k, sc, keep, off = V(0, 0, 0), o = {}) => k==='hair' ? undefined : geo.ell(k, HC.clone().add(off), V(hr[0] * sc[0], 0, 0), V(0, hr[1] * sc[1], 0), V(0, 0, hr[2] * sc[2]), wH, { lat: 16, lon: 24, keep, u: o.u || 3 });
  const hairline = (d) => d.y > -0.05 - (d.z < 0 ? 0.55 : 0) && !(d.z > 0.45 && d.y < 0.42); // above the forehead, lower at the back
  const strands = (count, len, r, spread, droop, seed = 1) => { let s = seed; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < count; i++) { const ph = rnd() * Math.PI * 2, th = 0.25 + rnd() * spread; const d = V(Math.sin(th) * Math.sin(ph), Math.cos(th), -Math.sin(th) * Math.cos(ph)); if (d.z > -0.05 && Math.abs(d.x) < 0.8) continue;
      const p0 = HC.clone().add(V(d.x * hr[0], d.y * hr[1], d.z * hr[2])); const pts = [p0]; let p = p0.clone(), dir = d.clone(); for (let k = 1; k <= 5; k++) { dir.lerp(V(0, -1, 0), droop).normalize(); p = p.clone().addScaledVector(dir, len / 5); pts.push(p); }
      geo.tube('hair', pts.map((c, k) => ({ c, rx: r * (1 - k * 0.06), rz: r * (1 - k * 0.06), w: wH })), { seg: 5, cap1: true }); } };
  switch (h) {
    case 'bald': break;
    case 'lowcut': case 'fade': case 'waves': case 'twa': shell('hair', [1.035, 1.03, 1.035], (d) => hairline(d) && (h !== 'fade' || d.y > 0.25 || d.z < -0.2)); break;
    case 'cornrows': shell('hair', [1.04, 1.04, 1.04], hairline); break;
    case 'afro': shell('hair', [1.03, 1.03, 1.03], hairline); geo.ell('hair', HC.clone().add(V(0, 0.06, -0.02)), V(0.15, 0, 0), V(0, 0.13, 0), V(0, 0, 0.145), wH, { lat: 12, lon: 18, keep: (d) => !(d.z > 0.55 && d.y < 0.2) && d.y > -0.45, u: 3 }); break;
    case 'puff': shell('hair', [1.035, 1.03, 1.035], hairline); geo.ell('hair', HC.clone().add(V(0, 0.13, -0.035)), V(0.085, 0, 0), V(0, 0.075, 0), V(0, 0, 0.085), wH, { lat: 10, lon: 14, u: 2 }); break;
    case 'bun': shell('hair', [1.035, 1.03, 1.035], hairline); geo.ell('hair', HC.clone().add(V(0, 0.07, -0.1)), V(0.05, 0, 0), V(0, 0.05, 0), V(0, 0, 0.05), wH, { lat: 8, lon: 12 }); break;
    case 'twists': shell('hair', [1.035, 1.03, 1.035], hairline); strands(46, 0.07, 0.013, 1.1, 0.05, 3); break;
    case 'locs': shell('hair', [1.04, 1.04, 1.04], hairline); strands(54, 0.2, 0.014, 1.25, 0.45, 5); break;
    case 'braids': shell('hair', [1.04, 1.035, 1.04], hairline); strands(70, 0.36, 0.011, 1.3, 0.6, 7); break;
    case 'bob': case 'bonestraight': { shell('hair', [1.05, 1.05, 1.06], hairline); const L = h === 'bob' ? 0.13 : 0.34, R0 = 0.112;
      const G = geo.grp('hair'), seg = 20, base = G.p.length / 3, n = 5;
      for (let i = 0; i <= n; i++) { const t = i / n, y = HC.y + 0.03 - L * t, r = R0 + 0.02 * t; for (let s = 0; s <= seg; s++) { const a = 0.82 * Math.PI + (s / seg) * 1.36 * Math.PI; const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.95; geo.v(G, V(HC.x + x, y, HC.z - 0.01 + z), V(Math.cos(a), 0, Math.sin(a)), s / seg * 3, t * 3, wH); } }
      const row = seg + 1; for (let i = 0; i < n; i++) for (let s = 0; s < seg; s++) { const a = base + i * row + s, b = a + row; G.ix.push(a, b, a + 1, a + 1, b, b + 1); } break; }
    case 'duku': { geo.ell('hat', HC.clone().add(V(0, 0.04, -0.015)), V(hr[0] * 1.14, 0, 0), V(0, hr[1] * 1.02, 0), V(0, 0, hr[2] * 1.12), wH, { lat: 14, lon: 20, keep: (d) => d.y > -0.05 && !(d.z > 0.6 && d.y < 0.45), u: 2 });
      geo.ell('hat', HC.clone().add(V(0, 0.15, 0.0)), V(0.11, 0, 0), V(0, 0.07, 0), V(0, 0, 0.08), wH, { lat: 10, lon: 14, u: 2 }); geo.ell('hat', HC.clone().add(V(0.05, 0.19, 0.03)), V(0.06, 0, 0), V(0, 0.045, 0), V(0, 0, 0.04), wH, { lat: 8, lon: 10 }); break; }
  }
  // hats
  const hat = look.hat;
  if (hat === 'cap') { shell('hat', [1.09, 1.05, 1.09], (d) => d.y > 0.12, V(0, 0.004, 0)); geo.ell('hat', HC.clone().add(V(0, hr[1] * 0.28, hr[2] * 1.15)), V(0.075, 0, 0), V(0, 0.008, 0), V(0, 0, 0.06), wH, { lat: 4, lon: 14 }); }
  if (hat === 'bucket') { shell('hat', [1.1, 1.08, 1.1], (d) => d.y > 0.18, V(0, 0.01, 0)); geo.tube('hat', [{ c: HC.clone().add(V(0, hr[1] * 0.22, 0)), rx: hr[0] * 1.12, rz: hr[2] * 1.12, w: wH }, { c: HC.clone().add(V(0, hr[1] * 0.12, 0)), rx: hr[0] * 1.6, rz: hr[2] * 1.6, w: wH }], { fwd: V(0, 0, 1), seg: 20 }); }
  if (hat === 'kufi') geo.tube('hat', [{ c: HC.clone().add(V(0, hr[1] * 0.45, -0.01)), rx: hr[0] * 1.04, rz: hr[2] * 1.04, w: wH }, { c: HC.clone().add(V(0, hr[1] * 1.02, -0.01)), rx: hr[0] * 0.98, rz: hr[2] * 0.98, w: wH }], { cap1: true, seg: 20 });
  // glasses
  if (look.glasses === 'shades' || look.glasses === 'specs') { const k = look.glasses === 'shades' ? 'shades' : 'specs'; for (const s of [-1, 1]) geo.ell(k, HC.clone().add(V(s * 0.034, 0.008, hr[2] * 0.97)), V(0.026, 0, 0), V(0, 0.018, 0), V(0, 0, 0.006), wH, { lat: 6, lon: 10 });
    geo.tube('specs', [{ c: HC.clone().add(V(-0.012, 0.012, hr[2] * 1.0)), rx: 0.003, rz: 0.003, w: wH }, { c: HC.clone().add(V(0.012, 0.012, hr[2] * 1.0)), rx: 0.003, rz: 0.003, w: wH }], { seg: 4, fwd: V(0, 1, 0) }); }
  // necklaces
  const N = B.Neck; if (look.neck === 'chain' || look.neck === 'beads') { const G = look.neck === 'chain' ? 'gold' : 'beads'; const pts = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; pts.push({ c: V(Math.sin(a) * 0.085, N.y - 0.05 - Math.max(0, Math.cos(a)) * 0.07, N.z + Math.cos(a) * 0.075), rx: 0.006, rz: 0.006, w: [[I.Spine2, 1]] }); } geo.tube(G, pts, { seg: 5, fwd: V(0, 1, 0) }); }
  if (look.neck === 'stole') for (const s of [-1, 1]) geo.tube('stole', [{ c: V(s * 0.07, N.y - 0.01, N.z - 0.03), rx: 0.04, rz: 0.006, w: [[I.Spine2, 1]] }, { c: V(s * 0.085, N.y - 0.05, N.z + 0.11), rx: 0.04, rz: 0.006, w: [[I.Spine2, 1]] }, { c: V(s * 0.08, B.Spine1.y - 0.02, B.Spine1.z + 0.115), rx: 0.04, rz: 0.006, w: [[I.Spine1, 1]] }, { c: V(s * 0.08, B.Hips.y + 0.02, B.Hips.z + 0.12), rx: 0.04, rz: 0.006, w: [[I.Spine, 1]] }], { fwd: V(0, 0, 1), seg: 6, sq: 6, v: 2 });
}

// ---------- materials ----------
const MATS = new Map();
function mat(key, make) { if (!MATS.has(key)) MATS.set(key, make()); return MATS.get(key); }
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide, ...o });
function materials(look) {
  const f = look.body === 'f', skin = SKIN[look.skin] || SKIN[5]; const full = look.full, top = full || look.top, topCol = full ? look.fullCol : look.topCol;
  return {
    skin: mat('skin' + skin, () => std({ color: skin, roughness: 0.65 })),
    face: mat(`face${skin}`, () => std({ color: skin, map: BASE.skinDetail, roughness: 0.8 })),
    eyes: BASE.eyeMaterial, teeth: BASE.teethMaterial, hands: mat(`hands${skin}`, () => std({ color: skin, map: BASE.bodyDetail, roughness: .8 })),
    topF: mat(`tf${top}${topCol}`, () => std({ map: fabric(top, topCol, true) })),
    topP: mat(`tp${top}${topCol}`, () => std({ map: fabric(top, topCol) })),
    botP: mat(`bp${look.bottom}${look.bottomCol}`, () => std({ map: fabric(look.bottom, look.bottomCol) })),
    shoe: mat(`sh${look.shoes}${look.shoesCol}`, () => std({ color: look.shoesCol || '#17150f', roughness: 0.6 })),
    sole: mat('sole', () => std({ color: '#f4f4f2', roughness: 0.7 })),
    hair: mat(`hr${look.hair}${look.hairCol}`, () => std({ color: '#ffffff', map: hairTex(look.hair, look.hairCol || '#141010'), roughness: 0.9 })),
    beard: mat(`bd${look.beard}${look.hairCol}`, () => std({ map: hairTex('lowcut',look.hairCol || '#141010'), transparent:look.beard==='stubble', opacity:look.beard==='stubble' ? .30 : .82 })),
    hat: mat(`ht${look.hat}${look.hatCol}${look.hair}`, () => look.hair === 'duku' && (!look.hat || look.hat === 'nohat') ? std({ map: fabric('ankara', look.hatCol || '#7b2d8e') }) : std({ color: look.hatCol || '#17150f' })),
    shades: mat('shades', () => std({ color: '#0b0b0d', roughness: 0.15, metalness: 0.3 })), specs: mat('specs', () => std({ color: '#2a1d12', roughness: 0.4 })),
    gold: mat('gold', () => std({ color: '#d4a017', metalness: 0.9, roughness: 0.25 })), beads: mat('beads', () => std({ color: '#e76f51', roughness: 0.4 })),
    stole: mat('stole' + look.neckCol, () => std({ map: fabric('stole', look.neckCol || '#f2b632') })),
  };
}

// ---------- assembly ----------
let BASE = null; const GEO = new Map();
export function initCharacters(rpmGltf, clips, human) {
  const scene = rpmGltf.scene; scene.updateMatrixWorld(true); let sm = null; scene.traverse((o) => { if (!sm && o.isSkinnedMesh) sm = o; });
  const I = {}, B = {}; sm.skeleton.bones.forEach((b, i) => { I[b.name] = i; B[b.name] = scene.worldToLocal(b.getWorldPosition(V(0, 0, 0))); });
  const bb = new THREE.Box3(); for (const b of sm.skeleton.bones) bb.expandByPoint(B[b.name]); const scale = 1.76 / (bb.max.y + 0.02);
  // Reuse the authored anatomical face from the bundled rig. Keep the procedural
  // clothes and hair, but avoid painting cartoon eyes onto a sphere.
  const parts = {}; scene.traverse((o) => { if (o.isSkinnedMesh) parts[o.material.name] = o; });
  const inScene = (mesh) => {
    const g = mesh.geometry.clone();
    // These bundled meshes carry quantized expression targets. We use their neutral
    // face; stale morph bounds otherwise put procedural hair several metres above it.
    g.morphAttributes = {}; g.morphTargetsRelative = false;
    for (const name of ['position', 'normal']) { const a = g.getAttribute(name), values = []; for (let i = 0; i < a.count; i++) values.push(a.getX(i), a.getY(i), a.getZ(i)); g.setAttribute(name, new THREE.Float32BufferAttribute(values, 3)); }
    g.applyMatrix4(scene.matrixWorld.clone().invert().multiply(mesh.matrixWorld)); g.computeBoundingBox(); return g;
  };
  const headGeometry = inScene(parts.Wolf3D_Skin);
  const detail = (material) => { const canvas = document.createElement('canvas'), source = material.map.image;
  canvas.width = source.width; canvas.height = source.height; const ctx = canvas.getContext('2d'); ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) { const a = pixels.data; const value = Math.min(255, (a[i] * .3 + a[i + 1] * .59 + a[i + 2] * .11) * 1.65); a[i] = a[i + 1] = a[i + 2] = value; }
  ctx.putImageData(pixels, 0, 0); const skinDetail = new THREE.CanvasTexture(canvas); skinDetail.flipY = false; skinDetail.colorSpace = THREE.SRGBColorSpace; return skinDetail; };
  const skinDetail = detail(parts.Wolf3D_Skin.material), bodyDetail = detail(parts.Wolf3D_Body.material);
  const handGeometry = inScene(parts.Wolf3D_Body), hp = handGeometry.getAttribute('position'), hi = handGeometry.index, hands = [];
  for (let i=0;i<hi.count;i+=3) { const ids=[hi.getX(i),hi.getX(i+1),hi.getX(i+2)]; if(ids.every(id=>Math.abs(hp.getX(id))>.40)) hands.push(...ids); }
  handGeometry.setIndex(hands); handGeometry.computeBoundingSphere();
  BASE = { scene, I, B, scale, clips, human, names: sm.skeleton.bones.map((b) => b.name), headGeometry,
    eyeGeometry: inScene(parts.Wolf3D_Eye), teethGeometry: inScene(parts.Wolf3D_Teeth), eyeMaterial: parts.Wolf3D_Eye.material, teethMaterial: parts.Wolf3D_Teeth.material, skinDetail, bodyDetail, handGeometry,
    headCenter: V(0, headGeometry.boundingBox.max.y - .12, .018) };
}
const geoKey = (l) => [l.body, l.top, l.bottom, l.full || '', l.shoes, l.hair, l.beard, l.hat, l.glasses, l.neck,...['build','hips','bust','waist','shoulders','muscle','faceWidth','nose','lips'].map(k=>l[k]??(k==='bust'?.45:.5))].join('|');
export class Character {
  constructor(look = {}) {
    this.native=!!BASE.human.native;this.root = new THREE.Group(); this.model = SkeletonUtils.clone(BASE.scene); this.model.scale.setScalar(BASE.scale); this.root.add(this.model);
    const metas = []; this.model.traverse((o) => { if (o.isSkinnedMesh) metas.push(o); });
    const byName = {}; this.model.traverse((o) => { if (o.isBone) byName[o.name] = o; });
    for (const m of metas) m.parent.remove(m);
    this.model.updateMatrixWorld(true); this.bindM = this.model.matrixWorld.clone(); this.skeleton = new THREE.Skeleton(BASE.names.map((n) => byName[n]));
    this.restBones=this.skeleton.bones.map(b=>({b,position:b.position.clone(),quaternion:b.quaternion.clone()}));
    this.geometryRig=BASE.B;
    this.meshes = [];
    this.mixer = new THREE.AnimationMixer(this.model); this.actions = {};
    for (const k in BASE.clips) this.actions[k] = this.mixer.clipAction(BASE.clips[k]);
    if (this.actions.agree) this.actions.agree.setLoop(THREE.LoopOnce, 1);
    if (this.actions.shake) this.actions.shake.setLoop(THREE.LoopOnce, 1);
    this.mixer.addEventListener('finished', () => { if (this.oneShot) { this.oneShot = false; this.play(this.base || 'idle'); } });
    this.cur = null; this.setLook(look); this.play('idle', 0);
  }
  setLook(look) {
    look = { ...look }; if (look.skinTone && !look.skin) look.skin = look.skinTone; this.look = look; this.body = look.body === 'f' ? 'f' : 'm';
    for (const m of this.meshes) m.parent.remove(m); this.meshes = [];
    const changedRig=BASE.human.native&&this.rigBody!==this.body;
    if(changedRig)this.fitAnatomyRig();
    const k = geoKey(look); let geos = GEO.get(k); if (!geos) { geos = buildBody(look, this.geometryRig, BASE.I); GEO.set(k, geos); if (GEO.size > 32) GEO.delete(GEO.keys().next().value); }
    const M = materials(look); M.skin=mat('anatomy'+look.skin,()=>new THREE.MeshStandardMaterial({color:SKIN[look.skin]||SKIN[5],roughness:.72,vertexColors:true}));
    M.anatomicalScalp=M.hair;
    M.humanEyes=mat('humanEyes',()=>new THREE.MeshStandardMaterial({color:'#eee9df',roughness:.4})); M.humanIris=mat('humanIris',()=>new THREE.MeshStandardMaterial({color:'#21170f',roughness:.3}));
    for(const key of ['topF','topP','botP'])M['skirt'+key]=M[key];
    this.root.scale.setScalar((this.body === 'f' ? .955 : 1) * (.94 + Math.max(0, Math.min(1, Number(look.height ?? .5))) * .12));
    this.model.updateMatrixWorld(true);
    for (const key in geos) { const mesh = new THREE.SkinnedMesh(geos[key], M[key] || M.skin); mesh.name=key;mesh.castShadow = true; mesh.frustumCulled = false; this.model.add(mesh); mesh.updateMatrixWorld(true); mesh.bind(this.skeleton, this.bindM || (this.bindM = mesh.matrixWorld.clone())); this.meshes.push(mesh); }
    if(changedRig)this.play(this.curName||'idle',0);
  }
  fitAnatomyRig() {
    this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);
    for(const r of this.restBones){r.b.position.copy(r.position);r.b.quaternion.copy(r.quaternion);}
    this.model.updateMatrixWorld(true);
    const sex=this.body==='f'?'female':'male',source=BASE.human[sex],J=BASE.human.joints[sex];
    const ys=source.filter((_,i)=>i%3===1),ground=Math.min(...ys),unit=(1.76/BASE.scale)/(Math.max(...ys)-ground);
    const joints={Hips:'pelvis',Spine:'spine-4',Spine1:'spine-2',Spine2:'spine-1',Neck:'neck',Head:'head'};
    for(const side of ['Left','Right']){
      const prefix=side==='Left'?'l-':'r-';
      for(const [bone,joint] of Object.entries({Shoulder:'clavicle',Arm:'shoulder',ForeArm:'elbow',Hand:'hand',UpLeg:'upper-leg',Leg:'knee',Foot:'ankle',ToeBase:'foot-2',Toe_End:'foot-2',HandMiddle1:'finger-3-1'}))joints[side+bone]=prefix+joint;
    }
    const native={};
    for(const [name,key] of Object.entries(joints)){const p=V(...J[key]);p.y-=ground;p.multiplyScalar(unit);if(name.endsWith('Toe_End'))p.z+=.025;native[name]=p;}
    this.model.traverse(b=>{
      if(!b.isBone)return;
      let target=native[b.name];
      if(!target){let anchor=b.parent;while(anchor&&!native[anchor.name])anchor=anchor.parent;if(anchor&&BASE.B[b.name])target=BASE.B[b.name].clone().sub(BASE.B[anchor.name]).add(native[anchor.name]);}
      if(!target)return;
      b.position.copy(b.parent.worldToLocal(this.model.localToWorld(target.clone())));b.updateMatrixWorld(true);
    });
    this.model.updateMatrixWorld(true);
    const toModel=this.model.matrixWorld.clone().invert();
    this.skeleton.boneInverses=this.skeleton.bones.map(b=>this.bindM.clone().multiply(toModel.clone().multiply(b.matrixWorld)).invert());
    this.geometryRig=Object.fromEntries(this.skeleton.bones.map(b=>[b.name,this.model.worldToLocal(b.getWorldPosition(V(0,0,0)))]));
    const hip=this.skeleton.bones.find(b=>b.name==='Hips').position;
    const reference=BASE.clips.idle.tracks.find(t=>t.name==='Hips.position').values;
    this.actions={};
    for(const [name,originalClip] of Object.entries(BASE.clips)){
      const clip=originalClip.clone();
      for(const track of clip.tracks)if(track.name==='Hips.position')for(let i=0;i<track.values.length;i+=3){track.values[i]+=hip.x-reference[0];track.values[i+1]+=hip.y-reference[1];track.values[i+2]+=hip.z-reference[2];}
      this.actions[name]=this.mixer.clipAction(clip);
    }
    this.cur=null;this.oneShot=false;this.rigBody=this.body;
  }
  play(name, fade = 0.25) {
    if (this.oneShot) { if (name !== 'walk') { this.base = name; return; } this.oneShot = false; }
    const a = this.actions[name] || this.actions.idle; if (this.cur === a) return;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play(); if (this.cur) this.cur.fadeOut(fade); this.cur = a; this.curName = name;
  }
  gesture(name) { if (!this.actions[name]) return; this.oneShot = true; this.base = this.curName === name ? 'idle' : this.curName || 'idle'; this.cur && this.cur.fadeOut(0.2); const a = this.actions[name]; a.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.2).play(); this.cur = a; this.curName = name; }
  update(dt, speed) { if (this.curName === 'walk') this.actions.walk.timeScale = Math.max(0.6, speed / 1.5); this.mixer.update(dt);if(this.native&&this.curName==='idle')applyPose(this,'stand'); }
  dispose() { this.mixer.stopAllAction(); for (const m of this.meshes) m.parent && m.parent.remove(m); }
}
