"""Purchased-home integration against the isolated local test database only."""
exec(open('tools/game-browser-test.py', encoding='utf8').read().split('async def main():')[0])
import subprocess
BASE = 'http://127.0.0.1:8080'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = await browser.new_page(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        name='qa_house'+str(int(time.time()))[-6:]
        token=await make_player(page,name)
        await page.get_by_role('button',name='Skip tour',exact=True).click()
        await page.goto('about:blank')
        await asyncio.sleep(1)
        # Fund only this freshly created fixture after its socket has closed.
        source='''import pg from 'pg';
const pool=new pg.Pool({connectionString:'postgres://awd@127.0.0.1:55432/awd'});
const name=process.argv[2];if(!/^qa_house[0-9]{6}$/.test(name))throw Error('test account required');
try {const r=await pool.query("UPDATE players SET state=jsonb_set(jsonb_set(state,'{cash}','0'::jsonb),'{momo}','5000000'::jsonb) WHERE id=(SELECT id FROM accounts WHERE username=$1) RETURNING id",[name]);if(r.rowCount!==1)throw Error('missing fixture');}finally{await pool.end();}
'''
        subprocess.run(['node','--input-type=module','-',name],input=source,text=True,cwd='server',check=True)
        await page.goto(BASE+'/?token='+token,wait_until='domcontentloaded',timeout=120000)
        await page.wait_for_function('!!window.__world?.me',timeout=120000)
        await page.evaluate('()=>{__stage.renderer.setPixelRatio(.65);window.__qaDraw=__stage.render.bind(__stage);__stage.render=()=>{};}')
        await page.evaluate("__net.send({t:'buy',kind:'home',id:'osu',buy:true})")
        await page.wait_for_function('__G.state.owned.osu===true && __G.state.home==="osu"')
        assert await page.evaluate('__G.state.cash+__G.state.momo')==3400000
        await page.locator('.zone',has_text='Walk outside').click()
        await page.wait_for_function('__G.state.place==="n:osu"',timeout=30000)
        await page.locator('.zone',has_text='Player-owned estate').click()
        await page.wait_for_function('__G.state.place==="e:osu"',timeout=30000)
        await page.wait_for_function('__world.estate?.owners.some(o=>o.mine)')
        await page.wait_for_function('__world.me.path.length===0',timeout=30000)
        await page.evaluate('__world.update(0);__qaDraw()')
        await page.screenshot(path=str(OUT/'city-purchased-estate.png'))
        # Reload proves both the purchase and the SQL directory survive saving.
        await page.reload(wait_until='domcontentloaded',timeout=120000)
        await page.wait_for_function('window.__world?.estate?.owners.some(o=>o.mine)',timeout=120000)
        await page.evaluate('()=>{__stage.renderer.setPixelRatio(.65);window.__qaDraw=__stage.render.bind(__stage);__stage.render=()=>{};}')
        owner=await page.evaluate('__world.estate.owners.find(o=>o.mine)')
        assert owner['name']==name and owner['home']=='osu'
        await page.wait_for_function('__world.me.path.length===0',timeout=30000)
        point=await page.evaluate('()=>{const r=__world.room.items.find(r=>r.spec.owner?.mine);__stage.view.target.set(r.spec.x,0,r.spec.z);__stage.applyView();__qaDraw();return __world.screenOf(r.spec.x,1.8,r.spec.z);}')
        assert await page.evaluate('(point)=>__world.pick(...point)?.item?.spec.owner?.mine===true',point)
        await page.mouse.click(*point)
        await page.screenshot(path=str(OUT/'city-house-tap.png'))
        await page.get_by_role('button',name='Move into this home',exact=True).click()
        await page.wait_for_function('__G.state.place==="home" && __world.place==="home"',timeout=30000)
        assert await page.evaluate('__G.state.cash+__G.state.momo')==3400000
        assert not errors,errors
        print('PASS purchased house, live and persisted estate directory, physical house tap and free reoccupation',flush=True)
        await browser.close()

asyncio.run(main())

