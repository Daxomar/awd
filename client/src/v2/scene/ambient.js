// Stage 9 ambient street life. Scripted, schedule-driven residents and vehicles — not autonomous AI.
// Bounded by a device budget, pooled per room, activated by distance, animated at reduced rates when far,
// and fully disposed with the room. Ambient residents carry no name tag and are never counted as players.
import { Avatar } from './avatars.js';
import { makeItem, trimKitCaches } from './kit.js';
import { EnvironmentResources } from './environment-resources.js';

export const AMBIENT_PREFIX = 'npc-amb';
const COLS = ['#c8102e', '#1f6fb8', '#f2b632', '#2a9d8f', '#7b2d8e', '#e76f51', '#f4f4f4', '#22313f', '#e9c46a'];
const CAR_COLS = ['#c8102e', '#f2f0e6', '#1f6fb8', '#2b2b2b', '#9aa0a6', '#f2c230'];

export function ambientBudget(nav = globalThis.navigator || {}) {
  const low = (nav.deviceMemory && nav.deviceMemory <= 4) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4);
  // Residents are full avatars (the main triangle cost), so low-end devices get four people at most.
  return low ? { walkers: 2, talkers: 2, parked: 2, moving: 1 } : { walkers: 4, talkers: 2, parked: 4, moving: 1 };
}
// Fewer people late at night, nobody chatting on the street after 23:00, no moving traffic in the small hours.
export function populationFor(hour, budget) {
  const night = hour >= 23 || hour < 5, evening = hour >= 19 || hour < 7;
  return { walkers: night ? 1 : evening ? Math.ceil(budget.walkers * 0.6) : budget.walkers, talkers: night ? 0 : budget.talkers, parked: budget.parked, moving: night ? 0 : budget.moving };
}
// A small deterministic random source so a street looks the same each visit.
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const hash = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export function residentLook(r) {
  const col = () => COLS[Math.floor(r() * COLS.length)];
  return { body: r() < 0.5 ? 'f' : 'm', skinTone: 3 + Math.floor(r() * 5), top: col(), bottom: col() };
}

