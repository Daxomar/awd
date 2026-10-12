import asyncio, sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = await browser.new_page(viewport={'width': 412, 'height': 860}, device_scale_factor=1)
        page.on('pageerror', lambda e: print('PAGEERROR:', e))
        await page.goto(sys.argv[1], wait_until='networkidle', timeout=120000)
        await page.wait_for_timeout(2500)
        out = Path(sys.argv[2]); out.parent.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(out))
        print(await page.locator('body').inner_text())
        await browser.close()
asyncio.run(main())
