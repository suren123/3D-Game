import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {Ray} from '@babylonjs/core/Culling/ray.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import '@babylonjs/loaders/glTF/glTFFileLoader.js';
import {RESOURCE_MANIFEST} from '../src/v2/resource-manifest.js';

// Actual Babylon glTF parsing/conversion, without a browser or GPU. The checks
// query shipped triangles, not the attachment constants in the authoring scripts.
async function load(id, scene) {
  const {path}=RESOURCE_MANIFEST.models.find(model=>model.id===id);
  const data=readFileSync(new URL(`../public/${path}`,import.meta.url));
  const container=await LoadAssetContainerAsync(new Uint8Array(data),scene,{pluginExtension:'.glb'});
  return {container,parts:container.meshes.filter(mesh=>mesh.getTotalVertices()).map(mesh=>{
    const matrix=mesh.computeWorldMatrix(true),positions=mesh.getVerticesData('position'),indices=mesh.getIndices();
    const points=Array.from({length:positions.length/3},(_,i)=>Vector3.TransformCoordinates(Vector3.FromArray(positions,i*3),matrix));
    const min=points.reduce((a,b)=>Vector3.Minimize(a,b)),max=points.reduce((a,b)=>Vector3.Maximize(a,b));
    const triangles=Array.from({length:indices.length/3},(_,i)=>Array.from(indices.slice(i*3,i*3+3),index=>points[index]));
    return {name:mesh.name,material:mesh.material,min,max,points,triangles};
  })};
}
function roof(parts,x,z) {
  const ray=new Ray(new Vector3(x,-10,z),Vector3.Up()),heights=[];
  for(const part of parts)for(const triangle of part.triangles){
    const hit=ray.intersectsTriangle(...triangle);
    if(hit)heights.push(hit.distance-10);
  }
  assert.ok(heights.length,'attachment must stand above a real shell triangle');
  return Math.max(...heights);
}
const overlap=(a,b)=>['x','y','z'].every(axis=>a.min[axis]<b.max[axis]-1e-5&&a.max[axis]>b.min[axis]+1e-5);
const triangleBox=triangle=>({min:triangle.reduce((a,b)=>Vector3.Minimize(a,b)),max:triangle.reduce((a,b)=>Vector3.Maximize(a,b))});
function crosses(a,b){
  const ab=a.triangles.map(triangle=>({triangle,...triangleBox(triangle)}));
  const bb=b.triangles.map(triangle=>({triangle,...triangleBox(triangle)}));
  const edgeHits=(triangle,target)=>triangle.some((p,i)=>{
    const delta=triangle[(i+1)%3].subtract(p),length=delta.length();
    if(length<1e-8)return false;
    const hit=new Ray(p,delta.scale(1/length)).intersectsTriangle(...target);
    return hit&&hit.distance>1e-5&&hit.distance<length-1e-5&&hit.bu>1e-5&&hit.bv>1e-5&&hit.bu+hit.bv<1-1e-5;
  });
  return ab.some(x=>bb.some(y=>overlap(x,y)&&(edgeHits(x.triangle,y.triangle)||edgeHits(y.triangle,x.triangle))));
}

