import * as THREE from 'three';
import {CITY_NEIGHBOURHOODS,CITY_LINKS,worldLocations} from '../../../../../shared/world-locations.js';
import {CityKit,disposeBatch} from './kit.js';
import {SCALE,seeded} from './geography.js';
import {buildLandmarks} from './landmarks.js';
import {buildPlots,buildAdField,disposeField,cityBounds,widthOf,PLOT,AD} from './estates.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

// Blender landmark models (world/scripts/build_landmarks.py). index.json lists the ids that exist;
// each model replaces its procedural stand-in once loaded, at the same place and scale.
const LANDMARK_URL='/assets/world/landmarks/';
let landmarkIndex=null;
const landmarkIds=()=>landmarkIndex||=fetch(LANDMARK_URL+'index.json').then(r=>r.ok?r.json():{ids:[]}).then(j=>new Set(j.ids||[])).catch(()=>new Set());

const SPECIAL=new Set(['blackstar','memorial','lighthouse','circle','makola','kantamanto','stadium','ug','airport','mall','castle']);
const PALETTES={historic:['#e07a5f','#f4a261','#e76f51'],compound:['#f59e0b','#ea580c','#d97706'],
  commercial:['#ec4899','#f97316','#06b6d4'],mixed:['#f43f5e','#3b82f6','#10b981'],
  coastal:['#06b6d4','#38bdf8','#fb923c'],modern:['#0284c7','#6366f1','#14b8a6'],
  established:['#10b981','#059669','#3b82f6'],office:['#2563eb','#0891b2','#0d9488'],
  industrial:['#d97706','#0284c7','#7c3aed'],campus:['#16a34a','#2563eb','#e11d48'],transport:['#ea580c','#eab308','#0284c7']};

