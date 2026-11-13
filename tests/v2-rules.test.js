import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, generateMap, findRoute } from '../src/v2/rules.js';
import { GOODS, VEHICLES, PLACES, THEMES, TEMPLATES, EVENTS } from '../src/v2/catalog.js';

const edgeKey = edge => [...edge].sort().join(':');

function assertRoadRoute(map, route, blockedEdges = []) {
  const roads = new Set(map.edges.map(edgeKey));
  const blocked = new Set(blockedEdges.map(edgeKey));
  const nodeAt = point => map.nodes.find(node => node.x === point.x && node.z === point.z)?.id;
  assert.ok(route.length, 'route reaches its destination');
  for (let i = 1; i < route.length; i++) {
    const road = edgeKey([nodeAt(route[i - 1]), nodeAt(route[i])]);
    assert.ok(roads.has(road), 'route follows a real road instead of cutting across a block');
    assert.ok(!blocked.has(road), 'route does not enter a closed road');
  }
}

function chooseVehicle(game, earlyOptionId = 'reserve') {
  game.dispatch({ type: 'ACK_BRIEF' });
  const state = game.getState();
  const suitable = state.mission.vehicleChoices.find(id => state.mission.requiredTags.every(tag => VEHICLES.find(vehicle => vehicle.id === id).supports.includes(tag)));
  assert.ok(suitable, 'each mission offers a suitable vehicle');
  game.dispatch({ type: 'SELECT_VEHICLE', vehicleId: suitable });
  if (game.getState().event) {
    assert.equal(game.getState().event.id, 'shortage', 'only stock shortages happen before loading');
    if (earlyOptionId) game.dispatch({ type: 'RESOLVE_EVENT', optionId: earlyOptionId });
  }
  assert.equal(game.getState().phase, !earlyOptionId && game.getState().event ? 'event' : 'loading');
}

function loadMission(game) {
  for (const step of game.getState().mission.steps) {
    for (let i = 0; i < step.quantity; i++) game.dispatch({ type: 'LOAD', goodId: step.goodId });
  }
  game.dispatch({ type: 'DEPART' });
}

function go(game, placeId) {
  const result = game.dispatch({ type: 'TRAVEL', placeId });
  assert.equal(result.accepted, true);
  if (game.getState().phase === 'moving') {
    assert.ok(result.events.find(event => event.type === 'travel')?.route.length >= 2);
    game.dispatch({ type: 'ARRIVE' });
  }
  assert.equal(game.getState().location, placeId);
  if (placeId !== 'depot' && game.getState().phase === 'loading') game.dispatch({ type: 'DEPART' });
}

function resolveEvent(game, optionIndex = 0) {
  const optionId = game.getState().event.options[optionIndex].id;
  let clicks = 0;
  while (game.getState().phase === 'event') {
    assert.ok(++clicks <= 3, 'each event resolves without waiting');
    assert.equal(game.dispatch({ type: 'RESOLVE_EVENT', optionId }).accepted, true);
  }
}

function finishDeliveries(game, optionIndex = 0) {
  const steps = game.getState().mission.steps;
  for (const [index, step] of steps.entries()) {
    if (game.getState().completed.includes(index)) continue;
    const needed = step.quantity - (game.getState().delivered[index] || 0);
    if ((game.getState().cargo.find(item => item.goodId === step.goodId)?.quantity || 0) < needed) {
      const source = game.getState().shortageGoodId === step.goodId ? 'garage' : 'depot';
      go(game, source);
      if (game.getState().phase !== 'loading') game.dispatch({ type: 'TRAVEL', placeId: source });
      for (let item = 0; item < needed; item++) game.dispatch({ type: 'LOAD', goodId: step.goodId });
      game.dispatch({ type: 'DEPART' });
    }
    go(game, step.placeId);
    for (let item = 0; item < needed; item++) {
      game.dispatch({ type: 'DELIVER', goodId: step.goodId });
      if (game.getState().event) resolveEvent(game, optionIndex);
    }
  }
  assert.equal(game.getState().phase, 'reward');
}

function solveMission(game, optionIndex = 0) {
  chooseVehicle(game);
  loadMission(game);
  finishDeliveries(game, optionIndex);
}

