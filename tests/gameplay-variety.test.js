import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/v2/rules.js';
import { GOODS, VEHICLES } from '../src/v2/catalog.js';

function selectSuitableVehicle(game) {
  game.dispatch({ type: 'ACK_BRIEF' });
  const { mission } = game.getState();
  const id = mission.vehicleChoices.find(id => mission.requiredTags.every(tag =>
    VEHICLES.find(vehicle => vehicle.id === id).supports.includes(tag)));
  assert.ok(id, 'the themed task still offers a suitable vehicle');
  return game.dispatch({ type: 'SELECT_VEHICLE', vehicleId: id });
}

function arrive(game, placeId) {
  game.dispatch({ type: 'TRAVEL', placeId });
  if (game.getState().phase === 'moving') game.dispatch({ type: 'ARRIVE' });
  assert.equal(game.getState().location, placeId);
}

test('1000 seeds retain defining passenger/tools tasks and show stock shortages before any loading', () => {
  const themes = { shuttle: 0, repair: 0 }, shortages = { normal: 0, challenge: 0 };
  let passengerErrandShortages = 0;
  for (let seed = 0; seed < 1000; seed++) for (const difficulty of ['easy', 'normal', 'challenge']) {
    const game = createGame({ seed, difficulty }), before = game.getState();
    const required = { shuttle: 'passenger', repair: 'tools' }[before.mission.templateId];
    if (required) {
      themes[before.mission.templateId]++;
      assert.ok(before.mission.steps.some(step => step.goodId === required), `${difficulty}/${seed}: defining item survives sampling`);
    }
    assert.equal(before.mission.steps.length, { easy: 1, normal: 2, challenge: 3 }[difficulty]);
    const result = selectSuitableVehicle(game), state = result.state;
    assert.deepEqual(state.cargo, []);
    assert.deepEqual(state.completed, []);
    assert.equal(state.rewardCount, 0);
    if (state.event) {
      assert.notEqual(difficulty, 'easy');
      assert.equal(state.event.id, 'shortage');
      assert.equal(state.phase, 'event');
      assert.equal(state.location, 'depot');
      assert.ok(before.mission.steps.some(step => step.goodId === state.shortageGoodId));
      assert.notEqual(GOODS.find(good => good.id === state.shortageGoodId).tag, 'passenger', 'a passenger never becomes shelf stock');
      assert.ok(result.events.some(event => event.type === 'event' && event.id === 'shortage'));
      shortages[difficulty]++;
      if (required === 'passenger') passengerErrandShortages++;
    } else assert.equal(state.phase, 'loading', 'the three delivery events do not interrupt packing');
  }
  assert.ok(themes.shuttle > 200 && themes.repair > 200);
  assert.ok(shortages.normal > 100 && shortages.challenge > 100);
  assert.ok(passengerErrandShortages > 10, 'passenger errands also exercise safe physical-stock selection');
});

test('both free pre-loading shortage choices preserve progress and produce genuinely different supply trips', () => {
  for (const difficulty of ['normal', 'challenge']) for (const optionId of ['reserve', 'pickup']) {
    // Seed 1 chooses a shortage; its repair task also visits the alternate supply location.
    const game = createGame({ seed: 1, difficulty });
    selectSuitableVehicle(game);
    const before = game.getState();
    assert.equal(before.event?.id, 'shortage');
    const blockedGood = before.shortageGoodId;
    assert.equal(game.dispatch({ type: 'LOAD', goodId: blockedGood }).accepted, false, 'packing waits for a free recovery choice');
    game.dispatch({ type: 'PAUSE', value: true });
    assert.equal(game.dispatch({ type: 'RESOLVE_EVENT', optionId }).accepted, false);
    game.dispatch({ type: 'PAUSE', value: false });
    game.dispatch({ type: 'RESOLVE_EVENT', optionId });
    const restored = game.getState();
    assert.equal(restored.phase, 'loading');
    assert.deepEqual(restored.mission, before.mission);
    assert.deepEqual(restored.cargo, before.cargo);
    assert.deepEqual(restored.completed, before.completed);
    assert.equal(restored.rewardCount, 0);
    assert.deepEqual(restored.eventHistory, [{ id: 'shortage', option: optionId }]);
    assert.equal(game.dispatch({ type: 'RESOLVE_EVENT', optionId }).accepted, false, 'repeating a resolved choice has no effect');

    const trips = [];
    game.subscribe((_, events) => trips.push(...events.filter(event => event.type === 'travel').map(event => event.placeId)));
    for (const step of before.mission.steps) game.dispatch({ type: 'LOAD', goodId: step.goodId });
    const packedAtDepot = game.getState();
    assert.equal(packedAtDepot.cargo.some(item => item.goodId === blockedGood), optionId === 'reserve');
    if (optionId === 'pickup') {
      arrive(game, 'garage');
      assert.equal(game.getState().phase, 'loading');
      game.dispatch({ type: 'LOAD', goodId: blockedGood });
      assert.ok(game.getState().cargo.some(item => item.goodId === blockedGood), 'the same physical item is available at the alternate source');
    }
    game.dispatch({ type: 'DEPART' });
    for (const step of before.mission.steps) {
      arrive(game, step.placeId);
      if (game.getState().phase === 'loading') game.dispatch({ type: 'DEPART' });
      game.dispatch({ type: 'DELIVER', goodId: step.goodId });
      assert.equal(game.getState().event, null, 'the resolved shortage cannot be followed by a second interruption');
    }
    assert.equal(game.getState().phase, 'reward');
    assert.equal(game.getState().rewardCount, 1);
    assert.equal(game.getState().eventHistory.length, 1);
    assert.equal(trips[0] === 'garage', optionId === 'pickup', 'only the pickup choice needs an extra supply trip before delivery');
  }
});
