/* ==========================================================
   オープニング演出 Version 2（約7秒・1回の訪問につき1度）
   ワープ → 日本列島と全国への光の弧 → 吸い込み・閃光・衝撃波・マーク → 社名 → 丸く開く
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
let W,H,DPR,mob;
const fit=()=>{DPR=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);mob=W<720};fit();addEventListener('resize',fit);
const rnd=(a,b)=>a+Math.random()*(b-a),ease=t=>1-Math.pow(1-t,3),easeIn=t=>t*t*t,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const COL=['#ff7a1a','#ffb45c','#ffe2b8','#7fc4ff','#ffffff'];

/* --- 日本列島（0〜1の座標） --- */
const JP=[[[.86,.06],[.95,.12],[.92,.2],[.80,.17],[.82,.10]],
 [[.80,.24],[.83,.32],[.80,.40],[.76,.47],[.70,.52],[.62,.56],[.55,.59],[.47,.62],[.39,.65],[.33,.64]],
 [[.44,.70],[.52,.69],[.50,.73],[.43,.74]],[[.26,.67],[.33,.70],[.32,.78],[.25,.82],[.22,.74]],[[.10,.93],[.13,.96],[.08,.98]]];
const segs=[];JP.forEach(p=>{for(let i=0;i<p.length-1;i++)segs.push([p[i],p[i+1]]);if(p.length>3)segs.push([p.at(-1),p[0]])});
const CITY={札幌:[.87,.12],仙台:[.81,.34],東京:[.75,.47],名古屋:[.63,.55],大阪:[.55,.59],広島:[.42,.63],福岡:[.28,.70],那覇:[.10,.95]};
const mapBox=()=>{const s=Math.min(W*(mob?.92:.56),H*.78);return{x:W/2-s*.52,y:H/2-s*.5,s}};
const M=p=>{const b=mapBox();return{x:b.x+p[0]*b.s,y:b.y+p[1]*b.s}};

/* --- 粒子 --- */
const N=mob?520:1100;
const P=Array.from({length:N},()=>{const [a,b]=segs[Math.floor(Math.random()*segs.length)],t=Math.random();
  return{z:rnd(.05,1),a:rnd(0,6.283),r:rnd(.02,1),c:COL[Math.floor(Math.random()*4)],m:[a[0]+(b[0]-a[0])*t+rnd(-.025,.025),a[1]+(b[1]-a[1])*t+rnd(-.022,.022)],sx:0,sy:0,px:0,py:0}});
let sparks=[],rings=[],arcs=[];
const t0=performance.now();let last=t0,ended=false,bang=false,fired=false,flew=false,opened=false;

/* --- 文字の準備 --- */
const name=nameEl.dataset.text;nameEl.innerHTML=[...name].map((c,i)=>`<span style="--i:${i}">${c}</span>`).join('');
const tag=tagEl.dataset.text;

const skip=()=>{if(ended)return;ended=true;ov.classList.add('skip');setTimeout(finish,500)};
ov.querySelector('.intro-skip').addEventListener('click',e=>{e.stopPropagation();skip()});
ov.addEventListener('click',skip);addEventListener('keydown',e=>{if(['Escape','Enter',' '].includes(e.key))skip()},{once:true});

