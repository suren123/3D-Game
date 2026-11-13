import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import {createWorld} from '../src/v2/world.js';
import {createGame} from '../src/v2/rules.js';

const paths={'street-lamp':'kenney-streets','town-road-sign':'kenney-town','town-traffic-light':'kenney-town'};
async function load(id,scene){
  const file=readFileSync(new URL(`../public/models/${paths[id]}/${id}.glb`,import.meta.url)),size=file.readUInt32LE(12),doc=JSON.parse(file.subarray(20,20+size));
  // Keep real vertices, normals and every GLTF coordinate-conversion transform.
  for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  delete doc.materials;delete doc.images;delete doc.textures;delete doc.samplers;
  doc.buffers[0].uri=`data:application/octet-stream;base64,${file.subarray(28+size).toString('base64')}`;
  return LoadAssetContainerAsync(`data:${JSON.stringify(doc)}`,scene,{pluginExtension:'.gltf'});
}
function vertices(root){
  return root.getChildMeshes().flatMap(mesh=>{
    const data=mesh.getVerticesData('position');if(!data)return [];
    const transform=mesh.computeWorldMatrix(true),result=[];
    for(let i=0;i<data.length;i+=3)result.push(Vector3.TransformCoordinates(Vector3.FromArray(data,i),transform));
    return result;
  });
}
const center=points=>({x:(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,z:(Math.min(...points.map(p=>p.z))+Math.max(...points.map(p=>p.z)))/2});
const unit=p=>{const d=Math.hypot(p.x,p.z);return {x:p.x/d,z:p.z/d};};
const dot=(a,b)=>a.x*b.x+a.z*b.z;
const key=edge=>[...edge].sort().join(':');
const overlap=(a,b)=>a.min.x<b.max.x-1e-6&&a.max.x>b.min.x+1e-6&&a.min.z<b.max.z-1e-6&&a.max.z>b.min.z+1e-6;

test('128 seeded towns place actual GLB lamps, signs and signals by real roads with correct pole anchors and facing',async()=>{
  const engine=new NullEngine();engine._renderingCanvas={getBoundingClientRect:()=>({width:1180,height:820}),addEventListener(){},removeEventListener(){}};
  const scene=new Scene(engine),loaded={};
  for(const id of Object.keys(paths))loaded[id]=await load(id,scene);
  const source={};
  for(const [id,container]of Object.entries(loaded)){
    source[id]=vertices(container.meshes.find(mesh=>mesh.name==='__root__'));
    const base=center(source[id].filter(p=>p.y<.001));
    if(id==='street-lamp'){
      const head=center(source[id].filter(p=>p.y>.57&&p.z<-.15));
      assert.ok(head.z<base.z-.15&&Math.abs(head.x-base.x)<1e-6,'real loaded lamp head extends -Z');
    }else if(id==='town-traffic-light'){
      const lenses=source[id].filter(p=>p.x>.11&&p.y>1.2&&p.y<1.6&&Math.abs(p.z)<.051);
      assert.ok(lenses.length>=20&&center(lenses).x>base.x+.15,'real three-light lenses face +X after Babylon conversion');
    }else{
      assert.ok(source[id].some(p=>p.y>1.1&&p.x>base.x+.5)&&source[id].some(p=>p.y>1.1&&p.z>base.z+.5),'real sign wings extend +X and +Z from its offset pole');
    }
  }
  const inert={instantiateModelsToScene(rename){const root=new TransformNode(rename('root'),scene),mesh=MeshBuilder.CreateBox(rename('mesh'),{size:.1},scene);mesh.parent=root;return {rootNodes:[root],dispose(){root.dispose();}};}};
  const world=createWorld(scene,{assets:new Proxy(loaded,{get:(assets,id)=>assets[id]||inert})}),seen=new Set();
  try{
    for(let seed=0;seed<128;seed++){
      const state=createGame({seed}).getState(),map=state.map;world.sync(state);
      const fixtures=world.getState().streetInfo.fixturePlacements,nodes=new Map(map.nodes.map(n=>[n.id,n])),roadKeys=new Set(map.edges.map(key));
      const lanes=map.edges.map(([aId,bId])=>{const a=nodes.get(aId),b=nodes.get(bId),h=map.layout.roadWidth/2;return {min:{x:Math.min(a.x,b.x)-(a.x===b.x?h:0),z:Math.min(a.z,b.z)-(a.z===b.z?h:0)},max:{x:Math.max(a.x,b.x)+(a.x===b.x?h:0),z:Math.max(a.z,b.z)+(a.z===b.z?h:0)}};});
      const lots=[...map.places.map(p=>p.lot),...map.layout.residentialLots,map.layout.parkingLot].filter(Boolean).map(lot=>({min:{x:lot.x-lot.width/2,z:lot.z-lot.depth/2},max:{x:lot.x+lot.width/2,z:lot.z+lot.depth/2}}));
      const paths=scene.meshes.filter(mesh=>mesh.name==='entrance-walkway').map(mesh=>{mesh.computeWorldMatrix(true);const b=mesh.getBoundingInfo().boundingBox;return {min:b.minimumWorld,max:b.maximumWorld};});
      const bounds=[];
      for(const fixture of fixtures){
        seen.add(fixture.id);
        const root=scene.transformNodes.find(n=>n.name===`${fixture.id}:instance`&&Math.hypot(n.position.x-fixture.position.x,n.position.z-fixture.position.z)<1e-6);
        assert.ok(root);root.computeWorldMatrix(true);
        const box=root.getHierarchyBoundingVectors(true);bounds.push(box);
        assert.ok(box.min.x>=map.layout.bounds.minX&&box.max.x<=map.layout.bounds.maxX&&box.min.z>=map.layout.bounds.minZ&&box.max.z<=map.layout.bounds.maxZ,'complete fixture stays on the island');
        assert.ok([...lanes,...lots,...paths].every(obstacle=>!overlap(box,obstacle)),`seed${seed}: complete ${fixture.id} clears lanes and reserved lots`);
        const baseVertices=vertices(root).filter(p=>p.y<.061),actualBase=center(baseVertices);
        assert.ok(Math.hypot(actualBase.x-fixture.base.x,actualBase.z-fixture.base.z)<2e-6,'position uses the real pole base instead of the model bounding-box centre');
        if(fixture.id==='street-lamp'){
          assert.ok(roadKeys.has(key(fixture.edge)));
          const a=nodes.get(fixture.edge[0]),b=nodes.get(fixture.edge[1]);
          const target={x:(a.x+b.x)/2,z:(a.z+b.z)/2},toward=unit({x:target.x-fixture.base.x,z:target.z-fixture.base.z});
          const nearest=map.edges.map(([aId,bId])=>{const a=nodes.get(aId),b=nodes.get(bId),dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((fixture.base.x-a.x)*dx+(fixture.base.z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(fixture.base.x-a.x-t*dx,fixture.base.z-a.z-t*dz);});
          assert.ok(Math.abs(Math.min(...nearest)-Math.hypot(target.x-fixture.base.x,target.z-fixture.base.z))<1e-6,'lamp faces its nearest actual road instead of a distant parallel edge');
          const localHead=center(source[fixture.id].filter(p=>p.y>.57&&p.z<-.15)),head=Vector3.TransformCoordinates(new Vector3(localHead.x,0,localHead.z),root.getWorldMatrix());
          assert.ok(dot(toward,unit({x:head.x-actualBase.x,z:head.z-actualBase.z}))>.999,'actual lamp arm faces its adjacent lane');
        }else{
          const junction=nodes.get(fixture.junctionId);
          assert.ok(junction&&map.edges.filter(edge=>edge.includes(junction.id)).length>=3);
          assert.ok(Math.hypot(fixture.base.x-junction.x,fixture.base.z-junction.z)<3.6,'fixture is beside its real junction');
          if(fixture.id==='town-traffic-light'){
            assert.ok(roadKeys.has(key(fixture.edge)));
            const approach=nodes.get(fixture.approachNodeId),incoming=unit({x:approach.x-junction.x,z:approach.z-junction.z});
            const localFace=center(source[fixture.id].filter(p=>p.x>.11&&p.y>1.2&&p.y<1.6&&Math.abs(p.z)<.051));
            const face=Vector3.TransformCoordinates(new Vector3(localFace.x,0,localFace.z),root.getWorldMatrix());
            assert.ok(dot(incoming,unit({x:face.x-actualBase.x,z:face.z-actualBase.z}))>.999,'actual lenses face approaching traffic on a connected road');
          }else{
            assert.ok(fixture.edges.length===2&&fixture.edges.every(edge=>roadKeys.has(key(edge))));
            const wings=[source[fixture.id].filter(p=>p.y>1.1&&p.y<1.33&&p.x>0),source[fixture.id].filter(p=>p.y>1.32&&p.z>0)];
            for(const vertices of wings){
              const local=center(vertices),end=Vector3.TransformCoordinates(new Vector3(local.x,0,local.z),root.getWorldMatrix());
              const wing=unit({x:end.x-actualBase.x,z:end.z-actualBase.z});
              assert.ok(fixture.edges.some(edge=>{const next=nodes.get(edge.find(id=>id!==junction.id));return dot(wing,unit({x:next.x-junction.x,z:next.z-junction.z}))>.999;}),'each actual loaded sign wing points along an existing street, including T junctions');
            }
          }
        }
      }
      assert.ok(bounds.every((box,i)=>bounds.slice(i+1).every(other=>!overlap(box,other))),'street fixtures do not intersect each other');
    }
    assert.deepEqual([...seen].sort(),Object.keys(paths).sort(),'multi-seed coverage actually places all three fixture types');
    const blocked=createGame({seed:19}).getState();blocked.map.seed=10019;
    blocked.map.layout.residentialLots.push({x:0,z:0,width:200,depth:200});world.sync(blocked);
    assert.deepEqual(world.getState().streetInfo.fixturePlacements,[],'no legal road verge means skip fixtures instead of forcing an isolated fallback');
  }finally{world.dispose();for(const container of Object.values(loaded))container.dispose();scene.dispose();engine.dispose();}
});
