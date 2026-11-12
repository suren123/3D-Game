import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture.js';
import { Button } from '@babylonjs/gui/2D/controls/button.js';
import { Container } from '@babylonjs/gui/2D/controls/container.js';
import { Control } from '@babylonjs/gui/2D/controls/control.js';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle.js';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock.js';
import { GOODS, VEHICLES, PLACES, THEMES, DIFFICULTIES } from './catalog.js';

const W = 1180, H = 820;
const C = { ink: '#264f49', muted: '#687d70', cream: '#fffaf0', mint: '#e2eee3', teal: '#328775', orange: '#ec9b59', yellow: '#f5ce77', line: '#dce7da', white: '#ffffff' };
const goods = Object.fromEntries(GOODS.map(item => [item.id, item]));
const cars = Object.fromEntries(VEHICLES.map(item => [item.id, item]));
const places = Object.fromEntries(PLACES.map(item => [item.id, item]));
const known = { ...goods, ...cars, ...places };

function round(ctx, x, y, w, h, r, fill) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function line(ctx, points, color, width = 5) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}

/** All pictograms are drawn into Babylon's GUI texture; no images, fonts or requests. */
class ToyIcon extends Control {
  constructor(kind, tint) { super(`art-${kind}`); this.kind = kind; this.tint = tint || known[kind]?.color || C.teal; this.isHitTestVisible = false; }
  _draw(ctx) {
    const m = this._currentMeasure;
    ctx.save(); ctx.translate(m.left, m.top); ctx.scale(m.width / 100, m.height / 100);
    const t = this.tint, k = this.kind;
    if (cars[k] || k === 'car') {
      round(ctx, 10, 40, 80, 35, 10, t); round(ctx, 26, 20, 51, 37, 12, t);
      round(ctx, 34, 27, k === 'bus' ? 14 : 32, 19, 4, '#d8f1eb');
      if (k === 'bus') round(ctx, 55, 27, 14, 19, 4, '#d8f1eb');
      if (k === 'tanker') round(ctx, 12, 24, 46, 33, 16, '#f0f4e7');
      if (k === 'fridge') { line(ctx, [[35, 48], [35, 64]], '#fff', 3); line(ctx, [[27, 56], [43, 56]], '#fff', 3); }
      if (k === 'repair') line(ctx, [[30, 58], [44, 44]], '#fff', 5);
      circle(ctx, 27, 76, 12, C.ink); circle(ctx, 73, 76, 12, C.ink); circle(ctx, 27, 76, 5, '#f8eed3'); circle(ctx, 73, 76, 5, '#f8eed3');
      round(ctx, 81, 49, 10, 9, 3, '#fff7bd');
    } else if (k === 'bread') {
      round(ctx, 13, 26, 74, 56, 20, '#b77739'); round(ctx, 17, 19, 66, 54, 20, t);
      [31, 48, 65].forEach(x => line(ctx, [[x + 4, 31], [x - 2, 47]], '#fff2ca', 5));
    } else if (k === 'apple') {
      circle(ctx, 39, 56, 27, t); circle(ctx, 62, 56, 27, t); line(ctx, [[50, 32], [54, 16]], '#806044', 6);
      ctx.save(); ctx.translate(65, 21); ctx.rotate(-.5); round(ctx, -14, -7, 28, 14, 7, '#76a779'); ctx.restore();
      line(ctx, [[29, 45], [27, 54]], '#ffd0b9', 5);
    } else if (k === 'milk') {
      round(ctx, 28, 24, 44, 62, 5, '#f9f9e9'); round(ctx, 28, 51, 44, 27, 2, t);
      line(ctx, [[28, 24], [38, 12], [62, 12], [72, 24]], '#74a9bd', 7); circle(ctx, 50, 64, 8, '#fff');
    } else if (k === 'flowers' || k === 'seeds') {
      line(ctx, [[50, 81], [50, 34]], '#5d9976', 6); line(ctx, [[50, 64], [31, 53]], '#5d9976', 6);
      if (k === 'flowers') { for (let i = 0; i < 5; i++) circle(ctx, 50 + Math.cos(i * 1.256) * 17, 34 + Math.sin(i * 1.256) * 17, 13, t); circle(ctx, 50, 34, 12, '#f5ca63'); }
      else { round(ctx, 22, 22, 30, 17, 9, '#89bd7e'); round(ctx, 49, 38, 31, 16, 9, '#65a779'); round(ctx, 27, 74, 48, 10, 5, '#c59c75'); }
    } else if (k === 'water') {
      ctx.beginPath(); ctx.moveTo(50, 10); ctx.bezierCurveTo(20, 46, 12, 59, 26, 77); ctx.bezierCurveTo(45, 98, 85, 84, 81, 60); ctx.bezierCurveTo(79, 44, 60, 24, 50, 10); ctx.fillStyle = t; ctx.fill();
      line(ctx, [[35, 57], [33, 65], [40, 73]], '#d4f1f6', 5);
    } else if (k === 'tools' || k === 'repair-tool') {
      line(ctx, [[27, 79], [69, 37]], t, 16); circle(ctx, 69, 29, 20, t); circle(ctx, 77, 20, 15, C.cream); circle(ctx, 27, 79, 5, C.cream);
    } else if (k === 'parcel') {
      round(ctx, 17, 23, 66, 61, 7, t); round(ctx, 44, 23, 13, 61, 1, '#f2d6a5'); line(ctx, [[20, 44], [80, 44]], '#a77d52', 3); round(ctx, 23, 53, 16, 12, 2, '#fff5da');
    } else if (k === 'book') {
      round(ctx, 23, 15, 58, 73, 6, '#5f85bd'); round(ctx, 18, 10, 58, 72, 6, t); line(ctx, [[28, 14], [28, 77]], '#e5edff', 4); line(ctx, [[40, 33], [63, 33]], '#fff', 5); line(ctx, [[40, 44], [59, 44]], '#fff', 4);
    } else if (k === 'icecream') {
      ctx.beginPath(); ctx.moveTo(29, 49); ctx.lineTo(70, 49); ctx.lineTo(50, 91); ctx.closePath(); ctx.fillStyle = '#dca96c'; ctx.fill(); circle(ctx, 50, 39, 25, t); circle(ctx, 50, 19, 13, '#fff2dd');
    } else if (k === 'ball') {
      circle(ctx, 50, 50, 37, '#f7f1e7'); circle(ctx, 50, 50, 13, t); line(ctx, [[17, 39], [37, 44]], t, 8); line(ctx, [[63, 44], [82, 35]], t, 8); line(ctx, [[49, 64], [48, 84]], t, 8);
    } else if (k === 'passenger') {
      round(ctx, 23, 58, 54, 31, 15, '#89c6ba'); circle(ctx, 50, 36, 26, '#f0c9a2'); ctx.beginPath(); ctx.arc(50, 31, 26, Math.PI, 2 * Math.PI); ctx.fillStyle = '#855f42'; ctx.fill(); circle(ctx, 41, 37, 3, C.ink); circle(ctx, 59, 37, 3, C.ink); line(ctx, [[45, 50], [54, 50]], '#bc765b', 3);
    } else if (k === 'park' || k === 'farm') {
      round(ctx, 45, 42, 11, 44, 3, '#a7835d'); circle(ctx, 36, 38, 23, t); circle(ctx, 63, 38, 23, t); circle(ctx, 50, 23, 22, t); round(ctx, 17, 83, 66, 8, 4, '#98b988');
      if (k === 'farm') { circle(ctx, 32, 38, 6, '#f7dc80'); circle(ctx, 65, 23, 6, '#f7dc80'); }
    } else if (places[k] || k === 'town') {
      round(ctx, 20, 36, 60, 50, 6, t); ctx.beginPath(); ctx.moveTo(12, 38); ctx.lineTo(50, 11); ctx.lineTo(88, 38); ctx.closePath(); ctx.fillStyle = '#dd8b6b'; ctx.fill(); round(ctx, 43, 59, 16, 27, 3, '#59867f'); round(ctx, 27, 47, 12, 14, 2, '#e5f1df'); round(ctx, 63, 47, 12, 14, 2, '#e5f1df');
      if (k === 'hospital') { round(ctx, 44, 30, 12, 27, 1, '#fff'); round(ctx, 36, 38, 28, 11, 1, '#fff'); }
      if (k === 'depot') { round(ctx, 35, 55, 32, 31, 4, '#c49357'); round(ctx, 48, 55, 7, 31, 1, '#f8dfad'); }
      if (k === 'cafe') { circle(ctx, 67, 58, 8, '#fff7e5'); circle(ctx, 68, 58, 4, t); round(ctx, 37, 48, 25, 23, 4, '#fff7e5'); line(ctx, [[39, 75], [66, 75]], '#fff7e5', 4); }
      if (k === 'school') {
        ['#e57963', '#f5cc6e', '#91bfa0'].forEach((color, i) => { ctx.beginPath(); ctx.arc(50, 58, 21 - i * 6, Math.PI, 2 * Math.PI); ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.stroke(); });
      }
      if (k === 'garage') { round(ctx, 31, 59, 40, 20, 5, '#f6d37c'); round(ctx, 41, 52, 20, 13, 4, '#f6d37c'); circle(ctx, 39, 79, 6, C.ink); circle(ctx, 65, 79, 6, C.ink); }
    } else if (k === 'star') {
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 20 : 42; const x = 50 + Math.cos(a) * r, y = 50 + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fillStyle = t; ctx.fill();
    } else if (k === 'sound' || k === 'listen') {
      round(ctx, 18, 40, 20, 26, 4, t); ctx.beginPath(); ctx.moveTo(34, 40); ctx.lineTo(54, 23); ctx.lineTo(54, 81); ctx.lineTo(34, 66); ctx.closePath(); ctx.fillStyle = t; ctx.fill();
      for (const r of [18, 30]) { ctx.beginPath(); ctx.arc(53, 52, r, -.85, .85); ctx.strokeStyle = t; ctx.lineWidth = 5; ctx.stroke(); }
    } else if (k === 'pause') { round(ctx, 28, 22, 15, 58, 4, t); round(ctx, 57, 22, 15, 58, 4, t); }
    else if (k === 'settings') { circle(ctx, 50, 50, 32, t); circle(ctx, 50, 50, 15, C.cream); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; circle(ctx, 50 + Math.cos(a) * 34, 50 + Math.sin(a) * 34, 7, t); } }
    else if (k === 'hint') { circle(ctx, 50, 39, 27, '#f1cd71'); round(ctx, 37, 62, 26, 14, 5, t); line(ctx, [[40, 83], [60, 83]], t, 6); }
    else if (k === 'close') { line(ctx, [[29, 29], [71, 71]], t, 7); line(ctx, [[71, 29], [29, 71]], t, 7); }
    else if (k === 'check') line(ctx, [[20, 51], [41, 73], [81, 28]], t, 9);
    else if (k === 'arrow') { line(ctx, [[17, 50], [82, 50]], t, 7); line(ctx, [[60, 27], [83, 50], [60, 73]], t, 7); }
    else { circle(ctx, 50, 50, 30, t); }
    ctx.restore();
  }
}

