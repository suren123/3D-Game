import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS, MISSIONS, createGame, findRoute } from '../src/game.js';

function finishMission(game) {
  const mission = MISSIONS.find(({ id }) => id === game.getState().missionId);
  mission.steps.forEach((step, index) => {
    assert.equal(game.arrive(step.location), true);
    assert.equal(game.getState().phase, 'action');
    assert.equal(game.act(), true);
    if (index < mission.steps.length - 1) {
      assert.equal(game.getState().phase, 'celebration');
      assert.equal(game.advance(), true);
    }
  });
  assert.equal(game.getState().phase, 'complete');
}

test('all six task steps can be completed, then the town loops for gentle replay', () => {
  const game = createGame();
  assert.equal(game.getState().location, 'garage');
  for (const [index, mission] of MISSIONS.entries()) {
    assert.equal(game.getState().missionId, mission.id);
    finishMission(game);
    assert.equal(game.getState().completedCount, index + 1);
    assert.equal(game.nextMission(), true);
  }
  assert.equal(game.getState().missionId, 'bread');
  assert.deepEqual(game.getState().stickers, ['bread', 'flowers', 'wash']);
});

test('exploring the wrong place cannot complete an action; leaving target revokes action', () => {
  const game = createGame();
  game.arrive('park');
  assert.equal(game.getState().location, 'park');
  assert.equal(game.getState().target, 'bakery');
  assert.equal(game.act(), false);
  game.arrive('bakery');
  assert.equal(game.getState().phase, 'action');
  game.arrive('wash');
  assert.equal(game.getState().phase, 'travel');
  assert.equal(game.act(), false);
  assert.equal(game.getState().stepIndex, 0);
  assert.equal(game.getState().completedCount, 0);
});

test('rapid or out-of-order commands cannot skip steps or claim rewards', () => {
  const game = createGame();
  assert.equal(game.act(), false);
  assert.equal(game.advance(), false);
  assert.equal(game.nextMission(), false);
  game.arrive('bakery');
  assert.equal(game.act(), true);
  assert.equal(game.act(), false);
  assert.equal(game.nextMission(), false);
  game.arrive('park');
  assert.equal(game.getState().phase, 'celebration');
  assert.equal(game.act(), false);
  assert.equal(game.advance(), true);
  assert.equal(game.advance(), false);
  assert.equal(game.getState().phase, 'action');
  assert.equal(game.act(), true);
  assert.equal(game.act(), false);
  assert.equal(game.advance(), false);
  assert.deepEqual(game.getState().stickers, ['bread']);
});

test('replaying a mission is allowed and earns no duplicate stickers', () => {
  const game = createGame();
  finishMission(game);
  assert.equal(game.selectMission('bread'), true);
  finishMission(game);
  assert.deepEqual(game.getState().stickers, ['bread']);
  assert.equal(game.getState().completedCount, 1);
});

test('saved data restores only known, unique sticker IDs, never in-flight state', () => {
  const game = createGame({
    stickers: ['bread', 'oops', 'flowers', 'bread', null, {}, '__proto__'],
    missionId: 'wash', phase: 'complete', stepIndex: 100, location: 'wash',
  });
  assert.deepEqual(game.getState(), {
    missionId: 'bread', stepIndex: 0, location: 'garage', target: 'bakery',
    phase: 'travel', stickers: ['bread', 'flowers'], completedCount: 2,
  });
  for (const saved of [undefined, null, 3, 'bread', { stickers: 'bread' }]) {
    assert.deepEqual(createGame(saved).getState().stickers, []);
  }
});

test('selecting another task preserves the car and rewards, resetting only task progress', () => {
  const game = createGame({ stickers: ['bread'] });
  game.arrive('garden');
  assert.equal(game.selectMission('flowers'), true);
  assert.equal(game.getState().phase, 'action');
  assert.equal(game.getState().location, 'garden');
  assert.deepEqual(game.getState().stickers, ['bread']);
  const before = game.getState();
  assert.equal(game.selectMission('missing'), false);
  assert.equal(game.arrive('__proto__'), false);
  assert.deepEqual(game.getState(), before);
});

test('all location pairs route on the road grid without cutting diagonally', () => {
  for (const from of Object.values(LOCATIONS)) {
    for (const to of Object.values(LOCATIONS)) {
      const route = findRoute(from.id, to.id);
      assert.deepEqual(route[0], from.node);
      assert.deepEqual(route.at(-1), to.node);
      const distance = Math.abs(from.node[0] - to.node[0]) + Math.abs(from.node[1] - to.node[1]);
      assert.equal(route.length, distance / 5 + 1);
      route.forEach(([x, z], index) => {
        assert.ok([-5, 0, 5].includes(x) && [-5, 0, 5].includes(z));
        if (index > 0) {
          const [prevX, prevZ] = route[index - 1];
          assert.equal(Math.abs(x - prevX) + Math.abs(z - prevZ), 5);
        }
      });
    }
  }
  assert.deepEqual(findRoute('missing', 'park'), []);
  assert.deepEqual(findRoute('garage', '__proto__'), []);
});

test('snapshots and routes cannot mutate the game, subscriber copies are independent', () => {
  const game = createGame();
  const snapshot = game.getState();
  snapshot.phase = 'complete';
  snapshot.stickers.push('wash');
  const route = findRoute('garage', 'bakery');
  route[0][0] = 999;
  assert.deepEqual(LOCATIONS.garage.node, [-5, -5]);
  assert.equal(game.getState().phase, 'travel');
  assert.deepEqual(game.getState().stickers, []);
  let notifications = 0;
  const stop = game.subscribe((state) => {
    notifications += 1;
    state.stickers.push('flowers');
  });
  game.subscribe((state) => assert.deepEqual(state.stickers, []));
  game.arrive('bakery');
  assert.equal(notifications, 2);
  stop();
  game.act();
  assert.equal(notifications, 2);
});

test('reset returns to a fresh town after earning rewards', () => {
  const game = createGame({ stickers: ['bread', 'flowers', 'wash'] });
  game.selectMission('wash');
  game.arrive('wash');
  game.act();
  assert.equal(game.reset(), true);
  assert.deepEqual(game.getState(), createGame().getState());
});
