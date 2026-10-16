// Fitting room: a softly lit pedestal far from the city where your character is shown full-size while you dress.
import * as THREE from 'three';
import { Avatar } from './avatars.js';
const AT = new THREE.Vector3(500, 0, 500);
export class Studio {
  constructor(stage) {
    this.stage = stage; this.g = new THREE.Group(); this.g.position.copy(AT); this.g.visible = false; stage.scene.add(this.g);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.82, 0.12, 48), new THREE.MeshStandardMaterial({ color: '#f4ecdc', roughness: 0.8 })); ped.position.y = -0.06; ped.receiveShadow = true; this.g.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.02, 8, 64), new THREE.MeshStandardMaterial({ color: '#d4a017', metalness: 0.6, roughness: 0.3 })); ring.rotation.x = -Math.PI / 2; this.g.add(ring);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 48), new THREE.MeshStandardMaterial({ color: '#efe3cf', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.12; floor.receiveShadow = true; this.g.add(floor);
    this.lamp = new THREE.PointLight('#fff1dc', 6, 6, 1.5); this.lamp.position.set(0.8, 2.6, 1.6); this.g.add(this.lamp);
    this.softbox = new THREE.PointLight('#f5f3ff', 5, 7, 1); this.softbox.position.set(-1.2, 1.8, 2.5); this.g.add(this.softbox);
    this.av = null; this.yaw = 0.35; this.open = false;
  }
  show(look, offsetY = 0.28, zoom = 2.6) {
    const st = this.stage; this.saved = { view: { ...st.view, target: st.view.target.clone() }, bounds: st.bounds, offsetY: st.offsetY, zmin: st.zoomMin, zmax: st.zoomMax, bg: st.bg.getHex() };
    this.g.visible = true; this.open = true; this.preview(look);
    st.bounds = null; st.view.target.set(AT.x, 0.95, AT.z); st.view.zoom = zoom; st.view.pitch = 0.18; st.offsetY = offsetY; st.zoomMin = 2.4; st.zoomMax = 6.5; st.applyView();
    const sc = st.key.shadow.camera; this.savedShadow = [sc.left, sc.right, sc.top, sc.bottom]; sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; sc.updateProjectionMatrix();
    st.bg.set('#f6efe2');
  }
  preview(look) { if (this.av) { this.av.setLook(look); return; } this.av = new Avatar(look, { lod: 0 }); this.g.add(this.av.root); this.av.root.rotation.y = this.yaw; }
  turn(dx) { this.yaw += dx * 0.012; if (this.av) this.av.root.rotation.y = this.yaw; }
  hide() {
    if (!this.open) return; const st = this.stage, s = this.saved; this.open = false; this.g.visible = false;
    if (this.av) { this.g.remove(this.av.root); this.av.dispose(); this.av = null; }
    Object.assign(st.view, s.view); st.view.target.copy(s.view.target); st.bounds = s.bounds; st.offsetY = s.offsetY; st.zoomMin = s.zmin; st.zoomMax = s.zmax; st.applyView(); st.bg.setHex(s.bg);
    const sc = st.key.shadow.camera; [sc.left, sc.right, sc.top, sc.bottom] = this.savedShadow; sc.updateProjectionMatrix();
  }
  update(dt) { if (this.open && this.av) { this.av.update(dt, 0); } }
}
