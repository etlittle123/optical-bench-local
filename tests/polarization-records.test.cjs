const assert=require('node:assert/strict');global.window={};require('../dist/components.js');const C=require('../dist/polarization-records.js'),O=require('../dist/engine3d.js'),S=require('../dist/sheets.js'),L=require('../dist/lablog.js'),N=require('../dist/notion-export.js');
const defs=window.OPTICAL_COMPONENTS,ids={laser:'l',polarizer:'p',hwp:'h',pbs:'b'},scene={version:8,boards:[{id:'board',x:0,y:0,cols:20,rows:12,spacing:25}],components:Object.entries(ids).map(([type,id],i)=>({type,id,name:type+' <实验>',x:i*80,y:100,z:100,yaw:type==='pbs'?135:0,pitch:0,roll:0,params:{...defs[type].defaults}})),labLog:{meta:{title:'偏振实验'},data:null}};
const before=JSON.stringify(scene),input={ids,polarizerAngle:'30',hwpMaxAngle:'17.5',hwpMinAngle:'62.5',note:'样品 A | <script>alert(1)</script>'};
let result=C.save([],scene,input);assert.equal(result.records.length,1);assert.equal(result.record.polarizerAngle,30);assert.equal(JSON.stringify(scene),before);
const id=result.record.id;result=C.save(result.records,scene,{...input,hwpMaxAngle:18});assert.equal(result.records.length,1);assert.equal(result.record.id,id);assert.equal(result.updated,true);
result=C.save(result.records,scene,{...input,polarizerAngle:40});assert.equal(result.records.length,2);
result=C.save(result.records,scene,{...input,polarizerAngle:50},id);assert.equal(result.records.length,2);assert.equal(result.records[0].polarizerAngle,50);
for(const bad of ['',' ',[],null,undefined,NaN,Infinity,true])assert.throws(()=>C.record(scene,{...input,hwpMinAngle:bad}));
assert.throws(()=>C.record(scene,{...input,ids:{...ids,hwp:ids.polarizer}}));assert.throws(()=>C.save([],scene,input,'missing'));
assert.equal(C.record(scene,{...input,hwpMaxAngle:-15,hwpMinAngle:390}).hwpMinAngle,390);assert.throws(()=>C.record(scene,{...input,hwpMaxAngle:20,hwpMinAngle:20}));
scene.labLog.polarizationAngles=result.records;const restored=O.migrate(JSON.parse(JSON.stringify(scene)),defs);assert.deepEqual(restored.labLog.polarizationAngles,result.records);
let book=S.sync(restored),old=book.experimentBook.active;book=S.add(book);assert.equal(book.labLog.polarizationAngles,undefined);book=S.switchTo(book,old);assert.deepEqual(book.labLog.polarizationAngles,result.records);
const args={meta:{title:'偏振记录'},design:scene,polarizationAngles:result.records},html=L.report(args),md=N.markdown(args);
assert.equal((html.match(/<h2>/g)||[]).length,4);assert.equal((md.match(/^## /gm)||[]).length,4);
for(const text of [html,md]){assert.ok(text.includes('62.5°'));assert.ok(text.includes('反射最强'));assert.ok(text.includes('分光校准'));assert.ok(!text.includes('<script>'))}
assert.ok(md.includes('\\|'));assert.equal(C.html([]),'');assert.equal(C.markdown([]),'');
console.log('PASS extrema angle validation, fixed-angle groups, update semantics, no optical mutation, design persistence, sheet isolation and four-section HTML/Markdown exports');
const A=require('../dist/experiment-archive.js');
A.prepare(scene,new Set(),design=>{assert.deepEqual(design.labLog.polarizationAngles,result.records);return {}}).then(files=>{const report=Object.entries(files).find(([k])=>k.endsWith('.html'))[1],design=Object.entries(files).find(([k])=>k.endsWith('.json')&&!k.includes('本地附件'))[1],notion=Object.entries(files).find(([k])=>k.endsWith('.zip'))[1];assert.ok(report.includes('62.5°'));assert.deepEqual(JSON.parse(design).labLog.polarizationAngles,result.records);assert.ok(new TextDecoder().decode(notion).includes('62.5°'));console.log('PASS full experiment archive retains angle records in HTML, design JSON and Notion notes')}).catch(e=>{console.error(e);process.exitCode=1});
