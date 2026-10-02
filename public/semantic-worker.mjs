import {pipeline,env} from '@huggingface/transformers';
import {semanticSearch} from './semantic.mjs';
import {normalizeQuery} from './search.mjs';
env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath=new URL('./models/',self.location.href).href;
env.backends.onnx.wasm.wasmPaths=new URL('./vendor/onnx/',self.location.href).href;
env.backends.onnx.wasm.numThreads=1;
let records,vectors,embed,pending,latestId,processing=false;
const embeddings=new Map();
let ready;
function initialize(dataBase){
 if(ready)return;
 ready=(async()=>{
 const [index,binary]=await Promise.all([fetch(new URL('index.json',dataBase),{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Index unavailable');return r.json();}),fetch(new URL('vectors.f32',dataBase),{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Vectors unavailable');return r.arrayBuffer();})]);
 records=index.records;vectors=new Float32Array(binary);if(vectors.length!==records.length*384)throw Error('Index/vector mismatch');
 embed=await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{dtype:'q8',device:'wasm'});
 self.postMessage({type:'ready'});
})();
ready.catch(error=>self.postMessage({type:'error',message:String(error)}));
}
self.onmessage=({data})=>{if(data.type==='init'){initialize(data.dataBase);return;}latestId=data.id;pending=data.type==='cancel'?null:data;if(pending&&!processing)drain();};
async function drain(){
 processing=true;
 try{
  await ready;
  while(pending){
   const data=pending;pending=null;
   const query=normalizeQuery(data.query);
   let embedding=embeddings.get(query);
   if(!embedding){const result=await embed(query,{pooling:'mean',normalize:true});embedding=result.data;embeddings.set(query,embedding);if(embeddings.size>32)embeddings.delete(embeddings.keys().next().value);}
   if(data.id===latestId)self.postMessage({type:'results',id:data.id,query,results:semanticSearch(records,vectors,query,embedding)});
  }
 }catch(error){pending=null;self.postMessage({type:'error',message:String(error)});}
 finally{processing=false;}
}
