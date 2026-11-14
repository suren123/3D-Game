#!/usr/bin/env python3
"""Phone landscape Canvas layout, real taps and one complete delivery.

Browser viewport/DPR simulation, not a physical Safari/iPhone claim.
"""
import asyncio,json,traceback,math,re,os
from playwright.async_api import async_playwright
from v2_browser import ROOT,URL,snap,state,click,phase,fill,is_game_request,is_game_url
OUT=ROOT/os.environ.get('TOWN_PHONE_OUT','artifacts/phone-ui')
SIZES=[(844,390),(667,375),(844,340)]
REPORT={'checks':[],'captures':[],'errors':[],'status':'running'}
def rectangle_check(s,canvas):
 layout=s['layout'];panel=layout['panelRect'];world=layout['worldRect']
 if not s['ui']['adult']:assert not any(re.search(r'[0-9×÷%]',x['text']) for x in s['ui']['texts']),s['ui']['texts']
 assert abs(panel['x']+panel['width']-canvas['width'])<1,(panel,canvas)
 assert abs(world['x'])<1 and abs(world['width']-panel['x'])<1,(world,panel)
 assert world['width']>canvas['width']/2,(world,canvas)
 bounds=[]
 for key,b in s['bounds'].items():
  assert min(b['width'],b['height'])>=43.5,(key,b)
  assert b['x']>=canvas['x']+panel['x']-1 and b['x']+b['width']<=canvas['x']+canvas['width']+1,(key,b)
  assert b['y']>=canvas['y']-1 and b['y']+b['height']<=canvas['y']+canvas['height']+1,(key,b,canvas)
  if not any(b==old for _,old in bounds):bounds.append((key,b))
 for i,(ka,a) in enumerate(bounds):
  for kb,b in bounds[i+1:]:
   dx=max(a['x']-b['x']-b['width'],b['x']-a['x']-a['width'],0)
   dy=max(a['y']-b['y']-b['height'],b['y']-a['y']-a['height'],0)
   assert math.hypot(dx,dy)>=5.95,(ka,kb,dx,dy)
 for slot in s['ui']['slots']:
  assert min(slot['bounds']['width'],slot['bounds']['height'])>=43.5,slot

async def capture(p,name):
 await p.wait_for_function('Object.keys(window.__townTest.snapshot().bounds).length>0&&!window.__townTest.snapshot().cargoTransfer.active')
 await p.wait_for_timeout(250)
 s=await snap(p);canvas=await p.locator('#game').bounding_box();rectangle_check(s,canvas)
 await p.screenshot(path=str(OUT/(name+'.png')))
 (OUT/(name+'.json')).write_text(json.dumps(s,ensure_ascii=False,indent=2));REPORT['captures'].append(name)
 return s
async def sizes(p,stage):
 for width,height in SIZES:
  await p.set_viewport_size({'width':width,'height':height});await capture(p,f'{stage}-{width}x{height}')

