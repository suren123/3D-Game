#!/usr/bin/env python3
"""Real-touch feedback/weather checks; snapshots are read-only, never test mutations.

TOWN_URL=http://127.0.0.1:5196/ python tests/v2_feedback.py
python tests/v2_feedback.py --weather-only --weather-timeout 600
python tests/v2_feedback.py --event-only
python tests/v2_feedback.py --skip-weather

Natural rain takes 84 active simulation seconds for seed19. Software rendering
can take much longer in wall time. A timeout is recorded as blocked, not passed;
this test never accelerates the production clock or dispatches rules directly.
"""
import argparse
import asyncio
import contextlib
import json
from pathlib import Path
import time
import traceback
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
from v2_browser import OUT, URL, VEHICLES, snap, click, prepare, fill, phase, is_game_request


def game_url(seed, difficulty):
    parts = urlsplit(URL)
    query = dict(parse_qsl(parts.query))
    query.update(test='1', seed=str(seed), difficulty=difficulty)
    return urlunsplit((parts.scheme, parts.netloc, parts.path or '/', urlencode(query), parts.fragment))


def progress(snapshot):
    """Only rules-owned progress; pause and presentation settings are excluded."""
    state = snapshot['state']
    keys = ['seed', 'difficulty', 'phase', 'round', 'mission', 'vehicleId', 'location',
            'cargo', 'storedCargo', 'completed', 'delivered', 'rewardCount', 'event',
            'eventUsed', 'eventHistory', 'blockedEdges', 'capacityBonus',
            'shortageGoodId', 'supplyLocations', 'currentDestination']
    return {key: state.get(key) for key in keys}


def frozen_world(snapshot):
    world = snapshot['world']
    return {key: world[key] for key in ['position', 'weather', 'particleCount', 'camera', 'cargoAnimation']}


class Observations:
    def __init__(self, page, case, output):
        self.page, self.case, self.output = page, case, output
        self.started = time.monotonic()
        self.rain = asyncio.Event()
        self.failure = None
        self.task = None
        self.last = None
        case.update(samples=0, maxParticleCount=0, weatherTransitions=[], screenshots=[])

    async def start(self):
        self.last = await snap(self.page)
        self.case['firstFrame'] = self.last['frames']
        self.task = asyncio.create_task(self.run())

    async def screenshot(self, name):
        path = self.output / name
        await self.page.screenshot(path=str(path))
        self.case['screenshots'].append(str(path))

    def check(self):
        if self.failure:
            raise AssertionError(self.failure)

    async def run(self):
        previous_weather = None
        try:
            while True:
                snapshot = await snap(self.page)
                self.last = snapshot
                world = snapshot['world']
                count, limit = world['particleCount'], world['particleLimit']
                assert limit == 96 and 0 <= count <= limit, f'Particle pool exceeded: {count}/{limit}'
                self.case['samples'] += 1
                self.case['maxParticleCount'] = max(self.case['maxParticleCount'], count)
                elapsed = time.monotonic() - self.started
                if world['weather'] != previous_weather:
                    self.case['weatherTransitions'].append({'weather': world['weather'],
                        'wallSeconds': round(elapsed, 3), 'frame': snapshot['frames'],
                        'paused': snapshot['state']['paused']})
                    previous_weather = world['weather']
                if world['weather'] == 'rain' and not self.rain.is_set():
                    self.case['naturalRain'] = {'wallSecondsFromObservationStart': round(elapsed, 3),
                        'frame': snapshot['frames'], 'frameDelta': snapshot['frames'] - self.case['firstFrame'],
                        'world': world, 'render': snapshot['render']}
                    await self.screenshot('feedback-natural-rain.png')
                    self.rain.set()
                await asyncio.sleep(.25)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            self.failure = f'{type(error).__name__}: {error}'

    async def stop(self):
        if self.task:
            self.task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.task
        self.case['observedWallSeconds'] = round(time.monotonic() - self.started, 3)
        if self.last:
            self.case['lastFrame'] = self.last['frames']
            self.case['observedFrameDelta'] = self.last['frames'] - self.case['firstFrame']


def checked(report, name):
    report['checks'].append(name)
    print('PASS', name, flush=True)


