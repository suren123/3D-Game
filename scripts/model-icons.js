// Development-only baker. Run through Vite with bake_model_icons.py.
// The game ships these PNGs, never this additional scene or its render loop.
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import '@babylonjs/loaders/glTF/glTFFileLoader.js';
import { RESOURCE_MANIFEST } from '../src/v2/resource-manifest.js';
import { PLACES, VEHICLES } from '../src/v2/catalog.js';

const engine = new Engine(document.querySelector('canvas'), true, {preserveDrawingBuffer:true,alpha:true});
engine.setSize(256,256);
window.bakeModelIcon = async id => {
  if (![...PLACES,...VEHICLES].some(x=>x.id===id)) throw new Error('Unknown icon');
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0,0,0,0);
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure=1.05;
  const hemi=new HemisphericLight('sky',Vector3.Up(),scene);hemi.intensity=1;
  hemi.diffuse=Color3.FromHexString('#fff3df');hemi.groundColor=Color3.FromHexString('#b7c9a1');
  const sun=new DirectionalLight('sun',new Vector3(.5,-1,.6),scene);sun.intensity=2.5;
  const camera=new ArcRotateCamera('camera',-Math.PI/4,.92,30,Vector3.Zero(),scene);
  camera.mode=Camera.ORTHOGRAPHIC_CAMERA;
  const item=RESOURCE_MANIFEST.models.find(x=>x.id===id);
  const container=await LoadAssetContainerAsync(new URL('../'+item.path,location.href).href,scene);
  container.addAllToScene();
  for(const m of container.materials)if(m.albedoColor){m.metallic=0;m.roughness=.85;}
  let min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity);
  for(const mesh of container.meshes){
    if(!mesh.getTotalVertices())continue;
    mesh.computeWorldMatrix(true);
    const b=mesh.getBoundingInfo().boundingBox;
    min=Vector3.Minimize(min,b.minimumWorld);max=Vector3.Maximize(max,b.maximumWorld);
  }
  camera.setTarget(min.add(max).scale(.5));
  const view=camera.getViewMatrix(true);
  let half=0;
  for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){
    const p=Vector3.TransformCoordinates(new Vector3(x,y,z),view);
    half=Math.max(half,Math.abs(p.x),Math.abs(p.y));
  }
  half*=1.10;
  camera.orthoLeft=camera.orthoBottom=-half;camera.orthoRight=camera.orthoTop=half;
  await scene.whenReadyAsync();scene.render();scene.render();
  const result=engine.getRenderingCanvas().toDataURL('image/png');
  scene.dispose();return result;
};
