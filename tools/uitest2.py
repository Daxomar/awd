import asyncio, random
from playwright.async_api import async_playwright
OUT = '/tmp/claude-0/-home-claude/950af714-f562-57f7-acec-abfa0721ec6b/scratchpad/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 412, 'height': 860}, device_scale_factor=2, is_mobile=True, has_touch=True)
        errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto('http://localhost:8080/?q=low', wait_until='domcontentloaded')
        await pg.wait_for_selector('text=Start my Accra life', timeout=120000)
        u = 'ama' + str(random.randint(1000, 99999))
        await pg.fill('input[autocomplete=username]', u); await pg.fill('input[type=password]', 'chale-test-12345'); await pg.fill('input[type=date]', '1997-02-11')
        await pg.check('input[type=checkbox]'); await pg.click('text=Start my Accra life')
        await pg.wait_for_selector('text=Who are you?', timeout=30000)
        await pg.fill('input[placeholder="What do they call you?"]', 'Ama'); await pg.click('text=Woman'); await pg.click('text=Next')
        await pg.click('text=Sweet Mouth'); await pg.click('text=Detty Spirit'); await pg.click('text=Next')
        await pg.click("text=Everybody's Chale"); await pg.click('text=Next'); await pg.click('text=Roll my life')
        await pg.wait_for_selector('text=Enter Accra', timeout=15000); await pg.click('text=Enter Accra')
        await pg.wait_for_selector('.notif', timeout=150000); await pg.wait_for_timeout(600); await pg.screenshot(path=OUT + 's1_notif.png')
        await pg.click('#tr .ib >> nth=1'); await pg.wait_for_timeout(800); await pg.screenshot(path=OUT + 's2_chats.png')
        await pg.click('.chatrow'); await pg.wait_for_timeout(500); await pg.screenshot(path=OUT + 's3_thread.png')
        await pg.click('.choices .btn >> nth=1'); await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + 's4_replied.png')
        await pg.click('.tabs >> text=Gist'); await pg.wait_for_timeout(500)
        await pg.fill('textarea.f', 'First day in Accra. Trotro mate just called me "my sister" and charged me ₵2 extra 😂'); await pg.click('text=Post'); await pg.wait_for_timeout(2500)
        await pg.fill('textarea.f', 'any lady thats horny tap in'); await pg.wait_for_timeout(61000); await pg.click('text=Post'); await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + 's5_gist.png')
        await pg.click('.tabs >> text=Goals'); await pg.wait_for_timeout(700); await pg.screenshot(path=OUT + 's6_goals.png')
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
