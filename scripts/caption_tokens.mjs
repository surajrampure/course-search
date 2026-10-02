import {AutoTokenizer,env} from '@huggingface/transformers';
import {resolve} from 'node:path';
env.allowRemoteModels=false;
env.localModelPath=resolve(import.meta.dirname,'../public/models')+'/';
const tokenizer=await AutoTokenizer.from_pretrained('Xenova/all-MiniLM-L6-v2');
let input='';for await(const chunk of process.stdin)input+=chunk;
console.log(JSON.stringify(JSON.parse(input).map(text=>tokenizer.encode(text,{add_special_tokens:false}).length)));
