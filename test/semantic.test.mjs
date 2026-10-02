import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pipeline,env} from '@huggingface/transformers';
import {createQueryProcessor} from '../public/search.mjs';
import {semanticSearch} from '../public/semantic.mjs';
let embed;
before(async()=>{
 env.allowRemoteModels=false;env.localModelPath=resolve('public/models')+'/';
 embed=await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{dtype:'q8'});
});
async function corpus(path,shorthand={}){
 const data=JSON.parse(await readFile(resolve(path,'index.json')));
 const bytes=await readFile(resolve(path,'vectors.f32'));
 const vectors=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
 assert.equal(vectors.length,data.records.length*384);
 assert(data.records.every(r=>new Date(r.releaseAt)<=new Date(data.metadata.builtAt)));
 const process=createQueryProcessor(data.records,{shorthand});
 return {data,search:async q=>{q=process(q).normalized;const e=await embed(q,{pooling:'mean',normalize:true});return semanticSearch(data.records,vectors,q,e.data);}};
}
test('the local model retrieves a passage by meaning',async()=>{
 const records=[{id:'fixture',category:'Notes',title:'Projections',section:'Geometry',text:'The perpendicular projection is the point on a line with minimum distance to the original vector.',concepts:['projection'],url:'https://math124.org/fixture/'}];
 const e=await embed(records.map(r=>`${r.section}. ${r.concepts.join('. ')}. ${r.text}`),{pooling:'mean',normalize:true});
 const q=await embed('closest vector on a line',{pooling:'mean',normalize:true});
 assert.equal(semanticSearch(records,e.data,'closest vector on a line',q.data)[0].title,'Projections');
});
test('Math 124 real sources preserve coverage, links, timestamps, and topic matches',{skip:!process.env.MATH124_DATA},async()=>{
 const {data,search}=await corpus(process.env.MATH124_DATA);
 // Keep the initial corpus as a floor while allowing later public releases.
 for(const [kind,minimum] of Object.entries({lectures:10,notes:14,homeworks:4,labs:5,exams:1}))assert(data.metadata.coverage[kind]>=minimum,kind);
 assert(data.metadata.recordings.available>=10);
 assert(data.metadata.recordings.available<=data.metadata.recordings.published);
 for(const r of data.records){
  assert(!r.url.includes('private'));
  if(r.category==='Lecture recordings'){
   assert(r.end>=r.start);
   assert.equal(Number(new URL(r.url).searchParams.get('start')),Math.max(0,r.start-5));
  }
 }
 const cosine=await search('cosine similarity');
 assert(cosine.some(r=>r.category==='Lecture recordings'));
 assert(cosine.some(r=>r.category==='Notes'));
 assert(cosine.some(r=>r.category==='Homeworks'));
 assert(cosine.some(r=>r.category==='Labs'));
 const projection=await search('closest vector on a line');
 assert(projection.some(r=>r.url.includes('/02-07/')));
 assert.deepEqual(await search('perpendicular'),await search('orthogonal'));
 assert.deepEqual(await search('porjection'),await search('projection'));
 const exam=await search('practice midterm 1');assert(exam.length);assert(exam.every(r=>r.category==='Past exams'&&r.title==='Practice Midterm 1'));
 assert.equal(new Set(data.records.filter(r=>r.title==='Practice Midterm 1').map(r=>r.url)).size,7);
 assert((await search('projection')).some(r=>r.title==='Practice Midterm 1'));
 const hw=await search('hw 4');assert(hw.length);assert(hw.every(r=>r.title.startsWith('Homework 4:')));
 assert.equal((await search('purple flying giraffes')).length,0);
});
test('EECS 245 real sources retain loss aliases and lecture moments',{skip:!process.env.EECS245_DATA},async()=>{
 const {search}=await corpus(process.env.EECS245_DATA,{absolute:'absolute loss'});
 const found=await search('absolute loss');
 assert(found.some(r=>r.url.includes('/absolute-loss/')));
 const lecture=found.find(r=>r.category==='Lecture recordings'&&r.url.endsWith('/ucCtbs'));
 assert(lecture);assert(lecture.locations.some(l=>l.start<=1630.2&&l.end>=1630.2&&/absolute loss/i.test(l.text)));
 for(const q of ['absolute','MAE','absolte loss'])assert.deepEqual(await search(q),found);
 assert((await search('closest vector on a line')).some(r=>r.url.includes('/projecting-onto-a-single-vector/')));
 assert.equal((await search('purple flying giraffes')).length,0);
});
