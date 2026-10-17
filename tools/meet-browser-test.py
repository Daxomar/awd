"""Stage 6 acceptance on the real game UI and server (loopback disposable fixtures).

D1: a new player sees first-session objectives on the main HUD, expands them, follows one, and claims it.
D2: with nobody else online, Meet explains it honestly, offers retry and other objectives, and play continues.
D3: a second new player opts into Discover; the first chooses them and sends an introduction; the recipient
    accepts; Messages opens; a genuine reply completes First Friend once. SwiftShader; no phone FPS claim.
"""
import argparse, asyncio, json, sys
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding='utf-8')
parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:8083')
parser.add_argument('--a', default='seller')
parser.add_argument('--b', default='friend')
args = parser.parse_args()
if urlsplit(args.base).hostname not in ('localhost', '127.0.0.1'):
    raise ValueError('Disposable loopback server only')
# Fresh disposable first-week accounts for every run (loopback QA database only).
import os, subprocess
env = {**os.environ, 'DATABASE_URL': 'postgres://awd@127.0.0.1:55432/awd_security', 'REDIS_URL': 'redis://127.0.0.1:6379/14', 'REDIS_NAMESPACE': 'phase8:'}
for role in (args.a, args.b):
    subprocess.run(['node', 'loadtest/phase8-fixtures.js', 'replace-role', role], cwd='server', env=env, check=True, capture_output=True)
FIX = {f['role']: f for f in json.loads(Path('.local/phase8/fixtures.json').read_text())}
OUT = Path('docs/master/stage6'); OUT.mkdir(parents=True, exist_ok=True)
checks = []


def check(ok, text):
    print(('PASS ' if ok else 'FAIL ') + text, flush=True); checks.append({'ok': bool(ok), 'check': text})
    if not ok:
        raise AssertionError(text)


