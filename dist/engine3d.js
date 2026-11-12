/* Optical Bench V8. Units: mm, nm, mW, fs. Pure geometry/optics, no DOM. */
(function(root){'use strict';
const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,s)=>a.map(v=>v*s),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len:a=>Math.hypot(...a)};
V.unit=a=>V.len(a)>1e-12?V.mul(a,1/V.len(a)):[1,0,0];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),rad=x=>x*Math.PI/180,deg=x=>x*180/Math.PI;
const num=(x,d=0)=>Number.isFinite(+x)?+x:d,percent=(x,d=100)=>clamp(num(x,d)/100,0,1);
function frame(yaw=0,pitch=0,roll=0){const y=rad(yaw),p=rad(pitch),r=rad(roll),n=[Math.cos(y)*Math.cos(p),Math.sin(y)*Math.cos(p),Math.sin(p)],u0=[-Math.sin(y),Math.cos(y),0],v0=V.cross(n,u0);return{n,u:V.add(V.mul(u0,Math.cos(r)),V.mul(v0,Math.sin(r))),v:V.add(V.mul(u0,-Math.sin(r)),V.mul(v0,Math.cos(r)))}}
function basis(d){const u=V.unit(V.cross(Math.abs(d[2])>.999?[0,1,0]:[0,0,1],d));return{u,v:V.cross(d,u)}}
function pose(c){return frame(c.yaw,c.pitch,c.roll)}
function position(c){return[c.x,c.y,c.z]}
/* Extrema-angle records calibrate the HWP dial to the PBS split. A record states
   the dial angle for zero reflection (hwpMinAngle) and full reflection (hwpMaxAngle);
   between them the reflected fraction follows sin^2, matching an ideal HWP when the
   two recorded angles are 45° apart and stretching that phase otherwise. */
