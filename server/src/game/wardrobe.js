// Wardrobe: everything a character can wear. Prices in GH₵ (2026 Accra street/boutique prices).
// g: 'm' | 'f' | 'u' (unisex). price 0 = free starter item. shop: where it is sold ('thrift' Kantamanto, 'mall' Accra Mall, 'tailor').
// colors: palette the player can pick from (first = default). Uniforms are not sold; they appear automatically at work.
export const SKIN = { 1: '#f3cfb0', 2: '#e2b08a', 3: '#c68a5f', 4: '#a26a45', 5: '#7d4b2e', 6: '#5f3621', 7: '#472616', 8: '#33190d' };
export const HAIR_COLORS = ['#141010', '#3a2416', '#6b3e1f', '#b5651d', '#d9a441', '#8e1b1b', '#e8e2d6', '#6b2d8c'];
const C = { basic: ['#f4f4f2', '#17150f', '#c8102e', '#1f6fb8', '#0e7a4e', '#f2b632', '#7b2d8e', '#e76f51', '#8a9aa8', '#ff8fb1'],
  denim: ['#2b3a55', '#3d5a80', '#1d2433', '#7a8ea8', '#17150f'], earth: ['#c2a878', '#6b4f2f', '#2a5d3a', '#1d2433', '#e9e2d0', '#8a1c2b'],
  print: ['#e76f51', '#1f6fb8', '#0e7a4e', '#7b2d8e', '#f2b632', '#c8102e'], kente: ['#f2b632', '#0e7a4e', '#c8102e', '#1f6fb8'], jersey: ['#f4f4f2', '#c8102e', '#f2b632'],
  fugu: ['#1f3f8f', '#8a1c2b', '#2a5d3a', '#17150f'], gold: ['#d4a017'], shoe: ['#f4f4f2', '#17150f', '#c8102e', '#6b4f2f', '#f2b632'] };
