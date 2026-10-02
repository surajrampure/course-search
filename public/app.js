import {resultCategories,combineLectureResults,tokens,excerpt,sortDocuments,createQueryProcessor,normalizeQuery,filterCategories,indexedCoverage} from './search.mjs';
import {loadCourseConfig} from './course-config.mjs';
const course = await loadCourseConfig().catch(error => {
 document.querySelector('.search-description').textContent='Search could not load. Open Smart Search from your course website, or refresh to try again.';
 document.querySelector('#search').disabled=true;
 throw error;
});
const activeCategories = course.categories;
const recordingPreviews = course.recordingPreviews || {};
document.title = 'Search · ' + course.courseName;
document.querySelector('.brand').lastChild.textContent = ' ' + course.courseName;
document.querySelector('header a').href = course.websiteURL;
document.querySelector('label[for=search]').textContent = 'Search ' + course.courseName + ' course materials';
for (const button of document.querySelectorAll('[data-category]')) if (!activeCategories.includes(button.dataset.category)) button.remove();
const footerLinks = document.querySelector('.index-coverage-links');
footerLinks.replaceChildren();
for (const item of course.footerLinks || []) { footerLinks.append(' • '); const link = document.createElement('a'); link.href=item.url; link.textContent=item.label; link.target='_blank'; link.rel='noreferrer'; footerLinks.append(link); }

if(new URLSearchParams(location.search).has('embedded'))document.body.classList.add('embedded');
const input=document.querySelector('#search'),groups=document.querySelector('#groups');
const explanation=document.querySelector('.search-explanation');
function renderExplanation(){if(window.renderMathInElement)window.renderMathInElement(explanation,{delimiters:[{left:'$',right:'$',display:false}],throwOnError:false,trust:false});}
renderExplanation();explanation.addEventListener('toggle',()=>{if(explanation.open)renderExplanation();});
if(document.body.classList.contains('embedded')){
 window.addEventListener('message',event=>{
  if(event.origin!==course.parentOrigin||event.source!==parent)return;
  if(event.data?.type==='course-search-focus')input.focus();
  if(event.data?.type==='course-search-font'&&typeof event.data.fontFamily==='string')document.documentElement.style.setProperty('--course-font',event.data.fontFamily);
 });
 parent.postMessage({type:'course-search-font-request'},course.parentOrigin);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();parent.postMessage({type:'course-search-close'},course.parentOrigin);}if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='f'){event.preventDefault();input.focus();}});
}

