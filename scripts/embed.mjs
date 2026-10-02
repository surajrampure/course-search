import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const index=JSON.parse(await readFile('search-index.json','utf8'));
const inputHash=createHash('sha256').update(await readFile('model-manifest.json')).update(JSON.stringify(index.records.map(r=>[r.section,r.concepts,r.text]))).digest('hex');
await mkdir('public/data',{recursive:true});
try{const previous=JSON.parse(await readFile('public/data/embedding-manifest.json','utf8'));const binary=await readFile('public/data/vectors.f32');if(previous.inputHash===inputHash&&binary.length===index.records.length*384*4){await writeFile('public/data/index.json',JSON.stringify(index));console.log('Embeddings unchanged; refreshed source metadata');process.exit(0);}}catch{}
const {pipeline,env}=await import('@huggingface/transformers');
env.allowRemoteModels=false;env.localModelPath=resolve('public/models')+'/';
const embed=await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{dtype:'q8'});
const vectors=new Float32Array(index.records.length*384);
for(let start=0;start<index.records.length;start+=32){
 const batch=index.records.slice(start,start+32).map(r=>`${r.section}. ${r.concepts.join('. ')}. ${r.text}`);
 const result=await embed(batch,{pooling:'mean',normalize:true});vectors.set(result.data,start*384);
 if(start%320===0)console.log(`${start}/${index.records.length}`);
}
await mkdir('public/data',{recursive:true});
await writeFile('public/data/vectors.f32',Buffer.from(vectors.buffer));
await writeFile('public/data/index.json',JSON.stringify(index));
await writeFile('public/data/embedding-manifest.json',JSON.stringify({inputHash,records:index.records.length,dimensions:384}));
console.log('Embedded',index.records.length,'passages');
