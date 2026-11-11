/* Offline spreadsheet and fitting primitives. Formula parser never executes JS. */
(function(root){'use strict';
const MAX_CELLS=200000,MAX_BYTES=10*1024*1024;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function number(s){s=String(s??'').trim();if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return null;const v=Number(s);return Number.isFinite(v)?v:null}
function transpose(rows){const w=rows.reduce((m,r)=>Math.max(m,r.length),0);if(w*rows.length>MAX_CELLS)throw Error('矩形数据区超过 200,000 单元格');return Array.from({length:w},(_,i)=>rows.map(r=>String(r[i]??'')))}
function parseGrid(text,opts={}){
 text=String(text).replace(/^\uFEFF/,'');if(new TextEncoder().encode(text).length>MAX_BYTES)throw Error('文件超过 10 MB');
 const skip=Number(opts.skip||0);if(!Number.isInteger(skip)||skip<0)throw Error('跳过行数须为非负整数');
 text=text.split(/\r\n|\r|\n/).slice(skip).join('\n');let sep=opts.delimiter||'auto';
 if(sep==='auto'){const first=text.split('\n').find(s=>s.trim()&&!s.trim().startsWith('#'))||'';sep=first.includes('\t')?'tab':first.includes(';')?'semicolon':first.includes(',')?'comma':'space'}
 let rows=[];
 if(sep==='space')rows=text.split('\n').filter(s=>s.trim()&&!s.trim().startsWith('#')).map(s=>s.trim().split(/\s+/));
 else{const delim={tab:'\t',comma:',',semicolon:';'}[sep];if(!delim)throw Error('未知分隔符');let r=[],v='',quoted=false,count=0;
 const push=()=>{r.push(v);v='';if(++count>MAX_CELLS)throw Error('数据超过 200,000 单元格')};
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){v+='"';i++}else if(quoted||v==='')quoted=!quoted;else v+=c}else if(c===delim&&!quoted)push();else if(c==='\n'&&!quoted){push();if(r.some(x=>x.trim())&&!r[0].trim().startsWith('#'))rows.push(r);r=[]}else v+=c}
 if(quoted)throw Error('引号未闭合');if(v||r.length){push();if(r.some(x=>x.trim())&&!r[0].trim().startsWith('#'))rows.push(r)}
 }
 if(!rows.length)throw Error('没有可读取的数据');
 if(opts.transpose)rows=transpose(rows);
 const width=rows.reduce((m,r)=>Math.max(m,r.length),0);if(width*rows.length>MAX_CELLS)throw Error('矩形数据区超过 200,000 单元格');
 const header=opts.header!==false,heads=header?rows.shift():[];
 return{headers:Array.from({length:width},(_,i)=>heads[i]||'列 '+(i+1)),rows:rows.map(r=>Array.from({length:width},(_,i)=>r[i]??'')),delimiter:sep};
}
function serializeGrid(headers,rows){const q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';return[headers,...rows].map(r=>r.map(q).join('\t')).join('\n')}
function series(grid,x,y){x=Number(x);y=Number(y);if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=grid.headers.length||y>=grid.headers.length)throw Error('请选择有效 X、Y 列');const points=[],rejected=[];grid.rows.forEach((r,i)=>{const a=number(r[x]),b=number(r[y]);if(a===null||b===null)rejected.push({row:i+1,reason:'空值或非数值'});else points.push({x:a,y:b,row:i+1})});if(!points.length)throw Error('所选列没有数值点');return{points,rejected,total:grid.rows.length}}

