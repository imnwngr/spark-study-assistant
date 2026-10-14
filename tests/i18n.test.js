'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(root,'i18n.js'),'utf8');
function languageEngine(){
  const document={documentElement:{lang:'en',dataset:{}},querySelectorAll:()=>[]};
  const world={document};world.globalThis=world;
  vm.runInNewContext(code,world);
  return {engine:world.SparkI18n,document};
}
test('default language is English and invalid language returns English',()=>{
  const {engine}=languageEngine();
  assert.equal(engine.language,'en');
  assert.equal(engine.t('scan'),'Scan page');
  assert.equal(engine.setLanguage('fr'),'en');
});
test('all four requested languages translate primary workflow labels',()=>{
  const {engine,document}=languageEngine();
  for(const [locale,scan,submit] of [
    ['en','Scan page','Submit & next'],
    ['vi','Quét bài','Nộp & bài tiếp'],
    ['zh-CN','扫描题目','提交并下一题'],
    ['zh-TW','掃描題目','提交並下一題']]){
    engine.setLanguage(locale);
    assert.equal(engine.t('scan'),scan);
    assert.equal(engine.t('submitNext'),submit);
    assert.equal(document.documentElement.lang,locale);
    assert.equal(engine.t('count',{n:3,frame:2}).includes('3'),true);
  }
});
test('light, dark and system themes are accepted with a safe default',()=>{
  const {engine,document}=languageEngine();
  for(const mode of ['light','dark','system'])assert.equal(engine.setTheme(mode),mode);
  assert.equal(engine.setTheme('unknown'),'system');
  assert.equal(document.documentElement.dataset.theme,'system');
});
test('every static translation key exists in English dictionary',()=>{
  const {engine}=languageEngine();
  const html=['popup.html','options.html'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join(' ');
  const keys=[...html.matchAll(/data-i18n(?:-placeholder|-title)?="([\w]+)"/g)].map(x=>x[1]);
  assert.ok(keys.length>70);
  for(const key of keys)assert.notEqual(engine.t(key),key,`Untranslated key ${key}`);
});
test('language engine modifies only text/attributes and not HTML markup',()=>{
  const {engine,document}=languageEngine();
  const el={dataset:{i18n:'scan',i18nPlaceholder:'answerPlaceholder',i18nTitle:'settings'},
    setAttribute(k,v){this[k]=v;},textContent:'original'};
  document.querySelectorAll=()=>[el];
  engine.setLanguage('vi');
  assert.equal(el.textContent,'Quét bài');
  assert.equal(el.placeholder,'Giải hoặc tự nhập');
  assert.equal(el.title,'Cài đặt');
  assert.equal(el['aria-label'],'Cài đặt');
});
