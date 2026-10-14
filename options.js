const $=id=>document.getElementById(id);
(async()=>{
  const o=await chrome.storage.local.get(['apiKey','model','useAI']);
  $('apiKey').value=o.apiKey||'';
  $('model').value=o.model||'gpt-4o-mini';
  $('useAI').checked=Boolean(o.useAI);
})();
$('toggleKey').addEventListener('click',()=>{
  $('apiKey').type=$('apiKey').type==='password'?'text':'password';
  $('toggleKey').textContent=$('apiKey').type==='password'?'Hiện':'Ẩn';
});
$('save').addEventListener('click',async()=>{
  await chrome.storage.local.set({apiKey:$('apiKey').value.trim(), model:$('model').value.trim()||'gpt-4o-mini',useAI:$('useAI').checked});
  $('message').textContent='Đã lưu cài đặt.';
});
$('clear').addEventListener('click',async()=>{
  $('apiKey').value=''; $('useAI').checked=false;
  await chrome.storage.local.remove('apiKey');
  await chrome.storage.local.set({useAI:false});
  $('message').textContent='Đã xóa API key.';
});
