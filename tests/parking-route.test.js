import test from 'node:test';
import assert from 'node:assert/strict';
import {generateMap,findRoute} from '../src/v2/rules.js';
import {initialParkingPose,planParkingRoute} from '../src/v2/parking-route.js';
import {buildRoadPath,sampleRoadPath,createRoadMotion} from '../src/v2/motion.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const edgeKey=edge=>[...edge].sort().join(':');
const on=(p,a,b)=>Math.abs(distance(a,p)+distance(p,b)-distance(a,b))<1e-6;
function roadsForSegment(map,a,b){
  if(a.x!==b.x&&a.z!==b.z)return [];
  return map.edges.filter(([aId,bId])=>{
    const p=map.nodes.find(n=>n.id===aId),q=map.nodes.find(n=>n.id===bId);
    return on(a,p,q)&&on(b,p,q);
  });
}
function expectedStop(map,place){
  const [a,b]=place.lot.accessEdge.map(id=>map.nodes.find(n=>n.id===id));
  const frontage=place.lot.walkway.at(-1);
  return a.x===b.x?{x:a.x,z:frontage.z}:{x:frontage.x,z:a.z};
}
function trip(map,from,to,position,blockedEdges=[]){
  const route=findRoute(map,from,to,blockedEdges),plan=planParkingRoute(map,route,{position},{placeId:to,blockedEdges});
  assert.deepEqual(plan.points[0],{x:position.x,z:position.z},'physical departure never teleports to the logical node');
  const destination=map.places.find(p=>p.id===to);
  assert.deepEqual({x:plan.stop.x,z:plan.stop.z},expectedStop(map,destination),'stop belongs to this entrance regardless of the approach');
  assert.equal(edgeKey(plan.stop.edge),edgeKey(destination.lot.accessEdge));
  const blocked=new Set(blockedEdges.map(edgeKey));
  for(let i=1;i<plan.points.length;i++){
    const roads=roadsForSegment(map,plan.points[i-1],plan.points[i]);
    assert.ok(roads.length,'adapted paths stay on real orthogonal road edges');
    assert.ok(roads.some(edge=>!blocked.has(edgeKey(edge))),'no partial segment enters a closed road');
  }
  const path=buildRoadPath(plan.points);
  for(const segment of path.segments.filter(s=>s.kind==='arc'))assert.ok(Math.abs(segment.radius-2.5)<1e-6,'parking must not shrink a real-junction turning radius');
  const arrived=sampleRoadPath(path,path.length);
  assert.ok(distance(arrived,plan.stop)<1e-6);
  return plan.stop;
}

test('64 maps use the actual walkway projection for every place and every approach',()=>{
  for(let seed=0;seed<64;seed++){
    const map=generateMap(seed),stops=[];
    for(const from of map.places){
      const pose=initialParkingPose(map,from.id);
      assert.deepEqual({x:pose.x,z:pose.z},expectedStop(map,from));
      assert.ok(distance(pose,{x:from.lot.frontageX,z:from.lot.frontageZ})>1.8,'vehicle stays on the road instead of entering the walkway');
      assert.ok(!stops.some(stop=>distance(stop,pose)<1e-6),'generated landmarks have separate physical entrances');stops.push(pose);
      for(const to of map.places)if(to.id!==from.id){
        trip(map,from.id,to.id,pose);
        const inferred=planParkingRoute(map,findRoute(map,from.id,to.id),{position:pose});
        assert.deepEqual({x:inferred.stop.x,z:inferred.stop.z},expectedStop(map,to),'legacy call infers the unique destination');
      }
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

function lineMap(){
  return {nodes:[{id:'a',x:0,z:0},{id:'b',x:12,z:0}],edges:[['a','b']],places:[
    {id:'left',nodeId:'a',lot:{accessEdge:['a','b'],frontageX:4,frontageZ:2,walkway:[{x:4,z:2}]}},
    {id:'right',nodeId:'b',lot:{accessEdge:['a','b'],frontageX:8,frontageZ:2,walkway:[{x:8,z:2}]}},
  ]};
}
test('adjacent entrances sharing a road connect directly in both directions from the physical pose',()=>{
  const map=lineMap();
  const plan=planParkingRoute(map,map.nodes,{position:{x:4,z:0}},{placeId:'right'});
  assert.equal(plan.removedStartNode,true);
  assert.deepEqual(plan.points,[{x:4,z:0},{x:8,z:0}]);
  assert.equal(buildRoadPath(plan.points).length,4);
  const back=planParkingRoute(map,[...map.nodes].reverse(),{position:plan.stop},{placeId:'left'});
  assert.deepEqual(back.points,[{x:8,z:0},{x:4,z:0}]);
});

test('coincident entrances produce completed zero-distance motion without an artificial logical-node detour',()=>{
  const map=lineMap();map.places[1].lot.frontageX=4;map.places[1].lot.walkway[0].x=4;
  const plan=planParkingRoute(map,map.nodes,{position:{x:4,z:0}},{placeId:'right'});
  assert.deepEqual(plan.points,[{x:4,z:0}]);
  assert.equal(createRoadMotion(buildRoadPath(plan.points)).done,true);
});

test('virtual endpoints find an open detour even when a stale logical route uses a closed road',()=>{
  for(const seed of [19,0,1]){
    const map=generateMap(seed),frontages=new Set(map.places.map(p=>edgeKey(p.lot.accessEdge)));
    for(const blocked of map.edges.filter(edge=>!frontages.has(edgeKey(edge)))){
      for(const from of map.places)for(const to of map.places)if(from.id!==to.id){
        const stale=findRoute(map,from.id,to.id),pose=initialParkingPose(map,from.id);
        const plan=planParkingRoute(map,stale,{position:pose},{placeId:to.id,blockedEdges:[blocked]});
        for(let i=1;i<plan.points.length;i++)assert.ok(roadsForSegment(map,plan.points[i-1],plan.points[i]).every(edge=>edgeKey(edge)!==edgeKey(blocked)));
        trip(map,from.id,to.id,pose,[blocked]);
      }
    }
  }
});

test('an explicitly blocked entrance is unreachable instead of crossing the closure to park',()=>{
  const map=generateMap(19),from=map.places[0],to=map.places[1],pose=initialParkingPose(map,from.id);
  const route=findRoute(map,from.id,to.id);
  for(const blocked of [from.lot.accessEdge,to.lot.accessEdge]){
    assert.deepEqual(findRoute(map,from.id,to.id,[blocked]),[]);
    assert.throws(()=>planParkingRoute(map,route,{position:pose},{placeId:to.id,blockedEdges:[blocked]}),/open road|unreachable/);
  }
});
