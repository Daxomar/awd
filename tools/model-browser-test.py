"""Verify the portable GLBs visually and exercise the compiled character creator."""
exec(open('tools/game-browser-test.py',encoding='utf8').read().split('async def main():')[0])
BASE='http://127.0.0.1:8080'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=await browser.new_page(viewport={'width':450,'height':800});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(BASE+'/model-review.html',wait_until='domcontentloaded')
  await page.wait_for_function('window.__modelReview?.ready',timeout=90000)
  await page.evaluate('__modelReview.renderer.setPixelRatio(.65);__modelReview.renderer.setAnimationLoop(null)')
  for sex in ['male','female']:
   await page.get_by_role('button',name='Man' if sex=='male' else 'Woman',exact=True).click()
   await page.wait_for_function('(sex)=>__modelReview.sex===sex',arg=sex,timeout=90000)
   await page.get_by_role('status').filter(has_text='Rigged GLB').wait_for()
   await page.evaluate('__modelReview.mixer.update(.01);__modelReview.draw()')
   bounds=await page.evaluate('()=>{let lo=Infinity,hi=-Infinity,meshes=0;__modelReview.model.updateMatrixWorld(true);__modelReview.model.traverse(m=>{if(!m.isSkinnedMesh)return;m.skeleton.update();meshes++;for(let i=0;i<m.geometry.attributes.position.count;i++){const v=m.position.clone();m.getVertexPosition(i,v);v.applyMatrix4(m.matrixWorld);if(!Number.isFinite(v.x+v.y+v.z))throw Error("Invalid GLB vertex");lo=Math.min(lo,v.y);hi=Math.max(hi,v.y);}});return {height:hi-lo,meshes};}')
   assert 1.4<bounds['height']<2.2 and bounds['meshes']>=7,bounds
   await page.screenshot(path=str(OUT/f'model-{sex}-portable.png'))
   await page.get_by_role('button',name='Walk',exact=True).click()
   before=await page.evaluate('__modelReview.mixer.time');await page.evaluate('__modelReview.mixer.update(.4);__modelReview.draw()');assert await page.evaluate('__modelReview.mixer.time')>before
   await page.get_by_role('button',name='Walk',exact=True).click()
   print('PASS portable',sex,bounds,flush=True)
  await page.set_viewport_size({'width':390,'height':844})
  await make_player(page,'qa_model'+str(int(time.time()))[-6:])
  await page.get_by_role('button',name='Skip tour',exact=True).click(no_wait_after=True)
  await page.locator('.zone',has_text='Wardrobe').click()
  await page.get_by_role('button',name='Woman',exact=True).click();await page.get_by_label('Bust',exact=True).fill('0.8');await page.get_by_label('Bust',exact=True).dispatch_event('input')
  # The studio is translated 500m from the city; switching rigs must stay local.
  assert await page.evaluate('()=>{const a=__studio.av;a.root.updateMatrixWorld(true);a.skeleton.update();const m=a.meshes.find(m=>m.name==="skin"),v=a.root.position.clone();m.getVertexPosition(0,v);return Math.abs(v.x)<2&&Math.abs(v.z)<2&&Math.abs(v.y)<3;}')
  await page.get_by_role('button',name='Wear this',exact=True).click();await page.wait_for_function('__G.state.look.body==="f"&&__G.state.look.bust===.8')
  await page.locator('.zone',has_text='Walk outside').click();await page.wait_for_function('__G.state.place.startsWith("n:")',timeout=30000)
  assert await page.evaluate('__world.me.av.native===true')
  assert not errors,errors
  print('PASS compiled character creator, translated studio gender switch, saved body morph and walking outdoors',flush=True);await browser.close()
asyncio.run(main())
