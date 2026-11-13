import test from 'node:test';
import assert from 'node:assert/strict';
import {generateMap,findRoute} from '../src/v2/rules.js';
import {initialParkingPose,planParkingRoute,PARKING_SETBACK} from '../src/v2/parking-route.js';
import {buildRoadPath,sampleRoadPath} from '../src/v2/motion.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function roadContainsSegment(map,a,b){
  if(a.x!==b.x&&a.z!==b.z)return false;
  return map.edges.some(([aId,bId])=>{
    const p=map.nodes.find(n=>n.id===aId),q=map.nodes.find(n=>n.id===bId);
    const on=r=>Math.abs(distance(p,r)+distance(r,q)-distance(p,q))<1e-6;
    return on(a)&&on(b);
  });
}
function trip(map,from,to,position){
  const route=findRoute(map,from,to),plan=planParkingRoute(map,route,{position});
  assert.deepEqual(plan.points[0],{x:position.x,z:position.z},'physical departure never teleports to the logical node');
  const goal=route.at(-1);
  assert.ok(Math.abs(distance(plan.stop,goal)-PARKING_SETBACK)<1e-6);
  assert.ok(roadContainsSegment(map,plan.stop,goal));
  for(let i=1;i<plan.points.length;i++)assert.ok(roadContainsSegment(map,plan.points[i-1],plan.points[i]),'adapted paths stay on real orthogonal road edges');
  const path=buildRoadPath(plan.points);
  for(const segment of path.segments.filter(s=>s.kind==='arc'))assert.ok(Math.abs(segment.radius-2.5)<1e-6,'parking must not shrink a real-junction turning radius');
  const arrived=sampleRoadPath(path,path.length);
  assert.ok(distance(arrived,plan.stop)<1e-6);
  return plan.stop;
}

test('64 maps start on frontage roads and retain safe physical endpoints for every place pair',()=>{
  for(let seed=0;seed<64;seed++){
    const map=generateMap(seed);
    for(const from of map.places){
      const pose=initialParkingPose(map,from.id),node=map.nodes.find(n=>n.id===from.nodeId);
      assert.ok(Math.abs(distance(pose,node)-PARKING_SETBACK)<1e-6);
      assert.ok(roadContainsSegment(map,pose,node));
      assert.ok(Math.cos(pose.yaw)*(node.z-pose.z)+Math.sin(pose.yaw)*(node.x-pose.x)>0,'initial vehicle faces its logical node');
      for(const to of map.places)if(to.id!==from.id)trip(map,from.id,to.id,pose);
    }
  }
});

test('every incoming/outgoing pair on seeds 19/0/1 supports consecutive tasks and depot returns',()=>{
  for(const seed of [19,0,1]){
    const map=generateMap(seed);
    for(const a of map.places)for(const b of map.places){
      if(a.id===b.id)continue;
      const stop=trip(map,a.id,b.id,initialParkingPose(map,a.id));
      for(const c of map.places)if(c.id!==b.id)trip(map,b.id,c.id,stop);
    }
  }
});

test('a short same-edge trip omits the logical start instead of making a curbward detour',()=>{
  const map={nodes:[{id:'a',x:0,z:0},{id:'b',x:10.5,z:0}],edges:[['a','b']]};
  const plan=planParkingRoute(map,map.nodes,{position:{x:3,z:0}});
  assert.equal(plan.removedStartNode,true);
  assert.deepEqual(plan.points,[{x:3,z:0},{x:7.5,z:0}]);
  assert.equal(buildRoadPath(plan.points).length,4.5);
  const back=planParkingRoute(map,[...map.nodes].reverse(),{position:plan.stop});
  assert.deepEqual(back.points,[{x:7.5,z:0},{x:3,z:0}]);
});
