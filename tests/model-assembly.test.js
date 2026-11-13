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

test('camp has an entrance facing the fixed camera, grounded matte tent and separated trees/props',async()=>{
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
      const radius=Math.min(platform.max.x-platform.min.x,platform.max.z-platform.min.z)/2;
      const feet=tent.flatMap(part=>part.points.filter(point=>Math.abs(point.y-body.min.y)<1e-5));
      assert.ok(feet.every(point=>Math.hypot(point.x,point.z)<=radius+.015),'rotated tent feet must remain on the round base');
      // Horizontal rays along the actual (+X,-Z) camera direction, beside the
      // central pole. A closed side panel would be hit before the tent center.
      const center=tent[0].points.reduce((sum,p)=>sum.add(p),Vector3.Zero()).scale(1/tent[0].points.length);
      const view=new Vector3(1,0,-1).normalize(),side=new Vector3(1,0,1).normalize(),entranceHits=[];
      for(const offset of [-.25,.25]){
        const start=new Vector3(center.x,body.min.y+.5,center.z).add(view.scale(6)).add(side.scale(offset));
        const ray=new Ray(start,view.scale(-1)),hits=[];
        for(const part of tent)for(const triangle of part.triangles){const hit=ray.intersectsTriangle(...triangle);if(hit)hits.push(hit.distance);}
        assert.ok(hits.length&&Math.min(...hits)>6.1,'the fixed camera must see through the opening to an interior/back surface');
        entranceHits.push(Math.min(...hits));
      }
      console.log(JSON.stringify({camp:{bounds:body,propCount:props.length,entranceFirstSolidZ:entranceHits}}));
    }finally{container.dispose();}
  }finally{scene.dispose();engine.dispose();}
});
