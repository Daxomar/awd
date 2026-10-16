// One shared renderer, cached portraits, and queued work keep phone lists inexpensive.
import * as THREE from 'three';
import { Avatar, loadAvatars } from '../scene/avatars.js';
import { h,ic } from './dom.js';
let renderer;const cache=new Map(),pending=new Map();let queue=Promise.resolve();
export function portrait(look,name='',className='avatar-c'){
 const el=h('div.'+className,{'aria-label':`${name || 'Player'} character portrait`,style:{overflow:'hidden',background:'#d9e1db'}},ic('user'));
 if(!look)return el;
 const key=JSON.stringify(look),show=url=>{if(!url)return;el.replaceChildren(h('img',{src:url,alt:`${name || 'Player'} character`,style:{width:'100%',height:'100%',objectFit:'cover'}}));};
 if(cache.has(key)){show(cache.get(key));return el;}
 if(!pending.has(key)){
  const task=queue.then(async()=>{await loadAvatars();await new Promise(r=>requestAnimationFrame(r));
   renderer??=new THREE.WebGLRenderer({alpha:false,antialias:true,preserveDrawingBuffer:true});renderer.setSize(96,96);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
   const scene=new THREE.Scene();scene.background=new THREE.Color('#d9e1db');scene.add(new THREE.HemisphereLight('#fff7ef','#707f72',2));const light=new THREE.DirectionalLight('#fff7ef',2);light.position.set(-2,3,4);scene.add(light);
   const avatar=new Avatar(look);await avatar.ready;avatar.root.rotation.y=.12;avatar.mixer.stopAllAction();scene.add(avatar.root);avatar.model.updateMatrixWorld(true);
   const focus=new THREE.Vector3();avatar.skeleton.bones.find(b=>b.name==='Head').getWorldPosition(focus);focus.y+=.05*avatar.root.scale.y;const camera=new THREE.PerspectiveCamera(26,1,.1,10);camera.position.set(focus.x,focus.y+.01,focus.z+.95);camera.lookAt(focus);renderer.render(scene,camera);const url=renderer.domElement.toDataURL('image/webp',.85);avatar.dispose();cache.set(key,url);if(cache.size>80)cache.delete(cache.keys().next().value);return url;
  });pending.set(key,task);queue=task.catch(()=>{});task.finally(()=>pending.delete(key)).catch(()=>{});
 }
 pending.get(key).then(show).catch(()=>{});return el;
}
