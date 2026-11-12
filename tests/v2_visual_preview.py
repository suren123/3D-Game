#!/usr/bin/env python3
"""Visual preview proof: actual Canvas inputs, offline delivery and map cleanup."""
import asyncio,json
from playwright.async_api import async_playwright
from v2_browser import OUT,URL,snap,click,prepare,fill,phase

async def run():
 OUT.mkdir(parents=True,exist_ok=True)
 errors=[];requests=[];cycles=[]
 async with async_playwright() as w:
  browser=await w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':1180,'height':820},has_touch=True)
  p=await ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url))
  await p.goto(URL+'?test=1&seed=11');await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
  baseline=len(requests);await ctx.set_offline(True)
  await click(p,'start');await prepare(p);await fill(p);await click(p,'depart');await p.wait_for_timeout(1200)
  s=await snap(p)
  assert len(s['manifest']['models'])==25
  assert all('place-'+place['id'] in s['bounds'] for place in s['state']['map']['places'])
  await p.screenshot(path=str(OUT/'visual-preview-overview.png'))
  await click(p,'place-cafe');await phase(p,'delivery');await p.wait_for_timeout(1400)
  await p.screenshot(path=str(OUT/'visual-preview-close.png'))
  for _ in range(2):await click(p,'deliver-flowers')
  await phase(p,'reward')
  assert (await snap(p))['state']['rewardCount']==1
  for _ in range(10):
   await click(p,'settings');await click(p,'new-session');await phase(p,'brief')
   s=await snap(p);assert s['world']['orphanMeshCount']==0,s['world']
   cycles.append({'seed':s['state']['seed'],'meshes':s['render']['meshes']})
  assert len(requests)==baseline,requests[baseline:]
  assert not errors,errors
  (OUT/'visual-preview.json').write_text(json.dumps({'offlineDelivery':True,'allSevenMarkersVisible':True,'mapCycles':cycles,'requestsAfterReady':len(requests)-baseline,'errors':errors,'limitations':'Cloud software Chromium; visual preview branch, not deployed; no physical iPad performance claim.'},ensure_ascii=False,indent=2))
  print('PASS visual preview: 25 models, seven markers, offline delivery, ten maps without orphan meshes or new requests',flush=True)
  await browser.close()

asyncio.run(run())
