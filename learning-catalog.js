/* Permanent IDs are maintained in learning-targets.json; never regenerate them. */
(function(root){
'use strict';
function validate(c){if(c?.version!==1||!Array.isArray(c.targets))throw Error('INVALID_CATALOG');const ids=new Set(),sources=new Set();for(const t of c.targets){if(typeof t.id!=='string'||!t.id.startsWith('target-')||ids.has(t.id))throw Error('INVALID_TARGET');ids.add(t.id);if(!['spelling','cloze'].includes(t.activity)||!Array.isArray(t.sources)||!t.sources.length)throw Error('INVALID_SOURCE');for(const s of t.sources){const k=JSON.stringify([t.activity,s.grade,s.unit,s.word,s.lessonId,s.target]);if(sources.has(k))throw Error('AMBIGUOUS_SOURCE');sources.add(k);}}return c;}
function spelling(c,grade,unit,word){return c.targets.filter(t=>t.activity==='spelling'&&t.sources.some(s=>s.grade===grade&&s.unit===unit&&s.word===word));}
function cloze(c,lessonId,target){return c.targets.find(t=>t.activity==='cloze'&&t.sources.some(s=>s.lessonId===lessonId&&s.target===target));}
const api=Object.freeze({validate,spelling,cloze});root.WordClubLearningCatalog=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
