#!/usr/bin/env python3
"""Real Canvas shelf/slot transfers, bounded input and reduced-motion feedback.

Run serially with GPU tests; snapshots are read-only, all actions use real GUI.
"""
import asyncio
import json
import traceback
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from playwright.async_api import async_playwright
from v2_browser import ROOT, URL, VEHICLES, snap, click, center, prepare

OUT = ROOT / 'artifacts' / 'goal' / 'cargo-slots'


def count(shot):
    return sum(item['quantity'] for item in shot['state']['cargo'])


def slots(shot):
    return sorted(key for key in shot['bounds'] if key.startswith('cargo-slot-'))


async def raw_tap(page, key):
    x, y = await center(page, key)
    await page.touchscreen.tap(x, y)
    return x, y


async def settled(page, expected_count=None):
    # Accepted cargo and an inactive decoration can precede GUI layout after a
    # rebuild. Wait for actual shelf/slot hit rectangles, not a fixed delay.
    await page.wait_for_function('''expected=>{
      const s=window.__townTest.snapshot(), keys=Object.keys(s.bounds);
      const count=expected??s.state.cargo.reduce((n,item)=>n+item.quantity,0);
      return s.state.phase==='loading'&&!s.state.paused&&!s.cargoTransfer.active
        &&keys.some(key=>key.startsWith('load-'))
        &&keys.filter(key=>key.startsWith('cargo-slot-')).length===count;
    }''', arg=expected_count, timeout=30000)
    return await snap(page)


