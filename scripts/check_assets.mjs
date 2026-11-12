import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { RESOURCE_MANIFEST as manifest } from '../src/v2/resource-manifest.js';
import { VOICE_LINES } from '../src/v2/dialogue.js';

const root=new URL('../public/',import.meta.url),paths=new Set([...manifest.models,...manifest.audio].map(x=>x.path));
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
for(const license of ['licenses/babylon-Apache-2.0.txt','models/kenney-car/License.txt','models/kenney-suburban/License.txt','models/kenney-nature/License.txt','audio/kenney-interface/License.txt'])assert((await stat(new URL(license,root))).size>0);
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
console.log(JSON.stringify({models:manifest.models.length,audio:manifest.audio.length,textures:manifest.textures.length,files:paths.size,bytes,voiceLines:VOICE_LINES.length}));
