// Logical destinations remain graph nodes; physical stops belong to the real
// walkway frontage. Keep this export for older consumers, not as a stop offset.
export const PARKING_SETBACK = 3;
const EPSILON=1e-6;
const point=p=>({x:p.x,z:p.z});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const edgeKey=edge=>Array.isArray(edge)?[...edge].sort().join(':'):edge;
function onSegment(p,a,b){
  return distance(a,b)>EPSILON&&Math.abs(distance(a,p)+distance(p,b)-distance(a,b))<EPSILON;
}
function project(p,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,lengthSquared=dx*dx+dz*dz;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/lengthSquared));
  return {x:a.x+dx*t,z:a.z+dz*t};
}
function frontagePose(map,place){
  const nodes=new Map(map.nodes.map(node=>[node.id,node])),edge=place?.lot?.accessEdge;
  const a=nodes.get(edge?.[0]),b=nodes.get(edge?.[1]);
  if(!a||!b||!map.edges.some(road=>edgeKey(road)===edgeKey(edge)))throw new Error(`Missing parking frontage: ${place?.id}`);
  const frontage=place.lot.walkway?.at(-1)||{x:place.lot.frontageX,z:place.lot.frontageZ};
  if(!Number.isFinite(frontage.x)||!Number.isFinite(frontage.z))throw new Error(`Invalid parking frontage: ${place.id}`);
  const position=project(frontage,a,b),node=nodes.get(place.nodeId);
  if(!node||!edge.includes(node.id))throw new Error(`Parking frontage does not meet ${place.id}`);
  const yaw=Math.atan2(node.x-position.x,node.z-position.z);
  return {...position,yaw,heading:yaw,nodeId:node.id,placeId:place.id,edge:[...edge]};
}

/** The vehicle waits on the road centre opposite the walkway, never on it. */
export function initialParkingPose(map,placeId='depot'){
  const place=map.places?.find(p=>p.id===placeId);
  if(!place)throw new Error(`Missing parking destination: ${placeId}`);
  return frontagePose(map,place);
}

// Split the actual start/goal edges so a vehicle parked halfway along a road
// may leave in either direction. Positive road lengths keep shortest paths
// simple, avoiding a turn back at an artificial frontage vertex.
function physicalRoute(map,start,stop,blockedEdges){
  const blocked=new Set(blockedEdges.map(edgeKey));
  const nodes=new Map(map.nodes.map(node=>[node.id,point(node)]));
  const startId='parking:start',goalId='parking:goal';
  nodes.set(startId,point(start));nodes.set(goalId,point(stop));
  const neighbors=new Map([...nodes.keys()].map(id=>[id,[]]));
  let startAttached=false,goalAttached=false;
  for(const edge of map.edges){
    if(blocked.has(edgeKey(edge)))continue;
    const a=nodes.get(edge[0]),b=nodes.get(edge[1]);
    const stops=[{id:edge[0],p:a},{id:edge[1],p:b}];
    if(onSegment(start,a,b)){stops.push({id:startId,p:start});startAttached=true;}
    if(edgeKey(edge)===edgeKey(stop.edge)){stops.push({id:goalId,p:stop});goalAttached=true;}
    stops.sort((p,q)=>distance(a,p.p)-distance(a,q.p));
    for(let i=1;i<stops.length;i++){
      const previous=stops[i-1],next=stops[i],length=distance(previous.p,next.p);
      neighbors.get(previous.id).push({id:next.id,length});neighbors.get(next.id).push({id:previous.id,length});
    }
  }
  if(!startAttached||!goalAttached)throw new Error('Parking route has no open road at its physical endpoint');
  const costs=new Map([[startId,0]]),previous=new Map(),pending=new Set(nodes.keys());
  while(pending.size){
    let current=null,best=Infinity;
    for(const id of pending)if((costs.get(id)??Infinity)<best){current=id;best=costs.get(id);}
    if(current===null||current===goalId)break;
    pending.delete(current);
    for(const next of neighbors.get(current)){
      const cost=best+next.length;
      if(cost<(costs.get(next.id)??Infinity)){
        costs.set(next.id,cost);previous.set(next.id,current);
      }
    }
  }
  if(!costs.has(goalId))throw new Error('Parking destination is unreachable on open roads');
  const ids=[];
  for(let id=goalId;id!==undefined;id=previous.get(id))ids.push(id);
  const points=[];
  for(const id of ids.reverse()){
    const p=nodes.get(id);
    if(!points.length||distance(points.at(-1),p)>EPSILON)points.push(point(p));
  }
  return points;
}

/** Adapt a rules route to physical frontage stops. A placeId is preferred;
 * unique logical endpoint inference preserves existing callers. blockedEdges
 * must be the same closures that were used to request the logical route.
 */
export function planParkingRoute(map,nodeRoute,{position},{placeId,blockedEdges=[]}={}){
  if(!Array.isArray(nodeRoute)||!nodeRoute.length)throw new Error('Parking route needs a logical destination');
  const goal=nodeRoute.at(-1);
  const place=placeId?map.places?.find(p=>p.id===placeId):map.places?.find(p=>{
    const node=map.nodes.find(n=>n.id===p.nodeId);return node&&distance(node,goal)<EPSILON;
  });
  if(!place)throw new Error(`Missing parking destination: ${placeId??'route endpoint'}`);
  const stop=frontagePose(map,place),points=physicalRoute(map,position,stop,blockedEdges);
  const last=points.at(-2);
  if(last)stop.yaw=stop.heading=Math.atan2(stop.x-last.x,stop.z-last.z);
  const removedStartNode=distance(position,nodeRoute[0])>EPSILON&&!points.slice(1).some(p=>distance(p,nodeRoute[0])<EPSILON);
  return {points,stop,removedStartNode,headingOffset:0};
}
