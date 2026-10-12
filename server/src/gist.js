// Accra Gist: in-game social feed (280 chars). Every post carries a status flex (where you live / what you drive /
// your job) so the feed doubles as aspiration. Moderated with the same filter as chat; 1 post per minute per player.
import { pool } from './db.js';
import { moderate, BLOCK_MSG } from './filter.js';
import * as D from './game/data.js';

export async function migrateGist() {
  await pool.query(`create table if not exists gist (id bigserial primary key, acct int not null, name text not null, text text not null, flex text, auto boolean default false,
      likes int default 0, hidden boolean default false, at timestamptz default now());
    create index if not exists gist_at on gist (at desc);
    create table if not exists gist_likes (post bigint, acct int, primary key (post, acct));
    create table if not exists gist_follows (acct int, target int, at timestamptz default now(), primary key (acct, target));`);
}
export function flex(s) {
  if (s.car && D.CARS[s.car]) return ` drives a ${D.CARS[s.car].name.replace(/ \(.*\)/, '')}`;
  const owned = Object.keys(s.owned || {})[0]; if (owned && D.HOMES[owned]) return ` owns a ${D.HOMES[owned].name}`;
  if (s.job && D.CAREERS[s.job.id]) return ` ${D.CAREERS[s.job.id].ranks[s.job.rank][0]}`;
  if (s.home && D.HOMES[s.home]) return ` lives at ${D.HOMES[s.home].name}`;
  return ' new in Accra';
}
// Accra News: pinned editorial cards at the top of the feed (real Accra events, neutral wording, no named individuals)
export const NEWS = [
  { id: 'labadi-2026-10', ic: 'icon:newspaper', t: 'Changes at the Labadi beachfront', d: 'Structures along parts of the La beachfront were demolished on 2 October 2026. Ghana News Agency reported concerns from the local MP. The in-game beach reflects this event; activities and characters are fictional.', at: Date.UTC(2026, 9, 3), place: 'labadi', source: 'Ghana News Agency', url: 'https://gna.org.gh/2026/10/la-mp-confronts-military-over-demolition-at-pleasure-beach/' },
];
let cache = { latest: null, trending: null, at: 0 };
export async function post(p, text, auto = false) {
  const s = p.state, now = Date.now();
  if (!auto) {
    if (!s.onboarded) return { error: 'Finish setting up your life first.' };
    if (s.flags.muteUntil > now) return { error: 'You are muted right now.' };
    if (now - (s.flags.lastGist || 0) < 60000) return { error: 'One post per minute. Breathe small.' };
  }
  const m = moderate(text, 280); if (m.blocked) return { error: BLOCK_MSG[m.blocked] || 'Post blocked.', blocked: m.blocked };
  if (m.text.length < 2) return { error: 'Say something.' };
  s.flags.lastGist = now;
  const r = await pool.query('insert into gist (acct, name, text, flex, auto) values ($1,$2,$3,$4,$5) returning id, extract(epoch from at)*1000 as at', [p.acct, p.name, m.text, flex(s), auto]);
  cache.at = 0; return { ok: true, id: +r.rows[0].id };
}
export async function feed(mode, acct) {
  const now = Date.now();
  if (now - cache.at > 5000) {
    const sel = 'select id, acct, name, text, flex, auto, likes, extract(epoch from at)*1000 as at from gist where not hidden';
    const [a, b] = await Promise.all([pool.query(`${sel} order by id desc limit 40`), pool.query(`${sel} and at > now() - interval '2 days' order by likes desc, id desc limit 40`)]);
    cache = { latest: a.rows, trending: b.rows, at: now };
  }
  let rows = mode === 'trending' ? cache.trending : cache.latest;
  if (mode === 'following') rows = (await pool.query('select g.id, g.acct, g.name, g.text, g.flex, g.auto, g.likes, extract(epoch from g.at)*1000 as at from gist g join gist_follows f on f.target = g.acct and f.acct = $1 where not g.hidden order by g.id desc limit 40', [acct])).rows;
  if (mode === 'me') rows = (await pool.query('select id, acct, name, text, flex, auto, likes, extract(epoch from at)*1000 as at from gist where acct=$1 and not hidden order by id desc limit 40', [acct])).rows;
  const liked = rows.length ? new Set((await pool.query('select post from gist_likes where acct=$1 and post = any($2)', [acct, rows.map((r) => r.id)])).rows.map((r) => +r.post)) : new Set();
  const fol = rows.length ? new Set((await pool.query('select target from gist_follows where acct=$1 and target = any($2)', [acct, [...new Set(rows.map((r) => r.acct))]])).rows.map((r) => r.target)) : new Set();
  const looks=rows.length?new Map((await pool.query("select id,state->'look' as look from players where id=any($1)",[[...new Set(rows.map(r=>r.acct))]])).rows.map(r=>[r.id,r.look])):new Map();
  return rows.map((r) => ({ id: +r.id, u: r.acct, n: r.name, look:looks.get(r.acct), t: r.text, f: r.flex, a: r.auto, l: r.likes, at: +r.at, me: r.acct === acct, liked: liked.has(+r.id), fol: fol.has(r.acct) }));
}
export async function follow(acct, target) {
  target = target | 0; if (!target || target === acct) return { following: false };
  const del = await pool.query('delete from gist_follows where acct=$1 and target=$2', [acct, target]); if (del.rowCount) return { following: false, target };
  await pool.query('insert into gist_follows (acct, target) values ($1,$2) on conflict do nothing', [acct, target]); return { following: true, target };
}
export async function followCounts(acct) { const r = await pool.query('select (select count(*) from gist_follows where target=$1)::int as followers, (select count(*) from gist_follows where acct=$1)::int as following', [acct]); return r.rows[0];
}
export async function like(acct, id) {
  const r = await pool.query('insert into gist_likes (post, acct) values ($1,$2) on conflict do nothing', [id | 0, acct]);
  if (r.rowCount) { await pool.query('update gist set likes = likes + 1 where id=$1', [id | 0]); cache.at = 0; }
  return { ok: true };
}
export async function hide(acct, id) { await pool.query('update gist set hidden = true where id=$1 and acct=$2', [id | 0, acct]); cache.at = 0; return { ok: true }; }
