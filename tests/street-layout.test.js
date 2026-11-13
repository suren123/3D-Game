import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planStreets, STREET_WIDTH} from '../src/v2/street-layout.js';
import {generateMap,findRoute} from '../src/v2/rules.js';
import {initialParkingPose,planParkingRoute} from '../src/v2/parking-route.js';
import {RESOURCE_MANIFEST} from '../src/v2/resource-manifest.js';
import {VEHICLES} from '../src/v2/catalog.js';
import {buildRoadPath, sampleRoadPath} from '../src/v2/motion.js';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import {Matrix,Quaternion,Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {createWorld} from '../src/v2/world.js';
import {createGame} from '../src/v2/rules.js';

const directions = [[1,0],[0,1],[-1,0],[0,-1]];
const originalOpenings = {
  'street-road-end': [2], 'street-road-straight': [0,2],
  'street-road-corner': [0,1], 'street-road-t': [0,1,2], 'street-road-cross': [0,1,2,3],
};

const geometryCache=new Map();
function originalGeometry(id){
  if(!geometryCache.has(id))geometryCache.set(id,loadOriginalGeometry(id));
  return geometryCache.get(id);
}
async function loadOriginalGeometry(id,path=`models/kenney-streets/${id}.glb`) {
  const file=readFileSync(new URL(`../public/${path}`,import.meta.url));
  const jsonLength=file.readUInt32LE(12),doc=JSON.parse(file.subarray(20,20+jsonLength).toString());
  // Only image/material bindings are removed for Node; real Babylon loading
  // retains every vertex, node and coordinate-conversion root transform.
  for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  delete doc.materials;delete doc.images;delete doc.textures;delete doc.samplers;
  doc.buffers[0].uri=`data:application/octet-stream;base64,${file.subarray(28+jsonLength).toString('base64')}`;
  const engine=new NullEngine(),scene=new Scene(engine);
  const container=await LoadAssetContainerAsync(`data:${JSON.stringify(doc)}`,scene,{pluginExtension:'.gltf'});
  try{
    const root=container.meshes.find(mesh=>mesh.name==='__root__');
    assert.deepEqual(Vector3.TransformCoordinates(new Vector3(1,0,0),root.computeWorldMatrix(true)).asArray(),[-1,0,0]);
    assert.deepEqual(Vector3.TransformCoordinates(new Vector3(0,0,1),root.getWorldMatrix()).asArray(),[0,0,1]);
    const triangles=[];
    for(const mesh of container.meshes){
      const positions=mesh.getVerticesData('position'),indices=mesh.getIndices();if(!positions||!indices)continue;
      const transform=mesh.computeWorldMatrix(true);
      for(let i=0;i<indices.length;i+=3)triangles.push(Array.from(indices.slice(i,i+3),index=>
        Vector3.TransformCoordinates(Vector3.FromArray(positions,index*3),transform).asArray()));
    }
    assert.ok(triangles.length,'actual loader returns measurable triangles, not TypedArray-coerced NaNs');
    return triangles;
  }finally{container.dispose();scene.dispose();engine.dispose();}
}

const area=t=>Math.abs((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[2][0]-t[0][0])*(t[1][1]-t[0][1]));
const inside=(p,t)=>{
  const signs=t.map((a,i)=>{const b=t[(i+1)%3];return(p[0]-b[0])*(a[1]-b[1])-(a[0]-b[0])*(p[1]-b[1]);});
  return !(Math.min(...signs)<-1e-6&&Math.max(...signs)>1e-6);
};
function measuredOpenings(triangles,rotation=0){
  const transform=Matrix.RotationY(rotation);
  const projected=t=>t.map(p=>{
    const v=Vector3.TransformCoordinates(Vector3.FromArray(p),transform);return[v.x,v.z];
  });
  const surfaces=triangles.filter(t=>t.every(([,y])=>y>.009&&y<.011)).map(projected).filter(t=>area(t)>1e-10);
  const curbs=triangles.filter(t=>t.every(([,y])=>y>.019)).map(projected).filter(t=>area(t)>1e-10);
  // Rounded bends have empty space on their closed sides: absence of a curb
  // does NOT make an opening. Require actual asphalt at each connection.
  return directions.flatMap(([x,z],i)=>{
    const point=[x*.499,z*.499];
    return surfaces.some(t=>inside(point,t))&&!curbs.some(t=>inside(point,t))?[i]:[];
  });
}

test('canonical openings agree with actual Babylon-loaded GLB road surfaces and root transforms',async()=>{
  for(const [id,expected]of Object.entries(originalOpenings)){
    assert.deepEqual(measuredOpenings(await originalGeometry(id)),expected,`${id}: actual loaded asphalt must match the orientation template`);
  }
});

test('all 15 connected-node combinations have exactly their actual loaded road openings',async()=>{
  for(let bits=1;bits<16;bits++){
    const nodes=[{id:'c',x:0,z:0},...directions.map(([x,z],i)=>({id:`d${i}`,x:x*8,z:z*8}))];
    const edges=directions.flatMap((_,i)=>bits&(1<<i)?[['c',`d${i}`]]:[]);
    const plan=planStreets({nodes,edges}),center=plan.find(p=>p.nodeId==='c');
    const openings=measuredOpenings(await originalGeometry(center.id),center.rotation);
    assert.deepEqual(openings,directions.flatMap((_,i)=>bits&(1<<i)?[i]:[]));
    for(let i=0;i<4;i++){
      assert.equal(plan.some(p=>p.edge?.includes(`d${i}`)),!!(bits&(1<<i)), 'missing edges must never become visible roads');
      assert.equal(plan.some(p=>p.nodeId===`d${i}`),!!(bits&(1<<i)));
    }
  }
});

test('1000 generated maps join edge pieces flush to the reserved junction tiles',()=>{
  const half=STREET_WIDTH/2;
  for(let seed=1;seed<=1000;seed++){
    const map=generateMap(seed),plan=planStreets(map),nodes=new Map(map.nodes.map(n=>[n.id,n]));
    assert.equal(plan.filter(p=>p.kind==='node').length,map.nodes.length);
    for(const [aId,bId]of map.edges){
      const a=nodes.get(aId),b=nodes.get(bId),length=Math.hypot(b.x-a.x,b.z-a.z);
      const dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
      const intervals=plan.filter(p=>p.edge?.[0]===aId&&p.edge?.[1]===bId).map(p=>{
        const center=(p.position[0]-a.x)*dx+(p.position[2]-a.z)*dz;
        assert.ok(Math.abs((p.position[0]-a.x)*dz-(p.position[2]-a.z)*dx)<1e-10);
        assert.equal(p.scale[2],STREET_WIDTH);
        const forward={x:Math.cos(p.rotation),z:-Math.sin(p.rotation)};
        assert.ok(Math.abs(forward.x*dx+forward.z*dz-1)<1e-10);
        return [center-p.scale[0]/2,center+p.scale[0]/2];
      }).sort((p,q)=>p[0]-q[0]);
      let cursor=half;
      for(const [start,end]of intervals){assert.ok(Math.abs(start-cursor)<1e-10,'no gap or overlap');cursor=end;}
      assert.ok(Math.abs(cursor-(length-half))<1e-10);
    }
  }
});

test('actual rounded road surfaces and raised curbs contain the complete turning vehicle footprint',async()=>{
  const overlap=(a,b)=>{
    for(const poly of [a,b])for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length],nx=-(q[1]-p[1]),nz=q[0]-p[0];
      const av=a.map(v=>v[0]*nx+v[1]*nz),bv=b.map(v=>v[0]*nx+v[1]*nz);
      if(Math.max(...av)<=Math.min(...bv)+1e-6||Math.max(...bv)<=Math.min(...av)+1e-6)return false;
    }
    return true;
  };
  for(const gap of [8,9,10.5,11])for(const turn of [-1,1]){
    const path=buildRoadPath([{x:0,z:0},{x:0,z:gap},{x:gap*turn,z:gap}]);
    const arc=path.segments.find(s=>s.kind==='arc');
    const plan=planStreets({nodes:[{id:'a',x:0,z:0},{id:'b',x:0,z:gap},{id:'c',x:gap*turn,z:gap}],edges:[['a','b'],['b','c']]});
    const pieces=[];const curbs=[];
    for(const piece of plan){
      const transform=Matrix.Compose(Vector3.FromArray(piece.scale),Quaternion.RotationYawPitchRoll(piece.rotation,0,0),Vector3.FromArray(piece.position));
      const geometry=await originalGeometry(piece.id);
      const projected=t=>t.map(p=>{const v=Vector3.TransformCoordinates(Vector3.FromArray(p),transform);return[v.x,v.z];});
      const surface=geometry.filter(t=>t.every(([,y])=>y>.009&&y<.011)).map(projected).filter(t=>area(t)>1e-10);
      pieces.push({surface,minX:Math.min(...surface.flat().map(p=>p[0])),maxX:Math.max(...surface.flat().map(p=>p[0])),minZ:Math.min(...surface.flat().map(p=>p[1])),maxZ:Math.max(...surface.flat().map(p=>p[1]))});
      curbs.push(...geometry.filter(t=>t.every(([,y])=>y>.019)).map(projected).filter(t=>area(t)>1e-10));
    }
    const asphalt=p=>pieces.some(piece=>p[0]>=piece.minX-1e-6&&p[0]<=piece.maxX+1e-6&&p[1]>=piece.minZ-1e-6&&p[1]<=piece.maxZ+1e-6&&piece.surface.some(t=>inside(p,t)));
    for(let distance=arc.start;distance<=arc.start+arc.length;distance+=.025){
      const p=sampleRoadPath(path,distance);
      const point=(side,fore)=>[p.x+Math.sin(p.yaw)*fore+Math.cos(p.yaw)*side,p.z+Math.cos(p.yaw)*fore-Math.sin(p.yaw)*side];
      for(const [halfWidth,halfLength]of [[.9,2.05],[1.05,1.7]]){
        const body=[point(-halfWidth,-halfLength),point(halfWidth,-halfLength),point(halfWidth,halfLength),point(-halfWidth,halfLength)];
        assert.ok(curbs.every(curb=>!overlap(body,curb)),'complete rigid vehicle rectangle avoids actual raised-curb triangles');
        for(const corner of body)assert.ok(asphalt(corner),'all vehicle corners lie on actual loaded asphalt');
        for(let side=-halfWidth;side<=halfWidth;side+=.2)for(let fore=-halfLength;fore<=halfLength;fore+=.2){
          assert.ok(asphalt(point(side,fore)),'body and wheels stay on actual loaded road surface through the entire turn');
        }
      }
    }
  }
});

