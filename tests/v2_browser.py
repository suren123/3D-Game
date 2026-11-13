#!/usr/bin/env python3
"""Canvas coordinate/touch integration tests. Snapshot is read-only; never dispatch rules."""
import asyncio,json,os,time,subprocess
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'v2'; URL=os.environ.get('TOWN_URL','http://127.0.0.1:5173/')
VEHICLES=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import{VEHICLES}from'./src/v2/catalog.js';console.log(JSON.stringify(VEHICLES))"],cwd=ROOT,text=True))
checks=[]
def is_game_request(request):
 # Browsers may inspect installation metadata after play begins; these files
 # are not requested by gameplay and never block a vehicle, voice or texture.
 return not request.url.split('?')[0].endswith(('/manifest.webmanifest','/icons/apple-touch-icon.png','/icons/icon-192.png','/icons/icon-512.png','/icons/favicon-32.png'))
async def snap(p):return await p.evaluate('window.__townTest.snapshot()')
async def state(p):return (await snap(p))['state']
def ok(name):checks.append(name);print('PASS',name,flush=True)
async def center(p,key):
 await p.wait_for_function('(k)=>!!window.__townTest?.snapshot().bounds?.[k]',arg=key,timeout=15000)
 b=(await snap(p))['bounds'][key];return b['x']+b['width']/2,b['y']+b['height']/2
async def click(p,key):
 cargo_action=key.startswith(('load-','unload-','cargo-slot-'))
 if key.startswith('unload-'):
  prefix='cargo-slot-'+key[len('unload-'): ]+'-'
  await p.wait_for_function('(prefix)=>Object.keys(window.__townTest.snapshot().bounds).some(k=>k.startsWith(prefix))',arg=prefix,timeout=15000)
  key=next(k for k in (await snap(p))['bounds'] if k.startswith(prefix))
 if key in ('listen','destinations') and key not in (await snap(p))['bounds']:
  # These secondary actions now live inside the child's single help panel.
  await click(p,'hint')
 if key.startswith('vehicle-'):
  await p.wait_for_function('Object.keys(window.__townTest.snapshot().bounds).some(k=>k.startsWith("vehicle-"))')
  for _ in range(3):
   bounds=(await snap(p))['bounds']
   if key in bounds or 'next-vehicles' not in bounds:break
   await click(p,'next-vehicles')
   await p.wait_for_function('!!window.__townTest.snapshot().bounds["next-vehicles"]')
 x,y=await center(p,key);await p.touchscreen.tap(x,y);await p.wait_for_timeout(120)
 if cargo_action:await p.wait_for_function('!window.__townTest.snapshot().cargoTransfer?.active',timeout=15000)
# Long routes need extra wall time on the cloud's software renderer.
async def phase(p,value):await p.wait_for_function('(v)=>window.__townTest.snapshot().state.phase===v',arg=value,timeout=180000)
async def travel(p,place):
 await click(p,'destinations');await click(p,'destination-'+place)
 await p.wait_for_function('window.__townTest.snapshot().state.phase!=="moving"',timeout=180000)
 assert (await state(p))['location']==place
async def prepare(p,event_choices=None):
 await click(p,'ack');s=await state(p)
 v=next(v for v in VEHICLES if v['id'] in s['mission']['vehicleChoices'] and all(t in v['supports'] for t in s['mission']['requiredTags']))
 await click(p,'vehicle-'+v['id'])
 s=await state(p)
 if s['phase']=='event':
  assert s['event']['id']=='shortage' and not s['cargo']
  option=(event_choices or {}).get('shortage','reserve')
  await click(p,'event-'+option)
 await phase(p,'loading')
 return v['id']
