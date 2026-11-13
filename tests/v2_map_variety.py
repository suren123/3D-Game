#!/usr/bin/env python3
"""Inspect random towns through real Canvas controls, with read-only snapshots.

Run independently with TOWN_URL, or the same default URL as v2_browser.py.
The browser is deliberately launched only from main(), never on import.
"""
import asyncio
import json
import math
import time
import traceback
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from playwright.async_api import async_playwright
from v2_browser import ROOT, URL, snap, state, click, prepare, phase, is_game_request

OUT = ROOT / 'artifacts' / 'goal'
REPORT = OUT / 'map-variety.json'
MIN_MAPS, MAX_MAPS = 20, 30
EXPECTED_TEMPLATES = {'village-square', 'garden-walk', 'market-lane'}
EXPECTED_THEMES = {'town', 'farm', 'coast'}
EPSILON = 1e-4


def test_url():
    parts = urlsplit(URL)
    query = dict(parse_qsl(parts.query))
    query.update(test='1', seed='2', difficulty='easy')
    return urlunsplit(parts._replace(query=urlencode(query)))


def overlaps(a, b):
    return (min(a['x'] + a['width'], b['x'] + b['width']) - max(a['x'], b['x']) > EPSILON
            and min(a['y'] + a['height'], b['y'] + b['height']) - max(a['y'], b['y']) > EPSILON)


def contains_point(box, point):
    return (box['x'] <= point['x'] <= box['x'] + box['width']
            and box['y'] <= point['y'] <= box['y'] + box['height'])


def assert_neighborhood(shot, half_height=None, settled=False):
    """Validate the fixed scale and the world-owned focus without assuming town fit."""
    world, camera = shot['world'], shot['world']['camera']
    assert camera['mode'] == 'neighborhood' and not camera['overview'], camera
    assert math.isfinite(camera['halfHeight']) and camera['halfHeight'] > 0, camera
    if half_height is not None:
        assert abs(camera['halfHeight'] - half_height) < 1e-4, (half_height, camera)
    focus = camera['focus']
    assert all(math.isfinite(focus[axis]) for axis in ('x', 'y', 'z')), camera
    if world['moving']:
        assert all(abs(focus[axis] - world['position'][axis]) < 1e-4 for axis in ('x', 'z')), world
        assert abs(focus['y'] - .8) < 1e-4, focus
    else:
        landmark = next(p for p in world['landmarks'] if p['id'] == shot['state']['location'])
        expected = {'x': world['position']['x'] * .55 + landmark['x'] * .45,
                    'y': .8,
                    'z': world['position']['z'] * .55 + landmark['z'] * .45}
        assert all(abs(focus[axis] - expected[axis]) < 1e-4 for axis in expected), (focus, expected)
    if settled:
        assert all(abs(camera['target'][axis] - focus[axis]) < .05 for axis in ('x', 'z')), camera


def entrance_stop(shot, place_id):
    town = shot['state']['map']
    lot = next(place['lot'] for place in town['places'] if place['id'] == place_id)
    nodes = {node['id']: node for node in town['nodes']}
    a, b = (nodes[node_id] for node_id in lot['accessEdge'])
    dx, dz = b['x'] - a['x'], b['z'] - a['z']
    t = ((lot['frontageX'] - a['x']) * dx + (lot['frontageZ'] - a['z']) * dz) / (dx * dx + dz * dz)
    assert 0 <= t <= 1, lot
    stop = {'x': a['x'] + t * dx, 'z': a['z'] + t * dz}
    position = shot['world']['position']
    assert math.hypot(position['x'] - stop['x'], position['z'] - stop['z']) < 1e-4, (position, stop, lot)
    return stop


async def stable_neighborhood(page, timeout=90):
    """Wait for three distinct near-view frames, including explore card layout."""
    deadline, previous, steady = time.monotonic() + timeout, None, 0
    while time.monotonic() < deadline:
        shot = await snap(page)
        camera = shot['world']['camera']
        eligible = (shot['state']['phase'] in ('explore', 'delivery', 'loading')
                    and not shot['state']['paused'] and not shot['world']['moving']
                    and camera.get('mode') == 'neighborhood' and not camera['overview']
                    and all(abs(camera['target'][axis] - camera['focus'][axis]) < .05 for axis in ('x', 'z')))
        labels = {key: box for key, box in shot['bounds'].items() if key.startswith('place-')}
        if shot['state']['phase'] == 'explore':
            eligible = eligible and len(labels) == 9
        numbers = [camera['halfHeight']] + [camera['target'][axis] for axis in ('x', 'z')]
        for key in sorted(labels):
            numbers.extend(labels[key][axis] for axis in ('x', 'y', 'width', 'height'))
        if eligible and previous and shot['frames'] != previous['frame']:
            delta = max(abs(a - b) for a, b in zip(numbers, previous['numbers'])) if len(numbers) == len(previous['numbers']) else math.inf
            steady = steady + 1 if delta < .05 else 0
            if steady >= 3:
                assert_neighborhood(shot, settled=True)
                return shot
        elif not eligible:
            steady = 0
        if previous is None or shot['frames'] != previous['frame']:
            previous = {'frame': shot['frames'], 'numbers': numbers}
        await page.wait_for_timeout(200)
    raise AssertionError('Neighborhood camera did not settle across three rendered frames')


