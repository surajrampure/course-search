import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {buildSearch} from '../public/search.mjs';

test('curated video titles appear as direct links in the enabled category and can be filtered out', async () => {
 const {window,document}=parseHTML(await readFile(new URL('../public/index.html',import.meta.url),'utf8'));
 const url='https://www.youtube.com/watch?v=ELVbshKqEbs';
 const title='Why Do Two Vectors (Usually) Span a Plane?';
 const records=[{id:'video',category:'Other videos',title,section:'Watch video',text:title,url,concepts:[],detail:'Video title'}];
 const config={courseName:'Math 124',websiteURL:'https://math124.org',categories:['Notes','Other videos']};
 let worker;
 Object.assign(globalThis,{window,document,parent:{postMessage(){}},location:{href:'http://localhost/index.html',search:'',origin:'http://localhost'},
  Worker:class {constructor(){worker=this;}postMessage(message){if(message.query)this.request=message;}},
  fetch:async path=>({ok:true,json:async()=>String(path).includes('config.json')?config:{records}})});
 await import('../public/app.js');
 assert.deepEqual([...document.querySelectorAll('.filter')].map(button=>button.dataset.category),config.categories);
 document.querySelector('#search').value='span plane';
 document.querySelector('#search-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
 worker.onmessage({data:{type:'ready'}});
 const respond=()=>worker.onmessage({data:{type:'results',...worker.request,results:buildSearch(records)(worker.request.query)}});
 respond();
 const group=document.querySelector('.group[data-category="Other videos"]');
 assert.equal(group.querySelector('h2').textContent,'Other videos');
 assert.equal(group.querySelector('h3 a').textContent,title);
 assert.equal(group.querySelector('h3 a').getAttribute('href'),url);
 const filter=document.querySelector('button[data-category="Other videos"]');
 filter.click();
 assert.equal(filter.getAttribute('aria-pressed'),'false');
 assert.equal(document.querySelector('.group[data-category="Other videos"]'),null);
 filter.click();
 assert.equal(document.querySelector('.group[data-category="Other videos"] h3 a').getAttribute('href'),url);
});