test('all six building signs contact the actual local roof and the cafe cup sits on its roof',async()=>{
  const engine=new NullEngine(),scene=new Scene(engine),observations=[];
  try{
    for(const id of ['depot','school','hospital','garage','shop','cafe']){
      const {container,parts}=await load(id,scene);
      try{
        const shell=parts.filter(part=>part.name.startsWith('building-'));
        assert.ok(shell.length);
        if(id==='cafe'){
          const cup=parts.find(part=>part.name==='cup-coffee');assert.ok(cup);
          const feet=cup.points.filter(point=>Math.abs(point.y-cup.min.y)<1e-5);
          assert.ok(feet.length>=3);
          const gaps=feet.map(point=>point.y-roof(shell,point.x,point.z));
          assert.ok(gaps.every(gap=>Math.abs(gap)<.01),`cafe cup floats or penetrates rooftop hardware: ${gaps}`);
          observations.push({id,cupFootSamples:feet.length,minGap:Math.min(...gaps),maxGap:Math.max(...gaps)});
        }else{
          const post=parts.find(part=>part.name.includes('support'));assert.ok(post,`${id}: sign post exists`);
          const levels=[];
          for(const x of [post.min.x,post.max.x])for(const z of [post.min.z,post.max.z])levels.push(roof(shell,x,z));
          assert.ok(levels.every(level=>post.min.y<=level+1e-4&&post.max.y>level+.02),`${id}: post must cross the roof at every foot corner`);
          assert.ok(Math.max(...levels)-Math.min(...levels)<.35,`${id}: post must not straddle a roof edge`);
          const cap=parts.find(part=>part.name.includes(id==='depot'?'parcel sign':id==='garage'?'wrench handle':id==='school'?'blue open-book cover':id==='hospital'?'white backing':'orange shopping basket')&&!part.name.includes('support'));
          assert.ok(cap&&overlap(post,cap),`${id}: the post must also meet the sign`);
          if(id==='hospital'){
            assert.ok(cap.min.y>Math.max(...levels)+.02,'medical board must stand above the roof rather than cut through it');
            assert.ok(!parts.some(part=>part.name.includes('canopy')),'detached hospital canopy must not return');
          }
          observations.push({id,footY:post.min.y,roofMin:Math.min(...levels),roofMax:Math.max(...levels)});
        }
      }finally{container.dispose();}
    }
    console.log(JSON.stringify({assemblyRoofContacts:observations}));
  }finally{scene.dispose();engine.dispose();}
});

test('camp entrance faces world -Z like the other buildings, with grounded matte tent and clear separated props',async()=>{
  const engine=new NullEngine(),scene=new Scene(engine);
  try{
    const {container,parts}=await load('camp',scene);
    try{
      const tent=parts.filter(part=>part.name.startsWith('tent_smallOpen'));
      assert.equal(tent.length,3,'all three actual Nature tent materials are present');
      const body={min:tent.reduce((v,p)=>Vector3.Minimize(v,p.min),tent[0].min),max:tent.reduce((v,p)=>Vector3.Maximize(v,p.max),tent[0].max)};
      const platform=parts.find(part=>part.material?.name==='sand');assert.ok(platform);
      assert.ok(Math.abs(body.min.y-platform.max.y)<1e-5,'tent feet sit on the platform');
      assert.ok(tent.every(part=>part.material.metallic===0),'the documented Nature fabric/wood correction remains matte');
      const props=parts.filter(part=>!tent.includes(part)&&part!==platform);
      assert.ok(props.length>=7);
      for(const prop of props)for(const cloth of tent)assert.ok(!overlap(cloth,prop)||!crosses(cloth,prop),`${prop.name}/${prop.material?.name} cuts through tent triangles`);
      for(let i=0;i<props.length;i++)for(let j=i+1;j<props.length;j++){
        const a=props[i],b=props[j];
        // The cream latch is intentionally attached to the brown crate.
        if([a.material?.name,b.material?.name].sort().join('/')==='brown/cream')continue;
        assert.ok(!overlap(a,b)||!crosses(a,b),`${a.name}/${a.material?.name} cuts through ${b.name}/${b.material?.name}`);
      }
      const radius=Math.min(platform.max.x-platform.min.x,platform.max.z-platform.min.z)/2;
      const feet=tent.flatMap(part=>part.points.filter(point=>Math.abs(point.y-body.min.y)<1e-5));
      assert.ok(feet.every(point=>Math.hypot(point.x,point.z)<=radius+.015),'rotated tent feet must remain on the round base');
      const propFeet=props.flatMap(part=>part.points.filter(point=>Math.abs(point.y-platform.max.y)<1e-5));
      assert.ok(propFeet.every(point=>Math.hypot(point.x,point.z)<=radius+.015),'all prop feet must remain on the round base');
      // Use actual loader world coordinates: the common frontage is -Z,
      // which projects towards the lower left in the fixed (+X,-Z) view.
      // Sample beside the central pole, including the low doorway where a
      // stool could block the entrance while higher camera rays still pass.
      const center=body.min.add(body.max).scale(.5),entranceHits=[];
      for(const height of [.12,.25,.5])for(const offset of [-.25,.25]){
        const start=new Vector3(center.x+offset,body.min.y+height,center.z-6);
        const ray=new Ray(start,new Vector3(0,0,1)),hits=[];
        for(const part of tent)for(const triangle of part.triangles){const hit=ray.intersectsTriangle(...triangle);if(hit)hits.push(hit.distance);}
        assert.ok(hits.length&&Math.min(...hits)>6.1,'world -Z rays must enter the opening before hitting an interior/back surface');
        assert.ok(Math.abs(start.z+Math.min(...hits)-body.max.z)<.01,'the -Z opening must lead to the +Z rear panel');
        for(const prop of props)for(const triangle of prop.triangles){
          const hit=ray.intersectsTriangle(...triangle);
          assert.ok(!hit||hit.distance>6.1,`${prop.name}/${prop.material?.name} blocks the -Z doorway`);
        }
        const rearStart=new Vector3(start.x,start.y,center.z+6),rearRay=new Ray(rearStart,new Vector3(0,0,-1)),rearHits=[];
        for(const part of tent)for(const triangle of part.triangles){const hit=rearRay.intersectsTriangle(...triangle);if(hit)rearHits.push(hit.distance);}
        assert.ok(rearHits.length&&Math.min(...rearHits)<5,'the opposite +Z gable remains the closed back, not a second assumed entrance');
        entranceHits.push({height,offset,frontDistance:Math.min(...hits),backDistance:Math.min(...rearHits)});
      }
      console.log(JSON.stringify({camp:{bounds:body,propCount:props.length,worldMinusZEntrance:entranceHits}}));
    }finally{container.dispose();}
  }finally{scene.dispose();engine.dispose();}
});

