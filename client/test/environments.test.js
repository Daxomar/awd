import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { canvasFixture, stageFixture, reachable } from './environment-fixture.js';
import { Room } from '../src/v2/scene/room.js';
import { homeSpec, HOME_IDS } from '../src/v2/scene/homes.js';
import { VENUES } from '../src/v2/scene/venues.js';
import { extraVenue, streetSpec, estatePlots, STREET_LAYOUTS } from '../src/v2/scene/neighbourhood.js';
import { HOME_ART, VENUE_ART } from '../src/v2/scene/environment-profiles.js';
import { environmentLight } from '../src/v2/scene/environment-light.js';
import { EnvironmentResources, EnvironmentCache } from '../src/v2/scene/environment-resources.js';
import { bake } from '../src/v2/scene/bake.js';
import { kitCacheStats, trimKitCaches, makeItem } from '../src/v2/scene/kit.js';
canvasFixture();
const cat=JSON.parse(fs.readFileSync(new URL('./fixtures/city-catalog.json',import.meta.url)));
const keys=['gas','fridge','tv','laptop','speaker','guitar','dumbbells','bed','ac','gen','solar','dslr'];
const all=Object.fromEntries(keys.map(k=>[k,true]));
const build=spec=>new Room(stageFixture()).build(structuredClone(spec));
function validate(room,label){
  const spec=room.spec,cells=reachable(room),n=room.nav;
  assert.ok(cells.size>4,label+' free floor');assert.ok(room.free(...room.cellOf(room.spawn.x,room.spawn.z)),label+' unobstructed spawn');
  assert.ok(Math.abs(spec.spawn.x)<spec.w/2&&Math.abs(spec.spawn.z)<spec.d/2,label+' spawn bounds');
  for(const z of spec.zones){
    const rec=room.items[z.item];assert.ok(rec,label+': '+z.id+' item');
    assert.ok(z.acts.every(id=>typeof id==='string'),label+' action IDs');
    const u=room.usePoint(rec,z.use||0),[i,j]=room.nearestFree(u.x,u.z);
    assert.ok(Math.abs(u.x)<spec.w/2&&Math.abs(u.z)<spec.d/2,label+': '+z.id+' use bounds');
    assert.ok(cells.has(j*n.nx+i),label+': '+z.id+' unreachable');
    const path=room.path(spec.spawn.x,spec.spawn.z,u.x,u.z);
    assert.ok(path.length,label+': '+z.id+' route');
    for(let k=1;k<path.length;k++)assert.ok(room.clear(path[k-1],path[k]),label+': '+z.id+' crosses obstacle');
  }
  for(const n of spec.npcs||[])if(n.seat)assert.ok(room.items[n.seat[0]]?.use[n.seat[1]],label+' NPC seat');
}
test('all eight homes keep owned furniture and reachable zones across equipment combinations',()=>{
  assert.deepEqual(Object.keys(HOME_ART),HOME_IDS);
  for(const id of HOME_IDS){
    const variants=[{},all,...keys.map(k=>({[k]:true})),...keys.map(k=>({...all,[k]:false}))];
    for(const [index,owned]of variants.entries()){
      const spec=homeSpec(id,owned),room=build(spec);validate(room,id+' configuration '+index);
      for(const [item,zone]of [['tv','tv'],['laptop','desk'],['guitar','guitar'],['dumbbells','gym']])assert.equal(spec.zones.some(z=>z.id===zone),!!owned[item],id+' '+item);
      for(const [key,kind]of [['fridge','fridge'],['gen','generator'],['solar','solar_unit'],['dslr','camera_case']])assert.equal(spec.items.some(i=>i.kind===kind),!!owned[key],id+' '+kind);
      assert.equal(spec.items.some(i=>i.kind==='gas_cooker'),!!owned.gas);
      assert.equal(spec.items.some(i=>i.kind==='coal_pot'),!owned.gas);
      room.dispose();
    }
  }
});
test('every authoritative venue, neighbourhood and estate has an explicit art direction and reachable actions',()=>{
  const ordinary=cat.locs.filter(l=>!l.id.includes(':'));assert.equal(ordinary.length,39);assert.deepEqual(new Set(Object.keys(VENUE_ART)),new Set(ordinary.map(l=>l.id)));
  for(const l of cat.locs){
    const spec=l.id.includes(':')?streetSpec(cat.homes[l.id.slice(2)].area,l.id[0]==='e'):extraVenue(l.id)||VENUES[l.id];
    assert.ok(spec.environment,l.id);const room=build(spec);validate(room,l.id);room.dispose();
  }
});
test('baseline zone IDs, action IDs, item indices, routes and authored spawns stay compatible',()=>{
  const contracts=JSON.parse(fs.readFileSync(new URL('./fixtures/environment-contract.json',import.meta.url)));
  assert.equal(Object.keys(contracts).length,63);
  for(const [id,contract]of Object.entries(contracts)){
    const spec=id.startsWith('home:')?homeSpec(id.slice(5),{}):id.includes(':')?streetSpec(cat.homes[id.slice(2)].area,id[0]==='e'):extraVenue(id)||VENUES[id];
    assert.deepEqual(spec.spawn,contract.spawn,id+' spawn');
    const zones=spec.zones.map(z=>Object.fromEntries(['id','item','acts','route','use'].map(k=>[k,z[k]??null])));
    const originalActs=new Set(contract.zones.flatMap(z=>z.acts));
    const baseline=zones.map(z=>({...z,acts:z.acts.filter(a=>originalActs.has(a))}));
    assert.deepEqual(baseline,contract.zones,id+' original interaction contract');
    // Authored milestone additions may extend a zone without moving/removing old actions.
    const additions=zones.flatMap(z=>z.acts.filter(a=>!originalActs.has(a)));
    assert.equal(additions.length,id.startsWith('n:')||id==='police'?1:0,id+' deliberate activity extension');
    if(id==='police')assert.deepEqual(additions,['community_service']);
  }
});
test('all neighbourhoods differ in composition and every occupied estate plot is reachable',()=>{
  assert.equal(new Set(Object.values(STREET_LAYOUTS).map(v=>JSON.stringify(v))).size,8);
  const compositions=[];
  for(const [id,home]of Object.entries(cat.homes)){
    const spec=streetSpec(home.area,true),room=build(spec);assert.equal(spec.items.filter(i=>i.owner).length,0,'Empty estates invent no owners');
    for(const [i,p]of estatePlots(id).entries())room.addItem({kind:'street_building:6,4',...p,owner:{id:i+1},family:spec.environment.family,style:spec.environment.style,label:'Resident '+i});
    const cells=reachable(room);for(const rec of room.items.filter(r=>r.spec.owner)){const u=room.usePoint(rec),[i,j]=room.nearestFree(u.x,u.z);assert.ok(cells.has(j*room.nav.nx+i),id+' owner approach');}
    validate(room,id+' estate');compositions.push(JSON.stringify([spec.floor,spec.ownerPlots,spec.environment.style]));room.dispose();
  }
  assert.equal(new Set(compositions).size,8);
});
test('unreachable navigation refuses a direct walk through walls',()=>{
  const room=build({w:6,d:6,outdoor:true,items:[{kind:'half_wall:6',x:0,z:0}],zones:[],spawn:{x:0,z:2}});
  assert.deepEqual(room.path(0,2,0,-2),[]);room.dispose();
});
test('rectangular canopy roofs stay within their supporting footprint',()=>{
  for(const [w,d]of [[5,2.4],[2.4,5],[2.4,2.6]]){
    const item=makeItem(`canopy:${w},${d}`),scope=new EnvironmentResources().capture(item.obj);
    const size=new THREE.Box3().setFromObject(item.obj).getSize(new THREE.Vector3());
    assert.ok(size.x<=w+.1&&size.z<=d+.1,JSON.stringify(size));assert.ok(size.y<3.2);scope.dispose();
  }
});
test('travel batching preserves authored furniture vertex colours',()=>{
  const g=new THREE.BoxGeometry(),values=new Float32Array(g.attributes.position.count*3);values.fill(.25);
  g.setAttribute('color',new THREE.BufferAttribute(values,3));
  const material=new THREE.MeshStandardMaterial({vertexColors:true,color:'#ffffff'}),root=new THREE.Group();root.add(new THREE.Mesh(g,material));bake(root);
  assert.ok(Math.abs(root.children[0].geometry.attributes.color.getX(0)-.25)<.0001);
  root.children[0].geometry.dispose();g.dispose();material.dispose();
});
test('resource scopes preserve live shared geometry, materials and texture dependencies',()=>{
  const g=new THREE.BoxGeometry(),t=new THREE.Texture(),m=new THREE.MeshStandardMaterial({map:t});const root=new THREE.Mesh(g,m),a=new EnvironmentResources().capture(root),b=new EnvironmentResources().capture(root);
  let disposed=0;for(const v of [g,m,t])v.addEventListener('dispose',()=>disposed++);
  a.dispose();assert.equal(disposed,0);b.dispose();assert.equal(disposed,3);b.dispose();assert.equal(disposed,3);
  const cache=new EnvironmentCache(0),shared=new THREE.BoxGeometry();cache.set('shared',shared);const live=new EnvironmentResources().capture(new THREE.Mesh(shared,new THREE.MeshStandardMaterial()));cache.trim();assert.equal(cache.size,1);live.dispose();cache.trim();assert.equal(cache.size,0);
});
test('repeated room entry and item replacement release owned resources and bound kit caches',()=>{
  const stage=stageFixture();
  for(let i=0;i<24;i++){
    const room=new Room(stage).build(homeSpec(HOME_IDS[i%8],i%2?all:{}));
    for(let j=0;j<8;j++){const item=room.addItem({kind:'street_building',x:0,z:0,label:'Unique owner '+i+'-'+j});room.removeItem(item);assert.equal(item.resources.values.size,0);}
    room.dispose();room.dispose();assert.equal(room.resources.values.size,0);assert.equal(room.group.children.length,0);assert.equal(stage.lamps.length,0);assert.equal(stage.scene.children.length,0);
  }
  trimKitCaches();const counts=kitCacheStats();assert.ok(counts.materials<=96,JSON.stringify(counts));assert.ok(counts.templates<=160,JSON.stringify(counts));assert.ok(counts.textures<=144,JSON.stringify(counts));
});
test('daylight is continuous through midnight and keeps night scenes visible',()=>{
  const morning=environmentLight(7),noon=environmentLight(12),sunset=environmentLight(18),night=environmentLight(22);
  assert.ok(noon.key>morning.key&&sunset.night>0&&night.night===1);assert.ok(night.hemi>=.65);assert.ok(night.key>=.4);
  for(const h of [0,5,6.5,9,12,16,18,19.5,24]){const a=environmentLight(h-.001),b=environmentLight(h+.001);assert.ok(Math.abs(a.key-b.key)<.001);}
  assert.equal(environmentLight(0).background.getHex(),environmentLight(24).background.getHex());
});
test('reduced motion freezes decorative fans, smoke and screens without stopping gameplay movement',()=>{
  const room=build(homeSpec('nima',{tv:true}));room.motion={matches:true};
  const spin=room.items.flatMap(r=>r.obj.userData.spin||[])[0];assert.ok(spin);const start=spin.obj.rotation[spin.axis];let frames=0;room.screens[0].update=()=>frames++;
  const person=room.addPerson('test',{root:new THREE.Group(),play(){},update(){}},room.spawn.x,room.spawn.z);
  person.path=[[person.x+.5,person.z]];const previousX=person.x;
  room.update(.1);assert.equal(spin.obj.rotation[spin.axis],start);assert.equal(frames,0);assert.ok(person.x>previousX,'Movement continues with reduced motion');
  room.motion.matches=false;room.update(.1);assert.notEqual(spin.obj.rotation[spin.axis],start);assert.equal(frames,1);room.dispose();
});
