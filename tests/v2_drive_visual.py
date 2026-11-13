#!/usr/bin/env python3
"""Capture the longest firetruck on real rounded-road turns through Canvas input.

Screenshots are evidence for independent visual review; geometry and appearance
are not automatically approved by this script. TOWN_URL follows v2_browser.py.
"""
import asyncio
import json
import math
import subprocess
import time
import traceback
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from playwright.async_api import async_playwright
from v2_browser import ROOT, URL, snap, state, click, fill, phase, is_game_request

OUT = ROOT / 'artifacts' / 'goal' / 'drive-visual'


def choose_plan():
    # Selection only: gameplay still uses the resulting real easy task and all
    # actual Canvas controls. Prefer two turns to allow screenshot capture time.
    source = r"""
import {createGame,findRoute} from './src/v2/rules.js';
import {VEHICLES} from './src/v2/catalog.js';
const vehicle=VEHICLES.find(v=>v.id==='tanker');let fallback;
for(let seed=0;seed<1000;seed++){
 const s=createGame({seed,difficulty:'easy'}).getState();
 if(!s.mission.vehicleChoices.includes(vehicle.id)||!s.mission.requiredTags.every(t=>vehicle.supports.includes(t)))continue;
 const step=s.mission.steps[0],route=findRoute(s.map,'depot',step.placeId),turns=[];
 for(let i=1;i<route.length-1;i++){
  const a=route[i-1],b=route[i],c=route[i+1],dx=b.x-a.x,dz=b.z-a.z,ex=c.x-b.x,ez=c.z-b.z;
  if(Math.abs(dx*ez-dz*ex)>1e-8&&Math.abs(dx*ex+dz*ez)<1e-8)turns.push(i);
 }
 if(!turns.length)continue;
 const plan={seed,vehicle:vehicle.id,supports:vehicle.supports,requiredTags:s.mission.requiredTags,step,route,turns,theme:s.map.theme,template:s.map.layout.templateId};
 fallback??=plan;if(turns.length>=2){fallback=plan;break;}
}
if(!fallback)throw Error('No suitable easy tanker mission with a real 90-degree route turn');
console.log(JSON.stringify(fallback));
"""
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', source], cwd=ROOT, text=True))


def test_url(seed):
    parts = urlsplit(URL)
    query = dict(parse_qsl(parts.query))
    query.update(test='1', seed=str(seed), difficulty='easy')
    return urlunsplit(parts._replace(query=urlencode(query)))


def angle_delta(a, b):
    return abs(math.atan2(math.sin(b - a), math.cos(b - a)))


async def settled_overview(page, timeout=60):
    deadline, previous, steady = time.monotonic() + timeout, None, 0
    while time.monotonic() < deadline:
        shot = await snap(page)
        camera, border = shot['world']['camera'], shot['state']['map']['layout']['bounds']
        good = (camera['overview'] and not shot['world']['moving'] and not shot['state']['paused']
                and abs(camera['target']['x'] - (border['minX'] + border['maxX']) / 2) < .05
                and abs(camera['target']['z'] - (border['minZ'] + border['maxZ']) / 2) < .05)
        if good and previous and shot['frames'] != previous['frames']:
            steady = steady + 1 if abs(camera['halfHeight'] - previous['halfHeight']) < .02 else 0
            if steady >= 3:
                return shot
        elif not good:
            steady = 0
        if not previous or shot['frames'] != previous['frames']:
            previous = {'frames': shot['frames'], 'halfHeight': camera['halfHeight']}
        await page.wait_for_timeout(150)
    raise AssertionError('Overview did not settle across distinct rendered frames')


