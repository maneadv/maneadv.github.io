/* ==========================================================
   オープニング演出（トップページ・1回の訪問につき1度）
   光の点が集まる → 線でつながる → マークを描く → 社名 → 幕が開く
   ========================================================== */
(()=>{
const ov=document.getElementById('intro');if(!ov)return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const done=()=>{if(ov.classList.contains('out'))return;ov.classList.add('out');try{sessionStorage.setItem('ma-intro','1')}catch(_){}
  document.documentElement.classList.remove('intro-lock');setTimeout(()=>ov.remove(),1100)};
if(reduced){ov.remove();document.documentElement.classList.remove('intro-lock');return}
document.documentElement.classList.add('intro-lock');
ov.querySelector('.intro-skip').addEventListener('click',e=>{e.stopPropagation();done()});
ov.addEventListener('click',done);addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Enter'||e.key===' ')done()},{once:true});
// 光の点と網
const cv=ov.querySelector('canvas'),ctx=cv.getContext('2d');let W,H;
const fit=()=>{const r=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;cv.width=W*r;cv.height=H*r;ctx.setTransform(r,0,0,r,0,0)};fit();addEventListener('resize',fit);
const N=Math.min(150,Math.floor(W*H/9000));
const P=Array.from({length:N},()=>{const a=Math.random()*6.283,rr=Math.max(W,H)*(.55+Math.random()*.4);return{x:W/2+Math.cos(a)*rr,y:H/2+Math.sin(a)*rr,tx:W/2+(Math.random()-.5)*W*.86,ty:H/2+(Math.random()-.5)*H*.72,d:Math.random()*.5}});
const num=ov.querySelector('.intro-num');const t0=performance.now();
const ease=t=>1-Math.pow(1-t,3);
const draw=now=>{if(!ov.isConnected)return;const t=(now-t0)/1000;ctx.clearRect(0,0,W,H);
  const k=Math.min(1,Math.max(0,(t-.1)/1.4));
  P.forEach(p=>{const e=ease(Math.min(1,Math.max(0,(k-p.d*.4)/(1-p.d*.4))));p.x2=p.x+(p.tx-p.x)*e;p.y2=p.y+(p.ty-p.y)*e});
  // 線：近い点どうしをつなぐ（徐々に現れる）
  const lk=Math.min(1,Math.max(0,(t-1.0)/.9)),fadeOut=Math.max(0,1-Math.max(0,t-2.6)/1.2);
  if(lk>0){ctx.lineWidth=.7;for(let i=0;i<N;i++){const a=P[i];for(let j=i+1;j<N;j++){const b=P[j],dx=a.x2-b.x2,dy=a.y2-b.y2,d=dx*dx+dy*dy;if(d<9000){ctx.strokeStyle=`rgba(255,150,70,${(1-d/9000)*.45*lk*fadeOut})`;ctx.beginPath();ctx.moveTo(a.x2,a.y2);ctx.lineTo(b.x2,b.y2);ctx.stroke()}}}}
  P.forEach(p=>{ctx.beginPath();ctx.arc(p.x2,p.y2,1.6,0,6.283);ctx.fillStyle=`rgba(255,200,140,${.9*fadeOut})`;ctx.fill()});
  // 中心へ光が集まる
  if(t>1.5&&t<3.2){const g=Math.sin(Math.min(1,(t-1.5)/1.7)*3.14);const rg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*.35);rg.addColorStop(0,`rgba(255,122,26,${.35*g})`);rg.addColorStop(1,'rgba(255,122,26,0)');ctx.fillStyle=rg;ctx.fillRect(0,0,W,H)}
  if(num){const c=Math.round(5000*ease(Math.min(1,t/1.8)));num.textContent=c.toLocaleString()}
  if(t<5.5)requestAnimationFrame(draw)};
requestAnimationFrame(draw);
ov.classList.add('play');
setTimeout(done,4600);
})();
