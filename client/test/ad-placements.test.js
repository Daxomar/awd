import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AD_PLACEMENTS} from '../../shared/ad-placements.js';
import {makeConstraints,canPlace} from '../src/v2/scene/city/planner.js';
import {decodeBlueprint} from '../src/v2/scene/city/blueprint.js';
import {resolveDistricts} from '../src/v2/scene/city/districts.js';
import {landmarkInventory} from '../src/v2/scene/city/landmarks.js';
import {SpatialIndex} from '../src/v2/scene/city/geography.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
test('legacy billboard IDs/prices remain while only approved new inventory is exposed',()=>{
  const legacy={circle:1200,oxford:1200,airportcity:1200,accramall:1000,makola:800,kaneshie:800,labadi:800,legon:800,stadium:800,jamestown:500,kotoka_arr:3500,kotoka_dep:3500};
  assert.equal(AD_PLACEMENTS.length,25);assert.equal(new Set(AD_PLACEMENTS.map(s=>s.id)).size,25);
  for(const [id,price]of Object.entries(legacy))assert.equal(AD_PLACEMENTS.find(s=>s.id===id).price,price);
  for(const s of AD_PLACEMENTS){assert.ok(s.width>0&&s.height>0);assert.ok(Number.isFinite(s.x)&&Number.isFinite(s.z));assert.equal(s.visibility.estimated,true);}
});
test('ground panels clear roads, water, green/protected sites, homes, landmarks and compiled buildings',()=>{
  const data=read('../public/assets/greater-accra.json'),cat=read('./fixtures/city-catalog.json');
  const districts=resolveDistricts(data,read('../public/assets/district-anchors.json')),constraints=makeConstraints(data,landmarkInventory(cat,data,districts));
  const plan=decodeBlueprint(read('../public/assets/city-blueprint.json')),occupied=new SpatialIndex(160);
  for(const b of plan.buildings){const r=Math.hypot(b.w,b.d)/2;occupied.insert({...b,r},b.x-r,b.z-r,b.x+r,b.z+r);}
  const ground=AD_PLACEMENTS.filter(s=>s.type==='ground');assert.equal(ground.length,3);
  for(const s of ground){
    assert.ok(s.exclusive);assert.ok(/commercial|event/.test(s.surface));
    const x=s.x+(s.offset?.[0]||0)/.003,z=s.z+(s.offset?.[1]||0)/.003;
    // 70×35 m symbolic map footprint + clearance encloses the rendered border.
    assert.ok(canPlace({x,z,w:70,d:35,angle:0,family:'commercial'},constraints),s.id+' geographic clearance');
    assert.ok(!occupied.query(x,z,60).some(b=>Math.hypot(b.x-x,b.z-z)<b.r+41),s.id+' building clearance');
    assert.ok(AD_PLACEMENTS.filter(b=>b.type!=='ground').every(b=>Math.hypot(x-b.x-(b.offset?.[0]??-.18)/.003,z-b.z-(b.offset?.[1]??-.18)/.003)>420),s.id+' separation from other advertising silhouettes');
  }
});