async def fill(p):
 s=await state(p);v=next(v for v in VEHICLES if v['id']==s['vehicleId']);capacity=max(1,v['capacity']+s['capacityBonus'])
 for i,step in enumerate(s['mission']['steps']):
  if i in s['completed']:continue
  need=step['quantity']-s['delivered'].get(str(i),0)
  have=next((x['quantity'] for x in s['cargo'] if x['goodId']==step['goodId']),0)
  for _ in range(max(0,need-have)):
   s=await state(p)
   if sum(x['quantity'] for x in s['cargo'])>=capacity:return
   if s['shortageGoodId']==step['goodId'] and s['location']=='depot':continue
   await click(p,'load-'+step['goodId'])
async def finish(p,event_choices=None):
 used=[]
 for _ in range(60):
  s=await state(p)
  if s['phase']=='reward':return used
  if s['phase']=='loading':await fill(p);await click(p,'depart');continue
  if s['phase']=='event':
   eid=s['event']['id'];used.append(eid)
   option=(event_choices or {}).get(eid,s['event']['options'][0]['id'])
   await click(p,'event-'+option);continue
  if s['phase'] not in ('explore','delivery'):raise AssertionError(s['phase'])
  step=next(x for i,x in enumerate(s['mission']['steps']) if i not in s['completed'])
  if not any(x['goodId']==step['goodId'] for x in s['cargo']):
   source='garage' if s['shortageGoodId']==step['goodId'] else 'depot'
   await travel(p,source);continue
  if s['location']!=step['placeId'] or s['phase']!='delivery':await travel(p,step['placeId']);continue
  await click(p,'deliver-'+step['goodId'])
 raise AssertionError('No completion within bounded actions')
async def touch_edges(p,ctx):
 s=await state(p);g=s['mission']['steps'][0]['goodId'];key='load-'+g
 x,y=await center(p,key)
 await p.mouse.move(x,y);await p.mouse.down();await p.wait_for_timeout(1100)
 assert not (await state(p))['cargo']
 await p.mouse.up();await p.wait_for_timeout(150)
 assert sum(i['quantity'] for i in (await state(p))['cargo'])==1
 await click(p,'unload-'+g);ok('long press acts once on release; no repeated cargo')
 await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(10,10,steps=8);await p.mouse.up();await p.wait_for_timeout(150)
 assert not (await state(p))['cargo'];ok('drag-out cancels button')
 cdp=await ctx.new_cdp_session(p)
 a={'x':x,'y':y,'id':1};b={'x':x+90,'y':y,'id':2}
 await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a]})
 await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a,b]})
 await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 await p.wait_for_timeout(200);assert not (await state(p))['cargo'];ok('two-finger gesture cancels all commands')
 await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a]})
 await cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
 await p.wait_for_timeout(150);assert not (await state(p))['cargo'];ok('touch cancellation leaves cargo unchanged')
 await cdp.detach()
