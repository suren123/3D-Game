"""Production-build interaction checks. Requires Python Playwright and Chromium.
Run a local server for dist first, then: python tests/browser_smoke.py
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('GAME_TEST_URL', 'http://127.0.0.1:5173')
OUT = Path('artifacts')
OUT.mkdir(exist_ok=True)
results = []
errors = []

def passed(name):
    results.append(name)
    print('PASS:', name, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True)
    context = browser.new_context(viewport={'width': 1180, 'height': 820}, device_scale_factor=1, has_touch=True)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL + '/?test=1')
    page.wait_for_selector('body[data-scene="ready"]')
    page.wait_for_function('window.__townTest && document.querySelector("[data-location=bakery]").style.left')
    page.locator('#sound-button').tap()
    page.screenshot(path=str(OUT / 'town-ipad-landscape.png'))
    assert page.locator('#drive-button').is_enabled()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.wait_for_function("window.__townTest.snapshot().town.model === 'kenney-taxi'", timeout=30000)
    passed('initial scene renders with Kenney taxi; iPad landscape layout fits')

    # Drive from a real touch target, pause midway, and prove 3D position freezes.
    page.locator('[data-location="bakery"]').tap()
    page.wait_for_function('window.__townTest.snapshot().town.moving')
    page.wait_for_timeout(300)
    page.locator('#pause-button').tap()
    before = page.evaluate('window.__townTest.snapshot().town.position')
    page.wait_for_timeout(700)
    after = page.evaluate('window.__townTest.snapshot().town.position')
    assert before == after, (before, after)
    assert page.locator('#drive-button').is_disabled()
    page.locator('#resume-button').tap()
    page.wait_for_function('document.body.dataset.phase === "action"', timeout=90000)
    at = page.evaluate('window.__townTest.snapshot()')
    assert at['town']['location'] == 'bakery'
    assert at['town']['position'] == {'x': 0, 'z': -5}
    passed('real touch drives the car; pause freezes 3D position; resume arrives correctly')

    # Opening UI pauses the scene; closing it restores the active task.
    page.locator('#help-button').tap()
    assert page.locator('#game-dialog').is_visible()
    assert page.evaluate('window.__townTest.snapshot().town.paused')
    page.locator('[data-dialog-action="close"]').tap()
    assert not page.evaluate('window.__townTest.snapshot().town.paused')
    assert page.get_attribute('body', 'data-phase') == 'action'
    assert page.get_attribute('body', 'data-mission') == 'bread'
    passed('help opens and pauses the scene, then closes and restores it')

    for mission_id in ['bread', 'flowers', 'wash']:
        for step in range(2):
            state = page.evaluate('window.__townTest.snapshot()')
            assert state['game']['missionId'] == mission_id
            assert state['game']['stepIndex'] == step
            if state['game']['phase'] == 'travel':
                page.locator('#drive-button').tap()
                assert page.locator('#drive-button').is_disabled()
                page.wait_for_function('document.body.dataset.phase === "action"', timeout=90000)
            page.locator('#drive-button').tap()
            if step == 0:
                assert page.get_attribute('body', 'data-phase') == 'celebration'
                assert page.get_attribute('body', 'data-step') == '0'
                page.locator('#drive-button').tap()
                assert page.get_attribute('body', 'data-step') == '1'
            else:
                assert page.get_attribute('body', 'data-phase') == 'complete'
                assert page.locator('#game-dialog').is_visible()
                if mission_id == 'wash':
                    page.screenshot(path=str(OUT / 'all-stickers-earned.png'))
                page.locator('[data-dialog-action="next"]').tap()
        passed(f'{mission_id}: both real travel/action steps complete and award a sticker')

    assert page.locator('#sticker-count').inner_text() == '3'
    page.locator('#stickers-tab').tap()
    assert page.locator('.sticker-item:not(.locked)').count() == 3
    page.screenshot(path=str(OUT / 'sticker-book.png'))
    page.locator('#close-dialog').tap()
    page.reload()
    page.wait_for_selector('body[data-scene="ready"]')
    assert page.locator('#sticker-count').inner_text() == '3'
    assert page.locator('#sound-button').get_attribute('aria-pressed') == 'false'
    passed('all three stickers and sound preference persist after reload')

    page.locator('#choose-button').tap()
    page.locator('[data-mission="flowers"]').tap()
    assert page.get_attribute('body', 'data-mission') == 'flowers'
    assert page.get_attribute('body', 'data-step') == '0'
    assert page.locator('#sticker-count').inner_text() == '3'
    passed('task selection preserves rewards and resets task progress')
    page.locator('#sound-button').tap()
    page.wait_for_function('window.__townTest.snapshot().loadedSounds.length === 3', timeout=30000)
    page.locator('#sound-button').tap()
    passed('three local Kenney WAV cues load and decode after a user gesture')

    for width, height in [(1024, 768), (1366, 1024), (390, 844)]:
        old_position = page.locator('.location-marker[data-location=\"bakery\"]').get_attribute('style')
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_timeout(300)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, height)
        assert page.locator('.location-marker[data-location=\"bakery\"]').get_attribute('style') != old_position
        assert page.evaluate('!document.body.style.left && !document.body.style.top')
        page.screenshot(path=str(OUT / f'layout-{width}x{height}.png'), full_page=True)
        if width >= 1024:
            controls = page.locator('#drive-button, #sound-button, #help-button, #choose-button, .location-marker').evaluate_all('(els)=>els.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))')
            assert all(c['width'] >= 56 and c['height'] >= 56 for c in controls), controls
        passed(f'{width}x{height} resize: no horizontal overflow, target sizing checked where applicable')

    # Storage denial must not turn a playable prototype into a blank page.
    isolated = browser.new_context(viewport={'width':1024, 'height':768}, has_touch=True)
    isolated.add_init_script("Object.defineProperty(window, 'localStorage', {get(){throw new DOMException('blocked','SecurityError')}})")
    blocked = isolated.new_page()
    blocked.on('pageerror', lambda error: errors.append(str(error)))
    blocked.goto(URL + '/?test=1')
    blocked.wait_for_selector('body[data-scene="ready"]')
    assert blocked.locator('#drive-button').is_enabled()
    passed('storage denied: scene and controls remain available')
    isolated.close()

    # Verify a precise fallback instead of a blank canvas when WebGL is missing.
    unavailable = browser.new_context(viewport={'width':1024,'height':768})
    unavailable.add_init_script("const nativeGetContext=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2'||type==='webgl'||type==='experimental-webgl')return null;return nativeGetContext.call(this,type,...args)}")
    fallback = unavailable.new_page()
    fallback.goto(URL)
    fallback.wait_for_selector('#scene-fallback:not([hidden])')
    assert fallback.locator('#drive-button').is_disabled()
    passed('WebGL unavailable: informative fallback and disabled drive control')
    unavailable.close()
    # Old Safari dialog API fallback, simulated without changing game state.
    compat = browser.new_context(viewport={'width':1024,'height':768},has_touch=True)
    compat.add_init_script('HTMLDialogElement.prototype.showModal=undefined')
    older = compat.new_page()
    older.on('pageerror', lambda error: errors.append(str(error)))
    older.goto(URL + '/?test=1')
    older.wait_for_selector('body[data-scene="ready"]')
    older.locator('#help-button').tap()
    assert older.locator('#game-dialog').is_visible()
    assert older.evaluate('window.__townTest.snapshot().town.paused')
    older.locator('#close-dialog').tap()
    assert not older.locator('#game-dialog').is_visible()
    assert older.locator('#drive-button').is_enabled()
    compat.close()
    passed('dialog API fallback opens, pauses and closes without losing the task')
    assert not errors, errors
    passed('no uncaught JavaScript errors in normal interaction or storage-denied mode')
    report = {'browser': browser.version, 'checks': results, 'errors': errors, 'note': 'Chromium touch emulation in cloud, not physical iPad Safari.'}
    (OUT / 'browser-results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    context.close()
    browser.close()
