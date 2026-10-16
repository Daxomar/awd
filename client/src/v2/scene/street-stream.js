import * as THREE from 'three';
import { B, mat, T, makeItem, trimKitCaches } from './kit.js';
import { EnvironmentResources, EnvironmentCache } from './environment-resources.js';
import { streetGraph, activeStreetSegments } from '../../../../shared/local-streets.js';

const add=(root,b)=>{const group=b.done([0,0],[]).obj;root.add(group);return group;};
const surfaces=new EnvironmentCache(2);
export const streetSurfaceStats=()=>({cached:surfaces.size,limit:surfaces.limit});
export const clearStreetSurfaces=()=>surfaces.clear();
function surfaceMaterial(graph,art){
  const key=graph.id+'|'+art.ground;const cached=surfaces.get(key);if(cached)return cached;
  // Paint the union on one owned plane. Overlapping road/cap meshes caused
  // coplanar seams at intersections; this also reduces the resident triangle cost.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d');ctx.scale(1024/graph.w,1024/graph.d);ctx.translate(graph.w/2,graph.d/2);
  ctx.fillStyle=art.ground;ctx.fillRect(-5.5,-5.5,11,11);ctx.lineCap='round';
  for(const [extra,color]of [[2.5,art.id==='jtown'?'#c9b896':'#c5c0ad'],[0,'#6e7470']]){
    ctx.strokeStyle=color;
    for(const s of graph.segments){ctx.lineWidth=s.width+extra;ctx.beginPath();ctx.moveTo(...s.from);ctx.lineTo(...s.to);ctx.stroke();}
  }
  ctx.strokeStyle='#ded6b8';ctx.lineWidth=.06;ctx.lineCap='butt';ctx.setLineDash([1,2]);
  for(const s of graph.segments){const dx=s.to[0]-s.from[0],dz=s.to[1]-s.from[1],length=Math.hypot(dx,dz);if(length<5)continue;
    ctx.beginPath();ctx.moveTo(s.from[0]+dx*2/length,s.from[1]+dz*2/length);ctx.lineTo(s.to[0]-dx*2/length,s.to[1]-dz*2/length);ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const material=new THREE.MeshStandardMaterial({map:texture,alphaTest:.5,roughness:.95});surfaces.set(key,material);return material;
}
function surface(graph,art){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(graph.w,graph.d),surfaceMaterial(graph,art));
  mesh.rotation.x=-Math.PI/2;mesh.position.y=.025;mesh.receiveShadow=true;mesh.userData.decorative=true;mesh.name='joined-road-surface';return mesh;
}
function baseGeometry(graph,art){
  const root=new THREE.Group(),b=new B();root.name='continuous-street-surfaces';
  // Low-cost surfaces stay resident for the complete compact graph. Detailed
  // architecture is streamed separately, so an unloaded neighbour is never void.
  root.add(surface(graph,art));
  for(const lot of graph.lots){
    const p=lot.approach;b.box(1.3,.012,1.3,'#cbbda3',p.x,.083,p.z,.008);
    const preview=new B();preview.bc(lot.w,2.2,lot.d,art.wall,lot.x,1.1,lot.z,0,lot.rot,0,.025);
    const group=add(root,preview);group.userData.segment=lot.segment;
  }
  add(root,b);return root;
}
function segmentGeometry(graph,seg,art){
  const root=new THREE.Group(),b=new B();root.name=seg.id;
  for(const lot of graph.lots.filter(l=>l.segment===seg.id&&l.role==='scenery')){
    const item=makeItem('street_building:5,4',{style:art.style,color:art.wall,label:'COMPOUND'}).obj;
    item.position.set(lot.x,0,lot.z);item.rotation.y=lot.rot;root.add(item);
  }
  // One restrained frontage sign per segment, using existing small text atlases.
  const x=(seg.from[0]+seg.to[0])/2,z=(seg.from[1]+seg.to[1])/2;
  const dx=seg.to[0]-seg.from[0],dz=seg.to[1]-seg.from[1],length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
  const sx=x+nx*(seg.width/2+.8),sz=z+nz*(seg.width/2+.8);
  b.box(.045,1.9,.045,'#6b7167',sx,0,sz,.003);
  b.plane(1.5,.23,mat('#fff',{map:T.text(seg.label,art.accent,'#f5efdc',256,64)}),sx,1.8,sz+.035);
  for(const side of [-1,1]){
    const tx=x+nx*(seg.width/2+2.1)*side,tz=z+nz*(seg.width/2+2.1)*side;
    if(Math.abs(tx)>18||Math.abs(tz)>18||Math.hypot(tx,tz)<7||graph.lots.some(l=>Math.hypot(l.x-tx,l.z-tz)<4))continue;
    b.box(.6,.18,.6,'#ad9d80',tx,0,tz,.03);b.cyl(.065,.08,1.7,'#84684b',tx,.18,tz,7);
    b.sph(.65,art.style==='coastal'?'#68875b':'#61805c',tx,2,tz,1,.8,1,8,5);
  }
  add(root,b);root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.decorative=true;}});return root;
}
export class StreetStream {
  constructor(room){
    this.room=room;this.graph=streetGraph(room.spec.localNetwork);this.active=new Map();this.builds=0;this.disposals=0;
    this.base=baseGeometry(this.graph,room.spec.environment);this.baseResources=new EnvironmentResources().capture(this.base);room.group.add(this.base);
    surfaces.trim();
    this.update(room.spawn.x,room.spawn.z);
  }
  update(x,z){
    const wanted=activeStreetSegments(this.graph,x,z,4);
    const key=[...wanted].sort().join('|');if(key===this.key)return;this.key=key;
    for(const child of this.base.children)if(child.userData.segment)child.visible=!wanted.includes(child.userData.segment);
    // New neighbours are made before old ones are released. Persistent road
    // surfaces and silhouettes keep joins continuous during this bounded swap.
    for(const id of wanted)if(!this.active.has(id)){
      const group=segmentGeometry(this.graph,this.graph.segments.find(s=>s.id===id),this.room.spec.environment);
      const resources=new EnvironmentResources().capture(group);this.room.group.add(group);this.active.set(id,{group,resources});this.builds++;
    }
    for(const rec of this.room.items)if(rec.streamed&&wanted.includes(rec.spec.segment))this.room.hydrateItem(rec);
    for(const [id,record]of this.active)if(!wanted.includes(id)){record.group.removeFromParent();record.resources.dispose();record.group.clear();this.active.delete(id);this.disposals++;}
    for(const rec of this.room.items)if(rec.streamed&&!wanted.includes(rec.spec.segment))this.room.dehydrateItem(rec);
    trimKitCaches();
  }
  stats(){return {active:this.active.size,ids:[...this.active.keys()],builds:this.builds,disposals:this.disposals};}
  dispose(){
    for(const rec of this.room.items)this.room.dehydrateItem(rec);
    for(const {group,resources}of this.active.values()){group.removeFromParent();resources.dispose();group.clear();}
    this.active.clear();this.base.removeFromParent();this.baseResources.dispose();this.base.clear();surfaces.trim();trimKitCaches();
  }
}
