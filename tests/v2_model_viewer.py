#!/usr/bin/env python3
"""Inspect every actual preloaded model through Canvas controls, offline."""
import asyncio,json,subprocess
from playwright.async_api import async_playwright
from v2_browser import ROOT,OUT,URL,snap,state,click,prepare,fill,is_game_request

async def run():
 catalog=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import{MODEL_CATALOG}from'./src/v2/model-catalog.js';console.log(JSON.stringify(MODEL_CATALOG))"],cwd=ROOT,text=True))
 OUT.mkdir(parents=True,exist_ok=True);errors=[];requests=[];visited=[]
 async with async_playwright() as w:
  browser=await w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':1180,'height':820},has_touch=True)
  p=await ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
  p.on('request',lambda r:requests.append(r.url) if is_game_request(r) else None)
  try:
   await p.goto(URL+'?test=1&seed=2')
   await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
   baseline=len(requests);await ctx.set_offline(True)
   await click(p,'start');await prepare(p)
   good=(await state(p))['mission']['steps'][0]['goodId'];await click(p,'load-'+good)
   before=await state(p)
   await click(p,'settings');await click(p,'model-viewer')
   for category in ['vehicle','place','decoration']:
    await click(p,'models-'+category)
    for i,expected in enumerate(x for x in catalog if x['category']==category):
     s=await snap(p)
     assert s['state']['paused'] and s['state']['cargo']==before['cargo']
     assert s['modelView']['id']==expected['id'],(s['modelView'],expected)
     assert s['world']['preview']['active'] and s['world']['preview']['id']==expected['id']
     assert s['modelView']['sourceLabel']==expected['sourceLabel']
     assert await p.locator('canvas:visible').count()==1
     for key,b in s['bounds'].items():
      assert b['x']>=s['layout']['panelRect']['x']-2 and b['x']+b['width']<=1182,(key,b)
      assert b['y']>=0 and b['y']+b['height']<=822,(key,b)
     visited.append(expected['id'])
     # Every landmark, especially all seven assemblies, needs its own close
     # image; visiting its metadata is not a visual-quality inspection.
     if category == 'place' or expected['id'] in ['van','street-road-cross','street-lamp','street-bench']:
      await p.screenshot(path=str(OUT/f'model-viewer-{expected["id"]}.png'))
     await click(p,'model-next')
   assert set(visited)=={m['id'] for m in (await snap(p))['manifest']['models']}
   z=(await snap(p))['world']['preview']['zoom'];await click(p,'model-zoom-in')
   assert (await snap(p))['world']['preview']['zoom']>z
   await click(p,'model-zoom-out');assert (await snap(p))['world']['preview']['zoom']==z
   await p.set_viewport_size({'width':820,'height':1180})
   await p.wait_for_function('window.__townTest.snapshot().orientationBlocked')
   assert (await state(p))['paused']
   await p.set_viewport_size({'width':1180,'height':820})
   await p.wait_for_function('!window.__townTest.snapshot().orientationBlocked')
   assert (await state(p))['paused'] and (await snap(p))['modelView']
   await click(p,'model-back');assert not (await snap(p))['world']['preview']['active']
   await click(p,'back-to-town')
   after=await state(p);assert not after['paused'] and after['cargo']==before['cargo'] and after['phase']==before['phase']
   await fill(p);await click(p,'depart');await p.wait_for_timeout(800)
   (ROOT/'artifacts'/'kenney').mkdir(parents=True,exist_ok=True)
   await p.screenshot(path=str(ROOT/'artifacts'/'kenney'/'final-town.png'))
   assert len(requests)==baseline,requests[baseline:]
   assert not errors,errors
   print(f'PASS all {len(visited)} actual models, source labels, zoom, portrait guard, pause restoration, offline zero requests',flush=True)
  finally:
   try:
    await p.screenshot(path=str(OUT/'model-viewer-latest.png'))
    (OUT/'model-viewer.json').write_text(json.dumps({'visited':visited,'errors':errors,'snapshot':await snap(p),'requestsAfterReady':len(requests)-baseline},ensure_ascii=False,indent=2))
   finally:await browser.close()

if __name__=='__main__':asyncio.run(run())
