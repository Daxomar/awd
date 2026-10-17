"""Stage 8 acceptance on the real game UI and server (loopback disposable fixtures).

Events are offered at random in normal play, so this journey places a specific open event in the disposable
QA database while the player is offline (p8 fixture accounts only), then checks the real client and server:
F1: an open robbery survives a disconnect, is shown on reconnect, and a decision only touches capped pocket cash.
F2: an unanswered event that expired while offline resolves neutrally — no money changes.
F3: a friend-loan decision moves money once, schedules a repayment, and both persist across a reload.
SwiftShader; real timers; no phone FPS claim.
"""
import argparse, asyncio, json, os, subprocess, sys, time
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
subprocess.run(['node', 'loadtest/phase8-fixtures.js', 'replace-role', 'seller'], cwd='server', env=env, check=True, capture_output=True)
FIX = {f['role']: f for f in json.loads(Path('.local/phase8/fixtures.json').read_text())}
OUT = Path('docs/master/stage8'); OUT.mkdir(parents=True, exist_ok=True)
PSQL = r'C:\Program Files\PostgreSQL\17\bin\psql.exe'
SID = FIX['seller']['id']
checks = []


def sql(q):
    return subprocess.run([PSQL, env['DATABASE_URL'], '-Atc', q], capture_output=True, text=True, check=True).stdout.strip()


def check(ok, text):
    print(('PASS ' if ok else 'FAIL ') + text, flush=True); checks.append({'ok': bool(ok), 'check': text})
    if not ok:
        raise AssertionError(text)


def put_event(active):
    """Disposable QA fixture only: write an open event into an offline p8 account."""
    doc = {'active': active, 'history': [], 'cooldowns': {}, 'pending': [], 'lastAt': 0, 'checkAt': int(time.time() * 1000) + 3600000, 'today': 0, 'dayKey': -1}
    payload = json.dumps(doc).replace("'", "''")
    sql(f"update players set state=jsonb_set(state,'{{lifeEvents}}','{payload}'::jsonb) where id={SID} and exists(select 1 from accounts where id={SID} and username like 'p8%')")


def wallet():
    return [int(float(x)) for x in sql(f"select state->>'cash', state->>'momo' from players where id={SID}").split('|')]


