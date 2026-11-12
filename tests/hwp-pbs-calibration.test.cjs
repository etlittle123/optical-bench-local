const assert=require('node:assert/strict');global.window={};require('../dist/components.js');
const D=window.OPTICAL_COMPONENTS,O=require('../dist/engine3d.js'),{V}=O,{BenchView}=require('../dist/view3d.js');
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const part=(id,type,pose={},params={})=>({id,name:id,type,x:100,y:100,z:100,yaw:0,pitch:0,roll:0,...pose,params:{...D[type].defaults,...params}});
const scene=(components,records)=>({version:8,boards:[{id:'b',x:0,y:0,cols:20,rows:20,spacing:25}],components,...(records?{labLog:{polarizationAngles:records}}:{})});
const record=(id,{P=0,max=45,min=0}={})=>({version:1,id,ids:{laser:'L',polarizer:'P',hwp:'H',pbs:'B'},names:{laser:'L',polarizer:'P',hwp:'H',pbs:'B'},polarizerAngle:P,hwpMaxAngle:max,hwpMinAngle:min,note:''});
const layout=options=>scene([
 part('L','laser',{x:0},{power:100,polarization:0}),
 part('P','polarizer',{x:100},{transmission:100}),
 part('H','hwp',{x:200,roll:options.roll},{transmission:100}),
 part('B','pbs',{x:300,yaw:135})
],options.records);
function split(s){const t=O.trace(s,D),segs=t.segments.filter(r=>r.fromId==='B'),sum=pred=>segs.filter(pred).reduce((n,r)=>n+r.beam.power,0);return{R:sum(r=>r.branch.endsWith('R')),T:sum(r=>r.branch.endsWith('T')),segments:segs,warnings:t.warnings}}

let out=split(layout({roll:22.5}));
near(out.R,50,1e-6);near(out.T,50,1e-6);
near(split(layout({roll:0})).R,0);near(split(layout({roll:45})).R,100,1e-6);
console.log('PASS uncalibrated HWP to PBS split still follows the ideal sin^2 law');

const cal=record('a1',{max:17.5,min:62.5});
for(const [roll,R] of [[17.5,100],[62.5,0],[40,50],[85,50],[107.5,100]]){
 out=split(layout({roll,records:[cal]}));near(out.R,R,1e-6);near(out.T,100-R,1e-6);
 for(const r of out.segments){near(V.dot(r.beam.field.re,r.d),0);near(V.dot(r.beam.field.im,r.d),0);near(O.intensity(r.beam.field),1)}
}
near(O.extremaFraction(17.5,cal),1);near(O.extremaFraction(62.5,cal),0);near(O.extremaFraction(40,cal),.5);
assert.equal(O.extremaFraction(0,{...cal,hwpMaxAngle:0,hwpMinAngle:0}),null);
assert.ok(split(layout({roll:40,records:[cal]})).warnings.some(w=>w.includes('极值角度记录校准')));
console.log('PASS recorded extrema anchor the PBS split (weakest 0%, strongest 100%, sin^2 between) and keep transverse fields');

out=split(layout({roll:17.5}));
near(out.R,100*Math.sin(Math.PI*35/180)**2,1e-6);
out=split(layout({roll:17.5,records:[]}));
near(out.R,100*Math.sin(Math.PI*35/180)**2,1e-6);
console.log('PASS ideal physics returns when the extrema record is absent');

const records=[record('a0',{P:0,max:45,min:0}),record('b30',{P:30,max:0,min:45})];
const selected=roll=>{const s=layout({roll,records});s.components[1].roll=30;return split(s)};
near(selected(0).R,75,1e-6);near(selected(45).R,0);
const selected0=roll=>split(layout({roll,records}));
near(selected0(45).R,100,1e-6);near(selected0(0).R,0);
near(split(layout({roll:20,records:[record('c',{max:30,min:10})]})).R,50,1e-6);
const wrapped=[record('w170',{P:170,max:45,min:0}),record('w10',{P:10,max:0,min:45})],wrappedScene=layout({roll:45,records:wrapped});
wrappedScene.components[1].roll=-10;
near(split(wrappedScene).R,100*Math.cos(Math.PI*10/180)**2,1e-6);
console.log('PASS multiple polarizer-angle records are selected by the last polarizer roll, including angles across 180°');

const vertical=scene([
 part('L','laser',{x:100,y:100,z:300,pitch:-90},{power:100,polarization:90}),
 part('H','hwp',{x:100,y:100,z:200,pitch:-90,roll:0},{transmission:100}),
 part('B','pbs',{x:100,y:100,z:100,pitch:-45})
],[record('v',{max:45,min:0})]);
out=split(vertical);near(out.R,0);
vertical.components[1].roll=45;out=split(vertical);near(out.R,100,1e-6);
for(const r of out.segments){near(V.dot(r.beam.field.re,r.d),0);near(V.dot(r.beam.field.im,r.d),0)}
console.log('PASS calibration follows the PBS splitting plane for a non-horizontal beam');

const viewScene=layout({roll:10}),viewTrace=O.trace(viewScene,D),view=new BenchView({getContext:()=>({})},{animate:false});
view.setScene(viewScene,viewTrace,new Set());
const branches=viewTrace.segments.filter(r=>r.fromId==='B'),strong=branches.find(r=>r.branch.endsWith('T')),weak=branches.find(r=>r.branch.endsWith('R')),styleOf=r=>view.items.find(i=>i.id?.kind==='ray'&&i.id.id===r.id).style;
assert.ok(styleOf(strong).width>styleOf(weak).width);
assert.ok(styleOf(strong).opacity>styleOf(weak).opacity);
const texts=view.items.filter(i=>i.kind==='text').map(i=>i.style.text);
assert.ok(texts.includes('800 nm · 12%')&&texts.includes('800 nm · 88%'),texts.join(' | '));
console.log('PASS beam width, opacity and split labels expose the PBS output ratio');
