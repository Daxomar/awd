// Stage 11: grant the first owner (or any role) from a shell with database access. There is deliberately no web
// route that can create the first administrator. Usage: npm run admin:grant -- <username> <role> "<reason>"
// Roles: owner, ops, moderator, support, finance. Use role "none" to remove access.
import {pool, migrate} from './src/db.js';
import {migrateGist} from './src/gist.js';
import {migrateAdmin, audit} from './src/admin/store.js';
import {isRole} from './src/admin/roles.js';

const [username, role, reason = 'Granted from the server shell'] = process.argv.slice(2);
if (!/^[a-zA-Z0-9_]{3,16}$/.test(username || '') || !(isRole(role) || role === 'none')) {
  console.error('Usage: npm run admin:grant -- <username> <owner|ops|moderator|support|finance|none> "<reason>"');
  process.exit(2);
}
await migrate(); await migrateGist(); await migrateAdmin();
const a = (await pool.query('select id, username from accounts where lower(username) = lower($1)', [username])).rows[0];
if (!a) { console.error('No account with that username. Create it in the game first.'); await pool.end(); process.exit(1); }
if (role === 'none') await pool.query('update admin_users set active = false, version = version + 1 where acct = $1', [a.id]);
else await pool.query(`insert into admin_users(acct, role) values($1, $2)
  on conflict(acct) do update set role = excluded.role, active = true, granted_at = now(), version = admin_users.version + 1`, [a.id, role]);
await pool.query('delete from admin_sessions where acct = $1', [a.id]);
await audit(pool, {name: 'server-shell'}, role === 'none' ? 'admins.revoke' : 'admins.grant', {target: `acct:${a.id}`, reason: String(reason).slice(0, 500), detail: {username: a.username, role}});
console.log(`${a.username}: ${role === 'none' ? 'administrator access removed' : 'role ' + role}`);
await pool.end();
