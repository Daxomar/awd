// Stage 11: dashboard metrics computed from data the game actually stores. Each metric carries its definition, and
// activity-based figures report when collection started instead of inventing earlier history.
import {pool} from '../db.js';

export const DEFINITIONS = {
  registered: 'Accounts ever created (accounts table).',
  dau: 'Distinct accounts that entered the city today (server date), counted once however often they reconnect or refresh.',
  wau: 'Distinct accounts active on any of the last 7 days, including today.',
  mau: 'Distinct accounts active on any of the last 30 days, including today.',
  online: 'Players connected to the city right now, summed across live shards.',
  sessions: 'Sign-ins and sign-ups that issued a new login session today.',
  visits: 'Successful entries into the city today (each connection, including reconnects). Not unique players.',
  newRegistrations: 'Accounts created today / in the last 7 days.',
  returning: 'Accounts active today that were also active on an earlier day.',
  retention: 'Of the accounts created in a signup week, the share active again 1, 7 and 30 days after signup. Only cohorts created after activity collection began are measured.',
  activeBusinesses: 'Player businesses currently operating.',
  propertyTransactions: 'Recorded property purchases, resales, listings, renovations and furnishing in the last 7 days.',
  activeCampaigns: 'Paid advertising campaigns on air right now.',
};

async function one(sql, args = []) { return (await pool.query(sql, args)).rows[0]; }

export async function overview({online, shards}) {
  const since = (await one("select v from admin_meta where k='activity_since'"))?.v || null;
  const act = await one(`select
      count(distinct acct) filter (where day = current_date)::int as dau,
      count(distinct acct) filter (where day > current_date - 7)::int as wau,
      count(distinct acct) filter (where day > current_date - 30)::int as mau,
      coalesce(sum(connections) filter (where day = current_date), 0)::int as visits
    from player_activity_days where day > current_date - 30`);
  const returning = await one(`select count(*)::int n from player_activity_days t where t.day = current_date
    and exists (select 1 from player_activity_days e where e.acct = t.acct and e.day < current_date)`);
  const reg = await one(`select count(*)::int total, count(*) filter (where created_at >= current_date)::int today,
    count(*) filter (where created_at > now() - interval '7 days')::int week from accounts`);
  const sessions = await one("select coalesce(sum(n), 0)::int n from daily_counters where day = current_date and key in ('signin', 'signup')");
  const biz = await one('select count(*)::int n from life_businesses where operating');
  const prop = await one("select count(*)::int n from property_transactions where at > now() - interval '7 days'");
  const ads = await one("select count(*)::int n from ad_orders where status = 'approved' and starts <= $1 and ends > $1", [Date.now()]);
  return {
    collectedSince: since, definitions: DEFINITIONS,
    metrics: {registered: reg.total, dau: act.dau, wau: act.wau, mau: act.mau, online, shards, sessions: sessions.n, visits: act.visits,
      newToday: reg.today, newWeek: reg.week, returning: returning.n, activeBusinesses: biz.n, propertyTransactions: prop.n, activeCampaigns: ads.n},
    daily: await dailySeries(), retention: await retention(since),
  };
}
async function dailySeries() {
  return (await pool.query(`select d::date as day,
      (select count(*)::int from player_activity_days a where a.day = d::date) as active,
      (select count(*)::int from accounts c where c.created_at::date = d::date) as registrations,
      (select coalesce(sum(n), 0)::int from daily_counters k where k.day = d::date and k.key in ('signin', 'signup')) as sessions
    from generate_series(current_date - 13, current_date, interval '1 day') d order by d`)).rows;
}
async function retention(since) {
  if (!since) return [];
  return (await pool.query(`with c as (select id, created_at::date as d0 from accounts where created_at >= $1::timestamptz and created_at > now() - interval '8 weeks')
    select date_trunc('week', d0)::date as week, count(*)::int as size,
      count(*) filter (where d0 + 1 <= current_date)::int as eligible1,
      count(*) filter (where exists (select 1 from player_activity_days a where a.acct = c.id and a.day = d0 + 1))::int as day1,
      count(*) filter (where d0 + 7 <= current_date)::int as eligible7,
      count(*) filter (where exists (select 1 from player_activity_days a where a.acct = c.id and a.day = d0 + 7))::int as day7,
      count(*) filter (where d0 + 30 <= current_date)::int as eligible30,
      count(*) filter (where exists (select 1 from player_activity_days a where a.acct = c.id and a.day = d0 + 30))::int as day30
    from c group by 1 order by 1 desc`, [since])).rows;
}

