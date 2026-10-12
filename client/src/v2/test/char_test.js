import * as THREE from 'three';
import { Stage } from '../scene/stage.js';
import { loadAvatars, Avatar } from '../scene/avatars.js';
import { applyPose } from '../scene/poses.js';
const T = (window.__T = { ready: false, errors: [] }); addEventListener('error', (e) => T.errors.push(String(e.message)));
const q = new URLSearchParams(location.search);
const LOOKS = [
  { body: 'm', skin: 5, hair: 'lowcut', top: 'jersey', topCol: '#f4f4f2', bottom: 'jeans', bottomCol: '#2b3a55', shoes: 'sneakers', shoesCol: '#f4f4f2' },
  { body: 'f', skin: 6, hair: 'braids', top: 'kaba', topCol: '#e76f51', bottom: 'slit', bottomCol: '#e76f51', shoes: 'heels', shoesCol: '#d4a017', neck: 'beads' },
  { body: 'm', skin: 7, hair: 'locs', beard: 'fullbeard', top: 'fugu', topCol: '#1f3f8f', bottom: 'chinos', bottomCol: '#c2a878', shoes: 'ahenema', shoesCol: '#6b4f2f' },
  { body: 'f', skin: 4, hair: 'bonestraight', full: 'kentedress', fullCol: '#f2b632', shoes: 'heels', shoesCol: '#17150f', neck: 'chain' },
  { body: 'm', skin: 3, hair: 'afro', top: 'kenteshirt', topCol: '#0e7a4e', bottom: 'shorts', bottomCol: '#2b3a55', shoes: 'slides', shoesCol: '#c8102e', glasses: 'shades' },
  { body: 'f', skin: 5, hair: 'duku', hatCol: '#7b2d8e', full: 'ankaradress', fullCol: '#7b2d8e', shoes: 'slides', shoesCol: '#17150f' },
  { body: 'm', skin: 6, hair: 'fade', beard: 'goatee', top: 'suit', topCol: '#1d2433', bottom: 'suitpants', bottomCol: '#1d2433', shoes: 'loafers', shoesCol: '#17150f', neck: 'chain' },
  { body: 'm', skin: 8, hair: 'twists', top: 'hoodie', topCol: '#c8102e', bottom: 'joggers', bottomCol: '#17150f', shoes: 'sneakers', shoesCol: '#17150f', hat: 'cap', hatCol: '#17150f' },
  { body: 'f', skin: 2, hair: 'puff', top: 'crop', topCol: '#f2b632', bottom: 'mini', bottomCol: '#17150f', shoes: 'sneakers', shoesCol: '#f4f4f2' },
  { body: 'm', skin: 5, hair: 'waves', top: 'kaftan', topCol: '#e9e2d0', bottom: 'chinos', bottomCol: '#e9e2d0', shoes: 'ahenema', shoesCol: '#d4a017', hat: 'kufi', hatCol: '#f4f4f2' },
  { body: 'm', skin: 4, hair: 'bald', beard: 'stubble', full: 'kentecloth', fullCol: '#f2b632', shoes: 'ahenema', shoesCol: '#d4a017' },
  { body: 'f', skin: 7, hair: 'bob', top: 'blouse', topCol: '#f6d6dc', bottom: 'pencil', bottomCol: '#17150f', shoes: 'heels', shoesCol: '#c8102e', glasses: 'specs' },
];
(async () => {
  const st = new Stage(document.getElementById('c')); st.setTime(13); await loadAvatars();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#e9e2d0' })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; st.scene.add(floor);
  const list = q.get('one') ? [LOOKS[+q.get('one')]] : LOOKS; const avs = [];
  const cols = q.get('one') ? 1 : 4;
  list.forEach((l, i) => { const a = new Avatar(l); a.root.position.set((i % cols - (cols - 1) / 2) * 0.9, 0, Math.floor(i / cols) * 1.3 - 1.3); a.root.rotation.y = q.get('back') ? Math.PI : 0.5; st.scene.add(a.root); avs.push(a); if (q.get('anim')) a.play(q.get('anim')); });
  if (q.get('one')) avs[0].root.position.set(0, 0, 0);
  st.view.yaw = q.get('yaw') ? +q.get('yaw') : 0.35; st.view.pitch = 0.25; st.view.zoom = q.get('one') ? 2.2 : 6.5; st.view.target.set(0, q.get('one') ? 0.95 : 0.6, 0); st.applyView();
  window.__avs = avs; window.__st = st; const clock = new THREE.Clock(); let n = 0;
  const loop = () => { const dt = Math.min(0.05, clock.getDelta()); for (const a of avs) { a.update(q.get('freeze') ? 0 : dt, 1.4); if (q.get('pose')) applyPose(a, q.get('pose')); } st.render(); if (++n === 15) T.ready = true; if(!q.get('freeze')||n<15)requestAnimationFrame(loop); }; loop();
})().catch((e) => { T.errors.push(String(e.stack || e)); T.ready = true; });
