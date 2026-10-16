import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CityAds} from '../src/v2/scene/city/ads.js';

async function scenario(change){
  const oldDocument=globalThis.document,oldFetch=globalThis.fetch,reports=[];
  const canvas={closest:()=>null},group=new THREE.Group(),face=new THREE.Mesh(new THREE.PlaneGeometry(1,.5),new THREE.MeshBasicMaterial());group.add(face);
  face.material.map=new THREE.Texture({complete:true,naturalWidth:1024});
  const ads=new CityAds(group),camera=new THREE.PerspectiveCamera(45,390/844,.1,100);camera.position.set(0,0,5);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
  const b={slot:{id:'circle'},face,ad:{id:12,ends:Date.now()+60000}};ads.boards=[b];
  const doc={hidden:false,querySelector:()=>null,elementsFromPoint:()=>[canvas]};globalThis.document=doc;
  globalThis.fetch=async(url,request)=>{reports.push({url,body:JSON.parse(request.body)});return {ok:true};};
  ads.seen=new Map([[`12:${Math.floor(Date.now()/900000)}`,{start:performance.now()-2100,last:performance.now()}]]);
  const stage={camera,renderer:{domElement:{getBoundingClientRect:()=>({left:0,top:0,width:390,height:844})}}};
  try{await change({doc,ads,b,face,group,stage,reports});}finally{face.material.map.dispose();group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});globalThis.document=oldDocument;globalThis.fetch=oldFetch;}
}
test('estimated impression requires measured front-face area, dwell and clear rays; sent once',async()=>scenario(async({ads,stage,reports})=>{
  ads.sampleAt=-Infinity;ads.sample(stage);await Promise.resolve();assert.equal(reports.length,1);assert.equal(reports[0].url,'/api/ads/exposure');assert.ok(reports[0].body.pixels>=400);assert.ok(reports[0].body.seconds>=2);
  ads.sampleAt=-Infinity;ads.sample(stage);assert.equal(reports.length,1);
}));
test('offscreen, back-facing, tiny, expired, preview and insufficient dwell never report',async()=>{
  for(const mode of ['offscreen','back','tiny','expired','preview','brief'])await scenario(async({ads,b,face,stage,reports})=>{
    if(mode==='offscreen')face.position.x=20;if(mode==='back')face.rotation.y=Math.PI;if(mode==='tiny')face.scale.setScalar(.01);
    if(mode==='expired')b.ad.ends=Date.now()-1;if(mode==='preview')b.preview={};if(mode==='brief')ads.seen.clear();
    ads.sampleAt=-Infinity;ads.sample(stage);assert.equal(reports.length,0,mode);
  });
});
test('3D occlusion, UI cover, background tabs and phone overlays suppress impressions',async()=>{
  for(const mode of ['occluded','ui','hidden','phone'])await scenario(async({doc,ads,group,stage,reports})=>{
    if(mode==='occluded'){const blocker=new THREE.Mesh(new THREE.PlaneGeometry(3,3),new THREE.MeshBasicMaterial());blocker.position.z=1;group.add(blocker);}
    if(mode==='ui')doc.elementsFromPoint=()=>[{closest:()=>({})}];if(mode==='hidden')doc.hidden=true;if(mode==='phone')doc.querySelector=()=>({});
    ads.sampleAt=-Infinity;ads.sample(stage);assert.equal(reports.length,0,mode);
  });
});
test('a live record without loaded artwork never counts as an impression',async()=>scenario(async({ads,face,stage,reports})=>{
  face.material.map.image.complete=false;ads.sampleAt=-Infinity;ads.sample(stage);assert.equal(reports.length,0);
}));

test('terrain wholly below elevated sight lines needs no triangle raycast',async()=>scenario(async({ads,group,stage,reports})=>{
  const terrain=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.MeshBasicMaterial());
  terrain.rotation.x=-Math.PI/2;terrain.position.y=-1;
  terrain.raycast=()=>{throw Error('Below-target terrain must be rejected before triangle tests');};group.add(terrain);
  ads.sampleAt=-Infinity;ads.sample(stage);assert.equal(reports.length,1);
}));
