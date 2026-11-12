#!/usr/bin/env python3
"""Final resource/vehicle/preload-failure/storage checks through actual Canvas touches."""
import asyncio,json,subprocess
from playwright.async_api import async_playwright
from v2_browser import ROOT,OUT,URL,snap,state,click,fill,finish,phase,VEHICLES
plans=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import{createGame}from'./src/v2/rules.js';import{VEHICLES}from'./src/v2/catalog.js';console.log(JSON.stringify(VEHICLES.map(v=>{for(let seed=0;seed<1000;seed++){const s=createGame({seed}).getState();if(s.mission.vehicleChoices.includes(v.id)&&s.mission.requiredTags.every(t=>v.supports.includes(t)))return {id:v.id,seed};}throw Error(v.id)})))"],cwd=ROOT,text=True))
async def run():
 OUT.mkdir(parents=True,exist_ok=True);results=[];errors=[]
 async with async_playwright() as w:
  browser=await w.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':1180,'height':820},has_touch=True)
  await ctx.add_init_script("if(!localStorage.getItem('little-town-drivers:v2'))localStorage.setItem('little-town-drivers:v1',JSON.stringify({sound:false,stickers:['bread','flowers','wash']}));")
  p=await ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
  for plan in plans:
   requests=[]
   def record(r):requests.append(r.url)
   p.on('request',record)
   await ctx.set_offline(False)
   await p.goto(URL+f"?test=1&seed={plan['seed']}&difficulty=easy")
   await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
   s=await snap(p);assert not s['settings']['sound'] and s['settings']['historicalCount']==3
   assert await p.evaluate("JSON.parse(localStorage.getItem('little-town-drivers:v1')).stickers.length")==3
   baseline=len(requests);await ctx.set_offline(True)
   await click(p,'start');await click(p,'ack');await click(p,'vehicle-'+plan['id'])
   await fill(p);await click(p,'depart');s=await snap(p)
   assert s['world']['vehicleId']==plan['id']
   assert s['vehicleMaterials'] and all(m['kind']=='PBRMaterial' and m['lights']==2 for m in s['vehicleMaterials'])
   await p.screenshot(path=str(OUT/f"vehicle-{plan['id']}.png"))
   await finish(p)
   assert len(requests)==baseline,requests[baseline:]
   assert (await snap(p))['audio']['playing']==0
   results.append(plan);print('PASS offline vehicle',plan['id'],flush=True)
   p.remove_listener('request',record)
  await ctx.close()
  ctx=await browser.new_context(viewport={'width':1180,'height':820},has_touch=True);p=await ctx.new_page()
  await ctx.route('**/audio/voice-v2/good-bread.mp3',lambda route:route.fulfill(status=404,body='missing for deliberate test'))
  await p.goto(URL+'?test=1')
  await p.wait_for_function('!!window.__townTest?.snapshot().bounds?.retry',timeout=120000)
  s=await snap(p);assert not s['ready'] and 'start' not in s['bounds']
  await p.screenshot(path=str(OUT/'missing-resource.png'));print('PASS missing resource blocks start and shows Canvas retry',flush=True)
  await ctx.close()
  ctx=await browser.new_context(viewport={'width':1180,'height':820},has_touch=True)
  await ctx.add_init_script("Storage.prototype.getItem=()=>{throw new Error('blocked')};Storage.prototype.setItem=()=>{throw new Error('blocked')};")
  p=await ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
  await p.goto(URL+'?test=1&seed=11');await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
  await click(p,'start');await click(p,'ack');assert (await state(p))['phase']=='selectVehicle'
  print('PASS storage blocked: game still starts',flush=True)
  assert not errors,errors
  (OUT/'resource-validation.json').write_text(json.dumps({'vehicles':results,'historyMigrated':True,'missingResourceBlocksStart':True,'storageBlockedPlayable':True,'errors':errors},indent=2))
  await browser.close()
asyncio.run(run())
