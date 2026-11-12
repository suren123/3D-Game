import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents.js';
import { SolidParticleSystem } from '@babylonjs/core/Particles/solidParticleSystem.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
// Scene.pick is a warning-only stub until this side-effect registers ray picking.
// Keep it explicit when importing individual engine modules.
import '@babylonjs/core/Culling/ray.js';
import { GOODS, PLACES, VEHICLES } from './catalog.js';

// The world only presents rules state. Models arrive fully parsed in the asset
// registry; neither this module nor a later map change opens a network request.
export function createWorld(scene, { assets, onPlaceTap = () => {}, onArrival = () => {}, reducedMotion = false } = {}) {
  const engine = scene.getEngine();
  const canvas = engine.getRenderingCanvas();
  const lookup = key => assets instanceof Map ? assets.get(key) : assets?.[key];
  const camera = new ArcRotateCamera('town-camera', -Math.PI / 4, .92, 60, Vector3.Zero(), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = .1; camera.maxZ = 180;
  camera.inputs.clear();
  scene.activeCamera = camera;
  scene.clearColor = Color4.FromHexString('#f4f3e7ff');
  const ambient = new HemisphericLight('soft-sky', new Vector3(0, 1, 0), scene);
  ambient.intensity = 1; ambient.diffuse = Color3.FromHexString('#fff8e9'); ambient.groundColor = Color3.FromHexString('#a6b992');
  const sun = new DirectionalLight('warm-sun', new Vector3(.5, -1, .6).normalize(), scene);
  sun.position.set(-24,42,-28); sun.intensity = 2.5; sun.diffuse = Color3.FromHexString('#fff1d9');
  sun.shadowMinZ=.1; sun.shadowMaxZ=120; sun.shadowOrthoScale=.15;
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering=true;
  shadows.filteringQuality=ShadowGenerator.QUALITY_MEDIUM; shadows.bias=.0005; shadows.normalBias=.025;
  shadows.setDarkness(.18);
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.05;
  scene.imageProcessingConfiguration.contrast = 1;

  const materials = new Map();
  function mat(hex, alpha = 1) {
    const key = `${hex}:${alpha}`;
    if (!materials.has(key)) {
      const m = new PBRMaterial(`town-${key}`, scene);
      m.albedoColor = Color3.FromHexString(hex).toLinearSpace(); m.metallic=0; m.roughness=.92;
      m.alpha = alpha; materials.set(key, m);
    }
    return materials.get(key);
  }
  let mapRoot = null, vehicle = null, vehicleAsset = null, cargoRoot = null, roadworksRoot = null;
  let map = null, state = null, vehicleId = '', cargoKey = '', blockedKey = '', location = 'depot';
  let paused = false, moving = false, route = [], routeIndex = 0, destination = null;
  let clock = 0, weatherTime = 0, rainTime = 0, travelDust = 0, overviewMode = true;
  let mapRadius = 20, targetHalfHeight = 23, currentHalfHeight = 23;
  let worldRect = null;
  const aim = Vector3.Zero();
  const position = new Vector3(0, .14, 0);
  const mapInstances = [], places = new Map(), placement = new Map();
  let cosmeticState = 71891;
  const cosmetic = () => ((cosmeticState = (Math.imul(cosmeticState, 1664525) + 1013904223) >>> 0) / 4294967296);
  function own(mesh, parent = mapRoot) { mesh.parent = parent; mesh.isPickable = false; mesh.receiveShadows=true; return mesh; }
  function box(name, p, size, color, parent = mapRoot) {
    const m = own(MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene), parent);
    m.position.set(...p); m.material = mat(color); return m;
  }
  function disc(name, x, z, radius, color, y = .03, scale = 1) {
    const m = own(MeshBuilder.CreateCylinder(name, { diameter: radius * 2, height: .045, tessellation: 24 }, scene));
    m.position.set(x, y, z); m.scaling.z = scale; m.material = mat(color); return m;
  }
  function instantiate(key, parent, p, scale = 1, rotation = 0) {
    const container = lookup(key);
    if (!container) throw new Error(`Missing preloaded world model: ${key}`);
    // Clone meshes so they join the current scene's light list. Instances of
    // detached AssetContainer sources inherit their source's (empty) light
    // list when the sources were parsed before the world lights were created.
    const instance = container.instantiateModelsToScene(name => `${key}:${name}`, false, { doNotInstantiate: true });
    const wrapper = new TransformNode(`${key}:instance`, scene); wrapper.parent = parent;
    wrapper.position.set(...p); wrapper.scaling.setAll(scale); wrapper.rotation.y = rotation;
    for (const root of instance.rootNodes) root.parent = wrapper;
    for (const mesh of wrapper.getChildMeshes()) { mesh.isPickable = false; mesh.receiveShadows = true; if(mesh.getTotalVertices())shadows.addShadowCaster(mesh); }
    return { wrapper, instance, dispose() { instance.dispose(); wrapper.dispose(); } };
  }
  function decoration(key, p, scale = 1, rotation = 0) {
    const instance = instantiate(key, mapRoot, p, scale, rotation); mapInstances.push(instance); return instance.wrapper;
  }
  function road(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    if (length < .01) return;
    const center = [(a.x + b.x) / 2, .075, (a.z + b.z) / 2];
    const border = box('road-shoulder', center, [3.65, .10, length + .9], '#ebe4d2');
    border.rotation.y = Math.atan2(dx, dz);
    const lane = box('road', [center[0], .14, center[2]], [2.8, .07, length + .25], '#a8b6ae');
    lane.rotation.y = border.rotation.y;
    for (let d = 1.8; d < length - .7; d += 2.5) {
      const dash = box('road-dash', [a.x + dx * d / length, .185, a.z + dz * d / length], [.10, .025, .8], '#f6edcd');
      dash.rotation.y = lane.rotation.y;
    }
  }
  function buildingPosition(place, index) {
    // Pick an unoccupied diagonal quadrant at the road node. Roads only occupy
    // the cardinal directions, so entrances remain clearly beside the road.
    const dirs = [[-1,-1], [1,-1], [-1,1], [1,1]];
    const order = dirs.map(([x,z]) => ({x,z,score: x * place.x + z * place.z + (z-x)*3 + cosmetic() * 2})).sort((a,b)=>b.score-a.score);
    let best = null;
    for (const dir of order) {
      const x = place.x + dir.x * 3.5, z = place.z + dir.z * 3.5;
      const space = [...placement.values()].every(p => Math.hypot(p.x-x,p.z-z) > 4.8);
      if (space) { best = { x, z, rotation: dir.z > 0 ? 0 : Math.PI }; break; }
    }
    return best || { x: place.x + (index % 2 ? -3.5 : 3.5), z: place.z + 3.5, rotation: 0 };
  }
  const particleShape = MeshBuilder.CreateBox('particle-shape', { size: 1 }, scene);
  const particles = new SolidParticleSystem('town-particles', scene, { updatable: true });
  particles.addShape(particleShape, 96); particleShape.dispose();
  const particleMesh = particles.buildMesh(); particleMesh.isPickable = false; particleMesh.alwaysSelectAsActiveMesh = true;
  const particleMaterial = new StandardMaterial('particle-material', scene);
  particleMaterial.diffuseColor = Color3.White(); particleMaterial.specularColor = Color3.Black();
  particleMaterial.disableLighting = true; particleMaterial.emissiveColor=Color3.White(); particleMesh.material = particleMaterial;
  particles.computeParticleTexture = false;
  for (const p of particles.particles) { p.isVisible = false; p.props = { ttl: 0, max: 1, rain: false }; }
  particles.setParticles();
  let nextParticle = 0;
  function burst(kind, at = position, count = 12) {
    if (paused || reducedMotion) return;
    const colors = kind === 'rain' ? ['#b0d9ed'] : kind === 'dust' || kind === 'stop' ? ['#f3e8ca','#fff6df'] : ['#f3c567','#f08f7f','#91c8b0','#a6bcea'];
    for (let i=0;i<count;i++) {
      const p = particles.particles[nextParticle++ % particles.nbParticles];
      const rain = kind === 'rain';
      p.isVisible = true; p.props = { ttl: rain ? 1.7 : .6 + cosmetic() * .7, max: 1.3, rain };
      p.position.copyFrom(at); p.position.y += rain ? 8 + cosmetic() * 4 : .3;
      if (rain) { p.position.x += (cosmetic()-.5)*28; p.position.z += (cosmetic()-.5)*28; }
      const angle = cosmetic()*Math.PI*2, speed = kind === 'dust' ? 1 : 2 + cosmetic()*2;
      p.velocity.set(Math.cos(angle)*speed, rain ? -9 : kind === 'dust' ? .6 : 3 + cosmetic()*3, Math.sin(angle)*speed);
      if (rain) p.velocity.x = -.9, p.velocity.z = .3;
      p.scaling.set(rain ? .045 : .14 + cosmetic()*.12, rain ? .6 : .14 + cosmetic()*.12, rain ? .045 : .14 + cosmetic()*.12);
      p.color = Color4.FromHexString(`${colors[Math.floor(cosmetic()*colors.length)]}ff`);
      p.rotation.set(cosmetic()*3,cosmetic()*3,cosmetic()*3);
    }
  }

  function setMap(nextMap) {
    moving = false; route = []; routeIndex = 0; destination = null;
    for (const instance of mapInstances.splice(0)) instance.dispose();
    mapRoot?.dispose(false, false); mapRoot = new TransformNode('map-root', scene);
    shadows.getShadowMap().renderList=[];
    if(vehicle)for(const mesh of vehicle.getChildMeshes())if(mesh.getTotalVertices())shadows.addShadowCaster(mesh);
    roadworksRoot = null; blockedKey = '';
    map = nextMap; places.clear(); placement.clear();
    cosmeticState = (Number(nextMap.seed) ^ 0x544f5953) >>> 0;
    for (const p of particles.particles) p.isVisible = false, p.props.ttl = 0;
    particles.setParticles(); rainTime = 0; weatherTime = 0;
    const coords = nextMap.nodes.flatMap(n=>[Math.abs(n.x),Math.abs(n.z)]);
    mapRadius = Math.max(9, ...coords) + 7.4;
    const theme = typeof map.theme === 'object' ? map.theme.id : map.theme;
    const land = theme === 'farm' ? '#cbd8ae' : theme === 'coast' ? '#c9ddbc' : '#c2d7b4';
    box('table', [0,-1.45,0], [140,.2,140], '#f4f0e3');
    const board=box('toy-board', [0,-.85,0], [mapRadius*2+1.4,1.0,mapRadius*2+1.4], '#8caf9d');
    shadows.addShadowCaster(board);
    box('sand-island', [0,-.45,0], [mapRadius*2+.7,.3,mapRadius*2+.7], '#eee4cd');
    box('grass-island', [0,-.20,0], [mapRadius*2,.45,mapRadius*2], land);
    const nodes = new Map(map.nodes.map(n=>[n.id,n]));
    for(const edge of map.edges){const a=nodes.get(edge[0]),b=nodes.get(edge[1]);if(a&&b)road(a,b);}
    for(const node of map.nodes) disc('intersection',node.x,node.z,1.4,'#a8b6ae',.16);
    map.places.forEach((place,index)=>{
      places.set(place.id,place);
      const p = buildingPosition(place,index); placement.set(place.id,p);
      const meta = PLACES.find(x=>x.id===place.id);
      box('front-garden',[p.x,.065,p.z],[6,.08,5.6],'#e8e7d4');
      const building=decoration(place.id,[p.x,.12,p.z],1.24,p.rotation);
      // A generous hitbox makes both small facade details and roofs tappable.
      for (const mesh of building.getChildMeshes()) mesh.isPickable = false;
      const hit=own(MeshBuilder.CreateBox(`hit-${place.id}`,{width:5.7,height:4.8,depth:5.7},scene));
      hit.position.set(p.x,2,p.z);hit.visibility=0;hit.isPickable=true;hit.metadata={placeId:place.id};
      const sign=disc('place-badge',place.x+1.9,place.z, .42,meta?.color||'#f4c566',.2);
      sign.metadata={placeId:place.id};sign.isPickable=true;
      if(place.id!=='park')decoration('flowers',[p.x-1.1,.12,p.z+(p.rotation?1.7:-1.7)],.9,p.rotation);
      decoration('planter',[p.x+2.2,.12,p.z-2.1],3);
      decoration('oak',[p.x-2.4,.12,p.z+1.5],2.15);
    });
    // Small neighbourhood silhouettes on the outer rim keep the playable
    // buildings distinct and the centre open for children's route choices.
    const rim=mapRadius-1.5;
    for(let i=0;i<14;i++){
      const side=i%4,t=(Math.floor(i/4)-1.5)*7;
      const x=side===0?-rim:side===1?rim:t,z=side===2?-rim:side===3?rim:t;
      if([...placement.values()].some(p=>Math.hypot(p.x-x,p.z-z)<4.5))continue;
      decoration('poplar',[x,.03,z],1.7+cosmetic()*.25,cosmetic()*6.28);
      if(i%3===0)decoration('hedge',[x+1.7,.03,z+.4],1.3);
    }
    const xs=[...new Set(map.nodes.map(n=>n.x))].sort((a,b)=>a-b);
    const zs=[...new Set(map.nodes.map(n=>n.z))].sort((a,b)=>a-b);
    for(let xi=0;xi<xs.length-1;xi++)for(let zi=0;zi<zs.length-1;zi++){
      const x=(xs[xi]+xs[xi+1])/2,z=(zs[zi]+zs[zi+1])/2;
      if([...placement.values()].some(p=>Math.hypot(p.x-x,p.z-z)<5))continue;
      box('residential-garden',[x,.06,z],[5.5,.08,5.3],'#d9dfc3');
      decoration(['home-a','home-c','home-f'][(xi+zi)%3],[x,.12,z],3.15,Math.PI);
      decoration('planter',[x+1.7,.12,z-2.1],2.4);
      decoration('oak',[x-2,.12,z+1.4],1.8);
    }
    for(const node of map.nodes){
      if(!map.edges.some(([a,b])=>{const other=nodes.get(a===node.id?b:b===node.id?a:null);return other&&other.x===node.x&&other.z>node.z;}))continue;
      for(let k=0;k<5;k++)box('crosswalk',[node.x-1+k*.5,.193,node.z+2.05],[.28,.025,.85],'#f6f2dc');
    }
    for(const place of map.places.filter(p=>p.id==='park'||p.id==='school')){
      const p=placement.get(place.id);decoration('bench',[p.x-2.2,.1,p.z+.5],1,Math.PI/2);
    }
    if(theme==='farm'){
      for(let i=0;i<5;i++){box('crop-bed',[-mapRadius+4,.10,-8+i*1.4],[3,.15,.85],'#b29568');for(let j=0;j<3;j++)decoration('bush',[-mapRadius+3+j,.18,-8+i*1.4],.45);}
    }else if(theme==='coast'){
      for(let i=0;i<5;i++)box('wave',[mapRadius+3+i*.8,-1.12,-9+i*4],[2.5,.03,.12],'#e2f1e9');
      box('pier',[mapRadius-1,-.1,0],[5,.3,2.5],'#c69565');
      for(let i=0;i<6;i++)box('pier-board',[mapRadius-3+i*.8,.08,0],[.06,.03,2.5],'#efdcb3');
    }
    const depot=places.get('depot')||map.places[0];
    position.set(depot?.x||0,.2,depot?.z||0);location=depot?.id||'depot';
    if(vehicle)vehicle.position.copyFrom(position);
    aim.set(0,0,0);camera.setTarget(aim);overviewMode=true;
    fitCamera();
  }
  function fitCamera(dt=0) {
    const bounds=canvas.getBoundingClientRect();
    const area=worldRect||{x:0,y:0,width:bounds.width,height:bounds.height};
    const aspect=area.width/Math.max(1,area.height);
    targetHalfHeight = overviewMode ? Math.max(23.5, mapRadius * 1.24, mapRadius * 1.5 / aspect) : 15.5;
    currentHalfHeight=dt?currentHalfHeight+(targetHalfHeight-currentHalfHeight)*(1-Math.exp(-dt*3)):targetHalfHeight;
    // Off-centre projection fits the town into its own rectangle. Keeping the
    // camera's full viewport lets the fullscreen Canvas GUI render normally.
    const unitsPerPixel=2*currentHalfHeight/Math.max(1,area.height);
    camera.orthoLeft=-(area.x+area.width/2)*unitsPerPixel;
    camera.orthoRight=(bounds.width-area.x-area.width/2)*unitsPerPixel;
    camera.orthoTop=(area.y+area.height/2)*unitsPerPixel;
    camera.orthoBottom=-(bounds.height-area.y-area.height/2)*unitsPerPixel;
  }
  function setLayout(rect){
    if(!rect||rect.width<=0||rect.height<=0)return;
    if(worldRect&&['x','y','width','height'].every(k=>Math.abs(worldRect[k]-rect[k])<.1))return;
    worldRect={x:rect.x,y:rect.y,width:rect.width,height:rect.height};
    fitCamera();
  }
  function setVehicle(id) {
    if(id===vehicleId&&vehicle)return;
    cargoRoot?.dispose(false,false);cargoRoot=null;cargoKey='';
    vehicleAsset?.dispose();vehicleAsset=null;
    vehicleId=id||'van';
    vehicleAsset=instantiate(vehicleId,null,[position.x,position.y,position.z],1.16);
    vehicle=vehicleAsset.wrapper;vehicle.name='player-vehicle';
  }
  function sync(next) {
    const old=state;state=next;paused=!!next.paused;
    if(!map||map.seed!==next.map.seed)setMap(next.map);
    if(!vehicle||vehicleId!==next.vehicleId)setVehicle(next.vehicleId||'van');
    if(!moving&&next.location!==location){
      const p=places.get(next.location);if(p){position.set(p.x,.2,p.z);vehicle.position.copyFrom(position);location=next.location;}
    }
    if(next.phase!=='moving'&&moving){moving=false;route=[];destination=null;}
    const blockSignature = JSON.stringify(next.blockedEdges || []);
    if (blockSignature !== blockedKey) {
      blockedKey = blockSignature; roadworksRoot?.dispose(false, false);
      roadworksRoot = new TransformNode('roadworks', scene); roadworksRoot.parent = mapRoot;
      for (const [from, to] of next.blockedEdges || []) {
        const a = map.nodes.find(n => n.id === from), b = map.nodes.find(n => n.id === to);
        if (!a || !b) continue;
        const group = new TransformNode('roadworks-barrier', scene); group.parent = roadworksRoot;
        group.position.set((a.x+b.x)/2, .2, (a.z+b.z)/2); group.rotation.y = Math.atan2(b.x-a.x,b.z-a.z);
        box('barrier', [0,.7,0], [2.7,.35,.18], '#f1be68', group);
        for (const x of [-1,1]) {
          box('barrier-leg', [x,.33,0], [.14,.7,.45], '#f4f0dd', group);
          const cone = own(MeshBuilder.CreateCylinder('safety-cone', {diameterBottom:.5,diameterTop:.08,height:.6,tessellation:8}, scene), group);
          cone.position.set(x,.3,-.5); cone.material = mat('#ef9274');
        }
      }
    }
    const key=JSON.stringify(next.cargo);
    if(key!==cargoKey){
      cargoKey=key;cargoRoot?.dispose(false,false);cargoRoot=new TransformNode('cargo',scene);cargoRoot.parent=vehicle;
      let index=0;
      for(const item of next.cargo||[])for(let q=0;q<item.quantity&&index<6;q++,index++){
        const good=GOODS.find(x=>x.id===item.goodId);
        box('cargo-package',[(index%2-.5)*.5,1.65+Math.floor(index/4)*.38,-.45+Math.floor(index%4/2)*.46],[.41,.34,.4],good?.color||'#e7b76b',cargoRoot);
      }
    }
    if(old?.phase==='event'&&next.phase!=='event')burst('success',position,14);
    if(old?.phase!==next.phase&&next.phase==='event')rainTime=4;
  }
  function travel(points, placeId) {
    if(paused||moving||!Array.isArray(points)||!points.length)return;
    route=points.map(p=>new Vector3(p.x,.2,p.z));routeIndex=0;destination=placeId;moving=true;
    while(routeIndex<route.length&&Vector3.Distance(position,route[routeIndex])<.05)routeIndex++;
    overviewMode=false;burst('dust',position,10);
  }
  function overview(){overviewMode=true;}
  function effect(kind){if(kind==='rain'||kind==='weather')rainTime=5;else burst(kind==='start'?'dust':kind,position,kind==='reward'?35:12);}
  function update(dt) {
    dt=Math.min(Math.max(Number(dt)||0,0),.1);
    if(paused)return;
    fitCamera(dt);
    clock+=dt;weatherTime+=dt;
    if(moving&&vehicle){
      let remaining=dt*6.8;
      while(remaining>0&&routeIndex<route.length){
        const target=route[routeIndex],distance=Vector3.Distance(position,target);
        const direction=target.subtract(position);
        if(distance>.001)vehicle.rotation.y=Math.atan2(direction.x,direction.z);
        if(distance<=remaining){position.copyFrom(target);remaining-=distance;routeIndex++;}
        else {position.addInPlace(direction.scale(remaining/distance));remaining=0;}
      }
      vehicle.position.copyFrom(position);
      travelDust+=dt;if(travelDust>.24){travelDust=0;burst('dust',position,2);}
      if(routeIndex>=route.length){moving=false;location=destination;destination=null;burst('stop',position,8);onArrival(location);}
    }
    const cameraTarget=overviewMode?Vector3.Zero():new Vector3(position.x*.58,0,position.z*.58);
    aim.copyFrom(Vector3.Lerp(aim,cameraTarget,reducedMotion?1:1-Math.exp(-dt*2.3)));camera.setTarget(aim);
    if(weatherTime>35){weatherTime=0;rainTime=4.5;}
    if(rainTime>0){rainTime-=dt;if(!reducedMotion&&Math.floor(clock*15)!==Math.floor((clock-dt)*15))burst('rain',aim,3);}
    for(const p of particles.particles){
      if(!p.isVisible)continue;
      p.props.ttl-=dt;
      if(p.props.ttl<=0){p.isVisible=false;continue;}
      p.position.addInPlace(p.velocity.scale(dt));
      if(!p.props.rain){p.velocity.y-=4*dt;p.rotation.x+=dt*2;p.rotation.z+=dt*2;}
      if(p.position.y<.1){p.isVisible=false;continue;}
      p.color.a=Math.min(1,p.props.ttl*2.5);
    }
    particles.setParticles();
  }
  function projectPlaces() {
    if(!map||!canvas)return[];
    const rect=canvas.getBoundingClientRect(),w=engine.getRenderWidth(),h=engine.getRenderHeight();
    const viewport=camera.viewport.toGlobal(w,h);
    return map.places.map(place=>{
      const p=placement.get(place.id);
      const projected=Vector3.Project(new Vector3(p.x,place.id==='park'?1.6:3.7,p.z),Matrix.Identity(),scene.getTransformMatrix(),viewport);
      const building=Vector3.Project(new Vector3(p.x,.8,p.z),Matrix.Identity(),scene.getTransformMatrix(),viewport);
      const x=projected.x/w*rect.width,y=projected.y/h*rect.height;
      const area=worldRect||{x:0,y:0,width:rect.width,height:rect.height};
      return {id:place.id,x,y,
        building:{x:building.x/w*rect.width,y:building.y/h*rect.height},
        visible:projected.z>=0&&projected.z<=1&&x>=area.x&&x<=area.x+area.width&&y>=area.y&&y<=area.y+area.height};
    });
  }
  let pressed=null;
  const heldPointers = new Set();
  let multiPointerGesture = false;
  const trackDown = event => { heldPointers.add(event.pointerId); if (heldPointers.size > 1) { multiPointerGesture = true; pressed = null; } };
  const trackUp = event => { heldPointers.delete(event.pointerId); if (!heldPointers.size) queueMicrotask(() => { multiPointerGesture = false; }); };
  const observer=scene.onPointerObservable.add(info=>{
    const event=info.event;
    const bounds=canvas.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top;
    if(worldRect&&(x<worldRect.x||x>worldRect.x+worldRect.width||y<worldRect.y||y>worldRect.y+worldRect.height)){pressed=null;return;}
    if(info.type===PointerEventTypes.POINTERDOWN){
      if(multiPointerGesture)return;
      if(pressed){pressed=null;return;}
      const id=info.pickInfo?.pickedMesh?.metadata?.placeId;
      if(id)pressed={id,pointer:event.pointerId,x:event.clientX,y:event.clientY};
    }else if(info.type===PointerEventTypes.POINTERUP){
      const previous=pressed;pressed=null;
      if(multiPointerGesture)return;
      if(!previous||paused||moving||!['explore','delivery','loading'].includes(state?.phase))return;
      if(event.pointerId!==previous.pointer||Math.hypot(event.clientX-previous.x,event.clientY-previous.y)>12)return;
      if(info.pickInfo?.pickedMesh?.metadata?.placeId===previous.id)onPlaceTap(previous.id);
    }
  });
  const cancel=()=>{pressed=null;};
  canvas?.addEventListener('pointerdown',trackDown,true);canvas?.addEventListener('pointerup',trackUp,true);canvas?.addEventListener('pointercancel',trackUp,true);
  canvas?.addEventListener('pointercancel',cancel);canvas?.addEventListener('lostpointercapture',cancel);
  const resizeObserver=engine.onResizeObservable.add(()=>fitCamera());
  return {
    setMap,sync,travel,update,overview,effect,projectPlaces,setLayout,
    cancelInput(){pressed=null;heldPointers.clear();multiPointerGesture=false;},
    setPaused(value){paused=!!value;pressed=null;},
    setReducedMotion(value){reducedMotion=!!value;if(value){for(const p of particles.particles)p.isVisible=false;particles.setParticles();}},
    getState(){return {position:{x:position.x,y:position.y,z:position.z},moving,location,vehicleId,meshCount:scene.meshes.length,orphanMeshCount:scene.meshes.filter(m=>m!==particleMesh&&!m.isDescendantOf(mapRoot)&&!m.isDescendantOf(vehicle)).length,particleCount:particles.particles.filter(p=>p.isVisible).length,particleLimit:96,weather:rainTime>0?'rain':'clear',camera:{overview:overviewMode,target:{x:aim.x,z:aim.z}},theme:map?.theme};},
    dispose(){
      scene.onPointerObservable.remove(observer);engine.onResizeObservable.remove(resizeObserver);
      canvas?.removeEventListener('pointercancel',cancel);canvas?.removeEventListener('lostpointercapture',cancel);
      canvas?.removeEventListener('pointerdown',trackDown,true);canvas?.removeEventListener('pointerup',trackUp,true);canvas?.removeEventListener('pointercancel',trackUp,true);
      for(const instance of mapInstances.splice(0))instance.dispose();mapRoot?.dispose(false,false);
      cargoRoot?.dispose(false,false);vehicleAsset?.dispose();particles.dispose();particleMaterial.dispose();
      for(const material of materials.values())material.dispose();shadows.dispose();camera.dispose();ambient.dispose();sun.dispose();
    },
  };
}
