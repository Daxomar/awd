import { keyOf } from './geography.js';
export const ROOFS = ['flat', 'hip', 'gable'];
export function decodeBlueprint(data) {
  if (data.version !== 1 || !Array.isArray(data.buildings)) throw new Error('Unsupported city blueprint');
  const buildings = data.buildings.map(([x,z,w,d,h,angle,floors,family,district,seed,roof]) => ({ x,z,w,d,h,angle,floors,family:data.families[family],district:data.districts[district],seed,roof:ROOFS[roof] }));
  const chunks = new Map(), counts = new Map();
  for (const p of buildings) { const key=keyOf(p.x,p.z); if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(p);counts.set(p.district,(counts.get(p.district)||0)+1); }
  return { buildings, chunks, counts };
}
