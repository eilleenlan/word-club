const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./speech.js');

const voices = [
  { name: 'Chinese', lang: 'zh-TW', voiceURI: 'zh' },
  { name: 'Microsoft David', lang: 'en-US', voiceURI: 'david' },
  { name: 'Microsoft Zira', lang: 'en-US', voiceURI: 'zira' },
  { name: 'English Natural', lang: 'en-US', voiceURI: 'natural' }
];
function setup(available = voices) {
  const calls = [], clips = [], statuses = [];
  const synth = { getVoices: () => available, cancel() {}, speak: value => calls.push(value) };
  class Utterance { constructor(text) { this.text = text; } }
  const makeAudio = source => { const clip = { source, async play() {}, pause() { this.paused = true; } }; clips.push(clip); return clip; };
  return { calls, clips, statuses, synth, player: new WordSpeaker({ synth, Utterance, makeAudio, onStatus: message => statuses.push(message) }) };
}
test('this uses a recording at normal speed, then distinct slow speed without pitch shift', async () => {
  const { player, calls, clips, statuses } = setup();
  await player.speak('this');
  assert.equal(clips[0].source, 'audio/unit1/this.mp3'); assert.equal(clips[0].playbackRate, 1); assert.equal(clips[0].preservesPitch, true);
  await player.speak('this', { slow: true });
  assert.equal(clips[0].paused, true); assert.equal(clips[1].playbackRate, 0.65); assert.equal(calls.length, 0); assert.match(statuses.at(-1), /教材錄音.*0.65/);
});
test('English voices only, prefer a natural voice and honor explicit selection', async () => {
  const { player, calls } = setup();
  assert.equal(player.voices().length, 3);
  await player.speak('practice'); assert.equal(calls[0].voice.voiceURI, 'natural'); assert.equal(calls[0].rate, 1);
  await player.speak('practice', { slow: true, voiceURI: 'zira' }); assert.equal(calls[1].voice.voiceURI, 'zira'); assert.equal(calls[1].rate, 0.65);
});
test('explicit voice selection overrides the this recording for comparison', async () => {
  const { player, calls, clips } = setup(); await player.speak('this', { voiceURI: 'david' }); assert.equal(clips.length, 0); assert.equal(calls[0].voice.voiceURI, 'david');
});
test('unavailable recording falls back to English speech', async () => {
  const { player, calls, statuses } = setup(); player.makeAudio = () => ({ pause() {}, play: () => Promise.reject(new Error('codec unsupported')) });
  await player.speak('this'); assert.equal(calls[0].text, 'this'); assert.match(statuses.at(-1), /改用裝置語音/);
});
test('autoplay denial asks for a click instead of retrying a blocked operation', async () => {
  const { player, calls, statuses } = setup(); player.makeAudio = () => ({ pause() {}, play: () => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })) });
  await player.speak('this'); assert.equal(calls.length, 0); assert.match(statuses.at(-1), /請按/);
});
test('rapid replay or navigation cancels stale audio', async () => {
  const { player, statuses } = setup(); let release; const clip = { pause() { this.paused = true; }, play: () => new Promise(resolve => { release = resolve; }) }; player.makeAudio = () => clip;
  const pending = player.speak('this'); player.cancel(); release(); await pending; assert.equal(clip.paused, true); assert.equal(statuses.length, 0);
});
test('voices loaded asynchronously are used; switching questions drops the pending request', async () => {
  const { player, synth, calls } = setup(); let available = [], listener;
  synth.getVoices = () => available; synth.addEventListener = (_, callback) => { listener = callback; }; synth.removeEventListener = () => {};
  const first = player.speak('practice'); available = voices; listener(); await first; assert.equal(calls[0].text, 'practice');
  available = []; const stale = player.speak('old word'); player.cancel(); available = voices; listener(); await stale; assert.equal(calls.length, 1);
});
test('no speech support shows a clear message', async () => {
  const { player, statuses } = setup(); player.synth = undefined; await player.speak('practice'); assert.match(statuses.at(-1), /無法播放英文語音/);
});
test('all eight Unit 1 prompts use their own supplied recording, including phrases and capital I', async () => {
  const { player, clips, calls } = setup();
  for (const word of ['this', 'the', 'she is', 'I am', 'what', 'name', 'he is', 'you are']) {
    await player.speak(word);
    const expected = `audio/unit1/${word.toLowerCase().replace(/ /g, '-')}.mp3`;
    assert.equal(clips.at(-1).source, expected);
    assert.ok(require('node:fs').statSync(expected).size > 1000);
  }
  assert.equal(calls.length, 0);
});
test('all 201 supplied questions map to separate textbook audio files at both speeds', async () => {
  require('./words.js');
  const { player, clips, calls } = setup();
  const sources = new Set();
  for (const unit of WORD_UNITS) for (const [word] of unit.words) {
    const expected = `audio/${unit.grade === 1 ? '' : `grade${unit.grade}/`}unit${Number(unit.number)}/${word.toLowerCase().replace(/ /g, '-')}.mp3`;
    for (const slow of [false, true]) {
      await player.speak(word, { slow });
      assert.equal(clips.at(-1).source, expected);
      assert.equal(clips.at(-1).playbackRate, slow ? 0.65 : 1);
    }
    assert.ok(require('node:fs').statSync(expected).size > 1000);
    sources.add(expected);
  }
  assert.equal(sources.size, 201); assert.equal(calls.length, 0);
});
