import { inPolygon } from './geography.js';
import { tree } from './kit.js';

const SPECIAL = new Set(['blackstar', 'memorial', 'lighthouse', 'circle', 'makola', 'kantamanto', 'stadium', 'ug', 'airport', 'mall', 'castle', 'hotel', 'mosque', 'church', 'bukom']);
export function landmarkInventory(cat, data, districts) {
  const items = [...cat.locs.map(l => ({ ...l })), ...Object.entries(cat.homes).map(([id, h]) => ({ ...h, id: `h:${id}`, home: true }))];
  for (const l of items) {
    l.saved = [l.x, l.z]; l.r = SPECIAL.has(l.id) ? (l.id === 'airport' ? 180 : 95) : l.home ? 34 : 23;
    // A few legacy game anchors are approximate. Keep saved/travel coordinates;
    // move only their drawn miniature inland if a sourced water polygon covers it.
    const wet = (x, z) => [...data.sea, ...data.water.map(w => w.rings)].some(rings => inPolygon(x, z, rings));
    if (wet(l.x, l.z)) { let found = false; for (let d = 40; d <= 600 && !found; d += 40) for (const dx of [0, -d, d]) if (!wet(l.x + dx, l.z - d)) { l.x += dx; l.z -= d; found = true; break; } }
    l.shift = [l.x - l.saved[0], l.z - l.saved[1]];
  }
  const terminal=data.features.find(f=>f.osm===666646523),tema=districts.find(d=>d.id==='tema-industrial');
  if(tema){const p=terminal?terminal.p.reduce((q,p)=>[q[0]+p[0]/terminal.p.length,q[1]+p[1]/terminal.p.length],[0,0]):[tema.x,tema.z];items.push({id:'decor:tema-port',name:'Tema port silhouette',x:p[0],z:p[1],r:450,decorative:true,source:terminal?'OSM Tema Container Terminal way666646523 centroid':'Port district art approximation'});}
  return items;
}
export function buildLandmarks(kit, items) {
  const parts = kit.batch();
  for (const l of items) {
    if (/^[ne]:/.test(l.id)) continue;
    const box = (x, y, z, w, h, d, color = '#dfd8c3', angle = 0) => parts.box(l.x + x, y, l.z + z, w, h, d, color, angle);
    const cyl = (x, y, z, w, h, color) => parts.add('cylinder', l.x + x, y + h / 2, l.z + z, w, h, w, color);
    const palm = (x, z) => tree(parts, l.x + x, l.z + z, 25, .4);
    switch (l.id) {
      case 'blackstar':
        box(0, 0, 0, 140, 1, 110, '#d1c6ad'); box(-28, 0, 0, 15, 66, 22); box(28, 0, 0, 15, 66, 22); box(0, 51, 0, 72, 15, 25);
        parts.add('star',l.x,77,l.z,26,26,8,'#394c45');
        for (const x of [-60, 60]) palm(x, 40); break;
      case 'memorial':
        box(0, 0, 0, 130, 1.5, 130, '#9aaf85'); box(0, 2, 0, 72, 3, 72); box(0, 5, 0, 24, 8, 24, '#638d93');
        for (const x of [-1, 1]) for (const z of [-1, 1]) { box(x * 19, 4, z * 19, 10, 42, 10); box(x * 11, 42, z * 11, 12, 15, 12); } cyl(0, 8, 0, 6, 29, '#9a8251');
        for (const x of [-50, 50]) { palm(x, 40); palm(x, -40); } break;
      case 'lighthouse':
        cyl(0, 0, 0, 25, 22, '#e4ddc7'); cyl(0, 22, 0, 25, 18, '#af6753'); cyl(0, 40, 0, 25, 18, '#e4ddc7'); cyl(0, 58, 0, 30, 5, '#af6753'); cyl(0, 63, 0, 20, 12, '#67818a'); cyl(0, 75, 0, 29, 5, '#af6753'); box(-28, 0, 10, 25, 15, 28, '#d7bb9d'); break;
      case 'circle':
        cyl(0, 0, 0, 155, 2, '#b9b9a4'); cyl(0, 2, 0, 75, 3, '#8caa7e'); cyl(0, 5, 0, 8, 48, '#dbd6c0');
        box(0, 20, 0, 175, 7, 22, '#b6b6a8', -.35); box(0, 20, 0, 175, 2, 15, '#737d77', -.35); box(-62, 0, 0, 5, 20, 15); box(62, 0, 0, 5, 20, 15); break;
      case 'makola': case 'kantamanto':
        for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) box(a * 20, 0, b * 19, 16, 10 + ((a + b + 6) % 3) * 2, 14, ['#a56a4d', '#bd9e62', '#708e82'][(a + b + 6) % 3]);
        for (const a of [-1, 1]) box(a * 85, 0, 0, 23, 28, 130, '#d8c1a4'); break;
      case 'stadium':
        box(0, 0, 0, 145, 2, 110, '#9fae8d'); box(0, 2, 0, 100, .5, 64, '#73996b'); box(0, 3, 0, 1, .4, 64, '#d8d7bb');
        for (const x of [-65, 65]) box(x, 1, 0, 18, 22, 110, '#d3cbb6'); for (const z of [-48, 48]) box(0, 1, z, 120, 15, 14, '#d3cbb6');
        for (const x of [-75, 75]) for (const z of [-60, 60]) { box(x, 0, z, 2, 45, 2, '#a2afa5'); box(x, 43, z, 12, 4, 6, '#ddd8bd'); } break;
      case 'ug':
        box(0, 0, 0, 140, 1, 110, '#9bac86'); for (const x of [-40, 40]) { box(x, 0, -10, 25, 22, 100); parts.add('hip', l.x + x, 26, l.z - 10, 28, 8, 105, '#aa7054'); } box(0, 0, -52, 100, 23, 25); box(0, 0, 15, 14, 58, 14); parts.add('hip', l.x, 64, l.z + 15, 21, 12, 21, '#aa7054'); palm(-58, 47); palm(58, 47); break;
      case 'airport':
        box(0, 0, 0, 240, 20, 70, '#c5d2c8'); box(0, 20, 0, 250, 5, 78, '#849b9c'); box(0, 5, 36, 220, 11, 2, '#6a939e'); cyl(100, 0, 60, 10, 58, '#d4d7c8'); cyl(100, 58, 60, 22, 9, '#728d94');
        box(-35, 3, 80, 65, 5, 7, '#e7e4d5'); box(-30, 3, 80, 12, 3, 55, '#e7e4d5'); break;
      case 'mall': box(0, 0, 0, 140, 22, 85); box(0, 22, 0, 145, 4, 90, '#a56d54'); for (let x = -55; x < 60; x += 20) box(x, 0, 62, 9, 5, 19, '#8c9f9c'); break;
      case 'castle': for (const x of [-40, 40]) box(x, 0, 0, 22, 32, 90, '#e4dfcd'); box(0, 0, -35, 100, 30, 25, '#e4dfcd'); box(35, 0, -25, 20, 55, 20, '#e4dfcd'); break;
      case 'decor:tema-port':
        box(0, 0, 0, 620, 1, 420, '#b5b8a6');
        for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) box(-210 + i * 66, 0, -120 + j * 52, 45, 15 + (j % 2) * 12, 20, ['#a9795f', '#708b87', '#b09d72'][(i + j) % 3]);
        for (const x of [-190, 0, 190]) { box(x - 25, 0, 170, 7, 90, 7, '#78938b'); box(x + 25, 0, 170, 7, 90, 7, '#78938b'); box(x, 85, 190, 80, 7, 75, '#78938b'); box(x, 45, 220, 3, 40, 3, '#c6c9b5'); } break;
      default: {
        const width = l.home ? 28 : 22, height = l.home ? 16 : 21;
        box(0, 0, 0, width, height, 24, l.home ? '#ded7c2' : '#d8c6a6'); parts.add('hip', l.x, height + 5, l.z, width + 3, 10, 28, '#a46c53'); box(0, 3, 12.5, 5, 7, 1, '#657e76'); if (l.home) palm(-24, -15);
      }
    }
  }
  return parts.finish();
}
