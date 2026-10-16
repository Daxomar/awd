"""Local cookie-authenticated route, viewport and resource QA for Phase 4.

Uses disposable .local/hud fixtures. Synthetic scene coverage follows the real
estate route checks; memory counts are WebGL diagnostics, not device FPS.
"""
import argparse
import asyncio
import json
import re
from pathlib import Path
from playwright.async_api import async_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:8082')
parser.add_argument('--fixtures', default='.local/hud/fixtures.json')
args = parser.parse_args()
assert args.base.startswith(('http://127.0.0.1:', 'http://localhost:'))
out = Path('.local/phase4/lifecycle')
out.mkdir(parents=True, exist_ok=True)

async def route(page, label, destination):
    await page.get_by_role('button', name='Interact', exact=True).click()
    await page.locator('.zone').filter(has_text=re.compile('^'+re.escape(label)+'$')).click()
    await page.get_by_role('dialog', name=label, exact=True).get_by_role('button', name=label, exact=True).click()
    await page.wait_for_function('(p)=>__G.state.place===p', arg=destination, timeout=30000)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport={'width':390, 'height':844}, is_mobile=True, has_touch=True)
        fixture = json.loads(Path(args.fixtures).read_text())[0]
        await context.add_cookies([{'name':'awd_session', 'value':fixture['cookie'], 'url':args.base, 'httpOnly':True, 'sameSite':'Strict'}])
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(args.base, wait_until='domcontentloaded')
        await page.wait_for_function('()=>!!window.__stage', timeout=120000)
        await page.evaluate('()=>{__stage.renderer.setPixelRatio(.7);window.__draw=__stage.render.bind(__stage);__stage.render=()=>{};}')
        await page.wait_for_function('()=>!!window.__world?.me', timeout=120000)
        if await page.get_by_role('button', name='Skip tour', exact=True).count():
            await page.get_by_role('button', name='Skip tour', exact=True).click()
        place = await page.evaluate('()=>__G.state.place')
        if place == 'home':
            await route(page, 'Walk outside', 'n:nima')
        assert await page.evaluate('()=>__G.state.place') == 'n:nima'
        await route(page, 'Player-owned estate', 'e:nima')
        await route(page, 'Back to neighbourhood', 'n:nima')
        await route(page, 'Go indoors', 'home')
        print('PASS authoritative home, street and estate routes', flush=True)
        await page.evaluate('async()=>{await __map.terrainReady;__map.dispose();window.__look=__world.me.av.baseLook;}')
        results = {'routes':True, 'layouts':[], 'cycles':[], 'owners':[]}
        for scene in ['home', 'n:nima']:
            await page.evaluate("s=>{__world.enter(s==='home'?{place:s,home:{id:'legon',mine:true,items:{tv:true,laptop:true}}}:{place:s},__look,'QA');__world.me.path=[];__stage.setTime(13);}", scene)
            original_zoom = await page.evaluate('()=>__stage.view.zoom')
            for width, height in [(375,812),(390,844),(430,932),(390,530),(844,390)]:
                await page.set_viewport_size({'width':width,'height':height})
                await page.wait_for_timeout(180)
                result = await page.evaluate('()=>{__world.update(.016);__draw();const p=__world.me;return {zoom:__stage.view.zoom,player:__world.screenOf(p.x,1,p.z),target:__stage.view.target.toArray()};}')
                assert all(0 <= v <= bound for v,bound in zip(result['player'],[width,height])), (scene,width,height,result)
                assert await page.locator('.joy').is_visible()
                assert await page.locator('.online-count').is_visible()
                results['layouts'].append({'scene':scene,'width':width,'height':height,**result})
                await page.screenshot(path=str(out/f'{scene.replace(":","-")}-{width}x{height}.png'))
            await page.set_viewport_size({'width':390,'height':844})
            await page.wait_for_timeout(180)
            zoom = await page.evaluate('()=>__stage.view.zoom')
            assert abs(zoom-original_zoom)<.001, (original_zoom,zoom)
            await page.evaluate('()=>{const z=__stage.view.zoom;__stage.zoomBy(.9);if(!(__stage.view.zoom<z))throw Error("Zoom failed");}')
        print('PASS five viewports, visible player and reversible camera resizing', flush=True)
        await page.evaluate("()=>{__world.enter({place:'home',home:{id:'nima',mine:true,items:{tv:true}}},__look,'QA');__world.me.path=[];}")
        await page.emulate_media(reduced_motion='reduce')
        motion = await page.evaluate('()=>{const r=__world.room,spin=r.items.flatMap(i=>i.obj.userData.spin||[])[0],before=spin.obj.rotation[spin.axis],p=__world.me,x=p.x;p.path=[[x+.5,p.z]];r.update(.1);return {frozen:before===spin.obj.rotation[spin.axis],walk:p.x>x,media:r.motion.matches};}')
        assert all(motion.values()), motion
        results['reducedMotion'] = motion
        for hour in [7,13,18,22]:
            await page.evaluate('h=>{__stage.setTime(h);__world.update(.016);__draw();}',hour)
            await page.screenshot(path=str(out/f'light-{hour}.png'))
        await page.emulate_media(reduced_motion='no-preference')
        # Warm repeated combinations, then compare the same end scene each cycle.
        for cycle in range(10):
            metrics = await page.evaluate('cycle=>{const times=[];for(const msg of [{place:"home",home:{id:"trasacco",items:{tv:true,gas:true,fridge:true}}},{place:"makola"},{place:"n:osu"},{place:"e:legon"}]){const t=performance.now();__world.enter(msg,__look,"QA");if(msg.place==="e:legon")__world.loadEstate({area:"legon",owners:[{id:900001,name:"Resident"}]});__world.me.path=[];__world.update(.016);__draw();times.push(performance.now()-t);}return {cycle,times,memory:{...__stage.renderer.info.memory}};}',cycle)
            results['cycles'].append(metrics)
        stable = results['cycles'][-4:]
        for key in ['geometries','textures']:
            counts = [m['memory'][key] for m in stable]
            assert max(counts)-min(counts)<=2, (key,counts)
        for cycle in range(24):
            result = await page.evaluate('i=>{__world.loadEstate({area:"legon",owners:Array.from({length:12},(_,n)=>({id:900000+n,name:"Owner "+i+"-"+n}))});__draw();return {...__stage.renderer.info.memory};}',cycle)
            results['owners'].append(result)
        for key in ['geometries','textures']:
            counts = [m[key] for m in results['owners'][-8:]]
            assert max(counts)-min(counts)<=2, (key,counts)
        results['errors'] = errors
        assert not errors, errors
        (out/'results.json').write_text(json.dumps(results,indent=2))
        print('PASS 40 scene transitions, 24 full estate-owner refreshes, reduced motion and lighting', flush=True)
        await browser.close()

asyncio.run(main())
