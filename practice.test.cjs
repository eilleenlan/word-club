const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./practice.js');
require('./words.js');
const s = globalThis.PracticeScope;
// Isolated test data; never loaded into the website.
const fixture = [
  { grade: 1, id: 'u1', number: '01', words: [['name', '名字'], ['I am', '我是']] },
  { grade: 2, id: 'u1', number: '01', words: [['name', '名字'], ['blue', '藍色']] },
  { grade: 5, id: 'u1', number: '01', words: [['competition', '競賽'], ['name', '命名']] },
  { grade: 6, id: 'u1', number: '01', words: [['excluded', '不在範圍']] }
];
const all = new Set(fixture.map(s.unitKey));
test('grade 5 cumulative range includes grades 1–5 and excludes grade 6', () => {
  const result = s.build(fixture, 5, true, all);
  assert.equal(result.count, 3); assert.equal(result.words.length, 5);
  assert.ok(result.words.some(w => w[0] === 'competition'));
  assert.ok(!result.words.some(w => w[0] === 'excluded'));
  assert.match(result.range, /一年級 Unit 01.*二年級 Unit 01.*五年級 Unit 01/);
});
test('same unit numbers in different grades stay distinct', () => {
  const result = s.build(fixture, 5, true, new Set(['g5:u1']));
  assert.equal(result.count, 1); assert.equal(result.words[0][0], 'competition');
  assert.notEqual(s.singleId(fixture[0]), s.singleId(fixture[2]));
});
test('same-grade mix cannot leak lower or higher grade words', () => {
  const result = s.build(fixture, 5, false, all);
  assert.equal(result.count, 1); assert.equal(result.words.length, 2);
});
test('empty selection and out-of-range-only selection cannot start', () => {
  assert.equal(s.build(fixture, 5, true, new Set()), null);
  assert.equal(s.build(fixture, 5, true, new Set(['g6:u1'])), null);
});
test('deduplicate identical words and meanings, keep phrases and different meanings', () => {
  const result = s.build(fixture, 5, true, all);
  assert.equal(result.words.filter(w => w[0] === 'name' && w[1] === '名字').length, 1);
  assert.equal(result.words.filter(w => w[0] === 'name').length, 2);
  assert.ok(result.words.some(w => w[0] === 'I am'));
});
test('history keys preserve grade 1 single/mixed records and isolate cumulative scopes', () => {
  assert.equal(s.singleId(fixture[0]), 'u1');
  const legacy = s.build(WORD_UNITS, 1, false, new Set(['g1:u1','g1:u2']));
  assert.equal(legacy.id, 'mixed:g1:u1+u2'); assert.equal(legacy.words.length, 20);
  assert.notEqual(s.build(fixture, 5, true, all).id, s.build(fixture, 6, true, all).id);
});
test('real grade 5 range includes 241 supplied questions and grade 5 alone has 80', () => {
  const available = s.eligible(WORD_UNITS, 5, true);
  assert.equal(s.build(WORD_UNITS, 5, true, new Set(available.map(s.unitKey))).words.length, 241);
  assert.equal(s.eligible(WORD_UNITS, 5, false).length, 4);
  assert.equal(s.build(WORD_UNITS, 5, false, new Set(available.map(s.unitKey))).words.length, 80);
  assert.equal(s.eligible(WORD_UNITS, 6, false).length, 4);
});

test('grade 6 includes 81 prompts, full phrases and separate verb tenses', () => {
  const available = s.eligible(WORD_UNITS, 6, true);
  const selected = new Set(available.map(s.unitKey));
  assert.equal(s.build(WORD_UNITS, 6, true, selected).words.length, 322);
  const own = s.build(WORD_UNITS, 6, false, selected);
  assert.equal(own.words.length, 81);
  for (const word of ['die','died','grow up','rain shower','plenty of','a lot of','a little']) assert.ok(own.words.some(item => item[0] === word));
  assert.equal(WORD_UNITS.find(u => u.grade === 6 && u.id === 'u1').words.length, 21);
});

test('grade 4 has 72 textbook prompts and its cumulative range excludes grades 5 and 6', () => {
  const selected = new Set(WORD_UNITS.map(s.unitKey));
  const own = s.build(WORD_UNITS, 4, false, selected);
  assert.equal(own.words.length, 72);
  assert.equal(s.build(WORD_UNITS, 4, true, selected).words.length, 161);
  for (const word of ['Taiwan','Taipei','Pacific Ocean','national park','far from','live in','city','cities']) assert.ok(own.words.some(w => w[0] === word));
  assert.equal(WORD_UNITS.find(u => u.grade === 4 && u.id === 'u1').words.length, 16);
});

