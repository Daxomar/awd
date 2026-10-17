"""Stage 11 acceptance (journey I): the separate admin console in a real browser against the loopback QA server.

I1: the console is a separate page; signed-out visitors see only the staff sign-in.
I2: an owner signs in and sees real overview metrics with definitions and the collection start date.
I3: the owner finds a reported player, suspends them through the confirmation dialog with a reason, and the action
    appears in the audit log; the report is closed as actioned.
I4: world, operations, payments and economy sections render live data.
I5: a support analyst sees only their sections; the server refuses payments even when requested directly.
I6: the console works at phone width without horizontal scrolling, with no page errors.
Credentials come from git-ignored fixtures and are never printed.
"""
import argparse, asyncio, json, os, subprocess, sys
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding='utf-8')
parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:8083')
args = parser.parse_args()
if urlsplit(args.base).hostname not in ('localhost', '127.0.0.1'):
    raise ValueError('Loopback QA server only')
env = {**os.environ, 'DATABASE_URL': 'postgres://awd@127.0.0.1:55432/awd_security', 'REDIS_URL': 'redis://127.0.0.1:6379/14', 'REDIS_NAMESPACE': 'phase8:'}
subprocess.run(['node', 'loadtest/admin-fixtures.js'], cwd='server', env=env, check=True, capture_output=True)
subprocess.run(['node', '-e', "const R=require('ioredis');const r=new R('redis://127.0.0.1:6379/14');r.keys('phase8:awd:limit:*').then(k=>k.length?r.del(...k):0).then(()=>r.quit())"], cwd='server', check=True, capture_output=True)
FIX = json.loads(Path('.local/master/admin-fixtures.json').read_text())
OUT = Path('docs/master/stage11'); OUT.mkdir(parents=True, exist_ok=True)
checks = []


def check(ok, text):
    print(('PASS ' if ok else 'FAIL ') + text, flush=True); checks.append({'ok': bool(ok), 'check': text})
    if not ok:
        raise AssertionError(text)


async def sign_in(p, who):
    await p.goto(args.base + '/admin.html', wait_until='domcontentloaded')
    await p.wait_for_selector('#signin:not([hidden])', timeout=30000)
    await p.fill('#user', FIX[who]['name']); await p.fill('#pass', FIX[who]['password'])
    await p.click('#signinForm button[type=submit]')
    await p.wait_for_selector('#shell:not([hidden])', timeout=30000)


