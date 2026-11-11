(()=>{'use strict';
const $=id=>document.getElementById(id),C=ExperimentCore,O=Optics3D,app=OpticalBench,clone=x=>JSON.parse(JSON.stringify(x));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let plan=app.exportDesign().experiment||{version:1,title:'新实验',snapshot:null,detectorId:'',minNm:200,maxNm:3500,steps:[]},runner=null,timer=null,running=false,remaining=0,deadline=0,selected=0;
const names={roll:'自身光轴 Roll（绝对角）/ °',yaw:'法线方位 Yaw / °',pitch:'法线仰角 Pitch / °','rotation.worldX':'绕平台 X（相对角）/ °','rotation.worldY':'绕平台 Y（相对角）/ °','rotation.worldZ':'绕平台 Z（相对角）/ °','rotation.localNormal':'绕初始自身光轴（相对角）/ °',x:'X 位移 / mm',y:'Y 位移 / mm',z:'Z 高度 / mm','params.travel':'延时台行程 / mm','params.power':'Power / mW','params.polarization':'Polarization / °','params.phaseMatchAngle':'BBO cut / °','params.opticAzimuth':'BBO axis azimuth / °','params.wavelength':'λ / nm'};
function error(e){$('expStatus').textContent=e.message||String(e)}
function persist(){app.setExperiment(clone(plan))}
function lock(on){document.querySelector('.app-shell').inert=on;document.querySelector('.topbar').inert=on;window.experimentLocked=on;$('expEditor').disabled=on;$('expCapture').disabled=on;$('expExample').disabled=on}
function controls(){
 $('expClose').disabled=!!runner;$('expPlay').disabled=running||!!runner?.done;$('expPause').disabled=!running;$('expStep').disabled=running||!!runner?.done;
 $('expProgress').textContent=runner?runner.index+' / '+runner.events.length+' 动作 · '+runner.rows.length+' 测量点':'尚未运行';
 $('expCsv').disabled=!runner?.rows.length;
}
function stopTimer(){if(timer!==null)clearTimeout(timer);timer=null}
function pause(){if(running){remaining=Math.max(0,deadline-Date.now());stopTimer();running=false;error('已暂停；继续或单步，重置后可编辑')}controls()}
function discard(){stopTimer();running=false;runner=null;remaining=0;lock(false);controls();draw()}
function reset(){stopTimer();running=false;remaining=0;if(plan.snapshot)app.applyExperimentState(plan.snapshot);runner=null;lock(false);controls();draw();error('已恢复初始快照，可编辑后重新运行')}
function capture(){discard();plan.snapshot=C.cleanSnapshot(app.exportDesign());if(!plan.snapshot.components.some(c=>c.id===plan.detectorId&&c.type==='detector'))plan.detectorId=plan.snapshot.components.find(c=>c.type==='detector')?.id||'';persist();render();error('已捕获当前光路为初始状态')}
function prepare(){if(runner)return;persist();runner=new C.Runner(plan,s=>O.trace(s,OPTICAL_COMPONENTS));app.applyExperimentState(runner.state);lock(true)}
function advance(){
 try{prepare();const result=runner.next();if(!result)return;app.applyExperimentState(result.state);selected=result.event.step;
  error((result.done?'完成 · ':'运行 · ')+result.event.title+(result.row?' · '+result.row.powerMw.toPrecision(4)+' mW':' · 等待步骤')+(result.row?.overload?' · PD 超量程':'')+(result.trace.warnings.length?' · '+result.trace.warnings.join('；'):''));
  $('expSteps').querySelectorAll('[data-step]').forEach(el=>el.classList.toggle('current',Number(el.dataset.step)===selected));draw();controls();return result;
 }catch(e){stopTimer();running=false;lock(false);controls();error(e)}
}
function tick(){timer=null;if(!running)return;const result=advance();if(!result){running=false;controls();return}if(result.done){running=false;controls();return}schedule(runner.events[runner.index].waitMs/(Number($('expSpeed').value)||1))}
function schedule(ms){remaining=ms;deadline=Date.now()+ms;timer=setTimeout(tick,ms)}
function play(){try{prepare();running=true;controls();if(remaining>0)schedule(remaining);else schedule(runner.events[runner.index].waitMs/(Number($('expSpeed').value)||1))}catch(e){running=false;error(e);controls()}}
function saveFile(name,text,type='application/json'){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([text],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function components(){return plan.snapshot?.components||[]}
function options(items,value){return items.map(([k,v])=>'<option value="'+esc(k)+'" '+(String(k)===String(value)?'selected':'')+'>'+esc(v)+'</option>').join('')}
function select(label,key,value,items){return '<label>'+label+'<select data-field="'+key+'">'+options(items,value)+'</select></label>'}
function input(label,key,value,type='number'){return '<label>'+label+'<input data-field="'+key+'" type="'+type+'" '+(type==='number'?'step="any"':'')+' value="'+esc(value)+'"></label>'}
function targetControls(step,prefix=''){
 const tk=prefix?'secondTarget':'target',pk=prefix?'secondKey':'key',c=components().find(c=>c.id===step[tk]);
 return select(prefix?'联动器件':'主器件',tk,step[tk],components().map(c=>[c.id,c.name]))+select('参数',pk,step[pk],c?C.fields(c).map(k=>[k,names[k]||k]):[]);
}
function render(){
 $('expTitle').value=plan.title||'';$('expMin').value=plan.minNm;$('expMax').value=plan.maxNm;
 $('expDetector').innerHTML=options([['','仅动作，不采集'],...components().filter(c=>c.type==='detector').map(c=>[c.id,c.name])],plan.detectorId);
 $('expSnapshot').textContent=plan.snapshot?components().length+' 个器件 · 修改光路后需重新捕获':'先捕获当前光路，或载入联动示例';
 $('expSteps').innerHTML=plan.steps.map((s,i)=>'<div class="exp-step '+(i===selected?'current':'')+'" data-step="'+i+'"><div class="exp-step-head"><b>'+String(i+1).padStart(2,'0')+'</b><span>'+esc({set:'设定参数',scan:s.linked?'联动扫描':'扫描',wait:'等待',measure:'测量'}[s.type])+'</span><button data-op="up" title="上移">↑</button><button data-op="down" title="下移">↓</button><button data-op="delete" title="删除">×</button></div><div class="exp-fields">'+input('步骤说明','note',s.note||'','text')+
 (['set','scan'].includes(s.type)?targetControls(s):'')+
 (s.type==='set'?input('设定值','value',s.value):'')+
 (s.type==='scan'?input('起点','start',s.start)+input('终点','end',s.end)+input('步长（正数）','increment',s.increment)+select('第二轴联动','linked',s.linked?'yes':'no',[['no','关闭'],['yes','开启']])+(s.linked?targetControls(s,'second')+input('联动起始值','offset',s.offset)+input('比例','ratio',s.ratio)+'<small class="exp-formula">第二轴 = 联动起始值 + 比例 ×（主轴值 − 主轴起点）</small>':''):'')+
 input(s.type==='wait'?'等待 / ms':'步间等待 / ms','dwellMs',s.dwellMs)+'</div></details></div>').join('')||'<p class="exp-empty">添加参数动作或扫描。扫描每一点都会读取选中的 PD。</p>';
 $('expSteps').querySelectorAll('[data-field]').forEach(el=>el.onchange=()=>{const card=el.closest('[data-step]'),s=plan.steps[Number(card.dataset.step)],k=el.dataset.field;s[k]=k==='linked'?el.value==='yes':el.type==='number'?Number(el.value):el.value;
  if(k==='target'||k==='secondTarget'){const pk=k==='target'?'key':'secondKey',c=components().find(c=>c.id===s[k]);s[pk]=c&&C.fields(c).includes(s[pk])?s[pk]:'roll'}persist();render()});
 $('expSteps').querySelectorAll('[data-op]').forEach(el=>el.onclick=()=>{const i=Number(el.closest('[data-step]').dataset.step),op=el.dataset.op;if(op==='delete')plan.steps.splice(i,1);else{const j=i+(op==='up'?-1:1);if(j>=0&&j<plan.steps.length)[plan.steps[i],plan.steps[j]]=[plan.steps[j],plan.steps[i]]}persist();render()});
 controls();
}
function add(type){if(!plan.snapshot){error('请先捕获初始状态');return}if(plan.steps.length>=200){error('最多 200 个步骤');return}
 const c=components().find(c=>c.type==='hwp')||components()[0],second=components().find(c=>c.type==='polarizer')||c;
 plan.steps.push({type,note:{set:'调整参数',scan:'角度扫描',measure:'读取 PD',wait:'等待'}[type],target:c?.id,key:'roll',value:0,start:0,end:90,increment:1,linked:false,secondTarget:second?.id,secondKey:'roll',offset:0,ratio:2,dwellMs:100});persist();render();
}
function draw(){
 const rows=runner?.rows||[],w=600,h=190,metric=$('expMetric').value||'powerMw',unit={powerMw:'mW',voltageV:'V',currentMa:'mA'}[metric],max=Math.max(...rows.map(r=>r[metric]),0),scale=max||1;
 const points=rows.map((r,i)=>(50+i/Math.max(1,rows.length-1)*530)+','+(150-r[metric]/scale*120)).join(' ');
 $('expPlot').innerHTML='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="模拟测量曲线"><path d="M50 22V150H580" fill="none" stroke="#a0b2c4"/><text x="5" y="20">'+(max?max.toPrecision(3):'0')+' '+unit+'</text><text x="48" y="170">1</text><text x="540" y="170">'+rows.length+'</text><text x="260" y="185">测量点序号</text><polyline points="'+points+'" fill="none" stroke="#087f83" stroke-width="2"/>'+rows.map((r,i)=>'<circle cx="'+(50+i/Math.max(1,rows.length-1)*530)+'" cy="'+(150-r[metric]/scale*120)+'" r="2" fill="#087f83"/>').join('')+'</svg>';
 const last=rows.at(-1);$('expReadout').textContent=last?'PD '+last.powerMw.toPrecision(5)+' mW · '+last.voltageV.toPrecision(4)+' V · '+last.rayCount+' 光束 · 到达时间 '+(last.arrivalMinPs===null?'无命中':last.arrivalMinPs.toFixed(3)+'–'+last.arrivalMaxPs.toFixed(3)+' ps'):'等待测量数据';
}
function example(){
 discard();const base=C.cleanSnapshot(app.exportDesign()),defs=OPTICAL_COMPONENTS;
 const c=(id,type,x,params={},roll=0)=>({id,type,name:id,x,y:200,z:100,yaw:0,pitch:0,roll,params:{...defs[type].defaults,...params}});
 base.components=[c('LD1','laser',100,{power:.01,polarization:90}),c('HWP1','hwp',175),c('BBO1','bbo',250,{phaseMatchAngle:O.bboCut(800)}),c('SP1','spectralFilter',325,{filterType:'shortpass',cutoffWavelength:775}),c('POL1','polarizer',400),c('PD1','detector',500)];
 base.showRays=true;app.importDesign({...base,labLog:app.exportDesign().labLog,experimentBook:app.exportDesign().experimentBook});
 plan={version:1,title:'BBO · HWP 1° / Analyzer 2°',snapshot:base,detectorId:'PD1',minNm:390,maxNm:410,steps:[{type:'scan',note:'HWP 0→90°，Analyzer 0→180°；读取 400 nm 信号',target:'HWP1',key:'roll',start:0,end:90,increment:1,linked:true,secondTarget:'POL1',secondKey:'roll',offset:0,ratio:2,dwellMs:100}]};
 persist();render();draw();error('示例已载入。0.01 mW 输入用于低转换模型演示，不代表实验室设定；可撤销光路更换。');
}
function open(){if(!runner)plan=app.exportDesign().experiment||plan;$('experimentPanel').hidden=false;render();draw()}
 $('experimentBtn').onclick=open;$('expClose').onclick=()=>{pause();$('experimentPanel').hidden=true;if(runner)error('暂停中；打开实验流程继续或重置')};
 $('expCapture').onclick=capture;$('expExample').onclick=example;$('expPlay').onclick=play;$('expPause').onclick=pause;
 $('expStep').onclick=()=>{remaining=0;advance()};$('expReset').onclick=reset;
 $('expAdd').onclick=()=>add($('expAction').value);
 $('expCsv').onclick=()=>saveFile('experiment-results.csv','\uFEFF'+C.csv(runner?.rows||[]),'text/csv;charset=utf-8');
 $('expExport').onclick=()=>{persist();saveFile('experiment-recipe.json',JSON.stringify(plan,null,2))};

 for(const [id,key]of [['expTitle','title'],['expDetector','detectorId'],['expMin','minNm'],['expMax','maxNm']])$(id).onchange=e=>{plan[key]=e.target.type==='number'?Number(e.target.value):e.target.value;persist()};
 $('expMetric').onchange=draw;
 $('experimentPanel').addEventListener('keydown',e=>e.stopPropagation());
 window.BenchExperiment={open,capture,setPlan(p){discard();plan=clone(p);persist();render()},onDesignLoaded(data){discard();plan=data||{version:1,title:'新实验',snapshot:null,detectorId:'',minNm:200,maxNm:3500,steps:[]};render()},getPlan:()=>clone(plan)};
 render();draw();
})();
