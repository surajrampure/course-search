import {tokens,normalizeQuery,normalizeText,createQueryProcessor} from './query.mjs';
export {tokens,normalizeQuery,createQueryProcessor};
export const categories=['Lecture recordings','Lecture PDFs','Notes','Homeworks','Labs','Past exams'];
export const resultCategories=['Lectures','Notes','Homeworks','Labs','Past exams'];
// Combine only matching, enabled lecture sources. Search scores stay unchanged.
export function combineLectureResults(documents){
 const lectures=new Map(),other=[];
 for(const document of documents){
  if(!['Lecture recordings','Lecture PDFs'].includes(document.category)){other.push(document);continue;}
  const key=`lecture:${document.title.trim().toLowerCase()}`;
  if(!lectures.has(key))lectures.set(key,{id:key,category:'Lectures',title:document.title,score:document.score,recording:null,pdf:null});
  const lecture=lectures.get(key);
  lecture[document.category==='Lecture recordings'?'recording':'pdf']=document;
  lecture.score=Math.max(lecture.score,document.score);
 }
 return [...lectures.values()].map(lecture=>({...lecture,url:(lecture.recording||lecture.pdf).url,locations:[...(lecture.recording?.locations||[]),...(lecture.pdf?.locations||[])]})).concat(other);
}
export function buildSearch(records){
  const processQuery=createQueryProcessor(records);
  const prepared=records.map(r=>({...r,words:tokens(`${r.section} ${r.text} ${(r.concepts||[]).join(' ')}`),heading:tokens(`${r.title} ${r.section}`)}));
  const postings=new Map();
  prepared.forEach((r,i)=>{for(const word of new Set(r.words)){if(!postings.has(word))postings.set(word,new Set());postings.get(word).add(i);}});
  return (query,options)=>{
    const normalized=processQuery(query,options).normalized;
    const terms=[...new Set(tokens(normalized))];if(!terms.length)return [];
    const matches=terms.map(term=>{
      const hits=new Set();for(const [word,ids] of postings)if(word===term||(term.length>=3&&word.startsWith(term)))for(const id of ids)hits.add(id);
      return hits;
    });
    const ids=new Set(matches.flatMap(hit=>[...hit]));
    const ranked=[...ids].map(id=>{
      const r=prepared[id];
      const matched=matches.filter(hit=>hit.has(id)).length;
      const exact=matched===terms.length;
      // Allow a substantial partial match for longer questions, while keeping
      // short topics precise and avoiding one-word hits for unrelated queries.
      if(!exact&&(terms.length<3||matched<Math.ceil(terms.length*.7)))return null;
      const score=terms.reduce((sum,term,index)=>{
        if(!matches[index].has(id))return sum;
        const rarity=Math.log(1+(prepared.length-matches[index].size+.5)/(matches[index].size+.5));
        const frequency=r.words.filter(word=>word===term||(term.length>=3&&word.startsWith(term))).length;
        const heading=r.heading.some(word=>word===term||(term.length>=3&&word.startsWith(term)));
        return sum+rarity*(frequency/(frequency+1.2)+Number(heading)*2);
      },0)+Number(exact)*4+Number(normalizeText(`${r.section} ${r.text}`).includes(normalized))*2;
      return {...r,score,exact,keyword:true};
    }).filter(Boolean).sort((a,b)=>b.score-a.score||Number(a.id)-Number(b.id));
    return groupDocuments(ranked);
  };
}
export function excerpt(text,query){
  const terms=tokens(query);const words=[...text.matchAll(/[a-z0-9]+/gi)];
  const hit=words.find(m=>terms.some(t=>tokens(m[0])[0]===t||m[0].toLowerCase().startsWith(t)));
  const start=hit?Math.max(0,hit.index-90):0;
  const boundary=start>0?text.indexOf(' ',start):0;
  const offset=boundary>=0?boundary:start;
  let s=text.slice(offset,offset+245).trim();if(offset>0)s='… '+s;if(offset+245<text.length)s+=' …';return s;
}

export function groupDocuments(ranked) {
  const documents=new Map();
  for(const hit of ranked){
    const url=hit.category==='Lecture recordings'?recordingUrl(hit):hit.url.split('#')[0];
    const key=`${hit.category}:${url}`;
    if(!documents.has(key)) documents.set(key,{id:key,category:hit.category,title:hit.title,url,semester:hit.semester,detail:hit.detail,lectureDate:hit.lectureDate,score:hit.score,locations:[]});
    const document=documents.get(key);
    document.score=Math.max(document.score,hit.score);
    // Several index chunks can refer to one section. Retain its best passage.
    if(!document.locations.some(location=>location.url===hit.url)) document.locations.push(hit);
  }
  return [...documents.values()].map(document=>({...document,locations:document.category==='Lecture recordings'?mergeMoments(document.locations):document.locations.sort((a,b)=>Number(a.id)-Number(b.id))}));
}

