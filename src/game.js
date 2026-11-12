/** Pure game rules. Rendering and persistence are deliberately owned by the UI. */
function freezeDeep(value) {
  Object.values(value).forEach((child) => {
    if (child && typeof child === 'object') freezeDeep(child);
  });
  return Object.freeze(value);
}

export const LOCATIONS = freezeDeep({
  garage: { id: 'garage', name: '小车车库', node: [-5, -5], building: [-7, -6.5], icon: '🏠' },
  bakery: { id: 'bakery', name: '面包店', node: [0, -5], building: [0, -7], icon: '🥖' },
  garden: { id: 'garden', name: '小花房', node: [5, -5], building: [6.8, -6.5], icon: '🌼' },
  station: { id: 'station', name: '消防站', node: [-5, 0], building: [-7, 0.6], icon: '🚒' },
  park: { id: 'park', name: '阳光公园', node: [0, 0], building: [2.3, 2.5], icon: '🌳' },
  wash: { id: 'wash', name: '泡泡洗车屋', node: [5, 5], building: [7, 4], icon: '🫧' },
});

export const MISSIONS = freezeDeep([
  {
    id: 'bread', title: '送面包', subtitle: '给公园的朋友送去香香的面包',
    icon: '🥖', color: '#ec9c53', sticker: '分享小能手',
    steps: [
      {
        location: 'bakery', action: '装上面包', prompt: '先去面包店，拿上香香的面包吧！',
        arrival: '面包烤好啦，轻轻点一下装上车。', celebration: '装好啦！一起送给公园的朋友吧。',
      },
      {
        location: 'park', action: '分享面包', prompt: '开去阳光公园，把面包分享给朋友吧！',
        arrival: '朋友们在等你，来分享面包吧！', celebration: '谢谢你！大家都吃到了香香的面包。',
      },
    ],
  },
  {
    id: 'flowers', title: '送小花', subtitle: '让消防站开满漂亮的小花',
    icon: '🌼', color: '#e4b848', sticker: '小镇园丁',
    steps: [
      {
        location: 'garden', action: '装上小花', prompt: '去小花房，接上漂亮的小花吧！',
        arrival: '小花准备好啦，轻轻点一下装上车。', celebration: '小花坐好啦！去消防站看看吧。',
      },
      {
        location: 'station', action: '种下小花', prompt: '给消防站送去小花，让小镇更漂亮！',
        arrival: '这里正好可以种花，一起来吧！', celebration: '谢谢你！小花让消防站更漂亮啦。',
      },
    ],
  },
  {
    id: 'wash', title: '洗洗小车', subtitle: '和泡泡一起给小车洗个澡',
    icon: '🫧', color: '#65b8ce', sticker: '闪亮小车手',
    steps: [
      {
        location: 'wash', action: '开始洗车', prompt: '去泡泡洗车屋，给小车洗个澡吧！',
        arrival: '泡泡准备好啦，点一下开始洗车。', celebration: '泡泡洗呀洗，小车变得亮晶晶！',
      },
      {
        location: 'garage', action: '停好小车', prompt: '开回小车车库，让小车休息一下吧！',
        arrival: '到家啦，把亮晶晶的小车停好吧。', celebration: '今天辛苦啦！你真会照顾小车。',
      },
    ],
  },
]);

const missionById = new Map(MISSIONS.map((mission) => [mission.id, mission]));
const isLocation = (id) => Object.prototype.hasOwnProperty.call(LOCATIONS, id);

/** Shortest axis-aligned route on the town's 3 × 3 road grid. */
export function findRoute(fromId, toId) {
  if (!isLocation(fromId) || !isLocation(toId)) return [];
  const [targetX, targetZ] = LOCATIONS[toId].node;
  let [x, z] = LOCATIONS[fromId].node;
  const path = [[x, z]];
  while (x !== targetX) {
    x += Math.sign(targetX - x) * 5;
    path.push([x, z]);
  }
  while (z !== targetZ) {
    z += Math.sign(targetZ - z) * 5;
    path.push([x, z]);
  }
  return path;
}

export function createGame(saved = {}) {
  // Saved data may be missing, stale or user-edited. Resume rewards, never a drive.
  const savedStickers = Array.isArray(saved?.stickers) ? saved.stickers : [];
  let state = initialState([...new Set(savedStickers.filter((id) => missionById.has(id)))]);
  const listeners = new Set();

  function initialState(stickers = []) {
    return {
      missionId: MISSIONS[0].id,
      stepIndex: 0,
      location: 'garage',
      target: MISSIONS[0].steps[0].location,
      phase: 'travel',
      stickers,
      completedCount: stickers.length,
    };
  }

  function getState() {
    return { ...state, stickers: [...state.stickers] };
  }

  function notify() {
    // Each subscriber receives its own copy, including during nested notifications.
    for (const listener of [...listeners]) listener(getState());
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('A listener function is required.');
    listeners.add(listener);
    listener(getState());
    return () => listeners.delete(listener);
  }

  function selectMission(id) {
    const mission = missionById.get(id);
    if (!mission) return false;
    state.missionId = id;
    state.stepIndex = 0;
    state.target = mission.steps[0].location;
    state.phase = state.location === state.target ? 'action' : 'travel';
    notify();
    return true;
  }

  function arrive(id) {
    if (!isLocation(id)) return false;
    state.location = id;
    // An arrival never skips a celebration or grants an unearned reward.
    if (state.phase === 'travel' || state.phase === 'action') {
      state.phase = id === state.target ? 'action' : 'travel';
    }
    notify();
    return true;
  }

  function act() {
    if (state.phase !== 'action' || state.location !== state.target) return false;
    const mission = missionById.get(state.missionId);
    if (state.stepIndex === mission.steps.length - 1) {
      state.phase = 'complete';
      if (!state.stickers.includes(mission.id)) state.stickers.push(mission.id);
      state.completedCount = state.stickers.length;
    } else {
      state.phase = 'celebration';
    }
    notify();
    return true;
  }

  function advance() {
    if (state.phase !== 'celebration') return false;
    state.stepIndex += 1;
    state.target = missionById.get(state.missionId).steps[state.stepIndex].location;
    state.phase = state.location === state.target ? 'action' : 'travel';
    notify();
    return true;
  }

  function nextMission() {
    if (state.phase !== 'complete') return false;
    const currentIndex = MISSIONS.findIndex((mission) => mission.id === state.missionId);
    return selectMission(MISSIONS[(currentIndex + 1) % MISSIONS.length].id);
  }

  function reset() {
    state = initialState();
    notify();
    return true;
  }

  return { getState, subscribe, selectMission, arrive, act, advance, nextMission, reset };
}
