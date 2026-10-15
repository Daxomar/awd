"""Play the local production client with two disposable accounts. No public URLs.
Create fresh fixtures with server/loadtest/hud-fixtures.js; artifacts in .local/hud.
"""
import argparse,asyncio,json,re
from pathlib import Path
from playwright.async_api import async_playwright
parser=argparse.ArgumentParser();parser.add_argument('--base',default='http://127.0.0.1:8082');parser.add_argument('--social-only',action='store_true',help='Resume social/travel checks with the same fixtures already on their Nima street');args=parser.parse_args();BASE=args.base.rstrip('/');assert BASE.startswith(('http://127.0.0.1:','http://localhost:'))
OUT=Path('.local/hud');OUT.mkdir(parents=True,exist_ok=True)
async def shot(page,name):
 await page.bring_to_front();await page.wait_for_timeout(350);await page.evaluate('()=>window.__qaDraw?.()');await page.screenshot(path=str(OUT/(name+'.png')),timeout=45000)
async def close_menu(page):
 await page.keyboard.press('Escape');await page.wait_for_timeout(350)
async def interact(page):
 await page.get_by_role('button',name='Interact',exact=True).click();await page.get_by_role('dialog',name='Around you',exact=True).wait_for()
async def zone(page,label):
 await interact(page);await page.locator('.zone').filter(has_text=re.compile('^'+re.escape(label)+'$')).click();await page.get_by_role('dialog',name=label,exact=True).wait_for()
async def route(page,label,expected):
 await zone(page,label);await page.get_by_role('dialog',name=label,exact=True).get_by_role('button',name=label,exact=True).click();await page.wait_for_function('(s)=>__G.state.place===s',arg=expected,timeout=60000)
async def opened(browser,fixture):
 context=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);await context.add_cookies([{'name':'awd_session','value':fixture['cookie'],'url':BASE,'httpOnly':True,'sameSite':'Strict'}]);page=await context.new_page();errors=[];sent=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('websocket',lambda ws:ws.on('framesent',lambda d:sent.append(json.loads(d)) if isinstance(d,str) else None))
 await page.goto(BASE,wait_until='domcontentloaded');await page.wait_for_function('()=>!!window.__stage',timeout=120000);await page.evaluate('()=>{__stage.renderer.setPixelRatio(.75);window.__qaDraw=__stage.render.bind(__stage);__stage.render=()=>{};}');await page.wait_for_function('()=>!!window.__world?.me',timeout=120000)
 skip=page.get_by_role('button',name='Skip tour',exact=True)
 if await skip.count():await skip.click()
 await page.wait_for_timeout(400);return context,page,errors,sent
async def layout(page):
 for width,height in [(375,812),(390,844),(430,932),(390,530),(844,390)]:
  await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(300)
  await page.locator('.joy').wait_for(state='visible',timeout=5000)
  rects=await page.evaluate('()=>[...document.querySelectorAll(".play-nav button,.player-status,.wallet-control,.location-control")].map(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom};})')
  assert all(r['w']>=44 and r['h']>=44 and r['left']>=0 and r['right']<=width+1 and r['bottom']<=height+1 for r in rects),(width,height,rects)
  await shot(page,f'hud-{width}x{height}');await page.get_by_role('button',name='Character status',exact=True).click();await shot(page,f'needs-{width}x{height}');await close_menu(page)
  await page.get_by_role('button',name='Phone',exact=True).click();await page.get_by_role('button',name='Put phone away',exact=True).wait_for();await shot(page,f'phone-{width}x{height}');assert await page.get_by_role('button',name='Put phone away',exact=True).is_visible();await page.get_by_role('button',name='Put phone away',exact=True).click();await page.wait_for_timeout(450)
 await page.set_viewport_size({'width':390,'height':844});print('PASS five layouts, phone dismissal, status and reachable controls',flush=True)