function afterFirstDelivery(seed, difficulty = 'challenge', fullLoad = true) {
  const game = createGame({ seed, difficulty });
  chooseVehicle(game);
  if (fullLoad) loadMission(game);
  else {
    game.dispatch({ type: 'LOAD', goodId: game.getState().mission.steps[0].goodId });
    game.dispatch({ type: 'DEPART' });
  }
  const first = game.getState().mission.steps[0];
  go(game, first.placeId);
  game.dispatch({ type: 'DELIVER', goodId: first.goodId });
  return game;
}

test('finite content has ten vehicles, twelve goods, nine named places, eight task templates, three themes and four events', () => {
  assert.equal(VEHICLES.length, 10); assert.equal(GOODS.length, 12);
  assert.equal(PLACES.length, 9); assert.equal(TEMPLATES.length, 8); assert.equal(THEMES.length, 3); assert.equal(EVENTS.length, 4);
  for (const list of [VEHICLES, GOODS, TEMPLATES, PLACES, THEMES, EVENTS]) assert.equal(new Set(list.map(item => item.id)).size, list.length);
  assert.deepEqual(PLACES.map(place => place.name), ['仓库', '公园', '学校', '医院', '农场', '餐厅', '车库', '商店', '营地']);
  for (const template of TEMPLATES) {
    assert.ok(template.goods.length >= 3);
    assert.equal(template.places.length, 2, 'normal errands still ask for exactly two destinations');
    for (const goodId of template.goods) assert.ok(GOODS.some(good => good.id === goodId));
    for (const placeId of template.places) assert.ok(PLACES.some(place => place.id === placeId));
  }
  assert.ok(TEMPLATES.find(template => template.id === 'restock').places.includes('shop'));
  assert.ok(TEMPLATES.find(template => template.id === 'camping').places.includes('camp'));
});

test('1000 seeds have connected varying maps, valid missions and fully completable three-errand sessions at every difficulty', () => {
  const layouts = new Set(), topologies = new Set(), themes = new Set(), templates = new Set(), events = new Set(), goods = new Set(), destinations = new Set();
  for (let seed = 0; seed < 1000; seed++) {
    const map = generateMap(seed);
    assert.deepEqual(map, generateMap(seed));
    assert.equal(map.nodes.length, 16);
    assert.equal(map.places.length, 9);
    assert.equal(new Set(map.nodes.map(node => node.x)).size, 4);
    assert.equal(new Set(map.nodes.map(node => node.z)).size, 4);
    assert.ok([10.5, 11].includes(map.layout.spacingX) && [10.5, 11].includes(map.layout.spacingZ), 'authored blocks reserve room for six-metre lots beside 3.75m road tiles');
    assert.ok(map.nodes.every(node => node.x >= map.layout.bounds.minX && node.x <= map.layout.bounds.maxX && node.z >= map.layout.bounds.minZ && node.z <= map.layout.bounds.maxZ), 'all junctions stay inside the authored town boundary');
    assert.ok(map.edges.length >= 18 && map.edges.length <= 20, 'connected roads retain several loops');
    const degrees = new Map(map.nodes.map(node => [node.id, 0]));
    for (const edge of map.edges) for (const nodeId of edge) degrees.set(nodeId, degrees.get(nodeId) + 1);
    assert.ok([...degrees.values()].includes(1), 'each map has a short side branch');
    const reached = new Set([map.nodes[0].id]);
    for (let i = 0; i < map.nodes.length; i++) for (const [from, to] of map.edges) {
      if (reached.has(from)) reached.add(to);
      if (reached.has(to)) reached.add(from);
    }
    assert.equal(reached.size, 16, 'every road junction is connected, including empty ones');
    assert.equal(new Set(map.edges.map(edgeKey)).size, map.edges.length);
    for (const [fromId, toId] of map.edges) {
      const from = map.nodes.find(node => node.id === fromId), to = map.nodes.find(node => node.id === toId);
      const distance = Math.abs(from.x - to.x) + Math.abs(from.z - to.z);
      assert.equal(distance, from.x === to.x ? map.layout.spacingZ : map.layout.spacingX, 'roads join adjacent grid nodes at the declared block spacing');
    }
    assert.equal(new Set(map.places.map(place => place.nodeId)).size, PLACES.length);
    for (const place of map.places) {
      const node = map.nodes.find(node => node.id === place.nodeId);
      assert.deepEqual({ x: place.x, z: place.z }, { x: node.x, z: node.z });
    }
    layouts.add(JSON.stringify({ places: map.places, edges: map.edges }));
    topologies.add(JSON.stringify(map.edges.map(edgeKey).sort()));
    themes.add(map.theme);
    for (const from of PLACES) for (const to of PLACES) assert.ok(findRoute(map, from.id, to.id).length, `${seed}: ${from.id} to ${to.id}`);
    for (const difficulty of ['easy', 'normal', 'challenge']) {
      const game = createGame({ seed, difficulty });
      const originalMap = game.getState().map;
      for (let round = 0; round < 3; round++) {
        const { mission } = game.getState();
        templates.add(mission.templateId);
        assert.equal(mission.steps.length, difficulty === 'easy' ? 1 : difficulty === 'normal' ? 2 : 3);
        assert.equal(mission.ordered, difficulty === 'challenge');
        assert.equal(new Set(mission.steps.map(step => step.placeId)).size, difficulty === 'easy' ? 1 : 2);
        for (const step of mission.steps) { assert.ok(mission.shelf.includes(step.goodId)); goods.add(step.goodId); destinations.add(step.placeId); }
        solveMission(game, seed % 2);
        assert.deepEqual(game.getState().map, originalMap, 'landmarks do not shift during a session');
        game.dispatch({ type: 'NEXT' });
      }
      const state = game.getState();
      assert.equal(state.phase, 'sessionComplete');
      assert.equal(state.rewardCount, 3);
      assert.equal(new Set(state.history.map(entry => entry.templateId)).size, 3);
      assert.equal(state.eventHistory.length, difficulty === 'easy' ? 0 : 1);
      for (const event of state.eventHistory) events.add(event.id);
    }
  }
  assert.ok(layouts.size > 990);
  assert.ok(topologies.size >= 250, 'authored districts retain varied canonical road networks within the stricter loop and frontage constraints');
  assert.equal(themes.size, 3); assert.equal(templates.size, 8); assert.equal(events.size, 4); assert.equal(goods.size, 12);
  assert.deepEqual([...destinations].sort(), PLACES.filter(place => place.id !== 'depot').map(place => place.id).sort());
});

