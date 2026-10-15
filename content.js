(() => {
  'use strict';
  if (globalThis.__sparkStudyAssistantLoaded) return;
  globalThis.__sparkStudyAssistantLoaded = true;
  let lastScan = { title: '', questions: [], refs: new Map(), applied:new Map(), submitted:false };
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
  function scan() {
    const questions = [];
    const refs = new Map();
    const blocks = [...document.querySelectorAll('.layout__content .contentblock, .interaction .contentblock')]
      .filter((n,i,a) => a.indexOf(n) === i);
    const title = exerciseTitle();
    const rubric = tidy(document.querySelector('.layout__rubric')?.textContent).slice(0,500);
    const sourceBlocks = blocks.length ? blocks :
      [...document.querySelectorAll('.layout__content .interaction')].slice(0,3);
    for (let b = 0; b < sourceBlocks.length; b++) {
      const block = sourceBlocks[b];
      const controls = getControls(block);
      const context = formatBlock(block, controls);
      if (!context) continue;
      if (controls.length) {
        controls.forEach((node,index) => {
          const id = `q${questions.length + 1}`;
          const kind = getKind(node);
          const extra = around(context,index);
          const localContext = context.replace(/\[\[\d+\]\]/g, token => token === `[[${index + 1}]]` ? "[[1]]" : "[other gap]");
          const options = kind === 'dropdown' ? getOptions(node) : [];
          const question = {id,kind,context,localContext,options,rubric,hint:extra.hint,before:extra.before,after:extra.after,
            block:b + 1,position:index + 1,applyable:true};
          questions.push(question);
          refs.set(id, {node,kind,options});
        });
      } else {
        // Static exercises can still be answered/copied, but are not silently edited.
        const id = `q${questions.length + 1}`;
        const isOrder = /sequence\s*\d/i.test(context) || /\b(order|unscramble|reorder)\b/i.test(rubric);
        const isCorrection = /\b(correction|correct|mistake|error)\b/i.test(rubric) || /grammar\s*1\s*\|\s*1/i.test(title);
        questions.push({id, kind:isOrder?'order':isCorrection?'correction':'manual', context,
          options:[], rubric, hint:'',before:'',after:'',block:b + 1,position:1, applyable:false});
      }
    }
    lastScan = {title,questions,refs,applied:new Map(),submitted:false};
    return {title,questions,frameUrl:location.origin + location.pathname, hasExercise:questions.length > 0};
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
  async function apply(answers) {
    const results = [];
    for (const response of answers) {
      const id = response.id;
      const value = tidy(response.answer);
      const found = lastScan.refs.get(id);
      if (!value) {lastScan.applied.delete(id);results.push({id,status:'skipped',detail:'Không có đáp án.'});continue;}
      if (!found) {lastScan.applied.delete(id);results.push({id,status:'manual',detail:'Dạng này chưa hỗ trợ tương tác tự động; dùng đáp án xem trước.'});continue;}
      if (!document.contains(found.node)) {lastScan.applied.delete(id);results.push({id,status:'skipped',detail:'Bài đã thay đổi. Hãy quét lại.'});continue;}
      try {
        let outcome;
        if (found.kind === 'dropdown') outcome=await setDropdown(found.node,value);
        else outcome={status:setText(found.node,value)?'filled':'uncertain',detail:'Text field updated.'};
        if(outcome.status==='filled') lastScan.applied.set(id,value);else lastScan.applied.delete(id);
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
    if(lastScan.submitted)return {submitted:false,reason:'submitAlready'};
    if(!Number.isInteger(expected)||expected!==lastScan.questions.length || !expected ||
      lastScan.questions.some(q=>!q.applyable)||lastScan.refs.size!==expected || lastScan.applied.size!==expected) {
      return {submitted:false,reason:'submitUnverified'};
    }
    // A manual change after filling invalidates the verification: re-read actual DOM values.
    const consistent=[...lastScan.refs.entries()].every(([id,ref])=>{
      if(!document.contains(ref.node))return false;
      const wanted=normalized(lastScan.applied.get(id));
      if(!wanted)return false;
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
