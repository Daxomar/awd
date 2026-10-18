// Geographic presentation never writes player locations or travel rules.
import * as THREE from 'three';
import { h, sheet } from '../ui/dom.js';
import { display, SCALE, cameraLimits, overviewFrame, clamp } from './city/geography.js';
import { resolveDistricts, FAMILIES } from './city/districts.js';
import { decodeBlueprint } from './city/blueprint.js';
import { CityKit, disposeBatch } from './city/kit.js';
import { CityFoundation } from './city/foundation.js';
import { buildTerrain, disposeTerrain } from './city/terrain.js';
import { landmarkInventory, buildLandmarks } from './city/landmarks.js';
import { DetailChunks } from './city/chunks.js';
import { clusterMarkers,pinPosition } from './city/markers.js';
import { CityAds } from './city/ads.js';
import {CompactCity} from './city/compact.js';
import {playableAnchor,CITY_NEIGHBOURHOODS} from '../../../../shared/world-locations.js';
import './city/map.css';

export class CityMap {
  constructor(stage, ui) {
    this.stage = stage; this.ui = ui; this.group = new THREE.Group(); this.group.visible = false; stage.scene.add(this.group);
    this.pins = new Map(); this.labels = []; this.filter = 'all'; this.built = false; this.disposed = false; this.ads = new CityAds(this.group); this.cars = [];
    this.mode='compact';this.geoGroup=new THREE.Group();this.geoGroup.visible=false;this.group.add(this.geoGroup);
  }
  get boards() { return this.ads.boards; }
  build(cat) {
    if (this.built) return; this.built = true; this.cat = cat;
    this.slots = new Map([...cat.locs, ...Object.entries(cat.homes).map(([id, home]) => ({ ...home, id: `h:${id}` }))].map(it => [it.id, { ...it, px: it.x * SCALE, pz: it.z * SCALE }]));
    this.status = h('div.city-loading', { role: 'status',hidden:true }, 'Preparing Greater Accra…');
    this.credit = h('a.city-credit', { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener noreferrer' }, '© OpenStreetMap contributors · ODbL');
    this.controls = h('div.city-controls', { 'aria-label': 'Map navigation' },
      h('button', { 'aria-label': 'City overview', onclick: () => this.overview() }, 'icon:globe-hemisphere-west', 'City'),
      h('button', { 'aria-label': 'Return to current location', onclick: () => { if (this.current) this.focus(...this.current,this.normalZoom); } }, 'icon:crosshair', 'Here'),
      h('button', { onclick: () => this.directory() }, 'icon:magnifying-glass', 'Places'),
      h('button', { 'aria-label': 'Explore districts', onclick: () => this.directory(true) }, 'icon:buildings', 'Districts'));
    this.ui.append(this.controls, this.credit, this.status);
    this.modeButton=h('button.city-mode',{onclick:()=>this.setMode(this.mode==='compact'?'geographic':'compact'),'aria-label':'Geographic map'},'icon:map-trifold','Geographic map');
    this.controls.append(this.modeButton);
    this.compact=new CompactCity(cat);this.group.add(this.compact.group);this.readyMs=this.compact.readyMs;this.ready=true;
    this.applyMode();this.terrainReady=Promise.resolve();
  }
  async setMode(mode){
    if(this.disposed||!['compact','geographic'].includes(mode))return;
    this.mode=mode;this.transition=null;
    if(mode==='compact'&&this.geoReady)this.releaseCity();
    this.applyMode();
    if(mode==='geographic'&&!this.geoReady){
      this.status.hidden=false;this.status.textContent='Loading geographic map…';
      if(!this.geoLoading)this.geoLoading=this.load().catch(error=>{
        if(this.disposed)return;this.status.replaceChildren(document.createTextNode('Geographic map could not load. '),h('button',{onclick:()=>this.setMode('geographic')},'Retry'));console.error('City map:',error);
      }).finally(()=>{this.geoLoading=null;});
      this.terrainReady=this.geoLoading;await this.geoLoading;
    }
  }
  applyMode(){
    if(!this.compact||this.disposed)return;
    const compact=this.mode==='compact';this.compact.group.visible=compact;this.geoGroup.visible=!compact;
    this.districts=compact?this.compact.districts:this.geoDistricts||[];
    this.limits=compact?{bounds:this.compact.bounds,min:2.4,max:210}:this.geoLimits;
    const records=compact?this.compact.locations.map(l=>({id:l.id,px:l.playable.x,pz:l.playable.z})):this.landmarks?.map(l=>({id:l.id,px:l.x*SCALE,pz:l.z*SCALE}));
    for(const l of records||[])if(this.slots.has(l.id))Object.assign(this.slots.get(l.id),l);
    if(!compact&&!this.geoReady)for(const l of this.slots.values()){l.px=l.x*SCALE;l.pz=l.z*SCALE;}
    this.modeButton.textContent=compact?'Region':'City view';this.modeButton.setAttribute('aria-label',compact?'Geographic map':'Compact city');
    this.credit.textContent=compact?'Schematic city · travel uses real geographic distances':'© OpenStreetMap contributors · ODbL';
    this.credit.href=compact?'#':'https://www.openstreetmap.org/copyright';
    this.status.hidden=compact||!!this.geoReady;
    for(const l of this.labels)l.el.remove();this.labels=[];
    for(const d of this.districts){const el=h('div.city-district-label',null,d.name);this.ui.append(el);this.labels.push({el,...d,x:d.x*SCALE,z:d.z*SCALE,type:'district'});}
    if(!compact){const named=new Map();for(const road of this.terrain?.roadLabels||[])if(!named.has(road.name)||road.priority>named.get(road.name).priority)named.set(road.name,road);
      for(const road of named.values()){const el=h('div.city-road-label',null,road.name);this.ui.append(el);this.labels.push({el,name:road.name,x:road.p[0]*SCALE,z:road.p[1]*SCALE,priority:road.priority,type:'road'});}}
    this.positionBoards();
    if(this.group.visible){this.applyLimits();this.current=this.slotOf(this.currentId)||this.current;this.setPins(this.pinList||[],this.onPick);if(this.current)this.focus(...this.current,this.normalZoom);else this.overview();}
  }
  positionBoards(){for(const b of this.ads.boards){const s=b.slot;if(this.mode==='compact'){
    const point=playableAnchor(this.compact.locations,s.x,s.z),place=this.compact.locations.find(l=>l.playable.x===point[0]&&l.playable.z===point[1]),node=CITY_NEIGHBOURHOODS.find(n=>n.id===place?.neighbourhood);
    b.root.position.set(point[0]+(Math.sign(point[0]-(node?.x||0))||1)*1.05,.006,point[1]+(Math.sign(point[1]-(node?.z||0))||1)*1.1);b.root.scale.setScalar(6.0);
  }else{const [x,z]=display(s.x,s.z),offset=s.offset||[-.18,-.18];b.root.position.set(x+offset[0],.006,z+offset[1]);b.root.scale.setScalar(1.6);}}}
  async load() {
    if(this.kit)this.releaseCity();
    const start = performance.now();
    const [data, anchors, blueprint] = await Promise.all(['/assets/greater-accra.json', '/assets/district-anchors.json', '/assets/city-blueprint.json'].map(async url => { const r = await fetch(url); if (!r.ok) throw new Error(`City data ${r.status}`); return r.json(); })); this.fetchMs=performance.now()-start;
    if (this.disposed||this.mode!=='geographic') return;
    this.data = data; this.geoDistricts = resolveDistricts(data, anchors); this.geoLimits = cameraLimits(data.boundsMeters); this.kit = new CityKit();
    this.landmarks = landmarkInventory(this.cat, data, this.geoDistricts);
    const terrainStart=performance.now(); this.terrain = buildTerrain(data, this.kit); this.geoGroup.add(this.terrain.group); this.terrainMs=performance.now()-terrainStart;
    await new Promise(resolve => requestAnimationFrame(resolve)); if (this.disposed) return;
    if(this.mode!=='geographic'){this.releaseCity();this.applyMode();return;}
    const planStart = performance.now(); this.plan = decodeBlueprint(blueprint); this.planMs = performance.now() - planStart;
    this.foundation = new CityFoundation(this.kit, this.plan.buildings); this.geoGroup.add(this.foundation.group); this.landmarkGroup = buildLandmarks(this.kit, this.landmarks); this.geoGroup.add(this.landmarkGroup);
    this.chunks = new DetailChunks(this.kit, this.geoGroup, this.plan.chunks); this.backgroundPlots = this.plan.buildings.length;
    this.geoReady=true;this.geoReadyMs=performance.now()-start;this.applyMode();
  }
  slotOf(id) { const s = this.slots?.get(id); return s ? [s.px, s.pz] : null; }
  get normalZoom(){return this.mode==='compact'?18:9;}
  realToMap(x, z) { return this.toMap(x,z); }
  toMap(x, z) { return this.mode==='compact'?playableAnchor(this.compact.locations,x,z):display(x,z); }
  setBillboards(slots) { this.ads.set(slots);this.positionBoards();this.compact?.setAds(slots,this.stage.renderer); }
  updateBoards() { this.ads.update(); }
  pickBoard(x, y) { return this.ads.pick(x, y, this.stage); }
  pickDestination(x,y){
    if(this.mode!=='compact')return null;
    const rect=this.stage.renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),this.stage.camera);
    return this.compact.pick(ray.ray);
  }
  setPins(list, onPick) {
    this.pinList = list; this.onPick = onPick;
    for (const p of this.pins.values()) p.el.remove(); this.pins.clear();
    for (const it of list) {
      const el = h('button.pin.small', { 'aria-label': it.name, title: it.name, class: it.cls || '' }, h('span.pb', null, h('span.pe', null, it.ic), h('span.pl', null, it.name), h('span.pc', { hidden: !it.count }, it.count || '')));
      const item=it.id==='home'?{...it,xz:this.slotOf('h:'+it.homeId)}:it;
      const [x,z]=pinPosition(item,id=>this.slotOf(id),(x,z)=>this.toMap(x,z));
      const pin = { el, x, z, it, members: [it] };
      el.onclick = e => { e.stopPropagation(); if (pin.members.length > 1) this.placeList(pin.members); else this.select(it); };
      this.ui.append(el); this.pins.set(it.id, pin);
    }
    this.layoutDirty = true;
  }
  setPresence(counts) { for (const p of this.pins.values()) p.it.count = counts[p.it.id] || 0; this.layoutDirty = true; }
  select(it) { this.selectedId = it.id; this.layoutDirty = true; this.onPick?.(it.id); }
  placeList(items) {
    let panel;
    const rows = items.map(it => h('button.city-place-row', { onclick: () => { panel.close(); this.select(it); } }, h('span', null, it.ic || 'icon:map-pin'), h('span', null, it.name), 'icon:caret-right'));
    panel = sheet(h('div.sheet-body.city-directory', null, ...rows), { title: 'Choose a place', sub: 'Select a destination to see travel options.' });
  }
  directory(districtMode = false) {
    const list = h('div.city-directory-list'), input = h('input', { type: 'search', placeholder: districtMode ? 'Find a district' : 'Find a destination', 'aria-label': districtMode ? 'Find a district' : 'Find a destination' });
    let panel;
    const all = districtMode ? this.districts || [] : [...this.cat.locs, ...(this.pinList || []).filter(p => p.id === 'home')];
    const paint = () => {
      const query = input.value.trim().toLocaleLowerCase(); list.replaceChildren();
      const matches = all.filter(it => `${it.name} ${it.area || ''}`.toLocaleLowerCase().includes(query));
      for (const it of matches) list.append(h('button.city-place-row', { onclick: () => {
        panel.close();
        if (districtMode) this.focusDistrict(it.id,true);
        else { const q = it.id === 'home' ? this.slotOf('h:'+it.homeId) : this.slotOf(it.id); if (q) this.focus(...q,this.normalZoom); this.select(it); }
      } }, h('span', null, districtMode ? 'icon:buildings' : it.ic || 'icon:map-pin'), h('span', null, h('strong', null, it.name), h('small', null, districtMode ? `${FAMILIES[it.family].label}${this.mode==='compact'?' · destinations and streets':' · geographic scenery'}` : it.area || 'Your home')), 'icon:caret-right'));
      if (!matches.length) list.append(h('p', null, 'No matching places.'));
    };
    input.oninput = paint; paint(); panel = sheet(h('div.sheet-body.city-directory', null, input, districtMode ? h('p', null, 'Choose an area to look around. Select a destination icon or use Places to travel.') : null, list), { title: districtMode ? this.mode==='compact'?'City neighbourhoods':'Greater Accra' : 'Destinations', sub: districtMode ? 'Historic coast, connected city, expanding suburbs.' : 'Every venue, street and estate remains available here.' });
  }
  focus(x, z, zoom = 5, smooth = false) {
    const limits = this.limits || { bounds: [-100, 150, -130, 30], min: 2.4, max: 560 }, [x0, x1, z0, z1] = limits.bounds;
    const target = { x: clamp(x, x0, x1), z: clamp(z, z0, z1), zoom: clamp(zoom, limits.min, limits.max) };
    if (smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.transition = { ...target, from: [this.stage.view.target.x, this.stage.view.target.z, this.stage.view.zoom], t: 0 };
    else { this.transition = null; this.stage.view.target.set(target.x, 0, target.z); this.stage.view.zoom = target.zoom; this.stage.applyView(); }
  }
  focusDistrict(id,smooth=false){
    const d=this.districts?.find(d=>d.id===id);if(!d)return;
    const target=id==='tema-industrial'?this.landmarks.find(l=>l.id==='decor:tema-port')||d:d;
    this.districtTitle=d.name;this.focus(target.x*SCALE,target.z*SCALE,this.mode==='compact'?18:5,smooth);
  }
  overview() { if(this.mode==='compact'){const [x0,x1,z0,z1]=this.compact.bounds;this.focus((x0+x1)/2,(z0+z1)/2,Math.max((x1-x0+8)/(this.stage.aspect||1),z1-z0+12),true);return;}if (!this.data) return; const frame = overviewFrame(this.data.boundsMeters, this.stage.aspect); this.focus(frame.x, frame.z, frame.zoom, true); }
  applyLimits() { const st = this.stage; st.bounds = this.limits?.bounds || [-100, 150, -130, 30]; st.zoomMin = 2.4; st.zoomMax = this.limits?.max||560; st.view.dist = 550; st.camera.far = 1400; st.applyView(); }
  show(on) {
    const st = this.stage;
    if (on && !this.group.visible) this.savedView = { dist: st.view.dist, far: st.camera.far, shadows: st.renderer.shadowMap.enabled };
    if (!on && this.group.visible && this.savedView) { st.view.dist = this.savedView.dist; st.camera.far = this.savedView.far; st.renderer.shadowMap.enabled = this.savedView.shadows; this.transition = null; }
    this.group.visible = on; this.ui.hidden = !on;
    if (on) { this.applyLimits(); const sc = st.key.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.far = 80; sc.updateProjectionMatrix(); }
  }
  update(dt) {
    if (!this.group.visible || this.disposed) return;
    const st = this.stage, v = st.view;
    if (this.transition) {
      const t = this.transition; t.t = Math.min(1, t.t + dt / .55); const a = t.t * t.t * (3 - 2 * t.t);
      v.target.set(t.from[0] + (t.x - t.from[0]) * a, 0, t.from[1] + (t.z - t.from[1]) * a); v.zoom = t.from[2] + (t.zoom - t.from[2]) * a; st.applyView(); if (t.t === 1) this.transition = null;
    }
    st.renderer.shadowMap.enabled = v.zoom < 15;
    this.terrain?.waterMaterial?.color.set('#73aeb4').multiplyScalar(.45+.55*(1-st.night));
    if(this.mode==='geographic'){this.foundation?.update(v.zoom,v.target.x,v.target.z,st.aspect);if(this.terrain)this.terrain.localRoads.visible=v.zoom<65;this.chunks?.update(v.target.x,v.target.z,v.zoom);}else{this.compact?.update?.(dt);}this.ads.update(st.camera); this.ads.sample(st); this.layout();
  }
  layout() {
    const viewport=[innerWidth,innerHeight].join(':');
    if(this.safeViewport!==viewport||this.layoutDirty){
      const filters=this.ui.querySelector('.map-filters');
      this.markerTop=Math.max(163,filters?filters.offsetTop+filters.offsetHeight:0);this.safeViewport=viewport;
    }
    const v = this.stage.view, signature = [innerWidth, innerHeight, v.target.x, v.target.z, v.zoom, this.showNames].join(':');
    if (!this.layoutDirty && this.lastLayout === signature) return; this.lastLayout = signature; this.layoutDirty = false;
    const rect = this.ui.getBoundingClientRect(), vec = new THREE.Vector3(), project = (x, z, y = 0) => { vec.set(x, y, z).project(this.stage.camera); return { sx: (vec.x * .5 + .5) * innerWidth - rect.left, sy: (-vec.y * .5 + .5) * innerHeight - rect.top, depth: vec.z }; };
    const width = rect.width, height = rect.height, top = this.markerTop, bottom = 150;
    const input = [...this.pins.values()].map(p => ({ ...project(p.x, p.z, .015), ...p.it, keep: p.it.keep || p.it.id === this.selectedId }));
    const groups = clusterMarkers(input, { width, height, top, bottom, radius: this.showNames ? 190 : 48, inset:this.showNames?100:24 });
    for (const p of this.pins.values()) p.el.hidden = true;
    const occupied = [];
    for (const g of groups) {
      const first = g.items[0], p = this.pins.get(first.id); p.members = g.items; p.el.hidden = false; p.el.style.left = `${g.sx}px`; p.el.style.top = `${g.sy}px`; p.el.classList.toggle('small', !this.showNames); p.el.classList.toggle('selected', g.items.some(it => it.id === this.selectedId));
      p.el.style.setProperty('--city-label-shift',`${clamp(g.sx,127,width-127)-g.sx}px`);
      p.el.setAttribute('aria-label', g.items.length > 1 ? `${first.name} and ${g.items.length - 1} nearby destinations` : first.name);
      const count = p.el.querySelector('.pc'); count.hidden = g.items.length === 1 && !first.count; count.textContent = g.items.length > 1 ? `+${g.items.length - 1}` : first.count || ''; p.el.title = g.items.map(it => it.name).join(' · ');
      occupied.push({ x: g.sx, y: g.sy, w: this.showNames ? 140 : 50, h: 54 });
    }
    const labels = this.labels.map(l => ({ ...l, ...project(l.x, l.z) })).filter(l => l.sx > 42 && l.sx < width - 42 && l.sy > top + 20 && l.sy < height - bottom - 15 && Math.abs(l.depth) <= 1).sort((a, b) => (a.type === 'district' ? -1 : 1) - (b.type === 'district' ? -1 : 1) || (b.radius || b.priority || 0) - (a.radius || a.priority || 0));
    for (const l of this.labels) l.el.hidden = true;
    let shown = 0;
    for (const l of labels) {
      if (l.type === 'road' && (v.zoom > 12 || shown > 6) || shown > (v.zoom > 70 ? 12 : 7)) continue;
      const w = Math.min(180, l.name.length * (l.type === 'district' ? 6.5 : 5.5));
      if (occupied.some(q => Math.abs(l.sx - q.x) < (w + q.w) / 2 + 8 && Math.abs(l.sy - q.y) < (22 + q.h) / 2 + 8)) continue;
      occupied.push({ x: l.sx, y: l.sy, w, h: 22 }); l.el.hidden = false; l.el.style.left = `${l.sx}px`; l.el.style.top = `${l.sy}px`; shown++;
    }
  }
  stats() {
    let bytes = 0, meshes = 0,visibleMeshes=0; const geometries = new Set();this.group.traverseVisible(o=>{if(o.isMesh)visibleMeshes++;});
    this.group.traverse(o => { if (o.isMesh) meshes++; if (o.geometry && !geometries.has(o.geometry)) { geometries.add(o.geometry); for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength; bytes += o.geometry.index?.array.byteLength || 0; } if (o.isInstancedMesh) bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength || 0); });
    return {mode:this.mode,compact:this.compact?.stats(),geographicLoaded:!!this.geoReady,buildings:this.mode==='compact'?this.compact.decorativeBuildings:this.backgroundPlots||0,chunks:this.chunks?.stats(),meshes,visibleMeshes,coarseRegions:this.foundation?.regionList.length,geometryBytes:bytes,readyMs:this.readyMs,geographicReadyMs:this.geoReadyMs,planMs:this.planMs,districts:this.districts?.length,destinations:this.slots.size,adTextures:this.ads.textures.size};
  }
  dispose() {
    if (this.disposed) return; this.show(false); this.disposed = true; this.ads.dispose();this.releaseCity();this.compact?.dispose();this.group.removeFromParent(); this.group.clear(); for (const p of this.pins.values()) p.el.remove(); this.pins.clear(); this.controls?.remove(); this.modeButton?.remove();this.credit?.remove(); this.status?.remove();
  }
  releaseCity(){
    this.ready=!!this.compact&&!this.disposed;this.chunks?.dispose();this.foundation?.dispose();if(this.landmarkGroup)disposeBatch(this.landmarkGroup);if(this.terrain)disposeTerrain(this.terrain.group);this.kit?.dispose();for(const l of this.labels)l.el.remove();this.labels=[];this.foundation=null;this.landmarkGroup=null;this.terrain=null;this.kit=null;this.plan=null;this.data=null;this.landmarks=null;this.districts=null;this.geoDistricts=null;this.geoLimits=null;this.geoReady=false;
  }
}
