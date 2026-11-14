import test from 'node:test';
import assert from 'node:assert/strict';
import {missionSpeech,feedbackSpeech,VOICE_LINES} from '../src/v2/dialogue.js';

test('unordered picture tasks speak each remaining pairing without imposing a visit order',()=>{
 const state={mission:{steps:[{goodId:'book',quantity:1,placeId:'school'},{goodId:'ball',quantity:1,placeId:'park'}]},completed:[]};
 const speech=missionSpeech(state);
 assert(!speech.includes('first')&&!speech.includes('then'));
 assert(speech.includes('and'));
 assert(speech.indexOf('good-book')<speech.indexOf('place-school'));
 assert(speech.indexOf('good-ball')<speech.indexOf('place-park'));
 const reminder=missionSpeech({...state,completed:[0]});
 assert(!reminder.includes('good-book')&&!reminder.includes('place-school'));
 assert(reminder.includes('good-ball')&&reminder.includes('place-park'));
 assert(speech.every(id=>VOICE_LINES.some(clip=>clip.id===id)));
});

test('recovery speech distinguishes a wrong place, missing cargo and a wrong item',()=>{
 const codes=['wrong-place','missing-cargo','wrong-item','empty-cargo','place-done','next-stop','capacity-full'];
 const lines=codes.map(code=>feedbackSpeech(code)[0]);
 assert.equal(new Set(lines).size,codes.length);
 assert(lines.every(id=>VOICE_LINES.some(clip=>clip.id===id)));
 assert.deepEqual(feedbackSpeech('loaded'),[]);
 assert.deepEqual(feedbackSpeech('unloaded'),[]);
});

test('partial delivery reminder asks only for the remaining unit',()=>{
 const speech=missionSpeech({mission:{steps:[{goodId:'ball',quantity:2,placeId:'park'}]},completed:[],delivered:{0:1}});
 assert(speech.includes('one'));
 assert(!speech.includes('two'));
 assert(speech.includes('good-ball'));
});

test('only the initial brief asks the child to press the remember button',()=>{
 const task={mission:{steps:[{goodId:'ball',quantity:1,placeId:'park'}]},completed:[]};
 assert(missionSpeech({...task,phase:'brief'}).includes('intro'));
 assert(!missionSpeech({...task,phase:'delivery'}).includes('intro'));
});
