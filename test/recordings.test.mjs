import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSearch,groupDocuments,sortDocuments,filterCategories,recordingCoverage,categories} from '../public/search.mjs';
import {semanticSearch} from '../public/semantic.mjs';
// Synthetic fixtures only: these never enter the published corpus.
const hit=(id,start,end,score=1,key='test')=>({id:String(id),category:'Lecture recordings',title:'Lecture 2 · Loss',section:'Moment',text:'Minimize absolute loss using the median.',url:`https://leccap.engin.umich.edu/leccap/player/r/${key}?start=${start}`,start,end,score,detail:'Leccap captions',concepts:[],lectureDate:'2026-09-03'});
test('offsets share one lecture card, nearby moments merge, distant hits remain',()=>{
 const result=groupDocuments([hit(2,45,85,9),hit(1,10,55,4),hit(3,90,110,2),hit(4,400,430),hit(5,10,55,1,'other')]);
 assert.equal(result.length,2);assert.equal(result[0].locations.length,2);
 assert.equal(result[0].url,'https://leccap.engin.umich.edu/leccap/player/r/test');
 assert.equal(result[0].locations[0].section,'0:10–1:50');
 assert.equal(result[0].locations[0].url,result[0].url+'?start=5');
 assert.equal(result[0].locations[0].score,9);
});
test('duplicate offsets deduplicate and pre-roll clamps to zero',()=>{
 const result=groupDocuments([hit(1,2,40,9),hit(2,2,40,2)]);
 assert.equal(result[0].locations.length,1);assert(result[0].locations[0].url.endsWith('?start=0'));
});
test('merged moment keeps the cosine and text of the same best ranked passage',()=>{
 const first={...hit(1,10,55,.5),cosine:.5,text:'First excerpt'};
 const best={...hit(2,45,85,.9),cosine:.6,exact:true,text:'Best ranked excerpt'};
 const highestCosine={...hit(3,90,110,.7),cosine:.7,text:'Different excerpt'};
 const [moment]=groupDocuments([best,highestCosine,first])[0].locations;
 assert.equal(moment.start,10);assert.equal(moment.end,110);
 assert.equal(moment.text,best.text);assert.equal(moment.cosine,best.cosine);
 assert.equal(moment.score,best.score);assert.equal(moment.exact,true);
});
test('merging cannot chain an entire lecture into one moment',()=>{
 const result=groupDocuments(Array.from({length:20},(_,i)=>hit(i,i*30,i*30+60)));
 assert(result[0].locations.length>1);assert(result[0].locations.every(l=>l.end-l.start<=120));
});
test('keyword and semantic paths both group and filter recordings',()=>{
 const records=[hit(1,10,50),hit(2,40,80)];
 const keywords=buildSearch(records)('absolute loss');
 const vectors=new Float32Array(2*384);vectors[0]=vectors[384]=1;
 const embedding=new Float32Array(384);embedding[0]=1;
 const semantic=semanticSearch(records,vectors,'absolute loss',embedding);
 assert.equal(keywords.length,1);assert.equal(semantic.length,1);
 assert.deepEqual(keywords[0].locations.map(l=>l.url),semantic[0].locations.map(l=>l.url));
 assert(categories.includes('Lecture recordings'));
 assert.equal(filterCategories(semantic,new Set(['Notes'])).length,0);
 assert.equal(filterCategories(keywords,new Set(['Lecture recordings'])).length,1);
});
test('semantic-only transcript retrieval without keyword overlap',()=>{
 const r=hit(1,10,50);const v=new Float32Array(384);v[0]=1;
 assert.equal(buildSearch([r])('prediction mistakes').length,0);
 assert.equal(semanticSearch([r],v,'prediction mistakes',v).length,1);
});
test('recordings sort by lecture date and coverage never implies missing captions exist',()=>{
 const first={...hit(1,0,30),title:'Lecture 2',lectureDate:'2026-09-03'};
 const last={...hit(2,0,30),title:'Lecture 10',lectureDate:'2026-10-01'};
 assert.equal(sortDocuments([last,first],'chronological')[0].title,'Lecture 2');
 assert.match(recordingCoverage({recordings:{published:2,available:1,recordings:[{title:'Lecture 2 · Loss',status:'missing'}]}}),/1 of 2.*Missing or pending: Lecture 2/);
});
