const assert=require('node:assert/strict');global.window={};require('../dist/components.js');const O=require('../dist/engine3d.js');window.Optics3D=O;const {BenchView}=require('../dist/view3d.js');
const ctx=new Proxy({measureText:s=>({width:s.length*9}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
const canvas={getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,AA=='};
const defs=window.OPTICAL_COMPONENTS;
const component=(id,type,x,y=100)=>({id,type,name:type==='material'?'石英样品':id,x,y,z:100,yaw:0,pitch:0,roll:0,params:{...defs[type].defaults}});
const scene={version:8,showRays:true,boards:[{id:'b',x:0,y:0,cols:20,rows:14,spacing:25}],components:[component('l','laser',50),component('m','material',200),component('d','detector',350)]};
const trace=O.trace(scene,defs),before=JSON.stringify(scene);
for(const style of ['studio','paper']){
 const v=new BenchView(canvas,{style,animate:false});v.resize(1000,700);v.showBoards=style!=='paper';v.polarization=false;v.showWavelengths=false;v.setScene(scene,trace,new Set());v.preset('top');v.paint();
 assert.ok(v.labelLayout.some(b=>b.it.style.text==='石英样品'));
 for(const b of v.labelLayout){assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=v.w&&b.y+b.h<=v.h);assert.ok(b.score<3000,'Labels must avoid rays, components and each other in this scene');}
 const old=v.labelLayout;v.paint();assert.equal(v.labelLayout,old);v.camera.zoom*=1.2;v.dirty=true;v.paint();assert.notEqual(v.labelLayout,old);
 if(style==='paper'){assert.ok(v.items.some(i=>i.kind==='symbol'));assert.ok(!v.items.some(i=>i.kind==='hole'));}
}
window.document={createElement:()=>canvas};assert.equal(window.captureOpticalDiagram(scene).image,'data:image/png;base64,AA==');assert.equal(JSON.stringify(scene),before);
console.log('PASS material names, collision-aware labels, layout caching, paper symbols and immutable diagram export');
for(const style of ['studio','paper'])for(const type of ['pbs','wollaston','chopper']){
 const c=component('special',type,200),s={...scene,components:[scene.components[0],c]},v=new BenchView(canvas,{style,animate:false});v.resize(1000,700);v.polarization=false;v.setScene(s,O.trace(s,defs),new Set());v.preset('top');v.paint();assert.ok(v.labelLayout.some(b=>b.it.style.text===defs[type].name));
}
console.log('PASS specialized optics studio and paper rendering');
