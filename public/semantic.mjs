import {groupDocuments,tokens,normalizeQuery} from './search.mjs';
export function semanticSearch(records,vectors,query,embedding){
 query=normalizeQuery(query);
 const terms=[...new Set(tokens(query))];if(!terms.length)return [];
 const q=query.toLowerCase();
 const concepts=[];
 if(/dot product|inner product|scalar product|\\cdot|[uv]\s*[·•]\s*[uv]|cosine similarity/.test(q))concepts.push('dot product','inner product');
 if(/closest.*(?:line|plane|vector)|nearest.*(?:line|plane|vector)|distance.*(?:line|plane)|projection/.test(q))concepts.push('projection');
 const hits=[];
 const requested = /\b(homework|hw|lab|lecture|lec|note|practice midterm)\s*0*(\d+(?:\.\d+)?)\b/i.exec(q);
 for(let i=0;i<records.length;i++){
  const r=records[i];let cosine=0;for(let j=0;j<384;j++)cosine+=embedding[j]*vectors[i*384+j];
  if(requested){
   const names={homework:'Homework',hw:'Homework',lab:'Lab',lecture:'Lecture',lec:'Lecture',note:'','practice midterm':'Practice Midterm'};
   const prefix=names[requested[1].toLowerCase()];
   const pattern=prefix?new RegExp('^'+prefix+' '+Number(requested[2])+'(?:\\D|$)'):new RegExp('^'+requested[2].replaceAll('.','\\.')+'(?:\\D|$)');
   if(!pattern.test(r.title))continue;
  }
  const words=new Set(tokens(`${r.section} ${r.text} ${(r.concepts||[]).join(' ')}`));
  const exact=terms.every(t=>words.has(t));
  const formula=concepts.some(c=>(r.concepts||[]).some(tag=>tag.includes(c)));
  // Absolute + relative semantic thresholds avoid arbitrary unrelated results.
  if(cosine>=.39||exact||formula||requested)hits.push({...r,score:cosine+(exact?.16:0)+(formula?.2:0),cosine,exact,formula,requested:Boolean(requested)});
 }
 hits.sort((a,b)=>b.score-a.score);
 const floor=Math.max(.39,(hits[0]?.cosine||0)*.70);
 return groupDocuments(hits.filter(r=>r.exact||r.formula||r.requested||r.cosine>=floor));
}
