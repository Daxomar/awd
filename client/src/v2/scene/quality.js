// Stage 12.3: graphics quality. A per-browser preference (Auto, Battery saver, Balanced, Sharp) sets the pixel
// ratio cap, shadows and the size of the ambient street crowd. In Auto, a frame-time governor steps quality down
// when the device cannot keep up, so slow phones stay playable without anyone opening Settings.
export const TIERS = {
  saver: {name: 'Battery saver', detail: 'Lowest resolution, no shadows, fewer people on the street', dpr: {mobile: 0.85, desktop: 1}, shadows: false, shadowMap: 512, crowd: 'low'},
  balanced: {name: 'Balanced', detail: 'Softer resolution and lighter shadows', dpr: {mobile: 1.15, desktop: 1.5}, shadows: true, shadowMap: 1024, crowd: 'normal'},
  sharp: {name: 'Sharp', detail: 'Full resolution and shadows', dpr: {mobile: 1.5, desktop: 2}, shadows: true, shadowMap: 2048, crowd: 'normal'},
};
export const ORDER = ['saver', 'balanced', 'sharp'];
const KEY = 'awd.quality';
export const PREFS = ['auto', ...ORDER];

export function savedQuality(storage = globalThis.localStorage) {
  try { const v = storage?.getItem(KEY); return PREFS.includes(v) ? v : 'auto'; } catch { return 'auto'; }
}
export function saveQuality(pref, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, PREFS.includes(pref) ? pref : 'auto'); } catch { /* private mode: this session only */ }
}
export function lowEnd(nav = globalThis.navigator || {}) {
  return !!((nav.deviceMemory && nav.deviceMemory <= 4) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4));
}
// Auto starts from the device class: low-end devices save battery, phones balance, desktops stay sharp.
export function autoTier({mobile, low}) { return low ? 'saver' : mobile ? 'balanced' : 'sharp'; }
export function resolveTier(pref, env) { return ORDER.includes(pref) ? pref : autoTier(env); }
export function pixelRatio(tier, {mobile, devicePixelRatio = 1}) {
  const t = TIERS[tier] || TIERS.balanced;
  return Math.min(devicePixelRatio || 1, mobile ? t.dpr.mobile : t.dpr.desktop);
}

// Frame-time governor for Auto: after a warm-up, if the average frame takes longer than `slowMs` for `windowMs`,
// it asks for one step down; it never steps up on its own, and waits `coolMs` between steps.
export class Governor {
  constructor({slowMs = 45, windowMs = 4000, warmMs = 10000, coolMs = 30000} = {}) {
    Object.assign(this, {slowMs, windowMs, warmMs, coolMs});
    this.samples = []; this.started = null; this.lastStep = -Infinity;
  }
  sample(now, frameMs) {
    if (this.started === null) this.started = now;
    if (!(frameMs > 0) || frameMs > 1000) return false;   // skip pauses and background tabs
    this.samples.push([now, frameMs]);
    while (this.samples.length && now - this.samples[0][0] > this.windowMs) this.samples.shift();
    if (now - this.started < this.warmMs || now - this.lastStep < this.coolMs || this.samples.length < 20) return false;
    const avg = this.samples.reduce((s, [, ms]) => s + ms, 0) / this.samples.length;
    if (avg <= this.slowMs) return false;
    this.lastStep = now; this.samples = [];
    return true;
  }
}
export const stepDown = tier => ORDER[Math.max(0, ORDER.indexOf(tier) - 1)];
