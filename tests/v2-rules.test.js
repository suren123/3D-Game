import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, generateMap, findRoute } from '../src/v2/rules.js';
import { GOODS, VEHICLES, PLACES, THEMES, TEMPLATES, EVENTS, DIFFICULTIES } from '../src/v2/catalog.js';

const edgeKey = edge => [...edge].sort().join(':');
const cargoCount = state => state.cargo.reduce((sum, item) => sum + item.quantity, 0);
const progress = state => ({ cargo: state.cargo, completed: state.completed, delivered: state.delivered, rewardCount: state.rewardCount });
const code = result => result.events.findLast(event => event.type === 'feedback')?.feedbackCode;
function chooseVehicle(game) {
  assert.equal(game.dispatch({ type: 'ACK_BRIEF' }).accepted, true);
  const id = game.getState().mission.vehicleChoices[0];
  assert.equal(game.dispatch({ type: 'SELECT_VEHICLE', vehicleId: id }).accepted, true);
  assert.equal(game.getState().phase, 'loading');
}
function loadMission(game) {
  for (const step of game.getState().mission.steps) for (let count = 0; count < step.quantity; count++) {
    assert.equal(game.dispatch({ type: 'LOAD', goodId: step.goodId }).accepted, true);
  }
  assert.equal(game.dispatch({ type: 'DEPART' }).accepted, true);
}
function go(game, placeId) {
  const result = game.dispatch({ type: 'TRAVEL', placeId });
  assert.equal(result.accepted, true, `can travel to ${placeId}`);
  if (result.state.phase === 'moving') {
    assert.ok(result.events.some(event => event.type === 'travel' && event.route.length > 0));
    assert.equal(game.dispatch({ type: 'ARRIVE' }).accepted, true);
  }
  assert.equal(game.getState().location, placeId);
}
function solveMission(game, reverse = false) {
  chooseVehicle(game); loadMission(game);
  const steps = game.getState().mission.steps;
  for (const step of reverse ? [...steps].reverse() : steps) {
    go(game, step.placeId);
    for (let count = 0; count < step.quantity; count++) assert.equal(game.dispatch({ type: 'DELIVER', goodId: step.goodId }).accepted, true);
  }
  assert.equal(game.getState().phase, 'reward');
}

// The geometry contracts remain independent of the simplified mission choices.
test('finite content and child-facing names remain available', () => {
  assert.equal(VEHICLES.length, 10); assert.equal(GOODS.length, 12); assert.equal(PLACES.length, 9);
  assert.equal(TEMPLATES.length, 8); assert.equal(THEMES.length, 3); assert.equal(EVENTS.length, 4);
  for (const list of [VEHICLES, GOODS, TEMPLATES, PLACES, THEMES, EVENTS]) assert.equal(new Set(list.map(item => item.id)).size, list.length);
  assert.ok(GOODS.every(good => [...good.name].length <= 3));
  assert.deepEqual(DIFFICULTIES.map(item => item.name), ['轻松', '记忆', '配对']);
  assert.deepEqual(PLACES.map(place => place.name), ['仓库', '公园', '学校', '医院', '农场', '餐厅', '车库', '商店', '营地']);
  for (const template of TEMPLATES) {
    assert.equal(template.places.length, 2);
    for (const goodId of template.goods) assert.ok(GOODS.some(good => good.id === goodId));
    for (const placeId of template.places) assert.ok(PLACES.some(place => place.id === placeId));
  }
});