test('real road geometry contains parked and travelling vehicles across consecutive tasks and depot returns',async()=>{
  // Current runtime vehicles all use scale 1.16. Verify the conservative body
  // envelopes against actual loader geometry before relying on those bounds.
  for(const vehicle of VEHICLES){
    const item=RESOURCE_MANIFEST.models.find(model=>model.id===vehicle.id);
    const geometry=await loadOriginalGeometry(vehicle.id,item.path),vertices=geometry.flat();
    const halfWidth=Math.max(...vertices.map(v=>Math.abs(v[0])))*1.16;
    const halfLength=Math.max(...vertices.map(v=>Math.abs(v[2])))*1.16;
    assert.ok((halfWidth<=.9&&halfLength<=2.05)||(halfWidth<=1.05&&halfLength<=1.7),`${vehicle.id}: actual vehicle exceeds the verified road envelope`);
  }
  const overlap=(a,b)=>{
    for(const poly of [a,b])for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length],nx=-(q[1]-p[1]),nz=q[0]-p[0];
      const av=a.map(v=>v[0]*nx+v[1]*nz),bv=b.map(v=>v[0]*nx+v[1]*nz);
      if(Math.max(...av)<=Math.min(...bv)+1e-6||Math.max(...bv)<=Math.min(...av)+1e-6)return false;
    }
    return true;
  };
  const box=t=>({minX:Math.min(...t.map(p=>p[0])),maxX:Math.max(...t.map(p=>p[0])),minZ:Math.min(...t.map(p=>p[1])),maxZ:Math.max(...t.map(p=>p[1]))});
  const boxesOverlap=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;
  for(const seed of [19,0,1]){
    const map=generateMap(seed),surfaces=[],curbs=[];
    for(const piece of planStreets(map)){
      const transform=Matrix.Compose(Vector3.FromArray(piece.scale),Quaternion.RotationYawPitchRoll(piece.rotation,0,0),Vector3.FromArray(piece.position));
      const geometry=await originalGeometry(piece.id);
      const projected=t=>t.map(p=>{const v=Vector3.TransformCoordinates(Vector3.FromArray(p),transform);return[v.x,v.z];});
      const triangles=geometry.filter(t=>t.every(([,y])=>y>.009&&y<.011)).map(projected).filter(t=>area(t)>1e-10);
      surfaces.push({triangles,...box(triangles.flat())});
      curbs.push(...geometry.filter(t=>t.every(([,y])=>y>.019)).map(projected).filter(t=>area(t)>1e-10).map(t=>({triangle:t,...box(t)})));
    }
    const asphalt=p=>surfaces.some(s=>p[0]>=s.minX-1e-6&&p[0]<=s.maxX+1e-6&&p[1]>=s.minZ-1e-6&&p[1]<=s.maxZ+1e-6&&s.triangles.some(t=>inside(p,t)));
    const check=(pose,label)=>{
      const point=(side,fore)=>[pose.x+Math.sin(pose.yaw)*fore+Math.cos(pose.yaw)*side,pose.z+Math.cos(pose.yaw)*fore-Math.sin(pose.yaw)*side];
      for(const [width,length]of [[.9,2.05],[1.05,1.7]]){
        const body=[point(-width,-length),point(width,-length),point(width,length),point(-width,length)],bodyBox=box(body);
        assert.ok(curbs.every(curb=>!boxesOverlap(curb,bodyBox)||!overlap(body,curb.triangle)),`${label}: full body intersects an actual raised curb`);
        for(const p of [...body,point(0,0),point(-width,0),point(width,0),point(0,-length),point(0,length)])assert.ok(asphalt(p),`${label}: body leaves actual loaded asphalt`);
      }
    };
    const trip=(from,to,start,blockedEdges=[])=>{
      const plan=planParkingRoute(map,findRoute(map,from,to,blockedEdges),{position:start},{placeId:to,blockedEdges}),path=buildRoadPath(plan.points);
      for(let d=0;d<path.length;d+=.2)check(sampleRoadPath(path,d),`seed${seed} ${from}->${to} at ${d.toFixed(1)}m`);
      const end=sampleRoadPath(path,path.length);check(end,`seed${seed} ${to} stopped`);return end;
    };
    let location='depot',pose=initialParkingPose(map);check(pose,`seed${seed} initial depot`);
    for(const place of [...map.places.filter(p=>p.id!=='depot'),{id:'depot'}]){
      pose=trip(location,place.id,pose);location=place.id;
    }
    for(const from of map.places)for(const to of map.places){
      if(from.id===to.id)continue;
      const stop=trip(from.id,to.id,initialParkingPose(map,from.id));
      trip(to.id,from.id,stop);
    }
    // Exercise detours on the same loaded asphalt, reserving actual entrance
    // edges exactly as the roadworks rules do. Pure graph checks alone cannot
    // show that a changed junction approach contains the complete body.
    const key=edge=>[...edge].sort().join(':');
    const frontages=new Set(map.places.map(place=>key(place.lot.accessEdge)));
    const blocked=map.edges.find(edge=>!frontages.has(key(edge))&&map.places.every(place=>findRoute(map,'depot',place.id,[edge]).length));
    assert.ok(blocked);
    for(const from of map.places)for(const to of map.places){
      if(from.id!==to.id)trip(from.id,to.id,initialParkingPose(map,from.id),[blocked]);
    }
  }
  // This tests translated driving and stopped poses. The existing visual
  // in-place departure half-turn can still swing the body outside a 3m lane;
  // a full collision/turnaround system is explicitly outside this correction.
});

