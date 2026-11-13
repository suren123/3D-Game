#!/usr/bin/env python3
"""Regression for unobstructed 3D buildings and separate destination cards."""
import asyncio,json
from playwright.async_api import async_playwright
from v2_map_variety import stable_neighborhood, assert_neighborhood, contains_point
from v2_browser import OUT,URL,snap,state,click,prepare,fill,phase,center
async def visible_other_building(p):
 shot=await stable_neighborhood(p)
 canvas=await p.locator('canvas:visible').bounding_box();assert canvas
 area=shot['layout']['worldRect'];view={**area,'x':area['x']+canvas['x'],'y':area['y']+canvas['y']}
 for place in shot['places']:
  point={'x':place['building']['x']+canvas['x'],'y':place['building']['y']+canvas['y']}
  if place['id']!=shot['state']['location'] and place['visible'] and contains_point(view,point) and not any(contains_point(box,point) for box in shot['bounds'].values()):
   return place['id'],point,shot
 raise AssertionError(('No visible noncurrent building available for direct input regression',shot['state']['seed'],view,shot['places']))

async def run():
 OUT.mkdir(parents=True,exist_ok=True);results=[];errors=[]
 async with async_playwright() as w:
  browser=await w.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for width,height,dpr,touch in [(1180,820,1,False),(1180,820,2,True),(1366,1024,1,False)]:
   ctx=await browser.new_context(viewport={'width':width,'height':height},device_scale_factor=dpr,has_touch=True)
   p=await ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
   await p.goto(URL+'?test=1&seed=11');await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
   await click(p,'start');await prepare(p);await fill(p);await click(p,'depart');await p.wait_for_timeout(350)
   # A second finger may land on HTML/safe-area padding outside the canvas.
   # It must cancel a pending building pick as well as a GUI button press.
   await p.wait_for_function('!!window.__townTest.snapshot().bounds["place-school"]')
   target,body,departure=await visible_other_building(p)
   near_height=departure['world']['camera']['halfHeight']
   cdp=await ctx.new_cdp_session(p)
   a={'x':body['x'],'y':body['y'],'id':1};b={'x':width,'y':body['y'],'id':2}
   await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a]})
   await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a,b]})
   await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   await p.wait_for_timeout(200);assert (await state(p))['phase']=='explore'
   await cdp.detach()
   # Drag out of a destination card must not turn into a trip.
   x,y=await center(p,'place-cafe');await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(15,400,steps=8);await p.mouse.up()
   assert (await state(p))['phase']=='explore'
   await click(p,'hint');await p.mouse.click(x,y);assert (await state(p))['paused']
   await click(p,'close-hint')
   # A software GPU can take longer than a fixed 250 ms to lay out the newly
   # rebuilt GUI. Wait for its actual clickable rectangle, not a guessed delay.
   await p.wait_for_function('!!window.__townTest?.snapshot().bounds?.["place-school"]',timeout=15000)
   target,body,_=await visible_other_building(p)
   # Use the projected point only after checking the world viewport and all UI targets.
   if touch:await p.touchscreen.tap(body['x'],body['y'])
   else:await p.mouse.click(body['x'],body['y'])
   await phase(p,'moving');assert (await state(p))['currentDestination']==target
   await phase(p,'delivery');assert (await state(p))['location']==target
   arrived=await stable_neighborhood(p)
   assert_neighborhood(arrived,near_height,settled=True)
   assert 'overview' not in arrived['bounds']
   step=(await state(p))['mission']['steps'][0]
   await click(p,'destinations')
   x,y=await center(p,'destination-'+step['placeId'])
   if touch:await p.touchscreen.tap(x,y)
   else:await p.mouse.click(x,y)
   if step['placeId']!=target:
    await phase(p,'moving');assert (await state(p))['currentDestination']==step['placeId']
   await phase(p,'delivery')
   for _ in range(step['quantity']):await click(p,'deliver-'+step['goodId'])
   await phase(p,'reward')
   assert (await state(p))['rewardCount']==1
   results.append({'viewport':[width,height],'dpr':dpr,'touch':touch,'building':target,'destinationCard':step['placeId'],'completed':True})
   print('PASS direct map building + destination card + delivery',width,height,dpr,touch,flush=True)
   await p.screenshot(path=str(OUT/f'map-input-{width}-{dpr}.png'));await ctx.close()
  assert not errors,errors
  (OUT/'map-input.json').write_text(json.dumps({'checks':results,'errors':errors},indent=2));await browser.close()
asyncio.run(run())