test('1000 seeds: connected reproducible maps and all three simplified three-errand sessions complete without automatic events', () => {
  const layouts = new Set(), topologies = new Set(), themes = new Set(), templates = new Set(), goodsSeen = new Set(), destinations = new Set(), vehiclesSeen = new Set();
  for (let seed = 0; seed < 1000; seed++) {
    const map = generateMap(seed);
    assert.deepEqual(map, generateMap(seed));
    assert.equal(map.nodes.length, 16); assert.equal(map.places.length, 9);
    assert.equal(new Set(map.nodes.map(node => node.x)).size, 4);
    assert.equal(new Set(map.nodes.map(node => node.z)).size, 4);
    assert.ok([10.5, 11].includes(map.layout.spacingX) && [10.5, 11].includes(map.layout.spacingZ));
    assert.ok(map.nodes.every(node => node.x >= map.layout.bounds.minX && node.x <= map.layout.bounds.maxX && node.z >= map.layout.bounds.minZ && node.z <= map.layout.bounds.maxZ));
    assert.ok(map.edges.length >= 18 && map.edges.length <= 20);
    const degrees = new Map(map.nodes.map(node => [node.id, 0]));
    for (const edge of map.edges) for (const nodeId of edge) degrees.set(nodeId, degrees.get(nodeId) + 1);
    assert.ok([...degrees.values()].includes(1));
    assert.equal(new Set(map.edges.map(edgeKey)).size, map.edges.length);
    for (const [fromId, toId] of map.edges) {
      const from = map.nodes.find(node => node.id === fromId), to = map.nodes.find(node => node.id === toId);
      assert.equal(Math.abs(from.x - to.x) + Math.abs(from.z - to.z), from.x === to.x ? map.layout.spacingZ : map.layout.spacingX);
    }
    assert.equal(new Set(map.places.map(place => place.nodeId)).size, PLACES.length);
    for (const place of map.places) {
      const node = map.nodes.find(node => node.id === place.nodeId);
      assert.deepEqual({ x: place.x, z: place.z }, { x: node.x, z: node.z });
    }
    for (const from of PLACES) for (const to of PLACES) assert.ok(findRoute(map, from.id, to.id).length, `${seed}: ${from.id} to ${to.id}`);
    layouts.add(JSON.stringify({ places: map.places, edges: map.edges }));
    topologies.add(JSON.stringify(map.edges.map(edgeKey).sort())); themes.add(map.theme);
    for (const difficulty of ['easy', 'normal', 'challenge']) {
      const game = createGame({ seed, difficulty });
      assert.deepEqual(game.getState(), createGame({ seed, difficulty }).getState());
      const emitted = [];
      game.subscribe((_, events) => emitted.push(...events));
      for (let round = 0; round < 3; round++) {
        const { mission } = game.getState();
        templates.add(mission.templateId);
        assert.equal(game.getState().difficulty, difficulty, 'no automatic difficulty increase');
        assert.equal(mission.steps.length, difficulty === 'easy' ? 1 : 2);
        assert.equal(mission.ordered, false);
        const targetPlaces = new Set(mission.steps.map(step => step.placeId));
        assert.equal(targetPlaces.size, difficulty === 'challenge' ? 2 : 1);
        assert.equal(new Set(mission.steps.map(step => step.goodId)).size, mission.steps.length);
        assert.ok(mission.steps.every(step => difficulty === 'easy' ? [1, 2].includes(step.quantity) : step.quantity === 1));
        assert.equal(mission.shelf.length, difficulty === 'easy' ? 3 : 4);
        assert.deepEqual(mission.shelfChoices, mission.shelf);
        assert.equal(new Set(mission.shelf).size, mission.shelf.length);
        assert.equal(mission.destinationChoices.length, 4);
        assert.equal(new Set(mission.destinationChoices).size, 4);
        assert.ok(!mission.destinationChoices.includes('depot'));
        for (const step of mission.steps) {
          assert.ok(mission.shelf.includes(step.goodId)); assert.ok(mission.destinationChoices.includes(step.placeId));
          goodsSeen.add(step.goodId); destinations.add(step.placeId);
        }
        const total = mission.steps.reduce((sum, step) => sum + step.quantity, 0);
        const suitable = VEHICLES.filter(vehicle => vehicle.capacity >= total && mission.requiredTags.every(tag => vehicle.supports.includes(tag)));
        assert.equal(mission.vehicleChoices.length, Math.min(2, suitable.length), 'cold cargo has one real suitable vehicle');
        for (const id of mission.vehicleChoices) {
          assert.ok(suitable.some(vehicle => vehicle.id === id)); vehiclesSeen.add(id);
        }
        solveMission(game, seed % 2 === 0);
        const state = game.getState();
        assert.deepEqual(state.map, map, 'map stays stable during the session');
        assert.equal(state.event, null); assert.deepEqual(state.eventHistory, []); assert.equal(state.eventUsed, false);
        assert.equal(state.rewardCount, round + 1); assert.deepEqual(state.cargo, []);
        assert.equal(state.completed.length, mission.steps.length);
        for (const [index, step] of mission.steps.entries()) assert.equal(state.delivered[index], step.quantity);
        game.dispatch({ type: 'NEXT' });
      }
      const state = game.getState();
      assert.equal(state.phase, 'sessionComplete'); assert.equal(state.rewardCount, 3);
      assert.equal(new Set(state.history.map(entry => entry.templateId)).size, 3);
      assert.ok(!emitted.some(event => event.type === 'event'));
      assert.ok(emitted.filter(event => event.type === 'feedback').every(event => [...event.text].length <= 3));
    }
  }
  assert.ok(layouts.size > 990); assert.ok(topologies.size >= 250);
  assert.equal(themes.size, 3); assert.equal(templates.size, 8); assert.equal(goodsSeen.size, 12); assert.equal(vehiclesSeen.size, 10);
  assert.deepEqual([...destinations].sort(), PLACES.filter(place => place.id !== 'depot').map(place => place.id).sort());
});

