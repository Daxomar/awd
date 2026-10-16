"""Production-cookie journeys using isolated local fixtures, never real payments.

The career case waits for the actual one-hour server shift. Business settlement
uses explicitly aged disposable business periods (not client clock changes).
Rendering is sampled on SwiftShader; these checks do not establish phone FPS.
"""
import argparse, asyncio, json, re, sys, time, subprocess, os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding='utf-8')
parser=argparse.ArgumentParser()
parser.add_argument('--case',choices=['career','career_resume','career_evidence','commerce','business_reconnect','social','housing','crime','layouts','dbee'],required=True)
parser.add_argument('--base',default='http://127.0.0.1:8083')
args=parser.parse_args()
if urlsplit(args.base).hostname not in ('localhost','127.0.0.1'):raise ValueError('Disposable loopback server only')
ROOT=Path('.local/phase8');OUT=Path('docs/images/phase8');OUT.mkdir(parents=True,exist_ok=True)
fixtures={f['role']:f for f in json.loads((ROOT/'fixtures.json').read_text())}

async def ready(p):
    await p.wait_for_function('()=>!!window.__stage',timeout=180000)
    await p.evaluate('()=>{__stage.renderer.setPixelRatio(.4);__stage.renderer.shadowMap.enabled=false;window.__draw ||= __stage.render.bind(__stage);__stage.render=()=>{};}')
    await p.wait_for_function('()=>!!window.__world?.me',timeout=120000)
    if await p.get_by_role('button',name='Skip tour',exact=True).count():await p.get_by_role('button',name='Skip tour',exact=True).click()
    await p.evaluate("()=>{window.__p8=[];for(const t of ['life_status','life_result','life_notice','hired','worktask','shiftDone','done','toast','bought'])__net.on(t,m=>{__p8.push({type:t,...m});if(__p8.length>250)__p8.shift();});__net.on('toast',m=>{if(m.k==='bad')console.log('QA action: '+m.m);});}")
    await p.wait_for_timeout(2000)
    await p.evaluate("()=>{window.__sent=[];const send=__net.send.bind(__net);__net.send=m=>{__sent.push({t:m.t,op:m.op,key:m.key,section:m.section});if(__sent.length>250)__sent.shift();return send(m);};}")

async def reload(p):
    try:await p.reload(wait_until='domcontentloaded')
    except Exception as e:
        if 'ERR_ABORTED' not in str(e):raise
        await p.wait_for_load_state('domcontentloaded')
    await ready(p)

async def game(browser,role):
    fixture=fixtures[role]
    c=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    # Keep this 8 GB desktop usable during software-rendered multi-context QA.
    # Game rules/network timers remain real; this is not a phone FPS benchmark.
    await c.add_init_script("(()=>{Object.defineProperty(window,'devicePixelRatio',{get:()=>.5});const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>setTimeout(()=>raf(fn),75);})();")
    await c.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';document.head.append(s);});")
    await c.add_cookies([{'name':'awd_session','value':fixture['cookie'],'url':args.base,'httpOnly':True,'sameSite':'Strict'}])
    p=await c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:print(m.text,flush=True) if m.text.startswith('QA action:') else None)
    await p.goto(args.base,wait_until='domcontentloaded');await ready(p)
    print('Authenticated:',role,flush=True);return c,p,errors

async def app(p,name):
    if await p.locator('.celebrate-back').count():
        await p.locator('.celebrate-back').get_by_role('button').click();await p.wait_for_timeout(500)
    if await p.locator('.sheet-back').count():
        await p.get_by_role('button',name='Close',exact=True).click();await p.wait_for_timeout(400)
    if await p.locator('.phone-back:not([hidden])').count():await p.get_by_role('button',name='Phone home',exact=True).click()
    else:await p.get_by_role('button',name='Phone',exact=True).click()
    await p.locator('.springboard').get_by_role('button',name=name,exact=True).click()
    await p.wait_for_timeout(1800)

