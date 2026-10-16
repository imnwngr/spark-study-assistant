
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('inspector scripts are registered on all exercise frames',()=>{
  const manifest=JSON.parse(read('manifest.json'));
  assert.equal(manifest.version,'0.7.8');
  assert.equal(manifest.content_scripts[0].all_frames,true);
  assert.ok(manifest.content_scripts[0].js.includes('inspector-content.js'));
});
test('inspector UI includes manual capture, export and clear',()=>{
  const html=read('inspector.html');
  for(const id of ['capture','export','clear','preview']) assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(read('popup.html'),/id="inspector"/);
  assert.match(read('popup.js'),/chrome\.runtime\.getURL\('inspector\.html'\)/);
});
test('inspector content handler is read-only and never submits or navigates',()=>{
  const script=read('inspector-content.js');
  assert.match(script,/SPARK_INSPECT_CAPTURE/);
  assert.doesNotMatch(script,/\.click\(|\.dispatchEvent\(|fetch\(|XMLHttpRequest|eval\(/);
  assert.match(script,/type !== 'password'/);
});
