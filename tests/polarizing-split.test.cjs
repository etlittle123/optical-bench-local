const assert=require('node:assert/strict');global.window={};require('../dist/components.js');
const D=window.OPTICAL_COMPONENTS,O=require('../dist/engine3d.js'),P=require('../dist/component-packs.js'),{V}=O;
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const component=(id,type,x,yaw=0,params={})=>({id,name:id,type,x,y:100,z:100,yaw,pitch:0,roll:0,params:{...D[type].defaults,...params}});
const scene=components=>({version:8,boards:[{id:'b',x:0,y:0,cols:20,rows:20,spacing:25}],components});
for(const [angle,ellipticity,transmit]of [[0,0,1],[45,0,.5],[90,0,0],[0,45,.5]]){
 const s=scene([component('l','laser',0,0,{power:1,polarization:angle,ellipticity}),component('p','pbs',100,135)]),trace=O.trace(s,D),out=trace.segments.filter(r=>r.fromId==='p');
 near(out.reduce((n,r)=>n+r.beam.power,0),1);
 near(out.filter(r=>r.branch.endsWith('T')).reduce((n,r)=>n+r.beam.power,0),transmit);
 for(const r of out){near(V.dot(r.beam.field.re,r.d),0);near(V.dot(r.beam.field.im,r.d),0);near(O.intensity(r.beam.field),1);if(r.branch.endsWith('R')){near(r.d[0],0);near(r.d[1],1)}}
 s.components[1].params.transmission=90;s.components[1].params.reflectivity=99;
 near(O.trace(s,D).segments.filter(r=>r.fromId==='p').reduce((n,r)=>n+r.beam.power,0),transmit*.9+(1-transmit)*.99);
}
for(const roll of [0,37,90])for(const [angle,ellipticity]of [[0,0],[45,0],[90,0],[0,45]]){
 const w=component('w','wollaston',100,0,{separationAngle:16});w.roll=roll;
 const s=scene([component('l','laser',0,0,{power:1,polarization:angle,ellipticity}),w]),out=O.trace(s,D).segments.filter(r=>r.fromId==='w');
 near(out.reduce((n,r)=>n+r.beam.power,0),1);
 for(const r of out){assert.ok(r.d[0]>.98);near(V.dot(r.beam.field.re,r.d),0);near(V.dot(r.beam.field.im,r.d),0);near(O.intensity(r.beam.field),1);near(r.beam.ellipticity,0)}
 if(out.length===2){near(O.deg(Math.acos(V.dot(out[0].d,out[1].d))),16);const a=O.transport(out[0].beam.field,out[0].d,[1,0,0]),b=O.transport(out[1].beam.field,out[1].d,[1,0,0]);near(V.dot(a.re,b.re)+V.dot(a.im,b.im),0)}
}
for(const dutyCycle of [0,50,100]){
 const t=O.trace(scene([component('l','laser',0,0,{power:10}),component('c','chopper',100,0,{dutyCycle})]),D);
 near(t.segments.filter(r=>r.fromId==='c').reduce((n,r)=>n+r.beam.power,0),dutyCycle/10);assert.ok(t.warnings.some(w=>w.includes('时间平均功率')));
}
for(const [type,params]of [['chopper',{dutyCycle:101}],['wollaston',{separationAngle:90}],['wollaston',{separationAngle:0}]])assert.throws(()=>P.validate({kind:'optical-bench-components',version:1,id:'bad',templates:[{id:'bad',name:'bad',baseType:type,params}]},D));
console.log('PASS PBS polarization routing and losses, Wollaston double beams and roll, transverse fields, energy balance, chopper duty cycle and invalid parameters');
