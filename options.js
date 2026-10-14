'use strict';
const $=id=>document.getElementById(id);
const P=SparkProviders;
const state={aiMode:'offline',activeProfileId:'',profiles:[],editingId:'',dirty:false};
const attrs=['profileName','endpoint','model','apiKey','responseFormat','enabled'];

function message(text,bad=false){
  const e=$('message');e.hidden=false;e.textContent=text;e.className='status settings-toast '+(bad?'error':'success');
}
function markDirty(){
  state.dirty=true;
  $('saveState').textContent='Có thay đổi chưa lưu';
  $('saveDot').classList.add('is-dirty');
}
function markSaved(){
  state.dirty=false;
  $('saveState').textContent='Đã lưu cài đặt';
  $('saveDot').classList.remove('is-dirty');
}
function editing(){return state.profiles.find(p=>p.id===state.editingId);}
function currentMode(){return document.querySelector('input[name="aiMode"]:checked')?.value||'offline';}
function populateProviders(select){
  for(const [value,preset] of Object.entries(P.PRESETS)){
    const o=document.createElement('option');o.value=value;o.textContent=preset.label;select.append(o);
  }
}
function renderMode(){
  const radio=document.querySelector(`input[name="aiMode"][value="${state.aiMode}"]`);
  if(radio)radio.checked=true;
  $('primaryProfileField').hidden=state.aiMode!=='single';
  $('compareNote').hidden=state.aiMode!=='compare';
  $('offlineNote').hidden=state.aiMode!=='offline';
}
function renderLists(){
  const list=$('profilesList');list.replaceChildren();
  const main=$('activeProfile');main.replaceChildren();
  if(!state.profiles.length){
    const empty=document.createElement('div');empty.className='profile-empty';empty.textContent='Chưa có API nào. Hãy thêm một nhà cung cấp.';list.append(empty);
  }
  for(const p of state.profiles){
    const choice=document.createElement('option');choice.value=p.id;choice.textContent=p.name||'API chưa đặt tên';main.append(choice);
    const button=document.createElement('button');button.type='button';button.className='profile-item'+(p.id===state.editingId?' selected':'');
    button.setAttribute('aria-pressed',String(p.id===state.editingId));
    button.title=`Chỉnh sửa ${p.name}`;
    const avatar=document.createElement('span');avatar.className='profile-avatar';avatar.textContent=(p.name||p.provider||'A').trim().slice(0,1).toUpperCase();
    const info=document.createElement('span');info.className='profile-info';
    const name=document.createElement('span');name.className='profile-name';name.textContent=p.name||'API chưa đặt tên';
    const meta=document.createElement('span');meta.className='profile-meta';
    const provider=P.PRESETS[p.provider]?.label||'Tùy chỉnh';
    meta.textContent=provider+(p.enabled?' · So sánh bật':' · So sánh tắt');
    info.append(name,meta);
    button.append(avatar,info);
    if(p.id===state.activeProfileId){const tag=document.createElement('span');tag.className='profile-selection';tag.textContent='CHÍNH';button.append(tag);}
    button.addEventListener('click',()=>{state.editingId=p.id;renderLists();renderEditor();});
    list.append(button);
  }
  main.value=state.activeProfileId;
  main.disabled=!state.profiles.length;
  $('profileCount').textContent=`${state.profiles.length} / ${P.MAX_PROFILES}`;
  $('addProfile').disabled=state.profiles.length>=P.MAX_PROFILES;
}
function renderEditor(){
  const p=editing();$('profileEditor').hidden=!p;
  if(!p)return;
  $('profileName').value=p.name;
  $('provider').value=p.provider;
  $('endpoint').value=p.endpoint;
  $('model').value=p.model;
  $('apiKey').value=p.apiKey;
  $('apiKey').type='password';$('toggleKey').textContent='Hiện';$('toggleKey').setAttribute('aria-label','Hiện API key');
  $('responseFormat').value=p.responseFormat;
  $('enabled').checked=p.enabled;
}
function render(){renderMode();renderLists();renderEditor();}
function addProfile(provider){
  if(state.profiles.length>=P.MAX_PROFILES){message('Đã đạt tối đa 8 cấu hình.',true);return;}
  const p=P.newProfile(provider);
  state.profiles.push(p);state.editingId=p.id;
  if(!state.activeProfileId)state.activeProfileId=p.id;
  render();markDirty();
  $('profileEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function initialize(){
  populateProviders($('newProvider'));populateProviders($('provider'));
  if(chrome.storage.local.setAccessLevel)await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  const stored=await chrome.storage.local.get(['aiProfiles','aiMode','activeProfileId','apiKey','model','useAI']);
  const config=P.normalizeSettings(stored);
  Object.assign(state,config);
  state.editingId=config.activeProfileId||config.profiles[0]?.id||'';
  render();
}
for(const radio of document.querySelectorAll('input[name="aiMode"]')){
  radio.addEventListener('change',()=>{state.aiMode=currentMode();renderMode();markDirty();});
}
$('activeProfile').addEventListener('change',()=>{state.activeProfileId=$('activeProfile').value;renderLists();markDirty();});
$('addProfile').addEventListener('click',()=>addProfile($('newProvider').value));
$('removeProfile').addEventListener('click',()=>{
  const p=editing();if(!p)return;
  if(!confirm(`Xóa cấu hình “${p.name}” khỏi danh sách đang chỉnh sửa? Nhấn Lưu để áp dụng.`))return;
  state.profiles=state.profiles.filter(x=>x.id!==p.id);
  if(state.activeProfileId===p.id)state.activeProfileId=state.profiles[0]?.id||'';
  state.editingId=state.profiles[0]?.id||'';render();markDirty();
});
$('provider').addEventListener('change',()=>{
  const p=editing();if(!p)return;
  const oldName=P.PRESETS[p.provider].label;
  const preset=P.PRESETS[$('provider').value];
  p.provider=$('provider').value;
  if(p.name===oldName)p.name=preset.label;
  p.endpoint=preset.endpoint;p.model=preset.model;p.responseFormat=preset.responseFormat;
  p.apiKey=''; // Never reuse a secret automatically when switching providers.
  renderEditor();renderLists();markDirty();
  message('Đã đổi nhà cung cấp. Hãy nhập API key riêng cho cấu hình mới.');
});
for(const name of attrs){
  $(name).addEventListener(name==='enabled'?'change':'input',()=>{
    const p=editing();if(!p)return;
    const field=name==='profileName'?'name':name;
    const value=name==='enabled'?$('enabled').checked:$(name).value;
    if(name==='endpoint' && p.apiKey){
      try {
        const from=new URL(p.endpoint),to=new URL(value);
        if(from.origin!==to.origin){
          p.apiKey='';$('apiKey').value='';
          message('Máy chủ API đã thay đổi. Khóa cũ được xóa để tránh gửi nhầm.');
        }
      }catch{}
    }
    p[field]=value;
    if(name==='profileName')renderLists();
    markDirty();
  });
}
$('toggleKey').addEventListener('click',()=>{
  const input=$('apiKey');input.type=input.type==='password'?'text':'password';
  const show=input.type==='password';$('toggleKey').textContent=show?'Hiện':'Ẩn';
  $('toggleKey').setAttribute('aria-label',show?'Hiện API key':'Ẩn API key');
});
$('save').addEventListener('click',async()=>{
  const button=$('save');button.disabled=true;
  try {
    state.aiMode=currentMode();
    const selected=P.selectedProfiles(state);
    if(state.aiMode!=='offline'&&!selected.length)throw new Error('Chưa chọn API cho chế độ hiện tại.');
    if(state.aiMode==='compare'&&selected.length<2)throw new Error('So sánh cần ít nhất hai cấu hình được bật.');
    for(const p of selected)P.validateProfile(p);
    // Permission request happens directly from the Save click, rather than from background.
    const origins=[...new Set(selected.map(p=>P.originPattern(p.endpoint)))];
    if(origins.length){
      const granted=await chrome.permissions.request({origins});
      if(!granted)throw new Error('Chưa được cấp quyền truy cập endpoint. Cài đặt chưa được lưu.');
    }
    const aiProfiles=state.profiles.map(P.sanitizeProfile);
    await chrome.storage.local.set({aiProfiles,aiMode:state.aiMode,activeProfileId:state.activeProfileId});
    await chrome.storage.local.remove(['apiKey','model','useAI']);
    markSaved();message(`Đã lưu ${aiProfiles.length} cấu hình. Chế độ: ${state.aiMode}.`);
  }catch(error){message(error.message||String(error),true);}
  finally{button.disabled=false;}
});
for(const link of document.querySelectorAll('[data-nav]')){
  link.addEventListener('click',()=>{
    document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('is-active',a===link));
  });
}
initialize().catch(e=>message('Không đọc được cài đặt: '+e.message,true));
