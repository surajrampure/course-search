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
