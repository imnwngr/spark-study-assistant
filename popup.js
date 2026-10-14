'use strict';
const $ = id => document.getElementById(id);
const state = {tabId:null,frameId:null,questions:[],title:'',answers:new Map(), solved:false};
const normalized = s=>String(s||'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
function status(message,type='normal') {
  const container=$('status');
  container.className='status '+type;
  container.querySelector('.status-message').textContent=message;
}
function progress(phase){
  const phases=['scan','solve','apply'], index=phases.indexOf(phase);
  document.querySelectorAll('.progress-step').forEach((item,i)=>{
    item.classList.toggle('is-current',i===index);
    item.classList.toggle('is-done',i<index);
    if(i===index)item.setAttribute('aria-current','step');
    else item.removeAttribute('aria-current');
  });
}
function el(tag,className,text) {const node=document.createElement(tag); if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
const errString = e=>e?.message||String(e);
async function sendFrame(frameId,message) {
  try {return await chrome.tabs.sendMessage(state.tabId,message,{frameId});}
  catch (err) {
    // An extension added while the tab was already loaded has no content scripts there.
    try {
      await chrome.scripting.executeScript({target:{tabId:state.tabId,frameIds:[frameId]},files:['content.js']});
      return await chrome.tabs.sendMessage(state.tabId,message,{frameId});
    } catch {return {ok:false,error:errString(err)};}
  }
}
async function scanPage() {
  $('scan').disabled=true;
  state.questions=[];state.answers=new Map();state.solved=false;
  $('results').hidden=true;
  document.body.classList.remove('has-results');
  $('emptyState').hidden=false;
  progress('scan');
  $('fillReport').textContent='';
  status('Đang tìm bài tập trong các iframe…');
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id || !/^https:\/\/learn\.eltngl\.com\//.test(tab.url||'')) throw new Error('Hãy mở trang learn.eltngl.com chứa bài tập trước.');
    state.tabId=tab.id;
    const frames = await chrome.webNavigation.getAllFrames({tabId:tab.id});
    const targets=frames?.length?frames.map(f=>f.frameId):[0];
    const responses=await Promise.all(targets.map(async frameId=>({frameId,response:await sendFrame(frameId,{type:'SPARK_SCAN'})})));
    const candidates=responses.filter(x=>x.response?.ok && x.response.result?.questions?.length);
    if(!candidates.length) throw new Error('Không tìm thấy bài tập. Hãy chờ bài tải xong, bấm quét lại hoặc tải lại trang.');
    candidates.sort((a,b)=>b.response.result.questions.length-a.response.result.questions.length);
    const selected=candidates[0];
    state.frameId=selected.frameId;
    state.title=selected.response.result.title;
    state.questions=selected.response.result.questions;
    state.answers=new Map();state.solved=false;
    $('title').textContent=state.title;
    $('count').textContent=`${state.questions.length} ô/câu được nhận diện · frame ${state.frameId}`;
    $('results').hidden=false;
    document.body.classList.add('has-results');
    $('emptyState').hidden=true;
    progress('solve');
    $('apply').disabled=true;
    render();
    status('Đã đọc bài tập. Chọn “Giải bài” để tạo đáp án.','success');
    return true;
  } catch(error) {status(errString(error),'error');return false;}
  finally {$('scan').disabled=false;}
}
function render() {
  const root=$('questions');root.replaceChildren();
  for(const [index,q] of state.questions.entries()) {
    const card=el('details','question-card');
    card.open=index===0;
    card.id='card-'+q.id;
    const head=el('summary','question-head');
    head.append(el('span','question-index',String(index+1).padStart(2,'0')));
    const main=el('span','question-headline');
    main.append(el('span','question-label',`Câu ${index+1}`));
    const short=(q.localContext||q.context||'').replace(/\s+/g,' ').trim();
    main.append(el('span','question-summary',short));
    const end=el('span','question-end');
    const badge=el('span','question-answer-badge','Đã có đáp án');badge.hidden=true;badge.id='badge-'+q.id;
    const chevron=document.createElementNS('http://www.w3.org/2000/svg','svg');
    chevron.setAttribute('class','ui-icon question-chevron');chevron.setAttribute('viewBox','0 0 24 24');
    const poly=document.createElementNS('http://www.w3.org/2000/svg','path');poly.setAttribute('d','m6 9 6 6 6-6');chevron.append(poly);
    end.append(badge,chevron);head.append(main,end);card.append(head);
    const body=el('div','question-body');
    body.append(el('span','question-kind',{
      dropdown:'CHỌN ĐÁP ÁN',text:'ĐIỀN TỪ',order:'SẮP XẾP',correction:'SỬA LỖI',manual:'NỘI DUNG'
    }[q.kind]||'BÀI TẬP'));
    body.append(el('p','question-text',q.localContext||q.context));
    if(q.options?.length) body.append(el('p','options-preview',`Lựa chọn: ${q.options.join(' · ')}`));
    const line=el('div','answer-line');
    const lbl=el('label','','Đáp án');lbl.setAttribute('for','answer-'+q.id);
    let input;
    if(q.options?.length) {
      input=el('select','answer-input');
      const blank=el('option','','— Chọn đáp án —');blank.value=''; input.append(blank);
      for(const opt of q.options){const optEl=el('option','',opt);optEl.value=opt;input.append(optEl);}
    } else {
      input=el('input','answer-input');input.type='text';input.placeholder='Giải bài hoặc tự nhập';
    }
    input.id='answer-'+q.id;
    input.addEventListener('input',()=>{
      const prev=state.answers.get(q.id)||{};
      state.answers.set(q.id,{...prev,id:q.id,answer:input.value,confidence:'high',source:'user',explanation:'Đã chỉnh sửa thủ công.'});
      updateCardState(q.id,input.value);
      $('apply').disabled=false;
    });
    line.append(lbl,input);body.append(line);
    const hint=el('p','explanation');hint.id='explain-'+q.id;
    if(!q.applyable) hint.textContent='Dạng này cần sao chép và thao tác thủ công trên Spark.';
    const alternatives=el('div','alternatives');alternatives.id='alts-'+q.id;
    body.append(hint,alternatives);card.append(body);root.append(card);
  }
}
function updateCardState(id,answer){
  const card=$('card-'+id),badge=$('badge-'+id);
  if(!card||!badge)return;
  const hasAnswer=Boolean(String(answer||'').trim());
  card.classList.toggle('has-answer',hasAnswer);
  badge.hidden=!hasAnswer;
}
function updateAnswers() {
  for(const q of state.questions) {
    const ans=state.answers.get(q.id);
    const input=$('answer-'+q.id), note=$('explain-'+q.id), alts=$('alts-'+q.id);
    if (!input || !note || !alts) continue;
    input.value=ans?.answer||'';
    updateCardState(q.id,ans?.answer);
    let label=ans?.source==='ai'?(ans.provider||'AI'):ans?.source==='compare'?'So sánh':ans?.source==='user'?'Bạn chọn':'Offline';
    note.textContent=ans ? `${label} · ${ans.confidence||'low'} · ${ans.explanation||''}` : 'Chưa có đáp án.';
    if(!q.applyable) note.textContent+=' Không hỗ trợ tự điền dạng này.';
    if(ans && (!ans.answer || (ans.alternatives?.length>1))) $('card-'+q.id).open=true;
    alts.replaceChildren();
    for(const alternative of ans?.alternatives||[]) {
      const button=el('button','alt-button',`${alternative.answer} (${alternative.providers.join(', ')})`);
      button.type='button';
      button.title='Chọn phương án này (vẫn cần kiểm tra trước khi điền)';
      button.addEventListener('click',()=>{
        state.answers.set(q.id,{id:q.id,answer:alternative.answer,confidence:'high',source:'user',
          explanation:'Bạn đã chọn phương án sau khi so sánh kết quả.',alternatives:ans.alternatives});
        updateAnswers();$('apply').disabled=false;
      });
      alts.append(button);
    }
  }
}
async function solve() {
  if(!state.questions.length)return;
  $('solve').disabled=true;progress('solve');status('Đang phân tích và giải bài…');
  try {
    const payload={title:state.title,questions:state.questions.map(q=>({id:q.id,kind:q.kind,context:q.context,
      localContext:q.localContext||'',options:q.options,rubric:q.rubric,hint:q.hint,before:q.before,after:q.after}))};
    const response=await chrome.runtime.sendMessage({type:'SPARK_SOLVE',payload});
    if(!response?.ok) throw new Error(response?.error||'Không gọi được bộ giải.');
    for(const ans of response.result.answers||[]) state.answers.set(ans.id,ans);
    state.solved=true;
    updateAnswers();
    const complete=(response.result.answers||[]).filter(a=>a.answer).length;
    $('apply').disabled=complete===0;
    if(complete>0)progress('apply');
    const label=response.result.mode==='compare'?'So sánh API':response.result.mode==='ai'?`AI (${response.result.provider||'API'})`:'Offline';
    status(`${label}: Có đáp án đủ đồng thuận ${complete}/${state.questions.length} câu.`+(response.result.warning?' '+response.result.warning:''), complete?'success':'normal');
    return complete > 0;
  }catch(error){status(errString(error),'error');return false;}
  finally{$('solve').disabled=false;}
}
function answerText() {
  if (!state.questions.length) return '';
  const lines=[state.title,''];
  for(const [i,q] of state.questions.entries()){
    lines.push(`${i+1}. ${q.context}`);
    if(q.options?.length)lines.push(`Options: ${q.options.join(' | ')}`);
    const answer=state.answers.get(q.id)?.answer||'';
    lines.push(`Answer: ${answer||'[chưa có]'}`);
    const alts=state.answers.get(q.id)?.alternatives||[];
    if(alts.length) lines.push('So sánh: '+alts.map(x=>`${x.answer} (${x.providers.join(', ')})`).join(' | '));
    lines.push('');
  }
  return lines.join('\n');
}
async function copyAnswers() {
  const output=answerText();
  try{await navigator.clipboard.writeText(output);status('Đã sao chép câu hỏi và đáp án.','success');}
  catch(error){status('Không sao chép được: '+errString(error),'error');}
}
async function applyAnswers() {
  if(!state.questions.length)return;
  const answers=[];
  let missing=0;
  for(const q of state.questions){
    const a=state.answers.get(q.id);
    const answer=String(a?.answer||'').trim();
    if(!answer || (a.source!=='user'&&a.confidence==='low')) {missing++;continue;}
    // Double check all option-backed answers before trying to click.
    if(q.options?.length && !q.options.some(o=>normalized(o)===normalized(answer))) {missing++;continue;}
    answers.push({id:q.id,answer});
  }
  if(!answers.length){status('Chưa có đáp án đủ tin cậy để điền.','error');return;}
  $('apply').disabled=true;progress('apply');status('Đang điền vào bài tập…');
  try{
    const response=await sendFrame(state.frameId,{type:'SPARK_APPLY',answers});
    if(!response?.ok) throw new Error(response?.error||'Không gửi được lệnh điền.');
    const results=response.result;
    const filled=results.filter(x=>x.status==='filled').length;
    const manual=results.filter(x=>x.status==='manual').length;
    const uncertain=results.filter(x=>x.status==='uncertain').length;
    $('fillReport').textContent=`Đã xác nhận: ${filled}. Cần nhập thủ công: ${manual}. Chưa xác minh: ${uncertain}. Bỏ qua: ${missing + results.filter(x=>x.status==='skipped').length}.`;
    status(`Đã thao tác ${results.length} đáp án. Hãy kiểm tra trên trang trước khi nộp.`,filled?'success':'normal');
    if(filled) { document.querySelector('[data-phase="apply"]')?.classList.add('is-done'); document.querySelector('[data-phase="apply"]')?.classList.remove('is-current'); }
  }catch(error){status(errString(error),'error');}
  finally{$('apply').disabled=false;}
}
async function autoSolveAndFill() {
  $('auto').disabled=true;
  try {
    if(!(await scanPage())) return;
    if(!(await solve())) return;
    await applyAnswers();
  } finally {$('auto').disabled=false;}
}
$('auto').addEventListener('click',autoSolveAndFill);
$('settings').addEventListener('click',()=>chrome.runtime.openOptionsPage());
$('scan').addEventListener('click',scanPage);
$('solve').addEventListener('click',solve);
$('copy').addEventListener('click',copyAnswers);
$('apply').addEventListener('click',applyAnswers);
async function showMode(){
  try {
    const saved=await chrome.storage.local.get(['aiMode']);
    const mode=saved.aiMode;
    $('modeLabel').textContent={single:'Chế độ một AI',compare:'Chế độ so sánh AI',offline:'Bộ giải quy tắc'}[mode]||'Sẵn sàng hỗ trợ';
  }catch{}
}
showMode();
scanPage();
