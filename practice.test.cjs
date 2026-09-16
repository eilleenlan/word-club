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
test('real grade 5 range has only the 40 supplied grade 1 questions, no invented data', () => {
  const available = s.eligible(WORD_UNITS, 5, true);
  assert.equal(s.build(WORD_UNITS, 5, true, new Set(available.map(s.unitKey))).words.length, 40);
  assert.equal(s.eligible(WORD_UNITS, 5, false).length, 0);
});
