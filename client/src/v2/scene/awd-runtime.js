// Runtime helpers for the Blender-built Accra We Dey character GLBs.
// Kept separate from the live game so the integration can adopt it deliberately.
// One loaded GLB is a template: instances share geometry and most materials;
// only per-look materials (skin tone, hair colour, garment colour) are cached by key.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// Saved skin palette (server/src/game/wardrobe.js SKIN) and the vertex-colour headroom
// used by the Blender bake (characters/scripts/awd_skin.py BASE).
export const SKIN = { 1: '#f3cfb0', 2: '#e2b08a', 3: '#c68a5f', 4: '#a26a45', 5: '#7d4b2e', 6: '#5f3621', 7: '#472616', 8: '#33190d' };
const SKIN_HEADROOM = 1 / 0.9;
const HAIR_ALBEDO = 1 / 0.78;
const BLINK_SECONDS = 0.16;

// Expression recipes mirror characters/scripts/awd_expressions.py EXPRESSIONS.
export const EXPRESSIONS = {
  neutral: {}, happy: { smile: 0.85, squint: 0.35, browUp: 0.15 }, sad: { frown: 0.8, browInnerUp: 0.8, squint: 0.1 },
  angry: { browDown: 1, frown: 0.35, squint: 0.45 }, surprised: { browUp: 1, jawOpen: 0.35, mouthO: 0.35 },
  concerned: { browInnerUp: 0.75, frown: 0.3, browDown: 0.15 }, laughing: { smile: 1, jawOpen: 0.55, squint: 0.7, browUp: 0.2 },
  talking: { jawOpen: 0.3, mouthO: 0.2 }, blinking: { blink: 1 },
};

// Saved body sliders (wardrobe.js cleanLook) -> morph influence in [-1, 1]; mirrors awd_morphs.py.
export const SLIDERS = { build: 0.5, hips: 0.5, bust: 0.45, waist: 0.5, shoulders: 0.5, muscle: 0.5, faceWidth: 0.5, nose: 0.5, lips: 0.5 };
export function sliderInfluence(name, value) {
  const d = SLIDERS[name], v = Math.max(0, Math.min(1, Number(value ?? d)));
  return v >= d ? (v - d) / (1 - d) : (v - d) / d;
}

// Materials tinted by their slot colour (topCol, bottomCol, fullCol, shoesCol, hatCol, neckCol).
const TINTED = /^AWD_(Fabric_|Hat_|Shoe_.*_upper$)/;
const SLOT_PREFIX = [['AWD_Top', 'top'], ['AWD_Bottom', 'bottom'], ['AWD_Full', 'full'], ['AWD_Shoes', 'shoes']];
const slotOf = (name) => SLOT_PREFIX.find(([prefix]) => name.startsWith(prefix))?.[1];
const extrasOf = (o) => { for (let n = o; n; n = n.parent) if (n.userData?.awd_slot) return n.userData; return {}; };

const LOOPED = new Set(['idle', 'walk', 'run', 'dance', 'sit_idle', 'talk', 'phone_use']);

export class AwdTemplate {
  constructor(gltf) {
    this.gltf = gltf;
    this.clips = Object.fromEntries(gltf.animations.map((clip) => [clip.name, clip]));
    this.materialCache = new Map();
  }

  // A material derived from a template material, shared by every instance with the same key.
  variant(base, key, apply) {
    const id = base.uuid + '|' + key;
    if (!this.materialCache.has(id)) { const m = base.clone(); apply(m); this.materialCache.set(id, m); }
    return this.materialCache.get(id);
  }

