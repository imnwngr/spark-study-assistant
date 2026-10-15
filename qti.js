/* Spark QTI Reader. Pure structural parser: never executes published scripts.
 * A QTI declaration is accepted only when it is consistent with the controls
 * present on the active Spark screen. */
(function(root){
  'use strict';
  const MAX_SOURCE=2_000_000,MAX_XML=1_000_000;
  const clean=value=>String(value??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  const norm=value=>clean(value).normalize('NFKC').toLowerCase().replace(/[’]/g,"'");
  const name=node=>node?.localName||node?.nodeName?.split(':').pop()||'';
  const children=(node,tag)=>[...(node?.children||[])].filter(el=>name(el)===tag);
  const child=(node,tag)=>children(node,tag)[0]||null;
  const descendants=(node,tag)=>[...(node?.getElementsByTagName?.('*')||[])].filter(el=>name(el)===tag);
  const attr=(node,key)=>node?.getAttribute?.(key)||'';
  const recognised=new Set(['inlineChoiceInteraction','choiceInteraction','textEntryInteraction','extendedTextInteraction','gapMatchInteraction','associateInteraction','orderInteraction','matchInteraction']);
  function assessmentsFromDataJs(source,parser){
    if(typeof source!=='string'||source.length>MAX_SOURCE||!parser?.parseFromString)return [];
    const regex=/"([^"\\]{1,120}\.xml)"\s*:\s*("(?:\\.|[^"\\])*")/g;
    const files=[];let match;
    while((match=regex.exec(source))!==null){
      let decoded;
      try{decoded=JSON.parse(match[2]);}catch{continue;}
      if(typeof decoded!=='string'||decoded.length>MAX_XML||!decoded.trimStart().startsWith('<'))continue;
      let xml;
      try{xml=parser.parseFromString(decoded,'application/xml');}catch{continue;}
      if(descendants(xml,'parsererror').length||name(xml.documentElement)!=='assessmentItem')continue;
      files.push({xml,filename:match[1]});
    }
    return files;
  }
  function xmlFromDataJs(source,parser){
    const list=assessmentsFromDataJs(source,parser);
    return list[0]||{error:typeof source!=='string'||source.length>MAX_SOURCE?'invalidData':'noAssessment'};
  }
  const interactionNodes=xml=>[...(xml?.getElementsByTagName?.('*')||[])].filter(n=>recognised.has(name(n)));
  function declaredResponses(xml){
    const map=new Map(), diagnostics=[];
    for(const el of descendants(xml,'responseDeclaration')){
      const id=attr(el,'identifier');
      const values=children(child(el,'correctResponse'),'value').map(n=>clean(n.textContent)).filter(Boolean);
      if(!id||map.has(id)){diagnostics.push('duplicateOrMissingResponseId');continue;}
      if(values.length)map.set(id,{values,baseType:attr(el,'baseType'),cardinality:attr(el,'cardinality')});
    }
    return {map,diagnostics};
  }
  function textVariants(values){
    // Spark text-gap QTI can encode accepted alternatives with a literal pipe,
    // or as multiple <value> siblings. Only the FIRST valid variant is typed.
    return values.flatMap(v=>v.split('|').map(clean)).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
  }
  function mapAssessment(xml,questions){
    const diagnostics=[],interactions=interactionNodes(xml),{map:declared,diagnostics:declErrors}=declaredResponses(xml);
    diagnostics.push(...declErrors);
    if(!Array.isArray(questions)||!questions.length||interactions.length!==questions.length){
      return {answers:[],total:questions?.length||0,interactions:interactions.length,reason:'interactionCountMismatch',diagnostics};
    }
    const answers=[];
    for(let i=0;i<interactions.length;i++){
      const el=interactions[i],q=questions[i],type=name(el),responseId=attr(el,'responseIdentifier');
      const declaration=declared.get(responseId),fail=reason=>diagnostics.push(`item${i+1}:${reason}`);
      if(!declaration){fail('missingDeclaration');continue;}
      let answer='',selectedIds=[],selectedLabels=[],choiceOptions=[],alternatives=[],pairs=[];
      if(type==='inlineChoiceInteraction'||type==='choiceInteraction'){
        const supported=type==='inlineChoiceInteraction'?q.kind==='dropdown':['choice','multi'].includes(q.kind);
        if(!supported){fail('unsupportedControl');continue;}
        const tag=type==='inlineChoiceInteraction'?'inlineChoice':'simpleChoice';
        const options=children(el,tag).map(x=>({id:attr(x,'identifier'),label:clean(x.textContent)}));
        const ids=options.map(x=>x.id),labels=options.map(x=>norm(x.label));
        if(options.length<2||ids.some(x=>!x)||new Set(ids).size!==ids.length||labels.some(x=>!x)||new Set(labels).size!==labels.length){fail('choiceMismatch');continue;}
        if(type==='inlineChoiceInteraction'){
          if(options.length!==q.options?.length ||
             labels.slice().sort().join('\u0000')!==q.options.map(norm).sort().join('\u0000')){fail('choiceMismatch');continue;}
        } else {
          // Spark shuffles radio/checkbox labels at runtime. The stable C0_1
          // identifier is part of the DOM class; never trust the QTI position.
          if(options.length!==q.choiceIds?.length ||
             ids.slice().sort().join('\u0000')!==q.choiceIds.slice().sort().join('\u0000')){fail('choiceMismatch');continue;}
          if(q.kind==='multi' && declaration.cardinality!=='multiple'){fail('cardinalityMismatch');continue;}
          if(q.kind==='choice' && declaration.values.length!==1){fail('cardinalityMismatch');continue;}
        }
        const wanted=declaration.values;
        if(!wanted.length||new Set(wanted).size!==wanted.length||wanted.some(id=>!ids.includes(id))||
          ((type==='inlineChoiceInteraction'||q.kind==='choice')&&wanted.length!==1)){fail('correctOptionMissing');continue;}
        selectedIds=wanted.slice();
        selectedLabels=wanted.map(id=>options.find(c=>c.id===id).label);
        choiceOptions=(q.choiceIds||[]).map(id=>options.find(c=>c.id===id)?.label||id);
        answer=selectedLabels.join(' | ');
      } else if(type==='textEntryInteraction'||type==='extendedTextInteraction'){
        if(q.kind!=='text'||q.options?.length||
           (declaration.cardinality && declaration.cardinality!=='single')||
           (declaration.baseType && declaration.baseType!=='string')){fail('textMismatch');continue;}
        alternatives=textVariants(declaration.values);
        if(!alternatives.length||alternatives.some(v=>v.length>400)){fail('textMismatch');continue;}
        if(/\bplay\s*,?\s*do\s*(?:or|\/)\s*go\b/i.test(q.rubric||'')&&q.wordBank){
          alternatives=alternatives.filter(v=>/^(?:play|do|go|plays|does|goes)\s+\S+/i.test(v));
          if(!alternatives.length){fail('incompleteCollocation');continue;}
        }
        answer=alternatives[0];
      } else if(type==='gapMatchInteraction'||type==='associateInteraction'){
        if(q.applyable||!['match','associate','manual'].includes(q.kind) ||
           !['directedPair','pair'].includes(declaration.baseType)||declaration.cardinality!=='multiple'){
          fail('unsupportedInteraction:'+type);continue;
        }
        const choiceNodes=[...descendants(el,'gapText'),...descendants(el,'gapImg'),...descendants(el,'gap'),...descendants(el,'simpleAssociableChoice')];
        const choices=new Map();
        for(const n of choiceNodes){const id=attr(n,'identifier');if(id && !choices.has(id))choices.set(id,clean(n.textContent)||
          (name(n)==='gap'?`Gap ${choices.size+1}`:id));}
        if(!choices.size){fail('pairChoicesMissing');continue;}
        let valid=true;
        for(const raw of declaration.values){
          const tuple=clean(raw).split(/\s+/);
          if(tuple.length!==2||!choices.has(tuple[0])||!choices.has(tuple[1])){valid=false;break;}
          pairs.push({sourceId:tuple[0],targetId:tuple[1],source:choices.get(tuple[0]),target:choices.get(tuple[1])});
        }
        if(!valid||!pairs.length){fail('pairMismatch');continue;}
        answer=pairs.map(p=>`${p.source} → ${p.target}`).join(' ; ');
      } else {fail('unsupportedInteraction:'+type);continue;}
      if(answer)answers.push({id:q.id,answer,confidence:'high',source:'qti',responseId,
        ...(selectedIds.length?{selectedIds,selectedLabels,choiceOptions}:{}),
        ...(alternatives.length?{acceptedVariants:alternatives}:{}),
        ...(pairs.length?{pairs}:{}),
        explanation:'Declared correct response in the published exercise data.'});
    }
    return {answers,total:questions.length,interactions:interactions.length,
      reason:answers.length===questions.length?'complete':'partial',diagnostics};
  }
  function finger(value){return norm(value).replace(/\[\[\d+\]\]|\[other gap\]|\[___\]/gi,' ').replace(/^[\d]+[.)]\s*/,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();}
  function paragraph(node){
    let current=node;
    for(let n=0;n<8&&current;n++,current=current.parentNode){if(name(current)==='p')return clean(current.textContent);}
    return '';
  }
  function signatureScore(xml,questions){
    const its=interactionNodes(xml); if(its.length!==questions.length)return 0;
    let total=0,available=0;
    for(let i=0;i<its.length;i++){
      const a=finger(paragraph(its[i])),b=finger(questions[i]?.context||'');
      if(!a||!b)continue;
      // Character token overlap tolerates the blank marker and counter prefix.
      const aa=a.split(' '),bb=b.split(' ');
      const bag=new Map();for(const token of aa)bag.set(token,(bag.get(token)||0)+1);
      let same=0;for(const token of bb){const n=bag.get(token)||0;if(n){bag.set(token,n-1);same++;}}
      total+=2*same/(aa.length+bb.length);available++;
    }
    return available?total/available:0;
  }
  function fromDataJs(source,questions,parser){
    if(typeof source!=='string'||source.length>MAX_SOURCE||!parser?.parseFromString)
      return {answers:[],total:questions?.length||0,reason:'invalidData',diagnostics:[]};
    const files=assessmentsFromDataJs(source,parser);
    if(!files.length)return {answers:[],total:questions?.length||0,reason:'noAssessment',diagnostics:[]};
    const candidates=files.map(f=>({...f,mapped:mapAssessment(f.xml,questions),signature:signatureScore(f.xml,questions)}));
    const viable=candidates.filter(f=>f.mapped.answers.length);
    if(!viable.length)return {...candidates[0].mapped,answers:[],reason:'noMapping',format:'QTI'};
    viable.sort((a,b)=>b.mapped.answers.length-a.mapped.answers.length||b.signature-a.signature);
    const best=viable[0],runner=viable[1];
    if(runner && best.mapped.answers.length===runner.mapped.answers.length &&
      (best.signature<0.55 || best.signature-runner.signature<0.15)){
      return {answers:[],total:questions?.length||0,reason:'ambiguousAssessment',diagnostics:['multipleQtiScreens']};
    }
    return {...best.mapped,filename:best.filename,format:'QTI',assessmentCount:files.length};
  }
  root.SparkQTI={fromDataJs,xmlFromDataJs,assessmentsFromDataJs,mapAssessment,signatureScore,norm,MAX_SOURCE};
})(typeof self!=='undefined'?self:globalThis);
