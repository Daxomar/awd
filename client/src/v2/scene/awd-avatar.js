// Game avatar built from the Blender character assets (characters/, docs/prototype-report.md).
// Same surface as character.js Character, so rooms, rides, the studio and portraits use it unchanged:
// root, model, mixer, skeleton, actions, look, curName, native, play, gesture, update(dt, speed),
// setLook, dispose, plus `ready` (resolves once the current outfit is attached).
// Bodies and the fallback outfit load at boot; every other part loads on first use and is cached
// for the session. Instances never dispose shared geometry, materials or textures.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AwdTemplate, AwdCharacter } from './awd-runtime.js';

const BASE_URL = '/assets/characters/prototype/';
const SEX = { m: 'male', f: 'female' };
// Worn whenever a requested part is missing for a body or fails to load (preloaded at boot).
const FALLBACK = { m: { hair: 'lowcut', top: 'tee', bottom: 'jeans', shoes: 'slides' }, f: { hair: 'puff', top: 'tee', bottom: 'jeans', shoes: 'slides' } };
const SLOTS = ['hair', 'beard', 'top', 'bottom', 'full', 'shoes', 'hat', 'glasses', 'neck'];
// Hats are sized for short hair; volume styles swap to lowcut while a hat is worn.
const HAT_SAFE_HAIR = new Set(['lowcut', 'fade', 'waves', 'twa', 'cornrows', 'bald']);
// Ground speeds the clips were authored for (awd_anim.py walk/run stride and duration), m/s.
const WALK_SPEED = 1.4, RUN_SPEED = 2.9, RUN_ABOVE = 2.4;
const TIME_SCALE = [0.3, 1.7];
const DRESS_TIMEOUT_MS = 10000;
const GESTURE_FADE = 0.2;

const loader = new GLTFLoader();
const pending = new Map();   // file -> Promise<AwdTemplate>
const loaded = new Map();    // file -> AwdTemplate
let catalogue = null;

function loadTemplate(file) {
  if (!pending.has(file)) {
    const rev = catalogue?.rev?.[file];
    const promise = loader.loadAsync(BASE_URL + file + (rev ? '?v=' + rev : '')).then((gltf) => { const t = new AwdTemplate(gltf); loaded.set(file, t); return t; });
    promise.catch(() => pending.delete(file));   // a later look may retry
    pending.set(file, promise);
  }
  return pending.get(file);
}

const bodyFile = (sex, lod) => `awd_${SEX[sex]}_base_lod${lod}.glb`;

// undefined: not built for this body; null: nothing to draw (bald, nohat, ...); otherwise the part file.
function partFile(cat, slot, id, sex, lod) {
  const entry = cat.slots[slot]?.[id];
  if (entry === null) return null;
  const file = entry?.[sex];
  if (!file) return undefined;
  return lod === 0 ? file.replace('_lod1.glb', '.glb') : file;
}

// Saved look -> one part file (or null) per slot, with the documented substitutions.
// `cat` is catalogue.json (written by characters/tools/build-manifest.mjs).
export function resolveParts(cat, look, sex, lod = 1) {
  const fallback = FALLBACK[sex];
  const pick = (slot, id) => {
    const file = partFile(cat, slot, id, sex, lod);
    if (file !== undefined) return file;
    return fallback[slot] ? partFile(cat, slot, fallback[slot], sex, lod) : null;
  };
  const hatted = look.hat && look.hat !== 'nohat';
  const hair = hatted && !HAT_SAFE_HAIR.has(look.hair) ? 'lowcut' : look.hair;
  const out = {
    hair: pick('hair', hair), beard: sex === 'm' ? pick('beard', look.beard || 'nobeard') : null,
    shoes: pick('shoes', look.shoes), hat: pick('hat', look.hat || 'nohat'),
    glasses: pick('glasses', look.glasses || 'noglasses'), neck: pick('neck', look.neck || 'nochain'),
  };
  const full = look.full ? partFile(cat, 'full', look.full, sex, lod) : null;
  if (full) return { ...out, full, top: null, bottom: null };
  return { ...out, full: null, top: pick('top', look.top), bottom: pick('bottom', look.bottom) };
}

// Boot: catalogue, both gameplay bodies and the fallback outfit. Rejects if any is missing,
// so the caller can fall back to the classic avatar.
export async function loadAwdAvatars() {
  const response = await fetch(BASE_URL + 'catalogue.json');
  if (!response.ok) throw new Error('character catalogue: HTTP ' + response.status);
  catalogue = await response.json();
  const files = ['m', 'f'].flatMap((sex) => [bodyFile(sex, 1), ...Object.entries(FALLBACK[sex]).map(([slot, id]) => partFile(catalogue, slot, id, sex, 1))]);
  await Promise.all(files.map(loadTemplate));
}