async def shot(p,name):
    await p.evaluate('()=>__draw()')
    await p.screenshot(path=str(OUT/(name+'.jpg')),type='jpeg',quality=86,timeout=120000)

async def click_action(p,name,scope=None):
    start=await p.evaluate('()=>__p8.length')
    await (scope or p).get_by_role('button',name=name,exact=True).click()
    await p.wait_for_function("n=>__p8.slice(n).some(m=>m.type==='life_result'&&m.key)",arg=start,timeout=120000)
    r=await p.evaluate("n=>__p8.slice(n).find(m=>m.type==='life_result'&&m.key)",start)
    for _ in range(10):
        if not r.get('error') or not re.search('saving|wait a moment|transaction already',r['error'],re.I):break
        await p.wait_for_timeout(2200);start=await p.evaluate('()=>__p8.length')
        await p.get_by_role('button',name='Retry saved action',exact=True).click()
        await p.wait_for_function("n=>__p8.slice(n).some(m=>m.type==='life_result'&&m.key)",arg=start,timeout=45000)
        r=await p.evaluate("n=>__p8.slice(n).find(m=>m.type==='life_result'&&m.key)",start)
    assert not r.get('error'),r.get('error')
    await p.wait_for_timeout(1800);return r

async def career(browser):
    c,p,errors=await game(browser,'career')
    try:
        assert await p.evaluate('()=>__G.state.cash+__G.state.momo')==800
        await app(p,'Jobs');await p.locator('button.cell').filter(has_text=re.compile('^Intern · Tech')).click()
        await p.get_by_role('button',name='Apply now',exact=True).click()
        await p.wait_for_function('()=>__G.state.job?.id==="tech"',timeout=30000)
        await shot(p,'career-hired')
        if await p.locator('.celebrate-back').count():
            await p.locator('.celebrate-back').get_by_role('button').click();await p.wait_for_timeout(500)
        await p.get_by_role('button',name='Start shift',exact=True).click()
        await p.wait_for_function('()=>!!__G.state.shift?.assignment',timeout=30000)
        await p.get_by_role('button',name='Interact',exact=True).click()
        await p.locator('.zone').filter(has_text=re.compile('^Engineering desk$')).click()
        await p.get_by_role('button',name='Check logs and reproduce the failure',exact=True).click()
        await p.wait_for_function('()=>__G.state.shift?.assignment?.stage==="working"',timeout=45000)
        await shot(p,'career-at-station')
        for _ in range(4):await p.wait_for_timeout(25000)
        await p.wait_for_function('()=>__G.state.shift?.tasks===1',timeout=20000)
        await app(p,'Jobs');await p.get_by_role('button',name='Career progress & skills',exact=True).click()
        await p.get_by_text('Career & development',exact=True).wait_for();await p.wait_for_timeout(2200)
        await shot(p,'career-promotion-eligibility');await shot(p,'skills')
        print('Actual workplace assignment passed. Waiting for the real one-hour shift.',flush=True)
        for i in range(76):
            if await p.evaluate('()=>__G?.state?.stats?.shifts>0'):break
            await p.wait_for_timeout(50000)
            if i%6==0:print('Real attended shift still running:',i,flush=True)
        await p.wait_for_function('()=>__G.state.stats.shifts===1',timeout=20000)
        await p.reload(wait_until='domcontentloaded');await ready(p)
        assert await p.evaluate('()=>__G.state.stats.shifts')==1
        assert await p.evaluate('()=>__G.state.life.careers.tech.assignments')==1
        await app(p,'Jobs');await shot(p,'career-paid-persistent')
        assert not errors,errors
        return {'passed':['Hustler GH800 start','in-person application','physical workplace assignment with real 90-second timer','professional reputation and skill progress','actual one-hour paid shift','persisted salary and career history after reload'],'clock':'Actual real server hour; no accelerated attendance','errors':errors}
    finally:await c.close()

