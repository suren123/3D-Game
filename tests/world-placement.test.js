import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import {RESOURCE_MANIFEST} from '../src/v2/resource-manifest.js';
import {createWorld} from '../src/v2/world.js';
import {createGame} from '../src/v2/rules.js';
import {VEHICLES} from '../src/v2/catalog.js';

// Let the real Babylon loader apply all source and __root__ transforms. Its
// left-hand conversion is a Y half-turn plus scaleZ=-1, NOT a lone Z reflection.
// Only material/image bindings are removed to avoid Node's missing image decoder;
// binary buffers, geometry, node transforms and scene hierarchy stay unchanged.
async function loadGeometry(path,scene) {
  const file=readFileSync(new URL(`../public/${path}`,import.meta.url));
  const jsonLength=file.readUInt32LE(12),doc=JSON.parse(file.subarray(20,20+jsonLength));
  for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  delete doc.materials;delete doc.textures;delete doc.images;delete doc.samplers;
  doc.buffers[0].uri=`data:application/octet-stream;base64,${file.subarray(28+jsonLength).toString('base64')}`;
  return LoadAssetContainerAsync(`data:${JSON.stringify(doc)}`,scene,{pluginExtension:'.gltf'});
}

const intersects=(a,b)=>a.min.x<b.max.x-1e-6&&a.max.x>b.min.x+1e-6&&a.min.z<b.max.z-1e-6&&a.max.z>b.min.z+1e-6;
const lotBounds=lot=>({min:{x:lot.x-lot.width/2,z:lot.z-lot.depth/2},max:{x:lot.x+lot.width/2,z:lot.z+lot.depth/2}});
const contains=(outer,inner)=>inner.min.x>=outer.min.x-1e-6&&inner.max.x<=outer.max.x+1e-6&&inner.min.z>=outer.min.z-1e-6&&inner.max.z<=outer.max.z+1e-6;
function bounds(node) {
  node.computeWorldMatrix(true);return node.getHierarchyBoundingVectors(true);
}
function triangles(node) {
  const result=[];
  for(const mesh of node.getChildMeshes()){
    const positions=mesh.getVerticesData('position'),indices=mesh.getIndices();
    if(!positions||!indices)continue;
    const transform=mesh.computeWorldMatrix(true);
    for(let i=0;i<indices.length;i+=3)result.push(Array.from(indices.slice(i,i+3),index=>
      Vector3.TransformCoordinates(Vector3.FromArray(positions,index*3),transform)));
  }
  return result;
}
function triangleHitsRect(triangle,rect) {
  const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
  if(triangle.some(p=>p.x>=rect.min.x&&p.x<=rect.max.x&&p.z>=rect.min.z&&p.z<=rect.max.z))return true;
  const corners=[{x:rect.min.x,z:rect.min.z},{x:rect.max.x,z:rect.min.z},{x:rect.max.x,z:rect.max.z},{x:rect.min.x,z:rect.max.z}];
  const crossing=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&
    Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+1e-8&&
    Math.max(Math.min(a.z,b.z),Math.min(c.z,d.z))<=Math.min(Math.max(a.z,b.z),Math.max(c.z,d.z))+1e-8;
  for(let i=0;i<3;i++)for(let j=0;j<4;j++)if(crossing(triangle[i],triangle[(i+1)%3],corners[j],corners[(j+1)%4]))return true;
  // Vertical rails have degenerate XZ projections. Their segments were checked
  // above; they must not turn their whole enclosing rectangle into a solid wall.
  if(Math.abs(cross(triangle[0],triangle[1],triangle[2]))<1e-8)return false;
  return corners.some(point=>{
    const signs=triangle.map((a,i)=>cross(a,triangle[(i+1)%3],point));
    return signs.every(value=>value>=0)||signs.every(value=>value<=0);
  });
}
function lanes(map) {
  const half=map.layout.roadWidth/2,nodes=new Map(map.nodes.map(node=>[node.id,node]));
  return [...map.nodes.map(node=>({min:{x:node.x-half,z:node.z-half},max:{x:node.x+half,z:node.z+half}})),
    ...map.edges.map(([aId,bId])=>{
      const a=nodes.get(aId),b=nodes.get(bId);
      return {min:{x:Math.min(a.x,b.x)-(a.x===b.x?half:0),z:Math.min(a.z,b.z)-(a.z===b.z?half:0)},
        max:{x:Math.max(a.x,b.x)+(a.x===b.x?half:0),z:Math.max(a.z,b.z)+(a.z===b.z?half:0)}};
    })];
}

