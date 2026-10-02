import {normalizeQuery,tokens} from './query.mjs';

// Explicit references constrain sources; remaining words describe the topic.
export function parseResourceQuery(input,{shorthand={}}={}){
 let text=input.normalize('NFKC').toLowerCase(),resource=null,location=null,exam=null;
 const consume=match=>{text=text.slice(0,match.index)+' '+text.slice(match.index+match[0].length);};
 let match=/\b(homework|hw|assignment|lecture|lec|lab|notes?|chapter)\s*[-#]?\s*(\d+(?:\.\d+)?)(?=\b|p\d)/i.exec(text);
 if(match){
  const kind=match[1].toLowerCase();
  resource={kind:/^(homework|hw|assignment)$/.test(kind)?'homework':/^(lecture|lec)$/.test(kind)?'lecture':kind==='lab'?'lab':'note',number:match[2]};
  consume(match);
 }
 // Consume term/year only when an exam is explicitly requested.
 const assessment=/\b(?:practice\s+)?(?:midterm|mt)\s*[-#]?\s*(\d+)(?=\b|p\d)|\bfinal(?:\s+exam)?\b|\b(?:past\s+)?exams?\b/i;
 const termPattern=/\b(fall|winter|spring|fa|wi|sp)\s*-?\s*(20\d{2}|\d{2})(?=\b|mt|midterm|final)/i;
 const term=termPattern.exec(text);
 const withoutTerm=term?text.slice(0,term.index)+' '+text.slice(term.index+term[0].length):text;
 if(!resource&&assessment.test(withoutTerm)){
  if(term)consume(term);
  match=assessment.exec(text);
  const value=match[0];
  exam={assessment:match[1]?'midterm':/final/i.test(value)?'final':null,number:match[1]?Number(match[1]):null,practice:/practice/i.test(value),term:null,year:null};
  consume(match);
  if(term){exam.term={fa:'fall',wi:'winter',sp:'spring'}[term[1]]||term[1];exam.year=Number(term[2])+ (term[2].length===2?2000:0);}
 }
 match=/\b(problem|question|activity|page)\s*#?\s*0*(\d+)\b/i.exec(text);
 if(!match&&(resource||exam))match=/\b(p)\s*0*(\d+)\b/i.exec(text);
 if(match){location={kind:match[1]==='p'||match[1]==='question'?'problem':match[1],number:Number(match[2])};consume(match);}
 const scoped=Boolean(resource||exam||location);
 if(scoped)text=text.replace(/\b(?:find|show|me|please|in|from|for|about|the)\b/g,' ');
 let query=normalizeQuery(text.replace(/^[\s,:;-]+|[\s,:;-]+$/g,'').replace(/\s+/g,' ').trim());
 query=shorthand[query]||query;
 if(!tokens(query).length)query='';
 return {query,resource,location,exam,scoped};
}

export function matchesResource(record,request){
 const {resource,location,exam}=request;
 if(resource){
  const categories={homework:['Homeworks'],lecture:['Lecture recordings','Lecture PDFs'],lab:['Labs'],note:['Notes']};
  if(!categories[resource.kind].includes(record.category))return false;
  const prefix={homework:'Homework',lecture:'Lecture',lab:'Lab'}[resource.kind];
  const number=resource.kind==='note'?resource.number.split('.').map(Number).join('.'):String(Number(resource.number));
  const escaped=number.replaceAll('.','\\.');
  if(!new RegExp('^'+(prefix?prefix+'\\s+':'')+escaped+'(?:\\D|$)','i').test(record.title))return false;
 }
 if(exam){
  if(record.category!=='Past exams')return false;
  if(exam.practice&&!/\bpractice\b/i.test(record.title))return false;
  if(exam.assessment==='midterm'&&!new RegExp('\\bMidterm\\s+'+exam.number+'(?:\\D|$)','i').test(record.title))return false;
  if(exam.assessment==='final'&&!/\bFinal\b/i.test(record.title))return false;
  if(exam.term&&!new RegExp('\\b'+exam.term+'\\b','i').test(record.title+' '+(record.semester||'')))return false;
  if(exam.year&&!new RegExp('\\b'+exam.year+'\\b').test(record.title+' '+(record.semester||'')))return false;
 }
 if(location){
  const heading=/^(Problem|Question|Activity|Page)\s+(\d+)\b/i.exec(record.section||'');
  if(!heading||Number(heading[2])!==location.number)return false;
  const kind=heading[1].toLowerCase();
  if(location.kind==='page'&&kind!=='page')return false;
  if(location.kind==='activity'&&kind!=='activity')return false;
  if(location.kind==='problem'&&!['problem','question',...(resource?.kind==='lab'?['activity']:[])].includes(kind))return false;
 }
 return true;
}