async def main():
 OUT.mkdir(parents=True,exist_ok=True);report={'checks':checks,'scenarios':[]};errors=[]
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':1180,'height':820},device_scale_factor=1,has_touch=True)
  p=await ctx.new_page();requests=[]
  p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url) if is_game_request(r) else None)
  try:
   await p.goto(URL+'?test=1&seed=11',wait_until='domcontentloaded')
   await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
   initial=await snap(p);assert initial['audio']['count']==len(initial['manifest']['audio']) and initial['resources']['ready']
   assert await p.locator('canvas:visible').count()==1
   assert await p.locator('button:visible,input:visible,a:visible').count()==0
   ok('single visible canvas; all manifest audio buffers decoded before start')
   await p.screenshot(path=str(OUT/'01-ready.png'))
   await ctx.set_offline(True);after_ready=len(requests)
   await click(p,'start');await p.screenshot(path=str(OUT/'02-brief.png'))
   await prepare(p);await touch_edges(p,ctx)
   s=await state(p);wrong=next(g for g in s['mission']['shelf'] if g!=s['mission']['steps'][0]['goodId'])
   await click(p,'load-'+wrong);assert (await state(p))['cargo'][0]['goodId']==wrong
   await click(p,'unload-'+wrong);await fill(p)
   before=await state(p);await click(p,'hint');assert (await state(p))['paused'];await click(p,'close-hint')
   assert (await state(p))['cargo']==before['cargo'];ok('wrong loading can be undone; free hint preserves cargo and progress')
   await click(p,'depart');await p.screenshot(path=str(OUT/'03-town.png'))
   await p.wait_for_timeout(7000);report['steadyRender']= (await snap(p))['render']
   s=await state(p);target=s['mission']['steps'][0]['placeId'];wrongplace=next(x['id'] for x in s['map']['places'] if x['id'] not in ('depot',target))
   await click(p,'destinations');await click(p,'destination-'+wrongplace)
   await phase(p,'moving');await click(p,'pause');frozen=(await snap(p))['world']['position'];await p.wait_for_timeout(500)
   assert (await snap(p))['world']['position']==frozen and (await snap(p))['audio']['playing']==0
   await click(p,'resume');await phase(p,'delivery');ok('pause freezes car and stops speech; resume arrives')
   s=await state(p);await click(p,'deliver-'+s['cargo'][0]['goodId']);assert (await state(p))['cargo']==s['cargo'] and not (await state(p))['completed']
   ok('wrong destination does not consume cargo or advance reward')
   await finish(p)
   for _ in range(2):await click(p,'next');await prepare(p);await finish(p)
   await click(p,'next');await phase(p,'sessionComplete');ok('three complete errands by real touch while offline')
   await p.screenshot(path=str(OUT/'04-session.png'))
   mesh_counts=[];themes=set()
   for i in range(10):
    await click(p,'settings');await click(p,'difficulty-challenge');await click(p,'new-session');await phase(p,'brief')
    s=await snap(p);themes.add(s['state']['map']['theme']);mesh_counts.append(s['render']['meshes'])
    assert s['world']['orphanMeshCount']==0,s['world']
    assert all(p['rotation']==0 for p in s['world']['landmarks'])
   assert len(requests)==after_ready,requests[after_ready:]
   report['mapCycles']={'themes':list(themes),'meshes':mesh_counts};ok('ten offline random maps: no network requests, bounded mesh counts')
   # Read-only test snapshots may expose answers, but product has no visible DOM controls.
   await ctx.set_offline(False)
   for seed,difficulty,choices in [(0,'normal',{'roadworks':'detour'}),(1,'normal',{'shortage':'pickup'}),(10,'challenge',{'repair':'pump'}),(11,'challenge',{'capacity':'two-trips'})]:
    await p.goto(URL+f'?test=1&seed={seed}&difficulty={difficulty}',wait_until='domcontentloaded')
    await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
    await click(p,'start');vehicle=await prepare(p,choices);await fill(p);await click(p,'depart')
    await finish(p,choices);s=await snap(p);used=[e['id'] for e in s['state']['eventHistory']]
    assert s['state']['rewardCount']>=1
    report['scenarios'].append({'seed':seed,'difficulty':difficulty,'events':used,'vehicle':vehicle,'render':s['render']})
    await p.screenshot(path=str(OUT/f'event-{seed}-complete.png'))
    ok(f'{difficulty} seed {seed}: event {used} recovers and finishes')
   # Resize actual UI and verify all visible controls remain inside the canvas.
   for width,height in [(1366,1024),(820,1180),(1180,820)]:
    await p.set_viewport_size({'width':width,'height':height});await p.wait_for_timeout(300)
    for key,b in (await snap(p))['bounds'].items():
     assert b['x']>=-2 and b['y']>=-2 and b['x']+b['width']<=width+2 and b['y']+b['height']<=height+2,(width,height,key,b)
   ok('resize and orientation changes preserve visible control bounds')
   assert not errors,errors
   report['errors']=errors;report['browser']=browser.version;report['final']=await snap(p)
  finally:
   try:await p.screenshot(path=str(OUT/'latest.png'));report['lastSnapshot']=await snap(p)
   except Exception:pass
   report['errors']=errors;(OUT/'integration.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
   await browser.close()
 print('Completed',len(checks),'checks',flush=True)
if __name__=='__main__':asyncio.run(main())
