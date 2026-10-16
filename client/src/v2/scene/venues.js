import { dressVenue } from './environment-profiles.js';
// Venue layouts for every LOCATIONS id (server/src/game/data.js). Each entry is a Room spec (see room.js) plus:
//   zones: [{ id, label, icon, item, acts:[actId], pose?, anim?, use? }]  item = index into items; use = preferred
//          use-point index on that item (default 0); pose overrides the use-point pose; anim = clip to play there
//          (e.g. 'dance'). Every act id of the location appears in exactly one zone.
//   spawn: { x, z }   where people appear (just inside the door / at the edge of an outdoor lot)
//   npcs:  [{ label, x, z, rot, pose, look:{body,skinTone,top,bottom}, y?, seat?:[itemIndex, useIndex] }]
//          when `seat` is set, place the NPC with placeNpc(room, npc) which reads the item's use point.
// Coordinates: x ∈ [-w/2, w/2], z ∈ [-d/2, d/2]; back wall at z = -d/2, left wall at x = -w/2. rot 0 = item faces +z
// (stands against the back wall), rot π/2 = faces +x (against the left wall). The camera looks from +x,+z, so tall
// things live along the back/left; the front stays low.
const PI = Math.PI, HP = PI / 2;
const I = (kind, x, z, rot = 0, o = {}) => ({ kind, x, z, rot, ...o });
const Z = (id, label, icon, key, acts, o = {}) => ({ id, label, icon, key, acts, ...o });
const L = (body, top, bottom, skinTone = 5) => ({ body, skinTone, top, bottom });
const N = (label, x, z, rot, look, pose = 'stand', o = {}) => ({ label, x, z, rot, look, pose, ...o });
const S = (label, seat, look, o = {}) => ({ label, x: 0, z: 0, rot: 0, look, pose: null, seat, ...o });
const warm = (pts, c = '#ffd59a', i = 6) => pts.map(([x, z, ii]) => ({ x, z, color: c, intensity: ii || i, dist: 8 }));

const darken = (hex, f) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');
// two-tone painted lower walls (split around the door), appended after the authored items so indices don't move
export function addDado(spec) {
  if (spec.outdoor || spec.dado === false) return spec;
  const col = spec.dado || darken(spec.wallColor || '#e8e1d3', 0.78); const H = 0.9;
  for (const side of ['back', 'left']) {
    const len = side === 'back' ? spec.w : spec.d; const holes = [];
    if (spec.door && spec.door.wall === side) { const c = side === 'back' ? -spec.w / 2 + spec.door.at * spec.w : spec.d / 2 - spec.door.at * spec.d; holes.push([c - 0.5, c + 0.5]); }
    let a = -len / 2; const segs = []; for (const [h0, h1] of holes.sort((p, q) => p[0] - q[0])) { if (h0 > a + 0.05) segs.push([a, h0]); a = h1; } if (len / 2 > a + 0.05) segs.push([a, len / 2]);
    for (const [s0, s1] of segs) { const L2 = +(s1 - s0).toFixed(3), c = (s0 + s1) / 2; spec.items.push(side === 'back' ? I(`dado:${L2},${H}`, c, -spec.d / 2, 0, { color: col }) : I(`dado:${L2},${H}`, -spec.w / 2, c, HP, { color: col })); }
  }
  return spec;
}
// resolve item keys (zones / npc seats) to indices
function V(spec) {
  addDado(spec);
  const idx = new Map(); spec.items.forEach((it, i) => { if (it.key) idx.set(it.key, i); });
  const find = (k) => { if (typeof k === 'number') return k; if (!idx.has(k)) throw new Error('venue item key ' + k); return idx.get(k); };
  spec.zones = spec.zones.map(({ key, ...z }) => ({ ...z, item: find(key) }));
  spec.npcs = (spec.npcs || []).map((n) => (n.seat ? { ...n, seat: [find(n.seat[0]), n.seat[1] || 0] } : n));
  return spec;
}
// helper for the game/test harness: world placement of an NPC (handles `seat`)
export function placeNpc(room, npc) {
  if (npc.seat) { const rec = room.items[npc.seat[0]]; const u = room.usePoint(rec, npc.seat[1]); return { x: u.x, z: u.z, yaw: u.yaw, pose: npc.pose || u.pose, y: u.y }; }
  return { x: npc.x, z: npc.z, yaw: npc.rot || 0, pose: npc.pose || 'stand', y: npc.y || 0 };
}
// helper: world use point for a zone (honours zone.use / zone.pose)
export function zoneUse(room, zone) { const rec = room.items[zone.item]; const u = room.usePoint(rec, zone.use || 0); if (zone.pose) u.pose = zone.pose; return u; }

// outfits
const wax = ['#c8102e', '#1f6fb8', '#f2b632', '#2a9d8f', '#7b2d8e', '#e76f51'];
const LOOK = {
  auntie: (t = '#e76f51', b = '#7b2d8e') => L('f', t, b, 5), uncle: (t = '#f2c230', b = '#3a2e22') => L('m', t, b, 5),
  boy: (t = '#2a9d8f', b = '#22313f') => L('m', t, b, 6), girl: (t = '#e86a92', b = '#2b2d42') => L('f', t, b, 4),
  nurse: () => L('f', '#ffffff', '#ffffff', 5), doctor: () => L('m', '#f4f4f4', '#2b3a55', 4), police: () => L('m', '#2b4a7a', '#1d2433', 5), policeF: () => L('f', '#2b4a7a', '#1d2433', 5),
  black: (b = 'm') => L(b, '#151515', '#151515', 5), redblack: (b = 'f') => L(b, '#b3202a', '#151515', 5), tourist: () => L('f', '#f4a261', '#e9e2d0', 2),
};

