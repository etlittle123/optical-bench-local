(function(){'use strict';
const app=OpticalBench,C=PolarizationRecords,$=id=>document.getElementById(id),esc=LabLogCore.esc,copy=x=>JSON.parse(JSON.stringify(x));
let panel,editId='',returnToLog=false;
const records=()=>app.exportDesign().labLog?.polarizationAngles||[];
function message(s){$('polAngleStatus').textContent=s}
function choices(){const scene=app.exportDesign();for(const k of ['laser','polarizer','hwp','pbs'])$('polAngle_'+k).innerHTML=scene.components.filter(c=>c.type===k).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')}
function render(){
 $('polAngleRecord').innerHTML='<option value="">新建角度记录</option>'+records().map(r=>'<option value="'+esc(r.id)+'">'+esc(r.names.pbs)+' · 偏振片 '+esc(r.polarizerAngle)+'°</option>').join('');$('polAngleRecord').value=editId;
 $('polAngleList').innerHTML=C.html(records());$('polAngleDelete').disabled=!editId;
}
function select(id){editId=id;choices();const r=records().find(r=>r.id===id);if(r){for(const [k,v]of Object.entries(r.ids))$('polAngle_'+k).value=v;for(const k of ['polarizerAngle','hwpMaxAngle','hwpMinAngle','note'])$('polAngle_'+k).value=r[k]??''}else{for(const k of ['polarizerAngle','hwpMaxAngle','hwpMinAngle','note'])$('polAngle_'+k).value=''}render()}
function store(list){const log=copy(app.exportDesign().labLog||{meta:{},data:null});log.polarizationAngles=list;app.setLabLog(log)}
function close(){panel.close();if(returnToLog)LabLogUI.open()}
function open(pbsId){
 if(window.experimentLocked)return;returnToLog=!$('labLogPanel').hidden;if(returnToLog)LabLogUI.saveDraft();
 if(!panel){panel=document.createElement('dialog');panel.id='polarizationPanel';panel.setAttribute('aria-label','PBS 反射端极值角度');panel.innerHTML=`<header><h2>PBS 反射端极值角度</h2><button id="polAngleClose">关闭</button></header><p>记录光路：激光 → 偏振片 → 半波片 → PBS。固定偏振片后，填写半波片在反射光最强、最弱时的刻度。保存后，半波片的 Roll 按这两个角度校准 PBS 的反射与透射比例。</p>
 <label>已有记录<select id="polAngleRecord"></select></label><button id="polAngleNew">＋ 新记录</button>
 <div class="log-grid">${[['laser','激光器'],['polarizer','偏振片'],['hwp','半波片'],['pbs','偏振分束棱镜']].map(([k,n])=>'<label>'+n+'<select id="polAngle_'+k+'"></select></label>').join('')}
 <label>偏振片固定角度 / °<input id="polAngle_polarizerAngle" type="number" step="any"></label><label>半波片：反射光最强角度 / °<input id="polAngle_hwpMaxAngle" type="number" step="any"></label><label>半波片：反射光最弱角度 / °<input id="polAngle_hwpMinAngle" type="number" step="any"></label><label>备注（可选）<input id="polAngle_note" maxlength="1000"></label></div>
 <p>这里保存你指定的实验角度，不需要填写光强；保存后会按记录角度校准该半波片到 PBS 的分光。不会移动器件，也不自动修改 Roll。模拟器中绕光轴的角度是 Roll。</p><button id="polAngleSave" class="primary">保存角度记录</button> <button id="polAngleDelete">删除此条</button><p id="polAngleStatus" role="status" aria-live="polite"></p><div id="polAngleList"></div><p>记录保存在当前实验中。使用顶部“保存”下载设计 JSON；导出的实验笔记也会包含这些角度。</p>`;
 document.body.appendChild(panel);panel.addEventListener('keydown',e=>e.stopPropagation());panel.addEventListener('cancel',e=>{e.preventDefault();close()});
 $('polAngleClose').onclick=close;$('polAngleNew').onclick=()=>{select('');message('请填写新一组角度。')};$('polAngleRecord').onchange=()=>{select($('polAngleRecord').value);message('')};
 $('polAngleSave').onclick=()=>{try{if(window.experimentLocked)return;const input={ids:Object.fromEntries(['laser','polarizer','hwp','pbs'].map(k=>[k,$('polAngle_'+k).value])),...Object.fromEntries(['polarizerAngle','hwpMaxAngle','hwpMinAngle','note'].map(k=>[k,$('polAngle_'+k).value]))},result=C.save(records(),app.exportDesign(),input,editId);store(result.records);editId=result.record.id;render();message(result.updated?'已更新角度记录。':'已保存角度记录。')}catch(e){message(e.message)}};
 $('polAngleDelete').onclick=()=>{if(window.experimentLocked||!editId)return;if(!confirm('删除这条极值角度记录？'))return;store(records().filter(r=>r.id!==editId));select('');message('已删除这条记录。')};
 }
 select('');if(pbsId){const r=records().find(r=>r.ids.pbs===pbsId);if(r)select(r.id);else $('polAngle_pbs').value=pbsId}message('');panel.showModal();
}
window.PolarizationRecordUI={open};$('logPolarizationBtn').onclick=()=>open();
})();
