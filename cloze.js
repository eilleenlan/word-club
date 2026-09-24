(() => {
 'use strict';
 const $ = id => document.getElementById(id), lesson = globalThis.CLOZE_LESSONS.find(item => item.id === new URLSearchParams(location.search).get('lesson')) || globalThis.CLOZE_LESSONS[0];
 document.title = `一年級 U${lesson.unit} 句子克漏字 · 小小拼字所`;
 $('cloze-lesson-label').textContent = `一年級 Unit ${lesson.unit} · ${lesson.title}`;
 $('cloze-lesson-description').textContent = lesson.description;
 $('cloze-source').textContent = lesson.source;
 $('cloze-unit-pill').textContent = `一年級 U${lesson.unit} · 二選一`;
 const key = `word-club-cloze:${lesson.id}`;
 let session;
 function shuffle(items) { const result=[...items]; for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result; }
 function show(view) { for(const name of ['home','quiz','result']) $('cloze-'+name).hidden=name!==view;window.scrollTo({top:0,behavior:'instant'}); }
 function stored() { try {return JSON.parse(localStorage.getItem(key)||'null');}catch{$('cloze-storage').hidden=false;return null;} }
 function home() {session=null;show('home');const record=stored();$('cloze-history').textContent=record&&Number.isInteger(record.best)&&record.total===lesson.questions.length?`完整練習最佳成績：${record.best} / ${record.total}`:'';$('cloze-start').focus();}
 function start(questions=lesson.questions,review=false) {session={questions:shuffle(questions),index:0,correct:0,missed:[],review,resolved:false};show('quiz');render();}
 function render() {
  const q=session.questions[session.index];session.resolved=false;
  $('cloze-title').textContent=session.review?'錯題再挑戰':'句子克漏字';
  $('cloze-counter').textContent=`${session.index+1} / ${session.questions.length}`;
  $('cloze-progress').max=session.questions.length;$('cloze-progress').value=session.index;
  $('cloze-context').textContent=q.context || ''; $('cloze-context').hidden=!q.context;
  $('cloze-sentence').textContent=q.sentence;$('cloze-chinese').textContent=q.translation;$('cloze-translation').open=false;
  $('cloze-feedback').replaceChildren();$('cloze-next').hidden=true;$('cloze-next').textContent=session.index===session.questions.length-1?'看看練習結果 →':'下一題 →';
  $('cloze-options').replaceChildren();
  for(const option of shuffle(q.options)){const button=document.createElement('button');button.type='button';button.textContent=option;button.onclick=()=>answer(option);$('cloze-options').append(button);}
  $('cloze-title').focus();
 }
 function answer(value) {
  if(session.resolved)return;session.resolved=true;
  const q=session.questions[session.index],correct=value===q.answer;
  if(correct)session.correct++;else session.missed.push(q);
  for(const button of $('cloze-options').children){button.disabled=true;if(button.textContent===q.answer){button.className='correct';button.textContent+=' ✓';}else if(button.textContent===value){button.className='wrong';button.textContent+=' ✕';}}
  const title=document.createElement('strong');title.textContent=correct?'答對了！':`再記一次，答案是 ${q.answer}。`;
  const explanation=document.createElement('span');explanation.textContent=q.explanation;$('cloze-feedback').append(title,explanation);
  $('cloze-next').hidden=false;$('cloze-next').focus();
 }
 function finish() {
  show('result');$('cloze-result-title').textContent=session.review?'完成錯題複習！':'完成句子練習！';
  $('cloze-total').textContent=session.questions.length;$('cloze-correct').textContent=session.correct;$('cloze-missed').textContent=session.missed.length;
  $('cloze-result-message').textContent=session.missed.length?'看看這些句子，再練一次會更熟悉。':'每一題都答對了！';
  $('cloze-review').hidden=!session.missed.length;$('cloze-review-list').replaceChildren();
  const list=document.createElement('ul');for(const q of session.missed){const li=document.createElement('li');li.textContent=q.sentence.replace('____',q.answer);const explanation=document.createElement('small');explanation.textContent=q.explanation;li.append(explanation);list.append(li);}$('cloze-review-list').append(list);
  if(!session.review){const record=stored();const best=Number.isInteger(record?.best)&&record.total===lesson.questions.length?Math.max(0,Math.min(record.best,lesson.questions.length)):0;try{localStorage.setItem(key,JSON.stringify({best:Math.max(best,session.correct),total:lesson.questions.length}));}catch{$('cloze-storage').hidden=false;}}
  $('cloze-result-title').focus();
 }
 $('cloze-start').onclick=()=>start();$('cloze-again').onclick=()=>start();$('cloze-next').onclick=()=>{if(!session?.resolved)return;if(++session.index<session.questions.length)render();else finish();};
 $('cloze-review').onclick=()=>start(session.missed,true);$('cloze-back').onclick=home;
 $('cloze-exit').onclick=()=>{if(confirm('回到練習介紹嗎？這輪尚未完成的成績不會儲存。'))home();};home();
})();
