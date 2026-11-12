/* Offline catalog records: specifications are distinct from simulation assumptions. */
(function(root){'use strict';
const copy=x=>JSON.parse(JSON.stringify(x)),fail=m=>{throw Error(m)},obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const key=r=>r.vendor.toLowerCase()+'|'+r.sku.toLowerCase();
const norm=s=>String(s).toLowerCase().replace(/[\s#_-]/g,'');
function safe(x,d=0){if(d>15)fail('数据嵌套过深');if(x&&typeof x==='object')for(const k of Object.keys(x)){if(['__proto__','prototype','constructor'].includes(k))fail('非法字段');safe(x[k],d+1)}}
function url(s){try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''}catch{return ''}}
function validate(input,defs,packs){
 safe(input);if(!obj(input)||input.kind!=='optical-bench-catalog'||input.version!==1||!Array.isArray(input.records)||input.records.length>10000)fail('需要 version 1 器材库 JSON，最多 10000 个条目');
 const seen=new Set();return {kind:input.kind,version:1,records:input.records.map(r=>{
  for(const k of ['vendor','sku','name','checked','notes'])if(typeof r[k]!=='string'||!r[k].trim()||r[k].length>3000)fail('缺少或无效字段：'+k);
  const documents=r.documents||[];
  if(!Array.isArray(documents)||documents.length>20||documents.some(s=>typeof s!=='string'||!s.trim()||s.length>300))fail('清单来源格式错误');
  if(typeof r.source!=='string'||(r.source?!url(r.source):!documents.length)||r.vendor.length>60||r.sku.length>80||r.name.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(r.checked))fail('厂商、型号、来源或核对日期无效');
  if(seen.has(key(r)))fail('重复厂商和型号：'+r.sku);seen.add(key(r));
  const p=packs.validate({kind:'optical-bench-components',version:1,id:'catalog-check',templates:[{id:'item',name:r.name,baseType:r.baseType,params:r.params}]},defs).templates[0].params;
  if(!obj(r.basis)||Object.keys(p).some(k=>typeof r.basis[k]!=='string'||!r.basis[k].trim()))fail('每个映射参数都需要 basis 来源或近似说明');
  if(!Array.isArray(r.specs)||r.specs.length>40||r.specs.some(s=>!Array.isArray(s)||s.length!==2||s.some(v=>typeof v!=='string'||v.length>500)))fail('specs 必须为名称、值的字符串对');
  const ranges=r.ranges||[];if(!Array.isArray(ranges)||ranges.length>10||ranges.some(a=>!Array.isArray(a)||a.length!==2||!a.every(Number.isFinite)||a[0]<=0||a[0]>=a[1]))fail('有效波段格式错误');
  if(r.designWavelength!==undefined&&(!Number.isFinite(r.designWavelength)||r.designWavelength<=0))fail('设计波长无效');
  if(r.maxAOI!==undefined&&(!Number.isFinite(r.maxAOI)||r.maxAOI<0||r.maxAOI>90))fail('入射角范围错误');
  const limits=r.limits||{};if(!obj(limits)||Object.entries(limits).some(([k,a])=>!Object.hasOwn(p,k)||!Array.isArray(a)||a.length!==2||!a.every(Number.isFinite)||a[0]>a[1]||p[k]<a[0]||p[k]>a[1]))fail('可调参数范围无效');
  return {vendor:r.vendor.trim(),sku:r.sku.trim(),name:r.name,baseType:r.baseType,params:p,basis:Object.fromEntries(Object.keys(p).map(k=>[k,String(r.basis[k]).slice(0,1000)])),specs:copy(r.specs),source:url(r.source),checked:r.checked,notes:r.notes,ranges:copy(ranges),...(documents.length?{documents:copy(documents)}:{}),...(Object.keys(limits).length?{limits:copy(limits)}:{}),...(r.designWavelength!==undefined?{designWavelength:r.designWavelength}:{}),...(r.maxAOI!==undefined?{maxAOI:r.maxAOI}:{})};
 })};
}
function search(records,{vendor='',query='',type=''}={}){const q=norm(query);return records.filter(r=>(!vendor||r.vendor===vendor)&&(!type||r.baseType===type)&&(!q||norm(r.vendor+' '+r.sku+' '+r.name+' '+r.specs.flat().join(' ')).includes(q))).sort((a,b)=>(norm(b.sku)===q)-(norm(a.sku)===q)||a.vendor.localeCompare(b.vendor)||a.sku.localeCompare(b.sku))}
function merge(a,b){const m=new Map(a.map(r=>[key(r),r]));for(const r of b){if(m.has(key(r)))fail('型号已存在：'+r.vendor+' '+r.sku+'。请勿覆盖已有规格快照。');m.set(key(r),r)}if(m.size>10000)fail('器材库最多 10000 条');return [...m.values()]}
function available(bundled,saved){const keys=new Set(saved.map(key));return merge(bundled.filter(r=>!keys.has(key(r))),saved)}
function instantiate(r,defs,existing=[],pose={}){let id='catalog-item',n=1;while(existing.some(c=>c.id===id))id='catalog-item-'+n++;const params={...defs[r.baseType].defaults,...r.params};return{id,type:r.baseType,name:r.vendor+' '+r.sku,x:100,y:100,z:100,yaw:['mirror','beamsplitter','dichroic','pbs'].includes(r.baseType)?135:0,pitch:0,roll:defs[r.baseType].defaults.axisAngle||0,...pose,params,catalog:{...copy(r),initialParams:copy(params)}}}
function status(c,k){if(!c.catalog)return '';if(c.catalog.initialParams?.[k]!==c.params[k])return '用户修改';return c.catalog.basis?.[k]||'未收录：使用通用模型默认值，需核对'}
function warnings(c,wavelength,angle){const r=c.catalog;if(!r)return [];const out=[];for(const [k,[lo,hi]] of Object.entries(r.limits||{}))if(c.params[k]<lo||c.params[k]>hi)out.push(c.name+'：'+k+' 超出收录的可调范围 '+lo+'–'+hi+'；当前设置为用户外推。');if(r.designWavelength&&Math.abs(wavelength-r.designWavelength)>.1)out.push(c.name+(c.type==='wollaston'?'：夹角参考波长为 ':'：设计波长为 ')+r.designWavelength+' nm；当前波长偏离设计点，仍使用当前理想模型参数。');if(c.params.filterType==='bandpass')out.push(c.name+'：理想矩形带通近似，边缘与阻带漏光不是实测曲线；未模拟角度蓝移。');if(r.ranges?.length&&!r.ranges.some(a=>wavelength>=a[0]&&wavelength<=a[1]))out.push(c.name+'：'+wavelength+' nm 位于已收录规格波段之外或过渡区；功率结果仅为简化模型外推。');if(Number.isFinite(r.maxAOI)&&angle>r.maxAOI+.1)out.push(c.name+'：入射角超出收录的 '+r.maxAOI+'° 条件，未模拟镀膜随角度变化。');return out}
const api={validate,search,merge,available,instantiate,status,warnings,url};root.CatalogCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
