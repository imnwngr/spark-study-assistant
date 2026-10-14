const test = require('node:test');
const assert = require('node:assert/strict');
require('../solver.js');
const solver = globalThis.SparkSolver;
function question(kind,context,options=[],extra={}) {return {id:'q1',kind,context,options,...extra};}
const knownDropdowns=[
 ['I get home [[1]] on Thursdays because I do sport after work.',['late','early','about'],'late'],
 ['He [[1]] up early to go jogging three times a week.',['stays','wakes','falls'],'wakes'],
 ['Do you want to [[1]] a break and go for a walk?',['work','take','do'],'take'],
 ["She always goes to bed early, so she doesn't often [[1]] tired.",['feel','fall','do'],'feel'],
 ['At the weekend, I sometimes [[1]] up until midnight watching films.',['stay','wake','get'],'stay']
];
for (const [context,options,answer] of knownDropdowns) test('vocabulary: '+answer,()=>assert.equal(solver.solve({questions:[question('dropdown',context,options)]}).answers[0].answer,answer));
for(const [word,answer] of [['Travels','/z/'],['Helps','/s/'],['Realises','/ɪz/'],['Once','/s/'],['Hers','/z/']]) test('pronunciation: '+word,()=>assert.equal(solver.solve({questions:[question('dropdown',`Press Play Transcript ${word}. [[1]]`,['/s/','/z/','/ɪz/'])]}).answers[0].answer,answer));
for (const [context,answer] of [
 ['Sequence 1. this take I medicine twice a day .','I take this medicine twice a day.'],
 ["Sequence 1. don't often they go on holiday .","They don't often go on holiday."],
 ['Sequence 1. rarely eats out during the week she .','She rarely eats out during the week.'],
 ['Sequence 1. at lunchtime check you always your emails do ?','Do you always check your emails at lunchtime?'],
 ['Sequence 1. are for class never you on time .','You are never on time for class.']
]) test('order: '+answer,()=>assert.equal(solver.solve({questions:[question('order',context)]}).answers[0].answer,answer));
for (const [hint,before,answer] of [['sleep','When we','sleep'],['be','our brain','is'],['not sleep','He sometimes works long hours and he',"doesn't sleep"],['feel','Then he','feels'],['drink','Robbie Shone listens to music,','drinks']]) test('simple present: '+hint,()=>assert.equal(solver.solve({questions:[question('text','',[],{hint,before})]}).answers[0].answer,answer));
test('unknown question abstains',()=>assert.equal(solver.solve({questions:[question('dropdown','A [[1]] word',['red','blue'])]}).answers[0].answer,''));
test('not in choices abstains',()=>assert.equal(solver.solve({questions:[question('dropdown','He [[1]] up early',['run','jump'])]}).answers[0].answer,''));
test('multi gap position stays distinct',()=>{
 const full='I [[1]] up about 5.30. Do you [[2]] long hours? I often [[3]] exercise. I sometimes [[4]] asleep. To [[5]] TV.';
 const questions=[['get','get','I [[1]] up about 5.30. Do you [other gap] long hours? I often [other gap] exercise. I sometimes [other gap] asleep. To [other gap] TV.'],
 ['work','work','I [other gap] up about 5.30. Do you [[1]] long hours? I often [other gap] exercise. I sometimes [other gap] asleep. To [other gap] TV.'],
 ['do','do','I [other gap] up about 5.30. Do you [other gap] long hours? I often [[1]] exercise. I sometimes [other gap] asleep. To [other gap] TV.'],
 ['fall','fall','I [other gap] up about 5.30. Do you [other gap] long hours? I often [other gap] exercise. I sometimes [[1]] asleep. To [other gap] TV.'],
 ['watch','watch','I [other gap] up about 5.30. Do you [other gap] long hours? I often [other gap] exercise. I sometimes [other gap] asleep. To [[1]] TV.']];
 for(const [_,answer,localContext] of questions) assert.equal(solver.solve({questions:[question('text',full,[],{localContext})]}).answers[0].answer,answer);
});
