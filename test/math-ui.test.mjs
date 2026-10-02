import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {buildSearch} from '../public/search.mjs';
test('Math 124 labels worksheets and Exams without changing the shared schema',async()=>{
 const {window,document}=parseHTML(await readFile(new URL('../public/index.html',import.meta.url),'utf8'));
 const records=[{id:'worksheet',category:'Lecture PDFs',title:'Lecture 6: Projection',section:'Page 1',text:'Projection worksheet',url:'https://math124.org/worksheet.pdf#page=1',detail:'Published course material'},
 {id:'exam',category:'Past exams',title:'Practice Midterm 1',section:'Problem 5',text:'Projection exam problem',url:'https://math124.org/resources/exams/practice-mt1/#problem-5',detail:'Published course material'}];
 const config={courseName:'Math 124',websiteURL:'https://math124.org',categories:['Lectures','Notes','Homeworks','Labs','Past exams'],categoryLabels:{'Past exams':'Exams'},lecturePDFLabel:'Open lecture worksheet',lecturePDFPageLabel:'worksheet page',lecturePDFCategoryLabel:'Lecture worksheets'};
 Object.assign(globalThis,{window,document,parent:{postMessage(){}},location:{href:'http://localhost/index.html',search:'',origin:'http://localhost'},Worker:class {constructor(){globalThis.testWorker=this;}postMessage(message){if(message.query)this.request=message;}},fetch:async url=>({ok:true,json:async()=>String(url).includes('config.json')?config:{records}})});
 await import('../public/app.js');
 assert.equal(document.querySelector('[data-category="Past exams"]').textContent,'Exams');
 assert.match(document.querySelector('#index-coverage').textContent,/Lecture worksheets: 6/);
 const input=document.querySelector('#search');input.value='projection';
 document.querySelector('#search-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
 globalThis.testWorker.onmessage({data:{type:'ready'}});
 globalThis.testWorker.onmessage({data:{type:'results',id:globalThis.testWorker.request.id,query:'projection',results:buildSearch(records)('projection')}});
 assert.equal(document.querySelector('[data-category="Past exams"].group h2').textContent,'Exams');
 assert.match(document.querySelector('.open-recording').textContent,/Open lecture worksheet/);
 assert.match(document.querySelector('.recording-prompt').textContent,/1 worksheet page/);
 assert.equal(document.querySelector('.lecture-source .locations').getAttribute('aria-label'),'Matching worksheet pages');
});