export class Ambient {
  constructor(room, { hour = 12, budget = ambientBudget(), seed = room.spec?.area || 'street' } = {}) {
    this.room = room; this.items = []; this.ids = []; this.cars = []; this.acc = 0;
    const r = rng(hash(seed)), pop = populationFor(hour, budget), spec = room.spec, W = spec.w / 2 - 1.5, D = spec.d / 2 - 1.5;
    this.population = pop;
    // Parked vehicles: decorative (not pickable) room items, so walking routes go around them. One nav rebuild.
    const rebuild = room.buildNav; room.buildNav = () => {};
    const segs = room.streetStream?.graph?.segments || [];
    for (let i = 0, tries = 0; i < pop.parked && tries < pop.parked * 6; tries++) {
      // Kerbside along a real street segment when there is one, otherwise any open ground.
      const sg = segs.length ? segs[Math.floor(r() * segs.length)] : null; let x, z, rot = r() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      if (sg) { const t = 0.25 + r() * 0.5, dx = sg.to[0] - sg.from[0], dz = sg.to[1] - sg.from[1], len = Math.hypot(dx, dz), side = r() < 0.5 ? 1 : -1, off = sg.width / 2 + 1.3; x = sg.from[0] + dx * t - dz / len * off * side; z = sg.from[1] + dz * t + dx / len * off * side; rot = Math.atan2(-dz, dx); }
      else { x = -W + r() * 2 * W; z = -D + r() * 2 * D; }
      const ux = Math.cos(rot), uz = -Math.sin(rot), clear = [-2, 0, 2].every(k => { const c = room.cellOf(x + ux * k, z + uz * k); return room.free(c[0], c[1]); });   // whole car on open ground
      if (!clear || this.items.some(it => Math.hypot(it.spec.x - x, it.spec.z - z) < 5)) continue;
      const p = { x, z }; i++;
      this.items.push(room.addItem({ kind: r() < 0.25 ? 'trotro' : 'car_display', x: p.x, z: p.z, rot, color: CAR_COLS[Math.floor(r() * CAR_COLS.length)], decorative: true, ambient: true }));
    }
    room.buildNav = rebuild; if (this.items.length) room.buildNav();
    this.points = this.walkPoints(r, W, D); this.links = this.streetLinks();
    for (let i = 0; i < pop.walkers; i++) { const start = this.links ? this.links.nodes[Math.floor(r() * this.links.nodes.length)] : this.points[Math.floor(r() * this.points.length)]; this.person(`walk${i}`, start, r, { walk: true, lateral: (r() - 0.5) * 1.6 }); }
    if (pop.talkers >= 2) { const p = this.points[Math.floor(r() * this.points.length)]; this.person('talkA', { x: p.x - 0.45, z: p.z }, r, { face: Math.PI / 2, gesture: 'agree' }); this.person('talkB', { x: p.x + 0.45, z: p.z }, r, { face: -Math.PI / 2, gesture: 'shake' }); }
    // Slow traffic along the longest straight street: one mesh on a fixed line, never a driving simulation.
    const lane = this.lane();
    for (let i = 0; lane && i < pop.moving; i++) {
      const obj = makeItem('car_display', { color: CAR_COLS[Math.floor(r() * CAR_COLS.length)] }).obj;
      obj.traverse(m => { if (m.isMesh) { m.castShadow = true; m.userData.decorative = true; } });
      room.group.add(obj);
      const car = { obj, resources: new EnvironmentResources().capture(obj), lane, t: 0, dir: 1, speed: 3.2 / lane.len, wait: 0 }; this.place(car); this.cars.push(car);
    }
  }
  free(x, z) { const cell = this.room.nearestFree?.(x, z); if (!cell || !this.room.free?.(cell[0], cell[1])) return null; const C = 0.25; return { x: (cell[0] + 0.5) * C - this.room.spec.w / 2, z: (cell[1] + 0.5) * C - this.room.spec.d / 2 }; }
  // Street corridors are open by construction (buildings, trees and signs sit beside them), so residents walk
  // straight from junction to junction: no path search at runtime. Rooms without a street graph use the nav grid.
  streetLinks() {
    const g = this.room.streetStream?.graph; if (!g?.segments?.length) return null;
    const key = (pt) => pt[0] + ',' + pt[1], nodes = new Map(), adj = new Map();
    for (const sg of g.segments) for (const [a, b] of [[sg.from, sg.to], [sg.to, sg.from]]) { nodes.set(key(a), { x: a[0], z: a[1] }); (adj.get(key(a)) || adj.set(key(a), []).get(key(a))).push({ to: { x: b[0], z: b[1] }, w: sg.width }); }
    return { nodes: [...nodes.values()], adj, key: (x, z) => x + ',' + z };
  }
  walkPoints(r, W, D) { const out = []; for (let i = 0; i < 14; i++) { const p = this.free(-W + r() * 2 * W, -D + r() * 2 * D); if (p) out.push(p); } return out.length ? out : [{ x: 0, z: 0 }]; }
  // The longest straight run of the street graph (or the authored road), shortened so cars turn before the ends.
  lane() {
    const g = this.room.streetStream?.graph, mk = (ax, az, bx, bz) => { const len = Math.hypot(bx - ax, bz - az); return len > 8 ? { ax, az, bx, bz, len, ux: (bx - ax) / len, uz: (bz - az) / len } : null; };
    if (!g) { const road = this.room.items.find(it => /^street_road/.test(it.spec.kind)); if (!road) return null; const half = Math.min(this.room.spec.w / 2 - 2, 15); return mk(-half, road.spec.z + 0.9, half, road.spec.z + 0.9); }
    const runs = new Map();
    for (const sg of g.segments) {
      const hz = sg.from[1] === sg.to[1], vt = sg.from[0] === sg.to[0]; if (!hz && !vt) continue;
      const key = hz ? 'h' + sg.from[1] : 'v' + sg.from[0], i = hz ? 0 : 1, a = Math.min(sg.from[i], sg.to[i]), b = Math.max(sg.from[i], sg.to[i]);
      const run = runs.get(key) || { hz, c: hz ? sg.from[1] : sg.from[0], a, b, sum: 0 }; run.a = Math.min(run.a, a); run.b = Math.max(run.b, b); run.sum += b - a; runs.set(key, run);
    }
    const best = [...runs.values()].filter(r => r.sum >= r.b - r.a - 0.01).sort((x, y) => (y.b - y.a) - (x.b - x.a))[0]; if (!best) return null;
    return best.hz ? mk(best.a + 2, best.c, best.b - 2, best.c) : mk(best.c, best.a + 2, best.c, best.b - 2);
  }
  place(c) { const L = c.lane; c.obj.position.set(L.ax + (L.bx - L.ax) * c.t, 0, L.az + (L.bz - L.az) * c.t); c.obj.rotation.y = Math.atan2(-L.uz * c.dir, L.ux * c.dir); }
  person(key, at, r, o) {
    if (o.walk && this.links) at = { x: at.x, z: at.z };
    const id = `${AMBIENT_PREFIX}-${key}`, room = this.room;
    room.addPerson(id, new Avatar(residentLook(r)), at.x, at.z, { npc: true, ambient: true });
    room.placeAt(id, at.x, at.z, o.face ?? r() * Math.PI * 2, 'stand');
    const p = room.people.get(id); p.ambient = { walk: !!o.walk, gesture: o.gesture, next: 1 + r() * 4, r, lateral: o.lateral || 0, node: o.walk && this.links ? { x: at.x, z: at.z } : null }; p.speed = 0.9 + r() * 0.3;
    this.ids.push(id);
  }
  // Bounded work: decisions at 10 Hz, distance activation (hidden beyond 28 m), animation every 3rd frame beyond 14 m.
  update(dt, me) {
    for (const c of this.cars) {
      const L = c.lane, px = c.obj.position.x, pz = c.obj.position.z;
      let blocked = false;   // stops for anyone (player or resident) on the lane just ahead
      for (const q of this.room.people.values()) { if (!q.av.root.visible) continue; const along = ((q.x - px) * L.ux + (q.z - pz) * L.uz) * c.dir, side = Math.abs((q.x - px) * L.uz - (q.z - pz) * L.ux); if (along > 0 && along < 3.5 && side < 1.5) { blocked = true; break; } }
      if (blocked) { c.wait = 1.2; continue; }
      if (c.wait > 0) { c.wait -= dt; continue; }
      c.t += c.dir * c.speed * dt;
      if (c.t > 1 || c.t < 0) { c.dir *= -1; c.t = Math.max(0, Math.min(1, c.t)); c.wait = 1.5; }
      this.place(c);
    }
    this.acc += dt; if (this.acc < 0.1) return; const step = this.acc; this.acc = 0;
    for (const id of this.ids) {
      const p = this.room.people.get(id); if (!p) continue;
      const d = me ? Math.hypot(p.x - me.x, p.z - me.z) : 0;
      p.av.root.visible = d < 28; p.lodStep = d > 14 ? 3 : 0;
      if (!p.av.root.visible) continue;
      const a = p.ambient; a.next -= step;
      if (me && d < 2.2 && !p.path.length) { p.yaw = Math.atan2(me.x - p.x, me.z - p.z); if (a.next <= 0) { p.av.gesture?.('wave'); a.next = 6; } continue; }   // notices you
      if (a.next > 0) continue;
      if (a.walk && this.links) {
        const from = a.node || { x: Math.round(p.x), z: Math.round(p.z) }, opts = this.links.adj.get(this.links.key(from.x, from.z));
        if (!opts?.length) { a.node = this.links.nodes[0]; p.path = [[a.node.x, a.node.z]]; a.next = 4; continue; }
        const back = opts.length > 1 ? opts.filter(o => !a.prev || o.to.x !== a.prev.x || o.to.z !== a.prev.z) : opts, e = back[Math.floor(a.r() * back.length)];
        const dx = e.to.x - from.x, dz = e.to.z - from.z, len = Math.hypot(dx, dz) || 1, off = Math.max(-e.w / 2 + 0.35, Math.min(e.w / 2 - 0.35, a.lateral));
        p.path = [[e.to.x - dz / len * off, e.to.z + dx / len * off]]; a.prev = from; a.node = e.to; a.next = len / p.speed + 1 + a.r() * 4;
      } else if (a.walk) { const t = this.points[Math.floor(a.r() * this.points.length)]; this.room.walkTo(id, t.x, t.z); a.next = 6 + a.r() * 8; }
      else { p.av.gesture?.(a.gesture || 'agree'); a.next = 4 + a.r() * 5; }
    }
  }
  stats() { return { residents: this.ids.length, parked: this.items.length, moving: this.cars.length, visible: this.ids.filter(id => this.room.people.get(id)?.av.root.visible).length }; }
  // roomGone: the room is being disposed anyway, which already releases its people and items.
  dispose(roomGone = false) {
    if (!roomGone) { for (const id of this.ids) this.room.removePerson(id); for (const rec of this.items) if (this.room.items.includes(rec)) this.room.removeItem(rec); }
    for (const c of this.cars) { c.obj.removeFromParent(); c.resources.dispose(); }
    this.ids = []; this.items = []; this.cars = []; trimKitCaches();
  }
}
