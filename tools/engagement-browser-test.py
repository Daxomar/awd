"""Disposable authenticated milestone journeys. Loopback + local mocked provider only.

Rendering is sampled on desktop SwiftShader to keep this host usable. These are
functional/UI checks, not phone FPS measurements. Never supply production accounts.
"""
import argparse
import asyncio
import json
import re
import sys
import time
import html
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding='utf-8')
parser = argparse.ArgumentParser()
parser.add_argument('--case', choices=['social', 'work', 'explore', 'ads', 'layouts', 'performance'], required=True)
parser.add_argument('--base', default='http://127.0.0.1:8082')
parser.add_argument('--fixtures', default='.local/engagement/fixtures.json')
args = parser.parse_args()
target = urlsplit(args.base)
if target.scheme != 'http' or target.hostname not in ('127.0.0.1', 'localhost') or target.path not in ('', '/'):
    raise ValueError('Use the isolated loopback QA server only.')
OUT = Path('docs/images/engagement')
OUT.mkdir(parents=True, exist_ok=True)
RESULTS = Path('.local/engagement')


async def ready(page):
    await page.wait_for_function('()=>!!window.__stage', timeout=120000)
    await page.evaluate('()=>{__stage.renderer.setPixelRatio(.5);window.__draw ||= __stage.render.bind(__stage);__stage.render=()=>{};}')
    await page.wait_for_function('()=>!!window.__world?.me', timeout=120000)
    skip = page.get_by_role('button', name='Skip tour', exact=True)
    if await skip.count():
        await skip.click()
    await page.evaluate("()=>{window.__events=[];for(const t of ['intro','intro_result','intro_complete','intro_update','worktask','objectives','dm_sent','toast','arrived','done'])__net.on(t,m=>{__events.push({type:t,...m});if(__events.length>200)__events.shift();});}")
    await page.wait_for_timeout(2500)


