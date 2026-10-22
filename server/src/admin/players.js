// Stage 11: player management. Overviews never include password hashes, session tokens, payment credentials
// or private-message text; message activity is shown only as counts.
import {pool} from '../db.js';
import {audit} from './store.js';
import {can, isRole, ROLES} from './roles.js';
import * as Game from '../game/rules.js';
import {CAREERS, HOMES} from '../game/data.js';
import {saveJournal} from '../life-journal.js';
import * as Life from '../game/life-progression.js';

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
      p.state->>'cash' as cash, p.state->>'momo' as momo, p.state->'job'->>'id' as job, p.state->'job'->>'rank' as job_rank,
      p.state->>'home' as home, p.state->>'title' as title, p.state->>'xp' as xp, p.state->>'rep' as rep,
      p.state->>'origin' as origin, p.state->>'place' as place, p.state as state
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
  const careers = Object.entries(CAREERS).map(([k, c]) => ({ id: k, name: c.name, ranks: c.ranks.map(r => r[0]) }));
  const homes = Object.entries(HOMES).map(([k, h]) => ({ id: k, name: h.name, area: h.area }));
  const out = {account: a, online: online(id), moderation: mods.rows, reports: reportsAgainst.rows, reportsFiled: reportsBy.rows[0].n,
    activity: activity.rows, holdings: holdings.rows[0], messages: messages.rows[0], staff: staff.rows[0] || null, careers, homes};
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

const SUGGESTION_FILTERS = {
  open: "s.status = 'open'",
  planned: "s.status = 'planned'",
  reviewed: "s.status = 'reviewed'",
  dismissed: "s.status = 'dismissed'",
  all: 'true'
};

export async function suggestions({ status = 'open', ...p } = {}) {
  const where = Object.hasOwn(SUGGESTION_FILTERS, status) ? SUGGESTION_FILTERS[status] : SUGGESTION_FILTERS.open, { lim, off } = pageOf(p);
  const rows = (await pool.query(`select s.id, s.acct, a.username as player_name, s.category, s.text, s.status, s.admin_note, s.handled_by, s.handled_at, s.at,
      count(*) over() as total
    from player_suggestions s left join accounts a on a.id = s.acct
    where ${where} order by s.at desc limit ${lim} offset ${off}`)).rows;
  return { rows: rows.map(({ total, ...r }) => ({ ...r, id: +r.id })), total: +(rows[0]?.total || 0), page: off / lim + 1, limit: lim, filters: Object.keys(SUGGESTION_FILTERS) };
}