test('wrong destination never drives; missing cargo at a correct destination recovers through the depot', () => {
  const game = createGame({ seed: 42 }); chooseVehicle(game);
  const { mission } = game.getState(), step = mission.steps[0];
  const wrongGood = mission.shelf.find(id => id !== step.goodId);
  game.dispatch({ type: 'LOAD', goodId: wrongGood }); game.dispatch({ type: 'DEPART' });
  const wrongPlace = mission.destinationChoices.find(id => id !== step.placeId);
  const before = game.getState();
  const wrong = game.dispatch({ type: 'TRAVEL', placeId: wrongPlace });
  assert.equal(wrong.accepted, false); assert.equal(code(wrong), 'wrong-place');
  assert.ok(!wrong.events.some(event => event.type === 'travel'));
  assert.equal(wrong.state.location, before.location); assert.equal(wrong.state.phase, before.phase);
  assert.deepEqual(progress(wrong.state), progress(before));
  game.dispatch({ type: 'TRAVEL', placeId: step.placeId });
  const arrival = game.dispatch({ type: 'ARRIVE' });
  assert.equal(code(arrival), 'missing-cargo'); assert.equal(arrival.state.location, step.placeId);
  const arrived = game.getState();
  const wrongItem = game.dispatch({ type: 'DELIVER', goodId: wrongGood });
  assert.equal(wrongItem.accepted, false); assert.equal(code(wrongItem), 'wrong-item');
  assert.deepEqual(progress(wrongItem.state), progress(arrived));
  const missing = game.dispatch({ type: 'DELIVER', goodId: step.goodId });
  assert.equal(missing.accepted, false); assert.equal(code(missing), 'missing-cargo');
  assert.deepEqual(progress(missing.state), progress(arrived));
  go(game, 'depot'); assert.equal(game.getState().feedbackCode, 'supply');
  game.dispatch({ type: 'UNLOAD', goodId: wrongGood });
  for (let count = 0; count < step.quantity; count++) game.dispatch({ type: 'LOAD', goodId: step.goodId });
  game.dispatch({ type: 'DEPART' }); go(game, step.placeId);
  for (let count = 0; count < step.quantity; count++) game.dispatch({ type: 'DELIVER', goodId: step.goodId });
  assert.equal(game.getState().feedbackCode, 'reward'); assert.equal(game.getState().rewardCount, 1);
});

test('two destinations accept either order and completed stops never consume cargo or drive again', () => {
  for (const firstIndex of [0, 1]) {
    const game = createGame({ seed: 83, difficulty: 'challenge' }); chooseVehicle(game); loadMission(game);
    const steps = game.getState().mission.steps, first = steps[firstIndex], second = steps[1 - firstIndex];
    go(game, first.placeId);
    const result = game.dispatch({ type: 'DELIVER', goodId: first.goodId });
    assert.equal(result.accepted, true); assert.equal(code(result), 'next-stop');
    assert.deepEqual(result.state.completed, [firstIndex]);
    const before = progress(game.getState());
    const duplicate = game.dispatch({ type: 'DELIVER', goodId: first.goodId });
    assert.equal(duplicate.accepted, false); assert.equal(code(duplicate), 'place-done'); assert.deepEqual(progress(duplicate.state), before);
    const sameStop = game.dispatch({ type: 'TRAVEL', placeId: first.placeId });
    assert.equal(code(sameStop), 'place-done'); assert.ok(!sameStop.events.some(event => event.type === 'travel'));
    go(game, second.placeId);
    const repeat = game.dispatch({ type: 'TRAVEL', placeId: first.placeId });
    assert.equal(repeat.accepted, false); assert.equal(code(repeat), 'place-done');
    assert.equal(game.getState().location, second.placeId);
    const reward = game.dispatch({ type: 'DELIVER', goodId: second.goodId });
    assert.equal(code(reward), 'reward'); assert.equal(reward.state.rewardCount, 1);
  }
});

test('empty departure is refused, moving travel fails explicitly, and the original destination stays intact', () => {
  const game = createGame({ seed: 7, difficulty: 'challenge' }); chooseVehicle(game);
  const empty = game.dispatch({ type: 'DEPART' });
  assert.equal(empty.accepted, false); assert.equal(code(empty), 'empty-cargo'); assert.equal(empty.state.phase, 'loading');
  const bypass = game.dispatch({ type: 'TRAVEL', placeId: empty.state.mission.steps[0].placeId });
  assert.equal(bypass.accepted, false); assert.equal(code(bypass), 'empty-cargo'); assert.equal(bypass.state.phase, 'loading');
  loadMission(game);
  const [first, second] = game.getState().mission.steps;
  game.dispatch({ type: 'TRAVEL', placeId: first.placeId });
  let notified = false;
  const unsubscribe = game.subscribe((_, events) => { notified = events.some(event => event.feedbackCode === 'moving'); });
  const moving = game.dispatch({ type: 'TRAVEL', placeId: second.placeId });
  unsubscribe();
  assert.equal(moving.accepted, false); assert.equal(code(moving), 'moving'); assert.ok(notified);
  assert.equal(moving.state.currentDestination, first.placeId); assert.ok(!moving.events.some(event => event.type === 'travel'));
  game.dispatch({ type: 'ARRIVE' }); assert.equal(game.getState().location, first.placeId);
});

