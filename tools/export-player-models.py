"""Export the game's dressed, rigged characters as portable GLBs and verify reloads."""
import asyncio, base64, json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'client/public/assets/models'

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=await browser.new_page(viewport={'width':450,'height':800})
  await page.goto('http://127.0.0.1:5173/chartest.html?one=0&freeze=1')
  await page.wait_for_function('window.__T?.ready',timeout=90000)
  assert not await page.evaluate('__T.errors')
  for sex,look in [('male',{'body':'m','skin':5,'hair':'fade','beard':'nobeard','top':'jersey','bottom':'jeans','shoes':'sneakers','shoesCol':'#f4f4f2'}),
                   ('female',{'body':'f','skin':5,'hair':'braids','beard':'nobeard','top':'jerseyaway','bottom':'jeans','bust':.55,'shoes':'sneakers','shoesCol':'#f4f4f2'})]:
   payload=await page.evaluate('''async look=>{
     const THREE=await import('/node_modules/three/build/three.module.js');
     const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
     const {applyModelWalk}=await import('/src/v2/scene/poses.js');
     const a=__avs[0];a.root.rotation.set(0,0,0);a.setLook(look);a.play('idle',0);a.update(.01,0);a.root.updateMatrixWorld(true);a.mixer.stopAllAction();a.update(0,0);
     const tracks=a.skeleton.bones.map(b=>new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',[0,2],[...b.quaternion.toArray(),...b.quaternion.toArray()]));
     const hips=a.skeleton.bones.find(b=>b.name==='Hips');tracks.push(new THREE.VectorKeyframeTrack('Hips.position',[0,2],[...hips.position.toArray(),...hips.position.toArray()]));
     const idle=new THREE.AnimationClip('Idle',2,tracks),rest=a.skeleton.bones.map(b=>b.quaternion.clone()),samples=a.skeleton.bones.map(()=>[]),times=[];
     for(let frame=0;frame<=24;frame++){a.skeleton.bones.forEach((b,i)=>b.quaternion.copy(rest[i]));applyModelWalk(a,frame/24*Math.PI*2);times.push(frame/24*1.2);a.skeleton.bones.forEach((b,i)=>samples[i].push(...b.quaternion.toArray()));}
     const walk=new THREE.AnimationClip('Walk',1.2,a.skeleton.bones.map((b,i)=>new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,samples[i])));
     a.skeleton.bones.forEach((b,i)=>b.quaternion.copy(rest[i]));a.root.updateMatrixWorld(true);
     a.root.userData.assetInfo={name:'Accra We Dey '+(look.body==='m'?'Man':'Woman'),source:'MakeHuman CC0 derivative; original game wardrobe',licence:'See LICENSE-human.md'};
     const out=await new GLTFExporter().parseAsync(a.root,{binary:true,animations:[idle,walk],onlyVisible:true});
     // Skin matrices already express joint transforms in world space. Make skin
     // nodes scene roots so editors do not also apply the rig's parent transform.
     const view=new DataView(out),jsonLength=view.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(out,20,jsonLength)));
     const skins=doc.nodes.map((n,i)=>n.skin!==undefined?i:null).filter(i=>i!==null);
     for(const n of doc.nodes)if(n.children){n.children=n.children.filter(i=>!skins.includes(i));if(!n.children.length)delete n.children;}
     doc.scenes[doc.scene||0].nodes=[...new Set([...doc.scenes[doc.scene||0].nodes,...skins])];
     const text=new TextEncoder().encode(JSON.stringify(doc)),paddedLength=Math.ceil(text.length/4)*4,bin=new Uint8Array(out,20+jsonLength),buffer=new ArrayBuffer(20+paddedLength+bin.length),header=new DataView(buffer);
     header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,buffer.byteLength,true);header.setUint32(12,paddedLength,true);header.setUint32(16,0x4e4f534a,true);
     const bytes=new Uint8Array(buffer);bytes.fill(32,20,20+paddedLength);bytes.set(text,20);bytes.set(bin,20+paddedLength);
     let data='';for(let i=0;i<bytes.length;i+=32768)data+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(data);
   }''',look)
   path=DEST/f'accra-{sex}-player.glb';path.write_bytes(base64.b64decode(payload));print(path.name,path.stat().st_size,'bytes',flush=True)
   check=await page.evaluate('''async path=>{const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');const g=await new GLTFLoader().loadAsync(path);let meshes=0,vertices=0;g.scene.traverse(o=>{if(o.isSkinnedMesh){meshes++;vertices+=o.geometry.attributes.position.count;}});return {meshes,vertices,animations:g.animations.map(a=>a.name)};}''','/assets/models/'+path.name)
   assert check['meshes']>=7 and check['animations']==['Idle','Walk'],check
   print('PASS portable model reload',sex,json.dumps(check),flush=True)
  await browser.close()

asyncio.run(main())