async def tab(p, name):
    # A marker inside the current view proves the section was re-rendered, not just still showing the old one.
    await p.evaluate("()=>{const s=document.createElement('span');s.id='stale';s.hidden=true;document.querySelector('#view').append(s);}")
    await p.click(f'#tabs a[data-tab={name}]')
    await p.wait_for_function("()=>!document.getElementById('stale')&&!document.querySelector('#view').textContent.startsWith('Loading')", timeout=30000)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        errs = []
        c = await browser.new_context(viewport={'width': 1280, 'height': 900})
        p = await c.new_page(); p.on('pageerror', lambda e: errs.append(str(e)))
        p.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Content Security Policy' in m.text else None)
        await p.goto(args.base + '/admin.html', wait_until='domcontentloaded')
        await p.wait_for_selector('#signin:not([hidden])', timeout=30000)
        check(await p.locator('#shell').is_hidden() and await p.locator('#tabs a').count() == 0, 'signed-out visitors see only the staff sign-in, on a page separate from the game')
        await p.screenshot(path=str(OUT / 'i1-signin.jpg'), type='jpeg', quality=70)

        await sign_in(p, 'owner')
        await p.wait_for_selector('.metric', timeout=30000)
        text = await p.locator('#view').text_content()
        check('Daily active' in text and 'collected since' in text and await p.locator('.metric').count() >= 12, 'the owner sees real overview metrics with definitions and the collection start date')
        await p.screenshot(path=str(OUT / 'i2-overview.jpg'), type='jpeg', quality=70, full_page=True)

        await tab(p, 'reports')
        check(FIX['target']['name'] in await p.locator('#view').text_content(), 'the open report about the target player is listed')
        await p.get_by_role('link', name=FIX['target']['name']).first.click()
        await p.wait_for_selector('text=Moderation history', timeout=30000)
        await p.get_by_role('button', name='Suspend').click()
        await p.fill('#cFields input[name=hours]', '6'); await p.fill('#cFields textarea[name=reason]', 'Spam links in city chat after a warning (QA)')
        await p.screenshot(path=str(OUT / 'i3-suspend-dialog.jpg'), type='jpeg', quality=70)
        await p.click('#cGo')
        await p.wait_for_function("()=>/Done/.test(document.querySelector('#view .msg')?.textContent||'')", timeout=30000)
        await p.wait_for_selector('text=suspended until', timeout=30000)
        check(True, 'the owner suspends the player through the confirmation dialog with a reason')
        await p.screenshot(path=str(OUT / 'i3-player-suspended.jpg'), type='jpeg', quality=70, full_page=True)

        await tab(p, 'reports')
        await p.get_by_role('button', name='Actioned').first.click()
        await p.fill('#cFields textarea[name=reason]', 'Player suspended for six hours'); await p.click('#cGo')
        await p.wait_for_function("()=>/Done/.test(document.querySelector('#view .msg')?.textContent||'')", timeout=30000)
        check(True, 'the report is closed as actioned with a recorded reason')

        await tab(p, 'audit')
        audit = await p.locator('#view').text_content()
        check('moderation.suspend' in audit and 'Spam links in city chat' in audit and 'reports.resolve' in audit, 'the suspension and the report decision appear in the audit log with the reason')
        await p.screenshot(path=str(OUT / 'i3-audit.jpg'), type='jpeg', quality=70, full_page=True)

        for name, needle in (('world', 'Feature flags'), ('ops', 'Event-loop delay'), ('payments', 'Payment provider'), ('economy', 'Ledger reconciliation'), ('ads', 'Placements')):
            await tab(p, name)
            check(needle in await p.locator('#view').text_content(), f'the {name} section renders live data')
            await p.screenshot(path=str(OUT / f'i4-{name}.jpg'), type='jpeg', quality=70, full_page=True)
        await p.get_by_role('button', name='Sign out').click()
        await p.wait_for_selector('#signin:not([hidden])', timeout=30000)
        check(await (await p.request.get(args.base + '/api/admin/overview')).json() == {'error': 'Sign in to the admin dashboard.'}, 'signing out ends the server session')
        await c.close()

        m = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        q = await m.new_page(); q.on('pageerror', lambda e: errs.append(str(e)))
        await sign_in(q, 'support')
        tabs = await q.locator('#tabs a').all_text_contents()
        check('Payments' not in tabs and 'Audit log' not in tabs and 'Administrators' not in tabs and 'Players' in tabs, 'a support analyst sees only their sections: ' + ', '.join(tabs))
        status = await q.evaluate("()=>fetch('/api/admin/payments').then(r=>r.status)")
        check(status == 403, 'the server refuses payments to a support analyst even when requested directly')
        await q.goto(args.base + '/admin.html#payments'); await q.wait_for_selector('#shell:not([hidden])', timeout=30000)
        await q.wait_for_selector('.metric', timeout=30000)
        check('Overview' in await q.locator('#view h1').text_content(), 'a hidden section in the address bar falls back to an allowed one')
        await tab(q, 'players')
        wide = await q.evaluate('()=>document.scrollingElement.scrollWidth')
        check(wide <= 390, f'the console fits phone width without horizontal page scrolling ({wide}px)')
        await q.screenshot(path=str(OUT / 'i5-support-mobile.jpg'), type='jpeg', quality=70, full_page=True)
        await m.close()
        check(not errs, 'no page errors or Content Security Policy violations ' + '; '.join(errs)[:300])
        await browser.close()
    (OUT / 'journey-i.json').write_text(json.dumps({'checks': checks, 'scope': 'Loopback QA server; disposable staff and player accounts; desktop and phone-width Chromium.'}, indent=1))

asyncio.run(main())