test('three acceptance seeds place road fixtures only where legal and clean event models',()=>{
  // NullEngine exercises real world placement and cleanup, with inert model
  // containers. Geometry orientation is independently checked above; rendering
  // and actual GLB loading remain browser acceptance responsibilities.
  const engine=new NullEngine();
  engine._renderingCanvas={getBoundingClientRect:()=>({width:1180,height:820}),addEventListener(){},removeEventListener(){}};
  const scene=new Scene(engine);
  const model={instantiateModelsToScene(rename){
    const root=new TransformNode(rename('root'),scene);
    const mesh=MeshBuilder.CreateBox(rename('mesh'),{size:1},scene);mesh.parent=root;
    return {rootNodes:[root],dispose(){root.dispose();}};
  }};
  const world=createWorld(scene,{assets:new Proxy({},{get:()=>model})});
  const seenDecorations=new Set();
  try {
    for(const seed of [2,7,14]){
      const state=createGame({seed}).getState();world.sync(state);
      const info=world.getState().streetInfo;
      for(const id of info.decorationIds)seenDecorations.add(id);
      for(const fixture of info.fixturePlacements){
        if(fixture.edge)assert.ok(state.map.edges.some(edge=>[...edge].sort().join(':')===[...fixture.edge].sort().join(':')));
        if(fixture.junctionId)assert.ok(state.map.edges.filter(edge=>edge.includes(fixture.junctionId)).length>=3);
      }
      assert.ok(info.decorationCount>=5&&info.decorationCount<=11);
      const meshes=scene.meshes.filter(m=>m.name.startsWith('street-'));
      assert.ok(meshes.length>info.tileCount);
      assert.ok(meshes.every(mesh=>!mesh.isPickable));
      world.sync({...state,blockedEdges:[state.map.edges[0]]});
      assert.deepEqual(world.getState().streetInfo.roadworkModelIds,['street-fence','street-cone']);
      world.sync(state);
      assert.deepEqual(world.getState().streetInfo.roadworkModelIds,[]);
      assert.equal(scene.meshes.filter(m=>m.name.startsWith('street-')).length,meshes.length,'event cleanup releases every temporary street model');
    }
    for(const id of ['street-lamp','street-bench','street-flower','town-trash','town-road-sign'])assert.ok(seenDecorations.has(id),'representative maps collectively exercise retained decoration models');
  } finally {world.dispose();scene.dispose();engine.dispose();}
});