function extremaFraction(roll,record){if(!record||!Number.isFinite(record.hwpMaxAngle)||!Number.isFinite(record.hwpMinAngle))return null;const span=record.hwpMaxAngle-record.hwpMinAngle;if(!(Math.abs(span)>1e-9))return null;const t=(num(roll)-record.hwpMinAngle)/span;return Math.sin(Math.PI*t/2)**2}
function angularDistance(a,b){const d=Math.abs((num(a)-num(b))%180);return Math.min(d,180-d)}
function angleRecords(state){const list=state?.labLog?.polarizationAngles;return Array.isArray(list)?list.filter(r=>r&&r.ids&&Number.isFinite(r.hwpMaxAngle)&&Number.isFinite(r.hwpMinAngle)&&Math.abs(r.hwpMaxAngle-r.hwpMinAngle)>1e-9):[]}
function viaComponent(state,id){return state.components.find(c=>c.id===id)}
function lastViaType(state,via,type){for(let i=via.length-1;i>=0;i--){const c=viaComponent(state,via[i]);if(c&&c.type===type)return c}return null}
function findHwpRecord(state,hwp,via=[]){const list=angleRecords(state).filter(r=>r.ids.hwp===hwp.id&&state.components.some(c=>c.id===r.ids.pbs));if(!list.length)return null;const pol=lastViaType(state,via,'polarizer');if(pol){const same=list.filter(r=>r.ids.polarizer===pol.id),pool=same.length?same:list,angle=num(pol.roll);pool.sort((a,b)=>angularDistance(a.polarizerAngle,angle)-angularDistance(b.polarizerAngle,angle));return{record:pool[0],polarizer:pol}}return{record:list[0],polarizer:null}}
function findPbsRecord(state,pbs,via=[]){for(let i=via.length-1;i>=0;i--){const h=viaComponent(state,via[i]);if(h&&h.type==='hwp'){for(let j=i+1;j<via.length;j++){const between=viaComponent(state,via[j]);if(between&&['hwp','qwp','polarizer','wollaston','mirror','beamsplitter','dichroic'].includes(between.type))return null}const cal=findHwpRecord(state,h,via.slice(0,i));if(cal&&cal.record.ids.pbs===pbs.id)return{...cal,hwp:h};break}}return null}
function reflect(d,n){return V.sub(d,V.mul(n,2*V.dot(d,n)))}
function rotateBetween(v,a,b){const k=V.cross(a,b),s=V.len(k),co=clamp(V.dot(a,b),-1,1);if(s<1e-10){if(co>0)return v.slice();const axis=basis(a).u;return V.sub(V.mul(axis,2*V.dot(v,axis)),v)}const axis=V.mul(k,1/s);return V.add(V.add(V.mul(v,co),V.mul(V.cross(axis,v),s)),V.mul(axis,V.dot(axis,v)*(1-co)))}
function transport(field,a,b){return{re:rotateBetween(field.re,a,b),im:rotateBetween(field.im,a,b)}}
function intensity(f){return V.dot(f.re,f.re)+V.dot(f.im,f.im)}
function normalizeField(f){const s=Math.sqrt(intensity(f));return s>1e-14?{re:V.mul(f.re,1/s),im:V.mul(f.im,1/s)}:{re:[0,0,0],im:[0,0,0]}}
function sourceField(d,angle=0,ellipticity=0){const {u,v}=basis(d),a=rad(angle),e=rad(ellipticity),major=V.add(V.mul(u,Math.cos(a)),V.mul(v,Math.sin(a))),minor=V.add(V.mul(u,-Math.sin(a)),V.mul(v,Math.cos(a)));return{re:V.mul(major,Math.cos(e)),im:V.mul(minor,Math.sin(e))}}
function polState(f,d){const {u,v}=basis(d),x=[V.dot(f.re,u),V.dot(f.im,u)],y=[V.dot(f.re,v),V.dot(f.im,v)],s0=intensity(f)||1,s1=x[0]**2+x[1]**2-y[0]**2-y[1]**2,s2=2*(x[0]*y[0]+x[1]*y[1]),s3=2*(x[0]*y[1]-x[1]*y[0]);return{angle:(deg(Math.atan2(s2,s1))/2+180)%180,ellipticity:deg(Math.asin(clamp(s3/s0,-1,1)))/2}}
function waveplate(f,d,axis,type){const u=V.unit(V.sub(axis,V.mul(d,V.dot(axis,d)))),v=V.cross(d,u),a=[V.dot(f.re,u),V.dot(f.im,u)],b=[V.dot(f.re,v),V.dot(f.im,v)],delta=type==='hwp'?Math.PI:Math.PI/2;let bp=type==='polarizer'?[0,0]:[b[0]*Math.cos(delta)-b[1]*Math.sin(delta),b[0]*Math.sin(delta)+b[1]*Math.cos(delta)];const out={re:V.add(V.mul(u,a[0]),V.mul(v,bp[0])),im:V.add(V.mul(u,a[1]),V.mul(v,bp[1]))};return{field:normalizeField(out),fraction:intensity(out)/Math.max(1e-15,intensity(f))}}
function radius(b,q=b.q){return Math.sqrt(Math.max(1e-12,b.wavelength*1e-6*b.m2*(q.re*q.re+q.im*q.im)/(Math.PI*q.im)))}
function qLens(q,f){if(Math.abs(f)<1e-9)return q;const z=q.re*q.re+q.im*q.im,a=q.re/z-1/f,b=-q.im/z,den=a*a+b*b;return{re:a/den,im:-b/den}}
function pulse(b){const t=b.pulseWidth0;return t*Math.sqrt(1+(4*Math.log(2)*b.gdd/t**2)**2)}
function stamp(b,d){const p=polState(b.field,d);return{...b,polarization:p.angle,ellipticity:p.ellipticity}}
function firstHit(o,d,lastId,components){let best=null;for(const c of components){if(c.id===lastId||c.type==='laser')continue;const {n,u,v}=pose(c),den=V.dot(d,n);if(Math.abs(den)<1e-8)continue;const t=V.dot(V.sub(position(c),o),n)/den;if(t<1e-6)continue;const point=V.add(o,V.mul(d,t)),rel=V.sub(point,position(c)),off=[V.dot(rel,u),V.dot(rel,v)],r=Math.hypot(...off),ap=Math.max(.01,num(c.params.aperture,c.type==='delay'?20:25.4));if(r>ap/2)continue;if(!best||t<best.t)best={c,t,point,off,r,ap}}return best}
function worldBounds(state){const ps=state.components.map(position);for(const b of state.boards){ps.push([b.x-30,b.y-30,0],[b.x+(b.cols-1)*b.spacing+30,b.y+(b.rows-1)*b.spacing+30,0])}if(!ps.length)ps.push([0,0,0],[600,400,100]);return{min:[0,1,2].map(i=>Math.min(...ps.map(p=>p[i]))-(i===2?0:150)),max:[0,1,2].map(i=>Math.max(...ps.map(p=>p[i]))+200)}}
function exitDistance(o,d,b){const ts=[];for(let i=0;i<3;i++){if(d[i]>1e-10)ts.push((b.max[i]-o[i])/d[i]);if(d[i]<-1e-10)ts.push((b.min[i]-o[i])/d[i])}return Math.max(.001,Math.min(3000,...ts.filter(x=>x>1e-6)))}
function bboConditions(c,a,b){const cross=deg(Math.acos(clamp(V.dot(a.d,b.d),-1,1))),angleError=Math.abs(cross-num(c.params.targetCrossingAngle)),tol=Math.max(.01,num(c.params.angleTolerance,5));const fb=transport(b.beam.field,b.d,a.d),pa=polState(a.beam.field,a.d).angle,pb=polState(fb,a.d).angle,pd=Math.abs(pa-pb)%180,polDiff=Math.min(pd,180-pd),mode=c.params.polarizationMode||'any',error=mode==='parallel'?polDiff:mode==='crossed'?Math.abs(90-polDiff):0,pt=Math.max(.01,num(c.params.polarizationTolerance,10));return{cross,polDiff,angleOk:angleError<=tol,polOk:error<=pt,angleFactor:Math.exp(-4*Math.log(2)*(angleError/tol)**2),polFactor:Math.exp(-4*Math.log(2)*(error/pt)**2)}}

