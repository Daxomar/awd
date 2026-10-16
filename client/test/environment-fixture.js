import * as THREE from 'three';
// Canvas drawing is verified in Chromium. Node tests exercise geometry, ownership
// and navigation without depending on a native canvas package or a GPU.
export function canvasFixture(){
  const gradient={addColorStop(){}};
  const context=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:t=>({width:String(t).length*8})},{get:(o,k)=>k in o?o[k]:()=>{}});
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
}
export function stageFixture(){return {scene:new THREE.Scene(),lamps:[],view:{target:new THREE.Vector3(),zoom:12},key:{shadow:{camera:{updateProjectionMatrix(){}}}},applyView(){},setTime(){},night:0};}
export function reachable(room){
  const [i,j]=room.nearestFree(room.spec.spawn.x,room.spec.spawn.z),n=room.nav,seen=new Set(),q=[[i,j]];
  for(let k=0;k<q.length;k++){const [x,z]=q[k],key=z*n.nx+x;if(seen.has(key)||!room.free(x,z))continue;seen.add(key);for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])q.push([x+dx,z+dz]);}
  return seen;
}
