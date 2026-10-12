// Player homes (HOMES in server/src/game/data.js) as Room specs that react to owned items (ITEMS in rules.js).
//   homeSpec(homeId, items) → Room spec + { zones, spawn, npcs: [] } in the same format as venues.js.
//   items: map of owned item keys → truthy (gas, fridge, tv, laptop, dslr, speaker, guitar, dumbbells, bed, ac, gen, solar, ring)
// HOME_ACTS → zones: sleep/nap → bed (lie) · bath → bucket shower / shower (or the compound bathhouse door) ·
// toilet → toilet (or compound door) · cook → gas cooker (coal pot without gas) · tv → seat facing the TV (if tv) ·
// code → laptop desk (if laptop) · guitar → guitar stand stool (if guitar) · workout → dumbbells (if dumbbells).
import { addDado } from './venues.js';

const PI = Math.PI, HP = PI / 2;
const I = (kind, x, z, rot = 0, o = {}) => ({ kind, x, z, rot, ...o });
const Z = (id, label, icon, key, acts, o = {}) => ({ id, label, icon, key, acts, ...o });
export const HOME_ZONES_ORDER = ['bed', 'bath', 'wc', 'cook', 'tv', 'desk', 'guitar', 'gym'];
const ICON = { bed: 'ph-bed', bath: 'ph-shower', wc: 'ph-toilet', cook: 'ph-cooking-pot', tv: 'ph-television', desk: 'ph-laptop', guitar: 'ph-guitar', gym: 'ph-barbell' };

function finish(spec, o) {
  const items = spec.items.filter(Boolean); spec.items = items;
  const idx = new Map(); items.forEach((it, i) => it.key && idx.set(it.key, i));
  const z = [];
  const add = (id, label, key, acts, extra) => { if (idx.has(key)) z.push({ ...Z(id, label, ICON[id], key, acts, extra), item: idx.get(key) }); };
  add('bed', 'Bed', 'bed', ['sleep', 'nap']);
  if (spec.shared) add('bath', 'Compound bath & WC', 'wc', ['bath', 'toilet']);
  else { add('bath', 'Bath', 'bath', ['bath']); add('wc', 'Toilet', 'wc', ['toilet']); }
  add('cook', o.gas ? 'Gas cooker' : 'Coal pot', 'cook', ['cook']);
  if (o.tv) add('tv', 'TV', 'tvseat', ['tv']);
  if (o.laptop) add('desk', 'Laptop desk', 'desk', ['code']);
  if (o.guitar) add('guitar', 'Guitar', 'guitar', ['guitar']);
  if (o.dumbbells) add('gym', 'Workout', 'gym', ['workout']);
  spec.zones = z.map(({ key, ...r }) => r).sort((a, b) => HOME_ZONES_ORDER.indexOf(a.id) - HOME_ZONES_ORDER.indexOf(b.id));
  spec.npcs = [];
  delete spec.shared; addDado(spec);
  return spec;
}

