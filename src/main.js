import './style.css';
import { createGame, MISSIONS, LOCATIONS } from './game.js';
import { createTown } from './town.js';
import { icon, missionArt } from './icons.js';

const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = 'little-town-drivers:v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { /* Private browsing may reject storage. */ }
const game = createGame(saved);
let soundEnabled = saved.sound !== false;
let audioContext;
let soundLoading;
let activeSound;
const soundBuffers = {};
const soundFiles = { tap: 'click_001.wav', arrive: 'pluck_001.wav', win: 'confirmation_001.wav' };
const voiceBuffers = new Map();
const voiceManifestPromise = fetch(`${import.meta.env.BASE_URL}audio/voice/manifest.json`)
  .then(response => response.ok ? response.json() : {}).catch(() => ({}));
let activeVoice;
let voiceSequence = 0;
let lastVoiceFile = null;
let voiceStatus = 'idle';
let town;
let userPaused = false;
let modalKind = '';
let returnFocus;
const nativeDialog = typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal === 'function';
let destination = null;
let sceneReady = false;
let celebrationTimer;
let lastMarkerSize = '';
const dialog = $('#game-dialog');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const locationIcons = { garage: 'car', bakery: 'bread', garden: 'flowers', station: 'station', park: 'park', wash: 'wash' };

function decorateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
}
decorateIcons();
$('#brand-icon').innerHTML = icon('car');
$('#buddy').innerHTML = icon('sun');

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ stickers: game.getState().stickers, sound: soundEnabled })); } catch { /* The game also works without saved rewards. */ }
}
function sound(type = 'tap') {
  if (!soundEnabled) return;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audioContext ||= new Context();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    soundLoading ||= Promise.all(Object.entries(soundFiles).map(async ([key, file]) => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}audio/kenney-interface/${file}`);
        if (!response.ok) return;
        soundBuffers[key] = await audioContext.decodeAudioData(await response.arrayBuffer());
      } catch { /* Keep the short synthesized cue if an optional audio file fails. */ }
    }));
    if (soundBuffers[type]) {
      try { activeSound?.stop(); } catch { /* Previous source already ended. */ }
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      gain.gain.value = 0.65;
      source.buffer = soundBuffers[type];
      source.connect(gain); gain.connect(audioContext.destination);
      source.start(); activeSound = source;
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      return;
    }
    const notes = type === 'win' ? [523.25, 659.25, 783.99, 1046.5] : type === 'arrive' ? [659.25, 783.99] : [523.25];
    notes.forEach((frequency, i) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime + i * 0.12;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.06, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(start); oscillator.stop(start + 0.32);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  } catch { /* Sound enhances the game; it must never prevent play. */ }
}
function stopVoice() {
  voiceSequence++;
  try { activeVoice?.stop(); } catch { /* Source may already be stopped. */ }
  activeVoice = null;
  if (voiceStatus === 'playing' || voiceStatus === 'loading') voiceStatus = 'stopped';
  window.speechSynthesis?.cancel();
}
function fallbackSpeech(text) {
  if (!soundEnabled || !('speechSynthesis' in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN'; utterance.rate = 0.85; utterance.volume = 0.7;
    speechSynthesis.speak(utterance);
  } catch { /* Text and icons remain sufficient when speech is unavailable. */ }
}
async function speak(text) {
  if (!soundEnabled) return;
  stopVoice();
  const request = voiceSequence;
  voiceStatus = 'loading';
  try {
    // Resume before the first await so touch-triggered prompts unlock iPad audio.
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) { voiceStatus = 'unavailable'; fallbackSpeech(text); return; }
    audioContext ||= new Context();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const manifest = await voiceManifestPromise;
    const file = manifest[text];
    if (!file) throw new Error('Prompt not generated');
    if (!voiceBuffers.has(file)) {
      const pending = fetch(`${import.meta.env.BASE_URL}audio/voice/${file}`).then(async response => {
        if (!response.ok) throw new Error('Prompt unavailable');
        return audioContext.decodeAudioData(await response.arrayBuffer());
      });
      voiceBuffers.set(file, pending);
      pending.catch(() => voiceBuffers.delete(file));
    }
    const buffer = await voiceBuffers.get(file);
    if (request !== voiceSequence || !soundEnabled || userPaused || document.hidden) return;
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    gain.gain.value = 0.75;
    source.buffer = buffer;
    source.connect(gain); gain.connect(audioContext.destination);
    activeVoice = source; lastVoiceFile = file; voiceStatus = 'playing';
    source.onended = () => {
      source.disconnect(); gain.disconnect();
      if (activeVoice === source) { activeVoice = null; voiceStatus = 'ended'; }
    };
    source.start();
  } catch {
    if (request !== voiceSequence || !soundEnabled || userPaused || document.hidden) return;
    voiceStatus = 'fallback';
    fallbackSpeech(text);
  }
}
function syncSound() {
  const button = $('#sound-button');
  button.innerHTML = icon(soundEnabled ? 'sound' : 'muted');
  button.setAttribute('aria-label', soundEnabled ? '关闭声音' : '打开声音');
  button.setAttribute('aria-pressed', String(soundEnabled));
}
function isPaused() { return userPaused || dialog.hasAttribute('open') || document.hidden; }
function syncPause() {
  town?.setPaused(isPaused());
  $('#pause-overlay').hidden = !userPaused;
  $('#pause-button').setAttribute('aria-pressed', String(userPaused));
  $('#pause-button').setAttribute('aria-label', userPaused ? '继续游戏' : '暂停游戏');
  $('#pause-button').firstElementChild.innerHTML = icon(userPaused ? 'play' : 'pause');
  $('#pause-label').textContent = userPaused ? '继续玩' : '歇一会';
  updateControls();
}
function currentMission() { return MISSIONS.find((mission) => mission.id === game.getState().missionId); }
function updateControls() {
  const state = game.getState();
  const mission = currentMission();
  const step = mission.steps[state.stepIndex];
  const moving = town?.getState().moving || false;
  const drive = $('#drive-button');
  let label, message, heading;
  if (moving) {
    label = '小车出发啦…'; message = `嘟嘟！正在开往${LOCATIONS[destination || state.target].name}`; heading = '沿着小路，慢慢出发';
  } else if (state.phase === 'action') {
    label = step.action; message = step.arrival; heading = '到站啦！一起帮个小忙';
  } else if (state.phase === 'celebration') {
    label = '继续出发'; message = step.celebration; heading = '真棒！你做到了';
  } else if (state.phase === 'complete') {
    label = '下个小任务'; message = step.celebration; heading = '又给小镇带来了一点快乐';
  } else {
    label = `出发去${LOCATIONS[state.target].name}`; message = step.prompt; heading = '小司机，准备好了吗？';
  }
  if (userPaused) { message = '休息好了，随时可以继续哦。'; heading = '不着急，小镇会等你'; }
  $('#drive-label').textContent = label;
  $('#instruction').textContent = message;
  $('#message-label').textContent = heading;
  drive.disabled = !sceneReady || moving || isPaused();
  drive.classList.toggle('success', ['action', 'celebration', 'complete'].includes(state.phase));
  drive.firstElementChild.innerHTML = icon(state.phase === 'action' ? state.missionId : 'car');
  $('#choose-button').disabled = moving || !sceneReady;
  document.querySelectorAll('.location-marker').forEach((marker) => {
    marker.disabled = !sceneReady || moving || isPaused();
    marker.classList.toggle('target', marker.dataset.location === state.target && (state.phase === 'travel' || state.phase === 'action'));
  });
}
function render() {
  const state = game.getState();
  const mission = currentMission();
  $('#mission-title').textContent = mission.title;
  $('#mission-subtitle').textContent = mission.subtitle;
  $('#task-number').textContent = `0${MISSIONS.indexOf(mission) + 1} / 03`;
  $('#mission-art').innerHTML = missionArt(mission.id);
  $('#mission-steps').innerHTML = mission.steps.map((step, index) => {
    const done = index < state.stepIndex || (index === state.stepIndex && ['celebration', 'complete'].includes(state.phase));
    const active = index === state.stepIndex && !done;
    return `<li class="step ${done ? 'done' : active ? 'active' : ''}" ${active ? 'aria-current="step"' : ''}><span class="step-number">${done ? icon('check') : index + 1}</span><span>${step.action}<small>${LOCATIONS[step.location].name}</small></span></li>`;
  }).join('');
  $('#sticker-count').textContent = state.completedCount;
  town?.setTarget(['travel', 'action'].includes(state.phase) ? state.target : null);
  updateControls();
  persist();
  // Observable state for browser regression checks; no mutation or debug controls.
  document.body.dataset.phase = state.phase;
  document.body.dataset.mission = state.missionId;
  document.body.dataset.step = state.stepIndex;
  document.body.dataset.location = state.location;
}
function updateMarkerPositions() {
  if (!town) return;
  const size = `${$('#town').clientWidth}:${$('#town').clientHeight}`;
  if (size === lastMarkerSize) return;
  town.resize();
  lastMarkerSize = size;
  const points = town.projectLocations();
  for (const [id, point] of Object.entries(points)) {
    const marker = document.querySelector(`.location-marker[data-location="${id}"]`);
    if (!marker) continue;
    marker.style.left = `${point.x + (id === 'park' ? -28 : id === 'wash' ? 30 : 0)}px`;
    marker.style.top = `${point.y}px`;
  }
}
function travel(id) {
  if (!sceneReady || isPaused() || town.getState().moving) return;
  sound(); destination = id;
  if (town.travelTo(id)) {
    document.body.dataset.moving = String(town.getState().moving);
    updateControls();
    if (town.getState().moving) speak(`出发去${LOCATIONS[id].name}！`);
  }
}
function party() {
  town?.celebrate(); sound('win');
  if (reducedMotion) return;
  const layer = $('#confetti');
  clearTimeout(celebrationTimer);
  layer.replaceChildren();
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = ['#f2c96b', '#e78d74', '#8ebc9b', '#8dbfc6'][i % 4];
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    layer.append(piece);
  }
  celebrationTimer = setTimeout(() => layer.replaceChildren(), 2300);
}
function openDialog(kind, content) {
  modalKind = kind;
  $('#dialog-content').innerHTML = content;
  if (!dialog.hasAttribute('open')) {
    returnFocus = document.activeElement;
    if (nativeDialog) dialog.showModal();
    else {
      dialog.setAttribute('open', '');
      dialog.classList.add('compat-dialog');
      document.body.classList.add('dialog-fallback-open');
      $('#close-dialog').focus();
    }
  }
  syncPause();
  $('#stickers-tab').classList.toggle('selected', kind === 'stickers');
  $('#town-tab').classList.toggle('selected', kind !== 'stickers');
  $('#stickers-tab').setAttribute('aria-pressed', String(kind === 'stickers'));
  $('#town-tab').setAttribute('aria-pressed', String(kind !== 'stickers'));
}
function closeDialog() {
  if (!dialog.hasAttribute('open')) return;
  if (nativeDialog) dialog.close();
  else {
    dialog.removeAttribute('open');
    document.body.classList.remove('dialog-fallback-open');
    dialog.dispatchEvent(new Event('close'));
  }
}
dialog.addEventListener('keydown', (event) => {
  if (nativeDialog) return;
  if (event.key === 'Escape') { event.preventDefault(); closeDialog(); }
  if (event.key === 'Tab') {
    const items = [...dialog.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')];
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
dialog.addEventListener('close', () => {
  modalKind = '';
  $('#stickers-tab').classList.remove('selected');
  $('#town-tab').classList.add('selected');
  $('#stickers-tab').setAttribute('aria-pressed', 'false');
  $('#town-tab').setAttribute('aria-pressed', 'true');
  syncPause();
  returnFocus?.focus();
});
function showStickers() {
  const state = game.getState();
  openDialog('stickers', `<div class="dialog-kicker">LITTLE MOMENTS, BIG SMILES</div><h2 id="dialog-title" class="dialog-title">我的快乐贴纸</h2><p class="dialog-desc">每一次小小的帮助，都值得被记住。已收集 ${state.completedCount} / 3 枚</p><div class="sticker-grid">${MISSIONS.map((mission) => `<div class="sticker-item ${state.stickers.includes(mission.id) ? '' : 'locked'}">${icon(mission.id)}<strong>${mission.sticker}</strong><small>${state.stickers.includes(mission.id) ? '你做到了！' : `完成「${mission.title}」`}</small></div>`).join('')}</div><p class="collection-note">不着急，快乐没有时间限制。<br>贴纸会保存在这台设备的浏览器里。</p><button class="primary-button dialog-primary" data-dialog-action="close">回小镇玩${icon('arrow')}</button>`);
}
function showHelp() {
  openDialog('help', `<div class="dialog-kicker">LET’S PLAY TOGETHER</div><h2 id="dialog-title" class="dialog-title">小司机，这样玩</h2><p class="dialog-desc">不用握方向盘，轻轻点一下就好。</p><div class="help-grid"><div class="help-step">${icon('town')}<b>① 点地点</b><p>点亮亮的目的地<br>或底部出发按钮</p></div><div class="help-step">${icon('car')}<b>② 坐稳啦</b><p>小车自己开过去<br>慢慢欣赏小镇</p></div><div class="help-step">${icon('star')}<b>③ 帮个忙</b><p>到站点大按钮<br>收下快乐贴纸</p></div></div><button class="primary-button dialog-primary" data-dialog-action="close">我知道啦${icon('arrow')}</button>`);
  speak('点一点目的地，小车自己开。到站后，点大按钮帮个忙吧！');
}
function chooseMission() {
  if (town?.getState().moving) return;
  const state = game.getState();
  openDialog('choose', `<div class="dialog-kicker">A LITTLE HELP GOES A LONG WAY</div><h2 id="dialog-title" class="dialog-title">今天想帮谁呢？</h2><p class="dialog-desc">选一个喜欢的小任务，快乐出发吧。</p><div class="mission-choices">${MISSIONS.map((mission) => `<button class="mission-choice ${mission.id === state.missionId ? 'current' : ''}" data-mission="${mission.id}">${icon(mission.id)}<span><strong>${mission.title}</strong><small>${mission.subtitle}</small></span><span class="choice-end">${icon(state.stickers.includes(mission.id) ? 'check' : 'chevron')}</span></button>`).join('')}</div>`);
}
function showReward() {
  const mission = currentMission();
  const all = game.getState().completedCount === MISSIONS.length;
  openDialog('reward', `<div class="reward-view"><div class="reward-medal">${icon(mission.id)}</div><div class="dialog-kicker">A LITTLE KINDNESS, A BIG HAPPY TOWN</div><h2 id="dialog-title" class="dialog-title">${all ? '小镇因为你更美好！' : `你是${mission.sticker}！`}</h2><p>${mission.steps[1].celebration}<br>${all ? '三枚贴纸集齐啦，想再逛一逛吗？' : '一枚新的快乐，收进贴纸册。'}</p><button class="primary-button dialog-primary" data-dialog-action="next">${all ? '再玩一圈' : '下个小任务'}${icon('arrow')}</button><button class="nav-button dialog-primary" data-dialog-action="stickers">看看我的贴纸${icon('sticker')}</button></div>`);
}

$('#drive-button').addEventListener('click', () => {
  if (!sceneReady || isPaused() || town.getState().moving) return;
  const state = game.getState();
  if (state.phase === 'travel') travel(state.target);
  else if (state.phase === 'action') {
    const message = currentMission().steps[state.stepIndex].celebration;
    if (game.act()) town.performAction?.(state.missionId, state.stepIndex);
    party(); speak(message);
    if (game.getState().phase === 'complete') showReward();
  } else if (state.phase === 'celebration') { game.advance(); sound(); }
  else if (state.phase === 'complete') { if (game.nextMission()) stopVoice(); sound(); }
});
$('#location-markers').addEventListener('click', (event) => {
  const marker = event.target.closest('button.location-marker[data-location]');
  if (marker && !marker.disabled) travel(marker.dataset.location);
});
$('#sound-button').addEventListener('click', () => {
  soundEnabled = !soundEnabled; syncSound(); persist();
  if (!soundEnabled) { stopVoice(); audioContext?.suspend().catch(() => {}); }
  else sound();
});
$('#help-button').addEventListener('click', showHelp);
$('#stickers-tab').addEventListener('click', showStickers);
$('#town-tab').addEventListener('click', closeDialog);
$('.brand').addEventListener('click', (event) => { event.preventDefault(); if (dialog.hasAttribute('open')) closeDialog(); });
$('#choose-button').addEventListener('click', chooseMission);
$('#close-dialog').addEventListener('click', closeDialog);
$('#pause-button').addEventListener('click', () => { userPaused = !userPaused; syncPause(); if (userPaused) stopVoice(); });
$('#resume-button').addEventListener('click', () => { userPaused = false; syncPause(); sound(); });
$('#retry-button').addEventListener('click', () => location.reload());
$('#dialog-content').addEventListener('click', (event) => {
  const mission = event.target.closest('button[data-mission]');
  if (mission) {
    if (game.selectMission(mission.dataset.mission)) { town?.clearCargo(); stopVoice(); }
    closeDialog(); sound(); return;
  }
  const action = event.target.closest('[data-dialog-action]')?.dataset.dialogAction;
  if (action === 'close') closeDialog();
  if (action === 'next') { if (game.nextMission()) stopVoice(); closeDialog(); sound(); }
  if (action === 'stickers') showStickers();
});
document.addEventListener('visibilitychange', () => {
  syncPause();
  if (document.hidden) { stopVoice(); audioContext?.suspend().catch(() => {}); }
});

$('#location-markers').innerHTML = Object.values(LOCATIONS).map((place) => `<button class="location-marker" data-location="${place.id}" aria-label="开往${place.name}" disabled>${icon(locationIcons[place.id])}<span>${place.name}</span></button>`).join('');
syncSound();
try {
  town = createTown($('#town'), {
    onLocationTap: travel,
    onArrival: (id) => {
      destination = null;
      document.body.dataset.moving = 'false';
      game.arrive(id);
      sound('arrive');
      if (game.getState().phase === 'action') speak(currentMission().steps[game.getState().stepIndex].arrival);
    },
    onFrame: updateMarkerPositions,
  });
  sceneReady = true;
  updateMarkerPositions();
  document.body.dataset.scene = 'ready';
  $('#town').querySelector('canvas').addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    sceneReady = false;
    town.setPaused(true);
    $('#scene-fallback').hidden = false;
    $('#location-markers').hidden = true;
    updateControls();
  });
} catch (error) {
  console.error('Town renderer could not start:', error);
  $('#scene-fallback').hidden = false;
  $('#location-markers').hidden = true;
  document.body.dataset.scene = 'unavailable';
}
game.subscribe(render);
syncPause();
window.addEventListener('pagehide', () => { town?.setPaused(true); stopVoice(); });
window.addEventListener('pageshow', syncPause);

// Read-only observability, enabled only for automated verification URLs.
if (new URLSearchParams(location.search).has('test')) {
  Object.defineProperty(window, '__townTest', { value: Object.freeze({ snapshot: () => ({ game: game.getState(), town: town?.getState(), sceneReady, userPaused, modalKind, loadedSounds: Object.keys(soundBuffers), voiceStatus, lastVoiceFile, loadedVoiceCount: voiceBuffers.size }) }) });
}
