"""Stage 12.3 performance diagnostics on the loopback QA server (desktop Chromium, SwiftShader).

Measures what can be measured honestly without a phone: bytes transferred on first load, time to a playable city
(cold scene construction), and per quality tier the draw calls, triangles, geometries, textures and JS heap in a
real neighbourhood with ambient life. It does NOT measure phone frame rate; software rendering is far slower than a
phone GPU and says nothing reliable about FPS. Results: docs/master/stage12/perf.json.
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
    raise ValueError('Loopback QA server only')
env = {**os.environ, 'DATABASE_URL': 'postgres://awd@127.0.0.1:55432/awd_security', 'REDIS_URL': 'redis://127.0.0.1:6379/14', 'REDIS_NAMESPACE': 'phase8:'}
subprocess.run(['node', 'loadtest/phase8-fixtures.js', 'replace-role', 'friend'], cwd='server', env=env, check=True, capture_output=True)
FIX = {f['role']: f for f in json.loads(Path('.local/phase8/fixtures.json').read_text())}
OUT = Path('docs/master/stage12'); OUT.mkdir(parents=True, exist_ok=True)

PROBE = """async (tier) => {
  __stage.applyQuality(tier);
  for (let i = 0; i < 3; i++) { __stage.render(); await new Promise(r => setTimeout(r, 120)); }
  const info = __stage.renderer.info, t0 = performance.now();
  for (let i = 0; i < 10; i++) __stage.render();
  const cpuMs = (performance.now() - t0) / 10;
  const c = __stage.renderer.domElement;
  return {tier, calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures,
    canvas: [c.width, c.height], shadows: __stage.key.castShadow, heapMb: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    softwareRenderMs: Math.round(cpuMs * 10) / 10};
}"""


async def main():
    results = {'scope': 'Desktop Chromium with SwiftShader on the loopback QA server. Not phone FPS.', 'viewport': [390, 844], 'devicePixelRatio': 3}
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'])
        ctx = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=3)
        await ctx.add_cookies([{'name': 'awd_session', 'value': FIX['friend']['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
        p = await ctx.new_page()
        bytes_in = {'total': 0, 'requests': 0}
        async def count(resp):
            try:
                body = await resp.body(); bytes_in['total'] += len(body); bytes_in['requests'] += 1
            except Exception:
                pass
        p.on('response', lambda r: asyncio.ensure_future(count(r)))
        start = time.time()
        await p.goto(args.base, wait_until='domcontentloaded')
        await p.wait_for_function('()=>!!window.__world?.me', timeout=240000)
        results['coldStartToCitySeconds'] = round(time.time() - start, 1)
        await p.wait_for_timeout(4000)
        results['firstLoadMb'] = round(bytes_in['total'] / 1048576, 2); results['firstLoadRequests'] = bytes_in['requests']
        results['place'] = await p.evaluate('()=>__G.state.place')
        results['ambient'] = await p.evaluate('()=>({people:__world.ambient?.items?.length??null,cars:__world.ambient?.cars?.length??null})')
        results['tiers'] = [await p.evaluate(PROBE, t) for t in ('sharp', 'balanced', 'saver')]
        await p.evaluate("()=>__act.setQuality('auto')")
        await browser.close()
    (OUT / 'perf.json').write_text(json.dumps(results, indent=1))
    print(json.dumps(results, indent=1))

asyncio.run(main())