def validate_cards(shot, canvas):
    places = shot['state']['map']['places']
    expected = {'place-' + place['id'] for place in places}
    labels = {key: box for key, box in shot['bounds'].items() if key.startswith('place-')}
    assert len(places) == 9 and set(labels) == expected, (expected, labels)
    relative = shot['layout']['panelRect']
    panel = {**relative, 'x': relative['x'] + canvas['x'], 'y': relative['y'] + canvas['y']}
    relative_world = shot['layout']['worldRect']
    view = {**relative_world, 'x': relative_world['x'] + canvas['x'], 'y': relative_world['y'] + canvas['y']}
    for key, box in labels.items():
        assert all(math.isfinite(box[axis]) for axis in ('x', 'y', 'width', 'height')), (key, box)
        assert box['width'] > 0 and box['height'] > 0, (key, box)
        assert (box['x'] >= panel['x'] - EPSILON and box['y'] >= panel['y'] - EPSILON
                and box['x'] + box['width'] <= panel['x'] + panel['width'] + EPSILON
                and box['y'] + box['height'] <= panel['y'] + panel['height'] + EPSILON), (key, box, panel)
    for index, (key, box) in enumerate(labels.items()):
        for other_key, other in list(labels.items())[index + 1:]:
            assert not overlaps(box, other), ('full touch targets overlap', key, box, other_key, other)
    projected = {place['id']: place for place in shot['places']}
    assert set(projected) == {place['id'] for place in places}
    visible = []
    for place_id, place in projected.items():
        point = {'x': place['building']['x'] + canvas['x'], 'y': place['building']['y'] + canvas['y']}
        assert math.isfinite(point['x']) and math.isfinite(point['y']), (place_id, point)
        if not contains_point(view, point):
            continue  # Distant places remain selectable through their nine cards.
        visible.append(place_id)
        for key, box in shot['bounds'].items():
            assert not contains_point(box, point), ('a UI target hides a visible building tap point', place_id, point, key, box)
    assert shot['state']['location'] in visible, ('current landmark must be visible', visible)
    return {'worldViewport': view, 'panelViewport': panel, 'destinationCards': labels, 'visibleBuildingPointsChecked': sorted(visible)}