export const VENUES = {
  // ------------------------------------------------------------------ Kwame Nkrumah Circle (outdoor station)
  circle: V({ w: 13, d: 10.5, outdoor: true, floor: 'pavers',
    items: [I('road:11,3', 0, -3.0), I('kerb:4', -3.5, -1.42), I('kerb:4', 3.5, -1.42),
      I('trotro', -2.4, -3.1, 0, { key: 'tro', color: '#f2f0e6' }), I('trotro', 2.9, -3.1, 0, { color: '#e9eef2', label: 'NO TIME TO WASTE' }),
      I('speaker', -5.05, -0.5, HP), I('mic_stand', -3.85, 0.5, -HP), I('wooden_bench', -2.6, 0.6, -HP, { key: 'bench', color: '#c8102e' }),
      I('pure_water', 0.2, 0.6, 0, { key: 'water' }), I('umbrella', -0.55, 0.15, 0, { color: '#1d4ed8' }), I('ice_cart', 2.1, 1.0, 0, { key: 'ice' }),
      I('food_stall', 4.3, 0.4, -HP, { key: 'stall', label: 'KHEBAB', umbrella: '#f2c230' }), I('toilet_booth', -4.6, 3.5, HP, { key: 'wc' }),
      I('palm_tree', -5.0, -1.0, 0, { }), I('lamp_post', 5.1, -1.0, PI), I('sign_post', 2.0, -1.2, 0, { label: 'CIRCLE' }), I('traffic_cone', 5.2, -2.0), I('traffic_cone', 0.25, -2.3),
      I('bin', 3.6, -0.9), I('crate_stack', 6.0, 4.5, 0.3, { arg: 2 }), I('jerrycans', -3.0, 4.6, 0.2),
      // Tiptoe Lane phone market: tables of UK-used phones, the fitter's bench, accessory hawkers, MoMo
      I('phone_stall', -0.6, 3.2, 0, { key: 'ptab', color: '#1f6fb8' }), I('umbrella', -0.2, 2.2, 0, { color: '#f2c230' }), I('phone_stall', 1.5, 3.2, 0, { key: 'ptab2', color: '#c8102e', label: 'FITTER\nREPAIRS · UNLOCK' }), I('umbrella', 1.9, 2.2, 0, { color: '#c8102e' }),
      I('phone_stall', 3.6, 3.2, 0, { color: '#0e7a4e', label: 'iFONE\nSAMSANG · TEKNO' }), I('hawker_stand', 5.5, 2.4, -HP, { key: 'hawk', color: '#1d4ed8' }), I('momo_kiosk', 5.7, 0.4, -HP, { color: '#ffcc00' }),
      I('sign_post', -2.2, 3.6, 0, { label: 'TIPTOE LANE' })],
    zones: [Z('preacher', 'Market preacher', 'ph-megaphone', 'bench', ['preacher']), Z('water', 'Pure water hustle', 'ph-drop', 'water', ['sellwater']), Z('ice', 'Fan Ice & water', 'ph-ice-cream', 'ice', ['purewater']),
      Z('phones', 'Phone market', 'ph-device-mobile', 'ptab', ['phonemarket']), Z('fitter', 'Phone fitter', 'ph-wrench', 'ptab2', ['fitter', 'unlock']), Z('acc', 'Chargers hustle', 'ph-plug', 'hawk', ['accessories']),
      Z('tro', 'Trotro', 'ph-bus', 'tro', ['mate']), Z('crowd', 'Crowd', 'ph-users-three', 'stall', ['pickpocket']), Z('wc', 'Pay toilet', 'ph-toilet', 'wc', ['toilet'])],
    spawn: { x: 4.6, z: 0.6 },
    npcs: [N('Seller Ibrahim', -0.6, 2.4, 0, L('m', '#f4f4f4', '#2b3a55', 6)), N('Fitter Yaw', 1.5, 2.4, 0, L('m', '#2a9d8f', '#1d2433', 7), 'work'), N('Hawker Ama', 4.8, 1.6, -HP, LOOK.girl('#7b2d8e', '#2b2d42')), N('Preacher Kwaku', -4.35, 0.5, HP, L('m', '#f4f4f4', '#1d2433', 6), 'cheer'), N('Akos (pure water)', 0.95, 0.1, -0.4, LOOK.girl('#f2c230', '#1f6fb8')), N('Mate Kojo', -1.0, -1.75, 0.4, LOOK.boy('#c8102e', '#2b2d42'), 'cheer')],
    lights: warm([[-3, 0], [2, 1], [5, -1, 8]]) }),

  // ------------------------------------------------------------------ Auntie Muni's Waakye
  muni: V({ w: 8, d: 6.5, floor: 'concrete', floorColor: '#c9bfae', wallColor: '#f3e3b0', windows: [{ wall: 'left', at: 0.6, w: 1.2 }], door: { wall: 'left', at: 0.18 },
    sign: { text: "Auntie Muni's Waakye", bg: '#1d6f42', fg: '#fcd116' },
    items: [I('waakye_pot', -2.0, -2.0, 0, { key: 'pot' }), I('coal_pot', -3.45, -2.8), I('cooler', -0.8, -2.9), I('chest_freezer', 2.4, -2.85), I('crate_stack', 3.55, -2.95),
      I('wooden_bench', 0.35, -1.95, -HP, { key: 'bench', color: '#3f7fbf' }), I('chop_table', 1.6, 0.65, 0, { key: 'tA', cw: '#1f6fb8' }), I('chop_table', -1.6, 1.35, 0, { key: 'tB', chair: '#c8102e', cw: '#7b2d8e' }),
      I('standing_fan', 3.5, -1.2, -0.7),I('window_curtain', -4, -0.65, HP, { color: '#c8102e', arg: 1.2 }), I('poster', -4, -2.4, HP, { label: 'GOD IS\nGOOD', color: '#1d6f42' }),
      I('calendar', 3.6, -3.25, 0), I('plant', -3.6, 2.95), I('doormat', -3.55, 2.08, HP), I('jerrycans', -3.6, -1.6, HP), I('picture', -4, 1.0, HP, { arg: 0.5 })],
    zones: [Z('eat', 'Waakye', 'ph-bowl-food', 'tA', ['waakye', 'waakyeSmall']), Z('gist', 'Gist with Muni', 'ph-chats-circle', 'bench', ['gistMuni'])],
    spawn: { x: -3.3, z: 2.08 },
    npcs: [N('Auntie Muni', -2.0, -2.85, 0, LOOK.auntie('#f2b632', '#1f6fb8'), 'work'), S('Brother Yaw', ['tB', 0], LOOK.uncle('#2a9d8f', '#2b2d42')), N('Little Fati', -0.45, -2.05, 0.3, LOOK.girl('#e86a92', '#3a2e5c'))],
    lights: warm([[-1, -1], [1.5, 1.2]]) }),

  // ------------------------------------------------------------------ Makola Market (open-air)
  makola: V({ w: 10, d: 8, outdoor: true, floor: 'concrete', floorColor: '#bdb3a0',
    items: [I('low_wall:10', 0, -3.88, 0, { color: '#e9d9b6', trim: '#c8102e' }), I('low_wall:7.5', -4.88, 0.1, HP, { color: '#e9d9b6', trim: '#c8102e' }), I('board_sign', 0.6, -3.55, 0, { label: 'MAKOLA MARKET', color: '#c8102e', arg: 3 }),
      I('market_table', -2.6, -2.35, 0, { key: 'food' }), I('umbrella', -2.0, -3.05, 0, { color: '#e63946' }),
      I('market_table', 2.3, -2.35, 0, { key: 'queens', color: '#6d4c41', goods: ['#c9a46b', '#e9c46a', '#f1f1e6', '#2e8b57', '#a0522d', '#c9a46b'] }), I('umbrella', 2.9, -3.05, 0, { color: '#2a9d8f' }),
      I('market_table', -4.0, 0.9, HP, { goods: ['#9a5a2a', '#d62828', '#e9d8a6', '#7b2d8e', '#9a5a2a', '#2e8b57'] }), I('umbrella', -4.55, 1.8, 0, { color: '#f2c230' }),
      I('sacks', 1.9, 1.0, 0.1, { key: 'sacks' }), I('toilet_booth', 4.2, -2.4, -HP, { key: 'wc' }), I('kenkey_basket', -0.2, -2.3), I('crate_stack', 4.4, 0.4, 0, { arg: 2 }),
      I('jerrycans', 0.4, 3.3, 0.4), I('pure_water', -1.4, 2.6, 0.3), I('palm_tree', 4.4, 3.4, 0, { arg: 3.2 })],
    zones: [Z('food', 'Foodstuff', 'ph-basket', 'food', ['foodstuff']), Z('queens', 'Market queens', 'ph-handshake', 'queens', ['haggle']), Z('loads', 'Loads & resale', 'ph-package', 'sacks', ['kayayo', 'resell']), Z('wc', 'Pay toilet', 'ph-toilet', 'wc', ['toilet'])],
    spawn: { x: 2.6, z: 3.2 },
    npcs: [N('Auntie Akos', -2.6, -3.25, 0, LOOK.auntie('#c8102e', '#f2b632'), 'work'), N('Maame Esi', 1.8, -3.25, 0, LOOK.auntie('#7b2d8e', '#2a9d8f'), 'work'), N('Fati (kayayo)', 0.6, 1.6, 0.5, LOOK.girl('#2a9d8f', '#e76f51'))],
    lights: warm([[-2, -1], [2, 0.5]]) }),

  // ------------------------------------------------------------------ Kantamanto thrift market
  kantamanto: V({ w: 9, d: 7, outdoor: true, floor: 'dirt',
    items: [I('awning:6.4', -1.0, -3.45, 0, { color: '#1f6fb8' }), I('clothes_rack', -2.4, -2.75, 0, { key: 'rack' }), I('clothes_rack', 0.4, -2.75), I('clothes_rack:1.4', -3.95, 0.2, HP),
      I('low_wall:7', -4.38, 0, HP, { color: '#d8c7a5', trim: '#1f6fb8' }), I('board_sign', 3.1, -3.25, 0, { label: 'KANTAMANTO', color: '#1f6fb8', arg: 2.2 }), I('mannequin', 2.3, -2.6, 0, { color: '#c8102e' }), I('mannequin', 1.7, -2.3, 0.3),
      I('bale', 1.7, 0.5, 0.25, { key: 'bale' }), I('bale', -1.4, 1.7, -0.4), I('umbrella', 3.4, 1.4, 0, { color: '#f2c230' }), I('plastic_chair', 3.3, 0.6, -2.2), I('mirror', -4.3, -1.6, HP),
      I('crate_stack', 3.8, -1.6, 0, { arg: 2 })],
    zones: [Z('rack', 'Thrift racks', 'ph-t-shirt', 'rack', ['thrift']), Z('bale', 'Fresh bale', 'ph-hand-grabbing', 'bale', ['bale'])],
    spawn: { x: 2.8, z: 2.8 },
    npcs: [N('Kwesi (bale boy)', 2.7, 1.2, -0.9, LOOK.boy('#f2c230', '#22313f'), 'cheer'), N('Adjoa', -1.1, -2.05, 0.5, LOOK.auntie('#2a9d8f', '#e76f51'))],
    lights: warm([[-1, -1.5], [2, 1]]) }),

  // ------------------------------------------------------------------ Who Jah Bless Chop Bar
  chopbar: V({ w: 10, d: 8, floor: 'lino', floorColor: '#c79a68', wallColor: '#f2d2b6', windows: [{ wall: 'left', at: 0.45, w: 1.4 }, { wall: 'back', at: 0.08, w: 1.0 }], door: { wall: 'left', at: 0.15 },
    sign: { text: 'Who Jah Bless Chop Bar', bg: '#c8102e', fg: '#fcd116' },
    items: [I('chop_bar_pot', -3.4, -3.0, 0, { key: 'pot' }), I('counter:2.4', 0.2, -2.9, 0, { key: 'counter', color: '#c8102e', label: 'FUFU · BANKU · RED RED' }), I('pots', 0.2, -2.95, 0, { y: 1.06 }),
      I('crate_stack', 2.4, -3.6), I('chest_freezer', 3.95, -3.55), I('wash_basin', -4.35, 0.5, HP, { key: 'wash' }), I('shared_door', -5, -1.6, HP, { key: 'wc', label: 'WASHROOM', color: '#2a6f97' }),
      I('bench_table', 0.0, 0.25, 0, { key: 'eat', color: '#3f7fbf' }), I('bench_table', 3.0, 0.9, 0, { color: '#2a9d8f' }), I('chop_table', 0.6, 2.8, 0, { chair: '#c8102e' }),
      I('window_curtain', -5, 0.4, HP, { color: '#1f6fb8', arg: 1.4 }), I('poster', -5, 1.6, HP, { label: 'NO CREDIT\nTODAY', color: '#1d6f42' }),
      I('calendar', 4.5, -4, 0), I('plant', -4.5, 3.55), I('standing_fan', 4.4, -1.6, -HP), I('doormat', -4.55, 2.8, HP)],
    zones: [Z('eat', 'Chop', 'ph-bowl-food', 'eat', ['fufu', 'banku', 'redred']), Z('wash', 'Wash plates', 'ph-drop', 'wash', ['washplates']), Z('rush', 'Lunch rush', 'ph-cooking-pot', 'counter', ['rush'], { pose: 'work' }), Z('wc', 'Washroom', 'ph-toilet', 'wc', ['toilet'])],
    spawn: { x: -4.3, z: 2.8 },
    npcs: [N('Madam Jah', 0.2, -3.6, 0, LOOK.auntie('#7b2d8e', '#f2b632'), 'work'), N('Kofi (pounder)', -3.2, -3.72, 0, LOOK.boy('#f4f4f4', '#3a2e22'), 'work'), S('Uncle Bediako', [8, 0], LOOK.uncle('#1f6fb8', '#2b2d42'))],
    lights: warm([[-1.5, -1], [2.5, 1]]) }),

  // ------------------------------------------------------------------ Sweet Mother Kenkey
  kenkey: V({ w: 7, d: 6, floor: 'concrete', floorColor: '#c4baa8', wallColor: '#cde3ef', windows: [{ wall: 'left', at: 0.5, w: 1.2 }], door: { wall: 'left', at: 0.2 },
    sign: { text: 'Sweet Mother Kenkey', bg: '#1d4ed8', fg: '#ffffff' },
    items: [I('kenkey_basket', -1.0, -2.0, 0, { key: 'basket' }), I('fish_tray', 0.1, -2.0), I('cooler', 1.5, -2.7), I('crate_stack', 2.85, -2.75),
      I('chop_table', 1.3, 0.6, 0, { key: 'eat', cw: '#f2b632' }), I('wooden_bench', -3.18, 0.2, HP, { color: '#c8102e' }), I('chop_table', -0.9, 1.6, 0, { chair: '#2f6fd1' }),
      I('standing_fan', 3.0, -0.8, -HP), I('window_curtain', -3.5, 0, HP, { color: '#7b2d8e', arg: 1.2 }), I('calendar', -3.0, -3, 0), I('poster', 3.0, -3, 0, { label: 'KENKEY\n₵10', color: '#c8102e' }), I('plant', 3.0, 2.5)],
    zones: [Z('eat', 'Kenkey & fish', 'ph-fish', 'eat', ['kenkey']), Z('take', 'Takeaway', 'ph-shopping-bag', 'basket', ['kenkeyTake'])],
    spawn: { x: -2.9, z: 1.8 },
    npcs: [N('Sweet Mother', -0.45, -2.72, 0, LOOK.auntie('#c8102e', '#1f6fb8'), 'work'), S('Kwame', [5, 1], LOOK.boy('#e9c46a', '#22313f'))],
    lights: warm([[0, -1], [0.5, 1.2]]) }),

  // ------------------------------------------------------------------ Oxford Street, Osu (outdoor)
  oxford: V({ w: 11, d: 8, outdoor: true, floor: 'pavers',
    items: [I('road:11,2.2', 0, -2.9), I('kerb:5', -3.0, -1.7), I('kerb:5', 3.0, -1.7), I('car_display', -2.4, -2.9, 0, { color: '#2f6fd1' }), I('traffic_cone', 1.0, -2.3),
      I('food_stall', -3.6, -0.7, 0, { key: 'stall', label: 'KELEWELE', umbrella: '#f2c230' }), I('chop_table', -3.6, 1.3, 0, { key: 'eat', cw: '#c8102e' }),
      I('hawker_stand', 0.8, -0.8, 0, { key: 'hawk' }), I('board_sign', 3.6, -1.2, 0, { key: 'photo', label: 'OXFORD ST · OSU', color: '#c8102e', arg: 2.4 }),
      I('wooden_bench', 1.6, 1.9, 0, { key: 'bench', color: '#2a9d8f' }), I('palm_tree', -5.0, -1.2, 0, { arg: 3.8 }), I('palm_tree', 5.0, 0.2, 0, { arg: 3.4 }), I('lamp_post', 2.0, -1.4, PI),
      I('flower_bed', 4.3, 2.6, -HP), I('bin', 2.6, -1.3), I('plant', -0.6, 2.8), I('umbrella', -1.8, 2.4, 0, { color: '#7b2d8e' })],
    zones: [Z('eat', 'Kelewele', 'ph-bowl-food', 'eat', ['kelewele']), Z('stroll', 'People-watch', 'ph-sneaker', 'bench', ['stroll']), Z('photo', 'Photo spot', 'ph-camera', 'photo', ['photoOsu']), Z('hawk', 'Hawk accessories', 'ph-device-mobile', 'hawk', ['hawk'])],
    spawn: { x: 4.0, z: 3.3 },
    npcs: [N('Auntie Dede', -3.6, -1.35, 0, LOOK.auntie('#f2b632', '#7b2d8e'), 'work'), N('Kojo (hawker)', 0.8, -1.35, 0, LOOK.boy('#e76f51', '#22313f'), 'work'), N('Tourist', 3.1, 0.3, 2.85, LOOK.tourist(), 'work')],
    lights: warm([[-3, 0], [2, -1, 8], [3, 2]]) }),

  // ------------------------------------------------------------------ Vibes Lounge (club)
  vibes: V({ w: 10, d: 8, wallH: 2.9, floor: 'checker', floorColor: '#5a5272', wallColor: '#33284a', door: { wall: 'left', at: 0.15 },
    sign: { text: 'Vibes Lounge', bg: '#120d1c', fg: '#ff4fa3' },
    items: [I('dj_booth', 0.4, -3.2, 0, { color: '#00e5ff' }), I('speaker', -1.0, -3.6), I('speaker', 1.75, -3.6), I('dance_floor:3.75,3', 0.6, -0.4, 0, { key: 'floor' }), I('disco_ball', 0.6, -0.4),
      I('bar_counter:2.6', -3.9, -0.6, HP, { key: 'bar', stool: '#ff4fa3' }), I('bottle_shelf:1.8', -3.4, -3.78), I('vip_sofa:2.4', 3.7, -3.45, 0, { key: 'vip' }), I('bottle_table', 3.0, -2.3), I('rope:2.4', 3.7, -1.55),
      I('shared_door', -5, -2.9, HP, { key: 'wc', label: 'TOILET', color: '#7a3cff' }), I('sofa', 3.9, 1.7, -HP, { color: '#7a3cff', arg: 2 }), I('coffee_table', 2.85, 1.7, HP, { color: '#1c1c22' }), I('plant', 4.4, -0.6)],
    zones: [Z('floor', 'Dance floor', 'ph-music-notes', 'floor', ['party', 'battle'], { anim: 'dance' }), Z('bar', 'Bar', 'ph-martini', 'bar', ['drinks', 'shutdown']), Z('vip', 'VIP', 'ph-crown', 'vip', ['vip', 'sneakvip']), Z('wc', 'Toilet', 'ph-toilet', 'wc', ['toilet'])],
    spawn: { x: -4.3, z: 2.8 },
    npcs: [N('DJ Kwame', 0.4, -3.85, 0, LOOK.boy('#151515', '#151515'), 'work'), N('Esi (bar)', -4.6, -0.6, HP, LOOK.girl('#ff4fa3', '#151515'), 'work'), N('Big Joe', 2.0, -1.55, 0.7, L('m', '#151515', '#151515', 6), 'lean')],
    lights: [{ x: -2, z: -1, color: '#ff4fa3', intensity: 7, dist: 7 }, { x: 3, z: 0, color: '#7a3cff', intensity: 7, dist: 7 }, { x: 0.4, z: -2.6, color: '#00e5ff', intensity: 5, dist: 6 }] }),

  // ------------------------------------------------------------------ Sankofa Tech Hub
  hub: V({ w: 10, d: 8, floor: 'wood', floorColor: '#c49a6c', wallColor: '#eef1f4', windows: [{ wall: 'back', at: 0.92, w: 1.1 }], door: { wall: 'left', at: 0.525 },
    sign: { text: 'Sankofa Tech Hub', bg: '#0f766e', fg: '#ffffff' },
    items: [I('whiteboard:2', -5, -2.0, HP), I('classroom_desk', -3.4, -2.6, HP, { key: 'boot' }), I('classroom_desk', -3.4, -1.3, HP),
      I('laptop_desk', -0.6, -2.4, PI, { key: 'd1' }), I('laptop_desk', 0.9, -2.4, PI, { key: 'desk', chair: '#c8102e' }), I('laptop_desk', 2.4, -2.4, PI),
      I('bookshelf', 4.2, -3.82), I('plant', 4.6, -2.6), I('shared_door', -2.4, -4, 0, { key: 'wc', label: 'WASHROOM' }), I('water_dispenser', -4.6, -3.65),
      I('big_screen:2', -5, 1.9, HP, { screen: 'show' }), I('rug', -3.1, 1.9, HP, { dims: [2.4, 1.6], k: 2 }), I('sofa', -2.4, 1.9, -HP, { key: 'pitch', color: '#2a9d8f', arg: 2.2 }), I('coffee_table', -3.5, 1.9, HP),
      I('ac', -3.4, -4, 0), I('plant', 3.4, 2.9), I('floor_lamp', -4.6, 3.6), I('picture', 4.95, -4, 0, { arg: 0.4, screen: 'code' })],
    zones: [Z('desk', 'Co-working desks', 'ph-laptop', 'desk', ['cowork', 'freelance', 'buildmvp', 'sakawa']), Z('boot', 'Bootcamp', 'ph-chalkboard-teacher', 'boot', ['bootcamp']), Z('pitch', 'Pitch room', 'ph-presentation-chart', 'pitch', ['pitch']), Z('wc', 'Washroom', 'ph-toilet', 'wc', ['toilet'])],
    spawn: { x: -4.3, z: -0.2 },
    npcs: [S('Nii (coder)', ['d1', 0], LOOK.boy('#1d1d1d', '#3a4a6b')), N('Mr Mensah', -4.55, -2.0, HP, LOOK.uncle('#f4f4f4', '#2b3a55'), 'work'), N('Akua (manager)', 1.6, -0.9, -0.3, LOOK.girl('#0f766e', '#22313f'))],
    lights: warm([[-2, -1.5], [2, -1], [-2.5, 2]], '#fff1d6', 5) }),

  // ------------------------------------------------------------------ Gold Coast Bank
  bank: V({ w: 9, d: 7, floor: 'terrazzo', floorColor: '#d8d0c2', wallColor: '#e3ece6', windows: [{ wall: 'left', at: 0.5, w: 1.2 }, { wall: 'back', at: 0.07, w: 1.0 }], door: { wall: 'left', at: 0.2 },
    sign: { text: 'Gold Coast Bank', bg: '#7a5c12', fg: '#fcd116' },
    items: [I('teller_desk', 0.6, -2.6, 0, { key: 'teller' }), I('atm', 3.85, -3.15), I('consult_desk', -3.2, -1.4, HP, { key: 'loans' }), I('airport_seats:4', 2.0, 1.2, 0, { color: '#1d3557' }),
      I('plant', -4.0, -3.0), I('plant', 4.0, 0.2), I('wall_clock', -3.0, -3.5), I('water_dispenser', -4.1, 1.0, HP), I('shared_door', -2.6, -3.5, 0, { key: 'wc', label: 'WASHROOM', color: '#7a5c12' }),
      I('rope:2.4', 0.6, -1.4), I('picture', -4.5, -3.0, HP, { arg: 0.5 }), I('floor_sign', 2.4, -1.0, -0.4, { label: 'QUEUE\nHERE', color: '#7a5c12' }), I('doormat', -4.0, 2.1, HP)],
    zones: [Z('loans', 'Loans desk', 'ph-hand-coins', 'loans', ['loans']), Z('teller', 'Banking hall', 'ph-bank', 'teller', ['fixed']), Z('wc', 'Washroom', 'ph-toilet', 'wc', ['toilet'])],
    spawn: { x: -3.8, z: 2.1 },
    npcs: [N('Mrs Owusu', -0.05, -3.15, 0, LOOK.auntie('#7a5c12', '#1d2433'), 'work'), S('Mr Boateng', ['loans', 1], LOOK.uncle('#f4f4f4', '#1d2433')), N('Security', -3.2, 2.7, 0.9, L('m', '#3a4a3a', '#1d2433', 6), 'lean')],
    lights: warm([[-1.5, -1], [2, 0.5]], '#fff1d6', 5) }),

  // ------------------------------------------------------------------ Ridge Hospital
  ridge: V({ w: 10, d: 8, floor: 'tiles', floorColor: '#e8eef0', wallColor: '#d9eeea', windows: [{ wall: 'left', at: 0.35, w: 1.4 }, { wall: 'back', at: 0.08, w: 1.0 }], door: { wall: 'left', at: 0.8 },
    sign: { text: 'Ridge Hospital', bg: '#0f766e', fg: '#ffffff' },
    items: [I('hospital_bed', 1.6, -2.95, 0, { key: 'bed' }), I('curtain:2', 2.5, -2.95, HP, { color: '#7fb7d8' }), I('hospital_bed', 3.4, -2.95, 0, { key: 'bedB', color: '#e9c46a' }),
      I('consult_desk', -2.8, -2.8, 0, { key: 'doc' }), I('medicine_shelf:1.2', -4.75, -0.6, HP), I('reception_desk', 0.0, 0.6, 0, { accent: '#0f766e' }), I('airport_seats:4', -1.6, 2.6, 0, { color: '#2a9d8f' }),
      I('water_dispenser', 4.5, -0.5, -HP), I('plant', 4.4, 2.1), I('shared_door', -5, 2.9, HP, { key: 'wc', label: 'WASHROOM', color: '#0f766e' }), I('poster', -5, 1.2, HP, { label: 'WASH\nYOUR HANDS', color: '#0f766e' }), I('wall_clock', -0.9, -4)],
    zones: [Z('doc', 'Consulting room', 'ph-stethoscope', 'doc', ['checkup']), Z('ward', 'Ward', 'ph-bed', 'bed', ['treatment']), Z('wc', 'Washroom', 'ph-toilet', 'wc', ['toilet'])],
    spawn: { x: -4.3, z: -2.4 },
    npcs: [S('Dr Asante', ['doc', 1], LOOK.doctor()), N('Nurse Abena', 0.0, -0.1, 0, LOOK.nurse(), 'work'), S('Patient', ['bedB', 0], LOOK.uncle('#9fc5e8', '#9fc5e8'))],
    lights: warm([[-2, -1], [2, 0]], '#fff6e6', 5) }),

  // ------------------------------------------------------------------ Korle Bu Teaching Hospital
  korlebu: V({ w: 11, d: 9, floor: 'terrazzo', floorColor: '#dcd6c8', wallColor: '#e6efe0', windows: [{ wall: 'left', at: 0.75, w: 1.2 }], door: { wall: 'left', at: 0.5 },
    sign: { text: 'Korle Bu Teaching Hospital', bg: '#14532d', fg: '#ffffff' },
    items: [I('hospital_bed', 1.0, -3.4, 0, { key: 'ward' }), I('curtain:2', 1.8, -3.4, HP, { color: '#9fd3c7' }), I('hospital_bed', 2.6, -3.4, 0, { color: '#e9c46a' }), I('curtain:2', 3.4, -3.4, HP, { color: '#9fd3c7' }), I('hospital_bed', 4.2, -3.4, 0),
      I('consult_desk', -3.6, -3.0, 0, { key: 'opd' }), I('airport_seats:5', -2.6, -0.4, 0, { color: '#2f6fd1' }), I('floor_sign', -1.6, -2.3, 0.4, { label: 'OPD', color: '#14532d' }),
      I('counter', 3.4, -0.8, 0, { color: '#e9a23b', label: 'CANTEEN' }), I('pots', 3.3, -0.85, 0, { y: 1.06 }), I('bench_table', 3.2, 1.6, 0, { key: 'canteen', color: '#e9a23b' }),
      I('medicine_shelf:1.2', -5.25, 2.4, HP), I('water_dispenser', -5.1, -1.3, HP), I('plant', 0.6, 3.8), I('wall_clock', -1.4, -4.5)],
    zones: [Z('opd', 'OPD', 'ph-stethoscope', 'opd', ['checkup2']), Z('ward', 'NHIS ward', 'ph-bed', 'ward', ['nhis']), Z('canteen', 'Canteen', 'ph-bowl-food', 'canteen', ['hospfood'])],
    spawn: { x: -4.8, z: 0 },
    npcs: [S('Dr Quaye', ['opd', 1], LOOK.doctor()), N('Nurse Efua', 1.8, -1.7, 0.6, LOOK.nurse(), 'stand'), N('Auntie Grace', 3.4, -1.55, 0, LOOK.auntie('#e9a23b', '#1f6fb8'), 'work')],
    lights: warm([[-2.5, -1.5], [2.5, -1], [3, 1.5]], '#fff6e6', 5) }),

  // ------------------------------------------------------------------ Osu Police Station
  police: V({ w: 8, d: 7, floor: 'tiles', floorColor: '#d6d2c8', wallColor: '#cfdbe8', windows: [{ wall: 'left', at: 0.6, w: 1.0 }], door: { wall: 'left', at: 0.15 },
    sign: { text: 'Osu Police Station', bg: '#1f3b73', fg: '#ffffff' },
    items: [I('police_desk', 1.4, -2.2, 0, { key: 'desk' }), I('cell_bars:2.4', -2.8, -1.45, 0, { key: 'cell' }), I('wooden_bench', 2.2, 0.9, 0, { color: '#1f3b73' }), I('plastic_chair', 2.85, -0.9, PI, { color: '#1d4ed8' }),
      I('notice_board', -4, 1.2, HP), I('chest', 3.4, -3.1, 0, { color: '#6b7280' }), I('plant', 3.55, -2.2), I('wall_clock', 3.55, -3.5),I('doormat', -3.55, 2.45, HP), I('flag_pole:1.9', -0.3, -3.1)],
    zones: [Z('desk', 'Charge office', 'ph-siren', 'desk', ['report'])],
    spawn: { x: -3.3, z: 2.45 },
    npcs: [N('Inspector Addo', 1.4, -2.9, 0, LOOK.police(), 'work'), N('Corporal Ama', 3.1, -1.4, -0.6, LOOK.policeF(), 'lean'), N('Suspect', -3.35, -2.35, 0, LOOK.boy('#e76f51', '#22313f'), 'sit', { y: 0.48 })],
    lights: warm([[-1, -1], [1.5, 0.5]], '#fff6e6', 5) }),

  // ------------------------------------------------------------------ Kwame Nkrumah Memorial Park (outdoor)
  memorial: V({ w: 11, d: 9, outdoor: true, floor: 'grass',
    items: [I('path:9,2', 0.5, 0, HP), I('path:11,1.6', 0, 1.4), I('statue', 0.5, -3.3, 0, { label: 'FREEDOM & JUSTICE' }), I('flower_bed:1.6', -1.0, -3.6), I('flower_bed:1.6', 2.0, -3.6),
      I('fountain', -2.7, -1.6, 0, { key: 'fountain', arg: 1.1 }), I('fountain', 3.7, -1.6, 0, { arg: 1.1 }), I('flag_pole', -1.6, -4.1), I('flag_pole', 2.6, -4.1),
      I('ticket_booth', -4.3, 3.0, HP, { key: 'tour', label: 'TOURS', color: '#1d6f42' }), I('palm_tree', -5.0, -4.0), I('palm_tree', 5.0, -4.0, 0, { arg: 3.2 }), I('palm_tree', -5.0, -0.2, 0, { arg: 3.0 }),
      I('hedge:3', -3.7, -4.2), I('hedge:2.6', 4.0, -4.2), I('wooden_bench', 2.8, 2.6, 0, { color: '#6d4c41' }), I('lamp_post', 1.9, -0.9, PI), I('hedge:2', 4.4, 3.8)],
    zones: [Z('tour', 'Guided tour', 'ph-map-trifold', 'tour', ['tour']), Z('fountain', 'Fountains', 'ph-camera', 'fountain', ['shoot'])],
    spawn: { x: 3.5, z: 3.7 },
    npcs: [N('Guide Kwabena', -3.1, 2.1, 0.8, LOOK.uncle('#1d6f42', '#e9e2d0')), N('Selasi (photographer)', -0.9, -0.5, -2.3, LOOK.girl('#151515', '#c8102e'), 'work')],
    lights: warm([[-2.7, -1.6], [3.7, -1.6], [0.5, -2.5]]) }),

  // ------------------------------------------------------------------ Black Star Square (outdoor)
  blackstar: V({ w: 12, d: 9, outdoor: true, floor: 'concrete', floorColor: '#d3cec4',
    items: [I('star_arch', 0, -3.8, 0, { arg: 5 }), I('flag_pole', -4.6, -3.9), I('flag_pole', -3.5, -3.9), I('flag_pole', 3.5, -3.9), I('flag_pole', 4.6, -3.9),
      I('track:10', 0, 0.5, 0, { key: 'track' }), I('kite', -3.5, -1.6, 0, { key: 'kite' }), I('kite', 2.5, -2.2, 0, { color: '#2f6fd1' }),
      I('wooden_bench', 3.4, 3.4, 0, { color: '#1d6f42' }), I('wooden_bench', -1.4, 3.4, 0, { color: '#1d6f42' }), I('lamp_post', -5.6, -1.4, 0), I('lamp_post', 5.6, -1.4, PI), I('ice_cart', 5.0, 2.9, -0.4), I('palm_tree', -5.4, 3.8, 0, { arg: 3 })],
    zones: [Z('track', 'Jogging lane', 'ph-person-simple-run', 'track', ['jog']), Z('kite', 'Kite flying', 'ph-wind', 'kite', ['kite'])],
    spawn: { x: 1.8, z: 3.8 },
    npcs: [N('Kofi (kite seller)', -4.4, -0.6, 0.8, LOOK.boy('#f2c230', '#22313f'), 'cheer'), N('Ice cream man', 4.3, 2.4, -0.6, LOOK.uncle('#2f6fd1', '#e9e2d0'))],
    lights: warm([[-5.6, -1.4, 8], [5.6, -1.4, 8], [0, -3]]) }),

  // ------------------------------------------------------------------ Osu Castle courtyard (outdoor)
  castle: V({ w: 11, d: 9, outdoor: true, floor: 'stone',
    items: [I('castle_wall:11', 0, -4.25, 0, { arg2: 2.6 }), I('castle_wall:8.5', -5.25, 0.25, HP, { arg2: 2.6 }),
      I('cannon', -3.6, -3.0, PI), I('cannon', -1.2, -3.0, PI, { key: 'cannon' }), I('cannon', 3.6, -3.0, PI), I('board_sign', 1.2, -3.8, 0, { label: 'OSU CASTLE', color: '#5a3b26', arg: 2.4 }), I('flag_pole', 4.7, -3.6),
      I('ticket_booth', -4.3, 2.8, HP, { key: 'tour', label: 'TOURS', color: '#5a3b26' }), I('palm_tree', 4.8, -1.2, 0, { arg: 3.6 }), I('palm_tree', 4.9, 1.6, 0, { arg: 3.2 }),
      I('wooden_bench', 0.4, 1.4, 0, { color: '#5a3b26' }), I('flower_bed:2', 1.8, 3.6), I('lamp_post', -2.4, 1.0, 0)],
    zones: [Z('tour', 'Castle tour', 'ph-castle-turret', 'tour', ['castletour']), Z('guide', 'Guide visitors', 'ph-flag', 'cannon', ['guide'])],
    spawn: { x: 3.0, z: 3.6 },
    npcs: [N('Guide Nana', -0.3, -1.8, 0.4, LOOK.uncle('#5a3b26', '#e9e2d0')), N('Visitor', 0.6, -1.4, -2.4, LOOK.tourist(), 'stand'), N('Visitor Tom', 1.3, -1.8, -1.9, L('m', '#2f6fd1', '#e9e2d0', 2))],
    lights: warm([[-2.4, 1.0, 8], [1, -2]]) }),

  // ------------------------------------------------------------------ Jamestown Lighthouse (outdoor)
  lighthouse: V({ w: 10, d: 8, outdoor: true, floor: 'dirt', floorColor: '#bf8a5e',
    items: [I('low_wall:10', 0, -3.85, 0, { color: '#e8dfc9', trim: '#c8102e' }), I('low_wall:7.5', -4.85, 0.2, HP, { color: '#e8dfc9', trim: '#c8102e' }), I('lighthouse', -3.0, -2.4, 0, { key: 'lh' }),
      I('canoe:4.4', 2.4, -2.9, 0, { color: '#1f6fb8', label: 'NYAME NE HENE' }), I('fishing_net', 2.6, 0.2), I('sign_post', -1.4, -1.0, 0, { label: 'LIGHTHOUSE' }), I('wooden_bench', -1.0, 1.8, 0, { color: '#c8102e' }),
      I('barrel', -4.2, 1.6), I('jerrycans', -4.2, 2.6, HP), I('palm_tree', 4.6, -0.9, 0, { arg: 3.4 }), I('clothes_rack:1.6', 0.6, 3.4, 0), I('crate_stack', 4.3, 2.6, 0, { arg: 2 })],
    zones: [Z('lh', 'Lighthouse', 'ph-lighthouse', 'lh', ['climb'])],
    spawn: { x: 3.4, z: 3.2 },
    npcs: [N('Caretaker Ato', -2.1, -0.7, 0.6, LOOK.uncle('#f4f4f4', '#3a2e22')), N('Papa Nii', 2.7, 1.05, PI, LOOK.uncle('#e76f51', '#3a2e22'), 'squat'), N('Little Nii', 1.0, 1.1, -0.5, L('m', '#f2c230', '#1f6fb8', 6), 'cheer')],
    lights: warm([[-1, 0], [2.5, 1]]) }),

  // ------------------------------------------------------------------ Bukom Boxing Arena
  bukom: V({ w: 10, d: 8, floor: 'concrete', floorColor: '#a9a49a', wallColor: '#c9d6df', windows: [{ wall: 'left', at: 0.45, w: 1.2 }], door: { wall: 'left', at: 0.15 },
    sign: { text: 'Bukom Boxing Arena', bg: '#c8102e', fg: '#ffffff' },
    items: [I('boxing_ring', 0.6, -1.95, 0, { key: 'ring' }), I('punching_bag', -4.4, -3.0, HP, { key: 'bag' }), I('punching_bag', -4.4, -1.6, HP, { color: '#1d4ed8' }),
      I('stadium_seats', 4.0, -1.9, -HP, { key: 'seats', arg: 2, arg2: 4 }), I('dumbbells', -3.4, 1.4, 0), I('wooden_bench', -0.5, 1.9, 0, { color: '#c8102e' }), I('cooler', 1.2, 1.9, 0, { color: '#c8102e' }),
      I('poster', -5, 0.4, HP, { label: 'FIGHT\nNIGHT\nSAT', color: '#c8102e' }), I('poster', -5, -0.5, HP, { label: 'NO PAIN\nNO GAIN', color: '#1d3557' }), I('wall_clock', -3.4, -4)],
    zones: [Z('bag', 'Bag work', 'ph-boxing-glove', 'bag', ['train']), Z('ring', 'The ring', 'ph-target', 'ring', ['spar']), Z('seats', 'Ringside', 'ph-ticket', 'seats', ['fightnight'])],
    spawn: { x: -4.3, z: 2.8 },
    npcs: [N('Coach Attuquaye', -2.6, -2.4, -0.9, LOOK.uncle('#c8102e', '#151515'), 'lean'), S('Boxer Nii', ['ring', 1], L('m', '#1d4ed8', '#1d4ed8', 6), { pose: 'guard' }), S('Fan', ['seats', 2], LOOK.boy('#f2c230', '#22313f'), { pose: 'cheer' })],
    lights: [{ x: 0.6, z: -2, color: '#fff4d6', intensity: 9, dist: 7 }, { x: -3, z: 1, color: '#ffd59a', intensity: 5, dist: 7 }] }),

  // ------------------------------------------------------------------ Jamestown Canoe Beach (outdoor)
  canoes: V({ w: 11, d: 9, outdoor: true, floor: 'sand',
    items: [I('sea:11,2.6', 0, -3.2), I('canoe', -1.8, -0.8, 0.15, { color: '#f7f1e3', label: 'GOD DEY' }), I('canoe', 2.4, 1.3, -0.2, { color: '#2a9d8f', label: 'NYAME NE HENE' }),
      I('fishing_net', 2.6, -1.2, 0, { key: 'net' }), I('fish_tray', -3.6, 2.8, PI, { key: 'fish' }), I('fish_smoker', -4.4, 0.9, HP), I('palm_tree', -5.0, -1.6, 0, { arg: 3.6 }), I('palm_tree', 5.0, -1.3, 0, { arg: 3.2 }),
      I('umbrella', -2.4, 3.4, 0, { color: '#f2c230' }), I('stool', -2.6, 2.6), I('barrel', 4.6, 3.6, 0, { color: '#e63946' })],
    zones: [Z('net', 'Pull the net', 'ph-fish-simple', 'net', ['net']), Z('fish', 'Fish sellers', 'ph-fish', 'fish', ['fish'])],
    spawn: { x: 4.0, z: 3.6 },
    npcs: [N('Papa Kwesi', 3.2, -2.0, 0.2, LOOK.uncle('#e76f51', '#3a2e22'), 'squat'), N('Auntie Fanti', -3.6, 2.12, PI, LOOK.auntie('#1f6fb8', '#f2b632'), 'work'), N('Kobby', 0.4, -3.4, 0.6, L('m', '#2a9d8f', '#1f6fb8', 6), 'wade', { y: -0.75 })],
    lights: warm([[-3, 1.5], [2, 0]]) }),

  // ------------------------------------------------------------------ Labadi Beach (outdoor)
  // after the 2 Oct 2026 demolition: rubble where the beach bars stood, an excavator, tape, vendors on coolers
  labadi: V({ w: 13, d: 10, outdoor: true, floor: 'sand',
    items: [I('sea:13,2.6', 0, -3.7, 0, { key: 'sea' }), I('rubble', -3.9, -1.0, 0.2, { arg: 3.2, key: 'ruins', label: 'BEACH BAR', color: '#2a9d8f', seed: 3 }), I('rubble', 0.6, -1.3, -0.15, { arg: 2.6, seed: 9, label: 'COCKTAILS', color: '#c8102e' }),
      I('excavator', 4.3, -0.9, -0.5), I('rubble', 3.6, 1.9, 0.4, { arg: 2.0, seed: 15 }), I('barrier_tape:5', -3.3, 0.7, 0), I('barrier_tape:4', 1.9, 0.5, 0),
      I('board_sign', -0.9, 0.9, 0.15, { arg: 2.2, label: 'DEMOLISHED · 2 OCT 2026', color: '#fcd116', fg: '#17150f' }),
      I('cooler', -1.4, 2.5, 0, { key: 'chop' }), I('coal_pot', -2.2, 2.6), I('plastic_chair', -0.6, 3.3, PI, { color: '#e63946' }), I('umbrella', -1.8, 2.3, 0, { color: '#1d4ed8' }),
      I('sacks', 5.2, 3.3, -0.4, { key: 'move' }), I('crate_stack', 5.6, 4.2, 0.3, { arg: 2 }), I('plastic_table', -4.6, 3.6, 0, { key: 'fund' }), I('board_sign', -4.6, 2.9, 0, { arg: 1.6, label: 'SUPPORT THE VENDORS', color: '#0e7a4e' }),
      I('pullup_bar', 1.9, -1.9, 0, { key: 'gym' }), I('drum', 1.6, 3.6, 0, { key: 'jam' }), I('drum', 2.4, 3.9, 0.4),
      I('toilet_booth', -6.0, 0.6, HP, { key: 'wc' }), I('palm_tree', -6.1, -2.0, 0, { arg: 3.8 }), I('palm_tree', 6.0, -2.2, 0, { arg: 3.2 }), I('plastic_chair', 2.8, 1.0, 1.2, { color: '#f4f4f2' })],
    zones: [Z('ruins', 'The ruins', 'ph-warning', 'ruins', ['ruins']), Z('move', 'Help a vendor', 'ph-package', 'move', ['helpvendor']), Z('fund', 'Vendors’ fund', 'ph-hand-heart', 'fund', ['donatefund']),
      Z('sea', 'The sea', 'ph-waves', 'sea', ['swim']), Z('chop', 'Cooler & coal pot', 'ph-fish', 'chop', ['palmwine', 'tilapia']), Z('gym', 'Muscle Beach', 'ph-barbell', 'gym', ['beachworkout']),
      Z('jam', 'Drummers’ jam', 'ph-music-notes', 'jam', ['drumjam'], { anim: 'dance' }), Z('wc', 'Pay toilet', 'ph-toilet', 'wc', ['toilet'])],
    spawn: { x: 1.4, z: 4.4 },
    npcs: [N('Auntie Dzifa (vendor)', -1.4, 1.85, 0, LOOK.auntie('#e76f51', '#1f6fb8')), N('Papa Tetteh', -2.2, 0.15, 2.8, LOOK.uncle('#f4f4f4', '#3a2e22')), N('Muscle Kojo', 2.6, -1.9, -HP, L('m', '#151515', '#c8102e', 6), 'squat'), N('Esi (lost her bar)', 3.2, 0.2, 2.4, LOOK.girl('#2a9d8f', '#2b2d42'))],
    lights: warm([[-1.4, 2.5], [1.8, 3.6, 8], [-4.6, 3.6]]) }),

  // ------------------------------------------------------------------ La Funeral Grounds (outdoor)
  funeral: V({ w: 11, d: 9, outdoor: true, floor: 'dirt', floorColor: '#c27c4e',
    items: [I('canopy:5,2.4', 0.8, -3.3, 0, { colors: ['#b3202a', '#151515'] }), I('chair_row:7', 0.8, -3.15, 0, { key: 'chairs', color: '#151515', alt: '#b3202a' }),
      I('canopy:2.4,5', -4.3, 0.6, 0, { colors: ['#b3202a', '#151515'] }), I('chair_row:6', -4.25, 0.6, HP, { color: '#b3202a', alt: '#151515' }),
      I('canopy:2.4,2.6', -4.3, -3.2, 0, { colors: ['#f7f1e3', '#d9a93a'] }), I('coffin', -4.3, -3.1, 0, { key: 'coffin' }), I('portrait_stand', -2.7, -4.0, 0.3),
      I('dj_booth', 4.2, -1.0, -HP, { key: 'dj', color: '#b3202a', label: 'DJ SLY' }), I('speaker', 5.1, -2.4, -HP), I('speaker', 5.1, 0.4, -HP), I('drum', 3.2, 2.2, -HP),
      I('board_sign', 4.5, -3.9, 0, { label: 'CELEBRATION\nOF LIFE', color: '#151515', fg: '#fcd116', arg: 1.8 }), I('bunting:6', 0.6, 1.0, 0, { colors: ['#b3202a', '#151515'] }), I('cooler', 2.2, 3.6, 0.3, { color: '#c8102e' }), I('crate_stack', 2.9, 3.7, 0, { arg: 2 })],
    zones: [Z('chairs', "Mourners' canopy", 'ph-users-three', 'chairs', ['attend']), Z('coffin', 'Coffin', 'ph-hands-praying', 'coffin', ['mourn']), Z('dj', 'DJ', 'ph-speaker-hifi', 'dj', ['djfuneral'])],
    spawn: { x: 2.6, z: 3.8 },
    npcs: [N('DJ Sly', 4.85, -1.0, -HP, LOOK.black('m'), 'work'), S('Auntie Mercy', [3, 2], LOOK.redblack('f')), N('Drummer Kofi', 3.7, 2.2, -HP, LOOK.redblack('m'), 'work')],
    lights: warm([[0.8, -3, 7], [-4, 0.5], [4, -1]]) }),

  // ------------------------------------------------------------------ Glorious Fire Ministry (church)
  church: V({ w: 11, d: 9, wallH: 3.0, floor: 'terrazzo', floorColor: '#e5ddcf', wallColor: '#f5ecd7', windows: [{ wall: 'left', at: 0.32, w: 1.0 }, { wall: 'left', at: 0.68, w: 1.0 }], door: { wall: 'left', at: 0.08 },
    sign: { text: 'Glorious Fire Ministry', bg: '#6a1b9a', fg: '#fcd116' },
    items: [I('stage:4,1.6', 0.8, -3.6, 0), I('pulpit', 0.8, -3.3, 0, { y: 0.3 }), I('keyboard_instrument', 3.8, -3.6, 0, { key: 'choir' }), I('drum', 4.95, -3.5, 0), I('speaker', -1.8, -3.9), I('speaker', 5.05, -2.0, -HP),
      I('pew', 2.4, -1.4, PI, { key: 'pews' }), I('pew', -1.4, -1.4, PI), I('pew', 2.4, 0.0, PI), I('pew', -1.4, 0.0, PI), I('pew', 2.4, 1.4, PI), I('pew', -1.4, 1.4, PI), I('pew', 2.4, 2.8, PI), I('pew', -1.4, 2.8, PI),
      I('offering_box', 4.75, 0.8, -HP, { key: 'seed' }), I('poster', -5.5, -0.2, HP, { label: 'JESUS\nIS LORD', color: '#6a1b9a' }), I('window_curtain', -5.5, 1.6, HP, { color: '#6a1b9a', arg: 1.0 }), I('window_curtain', -5.5, -1.62, HP, { color: '#6a1b9a', arg: 1.0 }),
      I('plant', -2.6, -3.95), I('bunting:4', 0.8, -2.6, 0, { colors: ['#6a1b9a', '#fcd116', '#ffffff'] })],
    zones: [Z('pews', 'Pews', 'ph-hands-praying', 'pews', ['service', 'prayer']), Z('choir', 'Choir stand', 'ph-music-notes', 'choir', ['choir']), Z('seed', 'Offering', 'ph-coins', 'seed', ['seed'])],
    spawn: { x: -4.8, z: 3.8 },
    npcs: [N('Prophet Mensah', 0.8, -3.95, 0, L('m', '#f4f4f4', '#151515', 5), 'cheer', { y: 0.3 }), N('Bro. Eli', 3.8, -4.05, 0, LOOK.boy('#6a1b9a', '#151515'), 'work'), N('Sister Ama', 0.5, 0.9, -2.6, LOOK.auntie('#f4f4f4', '#6a1b9a'))],
    lights: warm([[0.8, -2.8, 7], [-1.4, 1], [2.4, 1]]) }),

  // ------------------------------------------------------------------ Nima Central Mosque
  mosque: V({ w: 10, d: 8, floor: 'carpet', floorColor: '#2e6b4f', wallColor: '#f4f1ea', windows: [{ wall: 'back', at: 0.08, w: 1.0 }, { wall: 'left', at: 0.2, w: 1.0 }], door: { wall: 'left', at: 0.9 },
    sign: { text: 'Nima Central Mosque', bg: '#1d6f42', fg: '#ffffff' },
    items: [I('mihrab', -5, -0.5, HP), I('minbar', -4.2, -2.0, HP), I('prayer_mats:4', -2.6, -0.5, HP, { key: 'row1' }), I('prayer_mats:4', -1.2, -0.5, HP, { key: 'row2' }), I('prayer_mats:4', 0.2, -0.5, HP),
      I('ablution:2.4', 2.8, -3.3, 0), I('notice_board:1.0', 4.2, -4), I('wall_clock', 4.2, -4),I('wooden_bench', 2.6, 2.6, 0, { color: '#1d6f42' }), I('plant', 4.5, 0.2)],
    zones: [Z('pray', 'Prayer hall', 'ph-hands-praying', 'row1', ['pray']), Z('jumah', "Jumu'ah rows", 'ph-users-three', 'row2', ['jumah'])],
    spawn: { x: -4.3, z: -3.2 },
    npcs: [N('Imam Abdul', -3.8, -2.7, 0.3, L('m', '#f4f4f4', '#f4f4f4', 5)), S('Malam Musa', ['row1', 2], L('m', '#e9e2d0', '#e9e2d0', 6))],
    lights: warm([[-2, -0.5], [2.5, 0]], '#fff1d6', 5) }),

  // ------------------------------------------------------------------ Accra Sports Stadium (outdoor)
  stadium: V({ w: 12, d: 9, outdoor: true, floor: 'grass', floorColor: '#79b45c',
    items: [I('stadium_seats', -0.5, -3.2, 0, { key: 'stands', arg: 3, arg2: 8 }), I('steps:2,5', 4.6, -3.45, 0, { key: 'stairs' }), I('pitch_lines:12,5', 0, 1.9), I('goalpost', 0.5, 4.1, PI),
      I('floodlight', -5.6, -4.1), I('floodlight', 5.7, -1.4), I('ticket_booth', -5.2, 2.4, HP, { label: 'TICKETS ₵60', color: '#c8102e' }), I('flag_pole', 3.3, -4.1)],
    zones: [Z('stands', 'Stands', 'ph-soccer-ball', 'stands', ['match']), Z('stairs', 'Stadium stairs', 'ph-sneaker-move', 'stairs', ['stadiumjog'])],
    spawn: { x: 3.0, z: 3.0 },
    npcs: [S('Hearts fan', ['stands', 4], L('m', '#c8102e', '#f2c230', 6), { pose: 'cheer' }), S('Kotoko fan', ['stands', 1], L('f', '#f4f4f4', '#c8102e', 5)), N('Ticket lady', -4.4, 2.0, HP, LOOK.auntie('#c8102e', '#151515'))],
    lights: warm([[-5.6, -3, 9], [5.7, -1, 9]], '#fff8e0', 7) }),

  // ------------------------------------------------------------------ Black Stars Viewing Centre, Nima
  viewing: V({ w: 9, d: 7, floor: 'concrete', floorColor: '#b3ada2', wallColor: '#cde3ef', windows: [{ wall: 'back', at: 0.94, w: 0.9 }], door: { wall: 'back', at: 0.11 },
    sign: { text: 'Black Stars Viewing Centre', bg: '#151515', fg: '#fcd116' },
    items: [I('big_screen:2.6', -4.5, 0.3, HP, { screen: 'match' }), I('wooden_bench:2', -2.5, 0.3, -HP, { key: 'b1', color: '#c8102e' }), I('wooden_bench:2', -1.0, 0.3, -HP, { key: 'b2', color: '#f2c230' }), I('wooden_bench:2', 0.5, 0.3, -HP, { color: '#1d6f42' }),
      I('counter:1.6', 3.4, -2.6, 0, { key: 'bet', color: '#1d6f42', label: 'BETS' }), I('cooler', 1.8, -3.1), I('crate_stack', 1.0, -3.15, 0, { arg: 2 }), I('poster', -2.6, -3.5, 0, { label: 'GO\nBLACK\nSTARS', color: '#151515' }),
      I('standing_fan', 3.9, 2.8, -2.4), I('standing_fan', 2.0, 2.9, -2.6), I('bunting:5', -1.0, -1.6, HP, { colors: ['#ce1126', '#fcd116', '#006b3f'] }), I('plastic_chair', 2.0, 0.6, -HP, { color: '#2f6fd1' })],
    zones: [Z('watch', 'Watch the match', 'ph-television', 'b2', ['watch']), Z('bet', 'Betting counter', 'ph-dice-five', 'bet', ['bet'])],
    spawn: { x: -3.5, z: -2.6 },
    npcs: [N('Mallam Iddrisu', 3.4, -3.15, 0, LOOK.uncle('#f4f4f4', '#1d6f42'), 'work'), S('Fan Yaw', ['b1', 1], LOOK.boy('#fcd116', '#151515')), N('Shouting fan', 1.5, 1.6, -1.6, L('m', '#ce1126', '#151515', 6), 'cheer')],
    lights: warm([[-1, 0], [2.5, -1.5]], '#fff1d6', 5) }),

  // ------------------------------------------------------------------ Sankofa FM Studios
  radio: V({ w: 9, d: 7, floor: 'carpet', floorColor: '#3a4a6b', wallColor: '#e8e4f0', windows: [{ wall: 'left', at: 0.55, w: 1.0 }], door: { wall: 'left', at: 0.15 },
    sign: { text: 'Sankofa FM 98.7', bg: '#c8102e', fg: '#ffffff' },
    items: [I('acoustic_panel:2', -3.2, -3.5, 0), I('acoustic_panel:2', -4.5, -1.8, HP, { color: '#1d3557' }), I('radio_desk', -0.6, -0.8, 0, { key: 'desk' }),
      I('sofa', 2.6, -2.95, 0, { color: '#c8102e', arg: 2 }), I('coffee_table', 2.6, -1.9, 0), I('phone_table', 3.8, 1.0, -HP, { key: 'phone' }),
      I('poster', 4.1, -3.5, 0, { label: 'ON AIR', color: '#c8102e' }), I('picture', -4.5, 1.6, HP, { arg: 0.5, screen: 'news' }), I('picture', -4.5, 2.6, HP, { arg: 0.4 }), I('plant', -4.0, -3.0), I('water_dispenser', 4.1, -0.9, -HP), I('floor_lamp', 1.5, 2.8)],
    zones: [Z('phone', 'Call-in line', 'ph-phone-call', 'phone', ['callin']), Z('desk', 'Studio tour', 'ph-microphone', 'desk', ['tourfm'], { use: 2 })],
    spawn: { x: -3.8, z: 2.45 },
    npcs: [S('Nana Ama (host)', ['desk', 0], LOOK.girl('#c8102e', '#151515')), S('Fiifi (co-host)', ['desk', 1], LOOK.boy('#f2c230', '#22313f')), N('Producer Edem', -2.8, -2.2, 0.6, LOOK.uncle('#1d3557', '#22313f'), 'work')],
    lights: warm([[-0.6, -0.8, 7], [2.6, -1.5]], '#fff1d6', 5) }),

  // ------------------------------------------------------------------ Accra Mall
  mall: V({ w: 12, d: 9, wallH: 3.2, floor: 'tiles', floorColor: '#eceae6', wallColor: '#f1f1ef', door: { wall: 'back', at: 0.283 },
    sign: { text: 'Accra Mall', bg: '#1d3557', fg: '#ffffff' },
    items: [I('shop_shelf:1.6', -4.6, -4.25, 0, { key: 'home', color: '#f7f1e3' }), I('sofa', -4.4, -2.6, 0, { color: '#2a9d8f', arg: 1.8 }), I('floor_lamp', -5.6, -2.6), I('floor_sign', -3.0, -1.7, 0.3, { label: 'SALE\n-30%', color: '#e63946' }),
      I('display_case:1.8', -0.2, -3.2, 0, { key: 'gadgets' }), I('shop_shelf:1.8', -0.2, -4.27, 0, { color: '#1d3557' }),
      I('clothes_rack', 2.9, -3.6, 0), I('mannequin', 4.2, -4.0, 0, { color: '#c8102e' }), I('mannequin', 4.9, -4.0, 0.2, { color: '#1f6fb8' }), I('mirror', 5.6, -4.5, 0),
      I('shared_door', -6, -1.2, HP, { key: 'wc', label: 'WASHROOM', color: '#1d3557' }), I('big_screen:2.4', -6, 2.2, HP, { screen: 'film' }), I('cinema_seats:4', -3.8, 2.2, -HP, { key: 'cinema' }), I('floor_sign', -3.4, 0.2, 0.6, { label: 'NOW\nSHOWING', color: '#151515' }),
      I('counter:2', 4.6, -0.6, -HP, { color: '#f77f00', label: 'FOOD COURT' }), I('bench_table', 2.4, 1.2, 0, { key: 'food', color: '#f77f00' }), I('bench_table', 2.4, 3.5, 0, { color: '#2a9d8f' }),
      I('plant', 0.6, 0.6, 0, { color: '#f2f2f2' }), I('plant', -1.4, 3.9, 0, { color: '#f2f2f2' }), I('plant', 5.5, 3.9, 0, { color: '#f2f2f2' })],
    zones: [Z('home', 'Shops', 'ph-shopping-bag', 'home', ['homestore', 'fashion', 'window']), Z('gadgets', 'Phones & gadgets', 'ph-device-mobile', 'gadgets', ['gadgets']), Z('cinema', 'Cinema', 'ph-film-strip', 'cinema', ['cinema']),
      Z('food', 'Food court', 'ph-hamburger', 'food', ['foodcourt']), Z('wc', 'Washroom', 'ph-toilet', 'wc', ['toilet'])],
    spawn: { x: -2.6, z: -3.6 },
    npcs: [N('Ruth (gadgets)', -0.2, -3.85, 0, LOOK.girl('#1d3557', '#151515'), 'work'), N('Chef Kojo', 5.4, -0.6, -HP, LOOK.boy('#f4f4f4', '#151515'), 'work'), N('Shopper', 1.3, -1.6, -2.2, LOOK.auntie('#e86a92', '#f7f1e3'))],
    lights: warm([[-3, -2], [2, -1], [2, 2.5], [-4, 2.2]], '#fff6e6', 5) }),

  // ------------------------------------------------------------------ University of Ghana, Legon
  ug: V({ w: 11, d: 9, floor: 'terrazzo', floorColor: '#d8cdb8', wallColor: '#f3e3b0', windows: [{ wall: 'back', at: 0.06, w: 0.9 }], door: { wall: 'left', at: 0.2 },
    sign: { text: 'University of Ghana', bg: '#1e3a8a', fg: '#fcd116' },
    items: [I('whiteboard:2.4', -5.5, -2.0, HP), I('lectern', -4.2, -2.0, HP), I('classroom_desk', -2.6, -2.8, HP, { key: 'lecture' }), I('classroom_desk', -2.6, -1.4, HP), I('classroom_desk', -1.1, -2.8, HP), I('classroom_desk', -1.1, -1.4, HP),
      I('library_shelf', 4.5, -4.25), I('reading_table', 3.0, -2.2, 0, { key: 'balme' }), I('bookshelf', 5.3, -1.6, -HP), I('floor_lamp', 1.6, -3.9),
      I('food_stall', 4.5, 1.7, -HP, { label: 'JOLLOF · KHEBAB', umbrella: '#e63946' }), I('bench_table', 2.0, 2.6, 0, { key: 'night', color: '#1e3a8a' }), I('bunting:4', 2.6, 1.1, 0), I('plant', -4.8, 3.9), I('plant', 0.2, -4.0)],
    zones: [Z('lecture', 'Lecture hall', 'ph-graduation-cap', 'lecture', ['lecture', 'tutor']), Z('balme', 'Balme Library', 'ph-books', 'balme', ['balme']), Z('night', 'Night market', 'ph-bowl-food', 'night', ['nightmarket'])],
    spawn: { x: -4.8, z: 2.7 },
    npcs: [N('Prof. Agyeman', -4.65, -2.0, HP, LOOK.uncle('#e9e2d0', '#3a2e22'), 'work'), S('Esi (student)', [5, 1], LOOK.girl('#e76f51', '#22313f')), N('Auntie Fausti', 5.1, 1.7, -HP, LOOK.auntie('#c8102e', '#f2b632'), 'work')],
    lights: warm([[-2, -2], [3, -2], [3, 2]], '#fff1d6', 5) }),

  // ------------------------------------------------------------------ Kotoka International Airport
  airport: V({ w: 12, d: 9, wallH: 3.2, floor: 'terrazzo', floorColor: '#e2ddd3', wallColor: '#e9eef2', door: { wall: 'left', at: 0.15 },
    sign: { text: 'Kotoka International Airport', bg: '#1d3557', fg: '#ffffff' },
    items: [I('runway_window:4', -6, -1.5, HP), I('airport_seats:5', -3.8, -1.5, -HP, { key: 'seats', color: '#2f6fd1' }), I('airport_seats:5', -2.3, -1.5, -HP, { color: '#2f6fd1' }),
      I('counter:2.4', 1.2, -3.2, 0, { key: 'checkin', color: '#1d3557', label: 'CHECK-IN' }), I('departure_board', 4.6, -4.25), I('suitcase', 3.4, -1.0, 0.4, { color: '#c8102e' }), I('suitcase', -0.8, 1.6, -0.3),
      I('shared_door', -3.0, -4.5, 0, { key: 'wc', label: 'TOILETS', color: '#1d3557' }), I('plant', -5.5, -4.0), I('plant', 5.5, 0.4), I('floor_sign', 2.4, -1.4, 0.3, { label: 'GATE 3\nKUMASI', color: '#1d3557' }), I('rope:2.4', 1.2, -1.9), I('bin', 5.6, -2.4)],
    zones: [Z('seats', 'Viewing deck', 'ph-airplane-landing', 'seats', ['planes']), Z('checkin', 'Check-in', 'ph-airplane-takeoff', 'checkin', ['kumasi']), Z('wc', 'Toilets', 'ph-toilet', 'wc', ['toilet'])],
    spawn: { x: -5.2, z: 3.15 },
    npcs: [N('Selorm (check-in)', 1.2, -3.9, 0, LOOK.girl('#1d3557', '#1d3557'), 'work'), N('Uncle Kwaku', 3.0, -0.5, -2.4, LOOK.uncle('#7b2d8e', '#3a2e22')), S('Traveller', ['seats', 3], L('f', '#2a9d8f', '#e9e2d0', 3))],
    lights: warm([[-3, -1.5], [2, -2], [2, 2]], '#fff6e6', 5) }),

  // ------------------------------------------------------------------ Labadi Beach Hotel
  hotel: V({ w: 12, d: 10, wallH: 3.2, floor: 'terrazzo', floorColor: '#efe7d8', wallColor: '#f5ead5', windows: [{ wall: 'left', at: 0.62, w: 1.4 }], door: { wall: 'back', at: 0.25 },
    sign: { text: 'Labadi Beach Hotel', bg: '#0f4c5c', fg: '#fcd116' },
    items: [I('pool:4.5,3', 2.6, -2.4, 0), I('sunbed', 1.0, 0.95, 0, { key: 'sun', color: '#0f4c5c' }), I('sunbed', 2.2, 0.95, 0, { color: '#0f4c5c' }), I('sunbed', 3.4, 0.95, 0, { color: '#0f4c5c' }),
      I('umbrella', 1.6, 0.3, 0, { color: '#0f4c5c' }), I('umbrella', 2.8, 0.3, 0, { color: '#f2c230' }), I('palm_tree', 5.5, -4.5, 0, { arg: 2.9 }), I('plant', 5.5, 0.6),
      I('reception_desk', -5.0, -3.0, HP, { key: 'desk', accent: '#0f4c5c' }), I('buffet_table', -1.2, -4.45, 0), I('banquet_table', -3.6, 2.6, 0, { key: 'wed' }), I('banquet_table', -0.9, 3.5, 0, { key: 'brunch', color: '#fdf6e3' }),
      I('mic_stand', -2.6, 0.6, 0.6, { key: 'mic' }), I('speaker', -5.6, -0.9, HP), I('shared_door', -6, 0.8, HP, { key: 'wc', label: 'WASHROOM', color: '#0f4c5c' }), I('bunting:4', -2.2, 1.2, 0, { colors: ['#ffffff', '#d9a93a'] }), I('plant', 0.4, -4.4)],
    zones: [Z('sun', 'Pool day', 'ph-swimming-pool', 'sun', ['pool']), Z('brunch', 'Sunday brunch', 'ph-fork-knife', 'brunch', ['brunch']), Z('desk', 'Reception', 'ph-bed', 'desk', ['room']), Z('mic', 'Wedding MC', 'ph-microphone-stage', 'mic', ['emcee']), Z('wc', 'Washroom', 'ph-toilet', 'wc', ['toilet'])],
    spawn: { x: -3.0, z: -4.2 },
    npcs: [N('Adwoa (reception)', -5.6, -3.0, HP, LOOK.girl('#0f4c5c', '#151515'), 'work'), N('Waiter Kofi', 0.4, 1.9, -2.4, L('m', '#ffffff', '#151515', 5)), S('Guest', [0, 1], L('m', '#e76f51', '#1f6fb8', 4), { pose: 'wade' })],
    lights: warm([[2.6, -2.4, 7], [-3, 2.5], [-4, -2]], '#fff1d6', 6) }),

  // ------------------------------------------------------------------ Accra Metropolitan Assembly
  ama: V({ w: 10, d: 8, floor: 'tiles', floorColor: '#d9d4c7', wallColor: '#e6ecef', windows: [{ wall: 'left', at: 0.6, w: 1.2 }], door: { wall: 'left', at: 0.15 },
    sign: { text: 'Accra Metro Assembly', bg: '#006b3f', fg: '#fcd116' },
    items: [I('lectern', 0.8, -3.0, 0), I('flag_pole:1.9', -0.4, -3.4), I('chair_row:6', 0.6, -1.4, PI, { key: 'hall', color: '#2f6fd1' }), I('chair_row:6', 0.6, -0.2, PI, { color: '#2f6fd1' }), I('chair_row:6', 0.6, 1.0, PI, { color: '#2f6fd1' }),
      I('voting_booth', 3.4, -3.45, 0, { key: 'vote' }), I('voting_booth', 4.45, -3.45, 0), I('ballot_box', 3.9, -1.6, 0), I('notice_board', -5, -2.0, HP), I('plant', -4.5, -3.5),I('wall_clock', -2.8, -4),
      I('poster', -5, 1.4, HP, { label: 'VOTE\nWISELY', color: '#006b3f' })],
    zones: [Z('vote', 'Ballot', 'ph-check-square', 'vote', ['vote']), Z('hall', 'Town hall', 'ph-users-three', 'hall', ['townhall'])],
    spawn: { x: -4.3, z: 2.8 },
    npcs: [N('Hon. Assemblyman', 0.8, -3.45, 0, LOOK.uncle('#e9e2d0', '#1d2433'), 'work'), N('EC Officer', 4.6, -1.1, -2.3, LOOK.auntie('#006b3f', '#1d2433')), S('Citizen', [4, 1], LOOK.boy('#f2c230', '#22313f'))],
    lights: warm([[-1, -1.5], [2, 0.5]], '#fff1d6', 5) }),

  // ------------------------------------------------------------------ Correct Cars showroom
  cars: V({ w: 12, d: 9, floor: 'tiles', floorColor: '#cfd3d6', wallColor: '#f2f2f0', windows: [{ wall: 'back', at: 0.06, w: 1.2 }, { wall: 'left', at: 0.42, w: 1.8 }, { wall: 'left', at: 0.72, w: 1.6 }], door: { wall: 'left', at: 0.12 },
    sign: { text: 'Correct Cars', bg: '#151515', fg: '#f2c230' },
    items: [I('car_display', -1.4, -2.8, 0, { key: 'show', color: '#c8102e' }), I('car_display', 2.8, -2.8, 0, { color: '#f2c230' }), I('car_display', 0.6, 1.2, -0.5, { color: '#1d4ed8' }),
      I('reception_desk', -4.6, 0.6, HP, { key: 'rent', accent: '#f2c230', top: '#151515' }), I('sofa', -1.6, 3.4, 0, { color: '#151515', arg: 2 }), I('plant', -3.0, 3.6), I('plant', 5.4, -3.9),
      I('floor_sign', 4.8, -0.6, -0.5, { label: 'RENT\n₵350/DAY', color: '#151515' }), I('bunting:6', 0.6, -1.0, 0, { colors: ['#c8102e', '#f2c230', '#1d4ed8'] }), I('doormat', -5.5, 3.4, HP)],
    zones: [Z('show', 'Showroom', 'ph-car-profile', 'show', ['showroom']), Z('rent', 'Rentals desk', 'ph-key', 'rent', ['rent'])],
    spawn: { x: -5.3, z: 3.4 },
    npcs: [N('Salesman Kojo', 0.9, -1.3, 0.8, L('m', '#f4f4f4', '#151515', 5), 'lean'), N('Akosua', -5.45, 0.6, HP, LOOK.girl('#f2c230', '#151515'), 'work')],
    lights: warm([[-1.4, -2], [2.8, -2], [0.6, 1.5]], '#fff6e6', 5) }),

  // ------------------------------------------------------------------ Blessed MoMo Agent (street kiosk)
  momo: V({ w: 7, d: 6, outdoor: true, floor: 'pavers',
    items: [I('momo_kiosk', -0.8, -1.9, 0, { key: 'kiosk' }), I('low_wall:7', 0, -2.88, 0, { color: '#e8dfc9', trim: '#1d4ed8' }), I('umbrella', 1.4, -1.0, 0, { color: '#ffcc00' }), I('chop_table', 1.7, 0.6, 0, { chair: '#ffcc00', cw: '#1d4ed8' }),
      I('wooden_bench', -2.95, 0.5, HP, { color: '#1d4ed8' }), I('lamp_post', 3.1, -2.4, PI), I('floor_sign', 0.6, -0.35, 0.2, { label: 'CASH\nOUT\nHERE', color: '#1d4ed8' }), I('cooler', 2.5, -2.3), I('plant', -2.9, -2.2), I('pure_water', -1.6, 2.2, 0.4)],
    zones: [Z('kiosk', 'MoMo agent', 'ph-money', 'kiosk', ['momo'])],
    spawn: { x: 2.4, z: 2.4 },
    npcs: [N('Agent Blessing', -0.8, -2.0, 0, LOOK.girl('#ffcc00', '#1d4ed8'), 'work'), S('Customer', [3, 1], LOOK.uncle('#e76f51', '#22313f'))],
    lights: warm([[-0.8, -1.5], [2, 0.5]]) }),
};

for (const [id,spec] of Object.entries(VENUES)) dressVenue(spec,id);
