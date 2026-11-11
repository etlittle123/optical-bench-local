// DOM-adapter smoke test; this is not a browser-layout or real pointer test.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../dist/index.html','utf8');
class Element{
 constructor(id=''){this.id=id;this.style={};this.dataset={};this.events={};this.children=[];this.value='';this.type='';this.textContent='';this.disabled=false;this.classes=new Set();this.classList={toggle:(c,force)=>{const on=force??!this.classes.has(c);on?this.classes.add(c):this.classes.delete(c);return on},contains:c=>this.classes.has(c),add:c=>this.classes.add(c),remove:c=>this.classes.delete(c)};}
 set innerHTML(x){this.html=x;this.inputs=[...x.matchAll(/<(input|select)\b([^>]*)>/g)].map(m=>{const el=new Element();for(const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)){if(a[1]==='data-key')el.dataset.key=a[2];else el[a[1]]=a[2]}return el})}
 get innerHTML(){return this.html||''}
 querySelectorAll(s){return s==='[data-key]'?this.inputs||[]:[]}
 querySelector(){return null}
 addEventListener(k,f){(this.events[k]??=[]).push(f)}
 appendChild(el){this.children.push(el)} remove(){} focus(){} click(){this.onclick?.({currentTarget:this,target:this})}
 matches(s){return false} getBoundingClientRect(){return{width:900,height:650,left:0,top:0}} getContext(){return{}} setPointerCapture(){}hasPointerCapture(){return false}releasePointerCapture(){}
}
const els={};for(const m of html.matchAll(/id="([^"]+)"/g))els[m[1]]=new Element(m[1]);
const presets=['iso','top','front','side'].map(v=>{const e=new Element();e.dataset.view=v;return e});
const win=new Element(),local=new Map();Object.assign(win,{devicePixelRatio:1,innerWidth:1400,innerHeight:900});const doc={querySelector:s=>s.startsWith('#')?els[s.slice(1)]||null:null,querySelectorAll:s=>s==='[data-view]'?presets:[],createElement:()=>new Element(),body:new Element()};
const context={window:win,document:doc,localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},devicePixelRatio:1,innerWidth:1400,innerHeight:900,requestAnimationFrame:()=>{},ResizeObserver:class{constructor(f){this.f=f}observe(){}},console,setTimeout:()=>{},Blob,URL};vm.createContext(context);
for(const name of ['components','engine3d','view3d']){vm.runInContext(fs.readFileSync(__dirname+'/../dist/'+name+'.js','utf8'),context);Object.assign(context,win)}
vm.runInContext(fs.readFileSync(__dirname+'/../dist/app8.js','utf8'),context);
const app=win.OpticalBench;assert.ok(app);const initial=app.exportDesign();assert.equal(initial.components.length,10);assert.ok(app.getTrace().segments.some(r=>r.d[2]>.99));
app.addComponent('hwp');assert.equal(app.exportDesign().components.length,11);assert.equal(els.undoBtn.disabled,false);
const roll=els.inspector.querySelectorAll('[data-key]').find(e=>e.dataset.key==='roll');assert.ok(roll);roll.value='37';roll.onchange();assert.equal(app.exportDesign().components.at(-1).roll,37);
els.undoBtn.click();assert.equal(app.exportDesign().components.at(-1).roll,0);els.undoBtn.click();assert.equal(app.exportDesign().components.length,10);els.redoBtn.click();assert.equal(app.exportDesign().components.length,11);
els.saveBtn.click();assert.ok(local.get('optical-bench-design-v8'));assert.equal(JSON.parse(local.get('optical-bench-design-v8')).version,8);
const before=JSON.stringify(app.getTrace());for(const p of presets)p.click();assert.equal(JSON.stringify(app.getTrace()),before);
els.rayToggleBtn.click();assert.equal(app.getTrace().segments.length,0);els.undoBtn.click();assert.ok(app.getTrace().segments.length>0);
const backup=app.exportDesign();assert.throws(()=>app.importDesign({version:8,boards:[],components:[]}));assert.equal(app.exportDesign().components.length,backup.components.length);
els.demoBtn.click();assert.equal(app.exportDesign().components.length,10);els.undoBtn.click();assert.equal(app.exportDesign().components.length,11);
const surface=els.canvas3d,emit=(type,more={})=>{const e={button:0,pointerId:1,clientX:120,clientY:120,preventDefault(){},...more};for(const fn of surface.events[type]||[])fn(e)};
let cam=app.exportDesign().view3d;const objects=JSON.stringify(app.exportDesign().components);
emit('pointerdown',{button:2});emit('pointermove',{clientX:180,clientY:150});emit('pointerup');assert.equal(app.exportDesign().view3d.az,cam.az);
els.orbitBtn.click();assert.equal(els.orbitBtn.classList.contains('active'),true);emit('pointerdown');emit('pointermove',{clientX:180,clientY:150});emit('pointerup');assert.notEqual(app.exportDesign().view3d.az,cam.az);assert.equal(JSON.stringify(app.exportDesign().components),objects);
cam=app.exportDesign().view3d;emit('pointerdown',{ctrlKey:true});emit('pointermove',{clientX:180,clientY:150});emit('pointerup');assert.equal(app.exportDesign().view3d.az,cam.az);assert.notEqual(app.exportDesign().view3d.panX,cam.panX);
els.orbitBtn.click();cam=app.exportDesign().view3d;emit('pointerdown',{altKey:true});emit('pointermove',{clientX:210,clientY:120});emit('pointerup');assert.notEqual(app.exportDesign().view3d.az,cam.az);
const physical=JSON.stringify(app.getTrace());
for(const [id,key]of [['boardVisBtn','showBoards'],['namesBtn','showNames'],['waveBtn','showWavelengths'],['polBtn','polarization']]){
 els[id].click();assert.equal(app.exportDesign().display[key],false);assert.equal(JSON.stringify(app.getTrace()),physical);
}
els.saveBtn.click();const savedDisplay=JSON.parse(local.get('optical-bench-design-v8'));app.importDesign(savedDisplay);
assert.equal(app.exportDesign().display.showBoards,false);assert.equal(els.boardVisBtn.classList.contains('active'),false);
els.boardVisBtn.click();assert.equal(app.exportDesign().display.showBoards,true);els.undoBtn.click();assert.equal(app.exportDesign().display.showBoards,false);
console.log('PASS app editing, save, undo, import; right button ignored, left orbit mode, Alt orbit and Ctrl pan priority; independent display toggles and persistence');
// Exercise experiment integration with a deterministic clock and the same app instance.
doc.getElementById=id=>els[id]||null;
const shell=new Element(),bar=new Element(),oldQuery=doc.querySelector;
doc.querySelector=s=>s==='.app-shell'?shell:s==='.topbar'?bar:oldQuery(s);
let now=0,nextTimer=0;const timers=new Map();
context.Date={now:()=>now};context.setTimeout=(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,at:now+ms});return id};context.clearTimeout=id=>timers.delete(id);
for(const file of ['experiment','experiment-ui']){vm.runInContext(fs.readFileSync(__dirname+'/../dist/'+file+'.js','utf8'),context);Object.assign(context,win)}
els.expSpeed.value='1';els.expMetric.value='powerMw';els.experimentBtn.click();els.expExample.click();
assert.equal(app.exportDesign().components.length,6);assert.equal(app.exportDesign().experiment.steps[0].ratio,2);
els.expStep.click();assert.equal(shell.inert,true);assert.equal(els.expClose.disabled,true);assert.ok(els.expProgress.textContent.includes('1 / 91'));
const atFirst=JSON.stringify(app.exportDesign().components);els.expPlay.click();assert.equal(els.expPause.disabled,false);els.expPause.click();
assert.equal(els.expPlay.disabled,false);assert.equal(JSON.stringify(app.exportDesign().components),atFirst);
els.expPlay.click();let budget=200;while(timers.size&&budget--){const [id,t]=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at)[0];timers.delete(id);now=t.at;t.fn()}
assert.ok(els.expProgress.textContent.includes('91 / 91'));assert.equal(els.expPlay.disabled,true);assert.equal(app.exportDesign().components.find(c=>c.id==='POL1').roll,180);
els.expReset.click();assert.equal(shell.inert,false);assert.equal(app.exportDesign().components.find(c=>c.id==='POL1').roll,0);assert.equal(els.expCsv.disabled,true);
els.expStep.click();assert.ok(els.expProgress.textContent.includes('1 / 91'));els.expReset.click();
els.saveBtn.click();assert.equal(JSON.parse(local.get('optical-bench-design-v8')).experiment.steps[0].ratio,2);
console.log('PASS experiment example, single step, pause/resume clock, completion, reset, scene lock and recipe persistence');

