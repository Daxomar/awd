// Springboard layout: daily apps stay on the first page, everything else lives in folders,
// so 30+ apps fit on one screen without hiding any. Apps keep their ids, so deep links
// (phone.show('bank'), notifications, HUD shortcuts) open them directly as before.
export const FOLDERS = [
  { id: 'money', name: 'Money', apps: ['bank', 'invest', 'market', 'enterprise', 'finance', 'forbes'] },
  { id: 'homewheels', name: 'Home & Car', apps: ['houses', 'properties', 'cars', 'carmarket'] },
  { id: 'shopping', name: 'Shopping', apps: ['shop', 'boutique'] },
  { id: 'me', name: 'Me & People', apps: ['life', 'goals', 'milestones', 'relationships', 'contacts', 'health'] },
  { id: 'city', name: 'City', apps: ['civic', 'police', 'ads'] },
  { id: 'more', name: 'More', apps: ['settings', 'help', 'suggest'] },
];
// First-page order; unknown future apps fall in after these, before the folders.
const FIRST = ['today', 'explore', 'meet', 'events', 'games', 'map'];
const FOLDER_OF = Object.fromEntries(FOLDERS.flatMap((f) => f.apps.map((id) => [id, f.id])));

/**
 * @param {{id:string, dock?:boolean, hidden?:boolean}[]} apps
 * @returns {({kind:'app', app:object}|{kind:'folder', id:string, name:string, apps:object[]})[]}
 */
export function homeLayout(apps) {
  const visible = apps.filter((a) => !a.dock && !a.hidden), byId = new Map(visible.map((a) => [a.id, a]));
  const loose = visible.filter((a) => !FOLDER_OF[a.id]);
  const rank = (a) => { const i = FIRST.indexOf(a.id); return i < 0 ? FIRST.length : i; };
  const tiles = [...loose].sort((a, b) => rank(a) - rank(b)).map((app) => ({ kind: 'app', app }));
  for (const f of FOLDERS) {
    const inside = f.apps.map((id) => byId.get(id)).filter(Boolean);
    if (inside.length > 1) tiles.push({ kind: 'folder', id: f.id, name: f.name, apps: inside });
    else if (inside.length === 1) tiles.push({ kind: 'app', app: inside[0] });
  }
  return tiles;
}
export const folderBadge = (folder, badgeOf) => folder.apps.reduce((n, a) => n + (badgeOf(a) || 0), 0);
