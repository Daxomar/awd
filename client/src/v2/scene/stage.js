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
    const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.aspect = w / h; this.applyView();
  }
  applyView() {
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

  pan(dx, dy) { // screen-space pan in world units
    const v = this.view, s = v.zoom / innerHeight;
    const right = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw)), fwd = new THREE.Vector3(-Math.sin(v.yaw), 0, -Math.cos(v.yaw));
    v.target.addScaledVector(right, -dx * s).addScaledVector(fwd, dy * s / Math.sin(v.pitch));
    if (this.bounds) { const b = this.bounds; v.target.x = Math.max(b[0], Math.min(b[1], v.target.x)); v.target.z = Math.max(b[2], Math.min(b[3], v.target.z)); }
    this.applyView();
  }
  zoomBy(f) { const v = this.view; v.zoom = Math.max(this.zoomMin || 5, Math.min(this.zoomMax || 26, v.zoom * f)); this.applyView(); }
  paintBg() {
    const hex = this.bg.getHex(); if (hex === this._bgHex) return; this._bgHex = hex; const x = this.bgCv.getContext('2d'); const c = this.bg.clone();
    const top = c.clone().lerp(new THREE.Color('#ffffff'), 0.32), mid = c.clone(), bot = c.clone().lerp(new THREE.Color('#c9b48f'), 0.28);
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#' + top.getHexString()); g.addColorStop(0.55, '#' + mid.getHexString()); g.addColorStop(1, '#' + bot.getHexString()); x.fillStyle = g; x.fillRect(0, 0, 2, 256); this.bgTex.needsUpdate = true;
  }
  render() { if (!this.override) this.paintBg(); const o = this.override; this.renderer.render(o ? o.scene : this.scene, o ? o.camera : this.camera); }
}
