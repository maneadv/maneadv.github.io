/* ==========================================================
   背景音楽（オリジナル曲）：ヘッダーのボタンで再生・停止
   ・最初は止まった状態。押すと流れ、次のページでも続きから流れる
   ========================================================== */
(()=>{
const btn=document.querySelector('.bgm-btn');if(!btn)return;
const base=btn.dataset.src;const a=new Audio();a.loop=true;a.preload='none';
a.src=base+(a.canPlayType('audio/ogg; codecs="opus"')?'bgm2.ogg':'bgm2.mp3');
const TARGET=0.32;let fading=null;
const get=k=>{try{return localStorage.getItem(k)}catch(_){return null}},set=(k,v)=>{try{localStorage.setItem(k,v)}catch(_){}};
const sget=k=>{try{return sessionStorage.getItem(k)}catch(_){return null}},sset=(k,v)=>{try{sessionStorage.setItem(k,v)}catch(_){}};
const ui=on=>{btn.classList.toggle('on',on);btn.setAttribute('aria-pressed',String(on));btn.setAttribute('aria-label',on?'音楽を止める':'音楽を流す');btn.querySelector('.bgm-label').textContent=on?'音楽 入':'音楽 切'};
const fade=(to,ms,done)=>{clearInterval(fading);const from=a.volume,st=performance.now();fading=setInterval(()=>{const k=Math.min(1,(performance.now()-st)/ms);a.volume=from+(to-from)*k;if(k>=1){clearInterval(fading);done&&done()}},40)};
const play=()=>{const t=parseFloat(sget('ma-bgm-t')||'0');if(t&&!a.currentTime){try{a.currentTime=t}catch(_){}}a.volume=0;return a.play().then(()=>{fade(TARGET,1500);ui(true);return true}).catch(()=>false)};
const stop=()=>{fade(0,500,()=>a.pause());ui(false)};
btn.addEventListener('click',()=>{if(btn.classList.contains('on')){stop();set('ma-bgm','off')}else{set('ma-bgm','on');play()}});
addEventListener('pagehide',()=>{if(!a.paused)sset('ma-bgm-t',String(a.currentTime))});
ui(false);
// オープニングから呼び出せるようにする
window.maBgm={play:()=>play().then(ok=>{if(ok)set('ma-bgm','on');return ok}),stop:()=>{if(!a.paused)stop()},off:()=>get('ma-bgm')==='off',audio:a};
if(document.getElementById('intro'))a.preload='auto';
// 前のページで流していた場合は、続きから流す（ブラウザが止めた場合は最初の操作で流す）
if(get('ma-bgm')==='on'){play().then(ok=>{if(ok)return;btn.classList.add('wait');const go=e=>{if(e.target.closest&&e.target.closest('.bgm-btn'))return;play();btn.classList.remove('wait');removeEventListener('pointerdown',go,true);removeEventListener('keydown',go,true)};addEventListener('pointerdown',go,true);addEventListener('keydown',go,true)})}
})();