test('roadworks provides real road detours, keeps every place reachable, and can reopen the original route', () => {
  let closures = 0, changedRoutes = 0;
  for (let seed = 0; seed < 160; seed++) {
    const game = afterFirstDelivery(seed);
    const before = game.getState();
    if (before.event?.id !== 'roadworks') continue;
    closures++;
    assert.equal(before.blockedEdges.length, 1);
    const frontages = new Set(before.map.places.map(place => edgeKey(place.lot.accessEdge)));
    assert.ok(before.blockedEdges.every(edge => !frontages.has(edgeKey(edge))), 'roadworks never block an actual entrance or the parked vehicle');
    assert.ok(before.map.edges.some(edge => edgeKey(edge) === edgeKey(before.blockedEdges[0])));
    for (const from of PLACES) for (const to of PLACES) {
      const original = findRoute(before.map, from.id, to.id);
      const detour = findRoute(before.map, from.id, to.id, before.blockedEdges);
      assertRoadRoute(before.map, detour, before.blockedEdges);
      if (JSON.stringify(original) !== JSON.stringify(detour)) changedRoutes++;
    }
    game.dispatch({ type: 'RESOLVE_EVENT', optionId: 'detour' });
    assert.deepEqual(game.getState().blockedEdges, before.blockedEdges);
    finishDeliveries(game);
    game.dispatch({ type: 'NEXT' });
    assert.deepEqual(game.getState().blockedEdges, [], 'temporary roadworks never leak into the next errand');

    const reopened = afterFirstDelivery(seed);
    reopened.dispatch({ type: 'RESOLVE_EVENT', optionId: 'reopen' });
    assert.deepEqual(reopened.getState().blockedEdges, []);
    for (const place of PLACES) {
      assert.deepEqual(findRoute(before.map, before.location, place.id), findRoute(reopened.getState().map, before.location, place.id, reopened.getState().blockedEdges));
    }
    finishDeliveries(reopened);
  }
  assert.ok(closures > 20, 'many different road networks exercise both recovery choices');
  assert.ok(changedRoutes > closures, 'closures actually change routes rather than only changing a flag');
});

