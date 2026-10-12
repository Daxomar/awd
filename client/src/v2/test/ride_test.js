import * as THREE from 'three';
import { Stage } from '../scene/stage.js';
import { loadAvatars } from '../scene/avatars.js';
import { Ride } from '../scene/ride.js';
const T = (window.__T = { ready: false, errors: [] }); addEventListener('error', (e) => T.errors.push(String(e.message)));
const q = new URLSearchParams(location.search);
(async () => {
  const st = new Stage(document.getElementById('c')); await loadAvatars();
  const look = { body: 'f', skin: 6, hair: 'braids', top: 'kaba', topCol: '#e76f51', bottom: 'slit', bottomCol: '#e76f51', shoes: 'heels', shoesCol: '#d4a017' };
  const ride = new Ride(st); window.__ride = ride;
  ride.start({ mode: q.get('mode') || 'trotro', look, car: 'corolla', to: 'Circle', rush: !!q.get('rush'), hour: +(q.get('h') || 13) });
  const adv = +(q.get('t') || 3); for (let i = 0; i < adv * 30; i++) ride.update(1 / 30);
  const clock = new THREE.Clock(); let n = 0; const t0 = performance.now();
  const loop = () => { const dt = Math.min(0.05, clock.getDelta()); ride.update(dt); st.render(); if (++n === 20) { T.fps = Math.round(20000 / (performance.now() - t0)); T.calls = st.renderer.info.render.calls; T.tris = st.renderer.info.render.triangles; T.ready = true; } requestAnimationFrame(loop); }; loop();
})().catch((e) => { T.errors.push(String(e.stack || e)); T.ready = true; });