export class AwdAvatar {
  constructor(look = {}, { lod = 1 } = {}) {
    if (!catalogue) throw new Error('loadAwdAvatars() must finish before avatars are created');
    this.lod = lod;
    this.native = false;   // poses.js: no relaxed-idle override, the authored idle already relaxes
    this.root = new THREE.Group();
    this.character = null;
    this.worn = {};
    this.dressToken = 0;
    this.ready = Promise.resolve();
    this.setLook(look);
  }

  get model() { return this.character.root; }
  get mixer() { return this.character.mixer; }
  get skeleton() { return this.character.skeleton; }
  get actions() { return this.character.actions; }

  setLook(look) {
    this.look = look;
    const sex = look.body === 'f' ? 'f' : 'm';
    const want = resolveParts(catalogue, look, sex, this.lod), wanted = bodyFile(sex, this.lod);
    // Close-up avatars (studio) ask for LOD0. Until that body and its parts have all arrived the
    // LOD1 body stands in (hidden until dressed), then everything swaps in one step.
    if (!loaded.has(wanted)) {
      const files = [wanted, ...Object.values(want).filter(Boolean)];
      Promise.all(files.map(loadTemplate)).then(() => { if (!this.disposed && this.look === look) this.setLook(look); }).catch(() => {});
    }
    const body = loaded.get(wanted) || loaded.get(bodyFile(sex, 1));
    if (body !== this.character?.template) this.buildBody(body);
    this.character.setLook(look);
    this.dress(want, sex);
  }

  buildBody(template) {
    const previous = this.character;
    this.character = new AwdCharacter(template, this.look);
    this.character.root.visible = false;   // never show the undressed body
    this.character.mixer.addEventListener('finished', (e) => this.onFinished(e));
    if (previous) previous.dispose();
    this.root.add(this.character.root);
    const name = this.curName && !this.oneShot ? this.curName : 'idle';
    Object.assign(this, { worn: {}, cur: this.character.current, curName: 'idle', oneShot: false, _rig: null, _posed: false });
    if (name !== 'idle') this.play(name, 0);
  }

  // Attach immediately when every part is cached; otherwise keep the current outfit until the
  // new one has loaded (or the timeout passes and missing parts fall back).
  dress(want, sex) {
    const token = ++this.dressToken;
    const files = Object.values(want).filter(Boolean);
    if (files.every((f) => loaded.has(f))) { this.attach(want, sex); return; }
    const settled = Promise.allSettled(files.map(loadTemplate));
    const timeout = new Promise((resolve) => setTimeout(resolve, DRESS_TIMEOUT_MS));
    const current = () => token === this.dressToken && !this.disposed;
    settled.then(() => current() && this.attach(want, sex));
    this.ready = Promise.race([settled, timeout]).then(() => { if (current() && !this.character.root.visible) this.attach(want, sex); });
  }

  attach(want, sex) {
    for (const slot of SLOTS) {
      let file = want[slot];
      if (file && !loaded.has(file)) {
        const id = FALLBACK[sex][slot];
        file = id ? partFile(catalogue, slot, id, sex, 1) : null;
        if (file && !loaded.has(file)) file = null;
      }
      if (this.worn[slot] === file) continue;
      if (file) this.character.attachPart(slot, loaded.get(file));
      else this.character.detachSlot(slot);
      this.worn[slot] = file;
    }
    this.character.setLook(this.look);
    this.character.root.visible = true;
  }

  crossTo(action, fade) {
    if (action === this.cur) return;
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (fade > 0) { action.fadeIn(fade); this.cur?.fadeOut(fade); } else this.cur?.stop();
    this.cur = action;
  }

  play(name, fade = 0.25) {
    if (this.oneShot) { if (name !== 'walk') { this.base = name; return; } this.oneShot = false; }
    if (this.curName === name) return;
    this.crossTo(this.actions[name] || this.actions.idle, fade);
    this.curName = name;
  }

  gesture(name) {
    const action = this.actions[name];
    if (!action) return;
    this.oneShot = true;
    this.base = this.curName === name ? 'idle' : this.curName || 'idle';
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    if (action === this.cur) this.cur = null;   // replaying the same gesture restarts it
    this.crossTo(action, GESTURE_FADE);
    this.curName = name;
  }

  onFinished(event) {
    if (!this.oneShot || event.action !== this.cur) return;
    this.oneShot = false;
    const next = this.base || 'idle';
    this.curName = null;
    this.play(next, GESTURE_FADE);
  }

  update(dt, speed = 0) {
    if (this.curName === 'walk') {
      const running = speed > RUN_ABOVE && this.actions.run;
      const action = running ? this.actions.run : this.actions.walk;
      this.crossTo(action, GESTURE_FADE);
      action.timeScale = THREE.MathUtils.clamp(speed / (running ? RUN_SPEED : WALK_SPEED), ...TIME_SCALE);
    }
    this.character.update(dt);
  }

  dispose() {
    this.disposed = true;
    this.dressToken++;
    this.character.dispose();
  }
}

// Shared-resource counts for diagnostics and tests.
export const awdResources = () => ({ templates: loaded.size, pending: pending.size - loaded.size });