// Journal labels are free text; these buckets are an inference documented on the dashboard.
const BUCKETS = `case
  when label ~* '(shift|^gig$|auto-work pay)' then 'Salary and gigs'
  when label ~* 'business profit|capital returned' then 'Business'
  when label ~* 'savings' then 'Savings'
  when label ~* '(transfer|credit|sold|from @|sale|resale|refund)' then 'Player transfers and sales'
  when label ~* '(rent|fare|fuel|transport|rental|data bundle|meals|ingredients|repair)' then 'Living costs'
  when label ~* '(fine|misfortune|hospital|loan)' then 'Fines, health and loans'
  when label ~* '(milestone|reward|bonus|funding)' then 'Rewards'
  else 'Other' end`;
export async function economy(days = 7) {
  const d = Math.max(1, Math.min(30, days | 0 || 7));
  const flows = (await pool.query(`select ${BUCKETS} as bucket, sum(greatest(delta, 0))::bigint as created, sum(least(delta, 0))::bigint as removed, count(*)::int as entries
    from (select (facts->>'delta')::numeric as delta, coalesce(facts->>'label', '') as label from life_events where kind = 'money' and at > now() - make_interval(days => $1)) m
    group by 1 order by 2 desc`, [d])).rows;
  const transfers = (await pool.query(`select kind, count(*)::int as n, coalesce(sum(amount), 0)::bigint as volume from ledger
    where at > now() - make_interval(days => $1) and kind in ('market', 'vehicle', 'property', 'p2p') group by kind`, [d])).rows;
  const property = (await pool.query(`select kind, count(*)::int as n, coalesce(sum(amount), 0)::bigint as volume from property_transactions
    where at > now() - make_interval(days => $1) group by kind order by 2 desc`, [d])).rows;
  const vehicles = await one(`select count(*)::int as n, coalesce(sum(price), 0)::bigint as volume from vehicle_listings where status = 'sold' and closed_at > now() - make_interval(days => $1)`, [d]);
  const unusual = (await pool.query(`select e.acct, a.username, e.at, e.facts->>'label' as label, (e.facts->>'delta')::numeric as delta from life_events e join accounts a on a.id = e.acct
    where e.kind = 'money' and e.at > now() - make_interval(days => $1) and abs((e.facts->>'delta')::numeric) >= 20000 order by e.at desc limit 50`, [d])).rows;
  const inflow = (await pool.query(`select e.acct, a.username, sum((e.facts->>'delta')::numeric)::bigint as earned from life_events e join accounts a on a.id = e.acct
    where e.kind = 'money' and e.at > now() - interval '1 day' and (e.facts->>'delta')::numeric > 0 group by 1, 2 having sum((e.facts->>'delta')::numeric) >= 50000 order by 3 desc limit 20`)).rows;
  return {days: d, flows, transfers, property, vehicles, unusual, inflow, reconciliation: await reconciliation(),
    note: 'Buckets come from money-journal labels. Transfers between players move money without creating it.'};
}
// A saved wallet should equal the balance written with its latest journal entry. Players saved in the last
// two minutes may still have entries in flight, so they are skipped.
// The check scans the whole money journal, so one result is shared for a minute.
let recCache = null;
export async function reconciliation() {
  if (recCache && Date.now() - recCache.checkedAt < 60000) return recCache;
  const r = await one(`with last as (select distinct on (acct) acct, (facts->>'balance')::numeric as balance from life_events where kind = 'money' order by acct, seq desc)
    select count(*)::int as checked,
      count(*) filter (where abs(l.balance - ((p.state->>'cash')::numeric + (p.state->>'momo')::numeric)) > 1)::int as mismatched,
      coalesce(json_agg(json_build_object('acct', p.id, 'journal', l.balance, 'wallet', (p.state->>'cash')::numeric + (p.state->>'momo')::numeric))
        filter (where abs(l.balance - ((p.state->>'cash')::numeric + (p.state->>'momo')::numeric)) > 1), '[]') as samples
    from players p join last l on l.acct = p.id where p.updated_at < now() - interval '2 minutes'`);
  recCache = {checked: r.checked, mismatched: r.mismatched, samples: (r.samples || []).slice(0, 20), checkedAt: Date.now()};
  return recCache;
}

