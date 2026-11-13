// World units are metres. Models face -Z; the fixed camera is at (+X,-Z).
// Lots reserve the entire garden/building footprint, not only a model origin.
export const TOWN_ROAD_WIDTH = 3;
export const TOWN_ROAD_TILE_WIDTH = 3.75;
const LOT_SIZE = 6;
const nodeId = (column, row) => `n${row * 4 + column}`;
const edgeKey = edge => [...edge].sort().join(':');
const shuffle = (values, random) => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// Each plan authors the relationship between the commercial pair, civic
// buildings and green space. Reflections change the plan, never facade yaw.
export const TOWN_TEMPLATES = [
  { id: 'village-square', loop: [[1,1],[2,1],[2,2],[1,2]],
    cells: {shop:[1,1],cafe:[2,1],park:[1,0],school:[0,0],hospital:[0,1]} },
  { id: 'garden-walk', loop: [[0,1],[1,1],[2,1],[2,2],[1,2],[0,2]],
    cells: {shop:[0,1],cafe:[1,1],park:[1,0],school:[0,0],hospital:[2,0]} },
  { id: 'market-lane', loop: [[1,0],[2,0],[2,1],[2,2],[1,2],[1,1]],
    cells: {shop:[1,0],cafe:[2,0],park:[1,1],school:[0,0],hospital:[0,1]} },
];

function allEdges() {
  const result = [];
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
    if (column < 3) result.push([nodeId(column,row),nodeId(column+1,row)]);
    if (row < 3) result.push([nodeId(column,row),nodeId(column,row+1)]);
  }
  return result;
}

function connected(nodes, edges, omitted) {
  const neighbors = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) {
    if (omitted === edgeKey(edge)) continue;
    neighbors.get(edge[0])?.push(edge[1]); neighbors.get(edge[1])?.push(edge[0]);
  }
  const reached = new Set([nodes[0]?.id]), queue = [...reached];
  for (let i = 0; i < queue.length; i++) for (const next of neighbors.get(queue[i]) || []) {
    if (!reached.has(next)) { reached.add(next); queue.push(next); }
  }
  return reached.size === nodes.length;
}

function validRoads(nodes, edges, branchNodeId) {
  if (!connected(nodes, edges)) return false;
  const degree = new Map(nodes.map(node => [node.id,0]));
  for (const edge of edges) for (const id of edge) degree.set(id, degree.get(id)+1);
  if (nodes.some(node => degree.get(node.id) < (node.id === branchNodeId ? 1 : 2))) return false;
  if (degree.get(branchNodeId) !== 1) return false;
  // The only bridge is a one-segment outer spur. Every other road has a detour.
  return edges.every(edge => edge.includes(branchNodeId) || connected(nodes, edges, edgeKey(edge)));
}

function makeLot(x, z, frontageX, frontageZ, accessEdge) {
  const entranceX = x, entranceZ = z - LOT_SIZE/2;
  const walkway = [{x:entranceX,z:entranceZ}];
  // Side-facing access uses an L along the front and side verge, never a
  // diagonal line through the building or across the driving surface.
  if(frontageZ>z+LOT_SIZE/2){
    const sideX=x+LOT_SIZE/2+.25;
    walkway.push({x:sideX,z:entranceZ},{x:sideX,z:frontageZ},{x:frontageX,z:frontageZ});
  }else{
    if (frontageX !== entranceX) walkway.push({x:frontageX,z:entranceZ});
    if (frontageZ !== entranceZ) walkway.push({x:frontageX,z:frontageZ});
  }
  return {x,z,width:LOT_SIZE,depth:LOT_SIZE,rotation:0,entranceX,entranceZ,
    frontageX,frontageZ,accessEdge:[...accessEdge],walkway};
}

