import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Color4 } from '@babylonjs/core/Maths/math.color.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import { createGame } from './rules.js';
import { createWorld } from './world.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { preloadResources,RESOURCE_MANIFEST } from './resources.js';
import { missionSpeech } from './dialogue.js';
import './style.css';

const canvas=document.querySelector('#game');
const params=new URLSearchParams(location.search);
const testMode=params.get('test')==='1';
const SAVE_KEY='little-town-drivers:v2';
function readSaved(){
  try {
    const v2=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    if(v2&&typeof v2==='object')return v2;
    const v1=JSON.parse(localStorage.getItem('little-town-drivers:v1')||'null');
    return {sound:v1?.sound!==false,historicalStickers:Array.isArray(v1?.stickers)?v1.stickers.filter(x=>['bread','flowers','wash'].includes(x)):[]};
  }catch{return {};}
}
const saved=readSaved();
const settings={sound:saved.sound!==false,reducedMotion:saved.reducedMotion===true,
  historicalCount:Array.isArray(saved.historicalStickers)?saved.historicalStickers.length:0};
const randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const game=createGame({seed:testMode&&params.has('seed')?Number(params.get('seed')):randomSeed(),
  difficulty:testMode&&params.has('difficulty')?params.get('difficulty'):(saved.difficulty||'easy'),saved});
let engine,scene,ui,world,audio,resources,instrumentation,started=false,ready=false,loading=false,previous=game.getState();
let renderSamples=[],lastFrame=performance.now(),frameCount=0,renderScale=Math.min(window.devicePixelRatio||1,1.25);
function persist(){
  const s=game.getState();
  try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:2,...settings,difficulty:s.difficulty,rewardCount:s.rewardCount,historicalStickers:saved.historicalStickers||[]}));}catch{}
}
function speak(){if(started&&ready&&settings.sound)audio.speak(missionSpeech(game.getState()));}
function newSession(difficulty){audio.stop();game.dispatch({type:'NEW_SESSION',seed:randomSeed(),difficulty});}
function command(intent){
  if(multiPointer)return;
  if(intent.type==='RETRY_LOAD'){location.reload();return;}
  if(intent.type==='START'){
    if(!ready||started)return;started=true;
    audio.unlock().then(speak).catch(()=>{ui.render({...game.getState(),message:'声音还没醒来，点“再听”试试。'});});
    ui.render(game.getState());return;
  }
  if(!started||!ready)return;
  // AudioContext resumes in the same pointer gesture, including Safari after interruption.
  audio.unlock().catch(()=>{});
  const result=game.dispatch(intent);
  if(result.accepted)audio.effect('click');
}
function fail(error){
  console.error('Town startup failed:',error);
  if(ui)ui.loading({progress:0,error:true,text:error?.message||'小镇暂时没装好，点一下再试。'});
  else {const fallback=document.querySelector('#graphics-error');fallback.hidden=false;}
}

// Prevent browser long-press/drag gestures, and ignore extra fingers for command input.
let primaryPointer=null,multiPointer=false;
const heldPointers=new Set();
function cancelInput(){ui?.cancelInput?.();world?.cancelInput?.();}
canvas.addEventListener('pointerdown',event=>{
  heldPointers.add(event.pointerId);
  if(heldPointers.size>1||event.isPrimary===false){multiPointer=true;cancelInput();event.preventDefault();return;}
  primaryPointer=event.pointerId;
},{capture:true});
for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,event=>{
  heldPointers.delete(event.pointerId);
  const ignored=multiPointer||primaryPointer!==null&&primaryPointer!==event.pointerId;
  if(type==='pointercancel'||ignored)cancelInput();
  // Let Babylon observe releases even for a canceled gesture, so its internal
  // pointer counters cannot become stuck. Keep the command gate shut until all
  // listeners for this event have run.
  if(!heldPointers.size)queueMicrotask(()=>{multiPointer=false;primaryPointer=null;});
  if(ignored){event.preventDefault();return;}
  primaryPointer=null;
},{capture:true});
for(const type of ['contextmenu','selectstart','dragstart'])canvas.addEventListener(type,e=>e.preventDefault());

