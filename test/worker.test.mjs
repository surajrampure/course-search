import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

test('worker skips obsolete queued queries and reuses completed embeddings',async()=>{
 const source=(await readFile(new URL('../public/semantic-worker.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 const messages=[],embedded=[],ranked=[],releases=new Map();
 const embedding=new Float32Array(384);
 const self={location:{href:'http://localhost/worker.js'},postMessage:data=>messages.push(data)};
 runInNewContext(source,{self,URL,Float32Array,Map,env:{backends:{onnx:{wasm:{}}}},
  fetch:async()=>({ok:true,json:async()=>({records:[{}]}),arrayBuffer:async()=>embedding.buffer}),
  pipeline:async()=>query=>new Promise(resolve=>{embedded.push(query);releases.set(query,()=>resolve({data:embedding}));}),
  normalizeQuery:query=>query.toLowerCase(),
  semanticSearch:(_records,_vectors,query)=>{ranked.push(query);return [];}
 });
 const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 self.onmessage({data:{type:'init',dataBase:'http://localhost/data/'}});
 await flush();assert.equal(messages[0].type,'ready');
 self.onmessage({data:{id:1,query:'first'}});await flush();
 self.onmessage({data:{id:2,query:'intermediate'}});
 self.onmessage({data:{id:3,type:'cancel'}});
 self.onmessage({data:{id:4,query:'final'}});
 releases.get('first')();await flush();
 assert.deepEqual(embedded,['first','final']);assert.deepEqual(ranked,[]);
 releases.get('final')();await flush();
 assert.deepEqual(ranked,['final']);assert.equal(messages.at(-1).id,4);
 self.onmessage({data:{id:5,query:'FINAL'}});await flush();
 assert.deepEqual(embedded,['first','final']);assert.equal(messages.at(-1).id,5);
});
