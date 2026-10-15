import { CHUNK, SCALE } from './geography.js';
import { buildingDetail, disposeBatch } from './kit.js';

export class DetailChunks {
  constructor(kit, parent, plan, capacity = 12) {
    this.kit = kit; this.parent = parent; this.plan = plan; this.capacity = capacity; this.cache = new Map(); this.active = new Set(); this.queue = []; this.generated = 0; this.evicted = 0; this.disposed = false;
  }
  update(x, z, zoom) {
    if (this.disposed) return;
    const next = new Set(), cx = Math.floor(x / SCALE / CHUNK), cz = Math.floor(z / SCALE / CHUNK);
    if (zoom < 15) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const k = `${cx + a},${cz + b}`; if (this.plan.has(k)) next.add(k);
    }
    this.active = next;
    for (const [k, group] of this.cache) group.visible = next.has(k);
    // Retain completed detail across entries; only schedule currently wanted work.
    this.queue = [...next].filter(k => !this.cache.has(k)).sort((a, b) => {
      const d = k => { const [px, pz] = k.split(',').map(Number); return (px - cx) ** 2 + (pz - cz) ** 2; }; return d(a) - d(b) || a.localeCompare(b);
    });
    const key = this.queue.shift();
    if (key) {
      const parts = this.kit.batch(); for (const p of this.plan.get(key)) buildingDetail(parts, p);
      const group = parts.finish(); this.parent.add(group); this.cache.set(key, group); this.generated++;
    }
    // Refresh LRU order only for wanted chunks. Never dispose the shared kit here.
    for (const k of next) if (this.cache.has(k)) { const g = this.cache.get(k); this.cache.delete(k); this.cache.set(k, g); }
    while (this.cache.size > this.capacity) {
      const k = [...this.cache.keys()].find(k => !next.has(k)); if (!k) break;
      disposeBatch(this.cache.get(k)); this.cache.delete(k); this.evicted++;
    }
  }
  stats() { return { active: [...this.cache].filter(([k, g]) => this.active.has(k) && g.visible).length, cached: this.cache.size, queued: this.queue.length, generated: this.generated, evicted: this.evicted, capacity: this.capacity }; }
  dispose() { if (this.disposed) return; this.disposed = true; for (const g of this.cache.values()) disposeBatch(g); this.cache.clear(); this.active.clear(); this.queue = [];this.plan=new Map(); }
}
