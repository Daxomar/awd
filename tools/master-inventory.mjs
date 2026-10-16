// Read-only baseline. Refuse remote databases; never export player records.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {catalog} from '../server/src/game/rules.js';
import {pool} from '../server/src/db.js';

const target = new URL(process.env.DATABASE_URL || '');
if (!['127.0.0.1','localhost'].includes(target.hostname)) throw new Error('Local audit database required');
const out='docs/master/stage0'; fs.mkdirSync(out,{recursive:true});
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
try {
  const cat=catalog(), tables=(await pool.query("select table_name from information_schema.tables where table_schema='public' order by table_name")).rows;
  const database={};
  for (const {table_name:name} of tables) {
    if(!/^[a-z_]+$/.test(name))throw new Error('Unexpected table identifier');
    database[name]={count:Number((await pool.query(`select count(*) n from "${name}"`)).rows[0].n)};
  }
  const ownership=(await pool.query(`select count(*) filter(where state->>'home' is not null) as housed,
    count(*) filter(where state->>'car' is not null) as vehicles,
    count(*) filter(where coalesce(state->'owned','{}'::jsonb)<>'{}'::jsonb) as home_owners,
    count(*) filter(where coalesce(state->'biz','{}'::jsonb)<>'{}'::jsonb) as investors from players`)).rows[0];
  const economy={homes:cat.homes,cars:cat.cars,careers:cat.careers,transport:cat.transport,businesses:cat.biz,origins:cat.origins};
  const geo=JSON.parse(fs.readFileSync('client/public/assets/greater-accra.json'));
  const blueprint=JSON.parse(fs.readFileSync('client/public/assets/city-blueprint.json'));
  const inventory={date:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim().split('\n').filter(Boolean),
    destinations:cat.locs.map(({id,name,area,x,z,neighbourhood,estate,acts})=>({id,name,area,x,z,neighbourhood,estate,actions:acts.map(a=>a.id)})),
    economy,economyHash:hash(economy),destinationHash:hash(cat.locs.map(({id,x,z})=>({id,x,z}))),database,ownership,
    geography:{bounds:geo.boundsMeters,roads:geo.roads.length,decorativeBuildings:blueprint.buildings.length,districts:blueprint.districts.length,source:'Existing OSM data and compiled blueprint retained'},
    privacy:'Only aggregate ownership/table counts and public catalogue are exported. No player, session, message or payment records.'};
  fs.writeFileSync(out+'/inventory.json',JSON.stringify(inventory,null,2)+'\n');
  console.log(JSON.stringify({head:inventory.head,destinations:inventory.destinations.length,tables:tables.length,geography:inventory.geography,ownership}));
} finally {await pool.end();}
