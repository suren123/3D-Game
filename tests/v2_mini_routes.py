#!/usr/bin/env python3
"""New Mini destinations, transient cargo and actual rendered turning samples."""
import asyncio,json,math
from playwright.async_api import async_playwright
from v2_browser import OUT,URL,snap,state,click,prepare,fill,phase,is_game_request

async def run():
 OUT.mkdir(parents=True,exist_ok=True);errors=[];reports=[]
 async with async_playwright() as w:
  browser=await w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':1180,'height':820},has_touch=True)
  p=await ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
  try:
   for seed,place in [(2,'shop'),(12,'camp')]:
    await ctx.set_offline(False);requests=[]
    def record(r):
     if is_game_request(r):requests.append(r.url)
    p.on('request',record)
    await p.goto(URL+f'?test=1&seed={seed}&difficulty=easy')
    await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
    count=len(requests);await ctx.set_offline(True)
    await click(p,'start');await prepare(p)
    s=await state(p);step=s['mission']['steps'][0];assert step['placeId']==place
    await click(p,'load-'+step['goodId'])
    await p.wait_for_function('window.__townTest.snapshot().world.cargoAnimation!==null',timeout=10000)
    await click(p,'pause');frozen=(await snap(p))['world']['cargoAnimation']
    assert frozen is not None
    await p.wait_for_timeout(500);assert (await snap(p))['world']['cargoAnimation']==frozen
    await click(p,'resume')
    await p.wait_for_function('window.__townTest.snapshot().world.cargoMeshCount===0',timeout=30000)
    await fill(p);await p.wait_for_function('window.__townTest.snapshot().world.cargoMeshCount===0',timeout=30000)
    await click(p,'depart')
    await p.wait_for_function('(()=>{const s=window.__townTest.snapshot();return s.state.map.places.every(p=>s.bounds["place-"+p.id])})()',timeout=15000)
    s=await snap(p)
    assert s['world']['camera']['overview'] and 'overview' not in s['bounds']
    assert all(p['rotation']==0 for p in s['world']['landmarks']),'landmark fronts must face the fixed camera'
    assert all('place-'+place['id'] in s['bounds'] for place in s['state']['map']['places'])
    await p.screenshot(path=str(OUT/f'mini-town-{place}.png'))
    # Observe the real rendered game; no game-state mutation or instant travel.
    await p.evaluate('''()=>{window.motionSamples=[];window.sampleTrip=true;function sample(){if(!window.sampleTrip)return;const s=window.__townTest.snapshot();if(s.world.moving)window.motionSamples.push({position:s.world.position,heading:s.world.heading,speed:s.world.speed,curvature:s.world.curvature});requestAnimationFrame(sample)}requestAnimationFrame(sample)}''')
    await click(p,'place-'+place);await phase(p,'delivery')
    samples=await p.evaluate('()=>{window.sampleTrip=false;return window.motionSamples}')
    assert samples and any(s['speed']>0 for s in samples)
    changes=[abs(math.atan2(math.sin(b['heading']-a['heading']),math.cos(b['heading']-a['heading']))) for a,b in zip(samples,samples[1:])]
    assert max(changes,default=0)<math.pi/2,'turns must not snap a right angle in one update'
    if place=='shop':assert any(abs(s['curvature'])>.01 for s in samples),'bent route must visibly use an arc'
    assert (await snap(p))['world']['speed']==0
    for _ in range(step['quantity']):await click(p,'deliver-'+step['goodId'])
    await phase(p,'reward')
    await p.wait_for_function('window.__townTest.snapshot().world.cargoMeshCount===0',timeout=30000)
    assert not (await state(p))['cargo']
    assert len(requests)==count,requests[count:]
    reports.append({'seed':seed,'destination':place,'sampleCount':len(samples),'maxHeadingStepRadians':max(changes,default=0),'samples':samples,'offlineRequests':0,'reward':True})
    print('PASS',place,'offline task, cargo pause/cleanup, automatic overview, smooth travel',flush=True)
    p.remove_listener('request',record)
   assert not errors,errors
  finally:
   try:
    await p.screenshot(path=str(OUT/'mini-routes-latest.png'))
    (OUT/'mini-routes.json').write_text(json.dumps({'scenarios':reports,'errors':errors,'snapshot':await snap(p)},ensure_ascii=False,indent=2))
   finally:await browser.close()

if __name__=='__main__':asyncio.run(run())
