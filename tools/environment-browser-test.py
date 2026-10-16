"""Local production-cookie environment captures; never writes gameplay state.

Scene coverage uses the actual World/Room renderer in an authenticated game.
Synthetic room messages exercise art combinations; this is not a server travel test.
Frame timings are Chromium software-WebGL diagnostics, not physical phone FPS.
"""
import argparse
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:8082')
parser.add_argument('--label', default='after')
parser.add_argument('--only', default='')
parser.add_argument('--fixtures', default='.local/hud/fixtures.json')
args = parser.parse_args()
assert args.base.startswith(('http://127.0.0.1:', 'http://localhost:'))
OUT = Path('.local/phase4') / args.label
OUT.mkdir(parents=True, exist_ok=True)
CAT = json.loads(Path('client/test/fixtures/city-catalog.json').read_text())
OWN = {k: True for k in ['gas', 'fridge', 'tv', 'laptop', 'speaker', 'guitar', 'dumbbells', 'bed', 'ac', 'gen', 'solar', 'dslr']}

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        fixture = json.loads(Path(args.fixtures).read_text())[0]
        await context.add_cookies([{'name': 'awd_session', 'value': fixture['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(args.base, wait_until='domcontentloaded')
        await page.wait_for_function('()=>!!window.__stage', timeout=120000)
        await page.evaluate('()=>{__stage.renderer.setPixelRatio(.7);window.__draw=__stage.render.bind(__stage);__stage.render=()=>{};}')
        await page.wait_for_function('()=>!!window.__world?.me', timeout=120000)
        if await page.get_by_role('button', name='Skip tour', exact=True).count():
            await page.get_by_role('button', name='Skip tour', exact=True).click()
        await page.evaluate('async()=>{await __map.terrainReady;__map.dispose();window.__look=__world.me.av.baseLook;window.__original=__world.msg;}')
        scenes = [('home-'+id, {'place': 'home', 'home': {'id': id, 'mine': True, 'items': OWN}, 'people': []}) for id in CAT['homes']]
        scenes += [(l['id'].replace(':', '-'), {'place': l['id'], 'people': []}) for l in CAT['locs']]
        if args.only:
            scenes = [s for s in scenes if s[0] in args.only.split(',')]
        metrics = {}
        for name, msg in scenes:
            value = await page.evaluate('''msg=>{
              const t=performance.now();__world.enter(msg,__look,'Environment QA');
              if(msg.place.startsWith('e:'))__world.loadEstate({area:msg.place.slice(2),owners:[{id:999001,name:'Resident A'},{id:999002,name:'Resident B'},{id:999003,name:'Resident C'}]});
              const initMs=performance.now()-t;__world.me.path=[];__stage.setTime(13);__world.update(.016);__draw();
              const r=__stage.renderer,times=[];for(let i=0;i<5;i++){const t=performance.now();__draw();r.getContext().finish();times.push(performance.now()-t);}
              let meshes=0,bytes=0;const geos=new Set(),mats=new Set(),tex=new Set();__world.room.group.traverse(o=>{if(o.isMesh)meshes++;if(o.geometry)geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){mats.add(m);for(const v of Object.values(m))if(v?.isTexture)tex.add(v);}});
              for(const g of geos){for(const a of Object.values(g.attributes))bytes+=a.array.byteLength;bytes+=g.index?.array.byteLength||0;}
              return {initMs,render:{...r.info.render},memory:{...r.info.memory},meshes,geometryBytes:bytes,materials:mats.size,textures:tex.size,softwareFrameMs:times,spec:__world.spec};
            }''', msg)
            metrics[name] = value
            await page.screenshot(path=str(OUT / (name+'.png')), timeout=60000)
            print(name, value['render']['calls'], 'calls', value['render']['triangles'], 'triangles', flush=True)
            if name in ['home-nima', 'home-trasacco', 'vibes', 'labadi', 'n-osu']:
                await page.evaluate('()=>{__stage.setTime(22);__world.update(.016);__draw();}')
                await page.screenshot(path=str(OUT / (name+'-night.png')), timeout=60000)
        (OUT / 'metrics.json').write_text(json.dumps({'scenes': metrics, 'errors': errors}, indent=2), encoding='utf8')
        assert not errors, errors
        await browser.close()

asyncio.run(main())
