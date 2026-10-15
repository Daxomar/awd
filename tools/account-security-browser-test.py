"""Exercise signup and the account-security UI through real browser cookies."""
import asyncio,time
from pathlib import Path
from playwright.async_api import async_playwright
BASE='http://127.0.0.1:8082'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  context=await browser.new_context(viewport={'width':430,'height':860},is_mobile=True,has_touch=True)
  page=await context.new_page();errors=[];sockets=[]
  page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR',str(e),flush=True)))
  page.on('console',lambda m:(errors.append(m.text),print('BROWSER',m.text,flush=True)) if m.type=='error' and not m.text.startswith('Failed to load resource:') else None)
  def watch_socket(ws):
   sockets.append(ws.url)
   def frame(data):
    import json
    try:
     msg=json.loads(data)
     if msg.get('t') in ['welcome','full','toast']:print('WS',msg.get('t'),msg.get('m',''),msg.get('state',{}).get('onboarded'),flush=True)
    except (ValueError,TypeError):pass
   ws.on('framereceived',frame)
   ws.on('close',lambda:print('WS closed',flush=True))
  page.on('websocket',watch_socket)
  await page.add_init_script('const nativeRAF=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>nativeRAF(()=>setTimeout(()=>cb(performance.now()),250));')
  print('Opening production client',flush=True)
  await page.goto(BASE,wait_until='domcontentloaded')
  print('Client loaded',flush=True)
  await page.wait_for_function('()=>!!window.__stage',timeout=120000)
  await page.evaluate('()=>{__stage.renderer.setPixelRatio(.5);const render=__stage.render.bind(__stage);let last=0;__stage.render=()=>{if(Date.now()-last>700){last=Date.now();render();}};}')
  await page.locator('input[autocomplete=username]').wait_for(timeout=120000)
  user='qaweb'+str(int(time.time()))[-8:]
  await page.locator('input[autocomplete=username]').fill(user)
  await page.locator('input[type=password]').fill('browser-secure-passphrase')
  await page.locator('input[type=date]').fill('1995-01-01');await page.locator('input[type=checkbox]').check()
  await page.get_by_role('button',name='Start my Accra life',exact=True).click(no_wait_after=True)
  await page.get_by_role('button',name='Create my character',exact=True).wait_for(timeout=120000)
  await page.get_by_role('button',name='Create my character',exact=True).click()
  await page.get_by_role('button',name='Woman',exact=True).wait_for(timeout=30000)
  print('PASS cookie signup',flush=True)
  assert all('token=' not in url for url in sockets),sockets
  cookies=await context.cookies();assert any(c['httpOnly'] and c['sameSite']=='Strict' for c in cookies),cookies
  assert await page.evaluate("localStorage.getItem('awd_token')")==None
  assert 'awd_session' not in await page.evaluate('document.cookie')
  await page.get_by_role('button',name='Choose traits',exact=True).click(no_wait_after=True)
  await page.locator('.of-trait').nth(0).click();await page.locator('.of-trait').nth(1).click()
  await page.get_by_role('button',name='Save character (2/2)',exact=True).click()
  await page.get_by_role('button',name='Roll the birth lottery',exact=True).click()
  await page.get_by_role('button',name='Choose your first home',exact=True).click()
  await page.locator('.of-home').first.click()
  await page.get_by_role('button',name='Choose this home',exact=True).click(no_wait_after=True)
  await page.get_by_role('button',name='Enter Accra',exact=True).click(no_wait_after=True,timeout=30000)
  await page.wait_for_function('()=>!!window.__world?.me',timeout=90000)
  print('PASS onboarding',flush=True)
  skip=page.get_by_role('button',name='Skip tour',exact=True)
  if await skip.count():await skip.click(no_wait_after=True)
  await page.evaluate("()=>{__stage.renderer.setPixelRatio(.65);__stage.render=()=>{};__act.phone('settings');}")
  await page.get_by_role('button',name='Account security',exact=False).click(no_wait_after=True)
  await page.get_by_placeholder('Current password',exact=True).fill('wrong')
  await page.get_by_placeholder('New password (12–128 characters)').fill('browser-changed-passphrase')
  await page.get_by_placeholder('Repeat new password').fill('browser-changed-passphrase')
  await page.get_by_role('button',name='Change password',exact=True).click(no_wait_after=True)
  await page.get_by_role('status').filter(has_text='Current password is incorrect.').wait_for()
  print('PASS current-password rejection',flush=True)
  await page.get_by_placeholder('Current password',exact=True).fill('browser-secure-passphrase')
  await page.get_by_role('button',name='Change password',exact=True).click(no_wait_after=True)
  await page.locator('input[autocomplete=username]').wait_for(timeout=120000)
  await page.get_by_role('button',name='I have an account',exact=True).click()
  await page.locator('input[autocomplete=username]').fill(user);await page.locator('input[type=password]').fill('browser-changed-passphrase')
  await page.get_by_role('button',name='Log in',exact=True).click(no_wait_after=True)
  try:await page.wait_for_function('()=>!!window.__world?.me',timeout=120000)
  except Exception:
   print('LOGIN DIAGNOSTIC',await page.locator('body').inner_text(),flush=True)
   print('SESSION',await page.evaluate("()=>fetch('/api/session').then(r=>r.json())"),flush=True)
   raise
  await page.evaluate('()=>{__stage.render=()=>{};__act.phone("settings");}')
  await page.get_by_role('button',name='Account security',exact=False).click(no_wait_after=True)
  await page.get_by_role('button',name='Log out every device',exact=True).click(no_wait_after=True)
  await page.locator('input[autocomplete=username]').wait_for(timeout=120000)
  assert not errors,errors
  print('PASS production browser signup, onboarding, cookie isolation, password change, login and account-wide logout',flush=True)
  await browser.close()
asyncio.run(main())
