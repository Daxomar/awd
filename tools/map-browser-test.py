"""Focused compiled-preview checks for map labels and mobile filter hit targets."""
exec(open('tools/game-browser-test.py',encoding='utf8').read().split('async def main():')[0])
BASE='http://127.0.0.1:8080'
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=await b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await make_player(page,'qa_map'+str(int(time.time()))[-6:]);await page.get_by_role('button',name='Skip tour',exact=True).click();await page.evaluate('__stage.render=()=>{}')
  await page.locator('[data-nav=map]').click();await page.evaluate('async()=>{await __map.terrainReady;__map.update(.05);__qaDraw();}')
  await page.get_by_label('Names',exact=True).check();await page.evaluate('__map.update(.05)');assert await page.evaluate('[...__map.pins.values()].every(p=>!p.el.classList.contains("small"))')
  await page.get_by_label('Names',exact=True).uncheck()
  await page.evaluate('()=>{const p=__map.pins.get("cinema");__map.focus(p.x,p.z,22);__map.update(.05);__qaDraw();}')
  cinema=page.get_by_role('button',name='Silverbird Cinemas, Accra Mall',exact=True)
  await cinema.hover();await cinema.locator('.pl').wait_for(state='visible');assert await cinema.locator('.pl').inner_text()=='Silverbird Cinemas, Accra Mall'
  await page.screenshot(path=str(OUT/'city-map-tooltip.png'))
  await cinema.press('ArrowDown');assert await cinema.locator('.pl').is_visible()
  await page.get_by_role('button',name='Estates',exact=True).click();assert await page.evaluate('[...__map.pins.keys()].every(id=>id==="home"||id.startsWith("e:"))')
  await page.get_by_role('button',name='Streets',exact=True).click();assert await page.evaluate('[...__map.pins.keys()].every(id=>id==="home"||id.startsWith("n:"))')
  await page.get_by_role('button',name='Sound settings',exact=True).click();await page.get_by_label('Music',exact=True).wait_for()
  assert not errors,errors
  print('PASS compact map labels, full hover and keyboard names, mobile Names/Estates/Streets filters and reachable sound controls',flush=True);await b.close()
asyncio.run(main())
