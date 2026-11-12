import { GOODS, VEHICLES, PLACES, THEMES, DIFFICULTIES, TEMPLATES, EVENTS } from './catalog.js';

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
  const random = seededRandom(seed ^ 0x4d4150);
  const gapX = 8 + Math.floor(random() * 4), gapZ = 8 + Math.floor(random() * 4);
  const nodes = Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, x: (i % 3 - 1) * gapX, z: (Math.floor(i / 3) - 1) * gapZ }));
  let edges = [];
  for (let i = 0; i < 9; i++) {
    if (i % 3 < 2) edges.push([`n${i}`, `n${i + 1}`]);
    if (i < 6) edges.push([`n${i}`, `n${i + 3}`]);
  }
  // Keep cycles for recoverable roadworks, while varying the actual road topology.
  const removeCount = Math.floor(random() * 3);
  for (const candidate of shuffled(edges, random)) {
    if (edges.length <= 12 - removeCount) break;
    const next = edges.filter(edge => edge !== candidate);
    if (nodes.every(node => nodeRoute({ nodes, edges: next }, nodes[0].id, node.id).length)) edges = next;
  }
  const slots = shuffled(nodes, random);
  return {
    seed, theme: THEMES[Math.floor(random() * THEMES.length)].id, nodes, edges,
    places: PLACES.map((place, i) => ({ ...place, nodeId: slots[i].id, x: slots[i].x, z: slots[i].z })),
    depot: 'depot',
  };
}

export function findRoute(map, fromPlaceId, toPlaceId, blockedEdges = []) {
  const from = map.places.find(place => place.id === fromPlaceId);
  const to = map.places.find(place => place.id === toPlaceId);
  if (!from || !to) return [];
  const nodes = byId(map.nodes);
  return nodeRoute(map, from.nodeId, to.nodeId, blockedEdges).map(id => ({ x: nodes[id].x, z: nodes[id].z }));
}

