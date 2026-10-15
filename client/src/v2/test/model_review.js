import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
const canvas=document.querySelector('canvas'),scene=new THREE.Scene();scene.background=new THREE.Color('#ecebe4');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<600?1:1.5));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.01,100);camera.position.set(.35,1.1,3.9);
const orbit=new OrbitControls(camera,canvas);orbit.target.set(0,.85,0);orbit.enableDamping=true;orbit.minDistance=1.8;orbit.maxDistance=6;
scene.add(new THREE.HemisphereLight('#fff8ed','#7b8b77',2));
const light=new THREE.DirectionalLight('#fff4df',2.3);light.position.set(3,6,4);light.castShadow=true;light.shadow.mapSize.set(innerWidth<600?512:1024,innerWidth<600?512:1024);scene.add(light);
const fill=new THREE.DirectionalLight('#d9e8ed',1);fill.position.set(-3,3,4);scene.add(fill);
const floor=new THREE.Mesh(new THREE.CircleGeometry(5,48),new THREE.MeshStandardMaterial({color:'#ecebe4',roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const status=document.querySelector('#status'),loader=new GLTFLoader();let model,mixer,actions,serial=0,walking=false;
const dispose=root=>root?.traverse(o=>{if(o.geometry)o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){material.map?.dispose();material.dispose();}});
async function choose(sex){
  const request=++serial;status.textContent='Loading model…';
  try{
    const asset=await loader.loadAsync('/assets/models/accra-'+sex+'-player.glb?v=20261015-fit1');
    if(request!==serial){dispose(asset.scene);return;}
    mixer?.stopAllAction();if(model){scene.remove(model);dispose(model);}
    model=asset.scene;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;}});scene.add(model);
    mixer=new THREE.AnimationMixer(model);actions=Object.fromEntries(asset.animations.map(a=>[a.name,mixer.clipAction(a)]));
    (walking?actions.Walk:actions.Idle).play();
    for(const key of ['male','female'])document.getElementById(key).setAttribute('aria-pressed',String(key===sex));
    document.querySelector('#download').href='/assets/models/accra-'+sex+'-player.glb?v=20261015-fit1';
    status.textContent='Rigged GLB · '+sex+' adult';resize();window.__modelReview={ready:true,sex,model,mixer,renderer,draw:()=>renderer.render(scene,camera),animations:asset.animations.map(a=>a.name)};
  }catch(e){status.textContent='Could not load the model. '+e.message;}
}
for(const sex of ['male','female'])document.getElementById(sex).onclick=()=>choose(sex);
document.querySelector('#walk').onclick=()=>{if(!actions)return;walking=!walking;document.querySelector('#walk').setAttribute('aria-pressed',String(walking));for(const a of Object.values(actions))a.stop();(walking?actions.Walk:actions.Idle).reset().play();};
const resize=()=>{const top=Math.ceil(document.querySelector('header').getBoundingClientRect().bottom)+12,bottom=document.querySelector('footer').offsetHeight+26,height=Math.max(120,innerHeight-top-bottom);canvas.style.position='absolute';canvas.style.top=top+'px';canvas.style.height=height+'px';camera.aspect=innerWidth/height;camera.updateProjectionMatrix();renderer.setSize(innerWidth,height,false);};addEventListener('resize',resize);resize();
const clock=new THREE.Clock();let lastFrame=0;renderer.setAnimationLoop(time=>{if(document.hidden||time-lastFrame<32)return;lastFrame=time;const dt=Math.min(.05,clock.getDelta());mixer?.update(dt);orbit.update();renderer.render(scene,camera);});choose('male');
