"""Inspect character creation and saved looks in the local production client.

Creates one disposable local account; never targets a public game URL.
"""
import asyncio
import time
from pathlib import Path
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:8080'
OUT = Path('.local/mission-audit')

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport={'width':430,'height':860}, is_mobile=True, has_touch=True)
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.add_init_script('const raf=window.__nativeRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(()=>setTimeout(()=>cb(performance.now()),250));')
        user = 'artqa' + str(int(time.time()))[-8:]
        response = await context.request.post(BASE + '/api/signup', headers={'origin':BASE},
            data={'username':user,'password':'character-review-passphrase','dob':'1995-01-01','agree':True})
        result = await response.json()
        assert response.ok and result.get('ok'), result
        await page.goto(BASE, wait_until='domcontentloaded')
        await page.get_by_role('button',name='Woman',exact=True).wait_for(timeout=120000)
        await page.evaluate('()=>{__stage.renderer.setPixelRatio(.65);window.__qaDraw=__stage.render.bind(__stage);__stage.render=()=>{};window.requestAnimationFrame=__nativeRAF;}')
        await page.evaluate('()=>__qaDraw()')
        await page.screenshot(path=str(OUT / 'creator-male.png'))
        await page.get_by_role('button',name='Woman',exact=True).click()
        await page.get_by_label('Bust',exact=True).fill('0.8')
        await page.get_by_label('Bust',exact=True).dispatch_event('input')
        await page.evaluate('()=>__qaDraw()')
        await page.screenshot(path=str(OUT / 'creator-female.png'))
        assert await page.evaluate('()=>__studio.av.look.body==="f"&&__studio.av.look.bust===.8')
        await page.get_by_role('button',name='Next',exact=True).click()
        await page.locator('.ob-panel .opt').nth(0).click()
        await page.locator('.ob-panel .opt').nth(1).click()
        await page.get_by_role('button',name='Next (2/2)',exact=True).click()
        await page.get_by_role('button',name='Roll the birth lottery',exact=True).click()
        await page.get_by_role('button',name='Choose your first home',exact=True).click()
        await page.get_by_role('button',name='Move into Accra',exact=True).click(no_wait_after=True)
        await page.get_by_role('button',name='Enter Accra',exact=True).click(no_wait_after=True)
        await page.wait_for_function('()=>!!window.__world?.me',timeout=120000)
        skip = page.get_by_role('button',name='Skip tour',exact=True)
        if await skip.count(): await skip.click(no_wait_after=True)
        assert await page.evaluate('()=>__G.state.look.body==="f"&&__G.state.look.bust===.8')
        await page.locator('.zone',has_text='Walk outside').click()
        await page.wait_for_function('()=>__G.state.place.startsWith("n:")',timeout=30000)
        print('PASS creation and street entry',flush=True)
        await page.evaluate('()=>__qaDraw()')
        await page.screenshot(path=str(OUT / 'street-game.png'))
        await page.locator('.zone',has_text='Go indoors').click()
        await page.wait_for_function('()=>__G.state.place==="home"',timeout=30000)
        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_function('()=>!!window.__stage',timeout=120000)
        await page.evaluate('()=>{__stage.renderer.setPixelRatio(.65);__stage.render=()=>{};window.requestAnimationFrame=__nativeRAF;}')
        await page.wait_for_function('()=>!!window.__world?.me',timeout=120000)
        assert await page.evaluate('()=>__G.state.look.body==="f"&&__G.state.look.bust===.8')
        assert not errors, errors
        print('PASS production-cookie creator, body switch, saved morph, home/street transitions and reload',flush=True)
        await browser.close()

asyncio.run(main())