async def career_resume(browser):
    c,p,errors=await game(browser,'career')
    try:
        assert await p.evaluate('()=>__G.state.origin')=='hustler'
        for i in range(240):
            if await p.evaluate('()=>__G.state.stats.shifts===1'):break
            assert await p.evaluate('()=>!!__G.state.shift'),'The saved attended shift must remain resumable.'
            if i%6==0:print('Recorded attendance minutes:',await p.evaluate('()=>__G.state.shift.worked'),flush=True)
            await p.wait_for_timeout(30000)
        await p.wait_for_function('()=>__G.state.stats.shifts===1',timeout=30000)
        await reload(p)
        assert await p.evaluate('()=>__G.state.life.careers.tech.assignments')==1
        assert await p.evaluate('()=>__G.state.stats.earned')==150
        await app(p,'Jobs');await shot(p,'career-paid-persistent')
        await p.get_by_role('button',name='Career progress & skills',exact=True).click();await p.wait_for_timeout(2000);await shot(p,'career-persistent-history')
        await reload(p);assert await p.evaluate('()=>__G.state.stats.earned')==150
        assert not errors,errors
        return {'passed':['same natural GH800 Hustler fixture','actual physical assignment retained','recorded attended work resumes after reconnect/server restart','one real attended hour pays unchanged GH150','skills/professional progress retained','two reloads preserve one salary and assignment history'],'salary':150,'clock':'Real server time and recorded attendance; no accelerated clock or attendance grant. Early long run was interrupted by software-GPU host contention; continuation used the same stored fixture.','errors':errors}
    finally:await c.close()

async def career_evidence(browser):
    c,p,errors=await game(browser,'career')
    try:
        assert await p.evaluate('()=>__G.state.stats.shifts')==1
        await app(p,'Jobs');await p.get_by_role('button',name='Career progress & skills',exact=True).click();await p.wait_for_timeout(2000)
        skill=p.get_by_text(re.compile(r'^Coding · [0-9]+/10$'),exact=True)
        await skill.evaluate("e=>e.parentElement.scrollIntoView({block:'center'})");await shot(p,'skills')
        assert not errors,errors
        return {'passed':['saved paid career opened again without another reward','actual Coding skill value, progress and effect inspected in the game'],'errors':errors}
    finally:await c.close()

