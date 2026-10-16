"""Local authenticated street evidence and repeated software-WebGL diagnostics.
Cold first render and warmed frame samples are separate; never phone FPS.
"""
import argparse
import asyncio
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--label',choices=['before','after'],default='before')
parser.add_argument('--base',default='http://127.0.0.1:8082')
parser.add_argument('--fixtures',default='.local/phase4/fixtures.json')
args=parser.parse_args()
target=urlsplit(args.base)
if target.scheme!='http' or target.hostname not in ('127.0.0.1','localhost') or target.username or target.password or target.path not in ('','/'):
 raise ValueError('Use the isolated loopback QA server only.')
out=Path('.local/phase5')/args.label
out.mkdir(parents=True,exist_ok=True)

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  context=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  fixture=json.loads(Path(args.fixtures).read_text())[0]
  await context.add_cookies([{'name':'awd_session','value':fixture['cookie'],'url':args.base,'httpOnly':True,'sameSite':'Strict'}])
  async def keep_session_warm():
   while True:
    try:await context.request.get(args.base+'/api/session',timeout=20000)
    except Exception:pass
    await asyncio.sleep(3)
  keepalive=asyncio.create_task(keep_session_warm())
  page=await context.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  await page.goto(args.base,wait_until='domcontentloaded')
  await page.wait_for_function('()=>!!window.__stage',timeout=120000)
  await page.evaluate('()=>{__stage.renderer.setPixelRatio(.7);window.__draw=__stage.render.bind(__stage);__stage.render=()=>{};}')
  await page.wait_for_function('()=>!!window.__world?.me',timeout=120000)
  if await page.get_by_role('button',name='Skip tour',exact=True).count():await page.get_by_role('button',name='Skip tour',exact=True).click()
  await page.evaluate('async()=>{await __map.terrainReady;__map.dispose();window.__look=__world.me.av.baseLook;}')
  # Isolate deterministic renderer profiling from periodic authoritative room
  # updates. Live presence/travel/recovery are covered by a separate browser test.
  await page.evaluate('()=>__net.close()')
  conditions={'renderer':'Chromium SwiftShader','viewport':[390,844],'pixelRatio':.7,'phoneFPS':None,'authentication':'production cookie, disposable local account','syntheticRooms':True,'networkClosedAfterBootstrap':True,'cityOverviewDisposed':True,'visitsPerScene':4,'warmSamplesPerScene':120,'asset':await page.evaluate('()=>[...document.scripts].find(s=>s.type==="module")?.getAttribute("src")')}
  metrics={}
  for name in ['makola','vibes','n:jtown','home:legon']:
   result=await page.evaluate('''async name=>{
    const msg=name.startsWith('home:')?{place:'home',home:{id:name.slice(5),mine:true,items:{tv:true,laptop:true,gas:true,fridge:true}}}:{place:name};
    const builds=[],firstFrames=[],warm=[],visits=[];
    for(let visit=0;visit<4;visit++){
      const start=performance.now();__world.enter(msg,__look,'Street QA');__world.me.path=[];__stage.setTime(13);__world.update(.016);builds.push(performance.now()-start);
      const t=performance.now();__draw();__stage.renderer.getContext().finish();firstFrames.push(performance.now()-t);
      for(let i=0;i<35;i++){const t=performance.now();__world.update(.016);__draw();__stage.renderer.getContext().finish();if(i>=5)warm.push(performance.now()-t);if(i%5===0)await new Promise(r=>setTimeout(r,0));}
      visits.push({...__stage.renderer.info.memory,programs:__stage.renderer.info.programs.length,stream:__world.room.streetStream?.stats()||null});
    }
    return {builds,firstFrames,warm,visits,render:{...__stage.renderer.info.render},memory:{...__stage.renderer.info.memory}};
   }''',name)
   metrics[name]=result
   (out/'metrics.json').write_text(json.dumps({'conditions':conditions,'scenes':metrics,'errors':errors},indent=2))
   print('profiled',name,flush=True)
  for id in ['nima','jtown','kaneshie','labadi','osu','airres','legon','trasacco']:
   await page.evaluate("id=>{__world.enter({place:'n:'+id},__look,'Street QA');__world.me.path=[];__stage.setTime(13);__world.update(.016);__draw();}",id)
   await page.screenshot(path=str(out/f'n-{id}.png'))
  (out/'metrics.json').write_text(json.dumps({'conditions':conditions,'scenes':metrics,'errors':errors},indent=2))
  assert not errors,errors
  keepalive.cancel()
  await browser.close()
asyncio.run(main())