export class CompactCity {
  constructor(cat){
    const start=performance.now();this.locations=worldLocations(cat);this.kit=new CityKit();this.group=new THREE.Group();
    const p=this.kit.batch(),scale=1/SCALE;
    const box=(x,y,z,w,h,d,c,a=0)=>p.box(x*scale,y*scale,z*scale,w*scale,h*scale,d*scale,c,a);
    this.bounds=[-26,42,-32,23];
    box(8,-.16,-5,70,.12,58,'#7ea06b');
    box(8,-.19,24,78,.12,14,'#0ea5e9');box(8,-.10,19.8,72,.08,2.3,'#fbbf24');
    // Connected authored corridors, with curbs, central markings and crossings.
    for(const [from,to] of CITY_LINKS){
      const a=CITY_NEIGHBOURHOODS.find(n=>n.id===from),b=CITY_NEIGHBOURHOODS.find(n=>n.id===to);
      const x=(a.x+b.x)/2,z=(a.z+b.z)/2,len=Math.hypot(b.x-a.x,b.z-a.z),angle=-Math.atan2(b.z-a.z,b.x-a.x);
      box(x,-.055,z,len, .04,.85,'#cbd5e1',angle);box(x,-.025,z,len,.025,.59,'#334155',angle);
      const dx=(b.x-a.x)/len,dz=(b.z-a.z)/len;
      for(let t=1;t<len;t+=1.4)box(a.x+dx*t,.004,a.z+dz*t,.5,.009,.035,'#fef08a',angle);
    }
    this.decorativeBuildings=0;this.interactiveBuildings=this.locations.filter(l=>l.visual.interactive).length;this.targets=new Map();
    const building=(x,z,family,seed,prominent=false,id='')=>{
      const random=seeded(seed),colors=PALETTES[family]||PALETTES.mixed;
      const office=family==='office',modern=['modern','office'].includes(family),compound=['compound','historic','coastal'].includes(family);
      const w=prominent?1.65:1.15+random()*.4,d=prominent?1.5:1.0+random()*.25,floors=office?3+Math.floor(random()*3):modern?2+Math.floor(random()*2):compound?1:2;
      const floor=.40,height=floors*floor,wall=colors[Math.floor(random()*colors.length)];
      box(x,-.018,z,w+.30,.035,d+.40,'#a3b899');
      if(compound){
        // Open courts and separate wings distinguish compound/coastal housing
        // from the flat-roofed apartments and offices elsewhere in the city.
        for(const [dx,dz,bw,bd] of [[0,-d*.34,w,d*.32],[-w*.35,d*.10,w*.30,d*.70],[w*.35,d*.10,w*.30,d*.70]]){
          box(x+dx,0,z+dz,bw,height,bd,wall);p.add('hip',(x+dx)*scale,(height+.10)*scale,(z+dz)*scale,(bw+.10)*scale,.20*scale,(bd+.10)*scale,'#ea580c');
        }
      }else box(x,0,z,w,height,d,wall);
      if(!compound)box(x,height,z,w+.13,.065,d+.13,modern?'#60a5fa':'#c2410c');
      if(!modern&&!compound){p.add('hip',x*scale,(height+.17)*scale,z*scale,(w+.23)*scale,.34*scale,(d+.22)*scale,'#ea580c');}
      else if(modern){box(x,height+.065,z-d/2,w,.1,.07,wall);box(x,height+.065,z+d/2,w,.1,.07,wall);}
      // Recessed glazing, sill bands, entrance canopy and shaded veranda.
      for(let row=0;row<floors;row++)for(const side of [-1,1])for(const col of [-1,1]){
        const face=side===1&&compound?d*.45:d/2;
        box(x+col*w*.27,row*floor+.12,z+side*(face+.014),w*.21,.21,.032,'#38bdf8');
        box(x+col*w*.27,row*floor+.10,z+side*(face+.025),w*.25,.026,.07,'#fef08a');
      }
      const doorway=compound?-d*.18:d/2;
      box(x,0,z+doorway+.025,.24,.34,.055,'#415b51');box(x,.35,z+doorway+.12,.52,.06,.35,wall);
      if(prominent){
        box(x,.44,z+d/2+.045,w*.83,.18,.035,office?'#31565c':'#386854');
        for(const side of [-1,1])box(x+side*w*.41,0,z+d/2+.25,.04,.47,.04,'#929d88');
        box(x,.005,z+d/2+.35,.56,.015,.36,'#cfc7af');
      }
      if(family==='mixed'||family==='modern'){
        box(x,.48,z+d/2+.1,w+.08,.055,.25,'#c8cbb9');box(x,.55,z+d/2+.2,w,.16,.025,'#697d70');
      }
      if(family==='established'||family==='modern'){
        box(x,0,z-d/2-.20,w+.45,.23,.06,'#bbbba4');
        for(const side of [-1,1])box(x+side*(w/2+.20),0,z,.06,.23,d+.4,'#bbbba4');
      }
      if(id==='hotel')box(x,height+.065,z,.40,.4,.40,'#8d9a8f');
      return {w:w+.24,d:d+.35,h:height+.5};
    };
    for(const node of CITY_NEIGHBOURHOODS){
      const locations=this.locations.filter(l=>l.neighbourhood===node.id);
      const occupied=locations.map(l=>[l.playable.x,l.playable.z]);
      for(const l of locations){
        if(l.type==='street'||l.type==='estate'){
          const {x,z}=l.playable;box(x,0,z,1.7,.04,1.6,'#c3bfa6');
          for(const side of [-1,1])box(x+side*.65,0,z,.12,.65,.12,'#ccc9b3');
          box(x,.65,z,1.55,.13,.18,l.type==='estate'?'#556f62':'#8c8b73');
          this.targets.set(l.id,{w:1.7,d:1.6,h:.8});
        }else if(!SPECIAL.has(l.id))this.targets.set(l.id,building(l.playable.x,l.playable.z,node.family,l.id,l.type==='venue',l.id));
        // Every public building points at its real destination. Housing templates
        // are labelled examples, never advertised as unowned property units.
      }
      for(let a=-2;a<=2;a++)for(const b of [-1,1]){
        if(a===0)continue; // keep the north/south public corridor clear
        const x=node.x+a*2.05,z=node.z+b*4.9;
        if(occupied.some(q=>Math.hypot(x-q[0],z-q[1])<2.0))continue;
        building(x,z,node.family,node.id+':'+a+':'+b);this.decorativeBuildings++;
      }
      // Frontage paths and planted edges keep background architecture subordinate.
      for(const side of [-1,1])box(node.x,-.03,node.z+side*3.9,11.2,.025,.32,'#b7b9a0');
      for(const side of [-1,1])for(const col of [-1,1]){
        const x=node.x+side*5.7,z=node.z+col*4.5;
        box(x,0,z,.065,.65,.065,'#82785b');p.add('tree',x*scale,.80*scale,z*scale,.50*scale,.50*scale,.50*scale,'#718d65');
      }
      for(const l of locations){if(!SPECIAL.has(l.id))continue;
        const group=buildLandmarks(this.kit,[{id:l.id,x:l.playable.x/(SCALE*4),z:l.playable.z/(SCALE*4)}]);group.scale.setScalar(4);this.group.add(group);
        this.upgradeLandmark(l.id,l.playable.x/(SCALE*4),l.playable.z/(SCALE*4),group);
        this.targets.set(l.id,{w:l.id==='airport'?3.2:2.6,d:2.2,h:1.4});
      }
    }
    this.batch=p.finish();this.group.add(this.batch);
    // Player estates and the advertising field sit on open land beyond the mapped places, so they never
    // cover a destination. Both are instanced; the advert artwork arrives later with setAds().
    const b=cityBounds(this.locations),margin=3;
    this.plotOrigin={x:b.maxX+margin,z:b.minZ};
    this.adOrigin={x:b.minX-margin-widthOf(AD),z:b.minZ};
    this.plots=buildPlots(this.plotOrigin,'accra');this.group.add(this.plots);
    this.districts=CITY_NEIGHBOURHOODS.map(n=>({...n,x:n.x/SCALE,z:n.z/SCALE,radius:900,secondary:n.family,provenance:'Authored schematic presentation; original geographic map retained'}));
    this.readyMs=performance.now()-start;
  }
  // Live billboard artwork for the advertising field (CityMap.setBillboards).
  setAds(slots,renderer){
    if(this.disposed)return;
    disposeField(this.adField);
    this.adField=buildAdField(this.adOrigin,slots,renderer);
    this.group.add(this.adField);
  }
  async upgradeLandmark(id,x,z,stand){
    if(!(await landmarkIds()).has(id)||this.disposed)return;
    try{
      const gltf=await new GLTFLoader().loadAsync(LANDMARK_URL+id+'.glb');if(this.disposed||!stand.parent)return;
      const model=new THREE.Group();model.scale.setScalar(4*SCALE);model.userData.glb=true;model.name='landmark-'+id;   // metres, scaled like the kit batch
      gltf.scene.position.set(x,0,z);gltf.scene.scale.setScalar(1.8);   // landmarks read larger than the houses round them
      gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});model.add(gltf.scene);
      stand.removeFromParent();disposeBatch(stand);this.group.add(model);
    }catch{/* keep the procedural stand-in */}
  }
  dispose(){if(this.disposed)return;this.disposed=true;disposeField(this.adField);this.adField=null;disposeField(this.plots);this.plots=null;for(const group of [...this.group.children]){if(group.userData.glb){group.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [o.material].flat())m.dispose();}});group.removeFromParent();}else disposeBatch(group);}this.group.removeFromParent();this.group.clear();this.kit.dispose();}
  pick(ray){
    const hit=new THREE.Vector3(),bounds=new THREE.Box3();let nearest=null,distance=Infinity;
    for(const place of this.locations){
      if(!place.visual.interactive)continue;
      const {x,z}=place.playable,shape=this.targets.get(place.id);bounds.min.set(x-shape.w/2,0,z-shape.d/2);bounds.max.set(x+shape.w/2,shape.h,z+shape.d/2);
      if(ray.intersectBox(bounds,hit)){const d=ray.origin.distanceToSquared(hit);if(d<distance){nearest=place;distance=d;}}
    }
    return nearest?.id||null;
  }
  stats(){return {destinations:this.locations.length,interactiveBuildings:this.interactiveBuildings,decorativeBuildings:this.decorativeBuildings,readyMs:this.readyMs};}
}
