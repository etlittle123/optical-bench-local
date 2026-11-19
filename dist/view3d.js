/* Dependency-free orthographic 3D mesh renderer. Geometry lives in world mm. */
(function(root){'use strict';const O=root.Optics3D||(typeof require==='function'?require('./engine3d.js'):null),{V,rad,clamp}=O;
const color=w=>w<450?'#7942ce':w<570?'#17854e':w<700?'#a96b00':'#d33449';
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
function inside(p,pts){let yes=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if(((a.y>p.y)!==(b.y>p.y))&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes}return yes}
class BenchView{
 constructor(canvas,{animate=true,style="studio"}={}){this.style=style;this.canvas=canvas;this.ctx=canvas.getContext('2d');this.camera={az:-60,el:36,zoom:1,panX:0,panY:0,target:[360,280,70]};this.w=800;this.h=600;this.items=[];this.projected=[];this.state={components:[],boards:[]};this.rays=[];this.selected=new Set();this.labels=true;this.showBoards=true;this.showNames=true;this.showWavelengths=true;this.polarization=true;this.animate=animate;this.dirty=true;this.rectangle=null;this.last=0;this.modelBuilders=root.OPTICAL_MODELS||{};}
 resize(w,h,dpr=1){this.w=Math.max(1,w);this.h=Math.max(1,h);this.dpr=dpr;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.canvas.style&&(this.canvas.style.width=w+'px',this.canvas.style.height=h+'px');this.dirty=true}
 axes(){const a=rad(this.camera.az),e=rad(this.camera.el),n=[Math.cos(a)*Math.cos(e),Math.sin(a)*Math.cos(e),Math.sin(e)],u=[-Math.sin(a),Math.cos(a),0];return{n,u,v:V.cross(n,u)}}
 project(p){const {n,u,v}=this.axes(),r=V.sub(p,this.camera.target),z=this.camera.zoom;return{x:this.w/2+this.camera.panX+V.dot(r,u)*z,y:this.h/2+this.camera.panY-V.dot(r,v)*z,depth:V.dot(r,n)}}
 unproject(p,z){const {n,u,v}=this.axes(),x=(p.x-this.w/2-this.camera.panX)/this.camera.zoom,y=-(p.y-this.h/2-this.camera.panY)/this.camera.zoom,q=V.add(this.camera.target,V.add(V.mul(u,x),V.mul(v,y)));if(Math.abs(n[2])<1e-5)return null;return V.add(q,V.mul(n,(z-q[2])/n[2]))}
 fit(){const b=O.worldBounds(this.state);this.camera.target=[(b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(Math.max(...this.state.components.map(c=>c.z),100))/2];this.camera.panX=this.camera.panY=0;this.camera.zoom=1;const pts=[];for(const x of [b.min[0]+110,b.max[0]-160])for(const y of [b.min[1]+110,b.max[1]-160])for(const z of [0,Math.max(...this.state.components.map(c=>c.z),100)+40])pts.push(this.project([x,y,z]));const width=Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x)),height=Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y));this.camera.zoom=clamp(Math.min((this.w-100)/Math.max(1,width),(this.h-100)/Math.max(1,height)),.2,4);this.dirty=true}
 preset(name){const v={iso:[-60,36],top:[-90,90],front:[-90,0],side:[0,0]}[name];if(v){[this.camera.az,this.camera.el]=v;this.fit()}}
 add(kind,points,style={},id=null){this.items.push({kind,points,style,id,layer:this.style==='paper'&&id?.kind==='ray'?1:(this.layer??2)})}
 line(a,b,color='#8ba4b9',width=1,id=null,dash=[],opacity=1){this.add('line',[a,b],{color,width,dash,opacity},id)}
 poly(points,fill,stroke='#35475a',id=null){this.add('poly',points,{fill,stroke},id)}
 box(center,axes,sizes,fill,id){const [u,v,n]=axes,pts=[];for(let k=0;k<8;k++)pts.push(V.add(center,V.add(V.add(V.mul(u,((k&1)?1:-1)*sizes[0]/2),V.mul(v,((k&2)?1:-1)*sizes[1]/2)),V.mul(n,((k&4)?1:-1)*sizes[2]/2))));for(const f of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]])this.poly(f.map(i=>pts[i]),fill,'#465368',id)}
 disk(center,n,u,r,depth,fill,id,inner=0){const v=V.cross(n,u),rings=[-depth/2,depth/2].map(z=>Array.from({length:24},(_,i)=>V.add(center,V.add(V.mul(n,z),V.add(V.mul(u,r*Math.cos(i*Math.PI/12)),V.mul(v,r*Math.sin(i*Math.PI/12)))))));for(let i=0;i<24;i++){let j=(i+1)%24;this.poly([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],'#a0b2c3','#657e95',id)}for(let k=0;k<2;k++){if(!inner)this.poly(rings[k],fill,'#8da8bb',id);else{const small=rings[k].map(pt=>V.add(V.add(center,V.mul(n,(k-.5)*depth)),V.mul(V.sub(pt,V.add(center,V.mul(n,(k-.5)*depth))),inner/r)));for(let i=0;i<24;i++){const j=(i+1)%24;this.poly([rings[k][i],rings[k][j],small[j],small[i]],fill,'#61748b',id)}}}}
 label(p,text,color='#354f68',badge=false){this.add('text',[p],{text,color,badge});if(badge)this.items[this.items.length-1].layer=10}
 opticalFace(points,material,id){this.add('poly',points,{optical:material,stroke:'#7893a277'},id)}
 optic(p,n,u,r,kind,id){
  const v=V.cross(n,u),steps=48,at=(radius,z,a)=>V.add(p,V.add(V.mul(n,z),V.add(V.mul(u,radius*Math.cos(a)),V.mul(v,radius*Math.sin(a)))));
  const lens=kind==='convex'||kind==='concave',edge=lens?(kind==='convex'?1.1:Math.max(2,r*.22)):1.1;
  const profile=t=>lens?(kind==='convex'?edge+r*.23*(1-t*t):.65+(edge-.65)*t*t):edge;
  const rings=[-1,1].map(sign=>Array.from({length:steps},(_,i)=>at(r,sign*edge,i*2*Math.PI/steps)));
  for(let i=0;i<steps;i++){const j=(i+1)%steps,light=(1+Math.cos(i*2*Math.PI/steps-2.3))/2,shade=Math.round(100+85*light);this.add('poly',[rings[0][i],rings[0][j],rings[1][j],rings[1][i]],{fill:kind==='mirror'?`rgb(${shade},${shade+8},${shade+18})`:`rgba(151,199,214,${.28+.28*light})`,smoothGlass:true},id)}
  if(lens){
   // Curved front/back profiles are display geometry only; tracing stays a thin lens.
   const light=V.unit([-.4,-.6,1]);
   for(const sign of [-1,1])for(let k=0;k<6;k++)for(let i=0;i<steps;i++){
    const a=i*2*Math.PI/steps,b=(i+1)*2*Math.PI/steps,t0=k/6,t1=(k+1)/6,points=k===0?[at(0,sign*profile(0),0),at(r*t1,sign*profile(t1),a),at(r*t1,sign*profile(t1),b)]:[at(r*t0,sign*profile(t0),a),at(r*t1,sign*profile(t1),a),at(r*t1,sign*profile(t1),b),at(r*t0,sign*profile(t0),b)];
    const t=(t0+t1)/2,theta=(a+b)/2,slope=kind==='convex'?-.46*t:2*(edge-.65)*t/r,normal=V.unit(V.sub(V.mul(n,sign),V.mul(V.add(V.mul(u,Math.cos(theta)),V.mul(v,Math.sin(theta))),slope))),shine=Math.pow(Math.abs(V.dot(normal,light)),10);
    this.add('poly',points,{fill:`rgba(${Math.round(145+110*shine)},${Math.round(192+63*shine)},${Math.round(210+45*shine)},${.18+.28*shine})`,smoothGlass:true},id);
   }
  }else for(const ring of rings)this.opticalFace(ring,kind,id);
  for(const ring of rings)for(let i=0;i<steps;i++)this.line(ring[i],ring[(i+1)%steps],kind==='mirror'?'#596878aa':'#7498a9aa',.7,id);
  // A small reflected softbox arc makes polished surfaces readable at normal scale.
  const sign=V.dot(n,this.axes().n)>=0?1:-1;
  for(let i=0;i<7;i++){const a=2.1+i*.085;this.line(at(r*.84,sign*(profile(.84)+.12),a),at(r*.84,sign*(profile(.84)+.12),a+.085),'#ffffffbd',kind==='mirror'?2:1.3,id)}
 }
 metalHousing(p,n,u,r,halfDepth,id){
  // Open annular housing: preserve the optical face and make edge-on views legible.
  const v=V.cross(n,u),steps=48,inner=r-.1,outer=r+2.2,at=(radius,z,i)=>V.add(p,V.add(V.mul(n,z),V.add(V.mul(u,radius*Math.cos(i*2*Math.PI/steps)),V.mul(v,radius*Math.sin(i*2*Math.PI/steps))))),light=V.unit([-.4,-.6,1]);
  const face=(points,shade)=>this.add('poly',points,{fill:`rgb(${shade},${shade+7},${shade+15})`,smoothGlass:true},id);
  for(let i=0;i<steps;i++){
   const j=i+1,a=(i+.5)*2*Math.PI/steps,normal=V.add(V.mul(u,Math.cos(a)),V.mul(v,Math.sin(a))),shine=Math.max(0,V.dot(normal,light)),shade=Math.round(53+68*shine+32*Math.pow(shine,12));
   face([at(outer,-halfDepth,i),at(outer,-halfDepth,j),at(outer,halfDepth,j),at(outer,halfDepth,i)],shade);
   face([at(inner,-halfDepth,j),at(inner,-halfDepth,i),at(inner,halfDepth,i),at(inner,halfDepth,j)],48);
   for(const sign of [-1,1]){
    const z=sign*halfDepth;
    face([at(outer,z,i),at(outer,z,j),at(inner,z,j),at(inner,z,i)],Math.round(86+44*Math.max(0,V.dot(V.mul(n,sign),light))));
    this.line(at(outer,z,i),at(outer,z,j),'#bac7d5',.55,id);
    this.line(at(inner,z,i),at(inner,z,j),'#455365',.55,id);
   }
  }
 }
 prism(p,n,u,v,r,id){
  const pts=[];for(let i=0;i<8;i++)pts.push(V.add(p,V.add(V.mul(u,(i&1?1:-1)*r),V.add(V.mul(v,(i&2?1:-1)*r),V.mul(n,(i&4?1:-1)*r)))));
  for(const f of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]])this.opticalFace(f.map(i=>pts[i]),'prism',id);
  this.opticalFace([pts[0],pts[2],pts[7],pts[5]],'coating',id);
 }
 componentName(c){
  const p=c.params||{},value=n=>Number.isFinite(n)?String(Number(n.toFixed(4))):'?';
  if(c.type==='lens'){const f=p.focalLength;return Number.isFinite(f)&&f!==0?`${f>0?'凸透镜':'凹透镜'}\nf = ${value(f)} mm`:'透镜\n焦距未设置';}
  if(c.type==='spectralFilter')return p.filterType==='bandpass'?`BP · ${value(p.centerWavelength)} nm\n带宽 ${value(p.bandwidth)} nm`:`${p.filterType==='longpass'?'LP':'SP'} · ${value(p.cutoffWavelength)} nm`;
  if(c.type==='nd'){const ranges=(c.catalog?.ranges||[]).filter(a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)&&a[0]>0&&a[1]>a[0]);return `ND · OD ${value(p.opticalDensity)}\n`+(ranges.length?'工作波段 '+ranges.map(a=>a.map(value).join('–')).join(' / ')+' nm':'工作波段未录入');}
  return ['material','sample'].includes(c.type)?(c.name||'材料'):(root.OPTICAL_COMPONENTS?.[c.type]?.name||c.type);
 }
 shortName(c){const names={material:'MAT',laser:'LD',mirror:'M',beamsplitter:'BS',pbs:'PBS',wollaston:'WP',chopper:'CH',dichroic:'DM',hwp:'HWP',qwp:'QWP',polarizer:'POL',lens:'L',delay:'DL',iris:'IR',nd:'ND',spectralFilter:'FLT',bbo:'BBO',sample:'S',detector:'PD'};const index=this.state.components.filter(x=>x.type===c.type).findIndex(x=>x.id===c.id)+1;return (names[c.type]||c.type.toUpperCase().slice(0,6))+index}
 mesh(c){const id={kind:'component',id:c.id},p=O.position(c),{n,u,v}=O.pose(c),radius=Math.max(5,O.num(c.params.aperture,25.4)/2),selected=this.selected.has(c.id),tint=selected?'#b6a9d1':'#42485d';
  if(this.style==='paper'){this.add('symbol',[p,V.add(p,V.mul(u,18))],{type:c.type},id);if(this.showNames)this.label(p,this.componentName(c),'#242735',true);return;}
  if(this.modelBuilders[c.type]){this.modelBuilders[c.type](this,c,id);return}
  if(c.type==='laser'){this.box(V.sub(p,V.mul(n,24)),[n,u,v],[48,30,30],tint,id);this.disk(p,n,u,8,4,'#d65e69',id);this.line(p,V.add(p,V.mul(n,25)),'#d33449',2)}
  else if(['pbs','wollaston','beamsplitter'].includes(c.type)){this.prism(p,n,u,v,radius,id)}
  else if(c.type==='bbo'){this.box(p,[u,v,n],[radius*2,radius*2,Math.max(5,O.num(c.params.thickness,.5))],'#64b9be66',id);const cut=rad(O.num(c.params.phaseMatchAngle,29.2)),phi=rad(O.num(c.params.opticAzimuth)),optic=V.add(V.mul(n,Math.cos(cut)),V.mul(V.add(V.mul(u,Math.cos(phi)),V.mul(v,Math.sin(phi))),Math.sin(cut)));this.line(V.sub(p,V.mul(optic,27)),V.add(p,V.mul(optic,27)),'#9b630b',2);if(this.showNames)this.label(V.add(p,V.mul(optic,34)),'OA','#9b630b')}
  else if(c.type==='delay'){const travel=25+Math.max(0,O.num(c.params.travel)),off=O.num(c.params.returnOffset,20),center=V.add(p,V.add(V.mul(n,travel/2),V.mul(u,off/2)));this.box(V.sub(center,V.mul(v,12)),[n,u,v],[travel+22,Math.abs(off)+30,8],tint,id);const m1=V.add(p,V.mul(n,travel)),m2=V.add(m1,V.mul(u,off)),n1=V.unit(V.sub(n,u)),n2=V.unit(V.add(n,u));this.disk(m1,n1,V.unit(V.cross(v,n1)),12,3,'#d7eef7',id);this.disk(m2,n2,V.unit(V.cross(v,n2)),12,3,'#d7eef7',id);this.line(p,m1,'#769caa',1,null,[3,4]);this.line(m1,m2,'#769caa',1,null,[3,4]);this.line(m2,V.add(p,V.mul(u,off)),'#769caa',1,null,[3,4])}
  else if(c.type==='material'){this.optic(p,n,u,radius,'glass',id)}
  else if(c.type==='detector'||c.type==='sample'){this.box(V.add(p,V.mul(n,6)),[u,v,n],[radius*2+12,radius*2+12,12],tint,id);this.disk(p,n,u,radius,2,c.type==='sample'?'#3d9581':'#26323a',id)}
  else if(c.type==='iris'||c.type==='chopper'){this.disk(p,n,u,radius+2,3,tint,id,c.type==='iris'?radius:0)}
  else {this.optic(p,n,u,radius,c.type==='lens'?(c.params.focalLength<0?'concave':'convex'):c.type==='mirror'?'mirror':c.type==='nd'?'nd':['dichroic','spectralFilter'].includes(c.type)?'coating':'glass',id);if(['hwp','qwp','polarizer'].includes(c.type))this.line(V.sub(p,V.mul(u,radius*.8)),V.add(p,V.mul(u,radius*.8)),'#a56a0b88',1)}
  if(['mirror','lens','polarizer','hwp','qwp','nd','spectralFilter','dichroic'].includes(c.type))this.metalHousing(p,n,u,radius,c.type==='lens'&&c.params.focalLength<0?Math.max(3.5,radius*.22+.6):3.5,id);
  if(selected){this.line(p,V.add(p,V.mul(n,42)),'#c53b4c',2);this.line(p,V.add(p,V.mul(u,32)),'#147f64',2);this.line(p,V.add(p,V.mul(v,32)),'#296bb7',2)}
  if(this.showNames)this.label(p,this.componentName(c),selected?'#955a06':'#173344',true);
 }
 setScene(state,result,selected){this.state=state;this.rays=result.segments;this.selected=selected;this.items=[];
 const live=this.rays.filter(r=>!r.internal);this.maxPower=Math.max(1e-12,...live.map(r=>r.beam.power));this.sourcePower={};for(const r of this.rays)if(r.fromId===r.sourceId)this.sourcePower[r.sourceId]=Math.max(this.sourcePower[r.sourceId]||0,r.beam.power);
 for(const b of (this.showBoards?state.boards:[])){const w=(b.cols-1)*b.spacing+32,h=(b.rows-1)*b.spacing+32,id={kind:'board',id:b.id};this.layer=0;this.poly([[b.x-16,b.y-16,0],[b.x-16+w,b.y-16,0],[b.x-16+w,b.y-16+h,0],[b.x-16,b.y-16+h,0]],'#d5dbe5','#b7c3cf',id);this.layer=1;for(let j=0;j<b.rows;j++)for(let i=0;i<b.cols;i++){const p=[b.x+i*b.spacing,b.y+j*b.spacing,0];this.add('hole',[p],{color:'#778da2'},id)}if(this.labels)this.label([b.x,b.y-24,2],`${b.cols} × ${b.rows} · ${b.spacing} mm`)}this.layer=2;
 for(const c of state.components)this.mesh(c);
 for(const r of this.rays){const id={kind:'ray',id:r.id},co=color(r.beam.wavelength),pieces=Math.max(1,Math.ceil(r.length/20)),from=state.components.find(c=>c.id===r.fromId),ratio=clamp(r.beam.power/Math.max(1e-12,this.maxPower),0,1),visual=Math.sqrt(ratio),paper=this.style==='paper',width=r.internal?1.5:paper?1.4+0.9*visual:1.1+1.9*visual,opacity=paper?1:.4+.6*visual,basePower=this.sourcePower[r.sourceId]||0,share=basePower>0?r.beam.power/basePower:1,split=from&&['pbs','beamsplitter','wollaston'].includes(from.type);
  for(let i=0;i<pieces;i++){const a=V.add(r.a,V.mul(V.sub(r.b,r.a),i/pieces)),b=V.add(r.a,V.mul(V.sub(r.b,r.a),(i+1)/pieces));this.line(a,b,co,width,id,r.internal?[3,3]:r.weak?[6,4]:[],opacity)}const mid=V.mul(V.add(r.a,r.b),.5);if(this.showWavelengths&&!r.internal)this.label(V.add(mid,[0,0,12]),`${r.beam.wavelength.toFixed(0)} nm${r.beam.mode?' · '+r.beam.mode:''}${split?' · '+(share*100).toFixed(share<.1?1:0)+'%':''}`,co);if(!r.internal){const {u}=O.basis(r.d),tip=V.add(r.a,V.mul(r.d,r.length*.65));this.line(V.add(V.sub(tip,V.mul(r.d,7)),V.mul(u,3)),tip,co,1.5);this.line(V.sub(V.sub(tip,V.mul(r.d,7)),V.mul(u,3)),tip,co,1.5)}
  if(from?.type==='lens'&&!r.internal){const z=-r.beam.q.re;if(z>=0&&z<=r.length){const p=V.add(r.a,V.mul(r.d,z)),{u,v}=O.basis(r.d);this.line(V.sub(p,V.mul(u,6)),V.add(p,V.mul(u,6)),'#163f5c',2);this.line(V.sub(p,V.mul(v,6)),V.add(p,V.mul(v,6)),'#163f5c',2);if(this.labels)this.label(V.add(p,[0,0,18]),`F ${z.toFixed(1)} mm`,'#163f5c')}}
 }
 this.dirty=true;
 }
 prepare(){this.labelLayout=null;this.projected=this.items.map(item=>({...item,ps:item.points.map(p=>this.project(p))})).map(item=>({...item,depth:item.ps.reduce((s,p)=>s+p.depth,0)/item.ps.length})).sort((a,b)=>a.layer-b.layer||a.depth-b.depth);this.dirty=false}
 paint(time=0){const ctx=this.ctx;if(this.dirty)this.prepare();ctx.setTransform(this.dpr||1,0,0,this.dpr||1,0,0);ctx.clearRect(0,0,this.w,this.h);const bg=ctx.createLinearGradient(0,0,this.w,this.h);bg.addColorStop(0,'#edf0f5');bg.addColorStop(1,'#c5cddd');ctx.fillStyle=this.style==='paper'?'#ffffff':bg;ctx.fillRect(0,0,this.w,this.h);ctx.lineJoin='round';ctx.font='11px sans-serif';
 for(const it of this.projected){const {ps,style:s,kind}=it;ctx.setLineDash(s.dash||[]);if(kind==='shadow'){ctx.save();ctx.shadowColor='#30334c55';ctx.shadowBlur=16;ctx.fillStyle='#53536e25';ctx.beginPath();ctx.ellipse(ps[0].x+7,ps[0].y+7,22*this.camera.zoom,9*this.camera.zoom,0,0,Math.PI*2);ctx.fill();ctx.restore();}else if(kind==='poly'){ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(s.optical){const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),g=ctx.createLinearGradient(x,y,x+Math.max(1,Math.max(...xs)-x),y+Math.max(1,Math.max(...ys)-y));const stops={mirror:['#697a91','#f7fbff','#9dabbc','#dfe6ef','#7d8da5'],edge:['#5d6a79','#b8c2cd','#778591'],glassEdge:['#b5e1e280','#f1fcffb0','#7191b888'],glass:['#f5fcff90','#a3cbd033','#a3b4d473'],coating:['#b2dafa88','#ada4e455','#70c0dc66'],prism:['#b2d2ed45','#c7bce960','#abdeeb38'],nd:['#333d4ce6','#78889fc9','#2d3749e6']}[s.optical]||['#d5e6ee66','#c0d0dd55'];stops.forEach((c,i)=>g.addColorStop(i/(stops.length-1),c));ctx.fillStyle=g}else ctx.fillStyle=s.fill;ctx.fill();if(it.id?.kind==='component'&&!s.optical&&!s.smoothGlass){const n=V.unit(V.cross(V.sub(it.points[1],it.points[0]),V.sub(it.points[2],it.points[0]))),light=Math.abs(V.dot(n,V.unit([-.4,-.5,1])));ctx.fillStyle=light>.55?'#ffffff20':'#10152b22';ctx.fill();}if(!s.smoothGlass){ctx.strokeStyle=s.optical?(s.optical==='prism'||s.optical==='coating'?'#829abc88':'#7f95a533'):it.id?.kind==='component'?'#39415966':s.stroke;ctx.lineWidth=.45;ctx.stroke()}}else if(kind==='line'){ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);ctx.lineTo(ps[1].x,ps[1].y);ctx.strokeStyle=s.color;ctx.lineWidth=s.width;ctx.globalAlpha=s.opacity??1;if(it.id?.kind==='ray'&&this.style!=='paper'&&!s.dash?.length){ctx.save();ctx.shadowColor=s.color;ctx.shadowBlur=12;ctx.globalAlpha=.28*(s.opacity??1);ctx.lineWidth=s.width+6;ctx.stroke();ctx.restore();ctx.strokeStyle=s.color;ctx.lineWidth=s.width;}ctx.stroke();ctx.globalAlpha=1}else if(kind==='hole'){ctx.beginPath();ctx.ellipse(ps[0].x,ps[0].y,Math.max(1,2.1*this.camera.zoom),Math.max(.5,2.1*this.camera.zoom*Math.abs(Math.sin(rad(this.camera.el)))) ,0,0,Math.PI*2);ctx.fillStyle='#a5b5c5';ctx.fill();ctx.strokeStyle=s.color;ctx.lineWidth=.6;ctx.stroke()}else if(kind==='symbol'){this.paintSymbol(it)}}
 ctx.setLineDash([]);if(this.polarization){for(const r of this.rays.filter(r=>!r.internal)){const mid=V.mul(V.add(r.a,r.b),.5),field=r.beam.field,scale=16,draw=t=>this.project(V.add(mid,V.mul(V.add(V.mul(field.re,Math.cos(t)),V.mul(field.im,Math.sin(t))),scale)));ctx.beginPath();for(let i=0;i<=40;i++){const p=draw(i*Math.PI/20);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.strokeStyle='#1f718e88';ctx.lineWidth=1;ctx.stroke();const tip=draw(this.animate?time*.002:0),center=this.project(mid);ctx.beginPath();ctx.moveTo(center.x,center.y);ctx.lineTo(tip.x,tip.y);ctx.strokeStyle='#163f5c';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(tip.x,tip.y,2,0,Math.PI*2);ctx.fillStyle='#163f5c';ctx.fill()}}
 if(this.rectangle){const r=this.rectangle;ctx.fillStyle='#087e801a';ctx.strokeStyle='#087e80';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeRect(r.x,r.y,r.w,r.h)}this.paintLabels();if(this.style!=='paper')this.drawAxes(ctx);
 }
 paintSymbol(it){const ctx=this.ctx,p=it.ps[0],q=it.ps[1],type=it.style.type;ctx.save();ctx.translate(p.x,p.y);ctx.lineWidth=1.3;ctx.strokeStyle='#59616c';ctx.fillStyle='#f0f1f3';
 if(['laser','detector','sample','delay'].includes(type)){ctx.fillStyle=type==='laser'||type==='detector'?'#343945':'#d7dbe0';ctx.fillRect(-16,-11,32,22);ctx.strokeRect(-16,-11,32,22);ctx.fillStyle=type==='laser'?'#78d8df':'#ffffff';ctx.fillRect(-11,-6,22,12);}
 else if(['beamsplitter','pbs','wollaston','dichroic','bbo'].includes(type)){ctx.fillStyle=type==='bbo'?'#cce5dc':'#e5edf2';ctx.fillRect(-10,-10,20,20);ctx.strokeRect(-10,-10,20,20);ctx.beginPath();ctx.moveTo(-10,10);ctx.lineTo(10,-10);ctx.stroke();}
 else{const angle=Math.atan2(q.y-p.y,q.x-p.x);ctx.rotate(angle);ctx.fillStyle=type==='material'?'#b6dbd9':type==='mirror'?'#c4d4e0':'#eef0f4';ctx.fillRect(-13,-4,26,8);ctx.strokeRect(-13,-4,26,8);if(['hwp','qwp','polarizer','nd','iris'].includes(type)){ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(0,7);ctx.stroke();}}
 ctx.restore();
 }
 layoutLabels(){const ctx=this.ctx,placed=[],overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 const rays=this.projected.filter(i=>i.id?.kind==='ray'&&i.kind==='line').map(i=>i.ps),bounds=new Map();
 for(const i of this.projected.filter(i=>i.id?.kind==='component'&&i.kind!=='text')){const padX=i.kind==='symbol'?20:4,padY=i.kind==='symbol'?15:4,xs=i.ps.map(p=>p.x),ys=i.ps.map(p=>p.y),b=bounds.get(i.id.id)||{x:Infinity,y:Infinity,right:-Infinity,bottom:-Infinity};b.x=Math.min(b.x,Math.min(...xs)-padX);b.y=Math.min(b.y,Math.min(...ys)-padY);b.right=Math.max(b.right,Math.max(...xs)+padX);b.bottom=Math.max(b.bottom,Math.max(...ys)+padY);bounds.set(i.id.id,b)}
 const obstacles=[...bounds.values()].map(b=>({x:b.x,y:b.y,w:b.right-b.x,h:b.bottom-b.y}));
 const crosses=(box,line)=>{const [a,b]=line;let lo=0,hi=1;for(const [v,d,min,max] of [[a.x,b.x-a.x,box.x,box.x+box.w],[a.y,b.y-a.y,box.y,box.y+box.h]]){if(Math.abs(d)<1e-9){if(v<min||v>max)return false;}else{const t1=(min-v)/d,t2=(max-v)/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}}return true;};
 for(const it of this.projected.filter(i=>i.kind==='text').sort((a,b)=>Number(b.style.badge)-Number(a.style.badge))){
 const maxWidth=Math.min(it.style.badge?200:180,this.w-32),lines=[],fonts=[];
 for(const [index,paragraph]of String(it.style.text).split('\n').entries()){
  const font=it.style.badge?(index===0?'500 13px sans-serif':'12px sans-serif'):'11px sans-serif';ctx.font=font;let line='';
  const push=()=>{lines.push(line);fonts.push(font);line=''};
  for(const token of paragraph.match(/[A-Za-z0-9?.–+/%-]+|\s+|[^\s]/gu)||['']){if(line&&ctx.measureText(line+token).width>maxWidth)push();if(ctx.measureText(token).width>maxWidth){for(const ch of token){if(line&&ctx.measureText(line+ch).width>maxWidth)push();line+=ch}}else line+=line?token:token.trimStart();}push();
 }
 const w=Math.max(...lines.map((l,i)=>{ctx.font=fonts[i];return ctx.measureText(l).width}))+12,h=lines.length*17+6,anchor=it.ps[0];let best=null;
 const consider=(cx,cy,dist)=>{const box={x:clamp(cx-w/2,8,Math.max(8,this.w-w-8)),y:clamp(cy-h/2,8,Math.max(8,this.h-h-8)),w,h},padded={x:box.x-4,y:box.y-4,w:w+8,h:h+8},leader=[anchor,{x:clamp(anchor.x,box.x,box.x+w),y:clamp(anchor.y,box.y,box.y+h)}];const conflicts=placed.filter(b=>overlap(padded,b)).length,occlusion=rays.filter(l=>crosses(padded,l)).length,objects=obstacles.filter(o=>overlap(padded,o)).length,leaderConflicts=placed.filter(b=>it.style.badge&&crosses(b,leader)||b.it.style.badge&&crosses(padded,b.leader)).length,score=conflicts*100000+occlusion*10000+objects*3000+leaderConflicts*12000+dist;if(!best||score<best.score)best={...box,score,anchor,lines,fonts,leader,it};};
 for(const radius of [28,48,72,100,140,190,250])for(let j=0;j<16;j++){const a=-Math.PI/2+j*Math.PI/8;consider(anchor.x+Math.cos(a)*radius,anchor.y+Math.sin(a)*radius,radius);}
 if(best.score>=3000)for(let y=20;y<this.h-20;y+=26)for(let x=20;x<this.w-20;x+=40)consider(x,y,Math.hypot(x-anchor.x,y-anchor.y));placed.push(best);
 }return placed;
 }
 paintLabels(){const ctx=this.ctx;this.labelLayout=this.labelLayout||this.layoutLabels();ctx.setLineDash([]);
 // Draw connectors first so they never paint over another label's text.
 for(const b of this.labelLayout){const [a,p]=b.leader;if(b.it.style.badge&&Math.hypot(p.x-a.x,p.y-a.y)>10){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(p.x,p.y);ctx.strokeStyle=this.style==='paper'?'#a1a6ad':'#777d99';ctx.lineWidth=.65;ctx.stroke();}}
 for(const b of this.labelLayout){const {it}=b;ctx.fillStyle=this.style==='paper'?'#ffffff':'#f5f6fceF';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.textAlign='center';b.lines.forEach((line,i)=>{ctx.font=b.fonts[i];ctx.fillStyle=i&&it.style.badge?'#46576c':this.style==='paper'?'#242735':it.style.color;ctx.fillText(line,b.x+b.w/2,b.y+16+i*17)});}}
 drawAxes(ctx){const a=this.axes(),base={x:52,y:this.h-50};ctx.font='bold 11px sans-serif';[[[1,0,0],'X','#bc3148'],[[0,1,0],'Y','#167f5e'],[[0,0,1],'Z','#2569b8']].forEach(([v,t,c])=>{const x=base.x+V.dot(v,a.u)*30,y=base.y-V.dot(v,a.v)*30;ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(x,y);ctx.strokeStyle=c;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=c;ctx.fillText(t,x+7,y-4)});ctx.font='11px sans-serif';ctx.fillStyle='#657a92';ctx.textAlign='left';ctx.fillText('正交三维 · mm',16,this.h-13)}
 pick(p){if(this.dirty)this.prepare();for(const kind of ['component','ray','board'])for(let i=this.projected.length-1;i>=0;i--){const it=this.projected[i];if(it.id?.kind!==kind||it.kind==='text')continue;if(it.kind==='poly'&&inside(p,it.ps))return it.id;if(it.kind==='line'&&segmentDistance(p,...it.ps)<6)return it.id}return null}
}
function captureDiagram(design){const canvas=root.document.createElement('canvas'),view=new BenchView(canvas,{animate:false,style:'paper'});view.resize(1200,800,2);view.showBoards=false;view.labels=false;view.showNames=true;view.showWavelengths=false;view.polarization=false;const trace=O.trace(design,root.OPTICAL_COMPONENTS);view.setScene(design,trace,new Set());const zs=design.components.map(c=>c.z||0);view.preset(Math.max(...zs)-Math.min(...zs)>10?'iso':'top');view.fit();view.paint(0);const points=view.projected.flatMap(i=>i.ps),boxes=view.labelLayout||[];const left=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x),...boxes.map(b=>b.x))-40)),top=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y),...boxes.map(b=>b.y))-40)),right=Math.min(view.w,Math.ceil(Math.max(...points.map(p=>p.x),...boxes.map(b=>b.x+b.w))+40)),bottom=Math.min(view.h,Math.ceil(Math.max(...points.map(p=>p.y),...boxes.map(b=>b.y+b.h))+40));const output=root.document.createElement('canvas');if(points.length&&right>left&&bottom>top){output.width=(right-left)*2;output.height=(bottom-top)*2;output.getContext('2d').drawImage(canvas,left*2,top*2,output.width,output.height,0,0,output.width,output.height);}else{output.width=canvas.width;output.height=canvas.height;output.getContext('2d').drawImage(canvas,0,0);}return{image:output.toDataURL('image/png'),traceWarnings:trace.warnings};}
root.captureOpticalDiagram=captureDiagram;
root.BenchView=BenchView;root.BenchBeamColor=color;if(typeof module!=='undefined')module.exports={BenchView,color,inside,segmentDistance};
})(typeof window!=='undefined'?window:globalThis);
