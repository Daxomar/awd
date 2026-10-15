// Cached geometry may be shared by several live avatars. Evict only idle entries;
// removing an avatar must never dispose another avatar's meshes.
export class GeometryCache {
  constructor(maxIdle = 16) { this.maxIdle = maxIdle; this.entries = new Map(); }
  acquire(key, create) {
    let entry = this.entries.get(key);
    if (!entry) { entry = { geometries: create(), refs: 0 }; this.entries.set(key, entry); }
    entry.refs++;
    this.entries.delete(key); this.entries.set(key, entry);
    return entry.geometries;
  }
  release(key) {
    const entry = this.entries.get(key);
    if (!entry || !entry.refs) return;
    entry.refs--;
    this.entries.delete(key); this.entries.set(key, entry);
    let idle = [...this.entries.values()].filter(e => !e.refs).length;
    for (const [k, e] of this.entries) {
      if (idle <= this.maxIdle) break;
      if (e.refs) continue;
      this.entries.delete(k); idle--;
      for (const geometry of new Set(Object.values(e.geometries))) geometry.dispose();
    }
  }
  stats() {
    const entries = [...this.entries.values()];
    return { entries: entries.length, active: entries.filter(e => e.refs).length,
      idle: entries.filter(e => !e.refs).length, references: entries.reduce((n,e) => n + e.refs, 0) };
  }
}
