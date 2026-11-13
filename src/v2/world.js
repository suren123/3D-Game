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
import { GOODS, PLACES } from './catalog.js';
import { buildRoadPath, createRoadMotion, advanceRoadMotion } from './motion.js';
import { createModelPreview } from './model-preview.js';
import { planStreets } from './street-layout.js';
import { initialParkingPose, planParkingRoute } from './parking-route.js';
import { TOWN_CATALOG } from './town-assets.js';
const authoredScales = Object.fromEntries(TOWN_CATALOG.map(item=>[item.id,item.runtimeScale]));

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
  ambient.intensity = .8; ambient.diffuse = Color3.FromHexString('#fffdf5'); ambient.groundColor = Color3.FromHexString('#bdc9ac');
  const sun = new DirectionalLight('warm-sun', new Vector3(.5, -1, .6).normalize(), scene);
  sun.position.set(-24,42,-28); sun.intensity = 2.5; sun.diffuse = Color3.FromHexString('#fff8ee');
  sun.shadowMinZ=.1; sun.shadowMaxZ=120; sun.shadowOrthoScale=.15;
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering=true;
  shadows.filteringQuality=ShadowGenerator.QUALITY_MEDIUM; shadows.bias=.0005; shadows.normalBias=.025;
  shadows.setDarkness(.18);
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.12;
  scene.imageProcessingConfiguration.contrast = 1.12;

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
  let paused = false, moving = false, motion = null, destination = null;
  let departureTurn = null;
  let parkingHeading = 0;
  let cargoAnimation = null, cargoFeedback = 0;
  let clock = 0, weatherTime = 0, rainTime = 0, travelDust = 0, overviewMode = true;
  let boardBounds={minX:-20,maxX:20,minZ:-20,maxZ:20};
  let parkedVehicleIds=[];
  let mapRadius = 20, targetHalfHeight = 23, currentHalfHeight = 23;
  let worldRect = null;
  let framing = { halfWidth: 23, halfHeight: 23 };
  const mapFocus = new Vector3(0, .8, 0);
  const modelPreview=createModelPreview(scene,{assets});
  let previewId=null,previewZoom=1;
  const aim = Vector3.Zero();
  const position = new Vector3(0, .14, 0);
  const mapInstances = [], places = new Map(), placement = new Map();
  let streetInfo = {tileCount: 0, junctionCount: 0, decorationIds: [], decorationCount: 0, roadModelIds: []};
  let roadworkInstances = [];
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
  function streetDecoration(key, p, scale = 1, rotation = 0) {
    streetInfo.decorationCount++;
    if (!streetInfo.decorationIds.includes(key)) streetInfo.decorationIds.push(key);
    return decoration(key, p, scale, rotation);
  }
  function buildingPosition(place, index) {
    if(place.lot)return {...place.lot};
    // Pick an unoccupied diagonal quadrant at the road node. Roads only occupy
    // the cardinal directions, so entrances remain clearly beside the road.
    const dirs = [[-1,-1], [1,-1], [-1,1], [1,1]];
    const spacing=axis=>{const values=[...new Set(map.nodes.map(n=>n[axis]))].sort((a,b)=>a-b);return values.length>1?Math.min(...values.slice(1).map((v,i)=>v-values[i]))/2:4;};
    const offsetX=spacing('x'),offsetZ=spacing('z');
    const order = dirs.map(([x,z]) => ({x,z,score: x * place.x + z * place.z + (z-x)*3 + cosmetic() * 2})).sort((a,b)=>b.score-a.score);
    let best = null;
    for (const dir of order) {
      const x = place.x + dir.x * offsetX, z = place.z + dir.z * offsetZ;
      const space = [...placement.values()].every(p => Math.hypot(p.x-x,p.z-z) > 4.8);
      // Authored landmark facades face -Z, toward the fixed (+X,-Z) camera.
      // Placement may change by seed; recognisable doors/signs must never
      // turn away from the child just to face a different street quadrant.
      if (space) { best = { x, z, rotation: 0 }; break; }
    }
    return best || { x: place.x + (index % 2 ? -offsetX : offsetX), z: place.z + offsetZ, rotation: 0 };
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
    const groundCue=kind==='dust'||kind==='stop';
    const cargoCue=kind==='cargo';
    const colors = kind === 'rain' ? ['#b0d9ed'] : groundCue ? ['#f3e8ca','#fff6df'] : cargoCue ? ['#ffe5a0','#d1e8c3'] : ['#f3c567','#f08f7f','#91c8b0','#a6bcea'];
    for (let i=0;i<count;i++) {
      const p = particles.particles[nextParticle++ % particles.nbParticles];
      const rain = kind === 'rain';
      p.isVisible = true; p.props = { ttl: rain ? 1.4 : groundCue ? .3+cosmetic()*.3 : cargoCue ? .45 : .7+cosmetic()*.5, max: 1.3, rain };
      p.position.copyFrom(at); p.position.y += rain ? 6 + cosmetic() * 3 : cargoCue ? .8 : .15;
      if (rain) { p.position.x += (cosmetic()-.5)*22; p.position.z += (cosmetic()-.5)*22; }
      const angle = cosmetic()*Math.PI*2, speed = groundCue ? .55 : cargoCue ? .7 : 1.3+cosmetic()*1.4;
      p.velocity.set(Math.cos(angle)*speed, rain ? -8 : groundCue ? .45 : cargoCue ? 1.4 : 3+cosmetic()*2, Math.sin(angle)*speed);
      if (rain) p.velocity.x = -.9, p.velocity.z = .3;
      const size = groundCue ? .07 + cosmetic() * .07 : cargoCue ? .09 : .12 + cosmetic() * .1;
      p.scaling.set(rain ? .035 : size, rain ? .4 : size*.65, rain ? .035 : size);
      p.color = Color4.FromHexString(`${colors[Math.floor(cosmetic()*colors.length)]}ff`);
      p.rotation.set(cosmetic()*3,cosmetic()*3,cosmetic()*3);
      // Rain streaks follow the common fall direction; celebratory particles
      // keep their varied tumble instead of making the rain look like confetti.
      if(rain)p.rotation.set(Math.atan2(-p.velocity.z,-p.velocity.y),0,Math.atan2(p.velocity.x,-p.velocity.y));
    }
  }

  function setMap(nextMap) {
    moving = false; motion = null; destination = null; departureTurn=null; clearCargoAnimation();
    for (const instance of mapInstances.splice(0)) instance.dispose();
    roadworkInstances = [];
    mapRoot?.dispose(false, false); mapRoot = new TransformNode('map-root', scene);
    shadows.getShadowMap().renderList=[];
    if(vehicle)for(const mesh of vehicle.getChildMeshes())if(mesh.getTotalVertices())shadows.addShadowCaster(mesh);
    roadworksRoot = null; blockedKey = '';
    map = nextMap; places.clear(); placement.clear();
    cosmeticState = (Number(nextMap.seed) ^ 0x544f5953) >>> 0;
    for (const p of particles.particles) p.isVisible = false, p.props.ttl = 0;
    particles.setParticles(); rainTime = 0; weatherTime = 0;
    const coords = nextMap.nodes.flatMap(n=>[Math.abs(n.x),Math.abs(n.z)]);
    mapRadius = map.layout?.bounds ? Math.max(...Object.values(map.layout.bounds).map(Math.abs)) : Math.max(9, ...coords) + 7.4;
    boardBounds=map.layout?.bounds||{minX:-mapRadius,maxX:mapRadius,minZ:-mapRadius,maxZ:mapRadius};
    const boardX=(boardBounds.minX+boardBounds.maxX)/2,boardZ=(boardBounds.minZ+boardBounds.maxZ)/2;
    const boardWidth=boardBounds.maxX-boardBounds.minX,boardDepth=boardBounds.maxZ-boardBounds.minZ;
    mapFocus.set(boardX,.8,boardZ);
    const theme = typeof map.theme === 'object' ? map.theme.id : map.theme;
    const land = theme === 'farm' ? '#b3cd91' : theme === 'coast' ? '#afd2a1' : '#a8ce94';
    box('table', [0,-1.45,0], [400,.2,400], '#f8efdf');
    const board=box('toy-board', [boardX,-.85,boardZ], [boardWidth+1.4,1.0,boardDepth+1.4], '#8caf9d');
    shadows.addShadowCaster(board);
    box('sand-island', [boardX,-.45,boardZ], [boardWidth+.7,.3,boardDepth+.7], '#eee4cd');
    box('grass-island', [boardX,-.20,boardZ], [boardWidth,.45,boardDepth], land);
    const nodes = new Map(map.nodes.map(n=>[n.id,n]));
    const streetPieces = planStreets(map);
    streetInfo = {tileCount: streetPieces.length, junctionCount: streetPieces.filter(p=>p.kind==='node').length,
      decorationCount: 0, decorationIds: [], roadModelIds: [...new Set(streetPieces.map(p=>p.id))]};
    for (const piece of streetPieces) {
      const tile = decoration(piece.id, piece.position, 1, piece.rotation);
      tile.scaling.set(...piece.scale);
    }
    const pathSegment=(a,b,width=.85,color='#fff0d5')=>{
      const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
      if(length<.01)return;
      const path=box('entrance-walkway',[(a.x+b.x)/2,.09,(a.z+b.z)/2],[width,.07,length+.05],color);
      path.rotation.y=Math.atan2(dx,dz);
    };
    map.places.forEach((place,index)=>{
      places.set(place.id,place);
      const p = buildingPosition(place,index); placement.set(place.id,p);
      const meta = PLACES.find(x=>x.id===place.id);
      const yardWidth=p.width||6,yardDepth=p.depth||5.6;
      box('front-garden',[p.x,.065,p.z],[yardWidth,.08,yardDepth],place.id==='farm'?'#dfd4af':'#f5e5c9');
      const buildingScale=authoredScales[place.id]??({school:1.2,hospital:1.15,shop:1.08}[place.id]??1.24);
      const building=decoration(place.id,[p.x,.12,p.z],buildingScale,p.rotation);
      const limits=building.getHierarchyBoundingVectors(true);
      p.height=limits.max.y;
      p.modelBounds={min:limits.min.clone(),max:limits.max.clone()};
      // Path starts at the actual front of the imported model, then meets the
      // reserved lot walkway. No path crosses a building or ends in bare grass.
      if(p.walkway?.length){
        const entry={x:p.entranceX??p.x,z:p.entranceZ??p.z-yardDepth/2};
        pathSegment({x:p.x,z:limits.min.z-.04},entry);
        for(let i=1;i<p.walkway.length;i++)pathSegment(p.walkway[i-1],p.walkway[i]);
      }
      for (const mesh of building.getChildMeshes()) mesh.isPickable = false;
      const hit=own(MeshBuilder.CreateBox(`hit-${place.id}`,{width:Math.min(yardWidth,Math.max(4.8,limits.max.x-limits.min.x+.5)),height:Math.max(3.8,p.height+.3),depth:Math.min(yardDepth,Math.max(4.8,limits.max.z-limits.min.z+.5))},scene));
      hit.position.set(p.x,Math.max(3.8,p.height+.3)/2,p.z);hit.visibility=0;hit.isPickable=true;hit.metadata={placeId:place.id};
      const sign=disc('place-badge',p.frontageX??place.x+1.9,p.frontageZ??place.z, .33,meta?.color||'#f4c566',.21);
      sign.metadata={placeId:place.id};sign.isPickable=true;
      // Trees belong behind the buildings, leaving front doors and moving cars clear.
      if(yardWidth>6.3&&place.id!=='camp')decoration('oak',[p.x-yardWidth/2+.65,.12,p.z+yardDepth/2-.55],1.35);
    });
    // Vegetation respects complete lots, road surfaces and entrance paths.
    // A center-only landmark check allowed rim trees to grow in the north lane.
    const allLots=[...nextMap.places.map(p=>p.lot).filter(Boolean),...(map.layout?.residentialLots||[]),map.layout?.parkingLot].filter(Boolean);
    const segmentDistance=(x,z,a,b)=>{
      const dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz;
      const t=length2?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/length2)):0;
      return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
    };
    const clearOfPaths=(x,z,radius,lot)=>!(lot.walkway||[]).slice(1).some((b,i)=>segmentDistance(x,z,lot.walkway[i],b)<radius+.46);
    const clearVerge=(x,z,radius)=>
      x-radius>boardBounds.minX&&x+radius<boardBounds.maxX&&z-radius>boardBounds.minZ&&z+radius<boardBounds.maxZ&&
      map.edges.every(([a,b])=>segmentDistance(x,z,nodes.get(a),nodes.get(b))>(map.layout?.roadTileWidth||3.75)/2+radius)&&
      allLots.every(lot=>(Math.abs(x-lot.x)>(lot.width||6)/2+radius||Math.abs(z-lot.z)>(lot.depth||6)/2+radius)&&clearOfPaths(x,z,radius,lot));
    for(let i=0;i<20;i++){
      const side=i%4,t=(Math.floor(i/4)-2)*7;
      const x=side===0?boardBounds.minX+1.1:side===1?boardBounds.maxX-1.1:boardX+t;
      const z=side===2?boardBounds.minZ+1.1:side===3?boardBounds.maxZ-1.1:boardZ+t;
      if(!clearVerge(x,z,.9))continue;
      decoration('poplar',[x,.03,z],1.7+cosmetic()*.25,cosmetic()*6.28);
      if(i%3===0&&clearVerge(x+1.7,z+.4,.4))decoration('hedge',[x+1.7,.03,z+.4],1.3);
    }
    const xs=[...new Set(map.nodes.map(n=>n.x))].sort((a,b)=>a-b);
    const zs=[...new Set(map.nodes.map(n=>n.z))].sort((a,b)=>a-b);
    const gardenCenters=[...placement.values()];
    const residentialLots=map.layout?.residentialLots||xs.slice(0,-1).flatMap((v,xi)=>zs.slice(0,-1).map((z,zi)=>({x:(v+xs[xi+1])/2,z:(z+zs[zi+1])/2,width:5.5,depth:5.3})));
    const homes=['home-g','home-m','home-q','home-k','home-a','home-c','home-f'].filter(id=>lookup(id));
    residentialLots.forEach((lot,i)=>{
      const {x,z}=lot;
      if([...placement.values()].some(p=>Math.hypot(p.x-x,p.z-z)<5))return;
      box('residential-garden',[x,.06,z],[lot.width||6,.08,lot.depth||6],'#bfd79f');
      const id=homes[(i+map.seed)%homes.length];
      const home=decoration(id,[x,.12,z],authoredScales[id]??3.15,0);
      const limits=home.getHierarchyBoundingVectors(true);
      if(lot.walkway?.length){
        pathSegment({x,z:limits.min.z-.02},lot.walkway[0],.65);
        for(let n=1;n<lot.walkway.length;n++)pathSegment(lot.walkway[n-1],lot.walkway[n],.65);
      }
      gardenCenters.push({x,z});
      const planterSpot=[[2.45,2.45],[-2.45,2.45],[2.45,-2.45],[-2.45,-2.45]].map(([dx,dz])=>({x:x+dx,z:z+dz})).find(p=>
        (p.x+.4<limits.min.x||p.x-.4>limits.max.x||p.z+.4<limits.min.z||p.z-.4>limits.max.z)&&clearOfPaths(p.x,p.z,.4,lot));
      if(planterSpot)decoration('planter',[planterSpot.x,.12,planterSpot.z],2);
      if(i%2===0&&lookup('town-low-fence'))decoration('town-low-fence',[x,.12,z],1.7);
    });
    parkedVehicleIds=[];
    const parking=map.layout?.parkingLot;
    if(parking){
      const {x,z}=parking;
      box('neighbourhood-parking',[x,.065,z],[5.9,.08,5.9],'#c4c9be');
      const fleet=['taxi','police','van','ambulance','bus'];
      for(let i=0;i<3;i++){
        const id=fleet[(i+map.seed)%fleet.length];if(!lookup(id))continue;
        const px=x+(i-1)*1.9;
        decoration(id,[px,.12,z+.3],.95,Math.PI);
        parkedVehicleIds.push(id);
        for(const side of [-1,1])box('parking-line',[px+side*.87,.12,z+.35],[.055,.02,3.8],'#fff4cf');
      }
      if(parking.walkway?.length){
        for(let i=1;i<parking.walkway.length;i++)pathSegment(parking.walkway[i-1],parking.walkway[i],.85,'#c4c9be');
      }
      gardenCenters.push(parking);
    }
    // A few lamps sit outside straight edge midpoints, leaving junctions and
    // the large landmark touch targets clear. No procedural street markings.
    const streetSpots=[];
    const streetKinds=[['street-lamp',3.2],['street-bench',1.65],['street-flower',1.25],['town-trash',1],['town-road-sign',1]].filter(([id])=>lookup(id));
    const addStreetSpot=(x,z,rotation)=>{
      if(streetSpots.length>=10||gardenCenters.some(p=>Math.hypot(p.x-x,p.z-z)<3.3)||streetSpots.some(p=>Math.hypot(p.x-x,p.z-z)<3))return false;
      const [id,scale]=streetKinds[streetSpots.length%streetKinds.length];
      streetDecoration(id,[x,.06,z],scale,rotation);
      streetSpots.push({x,z});return true;
    };
    map.edges.forEach(([aId,bId], index)=>{
      const a=nodes.get(aId),b=nodes.get(bId);if(!a||!b)return;
      const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
      for(const side of [index%2?1:-1,index%2?-1:1]){
        const x=(a.x+b.x)/2-dz/length*2.55*side,z=(a.z+b.z)/2+dx/length*2.55*side;
        if(addStreetSpot(x,z,Math.atan2(dz*side,-dx*side)))break;
      }
    });
    // Exterior verge fallback keeps all three small street models visible when
    // seeded landmarks occupy most inner blocks. These points are beyond every
    // road endpoint and still inside the board; they never narrow a lane.
    if(streetSpots.length<streetKinds.length){
      for(const t of [0,-6,6,-11,11])for(const [x,z,rotation]of [[boardBounds.minX+2.3,boardZ+t,Math.PI/2],[boardBounds.maxX-2.3,boardZ+t,-Math.PI/2],[boardX+t,boardBounds.minZ+2.3,0],[boardX+t,boardBounds.maxZ-2.3,Math.PI]]){
        if(streetSpots.length<streetKinds.length)addStreetSpot(x,z,rotation);
      }
    }
    if(lookup('town-traffic-light')){
      const junction=map.nodes.find(n=>map.edges.filter(e=>e.includes(n.id)).length>=3&&gardenCenters.every(p=>Math.hypot(p.x-(n.x+2.3),p.z-(n.z-2.3))>3.4));
      if(junction)streetDecoration('town-traffic-light',[junction.x+2.3,.12,junction.z-2.3],1.15,Math.PI/2);
    }
    if(theme==='farm'){
      // A cultivated strip outside the occupied town plots; paths and lots stay clear.
      const fieldX=boardBounds.maxX+1.5;
      box('field-foundation',[fieldX,-.65,boardZ],[3.1,.75,mapRadius*1.25+.1],'#8caf9d');
      box('field-border',[fieldX,-.12,boardZ],[3,.3,mapRadius*1.25],'#c9b68b');
      for(let i=0;i<6;i++){
        const z=boardZ+(i-2.5)*3.1;
        box('crop-bed',[fieldX,.06,z],[2.5,.15,1.65],'#aa8764');
        for(let j=0;j<2;j++)decoration('hedge',[fieldX-.65+j*1.3,.14,z],.8);
      }
    }else if(theme==='coast'){
      // The pier reaches actual water, rather than hanging above the cream table.
      box('harbour-edge',[boardBounds.maxX+2.25,-.65,boardZ],[5.2,.7,boardDepth+.4],'#8caf9d');
      box('sea-water',[boardBounds.maxX+2.2,-.23,boardZ],[5,.08,boardDepth],'#83cbd4');
      box('sand-beach',[boardBounds.maxX+.25,-.12,boardZ],[1.1,.12,boardDepth],'#f1d5a0');
      for(let i=0;i<8;i++)box('wave',[boardBounds.maxX+2.8+(i%2)*.6,-.18,boardZ+(i-3.5)*5],[1.2,.025,.10],'#d6f1ec');
      box('pier',[boardBounds.maxX+1,.10,boardZ],[3.5,.22,2.2],'#c69565');
      for(let i=0;i<5;i++)box('pier-board',[boardBounds.maxX-.4+i*.7,.23,boardZ],[.045,.025,2.2],'#efdcb3');
    }
    const depot=places.get('depot')||map.places[0];
    const parked=initialParkingPose(map,depot?.id||'depot');
    position.set(parked.x,.2,parked.z);location=depot?.id||'depot';parkingHeading=parked.yaw;
    if(vehicle){vehicle.position.copyFrom(position);vehicle.rotation.y=parkingHeading;}
    aim.copyFrom(mapFocus);camera.beta=.92;camera.setTarget(aim);overviewMode=true;
    // Fit the rendered island and building bounds in camera space. The old
    // radius multiplier left large empty corners, especially beside the sidebar.
    let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
    const view=camera.getViewMatrix(true);
    for(const mesh of mapRoot.getChildMeshes()){
      if(mesh.name==='table'||!mesh.isVisible||mesh.visibility===0)continue;
      mesh.computeWorldMatrix(true);
      for(const corner of mesh.getBoundingInfo().boundingBox.vectorsWorld){
        const p=Vector3.TransformCoordinates(corner,view);
        left=Math.min(left,p.x);right=Math.max(right,p.x);bottom=Math.min(bottom,p.y);top=Math.max(top,p.y);
      }
    }
    framing={halfWidth:Math.max(Math.abs(left),Math.abs(right))+1.1,halfHeight:Math.max(Math.abs(bottom),Math.abs(top))+1.1};
    mapRoot.setEnabled(!previewId);
    fitCamera();
  }
  function fitCamera(dt=0) {
    const bounds=canvas.getBoundingClientRect();
    const area=worldRect||{x:0,y:0,width:bounds.width,height:bounds.height};
    const aspect=area.width/Math.max(1,area.height);
    if(previewId){
      const bounds=modelPreview.getBounds();
      if(bounds){
        camera.beta=Math.PI/4;
        camera.setTarget(new Vector3(bounds.center.x,bounds.center.y,bounds.center.z));
        const view=camera.getViewMatrix(true);let halfWidth=0,halfHeight=0;
        for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
          const p=Vector3.TransformCoordinates(new Vector3(x,y,z),view);
          halfWidth=Math.max(halfWidth,Math.abs(p.x));halfHeight=Math.max(halfHeight,Math.abs(p.y));
        }
        targetHalfHeight=Math.max(halfHeight,halfWidth/aspect)*1.15/previewZoom;
      }
    }else {
      const townHalfHeight=Math.max(framing.halfHeight, framing.halfWidth / aspect);
      // Keep route selection wide; show the car and nearby streets while driving.
      targetHalfHeight=townHalfHeight*(overviewMode?1:.55);
    }
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
    const heading=vehicle?.rotation.y??parkingHeading;
    clearCargoAnimation();cargoKey='';
    vehicleAsset?.dispose();vehicleAsset=null;
    vehicleId=id||'van';
    vehicleAsset=instantiate(vehicleId,null,[position.x,position.y,position.z],1.16);
    vehicle=vehicleAsset.wrapper;vehicle.name='player-vehicle';
    vehicle.rotation.y=heading;
    vehicle.setEnabled(!previewId);
  }
  function setModelPreview(id=null,zoom=1){
    const nextZoom=Math.max(.6,Math.min(2.5,Number(zoom)||1));
    if(!id&&!previewId)return modelPreview.getState();
    if(id===previewId&&nextZoom===previewZoom)return modelPreview.getState();
    pressed=null;
    if(id){
      if(id!==previewId)modelPreview.show(id);
      previewId=id;previewZoom=nextZoom;
      mapRoot?.setEnabled(false);vehicle?.setEnabled(false);particleMesh.setEnabled(false);
    }else{
      modelPreview.hide();previewId=null;previewZoom=1;
      mapRoot?.setEnabled(true);vehicle?.setEnabled(true);particleMesh.setEnabled(true);
      camera.beta=.92;camera.setTarget(aim);
    }
    fitCamera();return modelPreview.getState();
  }
  // Cargo is an action cue, never a permanent roof stack. Every cue uses a
  // bounded group which is disposed on completion, map change or vehicle swap.
  const cargoAnchors = {
    van: {x:0,y:.72,z:-1.08,ground:{x:0,y:.22,z:-2.0}},
    truck: {x:0,y:.95,z:-1.12,ground:{x:0,y:.22,z:-2.1}},
    fridge: {x:0,y:.85,z:-1.12,ground:{x:0,y:.22,z:-2.05}},
    tanker: {x:.8,y:.7,z:-.35,ground:{x:1.8,y:.22,z:-.35}},
    repair: {x:0,y:.75,z:-.85,ground:{x:0,y:.22,z:-1.9}},
    bus: {x:.72,y:.66,z:.55,ground:{x:1.7,y:.22,z:.55}},
    taxi: {x:.7,y:.72,z:.1,ground:{x:1.7,y:.22,z:.1}},
    tractor: {x:0,y:.7,z:-.85,ground:{x:0,y:.22,z:-1.8}},
    ambulance: {x:0,y:.85,z:-1.25,ground:{x:0,y:.22,z:-2.15}},
    police: {x:.7,y:.7,z:0,ground:{x:1.7,y:.22,z:0}},
  };
  function clearCargoAnimation(){
    cargoRoot?.dispose(false,false);cargoRoot=null;cargoAnimation=null;cargoFeedback=0;
    if(vehicle){vehicle.rotation.x=0;vehicle.rotation.z=0;}
  }
  function animateCargo(before,after){
    const old=new Map((before||[]).map(item=>[item.goodId,item.quantity]));
    const next=new Map((after||[]).map(item=>[item.goodId,item.quantity]));
    const changes=[];
    for(const id of new Set([...old.keys(),...next.keys()])){
      const delta=(next.get(id)||0)-(old.get(id)||0);
      for(let i=0;i<Math.min(Math.abs(delta),4)&&changes.length<6;i++)changes.push({id,loading:delta>0});
    }
    if(!changes.length||!vehicle)return;
    clearCargoAnimation();
    cargoRoot=new TransformNode('cargo-action',scene);cargoRoot.parent=vehicle;
    const anchor=cargoAnchors[vehicleId]||cargoAnchors.van;
    const items=changes.map((change,i)=>{
      const good=GOODS.find(g=>g.id===change.id);
      const mesh=box('cargo-action-package',[0,0,0],[.42,.34,.4],good?.color||'#e7b76b',cargoRoot);
      return {...change,mesh,delay:i*.075};
    });
    cargoAnimation={items,anchor,time:0,duration:reducedMotion ? .32 : .72};
    updateCargoAnimation(0);
  }
  function updateCargoAnimation(dt){
    if(!cargoAnimation)return;
    const cue=cargoAnimation;cue.time+=dt;
    for(const item of cue.items){
      const t=Math.max(0,Math.min(1,(cue.time-item.delay)/cue.duration)),ease=t*t*(3-2*t);
      const from=item.loading?cue.anchor.ground:cue.anchor,to=item.loading?cue.anchor:cue.anchor.ground;
      item.mesh.position.set(from.x+(to.x-from.x)*ease,from.y+(to.y-from.y)*ease+(reducedMotion?0:Math.sin(t*Math.PI)*.36),from.z+(to.z-from.z)*ease);
      item.mesh.visibility=Math.min(1,t*7,(1-t)*5);
      item.mesh.scaling.setAll(.65+Math.sin(t*Math.PI)*.35);
      item.mesh.rotation.y=reducedMotion?0:Math.sin(t*Math.PI)*.25;
    }
    cargoFeedback=reducedMotion?0:Math.sin(Math.min(1,cue.time/(cue.duration+.15))*Math.PI)*.025;
    if(cue.time>=cue.duration+cue.items.at(-1).delay)clearCargoAnimation();
  }
  function sync(next) {
    const old=state;state=next;paused=!!next.paused;
    if(!map||map.seed!==next.map.seed)setMap(next.map);
    if(!vehicle||vehicleId!==next.vehicleId)setVehicle(next.vehicleId||'van');
    if(!moving&&next.location!==location){
      const p=places.get(next.location);if(p){
        const parked=initialParkingPose(map,next.location);
        position.set(parked.x,.2,parked.z);vehicle.position.copyFrom(position);vehicle.rotation.y=parked.yaw;location=next.location;
      }
    }
    if(next.phase!=='moving'&&moving){moving=false;motion=null;destination=null;departureTurn=null;}
    const blockSignature = JSON.stringify(next.blockedEdges || []);
    if (blockSignature !== blockedKey) {
      for(const instance of roadworkInstances){
        const index=mapInstances.indexOf(instance);if(index!==-1)mapInstances.splice(index,1);
        instance.dispose();
      }
      roadworkInstances=[];
      blockedKey = blockSignature; roadworksRoot?.dispose(false, false);
      roadworksRoot = new TransformNode('roadworks', scene); roadworksRoot.parent = mapRoot;
      for (const [from, to] of next.blockedEdges || []) {
        const a = map.nodes.find(n => n.id === from), b = map.nodes.find(n => n.id === to);
        if (!a || !b) continue;
        const group = new TransformNode('roadworks-barrier', scene); group.parent = roadworksRoot;
        group.position.set((a.x+b.x)/2, .2, (a.z+b.z)/2); group.rotation.y = Math.atan2(b.x-a.x,b.z-a.z);
        const fence=instantiate('street-fence',group,[0,0,0],6.5,Math.PI/2);
        mapInstances.push(fence);roadworkInstances.push(fence);
        for (const x of [-1,1]) {
          const cone=instantiate('street-cone',group,[x,0,-.5],6);
          mapInstances.push(cone);roadworkInstances.push(cone);
        }
      }
    }
    const key=JSON.stringify(next.cargo);
    if(key!==cargoKey){
      cargoKey=key;
      if(old&&old.seed===next.seed&&old.vehicleId===next.vehicleId)animateCargo(old.cargo,next.cargo);
    }
    if(old?.phase==='loading'&&next.phase==='explore')overview();
    if(old?.phase==='event'&&next.phase!=='event')burst('success',position,14);
  }
  function travel(points, placeId) {
    if(paused||moving||!Array.isArray(points)||!points.length)return;
    // Logical destinations stay at road nodes; physical stops leave enough
    // straight approach for the complete car and its next rounded turn.
    const parkedRoute=planParkingRoute(map,points,{position:{x:position.x,z:position.z},heading:vehicle?.rotation.y||0});
    motion=createRoadMotion(buildRoadPath(parkedRoute.points));destination=placeId;moving=true;
    const from=vehicle?.rotation.y||0,delta=Math.atan2(Math.sin(motion.yaw-from),Math.cos(motion.yaw-from));
    departureTurn=!reducedMotion&&Math.abs(delta)>.025?{from,delta,time:0,duration:Math.max(.2,Math.abs(delta)/3.8)}:null;
    overviewMode=false;burst('dust',position,10);
  }
  function overview(){overviewMode=true;}
  function effect(kind){if(kind==='rain'||kind==='weather')rainTime=5;else burst(kind==='start'?'dust':kind,position,['reward','celebrate'].includes(kind)?32:kind==='cargo'?5:8);}
  function update(dt) {
    dt=Math.min(Math.max(Number(dt)||0,0),.1);
    if(!paused||previewId)fitCamera(dt);
    if(paused||previewId)return;
    clock+=dt;weatherTime+=dt;
    updateCargoAnimation(dt);
    if(moving&&vehicle){
      if(departureTurn){
        departureTurn.time+=dt;
        const t=Math.min(1,departureTurn.time/departureTurn.duration);
        vehicle.rotation.y=departureTurn.from+departureTurn.delta*t*t*(3-2*t);
        if(t>=1)departureTurn=null;
      }else{advanceRoadMotion(motion,dt);position.set(motion.x,.2,motion.z);vehicle.rotation.y=motion.yaw;}
      vehicle.position.copyFrom(position);
      travelDust+=dt;if(travelDust>.24){travelDust=0;burst('dust',position,2);}
      if(motion.done){moving=false;location=destination;destination=null;overview();burst('stop',position,8);onArrival(location);}
    }
    if(vehicle){vehicle.rotation.x=cargoFeedback;vehicle.rotation.z=-cargoFeedback*.55;}
    const cameraTarget=overviewMode?mapFocus:position;
    aim.copyFrom(Vector3.Lerp(aim,cameraTarget,reducedMotion?1:1-Math.exp(-dt*4)));camera.setTarget(aim);
    if(weatherTime>65+(map?.seed%20||0)){weatherTime=0;rainTime=5;}
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
      const projected=Vector3.Project(new Vector3(p.x,Math.max(1.6,(p.height||3.7)+.2),p.z),Matrix.Identity(),scene.getTransformMatrix(),viewport);
      const building=Vector3.Project(new Vector3(p.x,.8,p.z),Matrix.Identity(),scene.getTransformMatrix(),viewport);
      const x=projected.x/w*rect.width,y=projected.y/h*rect.height;
      const screenBounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
      if(p.modelBounds)for(const bx of [p.modelBounds.min.x,p.modelBounds.max.x])for(const by of [p.modelBounds.min.y,p.modelBounds.max.y])for(const bz of [p.modelBounds.min.z,p.modelBounds.max.z]){
        const q=Vector3.Project(new Vector3(bx,by,bz),Matrix.Identity(),scene.getTransformMatrix(),viewport);
        const sx=q.x/w*rect.width,sy=q.y/h*rect.height;
        screenBounds.left=Math.min(screenBounds.left,sx);screenBounds.right=Math.max(screenBounds.right,sx);
        screenBounds.top=Math.min(screenBounds.top,sy);screenBounds.bottom=Math.max(screenBounds.bottom,sy);
      }
      const area=worldRect||{x:0,y:0,width:rect.width,height:rect.height};
      return {id:place.id,x,y,screenBounds,
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
      if(!previous||paused||previewId||moving||!['explore','delivery','loading'].includes(state?.phase))return;
      if(event.pointerId!==previous.pointer||Math.hypot(event.clientX-previous.x,event.clientY-previous.y)>12)return;
      if(info.pickInfo?.pickedMesh?.metadata?.placeId===previous.id)onPlaceTap(previous.id);
    }
  });
  const cancel=()=>{pressed=null;};
  canvas?.addEventListener('pointerdown',trackDown,true);canvas?.addEventListener('pointerup',trackUp,true);canvas?.addEventListener('pointercancel',trackUp,true);
  canvas?.addEventListener('pointercancel',cancel);canvas?.addEventListener('lostpointercapture',cancel);
  const resizeObserver=engine.onResizeObservable.add(()=>fitCamera());
  return {
    setMap,sync,travel,update,overview,effect,projectPlaces,setLayout,setModelPreview,
    cancelInput(){pressed=null;heldPointers.clear();multiPointerGesture=false;},
    setPaused(value){paused=!!value;pressed=null;},
    setReducedMotion(value){reducedMotion=!!value;if(value){for(const p of particles.particles)p.isVisible=false;particles.setParticles();}},
    getState(){return {parkedVehicleIds:[...parkedVehicleIds],streetInfo:{...streetInfo,decorationIds:[...streetInfo.decorationIds],roadModelIds:[...streetInfo.roadModelIds],roadworkModelIds:roadworkInstances.length?['street-fence','street-cone']:[]},position:{x:position.x,y:position.y,z:position.z},moving,location,vehicleId,speed:motion?.speed||0,heading:vehicle?.rotation.y||0,curvature:motion?.curvature||0,cargoAnimation:cargoAnimation?{time:cargoAnimation.time,count:cargoAnimation.items.length}:null,cargoMeshCount:cargoRoot?.getChildMeshes().length||0,meshCount:scene.meshes.length,orphanMeshCount:scene.meshes.filter(m=>m!==particleMesh&&!m.metadata?.modelPreview&&!m.isDescendantOf(mapRoot)&&!m.isDescendantOf(vehicle)).length,particleCount:particles.particles.filter(p=>p.isVisible).length,particleLimit:96,weather:rainTime>0?'rain':'clear',preview:{...modelPreview.getState(),zoom:previewZoom},camera:{overview:overviewMode,halfHeight:currentHalfHeight,target:{x:aim.x,z:aim.z}},theme:map?.theme,landmarks:[...placement].map(([id,p])=>({id,x:p.x,z:p.z,height:p.height,rotation:p.rotation}))};},
    dispose(){
      scene.onPointerObservable.remove(observer);engine.onResizeObservable.remove(resizeObserver);
      canvas?.removeEventListener('pointercancel',cancel);canvas?.removeEventListener('lostpointercapture',cancel);
      canvas?.removeEventListener('pointerdown',trackDown,true);canvas?.removeEventListener('pointerup',trackUp,true);canvas?.removeEventListener('pointercancel',trackUp,true);
      for(const instance of mapInstances.splice(0))instance.dispose();mapRoot?.dispose(false,false);
      modelPreview.dispose();clearCargoAnimation();vehicleAsset?.dispose();particles.dispose();particleMaterial.dispose();
      for(const material of materials.values())material.dispose();shadows.dispose();camera.dispose();ambient.dispose();sun.dispose();
    },
  };
}
