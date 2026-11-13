import test from 'node:test';
import assert from 'node:assert/strict';
import {generateMap} from '../src/v2/rules.js';
import {PLACES, THEMES} from '../src/v2/catalog.js';
import {createTownLayout,validateTownLayout,TOWN_TEMPLATES} from '../src/v2/town-layout.js';

const key = edge => [...edge].sort().join(':');
const overlaps = (a,b) => Math.abs(a.x-b.x)<(a.width+b.width)/2 && Math.abs(a.z-b.z)<(a.depth+b.depth)/2;
function reachable(map, omitted) {
  const start=map.nodes.find(node=>node.id!==map.layout.branchNodeId).id;
  const visited=new Set([start]),queue=[start];
  for(let i=0;i<queue.length;i++)for(const edge of map.edges){
    if(key(edge)===omitted || !edge.includes(queue[i]))continue;
    const next=edge.find(id=>id!==queue[i]);
    if(!visited.has(next)){visited.add(next);queue.push(next);}
  }
  return visited.size;
}

test('1000 seeds reserve distinct civic, commercial, outer green and residential plots with recoverable roads',()=>{
  const templates=new Set(),themes=new Set(),topologies=new Set(),combinations=new Set();
  let fallbackCount=0,maxAttempts=0,parkingCount=0;
  for(let seed=0;seed<1000;seed++){
    const map=generateMap(seed),{layout}=map,nodes=new Map(map.nodes.map(node=>[node.id,node]));
    assert.deepEqual(validateTownLayout(map),[],`seed ${seed}`);
    assert.deepEqual(map,generateMap(seed),`seed ${seed} stays reproducible`);
    assert.deepEqual(map.places.map(place=>place.id),PLACES.map(place=>place.id));
    const allLots=[...map.places.map(place=>place.lot),...layout.residentialLots,...(layout.parkingLot?[layout.parkingLot]:[])];
    assert.ok(allLots.length===13||allLots.length===14);
    if(layout.parkingLot){assert.equal(layout.parkingLot.district,'parking');parkingCount++;}
    assert.equal(layout.residentialLots.length,4);
    assert.equal(layout.roadWidth,3);assert.equal(layout.roadTileWidth,3.75);
    for(const [index,lot]of allLots.entries()){
      assert.equal(lot.rotation,0);
      assert.equal(lot.width,6);assert.equal(lot.depth,6);
      assert.equal(lot.entranceX,lot.x);assert.equal(lot.entranceZ,lot.z-3);
      assert.ok(lot.x-3>=layout.bounds.minX && lot.x+3<=layout.bounds.maxX && lot.z-3>=layout.bounds.minZ && lot.z+3<=layout.bounds.maxZ);
      assert.ok(allLots.slice(index+1).every(other=>!overlaps(lot,other)),`seed ${seed}: every whole plot is separate`);
      const access=map.edges.find(edge=>key(edge)===key(lot.accessEdge));
      assert.ok(access,'each plot faces a real road edge');
      const a=nodes.get(access[0]),b=nodes.get(access[1]);
      if(a.z===b.z){assert.ok(lot.frontageX>=Math.min(a.x,b.x)&&lot.frontageX<=Math.max(a.x,b.x));assert.ok(Math.abs(Math.abs(lot.frontageZ-a.z)-1.955)<1e-10);}
      else{assert.ok(lot.frontageZ>=Math.min(a.z,b.z)&&lot.frontageZ<=Math.max(a.z,b.z));assert.ok(Math.abs(Math.abs(lot.frontageX-a.x)-1.955)<1e-10);}
      for(const [aId,bId]of map.edges){
        const a=nodes.get(aId),b=nodes.get(bId);
        const road={x:(a.x+b.x)/2,z:(a.z+b.z)/2,width:Math.abs(a.x-b.x)||3.75,depth:Math.abs(a.z-b.z)||3.75};
        assert.ok(!overlaps(lot,road),`seed ${seed}: garden/building footprint clears the complete road tile`);
        for(let i=1;i<lot.walkway.length;i++){
          const p=lot.walkway[i-1],q=lot.walkway[i];
          assert.ok(p.x===q.x||p.z===q.z);
          // A thin path may touch the curb but must never cross live asphalt.
          const lane={...road,width:Math.abs(a.x-b.x)||3,depth:Math.abs(a.z-b.z)||3};
          const path={x:(p.x+q.x)/2,z:(p.z+q.z)/2,width:Math.abs(q.x-p.x)||.001,depth:Math.abs(q.z-p.z)||.001};
          assert.ok(!overlaps(path,lane),'entrance paths stay outside the driving lane');
        }
      }
    }
    const place=id=>map.places.find(place=>place.id===id),shop=place('shop'),cafe=place('cafe');
    assert.equal(shop.district,'commercial');assert.equal(cafe.district,'commercial');
    assert.equal(shop.lot.z,cafe.lot.z,'commercial neighbours share a walking street');
    assert.equal(Math.abs(shop.lot.x-cafe.lot.x),layout.spacingX);
    for(const id of ['school','hospital','park'])assert.equal(place(id).district,'civic');
    for(const id of ['farm','camp']){
      assert.equal(place(id).district,'green-fringe');
      assert.ok(Math.abs(place(id).lot.x)>Math.max(...map.nodes.map(node=>Math.abs(node.x))));
    }
    assert.ok(place('farm').lot.x*place('camp').lot.x<0,'green landmarks occupy opposite edges');
    for(const id of ['depot','garage']){
      assert.equal(place(id).district,'logistics');
      assert.ok(place(id).lot.z>Math.max(...map.nodes.map(node=>node.z)));
    }
    assert.equal(reachable(map),16);
    for(const edge of map.edges){
      assert.equal(reachable(map,key(edge)),edge.includes(layout.branchNodeId)?15:16,'only the deliberate one-segment outer spur can be a bridge');
    }
    templates.add(layout.templateId);themes.add(map.theme);
    topologies.add(JSON.stringify(map.edges.map(key).sort()));
    combinations.add(JSON.stringify(map.places.map(place=>[place.id,place.nodeId,place.lot.x,place.lot.z])));
    fallbackCount+=layout.fallbackUsed;maxAttempts=Math.max(maxAttempts,layout.attempts);
    assert.ok(layout.attempts>=1&&layout.attempts<=512);
  }
  assert.deepEqual([...templates].sort(),TOWN_TEMPLATES.map(template=>template.id).sort());
  assert.equal(themes.size,3);
  assert.ok(topologies.size>=250);
  assert.ok(combinations.size>990);
  assert.ok(fallbackCount<=10,'normal seeds should rarely exhaust constrained placement retries');
  assert.ok(maxAttempts<512);
  assert.equal(parkingCount,1000,'acceptance seeds have separate off-road parking without consuming housing');
});

test('an adversarial random stream returns the validated authored fallback deterministically',()=>{
  const options={seed:17,random:()=>0,places:PLACES,themes:THEMES};
  const map=createTownLayout(options);
  assert.equal(map.layout.fallbackUsed,true);
  assert.equal(map.layout.attempts,512);
  assert.deepEqual(validateTownLayout(map),[]);
  assert.deepEqual(map,createTownLayout(options));
});

test('validation rejects damaged lots, frontages and topology before rendering',()=>{
  const map=generateMap(2);
  const invalid=structuredClone(map);
  invalid.places[0].lot={...invalid.places[0].lot,x:map.nodes[0].x,z:map.nodes[0].z};
  assert.ok(validateTownLayout(invalid).some(error=>error.includes('junction')||error.includes('road')));
  const rotated=structuredClone(map);rotated.places[0].lot.rotation=Math.PI;
  assert.ok(validateTownLayout(rotated).includes('Lot must face -Z with positive size'));
  const missingRoad=structuredClone(map);missingRoad.edges=missingRoad.edges.filter(edge=>key(edge)!==key(missingRoad.places[0].lot.accessEdge));
  assert.ok(validateTownLayout(missingRoad).some(error=>error.includes('frontage')));
});
