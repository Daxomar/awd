// A billboard face that reads like a lit LED screen: the advert is drawn unlit and without tone mapping
// (exactly the colours the advertiser uploaded, at full brightness in daylight and at night), in a glowing
// frame, and shaped to the artwork's own proportions instead of stretching it. Used by the city map
// (scene/city/ads.js) and the street billboards (scene/street-boards.js).
import * as THREE from 'three';

export const MIN_ASPECT = 0.6, MAX_ASPECT = 3.2;

export function boardMaterial(texture) {
  return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

export function prepareTexture(texture, renderer) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 4);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

// Width and height for artwork of this aspect within a board of nominal size w x h, keeping the area.
export function fitSize(aspect, w, h) {
  const a = Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, aspect || w / h)), area = w * h;
  return [Math.sqrt(area * a), Math.sqrt(area / a)];
}

// Frame, glow and face as one group; the face is a unit plane scaled to the artwork.
export function buildBoard(w, h, { frame = '#1d2a26', glow = '#fff6c8', depth = 0.04 } = {}) {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: frame, roughness: 0.55, metalness: 0.35 });
  const glowMat = new THREE.MeshBasicMaterial({ color: glow, toneMapped: false });
  const back = new THREE.Mesh(new THREE.BoxGeometry(1, 1, depth), frameMat);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), boardMaterial(null));
  halo.position.z = depth / 2 + 0.001; face.position.z = depth / 2 + 0.002;
  group.add(back, halo, face);
  const board = { group, face, halo, back, w, h, depth };
  shape(board, w / h);
  return board;
}

// Resize frame, glow rim and face around artwork of the given aspect.
export function shape(board, aspect) {
  const [fw, fh] = fitSize(aspect, board.w, board.h), rim = Math.min(fw, fh) * 0.05;
  board.face.scale.set(fw, fh, 1);
  board.halo.scale.set(fw + rim, fh + rim, 1);
  board.back.scale.set(fw + rim * 2.2, fh + rim * 2.2, 1);
  board.size = [fw, fh];
  return board;
}

export function setArtwork(board, texture) {
  board.face.material.map = texture;
  board.face.material.needsUpdate = true;
  const img = texture?.image;
  if (img?.width && img?.height) shape(board, img.width / img.height);
}

export function disposeBoard(board) {
  board.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  board.group.removeFromParent();
}

// The house advert shown on free boards.
export function houseAdTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512; const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 1024, 512); g.addColorStop(0, '#0e5a3a'); g.addColorStop(1, '#0a3b2b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
  ['#ce1126', '#fcd116', '#006b3f'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, 470 + i * 14, 1024, 14); });
  ctx.fillStyle = '#fcd116'; ctx.font = '900 104px system-ui, Arial Black, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ADVERTISE HERE', 512, 190);
  ctx.fillStyle = '#ffffff'; ctx.font = '800 54px system-ui, sans-serif'; ctx.fillText('Your brand, seen all over Accra', 512, 300);
  ctx.fillStyle = '#ffe9a6'; ctx.font = '700 42px system-ui, sans-serif'; ctx.fillText('accrawedey.world/advertise', 512, 385);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
