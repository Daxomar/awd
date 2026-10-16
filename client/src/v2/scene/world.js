// Room view controller: builds the cutaway room for the current place, keeps everyone in it in sync with the server,
// drives my avatar (walk, use furniture, pose), name tags, chat bubbles and the gem.
import * as THREE from 'three';
import { h as node } from '../ui/dom.js';
import { Room } from './room.js';
import { VENUES, placeNpc } from './venues.js';
import { homeSpec } from './homes.js';
import { fitRoom } from './frame.js';
import { Avatar } from './avatars.js';
import { G, accraNow } from '../store.js';
import { streetSpec, extraVenue } from './neighbourhood.js';
import { fitLook } from '../fits.js';
import { connectedStreetSpec,streetArrivalYaw } from './connected-streets.js';
import { nearestStreetSegment } from '../../../../shared/local-streets.js';
import {WORKPLACES} from '../../../../shared/workplaces.js';

const h = (cls, txt) => { const e = document.createElement('div'); e.className = cls; if (txt != null) e.textContent = txt; return e; };
export class World {
  constructor(stage, tagsEl) { this.stage = stage; this.tagsEl = tagsEl; this.room = null; this.others = new Map(); this.bubbles = []; this.ray = new THREE.Raycaster(); this.v = new THREE.Vector3();
    this.defaultYaw=stage.view.yaw;
    this.onResize=()=>{
      if(!this.room?.group.visible||this.stage.override)return;
      const zoom=this.stage.view.zoom,target=this.stage.view.target.clone(),previousFit=this.fitZoom;
      this.fitZoom=fitRoom(this.stage,this.spec);
      const scale=this.fitZoom/previousFit;
      this.baseZoom*=scale;this.stage.view.zoom=zoom*scale;this.stage.view.target.copy(target);
      this.stage.zoomMin=this.baseZoom*.45;this.stage.zoomMax=this.baseZoom*1.35;this.stage.applyView();
    };
    globalThis.addEventListener?.('resize',this.onResize);
  }
  get spec() { return this.room && this.room.spec; }
  clear() {
    this.clearSelection();this.hideGem();
    if (this.room) { for (const id of [...this.room.people.keys()]) this.room.removePerson(id); this.room.dispose(); }
    this.room = null; this.others.clear(); this.tagsEl.innerHTML = ''; this.bubbles = []; this.gemObj = null; this.npcs = [];
  }
  // build the room for a server 'room' message
  enter(msg, meLook, meName) {
    const wasLocal=this.spec?.localNetwork;
    this.clear(); this.place = msg.place; this.msg = msg;this.custody=!!msg.custody;
    let spec = null;
    if (msg.home) spec = homeSpec(msg.home.id || 'nima', msg.home.items || {}); else if(msg.place.startsWith('n:'))spec=connectedStreetSpec(msg.place.slice(2),G.cat.locs);else if(msg.place.startsWith('e:')){const home=G.cat.homes[msg.place.slice(2)];spec=streetSpec(home?.area||'Accra',true);}else spec = extraVenue(msg.place)||VENUES[msg.place];
    if (!spec) spec = VENUES.circle;
    spec = structuredClone(spec);
    for(const [id,c] of Object.entries(G.cat.careers))if(c.at===msg.place){
      const w=WORKPLACES[id];let item=0,best=Infinity;
      spec.items.forEach((it,i)=>{const d=Math.hypot(it.x-w.x,it.z-w.z);if(d<best){best=d;item=i;}});
      spec.zones.push({id:'work-'+id,label:w.label,icon:'ph-briefcase',item,acts:[],work:id});
    }
    if(msg.home?.mine){const item=spec.items.length,sp=spec.spawn||{x:0,z:0};spec.items.push({kind:'doormat',x:sp.x,z:sp.z,label:'Home door'});spec.zones.push({id:'exit',label:'Walk outside',icon:'ph-person-simple-walk',item,acts:[],route:'neighbourhood'});}
    if(msg.place==='n:'+G.state.home){const item=spec.items.findIndex(it=>it.localHome);spec.items[item].label='HOME ENTRANCE';spec.zones.push({id:'home',label:'Go indoors',icon:'ph-house',item,acts:[],route:'home'});}
    const returning=G.state.streetReturn;
    if(returning?.venue===msg.place&&/^n:/.test(returning.place)&&G.cat.homes[returning.place.slice(2)]){
      const item=spec.items.length;spec.items.push({kind:'doormat',...spec.spawn,label:'Street entrance'});
      spec.zones.push({id:'street-return',label:'Return to '+G.cat.homes[returning.place.slice(2)].area+' streets',icon:'ph-door-open',item,acts:[],route:'venue',destination:returning.place});
    }
    if(msg.street&&msg.street.network===msg.place.slice(2)&&Number.isFinite(msg.street.x)&&Number.isFinite(msg.street.z))spec.spawn={x:msg.street.x,z:msg.street.z};
    if(spec.localNetwork)this.stage.view.yaw=streetArrivalYaw(spec.localNetwork,spec.spawn,this.defaultYaw);
    else if(wasLocal)this.stage.view.yaw=this.defaultYaw;
    this.elapsed=0;
    if(this.custody)spec.spawn={x:-2.8,z:-2.4};
    const room = (this.room = new Room(this.stage).build(spec));
    this.fitZoom=fitRoom(this.stage, spec); if(spec.neighbourhood){this.stage.view.zoom=spec.localNetwork?23:40;this.stage.view.target.set(spec.spawn.x,.8,spec.spawn.z);}this.stage.applyView(); this.baseZoom = this.stage.view.zoom; this.stage.zoomMin = this.baseZoom * 0.45; this.stage.zoomMax = this.baseZoom * 1.35;
    this.stage.bounds = [-spec.w / 2, spec.w / 2, -spec.d / 2, spec.d / 2];
    this.itemZone = new Map(); for (const z of spec.zones || []) if (!this.itemZone.has(z.item)) this.itemZone.set(z.item, z);
    // A television and its sofa, or a cooker and its counter, share one activity.
    const related = { tv: ['tv'], laptop: ['code'], desk: ['code'], cooker: ['cook'], gas: ['cook'], coal: ['cook'], shower: ['bath'], bucket: ['bath'], toilet: ['toilet'], guitar: ['guitar'], dumbbell: ['workout'], bed: ['sleep', 'nap'] };
    spec.items.forEach((item, index) => { if (this.itemZone.has(index)) return; const ids = Object.entries(related).find(([prefix]) => item.kind.includes(prefix))?.[1]; const zone = ids && spec.zones.find(z => z.acts.some(id => ids.includes(id))); if (zone) this.itemZone.set(index, zone); });
    // NPCs (staff and locals)
    this.npcs = [];
    (spec.npcs || []).forEach((n, i) => { const id = 'npc' + i; const P = placeNpc(room, n); room.addPerson(id, new Avatar(n.look), P.x, P.z, { label: n.label, npc: true }); room.placeAt(id, P.x, P.z, P.yaw, P.pose, P.y); this.npcs.push(id); const person=room.people.get(id);person.schedule=n;person.nextMove=2+i*2;person.patrolIndex=1;this.tag(id, n.label, 'npc'); });
    // me: enter at the door and walk a few steps in
    const sp = this.custody?spec.spawn:room.spawn; const meAv = new Avatar(meLook || {}); meAv.baseLook = meLook; const me = room.addPerson('me', meAv, sp.x, sp.z, { label: meName });
    this.tag('me', meName, 'me');
    const [fi, fj] = room.nearestFree(sp.x * 0.55 + (Math.random() - 0.5) * 2.4, sp.z * 0.55 + (Math.random() - 0.5) * 2.4); const CELL = 0.25;
    this.entry = { x: (fi + 0.5) * CELL - spec.w / 2, z: (fj + 0.5) * CELL - spec.d / 2 }; room.walkTo('me', this.entry.x, this.entry.z);
    if(this.custody){this.entry={x:sp.x,z:sp.z};room.placeAt('me',sp.x,sp.z,0,'stand');}
    if(msg.street){this.entry={x:sp.x,z:sp.z};room.placeAt('me',sp.x,sp.z,0,'stand');}
    me.yaw = Math.PI;
    for (const e of msg.people || []) this.addOther(e);
    if (msg.gem) this.showGem(msg.gem);
    return room;
  }
  tag(id, name, kind = '') { const t = h('tag ' + kind); t.append(h('st'), h('nm', name || '')); t.querySelector('.st').hidden = true; this.tagsEl.append(t); const p = this.room.people.get(id); if (p) p.tagEl = t; }
  setStatus(id, ic) { const p = this.room && this.room.people.get(id); if (!p || !p.tagEl) return; const st = p.tagEl.querySelector('.st'); st.textContent = ic || ''; st.hidden = !ic; }
  // ---- others ----
  addOther(e) {
    if (!this.room || this.room.people.has('p' + e.id)) return; const spec = this.spec; const sp = this.room.spawn;
    const id = 'p' + e.id; const av = new Avatar(fitLook(e.lk || {}, e.fit)); av.baseLook = e.lk; av.fit = e.fit || null;
    let x = e.x, z = e.z; const fresh = x == null; if (fresh) { x = sp.x; z = sp.z; }
    this.room.addPerson(id, av, x, z, { name: e.n, pid: e.id }); this.others.set(e.id, e); this.tag(id, e.n);
    if (fresh) { const [fi, fj] = this.room.nearestFree(sp.x * 0.5 + (Math.random() - 0.5) * 2, sp.z * 0.5 + (Math.random() - 0.5) * 2); this.room.walkTo(id, (fi + 0.5) * 0.25 - spec.w / 2, (fj + 0.5) * 0.25 - spec.d / 2); }
    else if (e.it != null && this.room.items[e.it]) { const u = this.room.usePoint(this.room.items[e.it], e.u || 0); this.room.placeAt(id, u.x, u.z, u.yaw, u.pose, u.y); }
    this.setStatus(id, e.st);
  }
  restyle(pid, lk, fit) { const p = this.room && this.room.people.get(pid === 'me' ? 'me' : 'p' + pid); if (!p) return; if (lk) p.av.baseLook = lk; if (fit !== undefined) p.av.fit = fit; p.av.setLook(fitLook(p.av.baseLook || p.av.look, p.av.fit)); }
  removeOther(pid) { const id = 'p' + pid; const p = this.room && this.room.people.get(id); if (!p) return; p.tagEl && p.tagEl.remove(); this.room.removePerson(id); this.others.delete(pid); }
  moveOther(m) {
    const id = 'p' + m.id; if (!this.room || !this.room.people.has(id) || m.x == null) return;
    if (m.it != null && this.room.items[m.it]) { const u = this.room.usePoint(this.room.items[m.it], m.u || 0); this.room.walkTo(id, u.x, u.z, null, u); }
    else this.room.walkTo(id, m.x, m.z);
  }
  animOther(pid, a) { const p = this.room && this.room.people.get('p' + pid); if (p) this.gesture(p, a); }
  gesture(p, a) { if (a === 'dance') { p.anim = 'dance'; clearTimeout(p.danceT); p.danceT = setTimeout(() => { p.anim = null; }, 6000); } else p.av.gesture(a === 'wave' ? 'agree' : a); }
  // ---- me ----
  get me() { return this.room && this.room.people.get('me'); }
  localHint(){
    const graph=this.room?.streetStream?.graph,p=this.me;if(!graph||!p)return null;
    let zone=null,distance=2.4;
    for(const candidate of this.spec.zones.filter(z=>z.route)){
      const u=this.room.usePoint(this.room.items[candidate.item]),d=Math.hypot(u.x-p.x,u.z-p.z);
      if(d<distance){distance=d;zone=candidate;}
    }
    return {name:nearestStreetSegment(graph,p.x,p.z).label,zone};
  }
  walkMe(x, z, cb, finalPose) { if (!this.room) return; if(this.custody){x=Math.max(-3.6,Math.min(-2,x));z=Math.max(-3,Math.min(-1.8,z));}const p = this.me; p.anim = null; this.room.walkTo('me', x, z, cb, finalPose); }
  // walk to the zone's item and take its pose; returns {x,z,it,u}
  useZone(z, cb) {
    const rec = this.room.items[z.item]; if (!rec) return null; const n = rec.use.length; let ui = z.use || 0;
    // pick a free use point (another player may be sitting there)
    const taken = new Set([...this.room.people.values()].filter((p) => p.id !== 'me').map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`));
    for (let k = 0; k < n; k++) { const u = this.room.usePoint(rec, (ui + k) % n); if (!taken.has(`${u.x.toFixed(1)},${u.z.toFixed(1)}`)) { ui = (ui + k) % n; break; } }
    const u = this.room.usePoint(rec, ui); if (z.pose) u.pose = z.pose; this.walkMe(u.x, u.z, () => { if (z.anim) this.me.anim = z.anim; cb && cb(); }, u);
    return { x: u.x, z: u.z, it: z.item, u: ui };
  }
  standUp() { const p = this.me; if (!p || p.pose === 'stand') return null; p.anim = null; const [i, j] = this.room.nearestFree(p.x, p.z + 0.6); const x = (i + 0.5) * 0.25 - this.spec.w / 2, z = (j + 0.5) * 0.25 - this.spec.d / 2; this.room.placeAt('me', p.x, p.z, p.yaw, 'stand'); this.walkMe(x, z); return { x, z }; }
  // ---- gem ----
  showGem(g) {
    this.hideGem(); if (!this.room) return; const r = this.room, nav = r.nav; let s = g.seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    let x = 0, z = 0; for (let k = 0; k < 200; k++) { const i = 1 + Math.floor(rnd() * (nav.nx - 2)), j = 1 + Math.floor(rnd() * (nav.nz - 2)); if (r.free(i, j)) { x = (i + 0.5) * 0.25 - this.spec.w / 2; z = (j + 0.5) * 0.25 - this.spec.d / 2; break; } }
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: '#9d7bff', emissive: '#6b3cff', emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.15, flatShading: true }));
    m.position.set(x, 0.5, z); m.userData.gem = g.id; m.castShadow = true; r.group.add(m); this.gemObj = m;
    const glow = new THREE.PointLight('#8a63ff', 4, 2.5, 1.5); glow.position.set(0, 0.2, 0); m.add(glow);
  }
  hideGem() { if (this.gemObj) { this.gemObj.parent && this.gemObj.parent.remove(this.gemObj);this.gemObj.geometry.dispose();this.gemObj.material.dispose(); this.gemObj = null; } }
  // ---- input ----
  clearSelection(){this.selectionPerson=null;if(!this.selection)return;this.selection.removeFromParent();this.selection.geometry.dispose();this.selection.material.dispose();this.selection=null;}
  focusTarget({item,person}){
    this.clearSelection();if(!this.room)return;this.selectionPerson=person;
    const obj=person?this.room.people.get(person)?.av.root:this.room.items[item]?.obj;if(!obj)return;
    const box=new THREE.Box3().setFromObject(obj),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    if(box.isEmpty())center.copy(obj.position);
    const radius=person ? .5 :Math.max(.45,Math.max(size.x,size.z)*.6);
    this.selection=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.045,48),new THREE.MeshBasicMaterial({color:'#edc75f',transparent:true,opacity:.95,side:THREE.DoubleSide,depthWrite:false}));
    this.selection.rotation.x=-Math.PI/2;this.selection.position.set(center.x,.03,center.z);this.room.group.add(this.selection);
  }
  pick(cx, cy) {
    if (!this.room) return null; const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    if (this.gemObj) { this.ray.setFromCamera(ndc, this.stage.camera); if (this.ray.intersectObject(this.gemObj, false).length) return { type: 'gem' }; const sp = this.screenOf(this.gemObj.position.x, 0.5, this.gemObj.position.z); if (Math.hypot(sp[0] - cx, sp[1] - cy) < 34) return { type: 'gem' }; }
    // people first, generous hit radius on their screen position
    let best = null, bd = 40;
    for (const [id, p] of this.room.people) { if (id === 'me'||!p.av.root.visible) continue; let d = 1e9; for (const yy of [0.4, 1.0, 1.6]) { const [sx, sy] = this.screenOf(p.x, yy, p.z); d = Math.min(d, Math.hypot(sx - cx, sy - cy)); } if (d < bd) { bd = d; best = { type: id.startsWith('npc') ? 'npc' : 'person', id, pid: p.info.pid, name: p.info.name || p.info.label }; } }
    if (best) return best;
    const hit = this.room.pick(ndc); if (!hit) return null;
    if (hit.type === 'item') { const i = this.room.items.indexOf(hit.item); const z = this.itemZone.get(i); if (z) return { type: 'zone', zone: z }; return { type: 'item', item: hit.item, index: i }; }
    if (hit.type === 'person') { const p = this.room.people.get(hit.id); if (hit.id === 'me') return null; return { ...hit, type: hit.id.startsWith('npc') ? 'npc' : 'person', pid: p?.info.pid, name: p?.info.name || p?.info.label }; }
    return hit;
  }
  zoneForNpc(id) {
    const p = this.room.people.get(id); if (!p) return null;
    if(this.spec.neighbourhood&&p.info.label?.startsWith('Neighbour'))return null;
    const staff=p.info.label?.includes('Aboki')?'khebab':p.info.label?.includes('FanYogo')?'fanyogo':null;
    const zones=(this.spec.zones||[]).filter(z=>!z.route&&z.acts?.length&&this.room.items[z.item]&&(!staff||z.acts.includes(staff)));
    return zones.sort((a, b) => { const A = this.room.items[a.item].spec, B = this.room.items[b.item].spec; return Math.hypot(A.x - p.x, A.z - p.z) - Math.hypot(B.x - p.x, B.z - p.z); })[0] || null;
  }
  screenOf(x, y, z) { return this.room.screen(x, y, z); }
  // ---- chat bubbles & floaters ----
  bubble(who, text, cls = '') {
    const p = this.room && this.room.people.get(who); if (!p) return; const b = node('div', { class: 'bubble ' + cls }, text); this.tagsEl.append(b);
    const it = { el: b, who, until: performance.now() + Math.min(7000, 2500 + text.length * 60) }; this.bubbles = this.bubbles.filter((x) => { if (x.who === who) { x.el.remove(); return false; } return true; }); this.bubbles.push(it);
  }
  floater(text, bad) { const p = this.me; if (!p) return; const f = h('floater' + (bad ? ' bad' : ''), text); const [sx, sy] = this.screenOf(p.x, 2.0, p.z); f.style.left = sx + 'px'; f.style.top = sy + 'px'; this.tagsEl.append(f); setTimeout(() => f.remove(), 1700); }
  loadEstate(m) {
    if(this.place!=='e:'+m.area||!this.room)return;const r=this.room;for(const rec of [...r.items])if(rec.spec.owner)r.removeItem(rec);r.nav=null;
    r.spec.zones=r.spec.zones.filter(z=>!z.estateOwner);
    m.owners.forEach((owner,i)=>{const {x,z,rot}=r.spec.ownerPlots[i];const rec=r.addItem({kind:'street_building:6,4',x,z,rot,label:'@'+owner.name,owner,family:r.spec.environment?.family,style:r.spec.environment?.style,color:['#f0e6d4','#e0d2bf','#d6e1d7'][i%3]});if(owner.mine&&owner.home===G.state.home)r.spec.zones.push({id:'owner-home',label:'Go indoors',icon:'ph-house',item:r.items.indexOf(rec),acts:[],route:'home',estateOwner:true});});r.buildNav();this.itemZone=new Map(r.spec.zones.map(z=>[z.item,z]));this.estate=m;
  }
  update(dt) {
    const selected=this.room?.people.get(this.selectionPerson);if(selected&&this.selection){this.selection.position.x=selected.x;this.selection.position.z=selected.z;}
    if (!this.room) return; this.elapsed+=dt;const hour=new Date(accraNow()).getUTCHours();const isAvailable=open=>!open||(open[1]>24?hour>=open[0]||hour<open[1]-24:hour>=open[0]&&hour<open[1]);
    for(const id of this.npcs){const p=this.room.people.get(id),n=p.schedule;const on=isAvailable(n.open);p.av.root.visible=on;if(p.tagEl)p.tagEl.hidden=!on;if(!on)continue;if(this.elapsed>p.nextMove){p.nextMove=this.elapsed+5+(id.length%3);if(n.patrol&&!p.path.length){const target=n.patrol[p.patrolIndex++%n.patrol.length];this.room.walkTo(id,...target);}else p.av.gesture(n.gesture||'agree');}}
    for(const r of this.room.items)if(r.spec.open)r.obj.visible=isAvailable(r.spec.open);
    this.room.update(dt);
    if(this.me)this.room.streetStream?.update(this.me.x,this.me.z);
    if(this.spec.neighbourhood&&this.me&&this.me.path.length){this.stage.view.target.x+=(this.me.x-this.stage.view.target.x)*Math.min(1,dt*3);this.stage.view.target.z+=(this.me.z-this.stage.view.target.z)*Math.min(1,dt*3);this.stage.applyView();}
    if (this.gemObj) { this.gemObj.rotation.y += dt * 2; this.gemObj.position.y = 0.55 + Math.sin(performance.now() / 300) * 0.08; }
    for (const p of this.room.people.values()) {
      if (!p.tagEl) continue; const y = p.pose === 'lie' ? 0.9 : p.pose && p.pose.startsWith('sit') ? 1.55 : 2.0; const [sx, sy] = this.screenOf(p.x, y + (p.poseY || 0) * (p.pose === 'stand' ? 0 : 1), p.z);
      p.tagEl.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`; p.tagEl.style.left = '0'; p.tagEl.style.top = '0';
    }
    const now = performance.now();
    this.bubbles = this.bubbles.filter((b) => { const p = this.room.people.get(b.who); if (!p || now > b.until) { b.el.remove(); return false; } const [sx, sy] = this.screenOf(p.x, 2.35, p.z); b.el.style.left = sx + 'px'; b.el.style.top = sy + 'px'; return true; });
  }
}
