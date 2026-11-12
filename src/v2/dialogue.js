import { GOODS, PLACES, VEHICLES, EVENTS } from './catalog.js';

// Finite, pre-generated Mandarin fragments. No speech service at runtime.
export const VOICE_LINES = [
  {id:'intro',text:'记住这次的小任务。准备好了，就点记住了。'},
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
  const out = ['intro'];
  state.mission.steps.forEach((s,i)=>out.push(i===0?'first':'then',
    s.goodId==='passenger' ? (s.quantity===2?'person-two':'person-one') : ({1:'one',2:'two',3:'three'}[s.quantity]||'one'),
    `good-${s.goodId}`, 'to', `place-${s.placeId}`));
  return out;
}