// --- single rooms (Nima / Jamestown): cramped, mattress on the floor, compound bath & toilet through a door
function single(o, f) {
  const w = 5.5, d = 5;
  return finish({ w, d, floor: f.floor, floorColor: f.floorColor, wallColor: f.wall, dado: f.dado, shared: true,
    windows: [{ wall: 'left', at: 0.45, w: 1.1 }], door: { wall: 'back', at: 0.5 },
    items: [o.bed ? I('bed', -1.82, -1.4, 0, { key: 'bed', sheet: f.sheet }) : I('mattress', -1.9, -1.45, 0, { key: 'bed', color: f.sheet }),
      f.jt ? I('barrel', -2.38, 0.1, 0, { color: '#2f6fd1' }) : I('chest', -2.28, 0.1, HP),
      I('window_curtain', -2.75, 0.25, HP, { arg: 1.1, color: f.curtain }), I('shared_door', -2.75, 1.75, HP, { key: 'wc', label: 'BATH · WC', color: f.door }),
      I('bucket', -2.35, 0.95, 0, { color: '#2f6fd1' }), I('plastic_chair', 1.45, -0.75, PI, { key: 'tvseat', color: f.chair }), I('standing_fan', -0.45, -0.55, -0.8),
      o.laptop ? I('laptop_desk', 0.3, 0.95, PI, { key: 'desk' }) : I('plastic_table', 0.3, 0.6, 0, { color: f.chair }),
      I('picture', -0.95, -2.5, 0, { arg: 0.45 }), I('calendar', -2.75, -1.3, HP), I('doormat', 0, -2.2, 0), f.jt ? I('fishing_net', 1.4, 2.1, 0.2) : I('jerrycans', 1.2, 2.25, 0),
      o.tv ? I('tv', 1.45, -2.25, 0, { color: '#6f4a2e' }) : I('wall_shelf', 1.45, -2.5, 0),
      I(o.gas ? 'gas_cooker' : 'coal_pot', 2.2, 1.75, -HP, { key: 'cook' }),
      o.fridge && I('fridge', 2.4, 0.3, -HP), o.speaker && I('speaker', 2.45, -1.9, -HP), o.gen && I('generator', 2.4, -1.05, -HP),
      o.guitar && I('guitar_stand', -0.7, 2.0, 0, { key: 'guitar' }), o.dumbbells && I('dumbbells:1', 0.95, 2.25, PI, { key: 'gym' }), o.ac && I('ac', -1.8, -2.5, 0)],
    spawn: { x: 0, z: -1.8 } }, o);
}

