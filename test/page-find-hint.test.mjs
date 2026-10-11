import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const apps=[new URL('../public/app.js',import.meta.url)];
if(process.env.TEST_EECS_APP)apps.push(new URL('file://'+process.env.TEST_EECS_APP));
for(const app of apps)test('embedded hint and native Find follow OS: '+app.pathname,async()=>{
 const source=await readFile(app,'utf8');
 const code=source.slice(source.indexOf("if(document.body.classList.contains('embedded')){"),source.indexOf('let allResults='));
 for(const [platform,label,modifier] of [['MacIntel','⌘F','metaKey'],['Win32','Ctrl+F','ctrlKey'],['Linux x86_64','Ctrl+F','ctrlKey']]){
  const {document,window}=parseHTML('<html><body class="embedded"><form id="search-form"><input id="search"></form></body></html>');
  const messages=[],input=document.querySelector('#search');
  vm.runInNewContext(code,{document,window,input,navigator:{platform},location:{search:'?embedded=1&page-find=1',origin:'https://eecs245.org'},course:{parentOrigin:'https://math124.org'},parent:{postMessage:m=>messages.push(m)},URLSearchParams});
  assert.equal(document.querySelector('.page-find-hint').textContent,`Press ${label} again to find on this page. Esc closes Smart Search.`);
  const event=new window.Event('keydown',{cancelable:true});Object.assign(event,{key:'f',[modifier]:true});document.dispatchEvent(event);
  assert.equal(event.defaultPrevented,false);assert.match(messages.at(-1).type,/-page-find$/);
  const esc=new window.Event('keydown',{cancelable:true});esc.key='Escape';document.dispatchEvent(esc);
  assert.equal(esc.defaultPrevented,true);assert.match(messages.at(-1).type,/-close$/);
 }
});
