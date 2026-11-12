import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadPath, sampleRoadPath, createRoadMotion, advanceRoadMotion } from '../src/v2/motion.js';

test('junction is a tangent circular turn contained in the road crossing',()=>{
  const path=buildRoadPath([{x:0,z:0},{x:0,z:9},{x:9,z:9}]);
  assert.deepEqual(path.segments.map(s=>s.kind),['line','arc','line']);
  const arc=path.segments[1];
  for(let d=0;d<=path.length;d+=.025){
    const p=sampleRoadPath(path,d);
    assert.ok(Math.min(Math.abs(p.x),Math.abs(p.z-9))<.74,'centre must stay inside paved crossing');
  }
  // A conservative footprint for the longest vehicle stays on the union of
  // the two paved lanes, including the inner and outer sides of the bend.
  for(let d=arc.start;d<arc.start+arc.length;d+=.015){
    const p=sampleRoadPath(path,d);
    for(const [halfWidth,halfLength] of [[.9,2.05],[1.05,1.7]])for(let side=-halfWidth;side<=halfWidth;side+=.1)for(let fore=-halfLength;fore<=halfLength;fore+=.1){
      const x=p.x+Math.sin(p.yaw)*fore+Math.cos(p.yaw)*side;
      const z=p.z+Math.cos(p.yaw)*fore-Math.sin(p.yaw)*side;
      assert.ok(Math.min(Math.abs(x),Math.abs(z-9))<=1.5,'vehicle body and wheels stay on the paved crossing');
    }
  }
  for(const boundary of [arc.start,arc.start+arc.length]){
    const before=sampleRoadPath(path,boundary-.00001),after=sampleRoadPath(path,boundary+.00001);
    assert.ok(Math.hypot(before.x-after.x,before.z-after.z)<.0001);
    assert.ok(Math.abs(Math.sin(before.yaw-after.yaw))<.0001,'heading follows continuous tangent');
  }
});

test('motion accelerates, brakes into turns, stops exactly and stays stopped',()=>{
  const path=buildRoadPath([{x:0,z:0},{x:0,z:9},{x:9,z:9},{x:9,z:18}]);
  const m=createRoadMotion(path);let peak=0,last=0,frames=0;
  while(!m.done&&frames++<3000){
    advanceRoadMotion(m,1/60);peak=Math.max(peak,m.speed);
    assert.ok(Math.abs(m.speed-last)<=4.2/60+.05,'speed changes are bounded');last=m.speed;
    if(Math.abs(m.curvature)>.01)assert.ok(m.speed<3.25,'corner speed is controlled');
  }
  assert.ok(m.done);assert.ok(peak>4);assert.equal(m.speed,0);assert.equal(m.x,9);assert.equal(m.z,18);
  const stopped={...m};advanceRoadMotion(m,1);assert.deepEqual(m,stopped);
});

test('repeated points and arbitrary node count preserve exact destination',()=>{
  const points=[{x:-13.5,z:-12},{x:-13.5,z:-12},{x:-4.5,z:-12},{x:-4.5,z:-4},{x:4.5,z:-4},{x:4.5,z:4},{x:13.5,z:4},{x:13.5,z:12}];
  const a=createRoadMotion(buildRoadPath(points)),b=createRoadMotion(buildRoadPath(points));
  for(let t=0;t<30;t+=1/60)advanceRoadMotion(a,1/60);
  for(let t=0;t<30;t+=.1)advanceRoadMotion(b,.1);
  assert.ok(a.done&&b.done);assert.equal(a.x,13.5);assert.equal(a.z,12);assert.equal(a.distance,b.distance);
  const still={...a};advanceRoadMotion(a,0);assert.deepEqual(a,still);
});