const HOMES = {
  nima: (o) => single(o, { floor: 'lino', floorColor: '#b5835a', wall: '#cfe3d4', dado: '#5f8f78', sheet: '#1f6fb8', curtain: '#c8102e', door: '#2a6f97', chair: '#c8102e' }),
  jtown: (o) => single(o, { floor: 'concrete', floorColor: '#a39d90', wall: '#bfd9ea', dado: '#3d6f9e', sheet: '#e76f51', curtain: '#f2b632', door: '#8c3b2a', chair: '#2f6fd1', jt: true }),

  // --- chamber & hall (Kaneshie): bed + wardrobe in the chamber, sofa & TV in the hall, compound bath/toilet
  kaneshie: (o) => finish({ w: 7, d: 5.5, floor: 'lino', floorColor: '#c08f5f', wallColor: '#f3d0d6', dado: '#a8586b', shared: true,
    windows: [{ wall: 'left', at: 0.75, w: 1.1 }], door: { wall: 'back', at: 0.93 },
    items: [o.bed ? I('bed', -2.42, -1.66, 0, { key: 'bed', sheet: '#2a9d8f' }) : I('mattress', -2.4, -1.65, 0, { key: 'bed', color: '#7b2d8e' }), I('wardrobe', -0.9, -2.42, 0, { color: '#8a5a36' }),
      I('window_curtain', -3.5, -1.375, HP, { arg: 1.1, color: '#1f6fb8' }), I('shared_door', -3.5, 0.4, HP, { key: 'wc', label: 'BATH · WC', color: '#8c3b2a' }),
      o.tv ? I('tv', 1.5, -2.5, 0) : I('wall_shelf', 1.5, -2.75, 0), I('rug', 1.5, -0.8, 0, { dims: [2.2, 1.5], k: 0 }), I('coffee_table', 1.5, -0.85, 0), I('sofa', 1.5, 0.6, PI, { key: 'tvseat', color: '#b5543a', arg: 2.0 }),
      I('plastic_chair', 3.0, -0.95, -HP, { color: '#f2f0e6' }), I('standing_fan', 0.0, -1.2, -0.6), I('picture', -3.5, -0.4, HP, { arg: 0.45 }), I('calendar', 0.25, -2.75, 0), I('doormat', 3.0, -2.35, 0),
      I(o.gas ? 'gas_cooker' : 'coal_pot', -2.95, 2.0, HP, { key: 'cook' }), I('bucket', -3.1, 1.05, 0),
      o.laptop ? I('laptop_desk', -0.6, 1.7, PI, { key: 'desk' }) : I('plastic_table', -0.6, 1.8, 0),
      o.fridge && I('fridge', 3.1, -1.9, -HP), o.speaker && I('speaker', 3.15, 0.5, -HP), o.gen && I('generator', 3.1, 2.3, -HP), o.ac && I('ac', 0.35, -2.75, 0),
      o.guitar && I('guitar_stand', 0.9, 2.3, 0, { key: 'guitar' }), o.dumbbells && I('dumbbells:1', 2.2, 2.4, PI, { key: 'gym' }), I('plant', 3.15, 1.4)],
    spawn: { x: 3.0, z: -2.0 } }, o),

  // --- self-contain (La): own shower + toilet behind a tiled half wall, small kitchen corner
  labadi: (o) => finish({ w: 7, d: 6, floor: 'tiles', floorColor: '#d9c4a0', wallColor: '#f3e3b0', dado: '#b98c3e',
    windows: [{ wall: 'back', at: 0.25, w: 0.8 }], door: { wall: 'left', at: 0.2 },
    items: [I('shower', -2.95, -2.45, 0, { key: 'bath', color: '#bfe3ef' }), I('toilet', -1.75, -2.62, 0, { key: 'wc' }), I('half_wall:1.6', -1.15, -2.2, HP, { color: '#bfe3ef' }), I('bucket', -2.2, -1.75, 0, { color: '#e63946' }),
      I('bed', 2.4, -1.9, 0, { key: 'bed', sheet: o.bed ? '#1d3557' : '#7b2d8e' }), I('wardrobe', 0.4, -2.67, 0), I('plant', 3.25, -0.5),
      o.tv ? I('tv', -3.25, 0.4, HP) : I('wall_shelf', -3.5, 0.4, HP), I('coffee_table', -2.1, 0.4, HP), I('sofa', -1.0, 0.4, -HP, { key: 'tvseat', color: '#2a9d8f', arg: 1.8 }), I('rug', -2.0, 0.4, HP, { dims: [2, 1.6], k: 1 }),
      I('kitchen_counter:1.2', 2.9, 1.2, -HP, { color: '#e9c46a' }), I(o.gas ? 'gas_cooker' : 'coal_pot', 2.95, 2.35, -HP, { key: 'cook' }),
      o.fridge ? I('fridge', 2.95, -0.25, -HP) : I('cooler', 3.0, -0.25, -HP), o.speaker && I('speaker', -3.15, -0.95, HP), o.gen && I('generator', 1.9, 2.6, 0), o.ac && I('ac', 2.4, -3, 0),
      o.laptop ? I('laptop_desk', 0.6, 2.2, PI, { key: 'desk' }) : I('plastic_table', 0.6, 2.2, 0), o.guitar && I('guitar_stand', -1.0, 2.55, 0, { key: 'guitar' }), o.dumbbells && I('dumbbells:1', 1.9, 0.3, 0, { key: 'gym' }),
      I('plant', -3.1, 2.75), I('window_curtain', -1.75, -3, 0, { arg: 0.8, color: '#2a9d8f' }), I('picture', -3.5, -0.9, HP, { arg: 0.4 })],
    spawn: { x: -2.9, z: 1.8 } }, o),

  // --- 1-bed apartment (Osu): wood floor, living room with rug, dining, fitted kitchen, AC, bathroom nook
  osu: (o) => finish({ w: 8, d: 7, floor: 'wood', floorColor: '#b98a5c', wallColor: '#cde3ef', dado: '#5d86a8',
    windows: [{ wall: 'back', at: 0.4625, w: 1.2 }, { wall: 'left', at: 0.6, w: 1.0 }], door: { wall: 'left', at: 0.12 },
    items: [I('half_wall:1.9', -1.9, -2.55, HP), I('shower', -3.45, -2.95, 0, { key: 'bath' }), I('toilet', -2.4, -3.1, 0, { key: 'wc' }), I('mirror', -4, -2.0, HP),
      I('bed', 2.9, -2.4, 0, { key: 'bed', color: '#4a3324', sheet: '#c8102e' }), I('wardrobe', 1.05, -3.17, 0, { color: '#e8dcc0' }), I('ac', 2.9, -3.5, 0), I('plant', 3.75, -0.9),
      o.tv ? I('tv', -3.75, 0.5, HP, { color: '#2b2f36' }) : I('bookshelf', -3.82, 0.5, HP), I('rug', -2.75, 0.5, HP, { dims: [2.4, 2.0], k: 2 }), I('coffee_table', -2.75, 0.5, HP), I('sofa', -1.5, 0.5, -HP, { key: 'tvseat', color: '#e76f51', arg: 2.2 }),
      I('armchair', -2.75, -1.2, 0, { color: '#2a9d8f' }), I('floor_lamp', -3.6, 2.0),
      I('kitchen_counter:1.8', 3.65, 0.6, -HP, { color: '#8fbfa6' }), I(o.gas ? 'gas_cooker' : 'coal_pot', 3.7, 2.3, -HP, { key: 'cook' }), o.fridge ? I('fridge', 3.62, -0.75, -HP) : I('water_dispenser', 3.75, -0.75, -HP),
      I('dining_table', 1.4, 1.0, 0, { color: '#8a5a36' }),
      o.laptop ? I('laptop_desk', -0.2, 2.6, PI, { key: 'desk' }) : I('plant', -0.2, 3.0), o.guitar && I('guitar_stand', 1.2, 3.0, 0, { key: 'guitar' }), o.dumbbells && I('dumbbells:1', 2.6, 3.1, PI, { key: 'gym' }),
      o.speaker && I('speaker', -3.7, -0.65, HP), o.gen && I('generator', 0.0, -3.15, 0), I('picture', -0.5, -3.5, 0, { arg: 0.4, screen: 'show' })],
    spawn: { x: -3.4, z: 2.66 } }, o),

  // --- 2-bed flat (Airport Residential): marble tiles, big screen, L-ish lounge, fitted kitchen
  airres: (o) => finish({ w: 9, d: 8, floor: 'tiles', floorColor: '#e6e1d8', wallColor: '#e8efe6', dado: '#7f9f88',
    windows: [{ wall: 'back', at: 0.45, w: 1.2 }, { wall: 'left', at: 0.62, w: 1.0 }], door: { wall: 'left', at: 0.1 },
    items: [I('half_wall:2.2', -1.6, -2.9, HP), I('shower', -3.95, -3.45, 0, { key: 'bath' }), I('toilet', -2.6, -3.6, 0, { key: 'wc' }), I('mirror', -4.5, -2.4, HP),
      I('bed', 2.9, -2.9, 0, { key: 'bed', color: '#2b2f36', sheet: '#1d3557' }), I('wardrobe', 1.1, -3.67, 0, { color: '#f2efe8' }), I('plant', 4.1, -1.4), I('ac', 2.9, -4, 0),
      o.tv ? I('big_screen:2', -4.5, 0.7, HP, { screen: 'film' }) : I('bookshelf', -4.32, 0.7, HP), I('rug', -3.0, 0.7, HP, { dims: [2.4, 2.2], k: 0 }), I('coffee_table', -3.0, 0.7, HP), I('sofa', -1.6, 0.7, -HP, { key: 'tvseat', color: '#1d3557', arg: 2.4 }),
      I('armchair', -3.0, 2.6, PI, { color: '#e9c46a' }), I('dining_table', 1.4, 0.2, 0, { color: '#2b2f36', chair: '#e8dcc0' }),
      I('kitchen_counter:2.4', 4.17, 0.6, -HP, { color: '#f2efe8' }), I('sink_counter', 4.17, 2.5, -HP), I(o.gas ? 'gas_cooker' : 'coal_pot', 4.2, -1.2, -HP, { key: 'cook' }), o.fridge && I('fridge', 4.15, 3.55, -HP),
      o.laptop ? I('laptop_desk', 0.2, 2.8, PI, { key: 'desk' }) : I('plant', 0.2, 3.3), o.guitar && I('guitar_stand', 1.9, 3.3, 0, { key: 'guitar' }), o.dumbbells && I('dumbbells', -0.1, -1.6, 0, { key: 'gym' }),
      o.speaker && I('speaker', -1.2, -1.35, 0), o.gen && I('generator', -0.2, -3.65, 0), I('floor_lamp', -4.1, 2.2), I('picture', 1.1, -4, 0, { arg: 0.5 })],
    spawn: { x: -3.9, z: 3.2 } }, o),

  // --- family house (East Legon): dark wood floor, big lounge, 6-seat feel, island kitchen, master bed
  legon: (o) => finish({ w: 10, d: 9, floor: 'wood', floorColor: '#8a5a3a', wallColor: '#f4ecdc', dado: '#9c7a52',
    windows: [{ wall: 'back', at: 0.38, w: 1.2 }, { wall: 'left', at: 0.55, w: 1.0 }], door: { wall: 'left', at: 0.08 },
    items: [I('half_wall:2.6', -2.4, -3.2, HP, { color: '#e8dcc0' }), I('shower', -4.45, -3.95, 0, { key: 'bath', color: '#efe6d2' }), I('toilet', -3.2, -4.1, 0, { key: 'wc' }), I('mirror', -5, -2.6, HP, { color: '#d9a93a' }), I('plant', -2.9, -2.2),
      I('bed', 3.5, -3.4, 0, { key: 'bed', color: '#3b2a1f', sheet: '#7b2d8e' }), I('wardrobe', 1.6, -4.17, 0, { color: '#6f4a2e' }), I('bookshelf', 0.0, -4.32), I('floor_lamp', 4.65, -1.9), I('ac', 3.5, -4.5, 0),
      o.tv ? I('big_screen:2.4', -5, 0.9, HP, { screen: 'match' }) : I('bookshelf', -4.82, 0.9, HP), I('rug', -3.4, 0.9, HP, { dims: [2.8, 2.4], k: 1 }), I('coffee_table', -3.4, 0.9, HP), I('sofa', -1.8, 0.9, -HP, { key: 'tvseat', color: '#6b2fa0', arg: 2.6 }),
      I('armchair', -3.4, -0.9, 0, { color: '#d9a93a' }), I('armchair', -3.4, 2.75, PI, { color: '#d9a93a' }), I('dining_table', 0.9, 0.0, 0, { color: '#3b2a1f', chair: '#d9a93a' }),
      I('kitchen_counter:2.4', 4.67, 0.4, -HP, { color: '#2b2f36' }), I('sink_counter', 4.67, 2.3, -HP, { color: '#2b2f36' }), I(o.gas ? 'gas_cooker' : 'coal_pot', 4.7, -1.4, -HP, { key: 'cook' }), o.fridge && I('fridge', 4.65, 3.6, -HP, { color: '#c9ccd0' }),
      o.laptop ? I('laptop_desk', 0.6, 3.0, PI, { key: 'desk' }) : I('plant', 0.6, 3.5), o.guitar && I('guitar_stand', 2.3, 3.6, 0, { key: 'guitar' }), o.dumbbells && I('dumbbells', 2.6, 1.9, 0, { key: 'gym' }),
      o.speaker && I('speaker', -4.65, -1.0, HP), o.gen && I('generator', 3.4, -1.4, 0), I('plant', -4.5, 3.0), I('picture', -5, -0.3, HP, { arg: 0.6 }), I('picture', 3.4, -4.5, 0, { arg: 0.5, screen: 'show' })],
    spawn: { x: -4.4, z: 3.78 } }, o),

  // --- villa (Trasacco Valley): marble, pool & sunbeds in the room, bar, huge screen
  trasacco: (o) => finish({ w: 12, d: 10, wallH: 3.0, floor: 'terrazzo', floorColor: '#f1ece2', wallColor: '#f7f3ea', dado: '#c9b48a',
    windows: [{ wall: 'back', at: 0.42, w: 1.2 }, { wall: 'left', at: 0.62, w: 1.2 }], door: { wall: 'left', at: 0.12 },
    items: [I('half_wall:2.8', -3.2, -3.6, HP, { color: '#e9e2d0' }), I('shower', -5.45, -4.45, 0, { key: 'bath', color: '#efe6d2' }), I('toilet', -4.2, -4.6, 0, { key: 'wc' }), I('sink_counter', -4.4, -2.75, 0), I('mirror', -6, -3.2, HP, { color: '#d9a93a' }),
      I('bed', 4.6, -3.9, 0, { key: 'bed', color: '#2b2f36', sheet: '#0f4c5c' }), I('floor_lamp', 5.6, -2.5), I('plant', 3.4, -4.6), I('ac', 4.6, -5, 0),
      o.tv ? I('big_screen:2.8', -0.6, -4.8, 0, { screen: 'film' }) : I('bookshelf', -0.6, -4.82), I('rug', -0.6, -3.0, 0, { dims: [3.2, 1.8], k: 2 }), I('coffee_table', -0.6, -3.1, 0), I('sofa', -0.6, -1.8, PI, { key: 'tvseat', color: '#f2efe8', arg: 3.0 }),
      I('armchair', 1.7, -3.4, -HP, { color: '#0f4c5c' }), I('dining_table', 1.8, -0.4, 0, { color: '#f2efe8', chair: '#2b2f36' }),
      I('bar_counter:2.4', -4.9, 1.2, HP, { stool: '#d9a93a' }), I('bottle_shelf:1.8', -5.8, 1.2, HP),
      I('kitchen_counter:2.4', 5.67, -1.0, -HP, { color: '#2b2f36' }), I(o.gas ? 'gas_cooker' : 'coal_pot', 5.7, 0.8, -HP, { key: 'cook' }), o.fridge && I('fridge', 5.65, 1.85, -HP, { color: '#c9ccd0' }),
      I('pool:4,2.6', 3.0, 2.8, 0), I('sunbed', 0.0, 3.2, 0, { color: '#0f4c5c' }), I('umbrella', 0.2, 2.0, 0, { color: '#0f4c5c' }), I('palm_tree', -2.4, 4.5, 0, { arg: 2.6 }),
      o.laptop ? I('laptop_desk', -2.2, 1.6, PI, { key: 'desk' }) : I('plant', -2.2, 1.6), o.guitar && I('guitar_stand', -1.4, 3.9, 0, { key: 'guitar' }), o.dumbbells && I('dumbbells', -2.9, 3.6, 0, { key: 'gym' }),
      o.speaker && I('speaker', -2.7, -1.0, 0), o.gen && I('generator', 2.7, -4.6, 0), I('plant', 5.5, 4.4), I('floor_lamp', -5.5, -1.2), I('picture', -6, -0.4, HP, { arg: 0.6, screen: 'film' })],
    spawn: { x: -5.4, z: 3.8 } }, o),
};

export const HOME_IDS = Object.keys(HOMES);
export function homeSpec(homeId, items = {}) {
  const f = HOMES[homeId] || HOMES.nima; const own = {}; for (const k in items || {}) if (items[k]) own[k] = true;
  return f(own);
}