test('32 actually loaded GLB towns keep buildings, parked vehicles, vegetation and full-width entrance paths clear',async()=>{
  const engine=new NullEngine();
  engine._renderingCanvas={getBoundingClientRect:()=>({width:1180,height:820}),addEventListener(){},removeEventListener(){}};
  const scene=new Scene(engine),assets=new Map();
  for(const {id,path}of RESOURCE_MANIFEST.models){
    const container=await loadGeometry(path,scene);
    const root=container.meshes.find(mesh=>mesh.name==='__root__');
    assert.ok(root,'actual loader supplies its coordinate-conversion root');
    assert.deepEqual(Vector3.TransformCoordinates(new Vector3(1,0,0),root.computeWorldMatrix(true)).asArray(),[-1,0,0]);
    assert.deepEqual(Vector3.TransformCoordinates(new Vector3(0,0,1),root.getWorldMatrix()).asArray(),[0,0,1]);
    assets.set(id,container);
  }
  const world=createWorld(scene,{assets});
  let fenceCount=0,treeCount=0;
  try {
    // Includes original regressions: seed0 planter, seed4 side parking, and
    // seeds2/7/19 north-lane trees; also cycles all seven residential models.
    for(let seed=0;seed<32;seed++){
      const state=createGame({seed}).getState(),map=state.map;world.sync(state);
      const wrappers=scene.transformNodes.filter(node=>node.name.endsWith(':instance')).map(node=>({
        id:node.name.slice(0,-':instance'.length),node,position:node.position,bounds:bounds(node)}));
      const paths=scene.meshes.filter(mesh=>mesh.name==='entrance-walkway').map(mesh=>{
        mesh.computeWorldMatrix(true);const box=mesh.getBoundingInfo().boundingBox;
        return {min:box.minimumWorld,max:box.maximumWorld};
      });
      const roads=lanes(map);
      for(const place of map.places){
        const building=wrappers.find(w=>w.id===place.id&&w.position.x===place.lot.x&&w.position.z===place.lot.z);
        assert.ok(building,`seed${seed}: ${place.id} is rendered`);
        assert.ok(contains(lotBounds(place.lot),building.bounds),`seed${seed}: actual ${place.id} geometry fits its complete lot`);
      }
      const homes=wrappers.filter(w=>w.id.startsWith('home-'));
      assert.equal(homes.length,map.layout.residentialLots.length);
      for(const home of homes){
        const lot=map.layout.residentialLots.find(lot=>lot.x===home.position.x&&lot.z===home.position.z);
        assert.ok(lot&&contains(lotBounds(lot),home.bounds),`seed${seed}: actual ${home.id} fits its housing reserve`);
      }
      const parking=map.layout.parkingLot;
      assert.ok(parking);
      const parkingBounds=lotBounds(parking),vehicleIds=new Set(VEHICLES.map(vehicle=>vehicle.id));
      const parked=wrappers.filter(w=>vehicleIds.has(w.id)&&w.position.x>=parkingBounds.min.x&&w.position.x<=parkingBounds.max.x&&w.position.z>=parkingBounds.min.z&&w.position.z<=parkingBounds.max.z);
      assert.equal(parked.length,3);
      for(const [i,car]of parked.entries()){
        assert.ok(contains(lotBounds(parking),car.bounds),`seed${seed}: parked ${car.id} fits its separate lot`);
        assert.ok(parked.slice(i+1).every(other=>!intersects(car.bounds,other.bounds)),`seed${seed}: parked cars do not overlap`);
      }
      assert.ok(paths.length>0);
      for(const path of paths)assert.ok(roads.every(road=>!intersects(path,road)),`seed${seed}: the complete rendered walkway clears every driving lane`);
      for(const decoration of wrappers.filter(w=>['street-lamp','street-bench','street-flower','town-trash','town-road-sign','town-traffic-light','planter','poplar','hedge'].includes(w.id))){
        assert.ok(paths.every(path=>!intersects(decoration.bounds,path)),`seed${seed}: ${decoration.id} leaves entrance paths open`);
        if(!['poplar','hedge'].includes(decoration.id))continue;
        treeCount++;
        const lowTriangles=triangles(decoration.node).filter(t=>Math.min(...t.map(p=>p.y))<1.5&&Math.max(...t.map(p=>p.y))>.12);
        assert.ok(roads.every(road=>!intersects(decoration.bounds,road)||!lowTriangles.some(t=>triangleHitsRect(t,road))),`seed${seed}: real ${decoration.id} geometry clears the lane at vehicle height`);
      }
      for(const fence of wrappers.filter(w=>w.id==='town-low-fence')){
        fenceCount++;
        const faces=triangles(fence.node).filter(t=>Math.min(...t.map(p=>p.y))<.8&&Math.max(...t.map(p=>p.y))>.15);
        assert.ok(paths.every(path=>!intersects(fence.bounds,path)||!faces.some(face=>triangleHitsRect(face,path))),`seed${seed}: actual fence rails preserve the central entrance opening`);
      }
    }
    assert.ok(fenceCount>0&&treeCount>0,'geometry checks exercise retained fences and vegetation');
  }finally{world.dispose();for(const container of assets.values())container.dispose();scene.dispose();engine.dispose();}
});
