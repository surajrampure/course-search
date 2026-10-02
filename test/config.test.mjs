import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCourseConfig,validateConfigURL} from '../public/course-config.mjs';
import {createQueryProcessor} from '../public/query.mjs';
test('course configuration accepts course sites and checks data origins',async()=>{
 const page='https://surajrampure.github.io/course-search/v1/index.html?config=https://math124.org/assets/course-search/config.json';
 const fetcher=async()=>({ok:true,json:async()=>({courseName:'Math 124',categories:['Lectures','Notes','Homeworks','Labs'],dataBase:'./data/'})});
 const config=await loadCourseConfig(page,fetcher);
 assert.equal(config.dataBase,'https://math124.org/assets/course-search/data/');
 assert.equal(config.parentOrigin,'https://math124.org');
 assert.throws(()=>validateConfigURL('https://untrusted.example/config.json',page));
 await assert.rejects(loadCourseConfig(page,async()=>({ok:true,json:async()=>({courseName:'Math 124',categories:['Notes'],dataBase:'https://untrusted.example/'})})));
});
test('course-specific shorthand does not affect other courses',()=>{
 assert.equal(createQueryProcessor([])('absolute').normalized,'absolute');
 assert.equal(createQueryProcessor([],{shorthand:{absolute:'absolute loss'}})('absolute').normalized,'absolute loss');
 assert.equal(createQueryProcessor([],{shorthand:{absolute:'absolute loss'}})('absolute value').normalized,'absolute value');
});
