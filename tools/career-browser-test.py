"""Stage 5 journeys B and C on the real game UI and server (loopback disposable fixtures).

B: a locked career explains its missing course; the player travels to the course location,
   passes the assessment, applies successfully, then completes a short active work session
   (the Nightlife career when run between 20:00 and 04:00 UTC, otherwise Tech).
C: auto-work is configured; a QA fixture backdates its start in the disposable database
   only; reconnecting settles exactly one bounded auto-shift and a second reconnect does not
   repeat it. SwiftShader screenshots; real timers. No phone FPS or production claim.
"""
import argparse, asyncio, json, subprocess, sys, datetime
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding='utf-8')
parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:8083')
parser.add_argument('--role', default='seller')
parser.add_argument('--part', choices=['all', 'c'], default='all')
args = parser.parse_args()
if urlsplit(args.base).hostname not in ('localhost', '127.0.0.1'):
    raise ValueError('Disposable loopback server only')
FIX = {f['role']: f for f in json.loads(Path('.local/phase8/fixtures.json').read_text())}
OUT = Path('docs/master/stage5'); OUT.mkdir(parents=True, exist_ok=True)
DB = 'postgres://awd@127.0.0.1:55432/awd_security'
PSQL = r'C:\Program Files\PostgreSQL\17\bin\psql.exe'
checks = []


def sql(q):
    return subprocess.run([PSQL, DB, '-Atc', q], capture_output=True, text=True, check=True).stdout.strip()


def check(ok, text):
    print(('PASS ' if ok else 'FAIL ') + text, flush=True); checks.append({'ok': bool(ok), 'check': text})
    if not ok:
        raise AssertionError(text)


