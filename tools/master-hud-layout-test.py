"""Measure the actual authenticated HUD and map tools on disposable local saves.

Software rendering is sampled for screenshots; game and network timers are real.
This is a browser layout check, not a physical-device performance measurement.
"""
import argparse
import asyncio
import json
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright


MEASURE = """() => {
 const visible=e=>!!e&&!!e.getClientRects().length;
 const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
 const selectors=['.player-status','.wallet-control','.location-control','.optional-objective',
   '.street-context','.street-entrance','.map-filters','.city-controls','.play-nav','.hud-surface'];
 const boxes=Object.fromEntries(selectors.map(s=>[s,visible(document.querySelector(s))?box(document.querySelector(s)):null]));
 const controls=[...document.querySelectorAll('.hud-surface button,.city-controls button,.play-nav button,.map-filters button')].filter(visible).map(e=>({label:e.getAttribute('aria-label')||e.textContent,scrollableFilter:!!e.closest('.map-filters'),...box(e)}));
 const text=['.player-copy strong','.wallet-control strong','.current-location','.online-count','.location-control time','.optional-objective'].map(s=>{const e=document.querySelector(s);return {selector:s,text:e?.textContent||'',...box(e),clipped:e.scrollWidth>e.clientWidth+1};});
 const pins=[...document.querySelectorAll('.mapui .pin')].filter(e=>visible(e)&&getComputedStyle(e).visibility!=='hidden').map(box);
 return {boxes,controls,text,pins,overflow:document.documentElement.scrollWidth>innerWidth+1,mapView:document.querySelector('.game-ui').classList.contains('map-view')};
}"""


def overlaps(a, b):
    return a and b and min(a['right'], b['right'])-max(a['x'], b['x']) > 1 and min(a['bottom'], b['bottom'])-max(a['y'], b['y']) > 1


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://127.0.0.1:8085')
    args = parser.parse_args()
    if urlsplit(args.base).hostname not in ('127.0.0.1', 'localhost'):
        raise ValueError('Only isolated loopback QA is supported')
    fixture = next(f for f in json.loads(Path('.local/phase8/fixtures.json').read_text()) if f['role'] == 'career')
    out = Path('docs/master/stage1')
    out.mkdir(parents=True, exist_ok=True)
    results = []
    errors = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=['--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu-compositing', '--num-raster-threads=1'])
        context = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
        await context.add_cookies([{'name': 'awd_session', 'value': fixture['cookie'], 'url': args.base, 'httpOnly': True, 'sameSite': 'Strict'}])
        await context.add_init_script('(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>setTimeout(()=>raf(f),75)})();')
        page = await context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        try:
            await page.goto(args.base, wait_until='domcontentloaded', timeout=120000)
            await page.wait_for_function('()=>!!window.__world?.me', timeout=180000)
            await page.evaluate('()=>{__stage.renderer.setPixelRatio(.5);__stage.renderer.shadowMap.enabled=false;window.__qaDraw=__stage.render.bind(__stage);__stage.render=()=>{};}')
            if await page.get_by_role('button', name='Skip tour', exact=True).count():
                await page.get_by_role('button', name='Skip tour', exact=True).click()
            for view in ['home', 'map', 'home-return']:
                if view == 'map':
                    await page.get_by_role('button', name='Map', exact=True).click()
                    await page.wait_for_function('()=>__map.ready', timeout=240000)
                elif view == 'home-return':
                    await page.get_by_role('button', name='Home', exact=True).click()
                for width, height in [(375, 812), (390, 844), (430, 932), (390, 530), (844, 390)]:
                    await page.set_viewport_size({'width': width, 'height': height})
                    await page.wait_for_timeout(250)
                    await page.evaluate('()=>__qaDraw()')
                    result = await page.evaluate(MEASURE)
                    result.update(view=view, width=width, height=height)
                    assert not result['overflow'], result
                    assert result['mapView'] == (view == 'map'), result
                    boxes = result['boxes']
                    hud = ['.player-status', '.wallet-control', '.location-control', '.optional-objective', '.street-context']
                    for i, first in enumerate(hud):
                        for second in hud[i+1:]:
                            assert not overlaps(boxes[first], boxes[second]), (view, width, first, second, boxes)
                    for control in result['controls']:
                        assert control['w'] >= 44 and control['h'] >= 44, (view, width, control)
                        if not control['scrollableFilter']:
                            assert control['x'] >= 0 and control['right'] <= width+1, (view, width, control)
                    for text in result['text']:
                        assert text['text'] and text['w'] >= 20 and text['h'] >= 10, (view, width, text)
                    for selector in ['.wallet-control strong', '.online-count', '.location-control time']:
                        assert not next(t for t in result['text'] if t['selector'] == selector)['clipped'], (view, width, selector)
                    if view == 'map':
                        assert boxes['.street-context'] is None, result
                        assert not overlaps(boxes['.hud-surface'], boxes['.map-filters']), result
                        assert not overlaps(boxes['.hud-surface'], boxes['.city-controls']), result
                        for pin in result['pins']:
                            assert not overlaps(pin, boxes['.map-filters']), (view, width, pin, boxes['.map-filters'])
                    results.append(result)
                    await page.screenshot(path=str(out/f'hud-{view}-{width}x{height}.jpg'), type='jpeg', quality=86)
                    print(f'{view} {width}x{height} passed', flush=True)
            assert not errors, errors
            (out/'hud-layout.json').write_text(json.dumps({'passed': True, 'checks': results, 'pageErrors': errors, 'scope': 'Disposable authenticated local cookie session. Real DOM at device scale 1, .5 WebGL pixel ratio, sampled software rendering. No phone FPS claim.'}, indent=2)+'\n')
        finally:
            await context.close()
            await browser.close()


asyncio.run(main())
