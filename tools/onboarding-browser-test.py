"""Local production-mode onboarding journeys. Uses disposable fixtures; never a live game.
Run with --fixtures .local/onboarding/fixtures.json after the fixture helper.
Software-rendered screenshots verify layout, not physical phone performance.
"""
import argparse,asyncio,json,re,time
from pathlib import Path
from playwright.async_api import async_playwright
parser=argparse.ArgumentParser();parser.add_argument('--base',default='http://127.0.0.1:8082');parser.add_argument('--fixtures',default='.local/onboarding/fixtures.json');parser.add_argument('--output',default='.local/onboarding');args=parser.parse_args();BASE=args.base.rstrip('/');OUT=Path(args.output);OUT.mkdir(parents=True,exist_ok=True)
assert BASE.startswith(('http://127.0.0.1:','http://localhost:')), 'Disposable local server only'
async def ready(page):
 await page.wait_for_function('()=>!!window.__net',timeout=120000)
 await page.evaluate('()=>{if(__stage){__stage.renderer.setPixelRatio(.65);window.__qaRender=__stage.render.bind(__stage);__stage.render=()=>{};}}')
async def snap(page,name):
 await page.evaluate('()=>window.__qaRender?.()');await page.screenshot(path=str(OUT/(name+'.png')))
async def step(page,name):await page.locator('.onboarding-flow[data-step="'+name+'"]').wait_for(timeout=120000)
async def saved(page):await page.locator('.of-save').filter(has_text=re.compile(r'^Saved$')).wait_for(timeout=15000)
async def rpc(page,op,**fields):
 return await page.evaluate('''({op,fields})=>new Promise((resolve,reject)=>{const id='qa-'+Math.random();const timer=setTimeout(()=>{off();reject(Error('No RPC reply'));},15000);const off=__net.on('onboarding',m=>{if(m.id===id){clearTimeout(timer);off();resolve(m);}});__net.send({t:'onboarding',id,op,revision:__G.state.onboarding?.revision||0,...fields});})''',{'op':op,'fields':fields})
async def fit(page):
 return await page.evaluate('''()=>({width:innerWidth,scroll:document.querySelector('.onboarding-flow').scrollWidth,buttons:[...document.querySelectorAll('.of-primary,.sty-foot button')].map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};})})''')
async def begin_character(page):
 await page.get_by_role('button',name='Create my character',exact=True).click();await step(page,'character')
 await page.get_by_role('button',name='Woman',exact=True).click();await page.locator('#setup-name').fill('Ama')
 await page.get_by_label('Bust',exact=True).fill('0.8');await page.get_by_label('Bust',exact=True).dispatch_event('input');await saved(page)
async def traits(page):
 await page.get_by_role('button',name='Choose traits',exact=True).click();await page.locator('.of-trait').nth(0).click();await page.locator('.of-trait').nth(1).click();assert await page.locator('.of-trait[aria-pressed=true]').count()==2;await snap(page,'selected-traits');await page.get_by_role('button',name='Save character (2/2)',exact=True).click();await step(page,'lottery')