export const WEAR = {
  // ---- tops ----
  tee: { slot: 'top', g: 'u', name: 'Plain tee', price: 0, colors: C.basic },
  flagtee: { slot: 'top', g: 'u', name: 'Ghana flag tee', price: 0, colors: ['#17150f', '#f4f4f2'] },
  singlet: { slot: 'top', g: 'm', name: 'Singlet', price: 0, colors: C.basic },
  crop: { slot: 'top', g: 'f', name: 'Crop top', price: 0, colors: C.basic },
  polo: { slot: 'top', g: 'u', name: 'Polo shirt', price: 150, colors: C.basic, shop: 'thrift' },
  hoodie: { slot: 'top', g: 'u', name: 'Hoodie', price: 300, colors: C.basic, shop: 'thrift' },
  jersey: { slot: 'top', g: 'u', name: 'Ghana 2026 · Home', price: 0, colors: ['#f4f4f2'], tag: 'Black Stars · 2026', shop: 'mall' },
  jerseyaway: { slot: 'top', g: 'u', name: 'Ghana 2026 · Away', price: 0, colors: ['#f2b632'], tag: 'Black Stars · 2026', shop: 'mall' },
  ankara: { slot: 'top', g: 'u', name: 'Ankara shirt', price: 350, colors: C.print, tag: 'Wax print', shop: 'tailor' },
  kenteshirt: { slot: 'top', g: 'u', name: 'Kente shirt', price: 800, colors: C.kente, tag: 'Bonwire weave', shop: 'tailor' },
  fugu: { slot: 'top', g: 'm', name: 'Fugu smock', price: 600, colors: C.fugu, tag: 'From the North', shop: 'tailor' },
  office: { slot: 'top', g: 'u', name: 'Office shirt & tie', price: 350, colors: ['#f4f4f2', '#cfe0f5', '#f6d6dc', '#e9e2d0'], shop: 'mall' },
  kaftan: { slot: 'top', g: 'm', name: 'Kaftan', price: 600, colors: C.earth, long: true, tag: 'Friday wear', shop: 'tailor' },
  suit: { slot: 'top', g: 'u', name: 'Tailored suit jacket', price: 2500, colors: ['#1d2433', '#17150f', '#5b6170', '#2a5d3a', '#8a1c2b', '#e9e2d0'], tag: 'Big man', shop: 'tailor' },
  kaba: { slot: 'top', g: 'f', name: 'Kaba blouse', price: 450, colors: C.print, tag: 'Sunday best', shop: 'tailor' },
  blouse: { slot: 'top', g: 'f', name: 'Office blouse', price: 280, colors: ['#f4f4f2', '#f6d6dc', '#cfe0f5', '#17150f'], shop: 'mall' },
  // ---- bottoms ----
  jeans: { slot: 'bottom', g: 'u', name: 'Jeans', price: 0, colors: C.denim },
  shorts: { slot: 'bottom', g: 'u', name: 'Shorts', price: 0, colors: [...C.denim, '#c2a878', '#17150f'] },
  joggers: { slot: 'bottom', g: 'u', name: 'Joggers', price: 120, colors: ['#17150f', '#5b6170', '#2a5d3a', '#1d2433'], shop: 'thrift' },
  chinos: { slot: 'bottom', g: 'u', name: 'Chinos', price: 220, colors: C.earth, shop: 'mall' },
  suitpants: { slot: 'bottom', g: 'u', name: 'Suit trousers', price: 600, colors: ['#1d2433', '#17150f', '#5b6170', '#e9e2d0'], shop: 'tailor' },
  ankarapants: { slot: 'bottom', g: 'u', name: 'Ankara trousers', price: 350, colors: C.print, shop: 'tailor' },
  slit: { slot: 'bottom', g: 'f', name: 'Ankara slit', price: 350, colors: C.print, skirt: 'long', tag: 'Kaba & slit', shop: 'tailor' },
  mini: { slot: 'bottom', g: 'f', name: 'Mini skirt', price: 0, colors: C.basic, skirt: 'mini' },
  pencil: { slot: 'bottom', g: 'f', name: 'Pencil skirt', price: 250, colors: ['#17150f', '#1d2433', '#8a1c2b', '#e9e2d0'], skirt: 'knee', shop: 'mall' },
  kenteskirt: { slot: 'bottom', g: 'f', name: 'Kente wrap skirt', price: 900, colors: C.kente, skirt: 'long', shop: 'tailor' },
  // ---- full outfits (replace top + bottom) ----
  sundress: { slot: 'full', g: 'f', name: 'Sundress', price: 0, colors: C.basic, skirt: 'knee' },
  ankaradress: { slot: 'full', g: 'f', name: 'Ankara dress', price: 700, colors: C.print, skirt: 'flare', shop: 'tailor' },
  kentedress: { slot: 'full', g: 'f', name: 'Kente gown', price: 3500, colors: C.kente, skirt: 'long', tag: 'Wedding guest', shop: 'tailor' },
  bodycon: { slot: 'full', g: 'f', name: 'Bodycon dress', price: 600, colors: ['#17150f', '#c8102e', '#f4f4f2', '#7b2d8e', '#d4a017'], skirt: 'knee', tag: 'Detty December', shop: 'mall' },
  kentecloth: { slot: 'full', g: 'm', name: 'Kente cloth', price: 6000, colors: C.kente, skirt: 'robe', tag: 'Ceremonial weave', shop: 'tailor' },
  // ---- shoes ----
  slides: { slot: 'shoes', g: 'u', name: 'Charlie wote', price: 0, colors: ['#17150f', '#1f6fb8', '#c8102e', '#f2b632'] },
  sneakers: { slot: 'shoes', g: 'u', name: 'Sneakers', price: 600, colors: C.shoe, shop: 'mall' },
  ahenema: { slot: 'shoes', g: 'u', name: 'Ahenema sandals', price: 350, colors: ['#6b4f2f', '#17150f', '#d4a017'], tag: 'Royal sandals', shop: 'tailor' },
  loafers: { slot: 'shoes', g: 'u', name: 'Loafers', price: 700, colors: ['#17150f', '#6b4f2f', '#8a1c2b'], shop: 'mall' },
  heels: { slot: 'shoes', g: 'f', name: 'Heels', price: 450, colors: ['#17150f', '#c8102e', '#d4a017', '#f4f4f2'], shop: 'mall' },
  boots: { slot: 'shoes', g: 'u', name: 'Boots', price: 650, colors: ['#17150f', '#6b4f2f'], shop: 'mall' },
  // ---- hair (styles are free at the barber; wigs cost money) ----
  lowcut: { slot: 'hair', g: 'u', name: 'Low cut', price: 0 }, fade: { slot: 'hair', g: 'u', name: 'Skin fade', price: 0 }, waves: { slot: 'hair', g: 'm', name: '360 waves', price: 0 },
  afro: { slot: 'hair', g: 'u', name: 'Afro', price: 0 }, twists: { slot: 'hair', g: 'u', name: 'Twists', price: 0 }, locs: { slot: 'hair', g: 'u', name: 'Dreadlocks', price: 0 },
  cornrows: { slot: 'hair', g: 'u', name: 'Cornrows', price: 0 }, bald: { slot: 'hair', g: 'u', name: 'Clean shave', price: 0 },
  puff: { slot: 'hair', g: 'f', name: 'Afro puff', price: 0 }, bun: { slot: 'hair', g: 'f', name: 'Bun', price: 0 }, twa: { slot: 'hair', g: 'f', name: 'Short natural', price: 0 },
  braids: { slot: 'hair', g: 'f', name: 'Knotless braids', price: 600, tag: 'No 8-hour sitting', shop: 'mall' }, bob: { slot: 'hair', g: 'f', name: 'Bob wig', price: 900, shop: 'mall' },
  bonestraight: { slot: 'hair', g: 'f', name: 'Bone straight wig', price: 2500, tag: 'Long straight hair', shop: 'mall' }, duku: { slot: 'hair', g: 'f', name: 'Duku headwrap', price: 150, tag: 'Sunday service', shop: 'tailor' },
  // ---- face & extras ----
  nobeard: { slot: 'beard', g: 'm', name: 'Clean', price: 0 }, stubble: { slot: 'beard', g: 'm', name: 'Stubble', price: 0 }, goatee: { slot: 'beard', g: 'm', name: 'Goatee', price: 0 }, fullbeard: { slot: 'beard', g: 'm', name: 'Full beard', price: 0 },
  nohat: { slot: 'hat', g: 'u', name: 'No hat', price: 0 }, cap: { slot: 'hat', g: 'u', name: 'Snapback', price: 100, colors: C.basic, shop: 'thrift' }, bucket: { slot: 'hat', g: 'u', name: 'Bucket hat', price: 120, colors: C.basic, shop: 'thrift' }, kufi: { slot: 'hat', g: 'm', name: 'Kufi', price: 80, colors: ['#f4f4f2', '#17150f', '#2a5d3a'], shop: 'tailor' },
  noglasses: { slot: 'glasses', g: 'u', name: 'None', price: 0 }, shades: { slot: 'glasses', g: 'u', name: 'Shades', price: 150, shop: 'thrift' }, specs: { slot: 'glasses', g: 'u', name: 'Specs', price: 250, shop: 'mall' },
  nochain: { slot: 'neck', g: 'u', name: 'None', price: 0 }, chain: { slot: 'neck', g: 'u', name: 'Gold chain', price: 4000, tag: 'Big man ting', shop: 'mall' }, beads: { slot: 'neck', g: 'u', name: 'Waist & neck beads', price: 120, shop: 'thrift' }, stole: { slot: 'neck', g: 'u', name: 'Kente stole', price: 350, colors: C.kente, tag: 'Graduation', shop: 'tailor' },
};
// work uniforms by career (shown automatically during a shift)
export const UNIFORM = {
  police: { top: ['office', '#2b4a7a'], bottom: ['suitpants', '#1d2433'], shoes: ['boots', '#17150f'], hat: ['cap', '#1d2433'] },
  nurse: { full: ['sundress', '#f4f4f2'], shoes: ['sneakers', '#f4f4f2'] }, doctor: { top: ['suit', '#f4f4f2'], bottom: ['chinos', '#1d2433'] },
  chef: { top: ['office', '#f4f4f2'], bottom: ['joggers', '#17150f'], hat: ['kufi', '#f4f4f2'] }, bank: { top: ['suit', '#1d2433'], bottom: ['suitpants', '#1d2433'], shoes: ['loafers', '#17150f'] },
  civil: { top: ['office', '#cfe0f5'], bottom: ['chinos', '#1d2433'] }, tech: { top: ['hoodie', '#17150f'], bottom: ['jeans', '#2b3a55'], shoes: ['sneakers', '#f4f4f2'] },
  trotro: { top: ['jersey', '#f2b632'], bottom: ['shorts', '#2b3a55'], shoes: ['slides', '#17150f'] }, ride: { top: ['polo', '#0e7a4e'], bottom: ['jeans', '#2b3a55'] },
  hotel: { top: ['suit', '#8a1c2b'], bottom: ['suitpants', '#17150f'] }, aviation: { top: ['office', '#f4f4f2'], bottom: ['suitpants', '#1d2433'], hat: ['cap', '#1d2433'] },
  boxer: { top: ['singlet', '#c8102e'], bottom: ['shorts', '#17150f'], shoes: ['boots', '#c8102e'] }, fisher: { top: ['singlet', '#f2b632'], bottom: ['shorts', '#2b3a55'], shoes: ['slides', '#17150f'] },
  pastor: { top: ['suit', '#17150f'], bottom: ['suitpants', '#17150f'], shoes: ['loafers', '#17150f'] }, radio: { top: ['polo', '#c8102e'] }, dj: { top: ['hoodie', '#7b2d8e'], hat: ['cap', '#17150f'], glasses: ['shades'] },
  teacher: { top: ['office', '#e9e2d0'], bottom: ['chinos', '#6b4f2f'] }, trader: { top: ['ankara', '#e76f51'] }, fashion: { top: ['kaba', '#7b2d8e'] }, doctorF: null,
};
export const DEFAULT_LOOK = {
  m: { body: 'm', skin: 5, hair: 'lowcut', hairCol: '#141010', beard: 'nobeard', top: 'tee', topCol: '#f4f4f2', bottom: 'jeans', bottomCol: '#2b3a55', shoes: 'slides', shoesCol: '#17150f', hat: 'nohat', glasses: 'noglasses', neck: 'nochain' },
  f: { body: 'f', skin: 5, hair: 'puff', hairCol: '#141010', beard: 'nobeard', top: 'crop', topCol: '#f2b632', bottom: 'jeans', bottomCol: '#2b3a55', shoes: 'slides', shoesCol: '#17150f', hat: 'nohat', glasses: 'noglasses', neck: 'nochain' },
};
const HEX = /^#[0-9a-f]{6}$/i;
// validate a look against the catalog and what the player owns. Unknown or unowned items fall back to defaults.
export function cleanLook(l, owned = {}) {
  l = l && typeof l === 'object' ? l : {}; const body = l.body === 'f' ? 'f' : 'm'; const out = { ...DEFAULT_LOOK[body] };
  out.skin = Math.max(1, Math.min(8, (l.skin ?? l.skinTone ?? 5) | 0));
  for (const key of ['build', 'hips', 'bust', 'height','waist','shoulders','muscle','faceWidth','nose','lips']) { const v = l[key]; out[key] = typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(0, Math.min(1, v)) * 20) / 20 : key === 'bust' ? .45 : .5; }
  if (HEX.test(l.hairCol || '')) out.hairCol = l.hairCol;
  for (const slot of ['hair', 'beard', 'top', 'bottom', 'full', 'shoes', 'hat', 'glasses', 'neck']) {
    const id = l[slot]; const W = WEAR[id]; if (!W || W.slot !== slot || (W.g !== 'u' && W.g !== body)) { if (slot === 'full') delete out.full; continue; }
    if (W.price > 0 && !owned[id]) continue;
    out[slot] = id; const col = l[slot + 'Col']; if (W.colors) out[slot + 'Col'] = W.colors.includes(col) ? col : W.colors[0];
  }
  if (body === 'f') out.beard = 'nobeard';
  return out;
}
