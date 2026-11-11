/* Offline data parsing, mapping and self-contained report generation. */
(function(root){'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function numeric(s,comma=false){s=String(s??'').trim();if(comma)s=s.replace(',','.');if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))return null;const n=Number(s);return Number.isFinite(n)?n:null}
function split(text,sep){
 const rows=[];let row=[],field='',quoted=false,line=1,start=1;
 for(let i=0;i<text.length;i++){const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else if(quoted||field==='')quoted=!quoted;else field+=ch}
  else if(!quoted&&ch===sep){row.push(field);field=''}
  else if(!quoted&&(ch==='\n'||ch==='\r')){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push({line:start,cells:row});row=[];field='';line++;start=line}
  else{field+=ch;if(ch==='\n')line++}
 }
 if(quoted)throw Error('CSV 引号未闭合，请检查文件或分隔符');
 row.push(field);if(row.some(x=>x.trim()))rows.push({line:start,cells:row});return rows;
}
function parse(text,{delimiter='auto',skip=0,header=true,decimalComma=false}={}){
 text=String(text).replace(/^\uFEFF/,'');if(text.length>10*1024*1024)throw Error('文件超过 10 MB，请先拆分');
 if(!Number.isInteger(skip)||skip<0)throw Error('跳过行数必须是非负整数');
 const lines=text.split(/\r\n|\n|\r/).slice(skip);text=lines.join('\n');
 if(delimiter==='auto'){
  const first=lines.find(l=>l.trim()&&!l.trim().startsWith('#'))||'';
  delimiter=first.includes('\t')?'tab':first.includes(';')?'semicolon':first.includes(',')?'comma':'space';
 }
 let rows=delimiter==='space'?lines.map((l,i)=>({line:i+1,cells:l.trim().split(/\s+/)})).filter(r=>r.cells[0]):split(text,{comma:',',tab:'\t',semicolon:';'}[delimiter]||',');
 rows=rows.filter(r=>!r.cells[0].trim().startsWith('#')).map(r=>({...r,line:r.line+skip}));
 if(!rows.length)throw Error('未找到数据');
 const width=rows.reduce((m,r)=>Math.max(m,r.cells.length),0);if(Math.max(1,rows.length-(header?1:0))*width>200000)throw Error('最多支持 200000 个单元格，请拆分数据');
 const headings=header?rows.shift().cells:Array.from({length:width},(_,i)=>'列 '+(i+1));
 return{headers:Array.from({length:width},(_,i)=>headings[i]||'列 '+(i+1)),rows,delimiter,decimalComma};
}
function map(table,m){
 if(!Number.isInteger(+m.x)||!Number.isInteger(+m.y)||+m.x<0||+m.y<0||+m.x>=table.headers.length||+m.y>=table.headers.length)throw Error('请选择有效 X、Y 列');
 const a=Number(m.xScale??1),b=Number(m.yScale??1);if(!Number.isFinite(a)||!Number.isFinite(b)||a===0||b===0)throw Error('比例必须是非零有限数值');
 const points=[],rejected=[];
 for(const r of table.rows){const x=numeric(r.cells[m.x],table.decimalComma),y=numeric(r.cells[m.y],table.decimalComma);
  if(x===null||y===null||!Number.isFinite(x*a)||!Number.isFinite(y*b))rejected.push({line:r.line,reason:'所选列为空、非数值或超范围'});
  else points.push({x:x*a,y:y*b,line:r.line});
 }
 if(!points.length)throw Error('所选列没有可绘制的数值，请检查表头、分隔符和列映射');
 return{points,rejected,total:table.rows.length};
}
function chart(points,xLabel='X',yLabel='Y'){
 if(!points?.length)return '<p>未导入数据。</p>';
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const dx=maxX-minX||1,dy=maxY-minY||1,px=x=>60+(x-minX)/dx*640,py=y=>250-(y-minY)/dy*200;
 // Display decimation only; mapped data and report appendix retain all rows.
 const stride=Math.max(1,Math.ceil(points.length/1500)),sample=points.filter((_,i)=>i%stride===0||i===points.length-1);
 return '<svg viewBox="0 0 760 310" role="img" aria-label="导入数据曲线"><path d="M60 30V250H710" fill="none" stroke="#9aafbd"/><g fill="#476173" font-size="12">'+
 '<text x="60" y="270">'+minX.toPrecision(4)+'</text><text x="660" y="270">'+maxX.toPrecision(4)+'</text><text x="5" y="45">'+maxY.toPrecision(4)+'</text><text x="5" y="250">'+minY.toPrecision(4)+'</text><text x="330" y="300">'+esc(xLabel)+'</text><text x="60" y="18">'+esc(yLabel)+'</text></g><polyline fill="none" stroke="#087f83" stroke-width="1.5" points="'+sample.map(p=>px(p.x)+','+py(p.y)).join(' ')+'"/>'+sample.map(p=>'<circle cx="'+px(p.x)+'" cy="'+py(p.y)+'" r="2" fill="#087f83"/>').join('')+'</svg>';
}
function table(head,rows){return '<table><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>'}

function describeStep(s,design){
 const cs=design.experiment?.snapshot?.components||design.components||[],name=id=>cs.find(c=>c.id===id)?.name||id||'未选器件';
 const keys={roll:'自身光轴 Roll / °',yaw:'Yaw / °',pitch:'Pitch / °',x:'X / mm',y:'Y / mm',z:'Z / mm','rotation.worldX':'绕平台 X / °','rotation.worldY':'绕平台 Y / °','rotation.worldZ':'绕平台 Z / °','rotation.localNormal':'绕初始光轴 / °','params.travel':'延时台行程 / mm'};
 const k=key=>keys[key]||root.OpticalBench?.paramLabels?.[String(key).replace('params.','')]||key;
 let text=s.type==='scan'?name(s.target)+'：'+k(s.key)+'，起点 '+s.start+'，步长 '+s.increment+'，终点 '+s.end:s.type==='set'?name(s.target)+'：'+k(s.key)+' = '+s.value:s.type==='wait'?'等待':'采集模拟探测器读数';
 if(s.type==='scan'&&s.linked)text+='；联动 '+name(s.secondTarget)+' '+k(s.secondKey)+' = '+s.offset+' + '+s.ratio+' ×（主轴值 − '+s.start+'）';
 return (s.note?s.note+'；':'')+text+'；等待 '+(s.dwellMs||0)+' ms';
}
function report({meta,data,workbench,design,image,traceWarnings=[]}){
 const mapped=data?map(parse(data.raw,data.parser),data.mapping):null,pts=mapped?.points||[],labels=data?[data.mapping.xLabel||'X',data.mapping.yLabel||'Y']:['X','Y'];
 const steps=design.experiment?.steps||[];
 const pending=design.photoReconstruction;
 const graph=pts.length&&root.DataWorkbenchCore?root.DataWorkbenchCore.plot(pts,{...(workbench?.config||{}),xLabel:labels[0],yLabel:labels[1]},workbench?.fitResult):chart(pts,...labels);
 const peak=pts.length?pts.reduce((a,b)=>b.y>a.y?b:a):null;
 const pre=x=>'<pre>'+esc(typeof x==='string'?x:JSON.stringify(x,null,2))+'</pre>';
 const safeImage=typeof image==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)?'<img alt="当前模拟光路示意图" src="'+image+'">':'<p>未提供画布截图。</p>';
 return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+esc(meta.title||'实验日志')+'</title><style>body{max-width:960px;margin:40px auto;padding:0 25px;font:15px/1.7 system-ui;color:#243e4e}h1{font-size:30px}h2{margin-top:32px;border-bottom:1px solid #cfdee5}small,.muted{color:#647e8b}table{border-collapse:collapse;width:100%;font-size:12px;margin:14px 0}th,td{border:1px solid #d3e0e6;padding:7px;text-align:left;overflow-wrap:anywhere}th{background:#eff6f8}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;background:#f5f8fa;padding:12px}img,svg{width:100%;height:auto}p{white-space:pre-wrap}.note{background:#fff6df;border-left:4px solid #b58a36;padding:12px}@media print{body{margin:0;max-width:none}h2{break-after:avoid}tr,img,svg{break-inside:avoid}details{display:none}}</style>'+
 '<h1>'+esc(meta.title||'实验日志')+'</h1><p class="muted">实验日期：'+esc(meta.date||'未填写')+' · 记录人：'+esc(meta.author||'未填写')+'<br>导出时间：'+esc(new Date().toISOString())+' · Optical Bench V14</p>'+
 '<div class="note">本日志组合用户提供的测量数据、模拟光路和预设流程。模拟布局不证明真实装置配置；预设步骤不代表已经实际执行。未自动推断样品性质、拟合结果或实验结论。</div>'+
 '<h2>1. 实验目的与设置</h2><p>'+esc(meta.purpose||'未填写')+'</p><p>仪器与采集设置：'+esc(meta.settings||'未填写')+'</p>'+
 '<h2>2. 当前模拟光路</h2>'+safeImage+'<p class="muted">导出时的画布视角与显隐设置；图像为模拟示意，不是实验照片或实测几何。</p>'+
 (pending?'<h3>照片重建来源及待确认项</h3><p>以下信息来自 AI 光路初稿，尚未作为真实参数验证。</p>'+pre(pending):'')+
 '<h2>3. 预设动作</h2>'+
 (steps.length?table(['序号','动作说明'],steps.map((s,i)=>[i+1,describeStep(s,design)])):'<p>尚未在模拟器中录制动作。</p>')+
 '<p class="muted">以下是模拟器中录制或编辑的动作，不是 LabVIEW 或真实硬件执行记录。流程初始快照可能与当前光路不同，保存在设计 JSON 中。</p>'+
 '<h2>4. 导入数据与曲线</h2>'+
 (data?'<p>来源文件：'+esc(data.filename)+'\n数据性质：'+esc(data.kind||'未声明')+'\n导入时间：'+esc(data.importedAt)+'\nX：'+esc(labels[0])+'（源列 '+(+data.mapping.x+1)+'，乘数 '+esc(data.mapping.xScale)+'）\nY：'+esc(labels[1])+'（源列 '+(+data.mapping.y+1)+'，乘数 '+esc(data.mapping.yScale)+'）\n有效 '+pts.length+' / '+mapped.total+' 行；排除 '+mapped.rejected.length+' 行。</p>'+graph+(pts.length&&workbench?.config?.showPolar&&workbench.config.kind!=='polar'&&root.DataWorkbenchCore?'<h3>Polar plot</h3>'+root.DataWorkbenchCore.plot(pts,{...workbench.config,kind:'polar'},workbench.fitResult):'')+
 '<p>数据摘要：采样最大 Y='+peak.y.toPrecision(6)+'，对应 X='+peak.x.toPrecision(6)+'。这是离散采样极值，不是拟合峰位；并列时显示首个。</p>'+
 (mapped.rejected.length?'<details><summary>排除行与原因</summary>'+table(['原始行号','原因'],mapped.rejected.map(r=>[r.line,r.reason]))+'</details>':'')+
 '<details><summary>完整映射数据（'+pts.length+' 点）</summary>'+table(['原始行号',...labels],pts.map(p=>[p.line,p.x,p.y]))+'</details><details><summary>原始导入文本</summary>'+pre(data.raw)+'</details>':'<p>未导入测量数据。</p>')+
 (workbench?.fitResult?'<h3>拟合结果</h3>'+pre(workbench.fitResult):'')+'</html>';
}
root.LabLogCore={parse,map,numeric,chart,report,describeStep,esc};if(typeof module!=='undefined')module.exports=root.LabLogCore;
})(typeof window!=='undefined'?window:globalThis);