async def open_case(browser, seed, difficulty, case, report):
    context = await browser.new_context(viewport={'width': 1180, 'height': 820}, has_touch=True)
    page = await context.new_page()
    requests, failed, page_errors, console_errors = [], [], [], []
    page.on('request', lambda request: requests.append(request.url) if is_game_request(request) else None)
    page.on('requestfailed', lambda request: failed.append({'url': request.url, 'failure': request.failure})
            if is_game_request(request) else None)
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
    case.update(seed=seed, difficulty=difficulty, url=game_url(seed, difficulty), requests=requests,
                requestFailures=failed, pageErrors=page_errors, consoleErrors=console_errors)
    report['cases'].append(case)
    try:
        started = time.monotonic()
        await page.goto(case['url'], wait_until='domcontentloaded')
        await page.wait_for_function('window.__townTest?.snapshot().ready', timeout=120000)
        case['readyWallSeconds'] = round(time.monotonic() - started, 3)
        case['bundle'] = await page.evaluate('Array.from(document.scripts,s=>s.src).filter(Boolean)')
        initial = await snap(page)
        case['initialFrame'] = initial['frames']
        case['resourceVersion'] = initial['manifest']['version']
        case['render'] = initial['render']
        case['requestsAtReady'] = len(requests)
        await context.set_offline(True)
        return context, page
    except Exception:
        await context.close()
        raise


async def assert_paused(page, report, case, name):
    await click(page, 'pause')
    await page.wait_for_function('window.__townTest.snapshot().state.paused', timeout=10000)
    before = await snap(page)
    await page.wait_for_timeout(900)
    after = await snap(page)
    assert frozen_world(before) == frozen_world(after), {'before': frozen_world(before), 'after': frozen_world(after)}
    assert progress(before) == progress(after), 'Paused rules progress changed'
    case.setdefault('pauseSamples', []).append({'name': name, 'before': before['world'],
        'after': after['world'], 'framesRendered': after['frames'] - before['frames']})
    checked(report, f'{name}: pause freezes position, camera, weather, particles and cargo animation')
    await click(page, 'resume')


async def reduced_motion(page, report, case):
    before = await snap(page)
    await click(page, 'settings')
    assert (await snap(page))['state']['paused']
    # Fresh contexts use the default. If a future default changes, do not toggle
    # reduced motion back off and accidentally turn this into a false positive.
    if not (await snap(page))['settings']['reducedMotion']:
        await click(page, 'reduced-motion')
    enabled = await snap(page)
    assert enabled['settings']['reducedMotion']
    assert enabled['world']['particleCount'] == 0
    assert progress(before) == progress(enabled), 'Presentation preference changed mission progress'
    await click(page, 'back-to-town')
    await page.wait_for_timeout(1500)
    after = await snap(page)
    assert after['world']['particleCount'] == 0
    assert progress(before) == progress(after)
    case['reducedMotion'] = {'before': before['world'], 'after': after['world'],
        'progressUnchanged': True, 'settingEnabled': after['settings']['reducedMotion']}
    checked(report, 'Reduced motion clears the particle pool and keeps it empty without changing progress')


async def weather_wait(page, observer, args, report, case):
    started = time.monotonic()
    while not observer.rain.is_set():
        observer.check()
        if time.monotonic() - started > args.weather_timeout:
            snapshot = await snap(page)
            case['weatherBlocked'] = {'reason': 'No natural rain observed before wall-clock deadline',
                'waitWallSeconds': round(time.monotonic() - started, 3),
                'timeoutSeconds': args.weather_timeout, 'expectedPeriodActiveSeconds': 84,
                'currentFrame': snapshot['frames'], 'world': snapshot['world'], 'render': snapshot['render'],
                'note': 'Active simulation time is not exposed; no clock/state mutation was used.'}
            raise PlaywrightTimeoutError('Natural rain not observed; inspect weatherBlocked, actual frames and renderer in report')
        await asyncio.sleep(.5)
    observer.check()
    case['weatherWaitWallSeconds'] = round(time.monotonic() - started, 3)
    checked(report, 'Natural seed19 rain observed and photographed using the unmodified production clock')
    # Pause while rain is actually present if the first observation was earlier
    # in the delivery. Otherwise the driving pause already covers frozen weather.
    if (await snap(page))['world']['weather'] == 'rain':
        await assert_paused(page, report, case, 'Natural rain')


