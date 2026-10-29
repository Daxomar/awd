// What a person visibly does during an activity: a looping action clip from the character pipeline
// (characters/scripts/awd_anim.py ACTION_CLIPS) plus the props in their hands (awd_props.py), instead of
// standing still while a progress bar runs. Roaming activities (strolls, jogs, tours) walk the person
// around nearby instead. The server stays authoritative for the activity itself; this is presentation.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// action -> props held while it plays (node names in awd_props_<sex>.glb without the "prop_" prefix)
export const CLIP_PROPS = {
  lift: ['dumbbell_L', 'dumbbell_R'], eat: ['plate', 'spoon'], drink: ['bottle'], phone_use: ['phone'], photo: ['phone'],
  cook: ['ladle'], sweep: ['broom'], carry: ['headpan'], guitar: ['guitar'], drum: ['drum'], read: ['book'], fix: ['wrench'],
  emcee: ['mic'],
};
// The clip an action name plays (emcee is talking with a microphone).
const CLIP_OF = { emcee: 'talk' };

const GROUPS = {
  eat: 'waakye waakyeSmall fufu banku redred kenkey kenkeyTake kelewele rush jollof tilapia khebab chickenkhebab provisionsnack streetmeal hospfood brunch foodcourt popcorn',
  drink: 'drinks palmwine vip sneakvip purewater fanyogo fanice',
  phone_use: 'phonemarket gadgets momo unlock accessories callin',
  photo: 'photoOsu shoot osu_photo planes',
  lift: 'train workout beachworkout bootcamp',
  box: 'spar fightnight',
  cheer: 'match watch bet streetbet streetwatch kite',
  dance: 'party battle djfuneral shutdown',
  drum: 'drumjam',
  type: 'cowork freelance buildmvp code sakawa',
  read: 'lecture balme legon_study legal nhis report vote tutor',
  talk: 'haggle gistMuni nima_courtyard airres_exchange mate pitch loans townhall rent showroom tour guide castletour kaneshie_prices helpvendor choir attend',
  emcee: 'emcee preacher',
  carry: 'kayayo hawk sellwater foodstuff bale resell',
  sweep: 'community_service',
  scrub: 'washplates bath',
  cook: 'cook',
  pull: 'net fish jtown_harbour',
  fix: 'fitter seed',
  swim: 'swim',
  guitar: 'guitar',
};
export const ACTIVITY_ACTION = Object.fromEntries(Object.entries(GROUPS).flatMap(([clip, ids]) => ids.split(' ').map((id) => [id, clip])));
// Activities done on the move: the person walks (or jogs) a loop around where they are, at this speed.
export const ROAM = { stroll: 1.2, labadi_stretch: 1.2, trasacco_walk: 1.2, ruins: 1.1, climb: 1.1, jog: 2.8, stadiumjog: 2.8 };
// Fallback by activity icon, for anything new on the server.
const BY_ICON = { 'bowl-food': 'eat', hamburger: 'eat', 'beer-bottle': 'drink', 'device-mobile': 'phone_use', camera: 'photo',
  barbell: 'lift', 'book-open': 'read', 'soccer-ball': 'cheer', 'music-notes': 'drum', wrench: 'fix', 'chat-circle-dots': 'talk',
  megaphone: 'emcee', microphone: 'emcee', 'person-simple-dance': 'dance', 'music-notes-simple': 'dance', 'fork-knife': 'scrub', 't-shirt': 'talk' };

// {action, clip, props} for an activity id (and optional icon), or null for a still pose (sleep, toilet, prayer).
export function actionFor(id, icon) {
  const action = ACTIVITY_ACTION[id] || BY_ICON[String(icon || '').replace(/^icon:/, '')];
  if (!action) return null;
  return { action, clip: CLIP_OF[action] || action, props: CLIP_PROPS[action] || [] };
}

// ---------------------------------------------------------------- props on bones
const loader = new GLTFLoader();
const propSets = new Map();   // sex -> Promise<Map(name -> {node, bone, level})>
const BASE = '/assets/characters/prototype/';

function loadProps(sex) {
  if (!propSets.has(sex)) {
    const p = loader.loadAsync(`${BASE}awd_props_${sex === 'f' ? 'female' : 'male'}.glb`).then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const out = new Map();
      gltf.scene.traverse((o) => {
        if (!o.name?.startsWith('prop_') || !o.userData?.awd_bone) return;
        out.set(o.name.slice(5), { node: o, bone: o.userData.awd_bone, level: !!o.userData.awd_level });
      });
      return out;
    });
    p.catch(() => propSets.delete(sex));
    propSets.set(sex, p);
  }
  return propSets.get(sex);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _e = new THREE.Euler();

// Holds the props for one avatar; attach(names) swaps what is held, update() keeps level props level.
export class PropHolder {
  constructor(avatar) { this.av = avatar; this.held = []; this.want = ''; }

  async attach(names = []) {
    const key = names.join(',');
    if (key === this.want) return;
    this.want = key;
    this.clear();
    if (!names.length) return;
    const sex = this.av.look?.body === 'f' ? 'f' : 'm';
    let set;
    try { set = await loadProps(sex); } catch { return; }
    const skeleton = this.av.skeleton;
    if (this.want !== key || this.av.disposed || !skeleton) return;
    for (const name of names) {
      const rec = set.get(name), index = rec ? skeleton.bones.findIndex((b) => b.name === rec.bone) : -1;
      if (index < 0) continue;
      // Rest-pose offset: the prop was modelled where it is held in the bind pose.
      _m.copy(skeleton.boneInverses[index]).multiply(rec.node.matrixWorld);
      const obj = rec.node.clone();
      _m.decompose(obj.position, obj.quaternion, obj.scale);
      obj.userData.level = rec.level;
      obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
      skeleton.bones[index].add(obj);
      this.held.push(obj);
    }
  }

  // Plates and headpans stay level whatever the wrist or head does (their heading is kept).
  update() {
    for (const obj of this.held) {
      if (!obj.userData.level || !obj.parent) continue;
      obj.parent.getWorldQuaternion(_pq);
      obj.getWorldQuaternion(_q);
      _e.setFromQuaternion(_q, 'YXZ'); _e.x = 0; _e.z = 0;
      _q.setFromEuler(_e);
      obj.quaternion.copy(_pq.invert().multiply(_q));
    }
  }

  clear() {
    for (const obj of this.held) obj.removeFromParent();   // geometry and materials stay shared with the set
    this.held = [];
  }
}