test('farm has one barn door surface and staggered white braces seated in the panel',async()=>{
  const engine=new NullEngine(),scene=new Scene(engine);
  try{
    const {container,parts}=await load('farm',scene);
    try{
      assert.ok(!parts.some(part=>part.material?.name==='navy'),'the generic house door must not remain underneath the barn door');
      const hitSurfaces=(x,y)=>{
        const ray=new Ray(new Vector3(x,y,-5),new Vector3(0,0,1)),hits=[];
        for(const part of parts)for(const triangle of part.triangles){
          const hit=ray.intersectsTriangle(...triangle);
          if(hit)hits.push({material:part.material?.name,z:-5+hit.distance});
        }
        return hits;
      };
      const panelSamples=[];
      for(const [x,y] of [[.17,.4],[-.17,.9],[.21,.72],[-.21,1.2]]){
        const hits=hitSurfaces(x,y),panel=hits.filter(hit=>hit.material==='brown'&&hit.z<-1.5);
        assert.ok(panel.length,'the actual brown barn panel covers the sampled doorway');
        const front=Math.min(...panel.map(hit=>hit.z));
        assert.ok(!hits.some(hit=>hit.material!=='brown'&&Math.abs(hit.z-front)<1e-5),'different door materials must not share the same visible plane');
        panelSamples.push({x,y,front});
      }
      const crossing=hitSurfaces(0,1.5).filter(hit=>hit.material==='white');
      const uniquePlanes=values=>values.sort((a,b)=>a-b).filter((value,i,all)=>!i||value-all[i-1]>1e-5);
      const fronts=uniquePlanes(crossing.filter(hit=>hit.z<-1.57).map(hit=>hit.z));
      assert.equal(fronts.length,2,'the two crossing brace fronts must occupy separate depth planes');
      assert.ok(fronts[1]-fronts[0]>.005,'the crossing timbers need real depth separation rather than duplicate coplanar faces');
      const backs=uniquePlanes(crossing.filter(hit=>hit.z>-1.55&&hit.z<-1.5).map(hit=>hit.z));
      assert.equal(backs.length,2,'both braces must extend into the brown door thickness at their crossing');
      console.log(JSON.stringify({farm:{panelSamples,braceFrontPlanes:fronts,braceBackPlanes:backs}}));
    }finally{container.dispose();}
  }finally{scene.dispose();engine.dispose();}
});
