// Cutaway room: floor + two back walls (front open, Sims-style), furniture from the kit, people walking a nav grid.
// Spec (shared by homes and venues):
// { w, d, floor, floorColor?, wallColor, wallH?, outdoor?, windows:[{wall:'back'|'left', at, w}], door:{wall, at},
//   sign:{text, bg, fg}, items:[{kind, x, z, rot, acts?, zone?, color?}], lights?:[{x,z,color,intensity}] }
// Room local coords: x in [-w/2, w/2], z in [-d/2, d/2]; back wall at z=-d/2, left wall at x=-w/2.
import * as THREE from 'three';
import { makeItem, floorMaterial } from './kit.js';
import { animatedScreen } from './screens.js';
import { applyPose } from './poses.js';

const CELL = 0.25;
export class Room {
  constructor(stage) { this.stage = stage; this.group = new THREE.Group(); stage.scene.add(this.group); this.people = new Map(); this.items = []; this.screens=[]; this.elapsed=0; this.ray = new THREE.Raycaster(); }
  dispose() {
    for(const s of this.screens){s.dispose();s.material.dispose();}this.screens=[];
    this.stage.scene.remove(this.group); for (const l of this.stage.lamps) this.stage.scene.remove(l); this.stage.lamps = [];
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  build(spec) {
    this.spec = spec; const { w, d } = spec, H = spec.wallH || 2.7, G = this.group;
    // floor slab with a thin dark edge so the cutaway reads as a diorama
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), floorMaterial(spec.floor || 'tiles', spec.floorColor, w, d));
    floor.position.y = -0.08; floor.receiveShadow = true; floor.userData.floor = true; G.add(floor); this.floor = floor;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3), new THREE.MeshStandardMaterial({ color: spec.outdoor ? '#8b7a5e' : '#3b3f46', roughness: 0.9 }));
    base.position.y = -0.41; base.receiveShadow = true; G.add(base);
    if (!spec.outdoor) {
      const wm = new THREE.MeshStandardMaterial({ color: spec.wallColor || '#e8e1d3', roughness: 0.92 });
      const skirt = new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.wallColor || '#e8e1d3').multiplyScalar(0.72), roughness: 0.9 });
      const wall = (len, side) => { // builds a wall with window/door holes along its length
        const holes = [...(spec.windows || []).filter((h) => h.wall === side).map((h) => ({ c: h.at, w: h.w || 1.2, y0: 0.95, y1: 2.05, win: true })),
          ...(spec.door && spec.door.wall === side ? [{ c: spec.door.at, w: 1.0, y0: 0, y1: 2.15 }] : [])].sort((a, b) => a.c - b.c);
        const g = new THREE.Group(); let x0 = -len / 2; const T = 0.14;
        const seg = (a, b, y0, y1) => { if (b - a < 0.01 || y1 - y0 < 0.01) return; const m = new THREE.Mesh(new THREE.BoxGeometry(b - a, y1 - y0, T), wm); m.position.set((a + b) / 2, (y0 + y1) / 2, 0); m.castShadow = true; m.receiveShadow = true; g.add(m); };
        for (const h of holes) { const hx = -len / 2 + h.c * len, a = hx - h.w / 2, b = hx + h.w / 2; seg(x0, a, 0, H); seg(a, b, 0, h.y0); seg(a, b, h.y1, H); x0 = b;
          if (h.win) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(h.w, h.y1 - h.y0), new THREE.MeshStandardMaterial({ color: '#bfe3f2', emissive: '#ffd9a0', emissiveIntensity: 0, transparent: true, opacity: 0.45, roughness: 0.1 })); gl.position.set(hx, (h.y0 + h.y1) / 2, 0); gl.userData.window = true; g.add(gl);
            const sill = new THREE.Mesh(new THREE.BoxGeometry(h.w + 0.1, 0.05, 0.22), skirt); sill.position.set(hx, h.y0, 0.05); g.add(sill);
            for (let k = 1; k < 4; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.025, h.y1 - h.y0, 0.025), new THREE.MeshStandardMaterial({ color: '#2b2f33', metalness: 0.6, roughness: 0.4 })); bar.position.set(hx - h.w / 2 + (k * h.w) / 4, (h.y0 + h.y1) / 2, 0.02); g.add(bar); } } }
        seg(x0, len / 2, 0, H);
        const sk = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, T + 0.02), skirt); sk.position.y = 0.06; g.add(sk);
        return g;
      };
      const back = wall(w, 'back'); back.position.set(0, 0, -d / 2 - 0.07); G.add(back);
      const left = wall(d, 'left'); left.rotation.y = Math.PI / 2; left.position.set(-w / 2 - 0.07, 0, 0); G.add(left);
      const cap = new THREE.MeshStandardMaterial({ color: '#2f3237', roughness: 0.8 });
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.28, 0.06, 0.28), cap); c1.position.set(0.0, H, -d / 2 - 0.07); G.add(c1);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, d + 0.28), cap); c2.position.set(-w / 2 - 0.07, H, 0); G.add(c2);
      if (spec.sign) G.add(signBoard(spec.sign, w, d, H));
    }
    // furniture
    for (const it of spec.items || []) this.addItem(it);
    for (const L of spec.lights || []) { const p = new THREE.PointLight(L.color || '#ffd59a', L.intensity || 6, L.dist || 7, 1.6); p.position.set(L.x, L.y || 2.3, L.z); p.userData.base = L.intensity || 6; this.stage.scene.add(p); this.stage.lamps.push(p); }
    if (!spec.lights) { const p = new THREE.PointLight('#ffd59a', 7, Math.max(w, d) * 1.2, 1.4); p.position.set(0, 2.4, 0); p.userData.base = 7; this.stage.scene.add(p); this.stage.lamps.push(p); }
    this.buildNav();
    // camera framing
    const st = this.stage; st.view.target.set(0, 0.6, 0); st.view.zoom = Math.max(w, d) * 1.05 + 2.5; st.zoomMin = 4.5; st.zoomMax = Math.max(w, d) * 1.6 + 4;
    st.bounds = [-w / 2, w / 2, -d / 2, d / 2]; st.applyView();
    const r = Math.max(w, d) * 0.75 + 2; const sc = st.key.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.updateProjectionMatrix();
    return this;
  }
  addItem(it) {
    const made = makeItem(it.kind, { ...it });
    const o = made.obj; o.position.set(it.x, it.y || 0, it.z); o.rotation.y = it.rot || 0;
    o.traverse((m) => { if (m.isMesh) { m.castShadow = m.userData.noShadow ? false : true; m.receiveShadow = true; } });
    o.traverse(m=>{if(m.userData.liveScreen){const scr=animatedScreen(m.userData.liveScreen);m.material=m.material.clone();m.material.map=m.material.emissiveMap=scr.texture;m.material.color.set('#fff');scr.kind=m.userData.liveScreen;scr.material=m.material;this.screens.push(scr);}});
    const rec = { spec: it, obj: o, size: made.size || [1, 1], use: made.use || [{ x: 0, z: 0.8, pose: 'stand' }], acts: it.acts || made.acts || [], walkable: made.walkable, label: it.label || made.label };
    o.traverse((m) => { if (m.isMesh) m.userData.itemRef = rec; });
    this.group.add(o); this.items.push(rec); if (this.nav) this.buildNav(); return rec;
  }
  removeItem(rec) { this.group.remove(rec.obj); this.items = this.items.filter((x) => x !== rec); this.buildNav(); }
  // world position + facing of an item's use point
  usePoint(rec, i = 0) {
    const u = rec.use[i] || rec.use[0]; const c = Math.cos(rec.obj.rotation.y), s = Math.sin(rec.obj.rotation.y);
    return { x: rec.obj.position.x + u.x * c + u.z * s, z: rec.obj.position.z - u.x * s + u.z * c, y: u.y || 0, yaw: rec.obj.rotation.y + (u.face != null ? u.face : Math.PI), pose: u.pose || 'stand' };
  }
  // ---------- navigation grid ----------
  buildNav() {
    const { w, d } = this.spec; const nx = Math.ceil(w / CELL), nz = Math.ceil(d / CELL); const g = new Uint8Array(nx * nz);
    const block = (cx, cz, hw, hd, rot) => { const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot)); const ex = hw * c + hd * s, ez = hw * s + hd * c;
      for (let i = Math.max(0, Math.floor((cx - ex + w / 2) / CELL)); i <= Math.min(nx - 1, Math.floor((cx + ex + w / 2) / CELL)); i++) for (let j = Math.max(0, Math.floor((cz - ez + d / 2) / CELL)); j <= Math.min(nz - 1, Math.floor((cz + ez + d / 2) / CELL)); j++) g[j * nx + i] = 1; };
    for (const r of this.items) if (!r.walkable) block(r.obj.position.x, r.obj.position.z, r.size[0] / 2, r.size[1] / 2, r.obj.rotation.y);
    for (let i = 0; i < nx; i++) { g[i] = 1; } for (let j = 0; j < nz; j++) g[j * nx] = 1; // keep off the walls
    this.nav = { g, nx, nz };
  }
  cellOf(x, z) { return [Math.max(0, Math.min(this.nav.nx - 1, Math.floor((x + this.spec.w / 2) / CELL))), Math.max(0, Math.min(this.nav.nz - 1, Math.floor((z + this.spec.d / 2) / CELL)))]; }
  free(i, j) { const n = this.nav; return i > 0 && j > 0 && i < n.nx && j < n.nz && !n.g[j * n.nx + i]; }
  nearestFree(x, z) { const [ci, cj] = this.cellOf(x, z); if (this.free(ci, cj)) return [ci, cj]; for (let r = 1; r < 12; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) if (Math.max(Math.abs(di), Math.abs(dj)) === r && this.free(ci + di, cj + dj)) return [ci + di, cj + dj]; return [ci, cj]; }
  path(x0, z0, x1, z1) {
    const { nx, nz } = this.nav; const [si, sj] = this.nearestFree(x0, z0), [ti, tj] = this.nearestFree(x1, z1); const start = sj * nx + si, goal = tj * nx + ti;
    const gS = new Float32Array(nx * nz).fill(1e9), came = new Int32Array(nx * nz).fill(-1), open = [start]; gS[start] = 0; const inOpen = new Uint8Array(nx * nz); inOpen[start] = 1;
    const hf = (k) => Math.hypot((k % nx) - ti, Math.floor(k / nx) - tj);
    let guard = 0;
    while (open.length && guard++ < 20000) {
      let bi = 0, bf = 1e9; for (let k = 0; k < open.length; k++) { const f = gS[open[k]] + hf(open[k]); if (f < bf) { bf = f; bi = k; } }
      const cur = open.splice(bi, 1)[0]; inOpen[cur] = 0; if (cur === goal) break;
      const ci = cur % nx, cj = Math.floor(cur / nx);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (!this.free(ni, nj)) continue; if (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj))) continue;
        const k = nj * nx + ni, ng = gS[cur] + (di && dj ? 1.414 : 1); if (ng < gS[k]) { gS[k] = ng; came[k] = cur; if (!inOpen[k]) { open.push(k); inOpen[k] = 1; } } }
    }
    if (came[goal] < 0 && goal !== start) return [[x1, z1]];
    const cells = []; for (let k = goal; k !== -1 && k !== start; k = came[k]) cells.push(k); cells.reverse();
    const pts = cells.map((k) => [(k % nx + 0.5) * CELL - this.spec.w / 2, (Math.floor(k / nx) + 0.5) * CELL - this.spec.d / 2]);
    // string-pull: drop points visible from the previous kept point
    const out = []; let a = [x0, z0];
    for (let k = 0; k < pts.length; k++) { const nxt = pts[k + 1]; if (nxt && this.clear(a, nxt)) continue; out.push(pts[k]); a = pts[k]; }
    if (!out.length || out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1] || [x1, z1]);
    return out;
  }
  clear(a, b) { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CELL * 0.5)); for (let k = 1; k < n; k++) { const [i, j] = this.cellOf(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n); if (!this.free(i, j)) return false; } return true; }
  // ---------- people ----------
  addPerson(id, avatar, x, z, info = {}) {
    const p = { id, av: avatar, x, z, yaw: Math.PI * 0.25, path: [], speed: 1.45, pose: 'stand', info, poseAt: null };
    avatar.root.position.set(x, 0, z); avatar.root.userData.personId = id; this.group.add(avatar.root); this.people.set(id, p); return p;
  }
  removePerson(id) { const p = this.people.get(id); if (!p) return; this.group.remove(p.av.root); p.av.dispose && p.av.dispose(); this.people.delete(id); }
  walkTo(id, x, z, onArrive, finalPose) {
    const p = this.people.get(id); if (!p) return; p.pose = 'stand'; p.poseAt = null; p.path = this.path(p.x, p.z, x, z); p.onArrive = onArrive || null; p.finalPose = finalPose || null;
  }
  placeAt(id, x, z, yaw, pose, y = 0) { const p = this.people.get(id); if (!p) return; p.path = []; p.x = x; p.z = z; p.yaw = yaw; p.pose = pose || 'stand'; p.poseY = y; }
  update(dt) {
    this.elapsed+=dt;for(const s of this.screens)s.update(this.elapsed);for(const r of this.items){for(const spin of r.obj.userData.spin||[])spin.obj.rotation[spin.axis]+=dt*spin.speed;const smoke=r.obj.userData.smoke;if(smoke){smoke.position.y=1.3+(this.elapsed*.25)% .65;smoke.scale.setScalar(.85+Math.sin(this.elapsed)*.12);}}
    for (const p of this.people.values()) {
      let moving = false;
      if (p.path.length) {
        const [tx, tz] = p.path[0]; const dx = tx - p.x, dz = tz - p.z, dist = Math.hypot(dx, dz);
        if (dist < 0.06) { p.path.shift(); if (!p.path.length) { if (p.finalPose) { p.x = p.finalPose.x; p.z = p.finalPose.z; p.yaw = p.finalPose.yaw; p.pose = p.finalPose.pose; p.poseY = p.finalPose.y || 0; } const cb = p.onArrive; p.onArrive = null; cb && cb(); } }
        else { const st = Math.min(dist, p.speed * dt); p.x += (dx / dist) * st; p.z += (dz / dist) * st; const want = Math.atan2(dx, dz); let dy = want - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * Math.min(1, dt * 12); moving = true; }
      }
      const r = p.av.root; r.position.set(p.x, p.pose === 'stand' ? 0 : p.poseY || 0, p.z); r.rotation.set(0, p.yaw, 0);
      p.av.play(moving ? 'walk' : p.anim || 'idle'); p.av.update(dt, moving ? p.speed : 0);
      applyPose(p.av, moving ? 'stand' : p.pose);
    }
  }
  // ---------- picking ----------
  pick(ndc) {
    this.ray.setFromCamera(ndc, this.stage.camera);
    const hits = this.ray.intersectObjects(this.group.children, true);
    for (const h of hits) {
      let visible = true;
      for (let ancestor = h.object; ancestor; ancestor = ancestor.parent) {
        if (!ancestor.visible) { visible = false; break; }
      }
      if (!visible) continue;
      let o = h.object; while (o && !o.userData.itemRef && !o.userData.personId && o !== this.group) o = o.parent;
      if (o && o.userData.personId != null) return { type: 'person', id: o.userData.personId, point: h.point };
      if (o?.userData.itemRef && o.visible) return { type: 'item', item: o.userData.itemRef, point: h.point };
      if (h.object.userData.floor) { const lp = this.group.worldToLocal(h.point.clone()); return { type: 'floor', x: lp.x, z: lp.z }; }
    }
    return null;
  }
  // screen position of a world point (for name tags / bubbles)
  screen(x, y, z) { const v = new THREE.Vector3(x, y, z).applyMatrix4(this.group.matrixWorld).project(this.stage.camera); return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; }
}
function signBoard(sign, w, d, H) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 192; const x = c.getContext('2d');
  x.fillStyle = sign.bg || '#c8102e'; x.fillRect(0, 0, 1024, 192); x.fillStyle = sign.fg || '#fff';
  x.font = '800 104px "Outfit Variable", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(sign.text).toUpperCase(), 512, 100, 960);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const len = Math.min(w * 0.6, 5.2); const m = new THREE.Mesh(new THREE.BoxGeometry(len, len * 0.1875, 0.06), [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ color: sign.bg || '#c8102e' })).concat([new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.25 }), new THREE.MeshStandardMaterial({ color: '#222' })]));
  m.position.set(w * 0.08, H - 0.55, -d / 2 + 0.02); m.userData.sign = true; return m;
}
