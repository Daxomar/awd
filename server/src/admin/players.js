// Stage 11: player management. Overviews never include password hashes, session tokens, payment credentials
// or private-message text; message activity is shown only as counts.
import {pool} from '../db.js';
import {audit} from './store.js';
import {can, isRole, ROLES} from './roles.js';

const STATUS = {
  all: 'true', banned: 'a.banned', suspended: 'a.suspended_until > now()', staff: 'exists (select 1 from admin_users u where u.acct = a.id and u.active)',
  reported: "exists (select 1 from reports r where r.target_acct = a.id)",
};
const pageOf = ({page = 1, limit = 25}) => { const lim = Math.max(1, Math.min(100, limit | 0 || 25)); return {lim, off: (Math.max(1, page | 0 || 1) - 1) * lim}; };
export const cleanReason = r => (typeof r === 'string' ? r.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 500) : '');

export async function search({q = '', status = 'all', ...p} = {}, online = () => false) {
  const term = String(q).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16), where = Object.hasOwn(STATUS, status) ? STATUS[status] : 'true', {lim, off} = pageOf(p);
  const rows = (await pool.query(`select a.id, a.username, a.created_at, a.banned, a.suspended_until, p.worth, p.updated_at as last_saved,
      (select max(day) from player_activity_days d where d.acct = a.id) as last_active, count(*) over() as total
    from accounts a left join players p on p.id = a.id
    where ($1 = '' or a.username ilike $1 || '%' or a.id::text = $1) and (${where}) order by a.id desc limit ${lim} offset ${off}`, [term])).rows;
  return {rows: rows.map(({total, ...r}) => ({...r, online: online(r.id)})), total: +(rows[0]?.total || 0), page: off / lim + 1, limit: lim, filters: Object.keys(STATUS)};
}

export async function account(admin, id, online = () => false) {
  if (!Number.isSafeInteger(id) || id < 1) return {error: 'Choose a player.'};
  const a = (await pool.query(`select a.id, a.username, a.created_at, a.banned, a.suspended_until, a.adult_verified, p.worth, p.updated_at,
      p.state->>'cash' as cash, p.state->>'momo' as momo, p.state->'job'->>'id' as job, p.state->>'home' as home, p.state->>'title' as title,
      p.state->>'xp' as xp, p.state->>'origin' as origin, p.state->>'place' as place
    from accounts a left join players p on p.id = a.id where a.id = $1`, [id])).rows[0];
  if (!a) return {error: 'Player not found.', httpStatus: '404 Not Found'};
  const [mods, reportsAgainst, reportsBy, activity, holdings, messages, staff] = await Promise.all([
    pool.query('select id, kind, reason, until, actor_name, at from moderation_actions where acct = $1 order by at desc limit 50', [id]),
    pool.query('select id, reporter, target, text, status, resolution, at from reports where target_acct = $1 order by at desc limit 50', [id]),
    pool.query('select count(*)::int n from reports where reporter = $1', [id]),
    pool.query('select day, connections from player_activity_days where acct = $1 order by day desc limit 14', [id]),
    pool.query(`select (select count(*) from life_businesses where owner = $1)::int as businesses,
      (select count(*) from world_properties where owner = $1)::int as properties,
      (select count(*) from vehicle_listings where seller = $1 and status = 'listed')::int as vehicle_listings`, [id]).catch(() => ({rows: [{}]})),
    pool.query('select (select count(*) from dms where from_id = $1)::int as sent, (select count(*) from dms where to_id = $1)::int as received', [id]),
    pool.query('select role, active from admin_users where acct = $1', [id]),
  ]);
  const out = {account: a, online: online(id), moderation: mods.rows, reports: reportsAgainst.rows, reportsFiled: reportsBy.rows[0].n,
    activity: activity.rows, holdings: holdings.rows[0], messages: messages.rows[0], staff: staff.rows[0] || null};
  if (can(admin.role, 'players.records')) {
    out.money = (await pool.query(`select seq, at, facts->>'label' as label, (facts->>'delta')::numeric as delta, (facts->>'balance')::numeric as balance
      from life_events where acct = $1 and kind = 'money' order by seq desc limit 40`, [id])).rows;
    await audit(pool, admin, 'players.records.view', {target: `acct:${id}`});
  }
  return out;
}

