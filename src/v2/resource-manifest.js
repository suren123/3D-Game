import { VOICE_LINES } from './dialogue.js';

const vehicleFiles={van:'van',truck:'truck',fridge:'delivery',tanker:'firetruck',repair:'truck-flat',bus:'suv'};
const townModels=['depot','park','school','hospital','farm','cafe','garage','house','tree','bush','bench','flowers'];
export const RESOURCE_MANIFEST = Object.freeze({
  version:'town-v2-1',
  models:[...Object.entries(vehicleFiles).map(([id,file])=>({id,path:['bus','tanker'].includes(id)?`models/town-v2/${id}.glb`:`models/kenney-car/${file}.glb`})),
    ...townModels.map(id=>({id,path:`models/town-v2/${id}.glb`}))],
  textures:['models/kenney-car/Textures/colormap.png'],
  audio:[...VOICE_LINES.map(x=>({id:x.id,path:`audio/voice-v2/${x.id}.mp3`})),
    {id:'click',path:'audio/kenney-interface/click_001.wav'},
    {id:'success-sfx',path:'audio/kenney-interface/confirmation_001.wav'},
    {id:'soft',path:'audio/kenney-interface/pluck_001.wav'}],
  // All GUI symbols/particle sprites are generated in memory; fonts use local system families.
});