async def capture(page, name, before=None):
    before = before or await snap(page)
    await page.screenshot(path=str(OUT / f'{name}.png'))
    after = await snap(page)
    (OUT / f'{name}.json').write_text(json.dumps({'before': before, 'after': after}, ensure_ascii=False, indent=2))
    return {'image': f'{name}.png', 'snapshots': f'{name}.json', 'before': before, 'after': after}


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    plan = choose_plan()
    report = {'status': 'running', 'plan': plan, 'errors': [], 'captures': [], 'turnCaptures': [],
              'visualReview': 'pending independent review; screenshot capture is not automatic visual approval',
              'limitations': 'Cloud Chromium SwiftShader; no physical iPad frame-rate claim.', 'video': None}
    requests, baseline = [], None
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
            args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport={'width': 1180, 'height': 820}, device_scale_factor=1, has_touch=True)
        page = await context.new_page()
        page.on('pageerror', lambda error: report['errors'].append(str(error)))
        page.on('request', lambda request: requests.append(request.url) if is_game_request(request) else None)
        try:
            await page.goto(test_url(plan['seed']), wait_until='domcontentloaded')
            await page.wait_for_function('window.__townTest?.snapshot().ready', timeout=120000)
            ready = await snap(page)
            assert ready['resources']['ready'] and ready['audio']['count'] == len(ready['manifest']['audio'])
            baseline = len(requests)
            report['preloaded'] = {'resources': ready['resources'], 'audioCount': ready['audio']['count'],
                                   'manifestVersion': ready['manifest']['version']}
            await context.set_offline(True)
            await click(page, 'start')
            await click(page, 'ack')
            s = await state(page)
            assert s['difficulty'] == 'easy' and s['seed'] == plan['seed']
            assert 'tanker' in s['mission']['vehicleChoices'] and s['mission']['requiredTags'] == plan['requiredTags']
            assert s['mission']['steps'][0] == plan['step']
            await click(page, 'vehicle-tanker')
            await phase(page, 'loading')
            assert (await state(page))['vehicleId'] == 'tanker'
            await fill(page)
            await page.wait_for_function('window.__townTest.snapshot().world.cargoMeshCount === 0', timeout=30000)
            loaded = await snap(page)
            assert loaded['state']['cargo'] and loaded['world']['cargoAnimation'] is None
            report['loadedCargo'] = loaded['state']['cargo']
            await click(page, 'depart')
            await phase(page, 'explore')
            overview = await settled_overview(page)
            wide = overview['world']['camera']['halfHeight']
            overview_capture = await capture(page, '01-overview', overview)
            report['captures'].append({k: v for k, v in overview_capture.items() if k not in ('before', 'after')})
            # Test-owned recording storage only. Every sample reads the public
            # snapshot; no rules dispatch, camera change or simulation stepping.
            await page.evaluate("""() => {
              const log={active:true,overflow:false,lastFrame:-1,samples:[]};window.__driveVisualLog=log;
              function record(){
                if(!log.active)return;
                const s=window.__townTest.snapshot(),w=s.world;
                if(s.frames!==log.lastFrame){
                  log.lastFrame=s.frames;
                  log.samples.push({frame:s.frames,time:performance.now(),phase:s.state.phase,location:s.state.location,
                    currentDestination:s.state.currentDestination,position:w.position,heading:w.heading,speed:w.speed,
                    curvature:w.curvature,moving:w.moving,camera:w.camera,cargoMeshCount:w.cargoMeshCount,cargoAnimation:w.cargoAnimation});
                  if(log.samples.length>=20000){log.overflow=true;log.active=false;return;}
                }
                requestAnimationFrame(record);
              }
              requestAnimationFrame(record);
            }""")
            target = plan['step']['placeId']
            await click(page, 'place-' + target)
            await phase(page, 'moving')
            assert (await state(page))['currentDestination'] == target
            deadline, straight, previous_curvature, entry_heading = time.monotonic() + 240, False, 0, None
            arc_number, rejected, last_captured_arc = 0, 0, None
            while time.monotonic() < deadline:
                shot = await snap(page)
                world = shot['world']
                if not world['moving']:
                    break
                assert shot['state']['currentDestination'] == target
                assert world['cargoMeshCount'] == 0 and world['cargoAnimation'] is None, 'cargo must not remain on the vehicle roof while driving'
                close = not world['camera']['overview'] and world['camera']['halfHeight'] < wide * .7
                curved = abs(world['curvature']) > .01 and world['speed'] > 0
                if curved and abs(previous_curvature) <= .01:
                    arc_number += 1
                    entry_heading = world['heading']
                if close and world['speed'] > .1 and not curved and not straight:
                    item = await capture(page, '02-straight', shot)
                    assert item['after']['world']['moving'], 'straight screenshot must be taken during the trip'
                    report['captures'].append({k: v for k, v in item.items() if k not in ('before', 'after')})
                    straight = True
                count = len(report['turnCaptures'])
                progress = angle_delta(entry_heading, world['heading']) if curved and entry_heading is not None else 0
                # Capture early in three different bends. A screenshot costs
                # several rendered frames; demanding a late third shot in a
                # single bend can finish after the car has exited that bend.
                if close and curved and count < 3 and progress >= .10 and last_captured_arc != arc_number:
                    item = await capture(page, f'03-turn-attempt-{count + rejected + 1:02d}', shot)
                    after = item['after']['world']
                    if after['moving'] and abs(after['curvature']) > .01 and not after['camera']['overview'] and after['camera']['halfHeight'] < wide * .7:
                        last_captured_arc = arc_number
                        report['turnCaptures'].append({'arcNumber': arc_number, 'observedArcProgressRadians': progress,
                            'beforeFrame': shot['frames'], 'afterFrame': item['after']['frames'],
                            'curvatureBefore': world['curvature'], 'curvatureAfter': after['curvature'],
                            'image': item['image'], 'snapshots': item['snapshots']})
                    else:
                        rejected += 1
                previous_curvature = world['curvature']
                await page.wait_for_timeout(40)
            else:
                raise AssertionError('Real driving did not arrive within 240s')
            await phase(page, 'delivery')
            arrived = await snap(page)
            assert arrived['state']['location'] == target and not arrived['world']['moving'] and arrived['world']['speed'] == 0
            assert arrived['world']['camera']['overview']
            destination = next(place for place in arrived['state']['map']['places'] if place['id'] == target)
            position = arrived['world']['position']
            # Rules keep logical graph nodes; the actual car stops 3m before
            # the junction on its incoming straight, clear of end/corner curbs.
            last, previous = plan['route'][-1], plan['route'][-2]
            length = math.hypot(last['x'] - previous['x'], last['z'] - previous['z'])
            stop = {axis: last[axis] + (previous[axis] - last[axis]) * 3 / length for axis in ('x', 'z')}
            assert math.hypot(position['x'] - stop['x'], position['z'] - stop['z']) < 1e-4
            assert abs(math.hypot(position['x'] - destination['x'], position['z'] - destination['z']) - 3) < 1e-4
            report['arrivalStop'] = {'logicalNode': last, 'physicalPosition': position, 'setbackMetres': 3}
            settled = await settled_overview(page)
            item = await capture(page, '04-arrival', settled)
            report['captures'].append({k: v for k, v in item.items() if k not in ('before', 'after')})
            log = await page.evaluate('() => {const l=window.__driveVisualLog;l.active=false;return {overflow:l.overflow,samples:l.samples}}')
            assert not log['overflow']
            moving = [sample for sample in log['samples'] if sample['moving']]
            assert moving and any(abs(sample['curvature']) > .01 for sample in moving)
            changes = [angle_delta(a['heading'], b['heading']) for a, b in zip(moving, moving[1:])]
            assert max(changes, default=0) < math.pi / 2, 'heading must not snap 90 degrees between rendered frames'
            assert all(sample['cargoMeshCount'] == 0 and sample['cargoAnimation'] is None for sample in moving)
            assert any(not sample['camera']['overview'] and sample['camera']['halfHeight'] < wide * .7 for sample in moving)
            assert straight and len(report['turnCaptures']) == 3, 'require straight plus three confirmed moving/curved close-up screenshots'
            (OUT / 'frame-samples.json').write_text(json.dumps(log['samples'], ensure_ascii=False, indent=2))
            report['motion'] = {'sampleCount': len(log['samples']), 'movingFrameCount': len(moving),
                'maxHeadingStepRadians': max(changes, default=0), 'arcCountObserved': arc_number,
                'rejectedLateTurnCaptures': rejected, 'arrivedStopped': True, 'returnedToOverview': True,
                'cargoAbsentFromDrivingRoof': True}
            for _ in range(plan['step']['quantity']):
                await click(page, 'deliver-' + plan['step']['goodId'])
            await phase(page, 'reward')
            await page.wait_for_function('window.__townTest.snapshot().world.cargoMeshCount === 0', timeout=30000)
            assert not (await state(page))['cargo']
            assert len(requests) == baseline, requests[baseline:]
            assert not report['errors'], report['errors']
            report['status'] = 'passed'
            report['browser'] = browser.version
            print(f'PASS real offline tanker trip seed={plan["seed"]} target={target}; continuous heading, stopped overview, no roof cargo; three arc images await visual review', flush=True)
        except BaseException as error:
            report['status'] = 'failed'
            report['failure'] = {'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()}
            raise
        finally:
            if baseline is not None:
                report['requestsAfterReady'] = requests[baseline:]
            try:
                if await page.evaluate('!!window.__driveVisualLog'):
                    samples = await page.evaluate('() => {window.__driveVisualLog.active=false;return window.__driveVisualLog.samples}')
                    (OUT / 'frame-samples.json').write_text(json.dumps(samples, ensure_ascii=False, indent=2))
                report['lastSnapshot'] = await snap(page)
                await page.screenshot(path=str(OUT / 'latest.png'))
            except Exception as artifact_error:
                report['artifactError'] = str(artifact_error)
            (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
