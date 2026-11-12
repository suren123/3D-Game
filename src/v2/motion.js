// Road-centred paths with circular junction turns. Coordinates are world x/z;
// +Z is the vehicle's forward axis. No renderer or rules state lives here.
const distance = (a,b) => Math.hypot(b.x-a.x,b.z-a.z);
const unit = (a,b) => { const d=distance(a,b); return {x:(b.x-a.x)/d,z:(b.z-a.z)/d}; };

export function buildRoadPath(points, { turnRadius = 2.5, cruiseSpeed = 6.8, turnSpeed = 3.1 } = {}) {
  const nodes=[];
  for(const p of points||[])if(Number.isFinite(p.x)&&Number.isFinite(p.z)&&(!nodes.length||distance(nodes.at(-1),p)>.00001))nodes.push({x:p.x,z:p.z});
  const segments=[];let length=0;
  function line(a,b){const size=distance(a,b);if(size<.00001)return;segments.push({kind:'line',a,b,length:size,start:length,speed:cruiseSpeed});length+=size;}
  let cursor=nodes[0];
  for(let i=1;i<nodes.length-1;i++){
    const before=nodes[i-1],corner=nodes[i],after=nodes[i+1],a=unit(before,corner),b=unit(corner,after);
    const cross=a.x*b.z-a.z*b.x,dot=Math.max(-1,Math.min(1,a.x*b.x+a.z*b.z));
    if(Math.abs(cross)<.00001){line(cursor,corner);cursor=corner;continue;}
    const angle=Math.acos(dot),cut=Math.min(turnRadius*Math.tan(angle/2),distance(before,corner)*.35,distance(corner,after)*.35);
    const radius=cut/Math.tan(angle/2),sign=Math.sign(cross);
    const entry={x:corner.x-a.x*cut,z:corner.z-a.z*cut},exit={x:corner.x+b.x*cut,z:corner.z+b.z*cut};
    const center={x:entry.x-a.z*sign*radius,z:entry.z+a.x*sign*radius};
    line(cursor,entry);
    const size=radius*angle;
    segments.push({kind:'arc',center,radius,angle:Math.atan2(entry.z-center.z,entry.x-center.x),sweep:angle*sign,length:size,start:length,speed:turnSpeed});length+=size;cursor=exit;
  }
  if(nodes.length>1)line(cursor,nodes.at(-1));
  return {segments,length,start:nodes[0]||{x:0,z:0},end:nodes.at(-1)||{x:0,z:0},cruiseSpeed};
}

export function sampleRoadPath(path, travelled) {
  const d=Math.max(0,Math.min(path.length,travelled));
  const segment=path.segments.find(s=>d<s.start+s.length-.000001)||path.segments.at(-1);
  if(!segment)return {...path.end,yaw:0,curvature:0};
  const t=Math.max(0,Math.min(1,(d-segment.start)/segment.length));
  if(segment.kind==='line')return {x:segment.a.x+(segment.b.x-segment.a.x)*t,z:segment.a.z+(segment.b.z-segment.a.z)*t,yaw:Math.atan2(segment.b.x-segment.a.x,segment.b.z-segment.a.z),curvature:0};
  const a=segment.angle+segment.sweep*t,sign=Math.sign(segment.sweep);
  return {x:segment.center.x+Math.cos(a)*segment.radius,z:segment.center.z+Math.sin(a)*segment.radius,yaw:Math.atan2(-Math.sin(a)*sign,Math.cos(a)*sign),curvature:sign/segment.radius};
}

export function createRoadMotion(path){return {path,distance:0,speed:0,done:path.length<.00001,...sampleRoadPath(path,0)};}

export function advanceRoadMotion(motion, dt) {
  // Small deterministic steps keep braking and arrival stable across frame rates.
  let remaining=Math.max(0,Number(dt)||0);
  const acceleration=3.2,braking=4.2;
  while(remaining>.000001&&!motion.done){
    const step=Math.min(remaining,1/90);remaining-=step;
    const endDistance=Math.max(0,motion.path.length-motion.distance);
    // Include this step's trapezoid travel in the stopping envelope; sampling
    // sqrt(2*a*d) alone brakes one frame late and leaves a visible arrival snap.
    const stopLimit=Math.max(0,(-braking*step+Math.sqrt(Math.max(0,(braking*step)**2-4*braking*step*motion.speed+8*braking*endDistance)))/2);
    let limit=Math.min(motion.path.cruiseSpeed,stopLimit);
    for(const segment of motion.path.segments){
      if(segment.start+segment.length<motion.distance)continue;
      const ahead=Math.max(0,segment.start-motion.distance);
      limit=Math.min(limit,Math.sqrt(segment.speed**2+2*braking*ahead));
    }
    const next=Math.max(0,Math.min(motion.speed+acceleration*step,Math.max(motion.speed-braking*step,limit)));
    motion.distance=Math.min(motion.path.length,motion.distance+(motion.speed+next)*.5*step);motion.speed=next;
    if(motion.path.length-motion.distance<.0001&&motion.speed<.05){motion.distance=motion.path.length;motion.speed=0;motion.done=true;}
    Object.assign(motion,sampleRoadPath(motion.path,motion.distance));
  }
  return motion;
}
