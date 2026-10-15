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
  for(const id of ['submitNext','scan','auto','settings','status','emptyState','results','questions','copy','fillReport','title','count']){
    assert.match(popup,new RegExp(`id="${id}"`),`Missing popup node #${id}`);
  }
  assert.match(popup,/aria-live="polite"/);
  assert.match(popup,/<details|id="questions"/);
});
test('compact popup has one solve and fill action and a complete-exercise copy',()=>{
  assert.match(popup,/id="auto"/);
  assert.match(popup,/id="copy"/);
  assert.match(popup,/id="submitNext"/);
  assert.doesNotMatch(popup,/id="solve"|id="apply"/);
  const script=read('popup.js');
  assert.match(script,/SPARK_COPY_PROMPT/);
  assert.doesNotMatch(script,/\$\('solve'\)|\$\('apply'\)/);
  assert.match(read('content.js'),/function copyPrompt\(/);
  assert.match(read('content.js'),/SPARK_COPY_PROMPT/);
});
test('options retains all provider settings fields used by JS',()=>{
  for(const id of ['uiLanguage','uiTheme','autoNext','activeProfile','profilesList','profileEditor','profileName','provider','endpoint','model','apiKey','responseFormat','enabled','toggleKey','removeProfile','newProvider','addProfile','save','message']){
    assert.match(options,new RegExp(`id="${id}"`),`Missing settings field #${id}`);
  }
});
test('solution modes remain semantic, keyboard-accessible radios',()=>{
  for(const mode of ['offline','single','compare'])assert.match(options,new RegExp(`<input[^>]*name="aiMode"[^>]*value="${mode}"`));
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
  assert.match(css,/body\.popup\s*\{[\s\S]*?width:388px/);
  assert.match(css,/\.popup\.has-results \.welcome-panel/);
});
test('popup sizing does not depend on its initial viewport width',()=>{
  assert.match(popup,/<html[^>]*class="popup-document"/);
  const htmlRule=css.match(/html\.popup-document\s*\{([^}]+)\}/)?.[1]||'';
  const bodyRule=css.match(/body\.popup\s*\{([^}]+)\}/)?.[1]||'';
  assert.match(htmlRule,/min-width:388px/);
  assert.match(bodyRule,/min-width:388px/);
  assert.doesNotMatch(bodyRule,/100vw|100vh/);
  assert.match(bodyRule,/max-height:610px/);
});
test('design version matches the extension manifest',()=>{
  const manifest=JSON.parse(read('manifest.json'));
  assert.equal(manifest.version,'0.7.4');
  assert.match(options,/data-i18n="version"/);
});

test('all four UI languages and three themes are available',()=>{
  const ui=read('i18n.js');
  for(const locale of ['en','vi','zh-CN','zh-TW']){
    assert.match(options,new RegExp(`value="${locale}"`));
    assert.ok(ui.includes(locale));
  }
  for(const theme of ['system','light','dark']) assert.match(options,new RegExp(`value="${theme}"`));
  assert.match(css,/html\[data-theme="dark"\]/);
  assert.match(css,/html\[data-theme="light"\]/);
  const manifest=JSON.parse(read('manifest.json'));
  assert.equal(manifest.default_locale,'en');
  for(const locale of ['en','vi','zh_CN','zh_TW']){
    const messages=JSON.parse(read(`_locales/${locale}/messages.json`));
    assert.ok(messages.extName?.message && messages.extDescription?.message);
  }
});
test('submission is opt-in, guarded and uses only known Spark controls',()=>{
  const script=read('content.js');
  assert.match(script,/SPARK_SUBMIT_NEXT/);
  assert.match(script,/lastScan\.applied\.size!==expected/);
  assert.match(script,/availableActionControls\('check'\)/);
  assert.match(script,/availableActionControls\('submit'\)/);
  assert.match(script,/availableActionControls\('forward_lo'\)/);
  assert.match(script,/control\.isConnected/);
  assert.doesNotMatch(script,/querySelector\('button\[type=submit\]'/);
  const popupScript=read('popup.js');
  assert.match(popupScript,/confirm\(t\('submitAsk'\)\)/);
  assert.match(popupScript,/state\.lastApplyVerified/);
  assert.match(popup,/<button[^>]*id="submitNext"[^>]*disabled/);
});
test('both English and Vietnamese README files and DOM discovery guide exist',()=>{
  for(const file of ['README.md','README.vi.md','docs/AUTOMATION_DISCOVERY.md','docs/UI_DESIGN.md']){
    assert.ok(fs.existsSync(path.join(root,file)));
  }
  assert.match(read('README.md'),/README\.vi\.md/);
  assert.match(read('README.vi.md'),/README\.md/);
});
