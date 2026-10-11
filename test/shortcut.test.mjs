import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const adapters=[new URL('../public/smart-search.js',import.meta.url)];
if(process.env.TEST_EECS_ADAPTER)adapters.push(new URL('file://'+process.env.TEST_EECS_ADAPTER));
for(const adapter of adapters){
 // The second fixture is the existing EECS implementation, before shared migration.
 test('shortcut labels follow platform for '+adapter.pathname,async()=>{
  const code=await readFile(adapter,'utf8');
  for(const [navigator,label,key] of [
   [{userAgentData:{platform:'macOS'},platform:'Win32'},'⌘ F','Meta+F'],
   [{platform:'MacIntel'},'⌘ F','Meta+F'],
   [{userAgentData:{platform:'Windows'},platform:'MacIntel'},'Ctrl F','Control+F'],
   [{platform:'Win32'},'Ctrl F','Control+F'],
   [{platform:'Linux x86_64'},'Ctrl F','Control+F']
  ]){
   const {document,window}=parseHTML('<html><body><div id="main-header"><button class="smart-search-trigger" data-search-url="https://rampure.org/course-search/v1/"><kbd>Ctrl F</kbd></button></div></body></html>');
   window.matchMedia=()=>({matches:false,addEventListener(){}});
   vm.runInNewContext(code,{document,window,navigator,location:{href:'https://math124.org',origin:'https://math124.org'},URL,MutationObserver:class{observe(){}},getComputedStyle:()=>({fontFamily:'sans-serif'})});
   const trigger=document.querySelector('.smart-search-trigger');
   assert.equal(trigger.querySelector('kbd').textContent,label);
   assert.equal(trigger.getAttribute('aria-keyshortcuts'),key);
  }
 });
}

test('page-find is opt-in and the second shortcut preserves native Find',async()=>{
 const code=await readFile(adapters[0],'utf8');
 for(const enabled of [false,true]){
  const {document,window}=parseHTML(`<html><body><div id="main-header"><button class="smart-search-trigger" data-page-find="${enabled}" data-search-url="https://rampure.org/course-search/v1/?embedded=1"><kbd></kbd></button></div></body></html>`);
  window.matchMedia=()=>({matches:false,addEventListener(){}});
  vm.runInNewContext(code,{document,window,navigator:{platform:'MacIntel'},location:{href:'https://math124.org',origin:'https://math124.org'},URL,MutationObserver:class{observe(){}},getComputedStyle:()=>({fontFamily:'sans-serif'})});
  const modal=document.querySelector('dialog'),frame=document.querySelector('iframe');
  modal.showModal=()=>{modal.open=true;};modal.close=()=>{modal.open=false;modal.dispatchEvent(new window.Event('close'));};
  const key=(props={})=>{const e=new window.Event('keydown',{cancelable:true});Object.assign(e,{key:'f',metaKey:true,...props});document.dispatchEvent(e);return e;};
  assert.equal(key().defaultPrevented,true);assert.equal(modal.open,true);
  assert.equal(new URL(frame.src).searchParams.get('page-find'),enabled?'1':null);
  assert.equal(key({repeat:true}).defaultPrevented,true);assert.equal(modal.open,true);
  assert.equal(key().defaultPrevented,!enabled);assert.equal(modal.open,!enabled);
  document.querySelector('.smart-search-trigger').click();assert.equal(modal.open,true);
  const message=(origin,source)=>{const e=new window.Event('message');Object.assign(e,{origin,source,data:{type:'course-search-page-find'}});window.dispatchEvent(e);};
  message('https://untrusted.example',frame.contentWindow);assert.equal(modal.open,true);
  message('https://rampure.org',{});assert.equal(modal.open,true);
  message('https://rampure.org',frame.contentWindow);assert.equal(modal.open,!enabled);
  document.querySelector('.smart-search-trigger').click();document.querySelector('.smart-search-close').click();assert.equal(modal.open,false);
  assert.equal(document.body.classList.contains('smart-search-open'),false);
 }
});
