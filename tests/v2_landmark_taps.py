#!/usr/bin/env python3
"""Reach all 27 landmarks through cards, then tap their visible buildings offline.

Run serially with other GPU tests, e.g. TOWN_URL=http://127.0.0.1:4173/
python tests/v2_landmark_taps.py. TOWN_EXPECT_BUNDLE optionally pins a bundle
filename. Each case gets a fresh context and uses actual Canvas controls.
This checks input routing, not visual quality or physical iPad performance.
"""
import asyncio
import json
import math
import os
import time
import traceback
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from playwright.async_api import async_playwright
from v2_map_variety import stable_neighborhood, assert_neighborhood, entrance_stop
from v2_browser import ROOT, URL, click, is_game_request, prepare, snap

OUT = ROOT / 'artifacts' / 'goal' / 'landmark-taps'
REPORT = OUT / 'results.json'
SEEDS = (2, 7, 19)
PLACES = ('depot', 'park', 'school', 'hospital', 'farm', 'cafe', 'garage', 'shop', 'camp')
VIEWPORT = {'width': 1180, 'height': 820}
EXPECTED_BUNDLE = os.environ.get('TOWN_EXPECT_BUNDLE', '')


def case_url(seed):
    parts = urlsplit(URL)
    query = dict(parse_qsl(parts.query))
    query.update(test='1', seed=str(seed), difficulty='easy')
    return urlunsplit(parts._replace(query=urlencode(query)))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def contains(box, point):
    return (box['x'] <= point['x'] <= box['x'] + box['width']
            and box['y'] <= point['y'] <= box['y'] + box['height'])


