exec(open('tools/game-browser-test.py',encoding='utf8').read().split('async def main():')[0])
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  contexts=[await b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True) for _ in range(2)];a,c=[await x.new_page() for x in contexts];errors=[]
  for page in [a,c]:page.on('pageerror',lambda e:errors.append(str(e)))
  tag=str(int(time.time()))[-7:];await make_player(a,'phonea'+tag);await a.evaluate('__stage.render=()=>{}');await make_player(c,'phoneb'+tag,'f')
  for page in [a,c]:await page.get_by_role('button',name='Skip tour').click()
  names=[await page.evaluate('__G.state.name') for page in [a,c]]
  # Reopening the phone during its close animation must keep the new window.
  await a.evaluate('(name)=>{__act.phone("contacts",name);__act.closePhone();__act.phone("contacts",name);}',names[1]);await asyncio.sleep(.5)
  await a.locator('.profile-portrait img').wait_for(timeout=60000);assert await a.locator('.phone-back').is_visible();await a.screenshot(path=str(OUT/'09-profile.png'))
  await a.evaluate('(name)=>__act.phone("games",{with:name})',names[1]);await a.get_by_role('button',name='Invite player',exact=True).nth(2).click();await a.get_by_text('Invitation sent. They can accept from their phone.',exact=True).wait_for()
  await c.evaluate('__act.phone("games")');await c.locator('.game-row').first.click();await c.get_by_role('button',name='Accept',exact=True).click()
  await a.get_by_role('button',name='Draw a card',exact=True).click();await a.locator('.card-hand button').nth(7).wait_for();await c.get_by_role('button',name='Draw a card',exact=True).wait_for(state='visible');await c.wait_for_function("!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Draw a card').disabled")
  assert await a.locator('.card-hand button').count()==8;assert await c.locator('.card-hand button').count()==7
  await a.screenshot(path=str(OUT/'13-colour-cards.png'));await a.evaluate('__act.closePhone()');await asyncio.sleep(.5);await a.locator('[data-nav=map]').click()
  await a.evaluate('()=>{__stage.view.zoom=68;__stage.view.target.set(0,0,-20);__stage.applyView();__map.update(.01);__qaDraw();}');await a.screenshot(path=str(OUT/'14-map-overview.png'))
  assert not errors,errors;print('PASS face portrait, rapid phone reopen, mobile card hand privacy and drawing, geographic map overview',flush=True);await b.close()
asyncio.run(main())
