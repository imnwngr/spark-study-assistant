'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const popup=read('popup.html');
const options=read('options.html');
const css=read('styles.css');

test('popup retains all functional controls and status regions',()=>{
  for(const id of ['scan','auto','settings','status','emptyState','results','questions','solve','copy','apply','fillReport','title','count']){
    assert.match(popup,new RegExp(`id="${id}"`),`Missing popup node #${id}`);
  }
  assert.match(popup,/aria-live="polite"/);
  assert.match(popup,/<details|id="questions"/);
});
test('options retains all provider settings fields used by JS',()=>{
  for(const id of ['activeProfile','profilesList','profileEditor','profileName','provider','endpoint','model','apiKey','responseFormat','enabled','toggleKey','removeProfile','newProvider','addProfile','save','message']){
    assert.match(options,new RegExp(`id="${id}"`),`Missing settings field #${id}`);
  }
});
test('solution modes remain semantic, keyboard-accessible radios',()=>{
  for(const mode of ['offline','single','compare'])assert.match(options,new RegExp(`name="aiMode" value="${mode}"`));
  assert.match(options,/<fieldset[^>]*id="aiModeChoices"/);
});
test('no remote UI runtime, fonts, or inline JS event handlers',()=>{
  for(const html of [popup,options]){
    assert.doesNotMatch(html,/<script[^>]+src="https?:/i);
    assert.doesNotMatch(html,/<link[^>]+href="https?:/i);
    assert.doesNotMatch(html,/\son(?:click|change|input|load)\s*=/i);
  }
});
test('design supports system theme, reduced motion and compact popup',()=>{
  assert.match(css,/prefers-color-scheme:dark/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/\.popup\{width:408px/);
  assert.match(css,/\.popup\.has-results \.welcome-panel/);
});
test('design version matches the extension manifest',()=>{
  const manifest=JSON.parse(read('manifest.json'));
  assert.equal(manifest.version,'0.3.0');
  assert.match(options,/Version 0\.3\.0/);
});
