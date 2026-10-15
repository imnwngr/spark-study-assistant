/* Spark Wordbuilding inspector — paste entire file into DevTools Console on Dashboard.
 * Read-only, local report. No eval, no submission, no token or query-string output. */
(async () => {
  'use strict';
  const visited = new WeakSet();
  let active = null;
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const nodeName = n => n?.localName || n?.nodeName?.split(':').pop() || '';
  const descendants = (n, tag) => [...(n?.getElementsByTagName?.('*') || [])].filter(e => nodeName(e) === tag);
  const closestQuestion = n => n.closest?.('.contentblock,.block,.interaction') || n.parentElement;
  const path = value => { try { return new URL(value).pathname; } catch { return ''; } };

  function discover(win, depth = 0) {
    if (depth > 8 || visited.has(win) || active) return;
    visited.add(win);
    try {
      const doc = win.document;
      const script = [...doc.querySelectorAll('script[src]')].find(s => /\/data\.js$/i.test(path(s.src)));
      if (script && doc.querySelector('.layout__content,.contentblock,.interaction')) {
        active = { win, doc, script, url: new URL(script.src) };
        return;
      }
      for (const frame of doc.querySelectorAll('iframe')) if (frame.contentWindow) discover(frame.contentWindow, depth + 1);
    } catch { /* inaccessible frames are skipped */ }
  }
  discover(window);
  if (!active) { console.warn('No active exercise frame found. Open the exercise and try again.'); return; }
  const {win,doc,url} = active;
  if (url.origin !== win.location.origin || !/^\/cdn_proxy\//.test(url.pathname)) {
    console.warn('data.js is not same-origin published exercise content.');return;
  }
  const scriptResponse = await win.fetch(url.href, {credentials:'same-origin'});
  if (!scriptResponse.ok) {console.warn('data.js could not be loaded:',scriptResponse.status);return;}
  const source = await scriptResponse.text();
  if (source.length > 2_000_000) {console.warn('data.js exceeds inspection size limit.');return;}
  const expression = /"([^"\\]{1,120}\.xml)"\s*:\s*("(?:\\.|[^"\\])*")/g;
  const docs = [];
  let match;
  while ((match = expression.exec(source))) {
    try {
      const decoded = JSON.parse(match[2]);
      if (typeof decoded !== 'string' || decoded.length > 1_000_000 || !decoded.trimStart().startsWith('<')) continue;
      const xml = new DOMParser().parseFromString(decoded,'application/xml');
      if (descendants(xml,'parsererror').length || nodeName(xml.documentElement) !== 'assessmentItem') continue;
      const declarations = descendants(xml,'responseDeclaration').map(d => ({
        id: d.getAttribute('identifier'),
        baseType: d.getAttribute('baseType'),
        cardinality: d.getAttribute('cardinality'),
        values: descendants(d,'correctResponse').flatMap(c=>descendants(c,'value')).map(v=>clean(v.textContent).slice(0,150))
      }));
      // Enumerate *all* interaction tags, including vendor-specific ones.
      // The live activity may use a custom XML interaction not recognized yet.
      const interactions = descendants(xml,'itemBody').flatMap(body =>
        [...body.getElementsByTagName('*')].filter(el => /Interaction$/i.test(nodeName(el)))
      ).map(el=>({tag:nodeName(el),responseId:el.getAttribute('responseIdentifier'),parent:nodeName(el.parentElement)}));
      docs.push({filename:match[1],root:nodeName(xml.documentElement),interactions,declarations});
    } catch {/* malformed or unsupported JSON-escaped XML */}
  }
  const controls = [...doc.querySelectorAll('input,textarea,[contenteditable],[role="textbox"],select,[role="combobox"]')]
    .filter((n,i,arr)=>arr.indexOf(n)===i && !n.closest('header,#activity_controls'))
    .slice(0,40).map((el,i)=>({
      index:i+1,tag:el.tagName.toLowerCase(),type:el.getAttribute('type') || '',
      role:el.getAttribute('role') || '',contenteditable:el.getAttribute('contenteditable'),
      classes:[...el.classList].slice(0,8),
      containerClasses:[...(closestQuestion(el)?.classList || [])].slice(0,8),
      context:clean(closestQuestion(el)?.innerText||'').slice(0,180),
      visible:el.getClientRects().length>0
    }));
  const report = {
    reportType:'SPARK_WORDBUILDING_DIAGNOSTIC',version:'1.0',
    title:clean(doc.title),sourcePath:url.pathname,xmlDocuments:docs,
    contentBlocks:doc.querySelectorAll('.contentblock').length,
    rubric:clean(doc.querySelector('.layout__rubric')?.innerText).slice(0,500),
    controls
  };
  const output=JSON.stringify(report,null,2);
  console.log('=== SPARK WORDBUILDING DIAGNOSTIC ===');
  console.log(output);
  let copied=false;
  try {if (typeof copy === 'function'){copy(output);copied=true;}}catch{}
  if(!copied)try{await navigator.clipboard.writeText(output);copied=true;}catch{}
  if(!copied)try{
    const area=document.createElement('textarea');area.value=output;
    area.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(area);area.select();
    copied=document.execCommand('copy');area.remove();
  }catch{}
  if(copied)console.log('Report copied. Please review before sharing.');
  else{
    const blob=new Blob([output],{type:'application/json;charset=utf-8'});
    const href=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=href;link.download='spark-wordbuilding-diagnostic.json';document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(href),10000);
    console.log('Clipboard unavailable. Report download requested.');
  }
  return report;
})();
