"""Stage 7 acceptance on the real game UI and server (loopback disposable fixtures).

E1: an administrator schedules an event over the admin API (refused without the key).
E2: a player discovers it in the Events app, RSVPs, goes to the venue; attendance is recorded from real presence,
    survives closing the browser, and continues after reconnecting.
E3: profile privacy: another player sees only what the owner made public.
E4: home visit: the owner invites a nearby player home, the guest accepts, the owner sees and removes them.
SwiftShader; no phone FPS claim. The local QA admin key is read from .local and never printed.
"""
import argparse, asyncio, json, os, subprocess, sys, time, urllib.request, urllib.error
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding='utf-8')
parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:8083')
args = parser.parse_args()
if urlsplit(args.base).hostname not in ('localhost', '127.0.0.1'):
    raise ValueError('Disposable loopback server only')
env = {**os.environ, 'DATABASE_URL': 'postgres://awd@127.0.0.1:55432/awd_security', 'REDIS_URL': 'redis://127.0.0.1:6379/14', 'REDIS_NAMESPACE': 'phase8:'}
for role in ('seller', 'friend'):
    subprocess.run(['node', 'loadtest/phase8-fixtures.js', 'replace-role', role], cwd='server', env=env, check=True, capture_output=True)
FIX = {f['role']: f for f in json.loads(Path('.local/phase8/fixtures.json').read_text())}
# Local QA admin key (start the server with QA_ADMIN_KEY set to this file's content); never printed.
KEY = Path('.local/master/qa-admin-key').read_text().strip()
OUT = Path('docs/master/stage7'); OUT.mkdir(parents=True, exist_ok=True)
PSQL = r'C:\Program Files\PostgreSQL\17\bin\psql.exe'
checks = []


def sql(q):
    return subprocess.run([PSQL, env['DATABASE_URL'], '-Atc', q], capture_output=True, text=True, check=True).stdout.strip()


def check(ok, text):
    print(('PASS ' if ok else 'FAIL ') + text, flush=True); checks.append({'ok': bool(ok), 'check': text})
    if not ok:
        raise AssertionError(text)


def admin(method, body=None, key=KEY):
    req = urllib.request.Request(args.base + '/api/admin/events', method=method, data=json.dumps(body).encode() if body else None,
                                 headers={'content-type': 'application/json', 'x-admin-key': key, 'origin': args.base})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')