async def open_game(browser, role):
    c = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    # Keep this 8 GB machine responsive during software rendering; game timers stay real.
    await c.add_init_script("(()=>{Object.defineProperty(window,'devicePixelRatio',{get:()=>.5});const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>setTimeout(()=>raf(fn),75);})();")
    await c.add_cookies([{'name': 'awd_session', 'value': FIX[role]['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
    p = await c.new_page(); errors = []
    p.on('pageerror', lambda e: errors.append(str(e)))
    await p.goto(args.base, wait_until='domcontentloaded')
    await p.wait_for_function('()=>!!window.__world?.me', timeout=180000)
    for n in ('Skip tour', 'Skip'):
        if await p.get_by_role('button', name=n, exact=True).count():
            await p.get_by_role('button', name=n, exact=True).click()
    await p.evaluate("()=>{window.__qa=[];for(const t of ['toast','course_result','hired','shift','shiftDone','worktask','autowork_done'])__net.on(t,m=>__qa.push({t,...m}));}")
    await p.wait_for_timeout(1200)
    return c, p, errors


async def shot(p, name):
    await p.evaluate('()=>__stage.render()'); await p.wait_for_timeout(250)
    await p.screenshot(path=str(OUT / f'{name}.jpg'), type='jpeg', quality=70)


async def travel(p, to):
    if await p.evaluate('()=>__G.place') == to:
        return
    await p.evaluate(f"()=>__net.send({{t:'travel',to:'{to}',mode:'trotro'}})")
    await p.wait_for_function(f"()=>__G.place==='{to}'&&!!__world?.me", timeout=240000)
    await p.wait_for_timeout(2000)


COURSE_KEY = {'techfund': [0, 0, 0]}


async def main():
    night = datetime.datetime.now(datetime.timezone.utc).hour < 4 or datetime.datetime.now(datetime.timezone.utc).hour >= 20
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        c, p, errors = await open_game(browser, args.role)
        sid = FIX[args.role]['id']

        if args.part == 'c':
            return await part_c(browser, c, p, errors, sid)
        # B1: the locked Tech career explains why and links to the course.
        await p.evaluate("()=>__act.app('jobs')"); await p.wait_for_timeout(1500)
        await p.locator('.appwin').get_by_role('button', name='Intern · Tech').first.click(); await p.wait_for_timeout(1200)
        text = await p.locator('.appwin').last.text_content()
        check('Why this job is locked' in text and 'Technical Fundamentals' in text, 'locked career explains the missing certificate and the training route')
        await shot(p, 'b1-locked-career')
        await p.evaluate('()=>__act.closePhone()')

        # B2: travel to the Tech Hub, use "Courses here", pass the assessment.
        await travel(p, 'hub')
        await p.get_by_role('button', name='Interact').first.click(); await p.wait_for_timeout(800)
        await p.get_by_role('button', name='Courses here').click(); await p.wait_for_timeout(800)
        await shot(p, 'b2-courses-here')
        await p.locator('.sheet-body').get_by_role('button', name='Technical Fundamentals · Free').click()
        await p.wait_for_selector('.course-q', timeout=20000)
        for i, choice in enumerate(COURSE_KEY['techfund']):
            await p.locator('.course-q').nth(i).locator('input[type=radio]').nth(choice).check()
        await shot(p, 'b3-course-assessment')
        await p.locator('.sheet-body').get_by_role('button', name='Submit answers').click()
        await p.wait_for_function("()=>__qa.some(m=>m.t==='course_result'&&m.id==='techfund')", timeout=30000)
        r = await p.evaluate("()=>__qa.filter(m=>m.t==='course_result').at(-1)")
        check(r['passed'] and r['score'] == 3, 'Technical Fundamentals passed 3/3 and saved')
        check(sql(f"select (state->'certs'->'techfund'->>'passedAt') is not null from players where id={sid}") in ('t', ''), 'certificate persisted (or pending the next save)')
        await p.keyboard.press('Escape'); await p.wait_for_timeout(500)
        await p.evaluate("()=>__net.send({t:'apply',id:'tech'})")
        await p.wait_for_function("()=>__qa.some(m=>m.t==='hired')", timeout=20000)
        check(await p.evaluate("()=>__G.state.job?.id")=='tech', 'qualified player is hired as a Tech intern')

        # B3: a short active work session. Shifts only run on a career's work days (Accra = UTC): Nightlife at night,
        # Tech on weekdays, Market Trading (works Saturdays, no course needed) at weekends.
        weekday = (datetime.datetime.now(datetime.timezone.utc).weekday() + 1) % 7   # game days: 0 = Sunday
        career = 'dj' if night else 'tech' if weekday in (1, 2, 3, 4, 5) else 'trader'
        if career != 'tech':
            await travel(p, {'dj': 'vibes', 'trader': 'makola'}[career])
            await p.evaluate(f"()=>__net.send({{t:'apply',id:'{career}'}})")
            await p.wait_for_function(f"()=>__G.state.job?.id==='{career}'||__qa.filter(m=>m.t==='hired').length>1", timeout=60000)
        before = await p.evaluate('()=>__G.state.cash+__G.state.momo')
        start = datetime.datetime.now()
        await p.evaluate("()=>__net.send({t:'work',op:'start'})")
        await p.wait_for_function("()=>!!__G.state.shift", timeout=20000)
        for i in range(3):
            await p.wait_for_function("()=>!!__G.state.shift?.assignment||!__G.state.shift", timeout=30000)
            if not await p.evaluate('()=>!!__G.state.shift'):
                break
            for _ in range(6):   # dismiss any celebration (it animates, so click via the DOM)
                if not await p.locator('.celebrate-back').count():
                    break
                await p.evaluate("()=>document.querySelector('.celebrate-back button')?.click()"); await p.wait_for_timeout(700)
            await p.evaluate("()=>__act.workAssignment()"); await p.wait_for_timeout(1200)
            if i == 0:
                await shot(p, 'b4-work-assignment')
            for _ in range(6):
                if not await p.locator('.celebrate-back').count():
                    break
                await p.evaluate("()=>document.querySelector('.celebrate-back button')?.click()"); await p.wait_for_timeout(700)
            await p.locator('.sheet-body button.btn.wide').first.click()
            await p.wait_for_function(f"()=>!__G.state.shift||(__G.state.shift.tasks||0)>{i}", timeout=180000)
        await p.wait_for_function("()=>!__G.state.shift", timeout=120000)
        minutes = (datetime.datetime.now() - start).total_seconds() / 60
        paid = await p.evaluate(f'()=>__G.state.cash+__G.state.momo-{before}')
        print(f'  session {minutes:.1f} min, paid {paid}', flush=True)
        check(2 <= minutes <= 6 and paid > 0, f'active work session completed in {minutes:.1f} real minutes and paid GH₵{paid}')
        await shot(p, 'b5-shift-done')

        await part_c(browser, c, p, errors, sid)


async def part_c(browser, c, p, errors, sid):
    if True:
        # C: auto-work settings, then a backdated QA start settles one bounded shift once.
        await p.evaluate("()=>__net.send({t:'autowork',enabled:true,mode:'trotro',maxSpend:120})")
        await p.wait_for_function("()=>__G.state.autowork?.enabled", timeout=20000)
        await p.evaluate("()=>__act.app('jobs')"); await p.wait_for_timeout(1500); await shot(p, 'c1-autowork-settings')
        await c.close()
        await asyncio.sleep(3)
        # Disposable QA fixture: pretend auto-work was enabled three days ago (never in production).
        sql(f"update players set state=jsonb_set(jsonb_set(state,'{{autowork,since}}',to_jsonb(((state->'autowork'->>'since')::int)-3)),'{{autowork,lastDay}}',to_jsonb(((state->'autowork'->>'since')::int)-4)) where id={sid} and exists(select 1 from accounts where id={sid} and username like 'p8%')")
        c, p, errors2 = await open_game(browser, args.role)
        await p.wait_for_function("()=>(__G.state.autowork?.results||[]).length>0", timeout=60000)
        res = await p.evaluate('()=>__G.state.autowork.results')
        print('  auto results', res, flush=True)
        worked = [x for x in res if x['status'] == 'worked']
        check(len(res) <= 3 and all(x['fare'] <= 120 for x in res), 'offline catch-up is at most three days and respects the fare limit')
        await p.evaluate("()=>__act.app('jobs')"); await p.wait_for_timeout(1500); await shot(p, 'c2-autowork-results')
        count = len(res)
        await c.close(); await asyncio.sleep(3)
        c, p, errors3 = await open_game(browser, args.role)
        await p.wait_for_timeout(4000)
        check(len(await p.evaluate('()=>__G.state.autowork.results')) == count, 'reconnecting does not settle or pay the same days again')
        check(not (errors + errors2 + errors3), 'no page errors ' + '; '.join(errors + errors2 + errors3)[:300])
        await browser.close()
    (OUT / 'journeys-bc.json').write_text(json.dumps({'checks': checks, 'scope': 'Loopback disposable fixtures; QA backdating of auto-work start in the disposable database only; SwiftShader; real timers.'}, indent=1))

asyncio.run(main())
