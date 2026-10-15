import * as THREE from 'three';
import { display } from './geography.js';

export class CityAds {
  constructor(parent) { this.parent = parent; this.boards = []; this.textures = new Map(); this.loader = new THREE.TextureLoader(); this.ray = new THREE.Raycaster(); this.disposed = false; }
  set(slots) {
    if (this.disposed) return;
    const keep = new Set(slots.map(s => s.id));
    for (const b of [...this.boards]) if (!keep.has(b.slot.id)) { this.release(b); this.boards.splice(this.boards.indexOf(b), 1); }
    if (slots.length && !this.house) this.house = houseAd();
    for (const slot of slots) {
      let b = this.boards.find(b => b.slot.id === slot.id);
      if (!b) {
        const root = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: '#536c64', roughness: .8 });
        const pole = new THREE.Mesh(new THREE.BoxGeometry(.022, .32, .022), steel); pole.position.y = .16; root.add(pole);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(.46, .24, .022), steel); frame.position.y = .43; root.add(frame);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(.43, .215), new THREE.MeshStandardMaterial({ map: this.house, emissive: '#ffffff', emissiveMap: this.house, emissiveIntensity: .16 })); face.position.set(0, .43, .014); root.add(face);
        const [x, z] = display(slot.x, slot.z); root.position.set(x - .12, .01, z - .12); root.rotation.y = Math.PI / 4; root.scale.setScalar(slot.tier === 'MEGA' ? .42 : .35);
        b = { root, face, cur: null, seed: [...slot.id].reduce((n, c) => n + c.charCodeAt(0), 0) }; this.parent.add(root); this.boards.push(b);
      }
      b.slot = slot; b.ads = slot.live || []; b.cur = null;
    }
    this.update();
  }
  update() {
    if (this.disposed) return;
    const now = Date.now();
    for (const b of this.boards) {
      const ad = b.ads.length ? b.ads[(Math.floor(now / ((b.slot.rotate || 15) * 1000)) + b.seed) % b.ads.length] : null;
      const key = ad ? `${ad.id}:${ad.img}` : ''; if (key === b.cur) continue; b.cur = key; b.ad = ad;
      let texture = this.house;
      if (ad) {
        if (!this.textures.has(key)) {
          const t = this.loader.load(ad.img, loaded => { if (this.disposed || !this.textures.has(key)) loaded.dispose(); }); t.colorSpace = THREE.SRGBColorSpace; this.textures.set(key, t);
        }
        texture = this.textures.get(key); this.textures.delete(key); this.textures.set(key, texture);
      }
      b.face.material.map = texture; b.face.material.emissiveMap = texture; b.face.material.needsUpdate = true;
    }
    const active = new Set(this.boards.map(b => b.cur));
    while (this.textures.size > Math.max(24, this.boards.length)) {
      const key = [...this.textures.keys()].find(k => !active.has(k)); if (!key) break;
      this.textures.get(key).dispose(); this.textures.delete(key);
    }
  }
  pick(x, y, stage) {
    const r = stage.renderer.domElement.getBoundingClientRect(); this.ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1), stage.camera);
    return this.boards.find(b => this.ray.intersectObject(b.face, false).length) || null;
  }
  release(b) { const materials = new Set(); b.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); materials.add(o.material); } }); for (const m of materials) m.dispose(); b.root.removeFromParent(); }
  dispose() { if (this.disposed) return; this.disposed = true; for (const b of this.boards) this.release(b); this.boards = []; for (const t of this.textures.values()) t.dispose(); this.textures.clear(); this.house?.dispose(); }
}
function houseAd() {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#234f3d'; ctx.fillRect(0, 0, 256, 128); ctx.fillStyle = '#e0bd65'; ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'center'; ctx.fillText('YOUR AD HERE', 128, 59); ctx.fillStyle = '#fcfaf2'; ctx.font = '14px system-ui'; ctx.fillText('Phone · My Ads', 128, 87); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
