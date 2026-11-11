(function(root){'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
function scene(s){const out=copy(s);delete out.experimentBook;return out}
function sync(input){const s=copy(input);let b=s.experimentBook;if(!b||!Array.isArray(b.sheets)||!b.sheets.length)b={version:1,active:'sheet-1',sheets:[{id:'sheet-1',name:'实验 1',scene:null}]};let active=b.sheets.find(x=>x.id===b.active);if(!active)throw Error('实验 Sheet 索引无效');active.scene=scene(s);active.name=s.labLog?.meta?.title||active.name;s.experimentBook=b;return s}
function switchTo(input,id){const s=sync(input),b=s.experimentBook,t=b.sheets.find(x=>x.id===id);if(!t)throw Error('实验记录不存在');const out=scene(t.scene);b.active=id;out.experimentBook=b;return out}
function add(input){const s=sync(input),b=s.experimentBook;let n=1;while(b.sheets.some(x=>x.id==='sheet-'+n))n++;const id='sheet-'+n,out=scene(s);delete out.labLog;delete out.experiment;out.labLog={meta:{title:'实验 '+n,date:new Date().toLocaleDateString('sv-SE'),author:'',purpose:'',settings:'',notes:''},data:null};b.sheets.push({id,name:'实验 '+n,scene:scene(out)});b.active=id;out.experimentBook=b;return out}
function remove(input,id){const s=sync(input),b=s.experimentBook,i=b.sheets.findIndex(x=>x.id===id);if(i<0)throw Error('实验记录不存在');if(b.sheets.length<=1)throw Error('至少保留一个实验 Sheet');b.sheets.splice(i,1);if(b.active!==id)return s;const next=b.sheets[Math.min(i,b.sheets.length-1)],out=scene(next.scene);b.active=next.id;out.experimentBook=b;return out}
root.SheetCore={sync,switchTo,add,remove};if(typeof module!=='undefined')module.exports=root.SheetCore;
})(typeof window!=='undefined'?window:globalThis);
