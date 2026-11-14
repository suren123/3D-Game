import { VOICE_LINES } from './dialogue.js';
import { PLACES, VEHICLES } from './catalog.js';
import { STREET_MODELS } from './street-assets.js';
import { TOWN_MODELS } from './town-assets.js';

const vehicleFiles={van:'van',truck:'truck',fridge:'delivery',tanker:'firetruck',repair:'truck-flat',bus:'suv'};
const townModels=['depot','park','school','hospital','farm','cafe','garage','shop','camp'];
export const RESOURCE_MANIFEST = Object.freeze({
  version:'town-picture-ui-4',
  models:[...new Map([...Object.entries(vehicleFiles).map(([id,file])=>({id,path:['bus','tanker'].includes(id)?`models/town-v2/${id}.glb`:`models/kenney-car/${file}.glb`})),
    ...townModels.map(id=>({id,path:`models/${['school','hospital','shop'].includes(id)?'kenney-landmarks':'town-v2'}/${id}.glb`})),
    ...[['home-a','building-type-a'],['home-c','building-type-c'],['home-f','building-type-f'],['planter','planter']].map(([id,file])=>({id,path:`models/kenney-suburban/${file}.glb`})),
    // Nature Kit 2.1's legacy color-only exports mark even bark/leaves metallic.
    // Render these three as matte vegetation, matching the official preview.
    ...[['oak','tree_oak'],['poplar','tree_default'],['hedge','plant_bush']].map(([id,file])=>({id,path:`models/kenney-nature/${file}.glb`,materialPolicy:'matte-vegetation'})),
    ...STREET_MODELS, ...TOWN_MODELS].map(item=>[item.id,item])).values()],
  textures:['models/kenney-car/Textures/colormap.png','models/kenney-suburban/Textures/colormap.png'],
  icons:[...PLACES,...VEHICLES].map(({id})=>({id,path:`icons/models/${id}.png`})),
  audio:[...VOICE_LINES.map(x=>({id:x.id,path:`audio/voice-v2/${x.id}.mp3`})),
    {id:'click',path:'audio/kenney-interface/click_001.wav'},
    {id:'success-sfx',path:'audio/kenney-interface/confirmation_001.wav'},
    {id:'soft',path:'audio/kenney-interface/pluck_001.wav'}],
  // Model icons are baked from the shipped GLBs and fully decoded before play.
  // Other GUI symbols/particle sprites are generated; fonts use system families.
});
