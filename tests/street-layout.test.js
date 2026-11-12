import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planStreets, STREET_WIDTH} from '../src/v2/street-layout.js';
import {generateMap} from '../src/v2/rules.js';
import {buildRoadPath, sampleRoadPath} from '../src/v2/motion.js';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {createWorld} from '../src/v2/world.js';
import {createGame} from '../src/v2/rules.js';

const directions = [[1,0],[0,1],[-1,0],[0,-1]];
const originalOpenings = {
  'street-road-end': [0], 'street-road-straight': [0,2],
  'street-road-corner': [2,3], 'street-road-t': [0,2,3], 'street-road-cross': [0,1,2,3],
};

function originalGeometry(id) {
  const file=readFileSync(new URL(`../public/models/kenney-streets/${id}.glb`,import.meta.url));
  const jsonLength=file.readUInt32LE(12),doc=JSON.parse(file.subarray(20,20+jsonLength).toString());
  const binary=file.subarray(28+jsonLength);
  const values=index=>{
    const accessor=doc.accessors[index],view=doc.bufferViews[accessor.bufferView];
    const count=accessor.type==='VEC3'?3:1;
    const [bytes,method]={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']}[accessor.componentType];
    return Array.from({length:accessor.count},(_,i)=>Array.from({length:count},(_,j)=>binary[method]((view.byteOffset||0)+(accessor.byteOffset||0)+i*(view.byteStride||bytes*count)+j*bytes)));
  };
  const primitive=doc.meshes[0].primitives[0],positions=values(primitive.attributes.POSITION),indices=values(primitive.indices).flat();
  return Array.from({length:indices.length/3},(_,i)=>indices.slice(i*3,i*3+3).map(index=>positions[index]));
}

test('canonical openings agree with the actual imported GLB raised-curb triangles',()=>{
  const inside=(p,triangle)=>{
    const signs=triangle.map((a,i)=>{const b=triangle[(i+1)%3];return (p[0]-b[0])*(a[1]-b[1])-(a[0]-b[0])*(p[1]-b[1]);});
    return !(Math.min(...signs)<-1e-9&&Math.max(...signs)>1e-9);
  };
  for(const [id,expected]of Object.entries(originalOpenings)){
    const curbTops=originalGeometry(id).filter(t=>t.every(([,y])=>y>.019)).map(t=>t.map(([x,,z])=>[x,-z]));
    const openings=directions.flatMap(([x,z],i)=>curbTops.some(t=>inside([x*.499,z*.499],t))?[]:[i]);
    assert.deepEqual(openings,expected,`${id}: measured geometry must match the orientation template`);
  }
});

test('all 15 connected-node combinations have exactly their actual road openings',()=>{
  for(let bits=1;bits<16;bits++){
    const nodes=[{id:'c',x:0,z:0},...directions.map(([x,z],i)=>({id:`d${i}`,x:x*8,z:z*8}))];
    const edges=directions.flatMap((_,i)=>bits&(1<<i)?[['c',`d${i}`]]:[]);
    const plan=planStreets({nodes,edges}),center=plan.find(p=>p.nodeId==='c');
    const quarter=Math.round(-center.rotation/(Math.PI/2));
    const openings=originalOpenings[center.id].map(d=>(d+quarter)%4).sort();
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

test('original City road model asphalt and maximum curved vehicle footprint retain clearance',()=>{
  // Assert measured original mesh geometry instead of assuming the whole tile
  // is drivable. Kenney curbs begin at ±.4 on a one-unit tile.
  const file=readFileSync(new URL('../public/models/kenney-streets/street-road-straight.glb',import.meta.url));
  const doc=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)).toString());
  const accessor=doc.accessors[doc.meshes[0].primitives[0].attributes.POSITION];
  assert.deepEqual(accessor.min,[-.5,0,-.5]);
  const laneHalf=STREET_WIDTH*.4;
  for(const gap of [8,9])for(const turn of [-1,1]){
    const path=buildRoadPath([{x:0,z:0},{x:0,z:gap},{x:gap*turn,z:gap}]);
    const arc=path.segments.find(s=>s.kind==='arc');
    for(let distance=arc.start;distance<=arc.start+arc.length;distance+=.025){
      const p=sampleRoadPath(path,distance);
      for(const [halfWidth,halfLength]of [[.9,2.05],[1.05,1.7]])for(let side=-halfWidth;side<=halfWidth;side+=.1)for(let fore=-halfLength;fore<=halfLength;fore+=.1){
        const x=p.x+Math.sin(p.yaw)*fore+Math.cos(p.yaw)*side;
        const z=p.z+Math.cos(p.yaw)*fore-Math.sin(p.yaw)*side;
        assert.ok(Math.min(Math.abs(x),Math.abs(z-gap))<laneHalf,'body and wheels clear the raised inner curb');
      }
    }
  }
});

test('three acceptance seeds instantiate every street decoration and clean event models',()=>{
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
  try {
    for(const seed of [2,7,14]){
      const state=createGame({seed}).getState();world.sync(state);
      const info=world.getState().streetInfo;
      assert.deepEqual(info.decorationIds,['street-lamp','street-bench','street-flower']);
      assert.ok(info.decorationCount>=3&&info.decorationCount<=6);
      const meshes=scene.meshes.filter(m=>m.name.startsWith('street-'));
      assert.ok(meshes.length>info.tileCount);
      assert.ok(meshes.every(mesh=>!mesh.isPickable));
      world.sync({...state,blockedEdges:[state.map.edges[0]]});
      assert.deepEqual(world.getState().streetInfo.roadworkModelIds,['street-fence','street-cone']);
      world.sync(state);
      assert.deepEqual(world.getState().streetInfo.roadworkModelIds,[]);
      assert.equal(scene.meshes.filter(m=>m.name.startsWith('street-')).length,meshes.length,'event cleanup releases every temporary street model');
    }
  } finally {world.dispose();scene.dispose();engine.dispose();}
});
