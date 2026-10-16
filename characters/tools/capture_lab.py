"""Capture review renders of the AWD character GLBs from the Three.js character lab.

Requires the Vite dev server (cd client && npm run dev) on 127.0.0.1:5173.
Usage: python characters/tools/capture_lab.py [prefix] [--body=f] [--resume]
Writes PNGs to characters/previews/ and a JSON of runtime stats next to them.
Headless Chromium renders in software: images validate content, not phone FPS.
"""
import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'characters' / 'previews'
BASE = 'http://127.0.0.1:5173/character-lab.html'
SHOTS = [
    ('front', 'lod=0&cam=front&t=0.4', (540, 860)),
    ('three_quarter', 'lod=0&cam=three_quarter&t=0.4', (540, 860)),
    ('side', 'lod=0&cam=side&t=0.4', (540, 860)),
    ('back', 'lod=0&cam=back&t=0.4', (540, 860)),
    ('game_lod1', 'lod=1&cam=game&t=0.4', (540, 860)),
    ('face_neutral', 'lod=0&cam=face&t=0.4', (540, 540)),
    ('face_happy', 'lod=0&cam=face&expr=happy&t=0.4', (540, 540)),
    ('face_surprised', 'lod=0&cam=face&expr=surprised&t=0.4', (540, 540)),
    ('face_angry', 'lod=0&cam=face&expr=angry&t=0.4', (540, 540)),
    ('walk', 'lod=0&cam=side&clip=walk&t=0.25', (540, 860)),
    ('wave', 'lod=0&cam=front&clip=wave&t=0.95', (540, 860)),
    ('crowd_lod1', 'lod=1&n=12&cam=three_quarter&t=0.6', (860, 640)),
    ('sliders_slim', 'lod=1&cam=front&t=0.4&build=0&waist=0&hips=0&muscle=0', (540, 860)),
    ('sliders_full', 'lod=1&cam=front&t=0.4&build=1&waist=1&hips=1&bust=1&shoulders=1', (540, 860)),
    ('tones_lod2', 'lod=2&n=8&cam=game&t=0.6', (860, 640)),
]
HAIR_SHOTS = {
    'f': [('hair_a', 'lod=0&cam=grid&t=0.4&hairs=lowcut,fade,afro,twists,locs,cornrows,puff', (1600, 600)),
          ('hair_b', 'lod=0&cam=grid&t=0.4&hairs=bun,twa,braids,bob,bonestraight,duku,bald', (1600, 600)),
          ('hair_a_back', 'lod=0&cam=gridback&t=0.4&hairs=lowcut,fade,afro,twists,locs,cornrows,puff', (1600, 600)),
          ('hair_b_back', 'lod=0&cam=gridback&t=0.4&hairs=bun,twa,braids,bob,bonestraight,duku,bald', (1600, 600))],
    'm': [('hair', 'lod=0&cam=grid&t=0.4&hairs=lowcut,fade,waves,afro,twists,locs,cornrows', (1600, 600)),
          ('hair_back', 'lod=0&cam=gridback&t=0.4&hairs=lowcut,fade,waves,afro,twists,locs,cornrows', (1600, 600)),
          ('beards', 'lod=0&cam=grid&t=0.4&hair=lowcut&beards=nobeard,stubble,goatee,fullbeard', (1200, 600)),
          ('beards_laugh', 'lod=0&cam=grid&t=0.4&hair=lowcut&expr=laughing&beards=nobeard,stubble,goatee,fullbeard', (1200, 600))],
}


async def capture(browser, name, query, size, prefix):
    page = await browser.new_page(viewport={'width': size[0], 'height': size[1]})
    body = next((a.split('=')[1] for a in sys.argv if a.startswith('--body=')), 'm')
    try:
        await page.goto(f'{BASE}?{query}&body={body}')
        await page.wait_for_function('window.__LAB && (window.__LAB.ready || window.__LAB.errors.length)', timeout=120000)
        errors = await page.evaluate('window.__LAB.errors')
        if errors:
            raise RuntimeError(f'{name}: {errors}')
        await page.wait_for_timeout(800)
        await page.screenshot(path=str(OUT / f'{prefix}_{name}.png'), timeout=180000)
        return await page.evaluate('window.__LAB.measure()')
    finally:
        await page.close()


async def main(prefix):
    OUT.mkdir(parents=True, exist_ok=True)
    stats = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        try:
            body = next((a.split('=')[1] for a in sys.argv if a.startswith('--body=')), 'm')
            shots = HAIR_SHOTS[body] if '--set=hair' in sys.argv else SHOTS
            for name, query, size in shots:
                if '--resume' in sys.argv and (OUT / f'{prefix}_{name}.png').exists():
                    continue
                for attempt in range(3):   # software WebGL occasionally drops a frame or context
                    try:
                        stats[name] = await capture(browser, name, query, size, prefix)
                        break
                    except Exception as error:   # noqa: BLE001 - report and retry
                        print(f'{name}: attempt {attempt + 1} failed: {str(error).splitlines()[0]}', flush=True)
                        if attempt == 2:
                            raise
        finally:
            await browser.close()
    (OUT / f'{prefix}_runtime_stats.json').write_text(json.dumps(stats, indent=2))
    print('captured', len(SHOTS), 'views to', OUT)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    asyncio.run(main(args[0] if args else 'male_prototype'))
