#!/usr/bin/env python3
"""Real touch deliveries across three themes with Kenney scenes, fully offline."""
import asyncio,json
from playwright.async_api import async_playwright
from v2_browser import ROOT,URL,snap,state,click,prepare,fill,finish,phase,is_game_request
OUT=ROOT/'artifacts'/'kenney'
async def run():
 OUT.mkdir(parents=True,exist_ok=True);reports=[];errors=[]
 async with async_playwright() as w:
  b=await w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  try:
   for seed,target,theme in [(2,'shop','coast'),(7,'school','farm'),(19,'hospital','town')]:
    viewport={'width':1366,'height':1024} if seed==19 else {'width':1180,'height':820}
    ctx=await b.new_context(viewport=viewport,has_touch=True)
    p=await ctx.new_page();requests=[]
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.on('request',lambda r:requests.append(r.url) if is_game_request(r) else None)
    await p.goto(URL+f'?test=1&seed={seed}')
    await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
    before=len(requests);await ctx.set_offline(True)
    await click(p,'start');await prepare(p);await fill(p);await click(p,'depart')
    await p.wait_for_timeout(800);s=await snap(p)
    await p.screenshot(path=str(OUT/f'after-town-{seed}.png'))
    (OUT/f'scene-state-{seed}.json').write_text(json.dumps(s,ensure_ascii=False,indent=2))
    assert s['state']['map']['theme']==theme
    assert s['state']['mission']['steps'][0]['placeId']==target
    assert s['world']['streetInfo']['junctionCount']==len(s['state']['map']['nodes'])
    assert s['world']['streetInfo']['tileCount']>s['world']['streetInfo']['junctionCount']
    assert 'street-lamp' in s['world']['streetInfo']['decorationIds']
    assert s['world']['orphanMeshCount']==0
    assert all('place-'+x['id'] in s['bounds'] for x in s['state']['map']['places'])
    if target=='shop':await click(p,'place-'+target)
    else:
     body=next(x['building'] for x in s['places'] if x['id']==target)
     label=s['bounds']['place-'+target]
     assert not(label['x']<=body['x']<=label['x']+label['width'] and label['y']<=body['y']<=label['y']+label['height'])
     if seed==7:await p.touchscreen.tap(body['x'],body['y'])
     else:await p.mouse.click(body['x'],body['y'])
    await phase(p,'delivery')
    step=(await state(p))['mission']['steps'][0]
    for _ in range(step['quantity']):await click(p,'deliver-'+step['goodId'])
    await phase(p,'reward')
    await p.wait_for_function('window.__townTest.snapshot().world.cargoMeshCount===0',timeout=30000)
    assert (await state(p))['rewardCount']==1
    map_cycles=[]
    if seed==19:
     for _ in range(10):
      await click(p,'settings');await click(p,'new-session');await phase(p,'brief')
      changed=await snap(p);assert changed['world']['orphanMeshCount']==0
      assert changed['world']['streetInfo']['junctionCount']==len(changed['state']['map']['nodes'])
      map_cycles.append({'seed':changed['state']['seed'],'meshes':changed['render']['meshes']})
    assert len(requests)==before,requests[before:]
    reports.append({'seed':seed,'theme':theme,'destination':target,'offlineDelivery':True,'streetInfo':s['world']['streetInfo'],'viewport':viewport,'mapCycles':map_cycles,'requestsAfterReady':len(requests)-before})
    print('PASS Kenney scene',seed,target,theme,'offline delivery and loaded street models',flush=True)
    await ctx.close()
   ctx=await b.new_context(viewport={'width':1180,'height':820},has_touch=True)
   p=await ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
   await p.goto(URL+'?test=1&seed=0&difficulty=normal')
   await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
   await ctx.set_offline(True);await click(p,'start');await prepare(p);await fill(p);await click(p,'depart')
   first=(await state(p))['mission']['steps'][0]
   await click(p,'place-'+first['placeId']);await phase(p,'delivery')
   for _ in range(first['quantity']):await click(p,'deliver-'+first['goodId'])
   await phase(p,'event');event=await snap(p)
   assert event['state']['event']['id']=='roadworks'
   assert set(event['world']['streetInfo']['roadworkModelIds'])=={'street-fence','street-cone'}
   await p.screenshot(path=str(OUT/'roadworks-models.png'))
   await finish(p,{'roadworks':'detour'});assert (await state(p))['rewardCount']==1
   await click(p,'settings');await click(p,'new-session');await phase(p,'brief')
   clean=await snap(p);assert clean['world']['streetInfo']['roadworkModelIds']==[] and clean['world']['orphanMeshCount']==0
   reports.append({'seed':0,'roadworksOriginalModels':True,'detourDelivery':True,'mapCleanup':True})
   print('PASS original roadworks models, detour delivery, and cleanup',flush=True)
   await ctx.close()
   assert not errors,errors
  finally:
   (OUT/'visual-validation.json').write_text(json.dumps({'cases':reports,'errors':errors,'limitations':'Cloud Chromium SwiftShader; no real iPad Safari/performance claim.'},ensure_ascii=False,indent=2))
   await b.close()
if __name__=='__main__':asyncio.run(run())
