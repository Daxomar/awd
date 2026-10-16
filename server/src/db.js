// Postgres persistence. Player state is server-owned JSONB; money moves only through server code.
import pg from 'pg';
import { CFG } from './config.js';
import {migrateJournal,saveJournal} from './life-journal.js';
const requestedConnectTimeout=Number(process.env.PG_CONNECT_TIMEOUT_MS||5000);
const connectionTimeoutMillis=Number.isFinite(requestedConnectTimeout)?Math.max(500,Math.min(30000,requestedConnectTimeout)):5000;
export const pool = new pg.Pool({ connectionString: CFG.pgUrl, max: +(process.env.PG_POOL || 10), connectionTimeoutMillis, statement_timeout: 10000 });

export async function migrate() {
  await pool.query(`
  create table if not exists accounts (
    id serial primary key,
    username text unique not null check (char_length(username) between 3 and 16),
    pass text not null,
    dob date,
    created_at timestamptz default now(),
    banned boolean default false
  );
  create table if not exists players (
    id int primary key references accounts(id) on delete cascade,
    state jsonb not null,
    worth bigint default 0,
    updated_at timestamptz default now()
  );
  create index if not exists players_worth on players (worth desc);
  create table if not exists ledger (
    id bigserial primary key, from_id int, to_id int, amount bigint not null, kind text, at timestamptz default now()
  );
  create table if not exists ads (slot text primary key, brand text, line text, emoji text, bg text, fg text, url text, until bigint, ref text);
  create table if not exists ad_requests (id bigserial primary key, account int, slot text, brand text, line text, emoji text, bg text, fg text, url text, weeks int, contact text, ref text, at timestamptz default now());
  create table if not exists votes (week int, account int, cand int, primary key (week, account));
  create table if not exists candidates (week int, account int, name text, policy text, slogan text, primary key (week, account));
  create table if not exists reports (id bigserial primary key, reporter int, target text, text text, at timestamptz default now());
  create table if not exists homes (account int primary key, home text, x real, z real);
  alter table accounts add column if not exists adult_verified boolean not null default false;
  create table if not exists sessions (
    token_hash text primary key, account int not null references accounts(id) on delete cascade,
    expires_at timestamptz not null, last_seen timestamptz not null default now(), created_at timestamptz not null default now()
  );
  create index if not exists sessions_account on sessions(account);
  create index if not exists sessions_expiry on sessions(expires_at);
  `);
  await migrateJournal(pool);
}
export async function loadPlayer(id) { const r = await pool.query('select state from players where id=$1', [id]); return r.rows[0] ? r.rows[0].state : null; }
export async function savePlayers(batch) {
  if (!batch.length) return;
  batch=batch.map(b=>({...b,state:structuredClone(b.state)}));
  const journal=batch.some(b=>b.state.life?.queue?.length),db=journal?await pool.connect():pool;try{
  if(journal){await db.query('begin');for(const b of batch)await saveJournal(db,b.id,b.state);}
  // one round-trip for the whole flush
  const ids = [], states = [], worths = [];
  for (const b of batch) { ids.push(b.id); states.push(JSON.stringify(b.state)); worths.push(Math.round(b.worth || 0)); }
  await db.query(`insert into players (id, state, worth, updated_at)
    select * , now() from unnest($1::int[], $2::jsonb[], $3::bigint[])
    on conflict (id) do update set state = excluded.state, worth = excluded.worth, updated_at = now()`, [ids, states, worths]);
  if(journal)await db.query('commit');
  }catch(e){if(journal)await db.query('rollback');throw e;}finally{if(journal)db.release();}
}
export async function topWorth(n = 50) { const r = await pool.query('select a.username, p.worth, p.state->>\'title\' as title from players p join accounts a on a.id=p.id order by p.worth desc limit $1', [n]); return r.rows; }
