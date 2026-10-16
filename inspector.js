'use strict';
const $ = id => document.getElementById(id);
const captures = [];
let tabId = null, busy = false;
const status = message => { $('status').textContent = message; };
const validSparkUrl = url => /^https:\/\/learn\.eltngl\.com\//.test(url || '');
async function connect() {
  const provided = Number(new URLSearchParams(location.search).get('tabId'));
  if (Number.isInteger(provided) && provided > 0) {
    try { const tab = await chrome.tabs.get(provided); if (validSparkUrl(tab.url)) tabId = tab.id; } catch {}
  }
  if (!tabId) {
    const tabs = await chrome.tabs.query({url:'https://learn.eltngl.com/*'});
    const match = tabs.find(tab => tab.active) || tabs[0];
    if (match && validSparkUrl(match.url)) tabId = match.id;
  }
  $('source').textContent = tabId ? `Spark tab #${tabId}` : 'No Spark tab found';
  status(tabId ? 'Ready. Open a screen in Spark and select Capture screen.' : 'Open a Spark exercise, then reopen Inspector.');
}
async function capture() {
  if (busy) return;
  busy = true; $('capture').disabled = true;
  try {
    if (!tabId) await connect();
    if (!tabId) throw Error('No Spark exercise tab found.');
    const tab = await chrome.tabs.get(tabId);
    if (!validSparkUrl(tab.url)) throw Error('Spark tab is no longer available.');
    const frames = await chrome.webNavigation.getAllFrames({tabId});
    const inspected = await Promise.all((frames || [{frameId:0}]).map(async frame => {
      const id = frame.frameId;
      try {
        let response;
        try {response = await chrome.tabs.sendMessage(tabId, {type:'SPARK_INSPECT_CAPTURE'}, {frameId:id});}
        catch {
          await chrome.scripting.executeScript({target:{tabId,frameIds:[id]},files:['inspector-content.js']});
          response = await chrome.tabs.sendMessage(tabId, {type:'SPARK_INSPECT_CAPTURE'}, {frameId:id});
        }
        return {frameId:id, parentFrameId:frame.parentFrameId ?? -1, ...(response?.ok ? response.result : {error:response?.error || 'No response'})};
      } catch(error) {return {frameId:id, error:String(error?.message || error)};}
    }));
    const captureData = {label:`screen-${captures.length + 1}`,timestamp:new Date().toISOString(),frames:inspected};
    captures.push(captureData);
    $('count').textContent = String(captures.length);
    const li = document.createElement('li');
    const candidates = inspected.filter(f => f.summary?.interactionCount);
    li.textContent = `${captureData.label} · ${candidates.map(f => `${f.title}: ${f.summary.interactionCount} interactions [${f.summary.types.join(', ')}]`).join(' | ') || 'No interactions detected'}`;
    $('captures').append(li);
    $('preview').textContent = JSON.stringify({label:captureData.label,frames:inspected.map(f => ({frameId:f.frameId,title:f.title,summary:f.summary,error:f.error}))},null,2);
    status(`Captured ${captures.length} screen(s). Change screen in Spark and capture again.`);
  } catch(error) {status(`Error: ${error.message}`);}
  finally {busy=false; $('capture').disabled=false;}
}
function exportJSON() {
  if (!captures.length) {status('Capture at least one screen before exporting.');return;}
  const data = {tool:'Spark Exercise Inspector',version:'3.1.0',exportedAt:new Date().toISOString(),captures};
  const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`spark-exercise-inspections-${Date.now()}.json`;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  status(`Exported ${captures.length} screen(s). Review the JSON before sharing.`);
}
$('capture').addEventListener('click',capture);
$('export').addEventListener('click',exportJSON);
$('clear').addEventListener('click',()=>{captures.length=0;$('captures').replaceChildren();$('count').textContent='0';$('preview').textContent='No captures yet.';status('Captures cleared.');});
connect();
