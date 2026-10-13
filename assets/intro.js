/* ==========================================================
   オープニング Version 6「夜明け」— 映画のタイトル風（約14秒）＋背景音楽に同期
   ・音楽を流してから幕を開ける。ブラウザが自動再生を止めた場合は
     「はじめる」ボタン（押すと音楽付きで再生）を一度だけ出す
   ========================================================== */
(()=>{
const ov=document.getElementById('intro');if(!ov)return;
const root=document.documentElement;
const finish=()=>{try{sessionStorage.setItem('ma-intro','1')}catch(_){}root.classList.remove('intro-lock');ov.remove()};
if(matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return}
root.classList.add('intro-lock');
const name=ov.querySelector('.ci-name');name.innerHTML=[...name.dataset.text].map((c,i)=>`<span style="--i:${i}">${c}</span>`).join('');
const gate=ov.querySelector('.ci-gate');
let ended=false,started=false;
const skip=()=>{if(ended||!started)return;ended=true;ov.classList.add('skip');setTimeout(finish,600)};
// 場面の時刻（ミリ秒）。幕が開く時刻は、曲のビートが入る瞬間（12.47秒）に合わせている
const SCENES=[[100,'s1'],[500,'s2'],[1500,'s3'],[2600,'s4'],[5600,'s4b'],[8300,'s5'],[10200,'s6'],[12250,'s7'],[13700,'end']];
const run=()=>{
  if(started)return;started=true;ov.classList.remove('gate');ov.classList.add('run');
  const t0=performance.now();let k=0;const au=window.maBgm&&window.maBgm.audio;
  const tick=()=>{
    if(ended)return;
    const el=performance.now()-t0;
    // 音楽が流れていれば曲の位置に合わせる（読み込みで止まっても大きくずれないよう経過時間も見る）
    const t=(au&&!au.paused&&au.currentTime>0)?Math.max(au.currentTime*1000,el-1200):el;
    while(k<SCENES.length&&t>=SCENES[k][0]){const n=SCENES[k][1];if(n==='end'){ended=true;finish();return}ov.classList.add(n);k++}
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(()=>{if(!ended){ended=true;finish()}},20000);
  addEventListener('keydown',e=>{if(['Escape','Enter',' '].includes(e.key))skip()},{once:true});
};
ov.querySelector('.intro-skip').addEventListener('click',e=>{e.stopPropagation();skip()});
ov.addEventListener('click',skip);
const bgm=window.maBgm;
const showGate=()=>{
  ov.classList.add('gate');gate.hidden=false;
  const open=withMusic=>e=>{e.stopPropagation();if(bgm)withMusic?bgm.play(true):bgm.stop();gate.classList.add('out');setTimeout(()=>{gate.hidden=true},900);setTimeout(run,350)};
  gate.querySelector('.go').addEventListener('click',open(true));
  gate.querySelector('.mute').addEventListener('click',open(false));
  gate.addEventListener('click',e=>e.stopPropagation());
};
if(!bgm){run();return}
// 以前ヘッダーで音楽を切った人には自動では流さず、案内から選んでもらう
if(bgm.off()){showGate();return}
// まず自動で流してみる。止められたら案内を出す
let decided=false;
const t=setTimeout(()=>{if(!decided){decided=true;showGate()}},2500);
bgm.play(true).then(ok=>{if(decided)return;decided=true;clearTimeout(t);ok?run():showGate()});
})();
