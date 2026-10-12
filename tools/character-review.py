import asyncio,json
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=await browser.new_page(viewport={'width':450,'height':800})
  await page.goto('http://127.0.0.1:5173/chartest.html?one=0&freeze=1',wait_until='domcontentloaded')
  await page.wait_for_function('__T.ready',timeout=60000)
  errors=await page.evaluate('__T.errors'); assert not errors,errors
  await page.evaluate("()=>{window.__qaDraw=__st.render.bind(__st);__st.render=()=>{};__st.hemi.intensity=1.8;__st.key.intensity=1.6;__st.fill.intensity=1.4;__st.fill.position.set(0,2,5);}")
  for kind,look in [('male',{'body':'m','top':'jersey','skin':5,'hair':'fade','beard':'stubble','build':.55,'hips':.5,'bottom':'jeans','shoes':'sneakers'}),('female',{'body':'f','top':'jerseyaway','topCol':'#f2b632','skin':5,'hair':'puff','build':.65,'hips':.75,'bust':.85,'bottom':'jeans','shoes':'sneakers'})]:
   await page.evaluate("(look)=>{__avs[0].setLook(look);__avs[0].update(.01,0);__qaDraw();}",look)
   result=await page.evaluate("()=>__avs[0].meshes.map(m=>{const p=m.geometry.attributes.position;return {key:m.material.name,triangles:m.geometry.index.count/3,finite:Array.from(p.array).every(Number.isFinite)};})")
   assert all(r['finite'] and r['triangles']>0 for r in result),result
   await page.screenshot(path=f'.local/qa/avatar-{kind}.png')
   print(kind,json.dumps({'meshes':len(result),'triangles':sum(r['triangles'] for r in result),'finite':True}),flush=True)
  await page.evaluate('''async()=>{const a=__avs[0],T=await import('/node_modules/three/build/three.module.js'),{applyPose}=await import('/src/v2/scene/poses.js');
    const shapes=['build','hips','bust','waist','shoulders','muscle','faceWidth','nose','lips'];
    for(const body of ['m','f'])for(const value of [0,1])for(const outfit of [{top:'tee',bottom:'jeans'},{top:'crop',bottom:'shorts'},{full:'kentedress',fullCol:'#ce9643',bottom:'jeans'},{top:'hoodie',bottom:'joggers'}]){
      a.setLook({body,skin:5,hair:'puff',...outfit,...Object.fromEntries(shapes.map(k=>[k,value]))});a.play('walk',0);a.update(.3,1.4);
      for(const pose of ['stand','sit','cheer']){applyPose(a,pose);a.model.updateMatrixWorld(true);a.skeleton.update();for(const m of a.meshes){const p=m.geometry.attributes.position,w=m.geometry.attributes.skinWeight;for(let i=0;i<p.count;i++){const sum=w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i);if(Math.abs(sum-1)>.001)throw Error('Unnormalised weights');const v=new T.Vector3();m.getVertexPosition(i,v);if(!Number.isFinite(v.x+v.y+v.z)||v.length()>5)throw Error('Invalid posed vertex');}}}
    }
  }''')
  print('PASS male/female, 9 shape controls at both extremes, 4 outfits, walking/seated/raised arms; normalised weights and finite bounded deformations',flush=True)
  await browser.close()
asyncio.run(main())