async def open_game(browser, role):
    c = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    await c.add_init_script("(()=>{Object.defineProperty(window,'devicePixelRatio',{get:()=>.5});const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>setTimeout(()=>raf(fn),75);})();")
    await c.add_cookies([{'name': 'awd_session', 'value': FIX[role]['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
    p = await c.new_page(); errors = []
    p.on('pageerror', lambda e: errors.append(str(e)))
    await p.goto(args.base, wait_until='domcontentloaded')
    await p.wait_for_function('()=>!!window.__world?.me', timeout=180000)
    for n in ('Skip tour', 'Skip'):
        if await p.get_by_role('button', name=n, exact=True).count():
            await p.get_by_role('button', name=n, exact=True).click()
    await p.evaluate("()=>{window.__qa=[];for(const t of ['events','event_result','event_live','profile','home_invite_in','toast','arrived','room'])__net.on(t,m=>__qa.push({t,...m}));}")
    await p.wait_for_timeout(1500)
    return c, p, errors


async def shot(p, name):
    await p.evaluate('()=>__stage.render()'); await p.wait_for_timeout(250)
    await p.screenshot(path=str(OUT / f'{name}.jpg'), type='jpeg', quality=70)


async def travel(p, to):
    if await p.evaluate('()=>__G.state.place') == to:
        return
    await p.evaluate(f"()=>__net.send({{t:'travel',to:'{to}',mode:'trotro'}})")
    await p.wait_for_function(f"()=>__G.state.place==='{to}'&&!!__world?.me", timeout=240000)
    await p.wait_for_timeout(1500)


async def main():
    # E1: admin scheduling over HTTP
    status, r = admin('POST', {'op': 'create', 'spec': {}}, key='wrong-key')
    check(status == 403, 'admin API refuses requests without the admin key')
    spec = {'kind': 'meetup', 'title': 'Jamestown evening meetup', 'description': 'Meet neighbours by the lighthouse.', 'venue': 'n:jtown',
            'startsAt': int(time.time() * 1000) - 20000, 'minutes': 45, 'capacity': 10}
    status, r = admin('POST', {'op': 'create', 'spec': spec})
    check(status == 200 and r.get('ok'), 'administrator schedules an event at a real venue ' + str(r.get('error') or ''))
    eid = r['id']
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ca, a, errs_a = await open_game(browser, 'seller')
        sid_a = FIX['seller']['id']
        # E2: discover, RSVP, attend
        await a.evaluate("()=>__act.app('events')")
        await a.wait_for_function("()=>__qa.some(m=>m.t==='events')", timeout=30000)
        await a.wait_for_timeout(35000)   # the server tick makes it live within 30 s
        await a.locator('.appwin').get_by_role('button', name='Refresh').evaluate('e=>e.click()'); await a.wait_for_timeout(1500)
        await a.locator('.appwin').get_by_role('button', name='Now', exact=True).evaluate('e=>e.click()'); await a.wait_for_timeout(500)
        check(await a.locator('.appwin').get_by_text('Jamestown evening meetup').count() >= 1, 'the player discovers the live event in the Events app')
        await shot(a, 'e1-events-now')
        await a.locator('.appwin').get_by_text('Jamestown evening meetup').first.evaluate('e=>e.click()'); await a.wait_for_timeout(800)
        await a.locator('.appwin').get_by_role('button', name='I’m going').evaluate('e=>e.click()')
        await a.wait_for_function("()=>__qa.some(m=>m.t==='event_result'&&m.ok)", timeout=30000)
        await a.wait_for_timeout(800)
        check(await a.locator('.appwin').get_by_role('button', name='Cancel my RSVP').count() == 1, 'RSVP is confirmed by the server')
        await shot(a, 'e2-event-detail')
        await a.evaluate('()=>__act.closePhone()')
        await travel(a, 'n:jtown')
        await a.wait_for_timeout(65000)
        s1 = int(sql(f"select seconds from event_attendance where event='{eid}' and acct={sid_a}") or 0)
        check(s1 >= 30, f'attendance is recorded from real presence at the venue ({s1} s)')
        await ca.close()
        await asyncio.sleep(40)
        s2 = int(sql(f"select seconds from event_attendance where event='{eid}' and acct={sid_a}") or 0)
        check(s2 <= s1 + 30, f'no attendance accrues while disconnected ({s1} → {s2} s)')
        ca, a, errs_a2 = await open_game(browser, 'seller')
        await a.wait_for_timeout(65000)
        s3 = int(sql(f"select seconds from event_attendance where event='{eid}' and acct={sid_a}") or 0)
        check(s3 > s2, f'after reconnecting, the same attendance record continues ({s2} → {s3} s)')
        await a.evaluate("()=>__act.app('events')"); await a.wait_for_timeout(2500)
        await a.locator('.appwin').get_by_role('button', name='Mine').evaluate('e=>e.click()'); await a.wait_for_timeout(500)
        check(await a.locator('.appwin').get_by_text('Jamestown evening meetup').count() >= 1, 'the RSVP persists across the disconnect')
        await shot(a, 'e3-after-reconnect')
        await a.evaluate('()=>__act.closePhone()')

        # E3: profile privacy
        cb, b, errs_b = await open_game(browser, 'friend')
        name_a, name_b = FIX['seller']['username'], FIX['friend']['username']
        await b.evaluate(f"()=>__net.send({{t:'profile',name:'{name_a}'}})")
        await b.wait_for_function("()=>__qa.some(m=>m.t==='profile')", timeout=20000)
        prof = await b.evaluate("()=>__qa.filter(m=>m.t==='profile').at(-1).p")
        check('worth' not in prof and 'place' not in prof and 'job' in prof, 'by default other players see career and reputation, not net worth or location')
        await a.evaluate("()=>__net.send({t:'profile_set',show:{worth:true},headline:'Football fan'})"); await a.wait_for_timeout(2500)
        await b.evaluate(f"()=>__net.send({{t:'profile',name:'{name_a}'}})"); await b.wait_for_timeout(2500)
        prof = await b.evaluate("()=>__qa.filter(m=>m.t==='profile').at(-1).p")
        check('worth' in prof and prof.get('headline') == 'Football fan' and 'place' not in prof, 'the owner chooses to show net worth and a headline; location stays private')

        # E4: home invitation, visit and removal
        await a.evaluate("()=>__net.send({t:'travel',to:'home',mode:'trotro'})")
        await a.wait_for_function("()=>__G.state.place==='home'&&!!__world?.me", timeout=240000); await a.wait_for_timeout(1500)
        await a.evaluate(f"()=>__act.phone('contacts','{name_b}')"); await a.wait_for_timeout(2500)
        await a.locator('.appwin').get_by_role('button', name='Invite to my home').evaluate('e=>e.click()')
        await b.wait_for_function("()=>__qa.some(m=>m.t==='home_invite_in')", timeout=20000)
        await shot(b, 'e4-invitation')
        await b.locator('.sheet').get_by_role('button', name='Go now').click()
        await b.wait_for_function(f"()=>__G.state.place==='visit:{sid_a}'&&!!__world?.me", timeout=240000)
        check(True, 'the invited guest accepts and arrives at the private home')
        await a.evaluate('()=>__act.closePhone()'); await a.wait_for_timeout(2500)
        await a.evaluate("()=>__act.app('life')"); await a.wait_for_timeout(1500)
        await a.locator('.appwin').get_by_role('button', name='Guests at home').evaluate('e=>e.click()'); await a.wait_for_timeout(1000)
        check(await a.locator('.appwin').get_by_text('@' + name_b).count() == 1, 'the host sees the guest in the home guests list')
        await shot(a, 'e5-guests')
        await a.locator('.appwin').get_by_text('@' + name_b).evaluate('e=>e.click()')
        await b.wait_for_function("()=>__G.state.place==='circle'", timeout=30000)
        check(True, 'the host can ask a guest to leave; the guest is returned to a public place')
        await b.evaluate(f"()=>__net.send({{t:'visit',name:'{name_a}',mode:'trotro'}})"); await b.wait_for_timeout(2500)
        check(await b.evaluate("()=>__G.state.place") == 'circle', 'a removed guest cannot walk straight back in')
        check(not (errs_a + errs_a2 + errs_b), 'no page errors ' + '; '.join(errs_a + errs_a2 + errs_b)[:300])
        await browser.close()
    admin('POST', {'op': 'cancel', 'id': eid, 'reason': 'QA run finished'})
    (OUT / 'journey-e.json').write_text(json.dumps({'checks': checks, 'scope': 'Loopback disposable fixtures; real server, DB and attendance tick; SwiftShader.'}, indent=1))

asyncio.run(main())