test('a partial load refuses empty travel to the next task but keeps depot recovery available', () => {
  const game = createGame({ seed: 18, difficulty: 'challenge' }); chooseVehicle(game);
  const [first, second] = game.getState().mission.steps;
  game.dispatch({ type: 'LOAD', goodId: first.goodId }); game.dispatch({ type: 'DEPART' }); go(game, first.placeId);
  game.dispatch({ type: 'DELIVER', goodId: first.goodId }); assert.equal(cargoCount(game.getState()), 0);
  const empty = game.dispatch({ type: 'TRAVEL', placeId: second.placeId });
  assert.equal(empty.accepted, false); assert.equal(code(empty), 'empty-cargo');
  assert.equal(empty.state.location, first.placeId); assert.ok(!empty.events.some(event => event.type === 'travel'));
  go(game, 'depot'); game.dispatch({ type: 'LOAD', goodId: second.goodId }); game.dispatch({ type: 'DEPART' }); go(game, second.placeId);
  game.dispatch({ type: 'DELIVER', goodId: second.goodId }); assert.equal(game.getState().phase, 'reward');
});

test('capacity and aggregate cargo remain bounded, unload restores space', () => {
  const game = createGame({ seed: 17, difficulty: 'normal' }); chooseVehicle(game);
  const state = game.getState(), limit = VEHICLES.find(vehicle => vehicle.id === state.vehicleId).capacity;
  const wrong = state.mission.shelf.find(id => !state.mission.steps.some(step => step.goodId === id));
  for (let count = 0; count < limit + 3; count++) game.dispatch({ type: 'LOAD', goodId: wrong });
  assert.deepEqual(game.getState().cargo, [{ goodId: wrong, quantity: limit }]);
  assert.equal(game.getState().feedbackCode, 'capacity-full');
  for (let count = 0; count < limit; count++) game.dispatch({ type: 'UNLOAD', goodId: wrong });
  assert.deepEqual(game.getState().cargo, []); loadMission(game);
  for (const step of state.mission.steps) { go(game, step.placeId); game.dispatch({ type: 'DELIVER', goodId: step.goodId }); }
  assert.equal(game.getState().phase, 'reward');
});

test('pause, duplicate arrivals and repeated deliveries never advance or duplicate rewards', () => {
  const game = createGame({ seed: 7 }); chooseVehicle(game); loadMission(game);
  const step = game.getState().mission.steps[0]; game.dispatch({ type: 'TRAVEL', placeId: step.placeId });
  game.dispatch({ type: 'PAUSE', value: true }); const frozen = game.getState();
  for (const type of ['ARRIVE', 'ACK_BRIEF', 'DEPART', 'NEXT', 'DELIVER']) assert.equal(game.dispatch({ type, goodId: step.goodId }).accepted, false);
  assert.deepEqual(game.getState(), frozen); game.dispatch({ type: 'PAUSE', value: false }); game.dispatch({ type: 'ARRIVE' });
  assert.equal(game.dispatch({ type: 'ARRIVE' }).accepted, false);
  for (let count = 0; count < 10; count++) game.dispatch({ type: 'DELIVER', goodId: step.goodId });
  assert.equal(game.getState().rewardCount, 1); game.dispatch({ type: 'NEXT' });
  assert.equal(game.dispatch({ type: 'NEXT' }).accepted, false); assert.equal(game.getState().round, 1);
});

test('session changes are deterministic, preserve earned rewards, and isolate snapshots and subscribers', () => {
  const game = createGame({ seed: 'little-town', saved: { rewardCount: 4 } }); let calls = 0;
  const unsubscribe = game.subscribe(state => { calls++; state.phase = 'reward'; });
  const snapshot = game.getState(); snapshot.map.places.length = 0; snapshot.mission.steps[0].quantity = 100;
  assert.equal(game.getState().map.places.length, 9); game.dispatch({ type: 'ACK_BRIEF' });
  assert.equal(calls, 1); assert.equal(game.getState().phase, 'selectVehicle'); unsubscribe();
  game.dispatch({ type: 'NEW_SESSION', seed: 91, difficulty: 'challenge' });
  assert.equal(calls, 1); assert.equal(game.getState().rewardCount, 4);
  assert.deepEqual(game.getState(), createGame({ seed: 91, difficulty: 'challenge', saved: { rewardCount: 4 } }).getState());
  assert.equal(createGame({ difficulty: 'invalid', saved: { rewardCount: -2 } }).getState().rewardCount, 0);
});
