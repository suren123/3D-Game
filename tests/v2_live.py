#!/usr/bin/env python3
"""Check exact deployed Pages responses, a delivery and the model viewer.

Python uses system CA trust for managed HTTPS inspection. Playwright receives
only those real deployed responses; no TLS bypass or local asset substitution.
"""
import asyncio,json,os,re,urllib.request
from urllib.parse import urlsplit
from playwright.async_api import async_playwright
from v2_browser import ROOT,OUT,snap,state,click,prepare,fill,phase

BASE=os.environ.get('TOWN_LIVE_URL','https://suren123.github.io/3D-Game/')
def fetch(url):
 request=urllib.request.Request(url,headers={'User-Agent':'LittleTownDeploymentCheck','Accept-Encoding':'identity','Cache-Control':'no-cache'})
 with urllib.request.urlopen(request,timeout=40) as r:
  return r.status,r.headers.get('Content-Type','application/octet-stream'),r.read()

async def run():
 OUT.mkdir(parents=True,exist_ok=True);requests=[];errors=[]
 status,_,html=await asyncio.to_thread(fetch,BASE)
 assert status==200 and b'id="game"' in html
 expected=re.search(r'assets/index-[^" ]+\.js', (ROOT/'dist/index.html').read_text()).group()
 assert expected.encode() in html,'Pages still serves an older bundle'
 async with async_playwright() as w:
  browser=await w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':1180,'height':820},has_touch=True)
  async def transport(route):
   if not route.request.url.startswith(BASE):return await route.continue_()
   try:
    code,kind,body=await asyncio.to_thread(fetch,route.request.url)
    path=urlsplit(route.request.url).path.removeprefix(urlsplit(BASE).path)
    if path not in ['manifest.webmanifest','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png','icons/favicon-32.png']:
     requests.append({'path':path,'status':code,'bytes':len(body)})
    await route.fulfill(status=code,headers={'content-type':kind},body=body)
   except Exception as e:
    errors.append(type(e).__name__);await route.abort()
  await ctx.route('**/*',transport)
  p=await ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
  try:
   await p.goto(BASE+'?test=1&seed=2&v=town-mini-routes-1',wait_until='domcontentloaded')
   await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
   s=await snap(p);assert s['manifest']['version']=='town-mini-routes-1'
   assert s['resources']['icons']==15 and s['audio']['count']==51
   assert sum(r['path'].endswith('.glb') for r in requests)==27
   assert sum(r['path'].endswith('.mp3') for r in requests)==48
   assert sum(r['path'].startswith('icons/models/') for r in requests)==15
   baseline=len(requests)
   await click(p,'start');await prepare(p);await fill(p);await click(p,'depart')
   await p.wait_for_function('!!window.__townTest.snapshot().bounds["place-shop"]')
   s=await snap(p);assert s['world']['camera']['overview']
   assert all(x['rotation']==0 for x in s['world']['landmarks'])
   await p.screenshot(path=str(OUT/'live-mini-town.png'))
   step=s['state']['mission']['steps'][0];assert step['placeId']=='shop'
   await click(p,'place-shop');await phase(p,'delivery')
   for _ in range(step['quantity']):await click(p,'deliver-'+step['goodId'])
   await phase(p,'reward')
   await p.wait_for_function('window.__townTest.snapshot().world.cargoMeshCount===0',timeout=30000)
   await click(p,'settings');await click(p,'model-viewer');await click(p,'models-place');await click(p,'model-previous')
   s=await snap(p);assert s['modelView']['id']=='camp' and s['modelView']['sourceType']=='combined'
   await click(p,'model-zoom-in');assert (await snap(p))['world']['preview']['zoom']>1
   await p.screenshot(path=str(OUT/'live-model-viewer.png'))
   await click(p,'model-back');await click(p,'back-to-town')
   assert (await state(p))['phase']=='reward' and not (await state(p))['paused']
   assert len(requests)==baseline,requests[baseline:]
   assert not errors,errors
   print('PASS live current bundle, 27 models/15 icons/48 voices, direct shop delivery, cargo cleanup, model viewer, no later requests',flush=True)
  finally:
   try:(OUT/'live-mini-verification.json').write_text(json.dumps({'url':BASE,'bundle':expected,'status':status,'requests':requests,'errors':errors,'snapshot':await snap(p),'transport':'Actual deployed HTTPS responses using system CA verification; no local assets substituted.','limitations':'Software Chromium, no physical iPad test.'},ensure_ascii=False,indent=2))
   finally:await browser.close()

if __name__=='__main__':asyncio.run(run())
