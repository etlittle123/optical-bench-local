const assert=require('node:assert/strict');global.window={};require('../dist/components.js');const defs=window.OPTICAL_COMPONENTS,O=require('../dist/engine3d.js');
const c=(id,type,x,params={})=>({id,name:id,type,x,y:100,z:100,yaw:0,pitch:0,roll:0,params:{...defs[type].defaults,...params}});
const s={version:8,showRays:true,boards:[{id:'board',x:0,y:0,cols:20,rows:15,spacing:25}],components:[c('LD1','laser',100,{power:1}),c('MAT1','material',200,{thickness:2,refractiveIndex:1.5,groupIndex:1.6,transmission:80}),c('PD1','detector',300)]};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} vs ${b}`),ray=x=>O.trace(x,defs).segments.find(r=>r.toId==='PD1');
let r=ray(s);assert.ok(r);near(r.beamEnd.power,.8);near(r.opl,201);near(r.timePs,201.2/.299792458);near(r.beam.wavelength,800);near(r.beam.polarization,0);assert.deepEqual(r.d,[1,0,0]);
assert.deepEqual(O.migrate(JSON.parse(JSON.stringify(s)),defs).components,s.components);
const copy=()=>JSON.parse(JSON.stringify(s));let a=copy();Object.assign(a.components[1].params,{thickness:0,transmission:100});r=ray(a);near(r.opl,200);near(r.timePs,200/.299792458);near(r.beamEnd.power,1);
a=copy();a.components[1].params.transmission=0;assert.ok(!ray(a)||ray(a).beamEnd.power===0);
a=copy();a.components[1].yaw=30;assert.ok(O.trace(a,defs).warnings.some(w=>w.includes('未计算折射')));
a=copy();a.components[1].type='sample';assert.equal(ray(a),undefined);
console.log('PASS material transmission, wavelength/polarization, phase/group path, zero limits, serialization, tilt warning and sample compatibility');
module.exports=s;

for(const mode of ['reflect','both']){
 a=copy();Object.assign(a.components[1].params,{interaction:mode,transmission:80,reflectivity:80});
 const out=O.trace(a,defs).segments.filter(r=>r.fromId==='MAT1');
 const reflected=out.find(r=>r.d[0]<0),transmitted=out.find(r=>r.d[0]>0);
 assert.ok(reflected);near(reflected.beam.power,mode==='both'?.5:.8);
 if(mode==='both'){assert.ok(transmitted);near(transmitted.beam.power,.5);near(transmitted.opl,201);near(transmitted.timePs,201.2/.299792458);}else assert.equal(transmitted,undefined);
 assert.equal(O.migrate(a,defs).components[1].params.interaction,mode);
}
console.log('PASS material reflection, dual output, energy conservation and mode persistence');
