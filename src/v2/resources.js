import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import '@babylonjs/loaders/glTF/glTFFileLoader.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { RESOURCE_MANIFEST } from './resource-manifest.js';
export { RESOURCE_MANIFEST } from './resource-manifest.js';
const assetURL=path=>new URL(`${import.meta.env.BASE_URL}${path}`,document.baseURI).href;

export async function preloadResources(scene,audio,onProgress) {
  const assets=new Map(); let completed=0,bytes=0;
  const total=RESOURCE_MANIFEST.models.length+RESOURCE_MANIFEST.audio.length+1;
  const update=text=>onProgress({progress:++completed/total*.88,text});
  async function read(path) {
    const response=await fetch(assetURL(path));
    if(!response.ok)throw new Error(`资源未准备好：${path} (${response.status})`);
    const data=await response.arrayBuffer();bytes+=data.byteLength;return data;
  }
  try {
    // A small concurrency limit bounds transient memory and connection pressure.
    const tasks=RESOURCE_MANIFEST.audio.map(item=>async()=>{
      await audio.decode(item.id,await read(item.path));update('把声音装进口袋…');
    });
    for(const item of RESOURCE_MANIFEST.models)tasks.push(async()=>{
      const container=await LoadAssetContainerAsync(assetURL(item.path),scene);
      // These matte toy assets do not need metallic/roughness lighting. Reuse
      // their exact colours/textures with a simpler diffuse shader on iPad.
      const replacements=new Map();
      for(const original of container.materials){
        if(!original.albedoColor)continue;
        const toy=new StandardMaterial(`toy-${original.name}`,scene);
        toy.diffuseColor=original.albedoColor.clone();toy.specularColor=Color3.Black();
        toy.diffuseTexture=original.albedoTexture;toy.alpha=original.alpha;
        toy.backFaceCulling=original.backFaceCulling;toy.sideOrientation=original.sideOrientation;
        scene.removeMaterial(toy);replacements.set(original,toy);
      }
      for(const mesh of container.meshes)if(replacements.has(mesh.material))mesh.material=replacements.get(mesh.material);
      container.materials=container.materials.map(material=>replacements.get(material)||material);
      for(const original of replacements.keys())original.dispose(false,false);
      assets.set(item.id,container);update('把小车和房子放进小镇…');
    });
    let next=0;
    const results=await Promise.allSettled(Array.from({length:4},async()=>{
      while(next<tasks.length){const task=tasks[next++];await task();}
    }));
    const failed=results.find(x=>x.status==='rejected');if(failed)throw failed.reason;
    await document.fonts.ready;update('小镇准备就绪…');
    return {assets,stats:{version:RESOURCE_MANIFEST.version,count:total,audioBytes:bytes,ready:false},
      async warm(){
        onProgress({progress:.92,text:'给每辆车做出发检查…'});
        for(const container of assets.values()){
          // Compile scene-attached clones with the actual lights. Container-only
          // meshes have no light sources after removeAllFromScene().
          const warm=container.instantiateModelsToScene(name=>`warm-${name}`,false,{doNotInstantiate:true});
          try {
            for(const node of warm.rootNodes)node.setEnabled(false);
            for(const node of warm.rootNodes)for(const mesh of [node,...node.getChildMeshes()]){
              if(mesh.material&&mesh.getTotalVertices?.()>0)await mesh.material.forceCompilationAsync(mesh);
            }
          }finally{warm.dispose();}
        }
        await scene.whenReadyAsync();
        onProgress({progress:1,text:'准备好啦！'});
      },
      dispose(){for(const container of assets.values())container.dispose();}
    };
  } catch(error) {for(const c of assets.values())c.dispose();throw error;}
}
