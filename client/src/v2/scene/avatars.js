// Editable GLB human anatomy, fitted wardrobe and a retargeted mocap skeleton.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { initCharacters, Character, SKIN } from './character.js';

let ready = null;
export const SKIN_TONES = SKIN;
export function loadAvatars() {
  if (ready) return ready;
  const loader = new GLTFLoader();
  const model = name => loader.loadAsync('/assets/models/'+name+'.glb');
  ready = Promise.all([model('rpm_lo'), fetch('/assets/anim/clips.json').then((r) => r.json()), model('accra-male'), model('accra-female')]).then(([m, clips, male, female]) => {
    const human={native:true,joints:{},morphs:{}};
    for(const [sex,asset] of [['male',male],['female',female]]){
      const root=asset.scene.children[0],meshes=[];asset.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
      if(!root.userData.sourceJoints||!meshes.length)throw new Error('Invalid human model: '+sex);
      const mesh=meshes[0],geometry=mesh.geometry;
      human[sex]=Array.from(geometry.attributes.position.array);human.joints[sex]=root.userData.sourceJoints;
      human.morphs[sex]=Object.fromEntries(Object.entries(mesh.morphTargetDictionary).map(([name,index])=>[name,geometry.morphAttributes.position[index].array]));
      if(sex==='male'){
        human.triangles=meshes.flatMap(o=>Array.from(o.geometry.index.array));
        human.skinIndices=Array.from(geometry.attributes.skinIndex.array);human.skinWeights=Array.from(geometry.attributes.skinWeight.array);
        human.weightBones=mesh.skeleton.bones.map(b=>b.name);
      }
    }
    const c = {}; for (const k in clips.m) c[k] = THREE.AnimationClip.parse(clips.m[k]); initCharacters(m, c, human); return true;
  });
  return ready;
}
// accept old-format looks (top/bottom as hex colours, skinTone) and NPC shorthand
const OLDTOP = (hex) => ({ top: 'tee', topCol: hex });
export function normalizeLook(l = {}) {
  const f = l.body === 'f'; const o = { body: f ? 'f' : 'm', skin: l.skin || l.skinTone || 5, hair: l.hair || (f ? 'puff' : 'lowcut'), hairCol: l.hairCol || '#141010', beard: l.beard || 'nobeard',
    build: l.build ?? .5, hips: l.hips ?? .5, bust: l.bust ?? .45, height: l.height ?? .5, top: l.top, topCol: l.topCol, bottom: l.bottom, bottomCol: l.bottomCol, full: l.full, fullCol: l.fullCol, shoes: l.shoes || 'slides', shoesCol: l.shoesCol || '#17150f', hat: l.hat || 'nohat', hatCol: l.hatCol, glasses: l.glasses || 'noglasses', neck: l.neck || 'nochain', neckCol: l.neckCol };
  for(const key of ['waist','shoulders','muscle','faceWidth','nose','lips'])o[key]=l[key]??.5;
  if (!o.top || o.top[0] === '#') { // NPC / legacy shorthand: dress them in something Accra
    const tc = l.top && l.top[0] === '#' ? l.top : f ? '#e76f51' : '#f4f4f2', bc = l.bottom && l.bottom[0] === '#' ? l.bottom : '#2b3a55';
    let hsh = 0; for (const ch of tc + bc + (l.skinTone || '')) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    const PR = ['#e76f51', '#1f6fb8', '#0e7a4e', '#7b2d8e', '#f2b632', '#c8102e'], pc = PR[hsh % PR.length];
    if (tc === '#ffffff' || tc === '#f4f4f4' && bc === '#ffffff') Object.assign(o, f ? { full: 'sundress', fullCol: '#f4f4f2', top: 'tee', topCol: '#f4f4f2', bottom: 'jeans', bottomCol: '#f4f4f2' } : { top: 'office', topCol: '#f4f4f2', bottom: 'chinos', bottomCol: '#1d2433' });
    else if (tc === '#2b4a7a') Object.assign(o, { top: 'office', topCol: '#2b4a7a', bottom: 'suitpants', bottomCol: '#1d2433', hat: 'cap', hatCol: '#1d2433', shoes: 'boots' });
    else if (tc === '#151515' || tc === '#b3202a') Object.assign(o, { top: f ? 'blouse' : 'office', topCol: f ? '#17150f' : '#17150f', bottom: f ? 'pencil' : 'suitpants', bottomCol: '#17150f' });
    else { const k = (hsh >> 4) % 5; if (f) Object.assign(o, [{ top: 'kaba', topCol: pc, bottom: 'slit', bottomCol: pc }, { full: 'ankaradress', fullCol: pc, top: 'tee', bottom: 'jeans' }, { top: 'blouse', topCol: '#f4f4f2', bottom: 'pencil', bottomCol: '#17150f' }, { top: 'crop', topCol: tc, bottom: 'jeans', bottomCol: bc }, { top: 'tee', topCol: tc, bottom: 'jeans', bottomCol: bc }][k], { hair: ['braids', 'duku', 'puff', 'bun', 'bob'][hsh % 5], hatCol: pc });
      else Object.assign(o, [{ top: 'tee', topCol: tc, bottom: 'jeans', bottomCol: bc }, { top: 'ankara', topCol: pc, bottom: 'chinos', bottomCol: '#1d2433' }, { top: 'jersey', topCol: '#f4f4f2', bottom: 'shorts', bottomCol: bc }, { top: 'polo', topCol: tc, bottom: 'chinos', bottomCol: '#c2a878' }, { top: 'fugu', topCol: '#1f3f8f', bottom: 'jeans', bottomCol: bc }][k], { hair: ['lowcut', 'fade', 'waves', 'twists', 'locs'][hsh % 5], beard: ['nobeard', 'stubble', 'goatee', 'nobeard', 'fullbeard'][(hsh >> 3) % 5] }); }
  }
  if (!o.bottom || o.bottom[0] === '#') { o.bottomCol = l.bottom && l.bottom[0] === '#' ? l.bottom : '#2b3a55'; o.bottom = 'jeans'; }
  if (!o.topCol) o.topCol = '#f4f4f2'; if (!o.bottomCol) o.bottomCol = '#2b3a55'; if (o.full && !o.fullCol) o.fullCol = '#e76f51';
  return o;
}
export class Avatar extends Character { constructor(look = {}) { super(normalizeLook(look)); } setLook(look) { super.setLook(normalizeLook(look)); } }
