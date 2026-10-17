// Stage 11 browser QA fixtures: disposable owner, support analyst and target accounts in the isolated *_security
// database. Credentials go to .local/master/admin-fixtures.json (git-ignored) and are never printed.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
assert.notEqual(process.env.NODE_ENV, 'production', 'Do not create fixtures in production.');
const dbUrl = new URL(process.env.DATABASE_URL || 'postgres://invalid/invalid');
assert.ok(['localhost', '127.0.0.1'].includes(dbUrl.hostname) && dbUrl.pathname.endsWith('_security'), 'Isolated local *_security database required');
const {pool} = await import('../src/db.js'), {hashPassword} = await import('../src/auth.js'), Game = await import('../src/game/rules.js');
const tag = Date.now().toString(36).slice(-6), out = {};
try {
  for (const [key, role] of [['owner', 'owner'], ['support', 'support'], ['target', null]]) {
    const name = `${key.slice(0, 2)}ui${tag}`, password = crypto.randomBytes(18).toString('base64url');
    const id = +(await pool.query('insert into accounts(username, pass, adult_verified) values($1, $2, true) returning id', [name, await hashPassword(password)])).rows[0].id;
    const state = Game.newState({id, u: name}); state.onboarded = true;
    await pool.query('insert into players(id, state) values($1, $2)', [id, JSON.stringify(state)]);
    if (role) await pool.query('insert into admin_users(acct, role) values($1, $2)', [id, role]);
    await pool.query('insert into player_activity_days(acct, day, connections) values($1, current_date, 1) on conflict do nothing', [id]);
    out[key] = {id, name, password};
  }
  await pool.query('insert into reports(reporter, target, text, target_acct) values($1, $2, $3, $4)', [out.support.id, `player:${out.target.id}:${out.target.name}`, 'Keeps posting spam links in city chat (QA fixture)', out.target.id]);
  fs.mkdirSync('../.local/master', {recursive: true});
  fs.writeFileSync('../.local/master/admin-fixtures.json', JSON.stringify(out));
  console.log('admin fixtures written');
} finally { await pool.end(); }
