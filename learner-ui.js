/* Shared local identity UI. No account or per-question recording. */
(function(){
'use strict';
const animals={fox:'🦊',cat:'🐱',rabbit:'🐰',panda:'🐼',bear:'🐻',owl:'🦉'};
const names={fox:'狐狸',cat:'小貓',rabbit:'兔子',panda:'熊貓',bear:'小熊',owl:'貓頭鷹'};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls='secondary')=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
async function init(){
 const main=document.querySelector('main'),header=document.querySelector('.site-header');
 const bar=el('div',undefined,'learner-bar'),who=el('strong','正在讀取學習者…'),notice=el('p','', 'learner-notice');notice.setAttribute('role','status');
 const switchButton=button('切換學習者',()=>showPicker()),scoresButton=button('我的成績',()=>showScores()),legacyButton=button('舊版共用紀錄',()=>showLegacy(),'text-button');
 bar.append(who,switchButton,scoresButton,legacyButton);header.append(bar);header.after(notice);
 const dialog=el('dialog',undefined,'learner-dialog');dialog.setAttribute('aria-labelledby','learner-dialog-title');document.body.append(dialog);
 main.inert=true;
 let db,current=null,summaries=[],rotations={},beforeSwitch=()=>true,busy=false,saving=0;
 const listeners=new Set();
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('word-club-learner-management'):null;
 async function refreshManaged(id){if(current?.id!==id)return;try{const data=await load(id);summaries=data.records;rotations=data.banks;}catch(e){if(e.code!=='LEARNER_NOT_FOUND')return;current=null;summaries=[];rotations={};try{sessionStorage.removeItem('word-club-active-learner');}catch{}}
  draw();for(const fn of listeners)fn();status(current?'個人成績已清除；請重新開始練習。':'此學習者已移除，請重新選擇。');await showPicker();
 }
 if(channel)channel.onmessage=e=>{if(typeof e.data?.id==='string')void refreshManaged(e.data.id);};
 window.addEventListener('focus',async()=>{if(!current||!db)return;const id=current.id;try{await db.getLearner(id);}catch(e){if(e.code==='LEARNER_NOT_FOUND')void refreshManaged(id);}});
 function confirmManagement(person,action){
  const removing=action==='remove';openDialog(removing?'確認移除學習者':'確認清除個人學習紀錄');
  dialog.append(el('p','對象：'+person.nickname),el('p',removing?'移除此人物的暱稱、頭像、固定 ID，以及個人成績、完成收據、抽題輪替、場次、逐題紀錄、熟練度、錯題與裝扮資料（如有）。':'只清除此人物的拼字與克漏字成績摘要。保留暱稱、頭像、固定 ID、完成收據、抽題輪替及其他個人資料。'),el('p','不影響其他學習者或舊版共用紀錄。無法復原；此人物進行中的練習將結束。'));
  const error=el('p','','learner-error');error.setAttribute('role','alert');const cancel=button('取消',()=>showForm(person));const accept=button(removing?'確認移除':'確認清除',async()=>{if(busy||saving){error.textContent='正在儲存，請稍候再試。';return;}busy=true;accept.disabled=cancel.disabled=true;try{await db.manageLearner({learnerId:person.id,action,confirmed:true});channel?.postMessage({id:person.id});busy=false;if(current?.id===person.id)await refreshManaged(person.id);else{status(removing?'學習者已移除。':'個人成績已清除。');await showPicker();}}catch{error.textContent='操作失敗，未確認完成。請重新整理檢查後再試。';}finally{busy=false;accept.disabled=cancel.disabled=false;}},'secondary');dialog.append(error,cancel,accept);cancel.focus();
 }
 function status(message){notice.textContent=message;}
 function draw(){who.textContent=current?`${animals[current.avatarId]||'🐾'} ${current.nickname}`:'先選擇學習者';scoresButton.disabled=!current;main.inert=!current;}
 function openDialog(title){dialog.replaceChildren();const h=el('h2',title);h.id='learner-dialog-title';dialog.append(h);if(!dialog.open)dialog.showModal();}
 function closeButton(){dialog.append(button(current?'關閉':'稍後再選',()=>{dialog.close();switchButton.focus();},'text-button'));}
 dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const focusable=[...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length);if(!focusable.length){event.preventDefault();dialog.focus();return;}const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===dialog)){event.preventDefault();first.focus();}});
 dialog.addEventListener('cancel',e=>{if(busy){e.preventDefault();return;}setTimeout(()=>switchButton.focus(),0);});
 async function load(id){const person=await db.getLearner(id);const records=await db.readLearnerRecords(id,'summaries'),banks=await db.readLearnerRecords(id,'rotations');return {person,records,banks:Object.fromEntries(banks.map(r=>[r.id,r.bank]))};}
 async function choose(id,confirmed=false){
  if(busy)return;
  if(current?.id===id){dialog.close();switchButton.focus();return;}
  if(saving){status('正在儲存成績，請稍候再切換。');return;}
  if(current?.id!==id&&!confirmed&&!beforeSwitch())return;
  busy=true;
  try{const data=await load(id);await db.rememberLearner(id);let tabRemembered=true;try{sessionStorage.setItem('word-club-active-learner',id);}catch{tabRemembered=false;}
   current=data.person;summaries=data.records;rotations=data.banks;status(tabRemembered?'':'無法記住此分頁的選擇；重新整理時會使用裝置上次選擇的學習者。');draw();dialog.close();for(const fn of listeners)fn();switchButton.focus();
  }catch{status('無法切換或儲存學習者，原本的選擇保持不變。請重新整理後再試。');}finally{busy=false;}
 }
 async function showPicker(){
  if(!db){status('學習者資料暫時無法使用。請重新整理再試；既有紀錄未被清除。');return;}
  try{const list=await db.listLearners();openDialog('今天是誰來練習？');dialog.append(el('p','紀錄只儲存在這個瀏覽器，不需要帳號或密碼。'));
   const cards=el('div',undefined,'learner-cards');for(const person of list){const card=el('div',undefined,'learner-card');const select=button(`${animals[person.avatarId]||'🐾'} ${person.nickname}${person.id===current?.id?'（目前）':''}`,()=>choose(person.id));select.setAttribute('aria-label','選擇 '+person.nickname);card.append(select,button('編輯',()=>showForm(person),'text-button'));cards.append(card);}dialog.append(cards,button('新增學習者',()=>showForm(), 'primary'));closeButton();
   if(!list.length)showForm();else cards.querySelector('button')?.focus();
  }catch{status('無法讀取學習者，請重新整理再試。');}
 }
 function showForm(person){
  openDialog(person?'修改暱稱與頭像':'新增學習者');
  const form=el('form'),label=el('label','暱稱'),input=el('input');input.id='learner-nickname';input.required=true;input.maxLength=40;input.autocomplete='off';input.value=person?.nickname||'';label.htmlFor=input.id;
  const set=el('fieldset'),legend=el('legend','選擇動物頭像');set.append(legend);const grid=el('div',undefined,'animal-options');
  for(const [id,emoji]of Object.entries(animals)){const l=el('label'),radio=el('input');radio.type='radio';radio.name='avatar';radio.value=id;radio.checked=id===(animals[person?.avatarId]?person.avatarId:'fox');l.append(radio,el('span',emoji+' '+names[id]));grid.append(l);}set.append(grid);
  const error=el('p','', 'learner-error');error.setAttribute('role','alert');const submit=el('button',person?'儲存修改':'建立並開始','primary');submit.type='submit';
  form.append(label,input,set,error,submit);dialog.append(form,button('返回選擇',showPicker,'text-button'));
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;const nickname=input.value.trim();if(!nickname){error.textContent='請輸入暱稱。';input.focus();return;}
   const avatarId=form.querySelector('input[name=avatar]:checked').value;
   // Confirm before creating another child when a round is underway.
   if(!person&&current&&!beforeSwitch())return;
   if(saving){error.textContent='正在儲存成績，請稍候。';return;}
   busy=true;submit.disabled=true;
   try{const row=person?await db.updateLearner({learnerId:person.id,nickname,avatarId,expectedRevision:person.revision}):await db.createLearner({id:WordClubLearningStore.newId(),nickname,avatarId});
    if(person){if(current?.id===row.id){current=row;draw();}busy=false;await showPicker();}
    else{busy=false;await choose(row.id,true);}
   }catch{error.textContent='未能儲存。資料可能已在另一分頁修改，請返回選擇後重試。';}finally{busy=false;submit.disabled=false;}
  };if(person)dialog.append(button('清除個人學習紀錄',()=>confirmManagement(person,'clear'),'text-button'),button('移除學習者',()=>confirmManagement(person,'remove'),'text-button'));input.focus();
 }
 async function showScores(){if(!current)return;try{const id=current.id,rows=await db.readLearnerRecords(id,'summaries');if(current.id!==id)return;summaries=rows;openDialog(`${current.nickname}的成績`);dialog.append(el('p','保留各練習範圍的最佳成績，隨機練習保留最近一次；不是逐次歷程。'));if(!rows.length)dialog.append(el('p','還沒有完成的個人練習。'));const list=el('ul',undefined,'learner-scores');for(const row of rows.sort((a,b)=>b.updatedAt-a.updatedAt)){const item=el('li');item.append(el('strong',row.label),el('p',`${row.activity==='spelling'?'拼字':'克漏字'} · ${row.random?'上次初次答對':'最佳初次答對'} ${row.random?row.last:row.best}／${row.total}`));list.append(item);}dialog.append(list);closeButton();}catch{status('無法讀取成績，請重新整理再試。');}}
 function showLegacy(){openDialog('舊版共用紀錄');dialog.append(el('p','這些是先前共用裝置的成績，未歸屬任何孩子。保留原始資料，不與個人成績合併。'));const list=el('ul',undefined,'learner-scores');let count=0;
  const add=(key,row)=>{if(!row||!Number.isInteger(row.total)||(!Number.isInteger(row.best)&&!Number.isInteger(row.last)))return;const li=el('li');li.append(el('strong',key),el('p',`${Number.isInteger(row.best)?'最佳 '+row.best:'上次 '+row.last}／${row.total}`));list.append(li);count++;};
  try{const old=JSON.parse(localStorage.getItem('word-club-progress-v1')||'{}');for(const [id,row]of Object.entries(old||{}))add('拼字 · '+id,row);for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('word-club-cloze:')&&!key.includes(':variants:')){try{add('克漏字 · '+key.slice(16),JSON.parse(localStorage.getItem(key)));}catch{}}}if(!count)dialog.append(el('p','沒有可顯示的舊成績；原始資料沒有被更動。'));}catch{dialog.append(el('p','部分舊資料無法讀取，原始資料仍保留。'));}dialog.append(list);closeButton();
 }
 try{const r=await fetch('learning-targets.json');if(!r.ok)throw Error('catalog');const catalog=WordClubLearningCatalog.validate(await r.json());db=await WordClubLearningStore.open({catalog,onStatus:code=>{if(code==='REOPEN_REQUIRED'){main.inert=true;status('另一分頁更新了資料版本。請重新整理後繼續。');}else status('儲存暫時無法使用；請勿清除網站資料，重新整理後再試。');}});
  let id;try{id=sessionStorage.getItem('word-club-active-learner');}catch{}if(!id)id=await db.getLastLearner();if(id){try{const data=await load(id);current=data.person;summaries=data.records;rotations=data.banks;}catch(e){if(e.code!=='LEARNER_NOT_FOUND')throw e;}}
  draw();if(!current)await showPicker();
 }catch{draw();status('無法開啟學習者儲存。請用一般模式的 Chrome／Edge／Safari 重新整理再試；原紀錄未被清除。');}
 return Object.freeze({
  current:()=>current,ensure:()=>{if(!current){void showPicker();return false;}return true;},
  setBeforeSwitch:fn=>{beforeSwitch=fn;},subscribe:fn=>listeners.add(fn),
  scoreMap:activity=>Object.fromEntries(summaries.filter(s=>s.activity===activity).map(s=>[s.scopeKey,s])),
  rotationMap:()=>structuredClone(rotations),
  async save(summary){saving++;try{const row=await db.saveSummary(summary);status('');if(current?.id===summary.learnerId)summaries=[...summaries.filter(s=>s.id!==row.id),row];return row;}finally{saving--; }},
  async saveRotation(learnerId,id,changes){const row=await db.saveRotation(learnerId,id,changes);if(current?.id===learnerId)rotations[id]=row.bank;return row;},
  notice:status
 });
}
globalThis.LearnerUI={ready:init()};
})();
