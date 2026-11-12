#!/usr/bin/env python3
"""Browser proof for sidebar boundaries, portrait guard and install declarations.

Chromium cannot validate iPadOS's native Add to Home Screen UI.
"""
import asyncio,json
from playwright.async_api import async_playwright
from v2_browser import OUT,URL,snap,state,click,prepare,fill,phase

async def sidebar_bounds(p):
 await p.wait_for_timeout(250)
 s=await snap(p);panel=s['layout']['panelRect'];canvas=await p.locator('#game').bounding_box()
 for key,b in s['bounds'].items():
  if key.startswith('place-'):continue
  assert b['x']>=canvas['x']+panel['x']-2,(key,b,panel)
  assert b['x']+b['width']<=canvas['x']+panel['x']+panel['width']+2,(key,b,panel)
  assert b['y']>=canvas['y']-2 and b['y']+b['height']<=canvas['y']+canvas['height']+2,(key,b,canvas)
 return s

async def run():
 OUT.mkdir(parents=True,exist_ok=True);errors=[];checks=[]
 async with async_playwright() as w:
  browser=await w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':820,'height':1180},has_touch=True)
  p=await ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
  await p.goto(URL+'?test=1&seed=11')
  await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
  assert await p.locator('meta[name="apple-mobile-web-app-capable"]').get_attribute('content')=='yes'
  manifest_url=await p.locator('link[rel="manifest"]').evaluate('(e)=>e.href')
  manifest=await (await ctx.request.get(manifest_url)).json();assert manifest['display']=='standalone'
  assert (await snap(p))['orientationBlocked'] and 'start' not in (await snap(p))['bounds']
  await p.touchscreen.tap(410,590);assert not (await snap(p))['started']
  await p.screenshot(path=str(OUT/'ipad-portrait-guard.png'));checks.append('portrait startup cannot enter game')
  await p.set_viewport_size({'width':1180,'height':820})
  await p.wait_for_function('!window.__townTest.snapshot().orientationBlocked&&!!window.__townTest.snapshot().bounds.start')
  await click(p,'start');await sidebar_bounds(p)
  await click(p,'ack');await sidebar_bounds(p)
  s=await state(p)
  from v2_browser import VEHICLES
  vehicle=next(v for v in VEHICLES if v['id'] in s['mission']['vehicleChoices'] and all(t in v['supports'] for t in s['mission']['requiredTags']))
  await click(p,'vehicle-'+vehicle['id']);await phase(p,'loading');await sidebar_bounds(p);await fill(p)
  await p.screenshot(path=str(OUT/'sidebar-loading.png'))
  before=await state(p);await click(p,'hint');await sidebar_bounds(p);await click(p,'close-hint')
  assert (await state(p))['cargo']==before['cargo']
  await click(p,'depart');s=await sidebar_bounds(p)
  assert len([k for k in s['bounds'] if not k.startswith('place-')])<=4,s['bounds']
  await p.screenshot(path=str(OUT/'sidebar-town.png'));checks.append('brief, selection, loading, help and drive controls stay beside scene')
  step=(await state(p))['mission']['steps'][0]
  await click(p,'place-'+step['placeId']);await phase(p,'moving')
  await p.set_viewport_size({'width':820,'height':1180})
  await p.wait_for_function('window.__townTest.snapshot().orientationBlocked&&window.__townTest.snapshot().state.paused')
  frozen=(await snap(p))['world']['position'];await p.wait_for_timeout(600)
  assert (await snap(p))['world']['position']==frozen
  await p.set_viewport_size({'width':1180,'height':820})
  await p.wait_for_function('!window.__townTest.snapshot().orientationBlocked&&!window.__townTest.snapshot().state.paused')
  await phase(p,'delivery');await sidebar_bounds(p)
  await p.screenshot(path=str(OUT/'sidebar-delivery.png'));checks.append('portrait pauses journey; landscape resumes to delivery')
  for _ in range(step['quantity']):await click(p,'deliver-'+step['goodId'])
  await phase(p,'reward');await sidebar_bounds(p)
  await click(p,'pause');assert (await state(p))['paused']
  await p.set_viewport_size({'width':820,'height':1180});await p.wait_for_function('window.__townTest.snapshot().orientationBlocked')
  await p.set_viewport_size({'width':1180,'height':820});await p.wait_for_function('!window.__townTest.snapshot().orientationBlocked')
  assert (await state(p))['paused'];await click(p,'resume');checks.append('manual pause survives orientation changes')
  assert not errors,errors
  (OUT/'ipad-layout.json').write_text(json.dumps({'checks':checks,'errors':errors,'nativeIPadInstallTested':False},ensure_ascii=False,indent=2))
  print('PASS', '; '.join(checks),flush=True);await browser.close()

asyncio.run(run())
