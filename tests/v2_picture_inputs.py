#!/usr/bin/env python3
"""Real pointer edge cases and UI lifecycle for the picture interface."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
from v2_browser import ROOT,URL,snap,state,click,center,phase,prepare,fill,touch_edges,is_game_request
OUT=ROOT/'artifacts'/'picture-inputs'
async def run():
 OUT.mkdir(parents=True,exist_ok=True);report={'checks':[],'errors':[]}
 async with async_playwright() as w:
  browser=await w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':820,'height':1180},device_scale_factor=2,has_touch=True)
  p=await ctx.new_page();requests=[]
  p.on('pageerror',lambda e:report['errors'].append(str(e)))
  p.on('request',lambda r:requests.append(r.url) if is_game_request(r) else None)
  try:
   await p.goto(URL+'?test=1&seed=83&difficulty=easy',wait_until='domcontentloaded')
   await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
   assert (await snap(p))['orientationBlocked'] and 'start' not in (await snap(p))['bounds']
   await p.touchscreen.tap(410,590);assert not (await snap(p))['started']
   await p.screenshot(path=str(OUT/'portrait-start.png'))
   assert await p.locator('meta[name="apple-mobile-web-app-capable"]').get_attribute('content')=='yes'
   manifest_url=await p.locator('link[rel="manifest"]').evaluate('(e)=>e.href')
   manifest=await (await ctx.request.get(manifest_url)).json();assert manifest['display']=='standalone'
   await p.set_viewport_size({'width':1180,'height':820})
   await p.wait_for_function('!window.__townTest.snapshot().orientationBlocked&&!!window.__townTest.snapshot().bounds.start')
   report['checks'].append('portrait startup blocked; standalone declarations intact; landscape restores start')
   await ctx.set_offline(True);baseline=len(requests)
   await click(p,'start');await prepare(p);await touch_edges(p,ctx)
   report['checks'].append('long press, drag-out, multi-touch and cancel; DPR 2')
   good=(await state(p))['mission']['steps'][0]['goodId']
   for interruption in ['pause','orientation']:
    x,y=await center(p,'load-'+good);await p.touchscreen.tap(x,y)
    await p.wait_for_function('window.__townTest.snapshot().cargoTransfer.active')
    if interruption=='pause':await click(p,'pause')
    else:
     await p.set_viewport_size({'width':820,'height':1180});await p.wait_for_function('window.__townTest.snapshot().orientationBlocked')
    s=await snap(p);assert s['state']['paused'] and sum(x['quantity'] for x in s['state']['cargo'])==1
    assert not s['cargoTransfer']['active']
    if interruption=='pause':
     await p.set_viewport_size({'width':820,'height':1180});await p.wait_for_function('window.__townTest.snapshot().orientationBlocked')
     await p.set_viewport_size({'width':1180,'height':820});await p.wait_for_function('!window.__townTest.snapshot().orientationBlocked')
     assert (await state(p))['paused'];await click(p,'resume')
    else:
     await p.set_viewport_size({'width':1180,'height':820});await p.wait_for_function('!window.__townTest.snapshot().orientationBlocked&&!window.__townTest.snapshot().state.paused')
    await click(p,'unload-'+good);assert not (await state(p))['cargo']
    report['checks'].append(interruption+' during transfer preserves exactly one unit and unlocks input')
   await click(p,'settings');await click(p,'reduced-motion');await click(p,'back-to-town')
   await click(p,'load-'+good);s=await snap(p);assert not s['cargoTransfer']['active'] and sum(x['quantity'] for x in s['state']['cargo'])==1
   await click(p,'settings');await click(p,'model-viewer');s=await snap(p)
   assert s['ui']['adult'] and s['state']['paused'] and s['modelView']['sourceLabel']
   await click(p,'model-zoom-in');await p.screenshot(path=str(OUT/'model-viewer.png'))
   await click(p,'model-back');await click(p,'back-to-town');assert not (await state(p))['paused']
   report['checks'].append('reduced motion and adult model viewer preserve cargo')
   await fill(p);await click(p,'depart');s=await snap(p)
   targets={t['placeId'] for t in s['state']['mission']['steps']}
   place=next(x for x in s['places'] if x['visible'] and x['id'] not in targets|{'depot'} and 20<x['building']['x']<800 and 20<x['building']['y']<780)
   await p.touchscreen.tap(place['building']['x'],place['building']['y']);await p.wait_for_timeout(250)
   s=await snap(p);assert s['state']['phase']=='explore' and s['state']['feedbackCode']=='wrong-place'
   report['checks'].append('actual 3D building tap uses same wrong-place guard')
   for width,height in [(1366,1024),(1180,820)]:
    await p.set_viewport_size({'width':width,'height':height});await p.wait_for_timeout(500)
    s=await snap(p);canvas=await p.locator('#game').bounding_box();panel=s['layout']['panelRect']
    for key,b in s['bounds'].items():
     assert b['x']>=canvas['x']+panel['x']-2 and b['x']+b['width']<=canvas['x']+panel['x']+panel['width']+2,(key,b)
     assert b['y']>=canvas['y']-2 and b['y']+b['height']<=canvas['y']+canvas['height']+2,(key,b)
    await p.screenshot(path=str(OUT/f'layout-{width}.png'))
   report['checks'].append('all card bounds inside sidebar at both landscape sizes')
   target=(await state(p))['mission']['steps'][0]
   await click(p,'place-'+target['placeId']);await phase(p,'delivery')
   await click(p,'deliver-'+good);assert (await state(p))['delivered']['0']==1
   await click(p,'hint');await p.screenshot(path=str(OUT/'partial-delivery-hint.png'))
   hint=await snap(p);unit_checks=[x for x in hint['ui']['images'] if x['kind']=='check' and x['bounds']['width']<40]
   assert len(unit_checks)==1,unit_checks
   await click(p,'close-hint');await click(p,'deliver-'+good);await phase(p,'reward')
   report['checks'].append('partial delivery has exactly one unit check; remaining unit completes reward')
   assert len(requests)==baseline,requests[baseline:]
   assert not report['errors'],report['errors'];report.update(status='passed',requestsAfterReady=0)
  finally:
   report['snapshot']=await snap(p);(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));await browser.close()
 print('PASS',report['checks'],flush=True)
if __name__=='__main__':asyncio.run(run())
