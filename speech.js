/* Word Club audio: recorded pronunciation when available, English TTS fallback. */
(() => {
  'use strict';
  const recordingGroups = [
    ['this', 'the', 'she is', 'i am', 'what', 'name', 'he is', 'you are'],
    ['they', 'we', 'and', 'your', 'his', 'her', 'that', 'our', 'their', 'my', 'open', 'close'],
    ['in', 'school', 'who', 'hello', 'good', 'too', 'first grade', 'yes', 'no', 'not'],
    ['whose', 'yellow', 'green', 'color', 'red', 'orange', 'white', 'pink', 'blue', 'black']
  ];
  const recordings = Object.fromEntries(recordingGroups.flatMap((words, i) => words.map(word => [word, `audio/unit${i + 1}/${word.replace(/ /g, '-')}.mp3`])));
  class WordSpeaker {
    constructor({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, makeAudio = source => new Audio(source), onStatus = () => {} } = {}) {
      this.synth = synth; this.Utterance = Utterance; this.makeAudio = makeAudio; this.onStatus = onStatus; this.token = 0;
    }
    voices() {
      return (this.synth?.getVoices() || []).filter(v => /^en(?:[-_]|$)/i.test(v.lang)).sort((a, b) => this.score(b) - this.score(a) || a.name.localeCompare(b.name));
    }
    score(voice) {
      return (/natural|neural|premium|enhanced/i.test(voice.name) ? 100 : 0) + (/Google US English/i.test(voice.name) ? 80 : 0) + (/Samantha|Zira|Aria|Jenny/i.test(voice.name) ? 30 : 0) + (/^en[-_]US$/i.test(voice.lang) ? 20 : 0);
    }
    cancel() {
      this.token++;
      if (this.audio) { this.audio.onended = null; this.audio.onerror = null; this.audio.pause(); this.audio = null; }
      this.synth?.cancel(); this.utterance = null;
    }
    async waitForVoices() {
      if (this.voices().length || !this.synth) return;
      await new Promise(resolve => {
        const done = () => { clearTimeout(timer); this.synth.removeEventListener?.('voiceschanged', changed); resolve(); };
        const changed = () => { if (this.voices().length) done(); };
        const timer = setTimeout(done, 1200);
        this.synth.addEventListener?.('voiceschanged', changed);
      });
    }
    async speak(text, { slow = false, voiceURI = '' } = {}) {
      this.cancel(); const token = this.token;
      const rate = slow ? 0.65 : 1;
      const speedLabel = slow ? '慢速 0.65×' : '正常 1×';
      let fallback = '';
      if (!voiceURI && recordings[text.toLowerCase()]) {
        const clip = this.makeAudio(recordings[text.toLowerCase()]); this.audio = clip;
        clip.playbackRate = rate; clip.preservesPitch = true;
        try {
          await clip.play();
          if (token !== this.token) { clip.pause(); return; }
          this.onStatus(`教材錄音 · ${speedLabel}`);
          clip.onended = () => { if (token === this.token) this.audio = null; };
          clip.onerror = () => { if (token === this.token) { this.audio = null; this.onStatus('錄音播放中斷，請再按發音，或從選單改用裝置聲音。'); } };
          return;
        } catch (error) {
          if (token !== this.token) return;
          clip.pause(); this.audio = null;
          if (error.name === 'NotAllowedError') { this.onStatus('請按「聽英文發音」開始播放。'); return; }
          fallback = '錄音暫時無法播放，改用裝置語音。';
        }
      }
      if (!this.synth || !this.Utterance) { this.onStatus('這個瀏覽器無法播放英文語音，請換用 Chrome 或 Edge 再試。'); return; }
      this.onStatus('正在準備英文發音…');
      await this.waitForVoices();
      if (token !== this.token) return;
      const voices = this.voices();
      const voice = voices.find(v => v.voiceURI === voiceURI) || voices[0];
      if (!voice) { this.onStatus('裝置尚未提供英文聲音。請安裝英文語音，或用 Chrome／Edge 開啟。'); return; }
      const utterance = new this.Utterance(text);
      this.utterance = utterance; utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = rate; utterance.pitch = 1; utterance.volume = 1;
      const label = `${fallback}${voice.name} · ${speedLabel}`;
      this.onStatus(label);
      utterance.onend = () => { if (token === this.token) this.utterance = null; };
      utterance.onerror = event => {
        if (token !== this.token || ['canceled', 'interrupted'].includes(event.error)) return;
        this.onStatus(event.error === 'not-allowed' ? '請按「聽英文發音」開始播放。' : '這個聲音暫時無法播放，請換一個英文聲音再試。');
        this.utterance = null;
      };
      try { this.synth.speak(utterance); } catch { this.onStatus('這個聲音暫時無法播放，請換一個英文聲音再試。'); }
    }
  }
  globalThis.WordSpeaker = WordSpeaker;
})();
