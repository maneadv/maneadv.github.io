/* ==========================================================
   オープニング Version 8「夜明け」（約19秒・音付き）
   0.8s  地平線の先に小さなオレンジの点
   1.0s  あらゆる方向から光の粒子が集まる
   4.2s  弾け飛んでホワイトアウト
   4.9s  渦を巻いてブラックアウト
   6.8s  宇宙 → 地球 → 日本 → 大阪へズームイン
  11.4s  大阪・夜のオフィス街 → 夜が明けていく
  13.0s  「始まりは、夜明けから。」
  15.8s  「経営の相談に、確かな解決策を。」どーん！
  18.3s  幕が開いてトップページへ
   画面の動きはすべて「時刻 T の関数」として描く（音の再生位置に合わせて進む）
   ========================================================== */
(()=>{
const ov=document.getElementById('intro');if(!ov)return;
const root=document.documentElement;
let ended=false,started=false,withMusic=false,raf=0;
const bgm=window.maBgm;
const base=ov.dataset.base||'assets/';
const au=new Audio();au.preload='auto';
au.src=base+(au.canPlayType('audio/ogg; codecs="opus"')?'intro-sound.ogg':'intro-sound.mp3');
const heroV=document.querySelector('.hero-video');
const fadeAudio=(a,ms,done)=>{const v0=a.volume,st=performance.now();const f=()=>{const k=Math.min(1,(performance.now()-st)/ms);a.volume=v0*(1-k);if(k<1)requestAnimationFrame(f);else{a.pause();done&&done()}};f()};
const finish=()=>{
  try{sessionStorage.setItem('ma-intro','1')}catch(_){}
  cancelAnimationFrame(raf);root.classList.remove('intro-lock');ov.remove();
  if(!au.paused)fadeAudio(au,1800);
  if(withMusic&&bgm)bgm.play(true);
  if(heroV)heroV.play().catch(()=>{});
};
if(matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return}
root.classList.add('intro-lock');
if(heroV){heroV.pause();heroV.removeAttribute('autoplay')}

/* ---------- 道具 ---------- */
const cl=(v,a=0,b=1)=>v<a?a:v>b?b:v;
const seg=(t,a,b)=>cl((t-a)/(b-a));
const lerp=(a,b,k)=>a+(b-a)*k;
const eio=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
const eo=k=>1-Math.pow(1-k,3);
const RAD=Math.PI/180;
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};

/* ---------- 画面 ---------- */
const cv=ov.querySelector('.op-cv'),ctx=cv.getContext('2d');
const night=ov.querySelector('.op-night'),vid=ov.querySelector('.op-city'),dawn=ov.querySelector('.op-dawn'),white=ov.querySelector('.op-white');
let W=0,H=0,M=0,X=0,DPR=1;
const resize=()=>{DPR=Math.min(devicePixelRatio||1,innerWidth<700?1.25:1.5);W=innerWidth;H=innerHeight;M=Math.min(W,H);X=Math.max(W,H);cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR)};
resize();addEventListener('resize',resize);
const small=()=>W<700;

/* ---------- 粒子（すべて初期値だけ持ち、位置は時刻から計算） ---------- */
const NG=matchMedia('(max-width:700px)').matches?420:900;
const G=[];for(let i=0;i<NG;i++){const a=rnd()*Math.PI*2,d=.65+rnd()*.9,off=(rnd()-.5)*2.0;G.push({a,d,off,t0:1.0+Math.pow(i/NG,.85)*2.7+rnd()*.15,du:.75+rnd()*.7,c:rnd()})}
const NB=NG+300;const B=[];for(let i=0;i<NB;i++){B.push({a:rnd()*Math.PI*2,v:.35+Math.pow(rnd(),1.6)*2.2,k:1.6+rnd()*2.5,c:rnd(),w:.6+rnd()*1.6})}
const NS=matchMedia('(max-width:700px)').matches?360:700;
const S=[];for(let i=0;i<NS;i++){S.push({r:.04+Math.pow(rnd(),.7)*.8,a:rnd()*Math.PI*2,sp:.7+rnd()*.8,c:rnd()})}
const NST=420;const ST=[];for(let i=0;i<NST;i++){ST.push({x:(rnd()*2-1),y:(rnd()*2-1),z:rnd(),m:rnd()})}
const NF=360;const F=[];for(let i=0;i<NF;i++){F.push({a:rnd()*Math.PI*2,v:.3+Math.pow(rnd(),1.4)*1.9,k:2+rnd()*2,c:rnd()})}
const col=(c,al)=>c<.45?`rgba(255,${150+Math.round(c*120)},${60+Math.round(c*80)},${al})`:c<.8?`rgba(255,214,150,${al})`:`rgba(255,250,235,${al})`;

