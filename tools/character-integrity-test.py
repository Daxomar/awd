"""Check the live character pipeline, poses and repeated geometry ownership.

Run Vite first. Screenshots/metrics are private local review artifacts, not golden
image comparisons or representative-phone FPS measurements.
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path('.local/mission-audit')

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = await browser.new_page(viewport={'width': 430, 'height': 860})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto('http://127.0.0.1:5173/chartest.html?one=0&freeze=1', wait_until='domcontentloaded')
        await page.wait_for_function('()=>window.__T?.ready', timeout=120000)
        assert not await page.evaluate('()=>__T.errors')
        result = await page.evaluate('''async()=>{
          const {applyPose}=await import('/src/v2/scene/poses.js');
          const a=__avs[0], original={...a.look}, twin=new a.constructor(original);
          __st.scene.add(twin.root);twin.root.position.x=.8;
          const kept=twin.meshes[0].geometry;let prematurelyDisposed=false;
          kept.addEventListener('dispose',()=>{prematurelyDisposed=true;});
          const counts=[];let checked=0;
          for(const body of ['m','f'])for(const value of [0,1])for(const outfit of [
            {top:'tee',bottom:'jeans'},{top:'hoodie',bottom:'joggers'},
            {top:'crop',bottom:'shorts'},{full:'kentedress',bottom:'jeans'}]){
            a.setLook({body,skin:5,hair:'fade',beard:'nobeard',...outfit,
              ...Object.fromEntries(['build','hips','bust','waist','shoulders','muscle','faceWidth','nose','lips'].map(k=>[k,value]))});
            for(const pose of ['stand','sit','cheer']){
              a.play(pose==='stand'?'walk':'idle',0);a.update(.3,1.4);applyPose(a,pose);
              a.root.updateMatrixWorld(true);a.skeleton.update();
              for(const mesh of a.meshes){const p=mesh.geometry.attributes.position,w=mesh.geometry.attributes.skinWeight;
                for(let i=0;i<p.count;i++){const sum=w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i),v=a.root.position.clone();
                  mesh.getVertexPosition(i,v);if(Math.abs(sum-1)>.001||!Number.isFinite(v.x+v.y+v.z)||v.length()>5)throw Error('Invalid posed vertex');}
              }checked++;
            }
          }
          for(let i=0;i<40;i++){
            a.setLook({...original,waist:i/39});a.play('idle',0);a.update(.01,0);__st.render();
            if(i>=20)counts.push(__st.renderer.info.memory.geometries);
          }
          if(prematurelyDisposed)throw Error('Disposed geometry belonging to a live avatar');
          const cache=a.constructor.resourceStats();if(cache.idle>16||cache.references!==2)throw Error('Unbounded cache or leaked reference: '+JSON.stringify(cache));
          twin.dispose();__st.scene.remove(twin.root);a.setLook(original);a.update(.01,0);
          if(Math.max(...counts)-Math.min(...counts)>16)throw Error('GPU geometry did not stabilize');
          return {posedCases:checked,cache,gpuGeometryRange:[Math.min(...counts),Math.max(...counts)]};
        }''')
        for body in ['m', 'f']:
            await page.evaluate('''body=>{const a=__avs[0];a.setLook({body,skin:5,hair:body==='f'?'puff':'fade',top:'tee',topCol:'#e9e2d0',bottom:'jeans',shoes:'sneakers'});a.play('idle',0);a.update(.01,0);a.root.rotation.y=0;__st.render();}''', body)
            await page.screenshot(path=str(OUT / f'character-{body}.png'))
        assert not errors, errors
        (OUT / 'character-metrics.json').write_text(json.dumps(result, indent=2))
        print('PASS character pipeline', json.dumps(result), flush=True)
        await browser.close()

asyncio.run(main())
