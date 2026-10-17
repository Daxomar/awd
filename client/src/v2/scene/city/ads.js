import * as THREE from 'three';
import { display } from './geography.js';
import { buildBoard, setArtwork, prepareTexture, houseAdTexture } from '../billboard-face.js';

// Boards keep at least this share of their size on screen as the map zooms out (visibility for advertisers).
const NEAR = 14, MAX_GROW = 3.2;

export class CityAds {
  constructor(parent) { this.parent = parent; this.boards = []; this.textures = new Map(); this.loader = new THREE.TextureLoader(); this.ray = new THREE.Raycaster(); this.disposed = false; }
  set(slots) {
    if (this.disposed) return;
    const keep = new Set(slots.map(s => s.id));
    for (const b of [...this.boards]) if (!keep.has(b.slot.id)) { this.release(b); this.boards.splice(this.boards.indexOf(b), 1); }
    if (slots.length && !this.house) this.house = houseAdTexture();
    // Remove ground panels under billboards for now; show only prominent standing billboards
    slots = slots.filter(s => s.type !== 'ground');
    for (const slot of slots) {
      let b = this.boards.find(b => b.slot.id === slot.id);
      if (!b) {
        const root = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: '#3b4a45', roughness: .6, metalness: .4 });
        const width = slot.tier === 'MEGA' ? 1.05 : .82, height = width / 2, poleH = .62;
        const board = buildBoard(width, height, { depth: .03 }); board.group.position.y = poleH + height / 2; root.add(board.group);
        for (const x of [-width * .28, width * .28]) { const pole = new THREE.Mesh(new THREE.BoxGeometry(.03, poleH, .03), steel); pole.position.set(x, poleH / 2, -.01); root.add(pole); }
        const [x, z] = display(slot.x, slot.z), offset = slot.offset || [-.18, -.18]; root.position.set(x + offset[0], .006, z + offset[1]); root.rotation.y = slot.yaw || 0;
        b = { root, board, face: board.face, cur: null, seed: [...slot.id].reduce((n, c) => n + c.charCodeAt(0), 0) }; this.parent.add(root); this.boards.push(b);
      }
      b.slot = slot; b.ads = slot.live || []; b.cur = null;
    }
    this.update();
  }
  update(camera) {
    if (this.disposed) return;
    const now = Date.now();
    for (const b of this.boards) {
      if(camera&&b.slot.type!=='ground'){b.root.rotation.y=Math.atan2(camera.position.x-b.root.position.x,camera.position.z-b.root.position.z);b.root.scale.setScalar(Math.min(MAX_GROW,Math.max(1,camera.position.distanceTo(b.root.position)/NEAR)));}
      const live=b.ads.filter(a=>+a.ends>now);
      const ad = live.length ? live[(Math.floor(now / ((b.slot.rotate || 15) * 1000)) + b.seed) % live.length] : null;
      if(b.previewMode)continue;
      const key = ad ? `${ad.id}:${ad.img}` : ''; if (key === b.cur) continue; b.cur = key; b.ad = ad;
      let texture = this.house;
      if (ad) {
        if (!this.textures.has(key)) {
          const t = this.loader.load(ad.img, loaded => {
            if (this.disposed || !this.textures.has(key)) { loaded.dispose(); return; }
            if (b.cur === key) setArtwork(b.board, loaded);
          }, undefined, () => {
            this.textures.delete(key);
            if (b.cur === key) setArtwork(b.board, this.house);
          });
          prepareTexture(t); this.textures.set(key, t);
        }
        texture = this.textures.get(key); this.textures.delete(key); this.textures.set(key, texture);
      }
      setArtwork(b.board, texture);
    }
    const active = new Set(this.boards.map(b => b.cur));
    while (this.textures.size > Math.max(24, this.boards.length)) {
      const key = [...this.textures.keys()].find(k => !active.has(k)); if (!key) break;
      this.textures.get(key).dispose(); this.textures.delete(key);
    }
  }
  preview(id,image){
    this.clearPreview();const b=this.boards.find(b=>b.slot.id===id);if(!b)return false;
    b.previewMode=true;this.previewing=true;
    if(image){const t=prepareTexture(this.loader.load(image,(loaded)=>{if(b.preview===loaded)setArtwork(b.board,loaded);}));b.preview=t;setArtwork(b.board,t);}
    return true;
  }
  clearPreview(){this.previewing=false;for(const b of this.boards)if(b.previewMode){b.preview?.dispose();b.preview=null;b.previewMode=false;b.cur=null;}this.update();}
  sample(stage){
    const now=performance.now();if(now-(this.sampleAt||0)<500)return;this.sampleAt=now;
    if(this.previewing||document.hidden||document.querySelector('.phone-back:not([hidden]),.sheet-back')){this.seen=new Map();return;}
    this.seen||=new Map();this.sent||=new Map();
    const rect=stage.renderer.domElement.getBoundingClientRect(),camera=stage.camera;
    this.parent.updateWorldMatrix(true,true);camera.updateWorldMatrix(true,false);
    let occluders,checks=0;const sampleStart=performance.now();
    for(const b of this.boards){
      const ad=b.ad,key=ad&&`${ad.id}:${Math.floor(Date.now()/900000)}`;
      if(!ad||+ad.ends<=Date.now()||b.preview||this.sent.has(key))continue;
      const artwork=b.face.material.map?.image;
      if(!artwork?.complete||!artwork.naturalWidth){this.seen.delete(key);continue;}
      const center=b.face.getWorldPosition(new THREE.Vector3()),normal=new THREE.Vector3(0,0,1).transformDirection(b.face.matrixWorld),toCamera=camera.position.clone().sub(center);
      if(normal.dot(toCamera)<=0){this.seen.delete(key);continue;}
      const p=b.face.geometry.parameters,points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>new THREE.Vector3(x*p.width/2,y*p.height/2,0).applyMatrix4(b.face.matrixWorld).project(camera));
      if(points.some(v=>Math.abs(v.x)>1||Math.abs(v.y)>1||Math.abs(v.z)>1)){this.seen.delete(key);continue;}
      const pixels=Math.abs(points.reduce((a,p,i)=>{const q=points[(i+1)%points.length];return a+p.x*q.y-q.x*p.y;},0))*rect.width*rect.height/8;
      if(pixels<400){this.seen.delete(key);continue;}
      if(checks++>=2)continue;
      if(!occluders){occluders=[];this.parent.traverseVisible(o=>{if(o.isMesh)occluders.push(o);});}
      // Terrain below all three targets cannot intersect a ray from this elevated
      // camera. Exclude it before triangle tests against the merged road geometry.
      const minY=Math.min(...[[0,0],[-.3,-.3],[.3,.3]].map(([x,y])=>new THREE.Vector3(x*p.width,y*p.height,0).applyMatrix4(b.face.matrixWorld).y));
      const targets=camera.position.y>minY?occluders.filter(o=>{
        if(o.isInstancedMesh)return true;
        if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
        return !o.geometry.boundingBox||o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).max.y>=minY;
      }):occluders;
      // Test center and two opposite inner corners against rendered city geometry.
      let clear=0;
      for(const [x,y] of [[0,0],[-.3,-.3],[.3,.3]]){
        const target=new THREE.Vector3(x*p.width,y*p.height,0).applyMatrix4(b.face.matrixWorld);
        const projected=target.clone().project(camera);this.ray.setFromCamera(new THREE.Vector2(projected.x,projected.y),camera);
        const sx=rect.left+(projected.x*.5+.5)*rect.width,sy=rect.top+(-projected.y*.5+.5)*rect.height;
        if(document.elementsFromPoint(sx,sy).some(el=>el.closest('button,a,input,select,textarea,[role="dialog"]')))continue;
        this.ray.far=this.ray.ray.origin.distanceTo(target)+.01;
        const hit=this.ray.intersectObjects(targets,false)[0];if(hit?.object===b.face)clear++;
      }
      this.ray.far=Infinity;
      if(clear<2){this.seen.delete(key);continue;}
      const prior=this.seen.get(key),start=prior&&now-prior.last<1500?prior.start:now;this.seen.set(key,{start,last:now});
      if(now-start>=2000){
        this.sent.set(key,now);fetch('/api/ads/exposure',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({campaign:ad.id,placement:b.slot.id,kind:'impression',seconds:Math.min(60,(now-start)/1000),pixels:Math.round(pixels)})}).then(r=>{if(!r.ok)this.sent.delete(key);}).catch(()=>this.sent.delete(key));
      }
    }
    for(const [key,at] of this.sent)if(now-at>900000)this.sent.delete(key);
    for(const [key,v] of this.seen)if(now-v.last>2000)this.seen.delete(key);
    this.exposureStats={lastMs:performance.now()-sampleStart,maxMs:Math.max(this.exposureStats?.maxMs||0,performance.now()-sampleStart),samples:(this.exposureStats?.samples||0)+1,occluders:occluders?.length||0};
  }
  pick(x, y, stage) {
    const r = stage.renderer.domElement.getBoundingClientRect(); this.ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1), stage.camera);
    return this.boards.find(b => this.ray.intersectObject(b.face, false).length) || null;
  }
  release(b) { b.preview?.dispose();const materials = new Set(); b.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); materials.add(o.material); } }); for (const m of materials) m.dispose(); b.root.removeFromParent(); }
  dispose() { if (this.disposed) return;this.clearPreview(); this.disposed = true; for (const b of this.boards) this.release(b); this.boards = []; for (const t of this.textures.values()) t.dispose(); this.textures.clear(); this.house?.dispose(); }
}