/* ---------- 地図の点 ---------- */
{const port=innerHeight>innerWidth*1.05,ext=vid.canPlayType('video/webm; codecs="vp9"')?'webm':'mp4';vid.src=base+'osaka-dawn-'+(port?'p':'l')+'.'+ext;vid.load()}
let geo=null;
fetch(base+'intro-geo.json').then(r=>r.json()).then(d=>{
  const mk=(L,sp)=>{const n=L.b.length,buckets=[];for(let b=0;b<10;b++)buckets.push([]);
    for(let i=0;i<n;i++)buckets[L.b[i]].push(i);
    return buckets.map(ix=>{const m=ix.length,sl=new Float32Array(m),c=new Float32Array(m),lo=new Float32Array(m);
      ix.forEach((i,j)=>{const la=L.la[i]/L.s*RAD;sl[j]=Math.sin(la);c[j]=Math.cos(la);lo[j]=L.lo[i]/L.s*RAD});return {sl,c,lo,n:m}}).concat([{sp}])};
  geo={w:mk(d.w,.025),j:mk(d.j,.08*RAD*0.95),o:mk(d.o,.012*RAD*0.95)};
}).catch(()=>{});
const PAL=[];for(let b=0;b<10;b++){const k=b/9;PAL.push(`rgb(${Math.round(lerp(150,255,k))},${Math.round(lerp(92,236,k))},${Math.round(lerp(48,200,k))})`)}
const OS={la:34.69*RAD,lo:135.50*RAD};
// カメラ：中心の緯度経度と地球の半径（画面上のピクセル）
const cam=T=>{
  const k=eio(seg(T,7.0,10.6));
  const la=lerp(14*RAD,OS.la,k),lo=lerp(40*RAD,OS.lo,k);
  const r0=Math.log(.27*M),r1=Math.log(.33*M),r2=Math.log(70*X);
  let lr=T<8.4?lerp(r0,r1,seg(T,6.8,8.4)):lerp(r1,r2,Math.pow(eio(seg(T,8.4,11.55)),1.15));
  return {la,lo,R:Math.exp(lr),lr};
};
const drawLayer=(L,alpha,c,size)=>{
  if(alpha<=0.01)return;const s0=Math.sin(c.la),c0=Math.cos(c.la),cx=W/2,cy=H/2,R=c.R,h=size/2;
  const round=size>2.2;
  for(let b=0;b<10;b++){const P=L[b];if(!P.n)continue;ctx.fillStyle=PAL[b];
    for(let g2=0;g2<(round?3:1);g2++){
    ctx.globalAlpha=alpha*(.32+.68*b/9)*(round?(.78+.22*Math.sin(curT*(4+g2*1.7)+b*1.3+g2*2.1)):1);
    if(round)ctx.beginPath();
    for(let i=g2;i<P.n;i+=(round?3:1)){const dl=P.lo[i]-c.lo,cd=Math.cos(dl),cc=P.c[i];
      if(s0*P.sl[i]+c0*cc*cd<0)continue;
      const x=cx+R*cc*Math.sin(dl);if(x<-8||x>W+8)continue;
      const y=cy-R*(c0*P.sl[i]-s0*cc*cd);if(y<-8||y>H+8)continue;
      if(round){ctx.moveTo(x+h,y);ctx.arc(x,y,h,0,6.283)}else ctx.fillRect(x-h,y-h,size,size)}
    if(round)ctx.fill()}}
  ctx.globalAlpha=1;
};
const proj=(c,la,lo)=>{const s0=Math.sin(c.la),c0=Math.cos(c.la),dl=lo-c.lo;return {x:W/2+c.R*Math.cos(la)*Math.sin(dl),y:H/2-c.R*(c0*Math.sin(la)-s0*Math.cos(la)*Math.cos(dl))}};