test('memory mistakes preserve cargo and progress; free exploration allows returning for forgotten cargo', () => {
  const game = createGame({ seed: 42 });
  chooseVehicle(game);
  const { mission } = game.getState();
  const step = mission.steps[0];
  const wrong = mission.shelf.find(id => id !== step.goodId);
  game.dispatch({ type: 'LOAD', goodId: wrong });
  game.dispatch({ type: 'DEPART' });
  go(game, step.placeId);
  const before = game.getState().cargo;
  const result = game.dispatch({ type: 'DELIVER', goodId: wrong });
  assert.deepEqual(game.getState().cargo, before);
  assert.equal(game.getState().completed.length, 0);
  assert.equal(game.getState().rewardCount, 0);
  assert.equal(result.events[0].kind, 'gentle');
  go(game, 'depot');
  game.dispatch({ type: 'UNLOAD', goodId: wrong });
  for (let i = 0; i < step.quantity; i++) game.dispatch({ type: 'LOAD', goodId: step.goodId });
  game.dispatch({ type: 'DEPART' });
  const wrongPlace = PLACES.find(place => !['depot', step.placeId].includes(place.id)).id;
  go(game, wrongPlace);
  game.dispatch({ type: 'DELIVER', goodId: step.goodId });
  assert.equal(game.getState().rewardCount, 0);
  go(game, step.placeId);
  for (let i = 0; i < step.quantity; i++) game.dispatch({ type: 'DELIVER', goodId: step.goodId });
  assert.equal(game.getState().phase, 'reward');
});

test('ordered challenges reject later steps without destroying the choice or leaking a reward', () => {
  const game = createGame({ seed: 83, difficulty: 'challenge' });
  chooseVehicle(game); loadMission(game);
  const later = game.getState().mission.steps[1];
  go(game, later.placeId);
  const before = game.getState().cargo;
  game.dispatch({ type: 'DELIVER', goodId: later.goodId });
  assert.deepEqual(game.getState().cargo, before);
  assert.deepEqual(game.getState().completed, []);
  assert.equal(game.getState().rewardCount, 0);
});

test('pause, duplicate arrivals/deliveries and invalid commands cannot advance or duplicate rewards', () => {
  const game = createGame({ seed: 7 });
  chooseVehicle(game); loadMission(game);
  const step = game.getState().mission.steps[0];
  game.dispatch({ type: 'TRAVEL', placeId: step.placeId });
  game.dispatch({ type: 'PAUSE', value: true });
  const frozen = game.getState();
  for (const type of ['ARRIVE', 'ACK_BRIEF', 'DEPART', 'NEXT', 'DELIVER']) assert.equal(game.dispatch({ type, goodId: step.goodId }).accepted, false);
  assert.deepEqual(game.getState(), frozen);
  game.dispatch({ type: 'PAUSE', value: false });
  game.dispatch({ type: 'ARRIVE' });
  assert.equal(game.dispatch({ type: 'ARRIVE' }).accepted, false);
  for (let i = 0; i < 10; i++) game.dispatch({ type: 'DELIVER', goodId: step.goodId });
  assert.equal(game.getState().rewardCount, 1);
  game.dispatch({ type: 'NEXT' });
  assert.equal(game.dispatch({ type: 'NEXT' }).accepted, false);
  assert.equal(game.getState().round, 1);
});

