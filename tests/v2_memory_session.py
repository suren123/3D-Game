#!/usr/bin/env python3
"""Complete three ordered errands through real input, with a recoverable mistake."""
import asyncio,json
from playwright.async_api import async_playwright
from v2_browser import ROOT,URL,snap,state,click,prepare,fill,finish,phase,travel,is_game_request
OUT=ROOT/'artifacts/goal/memory-session'
async def run():
 OUT.mkdir(parents=True,exist_ok=True);report={'checks':[],'rounds':[],'errors':[]};requests=[]
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':1180,'height':820},has_touch=True)
  p=await ctx.new_page();p.on('pageerror',lambda e:report['errors'].append(str(e)))
  p.on('request',lambda r:requests.append(r.url) if is_game_request(r) else None)
  try:
   await p.goto(URL+'?test=1&seed=19&difficulty=challenge')
   await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
   count=len(requests);report['bundle']=[u for u in requests if '/assets/index-' in u and '.js' in u]
   report['browser']=browser.version;await ctx.set_offline(True);await click(p,'start')
   for round_number in range(3):
    s=await state(p);assert s['phase']=='brief' and s['round']==round_number
    if round_number:
     assert s['capacityBonus']==0 and not s['storedCargo'] and not s['blockedEdges'] and s['shortageGoodId'] is None
    await p.screenshot(path=str(OUT/f'round-{round_number}-brief.png'))
    await prepare(p);await fill(p);await click(p,'depart')
    if round_number==0:
     s=await state(p);later=s['mission']['steps'][1]
     await travel(p,later['placeId']);before=await state(p)
     await click(p,'deliver-'+later['goodId']);after=await state(p)
     assert after['cargo']==before['cargo'] and after['completed']==before['completed'] and after['rewardCount']==0
     report['checks'].append('out-of-order delivery keeps cargo and progress')
     await p.screenshot(path=str(OUT/'gentle-order-recovery.png'))
     await click(p,'hint');await click(p,'listen')
     await p.wait_for_function('window.__townTest.snapshot().audio.playing>0',timeout=10000)
     assert (await state(p))['cargo']==before['cargo'] and (await state(p))['paused']
     await p.screenshot(path=str(OUT/'free-memory-reminder.png'));await click(p,'close-hint')
     report['checks'].append('free illustrated and spoken reminder preserves work')
    await finish(p,{'capacity':'two-trips'});await phase(p,'reward')
    s=await state(p);assert s['rewardCount']==round_number+1 and len(s['completed'])==3
    report['rounds'].append({'round':round_number,'template':s['mission']['templateId'],'steps':s['mission']['steps'],'vehicle':s['vehicleId'],'events':s['eventHistory']})
    await click(p,'next')
   await phase(p,'sessionComplete');s=await state(p)
   assert len({x['template'] for x in report['rounds']})==3
   assert len(s['eventHistory'])==1 and s['eventHistory'][0]=={'id':'capacity','option':'two-trips'}
   assert s['rewardCount']==3 and not report['errors'];assert len(requests)==count,requests[count:]
   report['checks'].extend(['three different ordered errands complete','temporary event effects clear between errands','capacity two-trip recovery completes original task','offline zero new game requests'])
   report['requestsAfterReady']=len(requests)-count;report['passed']=True
   await p.screenshot(path=str(OUT/'three-errands-complete.png'));print('PASS',report['checks'],flush=True)
  finally:
   try:report['snapshot']=await snap(p);await p.screenshot(path=str(OUT/'last-frame.png'))
   except Exception:pass
   (OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));await browser.close()
if __name__=='__main__':asyncio.run(run())
