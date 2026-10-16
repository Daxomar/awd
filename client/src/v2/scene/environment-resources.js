// A resource is owned by each scene scope and, optionally, by a bounded cache.
// Materials own their textures. Avatars keep their separate resource lifecycle.
const refs = new WeakMap();
function textures(material) {
  return new Set(Object.values(material).filter(v => v?.isTexture));
}
export function retainResource(value) {
  const n = refs.get(value) || 0;
  if (!n && value.isMaterial) for (const t of textures(value)) retainResource(t);
  refs.set(value, n + 1);
}
export function releaseResource(value) {
  const n = refs.get(value) || 0;
  if (!n) throw new Error('Environment resource released without ownership');
  if (n > 1) { refs.set(value, n - 1); return; }
  refs.delete(value);
  value.dispose();
  if (value.isMaterial) for (const t of textures(value)) releaseResource(t);
}
export class EnvironmentResources {
  constructor() { this.values = new Set(); }
  capture(root, skip = () => false) {
    const visit = o => {
      if (skip(o)) return;
      const values = [o.geometry, ...(Array.isArray(o.material) ? o.material : [o.material])];
      for (const v of values) if (v && !this.values.has(v)) { this.values.add(v); retainResource(v); }
      for (const child of o.children || []) visit(child);
    };
    visit(root); return this;
  }
  dispose() { for (const v of this.values) releaseResource(v); this.values.clear(); }
}
export class EnvironmentCache extends Map {
  constructor(limit) { super(); this.limit = limit; }
  get(key) {
    const v = super.get(key);
    if (v) { super.delete(key); super.set(key, v); }
    return v;
  }
  set(key, value) {
    if (super.has(key)) throw new Error('Cached resource replaced without release');
    retainResource(value); return super.set(key, value);
  }
  trim() {
    for (const [key, v] of this) {
      if (this.size <= this.limit) break;
      if (refs.get(v) === 1) { super.delete(key); releaseResource(v); }
    }
  }
  clear() { for (const v of this.values()) releaseResource(v); super.clear(); }
}
