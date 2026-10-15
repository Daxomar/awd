import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {project,unproject,display,SCALE,inRing,inPolygon,overviewFrame,cameraLimits,SpatialIndex} from '../src/v2/scene/city/geography.js';
import {resolveDistricts,FAMILIES,DISTRICT_SPECS} from '../src/v2/scene/city/districts.js';
import {createPlan,makeConstraints,canPlace,segmentFootprintDistance} from '../src/v2/scene/city/planner.js';
import {decodeBlueprint} from '../src/v2/scene/city/blueprint.js';
import {landmarkInventory} from '../src/v2/scene/city/landmarks.js';
import {CityKit,buildingBase,disposeBatch} from '../src/v2/scene/city/kit.js';
import {CityFoundation} from '../src/v2/scene/city/foundation.js';
import {DetailChunks} from '../src/v2/scene/city/chunks.js';
import {clusterMarkers,pinPosition} from '../src/v2/scene/city/markers.js';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
const data=read('../public/assets/greater-accra.json'),anchors=read('../public/assets/district-anchors.json'),blueprint=read('../public/assets/city-blueprint.json'),cat=read('./fixtures/city-catalog.json');
const districts=resolveDistricts(data,anchors),landmarks=landmarkInventory(cat,data,districts),plan=decodeBlueprint(blueprint);

