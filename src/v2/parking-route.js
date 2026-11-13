// Logical destinations remain graph nodes. Only the physical driving path and
// stopped vehicle pose move back onto a straight approach, before any junction.
export const PARKING_SETBACK = 3;
const EPSILON=1e-6;
const point=p=>({x:p.x,z:p.z});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function onSegment(p,a,b){
  const length=distance(a,b);
  return length>EPSILON&&Math.abs(distance(a,p)+distance(p,b)-length)<EPSILON;
}
function toward(a,b,offset){
  const length=distance(a,b);
  if(length<=offset+EPSILON)throw new Error('Parking approach is too short for the physical setback');
  return {x:a.x+(b.x-a.x)*offset/length,z:a.z+(b.z-a.z)*offset/length};
}
function nodeAt(map,p){return map.nodes.find(n=>distance(n,p)<EPSILON);}

/** Initial spawn on the landmark's real frontage edge, facing its logical node. */
export function initialParkingPose(map,placeId='depot',{setback=PARKING_SETBACK}={}){
  const place=map.places.find(p=>p.id===placeId),node=map.nodes.find(n=>n.id===place?.nodeId);
  if(!node)throw new Error(`Missing parking destination: ${placeId}`);
  const edge=place.lot?.accessEdge||map.edges.find(e=>e.includes(node.id));
  if(!edge?.includes(node.id))throw new Error(`Parking frontage does not meet ${placeId}`);
  const other=map.nodes.find(n=>n.id===edge.find(id=>id!==node.id));
  if(!other)throw new Error(`Parking frontage lacks a road endpoint: ${placeId}`);
  const position=toward(node,other,setback),yaw=Math.atan2(node.x-position.x,node.z-position.z);
  return {...position,yaw,heading:yaw,nodeId:node.id,edge:[...edge]};
}

/** Adapt an unchanged rules node route to the actual current and stopped poses.
 * If already on the first outgoing edge, omit the logical start node instead
 * of driving back toward its curb and immediately reversing along that edge.
 * Same-edge trips connect the two physical poses directly.
 */
export function planParkingRoute(map,nodeRoute,{position},{setback=PARKING_SETBACK}={}){
  if(!Array.isArray(nodeRoute)||nodeRoute.length<2)throw new Error('Parking route needs two logical road nodes');
  const logical=nodeRoute.map(point),last=logical.at(-1),before=logical.at(-2);
  const stop=toward(last,before,setback),endNode=nodeAt(map,last),beforeNode=nodeAt(map,before);
  if(!endNode||!beforeNode)throw new Error('Parking route endpoint is not a logical road node');
  const removedStartNode=distance(position,logical[0])>EPSILON&&onSegment(position,logical[0],logical[1]);
  const remaining=logical.slice(removedStartNode?1:0);
  remaining[remaining.length-1]=stop;
  const points=[point(position)];
  for(const p of remaining)if(distance(points.at(-1),p)>EPSILON)points.push(p);
  return {points,stop:{...stop,nodeId:endNode.id,edge:[beforeNode.id,endNode.id]},removedStartNode,headingOffset:0};
}