for(const type of ['hwp','polarizer','qwp']){
 app.addComponent(type);const before=app.exportDesign().components.at(-1);
 for(const fn of win.events.keydown)fn({key:'r',target:new Element()});
 const after=app.exportDesign().components.at(-1);
 assert.equal(after.yaw,before.yaw+(type==='qwp'?0:5));assert.equal(after.roll,before.roll+(type==='qwp'?5:0));
 els.undoBtn.click();assert.equal(app.exportDesign().components.at(-1).yaw,before.yaw);
}
app.addComponent('material',{name:'石英样品',params:{interaction:'both',transmission:50,reflectivity:50}});
assert.equal(app.exportDesign().components.at(-1).name,'石英样品');
assert.equal(app.exportDesign().components.at(-1).params.interaction,'both');
console.log('PASS R rotation axis, undo, named material creation');

// Dialog interaction through the same DOM adapter (no browser layout assertions).
const inner=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
Object.defineProperty(Element.prototype,'innerHTML',{get:inner.get,set(value){inner.set.call(this,value);for(const m of value.matchAll(/id="([^"]+)"/g))els[m[1]]=new Element(m[1]);}});
Object.assign(Element.prototype,{setAttribute(k,v){this[k]=v},append(el){this.children.push(el);if(el.id)els[el.id]=el},replaceChildren(){this.children=[]},showModal(){this.open=true},close(){this.open=false},select(){}});
for(const file of ['component-packs','catalog-core','catalog-data','catalog-ui']){vm.runInContext(fs.readFileSync(__dirname+'/../dist/'+file+'.js','utf8'),context);Object.assign(context,win)}
const card=name=>els.componentLibrary.children.find(e=>e.innerHTML.includes('>'+name+'<'));
assert.equal(card('样品'),undefined);assert.ok(!html.includes('id="catalogBtn"'));
card('透镜').click();assert.equal(els.catalogPanel.open,true);assert.equal(els.catalogType.value,'lens');assert.ok(els.catalogResults.children.length>0);
els.catalogResults.children[0].click();els.catalogAdd.click();assert.ok(app.exportDesign().components.at(-1).catalog);assert.equal(els.catalogPanel.open,false);
card('偏振片').click();assert.equal(els.catalogType.value,'polarizer');els.genericAdd.click();assert.equal(app.exportDesign().components.at(-1).type,'polarizer');
card('材料').click();const count=app.exportDesign().components.length;els.materialCancel.click();assert.equal(app.exportDesign().components.length,count);
card('材料').click();els.materialName.value='测试玻璃';els.materialMode.value='both';els.materialForm.onsubmit({preventDefault(){}});
assert.equal(app.exportDesign().components.at(-1).name,'测试玻璃');assert.equal(app.exportDesign().components.at(-1).params.interaction,'both');assert.equal(els.materialPanel.open,false);
console.log('PASS library dialogs, type filter, catalog placement, generic fallback, material cancellation and creation');
