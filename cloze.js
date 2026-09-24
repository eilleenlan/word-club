(() => {
 'use strict';
 const $ = id => document.getElementById(id), lesson = globalThis.CLOZE_LESSONS.find(item => item.id === new URLSearchParams(location.search).get('lesson')) || globalThis.CLOZE_LESSONS[0];
 const gradeName = ['', '一', '二', '三', '四', '五', '六'][lesson.grade] + '年級';
 const typed = lesson.mode === 'typed';
 const choiceLabel = typed ? '填空拼字' : lesson.questions[0].options.length === 3 ? '三選一' : '二選一';
 $('cloze-instruction').textContent = typed ? '讀句子，輸入空格中的英文' : '選出適合空格的答案';
 if (typed) $('cloze-intro-help').textContent = '依提示填入正確詞形或片語。可查看中文及首字母提示；使用首字母提示的題目會加入複習，不計入獨立答對。送出後顯示答案與說明。';
 $('cloze-format').textContent = `${lesson.questions.length} 題 · 每題${choiceLabel}`;
 document.querySelectorAll('a[href="./?activity=cloze"]').forEach(link => link.href = `./?activity=cloze&grade=${lesson.grade}`);
 document.title = `${gradeName} U${lesson.unit} 句子克漏字 · 小小拼字所`;
 $('cloze-lesson-label').textContent = `${gradeName} Unit ${lesson.unit} · ${lesson.title}`;
 $('cloze-lesson-description').textContent = lesson.description;
 $('cloze-source').textContent = lesson.source;
 $('cloze-unit-pill').textContent = `${gradeName} U${lesson.unit} · ${choiceLabel}`;
 const key = `word-club-cloze:${lesson.id}`;
 const targets = [...new Set(lesson.questions.map(q => q.target || q.id))];
 const fullCount = lesson.variants ? targets.length : lesson.questions.length;
 const rotationKey = `${key}:variants:r${lesson.revision || 1}`;
 let rotation = {};
 if (lesson.variants) {try { const saved=JSON.parse(localStorage.getItem(rotationKey)||'{}'); if(saved && typeof saved==='object' && !Array.isArray(saved)) rotation=saved; } catch { $('cloze-storage').hidden=false; }}
 if (lesson.variants) $('cloze-round-size').querySelector('option[value="all"]').textContent=`整課練習（${fullCount} 個目標各一題）`;
 let session, previousRound = [];
 const roundMode = () => lesson.rounds ? $('cloze-round-size').value : 'all';
 const recordKey = () => lesson.rounds ? `${key}:r${lesson.revision}:${roundMode()}` : key;
 $('cloze-round-settings').hidden = !lesson.rounds;
 function shuffle(items) { const result=[...items]; for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result; }
 function show(view) { for(const name of ['home','quiz','result']) $('cloze-'+name).hidden=name!==view;window.scrollTo({top:0,behavior:'instant'}); }
 function stored() { try {return JSON.parse(localStorage.getItem(recordKey())||'null');}catch{$('cloze-storage').hidden=false;return null;} }
 function updateSummary() {
  const count=roundMode()==='all'?fullCount:Math.min(10,fullCount);
  $('cloze-round-summary').textContent=lesson.variants ? `${fullCount} 個練習目標 · ${lesson.questions.length} 種情境 · 本輪 ${count} 題，每個目標一題。情境輪替記錄保存在此瀏覽器。` : `題庫 ${lesson.questions.length} 題 · 本輪 ${count} 題。隨機抽題不保證一輪涵蓋每個單字。`;
  const record=stored();
  $('cloze-history').textContent=record&&record.total===count?(roundMode()==='10'&&Number.isInteger(record.last)?`上次隨機練習：${record.last} / ${count}`:Number.isInteger(record.best)?`完整練習最佳成績：${record.best} / ${count}`:''):'';
 }
 function home() {session=null;show('home');updateSummary();$('cloze-start').focus();}
 function start(questions,review=false) {
  let selected;
  if(review) selected=shuffle(questions);
  else if(lesson.variants) {
    let words=shuffle(targets);
    if(roundMode()==='10') {const rest=words.slice(10);words=words.slice(0,10);if(rest.length&&previousRound.length===words.length&&words.every(w=>previousRound.includes(w)))words[words.length-1]=rest[0];}
    previousRound=words;
    selected=words.map(target=>{
      const variants=lesson.questions.filter(q=>q.target===target);
      const saved=rotation[target] || {};
      let remaining=Array.isArray(saved.remaining)?saved.remaining.filter(id=>variants.some(q=>q.id===id)):[];
      if(!remaining.length){remaining=shuffle(variants.map(q=>q.id));if(remaining.length>1 && remaining[0]===saved.last)[remaining[0],remaining[1]]=[remaining[1],remaining[0]];}
      const id=remaining.shift();rotation[target]={remaining,last:id};return variants.find(q=>q.id===id);
    });
    try {localStorage.setItem(rotationKey,JSON.stringify(rotation));}catch{$('cloze-storage').hidden=false;}
  }
  else {selected=shuffle(lesson.questions);if(roundMode()==='10'){
    const rest=selected.slice(10);selected=selected.slice(0,10);
    if(rest.length&&previousRound.length===selected.length&&selected.every(q=>previousRound.includes(q)))selected[selected.length-1]=rest[0];
    previousRound=selected;
  }}
  session={questions:selected,index:0,correct:0,missed:[],review,resolved:false,key:recordKey(),random:roundMode()==='10'};
  $('cloze-again').textContent=session.random?'再抽 10 題':`再練完整 ${fullCount} 題`;
  show('quiz');render();
 }
 $('cloze-round-size').onchange=updateSummary;
 function render() {
  const q=session.questions[session.index];session.resolved=false;session.helped=false;
  $('cloze-title').textContent=session.review?'錯題再挑戰':'句子克漏字';
  $('cloze-counter').textContent=`${session.index+1} / ${session.questions.length}`;
  $('cloze-progress').max=session.questions.length;$('cloze-progress').value=session.index;
  $('cloze-context').textContent=q.context || ''; $('cloze-context').hidden=!q.context;
  $('cloze-sentence').textContent=q.sentence;$('cloze-chinese').textContent=q.translation;$('cloze-translation').open=false;
  $('cloze-feedback').replaceChildren();$('cloze-next').hidden=true;$('cloze-next').textContent=session.index===session.questions.length-1?'看看練習結果 →':'下一題 →';
  $('cloze-options').classList.toggle('three-options', q.options?.length === 3);
  $('cloze-options').hidden=typed; $('cloze-input-form').hidden=!typed; $('cloze-input').value=''; $('cloze-input').disabled=false; $('cloze-submit').disabled=false; $('cloze-letter-hint').textContent=''; $('cloze-hint').disabled=false;
  $('cloze-options').replaceChildren();
  for(const option of shuffle(q.options || [])){const button=document.createElement('button');button.type='button';button.textContent=option;button.onclick=()=>answer(option);$('cloze-options').append(button);}
  $('cloze-title').focus();
 }
 function answer(value) {
  if(session.resolved)return;session.resolved=true;
  const q=session.questions[session.index];
  const normalize = text => text.trim().replace(/[’‘]/g, "'").replace(/\s+/g,' ');
  const input = normalize(value), expected = normalize(q.answer);
  const correct = typed ? (/[A-Z]/.test(expected) ? input===expected : input.toLowerCase()===expected.toLowerCase()) : value===q.answer;
  $('cloze-input').disabled=true; $('cloze-submit').disabled=true; $('cloze-hint').disabled=true;
  if(correct && !session.helped)session.correct++;else session.missed.push(q);
  for(const button of $('cloze-options').children){button.disabled=true;if(button.textContent===q.answer){button.className='correct';button.textContent+=' ✓';}else if(button.textContent===value){button.className='wrong';button.textContent+=' ✕';}}
  const title=document.createElement('strong');title.textContent=correct?(session.helped?'答對了！這題用過提示，稍後再練一次。':'答對了！'):`再記一次，答案是 ${q.answer}。`;
  const explanation=document.createElement('span');explanation.textContent=q.explanation;$('cloze-feedback').append(title,explanation);
  $('cloze-next').hidden=false;$('cloze-next').focus();
 }
 function finish() {
  show('result');if(typed)$('cloze-correct-label').textContent='獨立答對';$('cloze-result-title').textContent=session.review?'完成複習！':'完成句子練習！';
  $('cloze-total').textContent=session.questions.length;$('cloze-correct').textContent=session.correct;$('cloze-missed').textContent=session.missed.length;
  $('cloze-result-message').textContent=session.missed.length?'看看這些句子，再練一次會更熟悉。':'每一題都答對了！';
  $('cloze-review').hidden=!session.missed.length;$('cloze-review-list').replaceChildren();
  const list=document.createElement('ul');for(const q of session.missed){const li=document.createElement('li');li.textContent=q.sentence.replace('____',q.answer);const explanation=document.createElement('small');explanation.textContent=q.explanation;li.append(explanation);list.append(li);}$('cloze-review-list').append(list);
  if(!session.review){const record=stored();const total=session.questions.length;const best=Number.isInteger(record?.best)&&record.total===total?Math.max(0,Math.min(record.best,total)):0;try{localStorage.setItem(session.key,JSON.stringify(session.random?{last:session.correct,total}:{best:Math.max(best,session.correct),total}));}catch{$('cloze-storage').hidden=false;}}

  $('cloze-result-title').focus();
 }
 $('cloze-input-form').onsubmit=event=>{event.preventDefault();if(!session||session.resolved)return;if(!$('cloze-input').value.trim()){$('cloze-feedback').textContent='請先輸入答案。';return;}answer($('cloze-input').value);};
 $('cloze-hint').onclick=()=>{if(!session||session.resolved)return;session.helped=true;$('cloze-letter-hint').textContent=session.questions[session.index].answer.split(' ').map(word=>word[0]+'＿'.repeat(word.length-1)).join(' / ');$('cloze-input').focus();};
 $('cloze-start').onclick=()=>start();$('cloze-again').onclick=()=>start();$('cloze-next').onclick=()=>{if(!session?.resolved)return;if(++session.index<session.questions.length)render();else finish();};
 $('cloze-review').onclick=()=>start(session.missed,true);$('cloze-back').onclick=home;
 $('cloze-exit').onclick=()=>{if(confirm('回到練習介紹嗎？這輪尚未完成的成績不會儲存。'))home();};home();
})();