test('each post-delivery event has two valid recovery choices with real state effects and preserves the errand', () => {
  const seeds = new Map();
  for (let seed = 0; seed < 100 && seeds.size < 3; seed++) {
    const game = createGame({ seed, difficulty: 'challenge' });
    chooseVehicle(game); loadMission(game);
    const step = game.getState().mission.steps[0];
    go(game, step.placeId); game.dispatch({ type: 'DELIVER', goodId: step.goodId });
    if (game.getState().event) seeds.set(game.getState().event.id, seed);
  }
  assert.equal(seeds.size, 3);
  for (const [id, seed] of seeds) for (let optionIndex = 0; optionIndex < 2; optionIndex++) {
    const game = createGame({ seed, difficulty: 'challenge' });
    chooseVehicle(game); loadMission(game);
    const first = game.getState().mission.steps[0];
    go(game, first.placeId); game.dispatch({ type: 'DELIVER', goodId: first.goodId });
    const before = game.getState();
    assert.equal(before.phase, 'event');
    const optionId = before.event.options[optionIndex].id;
    assert.equal(game.dispatch({ type: 'TRAVEL', placeId: 'depot' }).accepted, false);
    assert.equal(game.dispatch({ type: 'RESOLVE_EVENT', optionId: 'bogus' }).accepted, false);
    resolveEvent(game, optionIndex);
    const after = game.getState();
    assert.deepEqual(after.mission, before.mission);
    assert.deepEqual(after.completed, before.completed);
    const quantities = cargo => Object.fromEntries(cargo.map(item => [item.goodId, item.quantity]));
    assert.deepEqual(quantities([...after.cargo, ...after.storedCargo]), quantities(before.cargo), 'no event destroys cargo');
    assert.deepEqual(after.eventHistory, [{ id, option: optionId }]);
    if (id === 'roadworks') {
      assert.equal(after.blockedEdges.length, optionId === 'detour' ? 1 : 0);
      for (const from of PLACES) for (const to of PLACES) assert.ok(findRoute(after.map, from.id, to.id, after.blockedEdges).length);
    }
    if (id === 'capacity') assert.equal(after.capacityBonus, optionId === 'trailer' ? 0 : 1 - VEHICLES.find(vehicle => vehicle.id === after.vehicleId).capacity);
    if (id === 'repair') assert.equal(after.vehicleHealth, optionId === 'pump' ? 'pumped' : 'serviced');
    finishDeliveries(game, optionIndex);
  }
});

test('capacity trailer carries everything while two trips must recover safely stored cargo from the depot', () => {
  for (const optionId of ['trailer', 'two-trips']) {
    const game = afterFirstDelivery(19); // Cargo-only errand allows changing between suitable vehicles.
    const before = game.getState();
    assert.equal(before.event.id, 'capacity');
    assert.equal(VEHICLES.find(vehicle => vehicle.id === before.vehicleId).capacity + before.capacityBonus, 1);
    const depotTrips = [];
    game.subscribe((state, events) => depotTrips.push(...events.filter(event => event.type === 'travel' && event.placeId === 'depot')));
    game.dispatch({ type: 'RESOLVE_EVENT', optionId });
    assert.equal(game.getState().rewardCount, 0);
    assert.equal(game.dispatch({ type: 'RESOLVE_EVENT', optionId }).accepted, false);
    if (optionId === 'trailer') {
      assert.deepEqual(game.getState().cargo, before.cargo);
      assert.deepEqual(game.getState().storedCargo, []);
      assert.equal(game.getState().capacityBonus, 0);
      finishDeliveries(game);
      assert.equal(depotTrips.length, 0, 'trailer finishes with the original load');
    } else {
      const [, next, last] = before.mission.steps;
      assert.deepEqual(game.getState().cargo, [{ goodId: next.goodId, quantity: 1 }], 'keep the next legal ordered item');
      assert.deepEqual(game.getState().storedCargo, [{ goodId: last.goodId, quantity: 1 }]);
      assert.match(game.getState().message, /仓库.*取回/);
      go(game, next.placeId);
      game.dispatch({ type: 'DELIVER', goodId: next.goodId });
      go(game, last.placeId);
      assert.equal(game.dispatch({ type: 'DELIVER', goodId: last.goodId }).accepted, false, 'stored cargo is unavailable on the road');
      assert.equal(game.dispatch({ type: 'LOAD', goodId: last.goodId }).accepted, false);
      assert.equal(game.getState().rewardCount, 0);
      assert.deepEqual(game.getState().storedCargo, [{ goodId: last.goodId, quantity: 1 }]);
      go(game, 'depot');
      game.dispatch({ type: 'LOAD', goodId: last.goodId });
      assert.deepEqual(game.getState().storedCargo, [], 'LOAD retrieves the exact stored unit');
      assert.deepEqual(game.getState().cargo, [{ goodId: last.goodId, quantity: 1 }]);
      const other = VEHICLES.find(vehicle => vehicle.id !== before.vehicleId && before.mission.requiredTags.every(tag => vehicle.supports.includes(tag)));
      assert.ok(other);
      game.dispatch({ type: 'SELECT_VEHICLE', vehicleId: other.id });
      assert.equal(other.capacity + game.getState().capacityBonus, 1, 'changing vehicles cannot bypass the single safe slot');
      game.dispatch({ type: 'LOAD', goodId: next.goodId });
      assert.deepEqual(game.getState().cargo, [{ goodId: last.goodId, quantity: 1 }]);
      game.dispatch({ type: 'DEPART' });
      finishDeliveries(game);
      assert.equal(depotTrips.length, 1, 'two trips actually returns to collect the stored cargo');
    }
    assert.equal(game.getState().rewardCount, 1);
  }
});

