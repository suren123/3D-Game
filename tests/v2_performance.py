#!/usr/bin/env python3
"""Repeatable software-browser sample; does not certify iPad performance."""
import asyncio,json,time
from pathlib import Path
from v2_browser import snap,click,prepare,fill,OUT,URL
from playwright.async_api import async_playwright
async def run():
 OUT.mkdir(parents=True,exist_ok=True)
 async with async_playwright() as w:
  b=await w.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  p=await b.new_page(viewport={'width':1180,'height':820},has_touch=True)
  await p.goto(URL+'?test=1&seed=11')
  await p.wait_for_function('window.__townTest?.snapshot().ready',timeout=120000)
  await click(p,'start');await prepare(p);await fill(p);await click(p,'depart')
  await p.wait_for_timeout(3000)
  before=await snap(p);start=time.monotonic();await p.wait_for_timeout(10000);s=await snap(p);elapsed=time.monotonic()-start
  s['measuredFps']=(s['frames']-before['frames'])/elapsed
  print(json.dumps({k:s[k] for k in ['render','audio','measuredFps','vehicleMaterials']},indent=2))
  open(OUT/'performance.json','w').write(json.dumps(s,indent=2))
  await p.screenshot(path=str(OUT/'performance.png'))
  await b.close()
asyncio.run(run())
