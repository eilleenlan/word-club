(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const units = globalThis.WORD_UNITS;
  const key = 'word-club-progress-v1';
  let grade = 1, session = null, history = {};
  let practiceMode = 'single';
  const scope = globalThis.PracticeScope;
  const selections = new Map();
  const expandedGrades = new Map();
  const eligibleUnits = () => scope.eligible(units, grade, practiceMode === 'cross');
  function selectedUnits() {
    const id = `${practiceMode}:${grade}`;
    if (!selections.has(id)) {
      const available = eligibleUnits();
      selections.set(id, new Set((practiceMode === 'cross' ? available : available.slice(0, 1)).map(scope.unitKey)));
    }
    return selections.get(id);
  }
  const speaker = new WordSpeaker({ onStatus: message => { ($('results').hidden ? $('speech-status') : $('result-speech-status')).textContent = message; } });
  try { const saved = JSON.parse(localStorage.getItem(key) || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) history = saved; } catch { storageNotice(); }
  function storageNotice() { $('storage-status').textContent = '這個瀏覽器暫時無法儲存紀錄，仍然可以繼續練習。'; $('storage-status').hidden = false; }
  function show(view) { for (const id of ['home', 'quiz', 'results']) $(id).hidden = id !== view; window.scrollTo({ top: 0, behavior: 'instant' }); }
  function cancelSpeech() { speaker.cancel(); }
  function renderUnits() {
    $('mixed-panel').hidden = practiceMode === 'single';
    $('units').hidden = practiceMode !== 'single';
    $('units').replaceChildren();
    const currentUnits = scope.eligible(units, grade, false);
    if (!currentUnits.length) { $('units').innerHTML = '<div class="empty"><span class="eyebrow">COMING NEXT</span><h3>這個年級的單字還沒加入</h3><p>可以先用「跨年級練習」複習已加入的低年級單字。</p><button id="choose-cross" class="secondary">開始跨年級複習</button></div>'; $('choose-cross').onclick = () => setPracticeMode('cross'); }
    document.querySelectorAll('.grade').forEach(button => { const count = scope.eligible(units, Number(button.dataset.grade), false).length; button.querySelector('span').textContent = count ? `已加入 ${count} 個單元` : '等待加入課本單字'; });
    $('book-label').textContent = `${scope.gradeName(grade)}${grade === 1 ? ' · My School — Book 1' : grade === 4 ? ' · My Country — Book 4' : grade === 5 ? ' · Our World — Book 5' : grade === 6 ? ' · Our Planet — Book 6' : currentUnits.length ? ' · 課本單字' : ' · 本年級單字尚未加入'}`;
    currentUnits.forEach((unit, i) => {
      const card = document.createElement('article'); card.className = 'unit-card';
      const saved = history[scope.singleId(unit)];
      const count = Number.isInteger(saved?.best) && saved.best >= 0 && saved.best <= unit.words.length ? saved.best : null;
      card.innerHTML = `<div class="unit-main"><div class="unit-top"><span class="unit-number">UNIT ${unit.number}</span><span class="unit-symbol" aria-hidden="true">${['Hi', 'We', 'Aa', '✦'][i % 4]}</span></div><h3>${unit.title}</h3><p class="unit-subtitle">${unit.subtitle}</p><div class="unit-meta"><span>${unit.words.length} 個單字與片語</span><span class="saved">${count === null ? '還沒開始練習' : `★ 最佳初次答對 ${count}/${unit.words.length}`}</span></div><button class="start-unit" aria-label="開始 Unit ${unit.number} ${unit.title}">開始練習 <span aria-hidden="true">→</span></button></div><details><summary>看看本課單字</summary><ul class="word-list"></ul></details>`;
      const list = card.querySelector('ul');
      unit.words.forEach(word => { const li = document.createElement('li'); const en = document.createElement('strong'); en.textContent = word[0]; const zh = document.createElement('span'); zh.textContent = word[1]; li.append(en, zh); list.append(li); });
      card.querySelector('button').onclick = () => start({ ...unit, id: scope.singleId(unit) });
      $('units').append(card);
    });
    renderMixed();
  }
  function mixedUnit() {
    return scope.build(units, grade, practiceMode === 'cross', selectedUnits());
  }
  function updateMixedSummary() {
    const unit = mixedUnit();
    $('mixed-count').textContent = unit ? `已選 ${unit.count} 課 · 共 ${unit.words.length} 個單字與片語` : '請至少選擇一個已加入的單元';
    $('start-mixed').disabled = !unit;
    document.querySelectorAll('.grade-group').forEach(group => {
      const available = scope.eligible(units, Number(group.dataset.grade), false);
      const count = available.filter(item => selectedUnits().has(scope.unitKey(item))).length;
      group.querySelector('.grade-selection-count').textContent = `已選 ${count}／${available.length} 課`;
      const toggle = group.querySelector('.grade-select-all');
      toggle.checked = count === available.length;
      toggle.indeterminate = count > 0 && count < available.length;
    });
    const saved = unit && history[unit.id];
    $('mixed-history').textContent = saved && Number.isInteger(saved.best) && saved.total === unit.words.length ? `★ 這個範圍最佳初次答對 ${saved.best}/${saved.total}` : '';
  }
  function renderMixed() {
    $('mixed-units').replaceChildren();
    const cross = practiceMode === 'cross';
    $('mixed-title').textContent = cross ? `拼字競賽 · ${grade === 1 ? '一年級' : `一至${scope.gradeName(grade)}`}` : '把學過的單字，一起複習';
    $('start-mixed').textContent = cross ? '開始跨年級練習 →' : '開始綜合練習 →';
    const grades = cross ? Array.from({ length: grade }, (_, i) => i + 1) : [grade];
    const missing = grades.filter(g => !scope.eligible(units, g, false).length);
    document.querySelector('.mixed-description').textContent = missing.length ? `尚未加入：${missing.map(scope.gradeName).join('、')}。目前只會練習下方已加入的單字。` : '勾選要複習的單元，練習已加入且勾選的全部單字。';
    grades.forEach(g => {
      const available = scope.eligible(units, g, false);
      let container = $('mixed-units');
      if (!available.length) {
        const empty = document.createElement('p'); empty.className = 'grade-unavailable';
        empty.textContent = `${scope.gradeName(g)} · 尚未加入單字`;
        container.append(empty); return;
      }
      if (cross) {
        const group = document.createElement('div'); group.className = 'grade-group'; group.dataset.grade = g;
        const allLabel = document.createElement('label'); allLabel.className = 'grade-check-label';
        const all = document.createElement('input'); all.type = 'checkbox'; all.className = 'grade-select-all';
        all.setAttribute('aria-label', `全選${scope.gradeName(g)}已加入的單元`);
        allLabel.append(all);
        const details = document.createElement('details'); details.className = 'grade-details';
        const expansionKey = `${grade}:${g}`;
        details.open = expandedGrades.has(expansionKey) ? expandedGrades.get(expansionKey) : g === grade;
        details.ontoggle = () => expandedGrades.set(expansionKey, details.open);
        const summary = document.createElement('summary');
        const name = document.createElement('strong'); name.textContent = scope.gradeName(g);
        const count = document.createElement('span'); count.className = 'grade-selection-count';
        const loaded = document.createElement('small'); loaded.textContent = `已加入 ${available.length}／${g === 6 ? 8 : 10} 課`;
        summary.append(name, count, loaded);
        const choices = document.createElement('div'); choices.className = 'grade-unit-choices';
        details.append(summary, choices); group.append(allLabel, details); container.append(group); container = choices;
        all.onchange = () => {
          available.forEach(item => { const id = scope.unitKey(item); if (all.checked) selectedUnits().add(id); else selectedUnits().delete(id); });
          choices.querySelectorAll('input').forEach(input => { input.checked = all.checked; });
          updateMixedSummary();
        };
      }
      available.forEach(unit => {
        const label = document.createElement('label'); label.className = 'mixed-choice';
        const id = scope.unitKey(unit);
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = id; checkbox.checked = selectedUnits().has(id);
        checkbox.onchange = () => { if (checkbox.checked) selectedUnits().add(id); else selectedUnits().delete(id); updateMixedSummary(); };
        const title = document.createElement('span'); title.textContent = `Unit ${unit.number} · ${unit.title}`;
        const count = document.createElement('small'); count.textContent = `${unit.words.length} 題`;
        label.append(checkbox, title, count); container.append(label);
      });
    });
    updateMixedSummary();
  }
  function setPracticeMode(mode) {
    practiceMode = mode;
    $('single-mode').setAttribute('aria-pressed', String(mode === 'single'));
    $('mixed-mode').setAttribute('aria-pressed', String(mode === 'mixed'));
    $('cross-mode').setAttribute('aria-pressed', String(mode === 'cross'));
    renderUnits();
  }
  function chooseGrade(value) { grade = value; document.querySelectorAll('.grade').forEach(button => { const selected = Number(button.dataset.grade) === grade; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); }); renderUnits(); }
  function shuffled(items) { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
  function start(unit, words = unit.words, review = false) {
    cancelSpeech();
    session = { unit, words: $('shuffle').checked ? shuffled(words) : [...words], index: 0, missed: [], firstCorrect: 0, review, mode: document.querySelector('input[name="mode"]:checked').value };
    $('quiz-title').textContent = unit.mixed ? `${unit.title}${review ? ' · 錯題再挑戰' : ''}` : `Unit ${unit.number} · ${review ? '錯題再挑戰' : unit.title}`;
    $('quiz-scope').hidden = !unit.mixed;
    $('quiz-scope').textContent = unit.mixed ? `練習範圍：${unit.range}` : '';
    $('quiz-mode').textContent = session.mode === 'guided' ? '字母提示' : '完整拼字'; show('quiz'); renderQuestion(); speakCurrent();
  }
  function current() { return session.words[session.index]; }
  function hintText(word) { return word.split(' ').map(part => part[0] + ' _'.repeat(part.length - 1)).join('   /   '); }
  function renderQuestion() {
    const word = current(); session.attempts = 0; session.helped = false; session.resolved = false;
    $('counter').textContent = `${session.index + 1} / ${session.words.length}`; $('progress').max = session.words.length; $('progress').value = session.index;
    $('meaning').textContent = word[1]; $('context').textContent = word[2] || '先聽一聽，再把英文拼出來。';
    $('question-type').textContent = word[0].includes(' ') ? '這次練習一個片語' : '聽發音，拼出英文';
    $('letter-hint').textContent = session.mode === 'guided' ? hintText(word[0]) : '';
    $('space-note').textContent = word[0].includes(' ') ? `${word[0].split(' ').length} 個字，中間留空格` : '';
    $('answer').value = ''; $('answer').readOnly = false; $('answer').removeAttribute('aria-invalid');
    $('feedback').textContent = ''; $('feedback').className = 'feedback'; $('speech-status').textContent = '';
    $('check').hidden = false; $('next').hidden = true; $('hint').disabled = false; $('reveal').disabled = false;
    $('next').textContent = session.index === session.words.length - 1 ? '看看練習成果 ★' : '下一題 →'; $('answer').focus();
  }
  function speak(text) {
    void speaker.speak(text, { slow: $('slow').checked, voiceURI: $('voice').value });
  }
  function updateVoices() {
    const selected = $('voice').value;
    $('voice').replaceChildren(new Option('推薦聲音（優先真人錄音）', ''));
    speaker.voices().forEach(voice => $('voice').add(new Option(`${voice.name}（${voice.lang}）`, voice.voiceURI)));
    if ([...$('voice').options].some(option => option.value === selected)) $('voice').value = selected;
  }
  function speakCurrent() { if (session) speak(current()[0]); }
  function markMissed() { if (!session.missed.includes(current())) session.missed.push(current()); }
  function resolve(correct) {
    session.resolved = true; $('answer').readOnly = true; $('answer').removeAttribute('aria-invalid'); $('check').hidden = true; $('next').hidden = false; $('hint').disabled = true; $('reveal').disabled = true; $('progress').value = session.index + 1;
    $('feedback').className = `feedback ${correct ? 'good' : 'retry'}`; $('next').focus();
  }
  function submitAnswer() {
    if (!session || session.resolved) return;
    const verdict = scope.checkAnswer($('answer').value, current()[0]);
    if (verdict === 'empty') { $('feedback').textContent = '先輸入你的拼字，再按確認。'; $('answer').focus(); return; }
    if (verdict === 'correct') {
      if (session.attempts === 0 && !session.helped) session.firstCorrect++;
      $('answer').value = current()[0]; $('feedback').textContent = session.attempts > 0 || session.helped ? `答對了！${current()[0]}，再練一次會更熟悉。` : `★ 答對了！${current()[0]}`; resolve(true);
    } else {
      session.attempts++; markMissed(); $('feedback').className = 'feedback retry';
      if (verdict === 'case') {
        $('feedback').textContent = current()[0] === 'I am'
          ? '字母拼對了！表示「我」的 I 要大寫，am 用小寫。請修正後再確認。'
          : '字母拼對了！請檢查大小寫：專有名詞每個字的字首要大寫，其餘字母用小寫。修正後再確認。';
      } else {
        $('feedback').textContent = '還差一點點！看看字母提示，再試一次。';
        $('letter-hint').textContent = hintText(current()[0]);
      }
      $('answer').setAttribute('aria-invalid', 'true'); $('answer').focus(); $('answer').select();
    }
  }
  function finish() {
    cancelSpeech(); show('results'); $('completed-count').textContent = session.words.length; $('correct-count').textContent = session.firstCorrect; $('review-count').textContent = session.missed.length;
    $('result-speech-status').textContent = '';
    $('results-title').textContent = session.unit.mixed ? `${session.unit.title}${session.review ? ' · 錯題複習' : ''}完成！` : '你完成這次練習了！';
    $('result-message').textContent = session.missed.length ? '做得好！把剛剛需要幫忙的單字再練一次吧。' : '★ 太好了！這次每一題都一次答對。';
    $('review').hidden = session.missed.length === 0; $('review-list').replaceChildren();
    if (session.missed.length) {
      const list = document.createElement('div'); list.className = 'review-words'; const heading = document.createElement('h2'); heading.textContent = '再熟悉一下這些單字'; list.append(heading);
      session.missed.forEach(word => { const row = document.createElement('div'); row.className = 'review-word'; const en = document.createElement('strong'); en.textContent = word[0]; const zh = document.createElement('span'); zh.textContent = word[1]; const button = document.createElement('button'); button.textContent = '♫'; button.setAttribute('aria-label', `聽 ${word[0]} 的發音`); button.onclick = () => speak(word[0]); row.append(en, zh, button); list.append(row); }); $('review-list').append(list);
    }
    if (!session.review) { const previous = history[session.unit.id]; history[session.unit.id] = { best: Math.max(Number.isInteger(previous?.best) ? Math.min(previous.best, session.words.length) : 0, session.firstCorrect), total: session.words.length }; try { localStorage.setItem(key, JSON.stringify(history)); } catch { storageNotice(); } }
    $('results-title').focus();
  }
  function home() { cancelSpeech(); session = null; show('home'); renderUnits(); document.querySelector('.grade.selected').focus(); }
  document.querySelectorAll('.grade').forEach(button => button.onclick = () => chooseGrade(Number(button.dataset.grade)));
  $('single-mode').onclick = () => setPracticeMode('single');
  $('mixed-mode').onclick = () => setPracticeMode('mixed');
  $('cross-mode').onclick = () => setPracticeMode('cross');
  $('select-all').onclick = () => { eligibleUnits().forEach(unit => selectedUnits().add(scope.unitKey(unit))); renderMixed(); };
  $('clear-selection').onclick = () => { selectedUnits().clear(); renderMixed(); };
  $('start-mixed').onclick = () => { const unit = mixedUnit(); if (unit) start(unit); };
  $('answer-form').onsubmit = event => { event.preventDefault(); submitAnswer(); };
  $('speak').onclick = speakCurrent;
  $('slow').onchange = () => { if (session && !$('quiz').hidden) speakCurrent(); };
  $('voice').onchange = () => { if (session && !$('quiz').hidden) speakCurrent(); };
  updateVoices();
  if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', updateVoices);
  $('hint').onclick = () => { if (!session || session.resolved) return; session.helped = true; markMissed(); $('letter-hint').textContent = hintText(current()[0]); $('feedback').className = 'feedback'; $('feedback').textContent = `共有 ${current()[0].replace(/ /g, '').length} 個字母${current()[0].includes(' ') ? '，／ 表示單字之間的空格' : ''}。你可以的！`; $('answer').focus(); };
  $('reveal').onclick = () => { if (!session || session.resolved) return; markMissed(); $('answer').value = current()[0]; $('letter-hint').textContent = current()[0]; $('feedback').textContent = `一起記住：${current()[0]}。這一題會放進最後的複習。`; resolve(false); speakCurrent(); };
  $('next').onclick = () => { if (!session?.resolved) return; if (++session.index < session.words.length) { cancelSpeech(); renderQuestion(); speakCurrent(); } else finish(); };
  $('exit').onclick = () => { if (confirm('要回到單元選單嗎？這次尚未完成的練習不會儲存。')) home(); };
  $('back').onclick = home;
  $('review').onclick = () => { const { unit, missed } = session; start(unit, missed, true); };
  window.addEventListener('pagehide', cancelSpeech);
  renderUnits();
  if (document.modelContext?.registerTool) {
    try { Promise.resolve(document.modelContext.registerTool({ name: 'start_spelling_unit', description: '選擇已加入的單元並開始拼字練習，會重設目前尚未完成的練習。', inputSchema: { type: 'object', properties: { unit: { type: 'string', enum: units.map(scope.singleId) } }, required: ['unit'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute(input) { const unit = units.find(u => scope.singleId(u) === input?.unit); if (!unit) throw new Error('找不到這個單元'); chooseGrade(scope.gradeOf(unit)); start({ ...unit, id: scope.singleId(unit) }); return { unit: scope.singleId(unit), questions: unit.words.length, view: 'quiz' }; } })).catch(() => {}); } catch { /* Optional browser API. */ }
  }
})();
