/* ==========================================================
   オープニング演出 Version 3「サンライズ」（約7.5秒・1回の訪問につき1度）
   企業カラーのオレンジの原点＝日の出（サンライズ）
   夜空と日本列島 → 地平線から日が昇る → 太陽の光からマーク → 社名 → 光が広がって開く
   ========================================================== */
(()=>{
const ov=document.getElementById('intro');if(!ov)return;
const root=document.documentElement;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const finish=()=>{try{sessionStorage.setItem('ma-intro','1')}catch(_){}root.classList.remove('intro-lock');ov.remove()};
if(reduced){finish();return}
root.classList.add('intro-lock');
const cv=ov.querySelector('canvas'),ctx=cv.getContext('2d');
const logo=ov.querySelector('.intro-logo'),nameEl=ov.querySelector('.intro-name'),tagEl=ov.querySelector('.intro-tag'),numEl=ov.querySelector('.intro-num'),numBox=ov.querySelector('.intro-count'),flash=ov.querySelector('.intro-flash'),stage=ov.querySelector('.intro-stage'),capEl=ov.querySelector('.intro-cap');
let W,H,mob;
const fit=()=>{const r=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;cv.width=W*r;cv.height=H*r;ctx.setTransform(r,0,0,r,0,0);mob=W<720};fit();addEventListener('resize',fit);
const rnd=(a,b)=>a+Math.random()*(b-a),ease=t=>1-Math.pow(1-t,3),easeIO=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,k)=>a.map((v,i)=>Math.round(v+(b[i]-v)*k));
const rgb=c=>`rgb(${c[0]},${c[1]},${c[2]})`;

/* 日本列島（0〜1の座標）と都市 */
const JP=[[[.86,.06],[.95,.12],[.92,.2],[.80,.17],[.82,.10]],
 [[.80,.24],[.83,.32],[.80,.40],[.76,.47],[.70,.52],[.62,.56],[.55,.59],[.47,.62],[.39,.65],[.33,.64]],
 [[.44,.70],[.52,.69],[.50,.73],[.43,.74]],[[.26,.67],[.33,.70],[.32,.78],[.25,.82],[.22,.74]],[[.10,.93],[.13,.96],[.08,.98]]];
const segs=[];JP.forEach(p=>{for(let i=0;i<p.length-1;i++)segs.push([p[i],p[i+1]]);if(p.length>3)segs.push([p.at(-1),p[0]])});
const CITY={札幌:[.87,.12],仙台:[.81,.34],東京:[.75,.47],名古屋:[.63,.55],大阪:[.55,.59],広島:[.42,.63],福岡:[.28,.70],那覇:[.10,.95]};
const box=()=>{const s=Math.min(W*(mob?.9:.5),H*.5);return{x:W/2-s*.52,y:H*.66-s*.55,s}};
const M=p=>{const b=box();return{x:b.x+p[0]*b.s,y:b.y+p[1]*b.s}};
const DOTS=Array.from({length:mob?380:760},()=>{const [a,b]=segs[Math.floor(Math.random()*segs.length)],t=Math.random();return{m:[a[0]+(b[0]-a[0])*t+rnd(-.022,.022),a[1]+(b[1]-a[1])*t+rnd(-.02,.02)],d:rnd(0,.8),tw:rnd(0,6.28)}});
const STARS=Array.from({length:mob?120:240},()=>({x:Math.random(),y:Math.random()*.7,r:rnd(.4,1.5),tw:rnd(0,6.28)}));
let sparks=[],rings=[],arcs=[];
const t0=performance.now();let last=t0,ended=false,bang=false,fired=false,flew=false,opened=false,sunEnd=null;

nameEl.innerHTML=[...nameEl.dataset.text].map((c,i)=>`<span style="--i:${i}">${c}</span>`).join('');
const tag=tagEl.dataset.text;
const skip=()=>{if(ended)return;ended=true;ov.classList.add('skip');setTimeout(finish,500)};
ov.querySelector('.intro-skip').addEventListener('click',e=>{e.stopPropagation();skip()});
ov.addEventListener('click',skip);addEventListener('keydown',e=>{if(['Escape','Enter',' '].includes(e.key))skip()},{once:true});

// 空の色（夜 → 夜明け前の紫 → 朝焼けのオレンジ）
const SKY_TOP=[[2,6,12],[20,16,48],[58,30,62]],SKY_HZ=[[6,12,24],[120,48,70],[255,140,50]];
const sky=d=>d<.5?[mix(SKY_TOP[0],SKY_TOP[1],d*2),mix(SKY_HZ[0],SKY_HZ[1],d*2)]:[mix(SKY_TOP[1],SKY_TOP[2],(d-.5)*2),mix(SKY_HZ[1],SKY_HZ[2],(d-.5)*2)];

const frame=now=>{if(!ov.isConnected)return;const t=(now-t0)/1000,dt=Math.min(4,Math.max(1,(now-last)/16.7));last=now;
  const HZ=H*.72;                                   // 地平線の高さ
  const dawn=clamp((t-1.3)/2.4);                    // 夜明けの進み具合
  // 太陽の位置：地平線の下 → マークの位置まで昇る
  if(!sunEnd){const r=logo.getBoundingClientRect();sunEnd={x:r.left+r.width/2,y:r.top+r.height*.55}}
  const rise=easeIO(clamp((t-1.6)/2.3));
  const sx=W/2+(sunEnd.x-W/2)*rise,sy=H*.86+(sunEnd.y-H*.86)*rise,SR=Math.min(W,H)*(mob?.13:.1)*(1+rise*.25);

  /* 空 */
  ctx.globalCompositeOperation='source-over';
  const [top,hz]=sky(dawn);const g=ctx.createLinearGradient(0,0,0,HZ);g.addColorStop(0,rgb(top));g.addColorStop(1,rgb(hz));ctx.fillStyle=g;ctx.fillRect(0,0,W,HZ);
  const g2=ctx.createLinearGradient(0,HZ,0,H);g2.addColorStop(0,rgb(mix(hz,[10,8,14],.55)));g2.addColorStop(1,'#030508');ctx.fillStyle=g2;ctx.fillRect(0,HZ,W,H-HZ);
  ctx.globalCompositeOperation='lighter';
  /* 星（夜明けとともに消える） */
  STARS.forEach(s=>{const a=(1-dawn*1.4)*(.5+.5*Math.sin(s.tw+t*3));if(a<=0)return;ctx.globalAlpha=a;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x*W,s.y*HZ,s.r,0,6.283);ctx.fill()});ctx.globalAlpha=1;

  /* 太陽：光芒・光の輪・本体 */
  if(t>1.4){const vis=clamp((t-1.4)/.6);
    // 光芒（ゆっくり回る光の筋）
    ctx.save();ctx.translate(sx,sy);ctx.rotate(t*.18);const L=Math.hypot(W,H);
    for(let i=0;i<18;i++){ctx.rotate(6.283/18);const gg=ctx.createLinearGradient(0,0,0,-L);gg.addColorStop(0,`rgba(255,190,110,${.22*vis*dawn})`);gg.addColorStop(1,'rgba(255,150,60,0)');ctx.fillStyle=gg;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-L*.045,-L);ctx.lineTo(L*.045,-L);ctx.fill()}ctx.restore();
    // 大きな光のにじみ
    const hg=ctx.createRadialGradient(sx,sy,SR*.5,sx,sy,SR*6);hg.addColorStop(0,`rgba(255,170,80,${.55*vis})`);hg.addColorStop(.4,`rgba(255,110,30,${.22*vis})`);hg.addColorStop(1,'rgba(255,90,20,0)');ctx.fillStyle=hg;ctx.fillRect(0,0,W,H);
    // 太陽本体（地平線より下は隠す）
    ctx.save();if(rise<.35){ctx.beginPath();ctx.rect(0,0,W,HZ);ctx.clip()}
    const sg=ctx.createRadialGradient(sx,sy,0,sx,sy,SR);sg.addColorStop(0,'#fffef5');sg.addColorStop(.45,'#ffe2a0');sg.addColorStop(.8,'#ffa040');sg.addColorStop(1,'rgba(255,122,26,.0)');
    ctx.globalAlpha=vis;ctx.fillStyle=sg;ctx.beginPath();ctx.arc(sx,sy,SR*1.08,0,6.283);ctx.fill();ctx.restore();ctx.globalAlpha=1;
  }
  /* 地平線の光の線 */
  {const a=clamp((t-.6)/.6)*(1-clamp((t-4.2)/.6));if(a>0){const lg=ctx.createLinearGradient(0,0,W,0);lg.addColorStop(0,'rgba(255,160,70,0)');lg.addColorStop(.5,`rgba(255,220,160,${.95*a})`);lg.addColorStop(1,'rgba(255,160,70,0)');ctx.fillStyle=lg;ctx.fillRect(0,HZ-1,W,2);
    const bl=ctx.createRadialGradient(W/2,HZ,0,W/2,HZ,W*.45);bl.addColorStop(0,`rgba(255,140,50,${(.15+dawn*.35)*a})`);bl.addColorStop(1,'rgba(255,140,50,0)');ctx.fillStyle=bl;ctx.fillRect(0,0,W,H)}}

  /* 日本列島：夜は光る点、朝日を浴びて輪郭が金色に */
  const isl=1-clamp((t-3.7)/.5);
  if(isl>0){ctx.globalCompositeOperation='source-over';
    DOTS.forEach(p=>{const q=M(p.m),ap=clamp((t-.2-p.d*.6)/.5)*isl;if(ap<=0)return;const night=1-dawn;
      ctx.globalAlpha=ap;ctx.fillStyle=night>.5?`rgba(255,${180+Math.sin(p.tw+t*4)*40|0},110,1)`:`rgba(${Math.round(30+225*dawn)},${Math.round(20+120*dawn)},${Math.round(40+20*dawn)},1)`;
      ctx.fillRect(q.x-1,q.y-1,mob?1.8:2.2,mob?1.8:2.2)});ctx.globalAlpha=1;ctx.globalCompositeOperation='lighter';
    if(!fired&&t>.9){fired=true;const o=M(CITY.大阪);rings.push({x:o.x,y:o.y,t:0,c:'#ffb45c',w:3,max:Math.max(W,H)*.35});Object.entries(CITY).forEach(([n,p],i)=>{if(n!=='大阪')arcs.push({n,a:CITY.大阪,b:p,d:.07*i})});capEl.classList.add('on');numBox.classList.add('on')}
    arcs.forEach(a=>{const k=clamp((t-1.0-a.d)/.55);if(k<=0)return;const A=M(a.a),B=M(a.b),mx=(A.x+B.x)/2,my=(A.y+B.y)/2-Math.hypot(B.x-A.x,B.y-A.y)*.35;
      ctx.globalAlpha=isl;ctx.strokeStyle='rgba(255,190,110,.85)';ctx.lineWidth=1.8;ctx.beginPath();for(let s=0;s<=k;s+=.04){const u=1-s,x=u*u*A.x+2*u*s*mx+s*s*B.x,y=u*u*A.y+2*u*s*my+s*s*B.y;s?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();
      if(k>=1){if(!a.hit){a.hit=1;rings.push({x:B.x,y:B.y,t:0,c:'#ffe2b8',w:2,max:50})}ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(B.x,B.y,2.6,0,6.283);ctx.fill();ctx.fillStyle='rgba(255,236,210,.95)';ctx.font=`700 ${mob?10:12}px "Noto Sans JP",sans-serif`;ctx.textAlign='center';ctx.fillText(a.n,B.x,B.y-9)}ctx.globalAlpha=1});
    const o=M(CITY.大阪);const og=ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,40);og.addColorStop(0,`rgba(255,255,255,${.9*isl})`);og.addColorStop(.3,`rgba(255,150,60,${.6*isl})`);og.addColorStop(1,'rgba(255,122,26,0)');ctx.fillStyle=og;ctx.beginPath();ctx.arc(o.x,o.y,40,0,6.283);ctx.fill();
    ctx.globalAlpha=isl;ctx.fillStyle='#fff';ctx.font=`800 ${mob?12:14}px "Noto Sans JP",sans-serif`;ctx.textAlign='center';ctx.fillText('大阪',o.x,o.y+22);ctx.globalAlpha=1;
    numEl.textContent=Math.round(5000*ease(clamp((t-.9)/1.8))).toLocaleString();
  }
  if(t>3.6){numBox.classList.remove('on');capEl.classList.remove('on')}
  if(t>2.2)capEl.textContent='夜明けとともに、全国へ。';

  /* 太陽が昇りきる → 閃光・衝撃波・火の粉・マーク */
  if(!bang&&t>=3.95){bang=true;flash.classList.add('go');stage.classList.add('shake');logo.classList.add('in');
    for(let i=0;i<3;i++)rings.push({x:sx,y:sy,t:-i*.12,c:i?'#ffb45c':'#ffffff',w:6-i*1.5,max:Math.max(W,H)*.9});
    for(let i=0;i<(mob?200:380);i++){const a=rnd(0,6.283),v=rnd(2,mob?10:15);sparks.push({x:sx,y:sy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:1,c:['#ff7a1a','#ffb45c','#ffe2b8','#ffffff'][i%4],s:rnd(1,2.6)})}}
  if(t>4.3&&!nameEl.classList.contains('in'))nameEl.classList.add('in');
  if(t>4.95&&!tagEl.dataset.on){tagEl.dataset.on=1;let i=0;const ty=()=>{tagEl.textContent=tag.slice(0,++i);if(i<tag.length)setTimeout(ty,45)};ty()}

  rings=rings.filter(r=>{r.t+=.016*dt;if(r.t<0)return true;const k=ease(clamp(r.t/.9));ctx.strokeStyle=r.c;ctx.globalAlpha=1-k;ctx.lineWidth=r.w*(1-k)+.5;ctx.beginPath();ctx.arc(r.x,r.y,k*r.max,0,6.283);ctx.stroke();ctx.globalAlpha=1;return r.t<.9});
  sparks=sparks.filter(s=>{for(let q=0;q<Math.round(dt);q++){s.vx*=.965;s.vy=s.vy*.965+.05;s.x+=s.vx;s.y+=s.vy;s.l-=.01}ctx.globalAlpha=Math.max(0,s.l);ctx.fillStyle=s.c;ctx.beginPath();ctx.arc(s.x,s.y,s.s,0,6.283);ctx.fill();ctx.globalAlpha=s.l*.25;ctx.beginPath();ctx.arc(s.x,s.y,s.s*3.5,0,6.283);ctx.fill();ctx.globalAlpha=1;return s.l>0});

  /* マークがヘッダーへ飛び、太陽の位置から光が広がって開く */
  if(!flew&&t>6.4){flew=true;const hb=document.querySelector('.site-header .brand-mark');const lr=logo.getBoundingClientRect();
    if(hb){const r=hb.getBoundingClientRect();logo.style.setProperty('--fx',(r.left+r.width/2-(lr.left+lr.width/2))+'px');logo.style.setProperty('--fy',(r.top+r.height/2-(lr.top+lr.height/2))+'px');logo.style.setProperty('--fs',(r.width/lr.width).toFixed(3))}
    logo.classList.add('fly');ov.classList.add('closing');ov.style.setProperty('--hx',sx+'px');ov.style.setProperty('--hy',sy+'px')}
  if(t>6.6){const k=clamp((t-6.6)/.9);ov.style.setProperty('--hole',(k*k*Math.hypot(W,H)*1.05)+'px');if(!opened){opened=true;ov.classList.add('open')}}
  if(t>7.6&&!ended){ended=true;finish();return}
  requestAnimationFrame(frame)};
requestAnimationFrame(frame);
setTimeout(()=>{if(!ended){ended=true;finish()}},10000);
})();