/* BBO: near-normal slab, modal powers, Type-I undepleted conversion. */
function bboIndex(w,mode='o',theta=0){
 const l=w/1000,l2=l*l;
 const no=Math.sqrt(2.7366122+.0185720/(l2-.0178746)-.0143756*l2);
 const ne=Math.sqrt(2.3698703+.0128445/(l2-.0153064)-.0029129*l2);
 return mode==='o'?no:1/Math.sqrt(Math.cos(theta)**2/no**2+Math.sin(theta)**2/ne**2);
}
function bboAxis(c){const f=pose(c),t=rad(num(c.params.phaseMatchAngle,29.2)),p=rad(num(c.params.opticAzimuth));return V.add(V.mul(f.n,Math.cos(t)),V.mul(V.add(V.mul(f.u,Math.cos(p)),V.mul(f.v,Math.sin(p))),Math.sin(t)))}
function bboMode(c,d,w,mode){
 const axis=bboAxis(c),co=clamp(V.dot(axis,d),-1,1),theta=Math.acos(Math.abs(co)),cross=V.cross(d,axis);
 const o=V.len(cross)>1e-9?V.unit(cross):basis(d).u,e=V.unit(V.cross(o,d)),pol=mode==='o'?o:e;
 const n=bboIndex(w,mode,theta),h=.01,ng=n-w*(bboIndex(w+h,mode,theta)-bboIndex(w-h,mode,theta))/(2*h);
 // S follows the normal to the extraordinary wave-vector ellipsoid.
 const no=bboIndex(w),ne=bboIndex(w,'e',Math.PI/2),S=mode==='o'?d:V.unit(V.add(V.mul(d,1/ne**2),V.mul(axis,co*(1/no**2-1/ne**2))));
 return{mode,n,ng,theta,pol,S,walkoff:Math.acos(clamp(V.dot(d,S),-1,1))};
}
function bboMatch(c,d1,w1,d2=d1,w2=w1){
 const k=V.add(V.mul(d1,bboIndex(w1)/w1),V.mul(d2,bboIndex(w2)/w2)),d=V.unit(k),wave=1/(1/w1+1/w2),m=bboMode(c,d,wave,'e');
 const deltaK=2*Math.PI*1e6*(V.len(k)-m.n/wave),L=Math.max(0,num(c.params.thickness,.5)),x=deltaK*L/2,phaseFactor=Math.abs(x)<1e-8?1:(Math.sin(x)/x)**2;
 return{...m,d,wave,deltaK,phaseFactor};
}
function bboCut(w){let lo=0,hi=Math.PI/2;if(w<410||w>3300)return null;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(bboIndex(w/2,'e',mid)>bboIndex(w))lo=mid;else hi=mid}return deg((lo+hi)/2)}

