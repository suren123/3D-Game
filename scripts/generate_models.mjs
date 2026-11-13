// Reproducible offline low-poly toy props. No runtime geometry downloads, fonts,
// Blender installation or native exporter is required. Two landmarks include
// the curated CC0 Kenney Mini meshes and their original embedded colormaps.
// glTF 2.0 meshes are merged by material; all binary buffers are embedded in GLB.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { spawnSync } from 'node:child_process';

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
  function box(name,x,y,z,w,h,d,angle=0,roll=0) {
    // One bevel segment keeps the soft Mini silhouette without smooth cubes
    // or a browser-time modelling dependency. Thin sign strokes stay crisp.
    const geometry=new RoundedBoxGeometry(w,h,d,1,Math.min(w,h,d)*.12);
    const p=geometry.attributes.position;
    const point=i=>{
      const a=p.getX(i),b=p.getY(i),c=p.getZ(i);
      const rx=a*Math.cos(roll)-b*Math.sin(roll),ry=a*Math.sin(roll)+b*Math.cos(roll);
      return [x+rx*Math.cos(angle)+c*Math.sin(angle),y+ry,z-rx*Math.sin(angle)+c*Math.cos(angle)];
    };
    for(let i=0;i<p.count;i+=3)triangle(name,point(i),point(i+1),point(i+2));
    geometry.dispose();
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
  function house(w=3,h=2.4,d=2.5,wall='cream',top='coral',withDoor=true){
    box('white',0,.11,0,w+.35,.22,d+.35);box(wall,0,h/2+.22,0,w,h,d);roof(top,0,h+.22,0,w+.4,.85,d+.4);
    if(withDoor)door(0,-d/2-.06);window(-w*.3,1.5,-d/2-.07,.55,.7);window(w*.3,1.5,-d/2-.07,.55,.7);
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
      const position=add(new Float32Array(g.p),5126,'VEC3',min,max),normal=add(new Float32Array(g.n),5126,'VEC3'),indices=add(g.i.length>65535?new Uint32Array(g.i):new Uint16Array(g.i),g.i.length>65535?5125:5123,'SCALAR');
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

for(const id of ['depot','park','school','hospital','farm','cafe','garage','house','tree','bush','bench','flowers','bus','tanker','shop','camp']){
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
    for(const [x,z] of [[-1.4,-1.8],[1.25,-1.75],[1.35,-1.05]]){box('brown',x,.35,z,.72,.7,.65);box('cream',x,.35,z-.34,.1,.62,.04);box('cream',x,.35,z-.35,.64,.10,.04);}
    // An oversized parcel roof sign is readable from the fixed high camera.
    box('cream',0,3.48,0,1.22,.86,1.04);box('coral',0,3.49,-.54,.18,.72,.06);box('coral',0,3.93,0,.18,.05,1.02);
  }else if(id==='park'){
    cylinder('sand',0,.08,0,2.35,.16,2.35,20);cylinder('white',0,.3,0,1.25,.55,1.25,16);cylinder('blue',0,.59,0,1.05,.05,1.05,16);
    cylinder('cream',0,.9,0,.25,.9,.2,8);cylinder('blue',0,1.28,0,.75,.12,.75,12);ball('blue',0,1.63,0,.25);
    for(let i=0;i<5;i++){const a=i*1.256;ball('pink',Math.sin(a)*1.9,.3,Math.cos(a)*1.9,.28);ball('yellow',Math.sin(a+.15)*1.9,.4,Math.cos(a+.15)*1.9,.25);}
  }else if(id==='school'){
    box('yellow',0,1.4,0,3.8,2.8,2.8);roof('coral',0,2.8,0,4.2,.9,3.2);door(0,-1.46);
    for(const x of [-1.25,1.25]){window(x,1.7,-1.46,.65,.8);window(x,1.7,1.46,.65,.8);}
    box('cream',0,3.6,0,.9,.8,.9);roof('teal',0,4,0,1.2,.65,1.2);cylinder('cream',1.7,1.7,-.6,.065,3.4,.065,6);box('coral',1.93,3.05,-.6,.45,.45,.06);
    // School gate, bell and book badge distinguish it from a house.
    for(const x of [-1.65,1.65]){box('teal',x,.6,-1.9,.27,1.2,.3);ball('yellow',x,1.28,-1.9,.19);}
    box('teal',0,1.4,-1.9,3.55,.28,.32);box('white',0,1.43,-2.09,1.1,.57,.1);
    box('blue',-.23,1.44,-2.16,.42,.38,.07,0,-.12);box('coral',.23,1.44,-2.16,.42,.38,.07,0,.12);
    cylinder('yellow',0,3.9,-.52,.25,.4,.17,10);
  }else if(id==='hospital'){
    box('white',0,1.6,0,3.7,3.2,2.8);box('blue',0,3.22,0,4.05,.26,3.1);door(0,-1.46);
    for(const x of [-1.23,1.23])for(const y of [1.0,2.2])window(x,y,-1.46,.66,.65);
    box('white',0,3.9,0,1.55,1.5,.35);box('coral',0,3.9,-.23,1.13,.36,.16);box('coral',0,3.9,-.23,.36,1.13,.16);
    box('coral',0,3.39,.65,1.18,.12,.36);box('coral',0,3.4,.65,.36,.13,1.18);
  }else if(id==='farm'){
    // The barn supplies its own door: the inherited navy house door occupied
    // exactly the same front/back planes as this brown door and z-fought.
    house(3.2,2.3,2.7,'coral','cream',false);box('white',0,1,-1.44,1.25,1.8,.1);box('brown',0,.95,-1.51,1.05,1.6,.08);
    for(const x of [-1.85,1.85]){cylinder('yellow',x,.4,.5,.35,.8,.35,10);box('cream',x,.4,.5,.75,.1,.1);}
    for(let i=0;i<3;i++){box('brown',1.95,.05,-1+i*.5,.5,.12,.27);ball('leaf',1.95,.28,-1+i*.5,.24,1,.8,.6);}
    // White barn-door braces and a roof rooster-like weather vane.
    // Seat both braces into the panel and stagger their front planes by 1cm:
    // crossing timbers must not contribute duplicate coplanar front triangles.
    box('white',-.26,1,-1.57,.12,1.5,.07,0,-.55);box('white',.26,1,-1.58,.12,1.5,.07,0,.55);
    cylinder('brown',0,3.7,0,.045,.6,.045,6);ball('yellow',0,4.02,0,.21,1.5,1,.5);ball('coral',.26,4.2,0,.1);
  }else if(id==='cafe'){
    house(3.1,2.3,2.7,'pink','teal');for(let i=0;i<7;i++)box(i%2?'white':'coral',-1.35+i*.45,1.86,-1.68,.45,.22,.9);
    for(const x of [-1.0,1.0])window(x,1.08,-1.42,.65,.8);
    cylinder('brown',1.6,.55,-1.45,.08,1.1,.08,8);cylinder('cream',1.6,1.12,-1.45,.52,.12,.52,12);
    // Oversized roof cup, saucer and coffee surface.
    cylinder('cream',0,3.6,0,.68,.13,.68,12);cylinder('white',0,3.98,0,.43,.68,.55,12);cylinder('brown',0,4.33,0,.44,.025,.44,12);
    ball('white',.56,4.04,0,.29,.7,1,.55);ball('pink',.56,4.04,-.08,.15,.65,1,.3);
  }else if(id==='garage'){
    box('teal',0,1.3,0,3.7,2.6,2.7);box('cream',0,2.65,0,4.1,.25,3.1);
    box('navy',0,1.1,-1.39,2.7,2.2,.1);for(let i=0;i<5;i++)box('mint',0,.3+i*.4,-1.46,2.4,.07,.06);
    box('yellow',0,3.03,-.9,1.65,.8,.24);
    // Large raised wrench: diagonal shaft and two open jaws.
    box('navy',-.13,3.02,-1.06,.16,.7,.08,0,-.6);ball('navy',-.32,2.76,-1.06,.15,1,1,.35);
    box('navy',.21,3.29,-1.06,.15,.3,.08,0,-.72);box('navy',.40,3.15,-1.06,.15,.3,.08,0,-.72);
    for(const x of [-1.85,1.85]){cylinder('dark',x,.25,-1.65,.3,.5,.3,12);cylinder('cream',x,.55,-1.65,.17,.15,.17,10);}
    for(const x of [-.7,.7])box('white',x,.025,-1.8,.08,.04,.65);box('white',0,.025,-2.1,1.45,.04,.08);
  }else if(id==='shop'){
    // Open-front market. Genuine Mini Shop shelves and checkout are appended
    // by import_mini_assets.py; the broad awning stays behind the goods.
    box('cream',0,.09,0,4,.18,3.8);box('mint',0,1.15,1.55,3.8,2.15,.3);
    for(const x of [-1.75,1.75]){box('cream',x,1.17,.25,.22,2.15,2.6);box('teal',x,1.3,-1.1,.16,2.55,.16);}
    box('teal',0,2.43,.25,4.05,.25,3.1);
    for(let i=0;i<8;i++)box(i%2?'white':'coral',-1.75+i*.5,2.28,-1.39,.5,.3,.8);
    box('white',0,2.93,.25,1.42,.78,.18);box('coral',0,2.99,.13,.78,.38,.09);
    // Shopping bag badge: basket body and two handle posts.
    box('yellow',0,2.92,.06,.57,.34,.12);box('yellow',-.18,3.17,.06,.08,.24,.12);box('yellow',.18,3.17,.06,.08,.24,.12);box('yellow',0,3.28,.06,.42,.08,.12);
  }else if(id==='camp'){
    cylinder('sand',0,.07,0,2.1,.14,2.1,20);
    // Mini Forest tent, pine trees, flag and stones fill this camp.
    // A warm picnic crate and a log seating area keep its use non-combat.
    box('brown',1.0,.3,-1.2,.65,.6,.65);box('cream',1,.3,-1.54,.12,.5,.04);
    for(const x of [-.4,.4])cylinder('bark',x,.22,-1.35,.18,.44,.18,8);
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
const mini = spawnSync('python3', [fileURLToPath(new URL('./import_mini_assets.py', import.meta.url)), '--compose'], {stdio:'inherit'});
if(mini.status!==0)throw new Error('Mini composition failed. Run python3 scripts/import_mini_assets.py --download first.');
await writeFile(`${OUTPUT}/README.md`, `# Toy town models\n\nRegenerate with \`node scripts/generate_models.mjs\`. The original toy geometry is made offline, with beveled box edges and landmark badges. Original geometry is merged by material. No fonts, Blender or browser-time modelling are required.\n\n\`shop.glb\` and \`camp.glb\` combine original town geometry with genuine Kenney Mini Shop 2.1, Mini Forest 1.0 and Nature Kit 2.1 meshes (CC0-1.0). Their original colormap PNGs are embedded inside each GLB. The other 14 GLBs contain original geometry and embedded material colours, with no external texture files. See \`../kenney-mini/\` for the selected source models, exact licenses and \`sources.json\` provenance. To refresh those source files from Kenney, run \`python3 scripts/import_mini_assets.py --download\` before regenerating.\n\nGLB 2.0, Y-up; foundations sit at Y=0; building fronts face -Z; bus and tanker fronts face +Z. Existing location IDs and the world scale of 1.24 remain compatible. Shop measures 4.05 × 3.32 × 3.80 units (X/Y/Z), camp uses the isolated project base and the open Nature tent assembly recorded in camp-sources.json. Other buildings are approximately 3–4.5 units wide. All delivered resources work offline and require no Draco, Meshopt or additional image requests.\n`);
