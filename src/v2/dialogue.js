import { GOODS, PLACES, VEHICLES, EVENTS } from './catalog.js';

// Finite, pre-generated Mandarin fragments. No speech service at runtime.
export const VOICE_LINES = [
  {id:'intro',text:'看一看，听一听。记住后，就点记住了。'},
  {id:'and',text:'还有'},
  {id:'wrong-place',text:'这里今天不用送。换一个地方试试。'},
  {id:'place-done',text:'这里已经送好啦。我们换个地方吧。'},
  {id:'missing-cargo',text:'这里还有东西没带上。可以回仓库，也可以再看任务。'},
  {id:'empty-cargo',text:'车上还没有东西。先装好，再出发吧。'},
  {id:'moving',text:'小车正在路上。到了以后再选地方吧。'},
  {id:'wrong-item',text:'这件先留在车上。换一件试试，也可以再看任务。'},
  {id:'next-stop',text:'这里送好啦。点换地点，继续帮忙吧。'},
  {id:'full',text:'货格装满啦。可以放回一件，或者出发。'},
  {id:'first',text:'先把'}, {id:'then',text:'然后把'}, {id:'to',text:'送到'},
  {id:'one',text:'一份'}, {id:'two',text:'两份'}, {id:'three',text:'三份'},
  {id:'person-one',text:'一位'}, {id:'person-two',text:'两位'},
  {id:'remember',text:'想一想要带什么。忘记了，可以再看一次。'},
  {id:'choose-car',text:'选一辆能帮忙的小汽车。'},
  {id:'drive',text:'点一下想去的地方，小车自己开。'},
  {id:'arrive',text:'到啦！选一件要交给朋友的物品。'},
  {id:'success',text:'送对啦！你记得真清楚。'},
  {id:'gentle',text:'没关系，想一想，再试试。也可以再看一次任务。'},
  {id:'reward',text:'这一单完成啦！谢谢小司机的帮忙！'},
  {id:'session',text:'今天的三件小任务都完成啦！休息一下，或者再去一个新小镇。'},
  ...GOODS.map(x=>({id:`good-${x.id}`,text:x.name})),
  ...PLACES.map(x=>({id:`place-${x.id}`,text:x.name})),
  ...VEHICLES.map(x=>({id:`vehicle-${x.id}`,text:x.name})),
  ...EVENTS.map(x=>({id:`event-${x.id}`,text:x.message})),
];

export function missionSpeech(state) {
  // The reminder closes with '继续', so only the initial brief names '记住了'.
  const out = state.phase === 'brief' ? ['intro'] : [];
  state.mission.steps.map((step,i)=>({...step,quantity:step.quantity-(state.delivered?.[i]||0),complete:state.completed?.includes(i)}))
    .filter(step=>!step.complete&&step.quantity>0).forEach((s,i)=>out.push(...(i?['and']:[]),
    s.goodId==='passenger' ? (s.quantity===2?'person-two':'person-one') : ({1:'one',2:'two',3:'three'}[s.quantity]||'one'),
    `good-${s.goodId}`, 'to', `place-${s.placeId}`));
  return out;
}

// Quiet cargo actions use their transfer animation and click sound. Spoken
// feedback identifies the actual recovery path rather than a generic failure.
export function feedbackSpeech(code) {
  const clips = {
    'wrong-place':'wrong-place', 'place-done':'place-done',
    'missing-cargo':'missing-cargo', 'empty-cargo':'empty-cargo',
    moving:'moving', 'wrong-item':'wrong-item', 'next-stop':'next-stop',
    'capacity-full':'full', arrived:'arrive', delivered:'success',
  };
  return clips[code] ? [clips[code]] : [];
}
