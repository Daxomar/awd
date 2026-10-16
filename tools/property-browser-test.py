"""Stage 2 journey D: two authenticated players inspect, buy, tour, furnish, renovate,
list and resell one finite property unit through the real game UI and server.

Loopback disposable server and fixtures only (.local/phase8/fixtures.json, roles
'property' = seller and 'buyer'). The unit needs an explicit QA test price first:
    node server/loadtest/property-fixtures.js price-unit awd-nima-01 5000
Software rendering is sampled for screenshots; journey timers are real.
"""
import argparse, asyncio, json, subprocess, sys
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding='utf-8')
parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:8083')
parser.add_argument('--unit', default='awd-nima-01')
parser.add_argument('--price', type=int, default=6000)
args = parser.parse_args()
if urlsplit(args.base).hostname not in ('localhost', '127.0.0.1'):
    raise ValueError('Disposable loopback server only')
FIX = {f['role']: f for f in json.loads(Path('.local/phase8/fixtures.json').read_text())}
OUT = Path('docs/master/stage2'); OUT.mkdir(parents=True, exist_ok=True)
DB = 'postgres://awd@127.0.0.1:55432/awd_security'
PSQL = r'C:\Program Files\PostgreSQL\17\bin\psql.exe'
checks = []


def sql(query):
    return subprocess.run([PSQL, DB, '-Atc', query], capture_output=True, text=True, check=True).stdout.strip()


def check(ok, text):
    print(('PASS ' if ok else 'FAIL ') + text, flush=True)
    checks.append({'ok': bool(ok), 'check': text})
    if not ok:
        raise AssertionError(text)


def wallets(ids):
    rows = sql(f"select id,((state->>'cash')::numeric+(state->>'momo')::numeric)::bigint from players where id in ({ids[0]},{ids[1]})")
    return {int(r.split('|')[0]): int(r.split('|')[1]) for r in rows.splitlines()}


async def ready(p):
    await p.wait_for_function('()=>!!window.__stage', timeout=180000)
    await p.evaluate('()=>{__stage.renderer.setPixelRatio(.5);window.__draw ||= __stage.render.bind(__stage);}')
    await p.wait_for_function('()=>!!window.__world?.me', timeout=120000)
    if await p.get_by_role('button', name='Skip tour', exact=True).count():
        await p.get_by_role('button', name='Skip tour', exact=True).click()
    await p.wait_for_timeout(1500)


