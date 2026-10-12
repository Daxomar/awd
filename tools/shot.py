"""Headless screenshots: python3 shot.py <name> <at> <hour> [q] [cam-json] [wait-s]"""
import asyncio, json, sys
from playwright.async_api import async_playwright
OUT = '/tmp/claude-0/-home-claude/950af714-f562-57f7-acec-abfa0721ec6b/scratchpad/'
async def main():
    name, at, hour = sys.argv[1], sys.argv[2], float(sys.argv[3]); q = sys.argv[4] if len(sys.argv) > 4 else 'high'
    cam = sys.argv[5] if len(sys.argv) > 5 else '{"dist":6,"pitch":0.15}'; wait = int(sys.argv[6]) if len(sys.argv) > 6 else 20
    tok = json.load(open('/tmp/tok.json'))['token']
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []; pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto(f'http://localhost:8080/?at={at}&q={q}&token={tok}', wait_until='domcontentloaded')
        await pg.wait_for_function('window.__G && window.__G.me', timeout=90000)
        await pg.evaluate(f'window.__G.photo({{cam: {cam}, hour: {hour}}})')
        await pg.wait_for_timeout(wait * 1000); await pg.add_style_tag(content='.ui>*:not(#toasts){display:none!important}')
        await pg.screenshot(path=OUT + name + '.png', timeout=120000)
        print('crowd', await pg.evaluate('JSON.stringify(window.__G.crowd ? window.__G.crowd.list.map(n=>[Math.round(n.x),Math.round(n.z),n.a.root.visible]) : null)'))
        print('render', await pg.evaluate('JSON.stringify(window.__G.stage.renderer.info.render)'))
        print('fps', await pg.evaluate('window.__G.fps'), 'tiles', await pg.evaluate('window.__G.world.tiles.size'), 'pos', await pg.evaluate('[Math.round(window.__G.player.x), Math.round(window.__G.player.z)]'))
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