async def edge_tap(page, shot, side, place_id):
    box = shot['bounds']['place-' + place_id]
    # Two CSS pixels inside the complete card at mid-height. Hit the card's
    # edge rather than only its model thumbnail/text in the centre.
    inset = min(2, box['width'] / 10)
    x = {'left': box['x'] + inset, 'right': box['x'] + box['width'] - inset,
         'center': box['x'] + box['width'] / 2}[side]
    y = box['y'] + box['height'] / 2
    assert (await state(page))['location'] != place_id
    await page.touchscreen.tap(x, y)
    await page.wait_for_function('window.__townTest.snapshot().state.phase === "moving"', timeout=15000)
    observed = await snap(page)
    assert observed['state']['currentDestination'] == place_id, (side, place_id, observed['state'])
    return {'side': side, 'placeId': place_id, 'point': {'x': x, 'y': y},
            'targetBounds': box, 'currentDestination': observed['state']['currentDestination'],
            'phase': observed['state']['phase'], 'observedSnapshot': observed}


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'status': 'running', 'url': test_url(), 'maps': [], 'edgeTaps': [],
              'minimumMaps': MIN_MAPS, 'maximumMaps': MAX_MAPS,
              'errors': [], 'requestsAfterReady': [], 'limitations': 'Cloud Chromium SwiftShader; no physical iPad performance claim.'}
    requests = []
    errors = report['errors']
    baseline = None
    current_index = 0
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
            args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport={'width': 1180, 'height': 820}, device_scale_factor=1, has_touch=True)
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url) if is_game_request(request) else None)
        try:
            await page.goto(test_url(), wait_until='domcontentloaded')
            await page.wait_for_function('window.__townTest?.snapshot().ready', timeout=120000)
            initial = await snap(page)
            assert initial['resources']['ready'] and initial['audio']['count'] == len(initial['manifest']['audio'])
            assert await page.locator('canvas:visible').count() == 1
            assert await page.locator('button:visible,input:visible,a:visible').count() == 0
            baseline = len(requests)
            report['preloaded'] = {'resources': initial['resources'], 'audio': initial['audio'],
                                   'manifestVersion': initial['manifest']['version'], 'requestCount': baseline}
            await context.set_offline(True)
            await click(page, 'start')
            seeds, templates, themes = set(), set(), set()
            for current_index in range(1, MAX_MAPS + 1):
                # Even map1 is generated by the real settings/new-session flow;
                # the query seed is only the initial preload/welcome town.
                await click(page, 'settings')
                await click(page, 'difficulty-easy')
                await click(page, 'new-session')
                await phase(page, 'brief')
                new_state = await state(page)
                assert new_state['difficulty'] == 'easy' and new_state['seed'] not in seeds
                await prepare(page)
                # Empty departure is an exposed, valid child action; no cargo or
                # delivery is needed to inspect destination hit targets.
                await click(page, 'depart')
                shot = await stable_neighborhood(page)
                canvas = await page.locator('canvas:visible').bounding_box()
                assert canvas
                stem = f'map-variety-{current_index:02d}-{shot["state"]["seed"]}'
                (OUT / f'{stem}.json').write_text(json.dumps({'canvas': canvas, 'snapshot': shot}, ensure_ascii=False, indent=2))
                await page.screenshot(path=str(OUT / f'{stem}.png'))
                geometry = validate_cards(shot, canvas)
                town = shot['state']['map']
                seeds.add(town['seed']); templates.add(town['layout']['templateId']); themes.add(town['theme'])
                assert shot['state']['event'] is None and shot['state']['eventHistory'] == []
                assert shot['world']['orphanMeshCount'] == 0
                entry = {'index': current_index, 'seed': town['seed'], 'template': town['layout']['templateId'],
                         'theme': town['theme'], 'snapshot': f'{stem}.json', 'screenshot': f'{stem}.png', **geometry}
                report['maps'].append(entry)
                if current_index <= 3:
                    side, target = [('left', 'shop'), ('right', 'school'), ('center', 'hospital')][current_index - 1]
                    tap = await edge_tap(page, shot, side, target)
                    (OUT / f'{stem}-tap.json').write_text(json.dumps(tap, ensure_ascii=False, indent=2))
                    report['edgeTaps'].append({key: value for key, value in tap.items() if key != 'observedSnapshot'})
                    # The next iteration interrupts travel using the actual
                    # settings/new-session controls rather than a test command.
                assert len(requests) == baseline, requests[baseline:]
                assert not errors, errors
                print(f'PASS map {current_index}: seed={town["seed"]} template={town["layout"]["templateId"]} theme={town["theme"]}; nine separate panel cards and unobstructed visible buildings', flush=True)
                report['coverage'] = {'templates': sorted(templates), 'themes': sorted(themes),
                    'missingTemplates': sorted(EXPECTED_TEMPLATES - templates), 'missingThemes': sorted(EXPECTED_THEMES - themes)}
                REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2))
                if current_index >= MIN_MAPS and templates >= EXPECTED_TEMPLATES and themes >= EXPECTED_THEMES:
                    break
            assert len(report['maps']) >= MIN_MAPS
            assert {tap['side'] for tap in report['edgeTaps']} == {'left', 'right', 'center'}
            report['coverageComplete'] = templates >= EXPECTED_TEMPLATES and themes >= EXPECTED_THEMES
            report['status'] = 'passed'
            report['browser'] = browser.version
            if not report['coverageComplete']:
                print('NOTE maximum 30 random towns reached; missing coverage recorded:', report['coverage'], flush=True)
            print(f'PASS {len(report["maps"])} offline random towns; left/right/center real card taps; no new game requests', flush=True)
        except BaseException as error:
            report['status'] = 'failed'
            report['failure'] = {'mapIndex': current_index, 'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()}
            raise
        finally:
            if baseline is not None:
                report['requestsAfterReady'] = requests[baseline:]
            try:
                report['lastSnapshot'] = await snap(page)
                await page.screenshot(path=str(OUT / 'map-variety-latest.png'))
                if report['status'] == 'failed':
                    (OUT / 'map-variety-failure.json').write_text(json.dumps(report['lastSnapshot'], ensure_ascii=False, indent=2))
                    await page.screenshot(path=str(OUT / 'map-variety-failure.png'))
            except Exception as artifact_error:
                report['artifactError'] = str(artifact_error)
            REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2))
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
