(() => {
  'use strict';
  if (globalThis.__sparkStudyAssistantLoaded) return;
  globalThis.__sparkStudyAssistantLoaded = true;
  let lastScan = { title: '', questions: [], refs: new Map(), applied:new Map(), appliedChoiceIds:new Map(), submitted:false,activeRoot:null };
  let qtiCache = null;
  let qtiPending = null;
  const tidy = (v) => String(v || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const normalized = (v) => tidy(v).normalize('NFKC').toLowerCase().replace(/[’]/g, "'");

  const isTextField = el => {
    if (el.matches('textarea,[contenteditable="true"],[role="textbox"]')) return true;
    if (!el.matches('input')) return false;
    return ['text','search','email','number',''].includes(el.getAttribute('type') || 'text');
  };
  const getKind = node => node.matches('select,.wrapper-dropdown,[role="combobox"]') ? 'dropdown' : 'text';
  const optionNodes = node => {
    if (node.matches('select')) return [...node.options];
    let candidates = [...node.querySelectorAll('[role="option"], .listbox__choice,option')];
    if (!candidates.length && node.matches('[role="combobox"]')) {
      const popupId = node.getAttribute('aria-controls');
      const popup = popupId ? document.getElementById(popupId) : null;
      if (popup) candidates = [...popup.querySelectorAll('[role="option"],.listbox__choice,option')];
    }
    return candidates;
  };
  const getOptions = node => optionNodes(node).map(e => tidy(e.textContent))
    .filter(x => x && !/^(select|choose)( an? option)?$/i.test(x));
  function getControls(block) {
    const candidates = [...block.querySelectorAll('select,.wrapper-dropdown,[role="combobox"],input,textarea,[contenteditable="true"],[role="textbox"]')];
    return candidates.filter(node => {
      if (!node.matches('select,.wrapper-dropdown,[role="combobox"]') && !isTextField(node)) return false;
      if (node.matches('[role="combobox"]') && node.closest('.wrapper-dropdown')) return false;
      if (node.matches('select') && node.closest('.wrapper-dropdown')) return false;
      if (node.closest('.wrapper-dropdown') && !node.matches('.wrapper-dropdown')) return false;
      if (candidates.some(parent => parent !== node && parent.contains(node) &&
          (parent.matches('.wrapper-dropdown,[role="combobox"]') || (parent.matches('[contenteditable="true"]') && node.matches('[role="textbox"]'))))) return false;
      return true;
    });
  }
  function activeContentRoot(){
    const roots=[...document.querySelectorAll('.content-wrap[id^="content_wrap_"]')];
    const visible=roots.filter(el=>!el.classList.contains('activity--hidden') && !el.hidden &&
      !el.closest('[hidden],[inert]') && getComputedStyle(el).display!=='none');
    return visible[0]||roots[0]||document;
  }
  function choiceGroup(block){
    const controls=[...block.querySelectorAll('[role="checkbox"],[role="radio"]')]
      .filter(el=>!el.closest('[hidden],[inert]') && !el.matches('[aria-hidden="true"]'));
    if(!controls.length)return null;
    const kind=controls[0].getAttribute('role')==='checkbox'?'multi':'choice';
    if(controls.some(el=>el.getAttribute('role')!==(kind==='multi'?'checkbox':'radio')))return null;
    const items=controls.map(el=>{
      const match=(el.id||el.className||'').match(/(?:input-(?:checkbox|radio)-(?:s\d+-)?c|choice-c)(\d+)-(\d+)/);
      const id=match?`C${match[1]}_${match[2]}`:'';
      const label=tidy(el.innerText||el.textContent||
        el.closest('label')?.innerText||el.parentElement?.querySelector('label')?.innerText||'');
      return {node:el,id,label};
    });
    // QTI identifiers must be verifiable in the live DOM. Never infer from
    // shuffled visual position or fabricated labels.
    if(items.some(x=>!x.id)||new Set(items.map(x=>x.id)).size!==items.length)return null;
    const groups=new Set(items.map(x=>x.id.split('_')[0]));
    if(groups.size!==1)return null;
    return {kind,items,options:items.map(x=>x.label||x.id),choiceIds:items.map(x=>x.id)};
  }
  // Bank words are per-screen. Do not accidentally take the hidden next page's pool.
  function findWordBank(root,blocks,rubric){
    const pool=[...root.querySelectorAll('.pool .static_word')].map(el=>tidy(el.textContent)).filter(Boolean);
    if(pool.length)return {text:pool.join(' | '),block:null};
    if(!/\b(?:word|words|phrase|phrases)\b[^.?!]{0,130}\bbox\b/i.test(rubric)&&
       !/\b(?:word|words)\s*bank\b/i.test(rubric))return {text:'',block:null};
    const explicit=root.querySelector('.wordbank,.word-bank,.word-box,.wordbox,[data-zone-type="wordbank"]');
    if(explicit&&!getControls(explicit).length){
      const value=tidy(explicit.innerText||explicit.textContent).slice(0,350);
      if(value)return {text:value,block:blocks.find(b=>b===explicit||b.contains(explicit))||null};
    }
    const firstEditable=blocks.findIndex(b=>getControls(b).length>0);
    if(firstEditable<1)return {text:'',block:null};
    for(const block of blocks.slice(0,firstEditable)){
      if(getControls(block).length||block.querySelector('.enum,[data-continuous-enumeration-id]'))continue;
      const text=tidy(block.innerText||block.textContent);
      if(text.length>=5&&text.length<=220&&!/[?.!]/.test(text))return {text,block};
    }
    return {text:'',block:null};
  }
  function formatBlock(block, controls) {
    const clone = block.cloneNode(true);
    clone.querySelectorAll('.enum,.sr-only,.srOnly,.sr_only,script,style').forEach(n => n.remove());
    const copiedControls = getControls(clone);
    // Controls in detached cloned DOM appear in the same document order as originals.
    for (let i = copiedControls.length - 1; i >= 0; i--) {
      const ctrl = copiedControls[i];
      if (ctrl.isConnected || !clone.contains(ctrl)) continue;
      ctrl.replaceWith(document.createTextNode(` [[${i + 1}]] `));
    }
    return tidy(clone.textContent).replace(/\s+([,.!?;:])/g, '$1');
  }
  function around(context, index) {
    const token = `[[${index + 1}]]`;
    const offset = context.indexOf(token);
    if (offset < 0) return {before:'',after:'',hint:''};
    const before = context.slice(Math.max(0,offset - 240), offset).trim();
    const after = context.slice(offset + token.length, offset + token.length + 120).trim();
    const hintMatch = after.match(/^\s*\(([^)]+)\)/) || before.match(/\(([^)]+)\)\s*$/);
    return {before, after, hint:hintMatch?.[1] || ''};
  }
  function exerciseTitle() {
    return tidy(document.querySelector('.learningObject__title')?.textContent ||
      document.querySelector('.learningObject__heading')?.textContent ||
      document.title || 'Bài tập');
  }
  function scan(){
    const questions=[],refs=new Map();
    const root=activeContentRoot();
    const title=exerciseTitle();
    const deferredCategory=/\|\s*(?:speaking|writing(?: skill)?)\s*\|/i.test(title);
    const rubric=tidy(root.querySelector('.layout__rubric')?.textContent ||
      document.querySelector('.layout__rubric')?.textContent).slice(0,500);
    const blocks=[...root.querySelectorAll('.layout__content .contentblock,.interaction .contentblock')]
      .filter((n,i,a)=>a.indexOf(n)===i);
    const bank=findWordBank(root,blocks,rubric);
    const sourceBlocks=blocks.length?blocks.filter(b=>b!==bank.block):
      [...root.querySelectorAll('.layout__content .interaction')].slice(0,3);
    const hasEditable=sourceBlocks.some(b=>getControls(b).length||(!deferredCategory&&choiceGroup(b)));
    for(let b=0;b<sourceBlocks.length;b++){
      const block=sourceBlocks[b];
      const group=deferredCategory?null:choiceGroup(block);
      if(group){
        const id=`q${questions.length+1}`;
        const question={id,kind:group.kind,context:tidy(block.innerText||block.textContent).slice(0,1200),
          localContext:tidy(block.innerText||block.textContent).slice(0,1200),options:group.options,
          choiceIds:group.choiceIds,rubric,wordBank:bank.text,hint:'',before:'',after:'',
          block:b+1,position:1,applyable:true};
        questions.push(question);
        refs.set(id,{kind:group.kind,items:group.items});
        continue;
      }
      const controls=getControls(block);
      if(hasEditable&&!controls.length)continue; // e.g. static vocabulary reference before text gaps
      const context=formatBlock(block,controls);
      if(!context)continue;
      if(controls.length){
        controls.forEach((node,index)=>{
          const id=`q${questions.length+1}`,kind=getKind(node),extra=around(context,index);
          const localContext=context.replace(/\[\[\d+\]\]/g, token=>
            token===`[[${index+1}]]`?'[[1]]':'[other gap]');
          const options=kind==='dropdown'?getOptions(node):[];
          questions.push({id,kind,context,localContext,options,rubric,wordBank:bank.text,
            hint:extra.hint,before:extra.before,after:extra.after,
            block:b+1,position:index+1,applyable:true});
          refs.set(id,{node,kind,options});
        });
      }else{
        const id=`q${questions.length+1}`;
        const isMatch=Boolean(block.matches('.gap_match_view,.om-text-gap,.ll_view')||block.closest('.gap_match_view,.om-text-gap,.ll_view')||block.querySelector('.gap_match_view,.om-text-gap,.ll_view'));
        const isOrder=/sequence\s*\d/i.test(context)||/\b(order|unscramble|reorder)\b/i.test(rubric);
        const isCorrection=/\b(correction|correct|mistake|error)\b/i.test(rubric)||/grammar\s*1\s*\|\s*1/i.test(title);
        questions.push({id,kind:isMatch?'match':isOrder?'order':isCorrection?'correction':'manual',
          context,options:[],rubric,wordBank:bank.text,hint:'',before:'',after:'',
          block:b+1,position:1,applyable:false});
      }
    }
    const screenMatch=(root.id||'').match(/content_wrap_(\d+)/);
    const screenIndex=screenMatch?Number(screenMatch[1]):0;
    lastScan={title,questions,refs,applied:new Map(),appliedChoiceIds:new Map(),submitted:false,screenIndex,activeRoot:root};
    return {title,questions,screenIndex,frameUrl:location.origin+location.pathname,hasExercise:questions.length>0};
  }
  async function readQTI(expectedIds) {
    const questions = lastScan.questions;
    if (!questions.length || !Array.isArray(expectedIds) ||
      questions.length !== expectedIds.length ||
      questions.some((q,i)=>q.id!==expectedIds[i])) {
      return {answers:[],reason:'staleScan'};
    }
    const script = [...document.querySelectorAll('script[src]')].find(el=>{
      try{return new URL(el.src).pathname.endsWith('/data.js');}catch{return false;}
    });
    if(/\|\s*(?:speaking|writing(?: skill)?)\s*\|/i.test(lastScan.title))
      return {answers:[],reason:'deferredCategory'};
    if(!script || !globalThis.SparkQTI)return {answers:[],reason:'noDataScript'};
    const url = new URL(script.src);
    // Never load other origins or user-supplied endpoints.
    if(url.origin!==location.origin || !/^\/cdn_proxy\//.test(url.pathname))return {answers:[],reason:'invalidDataOrigin'};
    if(qtiCache?.url===url.href && qtiCache?.source){
      return globalThis.SparkQTI.fromDataJs(qtiCache.source,questions,new DOMParser());
    }
    if(!qtiPending){
      qtiPending=(async()=>{
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),4000);
        try {
          const response=await fetch(url.href,{credentials:'same-origin',cache:'force-cache',signal:controller.signal});
          if(!response.ok)return null;
          const declaredLength=Number(response.headers.get('content-length')||0);
          if(declaredLength>globalThis.SparkQTI.MAX_SOURCE)return null;
          const source=await response.text();
          return source.length<=globalThis.SparkQTI.MAX_SOURCE?source:null;
        } finally {clearTimeout(timer);}
      })().finally(()=>{qtiPending=null;});
    }
    const source=await qtiPending;
    if(!source)return {answers:[],reason:'dataUnavailable'};
    qtiCache={url:url.href,source};
    return globalThis.SparkQTI.fromDataJs(source,questions,new DOMParser());
  }
  function setText(el, value) {
    el.focus();
    if (el.matches('input,textarea')) {
      const proto = el.matches('textarea') ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto,'value')?.set;
      if (nativeSetter) nativeSetter.call(el,value); else el.value = value;
    } else if (el.isContentEditable) {
      el.textContent = value;
    } else return false;
    el.dispatchEvent(new InputEvent('input', {bubbles:true,inputType:'insertText',data:value}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    el.blur();
    return el.matches('input,textarea') ? el.value === value : tidy(el.textContent) === tidy(value);
  }
  const wait = ms => new Promise(r => setTimeout(r,ms));
  async function setDropdown(el, answer) {
    const options = getOptions(el);
    const match = options.find(opt => normalized(opt) === normalized(answer));
    if (!match) return {status:'skipped',detail:'Đáp án không thuộc danh sách lựa chọn.'};
    if (el.matches('select')) {
      const opt = [...el.options].find(o => normalized(o.textContent) === normalized(match));
      if (!opt) return {status:'skipped',detail:'Không tìm thấy option.'};
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set;
      if (setter) setter.call(el,opt.value); else el.value=opt.value;
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return {status:el.value === opt.value?'filled':'uncertain',detail:'Native select'};
    }
    const button = el.matches('[role="combobox"]') ? el : el.querySelector('[role="combobox"],button[data-event="toggle"]');
    const option = optionNodes(el)
      .find(n => normalized(n.textContent) === normalized(match));
    if (!button || !option) return {status:'skipped',detail:'Không tìm thấy nút hoặc lựa chọn.'};
    if (normalized(button.textContent) === normalized(match)) return {status:'filled',detail:'Đã chọn từ trước.'};
    button.click();
    await wait(100);
    option.click();
    await wait(160);
    const rendered = normalized(button.textContent);
    const selected = option.getAttribute('aria-selected') === 'true' ||
      option.classList.contains('selected') || option.classList.contains('is-selected');
    return {status: rendered.includes(normalized(match)) || selected ? 'filled':'uncertain',
      detail:rendered.includes(normalized(match)) || selected ? 'Đã nhận diện lựa chọn.':'Đã nhấn lựa chọn nhưng không xác nhận được trạng thái; kiểm tra trên trang.'};
  }
  function isChecked(node){
    const input=node.querySelector('input[type="checkbox"],input[type="radio"]');
    return node.hasAttribute('aria-checked') ? node.getAttribute('aria-checked')==='true' : Boolean(input?.checked);
  }
  async function setChoice(group,answer,selectedIds){
    const parts=Array.isArray(selectedIds)&&selectedIds.length?selectedIds:
      String(answer).split(' | ').map(tidy).filter(Boolean).map(label=>{
        const hits=group.items.filter(item=>normalized(item.label)===normalized(label));
        return hits.length===1?hits[0].id:'';
      });
    if(!parts.length||parts.some(id=>!id)||new Set(parts).size!==parts.length||
      parts.some(id=>!group.items.some(x=>x.id===id))||
      (group.kind==='choice'&&parts.length!==1))
      return {status:'skipped',detail:'QTI choice identifiers do not match visible controls.'};
    const desired=new Set(parts);
    if(group.kind==='choice'){
      const selected=group.items.find(item=>desired.has(item.id));
      if(!isChecked(selected.node)){selected.node.click();await wait(100);}
    } else {
      for(const item of group.items){
        const target=desired.has(item.id);
        if(isChecked(item.node)!==target){item.node.click();await wait(90);}
      }
    }
    const verified=group.items.every(item=>isChecked(item.node)===desired.has(item.id));
    return {status:verified?'filled':'uncertain',detail:verified?'Choice state verified.':'Could not verify selection state.'};
  }
  async function apply(answers) {
    if(!lastScan.activeRoot||activeContentRoot()!==lastScan.activeRoot){
      return (Array.isArray(answers)?answers:[]).map(a=>({id:a.id,status:'skipped',detail:'Screen changed; scan again.'}));
    }
    const results = [];
    for (const response of answers) {
      const id = response.id;
      const value = tidy(response.answer);
      const found = lastScan.refs.get(id);
      if (!value) {lastScan.applied.delete(id);results.push({id,status:'skipped',detail:'Không có đáp án.'});continue;}
      if (!found) {lastScan.applied.delete(id);results.push({id,status:'manual',detail:'Dạng này chưa hỗ trợ tương tác tự động; dùng đáp án xem trước.'});continue;}
      if (!(found.items?found.items.every(item=>document.contains(item.node)):document.contains(found.node))) {lastScan.applied.delete(id);results.push({id,status:'skipped',detail:'Bài đã thay đổi. Hãy quét lại.'});continue;}
      try {
        let outcome;
        if(found.kind==='dropdown')outcome=await setDropdown(found.node,value);
        else if(found.kind==='choice'||found.kind==='multi')outcome=await setChoice(found,value,response.selectedIds);
        else outcome={status:setText(found.node,value)?'filled':'uncertain',detail:'Text field updated.'};
        if(outcome.status==='filled'){
          lastScan.applied.set(id,value);
          if(found.items){
            const ids=found.items.filter(item=>isChecked(item.node)).map(item=>item.id);
            lastScan.appliedChoiceIds.set(id,ids);
          }
        }else{lastScan.applied.delete(id);lastScan.appliedChoiceIds.delete(id);}
        results.push({id,...outcome});
      } catch(error) {lastScan.applied.delete(id);results.push({id,status:'skipped',detail:String(error?.message || error)});}
    }
    return results;
  }
  // Only Spark's known scoring control is a submission candidate. Never guess at a
  // generic "submit" button, which might belong to a different iframe or LMS form.
  function actionable(node) {
    if (!node || !node.isConnected || node.disabled || node.getAttribute('aria-disabled') === 'true') return false;
    if (node.closest('[hidden],[inert]') || node.classList.contains('inactive_button')) return false;
    const css=getComputedStyle(node);
    return css.display!=='none' && css.visibility!=='hidden' && node.getClientRects().length>0;
  }
  function checkSignal() {
    const check=document.querySelector('[data-event="check"]');
    const answerStates=document.querySelectorAll('.status-correct,.status-incorrect,.is-correct,.is-incorrect,.correct-answer,.incorrect-answer').length;
    return {checkAvailable:actionable(check), answerStates};
  }
  async function submitNext(expected,goNext) {
    if(!lastScan.activeRoot||activeContentRoot()!==lastScan.activeRoot)
      return {submitted:false,reason:'submitChanged'};
    if(lastScan.submitted)return {submitted:false,reason:'submitAlready'};
    if(!Number.isInteger(expected)||expected!==lastScan.questions.length || !expected ||
      lastScan.questions.some(q=>!q.applyable)||lastScan.refs.size!==expected || lastScan.applied.size!==expected) {
      return {submitted:false,reason:'submitUnverified'};
    }
    // A manual change after filling invalidates the verification: re-read actual DOM values.
    const consistent=[...lastScan.refs.entries()].every(([id,ref])=>{
      if(!(ref.items?ref.items.every(item=>document.contains(item.node)):document.contains(ref.node)))return false;
      const wanted=normalized(lastScan.applied.get(id));
      if(!wanted)return false;
      if(ref.kind==='choice'||ref.kind==='multi'){
        const wanted=lastScan.appliedChoiceIds?.get(id);
        if(!wanted?.length)return false;
        return ref.items.every(item=>isChecked(item.node)===wanted.includes(item.id));
      }
      if(ref.kind==='dropdown'){
        if(ref.node.matches('select'))return normalized(ref.node.selectedOptions[0]?.textContent)===wanted;
        const button=ref.node.matches('[role="combobox"]')?ref.node:ref.node.querySelector('[role="combobox"],button[data-event="toggle"]');
        if(normalized(button?.textContent).includes(wanted))return true;
        return optionNodes(ref.node).some(option=>normalized(option.textContent)===wanted &&
          (option.getAttribute('aria-selected')==='true'||option.classList.contains('selected')||option.classList.contains('is-selected')));
      }
      return normalized(ref.node.value!==undefined?ref.node.value:ref.node.textContent)===wanted;
    });
    if(!consistent)return {submitted:false,reason:'submitChanged'};
    const check=document.querySelector('[data-event="check"]');
    if(!actionable(check))return {submitted:false,reason:'submitControlMissing'};
    // Lock before the click to prevent double-scoring on repeated popup calls.
    lastScan.submitted=true;
    const before=checkSignal();
    check.click();
    for(let i=0;i<10;i++){
      await wait(180);
      const after=checkSignal();
      if((before.checkAvailable && !after.checkAvailable) || after.answerStates>before.answerStates){
        if(goNext){
          // Scoring may update the toolbar asynchronously. Wait a bounded period
          // for exactly one Next *learning-object* control, not a generic arrow.
          for(let attempt=0;attempt<8;attempt++){
            const candidates=[...document.querySelectorAll('[data-event="forward_lo"]')].filter(actionable);
            if(candidates.length===1){
              // Delay lets the success response reach the popup before Spark unloads this iframe.
              setTimeout(()=>{if(actionable(candidates[0]))candidates[0].click();},250);
              return {submitted:true,confirmed:true,nextClicked:true};
            }
            if(candidates.length>1)break; // ambiguity must never cause a click
            await wait(150);
          }
        }
        return {submitted:true,confirmed:true,nextClicked:false,reason:'nextControlMissing'};
      }
    }
    return {submitted:true,confirmed:false,nextClicked:false,reason:'submitClicked'};
  }

  chrome.runtime.onMessage.addListener((message,_sender,respond) => {
    if (!message || !['SPARK_SCAN','SPARK_APPLY','SPARK_PING','SPARK_SUBMIT_NEXT','SPARK_QTI'].includes(message.type)) return false;
    if (message.type === 'SPARK_PING') {respond({ok:true,ready:true});return false;}
    if (message.type === 'SPARK_SCAN') {
      try {respond({ok:true,result:scan()});} catch(e) {respond({ok:false,error:e.message});}
      return false;
    }
    if (message.type === 'SPARK_QTI') {
      readQTI(message.ids).then(result=>respond({ok:true,result}),error=>respond({ok:false,error:String(error?.message||error)}));
      return true;
    }
    if (message.type === 'SPARK_APPLY') {
      apply(Array.isArray(message.answers)?message.answers:[])
        .then(result=>respond({ok:true,result}),err=>respond({ok:false,error:err.message}));
      return true;
    }
    if (message.type === 'SPARK_SUBMIT_NEXT') {
      submitNext(message.expected,message.goNext===true)
        .then(result=>respond({ok:true,result}),err=>respond({ok:false,error:String(err?.message||err)}));
      return true;
    }
    return false;
  });
})();
