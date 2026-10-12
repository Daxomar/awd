exec(open('tools/game-browser-test.py',encoding='utf8').read().split('async def main():')[0])
import os
BASE=os.environ.get('AWD_TEST_URL',BASE)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=await b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);errors=[];warnings=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:warnings.append(m.text) if 'unknown item' in m.text or '[net handler' in m.text else None)
  name='city'+str(int(time.time()))[-7:];token=await make_player(page,name)
  await page.get_by_role('button',name='Skip tour',exact=True).click();await page.evaluate('__stage.render=()=>{}')
  await page.locator('.zone',has_text='Walk outside').click();await page.wait_for_function('__G.state.place.startsWith("n:")',timeout=30000)
  await page.locator('.zone',has_text='Go indoors').wait_for();await page.evaluate('__qaDraw();__world.update(0);__qaDraw()');await page.screenshot(path=str(OUT/'city-neighbourhood.png'))
  await page.locator('.zone',has_text='Provisions shop').click();await page.locator('.act',has_text='Water and a snack').wait_for();await page.locator('.sheet-x').click()
  await page.locator('.zone',has_text='Neighbourhood food joint').click();await page.locator('.act',has_text='Jollof at the neighbourhood joint').wait_for();await page.locator('.sheet-x').click()
  await page.locator('.zone',has_text='Barber shop').click();await page.locator('.act',has_text='Choose a hairstyle').click();await page.locator('.sty').wait_for();await page.locator('.sty-foot').get_by_role('button',name='Close',exact=True).click()
  assert await page.evaluate('__world.room.screens.length')>0
  before=await page.evaluate('()=>__world.room.screens[0].texture.image.toDataURL()');await page.evaluate('__world.room.update(1)');after=await page.evaluate('()=>__world.room.screens[0].texture.image.toDataURL()');assert before!=after
  await page.evaluate('()=>{window.__npc=__world.room.people.get("npc2");window.__npcBefore=[__npc.x,__npc.z];for(let i=0;i<150;i++)__world.update(.05);}');assert await page.evaluate('Math.hypot(__npc.x-__npcBefore[0],__npc.z-__npcBefore[1])>.1')
  await page.locator('.zone',has_text='Viewing centre').click();await page.locator('.act',has_text='Match predictions').click();await page.locator('.match-card').first.wait_for()
  assert await page.locator('.match-card').count()==6;await page.locator('.match-card').get_by_role('button',name='Home ×2.3',exact=True).first.click();await page.wait_for_function('__G.state.flags.matchBets?.length===1');await page.screenshot(path=str(OUT/'city-matches.png'));await page.locator('.sheet-x').click()
  await page.locator('.zone',has_text='Player-owned estate').click();await page.wait_for_function('__G.state.place.startsWith("e:")',timeout=30000);await page.locator('.estate-panel').wait_for()
  assert await page.evaluate('__world.room.items.every(r=>!r.spec.owner||r.spec.owner.home===__G.state.place.slice(2))')
  await page.evaluate('__qaDraw()');await page.screenshot(path=str(OUT/'city-estate.png'))
  await page.locator('.zone',has_text='Back to neighbourhood').click();await page.wait_for_function('__G.state.place.startsWith("n:")',timeout=30000)
  await page.locator('.zone',has_text='Go indoors').click();await page.wait_for_function('__G.state.place==="home"',timeout=30000)
  await page.get_by_role('button',name='Sound settings',exact=True).click();await page.get_by_label('Music',exact=True).fill('0.3');await page.get_by_label('Music',exact=True).dispatch_event('input');await page.wait_for_function('__audio.ctx?.state==="running"');await page.get_by_role('button',name='Mute all',exact=True).click();assert await page.evaluate('__audio.settings.muted')
  await page.locator('.sheet-x').click();await page.locator('[data-nav=map]').click();await page.evaluate('async()=>{await __map.terrainReady;__map.update(.05);__qaDraw();}')
  stats=await page.evaluate('({plots:__map.backgroundPlots,markers:__map.pins.size,triangles:__stage.renderer.info.render.triangles})');assert stats['plots']>400,stats;print('Map density',stats,flush=True)
  assert await page.evaluate('[...__map.pins.values()].every(p=>p.el.classList.contains("small")&&p.el.getAttribute("aria-label")===p.it.name)')
  await page.screenshot(path=str(OUT/'city-map.png'));await page.get_by_label('Names',exact=True).check();await page.evaluate('__map.update(.05)');assert await page.evaluate('[...__map.pins.values()].every(p=>!p.el.classList.contains("small"))')
  await page.get_by_label('Names',exact=True).uncheck();await page.evaluate('()=>{const p=__map.pins.get("cinema");__map.focus(p.x,p.z,22);__map.update(.05);}')
  cinema=page.get_by_role('button',name='Silverbird Cinemas, Accra Mall',exact=True);await cinema.hover();assert await cinema.locator('.pl').inner_text()=='Silverbird Cinemas, Accra Mall';assert await cinema.locator('.pl').is_visible()
  await page.get_by_role('button',name='Estates',exact=True).click();assert await page.evaluate('[...__map.pins.keys()].every(id=>id==="home"||id.startsWith("e:"))')
  await page.get_by_role('button',name='Streets',exact=True).click();assert await page.evaluate('[...__map.pins.keys()].every(id=>id==="home"||id.startsWith("n:"))')
  assert not errors,errors;assert not warnings,warnings
  print('PASS mobile home/street/estate/return routes, moving NPC, animated TV, mixed match board, audio controls and map density',json.dumps(stats),flush=True);await b.close()
asyncio.run(main())

