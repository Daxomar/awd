"""Check real renderer disposal with the SAME warmed room before/after the map."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
BASE='http://127.0.0.1:8082'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);context=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  cookie=json.loads(Path('.local/hud/fixtures.json').read_text())[0]['cookie'];await context.add_cookies([{'name':'awd_session','value':cookie,'url':BASE}]);page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));await page.goto(BASE,wait_until='domcontentloaded');await page.wait_for_function('()=>!!window.__stage',timeout=120000);await page.evaluate('()=>{__stage.renderer.setPixelRatio(.3);window.__qaDraw=__stage.render.bind(__stage);__stage.render=()=>{};}');await page.wait_for_function('()=>!!window.__world?.me&&__map.ready',timeout=120000)
  if await page.get_by_role('button',name='Skip tour',exact=True).count():await page.get_by_role('button',name='Skip tour',exact=True).click()
  baseline=await page.evaluate('()=>{__qaDraw();return {...__stage.renderer.info.memory};}');await page.get_by_role('button',name='Map',exact=True).click()
  for title,prefix in [('Estates','e:'),('Streets','n:')]:
   await page.locator('.map-filters').get_by_role('button',name=title,exact=True).click();ids=await page.evaluate('()=>[...__map.pins.keys()]');assert len(ids)==9 and all(id.startswith(prefix) or id=='home' for id in ids),ids
  await page.locator('.map-names input').check();await page.evaluate('()=>{__map.focus(...__map.current,5);__map.update(.05);}');assert await page.evaluate('()=>__map.showNames');assert await page.locator('.pin:not([hidden])').evaluate_all('(els)=>els.every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})');await page.locator('.map-names input').uncheck();await page.locator('.map-filters').get_by_role('button',name='All',exact=True).click()
  await page.evaluate('()=>{__map.focus(...__map.current,5);for(let i=0;i<12;i++)__map.update(.05);__qaDraw();}');await page.locator('[data-nav=home]').click()
  result=await page.evaluate('''()=>{
   const objects={geometry:new Set(),material:new Set(),instance:new Set(),texture:new Set()},expected={},released={};
   __map.group.traverse(o=>{if(o.geometry)objects.geometry.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){objects.material.add(m);for(const t of Object.values(m))if(t?.isTexture)objects.texture.add(t);}if(o.isInstancedMesh)objects.instance.add(o);});
   for(const [kind,set]of Object.entries(objects)){expected[kind]=set.size;released[kind]=0;for(const resource of set)resource.addEventListener('dispose',()=>released[kind]++);}
   const before={...__stage.renderer.info.memory};__map.dispose();const afterRelease={...__stage.renderer.info.memory};__qaDraw();return {expected,released,before,afterRelease,afterRoomDraw:{...__stage.renderer.info.memory},cpuPlanReleased:__map.plan===null&&__map.data===null&&__map.chunks.plan.size===0,roomVisible:!!__world.me&&__world.room.group.visible};
  }''');result['baselineRoom']=baseline;assert result['expected']==result['released'],result;assert result['cpuPlanReleased'] and result['roomVisible'];assert result['afterRoomDraw']==baseline,result;assert not errors,errors;Path('.local/city3/resource-audit.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True);await browser.close()
asyncio.run(main())
