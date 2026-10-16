import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {CITY_NEIGHBOURHOODS,CITY_LINKS,worldLocations,playableAnchor} from '../../shared/world-locations.js';
import {CompactCity} from '../src/v2/scene/city/compact.js';
import {catalog,LOC,HOME_POS} from '../../server/src/game/rules.js';

const cat=catalog();
test('all live destinations and eight legacy home templates retain authoritative IDs and metres',()=>{
  const before=JSON.stringify(cat),locations=worldLocations(cat);
  assert.equal(locations.length,63);assert.equal(new Set(locations.map(l=>l.id)).size,63);
  for(const l of locations){const original=l.homeTemplate?HOME_POS[l.homeTemplate]:LOC[l.id];assert.ok(original,l.id);assert.ok(Math.abs(l.geographic.x-original.x)<.51);assert.ok(Math.abs(l.geographic.z-original.z)<.51);assert.deepEqual(l.navigation.geographic,l.geographic);assert.notDeepEqual(l.playable,l.geographic);assert.equal(l.availability.authority,'server');}
  assert.equal(JSON.stringify(cat),before);assert.deepEqual(worldLocations(cat),locations);
});
test('authored areas are connected and every building maps to existing activities or explicit housing rules',()=>{
  const reached=new Set([CITY_NEIGHBOURHOODS[0].id]);for(let i=0;i<CITY_NEIGHBOURHOODS.length;i++)for(const [a,b] of CITY_LINKS){if(reached.has(a))reached.add(b);if(reached.has(b))reached.add(a);}
  assert.equal(reached.size,CITY_NEIGHBOURHOODS.length);
  for(const l of worldLocations(cat)){
    assert.ok(Number.isFinite(l.playable.x)&&Number.isFinite(l.playable.z));
    if(l.type==='venue')assert.ok(l.activities.length,l.id);
    if(l.homeTemplate){assert.equal(l.instance.kind,'private-authorized-home');assert.equal(l.visual.interactive,false);assert.equal(l.ownership.kind,'legacy-per-player');}
  }
  assert.throws(()=>worldLocations({...cat,locs:[...cat.locs,{id:'unknown',area:'unmapped',x:1,z:1}]}),/No playable-world mapping/);
});
test('condensed display anchors never replace original fare inputs or mutate the metropolitan dataset',()=>{
  const locations=worldLocations(cat),start=cat.locs.find(l=>l.id==='circle'),end=cat.locs.find(l=>l.id==='ug');
  const originalDistance=Math.hypot(end.x-start.x,end.z-start.z);
  const a=playableAnchor(locations,start.x,start.z),b=playableAnchor(locations,end.x,end.z);
  assert.ok(originalDistance>8000);assert.ok(Math.hypot(b[0]-a[0],b[1]-a[1])<60);
  const baseline=JSON.parse(fs.readFileSync(new URL('../../docs/master/stage0/inventory.json',import.meta.url)));
  const wire=value=>JSON.parse(JSON.stringify(value)); // JSON wire format canonicalizes -0.
  assert.deepEqual(wire(cat.locs.map(({id,x,z})=>({id,x,z}))),baseline.destinations.map(({id,x,z})=>({id,x,z})));
  assert.deepEqual(wire({homes:cat.homes,cars:cat.cars,careers:cat.careers,transport:cat.transport,businesses:cat.biz,origins:cat.origins}),baseline.economy);
});
test('compact scene has a bounded background and independent geometry ownership across repeated removal',()=>{
  const a=new CompactCity(cat),b=new CompactCity(cat);
  assert.ok(a.decorativeBuildings<150);assert.equal(a.interactiveBuildings,55);
  let meshes=0,triangles=0,disposed=0;
  a.group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.count||1);}if(o.isInstancedMesh)o.addEventListener('dispose',()=>disposed++);});
  assert.ok(meshes<70);assert.ok(triangles<100000);
  const expected=meshes;let otherDisposed=0;b.kit.geometries.box.addEventListener('dispose',()=>otherDisposed++);
  a.dispose();a.dispose();assert.equal(disposed,expected);assert.equal(a.group.children.length,0);assert.equal(otherDisposed,0);
  b.dispose();assert.equal(otherDisposed,1);
});
test('actual building picking resolves every public destination and ignores decorative/housing templates',()=>{
  const city=new CompactCity(cat);
  for(const place of city.locations){const {x,z}=place.playable;const ray=new THREE.Ray(new THREE.Vector3(x,10,z),new THREE.Vector3(0,-1,0));assert.equal(city.pick(ray),place.visual.interactive?place.id:null,place.id);}
  assert.equal(city.pick(new THREE.Ray(new THREE.Vector3(100,10,100),new THREE.Vector3(0,-1,0))),null);
  city.dispose();
});