// Recursive descent: arithmetic, powers, named parameters and whitelisted unary functions only.
const funcs={sin:Math.sin,cos:Math.cos,tan:Math.tan,exp:Math.exp,log:Math.log,ln:Math.log,sqrt:Math.sqrt,abs:Math.abs,sind:x=>Math.sin(x*Math.PI/180),cosd:x=>Math.cos(x*Math.PI/180)};
function expression(source,params){
 source=String(source);if(source.length>500)throw Error('公式最多 500 字符');const tokens=[];const re=/\s*(?:(\d+(?:\.\d*)?|\.\d+)([eE][+-]?\d+)?|([A-Za-z_][A-Za-z_0-9]*)|(\*\*|[+\-*/^(),]))/gy;let pos=0,m;
 while(pos<source.length){if(!source.slice(pos).trim())break;re.lastIndex=pos;m=re.exec(source);if(!m)throw Error('公式含不支持的字符，位置 '+(pos+1));tokens.push(m[1]?{n:Number(m[1]+(m[2]||''))}:{v:m[3]||m[4]});pos=re.lastIndex}
 if(tokens.length>250)throw Error('公式过长');let i=0,depth=0;const peek=v=>tokens[i]?.v===v,take=()=>tokens[i++],expect=v=>{if(!peek(v))throw Error('公式缺少 '+v);i++};
 function atom(){if(++depth>40)throw Error('公式嵌套过深');let f;const t=take();if(!t)throw Error('公式不完整');if(t.n!==undefined)f=()=>t.n;else if(t.v==='('){f=sum();expect(')')}else if(Object.hasOwn(funcs,t.v)){expect('(');const a=sum();expect(')');f=(x,p)=>funcs[t.v](a(x,p))}else if(t.v==='x')f=x=>x;else if(t.v==='pi')f=()=>Math.PI;else if(t.v==='e')f=()=>Math.E;else if(params.includes(t.v))f=(x,p)=>p[t.v];else throw Error('未知变量或函数：'+t.v);depth--;return f}
 function power(){let a=atom();if(peek('^')||peek('**')){i++;const b=unary(),prev=a;a=(x,p)=>prev(x,p)**b(x,p)}return a}
 function unary(){if(peek('+')){i++;return unary()}if(peek('-')){i++;const a=unary();return(x,p)=>-a(x,p)}return power()}
 function product(){let a=unary();while(peek('*')||peek('/')){const op=take().v,b=unary(),prev=a;a=op==='*'?(x,p)=>prev(x,p)*b(x,p):(x,p)=>prev(x,p)/b(x,p)}return a}
 function sum(){let a=product();while(peek('+')||peek('-')){const op=take().v,b=product(),prev=a;a=op==='+'?(x,p)=>prev(x,p)+b(x,p):(x,p)=>prev(x,p)-b(x,p)}return a}
 const fn=sum();if(i!==tokens.length)throw Error('公式含多余内容');return fn;
}
function solve(a,b,tolerance=1e-20){const n=b.length,m=a.map((r,i)=>[...r,b[i]]);for(let k=0;k<n;k++){let j=k;for(let i=k+1;i<n;i++)if(Math.abs(m[i][k])>Math.abs(m[j][k]))j=i;if(Math.abs(m[j][k])<tolerance)return null;[m[k],m[j]]=[m[j],m[k]];const d=m[k][k];for(let q=k;q<=n;q++)m[k][q]/=d;for(let i=0;i<n;i++)if(i!==k){const v=m[i][k];for(let q=k;q<=n;q++)m[i][q]-=v*m[k][q]}}return m.map(r=>r[n])}
function fit(points,equation,initial){
 if(!initial||typeof initial!=='object'||Array.isArray(initial))throw Error('参数初值须为对象，例如 {"a":1,"b":0}');const names=Object.keys(initial);
 if(!names.length||names.length>8||names.some(n=>!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(n)||['x','pi','e',...Object.keys(funcs)].includes(n)))throw Error('需要 1–8 个合法参数名，不能使用 x、pi 或函数名');
 if(points.length<=names.length)throw Error('有效点数必须大于待拟合参数数目');if(points.length>20000)throw Error('拟合最多 20,000 点，请先选取或降采样');
 if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('拟合数据含非有限数');if(new Set(points.map(p=>p.x)).size<=names.length)throw Error('不同 X 点太少，无法可靠拟合');
 let p={...initial};if(names.some(n=>typeof p[n]!=='number'||!Number.isFinite(p[n])))throw Error('参数初值必须为有限数值');
 const fn=expression(equation,names),pred=q=>points.map(t=>fn(t.x,q)),score=y=>y.reduce((s,v,i)=>s+(points[i].y-v)**2,0);
 let ys=pred(p),sse=score(ys);if(!Number.isFinite(sse))throw Error('初值使公式出现无穷或非实数');let lambda=.001,converged=false,iterations=0,lastA=null;
 const yEnergy=points.reduce((s,t)=>s+t.y*t.y,0),tol=1e-12*Math.max(yEnergy,1e-24);
 for(;iterations<150;iterations++){
  const jac=names.map(n=>{const h=1e-5*Math.max(Math.abs(p[n]),1e-3),plus=pred({...p,[n]:p[n]+h}),minus=pred({...p,[n]:p[n]-h});return plus.map((v,i)=>(v-minus[i])/(2*h))});
  if(jac.some(col=>col.some(v=>!Number.isFinite(v))))throw Error('公式导数非有限，调整初值或公式');
  const a=names.map((_,j)=>names.map((_,k)=>jac[j].reduce((s,v,i)=>s+v*jac[k][i],0))),b=names.map((_,j)=>jac[j].reduce((s,v,i)=>s+v*(points[i].y-ys[i]),0));lastA=a;
  if(sse<=tol){converged=true;break}
  const mat=a.map((r,j)=>r.map((v,k)=>v+(j===k?lambda*Math.max(a[j][j],1e-20):0))),delta=solve(mat,b);if(!delta)throw Error('参数无法辨识，尝试更简单的公式');
  const trial={...p};names.forEach((n,j)=>trial[n]+=delta[j]);const yy=pred(trial),ss=score(yy);
  if(Number.isFinite(ss)&&ss<sse){const improvement=sse-ss;p=trial;ys=yy;sse=ss;lambda=Math.max(1e-12,lambda/3);if(improvement<tol||delta.every((d,j)=>Math.abs(d)<1e-8*(Math.abs(p[names[j]])+1e-6))){converged=true;break}}
  else{lambda*=10;if(lambda>1e16)break}
 }
 // Rank check on normalized normal matrix catches redundant / insensitive parameters.
 if(lastA){const scales=lastA.map((r,i)=>Math.sqrt(r[i]));if(scales.some(x=>!Number.isFinite(x)||x<1e-14))throw Error('有参数对数据无影响，无法辨识');const corr=lastA.map((r,j)=>r.map((v,k)=>v/scales[j]/scales[k]));if(!solve(corr,Array(names.length).fill(1),1e-8))throw Error('参数相互冗余，无法唯一拟合')}
 const mean=points.reduce((s,t)=>s+t.y,0)/points.length,sst=points.reduce((s,t)=>s+(t.y-mean)**2,0);
 return{params:p,SSE:sse,RMSE:Math.sqrt(sse/points.length),r2:sst>0?1-sse/sst:null,converged,iterations:iterations+1,equation,predictions:points.map((t,i)=>({x:t.x,y:ys[i]})),warning:converged?'局部最小二乘结果；请检查初值、残差与物理模型。':'未收敛；请调整初值或公式，勿视为有效拟合。'};
}
function plot(points,opts={},fitResult){
 if(!points?.length)return'<p>没有数据。</p>';const kind=opts.kind||'line',polar=kind==='polar',stride=Math.max(1,Math.ceil(points.length/2500)),display=points.filter((_,i)=>i%stride===0||i===points.length-1);
 let fitPts=fitResult?.predictions||[];
 if(fitResult?.equation&&fitResult?.params){try{const fn=expression(fitResult.equation,Object.keys(fitResult.params)),lo=points.reduce((a,p)=>Math.min(a,p.x),Infinity),hi=points.reduce((a,p)=>Math.max(a,p.x),-Infinity);const dense=Array.from({length:361},(_,i)=>{const x=lo+(hi-lo)*i/360;return{x,y:fn(x,fitResult.params)}});if(dense.every(p=>Number.isFinite(p.y)))fitPts=dense}catch{}}
 const all=[...points,...fitPts],W=760,H=420;let body='',coords;
 if(polar){if(all.some(p=>p.y<0))return'<p>极坐标图要求半径 Y ≥ 0；负值请处理后再绘制，不会自动取绝对值。</p>';const max=all.reduce((m,p)=>Math.max(m,p.y),0)||1,cx=380,cy=210,R=155;
  for(let j=1;j<=4;j++)body+='<circle cx="380" cy="210" r="'+R*j/4+'" fill="none" stroke="#cbdbe2"/><text x="385" y="'+(210-R*j/4)+'" font-size="11" fill="#607480">'+(max*j/4).toPrecision(3)+'</text>';
  for(let deg=0;deg<360;deg+=45){const a=deg*Math.PI/180;body+='<path d="M380 210L'+(cx+R*Math.cos(a))+' '+(cy-R*Math.sin(a))+'" stroke="#dce6ea"/><text text-anchor="middle" x="'+(cx+(R+24)*Math.cos(a))+'" y="'+(cy-(R+24)*Math.sin(a)+4)+'" font-size="12">'+deg+'°</text>'}
  coords=p=>{const a=opts.angleUnit==='rad'?p.x:p.x*Math.PI/180;return[cx+R*(p.y/max)*Math.cos(a),cy-R*(p.y/max)*Math.sin(a)]};
 }else{
  const minX=all.reduce((m,p)=>Math.min(m,p.x),Infinity),maxX=all.reduce((m,p)=>Math.max(m,p.x),-Infinity),minY=all.reduce((m,p)=>Math.min(m,p.y),Infinity),maxY=all.reduce((m,p)=>Math.max(m,p.y),-Infinity),dx=maxX-minX||1,dy=maxY-minY||1;
  coords=p=>[65+(p.x-minX)/dx*650,350-(p.y-minY)/dy*290];body='<path d="M65 40V350H720" fill="none" stroke="#78939f"/>';
  for(let j=0;j<=4;j++)body+='<text x="'+(65+650*j/4)+'" y="375" font-size="11" text-anchor="middle">'+(minX+dx*j/4).toPrecision(3)+'</text><text x="58" y="'+(354-290*j/4)+'" font-size="11" text-anchor="end">'+(minY+dy*j/4).toPrecision(3)+'</text>';
 }
 const poly=(pts,color,dash='')=>'<polyline fill="none" stroke="'+color+'" stroke-width="1.8" stroke-dasharray="'+dash+'" points="'+pts.map(p=>coords(p).join(',')).join(' ')+'"/>';
 if(kind!=='scatter')body+=poly(display,'#087f83');body+=display.map(p=>{const [x,y]=coords(p);return'<circle cx="'+x+'" cy="'+y+'" r="2.3" fill="#087f83"><title>'+esc(p.x)+', '+esc(p.y)+'</title></circle>'}).join('');if(fitPts.length)body+=poly([...fitPts].sort((a,b)=>a.x-b.x),'#c26521','5 3');
 return'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+(polar?'极坐标':'数据')+'图"><rect width="760" height="420" fill="white"/><g fill="#365465">'+body+'<text x="380" y="409" text-anchor="middle" font-size="13">'+esc(opts.xLabel||'X')+(polar?' · 角度 '+(opts.angleUnit==='rad'?'rad':'deg'):'')+'</text><text x="65" y="22" font-size="13">'+esc(opts.yLabel||'Y')+'</text></g></svg>';
}
const api={parseGrid,serializeGrid,transpose,series,plot,fit,expression,number,esc,MAX_CELLS,MAX_BYTES};root.DataWorkbenchCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
