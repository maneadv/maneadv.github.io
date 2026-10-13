/* ==========================================================
   オープニング Version 4「夜明け」— 映画のタイトル風（約7.8秒）
   段階ごとに印（s1〜s7）を付け、動きは intro.css が受け持つ
   ========================================================== */
(()=>{
const ov=document.getElementById('intro');if(!ov)return;
const root=document.documentElement;
const finish=()=>{try{sessionStorage.setItem('ma-intro','1')}catch(_){}root.classList.remove('intro-lock');ov.remove()};
if(matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return}
root.classList.add('intro-lock');
const name=ov.querySelector('.ci-name');name.innerHTML=[...name.dataset.text].map((c,i)=>`<span style="--i:${i}">${c}</span>`).join('');
const timers=[];let ended=false;
const at=(ms,fn)=>timers.push(setTimeout(fn,ms));
const step=k=>()=>ov.classList.add(k);
at(80,step('s1'));      // 黒帯
at(300,step('s2'));     // 金の地平線
at(1100,step('s3'));    // 日の出
at(1900,step('s4'));    // 「はじまりは、夜明けから。」
at(3700,step('s5'));    // マークと社名
at(5100,step('s6'));    // キャッチコピー
at(6300,step('s7'));    // 上下に開く
at(7500,()=>{if(!ended){ended=true;finish()}});
const skip=()=>{if(ended)return;ended=true;timers.forEach(clearTimeout);ov.classList.add('skip');setTimeout(finish,600)};
ov.querySelector('.intro-skip').addEventListener('click',e=>{e.stopPropagation();skip()});
ov.addEventListener('click',skip);
addEventListener('keydown',e=>{if(['Escape','Enter',' '].includes(e.key))skip()},{once:true});
setTimeout(()=>{if(!ended){ended=true;finish()}},11000);
})();
