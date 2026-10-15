// Legacy server metres stay authoritative. Only the display scale changes.
export const ORIGIN = [5.556, -.2];
export const SCALE = .003;
export const CHUNK = 750;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function project(lat, lon) {
  return [(lon - ORIGIN[1]) * 111320 * Math.cos(ORIGIN[0] * Math.PI / 180), -(lat - ORIGIN[0]) * 110574];
}
export function unproject(x, z) {
  return [ORIGIN[0] - z / 110574, ORIGIN[1] + x / (111320 * Math.cos(ORIGIN[0] * Math.PI / 180))];
}
export const display = (x, z) => [x * SCALE, z * SCALE];
export function seeded(seed) {
  let s = 2166136261;
  for (const c of String(seed)) s = Math.imul(s ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
export function inRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export const inPolygon = (x, z, rings) => inRing(x, z, rings[0]) && !rings.slice(1).some(r => inRing(x, z, r));
export function distanceSegment(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
export const roadWidth = kind => /motorway|trunk/.test(kind) ? 24 : /primary/.test(kind) ? 18 : /secondary/.test(kind) ? 13 : /tertiary/.test(kind) ? 10 : kind === 'pedestrian' ? 5 : 6;
export const arterial = kind => /motorway|trunk|primary|secondary|tertiary/.test(kind);
export const keyOf = (x, z) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;

// Small fixed-cell index: deterministic bounded queries, no scene dependency.
export class SpatialIndex {
  constructor(size = 150) { this.size = size; this.cells = new Map(); }
  insert(item, x0, z0, x1 = x0, z1 = z0) {
    for (let x = Math.floor(x0 / this.size); x <= Math.floor(x1 / this.size); x++) for (let z = Math.floor(z0 / this.size); z <= Math.floor(z1 / this.size); z++) {
      const k = `${x},${z}`; if (!this.cells.has(k)) this.cells.set(k, []); this.cells.get(k).push(item);
    }
  }
  query(x, z, radius = 0) {
    const out = new Set();
    for (let a = Math.floor((x - radius) / this.size); a <= Math.floor((x + radius) / this.size); a++) for (let b = Math.floor((z - radius) / this.size); b <= Math.floor((z + radius) / this.size); b++) for (const it of this.cells.get(`${a},${b}`) || []) out.add(it);
    return [...out];
  }
}
export function polygonIndex(polygons) {
  const index = new SpatialIndex(750);
  for (const item of polygons) {
    const p = item.rings[0], xs = p.map(q => q[0]), zs = p.map(q => q[1]);
    index.insert(item, Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs));
  }
  return index;
}
export function cameraLimits(bounds) {
  return { bounds: [bounds[0] * SCALE, bounds[1] * SCALE, bounds[2] * SCALE, bounds[3] * SCALE], min: 2.4, max: Math.ceil(overviewFrame(bounds,.4).zoom/10)*10 };
}
// Fit the projected ground rectangle inside the safe area below the existing HUD.
export function overviewFrame(bounds, aspect, usable = .64) {
  const [x0, x1, z0, z1] = bounds.map(v => v * SCALE), c = Math.SQRT1_2, pitch = .62;
  const width = ((x1 - x0) + (z1 - z0)) * c;
  const height = width * Math.sin(pitch);
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, zoom: Math.max(width / aspect, height / usable) * 1.06 };
}