class ClickSparkles extends Control {
  constructor() { super('tap-sparkles'); this.isHitTestVisible = false; this.bursts = []; }
  add(x, y) { if (this.bursts.length >= 8) this.bursts.shift(); this.bursts.push({ x, y, life: 0 }); this._markAsDirty(); }
  tick(dt) { if (!this.bursts.length) return; this.bursts.forEach(b => b.life += dt); this.bursts = this.bursts.filter(b => b.life < .45); this._markAsDirty(); }
  _draw(ctx) {
    for (const b of this.bursts) {
      const t = b.life / .45; ctx.save(); ctx.globalAlpha *= 1 - t;
      for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; circle(ctx, b.x + Math.cos(a) * (15 + t * 34), b.y + Math.sin(a) * (15 + t * 34), 4 * (1 - t) + 1, i % 2 ? C.yellow : '#8fcfb5'); }
      ctx.restore();
    }
  }
}

function position(control, x, y, width, height) {
  control.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  control.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  control.left = `${x}px`; control.top = `${y}px`; control.width = `${width}px`; control.height = `${height}px`;
  return control;
}

export function createUI(scene, callbacks = {}) {
  const { onCommand = () => {}, onSpeak = () => {}, onSound = () => {}, onOverview = () => {}, onReducedMotion = () => {}, onNewSession = () => {} } = callbacks;
  const texture = AdvancedDynamicTexture.CreateFullscreenUI('town-ui', true, scene);
  // Fit the entire logical frame. Babylon's useSmallestIdeal chooses the shorter
  // physical axis, which can crop this landscape frame on a different aspect.
  texture.useSmallestIdeal = false;
  const engine = scene.getEngine();
  const fitTexture = () => {
    const wide = engine.getRenderWidth() / engine.getRenderHeight() > W / H;
    texture.idealWidth = wide ? 0 : W; texture.idealHeight = wide ? H : 0;
  };
  fitTexture();
  const resizeObserver = engine.onResizeObservable.add(fitTexture);
  texture.rootContainer.isPointerBlocker = false;
  let screen, frame, markersLayer, lastState = null, panel = null, priorPaused = false;
  let mode = 'loading', loadingState = { progress: 0, text: '小镇正在准备，请稍等一会儿。' };
  let sound = true, reducedMotion = false, historicalCount = 0, chosenDifficulty = 'easy', lastSignature = '';
  let projected = [], disposed = false, markers = new Map();
  const buttons = new Map(), armed = new Set();
  const canvas = scene.getEngine().getRenderingCanvas();
  const sparkles = new ClickSparkles();
  sparkles.width = '100%'; sparkles.height = '100%'; sparkles.zIndex = 100;
  texture.addControl(sparkles);
  const cancelPress = () => {
    // Clear our acceptance gate before GUI releases: its forced release may
    // notify click observers, but a canceled gesture must never run an action.
    armed.clear();
    for (const b of buttons.values()) b.background = b._townBaseFill;
    for (const [pointerId, control] of Object.entries(texture._lastControlDown)) {
      control._forcePointerUp(Number(pointerId));
      delete texture._lastControlDown[pointerId];
    }
    texture._capturedPointerIds.clear();
  };
  const secondPointer = e => { if (e.isPrimary === false) cancelPress(); };
  canvas?.addEventListener('pointercancel', cancelPress, true);
  canvas?.addEventListener('pointerdown', secondPointer, true);
  canvas?.addEventListener('lostpointercapture', cancelPress, true);
  const tick = scene.onBeforeRenderObservable.add(() => {
    if (!lastState?.paused && !reducedMotion) sparkles.tick(Math.min(scene.getEngine().getDeltaTime() / 1000, .05));
  });

  function box(parent, name, x, y, w, h, background = C.cream, radius = 26) {
    const r = position(new Rectangle(name), x, y, w, h);
    r.background = background; r.thickness = 0; r.cornerRadius = radius; r.isHitTestVisible = false;
    parent.addControl(r); return r;
  }
  function text(parent, words, x, y, w, h, size = 26, color = C.ink, align = 'left', bold = false) {
    const t = position(new TextBlock(`text-${String(words).slice(0, 16)}`, words), x, y, w, h);
    t.color = color; t.fontSize = size; t.fontFamily = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
    t.fontWeight = bold ? '700' : '500'; t.textWrapping = true; t.lineSpacing = '5px';
    t.textHorizontalAlignment = align === 'center' ? Control.HORIZONTAL_ALIGNMENT_CENTER : Control.HORIZONTAL_ALIGNMENT_LEFT;
    t.isHitTestVisible = false; parent.addControl(t); return t;
  }
  function icon(parent, kind, x, y, size, tint) { const a = position(new ToyIcon(kind, tint), x, y, size, size); parent.addControl(a); return a; }
  function button(parent, id, label, x, y, w, h, action, options = {}) {
    const b = position(new Button(id), x, y, w, h);
    b.cornerRadius = options.radius ?? 22; b.thickness = options.outline ? 2 : 0;
    b.color = options.outline || C.line; b.background = options.fill || C.mint;
    b._townBaseFill = b.background;
    b.isPointerBlocker = true; b.isEnabled = options.enabled !== false;
    b.disabledColor = '#e4e5dd'; b.alpha = b.isEnabled ? 1 : .65;
    b.pointerEnterAnimation = b.pointerOutAnimation = b.pointerDownAnimation = b.pointerUpAnimation = () => {};
    if (options.icon) { const sz = options.iconOnly ? 44 : 38; icon(b, options.icon, options.iconOnly ? (w - sz) / 2 : 17, (h - sz) / 2, sz, options.ink); }
    if (label) text(b, label, options.icon ? 61 : 10, 0, w - (options.icon ? 72 : 20), h, options.size || 26, options.ink || C.ink, options.icon ? 'left' : 'center', true);
    b.onPointerDownObservable.add((_, event) => {
      if (event.userInfo?.event?.isPrimary === false) return;
      armed.add(b); b.background = options.pressedFill || '#c8dfcf';
    });
    b.onPointerOutObservable.add(() => { armed.delete(b); b.background = options.fill || C.mint; });
    b.onPointerUpObservable.add(() => { armed.delete(b); b.background = options.fill || C.mint; });
    b.onPointerClickObservable.add(() => {
      if (!armed.has(b) || disposed || !b.isEnabled) return;
      armed.delete(b);
      if (!reducedMotion && !lastState?.paused) { const m = b._currentMeasure; sparkles.add(m.left + m.width / 2, m.top + m.height / 2); }
      action();
    });
    parent.addControl(b); buttons.set(id, b); return b;
  }
  function send(type, payload = {}) { onCommand({ type, ...payload }); }
  function openPanel(nextPanel) {
    priorPaused = !!lastState?.paused; panel = nextPanel;
    if (!priorPaused) send('PAUSE', { value: true });
    rebuild();
  }
  function closePanel() {
    panel = null;
    if (!priorPaused) send('PAUSE', { value: false });
    rebuild();
  }
  function setup() {
    if (screen) screen.dispose();
    buttons.clear(); armed.clear(); markers = new Map();
    screen = new Container('ui-screen'); screen.width = '100%'; screen.height = '100%'; screen.zIndex = 1;
    screen.isHitTestVisible = false; texture.addControl(screen);
    frame = new Container('ui-frame'); frame.width = `${W}px`; frame.height = `${H}px`;
    // Containers still traverse their children, but their empty area must not
    // consume input before the lower map-marker layer gets to test its buttons.
    frame.isHitTestVisible = false; screen.addControl(frame);
  }
  function shade() {
    const s = new Rectangle('modal-shade'); s.width = '100%'; s.height = '100%'; s.background = '#254e43'; s.alpha = .35; s.thickness = 0; s.isPointerBlocker = true;
    screen.addControl(s); screen.removeControl(frame); screen.addControl(frame);
  }
  function modal(title, subtitle, { height = 652, width = 1000, close = false, utilities = true, badge = '今天也要快乐出发' } = {}) {
    shade();
    const x = (W - width) / 2, y = (H - height) / 2;
    const card = box(frame, 'modal-card', x, y, width, height);
    card.isHitTestVisible = true; card.isPointerBlocker = true; card.shadowColor = '#20392b26'; card.shadowBlur = 24; card.shadowOffsetY = 8;
    box(card, 'tiny-tag', 34, 28, Math.min(width - 100, 288), 38, '#e8edda', 14);
    text(card, badge, 48, 27, 280, 40, 20, C.teal, 'left', true);
    text(card, title, 36, 80, width - 106, 58, 38, C.ink, 'left', true);
    if (subtitle) text(card, subtitle, 38, 139, width - 76, 57, 25, C.muted);
    if (close) button(card, 'close', '', width - 94, 22, 72, 72, closePanel, { icon: 'close', iconOnly: true });
    else if (utilities) {
      button(card, 'settings', '', width - 94, 22, 72, 72, () => openPanel('settings'), { icon: 'settings', iconOnly: true });
      button(card, 'pause', '', width - 182, 22, 72, 72, () => send('PAUSE', { value: true }), { icon: 'pause', iconOnly: true });
    }
    return card;
  }
  function header() {
    const h = box(frame, 'header', 20, 16, W - 40, 88, '#fffaf0f2', 26);
    h.isHitTestVisible = true; h.isPointerBlocker = true;
    icon(h, 'car', 13, 9, 68, C.orange);
    text(h, '小车忙忙镇', 90, 6, 260, 47, 30, C.ink, 'left', true);
    const theme = THEMES.find(t => t.id === lastState?.map?.theme)?.name || '今天的小镇';
    text(h, `${theme}  ·  第 ${(lastState?.round || 0) + 1} / 3 单`, 91, 48, 360, 30, 21, C.muted);
    button(h, 'overview', '看全镇', 520, 8, 172, 72, () => onOverview(), { icon: 'town', fill: '#f0e9d8' });
    button(h, 'sound', sound ? '声音开' : '声音关', 706, 8, 172, 72, () => { sound = !sound; onSound(sound); rebuild(); }, { icon: 'sound', fill: '#e6ede1' });
    button(h, 'settings', '', 892, 8, 100, 72, () => openPanel('settings'), { icon: 'settings', iconOnly: true, fill: '#e6ede1' });
    button(h, 'pause', '', 1006, 8, 100, 72, () => send('PAUSE', { value: true }), { icon: 'pause', iconOnly: true, fill: '#f4e2c7' });
  }
  function missionRows(parent, y = 208) {
    const mission = lastState?.mission;
    (mission?.steps || []).forEach((step, i) => {
      const row = box(parent, `instruction-${i}`, 36, y + i * 100, 928, 88, i % 2 ? '#e8efdf' : '#f1eadb', 18);
      text(row, mission.ordered ? `${i + 1}` : '·', 8, 15, 42, 56, 28, C.teal, 'center', true);
      icon(row, step.goodId, 50, 8, 70);
      text(row, `${goods[step.goodId]?.name || step.goodId} × ${step.quantity}`, 135, 13, 260, 62, 29, C.ink, 'left', true);
      icon(row, 'arrow', 400, 24, 40, '#849b7b');
      icon(row, step.placeId, 468, 8, 70);
      text(row, places[step.placeId]?.name || step.placeId, 552, 13, 350, 62, 29, C.ink, 'left', true);
    });
  }
  function brief(isHint = false) {
    const mission = lastState.mission;
    const card = modal(isHint ? '再看看小任务' : mission?.title || '今天的小任务', mission?.ordered ? '先看清顺序。记不住也没关系，随时可以再看。' : '看看要带什么、送到哪里。准备好了再出发！', { close: isHint, badge: '小脑袋准备好了吗？' });
    missionRows(card);
    button(card, 'listen', '再听一次', 36, 538, 278, 82, () => onSpeak(), { icon: 'listen' });
    button(card, isHint ? 'close-hint' : 'ack', isHint ? '我想起来了' : '记住了，选小车', 510, 538, 454, 82, () => isHint ? closePanel() : send('ACK_BRIEF'), { icon: 'check', fill: C.teal, ink: C.white });
  }
  function vehiclePicker() {
    const options = (lastState.mission?.vehicleChoices || VEHICLES.map(v => v.id)).map(id => cars[id]).filter(Boolean);
    const card = modal('选一辆今天的伙伴', lastState.message || '小车各有本领。选好了，再去仓库装东西。', { badge: '第一站 · 小车车库' });
    const columns = options.length <= 2 ? 2 : 3, gap = 18, cw = (928 - (columns - 1) * gap) / columns;
    options.forEach((car, i) => {
      const x = 36 + (i % columns) * (cw + gap), y = 214 + Math.floor(i / columns) * 168;
      const b = button(card, `vehicle-${car.id}`, '', x, y, cw, 148, () => send('SELECT_VEHICLE', { vehicleId: car.id }), { fill: '#f0eddf' });
      icon(b, car.id, 18, 18, 91);
      text(b, car.name, 122, 18, cw - 132, 48, 28, C.ink, 'left', true);
      const special = { fridge: '冷藏物品', tanker: '运送清水', repair: '携带工具', bus: '搭载朋友' }[car.id] || '日常货物';
      text(b, `${special}\n能装 ${car.capacity} 份`, 122, 67, cw - 132, 72, 23, C.muted);
    });
    button(card, 'hint', '再看任务', 36, 548, 280, 72, () => openPanel('hint'), { icon: 'hint' });
    button(card, 'listen', '再听一次', 684, 548, 280, 72, () => onSpeak(), { icon: 'listen' });
  }
  function shelf() {
    const state = lastState, car = cars[state.vehicleId], count = state.cargo.reduce((a, b) => a + b.quantity, 0);
    const capacity = state.capacity ?? state.vehicleCapacity ?? Math.max(1, (car?.capacity || 0) + (state.capacityBonus || 0));
    const storedCount = (state.storedCargo || []).reduce((sum, item) => sum + item.quantity, 0);
    const subtitle = `${state.message || '点一次装一份；选错了，点下面的物品就能取下来。'}${storedCount ? ` 仓库暂存 ${storedCount} 份，点货架取回。` : ''}`;
    const card = modal('把记住的东西装上车', subtitle, { badge: `${places[state.location]?.name || '小镇仓库'} · 慢慢选，不着急` });
    const choices = (state.shelf || state.mission?.shelf || []).slice(0, 6);
    const columns = Math.min(3, choices.length), gap = 14, cw = (928 - gap * (columns - 1)) / columns;
    choices.forEach((id, i) => {
      const b = button(card, `load-${id}`, '', 36 + (i % columns) * (cw + gap), 208 + Math.floor(i / columns) * 104, cw, 92, () => send('LOAD', { goodId: id }), { fill: '#f0ecde' });
      icon(b, id, 12, 12, 66); text(b, goods[id]?.name || id, 89, 13, cw - 96, 66, 28, C.ink, 'left', true);
    });
    text(card, `车上装了 ${count} / ${capacity} 份  ·  点物品取下`, 40, 418, 720, 36, 24, C.teal, 'left', true);
    state.cargo.forEach((item, i) => {
      const b = button(card, `unload-${item.goodId}`, '', 36 + i * 154, 460, 143, 72, () => send('UNLOAD', { goodId: item.goodId }), { fill: '#dfebdd' });
      icon(b, item.goodId, 8, 11, 50); text(b, `×${item.quantity} −`, 65, 10, 73, 52, 25, C.ink, 'left', true);
    });
    if (!state.cargo.length) text(card, '空空的车厢，等你来装满', 39, 470, 600, 51, 25, C.muted);
    button(card, 'hint', '再看任务', 36, 551, 240, 72, () => openPanel('hint'), { icon: 'hint' });
    button(card, 'listen', '再听一次', 294, 551, 240, 72, () => onSpeak(), { icon: 'listen' });
    button(card, 'depart', '装好了，出发！', 574, 551, 390, 72, () => send('DEPART'), { fill: C.teal, ink: C.white, icon: 'car' });
  }
  function makeMarkers() {
    markersLayer = new Container('map-places'); markersLayer.width = '100%'; markersLayer.height = '100%'; markersLayer.isHitTestVisible = false; screen.addControl(markersLayer);
    const enable = ['explore', 'delivery'].includes(lastState?.phase) && !lastState.paused && !panel;
    markersLayer.isVisible = enable;
    for (const place of PLACES) {
      const b = button(markersLayer, `place-${place.id}`, '', 0, 0, 156, 84, () => send('TRAVEL', { placeId: place.id }), { fill: 'transparent', pressedFill: '#dce9d888', radius: 22 });
      // Keep a large touch target while the visible sign stays above the roof.
      const chip=box(b, `sign-${place.id}`, 0, 17, 156, 52, '#fffaf0ed', 18);
      icon(chip, place.id, 8, 7, 38); text(chip, place.name.replace('小镇', '').replace('阳光', '').replace('彩虹', '').replace('爱心', '').replace('开心', '').replace('熊熊', '').replace('汽车', ''), 50, 0, 98, 52, 24, C.ink, 'center', true);
      b.isVisible = false; markers.set(place.id, b);
    }
    // The fixed HUD belongs above map markers, but markers do not block open sky.
    screen.removeControl(frame); screen.addControl(frame); applyPlaces();
  }
  function applyPlaces() {
    const size = texture.getSize(), rect = canvas?.getBoundingClientRect();
    if (!rect?.width || !rect.height || !markersLayer?.isVisible) return;
    const ratio = texture.idealRatio || 1;
    const placed=[];
    for (const p of [...projected].sort((a,b)=>a.y-b.y)) {
      const b = markers.get(p.id); if (!b) continue;
      const x = p.x * size.width / rect.width / ratio, y = p.y * size.height / rect.height / ratio;
      const visible = p.visible !== false && y > 105 && y < H - 130;
      let markerTop=Math.max(101,Math.min(H-242,y-96));
      if(visible){
        // Avoid stacked sign faces near the top HUD; keep their large targets.
        for(const other of placed)if(Math.abs(other.x-x)<164&&Math.abs(other.top-markerTop)<72)markerTop=other.top+76;
        placed.push({x,top:markerTop});
      }
      const left = `${Math.round(x - 78)}px`, top = `${Math.round(markerTop)}px`;
      if (b.left !== left) b.left = left;
      if (b.top !== top) b.top = top;
      if (b.isVisible !== visible) b.isVisible = visible;
    }
  }
  function drivingHUD() {
    const s = lastState;
    const h = box(frame, 'drive-bar', 20, 662, 1140, 138, '#fffaf0f5', 28);
    h.isHitTestVisible = true; h.isPointerBlocker = true;
    icon(h, s.phase === 'moving' ? s.vehicleId : 'hint', 15, 18, 76);
    const defaults = { explore: '要送到哪里？点小镇里的地点吧。', moving: '小车在路上，我们慢慢来。', delivery: '到站啦！想想要交给朋友什么。' };
    text(h, s.message || defaults[s.phase] || '点一点，小车自己开。', 104, 14, 576, 68, 26, C.ink, 'left', true);
    const cargoText = s.cargo.map(i => `${goods[i.goodId]?.name}×${i.quantity}`).join('  ·  ');
    text(h, cargoText ? `车上：${cargoText}` : '车上空空的，可以回仓库装东西', 107, 84, 560, 38, 22, C.muted);
    button(h, 'hint', '再看', 702, 31, 130, 76, () => openPanel('hint'), { icon: 'hint', size: 25 });
    button(h, 'listen', '再听', 846, 31, 130, 76, () => onSpeak(), { icon: 'listen', size: 25 });
    button(h, 'destinations', '去哪', 990, 31, 128, 76, () => openPanel('destinations'), { fill: C.teal, ink: '#fff' });
    if (s.phase === 'delivery') {
      const dock = box(frame, 'delivery-dock', 260, 118, 660, 142, '#fffaf0f2', 24);
      dock.isHitTestVisible = true; dock.isPointerBlocker = true;
      text(dock, `这里是${places[s.location]?.name || '目的地'} · 点物品交一份`, 20, 9, 620, 38, 25, C.ink, 'left', true);
      const n = s.cargo.length;
      if (!n) text(dock, '没有物品了，去仓库补一补吧。', 20, 58, 620, 60, 25, C.muted);
      s.cargo.forEach((item, i) => {
        const width = Math.min(200, (620 - (n - 1) * 10) / n);
        const b = button(dock, `deliver-${item.goodId}`, '', 20 + i * (width + 10), 54, width, 76, () => send('DELIVER', { goodId: item.goodId }), { fill: '#e1eddf' });
        icon(b, item.goodId, 6, 10, 54);
        text(b, width > 140 ? `${goods[item.goodId]?.name} ×${item.quantity}` : `×${item.quantity}`, 64, 8, width - 70, 60, 24, C.ink, 'left', true);
      });
    }
  }
  function destinations() {
    const card = modal('想去哪里逛一逛？', '每个地方都可以去。选好了，小车自己开。', { close: true, badge: '小镇地图 · 没有走错的路' });
    PLACES.forEach((place, i) => {
      const b = button(card, `destination-${place.id}`, '', 36 + (i % 3) * 314, 213 + Math.floor(i / 3) * 119, 300, 104, () => { panel = null; if (!priorPaused) send('PAUSE', { value: false }); send('TRAVEL', { placeId: place.id }); rebuild(); }, { fill: '#e7eddd' });
      icon(b, place.id, 12, 18, 66); text(b, place.name, 90, 13, 200, 77, 28, C.ink, 'left', true);
    });
  }
  function eventCard() {
    const e = lastState.event;
    const card = modal(e?.title || '遇到一点小变化', e?.message || '没关系，一起想个办法。', { badge: '勇敢试一试 · 总会有办法' });
    icon(card, e?.id === 'repair' ? 'repair-tool' : e?.id === 'shortage' ? 'parcel' : 'car', 414, 209, 172, C.orange);
    (e?.options || []).forEach((opt, i) => button(card, `event-${opt.id}`, opt.label, 36 + i * 474, 438, 454, 96, () => send('RESOLVE_EVENT', { optionId: opt.id }), { fill: i ? '#e4ebdd' : C.teal, ink: i ? C.ink : C.white, size: 27 }));
    text(card, '不用着急，原来的小任务还在等你。', 80, 563, 840, 52, 26, C.muted, 'center');
  }
  function reward(isSession = false) {
    const card = modal(isSession ? '今天的三次帮忙，都完成啦！' : '谢谢你，小小帮手！', isSession ? '你记住了任务，也照顾了小镇的朋友。' : '每一次认真想一想，都很了不起。', { badge: '收集一个快乐的回忆' });
    icon(card, 'star', 398, 203, 204, C.yellow);
    const n = lastState.rewardCount || 0;
    text(card, `已经帮助朋友 ${n} 次`, 180, 421, 640, 57, 32, C.teal, 'center', true);
    if (historicalCount) text(card, `旧版贴纸回忆：${historicalCount} 张`, 180, 479, 640, 40, 24, C.muted, 'center');
    button(card, isSession ? 'new-session' : 'next', isSession ? '再去一个新小镇' : lastState.round >= 2 ? '看看今天的收获' : '再接一个小任务', 260, 532, 480, 86, () => isSession ? onNewSession(lastState.difficulty) : send('NEXT'), { fill: C.teal, ink: C.white, icon: 'arrow', size: 28 });
  }
  function paused() {
    const card = modal('小车休息一下', '喝口水、伸个懒腰。小镇会在这里等你。', { height: 520, width: 900, utilities: false, badge: '慢慢来，休息也很棒' });
    icon(card, lastState.vehicleId || 'car', 365, 206, 150);
    button(card, 'resume', '继续出发', 240, 398, 420, 86, () => send('PAUSE', { value: false }), { fill: C.teal, ink: C.white, icon: 'arrow' });
  }
  function settings() {
    const card = modal('大人和小司机的小设置', '难度只由你来选。换新地图后，会开始新的三单。', { close: true, badge: '陪伴着玩 · 一次练习一点点' });
    DIFFICULTIES.forEach((d, i) => {
      const selected = chosenDifficulty === d.id;
      const b = button(card, `difficulty-${d.id}`, '', 36 + i * 314, 207, 300, 150, () => { chosenDifficulty = d.id; rebuild(); }, { fill: selected ? '#cde3cd' : '#ececde', outline: selected ? C.teal : null });
      text(b, d.name, 18, 14, 264, 45, 28, C.ink, 'left', true);
      text(b, d.description, 18, 65, 264, 70, 23, C.muted);
    });
    button(card, 'setting-sound', sound ? '声音：开' : '声音：关', 36, 387, 440, 76, () => { sound = !sound; onSound(sound); rebuild(); }, { icon: 'sound' });
    button(card, 'reduced-motion', reducedMotion ? '轻柔动态：开' : '轻柔动态：关', 496, 387, 468, 76, () => { reducedMotion = !reducedMotion; if (reducedMotion) { sparkles.bursts = []; sparkles._markAsDirty(); } onReducedMotion(reducedMotion); rebuild(); });
    text(card, '轻柔动态会减少天气和庆祝的小粒子。', 40, 480, 920, 45, 24, C.muted);
    button(card, 'new-session', '用这个难度去新小镇', 510, 545, 454, 76, () => { panel = null; onNewSession(chosenDifficulty); rebuild(); }, { fill: C.teal, ink: C.white, size: 27 });
    button(card, 'back-to-town', '回到小镇', 36, 545, 278, 76, closePanel);
  }
  function landing() {
    box(frame, 'landing-bg', 0, 0, W, H, '#e7efdf', 0);
    icon(frame, 'farm', 60, 105, 195, '#a6c896'); icon(frame, 'town', 945, 400, 200, '#e0c091');
    box(frame, 'landing-card', 194, 89, 792, 640, C.cream, 42);
    icon(frame, 'car', 490, 113, 200, C.orange);
    text(frame, '小车忙忙镇', 250, 315, 680, 77, 58, C.ink, 'center', true);
    text(frame, '记一记 · 帮帮忙 · 去小镇冒险', 245, 400, 690, 49, 28, C.muted, 'center');
    if (mode === 'ready') {
      text(frame, '小镇全部准备好了，点一下出发吧！', 245, 468, 690, 49, 25, C.teal, 'center');
      button(frame, 'start', '快乐出发', 366, 553, 448, 98, () => { mode = 'game'; send('START'); rebuild(); }, { fill: C.teal, ink: C.white, icon: 'arrow', size: 32 });
    } else {
      const progress = Math.max(0, Math.min(1, Number(loadingState.progress) || 0));
      text(frame, loadingState.error ? '还差一点点，再试一次就好。' : loadingState.text, 242, 466, 696, 75, 25, C.muted, 'center');
      box(frame, 'progress-track', 280, 574, 620, 22, '#e6e8d8', 11);
      if (progress > 0) box(frame, 'progress-fill', 280, 574, Math.max(22, 620 * progress), 22, C.teal, 11);
      if (loadingState.error) button(frame, 'retry', '再试一次', 390, 620, 400, 78, () => send('RETRY_LOAD'), { fill: C.teal, ink: C.white });
      else text(frame, `${Math.round(progress * 100)}%  ·  准备好后，玩的时候不用再等下载`, 250, 618, 680, 54, 22, C.muted, 'center');
    }
  }
  function rebuild() {
    if (disposed) return;
    setup();
    if (mode !== 'game' || !lastState) { landing(); return; }
    makeMarkers();
    if (panel === 'hint') { brief(true); return; }
    if (panel === 'settings') { settings(); return; }
    if (panel === 'destinations') { destinations(); return; }
    if (lastState.paused) { paused(); return; }
    if (lastState.phase === 'brief') brief();
    else if (lastState.phase === 'selectVehicle') vehiclePicker();
    else if (lastState.phase === 'loading') shelf();
    else if (lastState.phase === 'event') eventCard();
    else if (lastState.phase === 'reward') reward();
    else if (lastState.phase === 'sessionComplete') reward(true);
    else { header(); drivingHUD(); }
  }
  function getBounds() {
    const result = {}, size = texture.getSize(), rect = canvas?.getBoundingClientRect();
    if (!rect?.width || !size.width) return result;
    for (const [id, b] of buttons) {
      let visible = b.isEnabled && b.isVisible && !b.notRenderable;
      for (let p = b.parent; p; p = p.parent) visible &&= p.isVisible && p.isEnabled;
      const m = b._currentMeasure;
      if (!visible || !m || m.width <= 0 || m.height <= 0) continue;
      result[id] = { x: rect.left + m.left * rect.width / size.width, y: rect.top + m.top * rect.height / size.height, width: m.width * rect.width / size.width, height: m.height * rect.height / size.height };
    }
    return result;
  }
  rebuild();
  return {
    render(state) {
      const signature = JSON.stringify(state);
      if (lastState?.seed !== state.seed || (lastState?.phase !== state.phase && state.phase === 'brief')) panel = null;
      lastState = state;
      if (!panel) chosenDifficulty = state.difficulty;
      if (signature !== lastSignature) { lastSignature = signature; rebuild(); }
    },
    loading(info) { mode = 'loading'; loadingState = { ...loadingState, error: false, ...info }; rebuild(); },
    ready() { mode = 'ready'; rebuild(); },
    setSettings(settings = {}) { sound = settings.sound ?? sound; historicalCount = settings.historicalCount ?? historicalCount; reducedMotion = settings.reducedMotion ?? reducedMotion; if (reducedMotion) { sparkles.bursts = []; sparkles._markAsDirty(); } rebuild(); },
    setPlaces(points) { projected = points || []; applyPlaces(); },
    cancelInput: cancelPress,
    getBounds,
    dispose() {
      disposed = true; cancelPress(); scene.onBeforeRenderObservable.remove(tick); engine.onResizeObservable.remove(resizeObserver);
      canvas?.removeEventListener('pointercancel', cancelPress, true); canvas?.removeEventListener('pointerdown', secondPointer, true); canvas?.removeEventListener('lostpointercapture', cancelPress, true);
      texture.dispose();
    },
  };
}
