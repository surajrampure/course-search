import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseResourceQuery,matchesResource} from '../public/resource-query.mjs';
import {createHybridSearch} from '../public/hybrid.mjs';
import {buildSearch} from '../public/search.mjs';

const record=(id,category,title,section,text='Synthetic discussion of projections.',extra={})=>({id:String(id),category,title,section,text,concepts:[],detail:'Synthetic fixture',url:`https://example.org/${id}#section`,...extra});
const records=[
 record(0,'Homeworks','Homework 4: Projections','Problem 3: Projections'),
 record(1,'Homeworks','Homework 4: Projections','Problem 30: Projections'),
 record(2,'Homeworks','Homework 40: Projections','Problem 3: Projections'),
 record(3,'Lecture PDFs','Lecture 8 · Span','Page 3'),
 record(4,'Lecture PDFs','Lecture 80 · Span','Page 3'),
 record(5,'Labs','Lab 4: Projections','Activity 2: Geometry'),
 record(6,'Notes','4.3. Bases','Definition'),
 record(7,'Notes','4.30. Other','Definition'),
 record(8,'Past exams','Fall 2025 Midterm 1','Problem 3: Geometry'),
 record(9,'Past exams','Winter 2026 Midterm 1','Problem 3: Geometry'),
 record(10,'Past exams','Fall 2025 Midterm 2','Problem 3: Geometry'),
];
const ids=query=>records.filter(r=>matchesResource(r,parseResourceQuery(query))).map(r=>r.id);

test('resource requests retain topic words and match exact numbered locations',()=>{
 for(const q of ['HW 4 problem 3','hw04 p3','hw-4 p3','homework 4 question 3','HW4P3','please show homework 4 problem 3'])assert.deepEqual(ids(q),['0'],q);
 assert.deepEqual(ids('HW 4 problem 3 midterm 1 review'),['0']);
 assert.deepEqual(ids('lecture 8 projection'),['3']);
 assert.equal(parseResourceQuery('lecture 8 projection').query,'projection');
 assert.deepEqual(ids('lec08 page 3'),['3']);
 assert.deepEqual(ids('lab 4 activity 2'),['5']);
 assert.deepEqual(ids('lab 4 problem 2'),['5']);
 assert.deepEqual(ids('note 4.3'),['6']);
 assert.deepEqual(ids('Fall 2025 Midterm 1 problem 3'),['8']);
 assert.deepEqual(ids('fa25-mt1 p3'),['8']);
 assert.deepEqual(ids('fa25mt1p3'),['8']);
 assert.deepEqual(ids('midterm 1 problem 3'),['8','9']);
 assert.deepEqual(ids('practice midterm 1'),[]);
 assert.deepEqual(ids('homework 99 problem 3'),[]);
 assert.equal(parseResourceQuery('closest vector on a line').scoped,false);
 assert.equal(parseResourceQuery('MAE').query,'absolute loss');
 assert.equal(parseResourceQuery('HW 2 absolute').query,'absolute');
 assert.equal(parseResourceQuery('HW 2 absolute',{shorthand:{absolute:'absolute loss'}}).query,'absolute loss');
});

test('hybrid search retains exact matches that embeddings miss and meaning-only matches',()=>{
 const fixture=[record(0,'Notes','Definition','Definition','The Frobenius norm measures matrix size.'),record(1,'Notes','Geometry','Geometry','The nearest point is the perpendicular projection.')];
 const vectors=new Float32Array(2*384);vectors[384]=1;
 const embedding=new Float32Array(384);embedding[0]=1;
 const search=createHybridSearch(fixture,vectors);
 const results=search(parseResourceQuery('Frobenius'),embedding);
 assert(results.some(r=>r.locations.some(l=>l.keyword&&l.text.includes('Frobenius'))));
 assert(results.some(r=>r.locations.some(l=>!l.keyword&&l.text.includes('nearest point'))));
 assert.equal(new Set(results.map(r=>r.id)).size,results.length);
});

test('structured queries never leak matches from other resources, even with perfect similarity',()=>{
 const vectors=new Float32Array(records.length*384);for(let i=0;i<records.length;i++)vectors[i*384]=1;
 const embedding=new Float32Array(384);embedding[0]=1;
 const search=createHybridSearch(records,vectors);
 assert.deepEqual(search(parseResourceQuery('HW 4 problem 3 projection'),embedding).map(r=>r.title),['Homework 4: Projections']);
 assert(search(parseResourceQuery('homework 4 problem 3 projection'),embedding).every(r=>r.locations.every(l=>l.section.startsWith('Problem 3:'))));
 assert.equal(search(parseResourceQuery('HW 99 projection'),embedding).length,0);
 assert.deepEqual(search(parseResourceQuery('HW4P3')).map(r=>r.title),['Homework 4: Projections']);
 assert.deepEqual(search(parseResourceQuery('lab 4 activity 2')).map(r=>r.title),['Lab 4: Projections']);
 assert.equal(search(parseResourceQuery('')).length,0);
});

test('BM25 favors focused passages and does not invent matches from assignment titles',()=>{
 const fixture=[record(0,'Notes','Example','Example','Frobenius norm'),record(1,'Notes','Example','Example','Frobenius norm '+ 'irrelevant filler '.repeat(250))];
 assert.equal(buildSearch(fixture)('Frobenius')[0].locations[0].id,'0');
 const titleOnly=record(2,'Homeworks','Projections homework','Problem 1','Review earlier work.');
 assert.equal(buildSearch([titleOnly])('projection').length,0);
});