async def journey(browser,fixture,recovery):
 context=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 await context.add_cookies([{'name':'awd_session','value':fixture['cookie'],'url':BASE,'httpOnly':True,'sameSite':'Strict'}]);page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.goto(BASE,wait_until='domcontentloaded');await ready(page);await step(page,'welcome');await snap(page,fixture['origin']+'-welcome');await begin_character(page)
 if recovery:
  for width,height in [(375,812),(390,844),(430,932),(844,390),(390,530)]:
   await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(200);layout=await fit(page);assert layout['scroll']<=width+1,layout;assert all(b['bottom']<=height+1 and b['height']>=44 for b in layout['buttons']),layout;await snap(page,f'character-{width}x{height}')
  await page.set_viewport_size({'width':390,'height':844});await page.reload(wait_until='domcontentloaded');await ready(page);await step(page,'character')
  assert await page.locator('#setup-name').input_value()=='Ama';assert await page.evaluate('()=>__G.state.onboarding.look.body')=='f';assert await page.evaluate('()=>__G.state.onboarding.look.bust')==.8
 await traits(page);assert await page.evaluate('()=>__G.state.birthOrigin')==fixture['origin'];await snap(page,fixture['origin']+'-before-roll')
 await page.get_by_role('button',name='Roll the birth lottery',exact=True).click();await page.wait_for_function('()=>!!__G.state.onboarding?.revealedAt')
 reveal=await page.evaluate('()=>__G.state.onboarding.revealedAt')
 if recovery:
  await page.reload(wait_until='domcontentloaded');await ready(page);await step(page,'lottery');assert await page.evaluate('()=>__G.state.onboarding.revealedAt')==reveal
 await page.get_by_role('button',name='Choose your first home',exact=True).wait_for();await snap(page,fixture['origin']+'-result')
 for _ in range(3):assert (await rpc(page,'roll',birthOrigin='hustler' if fixture['origin']=='dbee' else 'dbee',revision=0))['ok']
 assert await page.evaluate('()=>__G.state.cash+__G.state.momo')==0
 await page.get_by_role('button',name='Choose your first home',exact=True).click();await step(page,'home');assert await page.locator('.of-home').count()==(2 if fixture['origin']=='hustler' else 3)
 invalid=await rpc(page,'home',home='trasacco');assert not invalid['ok'];assert not invalid['state']['onboarding']['home'];await snap(page,fixture['origin']+'-homes')
 await page.locator('.of-home').first.click()
 if recovery:
  await page.evaluate("()=>{const send=__net.send.bind(__net);__net.send=m=>{if(m.t==='onboarding'&&m.op==='home'){__net.send=send;return send({...m,home:'trasacco'});}return send(m);};}")
  await page.get_by_role('button',name='Choose this home',exact=True).click();await page.locator('.of-error:not([hidden])').wait_for();await step(page,'home');await snap(page,'invalid-home-error')
  await context.set_offline(True);await page.evaluate('()=>__net.ws.close()');await page.wait_for_function('()=>!__net.connected');await page.get_by_role('button',name='Choose this home',exact=True).click();await page.locator('.of-error:not([hidden])').wait_for();await snap(page,'offline-home')
  await context.set_offline(False);await page.wait_for_function('()=>__net.connected',timeout=30000)
  await step(page,'home');await page.locator('.of-home').first.click()
 await page.get_by_role('button',name='Choose this home',exact=True).click();await step(page,'enter');home=await page.evaluate('()=>__G.state.onboarding.home')
 await page.reload(wait_until='domcontentloaded');await ready(page);await step(page,'enter');assert await page.evaluate('()=>__G.state.onboarding.home')==home;await snap(page,fixture['origin']+'-arrival')
 await page.get_by_role('button',name='Enter Accra',exact=True).click();await page.wait_for_function('()=>!!window.__world?.me',timeout=120000)
 if await page.get_by_role('button',name='Skip tour',exact=True).count():await page.get_by_role('button',name='Skip tour',exact=True).click()
 amount=25000 if fixture['origin']=='dbee' else 800
 assert await page.evaluate('()=>__G.state.cash+__G.state.momo')==amount
 assert await page.evaluate('()=>__G.state.home')==home
 assert await page.evaluate('()=>__G.state.look.body')=='f'
 for _ in range(3):assert (await rpc(page,'finish'))['state']['cash']+(await rpc(page,'finish'))['state']['momo']==amount
 await snap(page,fixture['origin']+'-in-home')
 await page.reload(wait_until='domcontentloaded');await ready(page);await page.wait_for_function('()=>!!window.__world?.me',timeout=120000);assert await page.locator('.onboarding-flow').count()==0
 assert not errors,errors;print('PASS',fixture['origin'],'complete, reload, eligibility, repeated roll/finish; recovery=',recovery,flush=True);await context.close()
async def signup_and_login(browser,fixture):
 context=await browser.new_context(viewport={'width':375,'height':812},is_mobile=True,has_touch=True);page=await context.new_page();await page.goto(BASE,wait_until='domcontentloaded');await ready(page);await page.locator('input[autocomplete=username]').wait_for(timeout=120000)
 name='new'+str(int(time.time()))[-9:];await page.locator('input[autocomplete=username]').fill(name);await page.locator('input[type=password]').fill('new-onboarding-password');await page.locator('input[type=date]').fill('1995-01-01');await page.locator('input[type=checkbox]').check();await page.get_by_role('button',name='Start my Accra life',exact=True).click();await step(page,'welcome');await snap(page,'registration-welcome')
 cookies=await context.cookies();assert any(c['name']=='awd_session' and c['httpOnly'] and c['sameSite']=='Strict' for c in cookies);assert await page.evaluate("localStorage.getItem('awd_token')") is None
 await context.close();context=await browser.new_context(viewport={'width':430,'height':932},is_mobile=True,has_touch=True);page=await context.new_page();await page.goto(BASE,wait_until='domcontentloaded');await ready(page);await page.get_by_role('button',name='I have an account',exact=True).wait_for(timeout=120000);await page.get_by_role('button',name='I have an account',exact=True).click();await page.locator('input[autocomplete=username]').fill(fixture['username']);await page.locator('input[type=password]').fill(fixture['password']);await page.get_by_role('button',name='Log in',exact=True).click();await page.wait_for_function('()=>!!window.__world?.me',timeout=120000);assert await page.locator('.onboarding-flow').count()==0
 print('PASS real form signup and returning-account login',flush=True);await context.close()
async def main():
 fixtures=json.loads(Path(args.fixtures).read_text());hustler=next(f for f in fixtures['all'][1:] if f['origin']=='hustler')
 async with async_playwright() as p:
  browser=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);await journey(browser,hustler,True);await journey(browser,fixtures['found']['dbee'],False);await signup_and_login(browser,hustler);await browser.close()
 print('All onboarding browser journeys passed.',flush=True)
asyncio.run(main())
