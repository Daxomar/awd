"""Disposable local production-mode fallback and reduced-motion checks."""
import argparse,asyncio,time
from pathlib import Path
from playwright.async_api import async_playwright
parser=argparse.ArgumentParser();parser.add_argument('--base',default='http://127.0.0.1:8082');args=parser.parse_args();BASE=args.base.rstrip('/')
assert BASE.startswith(('http://127.0.0.1:','http://localhost:')), 'Disposable local server only'
Path('.local/onboarding').mkdir(parents=True,exist_ok=True)
async def one(p,webgl):
 b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']+([] if webgl else ['--disable-webgl']))
 c=await b.new_context(viewport={'width':375,'height':812},is_mobile=True,has_touch=True,reduced_motion='reduce' if webgl else 'no-preference');page=await c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 name=('reduce' if webgl else 'nogl')+str(int(time.time()))[-8:]
 r=await page.request.post(BASE+'/api/signup',headers={'origin':BASE},data={'username':name,'password':'fallback-test-password','dob':'1995-01-01','agree':True});assert r.ok,await r.text()
 print('Testing', 'reduced motion' if webgl else 'WebGL disabled',flush=True)
 await page.goto(BASE,wait_until='domcontentloaded');await page.get_by_role('button',name='Create my character',exact=True).wait_for(timeout=120000)
 await page.evaluate('()=>{if(__stage){__stage.renderer.setPixelRatio(.6);__stage.render=()=>{};}}')
 await page.get_by_role('button',name='Create my character',exact=True).click();await page.get_by_role('button',name='Choose traits',exact=True).click();await page.locator('.of-trait').nth(0).click();await page.locator('.of-trait').nth(1).click();await page.get_by_role('button',name='Save character (2/2)',exact=True).click()
 await page.get_by_role('button',name='Roll the birth lottery',exact=True).wait_for();start=time.monotonic();await page.get_by_role('button',name='Roll the birth lottery',exact=True).click();await page.get_by_role('button',name='Choose your first home',exact=True).wait_for();elapsed=time.monotonic()-start
 if webgl:assert elapsed<1.1,elapsed
 else:assert await page.locator('.birth-die-fallback').is_visible();assert await page.evaluate('()=>__stage===null')
 await page.evaluate('()=>{if(__stage?.override){const o=__stage.override;__stage.renderer.render(o.scene,o.camera);}}')
 await page.screenshot(path='.local/onboarding/'+('reduced-motion' if webgl else 'no-webgl')+'.png')
 await page.get_by_role('button',name='Choose your first home',exact=True).click();await page.locator('.of-home').first.click();await page.get_by_role('button',name='Choose this home',exact=True).click();await page.get_by_role('button',name='Enter Accra',exact=True).click()
 if webgl:await page.wait_for_function('()=>!!window.__world?.me',timeout=120000)
 else:await page.get_by_role('button',name='Try again',exact=True).wait_for();assert await page.evaluate('()=>__G.state.onboarded')
 assert not errors,errors;print('PASS', 'reduced-motion 3D' if webgl else 'no-WebGL CSS fallback with saved completion', 'reveal seconds',round(elapsed,2),flush=True);await b.close()
async def main():
 async with async_playwright() as p:await one(p,False);await one(p,True)
asyncio.run(main())
