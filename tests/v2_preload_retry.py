#!/usr/bin/env python3
"""Recover from a real missing voice through the Canvas retry button."""
import asyncio
import json
from playwright.async_api import async_playwright
from v2_browser import ROOT, URL, snap, state, click, prepare, fill, finish, is_game_request

OUT = ROOT / 'artifacts/goal/preload-retry'


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'errors': [], 'checks': []}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium',
            args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport={'width': 1180, 'height': 820}, has_touch=True)
        page = await context.new_page()
        page.on('pageerror', lambda error: report['errors'].append(str(error)))
        requests = []
        page.on('request', lambda request: requests.append(request.url) if is_game_request(request) else None)
        pattern = '**/audio/voice-v2/good-bread.mp3*'
        await context.route(pattern, lambda route: route.fulfill(status=404, body='deliberate missing asset'))
        try:
            await page.goto(URL + '?test=1&seed=2')
            await page.wait_for_function('!!window.__townTest?.snapshot().bounds?.retry', timeout=120000)
            failed = await snap(page)
            assert not failed['ready'] and 'start' not in failed['bounds']
            await page.screenshot(path=str(OUT / 'missing-voice.png'))
            report['checks'].append('missing required voice prevents start and displays retry')
            await context.unroute(pattern)
            async with page.expect_navigation(wait_until='domcontentloaded'):
                await click(page, 'retry')
            await page.wait_for_function('window.__townTest?.snapshot().ready', timeout=120000)
            ready = await snap(page)
            assert ready['resources']['ready'] and ready['audio']['count'] == len(ready['manifest']['audio'])
            report['manifestVersion'] = ready['manifest']['version']
            report['bundle'] = await page.evaluate('[...document.scripts].map(s=>s.src).filter(Boolean)')
            report['checks'].append('actual retry reloads and prepares all required resources')
            baseline = len(requests)
            await context.set_offline(True)
            await click(page, 'start')
            await prepare(page)
            await fill(page)
            await click(page, 'depart')
            await finish(page)
            assert (await state(page))['rewardCount'] == 1
            assert len(requests) == baseline, requests[baseline:]
            assert not report['errors'], report['errors']
            report['checks'].append('recovered game completes offline delivery without extra requests')
            report['passed'] = True
            report['requestsAfterReady'] = len(requests) - baseline
            await page.screenshot(path=str(OUT / 'recovered-delivery.png'))
            print('PASS', report['checks'], flush=True)
        finally:
            (OUT / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