function missionFor(seed, difficulty, round, previousTemplateIds) {
  const random = seededRandom(seed ^ Math.imul(round + 1, 0x9e3779b1) ^ 0x5441534b);
  const available = TEMPLATES.filter(template => !previousTemplateIds.includes(template.id));
  const template = available[Math.floor(random() * available.length)];
  const count = difficulty === 'easy' ? 1 : difficulty === 'normal' ? 2 : 3;
  const selectedGoods = shuffled(template.goods, random).slice(0, count);
  const destinations = shuffled(template.places, random);
  const steps = selectedGoods.map((goodId, index) => ({
    goodId, quantity: difficulty === 'easy' ? 1 + Math.floor(random() * 2) : 1,
    placeId: destinations[index % destinations.length],
  }));
  const requiredTags = [...new Set(steps.map(step => goods[step.goodId].tag))];
  const suitable = VEHICLES.filter(vehicle => requiredTags.every(tag => vehicle.supports.includes(tag)));
  const preferred = suitable[Math.floor(random() * suitable.length)];
  const choiceCount = difficulty === 'easy' ? 2 : difficulty === 'normal' ? 3 : 6;
  const alternatives = shuffled(VEHICLES.filter(vehicle => vehicle.id !== preferred.id), random).slice(0, choiceCount - 1);
  const distractors = shuffled(GOODS.filter(good => !selectedGoods.includes(good.id)), random).slice(0, difficulty === 'easy' ? 2 : 3);
  return {
    id: `${seed}-${round}-${template.id}`, templateId: template.id, title: template.title,
    steps, ordered: difficulty === 'challenge', requiredTags,
    shelf: shuffled([...selectedGoods, ...distractors.map(good => good.id)], random),
    vehicleChoices: shuffled([preferred, ...alternatives], random).map(vehicle => vehicle.id),
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
    cargo: [], storedCargo: [], completed: [], delivered: {}, message: '先听一听，再记住今天的小任务。', paused: false,
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
  function feedback(events, text, kind = 'gentle') {
    state.message = text;
    events.push({ type: 'feedback', kind, text });
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
    feedback(events, '你把每一份心意都送到了，真棒！', 'success');
    events.push({ type: 'reward' });
  }

  function beginEvent(events) {
    if (state.difficulty === 'easy' || state.eventUsed || state.round !== 0 || remaining().length === 0) return;
    const random = seededRandom(state.seed ^ 0x45564e54);
    let definition = EVENTS[Math.floor(random() * EVENTS.length)];
    // One remaining unit cannot create a meaningful choice between one trip and several.
    if (definition.id === 'capacity' && (remaining().length < 2 || cargoCount() < 2)) {
      const alternatives = EVENTS.filter(event => event.id !== 'capacity');
      definition = alternatives[Math.floor(random() * alternatives.length)];
    }
    state.eventUsed = true;
    state.event = { id: definition.id, title: definition.title, message: definition.message, options: copy(definition.options) };
    state.phase = 'event';
    state.message = definition.message;
    if (definition.id === 'roadworks') {
      const from = state.map.places.find(place => place.id === state.location).nodeId;
      const to = state.map.places.find(place => place.id === remaining()[0].placeId).nodeId;
      const route = nodeRoute(state.map, from, to);
      const routeEdges = route.slice(1).map((node, i) => [route[i], node]);
      const candidates = [...routeEdges, ...state.map.edges];
      const blocked = candidates.find(edge => state.map.nodes.every(node => nodeRoute(state.map, from, node.id, [edge]).length));
      if (blocked) state.blockedEdges = [blocked];
    } else if (definition.id === 'capacity') {
      state.capacityBonus = 1 - vehicles[state.vehicleId].capacity;
    } else if (definition.id === 'shortage') {
      state.shortageGoodId = remaining()[0].goodId;
    } else if (definition.id === 'repair') {
      state.vehicleHealth = 'soft-tyre';
      state.event.progress = 0;
      state.event.message = `${definition.message} 打气进度：0/3。`;
      state.message = state.event.message;
    }
    events.push({ type: 'event', id: definition.id });
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
        state.message = '选一辆适合今天任务的小车。';
        break;
      case 'SELECT_VEHICLE': {
        if (!['selectVehicle', 'loading'].includes(state.phase) || state.location !== 'depot' || !state.mission.vehicleChoices.includes(command.vehicleId)) { accepted = false; break; }
        const selected = vehicles[command.vehicleId];
        if (!state.mission.requiredTags.every(tag => selected.supports.includes(tag))) {
          feedback(events, '这辆车不太适合这次的物品。再试试另一辆吧！'); break;
        }
        const selectedCapacity = state.capacityBonus < 0 ? 1 : Math.max(1, selected.capacity + state.capacityBonus);
        if (cargoCount() > selectedCapacity) {
          feedback(events, '车上物品有点多。先放下一些，再换车吧。'); break;
        }
        state.vehicleId = selected.id;
        if (state.capacityBonus < 0) state.capacityBonus = 1 - selected.capacity;
        state.phase = 'loading';
        state.message = '记得要带什么吗？点一下放一件，再点车上的物品可以放回。';
        break;
      }
      case 'LOAD': {
        if (state.phase !== 'loading' || !state.mission.shelf.includes(command.goodId)) { accepted = false; break; }
        if (state.shortageGoodId === command.goodId && state.location === 'depot') {
          feedback(events, '这个货架在补货，去汽车工坊的备用箱看看吧。'); break;
        }
        if (cargoCount() >= capacity()) { feedback(events, '小车已经坐满啦。可以放回一件，或者先送这一车。'); break; }
        const item = state.cargo.find(item => item.goodId === command.goodId);
        if (item) item.quantity++; else state.cargo.push({ goodId: command.goodId, quantity: 1 });
        const stored = state.location === 'depot' && state.storedCargo.find(item => item.goodId === command.goodId);
        if (stored) {
          stored.quantity--;
          state.storedCargo = state.storedCargo.filter(item => item.quantity > 0);
        }
        state.message = stored ? '从仓库取回啦。准备好就出发！' : '放好啦。准备好就出发！';
        events.push({ type: 'cargo' });
        break;
      }
      case 'UNLOAD': {
        if (state.phase !== 'loading') { accepted = false; break; }
        const item = state.cargo.find(item => item.goodId === command.goodId);
        if (!item) { accepted = false; break; }
        item.quantity--;
        state.cargo = state.cargo.filter(item => item.quantity > 0);
        state.message = '放回去了，慢慢想一想。';
        events.push({ type: 'cargo' });
        break;
      }
      case 'DEPART':
        if (state.phase !== 'loading') { accepted = false; break; }
        state.phase = state.location === 'depot' ? 'explore' : 'delivery';
        state.message = state.location === 'depot' ? '点一个地点，小车会自己开过去。' : '补好货啦。可以交出物品，也可以去下一个地方。';
        break;
      case 'TRAVEL': {
        if (!['explore', 'delivery', 'loading'].includes(state.phase) || !places[command.placeId]) { accepted = false; break; }
        if (command.placeId === state.location) {
          updateLocationPhase();
          state.message = state.phase === 'loading' ? '还可以补货或放回物品。' : '已经到了。选一件要交出的物品吧。';
          break;
        }
        if (state.vehicleHealth === 'soft-tyre') { feedback(events, '先照顾好轮胎，再出发。'); break; }
        const route = findRoute(state.map, state.location, command.placeId, state.blockedEdges);
        if (!route.length) { feedback(events, '这条路暂时不通。我们可以换一个办法。'); break; }
        state.phase = 'moving';
        state.currentDestination = command.placeId;
        state.message = `正在前往${places[command.placeId].name}。`;
        events.push({ type: 'travel', route, placeId: command.placeId });
        break;
      }
      case 'ARRIVE':
        if (state.phase !== 'moving' || !state.currentDestination) { accepted = false; break; }
        state.location = state.currentDestination;
        state.currentDestination = null;
        updateLocationPhase();
        state.message = state.phase === 'loading' ? '到了，记得还有什么要带吗？' : '到了，想一想这里需要哪件物品。';
        break;
      case 'DELIVER': {
        if (state.phase !== 'delivery') { accepted = false; break; }
        const item = state.cargo.find(item => item.goodId === command.goodId);
        if (!item) { accepted = false; break; }
        const outstanding = remaining();
        const step = outstanding.find(step => step.goodId === command.goodId && step.placeId === state.location);
        if (!step || (state.mission.ordered && step.index !== outstanding[0]?.index)) {
          feedback(events, state.mission.ordered ? '再想想先做哪一步。可以免费再听一次！' : '这里好像需要别的东西。可以再看看任务卡！');
          break;
        }
        item.quantity--;
        state.cargo = state.cargo.filter(item => item.quantity > 0);
        state.delivered[step.index] = (state.delivered[step.index] || 0) + 1;
        const finishedStep = state.delivered[step.index] >= step.quantity;
        if (finishedStep) state.completed.push(step.index);
        feedback(events, finishedStep ? '送对啦，谢谢你的小心照顾！' : '送对了一件，再想想还差几件。', 'success');
        events.push({ type: 'cargo' });
        if (remaining().length === 0) completeMission(events);
        else if (finishedStep) beginEvent(events);
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
        const message = id === 'shortage' && option === 'pickup' ? '备用箱在汽车工坊，需要补货时去那里。'
          : id === 'capacity' && option === 'two-trips' ? '其余物品已安全暂存仓库。先送车上这一件，再回小镇仓库点货架取回。'
          : '想到办法啦，我们继续原来的小任务！';
        feedback(events, message, 'success');
        break;
      }
      case 'NEXT': {
        if (state.phase !== 'reward') { accepted = false; break; }
        if (state.round >= 2) {
          state.phase = 'sessionComplete';
          state.message = '今天帮助了好多朋友！可以休息，也可以去新的小镇。';
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
        state.message = '新任务来啦。先听一听，再记住。';
        break;
      }
      default:
        accepted = false;
    }
    if (accepted) {
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
