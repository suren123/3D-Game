#!/usr/bin/env python3
"""Picture-first UI acceptance through real Canvas input; no state mutation.

Three difficulty sessions, mistakes/recovery, stable cargo slots, offline play,
orientation, and proof screenshots. Run serially on the shared software GPU.
"""
import asyncio, json, re, traceback, argparse, os
from pathlib import Path
from playwright.async_api import async_playwright
from v2_browser import ROOT,URL,VEHICLES,snap,state,click,center,phase,prepare,fill,is_game_request,is_game_url

OUT=ROOT/os.environ.get('TOWN_UI_OUT','artifacts/picture-ui')
REPORT={'status':'running','checks':[],'sessions':[],'errors':[],'captures':[],'transfers':[],
 'limitations':'Cloud Chromium/SwiftShader; physical iPad and child comprehension not tested.'}

def count(s):return sum(x['quantity'] for x in s['state']['cargo'])
def occupied(s):return [x for x in s['ui']['slots'] if x['goodId']]
def check(name):REPORT['checks'].append(name);print('PASS',name,flush=True)
async def settled(p):
 await p.wait_for_function('''()=>{const s=window.__townTest.snapshot();return s.ui&&s.ui.texts.length&&Object.keys(s.bounds).length&&!s.cargoTransfer.active}''',timeout=30000)
 return await snap(p)

def ui_check(s):
 ui=s['ui']
 if ui['adult'] or ui['orientationBlocked']:return
 assert not any(re.search(r'[0-9×÷%]',t['text']) for t in ui['texts']),ui['texts']
 panel=s['layout']['panelRect']
 # CSS absolute coordinates: canvas is centred with the same offset as GUI.
 for b in s['bounds'].values():
  assert b['width']>0 and b['height']>0,b
 if ui['slots']:
  assert len(occupied(s))==count(s),(ui['slots'],s['state']['cargo'])
  assert all(x['bounds'] and x['bounds']['width']>=60*s['layout']['scale']['x'] for x in ui['slots'])
  for slot in ui['slots']:
   b=slot['bounds'];assert b['x']>=panel['x']-2 and b['x']+b['width']<=panel['x']+panel['width']+2,(b,panel)
  # Units are never collapsed to a quantity; every occupied slot is unique.
  assert len({x['index'] for x in occupied(s)})==count(s)

async def capture(p,name):
 s=await settled(p);ui_check(s)
 await p.screenshot(path=str(OUT/(name+'.png')))
 (OUT/(name+'.json')).write_text(json.dumps(s,ensure_ascii=False,indent=2))
 REPORT['captures'].append(name);return s

def geometry(s):return [(x['index'],x['bounds']) for x in s['ui']['slots']]
async def transfer(p,key,kind,name):
 x,y=await center(p,key);await p.touchscreen.tap(x,y)
 await p.wait_for_function('''kind=>{const f=window.__townTest.snapshot().cargoTransfer;return f.active&&f.stage==='flying'&&f.kind===kind&&f.progress>0&&f.progress<1}''',arg=kind,timeout=15000)
 s=await snap(p);REPORT['transfers'].append({'name':name,'flight':s['cargoTransfer'],'phase':s['state']['phase'],'cargo':s['state']['cargo']})
 await p.screenshot(path=str(OUT/(name+'.png')))
 await settled(p);return s

async def depart_to(p,target):
 s=await settled(p)
 if s['state']['phase']=='loading':await click(p,'depart');s=await settled(p)
 if s['state']['phase']=='explore':await click(p,'place-'+target)
 else:
  await click(p,'destinations');await click(p,'destination-'+target)
 await phase(p,'moving')

async def finish_round(p,prefix,reverse=False):
 s=await settled(p)
 if s['state']['phase']=='loading':await fill(p);await click(p,'depart')
 s=await settled(p)
 indices=list(range(len(s['state']['mission']['steps'])))
 if reverse:indices.reverse()
 for i in indices:
  s=await settled(p);step=s['state']['mission']['steps'][i]
  if i in s['state']['completed']:continue
  if s['state']['location']!=step['placeId']:
   await depart_to(p,step['placeId']);await phase(p,'delivery')
  s=await settled(p);ui_check(s)
  assert s['state']['event'] is None
  for _ in range(step['quantity']-s['state']['delivered'].get(str(i),0)):
   await click(p,'deliver-'+step['goodId'])
 await phase(p,'reward');await capture(p,prefix+'-reward')