let allResults=[],completedResults=null,timer,requestId=0,semanticReady=false,semanticFailed=false;
let processQuery=null,activeQuery='',activeText='',activeProcessed,displayQuery='',displayText='',displayProcessed,sortOrder='relevance',lastQuery='';
const semanticCache=new Map();
const correction=document.createElement('p');correction.className='search-correction';correction.hidden=true;correction.setAttribute('role','status');correction.setAttribute('aria-live','polite');document.querySelector('#search-form').after(correction);
const expandedCategories=new Set(),expandedNotes=new Set(),expandedRecordings=new Set();
const worker=new Worker(new URL("./worker.js",import.meta.url),{type:"module"});
worker.postMessage({type:'init', dataBase:course.dataBase});
worker.onmessage=({data})=>{
 if(data.type==="ready"){semanticReady=true;if(!timer)run();}
 if(data.type==="results"){
  semanticCache.delete(data.query);semanticCache.set(data.query,data.results);
  if(semanticCache.size>32)semanticCache.delete(semanticCache.keys().next().value);
  if(data.id===requestId&&data.query===activeQuery)display(data.results,activeProcessed,activeText);
 }
 if(data.type==="error")failSearch(data.message);
};
worker.onerror=()=>failSearch();
function failSearch(message=''){
 semanticFailed=true;document.querySelector('#results').setAttribute('aria-busy','false');
 document.querySelector('#timing').title=message;
 document.querySelector('#timing').textContent='Search could not load. Refresh to try again.';
 if(!completedResults)document.querySelector('#summary').textContent='Search is unavailable.';
}
const icons=['▶','▤','▦','◫','▥'];
const selected=new Set(activeCategories);
function documentLabel(record){
 if(record.category==='Homeworks'||record.category==='Labs') return record.title.split(':')[0];
 return record.title;
}
function locationLabel(location){
 const numbered=location.section.match(/^(Problem|Activity|Page)\s+(\d+)/);
 return numbered ? (numbered[1]==='Problem'?'P':numbered[1]==='Activity'?'A':'p.')+numbered[2] : location.section;
}
function highlight(node,text,query){
 const terms=tokens(query);for(const part of text.split(/([a-z0-9]+)/gi)){
  if(terms.some(t=>tokens(part)[0]===t||part.toLowerCase().startsWith(t))){const mark=document.createElement('mark');mark.textContent=part;node.append(mark);}else node.append(document.createTextNode(part));
 }
}
function render(){
 groups.replaceChildren();
 for(const [i,category] of activeCategories.entries()){
  const matches=sortDocuments(allResults.filter(r=>r.category===category),sortOrder);if(!matches.length)continue;
  const section=document.createElement('section');section.className='group';section.dataset.category=category;
  const head=document.createElement('div');head.className='group-head';
  const icon=document.createElement('span');icon.className='group-icon';icon.textContent=icons[i];
  const h2=document.createElement('h2');h2.textContent=category;
  const count=document.createElement('span');count.className='group-count';count.textContent=matches.length;
  head.append(icon,h2,count);section.append(head);
  const cards=document.createElement('div');cards.className='cards';
  for(const r of expandedCategories.has(category)?matches:matches.slice(0,3)){
   const card=document.createElement('article');card.className='card';
   const heading=document.createElement('h3');const title=document.createElement('a');title.href=r.url;title.target='_blank';title.rel='noreferrer';title.textContent=documentLabel(r);title.title=r.title;heading.append(title);
   const locations=document.createElement('div');locations.className='locations';locations.setAttribute('aria-label','Matching locations');
   for(const location of r.locations){
    const link=document.createElement('a');link.href=location.url;link.target='_blank';link.rel='noreferrer';link.title=location.section;
    link.textContent=locationLabel(location);if(window.renderMathInElement)window.renderMathInElement(link,{delimiters:[{left:'$',right:'$',display:false}],throwOnError:false,trust:false});link.setAttribute('aria-label',r.title+' · '+location.section);
    locations.append(link);
   }
   const details=document.createElement('details');details.className='passages';
   const summary=document.createElement('summary');summary.textContent='Details';summary.setAttribute('aria-label','Preview passages from '+r.title);details.append(summary);
   for(const location of r.locations){
    const passage=document.createElement('div');passage.className='passage';
    const link=document.createElement('a');link.href=location.url;link.target='_blank';link.rel='noreferrer';link.textContent=location.section+' ↗';
    const text=document.createElement('p');text.className='card-excerpt';
    if(/\\|\$/.test(location.text)){
     text.textContent=location.text.replace(/\\\\/g,'\\').replace(/\\(?:mathbf|boldsymbol|bm)\s*\{([a-zA-Z](?:_\{?\d+\}?)?)\}/g,'\\vec{$1}').replace(/\*\*([uvw])\*\*/g,'$\\vec{$1}$');
     if(window.renderMathInElement)window.renderMathInElement(text,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false},{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true}],throwOnError:false,trust:false,macros:{'\\v':'\\vec{#1}','\\R':'\\mathbb{R}'}});
    }else highlight(text,excerpt(location.text,displayQuery),displayQuery);
    if(location.detail.startsWith('OCR')){const quality=document.createElement('small');quality.textContent='OCR transcript · check original PDF';text.append(quality);}
    passage.append(link);

    passage.append(text);details.append(passage);
   }
   if(category==='Notes'){
    card.classList.add('note-card');
    const note=document.createElement('details');note.className='note-sections';note.open=expandedNotes.has(r.id);
    note.addEventListener('toggle',()=>{note.open?expandedNotes.add(r.id):expandedNotes.delete(r.id);});
    const toggle=document.createElement('summary');toggle.className='note-title';toggle.textContent=documentLabel(r);
    const open=document.createElement('a');open.className='open-note';open.href=r.url;open.target='_blank';open.rel='noreferrer';open.textContent='Open note ↗';
    note.append(toggle,open,locations,details);card.append(note);
   }else if(category==='Lectures'){
    card.classList.add('recording-card');
    const recording=document.createElement('details');recording.className='recording-moments';recording.open=expandedRecordings.has(r.id);
    recording.addEventListener('toggle',()=>{recording.open?expandedRecordings.add(r.id):expandedRecordings.delete(r.id);});
    const toggle=document.createElement('summary');toggle.className='recording-summary';
    const thumbnail=document.createElement('span');thumbnail.className='recording-thumbnail';thumbnail.setAttribute('aria-hidden','true');
    const id=r.recording?new URL(r.recording.url).pathname.split('/').pop():null;
    if(recordingPreviews[id]){const image=document.createElement('img');image.src=recordingPreviews[id];image.alt='';image.loading='lazy';thumbnail.append(image);}
    const play=document.createElement('span');play.className='recording-play';play.textContent=r.recording?'▶':'▧';thumbnail.append(play);
    const label=document.createElement('span');label.className='recording-label';label.textContent=documentLabel(r);
    const preview=document.createElement('span');preview.className='card-excerpt';const previewLocations=(r.recording||r.pdf).locations;highlight(preview,excerpt(previewLocations.reduce((best,l)=>l.score>best.score?l:best).text,displayQuery),displayQuery);
    const countLabel=(count,singular)=>`${count} ${singular}${count===1?'':'s'}`;
    const counts=[r.recording&&countLabel(r.recording.locations.length,'moment'),r.pdf&&countLabel(r.pdf.locations.length,'PDF page')].filter(Boolean);
    const prompt=document.createElement('span');prompt.className='recording-prompt';prompt.textContent=counts.join(' · ')+' · Show matches';
    toggle.append(thumbnail,label,preview,prompt);
    const content=document.createElement('div');content.className='recording-content';
    for(const [source,label] of [[r.recording,'Watch recording'],[r.pdf,course.lecturePDFLabel || 'Open lecture PDF']]){
     if(!source)continue;
     const sourceBlock=document.createElement('section');sourceBlock.className='lecture-source';
     const open=document.createElement('a');open.className='open-recording';open.href=source.url;open.target='_blank';open.rel='noreferrer';open.textContent=label+' ↗';
     const sourceLocations=document.createElement('div');sourceLocations.className='locations';sourceLocations.setAttribute('aria-label',source.category==='Lecture recordings'?'Matching recording timestamps':'Matching PDF pages');
     for(const link of [...locations.children])if(source.locations.some(location=>location.url===link.href||location.url===link.getAttribute('href')))sourceLocations.append(link);
     sourceBlock.append(open,sourceLocations);content.append(sourceBlock);
    }
    content.append(details);recording.append(toggle,content);card.append(recording);
   }else {
    card.append(heading);
    card.append(locations,details);
   }
   cards.append(card);
  }
  section.append(cards);
  if(matches.length>3){
   const more=document.createElement('button');more.type='button';more.className='show-more';
   more.textContent=expandedCategories.has(category)?'Show less':`Show more (${matches.length-3})`;
   more.setAttribute('aria-label',`${more.textContent} ${category.toLowerCase()}`);
   more.setAttribute('aria-expanded',String(expandedCategories.has(category)));
   more.addEventListener('click',()=>{expandedCategories.has(category)?expandedCategories.delete(category):expandedCategories.add(category);render();});
   section.append(more);
  }
  groups.append(section);
 }
}
function display(results,processed,query){
 completedResults=results;displayQuery=processed.normalized;displayText=query;displayProcessed=processed;
 if(displayQuery!==lastQuery){expandedCategories.clear();expandedNotes.clear();expandedRecordings.clear();lastQuery=displayQuery;}
 correction.hidden=!processed.corrections.length;
 if(processed.corrections.length)correction.textContent=`Showing results for “${normalizeQuery(processed.corrected)}”.`;
 allResults=combineLectureResults(filterCategories(results,selected));
 document.querySelector('#summary').textContent=`${allResults.length} documents · ${allResults.reduce((sum,r)=>sum+r.locations.length,0)} matching locations for “${query}”`;
 document.querySelector('#timing').textContent='';document.querySelector('#results').setAttribute('aria-busy','false');
 document.querySelector('#empty').hidden=!!allResults.length;
 document.querySelector('#empty h2').textContent=selected.size?'No matches yet.':'Select a category to search.';
 document.querySelector('#empty p').textContent=selected.size?'Try another topic or enable more categories.':'Use the buttons above to include course materials.';render();
}
function run(){
 clearTimeout(timer);timer=null;
 const query=input.value.trim();requestId++;document.body.classList.toggle('has-query',!!query);document.querySelector('#results').hidden=!query;
 if(!query){activeQuery='';completedResults=null;allResults=[];groups.replaceChildren();correction.hidden=true;document.querySelector('#results').setAttribute('aria-busy','false');worker.postMessage({type:'cancel',id:requestId});return;}
 if(!processQuery){document.querySelector('#summary').textContent='Preparing search…';return;}
 activeProcessed=processQuery(query);activeQuery=activeProcessed.normalized;activeText=query;
 if(semanticCache.has(activeQuery)){display(semanticCache.get(activeQuery),activeProcessed,activeText);return;}
 if(semanticFailed){failSearch();return;}
 document.querySelector('#results').setAttribute('aria-busy','true');document.querySelector('#empty').hidden=true;
 document.querySelector('#timing').textContent=semanticReady?'Searching…':'Preparing search…';
 if(!completedResults)document.querySelector('#summary').textContent='';
 if(semanticReady)worker.postMessage({query:activeQuery,id:requestId});
}
for(const button of document.querySelectorAll('[data-category]')) button.addEventListener('click',()=>{
 const category=button.dataset.category;selected.has(category)?selected.delete(category):selected.add(category);
 button.setAttribute('aria-pressed',String(selected.has(category)));
 if(completedResults){const busy=document.querySelector('#results').getAttribute('aria-busy'),status=document.querySelector('#timing').textContent;display(completedResults,displayProcessed,displayText);document.querySelector('#results').setAttribute('aria-busy',busy);document.querySelector('#timing').textContent=status;}
});
for(const button of document.querySelectorAll('[data-sort]'))button.addEventListener('click',()=>{sortOrder=button.dataset.sort;for(const b of document.querySelectorAll('[data-sort]'))b.setAttribute('aria-pressed',String(b===button));render();});
input.addEventListener('input',()=>{
 clearTimeout(timer);requestId++;worker.postMessage({type:'cancel',id:requestId});
 if(!input.value.trim()){run();return;}
 timer=setTimeout(run,350);
});
document.querySelector('#search-form').addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);run();});
document.addEventListener('keydown',e=>{if(e.key==='/'&&e.target!==input){e.preventDefault();input.focus();}});
try{
 const response=await fetch(new URL('index.json',course.dataBase));if(!response.ok)throw new Error();const data=await response.json();processQuery=createQueryProcessor(data.records, {shorthand:course.queryShorthand || {}});
 document.querySelector('#index-coverage').textContent=indexedCoverage(data.records);
 if(!timer)run();
}catch{document.querySelector('#results').hidden=false;document.querySelector('#summary').textContent='Search is unavailable. Refresh to try again.';}
