#!/usr/bin/env python3
"""WebKit touch/graphics regression; Linux WPE is not native iPad Safari.

Uses the installed Playwright WebKit, or TOWN_WEBKIT_EXECUTABLE and normal
inherited loader variables for a user-owned browser dependency directory.
No game-state mutation, local-response substitution or TLS bypass.
"""
import os,sys,asyncio,json
from pathlib import Path
from v2_browser import ROOT,URL,snap,state,click,prepare,fill,phase,is_game_request
from playwright.async_api import async_playwright
OUT=ROOT/'artifacts/goal'
async def main():
 OUT.mkdir(parents=True,exist_ok=True)
 report={'engine':'Playwright WebKit WPE on Linux','realIPad':False,'errors':[],'checks':[]}
 browser=None
 try:
  async with async_playwright() as p:
   browser=await p.webkit.launch(executable_path=os.environ.get('TOWN_WEBKIT_EXECUTABLE') or None,headless=True)
   ctx=await browser.new_context(viewport={'width':1180,'height':820},has_touch=True)
   page=await ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
   requests=[];page.on('request',lambda r:requests.append(r.url) if is_game_request(r) else None)
   await page.goto(URL+'?test=1&seed=2',wait_until='domcontentloaded')
   await page.wait_for_function('window.__townTest?.snapshot().ready||!document.querySelector("#graphics-error").hidden',timeout=180000)
   s=await snap(page)
   if not s['ready']:raise RuntimeError('WebKit cannot create ready WebGL game: '+str(report['errors']))
   report['browser']=browser.version;report['bundle']=[x for x in requests if '/assets/index-' in x and '.js' in x]
   baseline=len(requests);await ctx.set_offline(True)
   await click(page,'start');await prepare(page);await fill(page);await click(page,'depart');await page.wait_for_timeout(800)
   await page.screenshot(path=str(OUT/'webkit-town.png'))
   step=(await state(page))['mission']['steps'][0]
   await click(page,'place-'+step['placeId']);await phase(page,'delivery')
   for _ in range(step['quantity']):await click(page,'deliver-'+step['goodId'])
   await phase(page,'reward');report['checks'].append('offline real touch complete delivery')
   await click(page,'settings');await click(page,'model-viewer');await click(page,'model-zoom-in');await click(page,'model-back');await click(page,'back-to-town')
   report['checks'].append('model viewer and zoom restore state')
   await page.set_viewport_size({'width':820,'height':1180});await page.wait_for_function('window.__townTest.snapshot().orientationBlocked')
   assert (await state(page))['paused'];await page.set_viewport_size({'width':1180,'height':820});await page.wait_for_function('!window.__townTest.snapshot().orientationBlocked')
   report['checks'].append('portrait guard and return')
   assert not report['errors'],report['errors'];assert len(requests)==baseline,requests[baseline:]
   report['requestsAfterReady']=len(requests)-baseline;report['pass']=True;report['final']=await snap(page)
   await page.screenshot(path=str(OUT/'webkit-final.png'));print('PASS',report['checks'],flush=True)
   await browser.close();browser=None
 except Exception as e:
  report['failure']=str(e);print('FAILED',str(e),flush=True);raise
 finally:(OUT/'webkit-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':asyncio.run(main())
