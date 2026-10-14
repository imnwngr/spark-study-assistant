importScripts('solver.js', 'providers.js');
'use strict';

const MAX_QUESTIONS = 100;
const API_TIMEOUT_MS = 50000;

function errMessage(error) {
  return String(error?.message || error || 'Lỗi không xác định').slice(0,250);
}

async function solveWithProfile(payload, profile) {
  const p=SparkProviders.validateProfile(profile);
  const pattern=SparkProviders.originPattern(p.endpoint);
  if(!await chrome.permissions.contains({origins:[pattern]})) {
    throw new Error(`Chưa cấp quyền truy cập máy chủ cho “${p.name}”. Mở Cài đặt và Lưu để cấp quyền.`);
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),API_TIMEOUT_MS);
  try {
    const headers={'Content-Type':'application/json'};
    // Local Ollama needs no secret; remote compatible services use Bearer authentication.
    if(p.apiKey)headers.Authorization=`Bearer ${p.apiKey}`;
    const response=await fetch(p.endpoint,{
      method:'POST',headers,signal:controller.signal,redirect:'error',
      body:JSON.stringify(SparkProviders.requestBody(p,payload))
    });
    let body;
    try {body=await response.json();}
    catch {throw new Error(`Máy chủ trả HTTP ${response.status}, không phải JSON.`);}
    if(!response.ok) {
      // Do not echo arbitrary server content which might include credentials.
      const serverCode=typeof body?.error?.code==='string'?body.error.code.slice(0,80):'';
      throw new Error(`HTTP ${response.status}${serverCode?' ('+serverCode+')':''}. Kiểm tra endpoint, model, key và định dạng JSON.`);
    }
    const raw=SparkProviders.parseContent(body?.choices?.[0]?.message?.content);
    return {profile:p,answers:SparkProviders.normalizeAnswers(payload,raw,p)};
  } finally {clearTimeout(timeout);}
}

async function runSolver(payload) {
  if(!payload||!Array.isArray(payload.questions)||payload.questions.length>MAX_QUESTIONS ||
    payload.questions.some(q=>!q||typeof q.id!=='string'||typeof q.context!=='string')) {
    throw new Error('Dữ liệu bài tập không hợp lệ hoặc quá dài.');
  }
  if(chrome.storage.local.setAccessLevel)await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  const storage=await chrome.storage.local.get(['aiProfiles','aiMode','activeProfileId','apiKey','model','useAI']);
  const settings=SparkProviders.normalizeSettings(storage);
  const offline=SparkSolver.solve(payload);
  const selected=SparkProviders.selectedProfiles(settings);
  if(settings.aiMode==='offline'||!selected.length)return offline;
  if(settings.aiMode==='single') {
    try {
      const solved=await solveWithProfile(payload,selected[0]);
      return {answers:solved.answers,mode:'ai',provider:solved.profile.name};
    } catch(error) {
      return {...offline,warning:`API “${selected[0].name}” không khả dụng (${errMessage(error)}). Đã dùng quy tắc offline.`};
    }
  }
  const settled=await Promise.allSettled(selected.map(p=>solveWithProfile(payload,p)));
  const successes=[];
  const failures=[];
  for(let i=0;i<settled.length;i++) {
    if(settled[i].status==='fulfilled')successes.push(settled[i].value);
    else failures.push({name:selected[i].name,reason:errMessage(settled[i].reason)});
  }
  if(!successes.length) {
    return {...offline,warning:'Tất cả API đều thất bại. '+failures.map(f=>`${f.name}: ${f.reason}`).join(' | ')};
  }
  const compared=SparkProviders.mergeComparison(payload,successes,failures);
  if(failures.length)compared.warning=failures.map(f=>`${f.name}: ${f.reason}`).join(' | ');
  return compared;
}

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(msg?.type!=='SPARK_SOLVE')return false;
  runSolver(msg.payload)
    .then(result=>sendResponse({ok:true,result}),error=>sendResponse({ok:false,error:errMessage(error)}));
  return true;
});