// kind → required permission. Every action needs a reason and lands in moderation_actions and the audit log.
export const MOD_ACTIONS = {note: 'moderation.note', appeal: 'moderation.note', suspend: 'moderation.suspend', unsuspend: 'moderation.suspend',
  ban: 'moderation.ban', unban: 'moderation.ban'};
export async function moderate(admin, b, disconnect) {
  const id = Number(b.acct), kind = b.kind, reason = cleanReason(b.reason);
  if (!Object.hasOwn(MOD_ACTIONS, kind) || !Number.isSafeInteger(id) || id < 1) return {error: 'Choose a player and an action.'};
  if (reason.length < 5) return {error: 'Give a reason of at least 5 characters.'};
  const hours = Number(b.hours);
  if (kind === 'suspend' && !(Number.isInteger(hours) && hours >= 1 && hours <= 24 * 90)) return {error: 'Suspensions last 1 hour to 90 days.'};
  if (id === admin.acct && ['suspend', 'ban'].includes(kind)) return {error: 'You cannot suspend or ban your own account.'};
  const db = await pool.connect();
  try {
    await db.query('begin');
    const t = (await db.query('select id, username, banned, suspended_until from accounts where id = $1 for update', [id])).rows[0];
    if (!t) { await db.query('rollback'); return {error: 'Player not found.', httpStatus: '404 Not Found'}; }
    const staff = (await db.query('select role from admin_users where acct = $1 and active', [id])).rows[0];
    // Staff cannot lock each other out: only an owner may suspend or ban an account that holds an administrator role.
    if (staff && ['suspend', 'ban'].includes(kind) && admin.role !== 'owner') { await db.query('rollback'); return {error: 'Only an owner can suspend or ban a staff account.', httpStatus: '403 Forbidden'}; }
    const until = kind === 'suspend' ? new Date(Date.now() + hours * 3600000) : null;
    if (kind === 'suspend') await db.query('update accounts set suspended_until = $2 where id = $1', [id, until]);
    if (kind === 'unsuspend') await db.query('update accounts set suspended_until = null where id = $1', [id]);
    if (kind === 'ban' || kind === 'unban') await db.query('update accounts set banned = $2 where id = $1', [id, kind === 'ban']);
    if (kind === 'suspend' || kind === 'ban') await db.query('delete from sessions where account = $1', [id]);
    await db.query('insert into moderation_actions(acct, actor, actor_name, kind, reason, until) values($1, $2, $3, $4, $5, $6)', [id, admin.acct, admin.name, kind, reason, until]);
    await audit(db, admin, `moderation.${kind}`, {target: `acct:${id}`, reason, detail: {username: t.username, hours: kind === 'suspend' ? hours : undefined}});
    await db.query('commit');
    if (kind === 'suspend' || kind === 'ban') disconnect(id);
    return {ok: true, until};
  } catch (e) { await db.query('rollback').catch(() => {}); throw e; } finally { db.release(); }
}

const REPORT_FILTERS = {open: "r.status = 'open'", closed: "r.status <> 'open'", all: 'true'};
export async function reports({status = 'open', ...p} = {}) {
  const where = Object.hasOwn(REPORT_FILTERS, status) ? REPORT_FILTERS[status] : REPORT_FILTERS.open, {lim, off} = pageOf(p);
  const rows = (await pool.query(`select r.id, r.reporter, ra.username as reporter_name, r.target, t.id as target_acct, t.username as target_name, r.text, r.status, r.resolution, r.handled_by, r.handled_at, r.at,
      count(*) over() as total
    from reports r left join accounts ra on ra.id = r.reporter left join accounts t on t.id = r.target_acct
    where ${where} order by r.at desc limit ${lim} offset ${off}`)).rows;
  const events = (await pool.query(`select r.event, e.title, r.reason, r.at from event_reports r join game_events e on e.id = r.event order by r.at desc limit 20`).catch(() => ({rows: []}))).rows;
  return {rows: rows.map(({total, ...r}) => ({...r, id: +r.id})), total: +(rows[0]?.total || 0), page: off / lim + 1, limit: lim, eventReports: events, filters: Object.keys(REPORT_FILTERS)};
}
export async function resolveReport(admin, b) {
  const id = Number(b.id), outcome = b.outcome, reason = cleanReason(b.reason);
  if (!Number.isSafeInteger(id) || !['actioned', 'dismissed'].includes(outcome)) return {error: 'Choose a report and an outcome.'};
  if (reason.length < 5) return {error: 'Give a reason of at least 5 characters.'};
  const db = await pool.connect();
  try {
    await db.query('begin');
    const r = await db.query("update reports set status = $2, resolution = $3, handled_by = $4, handled_at = now() where id = $1 and status = 'open' returning id", [id, outcome, reason, admin.name]);
    if (!r.rowCount) { await db.query('rollback'); return {error: 'This report was already closed by another administrator.', httpStatus: '409 Conflict'}; }
    await audit(db, admin, 'reports.resolve', {target: `report:${id}`, reason, detail: {outcome}});
    await db.query('commit'); return {ok: true};
  } catch (e) { await db.query('rollback').catch(() => {}); throw e; } finally { db.release(); }
}

