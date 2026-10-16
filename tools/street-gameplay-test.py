"""Authenticated Phase 5 local journeys; disposable accounts, production cookie auth.

Run against the isolated local fixture stack, never a public server. Rendering
is sampled explicitly on SwiftShader; simulation and network remain live.
"""
import argparse
import asyncio
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding='utf-8')

parser = argparse.ArgumentParser()
parser.add_argument('--case', choices=['inspect', 'coverage', 'pilot', 'travel', 'recover', 'final', 'estate'], default='coverage')
parser.add_argument('--base', default='http://127.0.0.1:8082')
parser.add_argument('--fixtures', default='.local/phase5/fixtures.json')
parser.add_argument('--start', type=int, default=0)
args = parser.parse_args()
target = urlsplit(args.base)
if target.scheme != 'http' or target.hostname not in ('127.0.0.1', 'localhost') or target.username or target.password or target.path not in ('', '/'):
    raise ValueError('Use the isolated loopback QA server only.')
OUT = Path('.local/phase5/gameplay')
OUT.mkdir(parents=True, exist_ok=True)


async def open_game(browser, fixture, video=False):
    options = dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    if video:
        options['record_video_dir'] = str(OUT / 'video')
        options['record_video_size'] = {'width': 390, 'height': 844}
    context = await browser.new_context(**options)
    await context.add_cookies([{'name': 'awd_session', 'value': fixture['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
    async def keepalive():
        while True:
            try:
                await context.request.get(args.base + '/api/session', timeout=20000)
            except Exception:
                pass
            await asyncio.sleep(3)
    task = asyncio.create_task(keepalive())
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    await page.goto(args.base, wait_until='domcontentloaded')
    await ready(page)
    return context, page, errors, task


async def ready(page):
    await page.wait_for_function('()=>!!window.__stage', timeout=120000)
    await page.evaluate('()=>{__stage.renderer.setPixelRatio(.6);window.__draw=__stage.render.bind(__stage);__stage.render=()=>{};}')
    await page.wait_for_function('()=>!!window.__world?.me', timeout=120000)
    skip = page.get_by_role('button', name='Skip tour', exact=True)
    if await skip.count():
        await skip.click()


async def shot(page, name, hour=None):
    await page.evaluate('(hour)=>{if(hour!==null)__stage.setTime(hour);__draw();}', hour)
    await page.screenshot(path=str(OUT / (name + '.png')))


async def route(page, label, destination=None):
    await page.get_by_role('button', name='Interact', exact=True).click()
    await page.locator('.zone').filter(has_text=re.compile('^' + re.escape(label) + '$')).click()
    await page.get_by_role('dialog', name=label, exact=True).get_by_role('button', name=label, exact=True).click()
    if destination:
        await page.wait_for_function('place=>__G.state.place===place&&__world.place===place', arg=destination, timeout=60000)


async def walk(page, x, z):
    """Steer the real joystick along the existing navigation grid."""
    box = await page.locator('.joy').bounding_box()
    assert box, 'joystick unavailable'
    cx, cy = box['x'] + box['width']/2, box['y'] + box['height']/2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    start = time.monotonic()
    try:
        while time.monotonic() - start < 55:
            state = await page.evaluate('''([x,z])=>{
                const p=__world.me,path=__world.room.path(p.x,p.z,x,z);
                while(path.length>1&&Math.hypot(path[0][0]-p.x,path[0][1]-p.z)<.55)path.shift();
                const t=path[0]||[x,z],dx=t[0]-p.x,dz=t[1]-p.z,y=__stage.view.yaw;
                return {x:p.x,z:p.z,path,d:Math.hypot(x-p.x,z-p.z),vx:Math.cos(y)*dx-Math.sin(y)*dz,vy:Math.sin(y)*dx+Math.cos(y)*dz};
            }''', [x, z])
            if state['d'] < .7:
                return
            length = max(.001, (state['vx']**2 + state['vy']**2)**.5)
            await page.mouse.move(cx + 40*state['vx']/length, cy + 40*state['vy']/length)
            await page.wait_for_timeout(220)
        raise AssertionError(f'joystick could not reach {x},{z}: {state}')
    finally:
        await page.mouse.up()
        await page.wait_for_timeout(700)


async def coverage(browser, fixtures):
    results = []
    for fixture in fixtures[args.start:8]:
        context, page, errors, task = await open_game(browser, fixture)
        area = fixture['home']
        try:
            # Keep the local renderer isolated from the expensive city overview.
            await page.evaluate('async()=>{await __map.terrainReady;__map.dispose();}')
            if await page.evaluate('()=>__G.state.place') != 'home':
                if (await page.evaluate('()=>__G.state.place')).startswith('e:'):
                    await route(page, 'Back to neighbourhood', 'n:' + area)
                await route(page, 'Go indoors', 'home')
            funds = await page.evaluate('()=>__G.state.cash+__G.state.momo')
            await route(page, 'Walk outside', 'n:' + area)
            entry = await page.evaluate('()=>({x:__world.me.x,z:__world.me.z,street:__world.msg.street})')
            assert entry['street']['network'] == area
            await shot(page, area + '-frontage', 13)
            await walk(page, 0, 0)
            await shot(page, area + '-intersection', 13)
            assert await page.evaluate('()=>__world.room.streetStream.active.size<=4')
            await route(page, 'Player-owned estate', 'e:' + area)
            await page.wait_for_function('()=>!!__world.estate', timeout=30000)
            owners = await page.evaluate('()=>__world.estate.owners.map(o=>({mine:o.mine,home:o.home}))')
            assert bool([o for o in owners if o['mine']]) == fixture['owned']
            await shot(page, area + '-estate', 13)
            if fixture['owned']:
                await route(page, 'Go indoors', 'home')
            else:
                await route(page, 'Back to neighbourhood', 'n:' + area)
                await route(page, 'Go indoors', 'home')
            assert await page.evaluate('()=>__G.state.cash+__G.state.momo') == funds
            assert not errors, errors
            results.append({'home': area, 'homeExit': True, 'intersectionJoystick': True, 'estate': True, 'ownerHome': fixture['owned'], 'homeReturn': True, 'unchangedFunds': True, 'errors': errors})
            (OUT/'coverage.json').write_text(json.dumps(results, indent=2))
            print('PASS home/street/intersection/estate/home', area, flush=True)
        except Exception:
            await shot(page, area + '-failure')
            print((await page.locator('body').inner_text())[:3000], flush=True)
            raise
        finally:
            task.cancel()
            await context.close()


async def pilot(browser, fixtures):
    results = {}
    context, a, errors, task = await open_game(browser, fixtures[4], video=True)
    other = None
    def save():
        (OUT/'pilot.json').write_text(json.dumps(results, indent=2))
    try:
        place = await a.evaluate('()=>__G.state.place')
        if place == 'home':
            await route(a, 'Walk outside', 'n:osu')
        assert await a.evaluate('()=>__G.state.place') == 'n:osu'
        await a.evaluate('()=>{window.__routeFrames=setInterval(()=>__draw(),1200);}')
        trajectory = []
        for i, (x, z) in enumerate([(0,-7),(0,0),(0,7),(12,7),(12,-7)]):
            await walk(a, x, z)
            trajectory.append(await a.evaluate('()=>({x:__world.me.x,z:__world.me.z,room:__G.room,stream:__world.room.streetStream.stats()})'))
            await shot(a, 'osu-route-' + str(i+1), 13)
        assert len({p['room'] for p in trajectory}) == 1
        results['continuousRoute'] = trajectory
        await shot(a, 'osu-night', 22)
        layouts = []
        for width, height in [(375,812),(390,844),(430,932),(390,530),(844,390)]:
            await a.set_viewport_size({'width':width,'height':height})
            await a.wait_for_timeout(400)
            info = await a.evaluate('''()=>{
                const joy=document.querySelector('.joy').getBoundingClientRect(),nav=document.querySelector('.play-nav').getBoundingClientRect(),head=document.querySelector('.play-hud').getBoundingClientRect();
                return {width:innerWidth,height:innerHeight,joy:{x:joy.x,y:joy.y,right:joy.right,bottom:joy.bottom},nav:{y:nav.y,bottom:nav.bottom},headerBottom:head.bottom,overflow:document.documentElement.scrollWidth>innerWidth};
            }''')
            assert info['joy']['x']>=0 and info['joy']['right']<=width
            assert info['joy']['bottom']<=info['nav']['y']+1
            assert info['headerBottom']<info['joy']['y'] and not info['overflow'], info
            layouts.append(info)
            await shot(a, f'layout-{width}-{height}', 13)
        results['layouts'] = layouts
        await a.set_viewport_size({'width':390,'height':844})
        # Manual camera controls still use the existing canvas gestures.
        old = await a.evaluate('()=>__stage.view.zoom')
        await a.mouse.move(280,340)
        await a.mouse.wheel(0,100)
        assert await a.evaluate('()=>__stage.view.zoom') > old
        old_target = await a.evaluate('()=>[__stage.view.target.x,__stage.view.target.z]')
        await a.mouse.move(280,340)
        await a.mouse.down()
        await a.mouse.move(315,360,steps=5)
        await a.mouse.up()
        new_target = await a.evaluate('()=>[__stage.view.target.x,__stage.view.target.z]')
        assert old_target != new_target
        results['cameraPanZoom'] = True
        await a.evaluate('()=>clearInterval(__routeFrames)')
        position = await a.evaluate('()=>[__world.me.x,__world.me.z]')
        await a.reload(wait_until='domcontentloaded')
        await ready(a)
        restored = await a.evaluate('()=>[__world.me.x,__world.me.z]')
        assert ((restored[0]-position[0])**2+(restored[1]-position[1])**2)**.5<1.5, (position, restored)
        results['streetReload'] = {'before':position,'restored':restored}
        save()
        other, b, other_errors, other_task = await open_game(browser, fixtures[8])
        await b.evaluate('async()=>{await __map.terrainReady;__map.dispose();}')
        if await b.evaluate('()=>__G.state.place') == 'home':
            await route(b, 'Walk outside', 'n:osu')
        await a.wait_for_function('()=>__world.others.size>=1', timeout=30000)
        await b.wait_for_function('()=>__world.others.size>=1', timeout=30000)
        await walk(a, 0, 0)
        await walk(b, 0, 3)
        remote_before = await b.evaluate('()=>{const p=__world.room.people.get("p"+[...__world.others.keys()][0]);return [p.x,p.z];}')
        await walk(a, 0, -2)
        await b.wait_for_function('old=>{const p=__world.room.people.get("p"+[...__world.others.keys()][0]);return Math.hypot(p.x-old[0],p.z-old[1])>.5;}', arg=remote_before)
        await shot(a, 'osu-two-players', 13)
        peer = await b.evaluate('()=>__G.myId')
        point = await a.evaluate('id=>{const p=__world.room.people.get("p"+id);return __world.screenOf(p.x,1.2,p.z);}', peer)
        await a.evaluate('()=>{window.__qaSocial=null;__net.on("social_done",m=>window.__qaSocial=m.kind);}')
        await a.mouse.click(*point)
        await a.get_by_role('button',name='Wave',exact=True).click()
        await a.wait_for_function('()=>window.__qaSocial==="wave"')
        await a.get_by_role('button',name='Chat',exact=True).click()
        message = 'Meet me by the Oxford entrance.'
        await a.get_by_role('textbox',name='Message',exact=True).fill(message)
        await a.get_by_role('button',name='Send message',exact=True).click()
        await b.get_by_role('button',name='Chat',exact=True).click()
        await b.locator('.chat-message').filter(has_text=message).first.wait_for()
        await a.get_by_role('button',name='Close chat',exact=True).click()
        await b.get_by_role('button',name='Close chat',exact=True).click()
        results['multiplayer'] = {'sameRoom':True,'joystickRemoteMovement':True,'clickPlayerWave':True,'cityChat':True}
        await route(b, 'Go indoors', 'home')
        await a.wait_for_function('()=>__world.others.size===0')
        await route(b, 'Walk outside', 'n:osu')
        await a.wait_for_function('()=>__world.others.size>=1')
        results['multiplayer']['homePresenceLeaveReturn'] = True
        # Walk to the ordinary venue frontage, then approve normal timed travel.
        zone = await a.evaluate('()=>__world.spec.zones.find(z=>z.destination==="oxford").label')
        await route(a, zone)
        await a.locator('.rides .ride.sel').wait_for()
        assert 'Free' in await a.locator('.rides .ride.sel').inner_text()
        await shot(a, 'osu-venue-travel-choice', 13)
        funds = await a.evaluate('()=>__G.state.cash+__G.state.momo')
        confirmation=await confirm_trip(a)
        busy=confirmation['busy'];travel={'from':busy['travel']['from'],'to':busy['travel']['to'],'ms':busy['end']-busy['start']}
        assert travel['to']=='oxford' and travel['from']=='n:osu' and travel['ms']>=5000
        await b.wait_for_function('()=>__world.others.size===0')
        await a.wait_for_function('()=>__G.state.place==="oxford"&&__world.place==="oxford"', timeout=90000)
        await shot(a, 'oxford-interior', 13)
        assert await a.evaluate('()=>__G.state.cash+__G.state.momo')==funds
        await a.reload(wait_until='domcontentloaded')
        await ready(a)
        assert await a.evaluate('()=>__world.spec.zones.some(z=>z.id==="street-return")')
        results['venue'] = {'frontageWalk':True,'timedWalking':travel,'interior':True,'reloadReturnContext':True}
        await route(a, 'Return to Osu streets')
        await confirm_trip(a,disconnect=True)
        # Real network outage during an active authoritative journey.
        await context.set_offline(True)
        await a.wait_for_timeout(1800)
        await context.set_offline(False)
        await a.wait_for_function('()=>__net.connected&&__G.state.place==="n:osu"&&__world.place==="n:osu"', timeout=120000)
        await b.wait_for_function('()=>__world.others.size>=1', timeout=30000)
        results['venue']['timedReturnReconnect'] = True
        await shot(a, 'osu-return-entrance', 13)
        save()
        other_task.cancel()
        await other.close()
        other = None
        # Strategic map and transport are still the only distant-travel path.
        await route(a, 'City map')
        await a.locator('.mapui').wait_for(state='visible')
        await a.evaluate('()=>__act.place("circle")')
        await a.locator('.ride').filter(has_text='Trotro').click()
        funds = await a.evaluate('()=>__G.state.cash+__G.state.momo')
        quote = await a.locator('.sheet-back.in .sheet-body > .btn.primary.wide').inner_text()
        confirmation=await confirm_trip(a);busy=confirmation['busy'];paid={'cost':confirmation['cost'],'to':busy['travel']['to'],'mode':busy['travel']['mode'],'ms':busy['end']-busy['start']}
        assert paid['cost']>0 and paid['to']=='circle' and paid['mode']=='trotro'
        await a.reload(wait_until='domcontentloaded')
        await ready(a)
        await a.wait_for_function('()=>__G.state.place==="circle"&&__world.place==="circle"', timeout=120000)
        assert not await a.evaluate('()=>__ride.active||!!__stage.override')
        await shot(a, 'circle-paid-arrival', 13)
        assert await a.evaluate('()=>__G.state.cash+__G.state.momo')==funds-paid['cost']
        results['distantTravel'] = {'quoted':quote,'fare':paid['cost'],'timing':paid['ms'],'arrival':'circle','reloadDuringTravel':True,'rideCleaned':True}
        assert not errors and not other_errors, (errors, other_errors)
        results['errors'] = errors + other_errors
        save()
        print('PASS pilot route, five layouts, camera, recovery, multiplayer, venue and distant paid travel', flush=True)
    except Exception:
        await shot(a, 'pilot-failure')
        print((await a.locator('body').inner_text())[:3000], flush=True)
        save()
        raise
    finally:
        task.cancel()
        if other:
            other_task.cancel()
            await other.close()
        await context.close()


async def confirm_trip(page, disconnect=False):
    # Listen before clicking: a five-second trip can finish while a heavily
    # loaded software renderer stalls the next automation command.
    await page.evaluate('''drop=>{
        window.__qaTrip=null;window.__qaOffTrip?.();
        const observe=m=>{
            if(!m.busy?.travel||window.__qaTrip)return;
            window.__qaTrip={cost:m.cost,busy:m.busy,observedAt:__net.now(),activeWhenObserved:m.busy.end>__net.now()};
            if(drop){__net.backoff=5000;__net.ws.close();}
        };
        window.__qaOffTrip=__net.on('busy',observe);
        // Observe the authoritative packet before costly travel-scene setup.
        // This records receipt time, rather than the end of UI initialization.
        const handlers=__net.h.busy;handlers.splice(handlers.indexOf(observe),1);handlers.unshift(observe);
    }''', disconnect)
    await page.locator('.sheet-back.in .sheet-body > .btn.primary.wide').click()
    await page.wait_for_function('()=>!!window.__qaTrip', timeout=30000)
    return await page.evaluate('()=>window.__qaTrip')


async def recovery_check(browser,fixtures):
    results=json.loads((OUT/'pilot.json').read_text())
    context,page,errors,task=await open_game(browser,fixtures[4])
    try:
        if await page.evaluate('()=>__G.state.place')!='n:osu':
            await page.get_by_role('button',name='Map',exact=True).click()
            await page.evaluate('()=>__act.place("n:osu")')
            await page.locator('.ride').filter(has_text='Trotro').click()
            await confirm_trip(page)
            await page.wait_for_function('()=>__world.place==="n:osu"&&!__G.state.busy',timeout=120000)
        zone=await page.evaluate('()=>__world.spec.zones.find(z=>z.destination==="oxford").label')
        await route(page,zone);trip=await confirm_trip(page)
        assert trip['activeWhenObserved']
        await page.wait_for_function('()=>__world.place==="oxford"&&!__G.state.busy',timeout=90000)
        await page.reload(wait_until='domcontentloaded');await ready(page)
        assert await page.evaluate('()=>__world.spec.zones.some(z=>z.id==="street-return")')
        await route(page,'Return to Osu streets');back=await confirm_trip(page,disconnect=True)
        assert back['activeWhenObserved'],back
        await context.set_offline(True);await page.wait_for_timeout(1800);await context.set_offline(False)
        await page.wait_for_function('()=>__net.connected&&__world.place==="n:osu"&&!__G.state.busy',timeout=120000)
        await shot(page,'osu-return-entrance',13)
        results['recovery']={'venueReloadContext':True,'socketClosedOnTravelConfirmation':True,'activeAtDisconnect':True,'reconnectArrival':'n:osu','returnMilliseconds':back['busy']['end']-back['busy']['start'],'confirmation':back}
        results['venue']['confirmation']=trip
        results['errors']=errors
        assert not errors,errors
        (OUT/'pilot.json').write_text(json.dumps(results,indent=2))
        print('PASS socket closed while server journey was active, reload return context, authoritative reconnect arrival',flush=True)
    finally:
        task.cancel();await context.close()


async def final_check(browser,fixtures):
    context,page,errors,task=await open_game(browser,fixtures[4])
    try:
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        await page.evaluate('''async()=>{
            await __map.terrainReady;__map.dispose();window.__qaRoomTimes=[];
            __net.h.room.unshift(()=>window.__qaRoomStart=performance.now());
            __net.on('room',m=>__qaRoomTimes.push({place:m.place,milliseconds:performance.now()-__qaRoomStart}));
        }''')
        await route(page,'Go indoors','home')
        await shot(page,'final-owned-home',13)
        await route(page,'Walk outside','n:osu')
        await page.get_by_role('button',name='Entrance: Go indoors',exact=True).click()
        await page.get_by_role('dialog',name='Go indoors',exact=True).get_by_role('button',name='Close',exact=True).click()
        await shot(page,'final-home-frontage',13)
        await walk(page,0,0)
        await shot(page,'final-intersection',13)
        timing=await page.evaluate('()=>({roomBuild:__qaRoomTimes,stream:__world.room.streetStream.stats(),memory:__stage.renderer.info.memory,programs:__stage.renderer.info.programs.length})')
        assert timing['stream']['active']<=4 and not errors,(timing,errors)
        (OUT/'final-smoke.json').write_text(json.dumps({'timing':timing,'nearbyEntranceButton':True,'errors':errors},indent=2))
        print('PASS final surface reuse, home/street transitions, nearby entrance, joystick and room timing',flush=True)
    finally:
        task.cancel();await context.close()


async def estate_recovery(browser,fixtures):
    context,page,errors,task=await open_game(browser,fixtures[4])
    try:
        await page.evaluate('async()=>{await __map.terrainReady;__map.dispose();}')
        await route(page,'Player-owned estate','e:osu')
        await page.wait_for_function('()=>__world.estate?.owners.some(o=>o.mine)')
        point=await page.evaluate('()=>{const rec=__world.room.items.find(r=>r.spec.owner?.mine);return __world.room.usePoint(rec);}')
        await walk(page,point['x'],point['z'])
        before=await page.evaluate('()=>({x:__world.me.x,z:__world.me.z})')
        await page.reload(wait_until='domcontentloaded');await ready(page)
        await page.wait_for_function('()=>__world.estate?.owners.some(o=>o.mine)')
        restored=await page.evaluate('()=>({x:__world.me.x,z:__world.me.z,free:__world.room.free(...__world.room.cellOf(__world.me.x,__world.me.z))})')
        assert abs(restored['x'])<.1 and abs(restored['z']-16)<.1 and restored['free'],restored
        await shot(page,'estate-recovery',13)
        await route(page,'Go indoors','home');await route(page,'Walk outside','n:osu')
        assert not errors,errors
        (OUT/'estate-recovery.json').write_text(json.dumps({'before':before,'restored':restored,'ownHomeReentry':True,'errors':errors},indent=2))
        print('PASS estate gate recovery, actual owner directory and home re-entry',flush=True)
    finally:
        task.cancel();await context.close()


async def travel_finish(browser, fixtures):
    results=json.loads((OUT/'pilot.json').read_text())
    context, page, errors, task=await open_game(browser,fixtures[4])
    def save():
        (OUT/'pilot.json').write_text(json.dumps(results,indent=2))
    try:
        place=await page.evaluate('()=>__G.state.place')
        assert place in ('oxford','n:osu'),place
        if place=='oxford':
            await shot(page,'oxford-interior',13)
            await page.reload(wait_until='domcontentloaded');await ready(page)
            assert await page.evaluate('()=>__world.spec.zones.some(z=>z.id==="street-return")')
            await route(page,'Return to Osu streets')
            trip=await confirm_trip(page,disconnect=True)
            assert trip['busy']['travel']['to']=='n:osu'
            await context.set_offline(True);await page.wait_for_timeout(1800);await context.set_offline(False)
            await page.wait_for_function('()=>__net.connected&&__G.state.place==="n:osu"&&__world.place==="n:osu"',timeout=120000)
            results['recovery']={'venueReloadContext':True,'socketClosedOnTravelConfirmation':True,'reconnectArrival':'n:osu','returnMilliseconds':trip['busy']['end']-trip['busy']['start']}
            await shot(page,'osu-return-entrance',13);save()
        zone=await page.evaluate('()=>__world.spec.zones.find(z=>z.destination==="oxford").label')
        await route(page,zone)
        await page.locator('.rides .ride.sel').wait_for()
        assert 'Free' in await page.locator('.rides .ride.sel').inner_text()
        trip=await confirm_trip(page)
        assert trip['busy']['travel']['from']=='n:osu' and trip['busy']['travel']['to']=='oxford'
        assert trip['busy']['end']-trip['busy']['start']>=5000 and trip['cost']==0
        await page.wait_for_function('()=>__G.state.place==="oxford"&&__world.place==="oxford"',timeout=90000)
        await shot(page,'oxford-interior',13)
        results['venue']={'frontageWalk':True,'confirmation':trip,'interior':True}
        await route(page,'Return to Osu streets')
        back=await confirm_trip(page)
        await page.wait_for_function('()=>__G.state.place==="n:osu"&&__world.place==="n:osu"',timeout=90000)
        results['venue']['timedReturnMilliseconds']=back['busy']['end']-back['busy']['start'];save()
        await route(page,'City map')
        await page.locator('.mapui').wait_for(state='visible')
        await page.evaluate('()=>__act.place("circle")')
        await page.locator('.ride').filter(has_text='Trotro').click()
        funds=await page.evaluate('()=>__G.state.cash+__G.state.momo')
        quoted=await page.locator('.sheet-back.in .sheet-body > .btn.primary.wide').inner_text()
        paid=await confirm_trip(page)
        assert paid['cost']>0 and paid['busy']['travel']['mode']=='trotro'
        await page.reload(wait_until='domcontentloaded');await ready(page)
        await page.wait_for_function('()=>__G.state.place==="circle"&&__world.place==="circle"',timeout=120000)
        assert await page.evaluate('()=>__G.state.cash+__G.state.momo')==funds-paid['cost']
        assert not await page.evaluate('()=>__ride.active||!!__stage.override')
        await shot(page,'circle-paid-arrival',13)
        results['distantTravel']={'quoted':quoted,'confirmation':paid,'arrival':'circle','reloadDuringJourney':True,'fareDebitedExactlyOnce':True,'rideCleaned':True}
        assert not errors,errors
        results['errors']=errors;save()
        print('PASS timed frontage/venue/return, venue reload, disconnect recovery, map, paid travel and journey reload',flush=True)
    except Exception:
        await shot(page,'travel-failure');save();raise
    finally:
        task.cancel();await context.close()


async def main():
    fixtures = json.loads(Path(args.fixtures).read_text())
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        if args.case == 'inspect':
            context, page, errors, task = await open_game(browser, fixtures[4])
            print((await page.locator('body').inner_text())[:4000], flush=True)
            await shot(page, 'inspect')
            task.cancel()
            await context.close()
        elif args.case == 'coverage':
            await coverage(browser, fixtures)
        elif args.case == 'pilot':
            await pilot(browser, fixtures)
        elif args.case == 'travel':
            await travel_finish(browser, fixtures)
        elif args.case == 'recover':
            await recovery_check(browser,fixtures)
        elif args.case == 'final':
            await final_check(browser,fixtures)
        else:
            await estate_recovery(browser,fixtures)
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
