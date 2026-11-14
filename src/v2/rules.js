import { GOODS, VEHICLES, PLACES, THEMES, DIFFICULTIES, TEMPLATES } from './catalog.js';
import { createTownLayout } from './town-layout.js';

const copy = value => JSON.parse(JSON.stringify(value));
const byId = list => Object.fromEntries(list.map(item => [item.id, item]));
const goods = byId(GOODS), vehicles = byId(VEHICLES), places = byId(PLACES);
const clampSeed = seed => {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  let value = 2166136261;
  for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
};

export function seededRandom(seed) {
  let value = clampSeed(seed);
  return () => {
    value += 0x6D2B79F5;
    let mixed = Math.imul(value ^ (value >>> 15), value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, random) {
  const result = [...list];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

const edgeKey = edge => [...edge].sort().join(':');
function nodeRoute(map, start, goal, blockedEdges = []) {
  if (!map.nodes.some(node => node.id === start) || !map.nodes.some(node => node.id === goal)) return [];
  const blocked = new Set(blockedEdges.map(edge => Array.isArray(edge) ? edgeKey(edge) : edge));
  const neighbors = new Map(map.nodes.map(node => [node.id, []]));
  for (const edge of map.edges) {
    if (blocked.has(edgeKey(edge))) continue;
    neighbors.get(edge[0])?.push(edge[1]);
    neighbors.get(edge[1])?.push(edge[0]);
  }
  const queue = [start], previous = new Map([[start, null]]);
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index];
    if (node === goal) break;
    for (const neighbor of neighbors.get(node) || []) {
      if (!previous.has(neighbor)) { previous.set(neighbor, node); queue.push(neighbor); }
    }
  }
  if (!previous.has(goal)) return [];
  const route = [];
  for (let node = goal; node !== null; node = previous.get(node)) route.push(node);
  return route.reverse();
}

/** Seed controls geometry, roads and landmark placement; never changes within a session. */
export function generateMap(seed = 1) {
  seed = clampSeed(seed);
  return createTownLayout({seed,random:seededRandom(seed ^ 0x4d4150),places:PLACES,themes:THEMES});
}

export function findRoute(map, fromPlaceId, toPlaceId, blockedEdges = []) {
  const from = map.places.find(place => place.id === fromPlaceId);
  const to = map.places.find(place => place.id === toPlaceId);
  if (!from || !to) return [];
  const blocked = new Set(blockedEdges.map(edge => Array.isArray(edge) ? edgeKey(edge) : edge));
  // A reachable logical junction is insufficient if its actual entrance road
  // is closed. Roadworks normally reserve all landmark frontages.
  if ([from, to].some(place => place.lot?.accessEdge && blocked.has(edgeKey(place.lot.accessEdge)))) return [];
  const nodes = byId(map.nodes);
  return nodeRoute(map, from.nodeId, to.nodeId, blockedEdges).map(id => ({ x: nodes[id].x, z: nodes[id].z }));
}

function missionFor(seed, difficulty, round, previousTemplateIds) {
  const random = seededRandom(seed ^ Math.imul(round + 1, 0x9e3779b1) ^ 0x5441534b);
  const available = TEMPLATES.filter(template => !previousTemplateIds.includes(template.id));
  const template = available[Math.floor(random() * available.length)];
  const count = difficulty === 'easy' ? 1 : 2;
  const pool = shuffled(template.goods, random);
  // Keep the errand's defining item while retaining the existing random draw
  // count and variety in its other slots. Names, step counts and speech stay finite.
  const selectedGoods = pool.slice(0, count);
  if (template.requiredGood && !selectedGoods.includes(template.requiredGood)) {
    selectedGoods[selectedGoods.length - 1] = template.requiredGood;
  }
  const destinations = shuffled(template.places, random);
  const steps = selectedGoods.map((goodId, index) => ({
    goodId, quantity: difficulty === 'easy' ? 1 + Math.floor(random() * 2) : 1,
    placeId: destinations[difficulty === 'challenge' ? index : 0],
  }));
  const requiredTags = [...new Set(steps.map(step => goods[step.goodId].tag))];
  const totalQuantity = steps.reduce((sum, step) => sum + step.quantity, 0);
  const suitable = VEHICLES.filter(vehicle => vehicle.capacity >= totalQuantity && requiredTags.every(tag => vehicle.supports.includes(tag)));
  const vehicleChoices = shuffled(suitable, random).slice(0, 2).map(vehicle => vehicle.id);
  const distractors = shuffled(GOODS.filter(good => !selectedGoods.includes(good.id)), random).slice(0, 2);
  const shelf = shuffled([...selectedGoods, ...distractors.map(good => good.id)], random);
  const targets = [...new Set(steps.map(step => step.placeId))];
  const placeDistractors = shuffled(PLACES.filter(place => place.id !== 'depot' && !targets.includes(place.id)), random).slice(0, 4 - targets.length);
  return {
    id: `${seed}-${round}-${template.id}`, templateId: template.id, title: template.title,
    steps, ordered: false, requiredTags,
    shelf, shelfChoices: [...shelf], vehicleChoices,
    destinationChoices: shuffled([...targets, ...placeDistractors.map(place => place.id)], random),
  };
}

const difficultyId = id => DIFFICULTIES.some(item => item.id === id) ? id : 'easy';
function initialState(seed, difficulty, saved = {}) {
  seed = clampSeed(seed);
  difficulty = difficultyId(difficulty);
  const rewardCount = Number.isSafeInteger(saved.rewardCount) && saved.rewardCount >= 0 ? saved.rewardCount : 0;
  return {
    seed, difficulty, map: generateMap(seed), phase: 'brief', round: 0,
    mission: missionFor(seed, difficulty, 0, []), vehicleId: 'van', location: 'depot',
    cargo: [], storedCargo: [], completed: [], delivered: {}, message: '听任务', feedbackCode: 'brief', paused: false,
    event: null, eventUsed: false, eventHistory: [], history: [], rewardCount,
    blockedEdges: [], capacityBonus: 0, shortageGoodId: null, supplyLocations: ['depot'],
    vehicleHealth: 'ready', currentDestination: null,
  };
}

/** Rules alone own progress and rewards. Scene and GUI send intent, never completion shortcuts. */
export function createGame({ seed = 1, difficulty = 'easy', saved = {} } = {}) {
  let state = initialState(seed, difficulty, saved);
  const listeners = new Set();

  function getState() { return copy(state); }
  function feedback(events, text, kind = 'gentle', feedbackCode = 'arrived') {
    state.message = text;
    state.feedbackCode = feedbackCode;
    events.push({ type: 'feedback', kind, text, feedbackCode });
  }
  function capacity() { return Math.max(1, vehicles[state.vehicleId].capacity + state.capacityBonus); }
  function cargoCount() { return state.cargo.reduce((sum, item) => sum + item.quantity, 0); }
  function remaining() { return state.mission.steps.map((step, i) => ({ ...step, index: i })).filter(step => !state.completed.includes(step.index)); }
  function updateLocationPhase() {
    state.phase = state.supplyLocations.includes(state.location) ? 'loading' : 'delivery';
  }
  function completeMission(events) {
    state.phase = 'reward';
    state.rewardCount += 1;
    state.history.push({ missionId: state.mission.id, templateId: state.mission.templateId, round: state.round });
    feedback(events, '完成啦', 'success', 'reward');
    events.push({ type: 'reward' });
  }

  function placeFeedback(events) {
    const atPlace = state.mission.steps.map((step, index) => ({ ...step, index })).filter(step => step.placeId === state.location);
    const pending = atPlace.filter(step => !state.completed.includes(step.index));
    if (pending.length) {
      const missing = pending.some(step => (state.cargo.find(item => item.goodId === step.goodId)?.quantity || 0) < step.quantity - (state.delivered[step.index] || 0));
      feedback(events, missing ? '去补货' : '交货吧', 'gentle', missing ? 'missing-cargo' : 'arrived');
    } else if (state.supplyLocations.includes(state.location)) {
      feedback(events, '装货吧', 'gentle', 'supply');
    } else {
      feedback(events, atPlace.length ? '送过啦' : '再想想', 'gentle', atPlace.length ? 'place-done' : 'wrong-place');
    }
  }

  function dispatch(command) {
    if (!command || typeof command.type !== 'string') return { accepted: false, events: [], state: getState() };
    const events = [];
    let accepted = true;
    if (state.paused && !['PAUSE', 'NEW_SESSION'].includes(command.type)) return { accepted: false, events, state: getState() };
    switch (command.type) {
      case 'PAUSE':
        state.paused = Boolean(command.value);
        break;
      case 'NEW_SESSION':
        state = initialState(command.seed ?? ((state.seed + 1) >>> 0), command.difficulty ?? state.difficulty, { rewardCount: state.rewardCount });
        events.push({ type: 'session' });
        break;
      case 'ACK_BRIEF':
        if (state.phase !== 'brief') { accepted = false; break; }
        state.phase = 'selectVehicle';
        feedback(events, '选小车', 'gentle', 'choose-vehicle');
        break;
      case 'SELECT_VEHICLE': {
        if (!['selectVehicle', 'loading'].includes(state.phase) || state.location !== 'depot' || !state.mission.vehicleChoices.includes(command.vehicleId)) { accepted = false; break; }
        const selected = vehicles[command.vehicleId];
        if (!state.mission.requiredTags.every(tag => selected.supports.includes(tag))) {
          accepted = false;
          feedback(events, '换辆车', 'gentle', 'choose-vehicle'); break;
        }
        const selectedCapacity = state.capacityBonus < 0 ? 1 : Math.max(1, selected.capacity + state.capacityBonus);
        if (cargoCount() > selectedCapacity) {
          accepted = false;
          feedback(events, '放回些', 'gentle', 'capacity-full'); break;
        }
        state.vehicleId = selected.id;
        if (state.capacityBonus < 0) state.capacityBonus = 1 - selected.capacity;
        state.phase = 'loading';
        feedback(events, '装货吧', 'gentle', 'vehicle-ready');
        break;
      }
      case 'LOAD': {
        if (state.phase !== 'loading' || !state.mission.shelf.includes(command.goodId)) { accepted = false; break; }
        if (state.shortageGoodId === command.goodId && state.location === 'depot') {
          accepted = false;
          feedback(events, '去补货', 'gentle', 'missing-cargo'); break;
        }
        if (cargoCount() >= capacity()) { accepted = false; feedback(events, '装满啦', 'gentle', 'capacity-full'); break; }
        const item = state.cargo.find(item => item.goodId === command.goodId);
        if (item) item.quantity++; else state.cargo.push({ goodId: command.goodId, quantity: 1 });
        const stored = state.location === 'depot' && state.storedCargo.find(item => item.goodId === command.goodId);
        if (stored) {
          stored.quantity--;
          state.storedCargo = state.storedCargo.filter(item => item.quantity > 0);
        }
        feedback(events, '装好啦', 'gentle', 'loaded');
        events.push({ type: 'cargo' });
        break;
      }
      case 'UNLOAD': {
        if (state.phase !== 'loading') { accepted = false; break; }
        const item = state.cargo.find(item => item.goodId === command.goodId);
        if (!item) { accepted = false; break; }
        item.quantity--;
        state.cargo = state.cargo.filter(item => item.quantity > 0);
        feedback(events, '放回啦', 'gentle', 'unloaded');
        events.push({ type: 'cargo' });
        break;
      }
      case 'DEPART':
        if (state.phase !== 'loading') { accepted = false; break; }
        if (!cargoCount()) { accepted = false; feedback(events, '先装货', 'gentle', 'empty-cargo'); break; }
        state.phase = state.location === 'depot' ? 'explore' : 'delivery';
        feedback(events, '去哪里', 'gentle', 'choose-place');
        break;
      case 'TRAVEL': {
        if (state.phase === 'moving') {
          accepted = false;
          feedback(events, '开车中', 'gentle', 'moving');
          break;
        }
        if (!['explore', 'delivery', 'loading'].includes(state.phase) || !places[command.placeId]) { accepted = false; break; }
        const supply = state.supplyLocations.includes(command.placeId);
        const pending = remaining().some(step => step.placeId === command.placeId);
        if (!supply && !pending) {
          accepted = false;
          const done = state.mission.steps.some(step => step.placeId === command.placeId);
          feedback(events, done ? '送过啦' : '再想想', 'gentle', done ? 'place-done' : 'wrong-place');
          break;
        }
        // Recovery sources remain reachable even after the last loaded unit is delivered.
        if (!supply && !cargoCount()) {
          accepted = false;
          feedback(events, '先装货', 'gentle', 'empty-cargo'); break;
        }
        if (command.placeId === state.location) {
          updateLocationPhase();
          placeFeedback(events);
          break;
        }
        if (state.vehicleHealth === 'soft-tyre') { accepted = false; feedback(events, '修小车', 'gentle', 'moving'); break; }
        const route = findRoute(state.map, state.location, command.placeId, state.blockedEdges);
        if (!route.length) { accepted = false; feedback(events, '换条路', 'gentle', 'wrong-place'); break; }
        state.phase = 'moving';
        state.currentDestination = command.placeId;
        feedback(events, '出发啦', 'gentle', 'moving');
        events.push({ type: 'travel', route, placeId: command.placeId });
        break;
      }
      case 'ARRIVE':
        if (state.phase !== 'moving' || !state.currentDestination) { accepted = false; break; }
        state.location = state.currentDestination;
        state.currentDestination = null;
        updateLocationPhase();
        placeFeedback(events);
        break;
      case 'DELIVER': {
        if (state.phase !== 'delivery') { accepted = false; break; }
        const atPlace = state.mission.steps.map((step, index) => ({ ...step, index })).filter(step => step.placeId === state.location);
        const pending = atPlace.filter(step => !state.completed.includes(step.index));
        if (!pending.length) {
          accepted = false;
          feedback(events, atPlace.length ? '送过啦' : '再想想', 'gentle', atPlace.length ? 'place-done' : 'wrong-place'); break;
        }
        const step = pending.find(step => step.goodId === command.goodId);
        if (!step) { accepted = false; feedback(events, '再想想', 'gentle', 'wrong-item'); break; }
        const item = state.cargo.find(item => item.goodId === command.goodId);
        if (!item) { accepted = false; feedback(events, '去补货', 'gentle', 'missing-cargo'); break; }
        item.quantity--;
        state.cargo = state.cargo.filter(item => item.quantity > 0);
        state.delivered[step.index] = (state.delivered[step.index] || 0) + 1;
        const finishedStep = state.delivered[step.index] >= step.quantity;
        if (finishedStep) state.completed.push(step.index);
        events.push({ type: 'cargo' });
        if (remaining().length === 0) completeMission(events);
        else {
          const nextStop = !remaining().some(step => step.placeId === state.location);
          feedback(events, nextStop ? '下一站' : '送对啦', 'success', nextStop ? 'next-stop' : 'delivered');
        }
        break;
      }
      case 'RESOLVE_EVENT': {
        if (state.phase !== 'event' || !state.event?.options.some(option => option.id === command.optionId)) { accepted = false; break; }
        const id = state.event.id, option = command.optionId;
        if (id === 'roadworks' && option === 'reopen') state.blockedEdges = [];
        if (id === 'capacity') {
          if (option === 'trailer') state.capacityBonus = 0;
          else {
            // Retain the next legal unit when present; safely stage all overflow at the depot.
            const next = remaining()[0];
            const retained = state.cargo.find(item => item.goodId === next.goodId) || state.cargo[0];
            state.storedCargo = state.cargo.map(item => ({ ...item, quantity: item.quantity - (item === retained ? 1 : 0) })).filter(item => item.quantity > 0);
            state.cargo = [{ goodId: retained.goodId, quantity: 1 }];
            events.push({ type: 'cargo' });
          }
        }
        if (id === 'shortage') {
          if (option === 'reserve') state.shortageGoodId = null;
          else state.supplyLocations = ['depot', 'garage'];
        }
        if (id === 'repair') {
          if (option === 'pump') {
            state.event.progress++;
            if (state.event.progress < 3) {
              const progress = state.event.progress;
              state.event.message = `正在给轮胎打气：${progress}/3。再点一下，也可以请朋友帮忙。`;
              state.event.options.find(option => option.id === 'pump').label = `给轮胎打气（${progress}/3）`;
              feedback(events, state.event.message);
              break;
            }
          }
          state.vehicleHealth = option === 'pump' ? 'pumped' : 'serviced';
        }
        state.eventHistory.push({ id, option });
        state.event = null;
        updateLocationPhase();
        const message = id === 'shortage' && option === 'pickup' ? '备用箱在车库，需要补货时去那里。'
          : id === 'capacity' && option === 'two-trips' ? '其余物品已安全暂存仓库。先送车上这一件，再回仓库点货架取回。'
          : '想到办法啦，我们继续原来的小任务！';
        feedback(events, message, 'success');
        break;
      }
      case 'NEXT': {
        if (state.phase !== 'reward') { accepted = false; break; }
        if (state.round >= 2) {
          state.phase = 'sessionComplete';
          feedback(events, '休息啦', 'success', 'session-complete');
          break;
        }
        state.round++;
        state.mission = missionFor(state.seed, state.difficulty, state.round, state.history.map(item => item.templateId));
        state.phase = 'brief';
        state.location = 'depot';
        state.vehicleId = 'van';
        state.cargo = []; state.storedCargo = []; state.completed = []; state.delivered = {};
        // Temporary problems belong to this errand, not the next child's new instructions.
        state.blockedEdges = []; state.capacityBonus = 0; state.shortageGoodId = null;
        state.supplyLocations = ['depot']; state.vehicleHealth = 'ready';
        feedback(events, '听任务', 'gentle', 'brief');
        break;
      }
      default:
        accepted = false;
    }
    if (accepted || events.length) {
      for (const listener of [...listeners]) listener(getState(), copy(events));
    }
    return { accepted, events: copy(events), state: getState() };
  }

  return {
    getState, dispatch,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('listener must be a function');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
