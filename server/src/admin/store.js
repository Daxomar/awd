// Stage 11: administrator persistence. Additive schema only: new tables plus new nullable/defaulted columns.
import {pool} from '../db.js';
import {FLAGS, setFlags} from './flags.js';

export async function migrateAdmin() {
  await pool.query(`
  create table if not exists admin_users(acct int primary key references accounts(id), role text not null, active boolean not null default true,
    granted_by int references accounts(id), granted_at timestamptz not null default now(), version int not null default 1);
  create table if not exists admin_sessions(token_hash text primary key, acct int not null references admin_users(acct),
    expires_at timestamptz not null, last_seen timestamptz not null default now(), created_at timestamptz not null default now());
  create index if not exists admin_sessions_acct on admin_sessions(acct);
  create table if not exists admin_audit(id bigserial primary key, actor int, actor_name text not null, role text, action text not null,
    target text, reason text, detail jsonb not null default '{}', outcome text not null default 'ok', at timestamptz not null default now());
  create index if not exists admin_audit_recent on admin_audit(at desc, id desc);
  create index if not exists admin_audit_target on admin_audit(target, at desc);
  create table if not exists moderation_actions(id bigserial primary key, acct int not null references accounts(id), actor int, actor_name text not null,
    kind text not null, reason text not null, until timestamptz, at timestamptz not null default now());
  create index if not exists moderation_actions_acct on moderation_actions(acct, at desc);
  alter table accounts add column if not exists suspended_until timestamptz;
  alter table reports add column if not exists status text not null default 'open';
  alter table reports add column if not exists handled_by text;
  alter table reports add column if not exists handled_at timestamptz;
  alter table reports add column if not exists resolution text;
  alter table reports add column if not exists target_acct int;
  create index if not exists reports_target_acct on reports(target_acct);
  create index if not exists reports_status_at on reports(status, at desc);
  create table if not exists player_activity_days(acct int not null references accounts(id), day date not null, connections int not null default 0,
    first_at timestamptz not null default now(), last_at timestamptz not null default now(), primary key(acct, day));
  create index if not exists player_activity_day on player_activity_days(day);
  create table if not exists daily_counters(day date not null, key text not null, n bigint not null default 0, primary key(day, key));
  create table if not exists admin_meta(k text primary key, v text not null);
  insert into admin_meta(k, v) values('activity_since', now()::text) on conflict do nothing;
  create table if not exists feature_flags(key text primary key, enabled boolean not null, version int not null default 1,
    updated_by text, updated_at timestamptz not null default now());
  create table if not exists admin_announcements(id bigserial primary key, text text not null, actor_name text not null, at timestamptz not null default now());
  create or replace function admin_audit_append_only() returns trigger language plpgsql as $$ begin raise exception 'admin_audit is append-only'; end $$;
  do $$ begin
    if not exists (select 1 from pg_trigger where tgname = 'admin_audit_no_change') then
      create trigger admin_audit_no_change before update or delete on admin_audit for each row execute function admin_audit_append_only();
    end if;
    if not exists (select 1 from pg_trigger where tgname = 'admin_audit_no_truncate') then
      create trigger admin_audit_no_truncate before truncate on admin_audit for each statement execute function admin_audit_append_only();
    end if;
  end $$;`);
  // Link existing reports to the reported account (game reports use player:ID:name, gist:ID or auto:kind:name).
  await pool.query(`update reports set target_acct = case when target ~ '^player:[0-9]+:' then split_part(target, ':', 2)::int
      when target ~ '^auto:' then reporter
      when target ~ '^gist:[0-9]+$' then (select g.acct from gist g where g.id = split_part(target, ':', 2)::bigint)
      else (select a.id from accounts a where lower(a.username) = lower(target) or a.id::text = target limit 1) end where target_acct is null`);
  await loadFlags();
}
export const REPORT_TARGET_SQL = `case when $2::text ~ '^player:[0-9]+:' then split_part($2::text, ':', 2)::int
      when $2::text ~ '^auto:' then $1::int
      when $2::text ~ '^gist:[0-9]+$' then (select g.acct from gist g where g.id = split_part($2::text, ':', 2)::bigint)
      else (select a.id from accounts a where lower(a.username) = lower($2::text) or a.id::text = $2::text limit 1) end`;

// Every consequential administrator action, and every denied attempt, lands here. The table refuses updates and deletes.
export async function audit(db, admin, action, {target = null, reason = null, detail = {}, outcome = 'ok'} = {}) {
  await db.query('insert into admin_audit(actor,actor_name,role,action,target,reason,detail,outcome) values($1,$2,$3,$4,$5,$6,$7,$8)',
    [admin?.acct ?? null, admin?.name || 'unknown', admin?.role ?? null, action, target == null ? null : String(target).slice(0, 120),
      reason == null ? null : String(reason).slice(0, 500), JSON.stringify(detail), outcome]);
}

// Activity is recorded from the moment this ships; the dashboard says so instead of inventing earlier history.
export async function recordConnection(acct) {
  await pool.query(`insert into player_activity_days(acct, day, connections) values($1, current_date, 1)
    on conflict(acct, day) do update set connections = player_activity_days.connections + 1, last_at = now()`, [acct]);
}
// Players who stay online across midnight still count as active on the new day.
export async function touchOnline(accts) {
  if (!accts.length) return;
  await pool.query(`insert into player_activity_days(acct, day, connections) select unnest($1::int[]), current_date, 0
    on conflict(acct, day) do update set last_at = now()`, [accts]);
}
export async function bump(key, n = 1) {
  await pool.query(`insert into daily_counters(day, key, n) values(current_date, $1, $2)
    on conflict(day, key) do update set n = daily_counters.n + excluded.n`, [key, n]);
}

export async function loadFlags() {
  const rows = (await pool.query('select key, enabled, version, updated_by, updated_at from feature_flags')).rows;
  setFlags(rows);
  return rows;
}
export async function flagRows() {
  const rows = await loadFlags();
  return Object.entries(FLAGS).map(([key, f]) => {
    const r = rows.find(x => x.key === key);
    return {key, name: f.name, detail: f.detail, enabled: r ? r.enabled : f.default, version: r ? r.version : 0, updatedBy: r?.updated_by || null, updatedAt: r?.updated_at || null};
  });
}
// Optimistic concurrency: the change applies only if nobody changed the flag since this administrator loaded it.
export async function changeFlag(db, key, enabled, version, actorName) {
  if (!Object.hasOwn(FLAGS, key)) return {error: 'Unknown flag.'};
  if (typeof enabled !== 'boolean' || !Number.isSafeInteger(version) || version < 0) return {error: 'Invalid flag change.'};
  const r = version === 0
    ? await db.query('insert into feature_flags(key, enabled, version, updated_by) values($1, $2, 1, $3) on conflict(key) do nothing returning version', [key, enabled, actorName])
    : await db.query('update feature_flags set enabled=$2, version=version+1, updated_by=$4, updated_at=now() where key=$1 and version=$3 returning version', [key, enabled, version, actorName]);
  if (!r.rowCount) return {error: 'Another administrator changed this flag. Reload and try again.', httpStatus: '409 Conflict'};
  return {ok: true, version: r.rows[0].version};
}