test('proper names and I require textbook case while whitespace remains forgiving', () => {
  for (const [answer, target, verdict] of [
    ['taiwan','Taiwan','case'], ['TAIWAN','Taiwan','case'], ['Taiwan','Taiwan','correct'],
    ['taipei','Taipei','case'], ['Taipei','Taipei','correct'],
    ['Pacific ocean','Pacific Ocean','case'], ['pacific Ocean','Pacific Ocean','case'],
    ['  Pacific   Ocean  ','Pacific Ocean','correct'], ['PacificOcean','Pacific Ocean','spelling'],
    ['i am','I am','case'], ['I AM','I am','case'], [' I  am ','I am','correct'],
    ['ISLAND','island','correct'], ['National Park','national park','correct'],
    ['Taiwn','Taiwan','spelling'], ['   ','Taiwan','empty']
  ]) assert.equal(s.checkAnswer(answer, target), verdict, `${answer} => ${target}`);
  assert.deepEqual(WORD_UNITS.flatMap(u => u.words).filter(w => /[A-Z]/.test(w[0])).map(w => w[0]).sort(), ['China','Egypt','England','France','I am','India','Pacific Ocean','Taipei','Taiwan','the United States']);
});

test('grade 3 has 27 textbook prompts, preserves phrases and excludes higher grades', () => {
  const selected = new Set(WORD_UNITS.map(s.unitKey));
  const own = s.build(WORD_UNITS, 3, false, selected);
  assert.equal(own.words.length, 27);
  assert.equal(s.build(WORD_UNITS, 3, true, selected).words.length, 89);
  assert.equal(WORD_UNITS.find(u => u.grade === 3 && u.id === 'u1').words.length, 13);
  for (const word of ['in front of','convenience store','police officer','fire fighter','fire station','police station']) assert.ok(own.words.some(w => w[0] === word));
  assert.equal(s.checkAnswer('firefighter', 'fire fighter'), 'spelling');
});

test('grade 2 has 22 textbook prompts, distinct forms and all six grades are represented', () => {
  const selected = new Set(WORD_UNITS.map(s.unitKey));
  const own = s.build(WORD_UNITS, 2, false, selected);
  assert.equal(own.words.length, 22);
  assert.equal(s.build(WORD_UNITS, 2, true, selected).words.length, 62);
  assert.deepEqual([...new Set(WORD_UNITS.map(u => u.grade))].sort(), [1,2,3,4,5,6]);
  assert.equal(WORD_UNITS.find(u => u.grade === 2 && u.id === 'u1').words.length, 12);
  for (const word of ['foot','feet','have','has']) assert.ok(own.words.find(w => w[0] === word)[2]);
});

test('grade 6 units 3 and 4 provide 40 textbook prompts and complete phrases', () => {
  const selected = new Set(['g6:u3','g6:u4']);
  const result = s.build(WORD_UNITS, 6, false, selected);
  assert.equal(result.count, 2); assert.equal(result.words.length, 40);
  for (const word of ['per year','tie up','pick up','products']) assert.ok(result.words.some(w => w[0] === word));
  assert.equal(s.build(WORD_UNITS, 5, true, selected), null);
});

test('grade 5 new units preserve country case and contractions', () => {
  const result = s.build(WORD_UNITS, 5, false, new Set(['g5:u3','g5:u4']));
  assert.equal(result.words.length, 40);
  assert.equal(s.checkAnswer('the united states','the United States'),'case');
  assert.equal(s.checkAnswer('The United States','the United States'),'case');
  assert.equal(s.checkAnswer('the United States','the United States'),'correct');
  assert.equal(s.checkAnswer('egypt','Egypt'),'case');
  assert.equal(s.checkAnswer('won’t',"won't"),'correct');
  assert.equal(s.checkAnswer("won't","won't"),'correct');
  assert.equal(s.checkAnswer('wont',"won't"),'spelling');
});

test('grade 4 units 3 and 4 preserve forms and lesson-specific audio in mixed practice', () => {
 const mixed = s.build(WORD_UNITS, 4, false, new Set(['g4:u3','g4:u4']));
 assert.equal(mixed.words.length, 41);
 for (const [base,past] of [['try','tried'],['go','went'],['bring','brought'],['take','took'],['build','built'],['catch','caught'],['collect','collected'],['see','saw'],['visit','visited'],['give','gave'],['like','liked']]) for (const word of [base,past]) assert.ok(mixed.words.find(w=>w[0]===word)[2]);
 assert.equal(mixed.words.find(w=>w[0]==='catch').audio,'audio/grade4/unit4/catch.mp3');
 assert.equal(WORD_UNITS.find(u=>u.grade===4&&u.id==='u2').words.find(w=>w[0]==='catch').audio,'audio/grade4/unit2/catch.mp3');
});
