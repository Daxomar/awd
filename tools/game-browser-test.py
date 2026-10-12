"""Two real browser sessions against the local API. Saves mobile review images."""
import asyncio, json, time, sys
from pathlib import Path
from playwright.async_api import async_playwright
sys.stdout.reconfigure(encoding='utf-8')
OUT=Path('.local/qa'); OUT.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:5173'

async def make_player(page, name, body='m'):
    print('Creating',name,flush=True)
    response=await page.request.post(BASE+'/api/signup',data={'username':name,'password':'test-player-2026','dob':'1995-01-01','agree':True})
    data=await response.json(); assert 'token' in data,data; token=data['token']
    await page.evaluate('''async ({name,body,token}) => {
      await new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:5173/ws?token=${token}`);const timer=setTimeout(()=>reject(Error('onboard timeout')),15000); ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t==='welcome')ws.send(JSON.stringify({t:'onboard',name,traits:['hustler','detty'],home:(m.state.birthOrigin==='dbee'?'osu':'nima'),look:{body,top:body==='f'?'jerseyaway':'jersey',hair:body==='f'?'puff':'fade'}}));if(m.t==='onboarded'){clearTimeout(timer);ws.close();resolve();}};});
    }''',{'name':name,'body':body,'token':token})
    await page.goto(BASE+'/?token='+token,wait_until='domcontentloaded',timeout=120000)
    try: await page.wait_for_function('!!window.__world?.me',timeout=120000)
    except:
        await page.screenshot(path=str(OUT/(name+'-failure.png')))
        print(await page.locator('body').inner_text(),flush=True)
        raise
    await page.evaluate("()=>{__stage.renderer.setPixelRatio(.65);window.__qaDraw=__stage.render.bind(__stage);let last=0;__stage.render=()=>{if(Date.now()-last>500){last=Date.now();__qaDraw();}};}")
    print('Ready',name,flush=True)
    return token

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        contexts=[await b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True),await b.new_context(viewport={'width':360,'height':740},is_mobile=True,has_touch=True)]
        a,c=await contexts[0].new_page(),await contexts[1].new_page(); errors=[]
        for page in [a,c]:
            page.on('websocket',lambda ws: ws.on('framereceived',lambda raw: print('WS',json.loads(raw).get('t'),json.loads(raw).get('id'),flush=True) if isinstance(raw,str) and json.loads(raw).get('t') in ['welcome','dm_request_answer'] else None))
            page.on('pageerror',lambda e: (errors.append(str(e)),print('BROWSER ERROR',e,flush=True)))
            page.on('console',lambda m: errors.append(m.text) if m.type=='error' and '[net handler' in m.text else None)
        tag=str(int(time.time()))[-7:]
        await make_player(a,'qa_a'+tag); await a.evaluate('window.__qaRender=__stage.render;__stage.render=()=>{}'); await make_player(c,'qa_b'+tag,'f'); await a.evaluate('__stage.render=window.__qaRender')
        await a.evaluate('__qaDraw()'); await a.screenshot(path=str(OUT/'01-tutorial.png'))
        for page in [a,c]: await page.get_by_role('button',name='Skip tour').click()
        await a.evaluate('__qaDraw()'); await a.screenshot(path=str(OUT/'02-home.png'))
        await a.locator('[data-nav=chat]').click()
        await a.locator('.chat-compose input').fill('Meet me at Circle')
        await a.get_by_role('button',name='Send message',exact=True).click()
        await c.locator('[data-nav=chat] .badge:not([hidden])').wait_for()
        await c.locator('[data-nav=chat]').click()
        assert await c.locator('[data-nav=chat] .badge').get_attribute('hidden') is not None
        await c.locator('.chat-message p',has_text='Meet me at Circle').wait_for()
        await a.locator('.chat-status',has_text='Sent').wait_for()
        assert await a.locator('.chat-compose input').input_value()==''
        await c.evaluate('__qaDraw()'); await c.screenshot(path=str(OUT/'03-city-chat.png'))
        await a.locator('[data-channel=room]').click()
        await a.locator('.chat-compose input').fill('Only in my home')
        await a.get_by_role('button',name='Send message',exact=True).click()
        await a.locator('.chat-message p',has_text='Only in my home').wait_for()
        await asyncio.sleep(.3)
        assert await c.locator('.chat-message p',has_text='Only in my home').count()==0
        # Force a socket reconnect, then verify a fresh identity and actual delivery.
        old=await a.evaluate('window.__G.myId')
        await a.evaluate("()=>__net.ws.close()")
        await a.wait_for_function('(old)=>window.__G.myId!==old',arg=old,timeout=45000)
        await a.locator('[data-channel=city]').click()
        await a.locator('.chat-compose input').fill('Back online now')
        await a.get_by_role('button',name='Send message',exact=True).click()
        await c.locator('.chat-message p',has_text='Back online now').wait_for()
        for page in [a,c]: await page.get_by_role('button',name='Close chat',exact=True).click()
        # Directly click the rendered bed, not only its menu shortcut.
        point=await a.evaluate('''()=>{const w=__world,z=w.spec.zones.find(z=>z.acts.includes('nap')||z.acts.includes('sleep'));const r=w.room.items[z.item];return w.screenOf(r.spec.x,.4,r.spec.z);}''')
        await a.mouse.click(*point)
        await a.locator('.sheet-title').wait_for()
        assert 'Bed' in await a.locator('.sheet-title').inner_text()
        await a.evaluate('__qaDraw()'); await a.screenshot(path=str(OUT/'04-furniture.png'))
        await a.locator('.act').first.click()
        await a.locator('.busy:not([hidden])').wait_for()
        await a.wait_for_function('!!__G.state.busy')
        await a.evaluate('__qaDraw()'); await a.screenshot(path=str(OUT/'05-resting.png'))
        await a.evaluate('window.__act.cancel()')
        await a.locator('.zone',has_text='Wardrobe').click()
        await a.locator('.sty').wait_for()
        await a.evaluate('__qaDraw()'); await a.screenshot(path=str(OUT/'06-wardrobe.png'))
        await c.locator('.zone',has_text='Wardrobe').click()
        await c.locator('.sty').wait_for()
        # Shapes change the rendered body immediately, then survive an authoritative save/reconnect.
        async def shape(page,key,value):
            await page.get_by_label(key,exact=True).evaluate("(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}",str(value))
        async def chest(page):
            return await page.evaluate("()=>{const p=__studio.av.meshes.find(m=>m.name==='topF').geometry.attributes.position;let z=-Infinity;for(let i=0;i<p.count;i++)if(p.getY(i)>1.18&&p.getY(i)<1.38&&Math.abs(p.getX(i))<.14)z=Math.max(z,p.getZ(i));return z;}")
        await shape(c,'Bust',0); small=await chest(c)
        await shape(c,'Bust',1); large=await chest(c); assert large>small+.02,(small,large)
        await shape(c,'Build',.7); await shape(c,'Hips',.8); await shape(c,'Height',.6)
        await c.evaluate('__qaDraw()'); await c.screenshot(path=str(OUT/'07-body-customization.png'))
        await c.get_by_role('button',name='Wear this',exact=True).click()
        await c.wait_for_function('__G.state.look.bust===1 && __G.state.look.hips===.8')
        old=await c.evaluate('__G.myId')
        await c.evaluate("()=>__net.ws.close()")
        await c.wait_for_function('(old)=>__G.myId!==old',arg=old,timeout=45000)
        assert await c.evaluate('__G.state.look.bust===1 && __G.state.look.build===.7 && __G.state.look.height===.6')
        await c.locator('.zone',has_text='Wardrobe').click()
        assert await c.get_by_label('Bust',exact=True).input_value()=='1'
        await c.get_by_role('button',name='Tops',exact=True).click()
        await c.locator('.sty-card',has_text='Ghana 2026 · Home').click()
        await c.get_by_role('button',name='Wear this',exact=True).click()
        await c.wait_for_function("__G.state.look.top==='jersey' && __G.state.look.bust===1")
        await a.locator('.sty-foot').get_by_role('button',name='Close',exact=True).click()
        a_name=await a.evaluate('__G.state.name'); c_name=await c.evaluate('__G.state.name')
        for page,name in [(a,c_name),(c,a_name)]:
            await page.evaluate('(name)=>__act.message(name)',name)
            await page.locator('.composer input').wait_for()
            await page.locator('.chat').wait_for()
        await a.locator('.composer input').fill('Private message from Accra')
        await a.get_by_role('button',name='Send private message',exact=True).click()
        await c.locator('.bub',has_text='Private message from Accra').wait_for()
        await a.wait_for_function("document.querySelector('.composer input').value==='' ")
        print('Accepting message request',flush=True)
        await c.get_by_role('button',name='Accept',exact=True).click()
        await c.locator('.message-request').wait_for(state='detached')
        await a.locator('.message-request').wait_for(state='detached')
        await c.evaluate("(name)=>new Promise(resolve=>{const off=__net.on('toast',()=>{off();resolve();});__net.send({t:'block',name,on:true});})",a_name)
        await a.locator('.composer input').fill('Keep this draft if blocked')
        await a.get_by_role('button',name='Send private message',exact=True).click()
        await a.get_by_role('button',name='Send private message',exact=True).wait_for(state='visible')
        await a.wait_for_function("!document.querySelector('.composer .send').disabled")
        assert await a.locator('.composer input').input_value()=='Keep this draft if blocked'
        print('Private chat passed',flush=True)
        await a.evaluate('__qaDraw()'); await a.screenshot(path=str(OUT/'08-private-draft.png'))
        # Review real avatar portraits and phone game boards at mobile width.
        await a.evaluate('(name)=>__act.phone("contacts",name)',c_name)
        await a.locator('.profile-portrait img').wait_for(timeout=60000)
        await a.screenshot(path=str(OUT/'09-profile.png'))
        await c.evaluate('(name)=>new Promise(resolve=>{const off=__net.on("toast",()=>{off();resolve();});__net.send({t:"block",name,on:false});})',a_name)
        await a.evaluate('(name)=>__act.phone("games",{with:name})',c_name)
        await a.get_by_role('button',name='Invite player',exact=True).first.click()
        await a.get_by_text('Invitation sent. They can accept from their phone.',exact=True).wait_for()
        await c.evaluate('__act.phone("games")')
        await c.locator('.game-row').first.click()
        await c.get_by_role('button',name='Accept',exact=True).click()
        await a.get_by_label('Square 1',exact=True).click()
        await c.get_by_label('Square 1',exact=True).filter(has_text='X').wait_for()
        await c.get_by_label('Square 5',exact=True).click()
        await a.get_by_label('Square 5',exact=True).filter(has_text='O').wait_for()
        await a.screenshot(path=str(OUT/'10-phone-game.png'))
        await a.evaluate('__act.closePhone()')
        await asyncio.sleep(.5)
        await a.locator('[data-nav=map]').click()
        await a.locator('.map-credit',has_text='real place coordinates').wait_for()
        await a.evaluate('__qaDraw()'); await a.screenshot(path=str(OUT/'11-accra-map.png'))
        text=await a.locator('body').inner_text()
        assert 'icon:' not in text, text
        assert not errors, errors
        print(json.dumps({'ok':True,'checks':['mobile tutorial','unread chat badge','private chat and failure draft retention','city chat between separate homes','nearby isolation','delivery acknowledgement','fresh identity and delivery after reconnect','3D furniture click','server activity','wardrobe','bust geometry changes','body save and reconnect','outfit retains body shape','no raw icon tokens','no browser exceptions'],'screenshots':str(OUT)}))
        await b.close()

asyncio.run(main())