async def open_game(browser, fixture, login=False):
    context = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    errors = []
    if not login:
        await context.add_cookies([{'name': 'awd_session', 'value': fixture['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
    page = await context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    await context.request.get(args.base+'/health',timeout=20000)
    await page.goto(args.base, wait_until='domcontentloaded')
    await page.wait_for_function('()=>!!window.__stage',timeout=120000)
    await page.evaluate('()=>{__stage.renderer.setPixelRatio(.5);window.__draw=__stage.render.bind(__stage);__stage.render=()=>{};}')
    if login:
        await page.get_by_role('button', name='I have an account', exact=True).click(timeout=120000)
        await page.locator('input[autocomplete=username]').fill(fixture['username'])
        await page.locator('input[type=password]').fill(fixture['password'])
        await page.get_by_role('button', name='Log in', exact=True).click()
    try:
        await ready(page)
    except Exception:
        print('Startup diagnostics:',errors,(await page.locator('body').inner_text())[:1600],flush=True)
        await page.screenshot(path=str(RESULTS/'startup-failure.png'),mask=[page.locator('input[type=password]')])
        raise
    print('Authenticated game ready:', fixture['role'], flush=True)
    return context, page, errors


async def app(page, name):
    if not await page.locator('.phone-back:not([hidden])').count():
        await page.get_by_role('button', name='Phone', exact=True).click()
    else:
        await page.get_by_role('button', name='Phone home', exact=True).click()
    await page.locator('.springboard').get_by_role('button', name=name, exact=True).click()


async def put_away(page):
    if await page.locator('.phone-back:not([hidden])').count():
        await page.get_by_role('button', name='Put phone away', exact=True).click()
        await page.wait_for_timeout(500)


async def shot(page, name):
    ratio=await page.evaluate('()=>__stage.renderer.getPixelRatio()')
    await page.evaluate('()=>{__stage.renderer.setPixelRatio(1);__draw();}')
    await page.screenshot(path=str(OUT / (name + '.jpg')), type='jpeg', quality=86)
    await page.evaluate('r=>__stage.renderer.setPixelRatio(r)',ratio)


async def social(browser, fixtures):
    ca, a, ea = await open_game(browser, fixtures[0], login=True)
    cb, b, eb = await open_game(browser, fixtures[1])
    try:
        await a.bring_to_front()
        await app(a, 'Meet')
        await a.get_by_label('Your introduction').fill('Hello, I am new to Accra. Where do you like to spend time?')
        await a.wait_for_timeout(1500)
        money = await a.evaluate('()=>__G.state.cash+__G.state.momo')
        await a.get_by_role('button', name='Find someone online', exact=True).click()
        await a.wait_for_function("()=>__events.some(m=>m.type==='intro_result'&&m.id)", timeout=30000)
        await b.bring_to_front()
        await app(b, 'Meet')
        await b.get_by_role('button', name='Accept', exact=True).wait_for(timeout=30000)
        await shot(b, 'social-consent')
        await b.wait_for_timeout(1500)
        await b.get_by_role('button', name='Accept', exact=True).click()
        await b.get_by_role('button', name='Open private conversation', exact=True).click(timeout=30000)
        await b.get_by_placeholder('Private message').wait_for()
        assert 'Where do you like to spend time?' in await b.locator('.appwin:not(.closing)').inner_text()
        await b.get_by_placeholder('Private message').fill('Welcome to Accra! I like the community spaces in Jamestown.')
        await b.get_by_placeholder('Private message').press('Enter')
        await b.wait_for_function("()=>__events.some(m=>m.type==='intro_complete')", timeout=30000)
        await shot(b, 'social-private-reply')
        await a.bring_to_front()
        await a.wait_for_function("()=>__events.some(m=>m.type==='intro_complete')", timeout=30000)
        await app(a, 'Milestones')
        await a.wait_for_function("()=>__G.objectives?.some(d=>d.id==='first_friend'&&d.completed)", timeout=30000)
        await a.wait_for_timeout(1800)
        xp = await a.evaluate('()=>__G.state.xp')
        card = a.get_by_text('Your first friend in Accra', exact=True).locator('..')
        await card.get_by_role('button', name='Claim milestone', exact=True).click()
        await a.wait_for_function("()=>__G.objectives.some(d=>d.id==='first_friend'&&d.claimed)", timeout=30000)
        assert await a.evaluate('()=>__G.state.xp') == xp + 25
        assert await a.evaluate('()=>__G.state.cash+__G.state.momo') == money
        await shot(a, 'social-milestone-claimed')
        await a.reload(wait_until='domcontentloaded')
        await ready(a)
        await a.wait_for_function("()=>__G.objectives?.some(d=>d.id==='first_friend'&&d.claimed)", timeout=30000)
        assert not ea + eb, ea + eb
        return {'passed': ['UI login and cookie-authenticated sockets', 'online consent', 'intro delivered through private inbox', 'genuine reply completes', 'cash disabled', 'XP claim once and reload persistence'], 'errors': ea + eb}
    finally:
        await ca.close()
        await cb.close()


async def work(browser, fixtures):
    context, p, errors = await open_game(browser, fixtures[2])
    try:
        money = await p.evaluate('()=>__G.state.cash+__G.state.momo')
        await app(p, 'Jobs')
        await shot(p, 'work-career')
        await p.get_by_role('button', name='Start shift', exact=True).click()
        await p.wait_for_function('()=>!!__G.state.shift?.assignment', timeout=30000)
        await p.get_by_role('button', name='Interact', exact=True).click()
        await p.locator('.zone').filter(has_text=re.compile('^Engineering desk$')).click()
        await p.get_by_role('button', name='Check logs and reproduce the failure', exact=True).click()
        await p.wait_for_function("()=>__G.state.shift?.assignment?.stage==='working'", timeout=45000)
        await shot(p, 'work-at-station')
        print('Work assignment started; checking its real server timer.', flush=True)
        for _ in range(4):
            await p.wait_for_timeout(25000)
        await p.wait_for_function('()=>__G.state.shift?.tasks===1', timeout=15000)
        assert await p.evaluate('()=>__G.state.cash+__G.state.momo') == money
        await app(p, 'Jobs')
        await shot(p, 'work-assignment-complete')
        assert not errors, errors
        return {'passed': ['existing career and salary display', 'room work station exposed after shift start', 'walk to station', 'server timed assignment completes', 'no per-task salary or duplicate task'], 'errors': errors}
    finally:
        await context.close()


async def explore(browser, fixtures):
    context, p, errors = await open_game(browser, fixtures[3])
    try:
        await shot(p, 'hud-optional-milestone')
        await app(p, 'Explore')
        await p.get_by_role('button', name='All places', exact=True).click()
        await shot(p, 'explore-places')
        assert 'Greater Accra' not in await p.locator('.appwin').inner_text()  # no fake geographic destinations
        await put_away(p)
        area = await p.evaluate('()=>__G.state.home')
        await p.get_by_role('button', name='Interact', exact=True).click()
        await p.locator('.zone').filter(has_text=re.compile('^Walk outside$')).click()
        await p.get_by_role('dialog', name='Walk outside', exact=True).get_by_role('button', name='Walk outside', exact=True).click()
        await p.wait_for_function('id=>__G.state.place===id&&__world.place===id', arg='n:' + area, timeout=45000)
        await p.get_by_role('button', name='Interact', exact=True).click()
        await p.locator('.zone').filter(has_text=re.compile('^Walk the neighbourhood$')).click()
        names = {'nima': 'Join courtyard conversation', 'jtown': 'Listen to harbour stories', 'kaneshie':'Compare provisions prices','labadi':'Neighbourhood mobility session','osu': 'Oxford side-street photo walk', 'airres': 'Join a language exchange', 'legon': 'Join the neighbourhood study circle','trasacco':'Take the garden circuit'}
        await p.get_by_role('button', name=re.compile(re.escape(names[area]))).click()
        await p.wait_for_function('()=>!!__G.state.busy', timeout=15000)
        await p.wait_for_function('()=>!__G.state.busy', timeout=45000)
        await shot(p, 'neighbourhood-discovery')
        await app(p, 'Milestones')
        await p.wait_for_function("()=>__G.objectives?.some(d=>d.id==='first_street'&&d.completed)", timeout=30000)
        await shot(p, 'milestone-progress')
        assert not errors, errors
        return {'passed': ['real destination directory', 'home to actual neighbourhood', 'authored local activity usable', 'authoritative milestone progress'], 'errors': errors}
    finally:
        await context.close()


async def layouts(browser, fixtures):
    context, p, errors = await open_game(browser, fixtures[0])
    rows=[]
    try:
        for width,height in [(375,812),(390,844),(430,932),(390,530),(844,390)]:
            await p.set_viewport_size({'width':width,'height':height})
            await app(p,'Meet')
            await p.wait_for_timeout(1200)
            await shot(p,f'mobile-{width}x{height}')
            overflow=await p.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1')
            assert not overflow,(width,height)
            rows.append({'width':width,'height':height,'horizontalOverflow':overflow})
        assert not errors,errors
        return {'viewports':rows,'errors':errors,'visualBaseline':'New screens: manual inspection; no prior pixel baseline.'}
    finally:
        await context.close()


async def ads(browser, fixtures):
    from PIL import Image, ImageDraw
    art=RESULTS/'campaign.png'
    title='Accra Places local QA '+str(int(time.time()))
    picture=Image.new('RGB',(1024,512),'#183f35');draw=ImageDraw.Draw(picture)
    draw.rectangle((24,24,1000,488),outline='#d4b477',width=8)
    draw.text((100,180),'ACCRA PLACES',fill='#fff4d6',font_size=86)
    draw.text((100,310),'LOCAL TEST CAMPAIGN',fill='#d4b477',font_size=42)
    picture.save(art)
    context,p,errors=await open_game(browser,fixtures[0])
    mock=RESULTS/'provider.json'
    async def checkout(route):
        ref=route.request.url.split('/mock-')[-1]
        rows=json.loads(mock.read_text())
        record=rows[ref];record['status']='success'
        mock.write_text(json.dumps(rows))
        await route.fulfill(content_type='text/html',body='<html><body><h1>Local mocked checkout</h1><a href="'+html.escape(record['callback'],quote=True)+'">Return to the game</a></body></html>')
    await context.route('https://checkout.paystack.com/mock-*',checkout)
    try:
        prior=await context.request.post(args.base+'/api/ads/mine',headers={'origin':args.base},data={})
        for old in (await prior.json()).get('rows',[]):
            if old['title'].startswith('Accra Places local QA') and old['status']=='approved':
                # Soft takedown of this harness's own prior mock campaign; its paid ledger is retained.
                await context.request.post(args.base+'/api/admin/ads',headers={'origin':args.base,'x-admin-key':'local-only-mocked-advertising-admin-key-1234'},data={'id':old['id'],'action':'takedown'})
        await app(p,'My Ads')
        await p.get_by_role('button',name='Browse placements',exact=True).click()
        await p.get_by_role('button',name=re.compile('Oxford Street · commercial courtyard panel')).click()
        await p.get_by_label('Business / campaign name').fill(title)
        await p.get_by_label('Campaign artwork').set_input_files(str(art))
        await p.get_by_label('Ghana phone / mobile-money contact').fill('0240000000')
        await p.get_by_label('Customer receipt email').fill('qa@example.com')
        await p.get_by_label('Website (optional)').fill('https://example.com')
        await p.get_by_role('button',name='Preview at this location',exact=True).click()
        await p.get_by_role('button',name='Preview only · return to booking',exact=True).wait_for()
        await p.wait_for_timeout(1500)
        await shot(p,'ground-artwork-preview')
        await p.get_by_role('button',name='Preview only · return to booking',exact=True).click()
        await p.get_by_role('button',name='Reserve and continue to payment',exact=True).click()
        await p.get_by_role('link',name='Return to the game',exact=True).click(timeout=30000)
        await ready(p)
        await p.wait_for_function("()=>!!__phone?.win&&__phone.win.app.id==='ads'",timeout=30000)
        await p.get_by_text(re.compile('Payment: fulfilled')).wait_for(timeout=30000)
        await shot(p,'campaign-payment-verified')
        response=await context.request.post(args.base+'/api/ads/mine',headers={'origin':args.base},data={})
        campaigns=(await response.json())['rows'];campaign=next(c for c in campaigns if c['title']==title)
        assert campaign['status']=='paid' and campaign['payment_status']=='fulfilled'
        response=await context.request.post(args.base+'/api/admin/ads',headers={'origin':args.base,'x-admin-key':'local-only-mocked-advertising-admin-key-1234'},data={'id':campaign['id'],'action':'approve'})
        assert (await response.json()).get('ok'), 'Local moderation did not approve test artwork'
        # Refresh through the real My Ads screen, updating the public map inventory.
        await app(p,'My Ads')
        await p.get_by_role('button',name='Refresh campaigns',exact=True).click()
        await p.locator('.appwin:not(.closing) button.cell').filter(has_text=title).click()
        await shot(p,'campaign-active-report')
        await put_away(p)
        await p.get_by_role('button',name='Map',exact=True).click()
        await p.evaluate("()=>{const b=__map.ads.boards.find(b=>b.slot.id==='ground_osu');__map.focus(b.root.position.x,b.root.position.z,2.4);}")
        # Actual frames for exposure testing; no simulated payment/provider success flag enters the game.
        await p.evaluate('()=>{__stage.renderer.setPixelRatio(.35);__stage.render=__draw;}')
        await p.wait_for_timeout(5000)
        await p.evaluate('()=>{__stage.render=()=>{};}')
        await shot(p,'ground-campaign-active')
        measured=await p.evaluate('()=>({seen:__map.ads.seen?.size||0,sent:__map.ads.sent?.size||0,board:__map.ads.boards.find(b=>b.slot.id===\'ground_osu\').ad?.id,stats:__map.ads.exposureStats})')
        performance_report=await p.evaluate('''()=>{const ads=__map.ads,r=__stage.renderer;
          const read=()=>({calls:r.info.render.calls,triangles:r.info.render.triangles,geometries:r.info.memory.geometries,textures:r.info.memory.textures});
          __draw();const visible=read();for(const b of ads.boards)b.root.visible=false;__draw();const hidden=read();for(const b of ads.boards)b.root.visible=true;
          const times=[];for(let i=0;i<12;i++){ads.sampleAt=0;const t=performance.now();ads.sample(__stage);times.push(performance.now()-t);}times.sort((a,b)=>a-b);
          __draw();return {environment:'Desktop Chromium SwiftShader; diagnostic only, not phone FPS',boards:ads.boards.length,cachedCampaignTextures:ads.textures.size,visible,hidden,samplerMedianMs:times[6],samplerMaxMs:times[11],stats:ads.exposureStats};}''')
        # Open the campaign panel through an actual projected board click.
        xy=await p.evaluate("()=>{const b=__map.ads.boards.find(b=>b.slot.id==='ground_osu'),v=b.face.getWorldPosition(__map.ads.ray.ray.origin.clone()).project(__stage.camera);return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight};}")
        await p.mouse.click(xy['x'],xy['y'])
        await p.wait_for_timeout(1200)
        await shot(p,'ground-campaign-details')
        response=await context.request.post(args.base+'/api/ads/mine',headers={'origin':args.base},data={})
        current=next(c for c in (await response.json())['rows'] if c['id']==campaign['id'])
        wallet=await p.evaluate('()=>__G.state.cash+__G.state.momo')
        await p.get_by_role('button',name='Close',exact=True).click()
        await p.wait_for_timeout(400)
        await app(p,'MoMo')
        await p.get_by_role('button',name='Top up',exact=True).click()
        await p.locator('button.cell').filter(has_text='GH₵600 game money').click()
        await p.get_by_label('Ghana mobile-money number',exact=True).fill('0240000000')
        await p.get_by_label('Receipt email',exact=True).fill('qa@example.com')
        await p.get_by_role('button',name='Continue · GH₵10',exact=True).click()
        await p.get_by_role('link',name='Return to the game',exact=True).click(timeout=30000)
        await ready(p)
        await p.get_by_text('Payment verified',exact=True).wait_for(timeout=30000)
        await p.wait_for_function('before=>__G.state.cash+__G.state.momo===before+600',arg=wallet,timeout=30000)
        await shot(p,'wallet-payment-verified')
        assert not errors,errors
        return {'passed':['phone catalogue','artwork validation/upload','in-location preview','mocked hosted checkout','signed callback restores campaign','independent verification before activation','moderation required','active ground render','persistent campaign report','mobile-money wallet form','top-up verified and credited once with reference restored'], 'metrics':{'estimatedImpressions':current['impressions'],'clicks':current['clicks'],'uniqueViewers':current['unique_viewers']},'sampler':measured,'performance':performance_report,'errors':errors}
    finally:
        await context.close()


async def performance(browser, fixtures):
    context,p,errors=await open_game(browser,fixtures[0])
    try:
        await p.get_by_role('button',name='Map',exact=True).click()
        await p.wait_for_function('()=>__map.ready&&__map.ads.boards.some(b=>b.slot.id==="ground_osu"&&b.ad)',timeout=60000)
        await p.evaluate('()=>{const b=__map.ads.boards.find(b=>b.slot.id==="ground_osu");__map.focus(b.root.position.x,b.root.position.z,2.4);}')
        await p.wait_for_function('()=>__map.ads.boards.find(b=>b.slot.id==="ground_osu").face.material.map?.image?.complete',timeout=30000)
        report=await p.evaluate('''()=>{const a=__map.ads,r=__stage.renderer,read=()=>({calls:r.info.render.calls,triangles:r.info.render.triangles,geometries:r.info.memory.geometries,textures:r.info.memory.textures});
          for(let i=0;i<12;i++)__map.update(.016);__draw();const visible=read();for(const b of a.boards)b.root.visible=false;__draw();const hidden=read();for(const b of a.boards)b.root.visible=true;
          const sent=a.sent,seen=a.seen,times=[];for(let i=0;i<12;i++){a.sent=new Map();a.seen=new Map();a.sampleAt=0;const t=performance.now();a.sample(__stage);times.push(performance.now()-t);}a.sent=sent;a.seen=seen;
          const ordered=[...times].sort((x,y)=>x-y),resources=[];for(let i=0;i<8;i++){__map.show(false);__map.show(true);__map.focus(a.boards.find(b=>b.slot.id==='ground_osu').root.position.x,a.boards.find(b=>b.slot.id==='ground_osu').root.position.z,2.4);__map.update(.016);__draw();resources.push(read());}
          return {environment:'Desktop Chromium SwiftShader, 390x844, diagnostic only; no physical-phone FPS claim',boards:a.boards.length,cachedCampaignTextures:a.textures.size,visible,hidden,eligibleSamplerMs:times,samplerMedianMs:ordered[6],samplerMaxMs:ordered[11],stats:a.exposureStats,repeatedMapResources:resources};}''')
        await shot(p,'ground-performance-context')
        assert not errors,errors
        return {**report,'errors':errors}
    finally:
        await context.close()


async def main():
    fixtures=json.loads(Path(args.fixtures).read_text())
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        try:
            fn=globals()[args.case]
            result=await fn(browser,fixtures)
            (RESULTS/(args.case+'-browser.json')).write_text(json.dumps(result,indent=2))
            print(json.dumps(result,indent=2),flush=True)
        finally:
            await browser.close()


asyncio.run(main())
