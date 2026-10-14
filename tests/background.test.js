'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'..');

function setup(storage,reply,permission=true){
  const calls=[];
  let listener;
  const ctx={URL,AbortController,setTimeout,clearTimeout,console};
  ctx.self=ctx;
  ctx.chrome={
    runtime:{onMessage:{addListener(fn){listener=fn;}}},
    storage:{local:{async get(){return storage;},async setAccessLevel(){}}},
    permissions:{async contains(){return permission;}}
  };
  ctx.fetch=async (url,request)=>{
    calls.push({url,request});
    if(typeof reply==='function')return reply(url,request);
    return {ok:true,status:200,async json(){return reply;}};
  };
  const context=vm.createContext(ctx);
  ctx.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context,{filename:file});};
  vm.runInContext(fs.readFileSync(path.join(base,'background.js'),'utf8'),context,{filename:'background.js'});
  const send=(payload)=>new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('timeout')),2000);
    const handled=listener({type:'SPARK_SOLVE',payload},{},result=>{clearTimeout(timeout);resolve(result);});
    if(!handled){clearTimeout(timeout);reject(new Error('not handled'));}
  });
  return {calls,send};
}
const payload={title:'Exercise',questions:[{id:'q1',kind:'dropdown',context:'I get home [[1]] on Thursdays because I do sport after work.',localContext:'I get home [[1]] on Thursdays because I do sport after work.',options:['late','early','about']}]};
const response=answer=>({choices:[{message:{content:JSON.stringify({answers:[{id:'q1',answer,confidence:'high',explanation:'test'}]})}}]});
const mk=(name,id,endpoint,apiKey)=>({name,id,endpoint,apiKey,model:'test-model',provider:'custom',responseFormat:'prompt_only',enabled:true});

test('offline mode never fetches',async()=>{
  const mock=setup({aiMode:'offline',aiProfiles:[]},response('late'));
  const res=await mock.send(payload);
  assert.equal(res.ok,true);assert.equal(res.result.mode,'offline');assert.equal(mock.calls.length,0);
});
test('single API sends to selected custom endpoint with only its key',async()=>{
  const p1=mk('One','one','https://one.example/v1/chat/completions','secret-one');
  const p2=mk('Two','two','https://two.example/v1/chat/completions','secret-two');
  const mock=setup({aiMode:'single',activeProfileId:'two',aiProfiles:[p1,p2]},response('late'));
  const res=await mock.send(payload);
  assert.equal(res.ok,true);assert.equal(mock.calls.length,1);
  assert.equal(mock.calls[0].url,p2.endpoint);
  assert.equal(mock.calls[0].request.headers.Authorization,'Bearer secret-two');
  assert.equal(mock.calls[0].request.body.includes('secret-one'),false);
  assert.equal(res.result.answers[0].answer,'late');
});
test('compare models with conflicting answers requires selection',async()=>{
  const a=mk('A','a','https://a.example/v1/chat/completions','a-key');
  const b=mk('B','b','https://b.example/v1/chat/completions','b-key');
  const mock=setup({aiMode:'compare',activeProfileId:'a',aiProfiles:[a,b]},url=>({ok:true,status:200,async json(){return response(url.startsWith('https://a.')?'late':'early');}}));
  const res=await mock.send(payload);
  assert.equal(mock.calls.length,2);assert.equal(res.result.mode,'compare');
  assert.equal(res.result.answers[0].answer,'');assert.equal(res.result.answers[0].alternatives.length,2);
});
test('denied permission prevents network call and falls back to offline',async()=>{
  const p=mk('One','one','https://one.example/v1/chat/completions','secret-one');
  const mock=setup({aiMode:'single',activeProfileId:'one',aiProfiles:[p]},response('early'),false);
  const res=await mock.send(payload);
  assert.equal(mock.calls.length,0);assert.equal(res.result.mode,'offline');
  assert.match(res.result.warning,/Chưa cấp quyền/);
});
test('HTTP error does not echo untrusted error text or secret',async()=>{
  const p=mk('One','one','https://one.example/v1/chat/completions','super-secret');
  const mock=setup({aiMode:'single',activeProfileId:'one',aiProfiles:[p]},()=>({ok:false,status:401,async json(){return {error:{message:'leaked super-secret'}};}}));
  const res=await mock.send(payload);
  assert.equal(res.result.mode,'offline');assert.equal(res.result.warning.includes('super-secret'),false);
});
