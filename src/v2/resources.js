import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import '@babylonjs/loaders/glTF/glTFFileLoader.js';
import { RESOURCE_MANIFEST } from './resource-manifest.js';
export { RESOURCE_MANIFEST } from './resource-manifest.js';
const assetURL=path=>{
  const url=new URL(`${import.meta.env.BASE_URL}${path}`,document.baseURI);
  // Pages may cache unchanged filenames between releases (including voices).
  url.searchParams.set('v',RESOURCE_MANIFEST.version);
  return url.href;
};

export async function preloadResources(scene,audio,onProgress) {
  const assets=new Map(),icons=new Map(); let completed=0,bytes=0;
  const total=RESOURCE_MANIFEST.models.length+RESOURCE_MANIFEST.audio.length+RESOURCE_MANIFEST.icons.length+1;
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
    for(const item of RESOURCE_MANIFEST.icons)tasks.push(async()=>{
      const blob=new Blob([await read(item.path)],{type:'image/png'}),url=URL.createObjectURL(blob);
      try{
        const image=new Image();image.src=url;await image.decode();icons.set(item.id,image);
      }finally{URL.revokeObjectURL(url);}
      update('认一认小车和地点…');
    });
    for(const item of RESOURCE_MANIFEST.models)tasks.push(async()=>{
      const container=await LoadAssetContainerAsync(assetURL(item.path),scene);
      // Retain authored PBR colors, texture color space, metallic and roughness.
      // A global override changes Kenney surfaces before they reach the light.
      // Explicit legacy Nature exception: its leaf/bark GLBs encode metallic=1,
      // unlike their matte appearance in Kenney's reference images. Keep color
      // and authored roughness; do not apply this correction to other packs.
      if(item.materialPolicy==='matte-vegetation')for(const material of container.materials){
        if(material.albedoColor)material.metallic=0;
      }
      assets.set(item.id,container);update('把小车和房子放进小镇…');
    });
    let next=0;
    const results=await Promise.allSettled(Array.from({length:4},async()=>{
      while(next<tasks.length){const task=tasks[next++];await task();}
    }));
    const failed=results.find(x=>x.status==='rejected');if(failed)throw failed.reason;
    await document.fonts.ready;update('小镇准备就绪…');
    return {assets,icons,stats:{version:RESOURCE_MANIFEST.version,count:total,audioBytes:bytes,icons:icons.size,ready:false},
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
      dispose(){for(const container of assets.values())container.dispose();assets.clear();icons.clear();}
    };
  } catch(error) {for(const c of assets.values())c.dispose();throw error;}
}