export async function resolveSuggestion(admin, b) {
  const id = Number(b.id), outcome = b.outcome, note = cleanReason(b.note || b.reason || '');
  if (!Number.isSafeInteger(id) || !['planned', 'reviewed', 'dismissed', 'open'].includes(outcome)) return { error: 'Choose a suggestion and an outcome.' };
  const db = await pool.connect();
  try {
    await db.query('begin');
    const r = await db.query("update player_suggestions set status = $2, admin_note = $3, handled_by = $4, handled_at = now() where id = $1 returning id", [id, outcome, note || null, admin.name]);
    if (!r.rowCount) { await db.query('rollback'); return { error: 'Suggestion not found.', httpStatus: '404 Not Found' }; }
    await audit(db, admin, 'suggestions.resolve', { target: `suggestion:${id}`, reason: note || null, detail: { outcome } });
    await db.query('commit'); return { ok: true };
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

export async function updatePlayer(admin, b, { shard, bus } = {}) {
  const id = Number(b.acct || b.id), reason = cleanReason(b.reason);
  if (!Number.isSafeInteger(id) || id < 1) return { error: 'Choose a player.' };
  if (reason.length < 5) return { error: 'Give a reason of at least 5 characters.' };

  const updates = {};
  if (b.cash !== undefined && b.cash !== '') {
    const val = Number(b.cash);
    if (!Number.isFinite(val) || val < 0 || !Number.isSafeInteger(Math.round(val))) return { error: 'Cash balance must be a non-negative number.' };
    updates.cash = Math.round(val);
  }
  if (b.momo !== undefined && b.momo !== '') {
    const val = Number(b.momo);
    if (!Number.isFinite(val) || val < 0 || !Number.isSafeInteger(Math.round(val))) return { error: 'MoMo balance must be a non-negative number.' };
    updates.momo = Math.round(val);
  }
  if (b.xp !== undefined && b.xp !== '') {
    const val = Number(b.xp);
    if (!Number.isFinite(val) || val < 0 || !Number.isSafeInteger(Math.round(val))) return { error: 'XP must be a non-negative number.' };
    updates.xp = Math.round(val);
  }
  if (b.rep !== undefined && b.rep !== '') {
    const val = Number(b.rep);
    if (!Number.isFinite(val) || !Number.isSafeInteger(Math.round(val))) return { error: 'Reputation must be an integer.' };
    updates.rep = Math.round(val);
  }
  if (b.jobId !== undefined) {
    const jobId = String(b.jobId || '').trim().toLowerCase();
    if (!jobId || jobId === 'none') {
      updates.job = null;
    } else {
      if (!Object.hasOwn(CAREERS, jobId)) return { error: `Invalid career '${jobId}'.` };
      const career = CAREERS[jobId];
      const rank = b.jobRank !== undefined ? Math.max(0, Math.min(career.ranks.length - 1, Number(b.jobRank) | 0)) : 0;
      updates.job = { id: jobId, rank, shifts: 0, perf: 0 };
    }
  } else if (b.jobRank !== undefined && b.jobRank !== '') {
    const rank = Number(b.jobRank);
    if (Number.isInteger(rank) && rank >= 0) updates.jobRank = rank;
  }
  if (b.home !== undefined && b.home !== '') {
    updates.home = String(b.home).trim().toLowerCase().slice(0, 40);
  }
  if (b.title !== undefined) {
    updates.title = String(b.title || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, 40);
  }
  if (b.origin !== undefined && b.origin !== '') {
    updates.origin = String(b.origin).trim().slice(0, 40);
  }
  if (b.adult_verified !== undefined) {
    updates.adult_verified = b.adult_verified === true || b.adult_verified === 'true' || b.adult_verified === 'yes' || b.adult_verified === 1;
  }
  if (b.skills && typeof b.skills === 'object' && !Array.isArray(b.skills)) {
    updates.skills = {};
    for (const [k, v] of Object.entries(b.skills)) {
      const lvl = Number(v);
      if (/^[a-z_]{1,20}$/.test(k) && Number.isFinite(lvl) && lvl >= 0 && lvl <= 10) {
        updates.skills[k] = Math.round(lvl * 10) / 10;
      }
    }
  }
  if (b.statePatch && typeof b.statePatch === 'object' && !Array.isArray(b.statePatch)) {
    const safePatch = {};
    const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype', 'v', 'name']);
    for (const [k, v] of Object.entries(b.statePatch)) {
      if (!FORBIDDEN.has(k) && /^[a-zA-Z0-9_]{1,30}$/.test(k)) {
        safePatch[k] = v;
      }
    }
    if (Object.keys(safePatch).length) updates.statePatch = safePatch;
  }

  if (Object.keys(updates).length === 0) return { error: 'No valid fields provided to update.' };

  const livePlayer = shard?.byAcct ? shard.byAcct(id) : null;
  if (livePlayer?.saving) await livePlayer.saving.catch(() => {});

  const db = await pool.connect();
  try {
    await db.query('begin');
    const t = (await db.query('select id, username, banned, adult_verified from accounts where id = $1 for update', [id])).rows[0];
    if (!t) { await db.query('rollback'); return { error: 'Player not found.', httpStatus: '404 Not Found' }; }

    const pRow = (await db.query('select id, state, worth from players where id = $1 for update', [id])).rows[0];
    const baseState = livePlayer ? livePlayer.state : (pRow ? pRow.state : Game.newState({ id: t.id, u: t.username }));
    const nextState = structuredClone(baseState);
    const diff = {};

    if (updates.adult_verified !== undefined && updates.adult_verified !== t.adult_verified) {
      diff.adult_verified = { from: t.adult_verified, to: updates.adult_verified };
      await db.query('update accounts set adult_verified = $2 where id = $1', [id, updates.adult_verified]);
    }

    for (const [k, v] of Object.entries(updates)) {
      if (k === 'adult_verified') continue;
      if (k === 'jobRank') {
        if (nextState.job) {
          const maxRank = (CAREERS[nextState.job.id]?.ranks.length || 1) - 1;
          const targetRank = Math.max(0, Math.min(maxRank, v));
          if (nextState.job.rank !== targetRank) {
            diff.jobRank = { from: nextState.job.rank, to: targetRank };
            nextState.job.rank = targetRank;
          }
        }
        continue;
      }
      if (k === 'skills') {
        nextState.skills = nextState.skills || {};
        diff.skills = {};
        for (const [sk, sv] of Object.entries(v)) {
          if (nextState.skills[sk] !== sv) {
            diff.skills[sk] = { from: nextState.skills[sk] || 0, to: sv };
            nextState.skills[sk] = sv;
          }
        }
        continue;
      }
      if (k === 'statePatch') {
        diff.statePatch = v;
        Object.assign(nextState, v);
        continue;
      }
      if (JSON.stringify(nextState[k]) !== JSON.stringify(v)) {
        diff[k] = { from: nextState[k], to: v };
        nextState[k] = v;
      }
    }

    const oldMoney = (baseState.cash || 0) + (baseState.momo || 0);
    const newMoney = (nextState.cash || 0) + (nextState.momo || 0);
    if (oldMoney !== newMoney) {
      const delta = newMoney - oldMoney;
      nextState.ledger = nextState.ledger || [];
      nextState.ledger.push([Date.now(), delta, 'Admin adjustment: ' + reason]);
      if (nextState.ledger.length > 60) nextState.ledger.shift();
      Life.moneyEvent(nextState, delta, 'Admin adjustment: ' + reason);
      await saveJournal(db, id, nextState, baseState);
    }

    const worth = Game.netWorth(nextState);
    await db.query(`insert into players (id, state, worth, updated_at) values ($1, $2, $3, now())
      on conflict (id) do update set state = excluded.state, worth = excluded.worth, updated_at = now()`,
      [id, JSON.stringify(nextState), worth]);

    await audit(db, admin, 'players.edit', {
      target: `acct:${id}`,
      reason,
      detail: { username: t.username, diff }
    });

    await db.query('commit');

    if (livePlayer) {
      Object.assign(livePlayer.state, nextState);
      livePlayer.dirty = true;
      if (shard?.send) {
        shard.send(livePlayer, { t: 'st', state: Game.view(livePlayer.state) });
        shard.send(livePlayer, { ...Game.me(livePlayer.state, Date.now(), shard.policy), place: livePlayer.state.place });
        shard.send(livePlayer, { t: 'toast', m: 'Your account data was updated by an administrator.', k: 'info' });
      }
    }
    if (bus?.publish) {
      bus.publish('awd:sync_player', { acct: id, state: nextState });
    }

    return { ok: true, id, diff, worth };
  } catch (e) {
    await db.query('rollback').catch(() => {});
    throw e;
  } finally {
    db.release();
  }
}
