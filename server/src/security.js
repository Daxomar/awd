import crypto from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { CFG } from './config.js';

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const EXTRA_ORIGINS = new Set([
  'https://accrawedey.world',
  'https://www.accrawedey.world',
  'https://awd-e6je.onrender.com',
]);
export function allowedOrigin(origin, required = false) {
  if (!origin) return !required && CFG.dev;
  if (origin === CFG.publicOrigin) return true;
  if (EXTRA_ORIGINS.has(origin)) return true;
  if (CFG.dev) {
    try { const u = new URL(origin); return ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) && ['http:', 'https:'].includes(u.protocol); } catch {}
  }
  return false;
}
export function clientIp(res, req) {
  // Enable only behind the private proxy; it overwrites this header, never appends.
  const forwarded = CFG.trustProxy ? req.getHeader('x-real-ip') : '';
  return net.isIP(forwarded) ? forwarded : Buffer.from(res.getRemoteAddressAsText()).toString();
}
export function securityHeaders(res, { html = false, scriptHashes = [] } = {}) {
  res.writeHeader('x-content-type-options', 'nosniff').writeHeader('referrer-policy', 'no-referrer')
    .writeHeader('x-frame-options', 'DENY').writeHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  if (CFG.secureCookies) res.writeHeader('strict-transport-security', 'max-age=31536000');
  if (html) res.writeHeader('content-security-policy', `default-src 'self'; script-src 'self' ${scriptHashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' blob: ${CFG.dev ? 'ws://localhost:* ws://127.0.0.1:*' : ''}; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
  return res;
}
export function inlineScriptHashes(html) {
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .filter(m => m[1].trim()).map(m => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
}
export function staticPath(root, url) {
  try {
    const decoded = decodeURIComponent(url);
    if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').some(x => x === '..' || x.startsWith('.'))) return null;
    const target = path.resolve(root, `.${decoded.startsWith('/') ? decoded : '/' + decoded}`);
    return target.startsWith(path.resolve(root) + path.sep) ? target : null;
  } catch { return null; }
}
export function parseMessage(raw) {
  try {
    const msg = JSON.parse(raw);
    if (!msg || Array.isArray(msg) || typeof msg !== 'object' || typeof msg.t !== 'string' || msg.t.length > 32) return null;
    let count = 0;
    function visit(v, depth) {
      if (depth > 8 || ++count > 400) return false;
      if (!v || typeof v !== 'object') return true;
      return Object.entries(v).every(([k,x]) => !['__proto__','prototype','constructor'].includes(k) && visit(x, depth + 1));
    }
    return visit(msg, 0) ? msg : null;
  } catch { return null; }
}
export function takeMessage(bucket, now = Date.now(), capacity=60, perSecond=20) {
  bucket.tokens = Math.min(capacity, (bucket.tokens ?? capacity) + Math.max(0, now - (bucket.at ?? now)) * perSecond/1000);
  bucket.at = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens--; return true;
}
export class RateLimiter {
  constructor(redis) { this.redis = redis; this.local = new Map(); }
  async take(category, identity, max, seconds) {
    const key = CFG.redisNamespace+'awd:limit:' + category + ':' + crypto.createHash('sha256').update(String(identity)).digest('hex');
    if (this.redis?.status === 'ready') {
      const n = await this.redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, key, seconds);
      return n <= max;
    }
    if (CFG.production) throw new Error('Security rate limiter unavailable');
    const now = Date.now(); let b = this.local.get(key);
    if (!b || now >= b.end) { b = { n: 0, end: now + seconds * 1000 }; this.local.set(key, b); }
    if (this.local.size > 10000) for (const [k,v] of this.local) if (v.end < now) this.local.delete(k);
    return ++b.n <= max;
  }
}
