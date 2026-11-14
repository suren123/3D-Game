import test from 'node:test';
import assert from 'node:assert/strict';
import {computeUILayout} from '../src/v2/ui.js';

test('landscape operation panel reaches the right edge and leaves the map a majority',()=>{
 for(const [width,height] of [[1180,820],[1366,1024],[1920,1080],[844,390],[667,375],[844,340],[776,340],[568,320]]){
  const l=computeUILayout(width,height);
  assert.equal(l.worldRect.x,0);assert.equal(l.worldRect.y,0);
  assert.equal(l.worldRect.height,height);
  assert.equal(l.worldRect.width,l.panelRect.x);
  assert.equal(l.panelRect.x+l.panelRect.width,width);
  assert(l.worldRect.width>width/2,`${width}x${height}: town remains the larger area`);
 }
});

test('short landscape keeps real touch sizes and room for shelf, cargo and footer',()=>{
 for(const [width,height] of [[844,390],[667,375],[844,340],[776,340],[568,320]]){
  const l=computeUILayout(width,height);
  assert(l.compact);assert.equal(l.scale,1);
  assert(l.slotSize>=44);assert(l.gap>=6);assert(l.choiceHeight>=44);
  assert(l.slotSize*3+l.gap*2<=l.innerWidth);
  assert(l.cargoY>=l.choiceHeight*2+6);
  assert(l.cargoY+l.slotSize*2+l.gap+6<=l.footerY);
  assert(l.footerY+44<=l.contentHeight);
 }
 const pad=computeUILayout(1180,820);assert(!pad.compact);assert.equal(pad.slotSize,72);
});