function assignAccessNodes(plots, random) {
  // Matching avoids two landmarks sharing a vehicle stop, including where
  // outer and inner districts meet. No mission or event random stream is used.
  const candidates = plots.map(plot => shuffle(plot.lot.accessEdge,random));
  const order = plots.map((_,i)=>i), used = new Set(), result = [];
  const visit = index => {
    if (index === order.length) return true;
    const current = order[index];
    for (const id of candidates[current]) {
      if (used.has(id)) continue;
      used.add(id); result[current]=id;
      if (visit(index+1)) return true;
      used.delete(id);
    }
    return false;
  };
  return visit(0) ? result : null;
}

function candidate({seed,random,places,themes}, fallback = false) {
  const template = fallback ? TOWN_TEMPLATES[1] : TOWN_TEMPLATES[Math.floor(random()*TOWN_TEMPLATES.length)];
  const reflectX = !fallback && random() < .5, reflectZ = !fallback && random() < .5;
  const transformNode = ([column,row]) => nodeId(reflectX?3-column:column,reflectZ?3-row:row);
  const transformCell = ([column,row]) => [reflectX?2-column:column,reflectZ?2-row:row];
  const spacingX = fallback ? 11 : 10.5+Math.floor(random()*2)*.5;
  const spacingZ = fallback ? 11 : 10.5+Math.floor(random()*2)*.5;
  const nodes = Array.from({length:16},(_,i)=>({id:`n${i}`,x:(i%4-1.5)*spacingX,z:(Math.floor(i/4)-1.5)*spacingZ}));
  const byId = new Map(nodes.map(node=>[node.id,node]));
  const gridEdges = allEdges(), mandatory = new Set();
  const mainLoop = template.loop.map(transformNode);
  mainLoop.forEach((id,i)=>mandatory.add(edgeKey([id,mainLoop[(i+1)%mainLoop.length]])));
  const cells = Object.fromEntries(Object.entries(template.cells).map(([id,cell])=>[id,transformCell(cell)]));
  if(!fallback && random()<.5)[cells.shop,cells.cafe]=[cells.cafe,cells.shop];
  if(!fallback && random()<.5)[cells.school,cells.hospital]=[cells.hospital,cells.school];
  const plots = [];
  const innerLot = (column,row) => {
    const a = byId.get(nodeId(column,row)), b = byId.get(nodeId(column+1,row));
    const x=(a.x+b.x)/2,z=a.z+spacingZ/2;
    return makeLot(x,z,x,a.z+TOWN_ROAD_TILE_WIDTH/2+.08,[a.id,b.id]);
  };
  for (const [id,[column,row]] of Object.entries(cells)) {
    const lot = innerLot(column,row);
    mandatory.add(edgeKey(lot.accessEdge));
    plots.push({id,district:['shop','cafe'].includes(id)?'commercial':'civic',lot});
  }
  // Farm and camp occupy opposite green fringes; logistics sit on the rear
  // edge. Four inner blocks remain available for residential gardens.
  const outerRow = fallback ? 1 : Math.floor(random()*3);
  const fringeIds = fallback || random()<.5 ? ['farm','camp'] : ['camp','farm'];
  for (const [index,id] of fringeIds.entries()) {
    const column=index?3:0,side=index?1:-1;
    const a=byId.get(nodeId(column,outerRow)),b=byId.get(nodeId(column,outerRow+1));
    const x=a.x+side*spacingX/2,z=(a.z+b.z)/2;
    const lot=makeLot(x,z,a.x+side*(TOWN_ROAD_TILE_WIDTH/2+.08),z,[a.id,b.id]);
    mandatory.add(edgeKey(lot.accessEdge));plots.push({id,district:'green-fringe',lot});
  }
  const rearColumns = fallback ? [0,2] : shuffle([0,1,2],random).slice(0,2);
  for (const [index,id] of ['depot','garage'].entries()) {
    const column=rearColumns[index],a=byId.get(nodeId(column,3)),b=byId.get(nodeId(column+1,3));
    const x=(a.x+b.x)/2,z=a.z+spacingZ/2;
    const lot=makeLot(x,z,x,a.z+TOWN_ROAD_TILE_WIDTH/2+.08,[a.id,b.id]);
    mandatory.add(edgeKey(lot.accessEdge));plots.push({id,district:'logistics',lot});
  }
  let branchNodeId, edges;
  if (fallback) {
    branchNodeId='n0';
    const omitted=new Set([['n0','n4'],['n2','n6'],['n6','n7'],['n9','n13']].map(edgeKey));
    edges=gridEdges.filter(edge=>!omitted.has(edgeKey(edge)));
  } else {
    const branchChoices=[];
    for (const id of ['n0','n3','n12','n15']) for (const omitted of gridEdges.filter(edge=>edge.includes(id))) {
      if (!mandatory.has(edgeKey(omitted))) branchChoices.push({id,omitted});
    }
    if (!branchChoices.length) return null;
    const branch=branchChoices[Math.floor(random()*branchChoices.length)];branchNodeId=branch.id;
    const allowed=gridEdges.filter(edge=>edgeKey(edge)!==edgeKey(branch.omitted));
    const target=18+Math.floor(random()*3);
    const required=allowed.filter(edge=>mandatory.has(edgeKey(edge)) || edge.includes(branchNodeId));
    const optional=shuffle(allowed.filter(edge=>!required.includes(edge)),random);
    if(required.length>target)return null;
    const selected=new Set([...required,...optional.slice(0,target-required.length)].map(edgeKey));
    edges=gridEdges.filter(edge=>selected.has(edgeKey(edge)));
  }
  if (!validRoads(nodes,edges,branchNodeId)) return null;
  const accesses=assignAccessNodes(plots,random);
  if(!accesses)return null;
  const placed=new Map(plots.map((plot,i)=>[plot.id,{...plot,nodeId:accesses[i]}]));
  const landmarks=places.map(place=>{
    const plot=placed.get(place.id),node=byId.get(plot.nodeId);
    return {...place,nodeId:node.id,x:node.x,z:node.z,district:plot.district,lot:plot.lot};
  });
  const occupied=new Set(Object.values(cells).map(([column,row])=>`${column}:${row}`));
  const residentialLots=[];
  for(let row=0;row<3;row++)for(let column=0;column<3;column++){
    if(occupied.has(`${column}:${row}`))continue;
    const x=(column-1)*spacingX,z=(row-1)*spacingZ;
    const options=[
      {edge:[nodeId(column,row),nodeId(column+1,row)],x,z:z-spacingZ/2+TOWN_ROAD_TILE_WIDTH/2+.08},
      {edge:[nodeId(column,row),nodeId(column,row+1)],x:x-spacingX/2+TOWN_ROAD_TILE_WIDTH/2+.08,z},
      {edge:[nodeId(column+1,row),nodeId(column+1,row+1)],x:x+spacingX/2-TOWN_ROAD_TILE_WIDTH/2-.08,z},
      {edge:[nodeId(column,row+1),nodeId(column+1,row+1)],x,z:z+spacingZ/2-TOWN_ROAD_TILE_WIDTH/2-.08},
    ];
    const access=options.find(option=>edges.some(edge=>edgeKey(edge)===edgeKey(option.edge)));
    if(!access)return null;
    const lot=makeLot(x,z,access.x,access.z,access.edge);
    residentialLots.push({...lot,id:`home-${column}-${row}`,district:'residential'});
  }
  // Reserve a separate neighbourhood parking garden. Prefer the third rear
  // plot; if its frontage is absent, use an empty side-fringe row instead.
  // Parked models must stay within this lot and never replace residential lots.
  const parkingCandidates=[];
  const rearColumn=[0,1,2].find(column=>!rearColumns.includes(column));
  const rearA=byId.get(nodeId(rearColumn,3)),rearB=byId.get(nodeId(rearColumn+1,3));
  parkingCandidates.push(makeLot((rearA.x+rearB.x)/2,rearA.z+spacingZ/2,
    (rearA.x+rearB.x)/2,rearA.z+TOWN_ROAD_TILE_WIDTH/2+.08,[rearA.id,rearB.id]));
  for(const row of [0,1,2])for(const column of [0,3]){
    if(row===outerRow)continue;
    const side=column===0?-1:1,a=byId.get(nodeId(column,row)),b=byId.get(nodeId(column,row+1));
    parkingCandidates.push(makeLot(a.x+side*spacingX/2,(a.z+b.z)/2,
      a.x+side*(TOWN_ROAD_TILE_WIDTH/2+.08),(a.z+b.z)/2,[a.id,b.id]));
  }
  const parking=parkingCandidates.find(lot=>edges.some(edge=>edgeKey(edge)===edgeKey(lot.accessEdge)) &&
    [...landmarks.map(place=>place.lot),...residentialLots].every(other=>!overlap(lot,other,.2)));
  const parkingLot=parking?{...parking,id:'neighbourhood-parking',district:'parking'}:null;
  const bounds={minX:-2*spacingX-LOT_SIZE/2-1,maxX:2*spacingX+LOT_SIZE/2+1,
    minZ:-1.5*spacingZ-TOWN_ROAD_TILE_WIDTH/2-1,maxZ:2*spacingZ+LOT_SIZE/2+1};
  return {seed,theme:themes[Math.floor(random()*themes.length)].id,nodes,edges,places:landmarks,depot:'depot',
    layout:{templateId:template.id,reflectX,reflectZ,spacingX,spacingZ,roadWidth:TOWN_ROAD_WIDTH,
      roadTileWidth:TOWN_ROAD_TILE_WIDTH,bounds,mainLoop,branchNodeId,residentialLots,parkingLot,fallback,fallbackUsed:fallback}};
}