/* ---------- 描画 ---------- */
const HY=()=>H*.56;
let curT=0;
function frame(T){
  curT=T;
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  ctx.clearRect(0,0,W,H);
  const cx=W/2,cy=HY();
  /* A: 地平線・オレンジの点・集まる粒子 */
  if(T<4.5){
    ctx.fillStyle='#020306';ctx.fillRect(0,0,W,H);
    const lw=eo(seg(T,.15,1.3))*Math.min(W*.9,1200),la=1-seg(T,3.9,4.2);
    if(lw>0){const g=ctx.createLinearGradient(cx-lw/2,0,cx+lw/2,0);g.addColorStop(0,'rgba(233,199,143,0)');g.addColorStop(.5,`rgba(233,199,143,${.85*la})`);g.addColorStop(1,'rgba(233,199,143,0)');ctx.fillStyle=g;ctx.fillRect(cx-lw/2,cy-.5,lw,1)}
    let arrived=0;ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
    const paths=[];for(let q=0;q<12;q++)paths.push(new Path2D());
    for(const p of G){const u=(T-p.t0)/p.du;if(u<0)continue;if(u>=1){arrived++;continue}
      const sx=cx+Math.cos(p.a)*p.d*X,sy=cy+Math.sin(p.a)*p.d*X;
      const tw=(1.6+Math.abs(p.off)*1.6)*(p.off<0?-1:1);
      const pt=v=>{const e=v*v*(3-2*v),r=p.d*X*(1-e),an=p.a+tw*e;return [cx+Math.cos(an)*r,cy+Math.sin(an)*r*.82]};
      const q=(p.c<.45?0:p.c<.8?1:2)*4+Math.min(3,Math.floor(u*4));
      for(let s3=0;s3<=3;s3++){const [x,y]=pt(Math.max(0,u-.09+s3*.03));s3?paths[q].lineTo(x,y):paths[q].moveTo(x,y)}}
    for(let q=0;q<12;q++){const lv=(q%4+.5)/4;ctx.strokeStyle=col([.2,.6,.9][Math.floor(q/4)],.25+.7*lv);ctx.lineWidth=.6+lv*1.6;ctx.stroke(paths[q])}
    const e=arrived/NG;
    if(T>.75){const r=(lerp(0,2.6,eo(seg(T,.75,1.2)))+e*11)*(1+.12*Math.sin(T*18)*e)+(T>3.8?Math.sin(T*70)*e*1.5:0);
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r*7+6);g.addColorStop(0,'rgba(255,245,225,1)');g.addColorStop(.12,'rgba(255,170,80,.95)');g.addColorStop(.4,'rgba(255,110,30,.28)');g.addColorStop(1,'rgba(255,90,20,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r*7+6,0,7);ctx.fill()}
    ctx.globalCompositeOperation='source-over';
  }
  /* 弾け飛ぶ */
  if(T>=4.2&&T<5.6){const t=T-4.2;ctx.globalCompositeOperation='lighter';
    const al=Math.max(0,1-t/1.3),bp=[0,1,2,3,4,5].map(()=>new Path2D());
    for(const p of B){const d=v=>p.v*X*(1-Math.exp(-p.k*v))/p.k*2.2;const r1=d(Math.max(0,t-.045)),r2=d(t);
      const q=(p.c<.45?0:p.c<.8?1:2)*2+(p.w>1.2?1:0);bp[q].moveTo(cx+Math.cos(p.a)*r1,cy+Math.sin(p.a)*r1);bp[q].lineTo(cx+Math.cos(p.a)*r2,cy+Math.sin(p.a)*r2)}
    bp.forEach((P,q)=>{ctx.strokeStyle=col([.2,.6,.9][q>>1],al);ctx.lineWidth=q%2?1.8:.9;ctx.stroke(P)});
    const rr=eo(seg(t,0,.6))*X*.9;ctx.strokeStyle=`rgba(255,220,170,${.8*(1-seg(t,0,.6))})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,rr,0,7);ctx.stroke();
    ctx.globalCompositeOperation='source-over'}
  /* B: 渦を巻いてブラックアウト */
  if(T>=4.8&&T<6.8){ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
    const u=seg(T,4.8,6.6),spin=t=>{const v=seg(t,4.8,6.6);return Math.PI*2*(v*1.2+v*v*v*3.2)},sh=t=>Math.pow(1-eio(seg(t,5.0,6.55)),1.1);
    ctx.globalCompositeOperation='lighter';ctx.lineCap='round';const ccx=W/2,ccy=H/2;
    const sp=[0,1,2,3,4,5].map(()=>new Path2D());
    for(const p of S){const t1=T-.05;const a1=p.a+spin(t1)*p.sp,a2=p.a+spin(T)*p.sp,r1=p.r*X*sh(t1)*.9,r2=p.r*X*sh(T)*.9;
      const q=(p.r<.3?0:p.r<.55?1:2)*2+(p.c>.5?1:0),P=sp[q];
      for(let s2=0;s2<=4;s2++){const k=s2/4,aa=lerp(a1,a2,k),rr=lerp(r1,r2,k);const x=ccx+Math.cos(aa)*rr,y=ccy+Math.sin(aa)*rr*.86;s2?P.lineTo(x,y):P.moveTo(x,y)}}
    const fadeE=1-seg(T,6.2,6.75);
    sp.forEach((P,q)=>{const al=fadeE*[1,.7,.45][q>>1];
      ctx.strokeStyle=u<.35?`rgba(255,${235-Math.round(u*120)},${210-Math.round(u*300)},${al})`:col(q%2?.7:.3,al*.9);ctx.lineWidth=(1.4-u*.6)*(q%2?1.8:1);ctx.stroke(P)});
    const core=(1-seg(T,6.3,6.7))*seg(T,5.6,6.3);if(core>0){const g=ctx.createRadialGradient(ccx,ccy,0,ccx,ccy,40);g.addColorStop(0,`rgba(255,200,140,${core})`);g.addColorStop(1,'rgba(255,120,40,0)');ctx.fillStyle=g;ctx.fillRect(ccx-40,ccy-40,80,80)}
    ctx.globalCompositeOperation='source-over'}
  /* C: 宇宙 → 地球 → 日本 → 大阪 */
  if(T>=6.7&&T<12.4){
    const c=cam(T),r=c.R/M;
    ctx.fillStyle='#010207';ctx.fillRect(0,0,W,H);
    // 星（カメラが進むほど外へ流れる）
    const sa=seg(T,6.8,7.5)*(1-seg(r,2.5,5));
    if(sa>0){const trav=(c.lr-Math.log(.27*M))*.32+(T-6.8)*.025;
      for(const s of ST){let z=(s.z-trav)%1;if(z<0)z+=1;z=.04+z*.96;const z2=Math.min(1,z+.012+Math.max(0,trav*0)),k=.42*X;
        const x=W/2+s.x/z*k,y=H/2+s.y/z*k;if(x<0||x>W||y<0||y>H)continue;const x0=W/2+s.x/(z+.025)*k,y0=H/2+s.y/(z+.025)*k;
        ctx.strokeStyle=`rgba(${220+Math.round(s.m*35)},${225+Math.round(s.m*20)},255,${sa*(1-z)*.95})`;ctx.lineWidth=(1-z)*1.8+.3;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x,y);ctx.stroke()}}
    const ga=seg(T,6.9,7.8);
    if(ga>0){
      const cxg=W/2,cyg=H/2,R=c.R;
      if(R<2.2*X){ // 海と大気
        const ag=ctx.createRadialGradient(cxg,cyg,R*.92,cxg,cyg,R*1.18);ag.addColorStop(0,`rgba(90,150,255,${.0*ga})`);ag.addColorStop(.35,`rgba(90,150,255,${.28*ga})`);ag.addColorStop(1,'rgba(40,80,200,0)');
        ctx.fillStyle=ag;ctx.beginPath();ctx.arc(cxg,cyg,R*1.18,0,7);ctx.fill();
        const og=ctx.createRadialGradient(cxg-R*.3,cyg-R*.3,R*.1,cxg,cyg,R);og.addColorStop(0,`rgba(16,34,66,${ga})`);og.addColorStop(1,`rgba(4,9,22,${ga})`);
        ctx.fillStyle=og;ctx.beginPath();ctx.arc(cxg,cyg,R,0,7);ctx.fill();
        // 夜明けの縁（右下にオレンジの光）
        ctx.save();ctx.beginPath();ctx.arc(cxg,cyg,R*1.01,0,7);ctx.clip();
        const dg=ctx.createRadialGradient(cxg+R*.9,cyg+R*.35,R*.05,cxg+R*.9,cyg+R*.35,R*.95);dg.addColorStop(0,`rgba(255,150,60,${.55*ga})`);dg.addColorStop(1,'rgba(255,120,40,0)');
        ctx.fillStyle=dg;ctx.fillRect(cxg-R,cyg-R,R*2,R*2);ctx.restore();
      }else{ctx.fillStyle='#040916';ctx.fillRect(0,0,W,H)}
      if(geo){ctx.globalCompositeOperation='lighter';
        drawLayer(geo.w,ga*(1-seg(r,5,10)),c,cl(R*.0085,1.3,3.6));
        drawLayer(geo.j,ga*seg(r,2.4,5)*(1-seg(r,70,140)),c,cl(R*geo.j[10].sp*.42,.9,5));
        drawLayer(geo.o,seg(r,32,70),c,cl(R*geo.o[10].sp*.4,.9,4.5));
        ctx.globalCompositeOperation='source-over'}
      // 大阪の印
      const ma=seg(T,10.1,10.6)*(1-seg(T,11.2,11.5));
      if(ma>0){const p=proj(c,OS.la,OS.lo);ctx.globalCompositeOperation='lighter';
        for(let k=0;k<3;k++){const ph=((T*0.9+k/3)%1);ctx.strokeStyle=`rgba(255,170,80,${ma*(1-ph)*.9})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,8+ph*60,0,7);ctx.stroke()}
        const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,16);g.addColorStop(0,`rgba(255,240,210,${ma})`);g.addColorStop(1,'rgba(255,140,50,0)');ctx.fillStyle=g;ctx.fillRect(p.x-16,p.y-16,32,32);
        ctx.globalCompositeOperation='source-over';ctx.fillStyle=`rgba(243,230,210,${ma})`;ctx.font=`400 ${small()?15:19}px "Shippori Mincho","Noto Serif JP",serif`;ctx.textBaseline='middle';
        ctx.fillText('大　阪',p.x+26,p.y-26);ctx.fillStyle=`rgba(214,178,122,${ma*.9})`;ctx.font=`italic 400 ${small()?11:13}px "Cormorant Garamond",serif`;ctx.fillText('OSAKA, JAPAN',p.x+27,p.y-6)}
    }
  }
  /* F: どーん！の衝撃波と火花 */
  if(T>=15.8&&T<18.4){const t=T-15.8,ccx=W/2,ccy=H/2;ctx.globalCompositeOperation='lighter';
    for(let k=0;k<2;k++){const tt=t-k*.12;if(tt<0)continue;const rr=eo(seg(tt,0,.9))*X*.75;ctx.strokeStyle=`rgba(255,${200-k*40},${140-k*60},${.75*(1-seg(tt,0,.9))})`;ctx.lineWidth=4-k*2;ctx.beginPath();ctx.ellipse(ccx,ccy,rr,rr*.62,0,0,7);ctx.stroke()}
    for(const p of F){const d=v=>p.v*X*(1-Math.exp(-p.k*v))/p.k*1.6;const r1=d(Math.max(0,t-.04)),r2=d(t),al=Math.max(0,1-t/1.6);
      ctx.strokeStyle=col(p.c,al);ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(ccx+Math.cos(p.a)*r1,ccy+Math.sin(p.a)*r1*.7);ctx.lineTo(ccx+Math.cos(p.a)*r2,ccy+Math.sin(p.a)*r2*.7);ctx.stroke()}
    ctx.globalCompositeOperation='source-over'}

  /* 画面の重ね（白・街の映像・夜明け） */
  const wo=T<4.2?0:T<4.42?seg(T,4.2,4.42):T<4.9?1:1-eio(seg(T,4.9,5.9));
  white.style.opacity=wo.toFixed(3);
  // 大阪の街へ：地図を拡大しながら溶かし、映像を出す
  const tr=seg(T,11.3,12.2);
  cv.style.opacity=(T<11.3||T>=12.4)?'1':(1-eo(tr)).toFixed(3);
  cv.style.transform=(T>=11.3&&T<12.4)?`scale(${(1+eo(tr)*1.6).toFixed(3)})`:'none';
  const va=seg(T,11.45,12.3);
  if(va>0&&vid.paused&&!vid.dataset.go){vid.dataset.go=1;try{vid.currentTime=0}catch(_){}vid.play().catch(()=>{})}
  const vOn=T>=11.3&&T<19.5;if(vid.style.display!==(vOn?'block':'none'))vid.style.display=vOn?'block':'none';
  if(dawn.style.display!==(T>=12.3?'block':'none'))dawn.style.display=T>=12.3?'block':'none';
  if(!vOn)return;
  vid.style.opacity=va.toFixed(3);
  const dk=seg(T,12.4,15.4),dim=seg(T,15.5,15.8)*(1-seg(T,16.0,17.2)*.4);
  vid.style.transform=`scale(${(1.25-eo(va)*.25).toFixed(3)})`;
  const fl=va<1?`blur(${((1-va)*8).toFixed(1)}px)`:'none';if(vid.style.filter!==fl)vid.style.filter=fl;
  night.style.opacity=(.18-.14*dk+.45*dim).toFixed(3);
  dawn.style.opacity=(dk*.35*(1-dim*.35)).toFixed(3);
}

