// Isometric stage: one renderer, an orthographic camera at a fixed iso angle, warm soft lighting,
// a time-of-day background, and a single shadow-casting key light fitted to whatever is on screen.
import * as THREE from 'three';
import { environmentLight } from './environment-light.js';

export class Stage {
  constructor(canvas) {
    const mobile = matchMedia('(pointer: coarse)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.bg = new THREE.Color('#dfe7e4');
    // soft vertical gradient backdrop derived from this.bg (sky-ish top, warmer ground-ish bottom) instead of a flat void
    this.bgCv = document.createElement('canvas'); this.bgCv.width = 2; this.bgCv.height = 256; this.bgTex = new THREE.CanvasTexture(this.bgCv); this.bgTex.colorSpace = THREE.SRGBColorSpace; this.scene.background = this.bgTex; this._bgHex = -1;
    // iso camera: yaw 45°, pitch ~35°. zoom = world units visible vertically
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    this.view = { yaw: Math.PI / 4, pitch: 0.62, zoom: 11, target: new THREE.Vector3(0, 0.8, 0), dist: 60 };
    // Third-person follow camera (Stage 4). The isometric camera stays the default.
    this.ortho = this.camera; this.persp = new THREE.PerspectiveCamera(58, 1, 0.05, 400); this.mode = 'iso';
    this.follow = { yaw: Math.PI, pitch: 0.34, dist: 3.4, min: 1.5, max: 7, target: new THREE.Vector3(0, 1.45, 0), actual: 3.4 };
    this.collide = null; // (from, to) => clear distance along the ray, set by the active scene
    this.hemi = new THREE.HemisphereLight('#fff6e8', '#7d7366', 1.15); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight('#fff1dc', 2.1); this.key.castShadow = true;
    this.key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.02; this.key.shadow.radius = 4;
    const sc = this.key.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 80;
    this.scene.add(this.key, this.key.target);
    this.fill = new THREE.DirectionalLight('#cfe0ff', 0.45); this.fill.position.set(-20, 12, 10); this.scene.add(this.fill);
    this.lamps = []; // point lights added by rooms (night)
    this.night = 0;
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.aspect = w / h; this.persp.aspect = this.aspect; this.applyView();
  }
  // 'iso' (overhead) or 'follow' (third person). Callers check the scene supports follow first.
  setMode(mode) { this.mode = mode === 'follow' ? 'follow' : 'iso'; this.camera = this.mode === 'follow' ? this.persp : this.ortho; this.applyView(); }
  applyFollow() {
    const f = this.follow, cam = this.persp, dir = new THREE.Vector3(Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), Math.cos(f.yaw) * Math.cos(f.pitch));
    const want = f.target.clone().addScaledVector(dir, f.dist);
    let d = f.dist; if (this.collide) d = Math.max(0.45, Math.min(d, this.collide(f.target, want)));
    f.actual = d; cam.position.copy(f.target).addScaledVector(dir, d);
    if (this.bounds) { const b = this.bounds, m = 0.25; cam.position.x = Math.max(b[0] + m, Math.min(b[1] - m, cam.position.x)); cam.position.z = Math.max(b[2] + m, Math.min(b[3] - m, cam.position.z)); }
    cam.position.y = Math.max(0.6, cam.position.y); cam.lookAt(f.target);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    this.view.yaw = f.yaw;   // joystick and panning stay relative to what the player sees
    this.key.position.copy(f.target).add(new THREE.Vector3(9, 16, 6)); this.key.target.position.copy(f.target); this.key.target.updateMatrixWorld();
  }
  applyView() {
    if (this.mode === 'follow') return this.applyFollow();
    const v = this.view, z = v.zoom, a = this.aspect || 1;
    this.camera.left = -z * a / 2; this.camera.right = z * a / 2; this.camera.top = z / 2; this.camera.bottom = -z / 2;
    const dir = new THREE.Vector3(Math.sin(v.yaw) * Math.cos(v.pitch), Math.sin(v.pitch), Math.cos(v.yaw) * Math.cos(v.pitch));
    this.camera.position.copy(v.target).addScaledVector(dir, v.dist); this.camera.lookAt(v.target);
    if (this.offsetY) this.camera.setViewOffset(innerWidth, innerHeight, 0, this.offsetY * innerHeight, innerWidth, innerHeight); else if (this.camera.view) this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
    this.key.position.copy(v.target).add(new THREE.Vector3(9, 16, 6)); this.key.target.position.copy(v.target); this.key.target.updateMatrixWorld();
  }
  // h = Accra hour (0-24). Day: soft mint-cream backdrop; night: deep indigo with warm interior light
  setTime(h) {
    this.hour=h;const light=environmentLight(h,this.environmentOutdoor);
    this.night=light.night;this.bg.copy(light.background);this.hemi.color.copy(light.ambient);
    this.hemi.intensity=light.hemi;this.hemi.groundColor.set(this.environmentOutdoor?'#727565':'#9a8b77');
    this.key.color.copy(light.sun);this.key.intensity=light.key;this.fill.intensity=light.fill;
    this.renderer.toneMappingExposure=light.exposure;
    for(const l of this.lamps)l.intensity=l.userData.base*(this.environmentOutdoor ? .06+this.night*.68 : .18+this.night*.6);
  }

  pan(dx, dy) { // screen-space pan in world units; in follow mode a drag orbits the camera
    if (this.mode === 'follow') { const f = this.follow; f.yaw -= dx * 0.008; f.pitch = Math.max(0.05, Math.min(1.1, f.pitch + dy * 0.005)); this.applyView(); return; }
    const v = this.view, s = v.zoom / innerHeight;
    const right = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw)), fwd = new THREE.Vector3(-Math.sin(v.yaw), 0, -Math.cos(v.yaw));
    v.target.addScaledVector(right, -dx * s).addScaledVector(fwd, dy * s / Math.sin(v.pitch));
    if (this.bounds) { const b = this.bounds; v.target.x = Math.max(b[0], Math.min(b[1], v.target.x)); v.target.z = Math.max(b[2], Math.min(b[3], v.target.z)); }
    this.applyView();
  }
  zoomBy(f) { if (this.mode === 'follow') { const c = this.follow; c.dist = Math.max(c.min, Math.min(c.max, c.dist * f)); this.applyView(); return; } const v = this.view; v.zoom = Math.max(this.zoomMin || 5, Math.min(this.zoomMax || 26, v.zoom * f)); this.applyView(); }
  paintBg() {
    const hex = this.bg.getHex(); if (hex === this._bgHex) return; this._bgHex = hex; const x = this.bgCv.getContext('2d'); const c = this.bg.clone();
    const top = c.clone().lerp(new THREE.Color('#ffffff'), 0.32), mid = c.clone(), bot = c.clone().lerp(new THREE.Color('#c9b48f'), 0.28);
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#' + top.getHexString()); g.addColorStop(0.55, '#' + mid.getHexString()); g.addColorStop(1, '#' + bot.getHexString()); x.fillStyle = g; x.fillRect(0, 0, 2, 256); this.bgTex.needsUpdate = true;
  }
  render() { if (!this.override) this.paintBg(); const o = this.override; this.renderer.render(o ? o.scene : this.scene, o ? o.camera : this.camera); }
}
