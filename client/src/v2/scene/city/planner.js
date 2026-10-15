import { FAMILIES, nearestDistrict } from './districts.js';
import { SpatialIndex, polygonIndex, inPolygon, distanceSegment, seeded, keyOf, roadWidth } from './geography.js';

export function corners(p, margin = 0) {
  const c = Math.cos(p.angle), s = Math.sin(p.angle), w = p.w / 2 + margin, d = p.d / 2 + margin;
  return [[-w, -d], [w, -d], [w, d], [-w, d]].map(([a, b]) => [p.x + a * c + b * s, p.z - a * s + b * c]);
}
export function makeConstraints(data, landmarks = []) {
  const roads = new SpatialIndex(160);
  for (const route of data.roads) for (let i = 1; i < route.p.length; i++) {
    const a = route.p[i - 1], b = route.p[i], width = roadWidth(route.kind) * 1.4;
    roads.insert({ a, b, width }, Math.min(a[0], b[0]) - width, Math.min(a[1], b[1]) - width, Math.max(a[0], b[0]) + width, Math.max(a[1], b[1]) + width);
  }
  const water = polygonIndex([...data.sea.map(rings => ({ rings })), ...data.water]);
  const green = polygonIndex(data.green);
  const protectedAreas=polygonIndex(data.features.filter(f=>f.kind==='aerodrome'&&f.p.length>3&&f.p[0][0]===f.p.at(-1)[0]&&f.p[0][1]===f.p.at(-1)[1]).map(f=>({rings:[f.p]})));
  const boundaries=new SpatialIndex(160);
  const forbidden=[...data.sea,...data.water.map(w=>w.rings),...data.green.map(g=>g.rings),...data.features.filter(f=>f.kind==='aerodrome'&&f.p.length>3&&f.p[0][0]===f.p.at(-1)[0]&&f.p[0][1]===f.p.at(-1)[1]).map(f=>[f.p])];
  for(const rings of forbidden)for(const ring of rings)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];boundaries.insert({a,b},Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1]));}
  const reservations = new SpatialIndex(250);
  for (const l of landmarks) reservations.insert(l, l.x - l.r, l.z - l.r, l.x + l.r, l.z + l.r);
  const runways = data.features.filter(f => f.kind === 'runway').flatMap(f => f.p.slice(1).map((b, i) => ({ a: f.p[i], b })));
  return { roads, water, green, reservations, runways, protectedAreas,boundaries };
}
export function canPlace(p, constraints) {
  const { roads, water, green, reservations, runways, protectedAreas,boundaries } = constraints;
  const margin=FAMILIES[p.family]?.boundary?10:3, radius = Math.hypot(p.w+margin*2, p.d+margin*2) / 2;
  const footprint=corners(p,margin);
  if (roads.query(p.x, p.z, radius + 20).some(r => {
    if(distanceSegment(p.x,p.z,r.a,r.b)>radius+r.width/2+3)return false;
    return segmentFootprintDistance(r.a,r.b,footprint)<r.width/2+3;
  })) return false;
  if (reservations.query(p.x, p.z, radius).some(l => Math.hypot(l.x - p.x, l.z - p.z) < radius + l.r)) return false;
  if (runways.some(r => distanceSegment(p.x, p.z, r.a, r.b) < radius + 180)) return false;
  // Corners alone miss thin rivers and concave park edges crossing a footprint.
  if(boundaries.query(p.x,p.z,radius).some(e=>segmentFootprintDistance(e.a,e.b,footprint)<.001))return false;
  for (const [x, z] of [[p.x, p.z], ...footprint]) {
    if (water.query(x, z).some(w => inPolygon(x, z, w.rings)) || green.query(x, z).some(w => inPolygon(x, z, w.rings)) || protectedAreas.query(x,z).some(w=>inPolygon(x,z,w.rings))) return false;
  }
  return true;
}
function intersect(a,b,c,d){
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),x=cross(c,d,b);return u*v<0&&w*x<0;
}
export function segmentFootprintDistance(a,b,points){
  let distance=Infinity;
  for(let i=0;i<points.length;i++){
    const c=points[i],d=points[(i+1)%points.length];if(intersect(a,b,c,d))return 0;
    distance=Math.min(distance,distanceSegment(a[0],a[1],c,d),distanceSegment(b[0],b[1],c,d),distanceSegment(c[0],c[1],a,b),distanceSegment(d[0],d[1],a,b));
  }
  // A short road segment entirely inside a footprint has no edge intersection.
  const inside=point=>{let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const p=points[i],q=points[j];if((p[1]>point[1])!==(q[1]>point[1])&&point[0]<(q[0]-p[0])*(point[1]-p[1])/(q[1]-p[1])+p[0])yes=!yes;}return yes;};
  return inside(a)||inside(b)?0:distance;
}
function* planSteps(data, districts, landmarks) {
  const constraints = makeConstraints(data, landmarks), occupied = new SpatialIndex(100), buildings = [], chunks = new Map(), counts = new Map();
  const register=p=>{
    const radius=Math.hypot(p.w,p.d)/2;
    if(occupied.query(p.x,p.z,radius+55).some(q=>Math.hypot(p.x-q.x,p.z-q.z)<radius+q.radius+4))return false;
    occupied.insert({x:p.x,z:p.z,radius},p.x-radius,p.z-radius,p.x+radius,p.z+radius);buildings.push(p);counts.set(p.district,(counts.get(p.district)||0)+1);
    const key=keyOf(p.x,p.z);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(p);return true;
  };
  const ordered = data.roads.map(r => ({ road: r, order: seeded(r.osm)() })).sort((a, b) => a.order - b.order);
  let processed = 0;
  for (const { road } of ordered) {
    if (++processed % 160 === 0) yield processed / ordered.length;
    if (/motorway|trunk/.test(road.kind)) continue;
    const random = seeded(`road:${road.osm}`);
    for (let i = 1; i < road.p.length; i++) {
      const a = road.p[i - 1], b = road.p[i], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 8) continue;
      const ux = dx / length, uz = dz / length, angle = Math.atan2(-uz, ux);
      // A continuous irregular frontage sequence, aligned to sourced streets.
      for (let t = random() * 28; t < length; t += 28 + random() * 25) for (const side of [-1, 1]) {
        const qx = a[0] + ux * t, qz = a[1] + uz * t;
        const { district, score } = nearestDistrict(districts, qx, qz);
        if (score > 1.5 || random() > Math.min(1, 1.65 - score * .45)) continue;
        const family = random() < .73 ? district.family : district.secondary, profile = FAMILIES[family];
        const limit = ['suburb', 'industrial', 'campus'].includes(district.family) ? 950 : 1700;
        if ((counts.get(district.id) || 0) >= limit || random() > 90 / profile.spacing) continue;
        const mix = range => range[0] + random() * (range[1] - range[0]);
        const w = mix(profile.width), d = mix(profile.depth), floors = Math.floor(mix([profile.floors[0], profile.floors[1] + 1]));
        const offset = roadWidth(road.kind) * .7 + d / 2 + (profile.boundary ? 14 : 7) + random() * 7;
        const p = { x: qx - uz * offset * side, z: qz + ux * offset * side, w, d, angle: angle + (side === 1 ? Math.PI : 0), floors, family, district: district.id, seed: Math.round(random() * 1e9), h: floors * (profile.warehouse ? 5 : 3.2) * 2.2, roof: random() < .2 ? 'flat' : profile.roof };
        if (!canPlace(p, constraints)) continue;
        register(p);
      }
    }
  }
  // Large mapped factory yards often have no public residential roads inside.
  // Compose service-yard rows within those actual industrial parcel boundaries.
  // They share the same collision constraints and never become travel targets.
  for(const feature of data.features.filter(f=>f.kind==='industrial'&&f.p.length>3&&f.p[0][0]===f.p.at(-1)[0]&&f.p[0][1]===f.p.at(-1)[1]).sort((a,b)=>a.osm-b.osm)){
    const random=seeded('parcel:'+feature.osm),xs=feature.p.map(p=>p[0]),zs=feature.p.map(p=>p[1]),cx=xs.reduce((a,b)=>a+b,0)/xs.length,cz=zs.reduce((a,b)=>a+b,0)/zs.length;
    let angle=0,longest=0;for(let i=1;i<feature.p.length;i++){const a=feature.p[i-1],b=feature.p[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length>longest){longest=length;angle=Math.atan2(-(b[1]-a[1]),b[0]-a[0]);}}
    const candidates=[];for(let z=Math.min(...zs)+65;z<Math.max(...zs)-40;z+=140)for(let x=Math.min(...xs)+65;x<Math.max(...xs)-40;x+=140){const p={x:x+(random()-.5)*25,z:z+(random()-.5)*25,w:42+random()*46,d:45+random()*58,h:(8+random()*6)*2.2,angle,floors:1,family:'industrial',seed:Math.floor(random()*1e9),roof:'gable'};if(inPolygon(p.x,p.z,[feature.p]))candidates.push(p);}
    candidates.sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz));let accepted=0;
    for(const p of candidates){if(accepted>=350)break;if(corners(p,4).some(([x,z])=>!inPolygon(x,z,[feature.p])))continue;if(feature.p.slice(1).some((b,i)=>segmentFootprintDistance(feature.p[i],b,corners(p,4))<.001))continue;
      p.district=nearestDistrict(districts,p.x,p.z).district.id;if(canPlace(p,constraints)&&register(p))accepted++;
    }
  }
  return { buildings, chunks, counts, constraints };
}
export function createPlan(data, districts, landmarks) {
  const work = planSteps(data, districts, landmarks); let next;
  do { next = work.next(); } while (!next.done);
  return next.value;
}
export async function createPlanAsync(data, districts, landmarks, progress = () => {}, cancelled = () => false) {
  const work = planSteps(data, districts, landmarks); let next;
  do { if (cancelled()) return null; next = work.next(); if (!next.done) { progress(next.value); await new Promise(resolve => requestAnimationFrame(resolve)); } } while (!next.done);
  return next.value;
}
