import {catalogue} from './game/property-model.js';

// Caller supplies the existing PostgreSQL pool; no parallel wallet or account store.
export async function migrateProperties(pool,options={}){
  await pool.query(`
    create table if not exists world_properties(
      id text primary key, name text not null, area text not null, neighbourhood text not null,
      template text not null, class text not null, x double precision not null,z double precision not null,
      base_price bigint check(base_price>0),purchase_enabled boolean not null default false,
      residential boolean not null default true,owner int references accounts(id),
      finish text not null default 'neutral',upgrades jsonb not null default '[]'::jsonb,
      revision bigint not null default 1 check(revision>0),last_sale_price bigint check(last_sale_price>0),
      created_at timestamptz not null default now(),updated_at timestamptz not null default now());
    create index if not exists world_properties_owner on world_properties(owner,id);
    create table if not exists property_furnishings(
      id bigserial primary key,item text not null,owner int not null references accounts(id),
      unit text references world_properties(id),paid bigint not null check(paid>=0),
      created_at timestamptz not null default now());
    create index if not exists property_furnishings_owner on property_furnishings(owner,unit,id);
    create unique index if not exists property_one_installed_item on property_furnishings(unit,item) where unit is not null;
    create table if not exists property_residences(
      acct int primary key references accounts(id),unit text not null unique references world_properties(id),
      updated_at timestamptz not null default now());
    create table if not exists property_listings(
      id bigserial primary key,unit text not null references world_properties(id),seller int not null references accounts(id),
      price bigint not null check(price>0 and price<=1000000000),furnished boolean not null,
      included bigint[] not null default '{}'::bigint[],status text not null default 'listed'
        check(status in ('listed','sold','cancelled','expired')),
      buyer int references accounts(id),credit bigint references credits(id),
      expires_at timestamptz not null,created_at timestamptz not null default now(),closed_at timestamptz);
    create unique index if not exists property_one_open_listing on property_listings(unit) where status='listed';
    create index if not exists property_listing_seller on property_listings(seller,status,id);
    create table if not exists property_transactions(
      id bigserial primary key,unit text not null references world_properties(id),actor int not null references accounts(id),
      kind text not null,amount bigint not null default 0 check(amount>=0),
      listing bigint references property_listings(id),facts jsonb not null default '{}'::jsonb,
      at timestamptz not null default now());
    create index if not exists property_transactions_unit on property_transactions(unit,id);
  `);
  for(const p of catalogue(options))await pool.query(`insert into world_properties
    (id,name,area,neighbourhood,template,class,x,z,base_price,purchase_enabled,residential)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(id) do nothing`,
    [p.id,p.name,p.area,p.neighbourhood,p.template,p.class,p.x,p.z,p.basePrice,p.purchaseEnabled,p.residential]);
}

export async function lockUnit(db,id){return (await db.query('select * from world_properties where id=$1 for update',[id])).rows[0]||null;}
export async function installed(db,id,{lock=false}={}){return (await db.query('select id,item,owner,unit,paid from property_furnishings where unit=$1 order by id'+(lock?' for update':''),[id])).rows;}
export async function activeListing(db,id,now,{lock=false}={}){
  return (await db.query("select * from property_listings where unit=$1 and status='listed'"+(lock?' for update':''),[id])).rows.find(row=>row.expires_at.getTime()>now)||null;
}
export async function expireListing(db,row,now){
  const expired=await db.query("update property_listings set status='expired',closed_at=to_timestamp($2/1000.0) where unit=$1 and status='listed' and expires_at<=to_timestamp($2/1000.0) returning id",[row.id,now]);
  if(expired.rowCount)await bumpRevision(db,row,now);
  return expired.rowCount>0;
}
export async function bumpRevision(db,row,now){
  const result=await db.query('update world_properties set revision=revision+1,updated_at=to_timestamp($2/1000.0) where id=$1 returning revision',[row.id,now]);
  row.revision=Number(result.rows[0].revision);return row.revision;
}
export async function recordProperty(db,row,acct,kind,now,{amount=0,listing=null,...facts}={}){
  await db.query('insert into property_transactions(unit,actor,kind,amount,listing,facts,at) values($1,$2,$3,$4,$5,$6,to_timestamp($7/1000.0))',[row.id,acct,kind,amount,listing,JSON.stringify(facts),now]);
}
