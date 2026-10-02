// Split inputs with the actual pinned tokenizer before generating embeddings.
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {AutoTokenizer, env} from '@huggingface/transformers';
env.allowRemoteModels = false;
env.localModelPath = resolve('public/models') + '/';
const tokenizer = await AutoTokenizer.from_pretrained('Xenova/all-MiniLM-L6-v2');
const path = process.argv[2] || 'search-index.json';
const index = JSON.parse(await readFile(path));
const prepared = [];
const input = r => `${r.section}. ${(r.concepts || []).join('. ')}. ${r.text}`;
function split(record) {
  const size = tokenizer(input(record), {truncation:false}).input_ids.data.length;
  if (size <= 256) { prepared.push({...record, id:String(prepared.length)}); return; }
  const words = record.text.split(/\s+/);
  if (words.length < 2) throw Error('A source passage cannot fit the model token budget');
  const middle = Math.floor(words.length / 2);
  split({...record, text:words.slice(0, middle + Math.min(10, Math.floor(middle/4))).join(' ')});
  split({...record, text:words.slice(middle).join(' ')});
}
index.records.forEach(split);
index.metadata ||= {};
index.metadata.sourcePassages ||= index.metadata.records || index.records.length;
index.metadata.records = prepared.length;
if (index.metadata.categories) index.metadata.categories=Object.fromEntries([...new Set(prepared.map(r=>r.category))].map(c=>[c,prepared.filter(r=>r.category===c).length]));
index.records = prepared;
await writeFile(path, JSON.stringify(index));
console.log(`Prepared ${prepared.length} passages without tokenizer truncation`);