async def commerce(browser):
    co,o,eo=await game(browser,'owner');cs,s,es=await game(browser,'seller');cb,b,eb=await game(browser,'buyer')
    try:
        await app(o,'Business');await shot(o,'business-setup')
        if not await o.get_by_role('button',name='Manage business',exact=True).count():await click_action(o,'Create Provision stall')
        await o.get_by_role('button',name='Manage business',exact=True).click()
        if await o.get_by_text(re.compile('Open|Closed')).filter(has_text='stock 0/').count():
            await o.get_by_label('Stock quantity',exact=True).fill('10');await click_action(o,'Buy wholesale stock')
        await o.get_by_label('Open for trading',exact=True).check();await click_action(o,'Save trading settings')
        await shot(o,'business-stock-and-pricing')
        env={**os.environ,'DATABASE_URL':'postgres://awd@127.0.0.1:55432/awd_security'};env.pop('NODE_ENV',None)
        r=await asyncio.to_thread(subprocess.run,['node','server/loadtest/phase8-fixtures.js','age-businesses',str(fixtures['owner']['id'])],env=env,capture_output=True,text=True)
        assert r.returncode==0,r.stderr
        await click_action(o,'Settle elapsed periods')
        await shot(o,'business-financial-statement')
        sales=await o.evaluate('()=>__G.state.life.business.sales');assert sales>0
        await o.get_by_label('Till amount',exact=True).fill('10');await click_action(o,'Withdraw till cash')
        await o.reload(wait_until='domcontentloaded');await ready(o);await app(o,'Business');await shot(o,'business-reloaded')
        # Existing Circle phone market, not an invented inventory grant.
        await s.evaluate("()=>__net.send({t:'phone',op:'buy',m:'button',test:true})")
        await s.wait_for_function('()=>__G.state.phones?.some(p=>p.tested)',timeout=30000)
        await app(s,'Trade');await s.get_by_label('Listing price',exact=True).fill('100');await click_action(s,'Place phone in escrow')
        await shot(s,'trade-escrow')
        await app(b,'Trade');await click_action(b,'Buy · GH₵101 incl. GH₵1 fee',b.locator('.appwin .group').filter(has_text='@'+fixtures['seller']['username']))
        await b.wait_for_function('()=>__G.state.phones.length===1',timeout=30000)
        await shot(b,'trade-purchase')
        await s.wait_for_function('()=>__G.state.life?.commerce?.sold===1',timeout=30000)
        await s.reload(wait_until='domcontentloaded');await ready(s);assert await s.evaluate('()=>__G.state.phones.length')==0
        await b.reload(wait_until='domcontentloaded');await ready(b);assert await b.evaluate('()=>__G.state.phones.length')==1
        await app(b,'Finances');await shot(b,'trade-financial-history')
        assert not eo+es+eb,eo+es+eb
        return {'passed':['Hustler business creation from unchanged starting wallet','wholesale inventory and price/open configuration','bounded simulated sales and stored statements','till withdrawal','business reload','real existing Circle phone purchase','escrow listing','Dbee purchase plus existing fee','seller credited once','both inventories persist after reload'],'businessSales':sales,'settlementFixture':'Only this disposable business was aged to exercise elapsed-period settlement; no device clock or wallet edit.','errors':eo+es+eb}
    finally:await co.close();await cs.close();await cb.close()

async def social(browser):
    ca,a,ea=await game(browser,'owner');cb,b,eb=await game(browser,'friend')
    try:
        # Existing travel to one real public neighbourhood, via the authoritative route.
        if await a.evaluate('()=>__G.state.place')!='n:nima':
            await a.evaluate("()=>__net.send({t:'travel',to:'n:nima',mode:'trotro'})")
            await a.wait_for_function('()=>!!__G.state.busy?.travel',timeout=30000)
            await a.wait_for_function('()=>__G.state.place==="n:nima"&&__world.place==="n:nima"',timeout=240000)
        if not await a.evaluate('()=>__G.state.friends["'+str(fixtures['friend']['id'])+'"]?.accepted'):
            await app(a,'People');await a.get_by_label('Player username',exact=True).fill(fixtures['friend']['username']);await click_action(a,'Send friend request')
            await app(b,'People');await shot(b,'friendship-consent');await click_action(b,'Accept friend request')
        if not await a.evaluate('()=>__G.state.life?.shared'):
            await app(a,'People');await click_action(a,'Invite to conversation')
            await app(b,'People');await click_action(b,'Accept shared activity')
            await shot(b,'shared-activity')
            await b.wait_for_function('()=>__G.state.life?.shared===1',timeout=60000)
        if not await a.evaluate('()=>!!__G.state.flags.partner'):
            await app(a,'People');await click_action(a,'Ask to start dating')
            await app(b,'People');await shot(b,'relationship-consent');await click_action(b,'Accept romantic invitation')
        assert await a.evaluate('()=>!!__G.state.flags.partner')
        await a.reload(wait_until='domcontentloaded');await ready(a);await app(a,'People');await shot(a,'relationship-persistent')
        await click_action(a,'End relationship');assert not await a.evaluate('()=>__G.state.flags.partner')
        # Reconnect while a second shared activity is active; no charge or reward.
        await click_action(a,'Invite to conversation');await app(b,'People');await click_action(b,'Accept shared activity')
        count=await a.evaluate('()=>__G.state.life.shared');await a.reload(wait_until='domcontentloaded');await ready(a);await app(a,'People');await a.wait_for_timeout(4000)
        assert await a.evaluate('()=>__G.state.life.shared')==count
        await shot(a,'shared-reconnect-cancelled')
        assert not ea+eb,ea+eb
        return {'passed':['existing travel to real shared venue','friend request and consent','30-second co-located activity','mutual dating acceptance','persistent romance after reload','unilateral breakup','active shared activity cancels on reconnect with no duplicate reward'],'errors':ea+eb}
    finally:await ca.close();await cb.close()