const frame=now=>{if(!ov.isConnected)return;const t=(now-t0)/1000;const dt=Math.min(4,Math.max(1,(now-last)/16.7));last=now;
  ctx.globalCompositeOperation='source-over';
  ctx.fillStyle=t<1.75?'rgba(2,6,12,.35)':t<3.9?'rgba(2,6,12,.28)':'rgba(2,6,12,.5)';ctx.fillRect(0,0,W,H);
  ctx.globalCompositeOperation='lighter';
  const cx=W/2,cy=H/2;

  /* 場面1：ワープ（0〜1.75秒） */
  if(t<1.75){const sp=.004+easeIn(clamp(t/1.5))*.05;
    P.forEach(p=>{p.z-=sp*(.6+p.r*.8);if(p.z<=.02){p.z=1;p.a=rnd(0,6.283);p.r=rnd(.02,1)}
      const k=1/p.z,x=cx+Math.cos(p.a)*p.r*W*.5*k*.12,y=cy+Math.sin(p.a)*p.r*H*.5*k*.12;
      const kz=1/(p.z+sp*6),x0=cx+Math.cos(p.a)*p.r*W*.5*kz*.12,y0=cy+Math.sin(p.a)*p.r*H*.5*kz*.12;
      ctx.strokeStyle=p.c;ctx.globalAlpha=clamp(1.2-p.z)*clamp(t*2);ctx.lineWidth=clamp(1.4-p.z,.3,2.2)*(1+t);
      ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x,y);ctx.stroke();p.sx=x;p.sy=y});
    ctx.globalAlpha=1;
    if(t>1.2){const g=ctx.createRadialGradient(cx,cy,0,cx,cy,W*.4);g.addColorStop(0,`rgba(255,180,92,${(t-1.2)*.5})`);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
    P.forEach(p=>{p.px=p.sx;p.py=p.sy});
  }
  /* 場面2：日本列島へ集まり、大阪から全国へ（1.75〜3.5秒） */
  else if(t<3.5){const k=ease(clamp((t-1.75)/.8));
    if(!fired&&t>2.35){fired=true;const o=M(CITY.大阪);rings.push({x:o.x,y:o.y,t:0,c:'#ffb45c',w:3,max:Math.max(W,H)*.5});
      Object.entries(CITY).forEach(([n,p],i)=>{if(n!=='大阪')arcs.push({n,a:CITY.大阪,b:p,d:.08*i,t:0})});capEl.classList.add('on')}
    P.forEach(p=>{const m=M(p.m);const x=p.px+(m.x-p.px)*k,y=p.py+(m.y-p.py)*k;p.sx=x;p.sy=y;
      ctx.globalAlpha=.85;ctx.fillStyle=p.c;ctx.fillRect(x-1,y-1,mob?1.8:2,mob?1.8:2)});
    ctx.globalAlpha=1;
    arcs.forEach(a=>{a.t=clamp((t-2.4-a.d)/.55);if(a.t<=0)return;const A=M(a.a),B=M(a.b),mx=(A.x+B.x)/2,my=(A.y+B.y)/2-Math.hypot(B.x-A.x,B.y-A.y)*.35;
      ctx.strokeStyle='rgba(255,170,90,.9)';ctx.lineWidth=2;ctx.beginPath();for(let s=0;s<=a.t;s+=.04){const u=1-s,x=u*u*A.x+2*u*s*mx+s*s*B.x,y=u*u*A.y+2*u*s*my+s*s*B.y;s?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();
      const s=a.t,u=1-s,hx=u*u*A.x+2*u*s*mx+s*s*B.x,hy=u*u*A.y+2*u*s*my+s*s*B.y;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx,hy,3.5,0,6.283);ctx.fill();
      if(a.t>=1&&!a.hit){a.hit=1;rings.push({x:B.x,y:B.y,t:0,c:'#ffe2b8',w:2,max:60})}
      if(a.t>=1){ctx.fillStyle='rgba(255,226,184,.95)';ctx.font=`700 ${mob?11:13}px "Noto Sans JP",sans-serif`;ctx.textAlign='center';ctx.fillText(a.n,B.x,B.y-12)}});
    if(t>2.3){const o=M(CITY.大阪);const g=ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,70);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.2,'rgba(255,140,50,.7)');g.addColorStop(1,'rgba(255,122,26,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(o.x,o.y,70,0,6.283);ctx.fill();
      ctx.fillStyle='#fff';ctx.font=`800 ${mob?13:15}px "Noto Sans JP",sans-serif`;ctx.textAlign='center';ctx.fillText('大阪',o.x,o.y+28)}
    const c=Math.round(5000*ease(clamp((t-2.1)/1.2)));numEl.textContent=c.toLocaleString();if(t>2.0)numBox.classList.add('on');
  }
  /* 場面3：吸い込み → 閃光 → 衝撃波・火花・マーク（3.5秒〜） */
  else{
    if(t<3.95){const k=easeIn(clamp((t-3.5)/.45));P.forEach(p=>{const x=p.sx+(cx-p.sx)*k,y=p.sy+(cy-p.sy)*k;ctx.strokeStyle=p.c;ctx.globalAlpha=.9;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(x-cx)*.08,y+(y-cy)*.08);ctx.stroke()});ctx.globalAlpha=1;numBox.classList.remove('on');capEl.classList.remove('on')}
    if(!bang&&t>=3.95){bang=true;flash.classList.add('go');stage.classList.add('shake');logo.classList.add('in');
      for(let i=0;i<3;i++)rings.push({x:cx,y:cy,t:-i*.12,c:i?'#ffb45c':'#ffffff',w:6-i*1.5,max:Math.max(W,H)*.9});
      for(let i=0;i<(mob?220:420);i++){const a=rnd(0,6.283),v=rnd(2,mob?11:16);sparks.push({x:cx,y:cy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:1,c:COL[Math.floor(rnd(0,5))],s:rnd(1,2.6)})}}
    if(t>4.25&&!nameEl.classList.contains('in'))nameEl.classList.add('in');
    if(t>4.9&&!tagEl.dataset.on){tagEl.dataset.on=1;let i=0;const ty=()=>{tagEl.textContent=tag.slice(0,++i);if(i<tag.length)setTimeout(ty,45)};ty()}
    if(t>4.0){ctx.save();ctx.translate(cx,cy);ctx.rotate(t*.5);const L=Math.max(W,H);for(let i=0;i<24;i++){ctx.rotate(6.283/24);const g=ctx.createLinearGradient(0,0,0,-L);g.addColorStop(0,'rgba(255,140,50,.10)');g.addColorStop(1,'rgba(255,140,50,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-18,-L);ctx.lineTo(18,-L);ctx.fill()}ctx.restore()}
  }
  // 衝撃波と火花
  rings=rings.filter(r=>{r.t+=.016*dt;if(r.t<0)return true;const k=ease(clamp(r.t/.9));ctx.strokeStyle=r.c;ctx.globalAlpha=1-k;ctx.lineWidth=r.w*(1-k)+.5;ctx.beginPath();ctx.arc(r.x,r.y,k*r.max,0,6.283);ctx.stroke();ctx.globalAlpha=1;return r.t<.9});
  sparks=sparks.filter(s=>{for(let q=0;q<Math.round(dt);q++){s.vx*=.965;s.vy=s.vy*.965+.06;s.x+=s.vx;s.y+=s.vy;s.l-=.011}ctx.globalAlpha=Math.max(0,s.l);ctx.fillStyle=s.c;ctx.beginPath();ctx.arc(s.x,s.y,s.s,0,6.283);ctx.fill();ctx.globalAlpha=s.l*.25;ctx.beginPath();ctx.arc(s.x,s.y,s.s*3.5,0,6.283);ctx.fill();ctx.globalAlpha=1;return s.l>0});

  /* 場面5：マークがヘッダーへ飛び、丸く開く（6.1秒〜） */
  if(!flew&&t>6.1){flew=true;const hb=document.querySelector('.site-header .brand-mark');const lr=logo.getBoundingClientRect();
    if(hb){const r=hb.getBoundingClientRect();logo.style.setProperty('--fx',(r.left+r.width/2-(lr.left+lr.width/2))+'px');logo.style.setProperty('--fy',(r.top+r.height/2-(lr.top+lr.height/2))+'px');logo.style.setProperty('--fs',(r.width/lr.width).toFixed(3))}
    logo.classList.add('fly');ov.classList.add('closing')}
  if(t>6.3){const k=easeIn(clamp((t-6.3)/.9));ov.style.setProperty('--hole',(k*Math.hypot(W,H)*.6)+'px');if(!opened){opened=true;ov.classList.add('open')}}
  if(t>7.3&&!ended){ended=true;finish();return}
  requestAnimationFrame(frame)};
requestAnimationFrame(frame);
setTimeout(()=>{if(!ended){ended=true;finish()}},9000);
})();