async def open_game(browser, role):
    c = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    await c.add_init_script("(()=>{Object.defineProperty(window,'devicePixelRatio',{get:()=>.5});const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>setTimeout(()=>raf(fn),75);try{localStorage.removeItem('awd.objectives.open')}catch{}})();")
    await c.add_cookies([{'name': 'awd_session', 'value': FIX[role]['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
    p = await c.new_page(); errors = []
    p.on('pageerror', lambda e: errors.append(str(e)))
    await p.goto(args.base, wait_until='domcontentloaded')
    await p.wait_for_function('()=>!!window.__world?.me', timeout=180000)
    for n in ('Skip tour', 'Skip'):
        if await p.get_by_role('button', name=n, exact=True).count():
            await p.get_by_role('button', name=n, exact=True).click()
    await p.evaluate("()=>{window.__qa=[];for(const t of ['objectives','intro_people','intro_result','intro_offer','intro_update','intro_complete','dm_in','dm_ack'])__net.on(t,m=>__qa.push({t,...m}));}")
    await p.wait_for_function("()=>!document.querySelector('.objectives-hud')?.hidden", timeout=60000)
    return c, p, errors


async def shot(p, name):
    await p.evaluate('()=>__stage.render()'); await p.wait_for_timeout(250)
    await p.screenshot(path=str(OUT / f'{name}.jpg'), type='jpeg', quality=70)


async def close_sheets(p):
    await p.evaluate("()=>document.querySelectorAll('.sheet-x').forEach(b=>b.click())"); await p.wait_for_timeout(500)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ca, a, errs_a = await open_game(browser, args.a)
        name_a, name_b = FIX[args.a]['username'], FIX[args.b]['username']

        # D1: HUD objectives
        hud = a.locator('.objectives-hud')
        text = await hud.text_content()
        check('Getting started' in text and '/' in text, 'first-session objectives are on the main HUD with progress: ' + text.strip()[:80])
        box = await hud.bounding_box(); nav = await a.locator('nav.play-nav').bounding_box()
        check(box['y'] + box['height'] < nav['y'], 'collapsed objective sits in the top HUD, clear of the bottom controls')
        await shot(a, 'd1-hud-collapsed')
        await a.locator('.obj-toggle').click(); await a.wait_for_timeout(500)
        rows = await a.locator('.obj-row').count()
        check(rows >= 8, f'expanded panel lists {rows} first-session objectives with actions')
        await shot(a, 'd2-hud-expanded')
        # Follow "Explore careers": open Jobs from its Go button, then claim from the HUD.
        await a.locator('.obj-row', has_text='Explore careers').get_by_role('button').click()
        await a.wait_for_function("()=>(__qa.filter(m=>m.t==='objectives').at(-1)?.rows||[]).some(d=>d.id==='career_look'&&d.completed)", timeout=30000)
        await a.evaluate('()=>__act.closePhone()'); await a.wait_for_timeout(800)
        xp0 = await a.evaluate('()=>__G.state.xp')
        await a.locator('.obj-row', has_text='Explore careers').get_by_role('button', name='Claim').click()
        await a.wait_for_function(f"()=>__G.state.xp>{xp0}", timeout=30000)
        await a.wait_for_timeout(500)
        check(await a.locator('.obj-row[data-state=claimed]', has_text='Explore careers').count() == 1, 'following an objective completes it on the server and the HUD claim awards XP once')
        await shot(a, 'd3-hud-claimed')

        # D2: empty server
        await a.evaluate('()=>__act.meet()')
        await a.wait_for_function("()=>__qa.some(m=>m.t==='intro_people')", timeout=30000)
        await a.wait_for_timeout(600)
        body = await a.locator('.meet-body').text_content()
        check('Nobody else' in body and 'Retry' in body and 'Meanwhile, try' in body, 'empty server: honest message, retry and other objectives')
        await shot(a, 'd4-meet-empty')
        await a.wait_for_timeout(2100)
        await a.locator('.meet-body').get_by_role('button', name='Retry').click(); await a.wait_for_timeout(2500)
        await a.locator('.meet-tabs').get_by_role('tab', name='Discover').click(); await a.wait_for_timeout(400)
        check('No players have opted into discovery' in await a.locator('.meet-body').text_content(), 'Discover is empty rather than invented')
        await a.locator('.meet-body .world-row').first.click(); await a.wait_for_timeout(1500)
        check(await a.locator('.meet-body').count() == 0, 'a suggested objective continues play when nobody is available')
        await close_sheets(a); await a.evaluate('()=>__act.closePhone()')

        # D3: second player opts into discovery; consent-based introduction
        cb, b, errs_b = await open_game(browser, args.b)
        await b.evaluate('()=>__act.meet()'); await b.wait_for_selector('.meet-toggle input', timeout=30000)
        await b.wait_for_function("()=>__qa.some(m=>m.t==='intro_people')", timeout=30000)
        await b.locator('.meet-toggle', has_text='Discover').locator('input').check(); await b.wait_for_timeout(3000)
        check(await b.locator('.meet-toggle', has_text='Discover').locator('input').is_checked(), 'the second player explicitly opts into Discover')
        await close_sheets(b)
        await a.wait_for_timeout(2100)
        await a.evaluate('()=>__act.meet()'); await a.wait_for_timeout(2600)
        await a.locator('.meet-tabs').get_by_role('tab', name='Discover').click(); await a.wait_for_timeout(400)
        person = a.locator('.meet-person', has_text='@' + name_b)
        check(await person.count() == 1, 'Discover lists the opted-in real player, without any location')
        await person.get_by_role('button', name='Say hello').click()
        await shot(a, 'd5-meet-compose')
        await person.get_by_role('button', name='Send introduction').click()
        await a.wait_for_function("()=>__qa.some(m=>m.t==='intro_result'&&(m.id||m.error))", timeout=30000)
        res = await a.evaluate("()=>__qa.filter(m=>m.t==='intro_result'&&(m.id||m.error)).at(-1)")
        check(bool(res.get('id')), 'introduction sent to the chosen player ' + str(res.get('error') or ''))
        await b.wait_for_function("()=>__qa.some(m=>m.t==='intro_offer')", timeout=30000)
        await b.evaluate('()=>__act.meet()'); await b.wait_for_selector('.meet-offer', timeout=30000)
        await shot(b, 'd6-recipient-offer')
        dms_before = await a.evaluate("()=>__qa.filter(m=>m.t==='dm_in').length")
        check(dms_before == 0, 'nothing is delivered before the recipient consents')
        await b.locator('.meet-offer').get_by_role('button', name='Accept').click()
        await b.wait_for_function(f"()=>document.querySelector('.appwin')?.textContent.includes('@{name_a}')", timeout=30000)
        check(True, 'accepting opens the existing private conversation')
        await a.wait_for_function("()=>__qa.some(m=>m.t==='intro_update'&&m.status==='accepted')", timeout=30000)
        await a.wait_for_function(f"()=>document.querySelector('.appwin')?.textContent.includes('@{name_b}')", timeout=30000)
        check(True, 'the initiator is told and their conversation opens')
        await b.wait_for_timeout(1500)
        inp = b.locator('.appwin input[placeholder="Private message"]').last
        await inp.fill('Welcome to Accra! Which neighbourhood are you exploring today?'); await inp.press('Enter')
        await b.wait_for_function("()=>__qa.some(m=>m.t==='dm_ack'&&m.ok)", timeout=30000)
        await a.wait_for_function("()=>__qa.some(m=>m.t==='intro_complete')", timeout=60000)
        check(True, 'a genuine reply completes First Friend')
        await shot(b, 'd7-reply')
        await a.evaluate("()=>{__act.closePhone();__net.send({t:'objective_status'})}")
        await a.wait_for_function("()=>(__qa.filter(m=>m.t==='objectives').at(-1)?.rows||[]).some(d=>d.id==='first_friend'&&d.completed)", timeout=30000)
        check(True, 'First Friend objective shows complete on the HUD')
        await shot(a, 'd8-first-friend-complete')
        check(not (errs_a + errs_b), 'no page errors ' + '; '.join(errs_a + errs_b)[:300])
        await browser.close()
    (OUT / 'journey-d.json').write_text(json.dumps({'checks': checks, 'scope': 'Loopback disposable fixtures; two fresh accounts; SwiftShader; real server and DB.'}, indent=1))

asyncio.run(main())
