"""Authenticated, read-only world audit on disposable local QA fixtures.
Software-rendered desktop diagnostics are not physical-phone measurements.
"""
import asyncio, argparse, json, time
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

async def main():
    parser=argparse.ArgumentParser();parser.add_argument('--label',default='baseline');parser.add_argument('--base',default='http://127.0.0.1:8083');args=parser.parse_args()
    if urlsplit(args.base).hostname not in ('localhost','127.0.0.1'):raise ValueError('Loopback QA only')
    fixture=next(f for f in json.loads(Path('.local/phase8/fixtures.json').read_text()) if f['role']=='career')
    out=Path('docs/master/'+('stage0' if args.label=='baseline' else 'stage1'));out.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--disable-gpu-compositing','--num-raster-threads=1'])
        context=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
        await context.add_cookies([{'name':'awd_session','value':fixture['cookie'],'url':args.base,'httpOnly':True,'sameSite':'Strict'}])
        await context.add_init_script("(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>setTimeout(()=>raf(f),75)})();")
        p=await context.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));start=time.monotonic()
        try:
            await p.goto(args.base,wait_until='domcontentloaded',timeout=120000)
            await p.wait_for_function('()=>!!window.__world?.me',timeout=180000)
            await p.evaluate('()=>{__stage.renderer.setPixelRatio(.5);__stage.renderer.shadowMap.enabled=false;window.__qaDraw=__stage.render.bind(__stage);__stage.render=()=>{};}')
            async def shot(name):
                await p.evaluate('()=>{__stage.renderer.shadowMap.enabled=false;__qaDraw();}')
                await p.screenshot(path=str(out/name),type='jpeg',quality=86,timeout=120000)
            if await p.get_by_role('button',name='Skip tour',exact=True).count():await p.get_by_role('button',name='Skip tour',exact=True).click()
            await shot('home.jpg');print('Authenticated home ready',flush=True)
            await p.get_by_role('button',name='Map',exact=True).click()
            await p.wait_for_function('()=>__map.ready',timeout=240000)
            await p.wait_for_timeout(1500)
            await p.evaluate('()=>{__stage.renderer.shadowMap.enabled=false;__qaDraw();}')
            metrics={'coldToMapSeconds':round(time.monotonic()-start,3),'map':await p.evaluate('()=>__map.stats()'),'renderer':await p.evaluate('()=>({calls:__stage.renderer.info.render.calls,triangles:__stage.renderer.info.render.triangles,memory:__stage.renderer.info.memory})')}
            await shot('city-normal.jpg')
            await p.evaluate('()=>__map.overview()');await p.wait_for_function('()=>!__map.transition',timeout=90000)
            await shot('city-overview.jpg')
            if args.label!='baseline':
                assert await p.evaluate('()=>__map.mode')=='compact'
                for name in ['Nima','Osu','Airport Residential','East Legon','Trasacco','Jamestown']:
                    await p.get_by_role('button',name='Explore districts',exact=True).click()
                    await p.get_by_role('searchbox').fill(name)
                    await p.locator('.city-place-row').filter(has_text=name).first.click();await p.wait_for_function('()=>!__map.transition',timeout=90000)
                    await shot(name.lower().replace(' ','-')+'.jpg');print('District inspected: '+name,flush=True)
                await p.get_by_role('button',name='Geographic map',exact=True).click()
                await p.wait_for_function('()=>__map.mode==="geographic"&&__map.geoReady',timeout=240000)
                await p.evaluate('()=>__map.overview()');await p.wait_for_function('()=>!__map.transition',timeout=90000)
                await shot('geographic-map.jpg')
                await p.get_by_role('button',name='Compact city',exact=True).click();await p.wait_for_timeout(1500)
                assert await p.evaluate('()=>__map.mode')=='compact'
                metrics['afterModeCycle']=await p.evaluate('()=>__map.stats()')
                assert not metrics['afterModeCycle']['geographicLoaded']
                assert metrics['afterModeCycle']['geometryBytes']<1000000
                metrics['modeCycle']='compact → geographic → compact, same authenticated session'
                print('Geographic mode and return passed',flush=True)
                visited=[]
                for place in await p.evaluate('()=>__G.cat.locs.map(l=>({id:l.id,name:l.name}))'):
                    await p.get_by_role('button',name='Places',exact=True).click()
                    await p.get_by_role('searchbox').fill(place['name'])
                    await p.locator('.city-place-row').filter(has_text=place['name']).first.click()
                    await p.get_by_role('dialog',name=place['name'],exact=True).wait_for()
                    assert await p.locator('.rides .ride').count()>=5
                    visited.append(place['id'])
                    if place['id']=='bank':await shot('public-destination.jpg')
                    await p.get_by_role('button',name='Close',exact=True).click()
                metrics['destinationPreviews']=visited
                assert len(visited)==55
                for width,height in [(375,812),(390,844),(430,932),(390,530),(844,390)]:
                    await p.set_viewport_size({'width':width,'height':height});await p.evaluate('()=>__map.overview()');await p.wait_for_function('()=>!__map.transition',timeout=90000)
                    assert await p.evaluate('()=>document.documentElement.scrollWidth<=innerWidth+1')
                    targets=await p.locator('.city-controls button').evaluate_all('(els)=>els.map(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,left:r.left,right:r.right};})')
                    assert all(t['w']>=44 and t['h']>=44 and t['left']>=0 and t['right']<=width+1 for t in targets),targets
                    await shot(f'mobile-{width}x{height}.jpg')
                await p.set_viewport_size({'width':390,'height':844})
                await p.evaluate('()=>{__map.focus(...__map.slotOf("bank"),18);for(const pin of __map.pins.values())pin.el.style.visibility="hidden";}')
                point=await p.evaluate('()=>{const [x,z]=__map.slotOf("bank"),v=__stage.view.target.clone().set(x,.7,z).project(__stage.camera);return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight};}')
                await p.mouse.click(point['x'],point['y'])
                await p.get_by_role('dialog',name='Gold Coast Bank, Ridge',exact=True).wait_for()
                metrics['buildingTap']='Real canvas tap opens bank destination without relying on the DOM pin'
                await p.get_by_role('button',name='Close',exact=True).click()
                await p.evaluate('()=>{for(const pin of __map.pins.values())pin.el.style.visibility="";}')
                await p.get_by_role('button',name='Home',exact=True).click()
                metrics['dispose']=await p.evaluate('()=>{const tracked=new Set(),instances=new Set();__map.group.traverse(o=>{if(o.geometry)tracked.add(o.geometry);if(o.isInstancedMesh)instances.add(o);});let geometries=0,buffers=0;for(const g of tracked)g.addEventListener("dispose",()=>geometries++);for(const o of instances)o.addEventListener("dispose",()=>buffers++);__map.dispose();return {expectedGeometries:tracked.size,releasedGeometries:geometries,expectedInstances:instances.size,releasedInstances:buffers,children:__map.group.children.length,roomVisible:__world.room.group.visible};}')
                assert metrics['dispose']['expectedGeometries']==metrics['dispose']['releasedGeometries']
                assert metrics['dispose']['expectedInstances']==metrics['dispose']['releasedInstances']
                assert metrics['dispose']['children']==0 and metrics['dispose']['roomVisible']
            metrics.update(errors=errors,scope='Local desktop SwiftShader, .5 WebGL pixel ratio, paced animation updates and sampled rendering with shadows disabled for capture; real game/network timers. DOM screenshots use device scale 1. No phone FPS or production capacity claim.')
            assert not errors,errors
            (out/'browser.json').write_text(json.dumps(metrics,indent=2)+'\n');print(json.dumps(metrics),flush=True)
        finally:await context.close();await browser.close()

asyncio.run(main())
