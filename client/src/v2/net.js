// WebSocket JSON client with auto-reconnect and a tiny event bus.
export class Net {
  constructor() { this.held = []; this.holding = true; this.h = {}; this.ws = null; this.connected = false; this.backoff = 1000; this.token = null; this.offset = 0; this.generation = 0; }
  on(t, fn) { (this.h[t] ||= []).push(fn); return () => { this.h[t] = this.h[t].filter((f) => f !== fn); }; }
  emit(t, m) { for (const f of this.h[t] || []) { try { f(m); } catch (e) { console.error('[net handler ' + t + ']', e); } } for (const f of this.h['*'] || []) f(m); if (t === 'multi') for (const x of m.list) this.emit(x.t, x); }
  url() { const p = location.protocol === 'https:' ? 'wss' : 'ws'; return `${p}://${location.host}/ws${this.token && this.token !== 'cookie' ? '?token=' + encodeURIComponent(this.token) : ''}`; }
  connect(token, retry = false) {
    this.token = token; this.stopped = false; clearTimeout(this.retryTimer); clearInterval(this.heartbeat);
    const generation = ++this.generation;
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
    this.connected = false;
    return new Promise((res, rej) => {
      let settled = false, welcomed = false; if(this.holding)this.held=[]; const ws = (this.ws = new WebSocket(this.url()));
      const timeout = setTimeout(() => ws.close(), 30000);
      ws.onmessage = (ev) => { if (generation !== this.generation || typeof ev.data !== 'string') return; let m; try { m = JSON.parse(ev.data); } catch { return; }
        this.lastSeen = Date.now();
        if (m.t === 'welcome') { welcomed=true;clearTimeout(timeout); this.connected = true; this.backoff = 1000; this.offset = m.now - Date.now();
          this.heartbeat = setInterval(() => { if (Date.now() - this.lastSeen > 45000) return ws.close(); this.send({ t: 'ping', c: Date.now() }); }, 20000);
          if (retry) this.emit('reconnected', m); this.emit('connection', { connected: true });
          if (!settled) { settled = true; res(m); } }
        if (this.holding && !['welcome', 'onboarding', 'onboarded', 'toast', 'pong', 'reconnected'].includes(m.t)) { this.held.push(m); if (this.held.length > 200) this.held.shift(); return; } this.emit(m.t, m); };
      ws.onclose = (e) => { if (generation !== this.generation) return; clearTimeout(timeout); clearInterval(this.heartbeat); this.connected = false; if (!settled) { settled = true; rej(new Error(e.code === 1006 ? 'Can’t reach the server.' : 'Disconnected')); } this.emit('close', e); this.emit('connection', { connected: false, terminal: [4000,4001,4003,4008].includes(e.code) });
        if(e.code===4003&&!this.stopped)this.emit('auth_expired',{});
        if ((welcomed || retry || !this.holding) && ![4000,4001,4003,4008].includes(e.code) && this.token && !this.stopped) { this.retryTimer = setTimeout(() => this.reconnect(), this.backoff); this.backoff = Math.min(15000, this.backoff * 1.7); } };
      ws.onerror = () => {};
    });
  }
  reconnect() { if (this.connected || this.stopped) return; this.connect(this.token, true).catch(() => {}); }
  // game UI is ready: deliver everything that arrived during login/onboarding
  release() { this.holding = false; const q = this.held; this.held = []; for (const m of q) this.emit(m.t, m); }
  send(o) { if (this.connected && this.ws?.readyState === WebSocket.OPEN) { this.ws.send(JSON.stringify(o)); return true; } this.emit('toast', { m: 'Connection lost. Reconnecting…', k: 'bad' }); return false; }
  now() { return Date.now() + this.offset; }
  close() { this.stopped = true; clearTimeout(this.retryTimer); clearInterval(this.heartbeat); try { this.ws.close(); } catch {} }
}
export const net = new Net();
