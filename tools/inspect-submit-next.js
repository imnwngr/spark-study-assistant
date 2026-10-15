/* Spark Submit/Next Inspector v1.0 — paste into the Dashboard DevTools Console.
 * Read-only: does not click controls, modify answers, intercept network, or export secrets.
 * Use the Spark UI yourself while this recorder observes safe button-state transitions.
 */
(() => {
  'use strict';
  const KEY='__sparkSubmissionInspectorV1';
  if (window[KEY]?.stop) window[KEY].stop();
  const startedAt=new Date().toISOString();
  const snapshots=[];
  const subscriptions=[];
  const observed=new WeakSet();
  let running=true;
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim().slice(0,110);
  const buttonEventNames=new Set(['check','sendscores','forward','forward_lo','previous','retry','reset','next_answer','all_answer']);
  const relevant=node=>{
    if (!node) return false;
    const action=node.getAttribute('data-event')||'';
    const label=clean([node.getAttribute('aria-label'),node.getAttribute('title'),node.querySelector('.button__title')?.textContent].filter(Boolean).join(' '));
    return buttonEventNames.has(action)||node.classList.contains('learningObject__controls-button--cal-forward') ||
      /\b(check answers|results|next|previous screen|continue|submit|finish|done)\b/i.test(label);
  };
  const stateOf=node=>{
    const css=node.ownerDocument.defaultView?.getComputedStyle(node);
    const box=node.getBoundingClientRect();
    const hiddenByAncestor=Boolean(node.closest('[hidden],[inert],.button--hidden,.activity--hidden'));
    return {
      event:node.getAttribute('data-event')||null,
      label:clean(node.getAttribute('aria-label')||node.getAttribute('title')||node.querySelector('.button__title')?.textContent||node.textContent),
      classes:[...node.classList].filter(v=>/^(active_button|inactive_button|button--hidden|learningObject__controls-button--cal-forward|button--disabled|disabled|is-disabled)$/.test(v)),
      disabled:node.disabled===true,
      ariaDisabled:node.getAttribute('aria-disabled'),
      hiddenAncestor:hiddenByAncestor,
      rendered:Boolean(box.width&&box.height&&css&&css.display!=='none'&&css.visibility!=='hidden'),
      actionable:!node.disabled && node.getAttribute('aria-disabled')!=='true' && !hiddenByAncestor &&
        Boolean(box.width&&box.height&&css&&css.display!=='none'&&css.visibility!=='hidden')
    };
  };
  const getFrames=()=>{
    const nodes=[];const visited=new WeakSet();
    function visit(win,depth,label){
      if(depth>8||visited.has(win))return;
      visited.add(win);
      let doc;
      try{doc=win.document;if(!doc)throw Error('document unavailable');}
      catch {nodes.push({depth,label,accessible:false});return;}
      nodes.push({depth,label,accessible:true,win,doc});
      for(const [i,frame] of [...doc.querySelectorAll('iframe')].entries()){
        try{if(frame.contentWindow)visit(frame.contentWindow,depth+1,clean(frame.title)||`iframe-${i}`);}
        catch {nodes.push({depth:depth+1,label:`iframe-${i}`,accessible:false});}
      }
    }
    visit(window,0,'Dashboard');return nodes;
  };
  const capture=(reason,trigger)=>{
    if(!running)return;
    const frameData=[];
    for(const frame of getFrames()){
      if(!frame.accessible){frameData.push({depth:frame.depth,label:frame.label,accessible:false});continue;}
      const {doc}=frame;
      const controls=[...doc.querySelectorAll('button,[role="button"]')].filter(relevant).map(stateOf);
      const active=[...doc.querySelectorAll('.content-wrap[id^="content_wrap_"]')]
        .filter(el=>!el.classList.contains('activity--hidden') && !el.hidden && doc.defaultView.getComputedStyle(el).display!=='none');
      if(!controls.length && !active.length)continue;
      frameData.push({
        depth:frame.depth,label:frame.label,accessible:true,
        exerciseTitle:clean(doc.querySelector('.learningObject__title')?.textContent||doc.title),
        activeScreens:active.map(el=>el.id),
        screenCounter:clean(doc.querySelector('.learningObject__controls--page .page-counter,.page-number,.screen-count')?.textContent),
        answerStateCounts:{
          correct:doc.querySelectorAll('.status-correct,.is-correct,.correct-answer').length,
          incorrect:doc.querySelectorAll('.status-incorrect,.is-incorrect,.incorrect-answer').length
        },
        controls
      });
    }
    const item={at:new Date().toISOString(),reason,trigger:trigger||null,frames:frameData};
    snapshots.push(item);
    if(snapshots.length>100)snapshots.shift();
    updateCount();
    console.info('[Spark Submit Inspector]',reason,'—',frameData.length,'relevant frames');
  };
  const onClick=event=>{
    if(!running||event.target.closest?.('#spark-submit-inspector-panel'))return;
    const button=event.target.closest?.('button,[role="button"]');
    if(!button || !relevant(button))return;
    const trigger={event:button.getAttribute('data-event')||null,
      label:clean(button.getAttribute('aria-label')||button.getAttribute('title')||button.querySelector('.button__title')?.textContent)};
    capture('BEFORE manual click',trigger);
    setTimeout(()=>capture('AFTER 250ms',trigger),250);
    setTimeout(()=>capture('AFTER 1200ms',trigger),1200);
  };
  function observeFrames(){
    if(!running)return;
    for(const frame of getFrames()){
      if(!frame.accessible||observed.has(frame.doc))continue;
      frame.doc.addEventListener('click',onClick,true);
      observed.add(frame.doc);
      subscriptions.push(frame.doc);
    }
  }
  const panel=document.createElement('section');
  panel.id='spark-submit-inspector-panel';
  panel.setAttribute('aria-label','Spark Submit Inspector');
  Object.assign(panel.style,{position:'fixed',zIndex:'2147483647',left:'12px',bottom:'12px',
    maxWidth:'calc(100vw - 24px)',width:'320px',padding:'12px',borderRadius:'14px',
    border:'1px solid #73869c',background:'#162434',color:'#f2f6ff',
    boxShadow:'0 12px 42px #0008',font:'12px system-ui, sans-serif',lineHeight:'1.5'});
  const title=document.createElement('strong');title.textContent='Spark · Submit/Next Inspector';
  const intro=document.createElement('p');intro.textContent='Read-only. Click Check Answers / Next manually on Spark. Then export the report.';
  intro.style.margin='7px 0';
  const count=document.createElement('div');count.style.margin='5px 0';
  const bar=document.createElement('div');Object.assign(bar.style,{display:'flex',gap:'5px',flexWrap:'wrap'});
  function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;
    Object.assign(b.style,{font:'inherit',padding:'6px 8px',border:'1px solid #8b9eb5',background:'#30445a',color:'white',borderRadius:'8px',cursor:'pointer'});
    b.addEventListener('click',fn);bar.append(b);return b;}
  const updateCount=()=>count.textContent=`Snapshots: ${snapshots.length} · Recording: ${running?'ON':'OFF'}`;
  const exportObject=()=>({reportType:'SPARK_SUBMIT_NEXT_DIAGNOSTIC',version:'1.0',startedAt,exportedAt:new Date().toISOString(),
    privacy:{inputValuesCollected:false,answersCollected:false,networkCaptured:false,queryStringsCollected:false},snapshots});
  function download(){const json=JSON.stringify(exportObject(),null,2);const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='spark-submit-next-diagnostic.json';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  async function copyJson(){const text=JSON.stringify(exportObject(),null,2);
    try{await navigator.clipboard.writeText(text);count.textContent='Copied JSON!';}catch{download();count.textContent='Clipboard blocked; requested JSON download.';}}
  function stop(){running=false;clearInterval(interval);subscriptions.forEach(doc=>doc.removeEventListener('click',onClick,true));panel.remove();delete window[KEY];}
  button('Capture now',()=>capture('MANUAL SNAPSHOT'));
  button('Copy JSON',copyJson);
  button('Download JSON',download);
  button('Stop',stop);
  panel.append(title,intro,count,bar);
  document.body.append(panel);
  const interval=setInterval(observeFrames,1200);
  observeFrames();capture('INITIAL');
  window[KEY]={capture,download,stop,getReport:exportObject};
  console.info('Spark Submit/Next Inspector active. No automatic clicks or answer extraction.');
})();
