/* Deterministic experiment steps. No timers, network, or hardware access. */
(function(root){'use strict';
const copy=x=>JSON.parse(JSON.stringify(x)),MAX_POINTS=5000;
const fail=m=>{throw Error(m)},finite=(x,name)=>{if(x===''||x===null||!Number.isFinite(Number(x)))fail(name+' 必须是有限数值');return Number(x)};
function cleanSnapshot(s){const c=copy(s);delete c.experiment;delete c.labLog;delete c.experimentBook;return c}
function fields(c){return ['x','y','z','yaw','pitch','roll','rotation.worldX','rotation.worldY','rotation.worldZ','rotation.localNormal',...Object.keys(c.params).filter(k=>typeof c.params[k]==='number'&&!['axisAngle','extraPath','passes'].includes(k)).map(k=>'params.'+k)]}
function target(snapshot,id,key){const c=snapshot.components.find(c=>c.id===id);if(!c)fail('步骤引用的器件不存在');if(!fields(c).includes(key))fail('器件不支持参数 '+key);return c}
function validateValue(key,v){
 if(['params.refractiveIndex','params.groupIndex'].includes(key)&&v<1)fail('本模型折射率须 ≥ 1');
 if(['z','params.power','params.travel','params.targetDelay','params.thickness'].includes(key)&&v<0)fail(key+' 不能小于 0');
 if(['params.aperture','params.wavelength','params.waistRadius','params.pulseWidth','params.repetitionRate'].includes(key)&&v<=0)fail(key+' 必须大于 0');
 if(key==='pitch'&&Math.abs(v)>90)fail('Pitch 必须在 ±90° 内');
 if(key==='params.ellipticity'&&Math.abs(v)>45)fail('椭圆率必须在 ±45° 内');
}
function rotatePose(base,key,angle){
 const R=Math.PI/180,y=base.yaw*R,p=base.pitch*R,r=base.roll*R;
 const n=[Math.cos(y)*Math.cos(p),Math.sin(y)*Math.cos(p),Math.sin(p)],u0=[-Math.sin(y),Math.cos(y),0],v0=[-Math.cos(y)*Math.sin(p),-Math.sin(y)*Math.sin(p),Math.cos(p)],u=u0.map((x,i)=>x*Math.cos(r)+v0[i]*Math.sin(r));
 const axis={worldX:[1,0,0],worldY:[0,1,0],worldZ:[0,0,1],localNormal:n}[key.split('.')[1]];if(!axis)fail('未知旋转轴');
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const co=Math.cos(angle*R),si=Math.sin(angle*R),turn=a=>{const b=cross(axis,a),d=dot(axis,a);return a.map((x,i)=>x*co+b[i]*si+axis[i]*d*(1-co))},nn=turn(n),uu=turn(u);
 const yy=Math.atan2(nn[1],nn[0]),pp=Math.asin(Math.max(-1,Math.min(1,nn[2]))),un=[-Math.sin(yy),Math.cos(yy),0],vn=[-Math.cos(yy)*Math.sin(pp),-Math.sin(yy)*Math.sin(pp),Math.cos(pp)];
 return{yaw:yy/R,pitch:pp/R,roll:Math.atan2(dot(uu,vn),dot(uu,un))/R};
}
function assign(s,id,key,v,reference){const c=target(s,id,key);validateValue(key,v);if(key.startsWith('rotation.'))Object.assign(c,rotatePose(reference||c,key,v));else if(key.startsWith('params.')){const k=key.slice(7);c.params[k]=v;if(c.type==='delay'&&k==='travel')c.params.targetDelay=2*v/.299792458;if(c.type==='delay'&&k==='targetDelay'){if(v<0)fail('延时不能小于 0');c.params.travel=v*.299792458/2}}else c[key]=v}
function compile(plan){
 if(!plan?.snapshot?.components?.length||!plan.snapshot.boards?.length)fail('请先捕获初始光路');
 if(!Array.isArray(plan.steps)||!plan.steps.length)fail('请添加实验步骤');
 if(plan.steps.length>200)fail('最多 200 个步骤');
 const pd=plan.snapshot.components.find(c=>c.id===plan.detectorId&&c.type==='detector');if(plan.detectorId&&!pd)fail('请选择初始快照中的 PD');
 const low=finite(plan.minNm??200,'波长下限'),high=finite(plan.maxNm??3500,'波长上限');if(low<=0||high<low)fail('波长窗口无效');
 const events=[];
 const add=e=>{events.push({...e,sample:e.sample&&!!pd});if(events.length>MAX_POINTS)fail('总动作数超过 5000，请增大扫描步长')};
 plan.steps.forEach((step,i)=>{
  const title=String(step.note||('步骤 '+(i+1))).slice(0,300),dwell=finite(step.dwellMs??100,'步间等待');
  if(dwell<0||dwell>60000)fail('等待时间应在 0–60000 ms 内');
  if(step.type==='wait'){add({step:i,title,changes:[],sample:false,waitMs:dwell});return}
  if(step.type==='measure'){add({step:i,title,changes:[],sample:true,waitMs:dwell,value:null,point:0});return}
  if(!['set','scan'].includes(step.type))fail('未知步骤类型');
  target(plan.snapshot,step.target,step.key);
  let values;
  if(step.type==='set')values=[finite(step.value,'设定值')];
  else{
   const start=finite(step.start,'起点'),end=finite(step.end,'终点'),inc=finite(step.increment,'步长');if(inc<=0)fail('扫描步长必须为正');
   const n=Math.floor(Math.abs(end-start)/inc+1e-9);if(n>=MAX_POINTS)fail('扫描点数超过 5000');
   values=Array.from({length:n+1},(_,j)=>start+Math.sign(end-start)*inc*j);
  }
  values.forEach((v,j)=>{
   validateValue(step.key,v);const changes=[{id:step.target,key:step.key,value:v}];
   if(step.type==='scan'&&step.linked){
    target(plan.snapshot,step.secondTarget,step.secondKey);
    if(step.target===step.secondTarget&&step.key===step.secondKey)fail('联动参数不能与主参数相同');
    if(step.target===step.secondTarget&&[step.key,step.secondKey].every(k=>k.startsWith('rotation.')||['yaw','pitch','roll'].includes(k)))fail('同一个器件不能同时联动两个旋转轴，请拆成步骤');
    const value=finite(step.offset,'联动起始值')+finite(step.ratio,'联动比例')*(v-finite(step.start,'起点'));
    validateValue(step.secondKey,value);changes.push({id:step.secondTarget,key:step.secondKey,value});
   }
   add({step:i,title,point:j,changes,sample:true,waitMs:dwell,value:v});
  });
 });
 return events;
}
function measure(state,trace,plan,event,index,timeMs){
 const pd=state.components.find(c=>c.id===plan.detectorId),p=pd.params;
 const all=trace.segments.filter(r=>r.toId===pd.id&&!r.internal&&r.beam.wavelength>=p.minWavelength&&r.beam.wavelength<=p.maxWavelength);
 const rays=all.filter(r=>r.beam.wavelength>=plan.minNm&&r.beam.wavelength<=plan.maxNm),totalPdPowerMw=all.reduce((s,r)=>s+r.beamEnd.power,0);
 const power=rays.reduce((s,r)=>s+r.beamEnd.power,0),times=rays.map(r=>r.timePs);
 return{sample:index,step:event.step+1,point:(event.point??0)+1,note:event.title,scanValue:event.value,secondValue:event.changes[1]?.value??null,elapsedMs:timeMs,powerMw:power,currentMa:power*p.responsivity,voltageV:power*1e-3*p.responsivity*p.transimpedanceGain,
 arrivalMinPs:times.length?Math.min(...times):null,arrivalMaxPs:times.length?Math.max(...times):null,rayCount:rays.length,totalPdPowerMw,overload:totalPdPowerMw>p.saturationPower,
 polarization:rays.map(r=>({nm:r.beam.wavelength,powerMw:r.beamEnd.power,angle:r.beamEnd.polarization,ellipticity:r.beamEnd.ellipticity})),warnings:trace.warnings||[]};
}
class Runner{
 constructor(plan,trace){this.plan=copy(plan);this.events=compile(this.plan);this.trace=trace;this.reset()}
 reset(){this.state=cleanSnapshot(this.plan.snapshot);this.state.showRays=true;this.index=0;this.rows=[];this.elapsedMs=0;this.lastStep=null;this.rotationReference=[]}
 get done(){return this.index>=this.events.length}
 next(){if(this.done)return null;const event=this.events[this.index];if(this.lastStep!==event.step){this.rotationReference=copy(this.state.components);this.lastStep=event.step}for(const c of event.changes)assign(this.state,c.id,c.key,c.value,this.rotationReference.find(x=>x.id===c.id));
  this.elapsedMs+=event.waitMs;const trace=this.trace(this.state),row=event.sample?measure(this.state,trace,this.plan,event,this.rows.length+1,this.elapsedMs):null;
  if(row)this.rows.push(row);this.index++;return{event,row,trace,state:copy(this.state),done:this.done,index:this.index};
 }
}
function csv(rows){
 const keys=['sample','step','point','note','scanValue','secondValue','elapsedMs','powerMw','currentMa','voltageV','arrivalMinPs','arrivalMaxPs','rayCount','totalPdPowerMw','overload','polarization','warnings'];
 const cell=x=>{let s=x==null?'':typeof x==='object'?JSON.stringify(x):String(x);if(typeof x==='string'&&/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
 return keys.join(',')+'\r\n'+rows.map(r=>keys.map(k=>cell(r[k])).join(',')).join('\r\n');
}
root.ExperimentCore={compile,Runner,fields,assign,rotatePose,cleanSnapshot,csv,MAX_POINTS};
if(typeof module!=='undefined')module.exports=root.ExperimentCore;
})(typeof window!=='undefined'?window:globalThis);