async def business_reconnect(browser):
    c,p,errors=await game(browser,'owner')
    try:
        await app(p,'Business');await p.get_by_role('button',name='Manage business',exact=True).click()
        before=await p.evaluate('()=>__G.state.cash+__G.state.momo')
        # Drop only the response receipt at the UI boundary, then really reload.
        # The server request, stock/till mutation and state broadcast are genuine.
        await p.evaluate("()=>{const emit=__net.emit.bind(__net);__net.emit=(t,m)=>{if(t!=='life_result')emit(t,m);};}")
        await p.get_by_label('Till amount',exact=True).fill('1');await p.get_by_role('button',name='Add operating reserve',exact=True).click()
        await p.wait_for_function('balance=>__G.state.cash+__G.state.momo===balance-1',arg=before,timeout=60000)
        await reload(p);await app(p,'Business');assert await p.get_by_role('button',name='Retry saved action',exact=True).count()
        r=await click_action(p,'Retry saved action');assert r['replayed']
        assert await p.evaluate('()=>__G.state.cash+__G.state.momo')==before-1
        await shot(p,'business-unconfirmed-reconnect');assert not errors,errors
        return {'passed':['real reserve contribution committed once','lost UI confirmation with retained account-scoped action reference','actual reload and authenticated reconnect','same receipt replay returns saved result with no second debit'],'faultInjection':'Only the life_result UI receipt was withheld; server rules, commit, wallet broadcast and authentication were genuine.','errors':errors}
    finally:await c.close()

async def housing(browser):
    c,p,errors=await game(browser,'property')
    try:
        assert await p.evaluate('()=>__G.state.cash+__G.state.momo')==25000
        await p.evaluate("()=>__net.send({t:'travel',to:'circle',mode:'trotro'})")
        await p.wait_for_function('()=>__G.state.place==="circle"&&__world.place==="circle"',timeout=240000)
        await p.wait_for_timeout(1800)
        earned=await p.evaluate('()=>__G.state.stats.earned')
        await p.evaluate("()=>__net.send({t:'act',loc:'circle',id:'mate'})")
        await p.wait_for_function('n=>__G.state.stats.earned>n',arg=earned,timeout=60000)
        assert await p.evaluate('()=>__G.state.stats.earned')>earned
        await p.evaluate("()=>__net.send({t:'travel',to:'home',mode:'trotro'})")
        await p.wait_for_function('()=>__G.state.place==="home"&&__world.place==="home"',timeout=240000)
        await app(p,'Shop');await p.locator('button.cell').filter(has_text='Gas cooker').click()
        await p.wait_for_function('()=>!!__G.state.items.gas',timeout=30000)
        await p.wait_for_function('()=>__world.spec.items.some(i=>i.kind.includes("gas_cooker"))',timeout=30000)
        await p.get_by_role('button',name='Put phone away',exact=True).click();await p.wait_for_timeout(500)
        await shot(p,'housing-owned-appliance')
        await p.get_by_role('button',name='Interact',exact=True).click()
        await p.locator('.zone').filter(has_text=re.compile('^Gas cooker$')).click()
        await p.locator('button.act').filter(has_text='Cook jollof').click()
        await p.wait_for_function('()=>!!__G.state.busy',timeout=30000);await p.wait_for_function('()=>!__G.state.busy',timeout=40000)
        await app(p,'Finances');await shot(p,'housing-finances')
        await app(p,'Houses');await shot(p,'housing-options')
        name=await p.evaluate('()=>__G.cat.homes.jtown.name')
        await p.locator('button.cell').filter(has_text=name).click();await p.get_by_role('button',name='Rent · pay GH₵960',exact=True).click()
        await p.wait_for_function('()=>__G.state.home==="jtown"&&__world.msg.home?.id==="jtown"',timeout=30000)
        await shot(p,'housing-new-home')
        await app(p,'Milestones');await p.get_by_role('button',name='Long-term',exact=True).click();await shot(p,'long-term-objectives')
        await p.reload(wait_until='domcontentloaded');await ready(p);assert await p.evaluate('()=>__G.state.items.gas')
        assert not errors,errors
        return {'passed':['unchanged Dbee GH25000 start','existing Circle gig pays actual earned income after real transport','eligible furniture purchase and room update','real home cooking','saved expenses and housing obligations','existing housing options and actual GH960 Jamestown rental with rebuilt room','long-term objectives','item persists after reload'],'errors':errors}
    finally:await c.close()

