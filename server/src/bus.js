// Cross-shard messaging over Redis pub/sub: city chat, global announcements, presence counts.
import Redis from 'ioredis';
import { CFG } from './config.js';
export class Bus {
  constructor(shardId, onMsg) {
    this.shardId = shardId; this.ok = false;this.prefix=CFG.redisNamespace;
    try {
      this.pub = new Redis(CFG.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
      this.sub = new Redis(CFG.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
      Promise.all([this.pub.connect(), this.sub.connect()]).then(async () => {
        await this.sub.subscribe(...['awd:city', 'awd:global', 'awd:credit', 'awd:dm', 'awd:gem', 'awd:session'].map(ch=>this.prefix+ch));
        this.sub.on('message', (ch, raw) => { try { const m = JSON.parse(raw); if (m.from !== this.shardId) onMsg(ch.slice(this.prefix.length), m); } catch {} });
        this.ok = true;
      }).catch((e) => console.warn('[bus] redis unavailable, single-shard mode:', e.message));
    } catch (e) { console.warn('[bus] disabled', e.message); }
  }
  publish(ch, m) { if (this.ok) this.pub.publish(this.prefix+ch, JSON.stringify({ ...m, from: this.shardId })).catch(() => {}); }
  async heartbeat(online) { if (!this.ok) return; await this.pub.hset(this.prefix+'awd:shards', this.shardId, JSON.stringify({ online, at: Date.now() })).catch(() => {}); }
  async shards() { if (!this.ok) return {}; const h = await this.pub.hgetall(this.prefix+'awd:shards').catch(() => ({})); const out = {}; for (const k in h) { try { const v = JSON.parse(h[k]); if (Date.now() - v.at < 30000) out[k] = v.online; } catch {} } return out; }
}
