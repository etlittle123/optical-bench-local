/* User-entered extrema angles; these are annotations, not simulated measurements. */
(function(root){'use strict';
const fail=m=>{throw Error(m)},copy=x=>JSON.parse(JSON.stringify(x));
function angle(v,label){if(!['string','number'].includes(typeof v)||typeof v==='string'&&!v.trim()||!Number.isFinite(Number(v)))fail('请填写有效的'+label);return Number(v)}
function record(scene,input){
 const names={},ids={};for(const [k,label]of [['laser','激光器'],['polarizer','偏振片'],['hwp','半波片'],['pbs','偏振分束棱镜']]){const c=scene.components.find(c=>c.id===input.ids?.[k]&&c.type===k);if(!c)fail('请选择'+label);ids[k]=c.id;names[k]=c.name}
 const polarizerAngle=angle(input.polarizerAngle,'偏振片固定角度'),hwpMaxAngle=angle(input.hwpMaxAngle,'半波片最大值角度'),hwpMinAngle=angle(input.hwpMinAngle,'半波片最小值角度');
 if(Math.abs(hwpMaxAngle-hwpMinAngle)<1e-9)fail('半波片最大值角度和最小值角度不能相同');
 return{version:1,id:'angle-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),ids,names,polarizerAngle,hwpMaxAngle,hwpMinAngle,note:String(input.note||'').slice(0,1000),updatedAt:new Date().toISOString()};
}
function save(list,scene,input,editId=''){
 if(!Array.isArray(list))fail('角度记录格式无效');const r=record(scene,input),out=copy(list);
 const i=editId?out.findIndex(x=>x.id===editId):out.findIndex(x=>Object.keys(r.ids).every(k=>x.ids?.[k]===r.ids[k])&&x.polarizerAngle===r.polarizerAngle);
 if(editId&&i<0)fail('原记录已不存在，请重新打开');if(i>=0){r.id=out[i].id;out[i]=r}else{if(out.length>=200)fail('每个实验最多 200 条角度记录');out.push(r)}return{records:out,record:r,updated:i>=0};
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cell=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ');
function rows(list){return (Array.isArray(list)?list:[]).filter(r=>r&&[r.polarizerAngle,r.hwpMaxAngle,r.hwpMinAngle].every(Number.isFinite)).map(r=>[r.names?.laser||r.ids?.laser,r.names?.polarizer||r.ids?.polarizer,r.names?.hwp||r.ids?.hwp,r.names?.pbs||r.ids?.pbs,r.polarizerAngle+'°',r.hwpMaxAngle+'°',r.hwpMinAngle+'°',r.note||''])}
const headings=['激光器','偏振片','半波片','PBS','偏振片固定角度','半波片：反射最强','半波片：反射最弱','备注'];
const explanation='用户设置的 PBS 反射端极值角度，并作为该半波片到 PBS 的分光校准：半波片 Roll 等于反射最弱角度时反射比例为 0，等于反射最强角度时为 100%，中间按 sin² 过渡。角度按实验刻度记录，不移动器件，也不修改 Roll；校准结果仍是简化模型。';
function html(list){const rs=rows(list);return rs.length?'<h3>PBS 反射端极值角度记录</h3><p>'+explanation+'</p><table><thead><tr>'+headings.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rs.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>':''}
function markdown(list){const rs=rows(list);return rs.length?'### PBS 反射端极值角度记录\n\n'+explanation+'\n\n| '+headings.join(' | ')+' |\n| '+headings.map(()=> '---').join(' | ')+' |\n'+rs.map(r=>'| '+r.map(cell).join(' | ')+' |').join('\n')+'\n\n':''}
const api={record,save,html,markdown};root.PolarizationRecords=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
