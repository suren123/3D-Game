#!/usr/bin/env python3
"""Real touch: fixed neighbourhood framing and the same park entrance from both directions."""
import asyncio,json,math,time
from playwright.async_api import async_playwright
from v2_browser import ROOT,URL,snap,state,click,prepare,fill,phase,is_game_request,travel
OUT=ROOT/'artifacts/frontage-camera'
async def settle(p):
 await p.wait_for_function('Object.keys(window.__townTest.snapshot().bounds).length>0',timeout=15000)
 await p.wait_for_function('(()=>{const w=window.__townTest.snapshot().world,c=w.camera;return !w.moving&&c.mode==="neighborhood"&&Math.hypot(c.target.x-c.focus.x,c.target.z-c.focus.z)<.04})()',timeout=30000)
 return await snap(p)
def entrance(s,place):
 m=s['state']['map'];lot=next(x['lot'] for x in m['places'] if x['id']==place)
 a,b=[next(n for n in m['nodes'] if n['id']==i) for i in lot['accessEdge']]
 return {'x':lot['frontageX'] if a['z']==b['z'] else a['x'],'z':a['z'] if a['z']==b['z'] else lot['frontageZ']}
async def run():
 OUT.mkdir(parents=True,exist_ok=True);errors=[];requests=[];report={'trips':[]}
 async with async_playwright() as w:
  browser=await w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':1180,'height':820},has_touch=True)
  p=await ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
  p.on('request',lambda r:requests.append(r.url) if is_game_request(r) else None)
  try:
   await p.goto(URL+'?test=1&seed=5&difficulty=easy')
   await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
   report['bundle']=await p.evaluate('[...document.scripts].map(x=>x.src).filter(Boolean)')
   baseline=len(requests);await ctx.set_offline(True)
   await click(p,'start');await click(p,'ack');await p.screenshot(path=str(OUT/'00-vehicle-slots.png'))
   await click(p,'vehicle-bus');await fill(p);await p.screenshot(path=str(OUT/'00-loaded-slots.png'));await click(p,'depart')
   s=await settle(p);scale=s['world']['camera']['halfHeight'];report['scale']=scale
   assert not s['world']['camera']['overview']
   assert len([k for k in s['bounds'] if k.startswith('place-')])==9
   await p.screenshot(path=str(OUT/'01-depart.png'))
   for index,target in enumerate(['park','camp','park']):
    if (await state(p))['phase']=='explore':await click(p,'place-'+target)
    else:await click(p,'destinations');await click(p,'destination-'+target)
    await phase(p,'moving')
    if index==0:
     await p.wait_for_function('window.__townTest.snapshot().world.speed>1',timeout=15000)
     await click(p,'pause');frozen=(await snap(p))['world'];await p.wait_for_timeout(500)
     after=(await snap(p))['world'];assert frozen['camera']==after['camera'] and frozen['position']==after['position']
     await click(p,'resume');await click(p,'settings');await click(p,'model-viewer')
     assert (await state(p))['paused'];await click(p,'model-back');await click(p,'back-to-town')
     assert abs((await snap(p))['world']['camera']['halfHeight']-scale)<.02
    trace=[];end=time.monotonic()+180
    while (await state(p))['phase']=='moving':
     assert time.monotonic()<end,'Route did not arrive'
     s=await snap(p);c=s['world']['camera'];assert abs(c['halfHeight']-scale)<.02,'Unwanted zoom during travel'
     assert c['mode']=='neighborhood' and not c['overview']
     trace.append({'position':s['world']['position'],'camera':c})
     if len(trace)==5:await p.screenshot(path=str(OUT/f'{index+2}-driving-{target}.png'))
     await p.wait_for_timeout(250)
    s=await settle(p);assert s['state']['location']==target
    stop=entrance(s,target);position=s['world']['position']
    assert math.hypot(position['x']-stop['x'],position['z']-stop['z'])<1e-5,(position,stop)
    assert abs(s['world']['camera']['halfHeight']-scale)<.02,'Arrival must keep the same close scale'
    landmark=next(x for x in s['places'] if x['id']==target);rect=s['layout']['worldRect'];b=landmark['screenBounds']
    assert rect['x']<=b['left']<b['right']<=rect['x']+rect['width'] and rect['y']<=b['top']<b['bottom']<=rect['y']+rect['height'],(target,b,rect)
    await p.screenshot(path=str(OUT/f'{index+2}-arrived-{target}.png'))
    report['trips'].append({'target':target,'stop':position,'heading':s['world']['heading'],'trace':trace,'landmark':landmark})
   a,b=report['trips'][0]['stop'],report['trips'][2]['stop']
   assert math.hypot(a['x']-b['x'],a['z']-b['z'])<1e-6 and abs(a['y']-b['y'])<1e-6
   assert abs(math.cos(report['trips'][0]['heading']-report['trips'][2]['heading'])+1)<1e-5,'Park must be reached from opposite directions'
   step=(await state(p))['mission']['steps'][0];assert step['placeId']=='park'
   for _ in range(step['quantity']):await click(p,'deliver-'+step['goodId'])
   await phase(p,'reward');assert (await state(p))['rewardCount']==1
   await p.wait_for_function('window.__townTest.snapshot().world.cargoMeshCount===0')
   assert len(requests)==baseline,requests[baseline:];assert not errors,errors
   report['pass']=True;report['requestsAfterReady']=0
   await p.screenshot(path=str(OUT/'05-reward.png'))
   print('PASS park same entrance from opposite directions; camp stop; fixed close scale, follow, pause, viewer return; real offline delivery',flush=True)
  finally:
   report['errors']=errors
   try:report['last']=await snap(p);await p.screenshot(path=str(OUT/'last.png'))
   except Exception:pass
   (OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));await browser.close()
if __name__=='__main__':asyncio.run(run())