// Within a category, chronological means course order for notes/assignments,
// and oldest term first for past exams, followed by MT1, MT2, then the final.
export function sortDocuments(documents,order='relevance'){
 const natural=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
 const key=r=>{
  if(r.category==='Lecture recordings')return Date.parse(r.lectureDate)||0;
  if(r.category==='Past exams'){
   const year=Number(r.title.match(/20\d{2}/)?.[0]||0);
   const term=/Winter/i.test(r.title)?1:/Spring/i.test(r.title)?2:3;
   const assessment=/Midterm 1/i.test(r.title)?1:/Midterm 2/i.test(r.title)?2:3;
   return year*100+term*10+assessment;
  }
  return /^Appendix/i.test(r.title)?1000:0;
 };
 return [...documents].sort((a,b)=>order==='chronological'?key(a)-key(b)||natural.compare(a.title,b.title):b.score-a.score||natural.compare(a.title,b.title));
}

// Only the playback offset is discarded; distinct recordings stay distinct.
export function recordingUrl(hit){
 const url=new URL(hit.recordingUrl||hit.url);url.searchParams.delete('start');url.hash='';return url.href;
}
export function timestamp(seconds){
 const t=Math.floor(seconds);return t>=3600?`${Math.floor(t/3600)}:${String(Math.floor(t/60)%60).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`:`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
}
export function mergeMoments(hits){
 const moments=[];
 for(const hit of [...hits].sort((a,b)=>a.start-b.start||b.score-a.score)){
  const last=moments.at(-1);
  // Bound merging so a run of broad matches doesn't become one whole lecture.
  if(last&&hit.start<=last.end+10&&Math.max(last.end,hit.end)-last.start<=120){
   last.end=Math.max(last.end,hit.end);
   if(hit.score>last.score)Object.assign(last,hit,{start:last.start,end:last.end});
  }else moments.push({...hit});
 }
 return moments.map(moment=>{
  const url=new URL(recordingUrl(moment));url.searchParams.set('start',String(Math.max(0,Math.floor(moment.start)-5)));
  return {...moment,url:url.href,section:`${timestamp(moment.start)}–${timestamp(moment.end)}`};
 });
}
export const filterCategories=(results,selected)=>results.filter(r=>selected.has(r.category)||(selected.has('Lectures')&&['Lecture recordings','Lecture PDFs'].includes(r.category)));
export function recordingCoverage(metadata){
 const coverage=metadata?.recordings;
 if(!coverage)return 'Recording caption coverage has not been reported.';
 const missing=coverage.recordings.filter(r=>r.status!=='available');
 return `Lecture recordings: captions indexed for ${coverage.available} of ${coverage.published} published recordings.`+
  (missing.length?` Missing or pending: ${missing.map(r=>r.title.split(' · ')[0]).join(', ')}.`:'')+
  ' Captions may contain transcription errors.';
}

// Reciprocal-rank fusion avoids comparing keyword weights to cosine scores.
// Merge at passage level so semantic updates retain keyword locations too.
export function mergeResults(keyword,semantic){
  const hits=new Map();
  for(const results of [keyword,semantic])results.forEach((document,rank)=>{
    const ordered=[...document.locations].sort((a,b)=>b.score-a.score);
    ordered.forEach((hit,locationRank)=>{
      const key=`${hit.category}:${hit.url}`;
      const contribution=1/(20+rank)+.1/(20+locationRank);
      if(hits.has(key))hits.get(key).score+=contribution;
      else hits.set(key,{...hit,score:contribution});
    });
  });
  return groupDocuments([...hits.values()].sort((a,b)=>b.score-a.score||Number(a.id)-Number(b.id)));
}

export function indexedCoverage(records){
 const titles=category=>[...new Set(records.filter(r=>r.category===category).map(r=>r.title))];
 const ranges=values=>{
  const numbers=[...new Set(values)].sort((a,b)=>a-b),parts=[];
  for(let i=0;i<numbers.length;i++){
   const start=numbers[i];let end=start;
   while(numbers[i+1]===end+1)end=numbers[++i];
   parts.push(start===end?String(start):`${start}-${end}`);
  }
  return parts.join(', ')||'none';
 };
 const numbered=category=>ranges(titles(category).map(t=>Number(t.match(/^(?:Lecture|Homework|Lab) (\d+)/)?.[1])).filter(Boolean));
 const recordings=numbered('Lecture recordings'),pdfs=numbered('Lecture PDFs');
 const lectures=recordings===pdfs?`Lectures: ${pdfs}`:`Lecture recordings: ${recordings} • Lecture PDFs: ${pdfs}`;
 return `${lectures} • Homeworks: ${numbered('Homeworks')} • Labs: ${numbered('Labs')}`;
}