async def hospital_case(browser, args, report, output):
    case = {'name': 'natural-weather' if args.weather_only else 'hospital-feedback'}
    context, page = await open_case(browser, 19, 'easy', case, report)
    observer = Observations(page, case, output)
    await observer.start()
    try:
        await click(page, 'start')
        await prepare(page)
        await fill(page)
        packed = await snap(page)
        assert packed['state']['mission']['steps'][0]['placeId'] == 'hospital'
        assert packed['state']['cargo'], 'The real shelf did not load cargo'
        if not args.weather_only:
            case['loadingCue'] = packed['world']
            assert packed['world']['cargoMeshCount'] > 0, 'The real loading action produced no temporary cargo cue'
            await page.wait_for_function('window.__townTest.snapshot().world.cargoMeshCount===0', timeout=30000)
            checked(report, 'Real shelf loading finishes and removes temporary cargo meshes')
        await click(page, 'depart')
        wide = (await snap(page))['world']['camera']['halfHeight']
        if not args.weather_only:
            await click(page, 'place-hospital')
            await page.wait_for_function('''h=>{const w=window.__townTest.snapshot().world;
                return w.moving&&!w.camera.overview&&w.camera.halfHeight<h*.70&&w.particleCount>0}''',
                arg=wide, timeout=90000)
            case['driving'] = await snap(page)
            await observer.screenshot('feedback-hospital-driving.png')
            await assert_paused(page, report, case, 'Driving feedback')
            await phase(page, 'delivery')
            arrived = await snap(page)
            assert arrived['state']['location'] == 'hospital'
            await observer.screenshot('feedback-hospital-arrived.png')
            checked(report, 'Real hospital route shows the close driving view and arrives at the hospital')
            step = arrived['state']['mission']['steps'][0]
            for _ in range(step['quantity']):
                await click(page, 'deliver-' + step['goodId'])
            await phase(page, 'reward')
            case['unloadingCue'] = (await snap(page))['world']
            assert case['unloadingCue']['cargoMeshCount'] > 0, 'The real delivery produced no temporary unloading cue'
            await observer.screenshot('feedback-hospital-reward.png')
            await page.wait_for_function('window.__townTest.snapshot().world.cargoMeshCount===0', timeout=30000)
            rewarded = await snap(page)
            assert rewarded['state']['rewardCount'] == 1
            assert not rewarded['state']['cargo']
            assert case['maxParticleCount'] > 0, 'No actual feedback particles were observed'
            case['reward'] = rewarded
            checked(report, 'Hospital delivery rewards once; unloading meshes clear and particles stay within 96')
        if not args.skip_weather:
            await weather_wait(page, observer, args, report, case)
        await reduced_motion(page, report, case)
        observer.check()
        assert not case['pageErrors'], case['pageErrors']
        assert not case['requestFailures'], case['requestFailures']
        assert len(case['requests']) == case['requestsAtReady'], 'Gameplay requested additional resources after ready'
        checked(report, 'Feedback case remains offline after the preload-ready barrier')
        case['passed'] = True
    finally:
        await observer.stop()
        with contextlib.suppress(Exception):
            case['final'] = await snap(page)
            case['requestsAfterReady'] = len(case['requests']) - case['requestsAtReady']
        await context.close()


