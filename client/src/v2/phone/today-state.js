// Pure view helpers for the "Today" board. The server computes progress, rewards and streaks;
// these functions only shape that board for display and never invent progress.
export const CATEGORY = { hustle: { id: 'hustle', name: 'Hustle', icon: 'briefcase' }, street: { id: 'street', name: 'Street', icon: 'map-trifold' }, linkup: { id: 'linkup', name: 'Link-up', icon: 'users-three' } };
export function todaySummary(board) {
  const list = Array.isArray(board?.list) ? board.list : [];
  const done = list.filter((m) => m.done).length, claimable = list.filter((m) => m.done && !m.claimed).length;
  return { done, total: list.length, claimable, streak: Math.max(0, board?.streak | 0), atRisk: !!board?.atRisk, finished: !!board?.doneToday };
}
// Chip label for the HUD: "Today 2/3 · 4🔥" style, without emoji so the icon font carries the flame.
export function chipText(board) {
  const s = todaySummary(board); if (!s.total) return '';
  return s.finished ? `Today done · ${s.streak}-day streak` : s.claimable ? `Today ${s.done}/${s.total} · claim` : `Today ${s.done}/${s.total}`;
}
// Seven ladder steps; `step` is the index the next (or today's) completion pays.
export function ladderView(board) {
  const ladder = Array.isArray(board?.ladder) ? board.ladder : [], step = Math.max(0, board?.step | 0), finished = !!board?.doneToday;
  return ladder.map((r, i) => ({ ...r, day: i + 1, state: i < step || (finished && i === step) ? 'done' : i === step ? 'next' : 'later' }));
}
export function missionView(m) {
  const need = Math.max(1, m?.need | 0), n = Math.min(need, Math.max(0, m?.n | 0));
  return { ...m, n, need, pct: Math.round((n / need) * 100), action: m?.claimed ? 'claimed' : n >= need ? 'claim' : 'progress', cat: CATEGORY[m?.cat] || CATEGORY.hustle };
}
