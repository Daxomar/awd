"""Focused Phase 4 multiplayer and authoritative travel check on local fixtures."""
import asyncio
import json
import re
import secrets
from pathlib import Path
from playwright.async_api import async_playwright

BASE='http://127.0.0.1:8082'
OUT=Path('.local/phase4/gameplay')
OUT.mkdir(parents=True,exist_ok=True)

async def open_game(browser,fixture):
    context=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    await context.add_cookies([{'name':'awd_session','value':fixture['cookie'],'url':BASE,'httpOnly':True,'sameSite':'Strict'}])
    page=await context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    await page.goto(BASE,wait_until='domcontentloaded')
    await page.wait_for_function('()=>!!window.__stage',timeout=120000)
    await page.evaluate('()=>{__stage.renderer.setPixelRatio(.6);window.__draw=__stage.render.bind(__stage);__stage.render=()=>{};}')
    await page.wait_for_function('()=>!!window.__world?.me',timeout=120000)
    if await page.get_by_role('button',name='Skip tour',exact=True).count():
        await page.get_by_role('button',name='Skip tour',exact=True).click()
    if await page.evaluate('()=>__G.state.place')=='home':
        await page.get_by_role('button',name='Interact',exact=True).click()
        await page.locator('.zone').filter(has_text=re.compile('^Walk outside$')).click()
        await page.get_by_role('dialog',name='Walk outside',exact=True).get_by_role('button',name='Walk outside',exact=True).click()
        await page.wait_for_function('()=>__G.state.place==="n:nima"')
    return context,page,errors

async def main():
    fixtures=json.loads(Path('.local/hud/fixtures.json').read_text())
    async with async_playwright() as p:
        browser=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        ca,a,ea=await open_game(browser,fixtures[0])
        cb,b,eb=await open_game(browser,fixtures[1])
        await a.wait_for_function('()=>__world.others.size>0&&__G.online>=2')
        await b.wait_for_function('()=>__world.others.size>0&&__G.online>=2')
        assert 'players online' in await a.locator('.online-count').inner_text()
        # Remote positions continue to follow real room movement packets.
        previous=await b.evaluate('()=>{const p=__world.room.people.get("p"+[...__world.others.keys()][0]);return [p.x,p.z];}')
        joy=await a.locator('.joy').bounding_box()
        await a.mouse.move(joy['x']+joy['width']/2,joy['y']+joy['height']/2)
        await a.mouse.down()
        await a.mouse.move(joy['x']+joy['width']*.9,joy['y']+joy['height']/2)
        await a.wait_for_timeout(650)
        await a.mouse.up()
        await b.wait_for_function('old=>{const p=__world.room.people.get("p"+[...__world.others.keys()][0]);return Math.hypot(p.x-old[0],p.z-old[1])>.05;}',arg=previous)
        await a.get_by_role('button',name='Chat',exact=True).click()
        await a.get_by_role('textbox',name='Message',exact=True).fill('Phase 4: meet at the viewing centre.')
        await a.get_by_role('button',name='Send message',exact=True).click()
        await b.get_by_role('button',name='Chat',exact=True).click()
        await b.locator('.chat-message').filter(has_text='Phase 4: meet at the viewing centre.').wait_for()
        await a.get_by_role('button',name='Close chat',exact=True).click()
        await b.get_by_role('button',name='Close chat',exact=True).click()
        await b.evaluate('(name)=>__act.message(name)',fixtures[0]['username'])
        await b.locator('.thread-portrait').wait_for()
        accept=b.get_by_role('button',name='Accept',exact=True)
        if await accept.count():
            await accept.click()
            await accept.wait_for(state='hidden')
        await a.evaluate('(name)=>__act.message(name)',fixtures[1]['username'])
        await a.locator('.thread-portrait').wait_for()
        await a.evaluate('()=>{window.__qaDmAck=null;__net.on("dm_ack",m=>window.__qaDmAck=m);}')
        await b.evaluate('()=>{window.__qaDmReceived=null;__net.on("dm_in",m=>window.__qaDmReceived=m.m.text);}')
        # Keep the unique marker short so contact-number moderation is not
        # mistaken for a failed message delivery by this test.
        message='Phase four private message '+secrets.token_hex(3)
        await a.get_by_placeholder('Private message',exact=True).fill(message)
        await a.locator('.composer .send').click()
        await a.wait_for_function('()=>!!window.__qaDmAck')
        ack=await a.evaluate('()=>window.__qaDmAck')
        assert ack.get('ok'),ack
        print('PASS private message acknowledged by server',flush=True)
        await b.wait_for_function('text=>window.__qaDmReceived===text',arg=message)
        await b.evaluate('(name)=>__act.message(name)',fixtures[0]['username'])
        await b.locator('.bub.in').filter(has_text=message).first.wait_for()
        await a.get_by_role('button',name='Put phone away',exact=True).click()
        await cb.close()
        print('PASS two-player presence, joystick synchronization, city chat and private messages',flush=True)
        funds=await a.evaluate('()=>__G.state.cash+__G.state.momo')
        await a.get_by_role('button',name='Map',exact=True).click()
        await a.evaluate("()=>__act.place('circle')")
        await a.locator('.ride').filter(has_text='Trotro').click()
        await a.locator('.sheet-back.in .sheet-body > .btn.primary.wide').click()
        await a.wait_for_function('()=>!!__G.state.busy?.travel')
        await a.wait_for_function('(n)=>__G.state.cash+__G.state.momo<n',arg=funds)
        await a.reload(wait_until='domcontentloaded')
        await a.wait_for_function('()=>window.__world?.me&&(__ride?.active||__G.state.place==="circle")',timeout=120000)
        await a.evaluate('()=>{__stage.renderer.setPixelRatio(.6);window.__draw=__stage.render.bind(__stage);__stage.render=()=>{};}')
        await a.wait_for_function('()=>__G.state.place==="circle"',timeout=90000)
        await a.evaluate('()=>__draw()')
        await a.screenshot(path=str(OUT/'circle-arrival.png'))
        assert 'Circle' in await a.locator('.location-control').inner_text()
        assert not await a.evaluate('()=>__ride.active||!!__stage.override')
        assert not ea and not eb,(ea,eb)
        (OUT/'results.json').write_text(json.dumps({'presence':True,'movement':True,'cityChat':True,'privateMessage':True,'paidTravel':True,'reloadDuringTravel':True,'arrival':'circle','errors':ea+eb},indent=2))
        await ca.close()
        await browser.close()
        print('PASS paid trotro travel, reload during journey, Circle arrival and ride cleanup',flush=True)

asyncio.run(main())
