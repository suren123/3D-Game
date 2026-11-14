import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture.js';
import { Button } from '@babylonjs/gui/2D/controls/button.js';
import { Container } from '@babylonjs/gui/2D/controls/container.js';
import { Control } from '@babylonjs/gui/2D/controls/control.js';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle.js';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock.js';
import { GOODS, VEHICLES, PLACES, DIFFICULTIES } from './catalog.js';
import { MODEL_CATALOG } from './model-catalog.js';

const W = 1180, H = 820;
const C = { ink: '#264f49', muted: '#687d70', cream: '#fffaf0', mint: '#e2eee3', teal: '#328775', orange: '#ec9b59', yellow: '#f5ce77', line: '#dce7da', white: '#ffffff' };
const goods = Object.fromEntries(GOODS.map(item => [item.id, item]));
const cars = Object.fromEntries(VEHICLES.map(item => [item.id, item]));
const places = Object.fromEntries(PLACES.map(item => [item.id, item]));
const known = { ...goods, ...cars, ...places };
// Catalogue names are already two or three characters; speech and pictures agree.
const shortName = id => known[id]?.name || '';
const feedbackLabels = { 'capacity-full': '装满啦', arrived: '点货格', supply: '补货啦', 'need-item': '再想想', delivered: '送对啦', loaded: '装好啦', unloaded: '放回啦', 'vehicle-ready': '装点货', 'choose-vehicle': '选小车', travel: '在路上', brief: '记一记', 'session-complete': '谢谢你', 'wrong-place': '再想想', 'place-done': '送过啦', 'missing-cargo': '缺货啦', 'empty-cargo': '装点货', moving: '在路上', 'wrong-item': '再想想', 'next-stop': '送对啦', reward: '谢谢你', full: '装满啦', 'cargo-full': '装满啦', incompatible: '换辆车', 'wrong-vehicle': '换辆车', 'shelf-empty': '补货中' };

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
    if (goods[this.kind]) { ctx.translate(50, 50); ctx.scale(1.08, 1.08); ctx.translate(-50, -50); }
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
      round(ctx, 23, 24, 54, 65, 5, '#267ba7'); round(ctx, 28, 28, 44, 55, 3, '#fffef4');
      round(ctx, 28, 50, 44, 27, 2, '#4b9dc2');
      line(ctx, [[25, 25], [36, 11], [62, 11], [75, 25]], '#267ba7', 7); circle(ctx, 50, 63, 8, '#fff');
    } else if (k === 'flowers') {
      line(ctx, [[50, 86], [50, 34]], '#39774c', 7); line(ctx, [[50, 64], [27, 54]], '#39774c', 7);
      for (let i = 0; i < 5; i++) circle(ctx, 50 + Math.cos(i * 1.256) * 18, 32 + Math.sin(i * 1.256) * 18, 14, '#d85c95');
      circle(ctx, 50, 32, 12, '#f5ca63');
    } else if (k === 'seeds') {
      round(ctx, 18, 13, 64, 77, 8, '#b67c43'); round(ctx, 22, 22, 56, 61, 5, '#f2d28c');
      line(ctx, [[23, 19], [77, 19]], '#806044', 5);
      line(ctx, [[50, 71], [50, 45]], '#39774c', 6);
      round(ctx, 28, 35, 23, 15, 8, '#4d9655'); round(ctx, 50, 28, 23, 15, 8, '#4d9655');
      [32, 48, 65].forEach(x => circle(ctx, x, 77, 3, '#9c692e'));
    } else if (k === 'water') {
      ctx.beginPath(); ctx.arc(50, 43, 28, Math.PI, Math.PI * 2); ctx.strokeStyle = '#326b88'; ctx.lineWidth = 7; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(18, 39); ctx.lineTo(25, 87); ctx.lineTo(75, 87); ctx.lineTo(82, 39); ctx.closePath(); ctx.fillStyle = '#388faf'; ctx.fill();
      round(ctx, 14, 33, 72, 13, 5, '#205e7d'); round(ctx, 22, 35, 56, 6, 3, '#8bd9ed');
      line(ctx, [[32, 53], [36, 75]], '#a1e0ed', 6);
    } else if (k === 'tools' || k === 'repair-tool') {
      line(ctx, [[27, 79], [69, 37]], t, 16); circle(ctx, 69, 29, 20, t); circle(ctx, 77, 20, 15, C.cream); circle(ctx, 27, 79, 5, C.cream);
    } else if (k === 'parcel') {
      round(ctx, 17, 23, 66, 61, 7, t); round(ctx, 44, 23, 13, 61, 1, '#f2d6a5'); line(ctx, [[20, 44], [80, 44]], '#a77d52', 3); round(ctx, 23, 53, 16, 12, 2, '#fff5da');
    } else if (k === 'book') {
      round(ctx, 23, 15, 58, 73, 6, '#5f85bd'); round(ctx, 18, 10, 58, 72, 6, t); line(ctx, [[28, 14], [28, 77]], '#e5edff', 4); line(ctx, [[40, 33], [63, 33]], '#fff', 5); line(ctx, [[40, 44], [59, 44]], '#fff', 4);
    } else if (k === 'icecream') {
      ctx.beginPath(); ctx.moveTo(29, 49); ctx.lineTo(70, 49); ctx.lineTo(50, 91); ctx.closePath(); ctx.fillStyle = '#dca96c'; ctx.fill(); circle(ctx, 50, 39, 25, t); circle(ctx, 50, 19, 13, '#fff2dd');
    } else if (k === 'ball') {
      // Broad curved colour panels read as a toy ball even in a cargo slot.
      circle(ctx, 50, 50, 37, '#5ba5c3');
      ctx.save(); ctx.beginPath(); ctx.arc(50, 50, 37, 0, Math.PI * 2); ctx.clip();
      ctx.beginPath(); ctx.moveTo(50, 13); ctx.bezierCurveTo(22, 30, 22, 70, 50, 87);
      ctx.lineTo(0, 100); ctx.lineTo(0, 0); ctx.closePath(); ctx.fillStyle = '#e97b68'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(50, 13); ctx.bezierCurveTo(78, 30, 78, 70, 50, 87);
      ctx.bezierCurveTo(22, 70, 22, 30, 50, 13); ctx.closePath(); ctx.fillStyle = '#f6ce67'; ctx.fill();
      ctx.strokeStyle = '#567d88'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      ctx.beginPath(); ctx.arc(50, 50, 37, 0, Math.PI * 2); ctx.strokeStyle = '#3e7183'; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(50, 50, 27, -2.55, -1.96); ctx.strokeStyle = '#fff5d9'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();
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

/** A single icon travels in GUI texture coordinates, independent of screen rebuilds. */
class CargoTransfer extends Control {
  constructor() { super('cargo-transfer'); this.isHitTestVisible = false; this.flight = null; }
  clear() { this.flight = null; this._markAsDirty(); }
  tick(dt) {
    if (!this.flight) return;
    this.flight.time += dt;
    if (this.flight.time >= .45) this.clear(); else this._markAsDirty();
  }
  _draw(ctx) {
    const f = this.flight;
    if (!f) return;
    const t = Math.min(1, f.time / .45), ease = t * t * (3 - 2 * t);
    const x = f.from.x + (f.to.x - f.from.x) * ease + (f.kind === 'reject' ? Math.sin(t * Math.PI * 4) * 12 * (1-t) : 0);
    const y = f.from.y + (f.to.y - f.from.y) * ease - Math.sin(Math.PI * t) * f.arc;
    const size = f.from.size + (f.to.size - f.from.size) * ease;
    ctx.save();
    circle(ctx, x, y, size * .56, '#fffaf0');
    ToyIcon.prototype._draw.call({ kind: f.goodId, tint: goods[f.goodId]?.color || C.teal,
      _currentMeasure: { left: x - size / 2, top: y - size / 2, width: size, height: size } }, ctx);
    ctx.restore();
  }
}

function position(control, x, y, width, height) {
  control.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  control.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  control.left = `${x}px`; control.top = `${y}px`; control.width = `${width}px`; control.height = `${height}px`;
  return control;
}


// CSS-sized compact controls keep phone touch targets independent of town scaling.
export function computeUILayout(width, height) {
  const compact = height < 600;
  const scale = compact ? 1 : height / H;
  const panelWidth = compact ? Math.min(288, width * .46) : PANEL_WIDTH * scale;
  const logicalHeight = compact ? height : H;
  const innerWidth = compact ? panelWidth - 16 : 272;
  const contentHeight = compact ? height - 64 : 708;
  const slotSize = compact ? (height < 360 ? 44 : 48) : 72;
  // Leave rounding room at the engine's 1.25 render scale: visible gap stays >=6 CSS px.
  const gap = compact && height < 360 ? 7 : 8;
  const footerY = contentHeight - 44;
  const cargoY = footerY - 8 - slotSize * 2 - gap;
  return { compact, scale, panelWidth, logicalHeight, innerWidth, contentHeight,
    slotSize, gap, footerY, cargoY, choiceHeight: Math.min(70, (cargoY - 16) / 2),
    worldRect: { x: 0, y: 0, width: Math.max(0, width - panelWidth), height },
    panelRect: { x: Math.max(0, width - panelWidth), y: 0, width: panelWidth, height } };
}
const PANEL_WIDTH = 320;

export function createUI(scene, callbacks = {}) {
  const { onCommand = () => {}, onSpeak = () => {}, onSound = () => {}, onModelPreview = () => {}, onReducedMotion = () => {}, onNewSession = () => {} } = callbacks;
  const WORLD_W = 860, PANEL_W = W - WORLD_W, CARD_W = PANEL_W - 24;
  const texture = AdvancedDynamicTexture.CreateFullscreenUI('town-ui', true, scene);
  texture.useSmallestIdeal = false;
  const engine = scene.getEngine(), canvas = engine.getRenderingCanvas();
  let layout = computeUILayout(W, H);
  const fitTexture = () => {
    const rect = canvas?.getBoundingClientRect();
    layout = computeUILayout(rect?.width || W, rect?.height || H);
    texture.idealWidth = 0;
    texture.idealHeight = layout.logicalHeight;
  };
  fitTexture();
  const resizeObserver = engine.onResizeObservable.add(() => { fitTexture(); clearCargoTransfer(); rebuild(); });
  texture.rootContainer.isPointerBlocker = false;
  let screen, frame, lastState = null, panel = null, priorPaused = false;
  let mode = 'loading', loadingState = { progress: 0, text: '小镇正在准备，请稍等一会儿。' };
  let sound = true, reducedMotion = false, chosenDifficulty = 'easy', lastSignature = '';
  let disposed = false, orientationBlocked = false;
  let modelIcons = new Map();
  let modelCategory = 'vehicle', modelIndex = 0, modelZoom = 1;
  const selectedModels = () => MODEL_CATALOG.filter(model => model.category === modelCategory);
  const selectedModel = () => selectedModels()[modelIndex] || selectedModels()[0];
  const buttons = new Map(), armed = new Set();
  const cargoIcons = new Map();
  let visibleTexts = [], visibleImages = [], visibleSlots = [], visibleCards = [];
  const cargoTransfer = new CargoTransfer();
  cargoTransfer.width = '100%'; cargoTransfer.height = '100%'; cargoTransfer.zIndex = 101;
  texture.addControl(cargoTransfer);
  let cargoPending = null, cargoLanding = null;
  let loadingSlots = [], requestedUnloadSlot = null;
  const sparkles = new ClickSparkles();
  sparkles.width = '100%'; sparkles.height = '100%'; sparkles.zIndex = 100;
  texture.addControl(sparkles);
  const cancelPress = () => {
    armed.clear();
    for (const b of buttons.values()) { b.background = b._townBaseFill; b.shadowOffsetY = 3; }
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
        armed.delete(b); b.background = b._townBaseFill; b.shadowOffsetY = 3;
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
    if (!orientationBlocked && !lastState?.paused && !reducedMotion) {
      const dt = Math.min(engine.getDeltaTime() / 1000, .05);
      sparkles.tick(dt);
      if (cargoPending) {
        const destination = cargoIcons.get(cargoPending.target), to = iconPoint(destination);
        if (to) {
          cargoLanding = destination; cargoLanding.alpha = 0;
          cargoTransfer.flight = { ...cargoPending, to, time: 0, arc: Math.min(30 * (texture.idealRatio || 1), Math.abs(to.y - cargoPending.from.y) * .18) };
          cargoPending = null; cargoTransfer._markAsDirty();
        }
      } else cargoTransfer.tick(dt);
      if (!cargoPending && !cargoTransfer.flight) {
        if (cargoLanding) cargoLanding.alpha = 1;
        cargoLanding = null; lockCargo(false);
      }
    }
  });

  function box(parent, name, x, y, w, h, background = C.cream, radius = 20) {
    const r = position(new Rectangle(name), x, y, w, h);
    r.background = background; r.thickness = 0; r.cornerRadius = radius; r.isHitTestVisible = false;
    parent.addControl(r); if (/instruction-|shelf-|destination-|place-/.test(name)) visibleCards.push({ id: name, control: r }); return r;
  }
  function text(parent, words, x, y, w, h, size = 24, color = C.ink, align = 'left', bold = false) {
    const t = position(new TextBlock(`text-${String(words).slice(0, 16)}`, words), x, y, w, h);
    t.color = color; t.fontSize = size; t.fontFamily = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
    t.fontWeight = bold ? '700' : '500'; t.textWrapping = true; t.wordDivider = ''; t.lineSpacing = '3px';
    t.textHorizontalAlignment = align === 'center' ? Control.HORIZONTAL_ALIGNMENT_CENTER : Control.HORIZONTAL_ALIGNMENT_LEFT;
    t.isHitTestVisible = false; parent.addControl(t); visibleTexts.push(t); return t;
  }
  function icon(parent, kind, x, y, size, tint) { const a = position(new ToyIcon(kind, tint, modelIcons.get(kind)), x, y, size, size); parent.addControl(a); visibleImages.push({ kind, control: a }); return a; }
  function button(parent, id, label, x, y, w, h, action, options = {}) {
    const b = position(new Button(id), x, y, w, h);
    b.cornerRadius = options.radius ?? (layout.compact ? 12 : 18); b.thickness = 2;
    b.color = options.outline || '#8eafa1'; b.background = options.fill || C.mint;
    b._townBaseFill = b.background;
    b.shadowColor = '#4a675e45'; b.shadowBlur = 0; b.shadowOffsetY = 3;
    b.isPointerBlocker = true; b.isEnabled = options.enabled !== false;
    b.disabledColor = '#e4e5dd'; b.alpha = b.isEnabled ? 1 : .65;
    b.pointerEnterAnimation = b.pointerOutAnimation = b.pointerDownAnimation = b.pointerUpAnimation = () => {};
    const iconSize = options.iconOnly ? (layout.compact ? 28 : 38) : w < 180 ? 28 : 36;
    if (options.icon) icon(b, options.icon, options.iconOnly ? (w - iconSize) / 2 : 10, (h - iconSize) / 2, iconSize, options.ink);
    if (label) {
      const inset = options.icon ? iconSize + 16 : 8;
      text(b, label, inset, 0, w - inset - 8, h, options.size || 24, options.ink || C.ink, options.icon ? 'left' : 'center', true);
    }
    b.onPointerDownObservable.add((_, event) => {
      if (orientationBlocked || event.userInfo?.event?.isPrimary === false) return;
      armed.add(b); b.background = options.pressedFill || '#b9d6c2'; b.shadowOffsetY = 1;
    });
    b.onPointerOutObservable.add(() => { armed.delete(b); b.background = b._townBaseFill; b.shadowOffsetY = 3; });
    b.onPointerUpObservable.add(() => { armed.delete(b); b.background = b._townBaseFill; b.shadowOffsetY = 3; });
    b.onPointerClickObservable.add(() => {
      if (!armed.has(b) || disposed || orientationBlocked || !b.isEnabled) return;
      armed.delete(b);
      if (!reducedMotion && !lastState?.paused) { const m = b._currentMeasure; sparkles.add(m.left + m.width / 2, m.top + m.height / 2); }
      action();
    });
    parent.addControl(b); buttons.set(id, b); return b;
  }
  function iconPoint(control) {
    const m = control?._currentMeasure;
    return m?.width > 0 && m.height > 0 ? { x: m.left + m.width / 2, y: m.top + m.height / 2, size: Math.min(m.width, m.height) } : null;
  }
  function lockCargo(locked) {
    for (const [id, b] of buttons) if (/^(load-|cargo-slot-|deliver-)/.test(id)) {
      b.isEnabled = !locked; b.alpha = locked ? .82 : 1;
    }
  }
  function clearCargoTransfer() {
    cargoPending = null; cargoTransfer.clear();
    if (cargoLanding && !cargoLanding.isDisposed) cargoLanding.alpha = 1;
    cargoLanding = null; lockCargo(false);
  }
  function cargoCapacity(state = lastState) {
    return Math.min(6, Math.max(1, state?.capacity ?? state?.vehicleCapacity ?? (cars[state?.vehicleId]?.capacity || 1) + (state?.capacityBonus || 0)));
  }
  function syncCargoSlots(state) {
    const capacity = cargoCapacity(state);
    if (lastState?.seed !== state.seed || lastState?.vehicleId !== state.vehicleId) loadingSlots = [];
    loadingSlots = Array.from({ length: capacity }, (_, i) => loadingSlots[i] || null);
    const remaining = new Map(state.cargo.map(item => [item.goodId, item.quantity]));
    if (requestedUnloadSlot !== null) {
      const goodId = loadingSlots[requestedUnloadSlot];
      const before = lastState?.cargo.find(item => item.goodId === goodId)?.quantity || 0;
      if ((remaining.get(goodId) || 0) === before - 1) loadingSlots[requestedUnloadSlot] = null;
    }
    for (let i = 0; i < loadingSlots.length; i++) {
      const goodId = loadingSlots[i], count = remaining.get(goodId) || 0;
      if (count > 0) remaining.set(goodId, count - 1); else loadingSlots[i] = null;
    }
    for (const [goodId, count] of remaining) for (let n = 0; n < count; n++) {
      const empty = loadingSlots.indexOf(null); if (empty >= 0) loadingSlots[empty] = goodId;
    }
  }
  function startFlight(flight) {
    cargoTransfer.flight = { ...flight, time: 0, arc: flight.kind === 'reject' ? 0 : Math.min(38 * (texture.idealRatio || 1), Math.abs(flight.to.y - flight.from.y) * .18) };
    cargoTransfer._markAsDirty(); lockCargo(true);
  }
  function changeCargo(type, goodId, source, slotIndex = null) {
    if (cargoPending || cargoTransfer.flight || lastState?.paused) return;
    const before = lastState.cargo.reduce((n, item) => n + item.quantity, 0);
    const oldQuantity = lastState.cargo.find(item => item.goodId === goodId)?.quantity || 0;
    const from = iconPoint(source), deliveryTarget = iconPoint(cargoIcons.get('delivery-place'));
    const emptySlot = loadingSlots.indexOf(null);
    requestedUnloadSlot = slotIndex;
    send(type, { goodId }); // Only accepted state deltas cause a goods transfer.
    requestedUnloadSlot = null;
    const after = lastState.cargo.reduce((n, item) => n + item.quantity, 0);
    const newQuantity = lastState.cargo.find(item => item.goodId === goodId)?.quantity || 0;
    const delta = type === 'LOAD' ? 1 : -1;
    if (!from || reducedMotion) return;
    if (after !== before + delta || newQuantity !== oldQuantity + delta) {
      const sourceId = type === 'LOAD' ? `load-${goodId}` : `${type === 'DELIVER' ? 'deliver-slot' : 'cargo-slot'}-${goodId}-${slotIndex}`;
      cargoLanding = cargoIcons.get(sourceId) || source;
      if (cargoLanding) cargoLanding.alpha = 0;
      startFlight({ kind: 'reject', goodId, from, to: from }); return;
    }
    if (type === 'DELIVER' && deliveryTarget) {
      startFlight({ kind: 'deliver', goodId, from, to: { ...deliveryTarget, size: from.size * .55 } }); return;
    }
    const target = type === 'LOAD' ? `cargo-slot-${goodId}-${emptySlot}` : `load-${goodId}`;
    cargoPending = { kind: type.toLowerCase(), goodId, from, target };
    lockCargo(true);
  }
  function send(type, payload = {}) { if (!orientationBlocked) onCommand({ type, ...payload }); }
  function openPanel(nextPanel) {
    // Preserve the pause state from before the first panel, including when the
    // task reminder switches to the destination picker.
    clearCargoTransfer();
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
    buttons.clear(); cargoIcons.clear();
    visibleTexts = []; visibleImages = []; visibleSlots = []; visibleCards = [];
    screen = new Container('ui-screen'); screen.width = '100%'; screen.height = '100%'; screen.zIndex = 1;
    screen.isHitTestVisible = false; texture.addControl(screen);
    frame = new Container('ui-frame'); frame.width = `${layout.compact ? layout.panelWidth : W}px`; frame.height = `${layout.logicalHeight}px`;
    frame.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT; frame.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
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
    for (let i = 0; i < 3; i++) { const dot = box(bg, `round-dot-${i}`, 20 + i * 30, 40, 16, 16, i <= (lastState?.round ?? -1) ? C.teal : '#dce7da', 8); dot.isHitTestVisible = false; }
    if (close) button(bg, 'close', '继续', 164, 12, 144, 72, closePanel, { icon: 'close' });
    else if (utilities) {
      button(bg, 'settings', '', 156, 12, 72, 72, () => openPanel('settings'), { icon: 'settings', iconOnly: true });
      button(bg, 'pause', '', 236, 12, 72, 72, () => send('PAUSE', { value: true }), { icon: 'pause', iconOnly: true, fill: '#f4e2c7' });
    }
    return box(bg, 'panel-content', 12, 100, CARD_W, 708, '#f6f3e8', 22);
  }
  function helpButton(card, y = 620, width = 272) {
    button(card, 'hint', '再看', 12, y, width, 72, () => openPanel('hint'), { icon: 'hint', size: 26 });
  }
  function missionRows(parent, y = 64) {
    const grouped = new Map();
    (lastState.mission?.steps || []).forEach((step, i) => {
      if (!grouped.has(step.placeId)) grouped.set(step.placeId, []);
      grouped.get(step.placeId).push({ ...step, complete: lastState.completed?.includes(i), delivered: lastState.delivered?.[i] || 0 });
    });
    const groups = [...grouped.entries()];
    groups.slice(0, 2).forEach(([placeId, steps], i) => {
      const units = steps.flatMap(step => Array.from({ length: Math.min(2, step.quantity) }, (_, unitIndex) => ({
        ...step, complete: step.complete || unitIndex < step.delivered,
      })));
      const height = groups.length === 1 ? 354 : 228;
      const row = box(parent, `instruction-${i}`, 12, y + i * 240, 272, height, '#e7eddf', 18);
      const unitGap = units.length > 1 ? 134 : 0, firstY = units.length > 1 ? (height - 256) / 2 : (height - 122) / 2;
      units.slice(0, 2).forEach((unit, n) => {
        icon(row, unit.goodId, 4, firstY + n * unitGap, 88);
        text(row, shortName(unit.goodId), 0, firstY + n * unitGap + 88, 96, 34, 25, C.ink, 'center', true);
        if (unit.complete) icon(row, 'check', 64, firstY + n * unitGap, 28, C.teal);
      });
      icon(row, 'arrow', 98, height / 2 - 20, 36, C.teal);
      icon(row, placeId, 140, height / 2 - 72, 120);
      text(row, shortName(placeId), 138, height / 2 + 52, 124, 40, 28, C.ink, 'center', true);
    });
  }
  function brief(isHint = false) {
    const card = sidebar({ close: isHint });
    text(card, isHint ? '再看' : '记一记', 12, 4, 272, 50, 30, C.ink, 'center', true);
    missionRows(card);
    button(card, 'listen', '再听', 12, 536, 272, 68, () => onSpeak(), { icon: 'listen', size: 26 });
    button(card, isHint ? 'close-hint' : 'ack', isHint ? '继续' : '记住了', 12, 620, 272, 72, () => isHint ? closePanel() : send('ACK_BRIEF'), { fill: C.teal, ink: C.white, size: 27 });
  }
  function capacitySlots(parent, capacity, x, y, size, gap, cargo = [], interaction = null) {
    const packed = interaction === 'preview' ? [] : loadingSlots;
    for (let i = 0; i < Math.min(6, capacity); i++) {
      const goodId = packed[i] || null;
      const id = `${interaction === 'deliver' ? 'deliver-slot' : 'cargo-slot'}-${goodId || 'empty'}-${i}`;
      let art;
      const clickable = !!goodId && (interaction === 'load' || interaction === 'deliver');
      const cell = clickable
        ? button(parent, id, '', x + (i % 3) * (size + gap), y + Math.floor(i / 3) * (size + gap), size, size,
          () => changeCargo(interaction === 'deliver' ? 'DELIVER' : 'UNLOAD', goodId, art, i), { fill: '#d7e8d3', outline: C.teal, radius: 12 })
        : box(parent, `capacity-slot-${i}`, x + (i % 3) * (size + gap), y + Math.floor(i / 3) * (size + gap), size, size, goodId ? '#d7e8d3' : '#fffaf0', 12);
      cell.thickness = clickable ? 2 : 1; cell.color = clickable ? C.teal : '#b9c7b5';
      if (!clickable && interaction !== 'preview') cell.background = goodId ? '#e6eadf' : '#f4f4e9';
      if (goodId) {
        art = icon(cell, goodId, 3, 3, size - 6); cargoIcons.set(id, art);
        if (interaction === 'deliver' && !buttons.has(`deliver-${goodId}`)) buttons.set(`deliver-${goodId}`, cell);
      }
      if (interaction !== 'preview') visibleSlots.push({ index: i, goodId, mode: interaction || 'read', clickable, control: cell });
    }
  }
  function cargoGrid(card, interaction = null) {
    capacitySlots(card, cargoCapacity(), 30, 350, 72, 10, lastState.cargo, interaction);
    if (cargoPending || cargoTransfer.flight) lockCargo(true);
  }
  function feedback(card, fallback = '') {
    const label = feedbackLabels[lastState.feedbackCode] || fallback;
    if (label) text(card, label, 12, 272, 272, 44, 28, C.teal, 'center', true);
  }
  function vehiclePicker() {
    const options = (lastState.mission?.vehicleChoices || []).map(id => cars[id]).filter(Boolean).slice(0, 2);
    const card = sidebar();
    text(card, '选小车', 12, 4, 272, 50, 30, C.ink, 'center', true);
    options.forEach((car, i) => {
      const b = button(card, `vehicle-${car.id}`, '', 12, 64 + i * 272, 272, 260, () => send('SELECT_VEHICLE', { vehicleId: car.id }), { fill: '#ece8d8' });
      icon(b, car.id, 64, 0, 144);
      text(b, shortName(car.id), 4, 144, 264, 38, 28, C.ink, 'center', true);
      const capacity = lastState.capacityBonus < 0 ? 1 : Math.max(1, car.capacity + (lastState.capacityBonus || 0));
      capacitySlots(b, capacity, 76, 184, 32, 8, [], 'preview');
    });
    helpButton(card);
  }
  function shelf() {
    const state = lastState, card = sidebar();
    text(card, '装货', 12, 2, 272, 42, 28, C.ink, 'center', true);
    const choices = (state.shelf || state.mission?.shelfChoices || state.mission?.shelf || []).slice(0, 4);
    choices.forEach((id, i) => {
      const tile = box(card, `shelf-${id}`, 12 + (i % 2) * 140, 48 + Math.floor(i / 2) * 140, 132, 132, '#eee9d9', 16);
      let art;
      const load = button(tile, `load-${id}`, '', 0, 0, 132, 132, () => changeCargo('LOAD', id, art), { fill: '#eee9d9' });
      art = icon(load, id, 18, 0, 96); cargoIcons.set(`load-${id}`, art);
      text(load, shortName(id), 4, 96, 124, 36, 26, C.ink, 'center', true);
    });
    cargoGrid(card, 'load');
    text(card, feedbackLabels[state.feedbackCode] || '', 12, 524, 272, 46, 27, C.teal, 'center', true);
    helpButton(card, 620, 132);
    button(card, 'depart', '出发', 152, 620, 132, 72, () => send('DEPART'), { fill: C.teal, ink: C.white, size: 27 });
  }
  function getLayout() {
    const rect = canvas?.getBoundingClientRect();
    const current = computeUILayout(rect?.width || 0, rect?.height || 0);
    // CSS pixels relative to the drawable canvas, after the body's safe area.
    return { worldRect: current.worldRect, panelRect: current.panelRect,
      scale: { x: current.scale, y: current.scale }, compact: current.compact,
      logical: { width: (rect?.width || 0) / current.scale, height: current.logicalHeight,
        worldWidth: current.worldRect.width / current.scale } };
  }
  function destinationOptions() {
    const state = lastState;
    const required = [...new Set((state.mission?.steps || []).filter((_, i) => !state.completed?.includes(i)).map(step => step.placeId))];
    const supplied = state.mission?.destinationChoices || [];
    const choices = [...new Set([...supplied, ...required])].filter(id => id !== 'depot' && places[id]);
    // Keep every pending task destination, without communicating which cards they are.
    while (choices.length > 4) { let index = choices.length - 1; while (index >= 0 && required.includes(choices[index])) index--; if (index < 0) break; choices.splice(index, 1); }
    for (const place of PLACES) if (choices.length < 4 && place.id !== 'depot' && !choices.includes(place.id)) choices.push(place.id);
    // Stable catalogue order prevents the fallback insertion order revealing the answers.
    return PLACES.filter(place => choices.includes(place.id)).slice(0, 4);
  }
  function destinationCards(card, prefix, y, onSelect) {
    destinationOptions().forEach((place, i) => {
      const b = button(card, `${prefix}-${place.id}`, '', 12 + (i % 2) * 140, y + Math.floor(i / 2) * 144,
        132, 136, () => onSelect(place.id), { fill: '#e4eddf', radius: 16 });
      visibleCards.push({ id: `${prefix}-${place.id}`, control: b });
      icon(b, place.id, 14, 0, 104);
      text(b, shortName(place.id), 3, 102, 126, 34, 26, C.ink, 'center', true);
    });
  }
  function depotButton(card, x = 12, y = 534, width = 272, action = () => send('TRAVEL', { placeId: 'depot' })) {
    button(card, 'return-depot', '回仓库', x, y, width, 72, action, { size: 25 });
  }
  function exploreHUD() {
    const card = sidebar();
    text(card, '选地点', 12, 0, 272, 40, 29, C.ink, 'center', true);
    destinationCards(card, 'place', 44, id => send('TRAVEL', { placeId: id }));
    cargoGrid(card);
    text(card, feedbackLabels[lastState.feedbackCode] || '', 12, 506, 272, 26, 23, C.teal, 'center', true);
    depotButton(card);
    helpButton(card);
  }
  function drivingHUD() {
    const s = lastState, card = sidebar();
    const delivered = s.phase === 'delivery';
    text(card, delivered ? '到站啦' : '在路上', 12, 4, 272, 48, 30, C.ink, 'center', true);
    // This is the place actually reached, never an undisclosed mission answer.
    const actualPlace = delivered ? s.location : s.currentDestination;
    if (actualPlace) {
      const art = icon(card, actualPlace, 68, 72, 160); cargoIcons.set('delivery-place', art);
      text(card, shortName(actualPlace), 12, 232, 272, 38, 28, C.ink, 'center', true);
    } else icon(card, s.vehicleId || 'car', 68, 88, 160);
    feedback(card, delivered ? '点货格' : '慢慢来');
    cargoGrid(card, delivered ? 'deliver' : null);
    if (delivered) {
      button(card, 'destinations', '换地点', 12, 534, 132, 72, () => openPanel('destinations'), { size: 25 });
      depotButton(card, 152, 534, 132);
    }
    helpButton(card);
  }
  function destinations() {
    const card = sidebar({ close: true });
    text(card, '换地点', 12, 0, 272, 40, 29, C.ink, 'center', true);
    const travel = id => {
      panel = null;
      if (!priorPaused) send('PAUSE', { value: false });
      send('TRAVEL', { placeId: id }); rebuild();
    };
    destinationCards(card, 'destination', 44, travel);
    cargoGrid(card);
    depotButton(card, 12, 534, 272, () => travel('depot'));
    button(card, 'close-hint', '继续', 12, 620, 272, 72, closePanel, { fill: C.teal, ink: C.white });
  }
  function eventCard() {
    const e = lastState.event, card = sidebar();
    const labels = { repair: '修一修', shortage: '补货啦', capacity: '装货格', roadworks: '修路啦' };
    text(card, labels[e?.id] || '想办法', 12, 6, 272, 52, 30, C.ink, 'center', true);
    icon(card, e?.id === 'repair' ? 'repair-tool' : e?.id === 'shortage' ? 'parcel' : 'car', 62, 80, 172, C.orange);
    if (e?.id === 'repair') for (let i = 0; i < 3; i++) box(card, `pump-dot-${i}`, 96 + i * 36, 274, 18, 18, i < (e.progress || 0) ? C.teal : '#cbd7c4', 9);
    button(card, 'event-listen', '再听', 12, 322, 272, 72, () => onSpeak('event'), { icon: 'listen', size: 26 });
    const optionLabels = { detour: '绕一绕', reopen: '开便道', trailer: '拖车', 'two-trips': '分次送', reserve: '备用箱', pickup: '去车库', pump: '打气', helper: '找朋友' };
    (e?.options || []).forEach((opt, i) => button(card, `event-${opt.id}`, optionLabels[opt.id] || '继续', 12, 430 + i * 104, 272, 88, () => send('RESOLVE_EVENT', { optionId: opt.id }), { fill: i ? C.mint : C.teal, ink: i ? C.ink : C.white, size: 28 }));
  }
  function reward(isSession = false) {
    const card = sidebar();
    text(card, '谢谢你', 12, 4, 272, 48, 30, C.ink, 'center', true);
    // Keep the actual current building visible where the last goods icon lands.
    if (places[lastState.location]) {
      icon(card, lastState.location, 68, 72, 160);
      text(card, shortName(lastState.location), 12, 232, 272, 38, 28, C.ink, 'center', true);
    }
    icon(card, 'star', 90, 310, 116, C.yellow);
    for (let i = 0; i < 3; i++) box(card, `reward-dot-${i}`, 96 + i * 36, 464, 18, 18, i <= lastState.round ? C.teal : '#cbd7c4', 9);
    button(card, isSession ? 'new-session' : 'next', isSession ? '再出发' : '继续', 12, 620, 272, 72, () => isSession ? onNewSession(lastState.difficulty) : send('NEXT'), { fill: C.teal, ink: C.white, size: 28 });
  }
  function paused() {
    const card = sidebar({ utilities: false });
    text(card, '歇一歇', 12, 8, 272, 54, 30, C.ink, 'center', true);
    icon(card, lastState.vehicleId || 'car', 62, 170, 172);
    button(card, 'resume', '继续', 12, 620, 272, 72, () => send('PAUSE', { value: false }), { fill: C.teal, ink: C.white, size: 28 });
  }
  function settings() {
    const card = sidebar({ close: true });
    text(card, '设置', 12, 0, 272, 48, 30, C.ink, 'center', true);
    DIFFICULTIES.forEach((d, i) => {
      const selected = chosenDifficulty === d.id;
      const b = button(card, `difficulty-${d.id}`, '', 12, 54 + i * 100, 272, 92, () => { chosenDifficulty = d.id; rebuild(); }, { fill: selected ? '#cde3cd' : '#e9e9db', outline: selected ? C.teal : null });
      text(b, d.name, 4, 0, 72, 92, 26, C.ink, 'center', true);
      icon(b, 'bread', 78, i ? 2 : 24, 44);
      if (i) icon(b, 'apple', 78, 46, 44);
      icon(b, 'arrow', 128, 32, 28, C.teal);
      icon(b, 'school', 162, i === 2 ? 0 : 18, 56);
      if (i === 2) icon(b, 'park', 210, 38, 50);
    });
    const soundButton = button(card, 'setting-sound', '声音', 12, 366, 132, 68, () => { sound = !sound; onSound(sound); rebuild(); }, { icon: sound ? 'sound' : 'close', fill: sound ? '#cde3cd' : C.mint, size: 25 });
    buttons.set('sound', soundButton);
    button(card, 'reduced-motion', '轻柔', 152, 366, 132, 68, () => { reducedMotion = !reducedMotion; if (reducedMotion) { clearCargoTransfer(); sparkles.bursts = []; sparkles._markAsDirty(); } onReducedMotion(reducedMotion); rebuild(); }, { icon: reducedMotion ? 'check' : 'close', fill: reducedMotion ? '#cde3cd' : C.mint, size: 25 });
    button(card, 'model-viewer', '图鉴', 12, 450, 272, 68, () => openPanel('models'), { size: 27 });
    button(card, 'new-session', '再出发', 12, 534, 272, 72, () => { panel = null; onNewSession(chosenDifficulty); rebuild(); }, { fill: C.teal, ink: C.white, size: 27 });
    button(card, 'back-to-town', '继续', 12, 620, 272, 72, closePanel, { size: 27 });
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
    text(card, model.packLabel.replaceAll(' + ', ' +\n'), 12, 250, 272, 62, 23, C.muted);
    // Keep the visible caption to one complete descriptive sentence. Full
    // original-file provenance remains in the catalog and resource documents.
    // A dedicated clipped region prevents long source notes drawing over controls.
    const description=position(new Container('model-description'),12,316,272,118);
    description.isHitTestVisible=false;description.clipChildren=true;card.addControl(description);
    text(description, model.details.split('。')[0]+'。', 0, 0, 272, 118, 22, C.muted);
    const step = delta => {modelIndex=(modelIndex+delta+list.length)%list.length;modelZoom=1;rebuild();};
    button(card, 'model-previous', '上一个', 12, 440, 132, 64, ()=>step(-1), {size:23});
    button(card, 'model-next', '下一个', 152, 440, 132, 64, ()=>step(1), {size:23});
    const zoom = delta => {modelZoom=Math.max(.65,Math.min(1.6,Math.round((modelZoom+delta)*100)/100));rebuild();};
    button(card, 'model-zoom-out', '缩小 −', 12, 516, 132, 64, ()=>zoom(-.15), {enabled:modelZoom>.65,size:23});
    button(card, 'model-zoom-in', '放大 ＋', 152, 516, 132, 64, ()=>zoom(.15), {enabled:modelZoom<1.6,size:23});
    text(card, `45°斜俯视 · ${Math.round(modelZoom*100)}%`, 12, 588, 272, 32, 22, C.muted, 'center');
    button(card, 'model-back', '返回设置', 12, 628, 272, 64, ()=>openPanel('settings'), {size:24});
  }
  function landing() {
    const card = sidebar({ utilities: false });
    text(card, '小车镇', 12, 8, 272, 54, 32, C.teal, 'center', true);
    icon(card, 'car', 48, 150, 200, C.orange);
    if (mode === 'ready') {
      icon(card, 'check', 114, 418, 68, C.teal);
      button(card, 'start', '出发', 12, 596, 272, 96, () => { mode = 'game'; send('START'); rebuild(); }, { fill: C.teal, ink: C.white, size: 30 });
    } else {
      const progress = Math.max(0, Math.min(1, Number(loadingState.progress) || 0));
      text(card, loadingState.error ? '再试试' : '准备中', 12, 414, 272, 60, 28, C.muted, 'center', true);
      box(card, 'progress-track', 20, 530, 256, 20, '#e0e5d5', 10);
      if (progress > 0) box(card, 'progress-fill', 20, 530, Math.max(20, 256 * progress), 20, C.teal, 10);
      if (loadingState.error) button(card, 'retry', '再试试', 12, 610, 272, 82, () => send('RETRY_LOAD'), { fill: C.teal, ink: C.white });
    }
  }
  function compactSidebar(heading, { close = false, utilities = true } = {}) {
    const bg = box(frame, 'operation-panel', 0, 0, layout.panelWidth, layout.logicalHeight, C.cream, 0);
    bg.isHitTestVisible = true; bg.isPointerBlocker = true;
    text(bg, heading, 8, 4, layout.panelWidth - (close ? 64 : utilities ? 112 : 16), 44, 24, C.ink, 'left', true);
    if (close) button(bg, 'close', '', layout.panelWidth - 52, 4, 44, 44, closePanel, { icon: 'close', iconOnly: true });
    else if (utilities) {
      button(bg, 'settings', '', layout.panelWidth - 104, 4, 44, 44, () => openPanel('settings'), { icon: 'settings', iconOnly: true });
      button(bg, 'pause', '', layout.panelWidth - 52, 4, 44, 44, () => send('PAUSE', { value: true }), { icon: 'pause', iconOnly: true, fill: '#f4e2c7' });
    }
    return box(bg, 'panel-content', 8, 56, layout.innerWidth, layout.contentHeight, '#f6f3e8', 12);
  }
  function compactAction(parent, id, label, x, y, width, action, primary = false, options = {}) {
    return button(parent, id, label, x, y, width, 44, action, {
      size: Math.min(21, Math.floor((width - 16) / Math.max(1, label.length))), fill: primary ? C.teal : C.mint, ink: primary ? C.white : C.ink, ...options,
    });
  }
  function compactFooter(card, actions) {
    const gap = 8, width = (layout.innerWidth - gap * (actions.length - 1)) / actions.length;
    actions.forEach((action, i) => compactAction(card, action.id, action.label, i * (width + gap), layout.footerY, width, action.run, action.primary));
  }
  const compactHint = () => ({ id: 'hint', label: '再看', run: () => openPanel('hint') });
  function compactCargo(card, interaction = null) {
    const size = layout.slotSize, gap = layout.gap, width = size * 3 + gap * 2;
    capacitySlots(card, cargoCapacity(), (layout.innerWidth - width) / 2, layout.cargoY, size, gap, lastState.cargo, interaction);
    if (cargoPending || cargoTransfer.flight) lockCargo(true);
  }
  function compactChoices(card, entries, prefix, onSelect, shelfMode = false) {
    const gap = 8, width = (layout.innerWidth - gap) / 2, height = layout.choiceHeight;
    const artSize = Math.min(50, height - 6);
    entries.forEach((entry, i) => {
      const id = typeof entry === 'string' ? entry : entry.id;
      let art;
      const b = button(card, `${prefix}-${id}`, '', (i % 2) * (width + gap), Math.floor(i / 2) * (height + gap), width, height,
        () => shelfMode ? changeCargo('LOAD', id, art) : onSelect(id), { fill: shelfMode ? '#eee9d9' : '#e4eddf' });
      visibleCards.push({ id: `${shelfMode ? 'shelf' : prefix}-${id}`, control: b });
      art = icon(b, id, 5, (height - artSize) / 2, artSize);
      text(b, shortName(id), artSize + 10, 0, width - artSize - 15, height, Math.min(20, Math.floor((width - artSize - 15) / Math.max(1, shortName(id).length))), C.ink, 'center', true);
      if (shelfMode) cargoIcons.set(`load-${id}`, art);
    });
  }
  function compactBrief(isHint = false) {
    const card = compactSidebar(isHint ? '再看' : '记一记', { close: isHint });
    const grouped = new Map();
    (lastState.mission?.steps || []).forEach((step, index) => {
      if (!grouped.has(step.placeId)) grouped.set(step.placeId, []);
      for (let n = 0; n < Math.min(2, step.quantity); n++) grouped.get(step.placeId).push({ goodId: step.goodId,
        complete: lastState.completed?.includes(index) || n < (lastState.delivered?.[index] || 0) });
    });
    const groups = [...grouped.entries()].slice(0, 2), gap = 8;
    const height = (layout.footerY - 8 - gap * (groups.length - 1)) / groups.length;
    groups.forEach(([placeId, units], i) => {
      const row = box(card, `instruction-${i}`, 0, i * (height + gap), layout.innerWidth, height, '#e7eddf', 12);
      const itemSize = Math.min(76, height / Math.max(1, units.length) - 28);
      const itemGap = 28, totalHeight = units.length * (itemSize + itemGap), y = (height - totalHeight) / 2;
      units.slice(0, 2).forEach((unit, n) => {
        const top = y + n * (itemSize + itemGap);
        icon(row, unit.goodId, 12, top, itemSize);
        text(row, shortName(unit.goodId), 4, top + itemSize, itemSize + 16, 22, 19, C.ink, 'center', true);
        if (unit.complete) icon(row, 'check', itemSize - 4, top, 22, C.teal);
      });
      const placeSize = Math.min(112, height - 32), left = layout.innerWidth - placeSize - 8;
      icon(row, 'arrow', (12 + itemSize + left - 24) / 2, height / 2 - 12, 24, C.teal);
      icon(row, placeId, left, (height - placeSize - 24) / 2, placeSize);
      text(row, shortName(placeId), left - 4, (height + placeSize - 24) / 2, placeSize + 8, 24, 21, C.ink, 'center', true);
    });
    compactFooter(card, [
      { id: 'listen', label: '再听', run: () => onSpeak() },
      { id: isHint ? 'close-hint' : 'ack', label: isHint ? '继续' : '记住了', run: () => isHint ? closePanel() : send('ACK_BRIEF'), primary: true },
    ]);
  }
  function compactVehicles() {
    const card = compactSidebar('选小车');
    const options = (lastState.mission?.vehicleChoices || []).map(id => cars[id]).filter(Boolean).slice(0, 2);
    const gap = 8, height = Math.min(128, (layout.footerY - 8 - gap) / 2);
    options.forEach((car, i) => {
      const b = button(card, `vehicle-${car.id}`, '', 0, i * (height + gap), layout.innerWidth, height,
        () => send('SELECT_VEHICLE', { vehicleId: car.id }), { fill: '#ece8d8' });
      const size = Math.min(104, height - 8);
      icon(b, car.id, 6, (height - size) / 2, size);
      text(b, shortName(car.id), 116, 4, layout.innerWidth - 124, 30, 23, C.ink, 'center', true);
      const capacity = Math.max(1, car.capacity + (lastState.capacityBonus || 0));
      capacitySlots(b, capacity, 132, 42, 22, 6, [], 'preview');
    });
    compactFooter(card, [compactHint()]);
  }
  function compactShelf() {
    const card = compactSidebar(feedbackLabels[lastState.feedbackCode] || '装货');
    const choices = (lastState.shelf || lastState.mission?.shelfChoices || lastState.mission?.shelf || []).slice(0, 4);
    compactChoices(card, choices, 'load', null, true);
    compactCargo(card, 'load');
    compactFooter(card, [compactHint(), { id: 'depart', label: '出发', run: () => send('DEPART'), primary: true }]);
  }
  function compactDestinations(isPanel = false) {
    const card = compactSidebar(feedbackLabels[lastState.feedbackCode] || (isPanel ? '换地点' : '选地点'), { close: isPanel });
    const travel = placeId => {
      if (isPanel) {
        panel = null;
        if (!priorPaused) send('PAUSE', { value: false });
      }
      send('TRAVEL', { placeId });
      if (isPanel) rebuild();
    };
    compactChoices(card, destinationOptions(), isPanel ? 'destination' : 'place', travel);
    compactCargo(card);
    compactFooter(card, [
      { id: 'return-depot', label: '回仓库', run: () => travel('depot') },
      isPanel ? { id: 'close-hint', label: '继续', run: closePanel } : compactHint(),
    ]);
  }
  function compactPlace(card, placeId) {
    const size = Math.min(112, layout.cargoY - 56), x = (layout.innerWidth - size) / 2;
    const art = icon(card, placeId, x, 0, size);
    text(card, shortName(placeId), 0, size, layout.innerWidth, 24, 22, C.ink, 'center', true);
    return art;
  }
  function compactDriving() {
    const delivered = lastState.phase === 'delivery';
    const card = compactSidebar(delivered ? (feedbackLabels[lastState.feedbackCode] || '到站啦') : '在路上');
    const placeId = delivered ? lastState.location : lastState.currentDestination;
    if (placeId) cargoIcons.set('delivery-place', compactPlace(card, placeId));
    else icon(card, lastState.vehicleId || 'car', (layout.innerWidth - 96) / 2, 0, 96);
    compactCargo(card, delivered ? 'deliver' : null);
    compactFooter(card, delivered ? [
      { id: 'destinations', label: '换地点', run: () => openPanel('destinations') },
      { id: 'return-depot', label: '回仓库', run: () => send('TRAVEL', { placeId: 'depot' }) },
      compactHint(),
    ] : [compactHint()]);
  }
  function compactReward(isSession = false) {
    const card = compactSidebar('谢谢你');
    if (places[lastState.location]) compactPlace(card, lastState.location);
    icon(card, 'star', (layout.innerWidth - 56) / 2, layout.cargoY + 2, 56, C.yellow);
    for (let i = 0; i < 3; i++) box(card, `reward-dot-${i}`, layout.innerWidth / 2 - 36 + i * 30, layout.footerY - 22, 12, 12, i <= lastState.round ? C.teal : '#cbd7c4', 6);
    compactFooter(card, [{ id: isSession ? 'new-session' : 'next', label: isSession ? '再出发' : '继续',
      run: () => isSession ? onNewSession(lastState.difficulty) : send('NEXT'), primary: true }]);
  }
  function compactSettings() {
    const card = compactSidebar('设置', { close: true }), gap = 8;
    const width = (layout.innerWidth - gap * 2) / 3;
    DIFFICULTIES.forEach((difficulty, i) => {
      const b = button(card, `difficulty-${difficulty.id}`, '', i * (width + gap), 0, width, 70,
        () => { chosenDifficulty = difficulty.id; rebuild(); }, { fill: chosenDifficulty === difficulty.id ? '#cde3cd' : C.mint });
      text(b, difficulty.name, 0, 4, width, 32, 22, C.ink, 'center', true);
      for (let n = 0; n <= i; n++) box(b, `difficulty-dot-${i}-${n}`, width / 2 - (i * 16 + 10) / 2 + n * 16, 46, 10, 10, C.teal, 5);
    });
    const half = (layout.innerWidth - gap) / 2;
    const soundButton = compactAction(card, 'setting-sound', '声音', 0, 78, half, () => { sound = !sound; onSound(sound); rebuild(); }, false,
      { icon: sound ? 'sound' : 'close', fill: sound ? '#cde3cd' : C.mint });
    buttons.set('sound', soundButton);
    compactAction(card, 'reduced-motion', '轻柔', half + gap, 78, half, () => {
      reducedMotion = !reducedMotion;
      if (reducedMotion) { clearCargoTransfer(); sparkles.bursts = []; sparkles._markAsDirty(); }
      onReducedMotion(reducedMotion); rebuild();
    }, false, { fill: reducedMotion ? '#cde3cd' : C.mint });
    compactAction(card, 'model-viewer', '图鉴', 0, 130, half, () => openPanel('models'));
    compactAction(card, 'new-session', '再出发', half + gap, 130, half, () => { panel = null; onNewSession(chosenDifficulty); rebuild(); }, true);
    compactFooter(card, [{ id: 'back-to-town', label: '继续', run: closePanel }]);
  }
  function compactModels() {
    const card = compactSidebar('模型图鉴', { close: true }), list = selectedModels(), model = selectedModel();
    const width = (layout.innerWidth - 16) / 3;
    [['vehicle', '车辆'], ['place', '地点'], ['decoration', '装饰']].forEach(([id, label], i) => compactAction(card, `models-${id}`, label,
      i * (width + 8), 0, width, () => { modelCategory = id; modelIndex = 0; modelZoom = 1; rebuild(); }, modelCategory === id));
    text(card, `${model.name} · ${model.sourceLabel}`, 0, 50, layout.innerWidth, 24, 18, C.ink, 'center', true);
    text(card, model.packLabel, 0, 78, layout.innerWidth, 24, 14, C.muted, 'center');
    const half = (layout.innerWidth - 8) / 2, controlsY = layout.footerY - 104;
    const step = delta => { modelIndex = (modelIndex + delta + list.length) % list.length; modelZoom = 1; rebuild(); };
    compactAction(card, 'model-previous', '上一个', 0, controlsY, half, () => step(-1));
    compactAction(card, 'model-next', '下一个', half + 8, controlsY, half, () => step(1));
    const zoom = delta => { modelZoom = Math.max(.65, Math.min(1.6, Math.round((modelZoom + delta) * 100) / 100)); rebuild(); };
    compactAction(card, 'model-zoom-out', '缩小', 0, controlsY + 52, half, () => zoom(-.15), false, { enabled: modelZoom > .65 });
    compactAction(card, 'model-zoom-in', '放大', half + 8, controlsY + 52, half, () => zoom(.15), false, { enabled: modelZoom < 1.6 });
    compactFooter(card, [{ id: 'model-back', label: '设置', run: () => openPanel('settings') }]);
  }
  function compactEvent() {
    const event = lastState.event;
    const labels = { repair: '修一修', shortage: '补货啦', capacity: '装货格', roadworks: '修路啦' };
    const card = compactSidebar(labels[event?.id] || '想办法');
    const size = Math.min(112, layout.footerY - 72);
    icon(card, event?.id === 'repair' ? 'repair-tool' : event?.id === 'shortage' ? 'parcel' : 'car', (layout.innerWidth - size) / 2, 0, size, C.orange);
    if (event?.id === 'repair') for (let i = 0; i < 3; i++) box(card, `pump-dot-${i}`, layout.innerWidth / 2 - 36 + i * 30, size + 8, 12, 12, i < (event.progress || 0) ? C.teal : '#cbd7c4', 6);
    compactAction(card, 'event-listen', '再听', 0, layout.footerY - 52, layout.innerWidth, () => onSpeak('event'));
    const optionLabels = { detour: '绕一绕', reopen: '开便道', trailer: '拖车', 'two-trips': '分次送', reserve: '备用箱', pickup: '去车库', pump: '打气', helper: '找朋友' };
    compactFooter(card, (event?.options || []).map((option, i) => ({ id: `event-${option.id}`, label: optionLabels[option.id] || '继续',
      run: () => send('RESOLVE_EVENT', { optionId: option.id }), primary: i === 0 })));
  }
  function compactLanding() {
    const card = compactSidebar('小车镇', { utilities: false });
    const size = Math.min(144, layout.footerY - 60);
    icon(card, 'car', (layout.innerWidth - size) / 2, 8, size, C.orange);
    if (mode === 'ready') compactFooter(card, [{ id: 'start', label: '出发', primary: true,
      run: () => { mode = 'game'; send('START'); rebuild(); } }]);
    else {
      text(card, loadingState.error ? '再试试' : '准备中', 0, layout.footerY - 56, layout.innerWidth, 26, 22, C.muted, 'center');
      const progress = Math.max(0, Math.min(1, Number(loadingState.progress) || 0));
      box(card, 'progress-track', 8, layout.footerY - 18, layout.innerWidth - 16, 8, '#e0e5d5', 4);
      if (progress > 0) box(card, 'progress-fill', 8, layout.footerY - 18, Math.max(8, (layout.innerWidth - 16) * progress), 8, C.teal, 4);
      if (loadingState.error) compactFooter(card, [{ id: 'retry', label: '再试试', primary: true, run: () => send('RETRY_LOAD') }]);
    }
  }
  function compactScreen() {
    if (mode !== 'game' || !lastState) return compactLanding();
    if (panel === 'hint') return compactBrief(true);
    if (panel === 'settings') return compactSettings();
    if (panel === 'models') return compactModels();
    if (panel === 'destinations') return compactDestinations(true);
    if (lastState.paused) {
      const card = compactSidebar('歇一歇', { utilities: false });
      icon(card, lastState.vehicleId || 'car', (layout.innerWidth - 128) / 2, 16, 128);
      compactFooter(card, [{ id: 'resume', label: '继续', primary: true, run: () => send('PAUSE', { value: false }) }]);
      return;
    }
    if (lastState.phase === 'brief') return compactBrief();
    if (lastState.phase === 'selectVehicle') return compactVehicles();
    if (lastState.phase === 'loading') return compactShelf();
    if (lastState.phase === 'event') return compactEvent();
    if (lastState.phase === 'reward' || lastState.phase === 'sessionComplete') return compactReward(lastState.phase === 'sessionComplete');
    if (lastState.phase === 'explore') return compactDestinations();
    return compactDriving();
  }

  function orientationNotice() {
    const bg = new Rectangle('orientation-blocker'); bg.width = '100%'; bg.height = '100%'; bg.background = C.cream; bg.thickness = 0; bg.isPointerBlocker = true;
    screen.addControl(bg);
    const device = new Rectangle('rotate-device'); device.width = '156px'; device.height = '98px'; device.top = '-78px'; device.rotation = -.2; device.cornerRadius = 16; device.thickness = 7; device.color = C.teal; device.isHitTestVisible = false; bg.addControl(device);
    const heading = new TextBlock('orientation-instruction', '横过来');
    heading.width = '94%'; heading.height = '110px'; heading.top = '72px'; heading.fontSize = 38; heading.color = C.ink; heading.fontWeight = '700'; heading.isHitTestVisible = false;
    bg.addControl(heading); visibleTexts.push(heading);
  }
  function rebuild() {
    if (disposed) return;
    onModelPreview(panel === 'models' ? selectedModel().id : null, modelZoom);
    setup();
    if (orientationBlocked) { orientationNotice(); return; }
    const interactiveWorld = mode === 'game' && lastState && ['explore', 'delivery'].includes(lastState.phase) && !lastState.paused && !panel;
    if (!interactiveWorld) blockWorld();
    if (layout.compact) { compactScreen(); return; }
    if (mode !== 'game' || !lastState) { landing(); return; }
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
    else if (lastState.phase === 'explore') exploreHUD();
    else drivingHUD();
  }
  function controlBounds(control) {
    const size = texture.getSize(), rect = canvas?.getBoundingClientRect(), m = control?._currentMeasure;
    if (!rect?.width || !size.width || !m || m.width <= 0 || m.height <= 0 || !control.isVisible || control.notRenderable) return null;
    for (let p = control.parent; p; p = p.parent) if (!p.isVisible || p.notRenderable) return null;
    return { x: rect.left + m.left * rect.width / size.width, y: rect.top + m.top * rect.height / size.height,
      width: m.width * rect.width / size.width, height: m.height * rect.height / size.height };
  }
  function getBounds() {
    const result = {};
    if (orientationBlocked) return result;
    for (const [id, b] of buttons) {
      let enabled = b.isEnabled;
      for (let p = b.parent; p; p = p.parent) enabled &&= p.isEnabled;
      const bounds = enabled ? controlBounds(b) : null;
      if (bounds) result[id] = bounds;
    }
    return result;
  }
  function getSnapshot() {
    return {
      phase: lastState?.phase || mode, panel, compact: layout.compact, paused: !!lastState?.paused, orientationBlocked,
      adult: panel === 'models',
      texts: visibleTexts.filter(t => t.text && controlBounds(t)).map(t => ({ text: t.text, bounds: controlBounds(t) })),
      slots: visibleSlots.map(slot => ({ index: slot.index, goodId: slot.goodId, mode: slot.mode,
        clickable: slot.clickable && slot.control.isEnabled, bounds: controlBounds(slot.control) })),
      images: visibleImages.map(entry => ({ kind: entry.kind, alpha: entry.control.alpha, bounds: controlBounds(entry.control) })).filter(entry => entry.bounds),
      cards: visibleCards.map(entry => ({ id: entry.id, bounds: controlBounds(entry.control) })).filter(entry => entry.bounds),
    };
  }
  rebuild();
  return {
    render(state) {
      const signature = JSON.stringify(state);
      if (lastState?.seed !== state.seed || (lastState?.phase !== state.phase && state.phase === 'brief')) panel = null;
      if (state.paused || lastState?.phase !== state.phase || lastState?.seed !== state.seed || lastState?.vehicleId !== state.vehicleId) clearCargoTransfer();
      syncCargoSlots(state);
      lastState = state;
      if (!panel) chosenDifficulty = state.difficulty;
      if (signature !== lastSignature) { lastSignature = signature; rebuild(); }
    },
    loading(info) { mode = 'loading'; loadingState = { ...loadingState, error: false, ...info }; rebuild(); },
    ready() { mode = 'ready'; rebuild(); },
    setModelIcons(images) { modelIcons = images; rebuild(); },
    setSettings(settings = {}) { sound = settings.sound ?? sound; reducedMotion = settings.reducedMotion ?? reducedMotion; if (reducedMotion) { clearCargoTransfer(); sparkles.bursts = []; sparkles._markAsDirty(); } rebuild(); },
    // Keep the world's callback compatible; destination UI no longer projects
    // labels or leader lines over the actual 3D buildings.
    setPlaces() {},
    setOrientationBlocked(blocked) {
      const next = !!blocked;
      if (next === orientationBlocked) return;
      orientationBlocked = next; clearCargoTransfer(); cancelPress(); sparkles.bursts = []; sparkles._markAsDirty(); rebuild();
    },
    cancelInput: cancelPress,
    getCargoTransfer() {
      const f=cargoTransfer.flight||cargoPending;
      return f?{active:true,stage:cargoPending?'layout':'flying',kind:f.kind,goodId:f.goodId,
        progress:cargoPending?0:Math.min(1,f.time/.45),from:{...f.from},to:f.to?{...f.to}:null}:{active:false};
    },
    getBounds,
    getSnapshot,
    getLayout,
    getModelView() { return panel === 'models' ? {...selectedModel(),zoom:modelZoom} : null; },
    dispose() {
      disposed = true; clearCargoTransfer(); cancelPress(); scene.onBeforeRenderObservable.remove(tick); engine.onResizeObservable.remove(resizeObserver);
      modelIcons = new Map();
      canvas?.removeEventListener('pointermove', cancelOutside, true); canvas?.removeEventListener('pointerup', cancelOutside, true);
      canvas?.removeEventListener('pointercancel', cancelPress, true); canvas?.ownerDocument?.removeEventListener('pointerdown', secondPointer, true); canvas?.removeEventListener('lostpointercapture', cancelPress, true);
      texture.dispose();
    },
  };
}