/* ---------- 進行 ---------- */
const STEPS=[[.05,'s1'],[13.0,'l1'],[15.3,'l1out'],[15.8,'boom'],[16.6,'co'],[18.3,'exit'],[19.3,'end']];
let k=0,t0=0;
const now=()=>{if(typeof window.__T==="number")return window.__T;const el=(performance.now()-t0)/1000;return (withMusic&&!au.paused&&au.currentTime>0)?Math.max(au.currentTime,el-1.2):el};
const tick=()=>{if(ended)return;const T=now();
  while(k<STEPS.length&&T>=STEPS[k][0]){const n=STEPS[k][1];if(n==='end'){ended=true;finish();return}ov.classList.add(n);k++}
  frame(T);raf=requestAnimationFrame(tick)};
const run=()=>{if(started)return;started=true;ov.classList.remove('gate');ov.classList.add('run');t0=performance.now();raf=requestAnimationFrame(tick);
  setTimeout(()=>{if(!ended){ended=true;finish()}},26000);
  addEventListener('keydown',e=>{if(['Escape','Enter',' '].includes(e.key))skip()},{once:true})};
const skip=()=>{if(ended||!started)return;ended=true;ov.classList.add('skip');setTimeout(finish,600)};
ov.querySelector('.intro-skip').addEventListener('click',e=>{e.stopPropagation();skip()});
ov.addEventListener('click',skip);

/* ---------- 音：自動で流せなければ「はじめる」を出す ---------- */
const gate=ov.querySelector('.ci-gate');
const showGate=()=>{ov.classList.add('gate');gate.hidden=false;
  const open=m=>e=>{e.stopPropagation();withMusic=m;
    if(m){au.currentTime=0;au.volume=1;au.play().catch(()=>{withMusic=false});bgm&&bgm.unlock&&bgm.unlock()}
    gate.classList.add('out');setTimeout(()=>{gate.hidden=true},900);setTimeout(run,500)};
  gate.querySelector('.go').addEventListener('click',open(true));
  gate.querySelector('.mute').addEventListener('click',open(false));
  gate.addEventListener('click',e=>e.stopPropagation())};
if(bgm&&bgm.off()){showGate();return}
let decided=false;
const tm=setTimeout(()=>{if(!decided){decided=true;au.pause();showGate()}},2500);
au.play().then(()=>{if(decided){au.pause();return}decided=true;clearTimeout(tm);withMusic=true;run()}).catch(()=>{if(decided)return;decided=true;clearTimeout(tm);showGate()});
})();