async function boot(){
  if(loading)return;loading=true;
  try{
    engine=new Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true,powerPreference:'high-performance',antialias:true},false);
    engine.setHardwareScalingLevel(1/renderScale);
    engine.maxFPS=30;
    scene=new Scene(engine);scene.clearColor=new Color4(.76,.88,.85,1);
    if(testMode){instrumentation=new SceneInstrumentation(scene);instrumentation.captureFrameTime=true;}
    new FreeCamera('loading-camera',new Vector3(0,20,-20),scene).setTarget(Vector3.Zero());
    audio=createAudio();audio.setEnabled(settings.sound);
    ui=createUI(scene,{onCommand:command,onSpeak:()=>{audio.unlock().then(speak).catch(()=>{});},
      onSound:value=>{settings.sound=value;audio.setEnabled(value);persist();ui.setSettings(settings);},
      onOverview:()=>world?.overview(),
      onReducedMotion:value=>{settings.reducedMotion=value;world?.setReducedMotion?.(value);ui.setSettings(settings);persist();},
      onNewSession:newSession});
    ui.setSettings(settings);
    engine.runRenderLoop(()=>{
      const now=performance.now(),dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;
      if(document.hidden)return;
      world?.update(dt);
      if(world?.projectPlaces)ui.setPlaces?.(world.projectPlaces());
      scene.render();frameCount++;
      if(testMode&&ready){renderSamples.push(engine.getDeltaTime());if(renderSamples.length>120)renderSamples.shift();}
    });
    ui.loading({progress:0,text:'正在把整个小镇装进口袋…'});
    resources=await preloadResources(scene,audio,progress=>ui.loading(progress));
    world=createWorld(scene,{assets:resources.assets,
      onPlaceTap:placeId=>command({type:'TRAVEL',placeId}),
      onArrival:()=>{if(started)game.dispatch({type:'ARRIVE'});},reducedMotion:settings.reducedMotion});
    world.setMap(previous.map);world.sync(previous);
    await resources.warm();
    resources.stats.ready=true;ready=true;ui.ready();
    game.subscribe((state,events)=>{
      if(state.seed!==previous.seed){world.setMap(state.map);audio.stop();}
      if(state.paused&&!previous.paused)audio.stop();
      engine.maxFPS=state.paused?12:30;
      world.setPaused(state.paused);world.sync(state);ui.render(state);
      for(const event of events){
        if(event.type==='travel'){audio.stop();world.travel(event.route,event.placeId);}
        if(event.type==='cargo')world.effect('cargo');
        if(event.type==='reward'){world.effect('celebrate');audio.speak(['reward']);}
        if(event.type==='feedback'){
          audio.effect(event.kind==='success'?'success-sfx':'soft');
          if(!events.some(x=>['reward','event'].includes(x.type)))audio.speak([event.kind==='success'?'success':'gentle']);
        }
        if(event.type==='event'){world.effect(state.event.id);audio.speak([`event-${state.event.id}`]);}
      }
      if(state.phase!==previous.phase){
        if(state.phase==='brief')speak();
        else if(state.phase==='selectVehicle')audio.speak(['choose-car']);
        else if(state.phase==='loading')audio.speak(['remember']);
        else if(state.phase==='explore')audio.speak(['drive']);
        else if(state.phase==='sessionComplete')audio.speak(['session']);
      }
      previous=state;persist();
    });
  }catch(error){fail(error);}
  finally{loading=false;}
}
window.addEventListener('resize',()=>{engine?.resize();});
window.addEventListener('blur',()=>{primaryPointer=null;heldPointers.clear();multiPointer=false;cancelInput();if(started)game.dispatch({type:'PAUSE',value:true});audio?.stop();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){primaryPointer=null;heldPointers.clear();multiPointer=false;cancelInput();audio?.stop();if(started)game.dispatch({type:'PAUSE',value:true});}lastFrame=performance.now();});
window.addEventListener('pagehide',()=>audio?.stop());
document.querySelector('#graphics-error button').addEventListener('click',()=>location.reload());
if(testMode)Object.defineProperty(window,'__townTest',{value:Object.freeze({
  snapshot:()=>({state:game.getState(),ready,started,resources:resources?.stats,audio:audio?.stats(),world:world?.getState(),
    bounds:ui?.getBounds(),settings:{...settings},frames:frameCount,manifest:RESOURCE_MANIFEST,
    vehicleMaterials:scene?.meshes.filter(m=>m.name.startsWith(`${game.getState().vehicleId}:`)&&m.material).map(m=>({name:m.name,lights:m._lightSources?.length,
      kind:m.material.getClassName(),color:m.material.albedoColor?.asArray(),textureReady:m.material.albedoTexture?.isReady(),enabled:m.isEnabled()})),
    render:{width:engine?.getRenderWidth(),height:engine?.getRenderHeight(),meshes:scene?.meshes.length,materials:scene?.materials.length,textures:scene?.textures.length,
      drawCalls:instrumentation?.drawCallsCounter.current,renderScale,cpuFrameMs:instrumentation?.frameTimeCounter.average,
      meanFrameMs:renderSamples.length?renderSamples.reduce((a,b)=>a+b,0)/renderSamples.length:0}})
}),writable:false});
boot();
