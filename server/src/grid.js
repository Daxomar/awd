// Uniform spatial hash for area-of-interest queries. O(1) insert/move, ring-scan nearest lookup.
export class Grid {
  constructor(cell) { this.cell = cell; this.cells = new Map(); }
  key(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }
  cellOf(x, z) { return [Math.floor(x / this.cell), Math.floor(z / this.cell)]; }
  insert(e) { const [cx, cz] = this.cellOf(e.x, e.z); e._cx = cx; e._cz = cz; const k = this.key(cx, cz); let s = this.cells.get(k); if (!s) this.cells.set(k, (s = new Set())); s.add(e); }
  remove(e) { const k = this.key(e._cx, e._cz); const s = this.cells.get(k); if (s) { s.delete(e); if (!s.size) this.cells.delete(k); } }
  move(e) { const [cx, cz] = this.cellOf(e.x, e.z); if (cx === e._cx && cz === e._cz) return; this.remove(e); this.insert(e); }
  // Nearest entities within radius, scanning rings outward and stopping early once `max` candidates are certain.
  near(e, radius, max, out = []) {
    // Collect up to `cap` candidates ring by ring (dense crowds stop early), then keep the closest `max`.
    out.length = 0; const R = Math.ceil(radius / this.cell), r2 = radius * radius, cap = max * 2;
    for (let ring = 0; ring <= R && out.length < cap; ring++) {
      for (let dx = -ring; dx <= ring && out.length < cap; dx++) for (let dz = -ring; dz <= ring; dz++) {
        if (dx !== -ring && dx !== ring && dz !== -ring && dz !== ring) continue;
        const s = this.cells.get(this.key(e._cx + dx, e._cz + dz)); if (!s) continue;
        for (const o of s) { if (o === e) continue; const ddx = o.x - e.x, ddz = o.z - e.z, d2 = ddx * ddx + ddz * ddz; if (d2 <= r2) { o._d2 = d2; out.push(o); if (out.length >= cap) break; } }
        if (out.length >= cap) break;
      }
    }
    if (out.length > max) { out.sort((a, b) => a._d2 - b._d2); out.length = max; }
    return out;
  }
}
