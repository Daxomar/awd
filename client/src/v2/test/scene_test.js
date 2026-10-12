// Dev harness: renders one venue (?v=muni) or home (?h=nima&items=tv,gas) with a seated player + a walker + the
// venue NPCs. Extra params: t=<hour>, tags=1 (zone/NPC labels), zoom=<world units>, poses=1 (pose line-up).
import '@fontsource-variable/outfit';
import * as THREE from 'three';
import { Stage } from '../scene/stage.js';
import { Room } from '../scene/room.js';
import { VENUES, placeNpc, zoneUse } from '../scene/venues.js';
import { homeSpec } from '../scene/homes.js';
import { fitRoom } from '../scene/frame.js';
import { loadAvatars, Avatar } from '../scene/avatars.js';

const T = (window.__T = { ready: false, errors: [] });
addEventListener('error', (e) => T.errors.push(String(e.message || e)));
addEventListener('unhandledrejection', (e) => T.errors.push(String(e.reason && e.reason.stack || e.reason)));
const q = new URLSearchParams(location.search);
const info = document.getElementById('info');

function poseSpec() {
  return { w: 7, d: 6, floor: 'wood', wallColor: '#cfe3d4', windows: [{ wall: 'left', at: 0.5 }],
    items: [{ kind: 'plastic_chair', x: -2, z: 0, rot: 0 }, { kind: 'plastic_chair', x: -0.8, z: 0, rot: 0, color: '#2f6fd1' }, { kind: 'bed', x: 2, z: -1.5, rot: 0 },
      { kind: 'mattress', x: -2, z: -1.9, rot: Math.PI / 2 }, { kind: 'kitchen_counter', x: 0.6, z: -2.6, rot: 0 }, { kind: 'rug', x: 0.5, z: 1.6, rot: 0 }, { kind: 'wooden_bench', x: 2.4, z: 1.6, rot: 0 }],
    zones: [{ id: 'a', label: 'Chair', icon: 'ph-chair', item: 0, acts: [] }], spawn: { x: 1, z: 2 } };
}

async function main() {
  await document.fonts.ready; try { await document.fonts.load('800 40px "Outfit Variable"'); } catch (e) { /* ignore */ }
  const stage = new Stage(document.getElementById('c'));
  const owned = Object.fromEntries((q.get('items') || '').split(',').filter(Boolean).map((k) => [k, 1]));
  let spec, name;
  if (q.get('poses')) { spec = poseSpec(); name = 'poses'; }
  else if (q.get('h')) { name = 'home:' + q.get('h'); spec = homeSpec(q.get('h'), owned); }
  else { name = q.get('v') || 'muni'; spec = VENUES[name]; if (!spec) throw new Error('no venue ' + name); }
  const room = new Room(stage).build(spec);
  fitRoom(stage, spec, q.get('zoom') ? +q.get('zoom') : null);
  if (q.get('tx')) { stage.view.target.set(+q.get('tx'), +(q.get('ty') || 0.6), +(q.get('tz') || 0)); stage.applyView(); }
  stage.setTime(q.get('t') ? +q.get('t') : 11);
  await loadAvatars();
  const sit = (id, look, zi = 0, ui = 0) => {
    const z = spec.zones[zi]; const u = ui ? room.usePoint(room.items[z.item], ui) : zoneUse(room, z);
    room.addPerson(id, new Avatar(look), u.x, u.z); room.placeAt(id, u.x, u.z, u.yaw, z.pose || u.pose, u.y);
  };
  if (q.get('poses')) {
    const L = [{ body: 'm', skinTone: 5, top: '#e0a32b', bottom: '#2a3b5c' }, { body: 'f', skinTone: 5, top: '#c8102e', bottom: '#1d2433' }];
    const put = (id, look, item, pose, ui = 0) => { const rec = room.items[item]; const u = room.usePoint(rec, ui); room.addPerson(id, new Avatar(look), u.x, u.z); room.placeAt(id, u.x, u.z, u.yaw, pose || u.pose, u.y); };
    put('m1', L[0], 0); put('f1', L[1], 1); put('m2', L[0], 2, null, 0); put('f2', L[1], 2, null, 1); put('f3', L[1], 3); put('m3', L[0], 4, 'work');
    room.addPerson('m4', new Avatar(L[0]), 0.5, 1.6); room.placeAt('m4', 0.5, 1.6, 0.6, 'sit_floor', 0); put('f4', L[1], 6, null, 0);
  } else {
    // player on the first zone's item, a friend on the last zone, a walker crossing the room, plus NPCs
    sit('me', { body: q.get('body') || 'm', skinTone: 5, top: '#f0b323', bottom: '#2b3a55' }, 0);
    if (spec.zones.length > 1) { const zi = spec.zones.length - 1; const rec = room.items[spec.zones[zi].item]; const u = room.usePoint(rec, rec.use.length > 1 ? 1 : 0); if (spec.zones[zi].pose) u.pose = spec.zones[zi].pose;
      room.addPerson('pal', new Avatar({ body: 'f', skinTone: 4, top: '#2a9d8f', bottom: '#3a2e5c' }), u.x, u.z); room.placeAt('pal', u.x, u.z, u.yaw, spec.zones[zi].pose || u.pose, u.y); }
    const sp = spec.spawn || { x: 0, z: 0 };
    room.addPerson('walker', new Avatar({ body: 'f', skinTone: 6, top: '#e76f51', bottom: '#264653' }), sp.x, sp.z);
    const tgt = room.usePoint(room.items[spec.zones[Math.min(1, spec.zones.length - 1)].item]); room.walkTo('walker', tgt.x, tgt.z);
    (spec.npcs || []).forEach((n, i) => { const id = 'npc' + i; const P = placeNpc(room, n); room.addPerson(id, new Avatar(n.look), P.x, P.z, { label: n.label }); room.placeAt(id, P.x, P.z, P.yaw, P.pose, P.y); });
  }
  const tags = [];
  if (q.get('tags')) {
    for (const z of spec.zones || []) { const rec = room.items[z.item]; const el = document.createElement('div'); el.className = 'tag'; el.textContent = z.label + ' · ' + z.acts.join(','); document.body.appendChild(el); tags.push([el, () => [rec.obj.position.x, 1.6, rec.obj.position.z]]); }
    for (const [id, p] of room.people) if (p.info.label) { const el = document.createElement('div'); el.className = 'tag'; el.style.background = 'rgba(160,40,40,.8)'; el.textContent = p.info.label; document.body.appendChild(el); tags.push([el, () => [p.x, 2.0, p.z]]); }
  }
  info.textContent = name + ' · ' + (spec.zones || []).map((z) => z.label).join(' / ');
  const clock = new THREE.Clock(); let frames = 0;
  const loop = () => {
    const dt = Math.min(0.05, clock.getDelta()); room.update(q.get('freeze') ? 0.016 : dt); stage.render();
    for (const [el, f] of tags) { const [x, y, z] = f(); const [sx, sy] = room.screen(x, y, z); el.style.left = sx + 'px'; el.style.top = sy + 'px'; }
    if (++frames === 12) { T.ready = true; T.items = room.items.length; let meshes = 0; room.group.traverse((o) => { if (o.isMesh) meshes++; }); T.meshes = meshes; T.calls = stage.renderer.info.render.calls; }
    requestAnimationFrame(loop);
  };
  loop();
  window.__room = room; window.__stage = stage;
}
main().catch((e) => { T.errors.push(String(e && e.stack || e)); info.textContent = 'ERR ' + e; T.ready = true; });
