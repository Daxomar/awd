import * as THREE from 'three';
import { buildingBase, disposeBatch } from './kit.js';
import { FAMILIES } from './districts.js';
import { SCALE } from './geography.js';

// One city batch for overview; fixed spatial batches for close-up frustum culling.
// Both reuse the same templates and deterministic plan. No regenerating on zoom.
export class CityFoundation {
  constructor(kit, buildings) {
    this.group = new THREE.Group(); this.regions = new THREE.Group();this.regionList=[];
    const positions = new Float32Array(buildings.length*3), colors=new Float32Array(buildings.length*3), tint=new THREE.Color(), regions = new Map();
    for (const [i,p] of buildings.entries()) {
      positions.set([p.x*SCALE,p.h*SCALE,p.z*SCALE],i*3);tint.set(FAMILIES[p.family].wall).multiplyScalar(.8);colors.set([tint.r,tint.g,tint.b],i*3);
      const key = `${Math.floor(p.x / 1000)},${Math.floor(p.z / 1000)}`;
      if (!regions.has(key)) regions.set(key, kit.batch()); buildingBase(regions.get(key), p);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    this.overview=new THREE.Points(geometry,new THREE.PointsMaterial({size:1.6,sizeAttenuation:false,vertexColors:true}));
    for (const [key,parts] of regions){const group=parts.finish(),[x,z]=key.split(',').map(Number);this.regions.add(group);this.regionList.push({group,x:(x+.5)*1000*SCALE,z:(z+.5)*1000*SCALE});}
    this.group.add(this.overview, this.regions); this.update(100);
  }
  update(zoom,x=0,z=0,aspect=1) {
    this.overview.visible=zoom>25;this.regions.visible=zoom<=25;
    if(this.regions.visible){const radius=zoom*Math.max(1,aspect)*1.1+1000*SCALE;for(const r of this.regionList)r.group.visible=Math.abs(r.x-x)<radius&&Math.abs(r.z-z)<radius;}
  }
  dispose() { this.overview.geometry.dispose();this.overview.material.dispose();this.overview.removeFromParent();for (const g of [...this.regions.children]) disposeBatch(g); this.group.removeFromParent(); this.group.clear();this.regionList=[]; }
}
