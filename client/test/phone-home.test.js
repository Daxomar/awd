import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {homeLayout,folderBadge,FOLDERS} from '../src/v2/phone/home-layout.js';
import {shouldPromptSuggestion,PROMPT_COOLDOWN_MS,PROMPT_MIN_ACCOUNT_AGE_MS} from '../src/v2/ui/suggestion-policy.js';
import {VIBES,vibeLines,pickVibe} from '../src/v2/ui/vibes.js';
import {QUICK_PHRASES} from '../src/v2/ui/chat.js';
import {LOCATIONS} from '../../server/src/game/data.js';

// The app ids registered in phone/apps.js (dock apps are excluded from the springboard).
const IDS = ['messages','momo','gist','jobs','today','explore','meet','events','milestones','enterprise','market','relationships','finance','progression','goals','games','boutique','houses','properties','cars','carmarket','shop','invest','bank','forbes','contacts','life','health','police','civic','map','ads','suggest','help','settings'];
const DOCK = ['messages','momo','gist','jobs'];
const apps = IDS.map((id) => ({id, dock: DOCK.includes(id), hidden: id === 'progression'}));

test('springboard fits on one page and every visible app stays reachable exactly once', () => {
  const tiles = homeLayout(apps);
  assert.ok(tiles.length <= 12, `first page holds ${tiles.length} tiles`);
  const reachable = tiles.flatMap((t) => (t.kind === 'app' ? [t.app.id] : t.apps.map((a) => a.id)));
  const expected = apps.filter((a) => !a.dock && !a.hidden).map((a) => a.id);
  assert.deepEqual([...reachable].sort(), [...expected].sort());
  assert.equal(new Set(reachable).size, reachable.length);
  assert.deepEqual(tiles.slice(0, 6).map((t) => t.app?.id), ['today','explore','meet','events','games','map']);
  assert.ok(!reachable.includes('progression'), 'hidden apps stay hidden');
});

test('folders never list an app twice, collapse when only one app exists and sum badges', () => {
  const all = FOLDERS.flatMap((f) => f.apps); assert.equal(new Set(all).size, all.length);
  const tiles = homeLayout([{id: 'bank'}, {id: 'today'}]);
  assert.deepEqual(tiles.map((t) => t.kind), ['app', 'app'], 'a lone folder member is shown as an app');
  const money = homeLayout([{id: 'bank'}, {id: 'invest'}]).find((t) => t.kind === 'folder');
  assert.equal(folderBadge(money, (a) => (a.id === 'bank' ? 2 : 1)), 3);
  assert.ok(homeLayout([{id: 'brand-new-app'}]).some((t) => t.app?.id === 'brand-new-app'), 'unknown apps still appear');
});

test('feedback prompt never interrupts a new player and is at most occasional', () => {
  const now = Date.UTC(2026, 9, 29);
  assert.equal(shouldPromptSuggestion({now, accountCreated: now - 60000}), false, 'not in the first session');
  assert.equal(shouldPromptSuggestion({now, accountCreated: 0}), false, 'unknown account age: do not ask');
  assert.equal(shouldPromptSuggestion({now, accountCreated: now - PROMPT_MIN_ACCOUNT_AGE_MS}), true);
  assert.equal(shouldPromptSuggestion({now, accountCreated: now - 9e9, lastSeen: now - 5 * 60000}), false, 'no 5-minute repeats');
  assert.equal(shouldPromptSuggestion({now, accountCreated: now - 9e9, lastSeen: now - PROMPT_COOLDOWN_MS}), true);
  assert.equal(shouldPromptSuggestion({now, accountCreated: now - 9e9, submittedAt: now - 1}), false, 'never after a suggestion was sent');
});

test('every venue and neighbourhood has ambient vibes; lines are short and cycle safely', () => {
  for (const [id, l] of Object.entries(LOCATIONS)) assert.ok(vibeLines(id).length >= 3, `${id} (${l.name}) has vibes`);
  assert.ok(vibeLines('home').length && vibeLines('visit:12').length);
  assert.deepEqual(vibeLines('nowhere'), []);
  for (const lines of Object.values(VIBES)) for (const line of lines) assert.ok(line.length <= 80, line);
  assert.equal(pickVibe(['a', 'b'], -1), 'b'); assert.equal(pickVibe([], 3), null);
  assert.ok(QUICK_PHRASES.length >= 4 && QUICK_PHRASES.every((p) => p.length <= 40));
});

test('every venue and action icon is a real Phosphor fill icon', () => {
  const css = readFileSync(new URL('../node_modules/@phosphor-icons/web/src/fill/style.css', import.meta.url), 'utf8');
  const exists = (ic) => css.includes(`.ph-fill.ph-${ic.replace(/^icon:/, '')}:before`);
  for (const [id, l] of Object.entries(LOCATIONS)) {
    assert.notEqual(l.ic, 'icon:circle', `${id} still uses the placeholder icon`); assert.ok(exists(l.ic), `${id} icon ${l.ic}`);
    for (const a of l.acts) { assert.ok(a.ic && a.ic !== 'icon:circle', `${id}/${a.id} placeholder`); if (a.ic.startsWith('icon:')) assert.ok(exists(a.ic), `${id}/${a.id} icon ${a.ic}`); }
  }
});
