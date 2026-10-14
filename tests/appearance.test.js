'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
function moduleContext(){
  const vars=new Map();
  const style={setProperty:(key,val)=>vars.set(key,val)};
  const doc={documentElement:{style,dataset:{}}};
  const chrome={storage:{local:{async get(){return {};}}}};
  const ctx=vm.createContext({document:doc,chrome});ctx.globalThis=ctx;
  vm.runInContext(read('appearance.js'),ctx);
  return {A:ctx.SparkAppearance,vars,doc};
}
test('appearance validates colors without evaluating arbitrary CSS',()=>{
  const {A}=moduleContext();
  assert.equal(A.normalizeColor('#FfA550'),'#ffa550');
  for(const bad of ['red','transparent','#fff','var(--test)','rgb(0,0,0)','url(https://evil.test)',''])assert.equal(A.normalizeColor(bad),A.DEFAULT_COLOR);
});
test('wallpaper strength clamps and rejects invalid values',()=>{
  const {A}=moduleContext();
  for(const [value,expected] of [[-5,0],[103,100],[60.4,60],[null,0],['nope',65]])assert.equal(A.normalizeStrength(value),expected);
});
test('hue conversion is stable and yields canonical hex',()=>{
  const {A}=moduleContext();
  assert.equal(A.hslToHex(0,1,.5),'#ff0000');
  assert.equal(A.hslToHex(120,1,.5),'#00ff00');
  assert.equal(A.hslToHex(240,1,.5),'#0000ff');
  assert.equal(Math.round(A.hueFromHex('#0000ff')),240);
});
test('applying wallpaper updates only CSS variables and data attribute',()=>{
  const {A,vars,doc}=moduleContext();
  const state=A.apply('#aabbcc',85);
  assert.equal(state.uiBackdropColor,'#aabbcc');
  assert.equal(state.uiBackdropStrength,85);
  assert.equal(vars.get('--wall-rgb'),'170, 187, 204');
  assert.equal(vars.get('--wall-strength'),'0.85');
  assert.equal(doc.documentElement.dataset.wallpaper,'custom');
});
test('presets are distinct and valid hex colors',()=>{
  const {A}=moduleContext();
  assert.equal(A.PRESETS.length,9);
  assert.equal(new Set(A.PRESETS.map(p=>p.color)).size,9);
  assert.ok(A.PRESETS.every(p=>/^#[0-9a-f]{6}$/.test(p.color)));
});
test('both interfaces load shared appearance runtime',()=>{
  assert.match(read('options.html'),/src="appearance.js"/);
  assert.match(read('options.html'),/src="color-studio.js"/);
  assert.match(read('popup.html'),/src="appearance.js"/);
  assert.match(read('options.js'),/uiBackdropStrength:state.uiBackdropStrength/);
  assert.match(read('popup.js'),/SparkAppearance.load\(\)/);
});
test('palette is keyboard-usable and has a non-palette custom option',()=>{
  const options=read('options.html');const studio=read('color-studio.js');
  for(const id of ['colorPresets','colorWheel','colorHex','nativeColor','wallStrength','resetColor','colorPreview'])assert.match(options,new RegExp(`id="${id}"`));
  assert.match(options,/role="slider" tabindex="0"/);
  for(const key of ['ArrowRight','ArrowUp','ArrowLeft','ArrowDown','Home','End'])assert.match(studio,new RegExp(key));
  assert.match(studio,/aria-pressed/);
  assert.match(studio,/\^#\[\\da-fA-F\]\{6\}\$/);
});
test('theme layers retain readable text in both themes with reduced transparency support',()=>{
  const css=read('styles.css');
  assert.match(css,/html\[data-theme="light"\]/);
  assert.match(css,/html\[data-theme="dark"\]/);
  assert.match(css,/prefers-reduced-transparency:reduce/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/prefers-contrast:more/);
  assert.match(css,/backdrop-filter:var\(--glass-blur\)/);
});
test('new product composition keeps every existing action',()=>{
  const html=read('popup.html');
  for(const id of ['auto','scan','settings','results','questions','solve','apply','submitNext','copy'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/class="action-dock"/);
  assert.match(html,/class="welcome-panel"/);
  assert.match(read('popup.js'),/state\.lastApplyVerified/);
});