async def main():
 fixtures=json.loads((OUT/'fixtures.json').read_text())
 async with async_playwright() as p:
  browser=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ca,a,ea,sa=await opened(browser,fixtures[0])
  if not args.social_only:
   assert await a.evaluate('()=>__G.state.place')=='home';assert await a.locator('.joy').is_visible();assert await a.locator('.location-control').inner_text() and 'Nima' in await a.locator('.location-control').inner_text()
   await a.get_by_role('button',name='Character status',exact=True).click();assert await a.locator('[data-need=energy]').get_attribute('data-status')=='critical';await a.locator('[data-need=energy]').click();await a.get_by_role('button',name='Nap (2h)',exact=False).first.click();await a.get_by_role('dialog',name='Bed',exact=True).wait_for();assert await a.evaluate('()=>!!__world.selection');await shot(a,'bed-selected');await close_menu(a)
   await layout(a)
   # A live server refresh must preserve keyboard focus in the status sheet.
   await a.emulate_media(reduced_motion='reduce');await a.get_by_role('button',name='Character status',exact=True).click();await a.locator('[data-need=energy]').focus();await a.wait_for_timeout(5500);assert await a.evaluate('()=>document.activeElement?.dataset.need')=='energy';assert await a.locator('.sheet').evaluate('(e)=>getComputedStyle(e).transitionDuration')=='0s';await close_menu(a)
   # Select the actual bed through the canvas rather than the options list.
   point=await a.evaluate("""()=>{__qaDraw();const z=__world.spec.zones.find(z=>z.label==='Bed'),p=__world.room.items[z.item].obj.position;for(const y of [.5,.3,.7])for(const dx of [0,.3,-.3])for(const dz of [0,.3,-.3]){const [x,v]=__world.screenOf(p.x+dx,y,p.z+dz),hit=__world.pick(x,v);if(hit?.type==='zone'&&hit.zone.id===z.id)return [x,v];}return null;}""")
   assert point,'No visible bed picking point';await a.mouse.click(*point);await a.get_by_role('dialog',name='Bed',exact=True).wait_for();assert await a.evaluate('()=>!!__world.selection');await close_menu(a)
   phone_button=a.get_by_role('button',name='Phone',exact=True);await phone_button.focus();await a.keyboard.press('Enter');await a.get_by_role('button',name='Phone home',exact=True).wait_for();assert await a.get_by_role('button',name='Phone home',exact=True).evaluate('(e)=>document.activeElement===e');await a.keyboard.press('Escape');await a.wait_for_timeout(400);assert await phone_button.evaluate('(e)=>document.activeElement===e');assert await a.locator('.notif').get_attribute('hidden') is not None
   # Cancel a real handset confirmation, then close its host while another is open.
   banks=len([m for m in sa if m.get('t')=='bank']);await a.evaluate("()=>__act.app('bank')");await a.locator('.cell').filter(has_text=re.compile('^Borrow')).first.click();await a.locator('.ios-alert').wait_for();await a.keyboard.press('Escape');assert not await a.locator('.ios-alert').count();await a.locator('.cell').filter(has_text=re.compile('^Borrow')).first.click();await a.get_by_role('button',name='Put phone away',exact=True).click();await a.wait_for_timeout(450);assert not await a.locator('.ios-alert').count();assert len([m for m in sa if m.get('t')=='bank'])==banks
   # Landscape springboard scroll keeps the existing dock apps reachable.
   await a.set_viewport_size({'width':844,'height':390});await phone_button.click();await a.locator('.dock .app').first.scroll_into_view_if_needed();await a.locator('.dock .app').first.click();assert await a.locator('.appwin').count()==1;await a.get_by_role('button',name='Phone home',exact=True).click();assert await a.evaluate('()=>!__phone.win');await a.get_by_role('button',name='Put phone away',exact=True).click();await a.wait_for_timeout(450);await a.set_viewport_size({'width':390,'height':844})
   print('PASS canvas object picking, reduced motion, focus continuity, handset confirmations and landscape dock',flush=True)
   # Opening and dismissing UI must not send world movement, including landscape margins.
   await a.wait_for_function('()=>!__world.me.path.length',timeout=30000);moves=len([m for m in sa if m.get('t')=='rmv']);await zone(a,'Bed');await a.set_viewport_size({'width':844,'height':390});await a.mouse.click(30,190);await a.wait_for_timeout(300);assert len([m for m in sa if m.get('t')=='rmv'])==moves;await close_menu(a);assert not await a.evaluate('()=>!!__world.selection');await a.set_viewport_size({'width':390,'height':844});await a.wait_for_timeout(400);assert await a.locator('.joy').is_visible()
   j=await a.locator('.joy').bounding_box();await a.mouse.move(j['x']+j['width']/2,j['y']+j['height']/2);await a.mouse.down();await a.mouse.move(j['x']+j['width']*.75,j['y']+j['height']/2);await a.wait_for_timeout(250);await a.mouse.up();assert len([m for m in sa if m.get('t')=='rmv'])>moves
   await a.mouse.move(280,280);await a.mouse.down();await a.evaluate('()=>__hud.openStatus()');target=await a.evaluate('()=>__stage.view.target.toArray()');await a.mouse.move(310,300);await a.mouse.up();assert await a.evaluate('()=>__stage.view.target.toArray()')==target;await close_menu(a)
   print('PASS UI/world pointer isolation and joystick recovery',flush=True)
   # A real rejection remains in the context menu; no optimistic start or reward.
   await zone(a,'Bed');await a.evaluate("()=>{const send=__net.send.bind(__net);__net.send=m=>{if(m.t==='act'){__net.send=send;return send({...m,id:'invalid_action'});}return send(m);};}");await a.locator('.act').filter(has_text='Nap (2h)').click();await a.locator('.context-error:not([hidden])').wait_for(timeout=15000);await shot(a,'rejected-action');assert not await a.evaluate('()=>!!__G.state.busy');await close_menu(a)
   # Start/cancel only after confirmation; then complete a real short activity.
   await zone(a,'Bed');await a.locator('.act').filter(has_text='Nap (2h)').click();await a.wait_for_function('()=>__G.state.busy?.id==="nap"');await a.get_by_role('button',name='Stop activity',exact=True).click();await a.wait_for_function('()=>!__G.state.busy')
   await zone(a,'Compound bath & WC');await a.locator('.act').filter(has_text=re.compile('Bath')).first.click();await a.wait_for_function('()=>__G.state.busy?.id==="bath"');await a.locator('.joy').wait_for(state='visible');await shot(a,'activity-progress');await a.wait_for_function('()=>!__G.state.busy',timeout=20000);await a.locator('.toast').filter(has_text='Activity complete').wait_for();await a.wait_for_function('()=>__G.state.n.hygiene>=99',timeout=10000)
   await zone(a,'Bed');await a.locator('.act').filter(has_text='Nap (2h)').click();await a.wait_for_function('()=>__G.state.busy?.id==="nap"');await a.wait_for_function('()=>!__G.state.busy',timeout=30000);await a.wait_for_function('()=>__G.state.n.energy>30',timeout=10000)
   print('PASS rejected action, confirmed activity, supported cancellation and real needs recovery',flush=True)
   # Repeated phone app and context lifetimes must not accumulate network listeners.
   baseline=await a.evaluate('()=>Object.fromEntries(Object.entries(__net.h).map(([k,v])=>[k,v.length]))')
   for _ in range(4):
    await a.get_by_role('button',name='Phone',exact=True).click();await a.locator('.app').filter(has_text=re.compile('Contacts')).click();await a.get_by_role('button',name='Put phone away',exact=True).click();await a.wait_for_timeout(450)
   now=await a.evaluate('()=>Object.fromEntries(Object.entries(__net.h).map(([k,v])=>[k,v.length]))');assert all(n==baseline.get(k,0) for k,n in now.items()),(baseline,now)
   await ca.set_offline(True);await a.evaluate('()=>__net.ws.close()');await a.locator('.connection-note:not([hidden])').wait_for();await shot(a,'disconnected');await ca.set_offline(False);await a.wait_for_function('()=>__net.connected',timeout=30000);await a.wait_for_function('()=>!!__world.me',timeout=30000);await a.locator('.connection-note').wait_for(state='hidden');assert 'Nima' in await a.locator('.location-control').inner_text()
   print('PASS phone listener cleanup and reconnect HUD',flush=True)
   await route(a,'Walk outside','n:nima');await shot(a,'neighbourhood')
  cb,b,eb,sb=await opened(browser,fixtures[1])
  if await b.evaluate('()=>__G.state.place')=='home':await route(b,'Walk outside','n:nima')
  await a.wait_for_function('()=>__world.others.size>0');await b.wait_for_function('()=>__world.others.size>0')
  if args.social_only:
   await b.evaluate('(name)=>__act.message(name)',fixtures[0]['username']);await b.get_by_placeholder('Private message',exact=True).wait_for();await b.locator('.thread-portrait').wait_for()
   accept=b.get_by_role('button',name='Accept',exact=True)
   if await accept.count():await accept.click();await b.get_by_role('button',name='Accept',exact=True).wait_for(state='hidden')
   await b.get_by_role('button',name='Put phone away',exact=True).click();await b.wait_for_timeout(450)
  async def person(page,username):
   await page.bring_to_front();await interact(page);await page.get_by_role('button',name='@'+username,exact=False).click()
   try:await page.locator('.socials').wait_for(timeout=15000)
   except Exception:
    retry=page.get_by_role('button',name='Try again',exact=True)
    if not await retry.count():raise
    print('Profile retry:',await page.locator('.context-error').inner_text(),flush=True);await retry.click();await page.locator('.socials').wait_for(timeout=15000)

  profile_count=await a.evaluate('()=>__net.h.profile?.length||0')
  for _ in range(4):await person(a,fixtures[1]['username']);await close_menu(a)
  assert await a.evaluate('()=>__net.h.profile?.length||0')==profile_count
  await person(a,fixtures[1]['username']);await shot(a,'nearby-player');await a.get_by_role('button',name='Wave',exact=True).click();await a.locator('.toast').filter(has_text='Wave with').wait_for(timeout=15000)
  await a.get_by_role('button',name='Chat',exact=True).click();await a.get_by_role('textbox',name='Message',exact=True).fill('Meet by the viewing centre.');await a.get_by_role('button',name='Send message',exact=True).click();await b.get_by_role('button',name='Chat',exact=True).click();await b.locator('.chat-message').filter(has_text='Meet by the viewing centre.').wait_for();await shot(b,'two-player-chat');await b.get_by_role('button',name='Close chat',exact=True).click();await a.get_by_role('button',name='Close chat',exact=True).click()
  # Accept a real friendly Oware invitation. Confirm must resolve before sheet dismissal.
  await person(a,fixtures[1]['username']);await a.get_by_role('button',name='Challenge to Oware',exact=True).click();await a.get_by_role('button',name='Friendly game',exact=False).click();await b.get_by_role('button',name='Play',exact=True).click();await a.locator('.ow').wait_for();await b.locator('.ow').wait_for();await a.locator('.ow-x').click();await a.locator('.ow-x').click();await a.get_by_role('button',name='Done',exact=True).click();await b.get_by_role('button',name='Done',exact=True).click();print('PASS confirmed friendly Oware acceptance',flush=True)
  # Exercise the banner key handler in its receive turn: a slow software-rendered
  # desktop must not let the real 4.2-second banner expire between tool commands.
  await b.evaluate("""()=>{window.__qaNotification=null;const off=__net.on('dm_in',()=>{off();const banner=__phone.banner,result={unread:__G.unreadDm,badge:!document.querySelector('[data-nav=phone] .badge').hidden};banner.focus();banner.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));window.__qaNotification={...result,opened:__phone.open&&__phone.win?.app.id==='messages'};});}""")
  await person(a,fixtures[1]['username']);await a.get_by_role('button',name='Private message',exact=True).click();await a.get_by_placeholder('Private message',exact=True).wait_for();await a.locator('.thread-portrait').wait_for();await a.get_by_placeholder('Private message',exact=True).fill('Hello from Nima');await a.locator('.composer .send').click();await b.wait_for_function('()=>!!window.__qaNotification');result=await b.evaluate('()=>__qaNotification');assert result['unread']>=1 and result['badge'] and result['opened'],result
  await b.get_by_placeholder('Private message',exact=True).wait_for();await b.get_by_role('button',name='Put phone away',exact=True).click();await b.locator('.notif').wait_for(state='hidden');await shot(a,'private-message');await a.get_by_role('button',name='Put phone away',exact=True).click()
  print('PASS two-player discovery, wave, city chat, private message and unread badge',flush=True)
  await cb.close()
  # Existing map and fares, no destination or economy changes.
  funds=await a.evaluate('()=>__G.state.cash+__G.state.momo');await a.get_by_role('button',name='Map',exact=True).click();await a.evaluate("()=>__act.place('circle')");await a.locator('.ride').filter(has_text='Trotro').click();await shot(a,'travel-choice');await a.locator('.sheet-back.in .sheet-body > .btn.primary.wide').click();await a.wait_for_function('()=>!!__G.state.busy?.travel');await a.wait_for_function('()=>__G.state.cash+__G.state.momo<'+str(funds),timeout=10000);await shot(a,'on-the-road');assert await a.evaluate('()=>__act.context()') is None;await a.reload(wait_until='domcontentloaded');await a.wait_for_function('()=>window.__world?.me&&(__ride?.active||__G.state.place==="circle")',timeout=120000);await a.evaluate('()=>{__stage.renderer.setPixelRatio(.75);window.__qaDraw=__stage.render.bind(__stage);__stage.render=()=>{};}');await shot(a,'restored-journey');
  if await a.evaluate('()=>!!__G.state.busy?.travel'):
   assert 'On the road' in await a.locator('.location-control').inner_text();assert await a.get_by_role('button',name='Map',exact=True).get_attribute('aria-disabled')=='true'
  await a.wait_for_function('()=>__G.state.place==="circle"',timeout=90000);assert 'Circle' in await a.locator('.location-control').inner_text();await shot(a,'venue-arrival')
  assert not ea and not eb,(ea,eb);await ca.close();await browser.close()
 print('Social and travel HUD journeys passed.' if args.social_only else 'All HUD gameplay journeys passed.',flush=True)
asyncio.run(main())
