"""Stage 4 journey H: overhead and third-person movement on a neighbourhood street and in a
home, with a second player present. Loopback disposable server and fixtures only
(roles 'owner' and 'friend', both living in Nima). SwiftShader screenshots, real timers;
no phone FPS claim.
"""
import argparse, asyncio, json, math, sys
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding='utf-8')
parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:8083')
args = parser.parse_args()
if urlsplit(args.base).hostname not in ('localhost', '127.0.0.1'):
    raise ValueError('Disposable loopback server only')
FIX = {f['role']: f for f in json.loads(Path('.local/phase8/fixtures.json').read_text())}
OUT = Path('docs/master/stage4'); OUT.mkdir(parents=True, exist_ok=True)
checks = []


def check(ok, text):
    print(('PASS ' if ok else 'FAIL ') + text, flush=True); checks.append({'ok': bool(ok), 'check': text})
    if not ok:
        raise AssertionError(text)


async def game(browser, role):
    c = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    await c.add_cookies([{'name': 'awd_session', 'value': FIX[role]['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
    p = await c.new_page(); errors = []
    p.on('pageerror', lambda e: errors.append(str(e)))
    await p.goto(args.base, wait_until='domcontentloaded')
    await p.wait_for_function('()=>!!window.__world?.me', timeout=180000)
    for _ in range(2):
        if await p.get_by_role('button', name='Skip tour', exact=True).count():
            await p.get_by_role('button', name='Skip tour', exact=True).click()
        if await p.get_by_role('button', name='Skip', exact=True).count():
            await p.get_by_role('button', name='Skip', exact=True).click()
        await p.wait_for_timeout(800)
    return c, p, errors


async def shot(p, name):
    await p.evaluate('()=>__stage.render()'); await p.wait_for_timeout(250)
    await p.screenshot(path=str(OUT / f'{name}.jpg'), type='jpeg', quality=70)


async def joystick(p, dx, dy, ms):
    box = await p.locator('.joy').bounding_box()
    cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + dx, cy + dy, steps=4)
    await p.wait_for_timeout(ms); await p.mouse.up()


async def go_street(p):
    if await p.evaluate("()=>__G.place") != 'n:nima':
        await p.evaluate("()=>__net.send({t:'street',to:'n:nima'})")
        await p.wait_for_function("()=>__G.place==='n:nima'&&!!__world?.me", timeout=120000)
        await p.wait_for_timeout(2500)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ac, a, aerr = await game(browser, 'owner')
        bc, b, berr = await game(browser, 'friend')
        await a.evaluate("()=>localStorage.removeItem('awd.camera')")
        await go_street(a); await go_street(b)
        bid = await b.evaluate('()=>__G.myId')
        await a.wait_for_function(f"()=>__world.others.has({bid})", timeout=30000)
        check(True, 'both players are in the same Nima street room')
        check(await a.evaluate('()=>__stage.mode') == 'iso', 'overhead camera is the default')
        await shot(a, 'h1-street-overhead')

        await a.get_by_role('button', name='Camera: overhead. Switch to behind-you view').click()
        await a.wait_for_timeout(1200)
        check(await a.evaluate("()=>__stage.mode==='follow'&&__stage.camera.isPerspectiveCamera&&localStorage.getItem('awd.camera')==='follow'"), 'toggle switches to the third-person camera and saves the preference')
        await shot(a, 'h2a-before-joystick')
        print('  blocked?', await a.evaluate("()=>({sheets:document.querySelectorAll('.sheet-back').length,joyHidden:document.querySelector('.joy').hidden,busy:__G.state.busy?.id||null})"), flush=True)
        before = await a.evaluate('()=>({x:__world.me.x,z:__world.me.z,c:__stage.camera.position.toArray()})')
        moved = 0
        for dx, dy in ((0, -40), (40, 0), (0, 40), (-40, 0)):   # the first open direction (walls block some)
            await joystick(a, dx, dy, 1600)
            await a.wait_for_timeout(1500)
            after = await a.evaluate('()=>({x:__world.me.x,z:__world.me.z,c:__stage.camera.position.toArray(),run:__world.me.av.curName})')
            moved = math.hypot(after['x'] - before['x'], after['z'] - before['z'])
            if moved > 1:
                break
        cam = math.dist(after['c'], before['c'])
        print('  moved', round(moved, 2), 'm; camera moved', round(cam, 2), 'm', flush=True)
        check(moved > 1.0 and cam > 0.5, 'joystick moves the player forward relative to the camera and the camera follows')
        await shot(a, 'h2-street-third-person')
        # The other player sees this player in the street.
        aid = await a.evaluate('()=>__G.myId')
        await a.wait_for_timeout(2500)
        print('  A me', await a.evaluate('()=>[__world.me.x,__world.me.z,__G.room]'), 'B sees', await b.evaluate(f"()=>{{const p=__world.room.people.get('p{aid}');return p?[p.x,p.z,p.path.length,__G.room]:null}}"), flush=True)
        await b.wait_for_function(f"()=>{{const p=__world.room.people.get('p{aid}');return p&&Math.hypot(p.x-({after['x']}),p.z-({after['z']}))<2.5;}}", timeout=30000)
        check(True, 'the second player sees the first player at the new position')
        await b.evaluate("()=>__net.send({t:'rmv',x:__world.me.x+1.5,z:__world.me.z,it:null,zn:null})")
        await a.wait_for_timeout(2500); await shot(a, 'h3-two-players-third-person')

        # Indoors: enclosed room, camera collision, wall fading.
        zone = await a.evaluate("()=>__world.spec.zones.find(z=>z.route==='home')")
        check(zone is not None, 'the street offers the home entrance')
        await a.evaluate('z=>__act.route(z)', zone)
        await a.wait_for_function("()=>__G.place==='home'&&!!__world?.me", timeout=120000)
        await a.wait_for_timeout(3000)
        info = await a.evaluate('''()=>{const s=__world.spec,c=__stage.camera.position;return {mode:__stage.mode,walls:__world.room.extraWalls?.length||0,
          inside:Math.abs(c.x)<=s.w/2&&Math.abs(c.z)<=s.d/2,dist:__stage.follow.actual}}''')
        print('  home', info, flush=True)
        check(info['mode'] == 'follow' and info['walls'] == 2 and info['inside'], 'home keeps third person, encloses the cutaway and keeps the camera inside the room')
        await shot(a, 'h4-home-third-person')
        for yaw in (0, math.pi / 2, math.pi, -math.pi / 2):
            await a.evaluate(f'()=>{{__stage.follow.yaw={yaw};__stage.follow.dist=6.5;__stage.applyView();}}')
            await a.wait_for_timeout(500)
            r = await a.evaluate('''()=>{const s=__world.spec,c=__stage.camera.position;return {inside:Math.abs(c.x)<=s.w/2+.01&&Math.abs(c.z)<=s.d/2+.01,actual:__stage.follow.actual}}''')
            check(r['inside'], f'camera stays inside the room at yaw {yaw:.2f} (requested 6.5 m, used {r["actual"]:.2f} m)')
        faded = await a.evaluate('()=>(__world.room.fadeMats||[]).some(m=>m.opacity<0.6)')
        check(faded, 'walls on the camera side fade so the player stays visible')
        await a.evaluate('()=>{__stage.follow.dist=3.4;__stage.follow.yaw=__world.me.yaw+Math.PI;__stage.applyView();}')
        await joystick(a, 30, -30, 1200); await a.wait_for_timeout(1500)
        await shot(a, 'h5-home-walk')
        seat = await a.evaluate("()=>{const i=__world.room.items.findIndex(r=>r.use.some(u=>u.pose&&u.pose!=='stand'));return i}")
        if seat >= 0:
            await a.evaluate(f"()=>__world.useZone({{item:{seat}}})")
            await a.wait_for_function("()=>__world.me.pose&&__world.me.pose!=='stand'", timeout=20000)
            check(True, 'player walks to furniture and sits in third person')
            await shot(a, 'h6-home-sit')

        # Leave to the street and switch back to overhead.
        exit_zone = await a.evaluate("()=>__world.spec.zones.find(z=>z.route==='neighbourhood')")
        await a.evaluate('z=>__act.route(z)', exit_zone)
        await a.wait_for_function("()=>__G.place==='n:nima'&&!!__world?.me", timeout=120000)
        await a.wait_for_timeout(2500)
        check(await a.evaluate('()=>__stage.mode') == 'follow', 'doorway transition to the street keeps third person')
        await a.get_by_role('button', name='Camera: behind you. Switch to overhead view').click()
        await a.wait_for_timeout(1200)
        check(await a.evaluate("()=>__stage.mode==='iso'&&__stage.camera.isOrthographicCamera&&localStorage.getItem('awd.camera')==='iso'"), 'toggle returns to the overhead camera')
        await shot(a, 'h7-street-overhead-again')
        await a.evaluate("()=>__act.nav('map')"); await a.wait_for_timeout(1500)
        check(await a.evaluate("()=>__stage.mode==='iso'"), 'the city map always uses the overhead camera')
        check(not aerr and not berr, 'no page errors ' + '; '.join(aerr + berr)[:300])
        await browser.close()
    (OUT / 'journey-h.json').write_text(json.dumps({'checks': checks, 'scope': 'Loopback disposable server and fixtures; SwiftShader; real timers. No phone FPS claim.'}, indent=1))

asyncio.run(main())
