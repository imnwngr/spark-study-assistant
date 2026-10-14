'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
require('../providers.js');
const P=globalThis.SparkProviders;
const payload={title:'Exercise',questions:[
  {id:'q1',kind:'dropdown',context:'I get home [[1]].',options:['late','early','about']},
  {id:'q2',kind:'text',context:'He [[1]] tired.',options:[]}
]};
const answer=(id,value,confidence='high')=>({id,answer:value,confidence,explanation:'ok'});
function profile(p='openai',id='main'){const x=P.newProfile(p,id);if(p!=='ollama')x.apiKey='test-secret';return x;}

test('has seven editable provider templates with full endpoints',()=>{
  assert.equal(Object.keys(P.PRESETS).length,7);
  for(const [key,val] of Object.entries(P.PRESETS)){
    if(key!=='custom')assert.equal(new URL(val.endpoint).pathname.endsWith('/chat/completions'),true);
  }
});
test('legacy OpenAI configuration migrates without losing key/model',()=>{
  const s=P.normalizeSettings({apiKey:'old-key',model:'custom-old',useAI:true});
  assert.equal(s.aiMode,'single');assert.equal(s.profiles[0].apiKey,'old-key');
  assert.equal(s.profiles[0].model,'custom-old');assert.equal(s.activeProfileId,'legacy-openai');
});
test('no AI legacy flag preserves offline mode',()=>{
  assert.equal(P.normalizeSettings({useAI:false,apiKey:'old'}).aiMode,'offline');
});
test('saved list caps count, removes duplicates, selects valid active id',()=>{
  const profiles=Array.from({length:12},(_,i)=>profile('openai',String(i)));
  profiles[1].id='0';
  const s=P.normalizeSettings({aiMode:'single',activeProfileId:'absent',aiProfiles:profiles});
  assert.equal(s.profiles.length,7);assert.equal(s.activeProfileId,'0');
});
test('single vs comparison choose expected providers',()=>{
  const a=profile('openai','a'),b=profile('groq','b'),c=profile('ollama','c');c.enabled=false;
  const s={aiMode:'single',activeProfileId:'b',profiles:[a,b,c]};
  assert.deepEqual(P.selectedProfiles(s).map(p=>p.id),['b']);
  s.aiMode='compare';assert.deepEqual(P.selectedProfiles(s).map(p=>p.id),['a','b']);
  s.aiMode='offline';assert.equal(P.selectedProfiles(s).length,0);
});
test('https and localhost-only http validation',()=>{
  const valid=['https://api.openai.com/v1/chat/completions','http://localhost:11434/v1/chat/completions','http://127.0.0.1:8080/v1/chat/completions'];
  for(const url of valid)assert.doesNotThrow(()=>P.validateEndpoint(url));
});
for(const url of [
  'http://example.com/v1/chat/completions',
  'javascript:alert(1)',
  'file:///etc/passwd',
  'https://user:pass@server.test/v1/chat/completions',
  'https://server.test/v1/chat/completions?key=abc',
  'https://server.test/v1/chat/completions#abc',
  'https://server.test/v1/answers',
  'http://192.168.1.1:8000/v1/chat/completions'
])test('reject unsafe endpoint: '+url,()=>assert.throws(()=>P.validateEndpoint(url)));
test('remote profile needs key, local Ollama can omit it',()=>{
  const remote=profile('openai');remote.apiKey='';
  assert.throws(()=>P.validateProfile(remote),/API key/);
  assert.doesNotThrow(()=>P.validateProfile(profile('ollama')));
});
test('schema mode sends strict schema for OpenAI',()=>{
  const body=P.requestBody(profile('openai'),payload);
  assert.equal(body.response_format.type,'json_schema');
  assert.equal(body.model,'gpt-4o-mini');
  assert.equal(body.messages[1].content.includes('I get home'),true);
  assert.equal(body.messages[1].content.includes('test-secret'),false);
});
test('json_object and prompt_only produce compatible requests',()=>{
  const groq=P.requestBody(profile('groq'),payload);
  assert.equal(groq.response_format.type,'json_object');
  const ollama=P.requestBody(profile('ollama'),payload);
  assert.equal(Object.hasOwn(ollama,'response_format'),false);
});
test('parse straightforward JSON and fenced JSON',()=>{
  const data='{"answers":[{"id":"q1","answer":"late"}]}';
  assert.equal(P.parseContent(data).length,1);
  assert.equal(P.parseContent('```json\n'+data+'\n```').length,1);
  assert.throws(()=>P.parseContent('answer: late'),/JSON/);
});
test('reject non-answers and oversized output',()=>{
  assert.throws(()=>P.parseContent('{"answer":"late"}'),/answers/);
  assert.throws(()=>P.parseContent('x'.repeat(200001)),/dài/);
});
test('reject fake option even if AI tries to choose one',()=>{
  const a=P.normalizeAnswers(payload,[answer('q1','wrong'),answer('q2','feels')],profile());
  assert.equal(a[0].answer,'');assert.equal(a[0].confidence,'low');assert.equal(a[1].answer,'feels');
});
test('accept exact option with case-folding and trim; ignore unknown and duplicates',()=>{
  const a=P.normalizeAnswers(payload,[answer('q1',' LATE '),answer('unknown','oops'),answer('q1','early')],profile());
  assert.equal(a[0].answer,'late');assert.equal(a[1].answer,'');
});
test('comparison unanimous across two models enables consensus',()=>{
  const x=P.mergeComparison(payload,[
    {profile:{name:'A'},answers:[answer('q1','late'),answer('q2','feels')]},
    {profile:{name:'B'},answers:[answer('q1','late'),answer('q2','feels')]}
  ]);
  assert.equal(x.answers[0].answer,'late');assert.equal(x.answers[1].answer,'feels');
  assert.equal(x.answers[0].source,'compare');
});
test('comparison disagreement never auto selects',()=>{
  const x=P.mergeComparison(payload,[
    {profile:{name:'A'},answers:[answer('q1','late')]},
    {profile:{name:'B'},answers:[answer('q1','early')]}
  ]);
  assert.equal(x.answers[0].answer,'');assert.equal(x.answers[0].alternatives.length,2);
});
test('one successful model is NOT consensus',()=>{
  const x=P.mergeComparison(payload,[{profile:{name:'A'},answers:[answer('q1','late')]}], [{name:'B'}]);
  assert.equal(x.answers[0].answer,'');assert.equal(x.answers[0].alternatives[0].answer,'late');
});
test('missing answer from a successful model prevents consensus',()=>{
  const x=P.mergeComparison(payload,[
    {profile:{name:'A'},answers:[answer('q1','late')]},
    {profile:{name:'B'},answers:[answer('q1','')]}
  ]);
  assert.equal(x.answers[0].answer,'');
});

test('low-confidence agreement is not automatically applied',()=>{
  const x=P.mergeComparison(payload,[
    {profile:{name:'A'},answers:[answer('q1','late','low')]},
    {profile:{name:'B'},answers:[answer('q1','late','low')]}
  ]);
  assert.equal(x.answers[0].answer,'');
  assert.equal(x.answers[0].alternatives[0].answer,'late');
});
