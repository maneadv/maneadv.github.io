/* ==========================================================
   オープニング Version 9（支給映像・約21秒・音付き）
   映像をそのまま全画面で流し、終わったらトップページへ。
   音を自動で流せない端末では「音ありで見る／音なしで見る」を出す。
   ========================================================== */
(()=>{
const ov=document.getElementById('intro');if(!ov)return;
const root=document.documentElement;
const v=ov.querySelector('.op-video');
const bgm=window.maBgm;
const heroV=document.querySelector('.hero-video');
let ended=false,started=false,withSound=false;
const fadeOut=(ms,done)=>{if(v.muted||v.paused){done&&done();return}const v0=v.volume,st=performance.now();const f=()=>{const k=Math.min(1,(performance.now()-st)/ms);v.volume=v0*(1-k);if(k<1)requestAnimationFrame(f);else done&&done()};f()};
const finish=()=>{if(ended)return;ended=true;
  try{sessionStorage.setItem('ma-intro','1')}catch(_){}
  ov.classList.add('exit');fadeOut(900);
  setTimeout(()=>{try{v.pause()}catch(_){}root.classList.remove('intro-lock');ov.remove();if(heroV)heroV.play().catch(()=>{})},1000);
  if(withSound&&bgm)setTimeout(()=>bgm.play(true),700)};
const forced=ov.classList.contains('force');try{sessionStorage.removeItem('ma-intro-force')}catch(_){}
if(!forced&&matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return}
root.classList.add('intro-lock');
if(heroV){heroV.pause();heroV.removeAttribute('autoplay')}

// 文字を出す時刻（映像の再生位置・秒）
const CUES=[[17.0,'l1'],[20.6,'l1out'],[21.4,'big'],[23.2,'co']];
const showCo=()=>ov.classList.add('co');
let raf=0;const cue=()=>{const t=v.currentTime;for(const [at,c] of CUES){if(t>=at)ov.classList.add(c)}if(!ended)raf=requestAnimationFrame(cue)};
const run=()=>{if(started)return;started=true;ov.classList.remove('gate');ov.classList.add('run');
  raf=requestAnimationFrame(cue);
  // 最後に社名を見せてから終える
  v.addEventListener('ended',()=>{ov.classList.add('big');showCo();setTimeout(finish,2400)},{once:true});
  // 映像が止まったまま進まないときの保険
  setTimeout(()=>{if(!ended&&(v.paused||v.currentTime<.2))finish()},9000);
  setTimeout(finish,38000);
  addEventListener('keydown',e=>{if(['Escape','Enter',' '].includes(e.key))finish()},{once:true})};
ov.querySelector('.intro-skip').addEventListener('click',e=>{e.stopPropagation();finish()});

const gate=ov.querySelector('.ci-gate');
const showGate=()=>{ov.classList.add('gate');gate.hidden=false;
  const open=snd=>e=>{e.stopPropagation();withSound=snd;v.muted=!snd;v.volume=1;try{v.currentTime=0}catch(_){}
    v.play().then(run).catch(()=>{v.muted=true;withSound=false;v.play().then(run).catch(finish)});
    if(snd&&bgm&&bgm.unlock)bgm.unlock();
    gate.classList.add('out');setTimeout(()=>{gate.hidden=true},800)};
  gate.querySelector('.go').addEventListener('click',open(true));
  gate.querySelector('.mute').addEventListener('click',open(false));
  gate.addEventListener('click',e=>e.stopPropagation())};
v.addEventListener('error',finish,{once:true});
if(bgm&&bgm.off&&bgm.off()){showGate();return}
// まずは音ありで自動再生を試す。だめなら選んでもらう
v.muted=false;
let decided=false;
const tm=setTimeout(()=>{if(!decided){decided=true;v.pause();showGate()}},2500);
v.play().then(()=>{if(decided){v.pause();return}decided=true;clearTimeout(tm);withSound=true;run()})
 .catch(()=>{if(decided)return;decided=true;clearTimeout(tm);showGate()});
})();