async def run_case(browser, seed, target):
    started = time.monotonic()
    result = {'seed': seed, 'target': target, 'input': 'mouse' if seed == 2 else 'touch',
              'url': case_url(seed), 'status': 'running', 'viewport': VIEWPORT,
              'deviceScaleFactor': 1, 'pageErrors': [], 'consoleErrors': [],
              'httpErrors': [], 'failedRequests': []}
    context = await browser.new_context(viewport=VIEWPORT, device_scale_factor=1, has_touch=True)
    page = await context.new_page()
    requests = []
    baseline = None
    before = None
    page.on('pageerror', lambda error: result['pageErrors'].append(str(error)))
    page.on('console', lambda message: result['consoleErrors'].append(message.text) if message.type == 'error' else None)
    page.on('request', lambda request: requests.append({'url': request.url, 'type': request.resource_type,
                                                       'game': is_game_request(request)}))
    page.on('requestfailed', lambda request: result['failedRequests'].append(
        {'url': request.url, 'failure': request.failure, 'game': is_game_request(request)}))
    page.on('response', lambda response: result['httpErrors'].append(
        {'url': response.url, 'status': response.status, 'game': is_game_request(response.request)}) if response.status >= 400 else None)
    try:
        await page.goto(result['url'], wait_until='domcontentloaded')
        await page.wait_for_function('window.__townTest?.snapshot().ready', timeout=120000)
        baseline = len(requests)
        # Offline begins immediately at ready; subsequent setup/taps cannot load assets.
        await context.set_offline(True)
        initial = await snap(page)
        result['preloaded'] = {'resources': initial['resources'], 'audio': initial['audio'],
                               'manifestVersion': initial['manifest']['version'], 'requestCount': baseline}
        result['build'] = await page.evaluate('''() => ({
            scripts: [...document.scripts].map(script => script.src).filter(Boolean),
            modules: performance.getEntriesByType('resource').map(entry => entry.name)
                .filter(name => /\\.js(?:[?#]|$)/.test(name)),
            userAgent: navigator.userAgent, devicePixelRatio: devicePixelRatio
        })''')
        if EXPECTED_BUNDLE:
            assert any(EXPECTED_BUNDLE in source for source in result['build']['scripts']), result['build']
        assert initial['resources']['ready'], initial['resources']
        assert initial['audio']['count'] == len(initial['manifest']['audio']), initial['audio']
        await click(page, 'start')
        result['vehicleId'] = await prepare(page)
        assert not (await snap(page))['state']['cargo'], 'Expected empty departure'
        await click(page, 'depart')
        before = await stable_neighborhood(page)
        assert before['state']['seed'] == seed, before['state']['seed']
        assert before['state']['location'] == 'depot', before['state']
        assert not before['state']['cargo'], before['state']['cargo']
        assert {place['id'] for place in before['state']['map']['places']} == set(PLACES)
        near_height = before['world']['camera']['halfHeight']
        # The near view cannot show all nine buildings. Use the nine real cards
        # to visit each place, then test the building now beside the parked car.
        if target != 'depot':
            await click(page, 'place-' + target)
            await page.wait_for_function('(id)=>{const s=window.__townTest.snapshot();return s.state.location===id&&!s.world.moving}', arg=target, timeout=240000)
            assert (await snap(page))['state']['phase'] == 'delivery'
        before = await stable_neighborhood(page)
        assert before['state']['location'] == target
        assert_neighborhood(before, near_height, settled=True)
        result['arrivalStop'] = entrance_stop(before, target)
        projected = {place['id']: place for place in before['places']}
        assert set(projected) == set(PLACES), sorted(projected)
        landmark = projected[target]
        canvas = await page.locator('canvas:visible').bounding_box()
        assert canvas, 'No visible Canvas bounds'
        # projectPlaces is Canvas-relative CSS coordinates; pointer APIs are viewport-relative.
        point = {'x': landmark['building']['x'] + canvas['x'],
                 'y': landmark['building']['y'] + canvas['y']}
        assert all(math.isfinite(value) for value in point.values()), point
        assert landmark['visible'], landmark
        world = before['layout']['worldRect']
        world = {**world, 'x': world['x'] + canvas['x'], 'y': world['y'] + canvas['y']}
        assert contains(world, point), (point, world)
        hidden_by = [key for key, box in before['bounds'].items() if contains(box, point)]
        result.update(point=point, canvas=canvas, worldViewport=world,
                      before={'phase': before['state']['phase'], 'location': before['state']['location'],
                              'currentDestination': before['state']['currentDestination'],
                              'camera': before['world']['camera'], 'render': before.get('render'),
                              'landmark': landmark, 'uiTargetsCoveringPoint': hidden_by})
        assert not hidden_by, ('UI touch target covers world building', target, hidden_by)
        if result['input'] == 'touch':
            await page.touchscreen.tap(point['x'], point['y'])
        else:
            await page.mouse.click(point['x'], point['y'])
        # A current-place tap must run the existing TRAVEL behavior: depot
        # reopens loading; other landmarks acknowledge arrival without a trip.
        expected_message = '还可以补货或放回物品。' if target == 'depot' else '已经到了。选一件要交出的物品吧。'
        await page.wait_for_function('(message)=>window.__townTest.snapshot().state.message===message', arg=expected_message, timeout=15000)
        after = await snap(page)
        state = after['state']
        result['observed'] = {'phase': state['phase'], 'location': state['location'],
                              'currentDestination': state['currentDestination'],
                              'worldMoving': after['world']['moving'], 'message': state['message']}
        assert state['phase'] == ('loading' if target == 'depot' else 'delivery'), result['observed']
        assert state['location'] == target and state['currentDestination'] is None, result['observed']
        assert not after['world']['moving'] and after['world']['speed'] == 0, result['observed']
        assert state['message'] == expected_message, result['observed']
        assert state['cargo'] == before['state']['cargo'] and state['rewardCount'] == before['state']['rewardCount']
        assert_neighborhood(after, near_height)
        entrance_stop(after, target)
        assert not result['pageErrors'], result['pageErrors']
        assert not [error for error in result['httpErrors'] if error['game']], result['httpErrors']
        assert not [error for error in result['failedRequests'] if error['game']], result['failedRequests']
        late_game_requests = [request for request in requests[baseline:] if request['game']]
        assert not late_game_requests, late_game_requests
        result['status'] = 'passed'
    except Exception as error:
        result['status'] = 'failed'
        result['failure'] = {'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()}
        stem = f'seed-{seed}-{target}-failure'
        evidence = {'before': before}
        try:
            evidence['observedSnapshot'] = await snap(page)
        except Exception as artifact_error:
            evidence['snapshotError'] = str(artifact_error)
        try:
            await page.screenshot(path=str(OUT / f'{stem}.png'))
            result['failureScreenshot'] = f'{stem}.png'
        except Exception as artifact_error:
            evidence['screenshotError'] = str(artifact_error)
        write_json(OUT / f'{stem}.json', evidence)
        result['failureSnapshot'] = f'{stem}.json'
    finally:
        result['requestsAfterReady'] = requests[baseline:] if baseline is not None else []
        result['gameRequestsAfterReady'] = [request for request in result['requestsAfterReady'] if request['game']]
        result['durationSeconds'] = round(time.monotonic() - started, 3)
        await context.close()
    return result


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'status': 'running', 'startedUtc': datetime.now(timezone.utc).isoformat(),
              'url': URL, 'expectedBundle': EXPECTED_BUNDLE or None, 'results': [],
              'expectedCases': 27, 'viewport': VIEWPORT,
              'limitations': 'Cloud Chromium SwiftShader; input routing only, not visual approval or physical iPad performance.'}
    write_json(REPORT, report)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
            args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        report['browser'] = {'name': 'Chromium', 'version': browser.version,
                             'executable': '/usr/bin/chromium', 'renderer': 'ANGLE SwiftShader (requested)'}
        try:
            for seed in SEEDS:
                for target in PLACES:
                    result = await run_case(browser, seed, target)
                    report['results'].append(result)
                    write_json(REPORT, report)
                    print(f'{result["status"].upper()} seed={seed} world={target} input={result["input"]} '
                          f'observed={result.get("observed", result.get("failure", {}).get("message"))}', flush=True)
        finally:
            await browser.close()
            report['passed'] = sum(result['status'] == 'passed' for result in report['results'])
            report['failed'] = sum(result['status'] == 'failed' for result in report['results'])
            report['status'] = 'passed' if report['passed'] == 27 and not report['failed'] else 'failed'
            report['finishedUtc'] = datetime.now(timezone.utc).isoformat()
            write_json(REPORT, report)
    assert report['status'] == 'passed', f'{report["passed"]}/27 passed; see {REPORT}'


if __name__ == '__main__':
    asyncio.run(main())
