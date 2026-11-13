#!/usr/bin/env python3
"""Real touch driving camera regression: zoom, follow, pause and return."""
import asyncio,json,math
from playwright.async_api import async_playwright
from v2_browser import OUT,URL,snap,state,click,prepare,fill,phase

async def run():
 OUT.mkdir(parents=True,exist_ok=True);errors=[];report={}
 async with async_playwright() as w:
  browser=await w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':1180,'height':820},has_touch=True)
  p=await ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
  try:
   await p.goto(URL+'?test=1&seed=2&difficulty=easy')
   await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
   await ctx.set_offline(True)
   await click(p,'start');await prepare(p);await fill(p);await click(p,'depart')
   s=await snap(p);wide=s['world']['camera']['halfHeight']
   assert s['world']['camera']['overview']
   await p.screenshot(path=str(OUT/'camera-overview.png'))
   await click(p,'place-shop')
   await p.wait_for_function('(h)=>{const w=window.__townTest.snapshot().world;return w.moving&&!w.camera.overview&&w.camera.halfHeight<h*.65}',arg=wide,timeout=45000)
   s=await snap(p);report['driving']=s['world']
   assert math.hypot(s['world']['camera']['target']['x']-s['world']['position']['x'],s['world']['camera']['target']['z']-s['world']['position']['z'])<4
   await p.screenshot(path=str(OUT/'camera-driving.png'))
   await click(p,'pause');frozen=(await snap(p))['world']
   await p.wait_for_timeout(500);after=(await snap(p))['world']
   assert frozen['camera']==after['camera'] and frozen['position']==after['position']
   await click(p,'resume')
   await click(p,'settings');await click(p,'model-viewer')
   assert (await state(p))['paused']
   await click(p,'model-back');await click(p,'back-to-town')
   assert not (await snap(p))['world']['camera']['overview']
   await phase(p,'delivery')
   await p.wait_for_function('(h)=>{const c=window.__townTest.snapshot().world.camera;return c.overview&&c.halfHeight>h*.97}',arg=wide,timeout=30000)
   s=await snap(p);report['arrived']=s['world']
   await p.screenshot(path=str(OUT/'camera-arrived.png'))
   step=s['state']['mission']['steps'][0]
   for _ in range(step['quantity']):await click(p,'deliver-'+step['goodId'])
   await phase(p,'reward');assert not errors,errors
   report['pass']=True
   print('PASS offline touch delivery, driving zoom/follow, pause freeze, model-viewer return, arrival overview',flush=True)
  finally:
   report['errors']=errors
   (OUT/'camera-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
   await browser.close()

if __name__=='__main__':asyncio.run(run())
