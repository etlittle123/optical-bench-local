const assert=require('node:assert/strict');
global.window={};require('../dist/components.js');require('../dist/catalog-data.js');
const defs=window.OPTICAL_COMPONENTS,C=require('../dist/catalog-core.js'),P=require('../dist/component-packs.js'),O=require('../dist/engine3d.js');
const pack=C.validate(window.OPTICAL_CATALOG,defs,P),rs=pack.records,coverage=require('../catalog/coverage.json');
const expected=["47-533","47-535","49-871","62-986","63-048","63-413","63-415","64-333","68-750","68-823","86-104","89-547","89-552","39-044","39-045","11-166","26-994","MC2000B","SAHWP05M-1700","WP25M-UB1","LA4380","LA4380-AB","LA4148-AB","LA4102-AB","BB1-E03-10","PF10-03-P01-10","NLC08","NLC09","BDM1-B-P10","PM10-AG-P10","DP20","DP12","NDFR10-20","NDFR10-30","NDFR10-40","FLP25-NIR-M","WGP20-VISIR","EF10-750SP","EF10-700SP"];
assert.deepEqual(rs.map(r=>r.sku).sort(),expected.sort());assert.equal(rs.length,coverage.total);
for(const [vendor,n]of [['LBTEK',11],['Thorlabs',11],['Edmund Optics',17]])assert.equal(C.search(rs,{vendor}).length,n);
assert.equal(C.search(rs,{query:'86104'})[0].sku,'86-104');assert.equal(C.search(rs,{query:'LA1509'}).length,0);
assert.equal(C.search(rs,{query:'DP12'}).length,1);assert.equal(rs.find(r=>r.sku==='DP12').documents.length,2);
for(const row of rs){const c=C.instantiate(row,defs);assert.ok(row.documents.length);for(const v of Object.values(c.params))if(typeof v==='number')assert.ok(Number.isFinite(v));if(row.baseType==='lens')assert.ok(row.params.focalLength>0);assert.ok(row.source||row.documents.length);const restored=O.migrate({version:8,boards:[{id:'b'}],components:[c]},defs);assert.deepEqual(restored.components[0].catalog,c.catalog);}
for(const sku of ['BB1-E03-10','PF10-03-P01-10','BDM1-B-P10','PM10-AG-P10']){const r=rs.find(r=>r.sku===sku);assert.equal(C.instantiate(r,defs).type,'mirror');assert.match(r.notes,/每次添加仅放置 1 片/);}
assert.equal(rs.find(r=>r.sku==='68-823').baseType,'wollaston');assert.equal(rs.find(r=>r.sku==='49-871').baseType,'pbs');
assert.equal(rs.find(r=>r.sku==='LA4380-AB').params.focalLength,100.3);assert.equal(rs.find(r=>r.sku==='NLC08').params.thickness,.03);
const saved={...rs.find(r=>r.sku==='LA4380'),params:{focalLength:321}};
const combined=C.available(rs,[saved]);assert.equal(combined.length,39);assert.equal(combined.find(r=>r.sku===saved.sku).params.focalLength,321);assert.notEqual(rs.find(r=>r.sku===saved.sku).params.focalLength,321);
const r=C.search(rs,{query:'86104'})[0],item=C.instantiate(r,defs,[],{x:100,y:100});
assert.equal(item.params.blockTransmission,.01);assert.equal(item.params.cutoffWavelength,775);assert.match(C.status(item,'refractiveIndex'),/未收录/);
item.params.thickness=7;assert.equal(C.status(item,'thickness'),'用户修改');item.params.thickness=3;assert.notEqual(C.instantiate(r,defs,[item]).id,item.id);
assert.throws(()=>C.merge(rs,[r]));
const clone=x=>JSON.parse(JSON.stringify(x)),checkBad=mutate=>{const bad=clone(r);mutate(bad);assert.throws(()=>C.validate({...pack,records:[bad]},defs,P));};
checkBad(r=>r.source='javascript:alert(1)');checkBad(r=>delete r.basis.thickness);checkBad(r=>r.params.thickness=-2);
checkBad(r=>{r.source='';r.documents=[]});checkBad(r=>r.documents=[{}]);checkBad(r=>r.limits={thickness:[5,2]});
assert.throws(()=>C.validate(JSON.parse('{"__proto__":{}}'),defs,P));
assert.equal(C.warnings(item,800,0).length,0);assert.ok(C.warnings(item,780,0).length);assert.ok(C.warnings(item,800,5).length);
for(const [sku,k,bad]of [['63-048','opticalDensity',4.1],['DP12','aperture',13]]){const c=C.instantiate(rs.find(r=>r.sku===sku),defs);assert.equal(C.warnings(c,500,0).length,0);c.params[k]=bad;assert.match(C.warnings(c,500,0).join(' '),/可调范围/);}
const s={version:8,boards:[{id:'b',x:0,y:0,cols:20,rows:20,spacing:25}],components:[{id:'ld',name:'LD',type:'laser',x:0,y:100,z:100,yaw:0,pitch:0,roll:0,params:{...defs.laser.defaults,power:1}},item,{id:'pd',name:'PD',type:'detector',x:200,y:100,z:100,yaw:0,pitch:0,roll:0,params:{...defs.detector.defaults}}],catalogRecords:[]};
let ray=O.trace(s,defs).segments.find(r=>r.toId==='pd');assert.ok(Math.abs(ray.beamEnd.power-.0001)<1e-8);s.components[0].params.wavelength=400;ray=O.trace(s,defs).segments.find(r=>r.toId==='pd');assert.ok(Math.abs(ray.beamEnd.power-.91)<1e-8);
const L=require('../dist/lablog.js'),report=L.report({meta:{},design:s});assert.ok(!report.includes('86-104'));assert.ok(!report.includes('edmundoptics.com'));assert.equal((report.match(/<h2>/g)||[]).length,4);
console.log('PASS selected 39 models, document provenance, deduplication, package semantics, validation, limits, roundtrip and spectral tracing');
