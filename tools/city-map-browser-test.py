"""Local-only production-cookie city QA. Uses disposable .local/hud fixtures.
No public accounts or production data. Software rendering timings are NOT FPS.
"""
import argparse, asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright
parser=argparse.ArgumentParser();parser.add_argument('--base',default='http://127.0.0.1:8082');parser.add_argument('--travel',action='store_true');args=parser.parse_args();BASE=args.base.rstrip('/');assert BASE.startswith(('http://127.0.0.1:','http://localhost:'))
OUT=Path('.local/city3');OUT.mkdir(parents=True,exist_ok=True)
async def screenshot(page,name):
 await page.bring_to_front();await page.evaluate('()=>{__map.update(.05);__qaDraw();}');await page.screenshot(path=str(OUT/(name+'.png')),timeout=60000)
async def close(page):
 await page.keyboard.press('Escape');await page.wait_for_timeout(300)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);context=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  fixture=json.loads(Path('.local/hud/fixtures.json').read_text())[0];await context.add_cookies([{'name':'awd_session','value':fixture['cookie'],'url':BASE,'httpOnly':True,'sameSite':'Strict'}]);page=await context.new_page();errors=[];sent=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('websocket',lambda ws:ws.on('framesent',lambda d:sent.append(json.loads(d)) if isinstance(d,str) else None))
  await page.add_init_script("Object.defineProperty(window,'__map',{get(){return this._map;},set(m){this._map=m;const build=m.build.bind(m);m.build=(...a)=>{const t=performance.now(),r=build(...a);window.__qaMapSyncMs=performance.now()-t;return r;};}})")
  print('Opening local game',flush=True);await page.goto(BASE,wait_until='domcontentloaded');await page.wait_for_function('()=>!!window.__stage',timeout=120000);print('Stage ready',flush=True);await page.evaluate('()=>{__stage.renderer.setPixelRatio(.6);window.__qaDraw=__stage.render.bind(__stage);__stage.render=()=>{};}');await page.wait_for_function('()=>!!window.__world?.me',timeout=120000);print('Player ready',flush=True)
  if await page.get_by_role('button',name='Skip tour',exact=True).count():await page.get_by_role('button',name='Skip tour',exact=True).click()
  await page.evaluate('async()=>await __map.terrainReady');print('City ready',flush=True);assert await page.evaluate('()=>!!__map.ready'),await page.locator('.city-loading').inner_text();await page.get_by_role('button',name='Map',exact=True).click()
  await page.evaluate('()=>{__map.overview();for(let i=0;i<15;i++)__map.update(.05);__stage.setTime(13);}');await screenshot(page,'after-overview')
  metrics=await page.evaluate('''()=>{const r=__stage.renderer,times=[];for(let i=0;i<7;i++){const t=performance.now();__qaDraw();r.getContext().finish();times.push(performance.now()-t);}return {syncBuildMs:__qaMapSyncMs,readyMs:__map.readyMs,fetchMs:__map.fetchMs,terrainMs:__map.terrainMs,decodeMs:__map.planMs,renderer:{...r.info.render},memory:{...r.info.memory},map:__map.stats(),softwareRenderMs:times};}''')
  await page.evaluate('()=>{__map.focus(2/.0065*.003,-25/.0065*.003,70/.0065*.003);__map.update(.05);__qaDraw();}');await screenshot(page,'after-baseline-frame');metrics['baselineFrame']=await page.evaluate('()=>({renderer:{...__stage.renderer.info.render},map:__map.stats()})')
  await page.evaluate('()=>{__map.focus(...__map.slotOf("circle"),22/.0065*.003);for(let i=0;i<12;i++)__map.update(.05);}');await screenshot(page,'after-matching-circle')
  for id in ['jamestown','circle','makola','osu','east-legon','madina','airport-city','tema','nima','oyarifa','la','tema-industrial','tema-heavy-industry','legon-hills']:
   await page.evaluate('(id)=>{__map.focusDistrict(id);for(let i=0;i<12;i++)__map.update(.05);}',id);await screenshot(page,'after-'+id)
  await page.evaluate('()=>{const d=__map.districts.find(d=>d.id==="circle");__map.focus(d.x*.003,d.z*.003,5);for(let i=0;i<12;i++)__map.update(.05);__qaDraw();}');metrics['district']=await page.evaluate('()=>({renderer:{...__stage.renderer.info.render},map:__map.stats()})')
  print('PASS city and fourteen district captures',flush=True)
  # Every venue, estate and street is discoverable, independent of active filter.
  travel_before=len([m for m in sent if m.get('t')=='travel']);await page.get_by_role('button',name='Places',exact=True).click();assert await page.locator('.city-place-row').count()==56
  await page.get_by_role('searchbox',name='Find a destination',exact=True).fill('Makola');await page.locator('.city-place-row').first.click();await page.get_by_role('dialog',name='Makola Market',exact=False).wait_for();assert await page.locator('.ride').count()>=5;await close(page);assert len([m for m in sent if m.get('t')=='travel'])==travel_before
  await page.get_by_role('button',name='Explore districts',exact=True).click();assert await page.locator('.city-place-row').count()==68;await page.get_by_role('searchbox',name='Find a district',exact=True).fill('Prampram');await page.locator('.city-place-row').click();await page.wait_for_timeout(700);assert await page.evaluate('()=>Math.abs(__stage.view.target.x-__map.districts.find(d=>d.id==="prampram").x*.003)<.1');assert len([m for m in sent if m.get('t')=='travel'])==travel_before
  await page.get_by_role('button',name='Return to current location',exact=True).click();assert await page.evaluate('()=>Math.hypot(__stage.view.target.x-__map.current[0],__stage.view.target.z-__map.current[1])<.01')
  # Select a real cluster and inspect its members without an implicit trip.
  await page.evaluate('()=>{__map.overview();for(let i=0;i<15;i++)__map.update(.05);}');cluster=page.locator('.pin:not([hidden])').filter(has=page.locator('.pc')).first
  await cluster.click();await page.get_by_role('dialog',name='Choose a place',exact=True).wait_for();assert await page.locator('.city-place-row').count()>1;await close(page)
  print('PASS complete destination directory, district browsing, cluster selection and explicit travel boundary',flush=True)
  for width,height in [(375,812),(390,844),(430,932),(390,530),(844,390)]:
   await page.set_viewport_size({'width':width,'height':height});await page.evaluate('()=>{__map.focus(...__map.current,5);__map.update(.05);}');await screenshot(page,f'after-{width}x{height}')
   rows=await page.locator('.city-controls button').evaluate_all('(els)=>els.map(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,l:r.left,r:r.right,t:r.top,b:r.bottom};})');assert all(r['w']>=44 and r['h']>=44 and r['l']>=0 and r['r']<=width+1 and r['t']>=0 and r['b']<=height for r in rows),(width,height,rows)
   assert await page.locator('.online-count').is_visible();assert not await page.locator('.joy').is_visible()
   before=await page.evaluate('()=>__stage.view.target.toArray()');await page.get_by_role('button',name='Places',exact=True).click();await page.mouse.move(35,210);await page.mouse.down();await page.mouse.move(90,260);await page.mouse.up();assert await page.evaluate('()=>__stage.view.target.toArray()')==before;await close(page)
  await page.set_viewport_size({'width':390,'height':844});await page.evaluate('()=>{__map.focus(...__map.current,5);__map.update(.05);}');target=await page.evaluate('()=>__stage.view.target.toArray()');await page.mouse.move(120,280);await page.mouse.down();await page.mouse.move(180,340,steps=5);await page.mouse.up();assert await page.evaluate('()=>__stage.view.target.toArray()')!=target
  await page.mouse.wheel(0,240);assert await page.evaluate('()=>__stage.view.zoom')>5
  # Real two-finger CDP touch gestures exercise the existing pointer pipeline.
  session=await context.new_cdp_session(page);zoom=await page.evaluate('()=>__stage.view.zoom');touch=lambda x,y,i:{'x':x,'y':y,'id':i,'radiusX':3,'radiusY':3,'force':1}
  await session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[touch(130,330,1),touch(230,330,2)]});await session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[touch(100,330,1),touch(260,330,2)]});await session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert await page.evaluate('()=>__stage.view.zoom')<zoom
  print('PASS five viewports, HUD isolation, pan, wheel and two-finger zoom',flush=True)
  # Tour every district, exercising generation, LRU eviction and repeat entry.
  metrics['cacheTour']=await page.evaluate('''()=>{for(const d of __map.districts){__map.focusDistrict(d.id);for(let i=0;i<10;i++)__map.update(.05);}return __map.stats();}''');assert metrics['cacheTour']['chunks']['cached']<=12;assert metrics['cacheTour']['chunks']['evicted']>0
  await page.get_by_role('button',name='Return to current location',exact=True).click();await page.evaluate('()=>{for(let i=0;i<12;i++)__map.update(.05);__qaDraw();}');stable=await page.evaluate('()=>({map:__map.stats(),memory:{...__stage.renderer.info.memory}})')
  for _ in range(8):
   await page.locator('[data-nav=home]').click();assert await page.evaluate('()=>__stage.view.dist')==60;await page.get_by_role('button',name='Map',exact=True).click();await page.evaluate('()=>{__map.focus(...__map.current,5);for(let i=0;i<12;i++)__map.update(.05);__qaDraw();}')
  metrics['reentry']=await page.evaluate('()=>({map:__map.stats(),memory:{...__stage.renderer.info.memory}})');assert metrics['reentry']['memory']==stable['memory'];assert metrics['reentry']['map']['geometryBytes']==stable['map']['geometryBytes']
  print('PASS all 68 districts, bounded detail cache and eight repeat entries without resource growth',flush=True)
  if args.travel:
   destination='circle' if await page.evaluate('()=>__G.state.place')=='n:nima' else 'n:nima';query='Kwame Nkrumah Circle' if destination=='circle' else 'Nima neighbourhood'
   await page.get_by_role('button',name='Places',exact=True).click();await page.get_by_role('searchbox',name='Find a destination',exact=True).fill(query);await page.locator('.city-place-row').first.click();await page.locator('.ride').filter(has_text='Trotro').click();before=await page.evaluate('()=>({funds:__G.state.cash+__G.state.momo,place:__G.state.place})');await page.locator('.sheet-back.in .sheet-body > .btn.primary.wide').click();await page.wait_for_function('()=>!!__G.state.busy?.travel',timeout=20000);await page.wait_for_function('(id)=>__G.state.place===id',arg=destination,timeout=90000);after=await page.evaluate('()=>({funds:__G.state.cash+__G.state.momo,place:__G.state.place})');assert after['funds']<before['funds'];metrics['travel']={'before':before,'after':after};print('PASS authoritative trip and arrival',flush=True)
  # Full map teardown must release shared city and instance resources, while the
  # active room and saved state remain usable. This is the final destructive-to-UI
  # step, confined to this disposable browser context.
  if await page.evaluate('()=>__map.group.visible'):await page.locator('[data-nav=home]').click()
  await page.wait_for_function('()=>!!__world.me&&__world.room.group.visible&&__stage.view.dist===60',timeout=30000)
  metrics['dispose']=await page.evaluate('()=>{__map.dispose();__qaDraw();return {children:__map.group.children.length,chunks:__map.chunks.stats(),memory:{...__stage.renderer.info.memory},room:!!__world.me&&__world.room.group.visible};}');assert metrics['dispose']['children']==0 and metrics['dispose']['chunks']['cached']==0 and metrics['dispose']['room'];assert not errors,errors
  (OUT/'after-metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8');print(json.dumps(metrics),flush=True);await browser.close()
asyncio.run(main())
