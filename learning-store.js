/* Local learner profiles and round summaries. Per-question recording stays disabled. */
(function(root){
'use strict';
const DB_VERSION=2,FORMAT_VERSION=1;
const fail=code=>Object.assign(new Error(code),{code});
const required=v=>{if(typeof v!=='string'||!v.trim())throw fail('INVALID_ID');return v;};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function open({indexedDB=root.indexedDB,name='word-club-learning',catalog,onStatus=()=>{}}={}){
 const notify=code=>{try{onStatus(code);}catch{}};
 if(!indexedDB){notify('STORAGE_UNAVAILABLE');return Promise.reject(fail('STORAGE_UNAVAILABLE'));}
 if(!catalog||catalog.version!==1||!Array.isArray(catalog.targets))return Promise.reject(fail('INVALID_CATALOG'));
 const targets=new Map(catalog.targets.map(t=>[t.id,{activity:t.activity}]));
 if(targets.size!==catalog.targets.length)return Promise.reject(fail('INVALID_CATALOG'));
 return new Promise((resolve,reject)=>{
  let abandoned=false,req;try{req=indexedDB.open(name,DB_VERSION);}catch(e){notify('OPEN_FAILED');reject(e);return;}
  req.onblocked=()=>{abandoned=true;notify('UPGRADE_BLOCKED');reject(fail('UPGRADE_BLOCKED'));};
  req.onerror=()=>{notify('OPEN_FAILED');reject(req.error);};
  req.onupgradeneeded=e=>{
   // Future upgrades append explicit cases; never recreate existing stores.
   if(e.oldVersion===0){const db=req.result;
    db.createObjectStore('meta',{keyPath:'id'});db.createObjectStore('learners',{keyPath:'id'});
    for(const name of ['sessions','events','mastery','mistakes','rewards','wardrobe']){const s=db.createObjectStore(name,{keyPath:['learnerId','id']});s.createIndex('learnerId','learnerId');}
    db.createObjectStore('legacy',{keyPath:'id'});
    req.transaction.objectStore('meta').add({id:'schema',version:DB_VERSION,formatVersion:FORMAT_VERSION,migrations:['initial-v1']});
   }
   if(e.oldVersion<2){for(const name of ['summaries','completions','rotations']){const store=req.result.createObjectStore(name,{keyPath:['learnerId','id']});store.createIndex('learnerId','learnerId');}req.transaction.objectStore('meta').put({id:'schema',version:2,formatVersion:FORMAT_VERSION,migrations:['initial-v1','learner-summaries-v2']});}
  };
  req.onsuccess=()=>{
   const db=req.result;if(abandoned){db.close();return;}
   db.onversionchange=()=>{db.close();notify('REOPEN_REQUIRED');};
   function run(names,mode,body){return new Promise((resolve,reject)=>{
    let tx,result,reason;
    const abort=e=>{reason=e;tx.abort();};
    try{tx=db.transaction(names,mode);
     tx.oncomplete=()=>resolve(result);
     tx.onabort=()=>{notify('TRANSACTION_FAILED');reject(reason||tx.error||fail('TRANSACTION_ABORTED'));};
     const get=(store,key,fn)=>{const r=tx.objectStore(store).get(key);r.onsuccess=()=>{try{fn(r.result);}catch(e){abort(e);}};};
     body({tx,get,done:v=>{result=v;}});
    }catch(e){if(tx){try{abort(e);}catch{reject(e);}}else{notify('TRANSACTION_FAILED');reject(e);}}
   });}
   const learner=(c,id,fn)=>c.get('learners',required(id),row=>{if(!row)throw fail('LEARNER_NOT_FOUND');fn(row);});
   const profile=(nickname,avatarId)=>{required(nickname);required(avatarId);if(nickname.length>40||avatarId.length>80)throw fail('INVALID_PROFILE');};
   resolve(Object.freeze({
    close:()=>db.close(),
    async createLearner({id,nickname,avatarId}){required(id);profile(nickname,avatarId);const row={id,nickname,avatarId,revision:1};return run(['learners'],'readwrite',c=>c.get('learners',id,old=>{if(old){if(!equal(old,row))throw fail('ID_CONFLICT');c.done(old);return;}c.tx.objectStore('learners').add(row);c.done(row);}));},
    async updateLearner({learnerId,nickname,avatarId,expectedRevision}){profile(nickname,avatarId);return run(['learners'],'readwrite',c=>learner(c,learnerId,old=>{if(old.revision!==expectedRevision)throw fail('STALE_REVISION');const row={...old,nickname,avatarId,revision:old.revision+1};c.tx.objectStore('learners').put(row);c.done(row);}));},
    async listLearners(){return run(['learners'],'readonly',c=>{const r=c.tx.objectStore('learners').getAll();r.onsuccess=()=>c.done(r.result);});},
    async getLastLearner(){return run(['meta'],'readonly',c=>c.get('meta','lastLearner',row=>c.done(row?.learnerId||null)));},
    async rememberLearner(learnerId){return run(['learners','meta'],'readwrite',c=>learner(c,learnerId,()=>{c.tx.objectStore('meta').put({id:'lastLearner',learnerId});c.done(true);}));},
    async saveSummary({learnerId,completionId,activity,scopeKey,label,correct,total,random}){
     required(completionId);required(scopeKey);required(label);
     if(!['spelling','cloze'].includes(activity)||!Number.isInteger(total)||total<1||!Number.isInteger(correct)||correct<0||correct>total||typeof random!=='boolean')throw fail('INVALID_SUMMARY');
     const id=activity+':'+scopeKey,receipt={learnerId,id:completionId,activity,scopeKey,label,correct,total,random};
     return run(['learners','summaries','completions'],'readwrite',c=>learner(c,learnerId,()=>c.get('completions',[learnerId,completionId],old=>{
      if(old&&!equal(old,receipt))throw fail('ID_CONFLICT');
      c.get('summaries',[learnerId,id],previous=>{if(old){if(!previous)throw fail('CLEARED_COMPLETION');c.done(previous);return;}const row={learnerId,id,activity,scopeKey,label,total,random,updatedAt:Date.now(),...(random?{last:correct}:{best:Math.max(previous?.total===total&&Number.isInteger(previous.best)?previous.best:0,correct)})};c.tx.objectStore('summaries').put(row);c.tx.objectStore('completions').add(receipt);c.done(row);});
     })));
    },
    async saveRotation(learnerId,id,changes){required(id);return run(['learners','rotations'],'readwrite',c=>learner(c,learnerId,()=>c.get('rotations',[learnerId,id],old=>{const row={learnerId,id,bank:{...old?.bank,...structuredClone(changes)}};c.tx.objectStore('rotations').put(row);c.done(row);})));},
    async manageLearner({learnerId,action,confirmed}){
     if(confirmed!==true)throw fail('CONFIRMATION_REQUIRED');
     if(!['clear','remove'].includes(action))throw fail('INVALID_ACTION');
     // Explicit allowlists: clearing scores preserves completion receipts and all other data.
     const stores=action==='clear'?['summaries']:['summaries','completions','rotations','sessions','events','mastery','mistakes','rewards','wardrobe'];
     return run(['learners','meta',...stores],'readwrite',c=>learner(c,learnerId,()=>{
      for(const name of stores){const r=c.tx.objectStore(name).index('learnerId').openCursor(learnerId);r.onsuccess=()=>{const cursor=r.result;if(cursor){cursor.delete();cursor.continue();}};}
      if(action==='remove'){c.tx.objectStore('learners').delete(learnerId);c.get('meta','lastLearner',row=>{if(row?.learnerId===learnerId)c.tx.objectStore('meta').delete('lastLearner');});}
      c.done(true);
     }));
    },
    async getLearner(id){return run(['learners'],'readonly',c=>learner(c,id,c.done));},
    async createSession({learnerId,id,activity,targetIds}){
     required(id);if(!['spelling','cloze'].includes(activity)||!Array.isArray(targetIds)||!targetIds.length||new Set(targetIds).size!==targetIds.length||targetIds.some(t=>targets.get(t)?.activity!==activity))throw fail('INVALID_SCOPE');
     const row={learnerId,id,activity,targetIds:[...targetIds],status:'open',formatVersion:FORMAT_VERSION};
     return run(['learners','sessions'],'readwrite',c=>learner(c,learnerId,()=>c.get('sessions',[learnerId,id],old=>{if(old&&!equal(old,row))throw fail('ID_CONFLICT');if(!old)c.tx.objectStore('sessions').add(row);c.done(old||row);})));},
    // No opt-in switch: phase 0 cannot write outcomes, even with a valid learner.
    async recordOutcome(){throw fail('RECORDING_NOT_ENABLED');},
    async readLearnerRecords(learnerId,store){if(!['sessions','events','mastery','mistakes','rewards','wardrobe','summaries','rotations'].includes(store))throw fail('INVALID_STORE');return run(['learners',store],'readonly',c=>learner(c,learnerId,()=>{const r=c.tx.objectStore(store).index('learnerId').getAll(learnerId);r.onsuccess=()=>c.done(r.result);}));},
    // Caller supplies storage explicitly. Original values are never changed or removed.
    async preserveLegacy(storage){const entries=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key==='word-club-progress-v1'||key?.startsWith('word-club-cloze:')){const value=storage.getItem(key);if(value===null)throw fail('LEGACY_CHANGED');entries.push([key,value]);}}entries.sort((a,b)=>a[0].localeCompare(b[0]));return run(['legacy'],'readwrite',c=>c.get('legacy','shared-v1',old=>{if(old){c.done(old);return;}const row={id:'shared-v1',entries,learnerId:null,formatVersion:FORMAT_VERSION};c.tx.objectStore('legacy').add(row);c.done(row);}));},
    async getLegacy(){return run(['legacy'],'readonly',c=>c.get('legacy','shared-v1',c.done));},
    async assignLegacy({learnerId,confirmed}){if(confirmed!==true)throw fail('CONFIRMATION_REQUIRED');return run(['learners','legacy'],'readwrite',c=>learner(c,learnerId,()=>c.get('legacy','shared-v1',old=>{if(!old)throw fail('LEGACY_NOT_FOUND');if(old.learnerId&&old.learnerId!==learnerId)throw fail('ALREADY_ASSIGNED');const row={...old,learnerId};c.tx.objectStore('legacy').put(row);c.done(row);})));}
   }));
  };
 });
}
const newId=()=>{if(!root.crypto?.randomUUID)throw fail('SECURE_ID_UNAVAILABLE');return root.crypto.randomUUID();};
const api=Object.freeze({open,newId,DB_VERSION,FORMAT_VERSION});root.WordClubLearningStore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
