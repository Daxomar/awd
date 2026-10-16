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

const LOOPED = new Set(['idle', 'walk', 'run', 'sit_idle', 'talk', 'dance_01', 'phone_use']);

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

  dispose() {
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
    const shared = this.meshes[0]?.skeleton;
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
    this.setLook(look);
    this.play('idle', 0);
  }

  setLook(look) {
    const tone = SKIN[look.skin] ? look.skin : 5;
    const tint = (base, key, colour) => this.template.variant(base, key, (m) => m.color.set(colour));
    for (const mesh of this.meshes) {
      const base = this.baseMaterials.get(mesh), name = base.name || '';
      if (name === 'AWD_Skin') mesh.material = this.template.variant(base, 'tone' + tone, (m) => m.color.set(SKIN[tone]).multiplyScalar(SKIN_HEADROOM));
      else if (name.startsWith('AWD_Hair_') || name === 'AWD_Brows') {
        const colour = look.hairCol || '#141010';
        mesh.material = this.template.variant(base, 'hair' + colour, (m) => m.color.set(colour).multiplyScalar(HAIR_ALBEDO));
      } else if (name.startsWith('AWD_Fabric_tee') && look.topCol) mesh.material = tint(base, look.topCol, look.topCol);
      else if (name.startsWith('AWD_Fabric_denim') && look.bottomCol) mesh.material = tint(base, look.bottomCol, look.bottomCol);
      else if (name.endsWith('_upper') && look.shoesCol) mesh.material = tint(base, look.shoesCol, look.shoesCol);
      else mesh.material = base;
    }
    this.look = { ...look, skin: tone };
  }

  setExpression(name, weight = 1) {
    this.expression = Object.fromEntries(Object.entries(EXPRESSIONS[name] || {}).map(([k, v]) => [k, v * weight]));
    this.applyMorphs(0);
  }

  applyMorphs(blink) {
    for (const mesh of this.meshes) {
      const dict = mesh.morphTargetDictionary; if (!dict) continue;
      for (const [key, index] of Object.entries(dict)) {
        mesh.morphTargetInfluences[index] = key === 'blink' ? Math.max(blink, this.expression.blink || 0) : this.expression[key] || 0;
      }
    }
  }

  play(name, fade = 0.25) {
    const action = this.actions[name] || this.actions.idle;
    if (!action || this.current === action) return;
    action.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
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