  // Shares every attribute (and morph) with the original; only the index differs.
  culled(geometry, hidden) {
    const id = geometry.uuid + '|' + hidden;
    if (!this.cullCache) this.cullCache = new Map();
    if (!this.cullCache.has(id)) {
      const region = geometry.attributes._awd_region, index = geometry.index.array, keep = [];
      const covered = (v) => (hidden >> Math.round(region.getX(v))) & 1;
      for (let i = 0; i < index.length; i += 3) {
        if (!(covered(index[i]) && covered(index[i + 1]) && covered(index[i + 2]))) keep.push(index[i], index[i + 1], index[i + 2]);
      }
      const g = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(geometry.attributes)) g.setAttribute(name, attr);
      g.morphAttributes = geometry.morphAttributes;
      g.morphTargetsRelative = geometry.morphTargetsRelative;
      g.setIndex(keep);
      g.boundingSphere = geometry.boundingSphere;
      this.cullCache.set(id, g);
    }
    return this.cullCache.get(id);
  }

  dispose() {
    for (const g of this.cullCache?.values() || []) g.index && g.dispose();
    for (const m of this.materialCache.values()) m.dispose();
    this.materialCache.clear();
    this.gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const m of [o.material].flat()) { for (const k in m) if (m[k]?.isTexture) m[k].dispose(); m.dispose(); }
    });
  }
}