async def game(browser, role):
    c = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    await c.add_init_script("(()=>{Object.defineProperty(window,'devicePixelRatio',{get:()=>.5});})();")
    await c.add_cookies([{'name': 'awd_session', 'value': FIX[role]['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
    p = await c.new_page(); errors = []
    p.on('pageerror', lambda e: errors.append(str(e)))
    await p.goto(args.base, wait_until='domcontentloaded'); await ready(p)
    return c, p, errors


async def property_app(p, unit=None):
    await p.evaluate("u=>__act.phone('properties',u?{unit:u}:undefined)", unit)
    await p.wait_for_selector('.property-screen', timeout=20000)
    await p.wait_for_function("()=>!/Loading/.test(document.querySelector('.property-screen')?.textContent||'Loading')", timeout=20000)


async def confirm(p, button_name):
    await p.locator('.property-screen').get_by_role('button', name=button_name).first.click()
    await p.get_by_role('button', name='Confirm property action').click()
    # A verified journey closes the phone (the ride takes over), so no note remains.
    await p.wait_for_function("()=>{const scr=document.querySelector('.property-screen');if(!scr||!scr.offsetParent)return true;const t=document.querySelector('.property-note')?.textContent||'';return t&&!/Waiting for the server/.test(t);}", timeout=30000)
    visible = await p.evaluate("()=>!!document.querySelector('.property-note')?.offsetParent")
    note = await p.locator('.property-note').text_content() if visible else 'journey started (phone closed for the ride)'
    if not ('Travel' in button_name or 'tour' in button_name) and not visible:
        raise AssertionError('no confirmation for ' + button_name)
    print('  server:', note, flush=True)
    return note


async def shot(p, name):
    await p.evaluate('()=>__draw()'); await p.wait_for_timeout(300)
    await p.screenshot(path=str(OUT / f'{name}.jpg'), type='jpeg', quality=70)


async def arrive(p, unit, timeout=300000):
    await p.wait_for_function(f"()=>__G.place==='unit:{unit}'&&!!__world?.me", timeout=timeout)
    await p.wait_for_timeout(2500)


async def main():
    seller_id, buyer_id = FIX['property']['id'], FIX['buyer']['id']
    before = wallets((seller_id, buyer_id))
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        sc, s, serr = await game(browser, 'property')
        bc, b, berr = await game(browser, 'buyer')

        # Inspect and buy the catalogue unit (seller account).
        await property_app(s, args.unit)
        await s.wait_for_selector('.property-card dl', timeout=20000); await shot(s, 'd1-inspection')
        detail = await s.locator('.property-screen').text_content()
        check('Catalogue/base price' in detail and 'Estimated value' in detail and 'Owner status' in detail, 'inspection shows location, class, base, estimate and status')
        if sql(f"select owner from world_properties where id='{args.unit}'") != str(seller_id):
            await confirm(s, 'Buy ')
        check(sql(f"select owner from world_properties where id='{args.unit}'") == str(seller_id), 'catalogue purchase sets one SQL owner')

        already_listed = sql(f"select count(*) from property_listings where unit='{args.unit}' and status='listed'") == '1'
        if not already_listed:
            # Travel into the unit with the real fare and timer.
            if not await s.evaluate(f"()=>__G.place==='unit:{args.unit}'"):
                await property_app(s, args.unit)
                await s.locator('select[aria-label="Property travel mode"]').select_option('taxi')
                await confirm(s, 'Travel to unit')
            await arrive(s, args.unit)
            room = await s.evaluate('()=>({key:__G.room,unit:__G.unitRoom})')
            check(room['key'].startswith(f"prop:{args.unit}@") and room['unit']['mine'] and room['unit']['canAct'], 'owner enters the authorized unit room with owner actions')
            await s.evaluate('()=>__act.closePhone()'); await shot(s, 'd2-empty-unit')

            # Furnish two unique assets and apply a cosmetic finish; the room updates in place.
            for name in ('Install Orthopedic mattress', 'Install Flat-screen TV', 'Coastal blue'):
                await property_app(s, args.unit); await confirm(s, name)
            check(sql(f"select count(*) from property_furnishings where unit='{args.unit}' and owner={seller_id}") == '2', 'two unique furnishing assets installed')
            await s.evaluate('()=>__act.closePhone()')
            await s.wait_for_function("()=>__G.unitRoom?.items?.bed&&__G.unitRoom.items.tv&&__G.unitRoom.theme==='coastal'", timeout=30000)
            await s.wait_for_timeout(2000); await shot(s, 'd3-furnished-coastal')
            check(True, 'room re-renders with the new furniture and finish without a reload')

            # Owner-only activity inside the unit uses the unit's own furniture.
            await s.evaluate("()=>__act.lifeAction('property_home_act',{unit:__G.place.slice(5),action:'nap'})")
            await s.wait_for_function("()=>__G.state.busy?.id==='nap'", timeout=20000)
            check(True, 'owner starts a home activity inside the unit')
            await s.evaluate("()=>__net.send({t:'cancel'})")
            await s.wait_for_function("()=>!__G.state.busy", timeout=20000)

            # Walk out through the property door, then list furnished.
            zone = await s.evaluate("()=>__world.spec.zones.find(z=>z.route==='property-exit')")
            await s.evaluate("z=>__act.route(z)", zone)
            await s.wait_for_function(f"()=>__G.state.place&&__G.state.place!=='unit:{args.unit}'", timeout=180000)
            check(True, 'property door walks the owner back to the neighbourhood')
            if sql(f"select count(*) from property_listings where unit='{args.unit}' and status='listed'") == '0':
                await property_app(s, args.unit)
                await s.get_by_label('Property asking price').fill(str(args.price))
                await confirm(s, 'Review property listing')
            check(sql(f"select price,furnished,cardinality(included) from property_listings where unit='{args.unit}' and status='listed'") == f'{args.price}|t|2', 'furnished listing snapshots both asset IDs')

        else:
            print('  resuming: seller steps already completed and listed', flush=True)
        # Buyer discovers and tours the listing, then buys it.
        await property_app(b, args.unit)
        await b.wait_for_selector('text=Current listing', timeout=20000); await shot(b, 'd4-buyer-listing')
        if not await b.evaluate(f"()=>__G.place==='unit:{args.unit}'"):
            await b.locator('select[aria-label="Property travel mode"]').select_option('taxi')
            await confirm(b, 'Start timed property tour')
        await arrive(b, args.unit)
        tour = await b.evaluate('()=>__G.unitRoom')
        check(not tour['mine'] and not tour['canAct'] and not tour['canFurnish'], 'tour shows the room without owner activities or furnishing')
        await b.evaluate('()=>__act.closePhone()'); await shot(b, 'd5-buyer-tour')
        await property_app(b, args.unit)
        await confirm(b, 'Buy ')
        check(sql(f"select owner,last_sale_price from world_properties where id='{args.unit}'") == f'{buyer_id}|{args.price}', 'resale transfers ownership at the actual transaction price')
        check(sql(f"select string_agg(distinct owner::text,',') from property_furnishings where unit='{args.unit}'") == str(buyer_id), 'included furnishings transfer once to the buyer')
        await b.wait_for_function("()=>__G.unitRoom?.mine&&__G.unitRoom.canAct", timeout=30000)
        await b.evaluate('()=>__act.closePhone()'); await b.wait_for_timeout(1500); await shot(b, 'd6-new-owner')

        # Seller cannot re-enter; buyer ownership survives a reload.
        await property_app(s, args.unit)
        text = await s.locator('.property-screen').text_content()
        check('Travel to unit' not in text and 'Start timed property tour' not in text, 'former owner loses entry after the sale')
        await b.reload(wait_until='domcontentloaded'); await ready(b)
        await b.wait_for_function(f"()=>__G.place==='unit:{args.unit}'&&__G.unitRoom?.mine", timeout=60000)
        check(True, 'buyer reloads inside the unit with ownership intact')
        await s.wait_for_timeout(12000)   # seller credit claim runs on the slow tick
        credit = sql(f"select c.claimed from property_listings l join credits c on c.id=l.credit where l.unit='{args.unit}' and l.status='sold'")
        check(credit == 't', 'seller proceeds were delivered exactly once as a durable credit')
        check(not serr and not berr, 'no page errors ' + '; '.join(serr + berr)[:300])
        await browser.close()
    after = wallets((seller_id, buyer_id))
    print('wallet delta', {k: after[k] - before[k] for k in after}, flush=True)
    (OUT / 'journey-d.json').write_text(json.dumps({'checks': checks, 'unit': args.unit, 'testPrice': args.price,
        'walletDelta': {str(k): after[k] - before[k] for k in after},
        'scope': 'Loopback disposable server and fixtures; explicit QA test price; SwiftShader screenshots, real timers. No phone FPS or production claim.'}, indent=1))

asyncio.run(main())