test('legacy metre projection round-trips; display never changes saved coordinates',()=>{
  assert.deepEqual(project(5.556,-.2),[0,-0]);
  const point=project(5.6476582,-.1960267),ll=unproject(...point);assert.ok(Math.abs(ll[0]-5.6476582)<1e-10);assert.ok(Math.abs(ll[1]+.1960267)<1e-10);
  for(const l of [...cat.locs,...Object.values(cat.homes)]){const original=[l.x,l.z];assert.deepEqual(display(...original),original.map(v=>v*SCALE));assert.deepEqual([l.x,l.z],original);}
  assert.equal(cat.locs.length,55);assert.equal(Object.keys(cat.homes).length,8);assert.equal(new Set(cat.locs.map(l=>l.id)).size,55);
});
test('city data and compiled procedural plan cannot silently drift apart',()=>{
  for(const [name,hash]of Object.entries(blueprint.sourceHashes)){const url=new URL('../../'+name,import.meta.url);const source=fs.readFileSync(url,'utf8').replace(/\r\n/g,'\n');assert.equal(crypto.createHash('sha256').update(source).digest('hex'),hash,`Rebuild blueprint after editing ${name}`);}
});
test('68 distinct sourced districts cover all twelve families and outer communities',()=>{
  assert.equal(districts.length,DISTRICT_SPECS.length);assert.equal(districts.length,68);assert.equal(new Set(districts.map(d=>d.id)).size,68);
  assert.equal(new Set(districts.flatMap(d=>[d.family,d.secondary])).size,12);assert.equal(Object.keys(FAMILIES).length,12);
  for(const d of districts){assert.ok(d.provenance, d.name);assert.ok(plan.counts.get(d.id)>15,`${d.name} is empty`);assert.ok(d.x>=data.boundsMeters[0]&&d.x<=data.boundsMeters[1]&&d.z>=data.boundsMeters[2]&&d.z<=data.boundsMeters[3]);}
  for(const id of ['jamestown','circle','makola','osu','east-legon','madina','airport-city','tema','prampram','kasoa','oyarifa'])assert.ok(districts.some(d=>d.id===id));
});
test('coastline, lagoons, reservoir and polygon holes distinguish land from sea',()=>{
  const wet=(lat,lon)=>{const [x,z]=project(lat,lon);return [...data.sea,...data.water.map(w=>w.rings)].some(r=>inPolygon(x,z,r));};
  assert.ok(!wet(5.60,-.2),'Central Accra must be land');assert.ok(wet(5.505,.1),'Gulf must be water');
  assert.ok(data.water.some(w=>w.relation&&/weija/i.test(w.name)),'Weija reservoir relation retained');assert.ok(data.water.some(w=>/sakumono/i.test(w.name)));
  const square=[[0,0],[10,0],[10,10],[0,10],[0,0]],hole=[[3,3],[7,3],[7,7],[3,7],[3,3]];assert.ok(inRing(5,5,square));assert.ok(!inPolygon(5,5,[square,hole]));assert.ok(inPolygon(1,1,[square,hole]));assert.ok(data.coast[0].length>100);
});
test('sourced arterial corridors retain junction relationships and hierarchy',()=>{
  for(const pattern of [/Ring Road/,/George Walker Bush/,/Motorway/,/Spintex/,/Liberation/,/Aburi Road/])assert.ok(data.roads.some(r=>pattern.test(r.name)),String(pattern));
  const endpoints=new Map();for(const road of data.roads)for(const p of [road.p[0],road.p.at(-1)]){const key=p.join(',');endpoints.set(key,(endpoints.get(key)||0)+1);}
  assert.ok([...endpoints.values()].filter(n=>n>1).length>10000,'Roads must connect rather than being isolated decorative lines');assert.ok(data.roads.some(r=>r.kind==='residential'));
});
test('deterministic frontage generation and accurate oriented-road clearance',()=>{
  const small={roads:[{osm:1,kind:'residential',p:[[-450,0],[450,0]]},{osm:2,kind:'residential',p:[[-450,180],[450,180]]}],sea:[],water:[],green:[],features:[]};
  const area=[{id:'test',x:0,z:0,radius:2000,family:'mixed',secondary:'compound'}];const a=createPlan(small,area,[]),b=createPlan(small,area,[]);assert.ok(a.buildings.length>5);assert.deepEqual(a.buildings,b.buildings);
  assert.equal(segmentFootprintDistance([-20,0],[20,0],[[-5,-5],[5,-5],[5,5],[-5,5]]),0);
  assert.equal(segmentFootprintDistance([-1,0],[1,0],[[-5,-5],[5,-5],[5,5],[-5,5]]),0);
});
test('every compiled building clears water, protected grounds, roads and landmark reservations',()=>{
  const constraints=makeConstraints(data,landmarks);let failures=[];
  for(const p of plan.buildings){if(!canPlace({...p,w:p.w-.04,d:p.d-.04},constraints))failures.push([p.district,p.x,p.z]);}
  assert.deepEqual(failures.slice(0,10),[],'2cm quantization tolerance only; never allow visible overlaps');assert.ok(plan.buildings.length>50000);
});
test('a narrow river or park strip cannot cross a building with dry corners',()=>{
  const ring=[[3,-20],[4,-20],[4,20],[3,20],[3,-20]],p={x:0,z:0,w:10,d:10,angle:0,family:'mixed'};
  for(const key of ['water','green']){const source={roads:[],sea:[],water:[],green:[],features:[]};source[key]=[{rings:[ring]}];assert.equal(canPlace(p,makeConstraints(source,[])),false,key);}
});
test('mapped industrial parcels receive deterministic interior yards without local streets',()=>{
  const source={roads:[],sea:[],water:[],green:[],features:[{osm:100,kind:'industrial',p:[[0,0],[1000,0],[1000,1000],[0,1000],[0,0]]}]},area=[{id:'industry',x:500,z:500,radius:2000,family:'industrial',secondary:'office'}];
  const a=createPlan(source,area,[]),b=createPlan(source,area,[]);assert.ok(a.buildings.length>8);assert.deepEqual(a.buildings,b.buildings);assert.ok(a.buildings.every(p=>p.family==='industrial'&&p.w>=42&&p.x>0&&p.x<1000&&p.z>0&&p.z<1000));
});
test('landmark registry preserves all venue/home IDs, isolates decorative port and saved anchors',()=>{
  const expected=[...cat.locs.map(l=>l.id),...Object.keys(cat.homes).map(id=>'h:'+id)];for(const id of expected){const l=landmarks.find(l=>l.id===id);assert.ok(l,id);assert.equal(l.saved.length,2);}
  assert.equal(landmarks.filter(l=>!l.decorative).length,63);assert.ok(landmarks.find(l=>l.id==='decor:tema-port').decorative);assert.ok(landmarks.every(l=>!l.decorative||!cat.locs.some(c=>c.id===l.id)));
});
test('chunk detail loading uses a bounded LRU and does not destroy shared templates',()=>{
  const kit=new CityKit(),parent=new THREE.Group(),chunks=new Map();const example=plan.buildings[0];
  for(let x=0;x<25;x++)chunks.set(`${x},0`,[{...example,x:x*750+100,z:100}]);
  let sharedDisposed=0;kit.geometries.box.addEventListener('dispose',()=>sharedDisposed++);const detail=new DetailChunks(kit,parent,chunks,12);
  for(let x=0;x<25;x++)for(let i=0;i<4;i++)detail.update((x*750+100)*SCALE,.3,5);
  assert.ok(detail.stats().cached<=12);assert.ok(detail.stats().active<=9);assert.ok(detail.stats().evicted>0);assert.equal(sharedDisposed,0);
  detail.dispose();detail.dispose();assert.equal(parent.children.length,0);assert.equal(detail.stats().cached,0);assert.equal(sharedDisposed,0);kit.dispose();assert.equal(sharedDisposed,1);
});
test('city overview and close-up share geometry ownership and dispose every instance batch',()=>{
  const kit=new CityKit(),foundation=new CityFoundation(kit,plan.buildings.slice(0,50));foundation.update(120);assert.ok(foundation.overview.visible&&!foundation.regions.visible);foundation.update(5);assert.ok(!foundation.overview.visible&&foundation.regions.visible);
  let instances=0,disposed=0;foundation.group.traverse(o=>{if(o.isInstancedMesh){instances++;o.addEventListener('dispose',()=>disposed++);}});foundation.dispose();assert.equal(disposed,instances);kit.dispose();
});
test('clustering preserves current location, stable IDs, hit separation and safe HUD area',()=>{
  const items=[{id:'a',sx:100,sy:250,depth:0},{id:'b',sx:120,sy:250,depth:0,keep:true},{id:'c',sx:210,sy:250,depth:0},{id:'off',sx:10,sy:250,depth:0},{id:'hud',sx:180,sy:70,depth:0}];const groups=clusterMarkers(items,{width:390,height:844});assert.equal(groups.length,2);assert.equal(groups[0].items[0].id,'b');assert.deepEqual(new Set(groups.flatMap(g=>g.items.map(p=>p.id))),new Set(['a','b','c']));assert.ok(Math.hypot(groups[0].sx-groups[1].sx,groups[0].sy-groups[1].sy)>=46);
});
test('camera limits follow the geographic extent at all supported aspect ratios',()=>{
  const limits=cameraLimits(data.boundsMeters);assert.ok(limits.bounds[1]>100,'Tema and Prampram remain reachable');
  for(const [w,h]of [[375,812],[390,844],[430,932],[390,530],[844,390]]){const frame=overviewFrame(data.boundsMeters,w/h);assert.ok(Number.isFinite(frame.zoom)&&frame.zoom>0);assert.ok(frame.x>=limits.bounds[0]&&frame.x<=limits.bounds[1]);}
});
test('a home pin created before geography loads uses its corrected slot after loading',()=>{
  const home={id:'home',homeId:'jtown',x:-1108,z:2543,xz:[-3.324,7.629]},slotOf=id=>id==='h:jtown'?[-3.324,7.269]:null;
  assert.deepEqual(pinPosition(home,slotOf,display),[-3.324,7.269]);assert.equal(home.z,2543);assert.deepEqual(pinPosition({...home,homeId:null},slotOf,display),home.xz);
});