function trace(state,defs){const segments=[],queue=[],bboHits={},reports=[],warnings=[],bounds=worldBounds(state);let seq=0;
for(const c of state.components.filter(c=>c.type==='laser')){const p=c.params,d=pose(c).n,wavelength=Math.max(1,num(p.wavelength,800)),m2=Math.max(1,num(p.m2,1)),waist=Math.max(.001,num(p.waistRadius,1));queue.push({o:position(c),d,sourceId:c.id,lastId:c.id,branch:'0',depth:0,total:0,opl:0,timePs:0,path:[],via:[],beam:stamp({wavelength,m2,power:Math.max(0,num(p.power,100)),field:sourceField(d,num(p.polarization),num(p.ellipticity)),q:{re:0,im:Math.PI*waist**2/(m2*wavelength*1e-6)},pulseWidth0:Math.max(.001,num(p.pulseWidth,50)),gdd:num(p.gdd),repetitionRate:Math.max(.001,num(p.repetitionRate,1))},d)})}
while(queue.length&&segments.length<1600){const r=queue.shift();if(r.depth>40||!Number.isFinite(r.beam.power)||r.beam.power<=0)continue;const h=firstHit(r.o,r.d,r.lastId,state.components),limit=exitDistance(r.o,r.d,bounds),hit=h&&h.t<=limit?h:null,L=hit?hit.t:limit,end=V.add(r.o,V.mul(r.d,L)),q={re:r.beam.q.re+L,im:r.beam.q.im},w=radius(r.beam,q),fraction=hit?clamp(1-Math.exp(-2*(Math.max(0,hit.ap/2-hit.r)/w)**2),0,1):1,beamEnd=stamp({...r.beam,q,power:r.beam.power*fraction},r.d);
const seg={weak:r.beam.power<1e-6,id:'ray'+seq++,sourceId:r.sourceId,fromId:r.lastId,toId:hit?.c.id||null,a:r.o.slice(),b:end,d:r.d.slice(),length:L,total:r.total+L,opl:r.opl+L,timePs:r.timePs+L/.299792458,beam:r.beam,beamEnd,wStart:radius(r.beam),wEnd:w,pulseEnd:pulse(beamEnd),branch:r.branch,path:r.path.slice(),hitOffset:hit?.off||[0,0],clipFraction:fraction,edgeWarning:fraction<.99,mixInfo:r.mixInfo||null};segments.push(seg);if(!hit)continue;
const c=hit.c,p=c.params,f=pose(c),behavior=defs[c.type]?.rayBehavior,base={...r,o:end,lastId:c.id,depth:r.depth+1,total:seg.total,opl:seg.opl,timePs:seg.timePs,path:[...r.path,seg.id],via:[...r.via,c.id],beam:beamEnd};
if(typeof window!=='undefined'&&window.CatalogCore)warnings.push(...window.CatalogCore.warnings(c,beamEnd.wavelength,deg(Math.acos(clamp(Math.abs(V.dot(r.d,f.n)),0,1)))));
if(behavior==='stop')continue;
const send=(d,b=base.beam,suffix='',origin=end,extra={})=>queue.push({...base,...extra,o:origin.slice(),d,beam:stamp(b,d),branch:r.branch+suffix});
// PBS uses the effective internal splitting plane, rather than the cube entrance face.
if(behavior==='polarizingSplit'){
 const cross=V.cross(r.d,f.n),sAxis=V.len(cross)>1e-8?V.unit(cross):basis(r.d).v,pAxis=V.unit(V.cross(sAxis,r.d));
 const reflected=waveplate(beamEnd.field,r.d,sAxis,'polarizer'),transmitted=waveplate(beamEnd.field,r.d,pAxis,'polarizer'),d=reflect(r.d,f.n);
 if(intensity(reflected.field)>0)send(d,{...beamEnd,field:{re:reflect(reflected.field.re,f.n),im:reflect(reflected.field.im,f.n)},power:beamEnd.power*reflected.fraction*percent(p.reflectivity)},'R');
 if(intensity(transmitted.field)>0)send(r.d,{...beamEnd,field:transmitted.field,power:beamEnd.power*transmitted.fraction*percent(p.transmission)},'T');
 const cal=findPbsRecord(state,c,r.via);
 warnings.push(c.name+'：PBS 使用理想偏振分束面；Yaw/Pitch 设置内部分束面法线，未模拟有限消光比、立方体折射或内部光程。'+(cal?'分光已按半波片极值角度记录校准（'+num(cal.record.hwpMinAngle)+'° 反射最弱，'+num(cal.record.hwpMaxAngle)+'° 反射最强）。':''));continue;
}
if(behavior==='wollaston'){
 const projected=V.sub(f.u,V.mul(r.d,V.dot(f.u,r.d))),u=V.len(projected)>1e-8?V.unit(projected):basis(r.d).u,v=V.cross(r.d,u),half=rad(clamp(num(p.separationAngle,16),0,89)/2);
 for(const [axis,sign,suffix]of [[u,1,'A'],[v,-1,'B']]){const part=waveplate(beamEnd.field,r.d,axis,'polarizer'),d=V.unit(V.add(V.mul(r.d,Math.cos(half)),V.mul(u,sign*Math.sin(half))));if(intensity(part.field)>0)send(d,{...beamEnd,field:transport(part.field,r.d,d),power:beamEnd.power*part.fraction*percent(p.transmission)},suffix)}
 warnings.push(c.name+'：沃拉斯顿棱镜采用近法线、对称双束近似；夹角固定为 '+num(p.separationAngle,16)+'°，未模拟随波长变化的色散和内部光程。');continue;
}
if(c.type==='chopper')warnings.push(c.name+'：斩波器仅按占空比计算时间平均功率；未模拟转速、刀片时序或瞬时脉冲。');
if(behavior==='reflect'){const d=reflect(r.d,f.n),field={re:reflect(beamEnd.field.re,f.n),im:reflect(beamEnd.field.im,f.n)};send(d,{...beamEnd,field,power:beamEnd.power*percent(p.reflectivity,99)});continue}
if(behavior==='retroreflect'){
  const side=V.unit(V.sub(f.u,V.mul(r.d,V.dot(f.u,r.d)))),off=num(p.returnOffset,20),depth=25+Math.max(0,num(p.travel)),p1=V.add(end,V.mul(r.d,depth)),p2=V.add(p1,V.mul(side,off)),p3=V.add(end,V.mul(side,off)),extra=2*depth+Math.abs(off);let previous=end,acc=0;
  for(const pt of [p1,p2,p3]){const len=V.len(V.sub(pt,previous)),dir=V.unit(V.sub(pt,previous)),innerBeam=stamp({...beamEnd,field:transport(beamEnd.field,r.d,dir),q:{re:q.re+acc,im:q.im}},dir);acc+=len;segments.push({...seg,id:'ray'+seq++,a:previous,b:pt,d:dir,beam:innerBeam,beamEnd:{...innerBeam,q:{re:q.re+acc,im:q.im}},length:len,total:seg.total+acc,opl:seg.opl+acc,timePs:seg.timePs+acc/.299792458,fromId:c.id,toId:null,internal:true});previous=pt}
  base.total+=extra;base.opl+=extra;base.timePs+=extra/.299792458;send(V.mul(r.d,-1),{...beamEnd,field:transport(beamEnd.field,r.d,V.mul(r.d,-1)),q:{re:q.re+extra,im:q.im},power:beamEnd.power*percent(p.reflectivity,98)**2},'',p3);continue;
}
if(behavior==='split'||behavior==='dichroic'){
  let R=percent(p.reflectivity,50),T=percent(p.transmission,50);if(behavior==='dichroic'){const short=beamEnd.wavelength<num(p.cutoffWavelength,650),ref=(p.reflectBand==='short')===short;R=ref?percent(p.reflection,98):0;T=ref?0:percent(p.transmission,95)}const d=reflect(r.d,f.n);
  send(d,{...beamEnd,field:{re:reflect(beamEnd.field.re,f.n),im:reflect(beamEnd.field.im,f.n)},power:beamEnd.power*R},'R');const t=Math.max(0,num(p.thickness)),n=Math.max(1,num(p.refractiveIndex,1));send(r.d,{...beamEnd,power:beamEnd.power*T,gdd:beamEnd.gdd+num(p.materialGdd)},'T',end,{opl:base.opl+(n-1)*t,timePs:base.timePs+(n-1)*t/.299792458});continue;
}
let b={...beamEnd};
if(c.type==='material'){
 const incidence=deg(Math.acos(clamp(Math.abs(V.dot(r.d,f.n)),0,1)));
 if(p.interaction!=='reflect'&&incidence>5)warnings.push(c.name+'：透射材料采用近法线等效薄片模型；当前入射角 '+incidence.toFixed(1)+'°，未计算折射和横向偏移。');
 const t=Math.max(0,num(p.thickness)),n=Math.max(1,num(p.refractiveIndex,1.5)),ng=Math.max(1,num(p.groupIndex,n));
 let T=p.interaction==='reflect'?0:percent(p.transmission,90),R=['reflect','both'].includes(p.interaction)?percent(p.reflectivity,10):0;
 const sum=T+R;if(sum>1){T/=sum;R/=sum;}
 if(R>0){const d=reflect(r.d,f.n);send(d,{...b,field:{re:reflect(b.field.re,f.n),im:reflect(b.field.im,f.n)},power:b.power*R},'R');}
 if(T>0)send(r.d,{...b,power:b.power*T,gdd:b.gdd+num(p.materialGdd)},p.interaction==='both'?'T':'',end,{opl:base.opl+(n-1)*t,timePs:base.timePs+(ng-1)*t/.299792458});continue;
}
if(['hwp','qwp','polarizer'].includes(c.type)){let axis=f.u;if(c.type==='hwp'){const cal=findHwpRecord(state,c,r.via);if(cal){const rec=cal.record,span=num(rec.hwpMaxAngle)-num(rec.hwpMinAngle),t=(num(c.roll)-num(rec.hwpMinAngle))/span,phiIn=polState(b.field,r.d).angle,{u,v}=basis(r.d);let sAngle=90;const pbs=viaComponent(state,rec.ids.pbs);if(pbs){const s=V.cross(r.d,pose(pbs).n);if(V.len(s)>1e-8){const unitS=V.unit(s);sAngle=deg(Math.atan2(V.dot(unitS,v),V.dot(unitS,u)))}}const phiOut=sAngle-90+90*t,eff=rad((phiIn+phiOut)/2);axis=V.unit(V.add(V.mul(u,Math.cos(eff)),V.mul(v,Math.sin(eff))))}}const out=waveplate(b.field,r.d,axis,c.type);b.field=out.field;b.power*=out.fraction*percent(p.transmission,98)}
else if(c.type==='lens'){b.power*=percent(p.transmission,99);b.q=qLens(b.q,num(p.focalLength,100));const sign=V.dot(r.d,f.n)>=0?1:-1,axis=V.mul(f.n,sign),ax=V.dot(r.d,axis),tangent=V.sub(r.d,V.mul(axis,ax)),offset=V.sub(end,position(c)),focal=num(p.focalLength,100);const d=V.unit(V.add(axis,V.sub(V.mul(tangent,1/Math.max(1e-6,ax)),V.mul(offset,1/(focal||1e-9)))));b.field=transport(b.field,r.d,d);base.d=d}
else if(behavior!=='shg'){const transform=defs[c.type]?.transform;if(transform){b={...b,...transform({...b},p)}}else b.power*=percent(p.transmission)}
const thick=Math.max(0,num(p.thickness)),n=Math.max(1,num(p.refractiveIndex,1));if(behavior!=='shg'){base.opl+=(n-1)*thick;base.timePs+=(n-1)*thick/.299792458}b.gdd+=num(p.materialGdd);
if(behavior==='shg'){
 if(b.wavelength<200||b.wavelength>3300){warnings.push(c.name+'：波长超出本模型 200–3300 nm 范围，停止追迹。');continue}
 const incidence=deg(Math.acos(clamp(Math.abs(V.dot(r.d,f.n)),0,1)));
 if(incidence>5){warnings.push(c.name+'：入射角 '+incidence.toFixed(1)+'° 超出近法线模型 ±5°，停止追迹；请调整晶体法线。');continue}
 const L=thick/Math.max(.001,Math.abs(V.dot(r.d,f.n))),T=percent(p.transmission,95);
 const modes=['o','e'].map(mode=>{const m=bboMode(c,r.d,b.wavelength,mode),fraction=(V.dot(b.field.re,m.pol)**2+V.dot(b.field.im,m.pol)**2)/Math.max(1e-15,intensity(b.field));return{...m,fraction}});
 const om=modes[0],entry={ray:seg,d:r.d,beam:beamEnd,opl:seg.opl,timePs:seg.timePs+om.ng*L/(2*.299792458),pulse:seg.pulseEnd,ordinary:om.fraction};
 // Modal output starts at the real back face; air propagation no longer double-counts the slab.
 for(const m of modes){if(m.fraction<1e-12)continue;const path=L/Math.max(1e-6,V.dot(m.S,r.d)),origin=V.add(end,V.mul(m.S,path));
 send(r.d,{...b,field:{re:m.pol,im:[0,0,0]},power:b.power*m.fraction*T,mode:m.mode,crystalInfo:{n:m.n,ng:m.ng,walkoffMrad:m.walkoff*1000},q:{re:q.re+L/m.n,im:q.im}},m.mode,origin,{total:seg.total+path,opl:seg.opl+m.n*L,timePs:seg.timePs+m.ng*L/.299792458});
 }
 const generate=(other,self)=>{
 if(!self&&Math.abs(b.repetitionRate-other.beam.repetitionRate)>1e-6){warnings.push(c.name+'：两光源重复频率不同，未计算跨脉冲序列的和频。');return}
 const match=bboMatch(c,r.d,b.wavelength,other.d,other.beam.wavelength);
 if(match.wave<200)return;
 const dt=Math.abs(entry.timePs-other.timePs),gvm=Math.max(Math.abs(match.ng-om.ng),Math.abs(match.ng-bboMode(c,other.d,other.beam.wavelength,'o').ng))*L/.299792458;
 const window=Math.hypot(entry.pulse,other.pulse)/1000,temporal=Math.exp(-4*Math.log(2)*(dt/Math.hypot(window,gvm))**2)*window/Math.hypot(window,gvm);
 const sep=V.len(V.sub(seg.b,other.ray.b)),spatial=Math.exp(-2*sep**2/(seg.wEnd**2+other.ray.wEnd**2)),walk=Math.exp(-((L*Math.tan(match.walkoff)/2)**2)/(seg.wEnd**2+other.ray.wEnd**2)),polFactor=entry.ordinary*other.ordinary;
 const signal=match.phaseFactor*polFactor*temporal*spatial*walk;
 const deff=(.08*Math.sin(match.theta)-2.2*Math.cos(match.theta)*Math.sin(3*rad(num(p.crystalAzimuth,90))))*1e-12;
 const omega=2*Math.PI*299792458/(match.wave*1e-9),area=Math.PI*(seg.wEnd**2+other.ray.wEnd**2)*1e-6/2;
 const peak=other.beam.power*1e-3/(area*other.beam.repetitionRate*1000*other.pulse*1e-15*Math.sqrt(Math.PI/(4*Math.log(2)))*Math.sqrt(2));
 const ratio=(self?.25:1)*2*omega**2*deff**2*(L*1e-3)**2*peak/(8.8541878128e-12*299792458**3*bboIndex(b.wavelength)*bboIndex(other.beam.wavelength)*match.n)*signal;
 const raw=b.power*ratio,power=Math.min(raw,.05*Math.min(b.power,other.beam.power))*T;
 if(raw>.05*Math.min(b.power,other.beam.power))warnings.push(c.name+'：低转换近似超限，生成光功率封顶为较弱输入的 5%；不是定量效率。');
 const rep={cId:c.id,a:entry,b:other,self,cross:deg(Math.acos(clamp(V.dot(r.d,other.d),-1,1))),dt,window:Math.hypot(window,gvm),spatial,signal,wave:match.wave,ok:power>1e-9,angleFactor:match.phaseFactor,polFactor,phaseFactor:match.phaseFactor,deltaK:match.deltaK,theta:deg(match.theta),walkoffMrad:match.walkoff*1000,gvmPs:gvm,power,cut:bboCut(b.wavelength),oFraction:om.fraction};reports.push(rep);
 if(power>1e-9){const origin=V.add(end,V.add(V.mul(match.d,L/2),V.mul(match.S,L/(2*Math.max(1e-6,V.dot(match.S,match.d))))));send(match.d,{...b,wavelength:match.wave,power,field:{re:match.pol,im:[0,0,0]},mode:'e',q:{re:0,im:Math.PI*(seg.wEnd/Math.sqrt(2))**2/(match.wave*1e-6*b.m2)}},self?'2ω':'S'+other.ray.id,origin,{total:seg.total+V.len(V.sub(origin,end)),opl:seg.opl+(om.n+match.n)*L/2,timePs:(entry.timePs+other.timePs)/2+match.ng*L/(2*.299792458),mixInfo:{dt,window}})}
 };
 generate(entry,true);bboHits[c.id]??=[];for(const other of bboHits[c.id]){if(other.ray.sourceId!==seg.sourceId)generate(other,false)}bboHits[c.id].push(entry);continue;
}

send(base.d,b);
}
if(queue.length)warnings.push('达到追迹上限；请检查循环反射或过多分束。');return{segments,reports,warnings};
}
function legacyDirections(components,defs){const dirs={},queue=components.filter(c=>c.type==='laser').map(c=>({o:[num(c.x),num(c.y),num(c.height,100)],d:frame(num(c.rotation)).n,last:c.id,depth:0}));let budget=400;while(queue.length&&budget-->0){const r=queue.shift();if(r.depth>28)continue;let best=null;for(const c of components){if(c.type==='laser'||c.id===r.last||Math.abs(num(c.height,100)-r.o[2])>.5)continue;const center=[num(c.x),num(c.y),num(c.height,100)],rel=V.sub(center,r.o),mir=['mirror','beamsplitter','dichroic'].includes(c.type),n=mir?frame(num(c.rotation)+90).n:r.d,den=V.dot(r.d,n);if(Math.abs(den)<1e-8)continue;const t=V.dot(rel,n)/den;if(t<=1e-5)continue;const point=V.add(r.o,V.mul(r.d,t)),ap=num(c.params?.aperture,defs[c.type]?.defaults.aperture||20);if(V.len(V.sub(point,center))>ap/2)continue;if(!best||t<best.t)best={c,point,t,n,mir}}if(!best)continue;const {c,point,n,mir}=best;dirs[c.id]??=[];dirs[c.id].push(r.d);const base={o:point,last:c.id,depth:r.depth+1};if(defs[c.type]?.rayBehavior==='stop')continue;if(c.type==='delay'){const side=[-r.d[1],r.d[0],0];queue.push({...base,o:V.add(point,V.mul(side,num(c.params?.returnOffset,20))),d:V.mul(r.d,-1)})}else if(mir){queue.push({...base,d:reflect(r.d,n)});if(c.type!=='mirror')queue.push({...base,d:r.d})}else queue.push({...base,d:r.d})}return dirs}
function migrate(input,defs){if(!input||!Array.isArray(input.boards)||!Array.isArray(input.components)||!input.boards.length)throw Error('设计缺少平台或器件列表');const s=JSON.parse(JSON.stringify(input)),old=num(s.version)<8,hints=old?legacyDirections(s.components,defs):{};s.version=8;s.showRays=s.showRays!==false;s.boards=s.boards.map(b=>({...b,x:num(b.x),y:num(b.y),cols:clamp(Math.round(num(b.cols,24)),2,100),rows:clamp(Math.round(num(b.rows,16)),2,100),spacing:clamp(num(b.spacing,25),1,100)}));s.components=s.components.map(c=>{if(!defs[c.type])throw Error('未知器件：'+c.type);const p={...defs[c.type].defaults,...c.params},axis=['hwp','qwp','polarizer'].includes(c.type),mirror=['mirror','beamsplitter','dichroic'].includes(c.type),incoming=hints[c.id],sum=incoming?.reduce((a,b)=>V.add(a,b),[0,0,0]),direction=sum&&V.len(sum)>1e-6?deg(Math.atan2(sum[1],sum[0])):0;return{...c,x:num(c.x),y:num(c.y),z:Math.max(0,num(c.z,num(c.height,100))),yaw:num(c.yaw,old?(mirror?num(c.rotation)+90:c.type==='laser'?num(c.rotation):direction):0),pitch:clamp(num(c.pitch),-90,90),roll:num(c.roll,old&&axis?num(c.rotation):0),params:p}});delete s.edges;return s}
function formatSignal(v){return v!==0&&Math.abs(v)<.001?v.toExponential(3):v.toFixed(3)}
root.Optics3D={formatSignal,V,rad,deg,num,clamp,frame,basis,pose,position,reflect,transport,intensity,normalizeField,sourceField,polState,waveplate,radius,pulse,qLens,firstHit,trace,migrate,worldBounds,bboConditions,bboIndex,bboAxis,bboMode,bboMatch,bboCut,extremaFraction,angleRecords,findHwpRecord,findPbsRecord};
if(typeof module!=='undefined')module.exports=root.Optics3D;
})(typeof window!=='undefined'?window:globalThis);