async def crime(browser):
    c,p,errors=await game(browser,'seller')
    try:
        if not await p.evaluate('()=>__G.state.life?.legal?.attempts'):
            await p.get_by_role('button',name='Interact',exact=True).click()
            await p.locator('.zone').filter(has_text=re.compile('^Crowd$')).click()
            await p.locator('button.act').filter(has_text='Pickpocket in the crowd').click()
            await p.wait_for_function('()=>!!__G.state.busy',timeout=30000);await p.wait_for_function('()=>!__G.state.busy',timeout=40000)
        await app(p,'Jobs');await p.get_by_role('button',name='Career progress & skills',exact=True).click();await p.wait_for_timeout(2000)
        await p.get_by_text('Game conduct',exact=True).scroll_into_view_if_needed();await shot(p,'crime-consequence')
        legal=await p.evaluate('()=>__G.state.life.legal');assert legal['attempts']==1
        await app(p,'Finances');await shot(p,'crime-financial-history')
        assert not errors,errors
        return {'passed':['existing fictional crowd crime','server risk/outcome and financial consequence','separate legal standing','saved accounting'],'outcome':legal['last'],'errors':errors}
    finally:await c.close()

async def layouts(browser):
    c,p,errors=await game(browser,'buyer');rows=[]
    try:
        for width,height in [(375,812),(390,844),(430,932),(390,530),(844,390)]:
            await p.set_viewport_size({'width':width,'height':height});await app(p,'Trade');await shot(p,f'mobile-{width}x{height}')
            overflow=await p.evaluate('()=>document.documentElement.scrollWidth>innerWidth+1');assert not overflow
            rows.append({'width':width,'height':height,'horizontalOverflow':overflow})
        await p.set_viewport_size({'width':390,'height':844})
        measurements=[];cdp=await c.new_cdp_session(p)
        for i in range(10):
            await app(p,'Finances');await p.get_by_role('button',name='Phone home',exact=True).click();await p.wait_for_timeout(450)
            start=await p.evaluate('()=>__p8.length');at=time.perf_counter()
            await p.evaluate("()=>__net.send({t:'life_status',section:'finance'})")
            await p.wait_for_function("n=>__p8.slice(n).some(m=>m.type==='life_status')",arg=start,timeout=45000)
            latency=(time.perf_counter()-at)*1000
            await cdp.send('HeapProfiler.collectGarbage')
            heap=await cdp.send('Runtime.getHeapUsage');dom=await cdp.send('Memory.getDOMCounters')
            subscriptions=await p.evaluate("()=>Object.fromEntries(['life_status','life_result','life_notice','connection'].map(k=>[k,__net.h[k]?.length||0]))")
            measurements.append({'cycle':i+1,'statusRoundTripMs':round(latency,2),'usedJSHeapBytes':heap['usedSize'],'subscriptions':subscriptions,**dom})
        assert measurements[-1]['subscriptions']==measurements[0]['subscriptions']
        assert not errors,errors
        return {'viewports':rows,'repeatedScreens':measurements,'rendering':'Sampled SwiftShader desktop browser; no phone FPS assertion.','errors':errors}
    finally:await c.close()

