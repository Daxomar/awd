exec(open('tools/game-browser-test.py',encoding='utf8').read().split('async def main():')[0])
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=await b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(BASE,wait_until='domcontentloaded')
  name='start'+str(int(time.time()))[-7:]
  res=await page.request.post(BASE+'/api/signup',data={'username':name,'password':'qa-new-life-2026','dob':'1995-01-01','agree':True});data=await res.json();assert data.get('token'),data
  await page.goto(BASE+'/?token='+data['token'],wait_until='domcontentloaded')
  await page.get_by_role('button',name='Woman',exact=True).wait_for(timeout=120000)
  await page.evaluate("()=>{__stage.renderer.setPixelRatio(.65);window.__qaDraw=__stage.render.bind(__stage);__stage.render=()=>{};}")
  await page.get_by_role('button',name='Woman',exact=True).click()
  await page.get_by_label('Bust',exact=True).fill('0.8');await page.get_by_label('Bust',exact=True).dispatch_event('input')
  await page.get_by_role('button',name='Next',exact=True).click()
  await page.locator('.opt').nth(0).click();await page.locator('.opt').nth(1).click()
  await page.get_by_role('button',name='Next (2/2)',exact=True).click()
  await page.get_by_role('button',name='Roll the birth lottery',exact=True).click();await page.get_by_role('button',name='Choose your first home',exact=True).click()
  roll=await page.evaluate('__G.state.birthOrigin');count=await page.locator('.opt').count();assert count==(3 if roll=='dbee' else 2),(roll,count)
  await page.locator('.opt').last.click();await page.evaluate('__qaDraw()');await page.screenshot(path=str(OUT/'12-new-life-housing.png'))
  await page.get_by_role('button',name='Move into Accra',exact=True).click()
  await page.get_by_role('button',name='Enter Accra',exact=True).click()
  await page.get_by_role('button',name='Skip tour',exact=True).wait_for();await page.get_by_role('button',name='Skip tour',exact=True).click()
  await page.wait_for_function('!!__world.me');state=await page.evaluate('({home:__G.state.home,job:__G.state.job,loan:__G.state.loan,look:__G.state.look,name:__G.state.name})')
  assert state['job'] is None and state['loan'] is None and state['look']['body']=='f' and state['look']['bust']==.8,state
  assert not errors,errors
  print('PASS fresh mobile onboarding, human customization, two traits, rolled housing choices, no assigned job or debt',json.dumps(state),flush=True)
  await b.close()
asyncio.run(main())
