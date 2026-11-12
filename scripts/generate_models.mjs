// Reproducible offline low-poly toy props. No runtime geometry downloads, fonts,
// textures, Blender installation or native exporter is required.
// glTF 2.0 meshes are merged by material; all binary buffers are embedded in GLB.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUTPUT = fileURLToPath(new URL('../public/models/town-v2/', import.meta.url));
await mkdir(OUTPUT, { recursive: true });
const palette = {
  cream:'#fff1cf', white:'#fffaf0', coral:'#ee8064', red:'#db6255', mint:'#72c6ad',
  teal:'#339b9c', blue:'#85bde3', navy:'#3b657a', yellow:'#f4c365', green:'#79ac69',
  leaf:'#96c878', darkleaf:'#4c9774', brown:'#b98259', bark:'#976648', pink:'#e99da5',
  purple:'#a7a0cf', dark:'#4e6260', glass:'#9dd9dd', asphalt:'#8c9a96', sand:'#dfcb9e',
};
const srgb = value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4;
const rgba = hex => [...hex.slice(1).match(/../g).map(x=>srgb(parseInt(x,16)/255)), 1];

function builder() {
  const groups = new Map();
  function triangle(mat,a,b,c) {
    if (!groups.has(mat)) groups.set(mat,{p:[],n:[],i:[]});
    const g=groups.get(mat), u=b.map((v,i)=>v-a[i]), v=c.map((v,i)=>v-a[i]);
    let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const l=Math.hypot(...n)||1;n=n.map(x=>x/l);
    const start=g.p.length/3;g.p.push(...a,...b,...c);g.n.push(...n,...n,...n);g.i.push(start,start+1,start+2);
  }
  function box(name,x,y,z,w,h,d,angle=0) {
    const points=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>{
      a*=w/2;b*=h/2;c*=d/2;return [x+a*Math.cos(angle)+c*Math.sin(angle),y+b,z-a*Math.sin(angle)+c*Math.cos(angle)];
    });
    for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]) {
      triangle(name,points[a],points[b],points[c]); triangle(name,points[a],points[c],points[d]);
    }
  }
  function cylinder(name,x,y,z,r,h,top=r,sides=10) {
    for(let i=0;i<sides;i++){
      const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;
      const p=[x+Math.cos(a)*r,y-h/2,z+Math.sin(a)*r],q=[x+Math.cos(b)*r,y-h/2,z+Math.sin(b)*r];
      const p2=[x+Math.cos(a)*top,y+h/2,z+Math.sin(a)*top],q2=[x+Math.cos(b)*top,y+h/2,z+Math.sin(b)*top];
      triangle(name,p,q2,q);triangle(name,p,p2,q2);
      triangle(name,[x,y-h/2,z],p,q);triangle(name,[x,y+h/2,z],q2,p2);
    }
  }
  function ball(name,x,y,z,r,sx=1,sy=1,sz=1) {
    const rings=4,sides=8;
    const p=(i,j)=>{const a=i/rings*Math.PI,b=j/sides*2*Math.PI;return [x+Math.sin(a)*Math.cos(b)*r*sx,y+Math.cos(a)*r*sy,z+Math.sin(a)*Math.sin(b)*r*sz];};
    for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){
      const a=p(i,j),b=p(i+1,j),c=p(i+1,j+1),d=p(i,j+1);
      triangle(name,a,c,b);triangle(name,a,d,c);
    }
  }
  function roof(name,x,y,z,w,h,d) {
    const p=[[-w/2,0,-d/2],[w/2,0,-d/2],[0,h,-d/2],[-w/2,0,d/2],[w/2,0,d/2],[0,h,d/2]].map(q=>[q[0]+x,q[1]+y,q[2]+z]);
    for(const [a,b,c] of [[0,2,1],[3,4,5],[0,3,5],[0,5,2],[1,2,5],[1,5,4],[0,1,4],[0,4,3]])triangle(name,p[a],p[b],p[c]);
  }
  function window(x,y,z,w=.65,h=.65) {box('white',x,y,z,w+.14,h+.14,.13);box('glass',x,y,z-.08,w,h,.07);}
  function door(x,z,y=.72) {box('white',x,y,z,.91,1.55,.17);box('navy',x,y,z-.1,.70,1.40,.08);box('yellow',x+.21,y,z-.16,.1,.12,.05);}
  function house(w=3,h=2.4,d=2.5,wall='cream',top='coral'){
    box('white',0,.11,0,w+.35,.22,d+.35);box(wall,0,h/2+.22,0,w,h,d);roof(top,0,h+.22,0,w+.4,.85,d+.4);
    door(0,-d/2-.06);window(-w*.3,1.5,-d/2-.07,.55,.7);window(w*.3,1.5,-d/2-.07,.55,.7);
    box('cream',w*.28,h+.8,.25,.4,1,.42);
  }
  async function save(id) {
    const json={asset:{version:'2.0',generator:'Little Town offline toy-model builder'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:id,mesh:0}],meshes:[{name:id,primitives:[]}],materials:[],bufferViews:[],accessors:[],buffers:[{byteLength:0}]};
    const chunks=[];let offset=0;
    const add=(array,componentType,type,min,max)=>{
      const bytes=Buffer.from(array.buffer);const padding=(4-bytes.length%4)%4;
      const view=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});chunks.push(bytes,Buffer.alloc(padding));offset+=bytes.length+padding;
      const accessor=json.accessors.length;json.accessors.push({bufferView:view,componentType,count:array.length/(type==='VEC3'?3:1),type,...(min?{min,max}:{})});return accessor;
    };
    for(const [color,g] of groups){
      const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];g.p.forEach((v,i)=>{min[i%3]=Math.min(min[i%3],v);max[i%3]=Math.max(max[i%3],v);});
      const position=add(new Float32Array(g.p),5126,'VEC3',min,max),normal=add(new Float32Array(g.n),5126,'VEC3'),indices=add(new Uint16Array(g.i),5123,'SCALAR');
      const material=json.materials.length;json.materials.push({name:color,pbrMetallicRoughness:{baseColorFactor:rgba(palette[color]),metallicFactor:0,roughnessFactor:1},doubleSided:false});
      json.meshes[0].primitives.push({attributes:{POSITION:position,NORMAL:normal},indices,material});
    }
    json.buffers[0].byteLength=offset;
    let encoded=Buffer.from(JSON.stringify(json));encoded=Buffer.concat([encoded,Buffer.alloc((4-encoded.length%4)%4,32)]);
    const bin=Buffer.concat(chunks),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
    header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+encoded.length+bin.length,8);
    jh.writeUInt32LE(encoded.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
    const bytes=Buffer.concat([header,jh,encoded,bh,bin]);await writeFile(`${OUTPUT}/${id}.glb`,bytes);console.log(`${id}.glb ${bytes.length} bytes`);
  }
  return {box,cylinder,ball,roof,window,door,house,save};
}

