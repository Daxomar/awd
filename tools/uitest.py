"""Headless UI flow: signup → onboarding → world → walk to a place → act → phone. Screenshots to scratchpad."""
import asyncio, random, sys
from playwright.async_api import async_playwright
OUT = '/tmp/claude-0/-home-claude/950af714-f562-57f7-acec-abfa0721ec6b/scratchpad/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 412, 'height': 860}, device_scale_factor=2, is_mobile=True, has_touch=True)
        errs = []; pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto('http://localhost:8080/?q=low')
        await pg.wait_for_selector('text=Start my Accra life', timeout=120000)
        await pg.screenshot(path=OUT + 'ui1_auth.png')
        u = 'kofi' + str(random.randint(1000, 99999))
        await pg.fill('input[autocomplete=username]', u); await pg.fill('input[type=password]', 'chale-test-12345'); await pg.fill('input[type=date]', '1996-05-04')
        await pg.check('input[type=checkbox]'); await pg.click('text=Start my Accra life')
        await pg.wait_for_selector('text=Who are you?', timeout=30000)
        await pg.fill('input[placeholder="What do they call you?"]', 'Kofi'); await pg.screenshot(path=OUT + 'ui2_who.png'); await pg.click('text=Next')
        await pg.click('text=Hustler'); await pg.click('text=Chop Master'); await pg.screenshot(path=OUT + 'ui3_traits.png'); await pg.click('text=Next')
        await pg.click('text=Big Man of Accra'); await pg.click('text=Next')
        await pg.screenshot(path=OUT + 'ui4_lottery.png'); await pg.click('text=Roll my life')
        await pg.wait_for_selector('text=Enter Accra', timeout=15000); await pg.wait_for_timeout(1200); await pg.screenshot(path=OUT + 'ui5_reveal.png'); await pg.click('text=Enter Accra')
        await pg.wait_for_timeout(9000); await pg.screenshot(path=OUT + 'ui6_world.png')
        # teleport (DEV) next to Circle and open the place card
        await pg.evaluate("""() => { const G = window.__G; const L = G.ui.locs.find(l => l.id === 'circle'); G.player.x = L.x + 4; G.player.z = L.z + 4; G.net.send({t:'tp', x: G.player.x, z: G.player.z}); G.camSnap = true; }""")
        await pg.wait_for_timeout(9000); await pg.screenshot(path=OUT + 'ui7_place.png')
        await pg.click('text=Pure water & Fan Ice'); await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + 'ui8_busy.png')
        await pg.wait_for_timeout(6000); await pg.screenshot(path=OUT + 'ui9_done.png')
        await pg.click('#tr .ib >> nth=1'); await pg.wait_for_timeout(800); await pg.screenshot(path=OUT + 'ui10_phone.png')
        await pg.click('.tabs >> text=Jobs'); await pg.wait_for_timeout(400); await pg.screenshot(path=OUT + 'ui11_jobs.png')
        print('fps', await pg.evaluate('window.__G.fps'), 'state', await pg.evaluate('JSON.stringify({cash: __G.ui.st.cash, momo: __G.ui.st.momo, n: __G.ui.st.n, origin: __G.ui.st.origin})'))
        print('\n'.join(errs[:15])); await b.close()
asyncio.run(main())
