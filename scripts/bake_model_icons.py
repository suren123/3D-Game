#!/usr/bin/env python3
"""Bake the actual shipped GLBs into UI icons using a local Vite server."""
import asyncio, base64, hashlib, json, os, subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
async def main():
    source="import{PLACES,VEHICLES}from'./src/v2/catalog.js';import{RESOURCE_MANIFEST as m}from'./src/v2/resource-manifest.js';console.log(JSON.stringify([...PLACES,...VEHICLES].map(x=>m.models.find(y=>y.id===x.id))))"
    models=json.loads(subprocess.check_output(['node','--input-type=module','-e',source],cwd=ROOT,text=True))
    output=ROOT/'public'/'icons'/'models';output.mkdir(parents=True,exist_ok=True)
    metadata={}
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=await browser.new_page(viewport={'width':256,'height':256})
        await page.goto(os.environ.get('TOWN_DEV_URL','http://127.0.0.1:5174/')+'scripts/model-icons.html')
        await page.wait_for_function('!!window.bakeModelIcon',timeout=60000)
        for model in models:
            data=await page.evaluate('(id)=>window.bakeModelIcon(id)',model['id'])
            (output/(model['id']+'.png')).write_bytes(base64.b64decode(data.split(',')[1]))
            metadata[model['id']]={'model':model['path'],'sha256':hashlib.sha256((ROOT/'public'/model['path']).read_bytes()).hexdigest()}
            print('Baked',model['id'],flush=True)
        await browser.close()
    (output/'sources.json').write_text(json.dumps(metadata,indent=2)+'\n')
if __name__=='__main__':asyncio.run(main())
