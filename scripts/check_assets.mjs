import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { RESOURCE_MANIFEST as manifest } from '../src/v2/resource-manifest.js';
import { VOICE_LINES } from '../src/v2/dialogue.js';
import { MODEL_CATALOG } from '../src/v2/model-catalog.js';
import { PLACES, VEHICLES } from '../src/v2/catalog.js';

const root=new URL('../public/',import.meta.url),paths=new Set([...manifest.models,...manifest.audio,...manifest.icons].map(x=>x.path));
assert.deepEqual([...MODEL_CATALOG.map(x=>x.id)].sort(),[...manifest.models.map(x=>x.id)].sort(),'Viewer must describe every preloaded model exactly once');
for(const model of MODEL_CATALOG){
  assert(['kenney','original','combined'].includes(model.sourceType));
  assert(['vehicle','place','decoration'].includes(model.category));
  assert(model.sourceLabel&&model.details&&model.packLabel);
  if(model.sourceType!=='original')assert(model.sourceUrl.startsWith('https://kenney.nl/assets/'));
  const item=[...PLACES,...VEHICLES].find(x=>x.id===model.id);
  if(item)assert.equal(model.name,item.name,`Viewer name drift: ${model.id}`);
}
for(const texture of manifest.textures)paths.add(texture);
let bytes=0;
for(const file of paths){
  const target=new URL(file,root);const data=await readFile(target);assert(data.length>0,`Empty asset: ${file}`);bytes+=data.length;
  if(file.endsWith('.glb')){
    assert.equal(data.readUInt32LE(0),0x46546c67,file);assert.equal(data.readUInt32LE(8),data.length,file);
    const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
    for(const image of json.images||[])if(image.uri&&!image.uri.startsWith('data:')){
      const resource=path.posix.join(path.posix.dirname(file),image.uri);
      assert(paths.has(resource),`External model texture missing from preload manifest: ${resource}`);
    }
    assert(!json.extensionsRequired?.some(x=>/draco|meshopt|basisu/i.test(x)),`Unlisted decoder required by ${file}`);
  }
}
const voiceMap=JSON.parse(await readFile(new URL('audio/voice-v2/manifest.json',root),'utf8'));
for(const line of VOICE_LINES)assert.equal(voiceMap[line.text],line.id+'.mp3',`Stale generated voice: ${line.id}`);
const iconSources=JSON.parse(await readFile(new URL('icons/models/sources.json',root),'utf8'));
for(const icon of manifest.icons){
  const model=manifest.models.find(x=>x.id===icon.id);
  const hash=createHash('sha256').update(await readFile(new URL(model.path,root))).digest('hex');
  assert.equal(iconSources[icon.id]?.model,model.path,`Wrong icon source: ${icon.id}`);
  assert.equal(iconSources[icon.id]?.sha256,hash,`Rebake icon after model change: ${icon.id}`);
  const data=await readFile(new URL(icon.path,root));
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(data.readUInt32BE(16),256);assert.equal(data.readUInt32BE(20),256);
}
for(const license of ['licenses/babylon-Apache-2.0.txt','models/kenney-car/License.txt','models/kenney-suburban/License.txt','models/kenney-nature/License.txt','models/kenney-mini/mini-shop-License.txt','models/kenney-mini/mini-forest-License.txt','audio/kenney-interface/License.txt'])assert((await stat(new URL(license,root))).size>0);
// Imported and adapted models retain their source licenses and exact shipped
// hashes. The full external library is not needed to validate a clean checkout.
for(const [folder,metadata] of [['kenney-streets','licenses/sources.json'],['kenney-landmarks','sources.json']]){
  const base=new URL(`models/${folder}/`,root);
  const records=JSON.parse(await readFile(new URL(metadata,base),'utf8'));
  const expected=manifest.models.filter(x=>x.path.startsWith(`models/${folder}/`));
  assert.deepEqual(records.map(x=>x.file).sort(),expected.map(x=>path.posix.basename(x.path)).sort(),`Source records must cover ${folder}`);
  for(const record of records){
    const data=await readFile(new URL(record.file,base));
    assert.equal(createHash('sha256').update(data).digest('hex'),record.distributedSha256,`Stale provenance: ${record.file}`);
    const licenses=record.sourceLayers?record.sourceLayers.map(x=>x.license):[record.license];
    for(const file of licenses){
      const text=await readFile(new URL(file,base),'utf8');
      assert(/CC0|Creative Commons Zero/.test(text),`Missing CC0 license: ${folder}/${file}`);
    }
  }
}
// Home-screen files must also work when the game is served below /3D-Game/.
const webapp=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
const appBase='https://example.github.io/3D-Game/';
assert.equal(webapp.display,'standalone');
for(const key of ['id','start_url','scope'])assert.equal(new URL(webapp[key],appBase+'manifest.webmanifest').href,appBase);
for(const icon of [...webapp.icons,{src:'./icons/apple-touch-icon.png',sizes:'180x180'}]){
  assert(new URL(icon.src,appBase).href.startsWith(appBase));
  const data=await readFile(new URL(icon.src,root));
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`,icon.sizes);
}
console.log(JSON.stringify({models:manifest.models.length,icons:manifest.icons.length,audio:manifest.audio.length,textures:manifest.textures.length,files:paths.size,bytes,voiceLines:VOICE_LINES.length}));