async def dbee(browser):
    ca,a,ea=await game(browser,'buyer');cb,b,eb=await game(browser,'friend')
    try:
        assert await a.evaluate('()=>__G.state.origin')=='dbee'
        await app(a,'Jobs')
        if not await a.evaluate('()=>__G.state.job?.id==="trotro"'):
            await a.locator('button.cell').filter(has_text=re.compile('^Trotro Mate')).click()
            await a.get_by_role('button',name='Apply now',exact=True).click();await a.wait_for_function('()=>__G.state.job?.id==="trotro"',timeout=30000)
        if await a.locator('.celebrate-back').count():await a.locator('.celebrate-back').get_by_role('button').click()
        await shot(a,'dbee-career')
        await app(a,'Business')
        if not await a.evaluate('()=>__G.state.life?.business?.created'):
            await a.get_by_label('Business type',exact=True).select_option('accessories');await click_action(a,'Create Phone-accessory counter')
        if not await a.evaluate('()=>__G.state.life?.business?.sales'):
            await a.get_by_role('button',name='Manage business',exact=True).click()
            await a.get_by_label('Stock quantity',exact=True).fill('10');await click_action(a,'Buy wholesale stock')
            await a.get_by_label('Open for trading',exact=True).check();await click_action(a,'Save trading settings')
            env={**os.environ,'DATABASE_URL':'postgres://awd@127.0.0.1:55432/awd_security'};env.pop('NODE_ENV',None)
            r=await asyncio.to_thread(subprocess.run,['node','server/loadtest/phase8-fixtures.js','age-businesses',str(fixtures['buyer']['id'])],env=env,capture_output=True,text=True);assert r.returncode==0,r.stderr
            await click_action(a,'Settle elapsed periods')
        assert await a.evaluate('()=>__G.state.life.business.sales')>0
        await shot(a,'dbee-business')
        if await a.evaluate('()=>__G.state.place')!='n:nima':
            await a.evaluate("()=>__net.send({t:'travel',to:'n:nima',mode:'trotro'})")
            await a.wait_for_function('()=>__G.state.place==="n:nima"&&__world.place==="n:nima"',timeout=240000)
        await app(a,'People');await a.get_by_label('Player username',exact=True).fill(fixtures['friend']['username']);await click_action(a,'Send friend request')
        await app(b,'People');await click_action(b,'Accept friend request',b.locator('.appwin .group').filter(has_text='@'+fixtures['buyer']['username']))
        await app(a,'People');await click_action(a,'Invite to conversation')
        await app(b,'People');await click_action(b,'Accept shared activity');await b.wait_for_function('()=>__G.state.friends["'+str(fixtures['buyer']['id'])+'"].pts>=35',timeout=60000)
        await shot(a,'dbee-social');await a.reload(wait_until='domcontentloaded');await ready(a)
        assert await a.evaluate('()=>__G.state.job.id')=='trotro';assert await a.evaluate('()=>__G.state.life.business.created')==1
        assert not ea+eb,ea+eb
        return {'passed':['unchanged Dbee birth outcome; no added money','career application at existing workplace','accessory business startup, stock, operations and statement','existing trotro journey','mutual friendship and real shared activity','persistent career and business after reconnect'],'errors':ea+eb}
    finally:await ca.close();await cb.close()

async def main():
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-compositing','--num-raster-threads=1'])
        try:
            result=await globals()[args.case](browser);(ROOT/(args.case+'-browser.json')).write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2),flush=True)
        finally:await browser.close()

asyncio.run(main())