function overlap(a,b,margin=0) {
  return Math.abs(a.x-b.x)<(a.width+b.width)/2+margin && Math.abs(a.z-b.z)<(a.depth+b.depth)/2+margin;
}

/** Inspectable hard constraints, also used before returning any generated map. */
export function validateTownLayout(map) {
  const errors=[],layout=map.layout;
  if(!layout)return ['Missing designed layout'];
  const {bounds,branchNodeId}=layout,nodes=new Map(map.nodes.map(node=>[node.id,node]));
  if(map.nodes.length!==16 || nodes.size!==16)errors.push('Expected 16 unique junctions');
  if(![10.5,11].includes(layout.spacingX) || ![10.5,11].includes(layout.spacingZ))errors.push('Invalid block spacing');
  if(layout.roadWidth!==TOWN_ROAD_WIDTH || layout.roadTileWidth!==TOWN_ROAD_TILE_WIDTH)errors.push('Road dimensions changed');
  if(map.nodes.some(node=>node.x<bounds.minX || node.x>bounds.maxX || node.z<bounds.minZ || node.z>bounds.maxZ))errors.push('Junction exceeds town bounds');
  if(map.edges.length<18 || map.edges.length>20)errors.push('Expected 18–20 roads');
  const keys=new Set(map.edges.map(edgeKey));
  if(keys.size!==map.edges.length)errors.push('Duplicate road');
  for(const edge of map.edges){
    const a=nodes.get(edge[0]),b=nodes.get(edge[1]);
    if(!a||!b || !((a.x===b.x&&Math.abs(a.z-b.z)===layout.spacingZ)||(a.z===b.z&&Math.abs(a.x-b.x)===layout.spacingX)))errors.push('Road must join adjacent orthogonal junctions');
  }
  if(!validRoads(map.nodes,map.edges,branchNodeId))errors.push('Road graph lacks a connected resilient ring and one short spur');
  if(!['n0','n3','n12','n15'].includes(branchNodeId))errors.push('Spur must end on an outer corner');
  if(layout.mainLoop.length<4 || new Set(layout.mainLoop).size!==layout.mainLoop.length || layout.mainLoop.some((id,i)=>!keys.has(edgeKey([id,layout.mainLoop[(i+1)%layout.mainLoop.length]]))))errors.push('Authored main loop is incomplete');
  if(map.places.length!==9 || new Set(map.places.map(place=>place.id)).size!==9 || new Set(map.places.map(place=>place.nodeId)).size!==9)errors.push('Expected nine unique landmark stops');
  const lots=[...map.places.map(place=>place.lot),...layout.residentialLots,...(layout.parkingLot?[layout.parkingLot]:[])];
  if(layout.residentialLots.length<4)errors.push('Residential reserve is missing');
  for(const [index,lot]of lots.entries()){
    if(!lot || ![lot.x,lot.z,lot.width,lot.depth,lot.entranceX,lot.entranceZ].every(Number.isFinite)){errors.push('Invalid lot');continue;}
    if(lot.rotation!==0 || lot.width<=0 || lot.depth<=0)errors.push('Lot must face -Z with positive size');
    if(lot.entranceX!==lot.x || lot.entranceZ!==lot.z-lot.depth/2)errors.push('Entrance must lie on the -Z facade');
    if(!Array.isArray(lot.accessEdge) || !keys.has(edgeKey(lot.accessEdge)))errors.push('Lot lacks a real frontage road');
    else{
      const a=nodes.get(lot.accessEdge[0]),b=nodes.get(lot.accessEdge[1]),offset=TOWN_ROAD_TILE_WIDTH/2+.08;
      if(a.z===b.z ? (lot.frontageX<Math.min(a.x,b.x) || lot.frontageX>Math.max(a.x,b.x) || Math.abs(Math.abs(lot.frontageZ-a.z)-offset)>1e-8) :
        (lot.frontageZ<Math.min(a.z,b.z) || lot.frontageZ>Math.max(a.z,b.z) || Math.abs(Math.abs(lot.frontageX-a.x)-offset)>1e-8))errors.push('Frontage must meet the road verge');
    }
    if(!lot.walkway?.length || lot.walkway[0].x!==lot.entranceX || lot.walkway[0].z!==lot.entranceZ || lot.walkway.at(-1).x!==lot.frontageX || lot.walkway.at(-1).z!==lot.frontageZ)errors.push('Walkway must join entrance to frontage');
    if(lot.walkway?.some((point,i)=>i && point.x!==lot.walkway[i-1].x && point.z!==lot.walkway[i-1].z))errors.push('Walkway must be orthogonal');
    if(lot.x-lot.width/2<bounds.minX || lot.x+lot.width/2>bounds.maxX || lot.z-lot.depth/2<bounds.minZ || lot.z+lot.depth/2>bounds.maxZ)errors.push('Lot exceeds town bounds');
    if(lots.slice(index+1).some(other=>other&&overlap(lot,other,.2)))errors.push('Lots overlap or lack separation');
    for(const node of map.nodes){
      if(overlap(lot,{...node,width:TOWN_ROAD_TILE_WIDTH,depth:TOWN_ROAD_TILE_WIDTH},.2))errors.push('Lot occupies a junction');
    }
    for(const edge of map.edges){
      const a=nodes.get(edge[0]),b=nodes.get(edge[1]);if(!a||!b)continue;
      const road={x:(a.x+b.x)/2,z:(a.z+b.z)/2,width:Math.abs(a.x-b.x)||TOWN_ROAD_TILE_WIDTH,depth:Math.abs(a.z-b.z)||TOWN_ROAD_TILE_WIDTH};
      if(overlap(lot,road,.2))errors.push('Lot occupies a road');
    }
  }
  for(const place of map.places){
    const node=nodes.get(place.nodeId);
    if(!node || place.x!==node.x || place.z!==node.z)errors.push('Landmark stop must retain road-node coordinates');
    if(!place.lot || !keys.has(edgeKey(place.lot.accessEdge)))errors.push('Landmark lacks a real frontage road');
  }
  return [...new Set(errors)];
}

export function createTownLayout(options) {
  for(let attempt=0;attempt<512;attempt++){
    const map=candidate(options);
    if(map && !validateTownLayout(map).length){map.layout.attempts=attempt+1;return map;}
  }
  // Authored emergency layout is independent of the failed random candidates.
  const map=candidate({...options,random:()=>.5},true);
  if(!map || validateTownLayout(map).length)throw new Error('Authored town fallback violates its layout constraints');
  map.layout.attempts=512;
  return map;
}
