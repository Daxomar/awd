// Disposable browser-journey fixture for Stage 3: give an offline QA account a car or
// test funds. Refuses anything except the loopback awd_security database and the
// generated p8* fixture accounts. Run only while the account is disconnected.
import pg from 'pg';

const u = new URL(process.env.DATABASE_URL || 'http://invalid');
if (process.env.NODE_ENV === 'production' || !['127.0.0.1', 'localhost'].includes(u.hostname) || u.pathname !== '/awd_security')
  throw Error('Disposable local awd_security only.');
const [op, idText, value] = process.argv.slice(2), id = Number(idText);
const CARS = ['vitz', 'corolla', 'prado', 'gwagon'];
if (!Number.isSafeInteger(id) || !(op === 'grant-car' && CARS.includes(value) || op === 'fund' && Number.isSafeInteger(Number(value)) && Number(value) > 0))
  throw Error('Usage: vehicle-fixtures.js grant-car <id> <vitz|corolla|prado|gwagon> | fund <id> <whole amount>');
const db = new pg.Client({connectionString: u.href});
await db.connect();
try {
  const fixture = (await db.query("select 1 from accounts where id=$1 and username like 'p8%'", [id])).rowCount;
  if (!fixture) throw Error('Only generated p8* QA fixture accounts can be changed.');
  const patch = op === 'grant-car' ? {car: value, carStyle: {paint: 'factory'}} : null;
  const r = patch
    ? await db.query('update players set state=state||$2::jsonb where id=$1', [id, JSON.stringify(patch)])
    : await db.query("update players set state=jsonb_set(state,'{momo}',to_jsonb((state->>'momo')::bigint+$2)) where id=$1", [id, Number(value)]);
  if (!r.rowCount) throw Error('Fixture player not found.');
  console.log(`QA fixture ${op} applied to disposable account ${id}.`);
} finally { await db.end(); }
