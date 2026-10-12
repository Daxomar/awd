// Runtime config (env-driven so the same build runs locally and in production)
export const CFG = {
  port: +(process.env.PORT || 8080),
  shardId: process.env.SHARD_ID || 'accra-1',
  shardCap: +(process.env.SHARD_CAP || 2500),          // max players in one city instance
  tickHz: +(process.env.TICK_HZ || 10),               // network snapshot rate
  aoiRadius: +(process.env.AOI_RADIUS || 90),          // metres
  aoiMax: +(process.env.AOI_MAX || 48),                // most entities streamed to one client
  cell: 30,                                            // spatial hash cell (m)
  pgUrl: process.env.DATABASE_URL || 'postgres://awd:awd@127.0.0.1:5432/awd',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  saveEveryMs: 30000,
  world: { minX: -6000, maxX: 6000, minZ: -7000, maxZ: 7000 },
};
