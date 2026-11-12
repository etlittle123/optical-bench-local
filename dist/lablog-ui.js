(()=>{'use strict';
const $=id=>document.getElementById(id),C=LabLogCore,app=OpticalBench,esc=C.esc,copy=x=>JSON.parse(JSON.stringify(x));
const defaults=()=>({meta:{title:'实验日志',date:new Date().toLocaleDateString('sv-SE'),author:'',purpose:'',settings:'',notes:''},data:null});
let draft=defaults(),table=null,current=null;
const note=t=>$('logStatus').textContent=t;
function download(name,text,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function parser(){return{delimiter:$('logDelimiter').value,header:$('logHeader').checked,skip:Number($('logSkip').value),decimalComma:$('logDecimal').checked}}
function mapping(){return{x:$('logX').value===''?-1:Number($('logX').value),y:$('logY').value===''?-1:Number($('logY').value),xScale:Number($('logXScale').value),yScale:Number($('logYScale').value),xLabel:$('logXLabel').value,yLabel:$('logYLabel').value}}
function fields(){for(const key of ['title','date','author','purpose','settings','notes'])draft.meta[key]=$('log_'+key).value}
function persist(){fields();app.setLabLog(copy(draft))}
function renderMap(){
 current=null;$('logChart').innerHTML='';$('logExport').disabled=!!draft.data;
 if(!draft.data)return;
 try{draft.data.mapping=mapping();draft.data.kind=$('logKind').value;current=C.map(table,draft.data.mapping);
  $('logChart').innerHTML=C.chart(current.points,draft.data.mapping.xLabel,draft.data.mapping.yLabel);
  const bad=current.rejected.slice(0,8).map(r=>r.line).join(', ');
  note('有效 '+current.points.length+' / '+current.total+' 行；排除 '+current.rejected.length+' 行'+(bad?'（原始行 '+bad+(current.rejected.length>8?' …':'')+'）':'')+'。图按文件顺序连线，未排序、未拟合。');
  $('logExport').disabled=false;persist();
 }catch(e){note(e.message)}
}
function parseData(preserve=false){
 if(!draft.data)return;current=null;table=null;$('logExport').disabled=true;
 try{
  draft.data.parser=parser();table=C.parse(draft.data.raw,draft.data.parser);
  const options=table.headers.map((h,i)=>'<option value="'+i+'">'+(i+1)+' · '+esc(h)+'</option>').join('');
  $('logX').innerHTML=options;$('logY').innerHTML=options;
  $('logX').value=preserve?draft.data.mapping.x:0;$('logY').value=preserve?draft.data.mapping.y:Math.min(1,table.headers.length-1);
  $('logPreview').innerHTML='<table><thead><tr><th>原始行</th>'+table.headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+table.rows.slice(0,6).map(r=>'<tr><td>'+r.line+'</td>'+r.cells.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  if(!preserve){$('logXLabel').value=table.headers[0];$('logYLabel').value=table.headers[Math.min(1,table.headers.length-1)]}
  renderMap();
 }catch(e){$('logPreview').innerHTML='';$('logChart').innerHTML='';note(e.message)}
}
function renderSheets(){const b=app.exportDesign().experimentBook,host=$('logSheets');host.replaceChildren();for(const sh of b.sheets){const btn=document.createElement('button');btn.textContent=sh.name;btn.setAttribute('role','tab');btn.setAttribute('aria-selected',String(sh.id===b.active));btn.onclick=()=>{persist();app.switchSheet(sh.id);open()};host.appendChild(btn);const del=document.createElement('button');del.textContent='×';del.className='sheet-delete';del.title='删除实验：'+sh.name;del.setAttribute('aria-label','删除实验：'+sh.name);del.disabled=b.sheets.length<=1;del.onclick=()=>{if(window.experimentLocked||exporting)return;persist();const live=app.exportDesign().experimentBook.sheets.find(x=>x.id===sh.id);if(!live)return;if(!confirm('删除实验「'+live.name+'」？\n该 Sheet 的光路、数据、日志和录制动作都会删除，其他实验不受影响。此操作不能撤销。'))return;try{app.deleteSheet(sh.id);open();note('已删除实验「'+live.name+'」。请保存或导出 JSON 以保留更改。')}catch(e){note(e.message)}};host.appendChild(del)}const add=document.createElement('button');add.textContent='＋ 新实验';add.onclick=()=>{persist();app.newSheet();open()};host.appendChild(add)}
function open(){
 if(window.experimentLocked)return;
 table=current=null;draft=copy(app.exportDesign().labLog||defaults());draft.meta={...defaults().meta,...draft.meta};
 $('labLogPanel').hidden=false;renderSheets();
 for(const key of ['title','date','author','purpose','settings','notes'])$('log_'+key).value=draft.meta[key]||'';
 const d=draft.data,p=d?.parser||{delimiter:'auto',header:true,skip:0},m=d?.mapping||{xScale:1,yScale:1,xLabel:'X',yLabel:'Y'};
 $('logDelimiter').value=p.delimiter;$('logHeader').checked=p.header;$('logSkip').value=p.skip;$('logDecimal').checked=!!p.decimalComma;
 $('logXScale').value=m.xScale;$('logYScale').value=m.yScale;$('logXLabel').value=m.xLabel;$('logYLabel').value=m.yLabel;$('logKind').value=d?.kind||'实测数据（用户声明）';
 $('logFilename').textContent=d?.filename||'尚未导入文件';$('logPreview').innerHTML='';$('logChart').innerHTML='';
 $('logExport').disabled=false;if(d){try{table=C.parse(d.raw,d.parser);current=C.map(table,d.mapping)}catch(e){$('logExport').disabled=true;note(e.message)}}else note('导入 TXT／CSV 后，请核对表头、列映射和单位。');
 $('logDataSummary').textContent=d?(d.filename+' · '+(current?.points.length||0)+' 个有效点 · '+(d.kind||'未声明')):'尚未导入数据。可以直接粘贴两三行采样点。';
 $('logAnalysisPreview').innerHTML='';if(current){const w=draft.workbench;$('logAnalysisPreview').innerHTML=window.DataWorkbenchCore?DataWorkbenchCore.plot(current.points,{...(w?.config||{}),xLabel:d.mapping.xLabel,yLabel:d.mapping.yLabel},w?.fitResult):C.chart(current.points,d.mapping.xLabel,d.mapping.yLabel)}
 if(current&&draft.workbench?.config?.showPolar&&draft.workbench.config.kind!=='polar')$('logAnalysisPreview').innerHTML+='<h3>Polar plot</h3>'+DataWorkbenchCore.plot(current.points,{...draft.workbench.config,kind:'polar'},draft.workbench.fitResult);
 window.RecordUI?.mount();
 const photo=app.exportDesign().photoReconstruction;$('logPhoto').textContent=photo?JSON.stringify(photo,null,2):'未附带照片重建记录。照片生成的 JSON 可用顶部“导入”打开；AI 不会直接控制实验设备。';
}
async function importFile(e){
 const f=e.target.files[0];if(!f)return;
 try{if(f.size>2*1024*1024)throw Error('文件超过 2 MB，请先拆分');
 const raw=new TextDecoder($('logEncoding').value,{fatal:true}).decode(await f.arrayBuffer());
 draft.data={filename:f.name,raw,kind:$('logKind').value,importedAt:new Date().toISOString(),parser:parser(),mapping:mapping(),encoding:$('logEncoding').value};
 $('logFilename').textContent=f.name;parseData(false);
 }catch(err){note(err.message+'；如为旧版中文 TXT，可选择 GB18030 后重新导入。')}e.target.value='';
}
function exportLog(){
 try{fields();if(draft.data&&!current)throw Error('请先修正解析或列映射');persist();
 const design=app.exportDesign(),diagram={...design};delete design.labLog;delete design.experimentBook;
 const html=C.report({meta:draft.meta,data:draft.data,workbench:draft.workbench,polarizationAngles:draft.polarizationAngles,design,...window.captureOpticalDiagram(diagram)});
 download('experiment-log.html',html,'text/html;charset=utf-8');note('已导出日志 HTML。打开后可用浏览器打印为 PDF；原始数据和设计 JSON 保留在折叠附录中。');
 }catch(e){note(e.message)}
}
function demo(){
 draft.data={filename:'DEMO-synthetic-angle-scan.csv',raw:'# 合成演示数据，不是实测\nangle_deg,signal_mV\n0,1\n15,0.75\n30,0.25\n45,0\n60,0.25\n75,0.75\n90,1\n',kind:'合成演示数据',importedAt:new Date().toISOString(),parser:{},mapping:{}};
 $('logKind').value=draft.data.kind;$('logDelimiter').value='auto';$('logSkip').value=0;$('logHeader').checked=true;$('logDecimal').checked=false;$('logXScale').value=1;$('logYScale').value=1;$('logFilename').textContent=draft.data.filename;parseData();
}
 let exporting=false;
 async function archive(toFolder){if(exporting||window.experimentLocked)return;exporting=true;try{persist();const snapshot=app.exportDesign();if(toFolder){if(!window.showDirectoryPicker)throw Error('此浏览器不支持选择文件夹，请使用 Chrome/Edge，或点击“全部实验 ZIP”后解压到目标文件夹。');const chosen=await window.showDirectoryPicker({id:'optical-experiment-logs',mode:'readwrite'});note('正在导出全部实验，请勿关闭页面…');const day=await ExperimentArchive.folder(snapshot,chosen);note('已导出全部实验到 '+chosen.name+'/'+day+'；原始文件按实验名称保存，重名自动加序号。')}else{note('正在打包全部实验…');await ExperimentArchive.download(snapshot);note('已下载全部实验 ZIP；解压到你选择的文件夹即可。')}}catch(e){note(e.name==='AbortError'?'已取消选择，未导出。':e.message)}finally{exporting=false}}
 $('logFolder').onclick=()=>archive(true);$('logArchive').onclick=()=>archive(false);
 $('logNotion').onclick=async()=>{if(exporting||window.experimentLocked)return;exporting=true;try{persist();note('正在合并全部实验 Sheet…');await ExperimentArchive.downloadNotion(app.exportDesign());note('已导出全部实验为一篇 experiment 笔记。Notion 页面输入 /zip → Convert Zip to pages，上传此 ZIP 即可。')}catch(e){note(e.message)}finally{exporting=false}};
 $('labLogBtn').onclick=open;$('logClose').onclick=()=>{if(!draft.data||current)persist();$('labLogPanel').hidden=true};
 $('logFile').onchange=importFile;$('logExample').onclick=demo;$('logExport').onclick=exportLog;
 $('logClear').onclick=()=>{draft.data=null;table=current=null;$('logPreview').innerHTML='';$('logChart').innerHTML='';$('logFilename').textContent='尚未导入文件';$('logExport').disabled=false;persist();note('已移除本日志的数据，光路不变。')};
 for(const id of ['logDelimiter','logHeader','logSkip','logDecimal'])$(id).onchange=()=>parseData(false);
 for(const id of ['logX','logY','logXScale','logYScale','logXLabel','logYLabel'])$(id).onchange=renderMap;
 $('logKind').onchange=()=>{if(draft.data)draft.data.kind=$('logKind').value;if(draft.workbench)draft.workbench.dataKind=$('logKind').value;persist()};
 for(const key of ['title','date','author','purpose','settings','notes'])$('log_'+key).onchange=()=>{persist();if(key==='title')renderSheets()};
 $('logSaveMap').onclick=()=>{if(!table)return note('先导入数据');download('column-mapping.json',JSON.stringify({version:1,parser:parser(),mapping:mapping()},null,2),'application/json')};
 $('logLoadMap').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>100000)throw Error('映射文件过大');const m=JSON.parse(await f.text());if(m.version!==1||!m.parser||!m.mapping)throw Error('不是列映射模板');if(!draft.data)throw Error('先导入数据文件');draft.data.mapping=m.mapping;
 $('logDelimiter').value=m.parser.delimiter;$('logHeader').checked=!!m.parser.header;$('logSkip').value=m.parser.skip;$('logDecimal').checked=!!m.parser.decimalComma;
 for(const [id,k]of [['logXScale','xScale'],['logYScale','yScale'],['logXLabel','xLabel'],['logYLabel','yLabel']])$(id).value=m.mapping[k];
 parseData(true);
 }catch(err){note(err.message)}e.target.value=''};
 $('labLogPanel').addEventListener('keydown',e=>e.stopPropagation());
 $('logWorkbenchBtn').onclick=()=>{persist();DataWorkbenchUI.open()};$('dataWorkbenchBtn').onclick=()=>{if(!$('labLogPanel').hidden)persist();DataWorkbenchUI.open()};
 window.LabLogUI={open,saveDraft:persist};
})();