async def event_case(browser, report, output):
    case = {'name': 'shortage-event-replay'}
    context, page = await open_case(browser, 1, 'normal', case, report)
    try:
        await click(page, 'start')
        await click(page, 'ack')
        before_selection = await snap(page)
        mission = before_selection['state']['mission']
        car = next(vehicle for vehicle in VEHICLES if vehicle['id'] in mission['vehicleChoices']
                   and all(tag in vehicle['supports'] for tag in mission['requiredTags']))
        await click(page, 'vehicle-' + car['id'])
        await phase(page, 'event')
        initial = await snap(page)
        assert initial['state']['event']['id'] == 'shortage' and not initial['state']['cargo']
        assert initial['state']['completed'] == [] and initial['state']['rewardCount'] == 0
        # The automatic event clip must finish first; otherwise playing>0 would
        # not prove that the new replay touch started a fresh sound.
        await page.wait_for_function('window.__townTest.snapshot().audio.playing===0', timeout=45000)
        before = await snap(page)
        await click(page, 'event-listen')
        await page.wait_for_function('window.__townTest.snapshot().audio.playing>0', timeout=10000)
        replay = await snap(page)
        assert progress(replay) == progress(before), 'Replaying instructions advanced event/cargo/progress'
        assert replay['audio']['state'] == 'running'
        await page.screenshot(path=str(output / 'feedback-shortage-replay.png'))
        await click(page, 'pause')
        await page.wait_for_function('window.__townTest.snapshot().state.paused&&window.__townTest.snapshot().audio.playing===0', timeout=5000)
        paused = await snap(page)
        await page.wait_for_timeout(900)
        after = await snap(page)
        assert progress(before) == progress(after)
        assert frozen_world(paused) == frozen_world(after)
        assert after['audio']['playing'] == 0
        case.update(before=before, replay=replay, paused=paused, afterPause=after,
                    screenshots=[str(output / 'feedback-shortage-replay.png')])
        checked(report, 'Real event-listen touch restarts decoded event audio after automatic playback ends')
        checked(report, 'Event replay preserves event/cargo/progress and pause stops its voice')
        await click(page, 'resume')
        assert progress(await snap(page)) == progress(before)
        assert not case['pageErrors'], case['pageErrors']
        assert not case['requestFailures'], case['requestFailures']
        assert len(case['requests']) == case['requestsAtReady']
        case['passed'] = True
    finally:
        with contextlib.suppress(Exception):
            case['final'] = await snap(page)
            case['frameDelta'] = case['final']['frames'] - case['initialFrame']
            case['requestsAfterReady'] = len(case['requests']) - case['requestsAtReady']
        await context.close()


async def run(args):
    output = args.output_dir
    output.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    report = {'status': 'running', 'checks': [], 'cases': [], 'errors': [], 'url': URL,
              'mode': 'weather-only' if args.weather_only else 'event-only' if args.event_only else 'full',
              'weatherSkipped': args.skip_weather, 'weatherTimeoutSeconds': args.weather_timeout,
              'viewport': {'width': 1180, 'height': 820}, 'hasTouch': True,
              'rendererRequest': 'Chromium --use-angle=swiftshader --enable-unsafe-swiftshader',
              'limitations': 'Cloud software Chromium; no physical iPad, speaker listening or target-device FPS claim. No production clock/state mutation.'}
    started = time.monotonic()
    failure = None
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium',
                args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            report['browser'] = browser.version
            try:
                if not args.event_only:
                    await hospital_case(browser, args, report, output)
                if not args.weather_only:
                    await event_case(browser, report, output)
                report['status'] = 'passed'
            finally:
                await browser.close()
    except Exception as error:
        failure = error
        report['status'] = 'blocked' if isinstance(error, PlaywrightTimeoutError) else 'failed'
        report['errors'].append({'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()})
    finally:
        report['wallSeconds'] = round(time.monotonic() - started, 3)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(f'{report["status"].upper()} feedback report: {args.report}', flush=True)
    if failure:
        raise failure


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--weather-only', action='store_true')
    mode.add_argument('--event-only', action='store_true')
    parser.add_argument('--skip-weather', action='store_true', help='Run delivery/replay without the long natural-weather wait')
    parser.add_argument('--weather-timeout', type=float, default=600, help='Wall-clock seconds allowed after delivery/idle setup')
    parser.add_argument('--output-dir', type=Path, default=OUT / 'feedback')
    parser.add_argument('--report', type=Path, default=OUT / 'feedback-verification.json')
    arguments = parser.parse_args()
    if arguments.weather_only and arguments.skip_weather:
        parser.error('--weather-only and --skip-weather cannot be combined')
    if arguments.weather_timeout <= 0:
        parser.error('--weather-timeout must be positive')
    asyncio.run(run(arguments))
