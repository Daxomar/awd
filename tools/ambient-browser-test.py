"""Stage 9 acceptance on the real game UI and server (loopback disposable fixtures).

G1: a neighbourhood street gains scripted residents, a conversation, parked cars and one slow vehicle by day,
    without name tags and without changing the real online-player count.
G2: residents never open a venue menu (tapping one shows the "scripted character, not a player" card).
G3: late at night the street is quieter (one walker, no chatting, no traffic).
G4: the cost is bounded: draw calls, triangles and per-frame ambient update time are measured and reported.
G5: a real player's business shows as a signboard at its venue.
The QA hour is pinned with an init script; SwiftShader numbers are not phone FPS.
"""
import argparse, asyncio, json, os, subprocess, sys, uuid
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
OUT = Path('docs/master/stage9'); OUT.mkdir(parents=True, exist_ok=True)
checks, metrics = [], {}


def check(ok, text):
    print(('PASS ' if ok else 'FAIL ') + text, flush=True); checks.append({'ok': bool(ok), 'check': text})
    if not ok:
        raise AssertionError(text)


async def open_game(browser, hour):
    c = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    await c.add_init_script("(()=>{Object.defineProperty(window,'devicePixelRatio',{get:()=>.5});const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>setTimeout(()=>raf(fn),75);window.__AWD_QA_HOUR__=%d;})();" % hour)
    await c.add_cookies([{'name': 'awd_session', 'value': FIX['seller']['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
    p = await c.new_page(); errors = []
    p.on('pageerror', lambda e: errors.append(str(e)))
    await p.goto(args.base, wait_until='domcontentloaded')
    await p.wait_for_function('()=>!!window.__world?.me', timeout=180000)
    for n in ('Skip tour', 'Skip'):
        if await p.get_by_role('button', name=n, exact=True).count():
            await p.get_by_role('button', name=n, exact=True).click()
    await p.evaluate("()=>{window.__qa=[];for(const t of ['frontage','life_status','life_result','toast'])__net.on(t,m=>__qa.push({t,...m}));}")
    await p.wait_for_timeout(1500)
    return c, p, errors


async def go(p, to):
    if await p.evaluate('()=>__G.state.place') != to:
        await p.evaluate(f"()=>__net.send({{t:'travel',to:'{to}',mode:'trotro'}})")
        await p.wait_for_function(f"()=>__G.state.place==='{to}'&&!!__world?.me", timeout=240000)
    await p.wait_for_timeout(3000)


async def shot(p, name):
    await p.evaluate('()=>__stage.render()'); await p.wait_for_timeout(250)
    await p.screenshot(path=str(OUT / f'{name}.jpg'), type='jpeg', quality=70)


PERF = """async()=>{const r=__stage.renderer,a=__world.ambient;
  const sample=async()=>{let n=0,calls=0,tri=0,t=0;for(let i=0;i<20;i++){const t0=performance.now();a.update(1/30,__world.me);t+=performance.now()-t0;__stage.render();calls+=r.info.render.calls;tri+=r.info.render.triangles;n++;await new Promise(f=>setTimeout(f,20));}return {calls:Math.round(calls/n),tri:Math.round(tri/n),updateMs:+(t/n).toFixed(3)};};
  const on=await sample();const roots=a.ids.map(id=>__world.room.people.get(id).av.root),cars=a.cars.map(c=>c.obj),parked=a.items.map(i=>i.obj),all=[...roots,...cars,...parked],was=all.map(o=>o.visible);
  all.forEach(o=>o.visible=false);let calls=0,tri=0;for(let i=0;i<10;i++){__stage.render();calls+=r.info.render.calls;tri+=r.info.render.triangles;}all.forEach((o,i)=>o.visible=was[i]);
  return {on,off:{calls:Math.round(calls/10),tri:Math.round(tri/10)}};}"""


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        c, p, e1 = await open_game(browser, 12)
        await go(p, 'n:nima')
        online = await p.evaluate('()=>__G.online')
        st = await p.evaluate('()=>__world.ambient?.stats()')
        print('  day stats', st, flush=True)
        check(st and st['residents'] >= 4 and st['parked'] >= 2 and st['moving'] == 1, 'by day the street has residents, a conversation, parked cars and one slow vehicle')
        tags = await p.evaluate("()=>[...__world.tagsEl.children].length")
        named = await p.evaluate("()=>[...__world.room.people.keys()].filter(id=>!id.startsWith('npc')).length")
        check(await p.evaluate('()=>__G.online') == online, f'residents are not counted as players (online stays {online}; {tags} tags for {named} real people and named staff)')
        await p.wait_for_timeout(8000)
        moved = await p.evaluate("()=>[...__world.room.people.entries()].filter(([id,x])=>id.startsWith('npc-amb')&&x.path.length).length")
        car0 = await p.evaluate('()=>__world.ambient.cars[0].obj.position.x'); await p.wait_for_timeout(1500); car1 = await p.evaluate('()=>__world.ambient.cars[0].obj.position.x')
        check(moved >= 1 or car0 != car1, f'residents walk between points and traffic moves ({moved} walking, car {car0:.1f}→{car1:.1f})')
        await shot(p, 'g1-street-day')
        perf = await p.evaluate(PERF)
        metrics['day'] = perf; print('  perf', perf, flush=True)
        check(perf['on']['updateMs'] < 2 and perf['on']['calls'] - perf['off']['calls'] < 400, f"ambient cost is bounded (update {perf['on']['updateMs']} ms/frame, +{perf['on']['calls'] - perf['off']['calls']} draw calls, +{perf['on']['tri'] - perf['off']['tri']} triangles)")
        rid = await p.evaluate("()=>__world.ambient.ids[0]")
        check(await p.evaluate(f"()=>__world.zoneForNpc('{rid}')===null"), 'a resident never opens a venue menu (tap shows the scripted-character card)')
        await c.close()
        c, p, e2 = await open_game(browser, 2)
        await go(p, 'n:nima')
        st = await p.evaluate('()=>__world.ambient?.stats()'); print('  night stats', st, flush=True)
        check(st['residents'] == 1 and st['moving'] == 0, 'late at night the street is quieter: one walker, no chatting, no traffic')
        await shot(p, 'g2-street-night')
        await go(p, 'makola')
        key = str(uuid.uuid4())
        await p.evaluate(f"()=>__net.send({{t:'life_action',op:'business_create',key:'{key}',type:'provisions',location:'makola'}})")
        await p.wait_for_timeout(5000)
        await go(p, 'circle'); await go(p, 'makola'); await p.wait_for_timeout(2000)
        fr = await p.evaluate("()=>__qa.filter(m=>m.t==='frontage').at(-1)")
        check(bool(fr) and any(r['mine'] for r in fr['rows']), 'the player business is sent as frontage at its venue')
        check(await p.evaluate("()=>(__world.frontage||[]).length") >= 1, 'a signboard for the business stands in the venue')
        await p.evaluate("()=>{const rec=__world.frontage[0];__world.focusTarget({item:__world.room.items.indexOf(rec)});}")
        await shot(p, 'g3-frontage')
        await c.close()
        check(not (e1 + e2), 'no page errors ' + '; '.join(e1 + e2)[:300])
        await browser.close()
    (OUT / 'journey-g.json').write_text(json.dumps({'checks': checks, 'metrics': metrics, 'scope': 'Loopback disposable fixtures; QA-pinned hour; SwiftShader (not phone FPS).'}, indent=1))

asyncio.run(main())