export async function adsSummary() {
  const now = Date.now();
  const status = (await pool.query(`select case when status = 'approved' and ends <= $1 then 'expired' when status = 'approved' and starts > $1 then 'scheduled'
      when status = 'approved' then 'active' when status = 'paid' and review is not null then 'in_review' else status end as state, count(*)::int as n
    from ad_orders group by 1 order by 2 desc`, [now])).rows;
  const revenue = await one(`select coalesce(sum(amount) filter (where fulfilled_at > now() - interval '30 days'), 0)::bigint as month,
    coalesce(sum(amount) filter (where fulfilled_at is not null), 0)::bigint as total from payment_orders where type = 'ad'`);
  const impressions = await one(`select coalesce(sum(impressions), 0)::bigint as impressions, coalesce(sum(clicks), 0)::bigint as clicks
    from ad_metrics_daily where day > current_date - 30`);
  const refunds = (await pool.query(`select p.id, p.legacy_id as campaign, p.amount, p.status, p.review_reason, a.title, a.status as campaign_status
    from payment_orders p left join ad_orders a on a.id = p.legacy_id where p.type = 'ad' and (p.status = 'review' or p.review_reason is not null) order by p.id desc limit 50`)).rows;
  return {status, revenue: {month: +revenue.month, total: +revenue.total, currency: 'GHS pesewas'}, impressions, refunds,
    note: 'Impressions are estimates from measured on-screen exposure, at most one per viewer per 15 minutes.'};
}
const CAMPAIGN_FILTERS = {
  active: "a.status = 'approved' and a.starts <= $1 and a.ends > $1", scheduled: "a.status = 'approved' and a.starts > $1",
  expired: "a.status = 'approved' and a.ends <= $1", in_review: "a.status = 'paid' and a.review is not null",
  pending_payment: "a.status = 'pending_payment'", suspended: "a.status in ('suspended', 'rejected')", all: '$1::bigint is not null',
};
const pageOf = ({page = 1, limit = 25}) => { const lim = Math.max(1, Math.min(100, limit | 0 || 25)); return {lim, off: (Math.max(1, page | 0 || 1) - 1) * lim}; };
export async function campaigns({filter = 'all', ...p} = {}) {
  const where = Object.hasOwn(CAMPAIGN_FILTERS, filter) ? CAMPAIGN_FILTERS[filter] : CAMPAIGN_FILTERS.all, {lim, off} = pageOf(p);
  const rows = (await pool.query(`select a.id, a.slot, a.title, a.url, a.category, a.review, a.status, a.starts, a.ends, a.amount, a.weeks, a.note, p.status as payment,
      coalesce((select sum(impressions) from ad_metrics_daily m where m.campaign = a.id), 0)::int as impressions, count(*) over() as total
    from ad_orders a left join payment_orders p on p.type = 'ad' and p.legacy_id = a.id where ${where} order by a.id desc limit ${lim} offset ${off}`, [Date.now()])).rows;
  return {rows: rows.map(({total, ...r}) => ({...r, id: +r.id, img: `/ads/${r.id}.jpg`})), total: +(rows[0]?.total || 0), page: off / lim + 1, limit: lim, filters: Object.keys(CAMPAIGN_FILTERS)};
}

const PAY_FILTERS = {all: 'true', pending: "o.status = 'pending'", fulfilled: 'o.fulfilled_at is not null', review: "o.status = 'review' or o.review_reason is not null",
  failed: "o.status in ('failed', 'cancelled')"};
export async function payments({filter = 'all', type = '', ...p} = {}) {
  const where = Object.hasOwn(PAY_FILTERS, filter) ? PAY_FILTERS[filter] : 'true', {lim, off} = pageOf(p);
  const t = ['ad', 'topup'].includes(type) ? type : null;
  const rows = (await pool.query(`select o.id, o.type, o.acct, ac.username, o.amount, o.currency, o.status, o.review_reason, o.created_at, o.fulfilled_at,
      (select json_agg(json_build_object('ref', a.ref, 'status', a.status, 'verified', a.verified_at, 'checks', a.checks, 'failure', a.failure) order by a.id) from payment_attempts a where a.order_id = o.id) as attempts,
      (select count(*) from payment_events e join payment_attempts a on a.ref = e.ref where a.order_id = o.id and e.event = 'charge.success')::int as charges,
      (select json_build_object('queued', r.created_at, 'sent', r.sent_at) from payment_receipt_outbox r where r.order_id = o.id) as receipt,
      count(*) over() as total
    from payment_orders o left join accounts ac on ac.id = o.acct where (${where}) and ($1::text is null or o.type = $1) order by o.id desc limit ${lim} offset ${off}`, [t])).rows;
  const summary = await one(`select count(*) filter (where status = 'pending')::int as pending, count(*) filter (where fulfilled_at is not null)::int as fulfilled,
    count(*) filter (where status = 'review')::int as review,
    (select count(*) from payment_attempts where fulfilled_at is null and checks > 0)::int as unresolved,
    (select count(*) from (select a.order_id from payment_events e join payment_attempts a on a.ref = e.ref where e.event = 'charge.success' group by a.order_id having count(distinct e.provider_id) > 1) d)::int as duplicate,
    (select count(*) from payment_receipt_outbox where sent_at is null)::int as "receiptsQueued" from payment_orders`);
  return {rows: rows.map(({total, ...r}) => r), total: +(rows[0]?.total || 0), page: off / lim + 1, limit: lim, summary, filters: Object.keys(PAY_FILTERS),
    note: 'Payments are fulfilled only after server-to-server verification with the provider. Nothing here marks a payment as paid.'};
}