async def open_game(browser):
    c = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    await c.add_init_script("(()=>{Object.defineProperty(window,'devicePixelRatio',{get:()=>.5});const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>setTimeout(()=>raf(fn),75);})();")
    await c.add_cookies([{'name': 'awd_session', 'value': FIX['seller']['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
    p = await c.new_page(); errors = []
    p.on('pageerror', lambda e: errors.append(str(e)))
    await p.goto(args.base, wait_until='domcontentloaded')
    await p.wait_for_function('()=>!!window.__world?.me', timeout=180000)
    for n in ('Skip tour', 'Skip'):
        if await p.get_by_role('button', name=n, exact=True).count():
            await p.get_by_role('button', name=n, exact=True).click()
    await p.evaluate("()=>{window.__qa=[];for(const t of ['life_event_result','toast'])__net.on(t,m=>__qa.push({t,...m}));}")
    await p.wait_for_timeout(2500)
    return c, p, errors


async def shot(p, name):
    await p.evaluate('()=>__stage.render()'); await p.wait_for_timeout(250)
    await p.screenshot(path=str(OUT / f'{name}.jpg'), type='jpeg', quality=70)


ROBBERY = {'id': 'robbery', 'title': 'Trouble on a quiet street', 'cat': 'neighbourhood', 'ctx': {}, 'place': 'n:nima',
           'text': 'Two strangers block your way on a dark stretch and demand the cash in your pocket. (Fictional game event — MoMo, savings and property are never at risk.)',
           'choices': [{'id': 'hand', 'label': 'Hand over some cash', 'hint': 'Lose part of your pocket cash, stay safe'}, {'id': 'escape', 'label': 'Try to get away', 'hint': 'Fitness helps'},
                       {'id': 'help', 'label': 'Shout for help', 'hint': 'People nearby may step in'}, {'id': 'talk', 'label': 'Talk your way out', 'hint': 'Charisma helps'}]}


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        now = int(time.time() * 1000)
        # F1: an open event survives disconnect; the decision only touches capped pocket cash.
        sql(f"update players set state=jsonb_set(state,'{{cash}}','300') where id={SID}")
        put_event({**ROBBERY, 'at': now, 'expires': now + 20 * 60000})
        cash0, momo0 = wallet()
        c, p, e1 = await open_game(browser)
        chip = p.locator('.life-chip')
        await p.wait_for_function("()=>!document.querySelector('.life-chip')?.hidden", timeout=20000)
        check('Trouble on a quiet street' in await chip.text_content(), 'an event that opened before the disconnect waits on the HUD after reconnecting')
        await shot(p, 'f0-hud-reminder')
        await chip.click(); await p.wait_for_timeout(800)
        await shot(p, 'f1-event-sheet')
        body = await p.locator('.life-event').first.text_content()
        check('Ignoring this is safe' in body and 'never MoMo' in body, 'the sheet explains the fair-play rules')
        await p.locator('.life-event-choices').get_by_role('button', name='Hand over some cash').click()
        await p.wait_for_function("()=>__qa.some(m=>m.t==='life_event_result')", timeout=30000)
        await p.wait_for_timeout(600)
        await shot(p, 'f2-result')
        await c.close(); await asyncio.sleep(4)
        cash1, momo1 = wallet()
        check(momo1 == momo0 and 0 < cash0 - cash1 <= 150, f'only pocket cash changed, within the cap (cash {cash0}→{cash1}, MoMo unchanged)')
        hist = json.loads(sql(f"select state->'lifeEvents'->'history' from players where id={SID}"))
        check(hist and hist[0]['id'] == 'robbery' and hist[0]['choice'] == 'hand', 'the decision is saved in the life history')
        calm = int(sql(f"select state->'lifeEvents'->>'calmUntil' from players where id={SID}") or 0)
        check(calm > now, 'a calm period follows the loss')

        # F2: expired while offline → neutral.
        put_event({**ROBBERY, 'at': now - 3600000, 'expires': now - 60000})
        cash2, momo2 = wallet()
        c, p, e2 = await open_game(browser)
        await p.wait_for_timeout(4000)
        check(await p.locator('.life-chip').is_hidden(), 'an expired event is not shown as a pending decision')
        await c.close(); await asyncio.sleep(4)
        cash3, momo3 = wallet()
        hist = json.loads(sql(f"select state->'lifeEvents'->'history' from players where id={SID}"))
        check(cash3 == cash2 and momo3 == momo2 and hist[0]['choice'] == 'expired', 'an event left unanswered while offline ends neutrally with no loss')

        # F3: friend loan: money once, repayment scheduled, both persist.
        sql(f"update players set state=jsonb_set(state,'{{friends}}','{{\"999999\":{{\"accepted\":true,\"n\":\"kofi\",\"pts\":30}}}}') where id={SID}")
        loan = {'id': 'friend_loan', 'title': 'A friend needs help', 'cat': 'social', 'at': now, 'expires': now + 20 * 60000, 'place': 'circle',
                'text': '@kofi is short this week and asks to borrow GH₵50, promising to pay you back tomorrow.', 'ctx': {'friend': 999999, 'name': 'kofi', 'amount': 50},
                'choices': [{'id': 'lend', 'label': 'Lend the money', 'hint': 'Repaid automatically in 24 hours'}, {'id': 'advise', 'label': 'Help them budget instead', 'hint': 'Charisma'}, {'id': 'no', 'label': 'Say no kindly', 'hint': 'No cost'}]}
        put_event(loan)
        w0 = sum(wallet())
        c, p, e3 = await open_game(browser)
        await p.evaluate('()=>__act.lifeEvent()'); await p.wait_for_timeout(800)
        await p.locator('.life-event-choices').get_by_role('button', name='Lend the money').click()
        await p.wait_for_function("()=>__qa.some(m=>m.t==='life_event_result')", timeout=30000)
        await p.evaluate("()=>document.querySelectorAll('.sheet-x').forEach(b=>b.click())"); await p.wait_for_timeout(500)
        await p.evaluate("()=>__act.app('life')"); await p.wait_for_timeout(1500)
        await shot(p, 'f3-life-history')
        check(await p.locator('.appwin').get_by_text('Recent life events').count() == 1, 'My Life lists recent life events')
        await c.close(); await asyncio.sleep(4)
        pending = json.loads(sql(f"select state->'lifeEvents'->'pending' from players where id={SID}"))
        check(sum(wallet()) == w0 - 50 and len(pending) == 1 and pending[0]['amount'] == 50, 'the loan moved GH₵50 once and the repayment is scheduled and saved')
        check(not (e1 + e2 + e3), 'no page errors ' + '; '.join(e1 + e2 + e3)[:300])
        await browser.close()
    (OUT / 'journey-f.json').write_text(json.dumps({'checks': checks, 'scope': 'Loopback disposable fixtures; open events placed in the disposable DB while offline; real server; SwiftShader.'}, indent=1))

asyncio.run(main())
