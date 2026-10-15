import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { h } from './dom.js';

const dots=[[[0,0]],[[-1,-1],[1,1]],[[-1,-1],[0,0],[1,1]],
  [[-1,-1],[1,-1],[-1,1],[1,1]],[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],
  [[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]];

export class BirthDie {
  constructor(stage,host){
    this.stage=stage;this.host=host;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.fallback=h('div.birth-die-fallback',{'aria-hidden':'true'},h('div.die-cube',null,
      ...dots.map((face,i)=>h('div.die-face',{class:'face-'+i},...face.map(([x,y])=>h('i',{style:{left:(50+x*25)+'%',top:(50+y*25)+'%'}}))))));
    host.append(this.fallback);
    if(!stage)return;
    try{
      this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e4ecdf');
      this.camera=new THREE.OrthographicCamera(-3,3,3,-3,.1,50);this.camera.position.set(3,2.6,5);this.camera.lookAt(0,.75,0);
      const materials=dots.map(face=>{
        const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#fffcf2';x.fillRect(0,0,128,128);x.fillStyle='#214e3c';
        for(const [dx,dy] of face){x.beginPath();x.arc(64+dx*29,64+dy*29,8,0,Math.PI*2);x.fill();}
        const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
        return new THREE.MeshStandardMaterial({map,roughness:.52});
      });
      this.die=new THREE.Mesh(new RoundedBoxGeometry(1,1,1,2,.1),materials);this.die.position.y=.78;this.die.rotation.set(.18,.45,-.08);this.scene.add(this.die);
      const plinth=this.plinth=new THREE.Mesh(new THREE.CylinderGeometry(.88,1,.25,40),new THREE.MeshStandardMaterial({color:'#286249',roughness:.7}));plinth.position.y=.125;this.scene.add(plinth);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(.9,.018,6,40),new THREE.MeshStandardMaterial({color:'#e6bb55',roughness:.5}));rim.rotation.x=Math.PI/2;rim.position.y=.24;this.scene.add(rim);
      this.scene.add(new THREE.HemisphereLight('#fff9e7','#88977c',2));const sun=new THREE.DirectionalLight('#fff4de',3);sun.position.set(3,5,4);this.scene.add(sun);
      const fill=new THREE.DirectionalLight('#d5e6ff',.7);fill.position.set(-3,2,1);this.scene.add(fill);
      this.fallback.hidden=true;
    }catch{this.scene=null;}
  }
  show(){this.host.hidden=false;if(this.scene)this.stage.override={scene:this.scene,camera:this.camera};this.resize();}
  outcome(origin){this.plinth?.material.color.set(origin==='dbee'?'#b38a3d':'#286249');}
  resize(){if(!this.camera)return;const r=this.host.getBoundingClientRect(),zoom=2.5*innerHeight/Math.max(140,r.height),a=innerWidth/innerHeight;
    Object.assign(this.camera,{left:-zoom*a/2,right:zoom*a/2,top:zoom/2,bottom:-zoom/2});
    this.camera.setViewOffset(innerWidth,innerHeight,(.5-(r.left+r.width/2)/innerWidth)*innerWidth,(.5-(r.top+r.height/2)/innerHeight)*innerHeight,innerWidth,innerHeight);this.camera.updateProjectionMatrix();}
  hide(){this.host.hidden=true;if(this.scene&&this.stage?.override?.scene===this.scene)this.stage.override=null;}
  roll(){
    if(this.reduced)return Promise.resolve();
    this.fallback.classList.add('rolling');const start=performance.now();
    return new Promise(resolve=>{this.resolveRoll=resolve;
      const tick=()=>{const t=Math.min(1,(performance.now()-start)/1400),ease=1-(1-t)**3;
        if(this.die){this.die.rotation.set(.18+ease*Math.PI*6,.45+ease*Math.PI*8,-.08+Math.sin(t*Math.PI)*.5);this.die.position.y=.78+Math.sin(t*Math.PI)*.45;}
        if(t<1)this.frame=requestAnimationFrame(tick);
      };tick();this.timer=setTimeout(()=>{cancelAnimationFrame(this.frame);this.fallback.classList.remove('rolling');this.resolveRoll=null;resolve();},1450);
    });
  }
  dispose(){clearTimeout(this.timer);cancelAnimationFrame(this.frame);this.resolveRoll?.();this.hide();this.fallback.remove();
    this.scene?.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){m.map?.dispose();m.dispose();}});}
}