export class AwdCharacter {
  constructor(template, look = {}) {
    this.template = template;
    this.root = SkeletonUtils.clone(template.gltf.scene);
    this.meshes = [];
    this.root.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = true; this.meshes.push(o); } });
    // Every part was exported with the same glTF skin, but loaders give each mesh its own
    // Skeleton. Share one so bone matrices (and the bone texture) are computed once per character.
    const shared = (this.skeleton = this.meshes[0]?.skeleton);
    for (const mesh of this.meshes.slice(1)) {
      const same = mesh.skeleton.bones.length === shared.bones.length && mesh.skeleton.bones.every((b, i) => b === shared.bones[i]);
      if (same) { mesh.skeleton.dispose(); mesh.bind(shared, mesh.bindMatrix); }
    }
    this.baseMaterials = new Map(this.meshes.map((m) => [m, m.material]));
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    for (const [name, clip] of Object.entries(template.clips)) {
      const action = this.mixer.clipAction(clip);
      if (!LOOPED.has(name)) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
      this.actions[name] = action;
    }
    this.current = null;
    this.blink = { next: 1 + Math.random() * 3, t: -1 };
    this.expression = {};
    this.sliders = {};
    this.setLook(look);
    this.play('idle', 0);
  }

  setLook(look) {
    const tone = SKIN[look.skin] ? look.skin : 5;
    const tint = (base, colour) => this.template.variant(base, colour, (m) => m.color.set(colour));
    for (const mesh of this.meshes) {
      const base = this.baseMaterials.get(mesh), name = base.name || '';
      const slot = mesh.userData.awdSlot || slotOf(mesh.name), slotColour = slot && look[slot + 'Col'];
      if (name === 'AWD_Skin') mesh.material = this.template.variant(base, 'tone' + tone, (m) => m.color.set(SKIN[tone]).multiplyScalar(SKIN_HEADROOM));
      else if (name.startsWith('AWD_Headwrap_')) mesh.material = tint(base, look.hatCol || '#7b2d8e');
      else if (name.startsWith('AWD_Hair_') || name.startsWith('AWD_Beard_') || name === 'AWD_Brows') {
        const colour = look.hairCol || '#141010';
        mesh.material = this.template.variant(base, 'hair' + colour, (m) => m.color.set(colour).multiplyScalar(HAIR_ALBEDO));
      } else if (slotColour && TINTED.test(name)) mesh.material = tint(base, slotColour);
      else mesh.material = base;   // prints, metal, lenses, soles and unset colours keep their authored look
    }
    this.sliders = Object.fromEntries(Object.keys(SLIDERS).map((k) => [k, sliderInfluence(k, look[k])]));
    // Height is a root scale, as in the live game (character.js).
    this.root.scale.setScalar(0.94 + Math.max(0, Math.min(1, Number(look.height ?? 0.5))) * 0.12);
    this.look = { ...look, skin: tone };
    this.applyMorphs(0);
  }

  // Attach a modular part (hair, beard, garment) exported with the same skeleton.
  // `part` is an AwdTemplate for the part GLB; meshes already in that slot are replaced.
  attachPart(slot, part) {
    this.detachSlot(slot);
    const clone = SkeletonUtils.clone(part.gltf.scene), shared = this.skeleton;
    const byName = new Map(shared.bones.map((b) => [b.name, b]));
    const added = [];
    clone.traverse((o) => { if (o.isSkinnedMesh) added.push(o); });
    for (const mesh of added) {
      const names = mesh.skeleton.bones.map((b) => b.name);
      const sameOrder = names.length === shared.bones.length && names.every((n, i) => n === shared.bones[i].name);
      const skeleton = sameOrder ? shared : new THREE.Skeleton(names.map((n) => byName.get(n)), mesh.skeleton.boneInverses);
      const host = this.root.getObjectByName(mesh.parent?.name) || this.meshes[0].parent;
      const hides = Number(extrasOf(mesh).awd_hides_regions || 0);   // read before re-parenting
      mesh.skeleton.dispose();
      host.add(mesh);
      mesh.bind(skeleton, mesh.bindMatrix);
      Object.assign(mesh, { frustumCulled: false, castShadow: true });
      mesh.userData.awdSlot = slot;
      mesh.userData.awdHides = hides;
      this.meshes.push(mesh);
      this.baseMaterials.set(mesh, mesh.material);
    }
    this.setLook(this.look);
    this.updateCulling();
  }

  // Drop body triangles whose three vertices all lie in regions the worn parts cover
  // completely (body attribute `_awd_region`, part extras `awd_hides_regions`).
  updateCulling() {
    const hidden = this.meshes.reduce((m, mesh) => m | (mesh.userData.awdHides || 0), 0);
    for (const mesh of this.meshes) {
      const original = mesh.userData.awdOriginalGeometry || mesh.geometry;
      const region = original.attributes._awd_region;
      if (!region || !original.index) continue;
      mesh.userData.awdOriginalGeometry = original;
      mesh.geometry = hidden ? this.template.culled(original, hidden) : original;
    }
  }

  detachSlot(slot) {
    const prefix = { hair: 'AWD_Hair', beard: 'AWD_Beard', top: 'AWD_Top', bottom: 'AWD_Bottom', shoes: 'AWD_Shoes', full: 'AWD_Full' }[slot];
    for (const mesh of this.meshes) {
      if (mesh.userData.awdSlot !== slot && !(prefix && mesh.name.startsWith(prefix))) continue;
      mesh.removeFromParent();
      this.baseMaterials.delete(mesh);
      if (mesh.skeleton !== this.skeleton) mesh.skeleton.dispose();
    }
    // Geometry and materials stay with their templates; only the links are dropped.
    this.meshes = this.meshes.filter((m) => this.baseMaterials.has(m));
    this.updateCulling();
  }

  setExpression(name, weight = 1) {
    this.expression = Object.fromEntries(Object.entries(EXPRESSIONS[name] || {}).map(([k, v]) => [k, v * weight]));
    this.applyMorphs(0);
  }

  applyMorphs(blink) {
    for (const mesh of this.meshes) {
      const dict = mesh.morphTargetDictionary; if (!dict) continue;
      for (const [key, index] of Object.entries(dict)) {
        if (key in SLIDERS) mesh.morphTargetInfluences[index] = this.sliders[key];
        else mesh.morphTargetInfluences[index] = key === 'blink' ? Math.max(blink, this.expression.blink || 0) : this.expression[key] || 0;
      }
    }
  }

  play(name, fade = 0.25) {
    const action = this.actions[name] || this.actions.idle;
    if (!action || this.current === action) return;
    action.reset().setEffectiveWeight(1).play();
    // A zero-length fadeIn leaves the weight at 0 until a later update, so cut instead.
    if (fade > 0) {
      action.fadeIn(fade);
      if (this.current) this.current.fadeOut(fade);
    } else if (this.current) this.current.stop();
    this.current = action;
  }

  update(dt) {
    this.mixer.update(dt);
    // Natural blinking: a short close-open every 2-5 s keeps the eyes alive.
    const b = this.blink; b.next -= dt;
    if (b.next <= 0 && b.t < 0) b.t = 0;
    let amount = 0;
    if (b.t >= 0) {
      b.t += dt; amount = Math.sin(Math.min(1, b.t / BLINK_SECONDS) * Math.PI);
      if (b.t >= BLINK_SECONDS) { b.t = -1; b.next = 2 + Math.random() * 3; }
    }
    this.applyMorphs(amount);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.root.removeFromParent();
    // Geometry and materials belong to the template; skeletons are per instance.
    for (const skeleton of new Set(this.meshes.map((m) => m.skeleton))) skeleton.dispose();
    this.meshes = [];
  }
}
