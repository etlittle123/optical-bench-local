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
const sp=component('sp','spectralFilter',160),lp=component('lp','spectralFilter',220),nd=component('nd','nd',280),bp=component('bp','spectralFilter',340);
sp.params.cutoffWavelength=775;lp.params.filterType='longpass';lp.params.cutoffWavelength=650;nd.params.opticalDensity=2;nd.catalog={vendor:'Hidden vendor',ranges:[[350,1100]]};bp.params.filterType='bandpass';bp.params.centerWavelength=800;bp.params.bandwidth=10;
const crowded={...scene,components:[component('source','laser',50),sp,lp,nd,bp,component('end','detector',430)]};
for(const style of ['studio','paper']){
 const v=new BenchView(canvas,{style,animate:false});v.resize(1000,700);v.showBoards=false;v.showWavelengths=false;v.polarization=false;
 assert.equal(v.componentName(sp),'SP · 775 nm');assert.equal(v.componentName(lp),'LP · 650 nm');assert.equal(v.componentName(nd),'ND · OD 2\n工作波段 350–1100 nm');assert.equal(v.componentName(bp),'BP · 800 nm\n带宽 10 nm');
 for(const preset of ['top','iso'])for(const zoom of [.6,1,1.5]){v.setScene(crowded,O.trace(crowded,defs),new Set());v.preset(preset);v.camera.zoom=zoom;v.dirty=true;v.paint();
  for(const b of v.labelLayout){assert.ok(b.score<3000,`${style}/${preset}/${zoom}: ${b.it.style.text} occludes a ray, optic, label or connector`);assert.ok(b.w<=212);assert.ok(b.lines.every(l=>!l.includes('\n')));assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=v.w&&b.y+b.h<=v.h)}
  const label=v.labelLayout.find(b=>b.it.style.text.startsWith('ND'));assert.equal(label.lines[0],'ND · OD 2');assert.ok(label.fonts[0].includes('13px'));assert.ok(label.fonts[1].includes('12px'));
 }
 nd.params.opticalDensity=.04;assert.ok(v.componentName(nd).startsWith('ND · OD 0.04'));nd.params.opticalDensity=2;
 assert.equal(v.componentName({...nd,catalog:undefined}),'ND · OD 2\n工作波段未录入');
}
console.log('PASS live filter specifications, explicit unknown ND ranges, compact multiline labels and dense-layout avoidance at multiple zooms in studio/paper views');
