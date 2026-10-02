(() => {
 const trigger=document.querySelector('.smart-search-trigger');if(!trigger)return;
 const header=document.querySelector('#main-header');const mobileHeader=document.querySelector('.site-header');const menu=document.querySelector('#menu-button');
 const mobile=window.matchMedia('(max-width:799px)');
 function placeTrigger(){if(mobile.matches&&mobileHeader&&menu)mobileHeader.insertBefore(trigger,menu);else header?.prepend(trigger);}
 placeTrigger();mobile.addEventListener('change',placeTrigger);
 const modal=document.createElement('dialog');modal.className='smart-search-modal';modal.setAttribute('aria-label','Smart Search');
 const close=document.createElement('button');close.type='button';close.className='smart-search-close';close.textContent='×';close.setAttribute('aria-label','Close Smart Search');
 const frame=document.createElement('iframe');frame.title=trigger.dataset.searchTitle || 'Search course materials';frame.className='smart-search-frame';
 modal.append(close,frame);document.body.append(modal);
 let returnFocus;
 const appOrigin = new URL(trigger.dataset.searchUrl, location.href).origin;
 const syncFont=()=>frame.contentWindow?.postMessage({type:'course-search-font',fontFamily:getComputedStyle(document.body).fontFamily},appOrigin);
 const focusSearch=()=>{syncFont();frame.contentWindow?.postMessage({type:'course-search-focus'},appOrigin);};
 new MutationObserver(syncFont).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 function open(){returnFocus=document.activeElement;if(!frame.src)frame.src=trigger.dataset.searchUrl;if(!modal.open){modal.showModal();document.body.classList.add('smart-search-open');}focusSearch();}
 function dismiss(){if(modal.open)modal.close();}
 close.addEventListener('click',dismiss);trigger.addEventListener('click',open);
 frame.addEventListener('load',focusSearch);
 modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dismiss();}});
 modal.addEventListener('close',()=>{document.body.classList.remove('smart-search-open');returnFocus?.focus();});
 document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='f'){event.preventDefault();open();}});
 window.addEventListener('message',event=>{if(event.origin!==appOrigin||event.source!==frame.contentWindow)return;if(event.data?.type==='course-search-close')dismiss();if(event.data?.type==='course-search-focus-parent')open();if(event.data?.type==='course-search-font-request')syncFont();});
})();
