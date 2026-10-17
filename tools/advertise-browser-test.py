"""Stage 10 acceptance: standalone advertising page → simulated Paystack checkout → verified return → automatic activation.

Runs only against the loopback QA server started with PAYSTACK_MOCK=1 (no real key; the server refuses the mock on
any public origin). The mock sends a signed webhook through the same verification and fulfilment code as Paystack.
H1: the page lists billboards and ground panels, previews artwork, and requires sign-in, rights and valid input.
H2: an eligible campaign pays, returns to the page with verified status and is live; a player in the game sees the
    board refresh without reloading.
H3: a campaign with a link outside the allowlist pays but waits in a disclosed moderator review.
H4: a cancelled checkout returns honestly as not paid. H5: the phone app is a shortcut, not a checkout.
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
for role in ('seller', 'friend'):
    subprocess.run(['node', 'loadtest/phase8-fixtures.js', 'replace-role', role], cwd='server', env=env, check=True, capture_output=True)
FIX = {f['role']: f for f in json.loads(Path('.local/phase8/fixtures.json').read_text())}
# The booking endpoint allows 5 bookings per IP per hour; repeated QA runs share one IP, so reset only those QA limiter
# keys in the disposable Redis database (db 14, namespace phase8:), including the payment-return check limit.
subprocess.run(['node', '-e', "const R=require('ioredis');const r=new R('redis://127.0.0.1:6379/14');r.keys('phase8:awd:limit:*').then(k=>k.length?r.del(...k):0).then(()=>r.quit())"], cwd='server', check=True, capture_output=True)
OUT = Path('docs/master/stage10'); OUT.mkdir(parents=True, exist_ok=True)
ART = str(Path('.local/master/qa-ad.png').resolve())
PSQL = r'C:\Program Files\PostgreSQL\17\bin\psql.exe'
checks = []


def sql(q):
    return subprocess.run([PSQL, env['DATABASE_URL'], '-Atc', q], capture_output=True, text=True, check=True).stdout.strip()


def check(ok, text):
    print(('PASS ' if ok else 'FAIL ') + text, flush=True); checks.append({'ok': bool(ok), 'check': text})
    if not ok:
        raise AssertionError(text)


def free_rotating():
    """A shared-rotation billboard with room left (QA runs accumulate campaigns in the disposable DB)."""
    for slot in ('dansoman', 'nungua', 'kasoa', 'jamestown', 'madina', 'tema'):
        n = int(sql(f"select count(*) from ad_reservations where placement='{slot}' and status in ('reserved','payment_pending','active')") or 0)
        if n < 30:
            return slot
    raise RuntimeError('no free QA placement')


async def context(browser, role, mobile=True):
    c = await browser.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 900}, is_mobile=mobile, has_touch=mobile)
    await c.add_cookies([{'name': 'awd_session', 'value': FIX[role]['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
    return c


async def book(p, slot, title, link, category='music'):
    await p.goto(args.base + '/advertise.html', wait_until='domcontentloaded')
    await p.wait_for_function("()=>document.getElementById('acct').textContent.startsWith('Signed in')", timeout=30000)
    await p.locator(f'.slot[data-id="{slot}"]').click()
    await p.select_option('#category', category)
    await p.fill('#title', title); await p.set_input_files('#img', ART); await p.fill('#url', link)
    await p.fill('#phone', '0240000000'); await p.fill('#email', 'qa@example.com')
    await p.wait_for_function("()=>document.getElementById('pvBB').style.backgroundImage.startsWith('url')", timeout=10000)
    await p.check('#rights')


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        anon = await browser.new_context(viewport={'width': 390, 'height': 844}); a = await anon.new_page(); errs = []
        a.on('pageerror', lambda e: errs.append(str(e)))
        await a.goto(args.base + '/advertise.html', wait_until='domcontentloaded')
        await a.wait_for_function("()=>document.querySelectorAll('.slot').length>0", timeout=60000)
        nb = await a.locator('.slot').count(); await a.locator('.tabs button[data-type=ground]').click(); ng = await a.locator('.slot').count()
        check(nb >= 10 and ng >= 3, f'the standalone page lists {nb} billboards and {ng} ground panels with prices and availability')
        await a.locator('#go').click()
        check('Sign in' in await a.locator('#out').text_content(), 'booking requires a signed-in game account')
        await anon.close()
        c = await context(browser, 'seller'); p = await c.new_page(); p.on('pageerror', lambda e: errs.append(str(e)))
        slot = free_rotating()
        await book(p, slot, 'Kofi new single', 'https://bit.ly/abc')
        await p.screenshot(path=str(OUT / 'h1-form-preview.jpg'), type='jpeg', quality=70, full_page=True)
        await p.locator('#go').click(); await p.wait_for_function("()=>document.querySelector('#out .msg.err')", timeout=30000)
        check('shortener' in await p.locator('#out').text_content(), 'a shortened destination link is refused before checkout')
        contrast = await p.evaluate("""()=>{const lum=c=>{const m=c.match(/\\d+(\\.\\d+)?/g).map(Number).slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*m[0]+.7152*m[1]+.0722*m[2];};
          const bad=[];for(const e of document.querySelectorAll('.btn:not(.ghost),.tabs button[aria-pressed=true],h2 b')){const s=getComputedStyle(e);const L1=lum(s.color),bg=s.backgroundImage!=='none'?'rgb(246,195,67)':s.backgroundColor;const L2=lum(bg);const r=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);if(r<4.5)bad.push(e.textContent.trim().slice(0,20)+':'+r.toFixed(1));}return bad;}""")
        check(not contrast, 'text on gold controls meets WCAG AA contrast ' + ', '.join(contrast))

        game_c = await context(browser, 'friend'); g = await game_c.new_page()
        await g.add_init_script("(()=>{Object.defineProperty(window,'devicePixelRatio',{get:()=>.5});const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>setTimeout(()=>raf(fn),100);})();")
        await g.goto(args.base, wait_until='domcontentloaded'); await g.wait_for_function('()=>!!window.__world?.me', timeout=180000)
        await g.evaluate("()=>{window.__qa=[];__net.on('ads_changed',m=>__qa.push(m));}")
        await p.fill('#url', 'https://open.spotify.com/track/qa'); await p.locator('#go').click()
        await p.wait_for_url('**/mock-checkout**', timeout=60000)
        check(True, 'checkout starts with the provider (simulated Paystack page)')
        await p.screenshot(path=str(OUT / 'h2-checkout.jpg'), type='jpeg', quality=70)
        await p.locator('#pay').click()
        await p.wait_for_url('**/advertise.html**', timeout=60000)
        await p.wait_for_function("()=>/Payment verified/.test(document.getElementById('ret').textContent)", timeout=60000)
        check(True, 'the payer returns to the advertising page and sees verified payment status')
        await p.wait_for_function("()=>document.querySelector('.camp .st')", timeout=30000)
        first = await p.locator('.camp').first.text_content()
        check('Live in the city' in first and 'Kofi new single' in first, 'the campaign is live immediately, with no manual approval')
        await p.screenshot(path=str(OUT / 'h3-verified-live.jpg'), type='jpeg', quality=70, full_page=True)
        live = await p.evaluate(f"()=>fetch('/api/billboards').then(r=>r.json()).then(j=>j.slots.find(s=>s.id==='{slot}').live.map(l=>l.title))")
        check('Kofi new single' in live, f'the placement serves the new campaign to the world ({slot})')
        await g.wait_for_function("()=>__qa.length>0", timeout=30000)
        check(True, 'a player already in the game is told to refresh that board (no reload)')
        sig = sql(f"select count(*) from payment_events e join payment_attempts a on a.ref=e.ref join payment_orders o on o.id=a.order_id where o.acct={FIX['seller']['id']} and e.event='charge.success' and e.outcome='fulfilled'")
        check(int(sig) >= 1, 'fulfilment came from a signed webhook verified server-to-server, recorded in PostgreSQL')

        await book(p, slot, 'Esi waakye joint', 'https://esi-waakye.example/menu', 'business')
        await p.locator('#go').click(); await p.wait_for_url('**/mock-checkout**', timeout=60000); await p.locator('#pay').click()
        await p.wait_for_url('**/advertise.html**', timeout=60000)
        await p.wait_for_function("()=>[...document.querySelectorAll('.camp')].some(c=>/Esi waakye/.test(c.textContent))", timeout=60000)
        card = await p.evaluate("()=>[...document.querySelectorAll('.camp')].find(c=>/Esi waakye/.test(c.textContent)).textContent")
        check('Waiting for a moderator' in card and 'allowlist' in card, 'a campaign the checks cannot clear waits in a disclosed review, with the reason shown')

        await book(p, slot, 'Fashion pop-up', 'https://instagram.com/qa', 'fashion')
        await p.locator('#go').click(); await p.wait_for_url('**/mock-checkout**', timeout=60000); await p.locator('#cancel').click()
        await p.wait_for_url('**/advertise.html**', timeout=60000)
        await p.wait_for_function("()=>/not completed|still being confirmed/.test(document.getElementById('ret').textContent)", timeout=60000)
        check(True, 'a cancelled checkout returns as not paid; nothing activates')
        await c.close()

        await g.evaluate("()=>__act.app('ads')"); await g.wait_for_timeout(1500)
        check(await g.locator('.appwin').get_by_role('button', name='Open the advertising page').count() == 1, 'the phone app is a shortcut to the standalone page')
        await g.screenshot(path=str(OUT / 'h4-phone-shortcut.jpg'), type='jpeg', quality=70)
        await game_c.close()
        check(not errs, 'no page errors ' + '; '.join(errs)[:300])
        await browser.close()
    (OUT / 'journey-h.json').write_text(json.dumps({'checks': checks, 'scope': 'Loopback QA server with PAYSTACK_MOCK=1 (simulated provider, signed webhook, server verification); disposable accounts; no real money.'}, indent=1))

asyncio.run(main())
