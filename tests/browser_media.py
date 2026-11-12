"""Focused regression for real assets, task cargo and pre-generated Mandarin."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('GAME_TEST_URL','http://127.0.0.1:5173')
results=[]
errors=[]

def passed(message):
    results.append(message)
    print('PASS:',message,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True)
    context=browser.new_context(viewport={'width':1024,'height':768},device_scale_factor=1,has_touch=True)
    page=context.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL+'/?test=1')
    page.wait_for_function('window.__townTest?.snapshot().town.model === "kenney-taxi"')
    page.locator('#help-button').tap()
    page.wait_for_function('window.__townTest.snapshot().lastVoiceFile === "help.mp3" && window.__townTest.snapshot().voiceStatus === "playing"',timeout=20000)
    passed('pre-generated Chinese help MP3 decodes and starts in response to a real touch')
    page.locator('#close-dialog').tap()
    page.locator('#sound-button').tap()
    assert page.evaluate('window.__townTest.snapshot().voiceStatus') in ['stopped','ended']
    passed('mute stops the spoken prompt')
    page.locator('#sound-button').tap()
    page.locator('#drive-button').tap()
    page.wait_for_function('window.__townTest.snapshot().lastVoiceFile === "go-bakery.mp3"',timeout=20000)
    page.wait_for_function('document.body.dataset.phase === "action"',timeout=90000)
    page.wait_for_function('window.__townTest.snapshot().lastVoiceFile === "arrive-bread-0.mp3"',timeout=20000)
    passed('departure and arrival play the correct local Mandarin files')
    page.locator('#drive-button').tap()
    assert page.evaluate('window.__townTest.snapshot().town.cargo') == 'bread'
    assert page.evaluate('window.__townTest.snapshot().town.actionFeedback') == 'bread:0'
    page.wait_for_function('window.__townTest.snapshot().lastVoiceFile === "reward-bread-0.mp3"',timeout=20000)
    page.locator('#choose-button').tap()
    page.locator('button[data-mission="flowers"]').tap()
    snapshot=page.evaluate('window.__townTest.snapshot()')
    assert snapshot['town']['cargo'] is None
    assert snapshot['game']['missionId'] == 'flowers'
    assert snapshot['voiceStatus'] in ['stopped', 'ended']
    passed('actual pickup displays cargo; task switch clears cargo and cancels the old spoken prompt')
    page.locator('#drive-button').tap()
    page.wait_for_function('window.__townTest.snapshot().lastVoiceFile === "go-garden.mp3"',timeout=20000)
    page.locator('#pause-button').tap()
    assert page.evaluate('window.__townTest.snapshot().voiceStatus') in ['stopped','ended']
    passed('pause stops a playing local spoken prompt')
    # Fetch and decode every generated prompt via the browser, without invoking TTS.
    durations=page.evaluate('''async () => {
      const manifest=await (await fetch('./audio/voice/manifest.json')).json();
      const ac=new AudioContext(); const clips=[];
      for(const file of Object.values(manifest)) {
        const response=await fetch('./audio/voice/'+file);
        if(!response.ok)throw new Error('Missing '+file);
        const buffer=await ac.decodeAudioData(await response.arrayBuffer());
        clips.push({file,duration:buffer.duration});
      }
      await ac.close();return clips;
    }''')
    assert len(durations)==19 and all(clip['duration']>0 for clip in durations)
    passed('all 19 static Mandarin MP3 files fetch and decode in Chromium')
    assert page.request.get(URL+'/licenses/three-LICENSE.txt').ok
    passed('Three.js MIT license is included in the distributable build')
    context.close()

    failed=browser.new_context(viewport={'width':1024,'height':768},has_touch=True)
    failed.route('**/models/kenney-car/taxi.glb',lambda route:route.abort())
    fallback=failed.new_page()
    fallback.on('pageerror',lambda e:errors.append(str(e)))
    fallback.goto(URL+'/?test=1')
    fallback.wait_for_function('window.__townTest?.snapshot().town.model === "procedural-fallback"')
    assert fallback.locator('#drive-button').is_enabled()
    fallback.locator('#sound-button').tap()
    fallback.locator('#drive-button').tap()
    fallback.wait_for_function('document.body.dataset.phase === "action"',timeout=90000)
    assert fallback.evaluate('window.__townTest.snapshot().town.location') == 'bakery'
    passed('model request failure preserves a playable procedural car and arrival')
    failed.close()
    assert not errors,errors
    passed('no uncaught JavaScript errors during media and cargo regression')
    Path('artifacts').mkdir(exist_ok=True)
    Path('artifacts/media-results.json').write_text(json.dumps({'browser':browser.version,'checks':results,'clips':durations,'errors':errors,'note':'Decoded and scheduled playback in cloud; physical speaker/iPad listening not verified.'},ensure_ascii=False,indent=2))
    browser.close()
