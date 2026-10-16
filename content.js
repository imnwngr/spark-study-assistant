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
      // Spark prepends a visual "." icon to radio text. Reading the entire
      // clickable div produces ".isn't" while QTI has "isn't".
      const caption=el.querySelector('.is-radiobutton-choice-text,.is-checkbox-choice-text,.choice-text,.item .text');
      const label=tidy(caption?.textContent||el.closest('label')?.innerText||
        el.parentElement?.querySelector('label')?.innerText||el.innerText||el.textContent||'')
        .replace(el.querySelector('.is-radiobutton__icon,.is-checkbox__icon') && !caption ? /^\.\s*/ : /^$/,'');
      return {node:el,id,label};
    });
    // QTI identifiers must be verifiable in the live DOM. Never infer from
    // shuffled visual position or fabricated labels.
    if(items.some(x=>!x.id)||new Set(items.map(x=>x.id)).size!==items.length)return null;
    const groups=new Set(items.map(x=>x.id.split('_')[0]));
    if(groups.size!==1)return null;
    return {kind,items,options:items.map(x=>x.label||x.id),choiceIds:items.map(x=>x.id),
      choiceLabelsVerified:items.every(x=>Boolean(x.label)&&normalized(x.label)!==normalized(x.id))};
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
    const sequence=block.closest('.interaction.os-sequence')||block.querySelector('.interaction.os-sequence');
    if(sequence){
      const tokens=[...sequence.querySelectorAll('li.os-sequence-element')].map(tile=>
        tidy(tile.querySelector('.firstword')?.textContent||tile.innerText||tile.textContent)).filter(Boolean);
      if(tokens.length)return `Sequence: ${tokens.join(' ').replace(/\s+([,.!?;:])/g,'$1')}`;
    }
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
  function screenInfo(root){
    const index=Number((root.id||'').match(/content_wrap_(\d+)/)?.[1]||0);
    const roots=[...document.querySelectorAll('.content-wrap[id^="content_wrap_"]')];
    const indices=roots.map(el=>Number(el.id.match(/^content_wrap_(\d+)$/)?.[1]));
    const reliable=indices.length>1&&indices.every(Number.isInteger)&&
      new Set(indices).size===indices.length&&Math.min(...indices)===0&&
      Math.max(...indices)===indices.length-1;
    return {index,count:reliable?indices.length:null};
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
    // A specific, answer-keyed word-correction activity is eligible even in
    // Writing skill. Essay/extended writing remains excluded.
    const correctionWidget=root.querySelector('.interaction.ic-text-correction.replace .ki24_view');
    const correctionTiles=correctionWidget?[...correctionWidget.querySelectorAll('.input-text')]:[];
    if(correctionWidget&&correctionTiles.length&& !root.querySelector('textarea,[contenteditable="true"]')){
      const id='q1';
      questions.push({id,kind:'textCorrection',context:tidy(correctionWidget.textContent).slice(0,1200),
        localContext:tidy(correctionWidget.textContent).slice(0,1200),options:[],
        correctionTokens:correctionTiles.map(t=>tidy(t.textContent)),
        correctionModifiedTokens:correctionTiles.filter(t=>t.classList.contains('modified') ||
          t.classList.contains('icTextCorrection__item--modified')).map(t=>tidy(t.textContent)),rubric,wordBank:'',hint:'',before:'',after:'',
        block:1,position:1,applyable:true});
      refs.set(id,{kind:'textCorrection',node:correctionWidget});
      const screen=screenInfo(root);
      lastScan={title,questions,refs,applied:new Map(),appliedChoiceIds:new Map(),appliedOrder:new Map(),
        submitted:false,screenIndex:screen.index,screenCount:screen.count,activeRoot:root,trustedCorrections:new Map()};
      return {title,questions,screenIndex:screen.index,screenCount:screen.count,
        frameUrl:location.origin+location.pathname,hasExercise:true};
    }
    const hasEditable=sourceBlocks.some(b=>getControls(b).length||(!deferredCategory&&choiceGroup(b)));
    const hasSequence=sourceBlocks.some(b=>b.closest('.os-sequence')||b.querySelector('.os-sequence__list'));
    for(let b=0;b<sourceBlocks.length;b++){
      const block=sourceBlocks[b];
      const group=deferredCategory?null:choiceGroup(block);
      if(group){
        const id=`q${questions.length+1}`;
        const question={id,kind:group.kind,context:tidy(block.innerText||block.textContent).slice(0,1200),
          localContext:tidy(block.innerText||block.textContent).slice(0,1200),options:group.options,
          choiceIds:group.choiceIds,choiceLabelsVerified:group.choiceLabelsVerified,rubric,wordBank:bank.text,hint:'',before:'',after:'',
          block:b+1,position:1,applyable:true};
        questions.push(question);
        refs.set(id,{kind:group.kind,items:group.items});
        continue;
      }
      const controls=getControls(block);
      if((hasEditable||hasSequence)&&!controls.length && !block.closest('.os-sequence') && !block.querySelector('.os-sequence__list'))continue; // e.g. static vocabulary reference before text gaps
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
        const sequence=block.closest('.interaction.os-sequence')||block.querySelector('.interaction.os-sequence');
        const tiles=sequence?[...sequence.querySelectorAll('li.os-sequence-element')].map(tile=>
          tidy(tile.querySelector('.firstword')?.textContent||tile.innerText||tile.textContent)).filter(Boolean):[];
        const isOrder=Boolean(sequence && tiles.length>=2) || /sequence\s*\d/i.test(context)||/\b(order|unscramble|reorder)\b/i.test(rubric);
        const isCorrection=/\b(correction|correct|mistake|error)\b/i.test(rubric)||/grammar\s*1\s*\|\s*1/i.test(title);
        questions.push({id,kind:isMatch?'match':isOrder?'order':isCorrection?'correction':'manual',
          context,options:[],rubric,wordBank:bank.text,hint:'',before:'',after:'',
          ...(isOrder&&tiles.length?{orderTokens:tiles}:{}),
          block:b+1,position:1,applyable:Boolean(isOrder && sequence && sequence.querySelector('.os-sequence__list'))});
        if(isOrder && sequence && sequence.querySelector('.os-sequence__list')) refs.set(id,{kind:'order',node:sequence});
      }
    }
    const screenMatch=(root.id||'').match(/content_wrap_(\d+)/);
    const screenIndex=screenMatch?Number(screenMatch[1]):0;
    const screenRoots=[...document.querySelectorAll('.content-wrap[id^="content_wrap_"]')];
    const indices=screenRoots.map(el=>Number(el.id.match(/^content_wrap_(\d+)$/)?.[1]));
    const reliableScreens=indices.length>1 && indices.every(Number.isInteger) &&
      new Set(indices).size===indices.length && Math.min(...indices)===0 &&
      Math.max(...indices)===indices.length-1;
    const screenCount=reliableScreens?indices.length:null;
    lastScan={title,questions,refs,applied:new Map(),appliedChoiceIds:new Map(),appliedOrder:new Map(),submitted:false,screenIndex,screenCount,activeRoot:root,trustedCorrections:new Map()};
    return {title,questions,screenIndex,screenCount,frameUrl:location.origin+location.pathname,hasExercise:questions.length>0};
  }
  // Read the complete, *currently visible* exercise as a learner sees it.
  // Never copy typed answers, XML correctResponse data, tokens, or hidden screens.
  function copyPrompt() {
    const root=activeContentRoot();
    const title=exerciseTitle();
    const rubric=tidy(root.querySelector('.layout__rubric')?.textContent ||
      document.querySelector('.layout__rubric')?.textContent);
    const blocks=[...root.querySelectorAll('.layout__content .contentblock,.interaction .contentblock')]
      .filter((block,index,array)=>array.indexOf(block)===index);
    const bank=findWordBank(root,blocks,rubric);
    const relevant=blocks.filter(block=>block!==bank.block);
    const lines=[title];
    if(rubric)lines.push('',`Instructions: ${rubric}`);
    if(bank.text)lines.push('',`Word bank: ${bank.text}`);
    let number=0;
    for(const block of relevant) {
      const controls=getControls(block);
      const group=choiceGroup(block);
      const formatted=formatBlock(block,controls)
        .replace(/\[\[\d+\]\]/g,'[____]');
      if(!formatted)continue;
      number++;
      const printed=tidy(block.querySelector('.enum')?.textContent)||String(number);
      lines.push('',`${/^\d+\.?$/.test(printed)?printed.replace(/\.$/,''):number}. ${formatted}`);
      if(group?.options.length)lines.push(`Options: ${group.options.join(' | ')}`);
      const orderTiles=block.closest('.os-sequence')?.querySelectorAll('li.os-sequence-element');
      if(orderTiles?.length)lines.push(`Tiles: ${[...orderTiles].map(n=>tidy(n.querySelector('.firstword')?.textContent||n.innerText||n.textContent)).join(' | ')}`);
      else {
        for(const [index,node] of controls.entries()) {
          const options=getOptions(node);
          if(options.length)lines.push(`Gap ${index+1} options: ${options.join(' | ')}`);
        }
      }
    }
    return {title,screenIndex:Number((root.id||'').match(/content_wrap_(\d+)/)?.[1]||0),
      questionBlocks:number,text:lines.join('\n').trim()};
  }

  function mapQtiAndRemember(source,questions){
    const result=globalThis.SparkQTI.fromDataJs(source,questions,new DOMParser());
    lastScan.trustedCorrections=new Map();
    for(const answer of result.answers||[]){
      if(questions.find(q=>q.id===answer.id)?.kind==='textCorrection' &&
        Array.isArray(answer.corrections)&&answer.corrections.length){
        lastScan.trustedCorrections.set(answer.id,answer.corrections.map(({from,to})=>({from,to})));
      }
    }
    return result;
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
    if(/\|\s*(?:speaking|writing(?: skill)?)\s*\|/i.test(lastScan.title) &&
      !(questions.length===1&&questions[0].kind==='textCorrection'))
      return {answers:[],reason:'deferredCategory'};
    if(!script || !globalThis.SparkQTI)return {answers:[],reason:'noDataScript'};
    const url = new URL(script.src);
    // Never load other origins or user-supplied endpoints.
    if(url.origin!==location.origin || !/^\/cdn_proxy\//.test(url.pathname))return {answers:[],reason:'invalidDataOrigin'};
    if(qtiCache?.url===url.href && qtiCache?.source){
      return mapQtiAndRemember(qtiCache.source,questions);
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
    return mapQtiAndRemember(source,questions);
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
  // Experimental Avallain sequence adapter. The widget can settle later than
  // the mouseup event, especially in long horizontal word sequences. Never
  // reorder DOM directly or assume a synthetic drag was persisted by Spark.
  const sequenceTiles = root => [...root.querySelectorAll('.os-sequence__list > li.os-sequence-element')]
    .filter(el => !el.classList.contains('ui-draggable-dragging'));
  const tileText = el => tidy(el.querySelector('.firstword')?.textContent || el.innerText || el.textContent);
  const sameWords = (a,b) => a.length===b.length &&
    a.map(normalized).sort().join('\0')===b.map(normalized).sort().join('\0');
  const sequenceWords = root => sequenceTiles(root).map(tileText);
  async function dragSequenceTile(source,target,before) {
    if(!source.isConnected || !target.isConnected || source===target)return false;
    if(source.classList.contains('ui-draggable-disabled') || target.classList.contains('ui-draggable-disabled'))return false;
    const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
    if(!a.width||!a.height||!b.width||!b.height)return false;
    const view=source.ownerDocument.defaultView;
    const x0=a.left+a.width/2,y0=a.top+a.height/2;
    const x1=before?b.left+b.width*.22:b.right-b.width*.22,y1=b.top+b.height/2;
    const send=(el,type,x,y,buttons)=>el.dispatchEvent(new view.MouseEvent(type,{
      bubbles:true,cancelable:true,view,button:0,buttons,clientX:x,clientY:y}));
    send(source,'mouseover',x0,y0,0);
    send(source,'mousedown',x0,y0,1);
    for(let i=1;i<=18;i++){
      const t=i/18,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t;
      const hit=source.ownerDocument.elementFromPoint(x,y)||target;
      send(hit,'mousemove',x,y,1);
      await wait(24);
    }
    send(source.ownerDocument.elementFromPoint(x1,y1)||target,'mouseup',x1,y1,0);
    return true;
  }
  async function setSequence(root,response) {
    const desired=Array.isArray(response.orderedTokens)?response.orderedTokens.map(tidy):[];
    const original=sequenceWords(root);
    if(desired.length<2 || !sameWords(original,desired))return {status:'skipped',detail:'QTI order does not match the visible tiles.'};
    const lists=[...root.querySelectorAll('.os-sequence__list')];
    if(lists.length!==1)return {status:'skipped',detail:'Sequence list is ambiguous.'};
    const list=lists[0];
    const stable=()=>[...list.children].filter(el=>el.matches('li.os-sequence-element')&&!el.classList.contains('ui-draggable-dragging'));
    if(stable().length!==desired.length)return {status:'skipped',detail:'Sequence contains unexpected tiles.'};
    const fixed=stable().map((el,i)=>el.classList.contains('ui-draggable-disabled')?i:-1).filter(i=>i>=0);
    if(fixed.some(i=>normalized(tileText(stable()[i]))!==normalized(desired[i])))
      return {status:'skipped',detail:'Fixed punctuation does not match the QTI order.'};

    // Wait for the widget's drag clone/placeholder and asynchronous reflow to
    // settle. A fixed 250ms sleep could misread an in-flight reordering as a
    // failure and force the user to press Solve again.
    async function waitForSequenceStep(position,expected,beforeIds) {
      const deadline=Date.now()+1800;
      let unchangedAt=0,previous='';
      while(Date.now()<deadline){
        const tiles=stable();
        const ids=tiles.map(el=>el.getAttribute('data-model-id')||el.id||tileText(el)).join('\u0001');
        const dragging=Boolean(list.querySelector('.ui-draggable-dragging,.drop-placeholder'));
        if(tiles.length===desired.length && !dragging &&
          normalized(tileText(tiles[position]))===normalized(expected) && ids!==beforeIds){
          // Allow Spark a final animation/frame to update its model.
          await wait(120);
          const final=stable();
          if(final.length===desired.length && normalized(tileText(final[position]))===normalized(expected))return true;
        }
        if(ids!==previous){previous=ids;unchangedAt=Date.now();}
        if(unchangedAt && Date.now()-unchangedAt>=500 && !dragging && ids===beforeIds)break;
        await wait(80);
      }
      return false;
    }

    // Retry the *same* still-unsolved position within this click, instead of
    // making the user press Solve twice. Bounded work prevents runaway drags.
    for(let i=0;i<desired.length;i++){
      let attempts=0;
      while(normalized(tileText(stable()[i]))!==normalized(desired[i])){
        const current=stable();
        if(current.length!==desired.length)return {status:'uncertain',detail:'Sequence changed during dragging.'};
        if(current[i].classList.contains('ui-draggable-disabled'))return {status:'skipped',detail:'Cannot move a fixed tile.'};
        const candidates=current.slice(i+1).filter(el=>normalized(tileText(el))===normalized(desired[i])&&!el.classList.contains('ui-draggable-disabled'));
        if(candidates.length!==1)return {status:'skipped',detail:'Ambiguous repeated word; refusing to guess tile identity.'};
        if(attempts++>=2)return {status:'uncertain',detail:'Spark did not accept the drag after two attempts; stopping safely.'};
        const beforeIds=current.map(el=>el.getAttribute('data-model-id')||el.id||tileText(el)).join('\u0001');
        const moved=await dragSequenceTile(candidates[0],current[i],true);
        if(!moved || !(await waitForSequenceStep(i,desired[i],beforeIds))){
          // The tile may have moved while the widget was settling; re-read
          // state rather than applying a second drag against stale elements.
          if(normalized(tileText(stable()[i]))===normalized(desired[i]))continue;
          if(attempts>=2)return {status:'uncertain',detail:'Spark did not confirm the synthetic drag. No DOM-only fallback was used.'};
          await wait(180);
        }
      }
    }
    const correct=sequenceWords(root).every((t,i)=>normalized(t)===normalized(desired[i]));
    return {status:correct?'filled':'uncertain',detail:correct?
      'Visible sequence verified; Spark persistence is not independently confirmed.':
      'Sequence order could not be verified.'};
  }
  // Recorded in Spark Inspector v3.3: clicking an inline token opens a
  // .tc_popup with a native input and an <a.button-submit>OK</a>. The OK click
  // commits the change to Spark's widget model; Enter alone does not.
  const visible=node=>{
    if(!node?.isConnected || node.closest('[hidden],[inert]'))return false;
    const style=getComputedStyle(node);
    return style.display!=='none'&&style.visibility!=='hidden'&&node.getClientRects().length>0;
  };
  async function waitForUniqueCorrectionPopup(parent){
    const deadline=Date.now()+1100;
    while(Date.now()<deadline){
      const popups=[...parent.querySelectorAll('.tc_popup')].filter(visible);
      if(popups.length>0)return popups.length===1?popups[0]:null;
      await wait(45);
    }
    return null;
  }
  function typeCorrectionIntoPopup(field,value){
    if(!field?.matches('input[type="text"],input:not([type]),textarea') || !visible(field))return false;
    // Keep focus until the OK control is clicked, like a real user. The old
    // generic setText() blurs early and can dismiss this popup.
    field.focus();
    const proto=field.matches('textarea')?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
    if(setter)setter.call(field,value);else field.value=value;
    field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
    return field.value===value;
  }
  async function confirmCorrection(target,expected,popup){
    const buttons=[...popup.querySelectorAll('a.button-submit,button.button-submit')]
      .filter(button=>visible(button)&&/^ok$/i.test(tidy(button.textContent)));
    if(buttons.length!==1)return false;
    const input=[...popup.querySelectorAll('input[type="text"],input:not([type]),textarea')].filter(visible);
    if(input.length!==1 || !typeCorrectionIntoPopup(input[0],expected))return false;
    // Spark's change handler may run before click when focus leaves the input.
    input[0].dispatchEvent(new Event('change',{bubbles:true}));
    buttons[0].click();
    const deadline=Date.now()+1800;
    while(Date.now()<deadline){
      if(!target.isConnected)return false;
      if(normalized(target.textContent)===normalized(expected) &&
        !target.classList.contains('editing')){
        await wait(100);
        return normalized(target.textContent)===normalized(expected);
      }
      await wait(60);
    }
    return false;
  }
  async function setTextCorrections(widget,response){
    const edits=response.corrections;
    if(!Array.isArray(edits)||!edits.length||edits.length>20 ||
      edits.some(e=>!e||typeof e.from!=='string'||typeof e.to!=='string'||
        !e.from.trim()||!e.to.trim()||normalized(e.from)===normalized(e.to)))
      return {status:'skipped',detail:'Missing validated QTI word-correction pairs.'};
    const parent=widget.closest('.ic-text-correction');
    if(!parent)return {status:'uncertain',detail:'Correction widget is missing.'};
    for(const edit of edits){
      const tokens=[...widget.querySelectorAll('.input-text')];
      const matching=tokens.filter(n=>normalized(n.textContent)===normalized(edit.from));
      const already=tokens.some(n=>normalized(n.textContent)===normalized(edit.to) &&
        (n.classList.contains('modified')||n.classList.contains('icTextCorrection__item--modified')));
      if(matching.length!==1){
        if(matching.length===0&&already)continue;
        return {status:'uncertain',detail:`Cannot uniquely locate word: ${edit.from}`};
      }
      const target=matching[0];
      if(!visible(target))return {status:'uncertain',detail:'Correction target is not visible.'};
      // An already-open unrelated correction popup is ambiguous: do not type
      // into another user's work or press an unrelated submit button.
      if([...parent.querySelectorAll('.tc_popup')].some(visible))
        return {status:'uncertain',detail:'Close the open Spark correction editor and retry.'};
      target.click();
      const popup=await waitForUniqueCorrectionPopup(parent);
      if(popup){
        const confirmed=await confirmCorrection(target,edit.to,popup);
        if(!confirmed)return {status:'uncertain',detail:`Spark popup did not confirm ${edit.from} → ${edit.to}.`};
      }else{
        // Some other correction widgets expose discrete choices instead of
        // the recorded text-entry popup. Only accept a unique real UI option.
        const choiceSelector='[role="option"],[role="menuitem"],.listbox__choice,.ui-menu-item,'+
          '.correction-option,.replace-option,[class*="correction-choice"],[class*="replacement-choice"]';
        const options=[...(parent.querySelectorAll(choiceSelector))]
          .filter(el=>visible(el)&&!el.closest('.ki24_view')&&normalized(el.textContent)===normalized(edit.to));
        if(options.length!==1)return {status:'uncertain',detail:`No unique Spark replacement control for ${edit.from}.`};
        options[0].click();
        await wait(220);
      }
      if(normalized(target.textContent)!==normalized(edit.to))
        return {status:'uncertain',detail:`Spark did not visibly apply ${edit.to}.`};
    }
    return {status:'filled',detail:'Spark accepted all visible word corrections; gradebook not confirmed.'};
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
        if(found.kind==='textCorrection'){
          const trusted=lastScan.trustedCorrections?.get(id);
          const submitted=Array.isArray(response.corrections)?response.corrections:[];
          if(!trusted||trusted.length!==submitted.length||
            trusted.some((e,i)=>normalized(e.from)!==normalized(submitted[i].from)||
              normalized(e.to)!==normalized(submitted[i].to)))
            outcome={status:'skipped',detail:'Correction pairs were not verified against this screen’s QTI.'};
          else outcome=await setTextCorrections(found.node,response);
        }
        else if(found.kind==='order')outcome=await setSequence(found.node,response);
        else if(found.kind==='dropdown')outcome=await setDropdown(found.node,value);
        else if(found.kind==='choice'||found.kind==='multi')outcome=await setChoice(found,value,response.selectedIds);
        else outcome={status:setText(found.node,value)?'filled':'uncertain',detail:'Text field updated.'};
        if(outcome.status==='filled'){
          lastScan.applied.set(id,value);
          if(found.kind==='order')lastScan.appliedOrder.set(id,response.orderedTokens.map(tidy));
          if(found.items){
            const ids=found.items.filter(item=>isChecked(item.node)).map(item=>item.id);
            lastScan.appliedChoiceIds.set(id,ids);
          }
        }else{lastScan.applied.delete(id);lastScan.appliedChoiceIds.delete(id);lastScan.appliedOrder.delete(id);}
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
  function availableActionControls(event) {
    // Spark creates hidden duplicates of each toolbar in some activities.
    // Only the single rendered, enabled control inside the learning object is safe.
    return [...document.querySelectorAll(`#activity_controls [data-event="${event}"]`)]
      .filter(actionable);
  }
  function checkSignal() {
    const available=availableActionControls('check');
    const answerStates=document.querySelectorAll('.status-correct,.status-incorrect,.is-correct,.is-incorrect,.correct-answer,.incorrect-answer').length;
    return {checkAvailable:available.length===1, answerStates};
  }
  // Verify all applied answers against live controls, not merely a successful click.
  function appliedStillMatches() {
    if(!lastScan.questions.length || lastScan.refs.size!==lastScan.questions.length ||
      lastScan.applied.size!==lastScan.questions.length ||
      lastScan.questions.some(q=>!q.applyable))return false;
    return [...lastScan.refs.entries()].every(([id,ref])=>{
      if(!(ref.items?ref.items.every(item=>document.contains(item.node)):document.contains(ref.node)))return false;
      const wanted=normalized(lastScan.applied.get(id));
      if(!wanted)return false;
      if(ref.kind==='textCorrection')return false; // Spark grading persistence not verified.
      if(ref.kind==='order'){
        const order=lastScan.appliedOrder?.get(id);
        return Array.isArray(order) && sameWords(sequenceWords(ref.node),order) &&
          sequenceWords(ref.node).every((word,i)=>normalized(word)===normalized(order[i]));
      }
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


  }

  async function submitNext(expected,goNext) {
    if(!lastScan.activeRoot||activeContentRoot()!==lastScan.activeRoot)
      return {submitted:false,reason:'submitChanged'};
    if(lastScan.submitted)return {submitted:false,reason:'submitAlready'};
    if(!Number.isInteger(expected)||expected!==lastScan.questions.length || !expected ||
      lastScan.questions.some(q=>!q.applyable||q.kind==='order')||lastScan.refs.size!==expected || lastScan.applied.size!==expected) {
      return {submitted:false,reason:'submitUnverified'};
    }
    if(!appliedStillMatches())return {submitted:false,reason:'submitChanged'};

    // Observed on the authenticated 1b | Grammar | 3 activity:
    //   submit -> Submit to Gradebook, becomes inactive after ~1.2 s
    //   forward_lo -> Next, remains actionable until clicked
    //   check -> Check Answers, hidden/disabled here
    // Use the Spark gradebook control when present, falling back to Check Answers
    // for other activity types. Never click a generic form submit button.
    const gradebook=availableActionControls('submit');
    const checks=availableActionControls('check');
    if(gradebook.length>1 || checks.length>1)return {submitted:false,reason:'submitControlMissing'};
    const mode=gradebook.length===1?'gradebook':checks.length===1?'check':null;
    if(!mode)return {submitted:false,reason:'submitControlMissing'};
    const control=mode==='gradebook'?gradebook[0]:checks[0];
    const originalRoot=lastScan.activeRoot;
    const before=checkSignal();

    // Lock before clicking to avoid a second Gradebook submission on repeated calls.
    lastScan.submitted=true;
    control.click();
    let transitioned=false;
    for(let i=0;i<22;i++){
      await wait(160);
      if(activeContentRoot()!==originalRoot)break;
      if(mode==='gradebook'){
        // Disappearance alone is NOT proof: require the *same connected button*
        // to enter the disabled/inactive state, as observed in the diagnostic.
        if(control.isConnected && (control.disabled || control.classList.contains('inactive_button'))
           && !actionable(control)){
          // Avoid advancing while a transient save-request spinner merely disables Submit.
          await wait(380);
          if(control.isConnected && (control.disabled || control.classList.contains('inactive_button'))
             && !actionable(control) && activeContentRoot()===originalRoot){
            transitioned=true;
            break;
          }
        }
      }else{
        const after=checkSignal();
        if((before.checkAvailable && !after.checkAvailable) || after.answerStates>before.answerStates){
          transitioned=true;
          break;
        }
      }
    }
    if(!transitioned){
      // The click may have reached Spark, but a server-side save is NOT established.
      // Never retry automatically or click Next on an ambiguous outcome.
      return {submitted:true,confirmed:false,nextClicked:false,mode,reason:'submitClicked'};
    }

    if(goNext){
      const candidates=availableActionControls('forward_lo');
      if(candidates.length!==1)
        return {submitted:true,confirmed:true,nextClicked:false,mode,reason:'nextControlMissing'};
      const next=candidates[0];
      // Respond before navigating, since Spark may unload this iframe on Next.
      // Recheck every guard immediately before the scheduled click.
      setTimeout(()=>{
        if(lastScan.submitted && activeContentRoot()===originalRoot &&
           actionable(next) && availableActionControls('forward_lo').length===1 &&
           (mode!=='gradebook'||(control.isConnected && !actionable(control)))){
          next.click();
        }
      },300);
      return {submitted:true,confirmed:true,nextClicked:true,mode};
    }
    return {submitted:true,confirmed:true,nextClicked:false,mode};
  }

  async function forwardScreen(expectedIndex, expectedCount) {
    if(!lastScan.activeRoot || activeContentRoot()!==lastScan.activeRoot ||
       !Number.isInteger(expectedIndex) || !Number.isInteger(expectedCount) ||
       lastScan.screenIndex!==expectedIndex || lastScan.screenCount!==expectedCount ||
       expectedCount<2 || expectedIndex<0 || expectedIndex>=expectedCount-1)
      return {advanced:false,reason:'screenBoundary'};
    if(!appliedStillMatches())return {advanced:false,reason:'screenUnverified'};
    const next=availableActionControls('forward');
    if(next.length!==1)return {advanced:false,reason:'screenForwardMissing'};
    // Spark's intra-activity navigation is `forward`, NEVER `forward_lo`.
    // Recheck before clicking to avoid advancing a changed screen.
    if(activeContentRoot()!==lastScan.activeRoot || !actionable(next[0]))
      return {advanced:false,reason:'screenChanged'};
    next[0].click();
    const deadline=Date.now()+2200;
    while(Date.now()<deadline){
      await wait(80);
      const current=activeContentRoot();
      if(current!==lastScan.activeRoot){
        const number=Number(current.id?.match(/^content_wrap_(\d+)$/)?.[1]);
        if(number===expectedIndex+1)return {advanced:true,screenIndex:number};
        return {advanced:false,reason:'unexpectedScreen'};
      }
    }
    return {advanced:false,reason:'screenTransitionUnknown'};
  }

  chrome.runtime.onMessage.addListener((message,_sender,respond) => {
    if (!message || !['SPARK_SCAN','SPARK_COPY_PROMPT','SPARK_APPLY','SPARK_PING','SPARK_SUBMIT_NEXT','SPARK_FORWARD_SCREEN','SPARK_QTI'].includes(message.type)) return false;
    if (message.type === 'SPARK_PING') {respond({ok:true,ready:true});return false;}
    if (message.type === 'SPARK_SCAN') {
      try {respond({ok:true,result:scan()});} catch(e) {respond({ok:false,error:e.message});}
      return false;
    }
    if (message.type === 'SPARK_COPY_PROMPT') {
      try {respond({ok:true,result:copyPrompt()});} catch(e){respond({ok:false,error:e.message});}
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
    if (message.type === 'SPARK_FORWARD_SCREEN') {
      forwardScreen(message.screenIndex,message.screenCount)
        .then(result=>respond({ok:true,result}),err=>respond({ok:false,error:String(err?.message||err)}));
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
