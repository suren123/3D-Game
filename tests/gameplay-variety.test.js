import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/v2/rules.js';

test('1000 seeds keep the defining tools/passenger item and every default loading phase stays uninterrupted', () => {
  const themes = { shuttle: 0, repair: 0 };
  for (let seed = 0; seed < 1000; seed++) for (const difficulty of ['easy', 'normal', 'challenge']) {
    const game = createGame({ seed, difficulty }), before = game.getState();
    const required = { shuttle: 'passenger', repair: 'tools' }[before.mission.templateId];
    if (required) {
      themes[before.mission.templateId]++;
      assert.ok(before.mission.steps.some(step => step.goodId === required), `${difficulty}/${seed}: defining item survives sampling`);
    }
    assert.equal(before.mission.steps.length, difficulty === 'easy' ? 1 : 2);
    game.dispatch({ type: 'ACK_BRIEF' });
    const result = game.dispatch({ type: 'SELECT_VEHICLE', vehicleId: before.mission.vehicleChoices[0] });
    assert.equal(result.state.phase, 'loading'); assert.equal(result.state.event, null);
    assert.deepEqual(result.state.cargo, []); assert.deepEqual(result.state.completed, []);
    assert.deepEqual(result.state.eventHistory, []); assert.equal(result.state.eventUsed, false);
    assert.ok(!result.events.some(event => event.type === 'event'));
    assert.equal(game.dispatch({ type: 'RESOLVE_EVENT', optionId: 'reserve' }).accepted, false);
  }
  assert.ok(themes.shuttle > 200 && themes.repair > 200);
});