async def session(browser,difficulty,seed,rounds):
 ctx=await browser.new_context(viewport={'width':1180,'height':820},has_touch=True)
 p=await ctx.new_page();requests=[]
 p.on('pageerror',lambda e:REPORT['errors'].append(str(e)))
 p.on('console',lambda m:REPORT.setdefault('consoleErrors',[]).append({'text':m.text,'location':m.location}) if m.type=='error' else None)
 p.on('request',lambda r:requests.append(r.url) if is_game_request(r) else None)
 await p.goto(URL+f'?test=1&seed={seed}&difficulty={difficulty}',wait_until='domcontentloaded')
 await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
 initial=await settled(p);REPORT.setdefault('bundles',[]).extend(await p.locator('script[src]').evaluate_all('(els)=>els.map(x=>x.src)'))
 assert await p.locator('canvas:visible').count()==1
 assert await p.locator('button:visible,input:visible,a:visible').count()==0
 await ctx.set_offline(True);baseline=len(requests)
 await click(p,'start');await capture(p,difficulty+'-brief')
 for round_index in range(rounds):
  prefix=f'{difficulty}-{round_index}'
  if round_index:
   await click(p,'next');await phase(p,'brief')
   await capture(p,prefix+'-brief')
  await click(p,'ack');await capture(p,prefix+'-vehicles')
  s=await state(p);vehicle='truck' if difficulty=='easy' and round_index==0 and 'truck' in s['mission']['vehicleChoices'] else s['mission']['vehicleChoices'][0]
  await click(p,'vehicle-'+vehicle);await phase(p,'loading')
  s=await capture(p,prefix+'-loading');slot_geometry=geometry(s)
  if round_index==0:
   # All cargo phases share the same unit slots and coordinates.
   await click(p,'depart');s=await settled(p)
   assert s['state']['phase']=='loading' and s['state']['feedbackCode']=='empty-cargo'
   assert any(t['text'] for t in s['ui']['texts'])
   target=s['state']['mission']['steps'][0]
   wrong=next(g for g in s['state']['mission']['shelf'] if g not in [x['goodId'] for x in s['state']['mission']['steps']])
   if difficulty=='easy':
    assert vehicle=='truck','Seed must exercise all six actual cargo slots'
    await transfer(p,'load-'+wrong,'load',prefix+'-load-flight')
    slot=occupied(await settled(p))[0]
    await transfer(p,f'cargo-slot-{wrong}-{slot["index"]}','unload',prefix+'-return-flight')
    for _ in range(6):await click(p,'load-'+wrong)
    full=await capture(p,prefix+'-six-full');assert count(full)==6
    await click(p,'load-'+wrong);s=await settled(p)
    assert s['state']['cargo']==full['state']['cargo'] and not s['cargoTransfer']['active'] and s['state']['feedbackCode']=='capacity-full'
    await click(p,f'cargo-slot-{wrong}-1');await click(p,'load-'+target['goodId'])
    mixed=await capture(p,prefix+'-mixed');assert mixed['ui']['slots'][1]['goodId']==target['goodId']
    assert all(x['goodId']==wrong for x in mixed['ui']['slots'] if x['index']!=1)
    for slot in list(mixed['ui']['slots']):
     if slot['goodId']==wrong:await click(p,f'cargo-slot-{wrong}-{slot["index"]}')
    await fill(p)
   elif difficulty=='normal':
    # Correct place with missing cargo: keep a wrong unit, travel, then recover.
    await click(p,'load-'+wrong)
    await depart_to(p,target['placeId']);await phase(p,'delivery')
    missing=await capture(p,prefix+'-missing-cargo')
    assert missing['state']['feedbackCode']=='missing-cargo'
    assert 'return-depot' in missing['bounds'] and 'destinations' in missing['bounds']
    before=missing['state']['cargo']
    await click(p,'deliver-'+wrong);after=await settled(p)
    assert after['state']['cargo']==before and after['state']['completed']==[] and after['state']['feedbackCode']=='wrong-item'
    await capture(p,prefix+'-wrong-item')
    await click(p,'return-depot');await phase(p,'loading')
    await click(p,'unload-'+wrong);await fill(p)
   else:await fill(p)
  else:await fill(p)
  s=await capture(p,prefix+'-packed')
  if round_index==0:
   assert geometry(s)==slot_geometry
   before=s['state']['cargo'];await click(p,'hint');hint=await capture(p,prefix+'-hint');assert hint['state']['paused']
   await click(p,'close-hint');assert (await state(p))['cargo']==before
  await click(p,'depart');s=await capture(p,prefix+'-destinations')
  if round_index==0:
   assert geometry(s)==slot_geometry
   wrong_place=next(x for x in s['state']['mission']['destinationChoices'] if x not in [t['placeId'] for t in s['state']['mission']['steps']])
   before=s['world']['position'];await click(p,'place-'+wrong_place);wrongshot=await capture(p,prefix+'-wrong-place')
   assert wrongshot['state']['phase']=='explore' and wrongshot['state']['feedbackCode']=='wrong-place'
   assert wrongshot['world']['position']==before and wrongshot['state']['currentDestination'] is None
   assert any(t['text'] in ('换一个','换地点','再想想') for t in wrongshot['ui']['texts']),wrongshot['ui']['texts']
  steps=s['state']['mission']['steps'];first=steps[-1] if difficulty=='challenge' else steps[0]
  await click(p,'place-'+first['placeId']);await phase(p,'moving')
  moving=await capture(p,prefix+'-driving')
  if round_index==0:
   assert geometry(moving)==slot_geometry
   assert not any(key=='destinations' or key.startswith('destination-') for key in moving['bounds'])
   assert all(not x['clickable'] for x in moving['ui']['slots'])
   await click(p,'hint');hint=await settled(p);assert 'destinations' not in hint['bounds'];await click(p,'close-hint')
   if difficulty=='easy':
    await click(p,'pause');frozen=(await snap(p))['world']['position'];await p.wait_for_timeout(450);assert (await snap(p))['world']['position']==frozen;await click(p,'resume')
    await p.set_viewport_size({'width':820,'height':1180});await p.wait_for_function('window.__townTest.snapshot().orientationBlocked&&window.__townTest.snapshot().state.paused')
    await p.screenshot(path=str(OUT/'portrait-guard.png'))
    await p.set_viewport_size({'width':1180,'height':820});await p.wait_for_function('!window.__townTest.snapshot().orientationBlocked&&!window.__townTest.snapshot().state.paused')
  await phase(p,'delivery');arrived=await capture(p,prefix+'-arrived')
  if round_index==0:assert geometry(arrived)==slot_geometry
  if difficulty=='easy' and round_index==0:
   for _ in range(first['quantity']-1):await click(p,'deliver-'+first['goodId'])
   await transfer(p,'deliver-'+first['goodId'],'deliver',prefix+'-last-delivery-flight')
   await phase(p,'reward');await capture(p,prefix+'-reward')
  else:await finish_round(p,prefix,reverse=difficulty=='challenge')
  final=await state(p);assert final['rewardCount']==round_index+1 and final['event'] is None
  assert not final['eventHistory'];check(prefix+' complete without automatic events')
 if rounds==3:
  await click(p,'next');await phase(p,'sessionComplete');await capture(p,difficulty+'-session-complete')
 assert len(requests)==baseline,requests[baseline:]
 REPORT['sessions'].append({'difficulty':difficulty,'seed':seed,'rounds':rounds,'rewardCount':(await state(p))['rewardCount'],'requestsAfterReady':len(requests)-baseline})
 await ctx.close()

async def run(rounds):
 OUT.mkdir(parents=True,exist_ok=True)
 async with async_playwright() as w:
  browser=await w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  try:
   for difficulty,seed in [('easy',83),('normal',2),('challenge',83)]:await session(browser,difficulty,seed,rounds)
   assert not [e for e in REPORT.get('consoleErrors',[]) if is_game_url(e['location'].get('url',''))],REPORT.get('consoleErrors',[])
   assert not REPORT['errors'],REPORT['errors'];REPORT['status']='passed'
  except Exception:
   REPORT['status']='failed';REPORT['failure']=traceback.format_exc()
   for ctx in browser.contexts:
    for page in ctx.pages:
     try:
      await page.screenshot(path=str(OUT/'failure.png'))
      (OUT/'failure.json').write_text(json.dumps(await snap(page),ensure_ascii=False,indent=2))
     except Exception:pass
   raise
  finally:
   (OUT/'report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2));await browser.close()
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--rounds',type=int,default=3);args=parser.parse_args()
 asyncio.run(run(args.rounds))
