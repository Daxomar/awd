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
        context=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=.5)
        await context.add_cookies([{'name':'awd_session','value':fixture['cookie'],'url':args.base,'httpOnly':True,'sameSite':'Strict'}])
        await context.add_init_script("(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>setTimeout(()=>raf(f),75)})();")
        p=await context.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));start=time.monotonic()
        try:
            await p.goto(args.base,wait_until='domcontentloaded',timeout=120000)
            await p.wait_for_function('()=>!!window.__world?.me',timeout=180000)
            await p.evaluate('()=>{__stage.renderer.setPixelRatio(.5);__stage.renderer.shadowMap.enabled=false;}')
            if await p.get_by_role('button',name='Skip tour',exact=True).count():await p.get_by_role('button',name='Skip tour',exact=True).click()
            await p.screenshot(path=str(out/'home.jpg'),type='jpeg',quality=85,timeout=120000)
            await p.get_by_role('button',name='Map',exact=True).click()
            await p.wait_for_function('()=>__map.ready',timeout=240000)
            await p.wait_for_timeout(1500)
            metrics={'coldToMapSeconds':round(time.monotonic()-start,3),'map':await p.evaluate('()=>__map.stats()'),'renderer':await p.evaluate('()=>({calls:__stage.renderer.info.render.calls,triangles:__stage.renderer.info.render.triangles,memory:__stage.renderer.info.memory})')}
            await p.screenshot(path=str(out/'city-normal.jpg'),type='jpeg',quality=86,timeout=120000)
            await p.evaluate('()=>__map.overview()');await p.wait_for_timeout(1800)
            await p.screenshot(path=str(out/'city-overview.jpg'),type='jpeg',quality=86,timeout=120000)
            if args.label!='baseline':
                assert await p.evaluate('()=>__map.mode')=='compact'
                for name in ['Nima','Osu','Airport Residential','East Legon','Trasacco','Jamestown']:
                    await p.get_by_role('button',name='Districts',exact=True).click()
                    await p.get_by_role('searchbox').fill(name)
                    await p.locator('.city-place-row').filter(has_text=name).first.click();await p.wait_for_timeout(1200)
                    await p.screenshot(path=str(out/(name.lower().replace(' ','-')+'.jpg')),type='jpeg',quality=85,timeout=120000)
                await p.get_by_role('button',name='Geographic map',exact=True).click()
                await p.wait_for_function('()=>__map.mode==="geographic"&&__map.geoReady',timeout=240000)
                await p.evaluate('()=>__map.overview()');await p.wait_for_timeout(1500)
                await p.screenshot(path=str(out/'geographic-map.jpg'),type='jpeg',quality=85,timeout=120000)
                await p.get_by_role('button',name='Compact city',exact=True).click();await p.wait_for_timeout(1500)
                assert await p.evaluate('()=>__map.mode')=='compact'
                metrics['afterModeCycle']=await p.evaluate('()=>__map.stats()')
                metrics['modeCycle']='compact → geographic → compact, same authenticated session'
            metrics.update(errors=errors,scope='Local desktop SwiftShader, .5 pixel ratio and paced rendering; real timers. No phone FPS or production capacity claim.')
            assert not errors,errors
            (out/'browser.json').write_text(json.dumps(metrics,indent=2)+'\n');print(json.dumps(metrics),flush=True)
        finally:await context.close();await browser.close()

asyncio.run(main())
