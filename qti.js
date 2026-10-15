/* Spark QTI Reader — pure parser, no eval and no remote service.
 * Only accepts explicit responseDeclaration -> correctResponse values that can
 * be mapped unambiguously to a rendered exercise interaction. */
(function(root){
  'use strict';
  const MAX_SOURCE = 2_000_000;
  const MAX_XML = 1_000_000;
  const norm = value => String(value ?? '').normalize('NFKC').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim().toLowerCase().replace(/[’]/g,"'");
  const clean = value => String(value ?? '').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  const name = node => node?.localName || node?.nodeName?.split(':').pop() || '';
  const children = (node, tag) => [...(node?.children || [])].filter(el=>name(el)===tag);
  const child = (node, tag) => children(node,tag)[0] || null;
  const descendants = (node, tag) => [...(node?.getElementsByTagName('*') || [])].filter(el=>name(el)===tag);
  const getAttr = (node,attr) => node?.getAttribute(attr) || '';
  function xmlFromDataJs(source, parser){
    if(typeof source!=='string'||source.length>MAX_SOURCE||!parser || typeof parser.parseFromString!=='function')return {error:'invalidData'};
    // The published engine packs XML text as JSON strings keyed by filename.
    // Match string literals only; never evaluate the downloaded JavaScript.
    const expression=/"([^"\\]{1,120}\.xml)"\s*:\s*("(?:\\.|[^"\\])*")/g;
    let match;
    while((match=expression.exec(source))!==null){
      let decoded;
      try{decoded=JSON.parse(match[2]);}catch{continue;}
      if(typeof decoded!=='string'||decoded.length>MAX_XML||!decoded.trimStart().startsWith('<'))continue;
      const xml=parser.parseFromString(decoded,'application/xml');
      if(descendants(xml,'parsererror').length)continue;
      if(name(xml.documentElement)==='assessmentItem')return {xml,filename:match[1]};
    }
    return {error:'noAssessment'};
  }
  function mapAssessment(xml,questions){
    const diagnostics=[];
    const recognized=['inlineChoiceInteraction','choiceInteraction','textEntryInteraction','extendedTextInteraction','orderInteraction','matchInteraction','gapMatchInteraction'];
    const interactions=[...(xml?.getElementsByTagName?.('*')||[])].filter(n=>recognized.includes(name(n)));
    const declarations=descendants(xml,'responseDeclaration');
    const ids=new Set();
    const declared=new Map();
    for(const el of declarations){
      const id=getAttr(el,'identifier');
      const values=children(child(el,'correctResponse'),'value').map(n=>clean(n.textContent)).filter(Boolean);
      if(!id||ids.has(id)){diagnostics.push('duplicateOrMissingResponseId');continue;}
      ids.add(id);
      if(values.length)declared.set(id,{values,baseType:getAttr(el,'baseType'),cardinality:getAttr(el,'cardinality')});
    }
    if(!Array.isArray(questions)||!questions.length || interactions.length!==questions.length){
      return {answers:[],total:questions?.length||0,interactions:interactions.length,reason:'interactionCountMismatch',diagnostics};
    }
    const answers=[];
    for(let i=0;i<interactions.length;i++){
      const el=interactions[i],q=questions[i];
      const responseId=getAttr(el,'responseIdentifier');
      const declaration=declared.get(responseId);
      if(!declaration){diagnostics.push(`item${i+1}:missingDeclaration`);continue;}
      let answer='';
      const kind=name(el);
      if(kind==='inlineChoiceInteraction'||kind==='choiceInteraction'){
        if(q.kind!=='dropdown'||!Array.isArray(q.options)||!q.options.length){diagnostics.push(`item${i+1}:unsupportedControl`);continue;}
        const optionTag=kind==='inlineChoiceInteraction'?'inlineChoice':'simpleChoice';
        const choices=children(el,optionTag).map(n=>({id:getAttr(n,'identifier'),text:clean(n.textContent)}));
        // The live DOM and QTI must expose exactly the same unique set of
        // labels. This guards stale content and accidental positional matches.
        if(choices.length!==q.options.length ||
          choices.some(c=>!c.id||!c.text) ||
          new Set(choices.map(c=>norm(c.text))).size!==choices.length ||
          choices.map(c=>norm(c.text)).sort().join('\u0000')!==q.options.map(norm).sort().join('\u0000') ||
          declaration.values.length!==1){diagnostics.push(`item${i+1}:choiceMismatch`);continue;}
        const correct=choices.filter(c=>c.id===declaration.values[0]);
        if(correct.length!==1){diagnostics.push(`item${i+1}:correctOptionMissing`);continue;}
        answer=q.options.find(text=>norm(text)===norm(correct[0].text))||'';
      } else if(kind==='textEntryInteraction'||kind==='extendedTextInteraction'){
        if(q.kind!=='text'||q.options?.length||declaration.values.length!==1||
          declaration.values[0].length>400){diagnostics.push(`item${i+1}:textMismatch`);continue;}
        answer=declaration.values[0];
      } else {
        // Reordering / drag-drop requires its own DOM ↔ QTI mapping evidence.
        diagnostics.push(`item${i+1}:unsupportedInteraction:${kind}`);
        continue;
      }
      if(answer)answers.push({id:q.id,answer,confidence:'high',source:'qti',responseId,explanation:'Declared correct response in the published exercise data.'});
    }
    return {answers,total:questions.length,interactions:interactions.length,reason:answers.length===questions.length?'complete':'partial',diagnostics};
  }
  function fromDataJs(source,questions,parser){
    const parsed=xmlFromDataJs(source,parser);
    if(!parsed.xml)return {answers:[],total:questions?.length||0,reason:parsed.error,diagnostics:[]};
    const mapped=mapAssessment(parsed.xml,questions);
    // Deliberately never expose raw XML or script URLs in popup messaging.
    return {...mapped,format:'QTI',filename:parsed.filename};
  }
  root.SparkQTI={fromDataJs,xmlFromDataJs,mapAssessment,norm,MAX_SOURCE};
})(typeof self!=='undefined'?self:globalThis);
