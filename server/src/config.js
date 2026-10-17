import { secret } from './secrets.js';
const production = process.env.NODE_ENV === 'production';
function resolvePublicUrl() {
  const raw = process.env.PUBLIC_URL || (production ? 'https://accrawedey.world' : 'http://localhost:8080');
  if (/^https?:\/\/[\w-]+\.onrender\.com/i.test(raw)) return 'https://accrawedey.world';
  return raw;
}
const publicUrl = new URL(resolvePublicUrl());
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(publicUrl.hostname);
const sessionSecret = secret('SESSION_SECRET', production ? '' : 'dev-secret-change-me');
const birthSeed = secret('BIRTH_SEED', production ? '' : sessionSecret);
if (production) {
  if (sessionSecret.length < 32 || birthSeed.length < 32) throw new Error('Production requires random SESSION_SECRET and BIRTH_SEED (32+ characters).');
  if (process.env.DEV || process.env.BOT_KEY) throw new Error('DEV and BOT_KEY must be absent in production.');
  if (publicUrl.protocol !== 'https:' && !loopback) throw new Error('Production PUBLIC_URL must use HTTPS (except local loopback testing).');
  if (!['https:', 'http:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password) throw new Error('Invalid PUBLIC_URL.');
  const admin = secret('ADMIN_KEY');
  if (admin && admin.length < 32) throw new Error('Production ADMIN_KEY must have 32+ random characters.');
}
const dbPassword = secret('POSTGRES_PASSWORD');
const redisPassword = secret('REDIS_PASSWORD');
if(production&&(!process.env.DATABASE_URL&&!dbPassword||!process.env.REDIS_URL&&!redisPassword))throw new Error('Production requires explicit database and Redis credentials.');
// Runtime config (env-driven so the same build runs locally and in production)
export const CFG = {
  production, dev: !production && process.env.DEV === '1',
  publicOrigin: publicUrl.origin, secureCookies: publicUrl.protocol === 'https:',
  trustProxy: process.env.TRUST_PROXY === '1',
  cookieName: publicUrl.protocol === 'https:' ? '__Host-awd_session' : 'awd_session',
  birthSeed,
  redisNamespace: process.env.REDIS_NAMESPACE || '',
  port: +(process.env.PORT || 8080),
  shardId: process.env.SHARD_ID || 'accra-1',
  shardCap: +(process.env.SHARD_CAP || 2500),          // max players in one city instance
  tickHz: +(process.env.TICK_HZ || 10),               // network snapshot rate
  aoiRadius: +(process.env.AOI_RADIUS || 90),          // metres
  aoiMax: +(process.env.AOI_MAX || 48),                // most entities streamed to one client
  cell: 30,                                            // spatial hash cell (m)
  pgUrl: process.env.DATABASE_URL || (dbPassword ? `postgres://awd:${encodeURIComponent(dbPassword)}@${process.env.DB_HOST || 'db'}:5432/awd` : 'postgres://awd:awd@127.0.0.1:5432/awd'),
  redisUrl: process.env.REDIS_URL || (redisPassword ? `redis://:${encodeURIComponent(redisPassword)}@${process.env.REDIS_HOST || 'redis'}:6379` : 'redis://127.0.0.1:6379'),
  secret: sessionSecret,
  saveEveryMs: 30000,
  world: { minX: -6000, maxX: 6000, minZ: -7000, maxZ: 7000 },
};