async def run():
 OUT.mkdir(parents=True,exist_ok=True)
 async with async_playwright() as w:
  browser=await w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':844,'height':390},device_scale_factor=2,has_touch=True)
  p=await ctx.new_page();requests=[]
  p.on('pageerror',lambda e:REPORT['errors'].append(str(e)))
  p.on('console',lambda m:REPORT.setdefault('consoleErrors',[]).append({'text':m.text,'location':m.location}) if m.type=='error' else None)
  p.on('request',lambda r:requests.append(r.url) if is_game_request(r) else None)
  try:
   await p.goto(URL+'?test=1&seed=83&difficulty=easy',wait_until='domcontentloaded')
   await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
   await ctx.set_offline(True);baseline=len(requests)
   REPORT['bundle']=await p.locator('script[src]').evaluate_all('(els)=>els.map(e=>e.src)')
   await sizes(p,'ready');await click(p,'start');await sizes(p,'brief');await click(p,'ack');await sizes(p,'vehicles')
   await p.set_viewport_size({'width':667,'height':375});await p.wait_for_timeout(300);await click(p,'vehicle-truck');await phase(p,'loading');await sizes(p,'loading')
   await p.set_viewport_size({'width':667,'height':375});await p.wait_for_timeout(300);await fill(p);await sizes(p,'packed')
   cargo=(await state(p))['cargo'];await click(p,'settings');await sizes(p,'settings')
   await click(p,'model-viewer');model=await capture(p,'model-viewer-844x340')
   assert any(t['text']==model['modelView']['packLabel'] for t in model['ui']['texts'])
   await click(p,'models-place')
   for expected in ['camp','shop']:
    await click(p,'model-previous');model=await capture(p,'model-viewer-'+expected+'-844x340')
    assert model['modelView']['id']==expected and any(t['text']==model['modelView']['packLabel'] for t in model['ui']['texts'])
   await click(p,'model-back');await click(p,'back-to-town');assert (await state(p))['cargo']==cargo
   await click(p,'hint');await sizes(p,'hint');await click(p,'close-hint');await click(p,'depart');await sizes(p,'places')
   s=await state(p);target=s['mission']['steps'][0];wrong=next(x for x in s['mission']['destinationChoices'] if x!=target['placeId'])
   await click(p,'place-'+wrong);await capture(p,'wrong-place-844x340');assert (await state(p))['feedbackCode']=='wrong-place'
   await p.set_viewport_size({'width':844,'height':390});await p.wait_for_timeout(300);await click(p,'place-'+target['placeId']);await phase(p,'moving');await sizes(p,'moving')
   assert all(not x['clickable'] for x in (await snap(p))['ui']['slots'])
   await phase(p,'delivery');await sizes(p,'arrived')
   await click(p,'deliver-'+target['goodId']);await click(p,'hint');await capture(p,'partial-hint-844x340');await click(p,'close-hint')
   await click(p,'deliver-'+target['goodId']);await phase(p,'reward');await sizes(p,'reward')
   completed_reward=(await state(p))['rewardCount']
   for difficulty in ['normal','challenge']:
    await click(p,'settings');await click(p,'difficulty-'+difficulty);await click(p,'new-session');await phase(p,'brief')
    await sizes(p,difficulty+'-brief');await click(p,'ack')
    vehicle=(await state(p))['mission']['vehicleChoices'][0];await click(p,'vehicle-'+vehicle);await phase(p,'loading');await fill(p)
    await sizes(p,difficulty+'-packed')
   await p.evaluate("document.body.style.paddingLeft='34px';document.body.style.paddingRight='34px';window.dispatchEvent(new Event('resize'))")
   await capture(p,'simulated-safe-area');canvas=await p.locator('#game').bounding_box();assert abs(canvas['x']-34)<1 and abs(canvas['width']-(844-68))<1
   assert len(requests)==baseline,requests[baseline:]
   assert not [e for e in REPORT.get('consoleErrors',[]) if is_game_url(e['location'].get('url',''))],REPORT.get('consoleErrors',[])
   assert not REPORT['errors'],REPORT['errors'];REPORT.update(status='passed',requestsAfterReady=0,rewardCount=completed_reward)
   REPORT['checks']=['3 landscape sizes, fixed right edge, map majority','all clickable targets >=44 CSS and spacing >=6','actual 667px loading / 844px driving / 340px-high delivery','settings, model viewer and reminder preserve cargo','wrong-place guard before driving','no new requests offline','simulated horizontal safe area respected']
  except Exception:
   REPORT['failure']=traceback.format_exc();REPORT['status']='failed'
   try:await p.screenshot(path=str(OUT/'failure.png'));REPORT['failureSnapshot']=await snap(p)
   except Exception:pass
   raise
  finally:
   (OUT/'report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2));await browser.close()
 print('PASS phone UI',REPORT['checks'],flush=True)
if __name__=='__main__':asyncio.run(run())
