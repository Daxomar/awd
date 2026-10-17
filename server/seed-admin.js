#!/usr/bin/env node
// Seed an administrator user into the Accra We Dey database.
// Can be run locally or against live/staging databases (e.g., Render) via DATABASE_URL.
// Usage:
//   node server/seed-admin.js [--username <name>] [--password <pass>] [--role <role>] [--db <url>]
//   npm --prefix server run seed:admin -- --username admin_owner --password Admin@Accra2026!
//   DATABASE_URL="postgres://..." node server/seed-admin.js

import crypto from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';
import { isRole } from './src/admin/roles.js';

const scrypt = promisify(crypto.scrypt);

// Parse CLI flags
function parseArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--username' || arg === '-u') opts.username = args[++i];
    else if (arg === '--password' || arg === '-p') opts.password = args[++i];
    else if (arg === '--role' || arg === '-r') opts.role = args[++i];
    else if (arg === '--db') opts.db = args[++i];
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (!arg.startsWith('-') && !opts.db && arg.startsWith('postgres')) opts.db = arg;
  }
  return opts;
}

async function hashPassword(password, salt = crypto.randomBytes(16), cost = 32768) {
  const key = await scrypt(password, salt, 32, { N: cost, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${cost}$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(`
Accra We Dey - Admin User Seeder

Usage:
  node server/seed-admin.js [options]
  node tools/seed-admin.js [options]

Options:
  -u, --username <name>  Username (3-16 letters, numbers, _, default: admin_owner)
  -p, --password <pass>  Password (12-128 chars, default: Admin@Accra2026!)
  -r, --role <role>      Admin role (owner, ops, moderator, support, finance; default: owner)
  --db <url>             Postgres connection string (or set DATABASE_URL env var)
  -h, --help             Show this help message

Examples:
  node server/seed-admin.js
  node server/seed-admin.js -u myadmin -p "SuperSecret1234!"
  DATABASE_URL="postgres://..." node server/seed-admin.js
`);
    process.exit(0);
  }

  const username = opts.username || 'admin_owner';
  const password = opts.password || 'Admin@Accra2026!';
  const role = opts.role || 'owner';

  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    console.error(`[Error] Invalid username "${username}". Must be 3–16 letters, numbers, or underscore.`);
    process.exit(1);
  }

  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    console.error(`[Error] Password must be between 12 and 128 characters long.`);
    process.exit(1);
  }

  if (!isRole(role)) {
    console.error(`[Error] Invalid role "${role}". Allowed roles: owner, ops, moderator, support, finance.`);
    process.exit(1);
  }

  const rawUrl = opts.db || process.env.DATABASE_URL || 'postgres://awd:awd@127.0.0.1:5432/awd';
  let ssl = undefined;
  try {
    const u = new URL(rawUrl);
    if (!['localhost', '127.0.0.1', 'db'].includes(u.hostname)) {
      ssl = { rejectUnauthorized: false };
    }
  } catch (e) {
    console.error('[Error] Invalid database connection string:', e.message);
    process.exit(1);
  }

  console.log(`\nConnecting to database...`);
  const pool = new pg.Pool({ connectionString: rawUrl, ssl, connectionTimeoutMillis: 10000 });

  try {
    const client = await pool.connect();
    client.release();
    console.log(`Database connected successfully.`);

    // Ensure required tables exist
    console.log(`Ensuring admin and account schemas exist...`);
    const { migrate } = await import('./src/db.js').catch(() => ({ migrate: null }));
    const { migrateAdmin } = await import('./src/admin/store.js').catch(() => ({ migrateAdmin: null }));
    if (migrate) await migrate().catch(err => console.warn('[warn] migrate:', err.message));
    if (migrateAdmin) await migrateAdmin().catch(err => console.warn('[warn] migrateAdmin:', err.message));

    const passHash = await hashPassword(password);

    // 1. Check if account already exists
    const existing = (await pool.query('SELECT id, username FROM accounts WHERE lower(username) = lower($1)', [username])).rows[0];
    let acctId;

    if (existing) {
      acctId = existing.id;
      console.log(`Account "${existing.username}" (ID: ${acctId}) already exists. Updating credentials...`);
      await pool.query(
        'UPDATE accounts SET pass = $1, adult_verified = true, banned = false, suspended_until = null WHERE id = $2',
        [passHash, acctId]
      );
    } else {
      console.log(`Creating new account "${username}"...`);
      const res = await pool.query(
        'INSERT INTO accounts(username, pass, adult_verified, banned) VALUES($1, $2, true, false) RETURNING id, username',
        [username, passHash]
      );
      acctId = res.rows[0].id;
      console.log(`Account created with ID: ${acctId}`);
    }

    // 2. Ensure player row exists so this account can also access the game
    const hasPlayer = (await pool.query('SELECT 1 FROM players WHERE id = $1', [acctId])).rowCount > 0;
    if (!hasPlayer) {
      const state = {
        v: 2,
        name: username,
        onboarded: true,
        created: Date.now(),
        cash: 500,
        momo: 1000,
        n: { hunger: 80, energy: 85, fun: 70, social: 60, hygiene: 75, bladder: 70 },
        look: { body: 'm', skinTone: 5, top: '#2b3a55', bottom: '#1d2433' },
        wardrobe: {},
        stats: { earned: 0, shifts: 0, meals: 0, gigs: 0, promos: 0 },
        flags: {}
      };
      await pool.query('INSERT INTO players(id, state, worth) VALUES($1, $2, 1500) ON CONFLICT (id) DO NOTHING', [acctId, JSON.stringify(state)]);
    }

    // 3. Grant/upsert admin role in admin_users
    console.log(`Granting "${role}" role in admin_users...`);
    await pool.query(`
      INSERT INTO admin_users(acct, role, active, version)
      VALUES($1, $2, true, 1)
      ON CONFLICT (acct) DO UPDATE
        SET role = excluded.role, active = true, version = admin_users.version + 1, granted_at = now()
    `, [acctId, role]);

    // 4. Invalidate any stale admin sessions
    await pool.query('DELETE FROM admin_sessions WHERE acct = $1', [acctId]);

    // 5. Audit log
    try {
      await pool.query(`
        INSERT INTO admin_audit(actor, actor_name, role, action, target, reason, detail, outcome)
        VALUES($1, $2, $3, 'admins.seed', 'self', 'Seeded via seed-admin script', $4, 'ok')
      `, [acctId, username, role, JSON.stringify({ username, role, at: new Date().toISOString() })]);
    } catch {}

    console.log(`
========================================================================
  ACCRA WE DEY - ADMIN USER READY
========================================================================
  Role      : ${role.toUpperCase()} (Full Permissions)
  Username  : ${username}
  Password  : ${password}
  Account ID: ${acctId}

  Live Admin Login URL:
  -> https://accrawedey.world/admin.html
  (or local dev: http://localhost:8080/admin.html)

  Instructions:
  1. Open https://accrawedey.world/admin.html in your browser.
  2. Enter the Username and Password shown above.
  3. You will immediately enter the live Admin Operations dashboard.
========================================================================
`);
  } catch (err) {
    console.error(`\n[Database Error] ${err.message}`);
    if (err.code === 'ECONNREFUSED') {
      console.error('Make sure PostgreSQL is running or provide a valid DATABASE_URL.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