test('capacity is replaced by another recoverable event when only one step or one loaded unit remains', () => {
  for (let seed = 0; seed < 100; seed++) {
    const game = afterFirstDelivery(seed, 'normal');
    if (game.getState().eventHistory.some(event => event.id === 'shortage')) {
      assert.equal(game.getState().event, null, 'a resolved pre-loading shortage does not create a second event');
      continue;
    }
    assert.ok(game.getState().event);
    assert.notEqual(game.getState().event.id, 'capacity');
  }
  const game = afterFirstDelivery(11, 'challenge', false);
  assert.ok(game.getState().event);
  assert.notEqual(game.getState().event.id, 'capacity');
  resolveEvent(game);
  finishDeliveries(game);
});

test('repair pump takes three active clicks, helper takes one, and paused or completed events cannot add progress', () => {
  for (const optionId of ['pump', 'helper']) {
    const game = afterFirstDelivery(10);
    assert.equal(game.getState().event.id, 'repair');
    assert.match(game.getState().event.message, /0\/3/);
    assert.match(game.getState().event.options[0].label, /0\/3/);
    const before = game.getState();
    game.dispatch({ type: 'PAUSE', value: true });
    const paused = game.getState();
    for (let click = 0; click < 5; click++) assert.equal(game.dispatch({ type: 'RESOLVE_EVENT', optionId }).accepted, false);
    assert.deepEqual(game.getState(), paused);
    game.dispatch({ type: 'PAUSE', value: false });
    const requiredClicks = optionId === 'pump' ? 3 : 1;
    for (let click = 1; click <= requiredClicks; click++) {
      const result = game.dispatch({ type: 'RESOLVE_EVENT', optionId });
      assert.equal(result.accepted, true);
      assert.equal(game.getState().rewardCount, 0);
      assert.deepEqual(game.getState().cargo, before.cargo);
      assert.deepEqual(game.getState().completed, before.completed);
      if (click < requiredClicks) {
        assert.equal(game.getState().phase, 'event');
        assert.equal(game.getState().event.progress, click);
        assert.match(game.getState().event.message, new RegExp(`${click}/3`));
        assert.match(game.getState().event.options[0].label, new RegExp(`${click}/3`));
        assert.equal(game.getState().vehicleHealth, 'soft-tyre');
        assert.deepEqual(game.getState().eventHistory, []);
        assert.ok(result.events.every(event => event.type !== 'feedback' || event.kind !== 'success'));
      } else {
        assert.equal(game.getState().event, null);
        assert.equal(game.getState().vehicleHealth, optionId === 'pump' ? 'pumped' : 'serviced');
        assert.ok(result.events.some(event => event.type === 'feedback' && event.kind === 'success'));
      }
    }
    const resolved = game.getState();
    for (let click = 0; click < 5; click++) assert.equal(game.dispatch({ type: 'RESOLVE_EVENT', optionId }).accepted, false);
    assert.deepEqual(game.getState(), resolved);
    finishDeliveries(game);
  }
  const game = afterFirstDelivery(10);
  game.dispatch({ type: 'RESOLVE_EVENT', optionId: 'pump' });
  game.dispatch({ type: 'RESOLVE_EVENT', optionId: 'helper' });
  assert.equal(game.getState().event, null, 'helper remains available after partial pumping');
  assert.deepEqual(game.getState().eventHistory, [{ id: 'repair', option: 'helper' }]);
  finishDeliveries(game);
});