export async function auditLog({actor = '', action = '', target = '', ...p} = {}) {
  const {lim, off} = pageOf(p);
  const rows = (await pool.query(`select id, actor_name, role, action, target, reason, detail, outcome, at, count(*) over() as total from admin_audit
    where ($1 = '' or actor_name ilike $1) and ($2 = '' or action like $2 || '%') and ($3 = '' or target = $3)
    order by at desc, id desc limit ${lim} offset ${off}`, [String(actor).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16), String(action).replace(/[^a-z._]/g, '').slice(0, 40), String(target).slice(0, 120)])).rows;
  return {rows: rows.map(({total, ...r}) => ({...r, id: +r.id})), total: +(rows[0]?.total || 0), page: off / lim + 1, limit: lim};
}

export async function admins() {
  const rows = (await pool.query(`select u.acct, a.username, u.role, u.active, u.granted_at, u.version, g.username as granted_by,
      (select max(last_seen) from admin_sessions s where s.acct = u.acct) as last_seen
    from admin_users u join accounts a on a.id = u.acct left join accounts g on g.id = u.granted_by order by u.active desc, u.role, a.username`)).rows;
  return {rows, roles: Object.fromEntries(Object.entries(ROLES).map(([k, r]) => [k, {name: r.name, perms: r.perms}]))};
}
// Grant, change or remove a role. Uses the row version so two owners editing the same person cannot silently overwrite.
export async function setAdmin(admin, b, endSessions) {
  const username = String(b.username || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16), reason = cleanReason(b.reason);
  const active = b.active !== false, role = b.role, version = Number(b.version || 0);
  if (!username || (active && !isRole(role))) return {error: 'Choose an account and a role.'};
  if (reason.length < 5) return {error: 'Give a reason of at least 5 characters.'};
  const db = await pool.connect();
  try {
    await db.query('begin');
    await db.query("select pg_advisory_xact_lock(hashtext('admin_users'))"); // one role change at a time, so owners cannot remove each other at once
    const t = (await db.query('select id from accounts where lower(username) = lower($1)', [username])).rows[0];
    if (!t) { await db.query('rollback'); return {error: 'No account with that username.', httpStatus: '404 Not Found'}; }
    if (t.id === admin.acct) { await db.query('rollback'); return {error: 'Ask another owner to change your own access.'}; }
    const cur = (await db.query('select role, active, version from admin_users where acct = $1 for update', [t.id])).rows[0];
    if ((cur?.version || 0) !== version) { await db.query('rollback'); return {error: 'Another owner changed this access. Reload and try again.', httpStatus: '409 Conflict'}; }
    if (cur?.active && cur.role === 'owner' && (!active || role !== 'owner')) {
      const owners = +(await db.query("select count(*) n from admin_users where active and role = 'owner'")).rows[0].n;
      if (owners <= 1) { await db.query('rollback'); return {error: 'There must always be at least one owner.'}; }
    }
    if (cur) await db.query('update admin_users set role = $2, active = $3, granted_by = $4, granted_at = now(), version = version + 1 where acct = $1', [t.id, active ? role : cur.role, active, admin.acct]);
    else if (active) await db.query('insert into admin_users(acct, role, granted_by) values($1, $2, $3)', [t.id, role, admin.acct]);
    else { await db.query('rollback'); return {error: 'That account has no administrator access.'}; }
    await audit(db, admin, active ? 'admins.grant' : 'admins.revoke', {target: `acct:${t.id}`, reason, detail: {username, role: active ? role : cur.role, previous: cur?.role || null}});
    await db.query('commit');
    if (!active || cur?.role !== role) await endSessions(t.id);
    return {ok: true};
  } catch (e) { await db.query('rollback').catch(() => {}); throw e; } finally { db.release(); }
}
