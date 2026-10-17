// Big roadside billboards in neighbourhood streets, where players spend most of their time. Each street
// shows the live adverts booked on the city billboards nearest to it (rotating), on tall lit LED boards
// raised above the rooftops and turned towards the camera so they are always readable. Free boards show
// the house advert. These are extra visibility for adverts already live nearby; exposure accounting stays
// with the booked city placements (scene/city/ads.js).
import * as THREE from 'three';
import { buildBoard, setArtwork, prepareTexture, houseAdTexture, disposeBoard } from './billboard-face.js';

export const BOARD_W = 7.2, BOARD_H = 3.6, POLE_H = 5.2, ROTATE_S = 12;

// The (up to) `count` slots nearest to a real-world point, live adverts first.
export function nearestSlots(slots, x, z, count = 2, now = Date.now()) {
  const live = (s) => (s.live || []).some((a) => +a.ends > now);
  return [...(slots || [])].filter((s) => Number.isFinite(s.x) && Number.isFinite(s.z))
    .sort((a, b) => (live(b) - live(a)) || (Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)))
    .slice(0, count);
}

export class StreetBoards {
  constructor(room, renderer) {
    this.room = room; this.renderer = renderer; this.boards = []; this.textures = new Map();
    this.loader = new THREE.TextureLoader(); this.house = houseAdTexture();
  }

  // spots: [{x, z}] in room space (back corners of the street, clear of shops and paths).
  set(slots, origin, spots) {
    this.clearBoards();
    const chosen = nearestSlots(slots, origin.x, origin.z, spots.length);
    spots.forEach((spot, i) => {
      const root = new THREE.Group(), parts = [];
      const steel = new THREE.MeshStandardMaterial({ color: '#2f3a36', roughness: 0.5, metalness: 0.5 });
      const lampMat = new THREE.MeshBasicMaterial({ color: '#fff4cf', toneMapped: false });
      for (const x of [-BOARD_W * 0.3, BOARD_W * 0.3]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, POLE_H, 10), steel); pole.position.set(x, POLE_H / 2, -0.2); parts.push(pole);
      }
      const deck = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W * 0.9, 0.12, 0.8), steel); deck.position.set(0, POLE_H, 0.1); parts.push(deck);
      for (const x of [-BOARD_W * 0.33, 0, BOARD_W * 0.33]) {   // flood lights along the top edge
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.3), lampMat); lamp.position.set(x, POLE_H + BOARD_H + 0.45, 0.55); parts.push(lamp);
      }
      const board = buildBoard(BOARD_W, BOARD_H, { depth: 0.25 }); board.group.position.y = POLE_H + BOARD_H / 2 + 0.15;
      root.add(...parts, board.group);
      root.position.set(spot.x, 0, spot.z);
      root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.decorative = true; } });
      this.room.group.add(root);
      this.boards.push({ root, board, parts, materials: [steel, lampMat], ads: chosen[i]?.live || [], seed: i * 7, cur: null });
    });
    this.update();
  }

  update(camera) {
    const now = Date.now();
    for (const b of this.boards) {
      if (camera) {
        const p = b.root.getWorldPosition(new THREE.Vector3());
        b.root.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
      }
      const live = b.ads.filter((a) => +a.ends > now);
      const ad = live.length ? live[(Math.floor(now / (ROTATE_S * 1000)) + b.seed) % live.length] : null;
      const key = ad ? `${ad.id}:${ad.img}` : 'house';
      if (key === b.cur) continue;
      b.cur = key;
      if (!ad) { setArtwork(b.board, this.house); continue; }
      let t = this.textures.get(key);
      if (!t) {
        t = prepareTexture(this.loader.load(ad.img, (loaded) => { if (b.cur === key) setArtwork(b.board, loaded); },
          undefined, () => { if (b.cur === key) setArtwork(b.board, this.house); }), this.renderer);
        this.textures.set(key, t);
      }
      setArtwork(b.board, t);
    }
  }

  clearBoards() {
    for (const b of this.boards) {
      for (const m of b.parts) m.geometry.dispose();
      for (const m of b.materials) m.dispose();
      disposeBoard(b.board);
      b.root.removeFromParent();
    }
    this.boards = [];
  }

  dispose() {
    this.clearBoards();
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear(); this.house.dispose();
  }
}
