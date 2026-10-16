// Disposable browser-journey fixture: give one catalogue unit an explicit test price.
// Refuses anything except the loopback awd_security QA database. Production catalogue
// prices are configured in game/property-model.js and are never changed here.
import pg from 'pg';

const u = new URL(process.env.DATABASE_URL || 'http://invalid');
if (process.env.NODE_ENV === 'production' || !['127.0.0.1', 'localhost'].includes(u.hostname) || u.pathname !== '/awd_security')
  throw Error('Disposable local awd_security only.');
const [op, unit, value] = process.argv.slice(2);
if (op !== 'price-unit' || !/^awd-[a-z]+-\d{2}$/.test(unit || '') || !Number.isSafeInteger(Number(value)) || Number(value) < 1)
  throw Error('Usage: node loadtest/property-fixtures.js price-unit <unowned unit id> <whole test price>');
const db = new pg.Client({ connectionString: u.href });
await db.connect();
try {
  const r = await db.query('update world_properties set base_price=$2,purchase_enabled=true where id=$1 and owner is null returning id', [unit, Number(value)]);
  if (!r.rowCount) throw Error('Unit not found or already owned.');
  console.log(`QA fixture: ${unit} priced at GH₵${Number(value)} in the disposable database only.`);
} finally { await db.end(); }
