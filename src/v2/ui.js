import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture.js';
import { Button } from '@babylonjs/gui/2D/controls/button.js';
import { Container } from '@babylonjs/gui/2D/controls/container.js';
import { Control } from '@babylonjs/gui/2D/controls/control.js';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle.js';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock.js';
import { GOODS, VEHICLES, PLACES, THEMES, DIFFICULTIES } from './catalog.js';
import { MODEL_CATALOG } from './model-catalog.js';

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

/** Model thumbnails and vector symbols share Babylon's one GUI canvas. */
class ToyIcon extends Control {
  constructor(kind, tint, image) { super(`art-${kind}`); this.kind = kind; this.tint = tint || known[kind]?.color || C.teal; this.image=image; this.isHitTestVisible = false; }
  _draw(ctx) {
    const m = this._currentMeasure;
    if(this.image){ctx.drawImage(this.image,m.left,m.top,m.width,m.height);return;}
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

class PlaceLinks extends Control {
  constructor() { super('place-links'); this.isHitTestVisible=false; this.links=[]; }
  _draw(ctx) {
    const m=this._currentMeasure;
    ctx.save();ctx.translate(m.left,m.top);ctx.scale(m.width/860,m.height/H);
    for(const p of this.links){
      line(ctx,[[p.x1,p.y1],[p.x2,p.y2]],'#fffaf0',4);
      line(ctx,[[p.x1,p.y1],[p.x2,p.y2]],'#789e8b',1.5);
      circle(ctx,p.x2,p.y2,3,'#789e8b');
    }
    ctx.restore();
  }
}

function position(control, x, y, width, height) {
  control.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  control.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  control.left = `${x}px`; control.top = `${y}px`; control.width = `${width}px`; control.height = `${height}px`;
  return control;
}

export function createUI(scene, callbacks = {}) {
  const { onCommand = () => {}, onSpeak = () => {}, onSound = () => {}, onModelPreview = () => {}, onReducedMotion = () => {}, onNewSession = () => {} } = callbacks;
  const WORLD_W = 860, PANEL_W = W - WORLD_W, CARD_W = PANEL_W - 24;
  const texture = AdvancedDynamicTexture.CreateFullscreenUI('town-ui', true, scene);
  texture.useSmallestIdeal = false;
  const engine = scene.getEngine(), canvas = engine.getRenderingCanvas();
  const fitTexture = () => {
    const wide = engine.getRenderWidth() / engine.getRenderHeight() > W / H;
    texture.idealWidth = wide ? 0 : W;
    texture.idealHeight = wide ? H : 0;
  };
  fitTexture();
  const resizeObserver = engine.onResizeObservable.add(() => { fitTexture(); applyPlaces(); });
  texture.rootContainer.isPointerBlocker = false;
  let screen, frame, markersLayer, lastState = null, panel = null, priorPaused = false;
  let mode = 'loading', loadingState = { progress: 0, text: '小镇正在准备，请稍等一会儿。' };
  let sound = true, reducedMotion = false, historicalCount = 0, chosenDifficulty = 'easy', lastSignature = '';
  let projected = [], disposed = false, orientationBlocked = false, vehiclePage = 0, markers = new Map();
  let placeLinks = null;
  let modelIcons = new Map();
  let modelCategory = 'vehicle', modelIndex = 0, modelZoom = 1;
  const selectedModels = () => MODEL_CATALOG.filter(model => model.category === modelCategory);
  const selectedModel = () => selectedModels()[modelIndex] || selectedModels()[0];
  const buttons = new Map(), armed = new Set();
  const sparkles = new ClickSparkles();
  sparkles.width = '100%'; sparkles.height = '100%'; sparkles.zIndex = 100;
  texture.addControl(sparkles);
  const cancelPress = () => {
    armed.clear();
    for (const b of buttons.values()) b.background = b._townBaseFill;
    for (const [pointerId, control] of Object.entries(texture._lastControlDown)) {
      control._forcePointerUp(Number(pointerId));
      delete texture._lastControlDown[pointerId];
    }
    texture._capturedPointerIds.clear();
  };
  const secondPointer = e => { if (e.isPrimary === false) cancelPress(); };
  const cancelOutside = event => {
    if (!armed.size) return;
    const rect = canvas?.getBoundingClientRect(), size = texture.getSize();
    if (!rect?.width || !rect.height) { armed.clear(); return; }
    const x = (event.clientX - rect.left) * size.width / rect.width;
    const y = (event.clientY - rect.top) * size.height / rect.height;
    for (const b of armed) {
      const m = b._currentMeasure;
      // A rebuild can leave Babylon's hover owner at the root while a button
      // owns the press. Check the actual pointer before GUI move/up handling,
      // so leaving the touch target always cancels, even without a GUI out.
      if (!m || x < m.left || x > m.left + m.width || y < m.top || y > m.top + m.height) {
        armed.delete(b); b.background = b._townBaseFill;
      }
    }
  };
  canvas?.addEventListener('pointermove', cancelOutside, true);
  canvas?.addEventListener('pointerup', cancelOutside, true);
  canvas?.addEventListener('pointercancel', cancelPress, true);
  // The second contact may land in the safe-area gutter or on the HTML edge.
  canvas?.ownerDocument?.addEventListener('pointerdown', secondPointer, true);
  canvas?.addEventListener('lostpointercapture', cancelPress, true);
  const tick = scene.onBeforeRenderObservable.add(() => {
    if (!orientationBlocked && !lastState?.paused && !reducedMotion) sparkles.tick(Math.min(engine.getDeltaTime() / 1000, .05));
  });

  function box(parent, name, x, y, w, h, background = C.cream, radius = 20) {
    const r = position(new Rectangle(name), x, y, w, h);
    r.background = background; r.thickness = 0; r.cornerRadius = radius; r.isHitTestVisible = false;
    parent.addControl(r); return r;
  }
  function text(parent, words, x, y, w, h, size = 24, color = C.ink, align = 'left', bold = false) {
    const t = position(new TextBlock(`text-${String(words).slice(0, 16)}`, words), x, y, w, h);
    t.color = color; t.fontSize = size; t.fontFamily = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
    t.fontWeight = bold ? '700' : '500'; t.textWrapping = true; t.wordDivider = ''; t.lineSpacing = '3px';
    t.textHorizontalAlignment = align === 'center' ? Control.HORIZONTAL_ALIGNMENT_CENTER : Control.HORIZONTAL_ALIGNMENT_LEFT;
    t.isHitTestVisible = false; parent.addControl(t); return t;
  }
  function icon(parent, kind, x, y, size, tint) { const a = position(new ToyIcon(kind, tint, modelIcons.get(kind)), x, y, size, size); parent.addControl(a); return a; }
  function button(parent, id, label, x, y, w, h, action, options = {}) {
    const b = position(new Button(id), x, y, w, h);
    b.cornerRadius = options.radius ?? 18; b.thickness = options.outline ? 2 : 0;
    b.color = options.outline || C.line; b.background = options.fill || C.mint;
    b._townBaseFill = b.background;
    b.isPointerBlocker = true; b.isEnabled = options.enabled !== false;
    b.disabledColor = '#e4e5dd'; b.alpha = b.isEnabled ? 1 : .65;
    b.pointerEnterAnimation = b.pointerOutAnimation = b.pointerDownAnimation = b.pointerUpAnimation = () => {};
    const iconSize = options.iconOnly ? 38 : w < 180 ? 28 : 36;
    if (options.icon) icon(b, options.icon, options.iconOnly ? (w - iconSize) / 2 : 10, (h - iconSize) / 2, iconSize, options.ink);
    if (label) {
      const inset = options.icon ? iconSize + 16 : 8;
      text(b, label, inset, 0, w - inset - 8, h, options.size || 24, options.ink || C.ink, options.icon ? 'left' : 'center', true);
    }
    b.onPointerDownObservable.add((_, event) => {
      if (orientationBlocked || event.userInfo?.event?.isPrimary === false) return;
      armed.add(b); b.background = options.pressedFill || '#c8dfcf';
    });
    b.onPointerOutObservable.add(() => { armed.delete(b); b.background = b._townBaseFill; });
    b.onPointerUpObservable.add(() => { armed.delete(b); b.background = b._townBaseFill; });
    b.onPointerClickObservable.add(() => {
      if (!armed.has(b) || disposed || orientationBlocked || !b.isEnabled) return;
      armed.delete(b);
      if (!reducedMotion && !lastState?.paused) { const m = b._currentMeasure; sparkles.add(m.left + m.width / 2, m.top + m.height / 2); }
      action();
    });
    parent.addControl(b); buttons.set(id, b); return b;
  }
  function send(type, payload = {}) { if (!orientationBlocked) onCommand({ type, ...payload }); }
  function openPanel(nextPanel) {
    // Preserve the pause state from before the first panel, including when the
    // task reminder switches to the destination picker.
    const firstPanel = !panel;
    if (firstPanel) priorPaused = !!lastState?.paused;
    panel = nextPanel;
    if (firstPanel && !priorPaused) send('PAUSE', { value: true });
    rebuild();
  }
  function closePanel() {
    panel = null;
    if (!priorPaused) send('PAUSE', { value: false });
    rebuild();
  }
  function setup() {
    cancelPress();
    screen?.dispose();
    buttons.clear(); markers = new Map(); markersLayer = null; placeLinks = null;
    screen = new Container('ui-screen'); screen.width = '100%'; screen.height = '100%'; screen.zIndex = 1;
    screen.isHitTestVisible = false; texture.addControl(screen);
    frame = new Container('ui-frame'); frame.width = `${W}px`; frame.height = `${H}px`;
    frame.isHitTestVisible = false; screen.addControl(frame);
  }
  function blockWorld() {
    // The world stays fully visible. This transparent input surface prevents
    // touches behind a task, help, settings, or pause panel from reaching it.
    const blocker = new Rectangle('world-input-blocker');
    blocker.width = '100%'; blocker.height = '100%'; blocker.background = 'transparent'; blocker.thickness = 0;
    blocker.isPointerBlocker = true;
    screen.addControl(blocker); screen.removeControl(frame); screen.addControl(frame);
  }
  function sidebar({ utilities = true, close = false } = {}) {
    const bg = box(frame, 'operation-panel', WORLD_W, 0, PANEL_W, H, '#fffaf0', 0);
    bg.isHitTestVisible = true; bg.isPointerBlocker = true;
    box(bg, 'panel-edge', 0, 0, 3, H, '#d9e3d4', 0);
    text(bg, '小车\n忙忙镇', 16, 10, 116, 76, 25, C.teal, 'left', true);
    if (close) button(bg, 'close', '返回', 164, 12, 144, 72, closePanel, { icon: 'close' });
    else if (utilities) {
      button(bg, 'settings', '', 156, 12, 72, 72, () => openPanel('settings'), { icon: 'settings', iconOnly: true });
      button(bg, 'pause', '', 236, 12, 72, 72, () => send('PAUSE', { value: true }), { icon: 'pause', iconOnly: true, fill: '#f4e2c7' });
    }
    return box(bg, 'panel-content', 12, 100, CARD_W, 708, '#f6f3e8', 22);
  }
  function title(card, heading, subtitle = '', { subtitleHeight = 80 } = {}) {
    text(card, heading, 12, 8, 272, 64, 28, C.ink, 'left', true);
    if (subtitle) text(card, subtitle, 12, 76, 272, subtitleHeight, 22, C.muted);
  }
  function helpButton(card, y = 620, width = 272) {
    button(card, 'hint', '帮帮我', 12, y, width, 72, () => openPanel('hint'), { icon: 'hint', size: 24 });
  }
  function missionRows(parent, y = 158) {
    const mission = lastState?.mission;
    (mission?.steps || []).slice(0, 3).forEach((step, i) => {
      const row = box(parent, `instruction-${i}`, 12, y + i * 112, 272, 104, i % 2 ? '#e7eddf' : '#eee6d4', 16);
      text(row, mission.ordered ? `${i + 1}.` : '·', 8, 5, 30, 40, 23, C.teal, 'center', true);
      icon(row, step.goodId, 38, 6, 38);
      text(row, `${goods[step.goodId]?.name || step.goodId} × ${step.quantity}`, 84, 4, 180, 44, 24, C.ink, 'left', true);
      icon(row, 'arrow', 22, 59, 28, C.teal);
      icon(row, step.placeId, 58, 54, 40);
      text(row, places[step.placeId]?.name || step.placeId, 106, 53, 158, 44, 24, C.ink, 'left', true);
    });
  }
  function brief(isHint = false) {
    const mission = lastState.mission, card = sidebar({ close: isHint });
    title(card, isHint ? '再看看小任务' : mission?.title || '今天的小任务', mission?.ordered ? '照着顺序记一记。想不起来，随时找我帮忙。' : '记住物品和地点，准备好后就出发！');
    missionRows(card);
    const canChooseDestination = isHint && ['explore', 'moving', 'delivery'].includes(lastState.phase);
    button(card, 'listen', '再听一次', 12, 510, 272, 72, () => onSpeak(), { icon: 'listen' });
    if (canChooseDestination) {
      button(card, 'destinations', '选个地点', 12, 590, 132, 100, () => openPanel('destinations'), { size: 24 });
      button(card, 'close-hint', '想起来了', 152, 590, 132, 100, closePanel, { fill: C.teal, ink: C.white });
    } else {
      button(card, isHint ? 'close-hint' : 'ack', isHint ? '我想起来了' : '记住了，选小车', 12, 610, 272, 82, () => isHint ? closePanel() : send('ACK_BRIEF'), { icon: 'check', fill: C.teal, ink: C.white, size: 25 });
    }
  }
  function vehiclePicker() {
    const options = (lastState.mission?.vehicleChoices || VEHICLES.map(v => v.id)).map(id => cars[id]).filter(Boolean);
    const pages = Math.max(1, Math.ceil(options.length / 3));
    vehiclePage = Math.min(vehiclePage, pages - 1);
    const card = sidebar();
    title(card, '选一辆小车', lastState.message || '小车各有本领，选好后去装东西。', { subtitleHeight: 68 });
    options.slice(vehiclePage * 3, vehiclePage * 3 + 3).forEach((car, i) => {
      const b = button(card, `vehicle-${car.id}`, '', 12, 152 + i * 116, 272, 108, () => send('SELECT_VEHICLE', { vehicleId: car.id }), { fill: '#ece8d8' });
      icon(b, car.id, 10, 16, 76);
      text(b, car.name, 100, 10, 164, 40, 27, C.ink, 'left', true);
      const special = { fridge: '冷藏物品', tanker: '运送清水', repair: '携带工具', bus: '搭载朋友' }[car.id] || '日常货物';
      text(b, special, 100, 40, 164, 34, 22, C.muted);
      text(b, `能装 ${car.capacity} 份`, 100, 74, 164, 34, 22, C.muted);
    });
    if (pages > 1) button(card, 'next-vehicles', `更多小车 · ${vehiclePage + 1}/${pages}`, 12, 520, 272, 72, () => { vehiclePage = (vehiclePage + 1) % pages; rebuild(); }, { icon: 'arrow', size: 23 });
    helpButton(card);
  }
  function shelf() {
    const state = lastState, car = cars[state.vehicleId], count = state.cargo.reduce((a, b) => a + b.quantity, 0);
    const capacity = state.capacity ?? state.vehicleCapacity ?? Math.max(1, (car?.capacity || 0) + (state.capacityBonus || 0));
    const storedCount = (state.storedCargo || []).reduce((sum, item) => sum + item.quantity, 0);
    const card = sidebar();
    text(card, '装上要带的东西', 12, 2, 272, 42, 28, C.ink, 'left', true);
    text(card, state.message || '点物品装一份，点减号取下。', 12, 44, 272, 102, 22, C.muted);
    text(card, `车上 ${count}/${capacity} 份${storedCount ? `，暂存${storedCount}份` : ''}`, 12, 146, 272, 34, 23, C.teal, 'left', true);
    const choices = (state.shelf || state.mission?.shelf || []).slice(0, 6);
    choices.forEach((id, i) => {
      const x = 12 + (i % 2) * 140, y = 180 + Math.floor(i / 2) * 144;
      const tile = box(card, `shelf-${id}`, x, y, 132, 144, '#eee9d9', 16);
      const load = button(tile, `load-${id}`, '', 0, 0, 132, 72, () => send('LOAD', { goodId: id }), { fill: '#eee9d9' });
      icon(load, id, 5, 16, 40); text(load, goods[id]?.name || id, 48, 0, 78, 72, 23, C.ink, 'center', true);
      const quantity = state.cargo.find(item => item.goodId === id)?.quantity || 0;
      if (quantity) button(tile, `unload-${id}`, `−  ${quantity} 份`, 0, 72, 132, 72, () => send('UNLOAD', { goodId: id }), { fill: '#dce9d9', size: 24 });
      else text(tile, '轻点装一份', 4, 82, 124, 48, 22, C.muted, 'center');
    });
    helpButton(card, 620, 132);
    button(card, 'depart', '装好出发', 152, 620, 132, 72, () => send('DEPART'), { fill: C.teal, ink: C.white, size: 24 });
  }
  function makeMarkers() {
    markersLayer = position(new Container('map-places'), 0, 0, WORLD_W, H);
    markersLayer.isHitTestVisible = false; markersLayer.clipChildren = true;
    frame.addControl(markersLayer);
    markersLayer.isVisible = ['explore', 'delivery'].includes(lastState?.phase) && !lastState.paused && !panel && !orientationBlocked;
    placeLinks=position(new PlaceLinks(),0,0,WORLD_W,H);markersLayer.addControl(placeLinks);
    for (const place of PLACES) {
      const b = button(markersLayer, `place-${place.id}`, '', 0, 0, 132, 72, () => send('TRAVEL', { placeId: place.id }), { fill: 'transparent', pressedFill: '#dce9d855', radius: 16 });
      const chip = box(b, `sign-${place.id}`, 16, 16, 100, 40, '#fffaf0ed', 13);
      icon(chip, place.id, 3, 6, 28);
      const shortName = place.name;
      text(chip, shortName, 32, 0, 66, 40, 21, C.ink, 'center', true);
      b.isVisible = false; markers.set(place.id, b);
    }
    applyPlaces();
  }
  function getLayout() {
    const size = texture.getSize(), rect = canvas?.getBoundingClientRect();
    const ratio = texture.idealRatio || 1;
    if (!rect?.width || !rect.height || !size.width || !size.height) return { worldRect: { x: 0, y: 0, width: 0, height: 0 }, panelRect: { x: 0, y: 0, width: 0, height: 0 } };
    const sx = ratio * rect.width / size.width, sy = ratio * rect.height / size.height;
    const x = (rect.width - W * sx) / 2, y = (rect.height - H * sy) / 2;
    // Coordinates are CSS pixels relative to the canvas, matching projectPlaces.
    return {
      worldRect: { x, y, width: WORLD_W * sx, height: H * sy },
      panelRect: { x: x + WORLD_W * sx, y, width: PANEL_W * sx, height: H * sy },
      scale: { x: sx, y: sy }, logical: { width: W, height: H, worldWidth: WORLD_W },
    };
  }
  function applyPlaces() {
    const layout = getLayout();
    if (!layout.scale || !markersLayer?.isVisible) return;
    const { worldRect, scale } = layout, placed = [];
    for (const p of [...projected].sort((a, b) => a.y - b.y)) {
      const b = markers.get(p.id); if (!b) continue;
      const x = (p.x - worldRect.x) / scale.x, y = (p.y - worldRect.y) / scale.y;
      // Every touch rectangle remains strictly inside the left world region.
      let left = Math.max(4, Math.min(WORLD_W - 136, x - 66));
      let top = Math.max(4, Math.min(H - 76, y - 88));
      const visible = p.visible !== false && x >= 0 && x <= WORLD_W && y >= 0 && y <= H;
      if (visible) {
        // Avoid other signs and building facades; link displaced signs back
        // to their actual landmarks so their identity remains unambiguous.
        const candidates=[0,-90,90,-150,150].map(shift=>{
          const candidate=Math.max(4,Math.min(WORLD_W-136,x-66+shift));
          let score=Math.abs(candidate-(x-66));
          for(const other of placed)if(Math.abs(other.left-candidate)<108&&Math.abs(other.top-top)<44)score+=10000;
          for(const other of projected){
            if(other.id===p.id||!other.building||other.visible===false)continue;
            const bx=(other.building.x-worldRect.x)/scale.x,by=(other.building.y-worldRect.y)/scale.y;
            if(candidate+116>bx-32&&candidate+16<bx+32&&top+56>by-65&&top+16<by+20)score+=1000;
          }
          return {left:candidate,score};
        }).sort((a,b)=>a.score-b.score);
        left=candidates[0].left;
        placed.push({left,top,x1:left+66,y1:top+36,x2:x,y2:y});
      }
      b.left = `${Math.round(left)}px`; b.top = `${Math.round(top)}px`; b.isVisible = visible;
    }
    if(placeLinks){
      const key=JSON.stringify(placed.map(p=>[p.x1,p.y1,p.x2,p.y2].map(n=>Math.round(n*10))));
      if(placeLinks.key!==key){placeLinks.key=key;placeLinks.links=placed;placeLinks._markAsDirty();}
    }
  }
  function drivingHUD() {
    const s = lastState, card = sidebar();
    const defaults = { explore: '想一想要去哪里，再点小镇里的地点。', moving: '小车在路上，我们慢慢来。', delivery: '到站啦！选物品交给朋友。' };
    const theme = THEMES.find(t => t.id === s.map?.theme)?.name || '今天的小镇';
    text(card, `${theme} · 第 ${s.round + 1} / 3 单`, 12, 8, 272, 40, 22, C.teal, 'left', true);
    text(card, s.message || defaults[s.phase] || '', 12, 52, 272, 138, 22, C.ink, 'left', true);
    if (s.phase === 'delivery') {
      text(card, `这里是${places[s.location]?.name || '目的地'}`, 12, 192, 272, 36, 24, C.teal, 'left', true);
      text(card, '点一次，交一份', 12, 228, 272, 34, 22, C.muted);
      s.cargo.slice(0, 6).forEach((item, i) => {
        const b = button(card, `deliver-${item.goodId}`, '', 12 + (i % 2) * 140, 266 + Math.floor(i / 2) * 88, 132, 84, () => send('DELIVER', { goodId: item.goodId }));
        icon(b, item.goodId, 4, 6, 38);
        text(b, goods[item.goodId]?.name || item.goodId, 46, 4, 80, 42, 22, C.ink, 'center', true);
        text(b, `× ${item.quantity}`, 10, 46, 112, 34, 23, C.ink, 'center', true);
      });
      if (!s.cargo.length) text(card, '车上空空的，回仓库再装一些吧。', 12, 278, 272, 100, 24, C.muted);
    } else {
      icon(card, s.vehicleId || 'car', 82, 198, 132);
      text(card, '车上带着', 12, 342, 272, 40, 23, C.teal, 'left', true);
      s.cargo.slice(0, 6).forEach((item, i) => text(card, `${goods[item.goodId]?.name} ×${item.quantity}`, 12 + (i % 2) * 140, 386 + Math.floor(i / 2) * 44, 132, 40, 22, C.muted));
      if (!s.cargo.length) text(card, '空空的车厢，可以去仓库装东西。', 12, 388, 272, 100, 24, C.muted);
    }
    // The camera already shows the whole town after loading and throughout travel.
    helpButton(card);
  }
  function destinations() {
    const card = sidebar({ close: true });
    title(card, '想去哪里？', '选一个地点，小车就会自己开过去。', { subtitleHeight: 68 });
    PLACES.forEach((place, i) => {
      const b = button(card, `destination-${place.id}`, '', 12 + (i % 2) * 140, 144 + Math.floor(i / 2) * 94, 132, 88, () => {
        panel = null;
        if (!priorPaused) send('PAUSE', { value: false });
        send('TRAVEL', { placeId: place.id }); rebuild();
      });
      icon(b, place.id, 44, 0, 44);
      text(b, place.name, 4, 44, 124, 40, 24, C.ink, 'center', true);
    });
    button(card, 'close-hint', '回到小镇', 12, 620, 272, 72, closePanel, { fill: C.teal, ink: C.white });
  }
  function eventCard() {
    const e = lastState.event, card = sidebar();
    title(card, e?.title || '遇到一点小变化');
    text(card, e?.message || '没关系，一起想个办法。', 12, 82, 272, 180, 23, C.muted);
    icon(card, e?.id === 'repair' ? 'repair-tool' : e?.id === 'shortage' ? 'parcel' : 'car', 92, 274, 112, C.orange);
    (e?.options || []).forEach((opt, i) => button(card, `event-${opt.id}`, opt.label, 12, 414 + i * 100, 272, 88, () => send('RESOLVE_EVENT', { optionId: opt.id }), { fill: i ? C.mint : C.teal, ink: i ? C.ink : C.white, size: 24 }));
    text(card, '慢慢想，总会有办法。', 12, 632, 272, 50, 22, C.muted, 'center');
  }
  function reward(isSession = false) {
    const card = sidebar();
    title(card, isSession ? '三次帮忙都完成啦！' : '谢谢你，小小帮手！', isSession ? '你记住了任务，也照顾了小镇的朋友。' : '认真想一想，就很了不起。');
    icon(card, 'star', 62, 196, 172, C.yellow);
    text(card, `已经帮助朋友 ${lastState.rewardCount || 0} 次`, 12, 394, 272, 72, 27, C.teal, 'center', true);
    if (historicalCount) text(card, `旧版贴纸：${historicalCount} 张`, 12, 480, 272, 40, 22, C.muted, 'center');
    button(card, isSession ? 'new-session' : 'next', isSession ? '再去一个新小镇' : lastState.round >= 2 ? '看看今天的收获' : '再接一个小任务', 12, 600, 272, 92, () => isSession ? onNewSession(lastState.difficulty) : send('NEXT'), { fill: C.teal, ink: C.white, size: 25 });
  }
  function paused() {
    const card = sidebar({ utilities: false });
    title(card, '小车休息一下', '喝口水，伸个懒腰。小镇在这里等你。');
    icon(card, lastState.vehicleId || 'car', 62, 230, 172);
    button(card, 'resume', '继续出发', 12, 600, 272, 92, () => send('PAUSE', { value: false }), { fill: C.teal, ink: C.white, icon: 'arrow' });
  }
  function settings() {
    const card = sidebar({ close: true });
    text(card, '小司机的小设置', 12, 8, 272, 54, 28, C.ink, 'left', true);
    DIFFICULTIES.forEach((d, i) => {
      const selected = chosenDifficulty === d.id;
      const b = button(card, `difficulty-${d.id}`, '', 12, 64 + i * 88, 272, 80, () => { chosenDifficulty = d.id; rebuild(); }, { fill: selected ? '#cde3cd' : '#e9e9db', outline: selected ? C.teal : null });
      text(b, d.name, 10, 3, 252, 38, 25, C.ink, 'left', true);
      const description = { easy: '记一种物品和一个地点', normal: '记两种物品和两个地点', challenge: '记三步，按顺序完成' }[d.id];
      text(b, description, 10, 40, 252, 36, 22, C.muted);
    });
    const soundButton = button(card, 'setting-sound', sound ? '声音：开' : '声音：关', 12, 336, 272, 64, () => { sound = !sound; onSound(sound); rebuild(); }, { icon: 'sound' });
    buttons.set('sound', soundButton); // Existing test ID now points to the settings action.
    button(card, 'reduced-motion', reducedMotion ? '轻柔动态：开' : '轻柔动态：关', 12, 408, 272, 64, () => { reducedMotion = !reducedMotion; if (reducedMotion) { sparkles.bursts = []; sparkles._markAsDirty(); } onReducedMotion(reducedMotion); rebuild(); }, { size: 24 });
    button(card, 'model-viewer', '模型图鉴', 12, 480, 272, 64, () => openPanel('models'), { size: 25 });
    button(card, 'new-session', '用这个难度去新小镇', 12, 552, 272, 64, () => { panel = null; onNewSession(chosenDifficulty); rebuild(); }, { fill: C.teal, ink: C.white, size: 23 });
    button(card, 'back-to-town', '回到小镇', 12, 628, 272, 64, closePanel, { size: 24 });
  }
  function modelViewer() {
    const card = sidebar({ close: true }), list = selectedModels(), model = selectedModel();
    text(card, '模型图鉴', 12, 8, 272, 54, 28, C.ink, 'left', true);
    [['vehicle','车辆'],['place','地点'],['decoration','装饰']].forEach(([id,label],i)=>{
      button(card, `models-${id}`, label, 12+i*92, 72, 88, 64, ()=>{
        modelCategory=id;modelIndex=0;modelZoom=1;rebuild();
      }, {fill:modelCategory===id?'#cde3cd':C.mint,size:23});
    });
    text(card, model.name, 12, 150, 272, 46, 28, C.ink, 'left', true);
    text(card, `${model.sourceLabel} · ${modelIndex+1}/${list.length}`, 12, 204, 272, 40, 23, C.teal, 'left', true);
    text(card, model.packLabel, 12, 250, 272, 62, 23, C.muted);
    text(card, model.details, 12, 316, 272, 94, 22, C.muted);
    const step = delta => {modelIndex=(modelIndex+delta+list.length)%list.length;modelZoom=1;rebuild();};
    button(card, 'model-previous', '上一个', 12, 420, 132, 64, ()=>step(-1), {size:23});
    button(card, 'model-next', '下一个', 152, 420, 132, 64, ()=>step(1), {size:23});
    const zoom = delta => {modelZoom=Math.max(.65,Math.min(1.6,Math.round((modelZoom+delta)*100)/100));rebuild();};
    button(card, 'model-zoom-out', '缩小 −', 12, 496, 132, 64, ()=>zoom(-.15), {enabled:modelZoom>.65,size:23});
    button(card, 'model-zoom-in', '放大 ＋', 152, 496, 132, 64, ()=>zoom(.15), {enabled:modelZoom<1.6,size:23});
    text(card, `45°斜俯视 · ${Math.round(modelZoom*100)}%`, 12, 572, 272, 40, 22, C.muted, 'center');
    button(card, 'model-back', '返回设置', 12, 628, 272, 64, ()=>openPanel('settings'), {size:24});
  }
  function landing() {
    const card = sidebar({ utilities: false });
    title(card, '小车忙忙镇', '记一记，帮帮忙，去小镇冒险。');
    icon(card, 'car', 62, 192, 172, C.orange);
    if (mode === 'ready') {
      text(card, '小镇准备好了，快乐出发吧！', 12, 400, 272, 90, 26, C.teal, 'center', true);
      button(card, 'start', '快乐出发', 12, 596, 272, 96, () => { mode = 'game'; send('START'); rebuild(); }, { fill: C.teal, ink: C.white, icon: 'arrow', size: 28 });
    } else {
      const progress = Math.max(0, Math.min(1, Number(loadingState.progress) || 0));
      text(card, loadingState.error ? '还差一点点，再试一次就好。' : loadingState.text, 12, 388, 272, 114, 24, C.muted, 'center');
      box(card, 'progress-track', 20, 530, 256, 20, '#e0e5d5', 10);
      if (progress > 0) box(card, 'progress-fill', 20, 530, Math.max(20, 256 * progress), 20, C.teal, 10);
      if (loadingState.error) button(card, 'retry', '再试一次', 12, 610, 272, 82, () => send('RETRY_LOAD'), { fill: C.teal, ink: C.white });
      else text(card, `${Math.round(progress * 100)}%\n准备好后，玩时不用再下载`, 12, 578, 272, 104, 22, C.muted, 'center');
    }
  }
  function orientationNotice() {
    const bg = new Rectangle('orientation-blocker'); bg.width = '100%'; bg.height = '100%'; bg.background = C.cream; bg.thickness = 0; bg.isPointerBlocker = true;
    screen.addControl(bg);
    const heading = new TextBlock('orientation-instruction', '把 iPad 横过来玩');
    heading.width = '94%'; heading.height = '110px'; heading.fontSize = 36; heading.color = C.ink; heading.fontWeight = '700'; heading.textWrapping = true; heading.isHitTestVisible = false;
    bg.addControl(heading);
    const detail = new TextBlock('orientation-detail', '小镇和操作面板，就能一起看清啦');
    detail.width = '88%'; detail.height = '100px'; detail.top = '110px'; detail.fontSize = 25; detail.color = C.muted; detail.textWrapping = true; detail.isHitTestVisible = false;
    bg.addControl(detail);
  }
  function rebuild() {
    if (disposed) return;
    onModelPreview(panel === 'models' ? selectedModel().id : null, modelZoom);
    setup();
    if (orientationBlocked) { orientationNotice(); return; }
    const interactiveWorld = mode === 'game' && lastState && ['explore', 'delivery'].includes(lastState.phase) && !lastState.paused && !panel;
    if (!interactiveWorld) blockWorld();
    if (mode !== 'game' || !lastState) { landing(); return; }
    makeMarkers();
    if (panel === 'hint') { brief(true); return; }
    if (panel === 'settings') { settings(); return; }
    if (panel === 'models') { modelViewer(); return; }
    if (panel === 'destinations') { destinations(); return; }
    if (lastState.paused) { paused(); return; }
    if (lastState.phase === 'brief') brief();
    else if (lastState.phase === 'selectVehicle') vehiclePicker();
    else if (lastState.phase === 'loading') shelf();
    else if (lastState.phase === 'event') eventCard();
    else if (lastState.phase === 'reward') reward();
    else if (lastState.phase === 'sessionComplete') reward(true);
    else drivingHUD();
  }
  function getBounds() {
    const result = {}, size = texture.getSize(), rect = canvas?.getBoundingClientRect();
    if (!rect?.width || !size.width || orientationBlocked) return result;
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
      if (lastState?.mission?.id !== state.mission?.id || state.phase !== 'selectVehicle') vehiclePage = 0;
      if (lastState?.seed !== state.seed || (lastState?.phase !== state.phase && state.phase === 'brief')) panel = null;
      lastState = state;
      if (!panel) chosenDifficulty = state.difficulty;
      if (signature !== lastSignature) { lastSignature = signature; rebuild(); }
    },
    loading(info) { mode = 'loading'; loadingState = { ...loadingState, error: false, ...info }; rebuild(); },
    ready() { mode = 'ready'; rebuild(); },
    setModelIcons(images) { modelIcons = images; rebuild(); },
    setSettings(settings = {}) { sound = settings.sound ?? sound; historicalCount = settings.historicalCount ?? historicalCount; reducedMotion = settings.reducedMotion ?? reducedMotion; if (reducedMotion) { sparkles.bursts = []; sparkles._markAsDirty(); } rebuild(); },
    setPlaces(points) { projected = points || []; applyPlaces(); },
    setOrientationBlocked(blocked) {
      const next = !!blocked;
      if (next === orientationBlocked) return;
      orientationBlocked = next; cancelPress(); sparkles.bursts = []; sparkles._markAsDirty(); rebuild();
    },
    cancelInput: cancelPress,
    getBounds,
    getLayout,
    getModelView() { return panel === 'models' ? {...selectedModel(),zoom:modelZoom} : null; },
    dispose() {
      disposed = true; cancelPress(); scene.onBeforeRenderObservable.remove(tick); engine.onResizeObservable.remove(resizeObserver);
      modelIcons = new Map();
      canvas?.removeEventListener('pointermove', cancelOutside, true); canvas?.removeEventListener('pointerup', cancelOutside, true);
      canvas?.removeEventListener('pointercancel', cancelPress, true); canvas?.ownerDocument?.removeEventListener('pointerdown', secondPointer, true); canvas?.removeEventListener('lostpointercapture', cancelPress, true);
      texture.dispose();
    },
  };
}