for(const id of ['depot','park','school','hospital','farm','cafe','garage','house','tree','bush','bench','flowers','bus','tanker']){
  const b=builder(),{box,cylinder,ball,roof,window,door,house}=b;
  if(id==='bus'||id==='tanker'){
    box('dark',0,.4,0,1.4,.25,3.4);
    for(const x of [-.72,.72])for(const z of [-1.1,1.05]){ball('dark',x,.36,z,.36,.44,1,1);ball('cream',x*1.09,.36,z,.19,.22,1,1);}
    if(id==='bus'){
      box('yellow',0,1.05,0,1.4,1.25,3.3);box('cream',0,1.75,0,1.5,.2,3.4);
      for(const x of [-.71,.71])for(let i=0;i<4;i++)box('glass',x,1.39,-1.17+i*.76,.05,.52,.57);
      box('glass',0,1.38,1.67,1.16,.55,.05);box('white',0,.83,1.71,1.3,.14,.08);
      for(const x of [-.48,.48])box('white',x,.94,1.72,.2,.18,.05);
    }else{
      box('mint',0,.98,1.04,1.45,1.25,1.2);box('glass',0,1.28,1.67,1.2,.5,.05);
      box('cream',0,1.65,1.05,1.5,.16,1.3);ball('blue',0,1.17,-.62,.78,.93,.87,1.4);
      cylinder('white',0,1.8,-.62,.23,.2,.23,10);box('teal',0,.73,-1.65,1.45,.18,.2);
      for(const x of [-.48,.48])box('yellow',x,.93,1.68,.2,.18,.06);
    }
  }else if(id==='depot'){
    box('cream',0,1.35,0,3.6,2.7,2.7);roof('yellow',0,2.7,0,4,.7,3.1);
    box('teal',0,1.1,-1.39,2.3,2.1,.12);for(let i=0;i<4;i++)box('mint',0,.45+i*.43,-1.48,2.1,.08,.05);
    box('white',0,2.45,-1.42,1.65,.48,.2);box('yellow',0,2.45,-1.56,.46,.36,.15);
    for(const [x,z] of [[-2,-1],[1.95,-1.2],[2.0,-.3]]){box('brown',x,.35,z,.65,.7,.65);box('cream',x,.35,z-.34,.1,.62,.04);}
  }else if(id==='park'){
    cylinder('sand',0,.08,0,2.35,.16,2.35,20);cylinder('white',0,.3,0,1.25,.55,1.25,16);cylinder('blue',0,.59,0,1.05,.05,1.05,16);
    cylinder('cream',0,.9,0,.25,.9,.2,8);cylinder('blue',0,1.28,0,.75,.12,.75,12);ball('blue',0,1.63,0,.25);
    for(let i=0;i<5;i++){const a=i*1.256;ball('pink',Math.sin(a)*1.9,.3,Math.cos(a)*1.9,.28);ball('yellow',Math.sin(a+.15)*1.9,.4,Math.cos(a+.15)*1.9,.25);}
  }else if(id==='school'){
    box('yellow',0,1.4,0,3.8,2.8,2.8);roof('coral',0,2.8,0,4.2,.9,3.2);door(0,-1.46);
    for(const x of [-1.25,1.25]){window(x,1.7,-1.46,.65,.8);window(x,1.7,1.46,.65,.8);}
    box('cream',0,3.6,0,.9,.8,.9);roof('teal',0,4,0,1.2,.65,1.2);cylinder('cream',2.4,1.7,-.6,.065,3.4,.065,6);box('coral',2.8,3.05,-.6,.8,.45,.06);
  }else if(id==='hospital'){
    box('white',0,1.6,0,3.7,3.2,2.8);box('blue',0,3.22,0,4.05,.26,3.1);door(0,-1.46);
    for(const x of [-1.23,1.23])for(const y of [1.0,2.2])window(x,y,-1.46,.66,.65);
    box('white',0,3.85,0,1.15,1.15,.3);box('coral',0,3.85,-.2,.72,.23,.12);box('coral',0,3.85,-.2,.23,.72,.12);
  }else if(id==='farm'){
    house(3.2,2.3,2.7,'coral','cream');box('white',0,1,-1.44,1.25,1.8,.1);box('brown',0,.95,-1.51,1.05,1.6,.08);
    for(const x of [-2.2,2.2]){cylinder('yellow',x,.5,.5,.55,1,.55,10);box('cream',x,.5,.5,1.2,.1,.1);}
    for(let i=0;i<3;i++){box('brown',2.3,.05,-1+i*.5,.9,.12,.27);ball('leaf',2.3,.28,-1+i*.5,.3,1,.8,.6);}
  }else if(id==='cafe'){
    house(3.1,2.3,2.7,'pink','teal');for(let i=0;i<7;i++)box(i%2?'white':'coral',-1.35+i*.45,1.86,-1.68,.45,.22,.9);
    for(const x of [-1.0,1.0])window(x,1.08,-1.42,.65,.8);
    cylinder('brown',2.35,.7,-.8,.1,1.4,.1,8);cylinder('cream',2.35,1.42,-.8,.75,.14,.75,12);
    cylinder('teal',2.35,2.15,-.8,.03,1.4,.03,6);cylinder('yellow',2.35,2.75,-.8,1.2,.55,0,8);
  }else if(id==='garage'){
    box('teal',0,1.3,0,3.7,2.6,2.7);box('cream',0,2.65,0,4.1,.25,3.1);
    box('navy',0,1.1,-1.39,2.7,2.2,.1);for(let i=0;i<5;i++)box('mint',0,.3+i*.4,-1.46,2.4,.07,.06);
    box('yellow',0,2.9,-.9,1.5,.45,.2);for(const x of [-1.9,1.9]){cylinder('dark',x,.25,-1.8,.4,.5,.4,12);cylinder('cream',x,.55,-1.8,.2,.15,.2,10);}
  }else if(id==='house')house(2.3,1.9,2.3,'cream','purple');
  else if(id==='tree'){
    cylinder('bark',0,.7,0,.16,1.4,.12,7);ball('darkleaf',0,1.8,0,1,1,1.15,1);ball('leaf',-.45,2.15,-.2,.65);ball('green',.5,2.0,.15,.68);
  }else if(id==='bush'){ball('darkleaf',-.4,.38,0,.46);ball('leaf',.15,.5,0,.6);ball('green',.55,.4,.1,.4);}
  else if(id==='bench'){
    for(const x of [-.65,.65]){box('navy',x,.35,0,.14,.7,.6);box('navy',x,.8,.23,.12,.9,.12);}
    for(let i=0;i<3;i++)box('brown',0,.73,-.23+i*.23,1.65,.11,.18);
    for(let i=0;i<2;i++)box('yellow',0,1.02+i*.22,.27,1.65,.16,.1);
  }else if(id==='flowers'){
    box('cream',0,.18,0,1.4,.36,.55);box('brown',0,.38,0,1.3,.08,.45);
    for(let i=0;i<5;i++){const x=-.53+i*.265;cylinder('green',x,.6,0,.035,.5,.035,5);ball(i%2?'pink':'yellow',x,.87,0,.18);}
  }
  await b.save(id);
}
await writeFile(`${OUTPUT}/README.md`, `# Toy town models\n\nOriginal low-poly models generated by this project with \`node scripts/generate_models.mjs\`.\nAll shapes are original geometry, using no downloaded textures or fonts. GLB 2.0, Y-up, ground at Y=0; building fronts face -Z; bus and tanker fronts face +Z.\nBuildings are approximately 3–4 units wide and trees 3 units high. Meshes are merged by material.\nMaterial colours are embedded linear RGB, with zero metallic and full roughness.\nThe files are reusable offline resources, not generated in the browser.\n`);
