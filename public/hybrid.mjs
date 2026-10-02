import {buildSearch,groupDocuments,mergeResults} from './search.mjs';
import {semanticSearch} from './semantic.mjs';
import {matchesResource} from './resource-query.mjs';

export function createHybridSearch(records,vectors){
 const keyword=buildSearch(records);
 return (request,embedding)=>{
  const filter=record=>matchesResource(record,request);
  // Resource navigation should work even without descriptive topic words.
  if(!request.query)return request.scoped?groupDocuments(records.filter(filter).map(record=>({...record,score:1,requested:true}))):[];
  return mergeResults(keyword(request.query,{filter}),semanticSearch(records,vectors,request.query,embedding,{filter}));
 };
}