async def animated(page, key, kind, expected_count, report, name):
    # Deliberately bypass click(): its cargo compatibility helper waits until
    # animation finishes. This test observes and captures an actual flight.
    x,y=await raw_tap(page, key)
    if name == '01-load':
        await page.touchscreen.tap(x,y)  # An immediate second touch must not add a second item.
    await page.wait_for_function('''kind=>{
      const f=window.__townTest.snapshot().cargoTransfer;
      return f.active&&f.stage==='flying'&&f.kind===kind&&f.progress>0&&f.progress<1;
    }''', arg=kind, timeout=15000)
    during = await snap(page)
    assert count(during) == expected_count, during['state']['cargo']
    flight = during['cargoTransfer']
    assert flight['from']['size'] > 0 and flight['to']['size'] > 0, flight
    assert abs(flight['from']['y'] - flight['to']['y']) > 20, flight
    assert not any(key.startswith(('load-', 'cargo-slot-')) for key in during['bounds']), 'Only loading controls must lock during a flight'
    await page.screenshot(path=str(OUT / f'{name}-flying.png'))
    after = await settled(page, expected_count)
    assert count(after) == expected_count and len(slots(after)) == expected_count, after['state']['cargo']
    report['transfers'].append({'name': name, 'flight': flight, 'cargo': after['state']['cargo'], 'slots': slots(after)})
    return after


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    parts = urlsplit(URL)
    query = dict(parse_qsl(parts.query)); query.update(test='1', seed='11', difficulty='easy')
    url = urlunsplit(parts._replace(query=urlencode(query)))
    report = {'status': 'running', 'url': url, 'transfers': [], 'errors': [],
              'limitations': 'Cloud Chromium Canvas input and screenshots; no physical iPad or visual approval claim.'}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
            args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport={'width': 1180, 'height': 820}, has_touch=True)
        page = await context.new_page()
        page.on('pageerror', lambda error: report['errors'].append(str(error)))
        try:
            await page.goto(url)
            await page.wait_for_function('window.__townTest?.snapshot().ready', timeout=120000)
            await context.set_offline(True)
            await click(page, 'start'); vehicle_id = await prepare(page)
            initial = await settled(page, 0)
            assert initial['state']['phase'] == 'loading' and count(initial) == 0
            assert not slots(initial) and not initial['cargoTransfer']['active']
            good_id = initial['state']['mission']['shelf'][0]
            car = next(vehicle for vehicle in VEHICLES if vehicle['id'] == vehicle_id)
            capacity = max(1, car['capacity'] + initial['state']['capacityBonus'])
            assert capacity >= 2
            await animated(page, 'load-' + good_id, 'load', 1, report, '01-load')
            two = await animated(page, 'load-' + good_id, 'load', 2, report, '02-load-again')
            assert len(slots(two)) == 2 and all(key.startswith('cargo-slot-' + good_id + '-') for key in slots(two))
            one = await animated(page, slots(two)[1], 'unload', 1, report, '03-slot-unload')
            assert one['state']['cargo'] == [{'goodId': good_id, 'quantity': 1}]
            await animated(page, 'load-' + good_id, 'load', 2, report, '04-reload')
            for n in range(3, capacity + 1):
                await animated(page, 'load-' + good_id, 'load', n, report, f'05-fill-{n}')
            full = await snap(page)
            await raw_tap(page, 'load-' + good_id)
            immediate_rejection = await snap(page)
            assert immediate_rejection['state']['cargo'] == full['state']['cargo'] and not immediate_rejection['cargoTransfer']['active']
            rejected = await settled(page, capacity)
            assert rejected['state']['cargo'] == full['state']['cargo'] and not rejected['cargoTransfer']['active']
            assert len(slots(rejected)) == capacity
            assert '坐满' in rejected['state']['message'], rejected['state']['message']
            report['fullCapacityRejectedWithoutFlight'] = True
            # Start an unload and pause while it is still flying. Clearing the
            # decoration must preserve the already accepted rules cargo.
            await raw_tap(page, slots(rejected)[0])
            await page.wait_for_function("window.__townTest.snapshot().cargoTransfer.stage==='flying'", timeout=15000)
            await raw_tap(page, 'pause')
            paused = await snap(page)
            assert paused['state']['paused'] and not paused['cargoTransfer']['active']
            assert count(paused) == capacity - 1
            await page.wait_for_timeout(400)
            assert (await snap(page))['state']['cargo'] == paused['state']['cargo']
            await click(page, 'resume')
            resumed = await settled(page, capacity - 1)
            assert len(slots(resumed)) == capacity - 1
            report['pauseClearsFlightAndPreservesCargo'] = True
            other_good = initial['state']['mission']['shelf'][1]
            occupied_before = slots(resumed)
            mixed = await animated(page, 'load-' + other_good, 'load', capacity, report, '06-empty-slot-mixed-load')
            assert all(key in slots(mixed) for key in occupied_before), 'Existing cargo must keep its slots'
            new_slot = next(key for key in slots(mixed) if key.startswith('cargo-slot-' + other_good + '-'))
            assert new_slot.endswith('-0'), 'Load must use the vacated first slot'
            await animated(page, new_slot, 'unload', capacity - 1, report, '07-mixed-slot-return')
            await click(page, 'settings')
            if not (await snap(page))['settings']['reducedMotion']:
                await click(page, 'reduced-motion')
            await click(page, 'back-to-town')
            await raw_tap(page, 'load-' + good_id)
            await page.wait_for_function('(n)=>Object.keys(window.__townTest.snapshot().bounds).filter(k=>k.startsWith("cargo-slot-")).length===n',arg=capacity,timeout=15000)
            reduced = await snap(page)
            assert reduced['settings']['reducedMotion'] and not reduced['cargoTransfer']['active']
            assert count(reduced) == capacity and len(slots(reduced)) == capacity
            await raw_tap(page, slots(reduced)[0])
            await page.wait_for_function('(n)=>Object.keys(window.__townTest.snapshot().bounds).filter(k=>k.startsWith("cargo-slot-")).length===n',arg=capacity-1,timeout=15000)
            reduced_unload = await snap(page)
            assert count(reduced_unload) == capacity - 1 and not reduced_unload['cargoTransfer']['active']
            assert len(slots(reduced_unload)) == capacity - 1
            report['reducedMotionImmediateBothDirections'] = True
            await page.screenshot(path=str(OUT / '08-primary-final.png'))
            report.update(vehicle=vehicle_id, capacity=capacity, primaryFinal=await snap(page))
            # A fresh real seed2 setup covers the largest six-slot vehicle.
            # Do not repeat the already covered rejection/pause/error cases.
            await context.set_offline(False)
            six_query=dict(query);six_query['seed']='2'
            six_url=urlunsplit(parts._replace(query=urlencode(six_query)))
            await page.goto(six_url)
            await page.wait_for_function('window.__townTest?.snapshot().ready', timeout=120000)
            await context.set_offline(True)
            await click(page, 'start');await click(page, 'ack')
            selection=await snap(page)
            assert 'truck' in selection['state']['mission']['vehicleChoices'], selection['state']['mission']
            await click(page, 'vehicle-truck')
            six_initial=await settled(page, 0)
            assert six_initial['state']['vehicleId']=='truck'
            truck=next(vehicle for vehicle in VEHICLES if vehicle['id']=='truck')
            assert truck['capacity']+six_initial['state']['capacityBonus']==6
            six_good=six_initial['state']['mission']['shelf'][0]
            for n in range(1,7):
                await click(page, 'load-'+six_good)
                loaded=await settled(page,n)
                assert count(loaded)==n,loaded['state']['cargo']
            six_full=await settled(page,6)
            canvas=await page.locator('canvas:visible').bounding_box();assert canvas
            relative=six_full['layout']['panelRect']
            panel={**relative,'x':relative['x']+canvas['x'],'y':relative['y']+canvas['y']}
            six_bounds={key:six_full['bounds'][key] for key in slots(six_full)}
            assert len(six_bounds)==6
            for key,box in six_bounds.items():
                assert box['width']>0 and box['height']>0,(key,box)
                assert (box['x']>=panel['x']-1e-4 and box['y']>=panel['y']-1e-4
                    and box['x']+box['width']<=panel['x']+panel['width']+1e-4
                    and box['y']+box['height']<=panel['y']+panel['height']+1e-4),(key,box,panel)
            ordered=sorted(six_bounds.values(),key=lambda box:box['x'])
            assert all(abs(box['y']-ordered[0]['y'])<1e-4 for box in ordered)
            assert all(a['x']+a['width']<=b['x']+1e-4 for a,b in zip(ordered,ordered[1:]))
            await page.screenshot(path=str(OUT / '09-truck-six-slots-full.png'))
            report['maximumCapacity']={'seed':2,'vehicle':'truck','capacity':6,'cargo':six_full['state']['cargo'],
                'slotBounds':six_bounds,'panelViewport':panel,'screenshot':'09-truck-six-slots-full.png',
                'snapshot':six_full}
            assert not report['errors'], report['errors']
            report.update(status='passed',final=six_full)
            print('PASS Canvas cargo slots: two-way transfers, single-item unload, full-capacity rejection, pause, reduced motion and six visible truck slots', flush=True)
        except BaseException as error:
            report['status'] = 'failed'
            report['failure'] = {'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()}
            raise
        finally:
            try:
                report['latest'] = await snap(page)
                await page.screenshot(path=str(OUT / 'latest.png'))
            finally:
                (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
                await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
