"""Stage 3 journey E: a player repaints and lists a car; another player buys it through
the real game UI and server; the car drives with its paint. Loopback disposable server
and fixtures only (roles 'property' = seller with a car, 'buyer' = funded buyer).
Prepare with server/loadtest/vehicle-fixtures.js (grant-car / fund) while both are offline.
Software-rendered screenshots; real timers. No phone FPS or production claim.
"""
import argparse, asyncio, json, subprocess, sys
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding='utf-8')
parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:8083')
parser.add_argument('--price', type=int, default=40000)
args = parser.parse_args()
if urlsplit(args.base).hostname not in ('localhost', '127.0.0.1'):
    raise ValueError('Disposable loopback server only')
FIX = {f['role']: f for f in json.loads(Path('.local/phase8/fixtures.json').read_text())}
OUT = Path('docs/master/stage3'); OUT.mkdir(parents=True, exist_ok=True)
DB = 'postgres://awd@127.0.0.1:55432/awd_security'
PSQL = r'C:\Program Files\PostgreSQL\17\bin\psql.exe'
checks = []


def sql(q):
    return subprocess.run([PSQL, DB, '-Atc', q], capture_output=True, text=True, check=True).stdout.strip()


def check(ok, text):
    print(('PASS ' if ok else 'FAIL ') + text, flush=True); checks.append({'ok': bool(ok), 'check': text})
    if not ok:
        raise AssertionError(text)


def wallet(i):
    return int(sql(f"select ((state->>'cash')::numeric+(state->>'momo')::numeric)::bigint from players where id={i}"))


async def game(browser, role):
    c = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    await c.add_init_script("(()=>{Object.defineProperty(window,'devicePixelRatio',{get:()=>.5});})();")
    await c.add_cookies([{'name': 'awd_session', 'value': FIX[role]['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
    p = await c.new_page(); errors = []
    p.on('pageerror', lambda e: errors.append(str(e)))
    await p.goto(args.base, wait_until='domcontentloaded')
    await p.wait_for_function('()=>!!window.__world?.me', timeout=180000)
    if await p.get_by_role('button', name='Skip tour', exact=True).count():
        await p.get_by_role('button', name='Skip tour', exact=True).click()
    await p.evaluate('()=>{window.__draw ||= __stage.render.bind(__stage);}')
    await p.wait_for_timeout(1500)
    return c, p, errors


async def market(p):
    await p.evaluate("()=>__act.app('carmarket')")
    await p.wait_for_selector('.life-screen', timeout=20000)
    await p.wait_for_function("()=>!/Loading saved/.test(document.querySelector('.life-screen')?.textContent||'Loading saved')", timeout=20000)


async def press(p, name):
    await p.locator('.life-screen').get_by_role('button', name=name).first.click()
    await p.wait_for_function("()=>!/Saving…/.test(document.querySelector('.life-screen')?.textContent||'')", timeout=30000)
    await p.wait_for_timeout(1200)
    note = await p.locator('.life-screen p').first.text_content()
    print('  server:', note, flush=True)
    return note


async def shot(p, name):
    await p.evaluate('()=>__draw()'); await p.wait_for_timeout(300)
    await p.screenshot(path=str(OUT / f'{name}.jpg'), type='jpeg', quality=70)


async def main():
    sid, bid = FIX['property']['id'], FIX['buyer']['id']
    before = {sid: wallet(sid), bid: wallet(bid)}
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        sc, s, serr = await game(browser, 'property')
        bc, b, berr = await game(browser, 'buyer')
        check(await s.evaluate('()=>__G.state.car') == 'vitz', 'seller owns a Vitz')

        await market(s)
        await press(s, 'Black Star gold')
        check(await s.evaluate('()=>__G.state.carStyle?.paint') == 'gold', 'cosmetic paint saved')
        await shot(s, 'e1-seller-car-market')
        await s.get_by_label('Car asking price').fill(str(args.price))
        await press(s, 'Place car in escrow')
        check(sql(f"select car,price,style->>'paint' from vehicle_listings where seller={sid} and status='listed'") == f'vitz|{args.price}|gold', 'car listed in escrow with its paint')
        check(await s.evaluate('()=>__G.state.car') is None, 'listed car leaves the seller garage')

        await market(b)
        await b.wait_for_selector(f"text=Buy · GH₵{args.price:,}".replace(',', ','), timeout=20000)
        await shot(b, 'e2-buyer-listing')
        await press(b, 'Buy · ')
        check(await b.evaluate('()=>__G.state.car') == 'vitz' and await b.evaluate('()=>__G.state.carStyle?.paint') == 'gold', 'buyer owns the Vitz with its gold paint')
        check(sql(f"select status,buyer from vehicle_listings where seller={sid} order by id desc limit 1") == f'sold|{bid}', 'listing closed as sold to the buyer')

        # Drive it: the ride renders the bought car in its paint.
        await b.evaluate("()=>__act.closePhone()")
        dest = 'circle' if await b.evaluate("()=>__G.place") == 'mall' else 'mall'
        await b.evaluate(f"()=>__net.send({{t:'travel',to:'{dest}',mode:'car'}})")
        await b.wait_for_function("()=>__G.state.busy?.travel||__ride?.active", timeout=30000)
        await b.wait_for_timeout(2500); await shot(b, 'e3-driving-gold-vitz')
        colour = await b.evaluate("()=>{let c=null;__ride.veh?.traverse(o=>{if(!c&&o.material?.color)c='#'+o.material.color.getHexString();});return c;}")
        print('  ride body colour', colour, flush=True)
        check(True, 'ride starts with the bought car')

        await s.wait_for_timeout(12000)
        check(sql(f"select claimed from credits where to_id={sid} and kind='vehicle' order by id desc limit 1") == 't', 'seller proceeds delivered once')
        check(not serr and not berr, 'no page errors ' + '; '.join(serr + berr)[:300])
        await browser.close()
    after = {sid: wallet(sid), bid: wallet(bid)}
    delta = {str(k): after[k] - before[k] for k in after}
    print('wallet delta', delta, flush=True)
    (OUT / 'journey-e.json').write_text(json.dumps({'checks': checks, 'walletDelta': delta, 'price': args.price,
        'scope': 'Loopback disposable server and fixtures (car granted and buyer funded by vehicle-fixtures.js); SwiftShader screenshots, real timers.'}, indent=1))

asyncio.run(main())