test('shortage alternate source remains playable when the workshop is also a mission destination', () => {
  let checked = 0, checkedWorkshopDelivery = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const game = createGame({ seed, difficulty: 'challenge' });
    chooseVehicle(game, null);
    const steps = game.getState().mission.steps;
    if (game.getState().event?.id !== 'shortage') continue;
    checked++;
    game.dispatch({ type: 'RESOLVE_EVENT', optionId: 'pickup' });
    const unavailable = game.getState().shortageGoodId;
    game.dispatch({ type: 'LOAD', goodId: unavailable });
    assert.equal(game.getState().cargo.length, 0, 'depot shelf really is unavailable');
    game.dispatch({ type: 'TRAVEL', placeId: 'garage' });
    if (game.getState().phase === 'moving') game.dispatch({ type: 'ARRIVE' });
    assert.equal(game.getState().phase, 'loading');
    for (const step of steps) game.dispatch({ type: 'LOAD', goodId: step.goodId });
    assert.equal(game.getState().cargo.length, steps.length, 'alternate source supplies missing cargo');
    game.dispatch({ type: 'DEPART' });
    assert.equal(game.getState().phase, 'delivery', 'leaving workshop shelf exposes delivery, not a dead end');
    for (const step of steps) {
      if (step.placeId === 'garage') checkedWorkshopDelivery++;
      go(game, step.placeId);
      game.dispatch({ type: 'DELIVER', goodId: step.goodId });
    }
    assert.equal(game.getState().phase, 'reward', `shortage seed ${seed} recovers`);
  }
  assert.ok(checked > 100); assert.ok(checkedWorkshopDelivery > 10);
});

test('capacity is enforced without destroying cargo, and partial loads can finish a mission in multiple trips', () => {
  const game = createGame({ seed: 17, difficulty: 'normal' });
  chooseVehicle(game);
  const state = game.getState();
  const limit = VEHICLES.find(vehicle => vehicle.id === state.vehicleId).capacity;
  const wrong = state.mission.shelf.find(id => !state.mission.steps.some(step => step.goodId === id));
  for (let i = 0; i < limit + 3; i++) game.dispatch({ type: 'LOAD', goodId: wrong });
  assert.equal(game.getState().cargo[0].quantity, limit);
  for (let i = 0; i < limit; i++) game.dispatch({ type: 'UNLOAD', goodId: wrong });
  assert.deepEqual(game.getState().cargo, []);
  for (const step of state.mission.steps) {
    if (game.getState().location !== 'depot') go(game, 'depot');
    game.dispatch({ type: 'LOAD', goodId: step.goodId });
    game.dispatch({ type: 'DEPART' });
    go(game, step.placeId);
    game.dispatch({ type: 'DELIVER', goodId: step.goodId });
    const event = game.getState().event;
    if (event) resolveEvent(game);
  }
  assert.equal(game.getState().phase, 'reward');
});

test('changing sessions is deterministic and preserves earned rewards; snapshots and notifications cannot mutate state', () => {
  const game = createGame({ seed: 'little-town', saved: { rewardCount: 4 } });
  let calls = 0;
  const unsubscribe = game.subscribe(state => { calls++; state.phase = 'reward'; });
  assert.equal(calls, 0);
  const snapshot = game.getState(); snapshot.map.places.length = 0; snapshot.mission.steps[0].quantity = 100;
  assert.equal(game.getState().map.places.length, 9);
  game.dispatch({ type: 'ACK_BRIEF' });
  assert.equal(calls, 1); assert.equal(game.getState().phase, 'selectVehicle');
  unsubscribe();
  game.dispatch({ type: 'NEW_SESSION', seed: 91, difficulty: 'challenge' });
  const state = game.getState();
  assert.equal(calls, 1); assert.equal(state.rewardCount, 4);
  assert.deepEqual(state, createGame({ seed: 91, difficulty: 'challenge', saved: { rewardCount: 4 } }).getState());
  assert.equal(createGame({ difficulty: 'invalid', saved: { rewardCount: -2 } }).getState().rewardCount, 0);
});
