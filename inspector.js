'use strict';
const $ = id => document.getElementById(id);
const captures = [];
const recordings = [];
let tabId = null, busy = false, recording = false, recordedFrames = [];
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
  status(tabId ? 'Ready. Capture screen or start a correction interaction recording.' : 'Open a Spark exercise, then reopen Inspector.');
}
async function getFrames() {
  if (!tabId) await connect();
  if (!tabId) throw Error('No Spark exercise tab found.');
  const tab = await chrome.tabs.get(tabId);
  if (!validSparkUrl(tab.url)) throw Error('Spark tab is no longer available.');
  return (await chrome.webNavigation.getAllFrames({tabId})) || [{frameId:0,parentFrameId:-1}];
}
async function sendFrame(id, type) {
  try {
    try {return await chrome.tabs.sendMessage(tabId, {type}, {frameId:id});}
    catch {
      await chrome.scripting.executeScript({target:{tabId,frameIds:[id]},files:['inspector-content.js']});
      return await chrome.tabs.sendMessage(tabId, {type}, {frameId:id});
    }
  } catch (error) {return {ok:false,error:String(error?.message || error)};}
}
async function withBusy(task) {
  if (busy) return;
  busy = true;
  for (const id of ['capture','startTrace','stopTrace','export','clear']) $(id).disabled = true;
  try {await task();} catch(error) {status(`Error: ${error.message}`);}
  finally {busy=false;updateButtons();}
}
function updateButtons() {
  $('startTrace').disabled = busy || recording;
  $('stopTrace').disabled = busy || !recording;
  $('capture').disabled = busy;
  $('export').disabled = busy;
  $('clear').disabled = busy;
  $('recordState').textContent = recording ? 'Recording interaction…' : 'Not recording';
  $('recordCount').textContent = String(recordings.length);
}
async function capture() {
  await withBusy(async () => {
    const frames = await getFrames();
    const inspected = await Promise.all(frames.map(async frame => {
      const response = await sendFrame(frame.frameId,'SPARK_INSPECT_CAPTURE');
      return {frameId:frame.frameId, parentFrameId:frame.parentFrameId ?? -1,
        ...(response?.ok ? response.result : {error:response?.error || 'No response'})};
    }));
    const captureData = {label:`screen-${captures.length + 1}`,timestamp:new Date().toISOString(),frames:inspected};
    captures.push(captureData);
    $('count').textContent = String(captures.length);
    const li = document.createElement('li');
    const candidates = inspected.filter(f => f.summary?.interactionCount);
    li.textContent = `${captureData.label} · ${candidates.map(f => `${f.title}: ${f.summary.interactionCount} interactions [${f.summary.types.join(', ')}]`).join(' | ') || 'No interactions detected'}`;
    $('captures').append(li);
    $('preview').textContent = JSON.stringify({label:captureData.label,frames:inspected.map(f => ({frameId:f.frameId,title:f.title,summary:f.summary,error:f.error}))},null,2);
    status(`Captured ${captures.length} screen(s). ${recording ? 'Interaction recording is active.' : 'Change screen in Spark and capture again.'}`);
  });
}
async function startRecording() {
  await withBusy(async () => {
    const frames = await getFrames();
    const started = await Promise.all(frames.map(async frame => ({frameId:frame.frameId, parentFrameId:frame.parentFrameId ?? -1,
      response:await sendFrame(frame.frameId, 'SPARK_INSPECT_TRACE_START')})));
    recordedFrames = started.filter(f => f.response?.ok).map(({frameId,parentFrameId}) => ({frameId,parentFrameId}));
    if (!recordedFrames.length) throw Error('Could not attach recorder to any Spark frame.');
    recording = true;
    status(`Recording on ${recordedFrames.length} frame(s). Click a wrong word, edit it manually, confirm, then select Stop recording.`);
  });
}
async function finishRecording() {
  if (!recording) return;
  const frames = recordedFrames.slice();
  // Freeze all recorders before fetching their final reports.
  await Promise.all(frames.map(f => sendFrame(f.frameId,'SPARK_INSPECT_TRACE_STOP')));
  const fetched = await Promise.all(frames.map(async f => {
    const response = await sendFrame(f.frameId,'SPARK_INSPECT_TRACE_GET');
    return {frameId:f.frameId,parentFrameId:f.parentFrameId,
      ...(response?.ok ? response.result : {error:response?.error || 'Trace unavailable (frame may have reloaded)'})};
  }));
  const recordingData = {label:`interaction-${recordings.length + 1}`,timestamp:new Date().toISOString(),frames:fetched};
  recordings.push(recordingData);
  recording = false;
  recordedFrames = [];
  const meaningful = fetched.filter(f => f.eventCount > 2);
  const total = meaningful.reduce((sum,f) => sum + (f.eventCount || 0),0);
  status(`Saved interaction ${recordings.length}: ${total} events in ${meaningful.length} active frame(s). Export JSON to share.`);
}
async function stopRecording() {await withBusy(finishRecording);}
async function exportJSON() {
  await withBusy(async () => {
    if (recording) await finishRecording();
    if (!captures.length && !recordings.length) {status('Capture a screen or record an interaction before exporting.');return;}
    const data = {tool:'Spark Exercise Inspector',version:'3.2.0',exportedAt:new Date().toISOString(),captures,recordings};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`spark-exercise-inspections-${Date.now()}.json`;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    status(`Exported ${captures.length} screen(s) and ${recordings.length} interaction recording(s). Review JSON before sharing.`);
  });
}
async function clearAll() {
  await withBusy(async () => {
    let frameIds = [];
    try {frameIds = (await getFrames()).map(f=>f.frameId);} catch {}
    await Promise.all([...new Set([...frameIds,...recordedFrames.map(f=>f.frameId)])]
      .map(id=>sendFrame(id,'SPARK_INSPECT_TRACE_CLEAR')));
    captures.length=0;recordings.length=0;recordedFrames=[];recording=false;
    $('captures').replaceChildren();$('count').textContent='0';$('preview').textContent='No captures yet.';
    status('Captures and interaction recordings cleared.');
  });
}
$('capture').addEventListener('click',capture);
$('startTrace').addEventListener('click',startRecording);
$('stopTrace').addEventListener('click',stopRecording);
$('export').addEventListener('click',exportJSON);
$('clear').addEventListener('click',clearAll);
updateButtons();
connect();
