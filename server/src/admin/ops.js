// Stage 11: in-process operational telemetry for the dashboard. Only counters and short codes are kept:
// no request bodies, stacks, tokens or personal data. Values reset when the process restarts (shown as "since").
const started = Date.now();
const workers = new Map();
const incidents = [];
const counters = {http5xx: 0, http4xx: 0, wsRejected: 0};
export function beat(name, ok = true, code = '') {
  const w = workers.get(name) || {runs: 0, failures: 0, lastOk: null, lastFailure: null, lastCode: ''};
  const next = {...w, runs: w.runs + 1, ...(ok ? {lastOk: Date.now()} : {failures: w.failures + 1, lastFailure: Date.now(), lastCode: String(code).slice(0, 40)})};
  workers.set(name, next);
  if (!ok) incident(name, code);
}
export function incident(source, code) {
  incidents.unshift({at: Date.now(), source: String(source).slice(0, 40), code: String(code || 'error').slice(0, 60)});
  if (incidents.length > 50) incidents.length = 50;
}
export function count(status) {
  if (/^5/.test(status)) counters.http5xx++;
  else if (/^4/.test(status)) counters.http4xx++;
}
export const countWsRejected = () => { counters.wsRejected++; };
// Wraps a periodic job so the dashboard sees when it last succeeded and how often it failed.
export async function track(name, job) {
  try { const r = await job(); beat(name, true); return r; } catch (e) { beat(name, false, e?.code || e?.name || 'failed'); throw e; }
}
export const snapshot = () => ({since: started, workers: Object.fromEntries(workers), incidents: [...incidents], counters: {...counters}});
