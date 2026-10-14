'use strict';
const $=id=>document.getElementById(id);
const P=SparkProviders;
const state={aiMode:'offline',activeProfileId:'',profiles:[],editingId:''};
const attrs=['profileName','endpoint','model','apiKey','responseFormat','enabled'];

function message(text,bad=false){$('message').textContent=text;$('message').className='status'+(bad?' error':' success');}
function editing(){return state.profiles.find(p=>p.id===state.editingId);}
function populateProviders(select){
  for(const [value,preset] of Object.entries(P.PRESETS)){
    const o=document.createElement('option');o.value=value;o.textContent=preset.label;select.append(o);
  }
}
function renderLists(){
  const list=$('profilesList');list.replaceChildren();
  const main=$('activeProfile');main.replaceChildren();
  for(const p of state.profiles){
    const choice=document.createElement('option');choice.value=p.id;choice.textContent=p.name||'API chưa đặt tên';main.append(choice);
    const button=document.createElement('button');button.type='button';button.className='profile-item'+(p.id===state.editingId?' selected':'');
    const left=document.createElement('span');left.className='profile-name';left.textContent=p.name||'API chưa đặt tên';
    const right=document.createElement('small');right.textContent=(p.id===state.activeProfileId?'Chính · ':'')+(p.enabled?'So sánh: bật':'So sánh: tắt');
    button.append(left,right);button.addEventListener('click',()=>{state.editingId=p.id;render();});list.append(button);
  }
  $('activeProfile').value=state.activeProfileId;
  $('activeProfile').disabled=!state.profiles.length;
  $('profileCount').textContent=`(${state.profiles.length}/${P.MAX_PROFILES})`;
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
  $('apiKey').type='password';$('toggleKey').textContent='Hiện';
  $('responseFormat').value=p.responseFormat;
  $('enabled').checked=p.enabled;
}
function render(){ $('aiMode').value=state.aiMode;renderLists();renderEditor(); }
function addProfile(provider){
  if(state.profiles.length>=P.MAX_PROFILES){message('Đã đạt tối đa 8 cấu hình.',true);return;}
  const p=P.newProfile(provider);
  state.profiles.push(p);state.editingId=p.id;
  if(!state.activeProfileId)state.activeProfileId=p.id;
  render();
}
async function initialize(){
  populateProviders($('newProvider'));populateProviders($('provider'));
  // Prevent injected content scripts from directly reading stored keys.
  if(chrome.storage.local.setAccessLevel)await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  const stored=await chrome.storage.local.get(['aiProfiles','aiMode','activeProfileId','apiKey','model','useAI']);
  const config=P.normalizeSettings(stored);
  Object.assign(state,config);
  state.editingId=config.activeProfileId||config.profiles[0]?.id||'';
  render();
}
$('aiMode').addEventListener('change',()=>{state.aiMode=$('aiMode').value;});
$('activeProfile').addEventListener('change',()=>{state.activeProfileId=$('activeProfile').value;renderLists();});
$('addProfile').addEventListener('click',()=>addProfile($('newProvider').value));
$('removeProfile').addEventListener('click',()=>{
  const p=editing();if(!p)return;
  if(!confirm(`Xóa cấu hình “${p.name}” khỏi danh sách đang chỉnh sửa? Nhấn Lưu để áp dụng.`))return;
  state.profiles=state.profiles.filter(x=>x.id!==p.id);
  if(state.activeProfileId===p.id)state.activeProfileId=state.profiles[0]?.id||'';
  state.editingId=state.profiles[0]?.id||'';render();
});
$('provider').addEventListener('change',()=>{
  const p=editing();if(!p)return;
  const oldName=P.PRESETS[p.provider].label;
  const preset=P.PRESETS[$('provider').value];
  p.provider=$('provider').value;
  if(p.name===oldName)p.name=preset.label;
  p.endpoint=preset.endpoint;p.model=preset.model;p.responseFormat=preset.responseFormat;
  p.apiKey=''; // Never reuse a secret automatically when switching providers.
  render();message('Đã đổi nhà cung cấp. Vui lòng nhập key riêng cho nhà cung cấp mới.');
});
for(const name of attrs){
  $(name).addEventListener(name==='enabled'?'change':'input',()=>{
    const p=editing();if(!p)return;
    const field=name==='profileName'?'name':name;
    const value=name==='enabled'?$('enabled').checked:$(name).value;
    if(name==='endpoint' && p.apiKey){
      try {
        const from=new URL(p.endpoint), to=new URL(value);
        if(from.origin!==to.origin){
          p.apiKey='';$('apiKey').value='';
          message('Bạn đã đổi máy chủ API. Khóa cũ được xóa khỏi cấu hình đang chỉnh sửa để tránh gửi nhầm.',false);
        }
      } catch {}
    }
    p[field]=value;
    if(name==='profileName')renderLists();
  });
}
$('toggleKey').addEventListener('click',()=>{
  const input=$('apiKey');input.type=input.type==='password'?'text':'password';
  $('toggleKey').textContent=input.type==='password'?'Hiện':'Ẩn';
});
$('save').addEventListener('click',async()=>{
  const button=$('save');button.disabled=true;
  try {
    state.aiMode=$('aiMode').value;
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
    message(`Đã lưu ${aiProfiles.length} cấu hình. Chế độ: ${state.aiMode}.`);
  } catch(error) {message(error.message||String(error),true);}
  finally{button.disabled=false;}
});
initialize().catch(e=>message('Không đọc được cài đặt: '+e.message,true));
