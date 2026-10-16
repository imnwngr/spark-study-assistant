'use strict';
const $ = id => document.getElementById(id);
const captures = [];
const recordings = [];
const coverageHistory = [];
let tabId = null, busy = false, recording = false;
let recordedFrames = new Map();
let pollTimer = null, sessionTimeout = null, pollBusy = false, recordingStartedAt = null, recordingMode = 'idle';
let lastInventory = [], lastCoverageError = null, traceBefore = [];
const TRACE_VERSION = '3.4.0';
const status = message => { $('status').textContent = message; };
const validSparkUrl = url => /^https:\/\/learn\.eltngl\.com\//.test(url || '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clean = (value, size = 110) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, size);

async function connect() {
  const provided = Number(new URLSearchParams(location.search).get('tabId'));
  if (Number.isInteger(provided) && provided > 0) {
    try {const tab = await chrome.tabs.get(provided); if (validSparkUrl(tab.url)) tabId = tab.id;} catch {}
  }
  if (!tabId) {
    const tabs = await chrome.tabs.query({url:'https://learn.eltngl.com/*'});
    const match = tabs.find(tab => tab.active) || tabs[0];
    if (match && validSparkUrl(match.url)) tabId = match.id;
  }
  if (tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      $('source').textContent = `Spark tab #${tabId} · ${clean(tab.title, 55)}`;
    } catch { $('source').textContent = `Spark tab #${tabId}`; }
  } else $('source').textContent = 'No Spark tab found';
  status(tabId ? 'Ready. Open an exercise in Spark before starting the recorder.' : 'Open a Spark exercise, then reopen Inspector.');
}
async function getFrames() {
  if (!tabId) await connect();
  if (!tabId) throw Error('No Spark exercise tab found.');
  const tab = await chrome.tabs.get(tabId);
  if (!validSparkUrl(tab.url)) throw Error('Selected tab is no longer a Spark page. Reopen Inspector from the right Spark tab.');
  return (await chrome.webNavigation.getAllFrames({tabId})) || [{frameId:0,parentFrameId:-1}];
}
async function sendFrame(id, type, allowInject = true) {
  try {
    try {return await chrome.tabs.sendMessage(tabId, {type}, {frameId:id});}
    catch (first) {
      if (!allowInject) throw first;
      await chrome.scripting.executeScript({target:{tabId,frameIds:[id]},files:['inspector-content.js']});
      return await chrome.tabs.sendMessage(tabId, {type}, {frameId:id});
    }
  } catch (error) {return {ok:false,error:String(error?.message || error)};}
}
// Executed inside each accessible iframe. No DOM writes, application commands or response values.
function inspectLiveFrame() {
  const url = (() => {try {return location.origin + location.pathname;} catch {return null;}})();
  return {title: document.title.slice(0,110), url,
    readyState:document.readyState,
    correctionWidgets:document.querySelectorAll('.interaction.ic-text-correction').length,
    interactionCount:document.querySelectorAll('.interaction').length,
    interactionTypes:[...new Set([...document.querySelectorAll('.interaction')].map(el =>
      [...el.classList].find(cls => /^(?:is-|ic-|os-|pp-)/.test(cls)) || 'unknown'))].slice(0,16),
    visibleEditors:[...document.querySelectorAll('input,textarea,[contenteditable="true"]')].filter(el => !!el.getClientRects().length).length};
}
async function getInventory() {
  const nav = await getFrames();
  const mapped = new Map(nav.map(f => [f.frameId, {frameId:f.frameId,parentFrameId:f.parentFrameId ?? -1, fromNavigation:true}]));
  let injectionError = null;
  try {
    const live = await chrome.scripting.executeScript({target:{tabId,allFrames:true},func:inspectLiveFrame});
    for (const frame of live || []) {
      const record = mapped.get(frame.frameId) || {frameId:frame.frameId,parentFrameId:null,fromNavigation:false};
      Object.assign(record,frame.result || {},{accessible:true});
      mapped.set(frame.frameId,record);
    }
  } catch (e) {injectionError = String(e?.message || e);}
  const result = [...mapped.values()].sort((a,b) => a.frameId-b.frameId);
  if (injectionError) {
    // Fallback: content scripts may already be present when all-frame script injection is restricted.
    for (const frame of result) {
      const probe = await sendFrame(frame.frameId,'SPARK_INSPECT_PROBE',false);
      if (probe?.ok) Object.assign(frame,probe.result,{accessible:true});
    }
  }
  lastInventory = result;
  lastCoverageError = injectionError;
  const widgets = result.reduce((sum,f) => sum+(f.correctionWidgets || 0),0);
  const interactions = result.reduce((sum,f) => sum+(f.interactionCount || 0),0);
  $('coverage').textContent = `${result.length} iframe(s) · ${result.filter(f=>f.accessible).length} accessible · ${interactions} interaction(s) · ${widgets} correction widget(s)`;
  $('framePreview').textContent = JSON.stringify({tabId,frames:result,probeError:injectionError},null,2);
  return result;
}
function updateButtons() {
  $('startTrace').disabled = busy || recording;
  $('stopTrace').disabled = busy || !recording;
  $('capture').disabled = busy;
  $('export').disabled = busy;
  $('clear').disabled = busy;
  $('recordState').textContent = recording ?
    (recordingMode === 'active' ? `Recording in ${[...recordedFrames.values()].filter(f=>!f.lostOnReload).length} exercise iframe(s)` : 'Waiting for exercise iframe…') : 'Not recording';
  $('recordCount').textContent = String(recordings.length);
}
async function withBusy(task) {
  if (busy) return;
  busy = true; updateButtons();
  try {await task();} catch (error) {status(`Error: ${error.message}`);}
  finally {busy=false;updateButtons();}
}
function addCoverageRecord(event, inventory) {
  const record = {at:new Date().toISOString(),event,frameCount:inventory.length,
    accessibleCount:inventory.filter(f=>f.accessible).length,
    correctionFrames:inventory.filter(f=>f.correctionWidgets>0).map(f=>({frameId:f.frameId,title:f.title,url:f.url,correctionWidgets:f.correctionWidgets})),
    exerciseFrames:inventory.filter(f=>f.interactionCount>0).map(f=>({frameId:f.frameId,title:f.title,url:f.url,interactionCount:f.interactionCount,interactionTypes:f.interactionTypes||[]})),
    errors:lastCoverageError};
  // Preserve transitions only, not a repetitive polling log.
  const previous = coverageHistory[coverageHistory.length-1];
  if (event !== 'poll' || !previous || JSON.stringify({...previous,at:null}) !== JSON.stringify({...record,at:null})) {
    if (coverageHistory.length >= 50) coverageHistory.shift();
    coverageHistory.push(record);
  }
}
async function snapshotFrames(inventory) {
  return Promise.all(inventory.map(async frame => {
    const response=await sendFrame(frame.frameId,'SPARK_INSPECT_CAPTURE');
    return {frameId:frame.frameId,parentFrameId:frame.parentFrameId ?? -1,
      ...(response?.ok ? response.result : {error:response?.error || 'No response'})};
  }));
}
async function capture() {
  await withBusy(async () => {
    const inventory = await getInventory();
    addCoverageRecord('capture',inventory);
    const inspected = await snapshotFrames(inventory);
    const captureData = {label:`screen-${captures.length + 1}`,timestamp:new Date().toISOString(),frames:inspected};
    captures.push(captureData);
    $('count').textContent = String(captures.length);
    const li=document.createElement('li');
    const found=inspected.filter(f=>f.summary?.interactionCount);
    li.textContent=`${captureData.label} · ${found.map(f=>`${f.title}: ${f.summary.interactionCount} interactions [${f.summary.types.join(', ')}]`).join(' | ') || 'No interactions detected (check frame coverage)'}`;
    $('captures').append(li);
    $('preview').textContent=JSON.stringify({label:captureData.label,frames:inspected.map(f=>({frameId:f.frameId,title:f.title,summary:f.summary,error:f.error}))},null,2);
    status(found.length ? `Captured ${captures.length} screen(s). Change screen in Spark and capture again.` : 'Captured, but no exercise interactions were found. Check iframe coverage below.');
  });
}
async function pollFrameCoverage() {
  if (!recording || pollBusy) return;
  pollBusy=true;
  try {
    const inventory = await getInventory();
    addCoverageRecord('poll',inventory);
    const exerciseFrames = inventory.filter(f=>f.interactionCount>0 && f.accessible);
    for (const frame of exerciseFrames) {
      const probe = await sendFrame(frame.frameId,'SPARK_INSPECT_PROBE');
      if (!probe?.ok) continue;
      const instance = probe.result.instanceId;
      const previous = recordedFrames.get(frame.frameId);
      if (previous?.instanceId === instance) {
        // Keep a rolling snapshot so a frame reload cannot erase an entire diagnostic trace.
        const latest = await sendFrame(frame.frameId,'SPARK_INSPECT_TRACE_GET',false);
        if (latest?.ok) previous.cachedTrace = latest.result;
        continue;
      }
      const started = await sendFrame(frame.frameId,'SPARK_INSPECT_TRACE_START');
      if (!started?.ok) continue;
      if (previous && previous.instanceId !== instance) {
        previous.lostOnReload = true;
        // Preserve old generation diagnostics. A later navigation cannot restore its trace.
        recordedFrames.set(`${frame.frameId}:old:${previous.instanceId}`,previous);
      }
      recordedFrames.set(frame.frameId,{
        frameId:frame.frameId,parentFrameId:frame.parentFrameId ?? -1,instanceId:instance,
        title:frame.title,url:frame.url,interactionTypes:frame.interactionTypes||[],attachedAt:new Date().toISOString()
      });
    }
    const attached = [...recordedFrames.values()].filter(f=>!f.lostOnReload);
    if (attached.length) {
      recordingMode='active';
      status(`Recording in ${attached.length} exercise frame(s). Perform one normal answer interaction, then Stop recording.`);
    } else {
      recordingMode='waiting';
      status('Waiting: no accessible exercise interaction detected. Open the desired exercise and wait until coverage shows 1+ interaction before editing.');
    }
    updateButtons();
  } catch (error) {status(`Recorder coverage error: ${error.message}`);}
  finally {pollBusy=false;}
}
async function startRecording() {
  await withBusy(async () => {
    await getFrames();
    recordedFrames = new Map();
    recordingStartedAt = new Date().toISOString();
    recordingMode='waiting';
    recording=true;
    await pollFrameCoverage();
    traceBefore = await snapshotFrames(lastInventory);
    pollTimer=setInterval(() => {void pollFrameCoverage();},850);
    sessionTimeout=setTimeout(() => {if(recording) void stopRecording();},180000);
    updateButtons();
  });
}
async function finishRecording() {
  if (!recording) return;
  recording=false;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer=null;
  if (sessionTimeout) clearTimeout(sessionTimeout);
  sessionTimeout=null;
  // Let any in-progress coverage poll finish before collecting frames.
  for (let i=0;i<15 && pollBusy;i++) await sleep(40);
  const frames=[...recordedFrames.values()];
  await Promise.all(frames.filter(f=>!f.lostOnReload).map(f=>sendFrame(f.frameId,'SPARK_INSPECT_TRACE_STOP',false)));
  const fetched=await Promise.all(frames.map(async f=>{
    const {cachedTrace,...meta}=f;
    if (f.lostOnReload) return {...meta,...(cachedTrace || {eventCount:0,events:[]}),warning:'Frame reloaded; recovered the last available partial trace.'};
    const response=await sendFrame(f.frameId,'SPARK_INSPECT_TRACE_GET',false);
    return {...meta,...(response?.ok ? response.result : cachedTrace || {eventCount:0,events:[],error:response?.error || 'Trace unavailable (frame may have reloaded)'})};
  }));
  const meaningful=fetched.filter(f=>{
    const events=f.events || [];
    // General trace means the user interacted, not that an answer was graded correct.
    return events.some(e=>['click','input','change','drop','dragend','pointerup','keydown','submit'].includes(e.type));
  });
  let traceAfter=[];
  try {traceAfter = await snapshotFrames(await getInventory());} catch {}
  const total=meaningful.reduce((sum,f)=>sum+(f.eventCount||0),0);
  const saved={label:`interaction-${recordings.length+1}`,timestamp:new Date().toISOString(),startedAt:recordingStartedAt,
    verified:meaningful.length>0,
    verificationScope:'interaction-events-observed-only; not answer correctness',
    warning:meaningful.length ? null : 'No exercise interaction events were recorded. Inspect the before/after snapshots and frame coverage; retry with the exercise visible.',
    frames:fetched,coverage:coverageHistory.slice(),screens:{before:traceBefore,after:traceAfter}};
  recordings.push(saved);
  recordedFrames=new Map();traceBefore=[];recordingMode='idle';
  if (meaningful.length) status(`Saved ${total} events from ${meaningful.length} exercise frame(s), plus before/after screen snapshots. Export JSON.`);
  else status('No exercise interaction recorded. Before/after screen snapshots were saved; check frame diagnostics and retry.');
}
async function stopRecording() {await withBusy(finishRecording);}
async function exportJSON() {
  await withBusy(async () => {
    if (recording) await finishRecording();
    if (!captures.length && !recordings.length) {status('Capture a screen or record an interaction before exporting.');return;}
    const data={tool:'Spark Exercise Inspector',version:TRACE_VERSION,exportedAt:new Date().toISOString(),
      sourceTabId:tabId,framesLastSeen:lastInventory,frameProbeError:lastCoverageError,coverage:coverageHistory,captures,recordings};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`spark-exercise-inspections-${Date.now()}.json`;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    status(`Exported ${captures.length} screen(s) and ${recordings.length} recording(s). Check warnings and review text before sharing.`);
  });
}
async function clearAll() {
  await withBusy(async () => {
    if (recording) await finishRecording();
    let frameIds=[];
    try {frameIds=(await getFrames()).map(f=>f.frameId);} catch {}
    await Promise.all([...new Set(frameIds)].map(id=>sendFrame(id,'SPARK_INSPECT_TRACE_CLEAR',false)));
    captures.length=0;recordings.length=0;coverageHistory.length=0;recordedFrames=new Map();traceBefore=[];
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
