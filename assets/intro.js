/* ==========================================================
   オープニング Version 5「夜明け」— 映画のタイトル風（約7.5秒）＋背景音楽
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
const timers=[];let ended=false,started=false;
const at=(ms,fn)=>timers.push(setTimeout(fn,ms));
const step=k=>()=>ov.classList.add(k);
const skip=()=>{if(ended||!started)return;ended=true;timers.forEach(clearTimeout);ov.classList.add('skip');setTimeout(finish,600)};
const run=()=>{
  if(started)return;started=true;ov.classList.remove('gate');ov.classList.add('run');
  at(80,step('s1'));      // 黒帯
  at(300,step('s2'));     // 金の地平線
  at(1100,step('s3'));    // 日の出
  at(1900,step('s4'));    // 「はじまりは、夜明けから。」
  at(3700,step('s5'));    // マークと社名
  at(5100,step('s6'));    // キャッチコピー
  at(6300,step('s7'));    // 上下に開く
  at(7500,()=>{if(!ended){ended=true;finish()}});
  setTimeout(()=>{if(!ended){ended=true;finish()}},12000);
  addEventListener('keydown',e=>{if(['Escape','Enter',' '].includes(e.key))skip()},{once:true});
};
ov.querySelector('.intro-skip').addEventListener('click',e=>{e.stopPropagation();skip()});
ov.addEventListener('click',skip);
const bgm=window.maBgm;
const showGate=()=>{
  ov.classList.add('gate');gate.hidden=false;
  const open=withMusic=>e=>{e.stopPropagation();if(bgm)withMusic?bgm.play():bgm.stop();gate.classList.add('out');setTimeout(()=>{gate.hidden=true},900);setTimeout(run,350)};
  gate.querySelector('.go').addEventListener('click',open(true));
  gate.querySelector('.mute').addEventListener('click',open(false));
  gate.addEventListener('click',e=>e.stopPropagation());
};
// 音楽を止めると決めている人には流さない
if(!bgm||bgm.off()){run();return}
// まず自動で流してみる。止められたら案内を出す
let decided=false;
const t=setTimeout(()=>{if(!decided){decided=true;showGate()}},2500);
bgm.play().then(ok=>{if(decided)return;decided=true;clearTimeout(t);ok?run():showGate()});
})();
