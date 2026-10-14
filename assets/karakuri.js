/* ==========================================================
   からくり拡張（Version 9）
   ========================================================== */
(()=>{
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine=matchMedia('(pointer:fine)').matches;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

/* ---------- 1. メイン動画：再生切替・視差・時間表示 ---------- */
const video=$('.hero-video'),toggle=$('.video-toggle'),hero=$('.future-hero');
if(video){
  if(reduced){video.removeAttribute('autoplay');video.pause();}
  else{const p=video.play();if(p&&p.catch)p.catch(()=>{});}
  const setLabel=()=>{if(toggle)toggle.innerHTML=video.paused?'<span aria-hidden="true">▶</span>映像を再生':'<span aria-hidden="true">❚❚</span>映像を停止';};
  setLabel();
  toggle&&toggle.addEventListener('click',()=>{video.paused?video.play():video.pause();setLabel();});
  video.addEventListener('play',setLabel);video.addEventListener('pause',setLabel);
  // 映像の時間帯を表示（昼→夕暮れ→昼の往復）
  const clock=$('.hero-time b');
  if(clock){const tick=()=>{const d=video.duration||20,t=video.currentTime%d,ph=t<d/2?t/(d/2):2-t/(d/2);const min=Math.round((19+ph*4.5)*60);clock.textContent=String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0');requestAnimationFrame(tick)};requestAnimationFrame(tick);}
  if(!reduced){
    let mx=0,my=0,sy=0,queued=false;
    const apply=()=>{queued=false;video.style.setProperty('--vx',(mx*-14)+'px');video.style.setProperty('--vy',(my*-10+sy*.18)+'px');video.style.setProperty('--vs',1+Math.min(sy,700)/700*.08);};
    const q=()=>{if(!queued){queued=true;requestAnimationFrame(apply)}};
    if(fine)hero.addEventListener('pointermove',e=>{const r=hero.getBoundingClientRect();mx=(e.clientX-r.left)/r.width-.5;my=(e.clientY-r.top)/r.height-.5;q();});
    addEventListener('scroll',()=>{sy=Math.max(0,scrollY);if(sy<1000)q();},{passive:true});
  }
}

/* ---------- 2. 見出しの文字を分解（触ると跳ねる／波打つ） ---------- */
const split=el=>{const walk=node=>{[...node.childNodes].forEach(n=>{if(n.nodeType===3){const frag=document.createDocumentFragment();[...n.textContent].forEach(c=>{if(/\s/.test(c)){frag.append(c);return}const s=document.createElement('span');s.className='ch';s.textContent=c;frag.append(s)});n.replaceWith(frag)}else if(n.nodeType===1&&n.tagName!=='BR')walk(n)})};walk(el);$$('.ch',el).forEach((c,i)=>c.style.setProperty('--i',i));};
const h1=$('.future-copy h1');
if(h1&&!reduced){split(h1);h1.classList.add('jump-text');$$('.ch',h1).forEach(c=>{const hop=()=>{c.classList.add('hop');setTimeout(()=>c.classList.remove('hop'),380)};c.addEventListener('pointerenter',hop);c.addEventListener('click',hop)});}
if(!reduced&&'IntersectionObserver'in window){
  const heads=$$('.section-head h2,.two-col h2,.partner h2,.contact h2,.slot-sec h2');
  heads.forEach(h=>{split(h);h.classList.add('wave')});
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('go');io.unobserve(e.target)}}),{threshold:.6});
  heads.forEach(h=>{io.observe(h);h.addEventListener('pointerenter',()=>{h.classList.remove('go');void h.offsetWidth;h.classList.add('go')})});
}

/* ---------- 3. カーソルリング・吸着ボタン・波紋 ---------- */
if(fine&&!reduced){
  const ring=document.createElement('div');ring.className='cursor-ring';ring.setAttribute('aria-hidden','true');
  const dot=document.createElement('div');dot.className='cursor-dot';dot.setAttribute('aria-hidden','true');
  ring.style.opacity='0';dot.style.opacity='0';document.body.append(ring,dot);
  addEventListener('pointermove',()=>{ring.style.opacity='';dot.style.opacity=''},{once:true,passive:true});
  document.addEventListener('mouseleave',()=>{ring.style.opacity='0';dot.style.opacity='0'});document.addEventListener('mouseenter',()=>{ring.style.opacity='';dot.style.opacity=''});
  let x=innerWidth/2,y=innerHeight/2,rx=x,ry=y;
  addEventListener('pointermove',e=>{x=e.clientX;y=e.clientY;dot.style.transform=`translate(${x}px,${y}px)`;ring.classList.toggle('on-link',!!e.target.closest('a,button,[role=tab],.flip,.ticker span,input,select,textarea'))},{passive:true});
  const loop=()=>{rx+=(x-rx)*.18;ry+=(y-ry)*.18;ring.style.transform=`translate(${rx}px,${ry}px)`;requestAnimationFrame(loop)};loop();
  $$('.button,.nav-cta,.karakuri-btn').forEach(b=>{b.classList.add('magnet');b.addEventListener('pointermove',e=>{const r=b.getBoundingClientRect();b.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.22}px,${(e.clientY-r.top-r.height/2)*.3}px)`});b.addEventListener('pointerleave',()=>b.style.transform='')});
}
if(!reduced)addEventListener('pointerdown',e=>{if(!e.target.closest('a,button,.flip'))return;const r=document.createElement('span');r.className='ripple';r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';document.body.append(r);setTimeout(()=>r.remove(),720)});

/* ---------- 4. 5,000社 回転メーター ---------- */
const proof=$('.proof-grid strong');
if(proof){
  const small=proof.querySelector('small');const odo=document.createElement('span');odo.className='odo';odo.setAttribute('aria-label','5,000');
  '5,000'.split('').forEach(c=>{if(c===','){const s=document.createElement('span');s.className='sep';s.textContent=',';s.setAttribute('aria-hidden','true');odo.append(s);return}const d=document.createElement('span');d.className='dg';d.setAttribute('aria-hidden','true');const b=document.createElement('b');for(let k=0;k<=19;k++){const i=document.createElement('i');i.textContent=k%10;b.append(i)}b.dataset.target=10+Number(c);d.append(b);odo.append(d)});
  proof.textContent='';proof.append(odo);if(small)proof.append(small);
  const roll=()=>$$('.dg b',odo).forEach((b,i)=>{b.style.transitionDelay=(i*.15)+'s';b.style.transform=`translateY(-${b.dataset.target}em)`});
  if(reduced){$$('.dg b',odo).forEach(b=>{b.style.transition='none';b.style.transform=`translateY(-${b.dataset.target}em)`})}
  else if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){roll();io.disconnect()}},{threshold:.5});io.observe(proof)}else roll();
  proof.style.cursor='pointer';proof.title='クリックでもう一度回す';
  proof.addEventListener('click',()=>{$$('.dg b',odo).forEach(b=>{b.style.transition='none';b.style.transform='translateY(0)'});void odo.offsetWidth;$$('.dg b',odo).forEach(b=>b.style.transition='');requestAnimationFrame(roll)});
}

/* ---------- 5. からくり装置（ボールが4つの歯車を回して成果へ） ---------- */
const kk=$('.karakuri');
if(kk){
  const svg=$('svg',kk),NS='http://www.w3.org/2000/svg';
  const gearPath=(r,teeth=12,depth=7)=>{let d='';const n=teeth*4;for(let i=0;i<n;i++){const a=i/n*Math.PI*2,rr=(i%4<2)?r:r-depth;d+=(i?'L':'M')+(Math.cos(a)*rr).toFixed(2)+','+(Math.sin(a)*rr).toFixed(2)}return d+'Z'};
  const stations=[{x:250,y:118,label:'課題整理'},{x:450,y:142,label:'解決策設計'},{x:650,y:166,label:'専門家連携'},{x:850,y:190,label:'実行支援'}];
  const R=34,BR=11;
  // ボールの中心が通る道
  let d='M70,46 ';stations.forEach(s=>{d+=`L${s.x-34},${s.y} L${s.x+34},${s.y} `});d+='L925,214 L950,258';
  const ballPath=document.createElementNS(NS,'path');ballPath.setAttribute('d',d);ballPath.setAttribute('fill','none');
  const g=$('.kk-layer',svg);
  // レール（ボールの下）
  const trackD=d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,(m,a,b)=>`${a},${(+b+BR+3).toFixed(1)}`);
  [['track-shadow'],['track']].forEach(([c])=>{const p=document.createElementNS(NS,'path');p.setAttribute('d',trackD);p.setAttribute('class',c);g.append(p)});
  stations.forEach((s,i)=>{
    const st=document.createElementNS(NS,'g');st.setAttribute('class','station');
    const cy=s.y+BR+3+R+4;
    st.innerHTML=`<path class="gear" d="${gearPath(R)}" transform="translate(${s.x},${cy})"></path><circle class="gear-hub" cx="${s.x}" cy="${cy}" r="9"></circle><text class="num" x="${s.x}" y="${cy+R+18}">STEP ${i+1}</text><text x="${s.x}" y="${cy+R+36}">${s.label}</text>`;
    g.append(st);s.el=st;s.gear=$('.gear',st);s.cy=cy;s.rot=0;
  });
  // ボール
  const ball=document.createElementNS(NS,'circle');ball.setAttribute('r',BR);ball.setAttribute('class','ball');g.append(ball);
  const L=(()=>{svg.append(ballPath);const l=ballPath.getTotalLength();return l})();
  const place=len=>{const p=ballPath.getPointAtLength(len);ball.setAttribute('cx',p.x);ball.setAttribute('cy',p.y);return p};
  place(0);
  const flowItems=$$('.flow-grid li');
  const msg=$('.karakuri-msg',kk);
  const msgs=['課題を整理しています…','解決策を設計しています…','専門家・企業とつないでいます…','実行を支援しています…'];
  let running=false;
  const confetti=()=>{const box=kk.getBoundingClientRect(),cup=$('.cup',svg).getBoundingClientRect();for(let i=0;i<36;i++){const c=document.createElement('span');c.className='confetti';c.style.background=['#ff7a1a','#ffb45c','#fff','#7fc4ff'][i%4];c.style.left=(cup.left-box.left+cup.width/2)+'px';c.style.top=(cup.top-box.top)+'px';kk.append(c);const a=-Math.PI/2+(Math.random()-.5)*2.2,v=120+Math.random()*160;c.animate([{transform:'translate(0,0) rotate(0)',opacity:1},{transform:`translate(${Math.cos(a)*v}px,${Math.sin(a)*v+140}px) rotate(${Math.random()*720}deg)`,opacity:0}],{duration:1300+Math.random()*600,easing:'cubic-bezier(.2,.7,.4,1)'}).onfinish=()=>c.remove()}};
  const run=()=>{
    if(running)return;running=true;kk.classList.remove('done');kk.classList.add('running');
    stations.forEach(s=>s.el.classList.remove('lit'));flowItems.forEach(li=>li.classList.remove('lit'));
    if(reduced){stations.forEach((s,i)=>{s.el.classList.add('lit');flowItems[i]&&flowItems[i].classList.add('lit')});place(L);kk.classList.add('done');msg.textContent='成果につながりました。';running=false;kk.classList.remove('running');return}
    let start=null,last=0,lastX=70;const dur=6200;
    const step=t=>{start??=t;const k=Math.min((t-start)/dur,1);const e=k<.08?(k/.08)**2*.08:k; // 最初だけ加速
      const len=e*L,p=place(len);
      stations.forEach((s,i)=>{if(Math.abs(p.x-s.x)<36&&Math.abs(p.y-s.y)<4){s.rot+=(p.x-lastX)/R*57.3;s.gear.setAttribute('transform',`translate(${s.x},${s.cy}) rotate(${s.rot})`)}
        if(p.x>s.x-34&&!s.el.classList.contains('lit')){s.el.classList.add('lit');flowItems[i]&&flowItems[i].classList.add('lit');msg.textContent=msgs[i]}});
      lastX=p.x;
      const sc=$('.karakuri-scroll',kk);if(sc.scrollWidth>sc.clientWidth+4){const k2=sc.scrollWidth/1000;sc.scrollLeft=p.x*k2-sc.clientWidth/2}
      if(k<1)requestAnimationFrame(step);else{kk.classList.add('done');kk.classList.remove('running');msg.textContent='成果につながりました。もう一度レバーを押すと再び動きます。';confetti();running=false}};
    requestAnimationFrame(step);
  };
  $('.karakuri-btn',kk).addEventListener('click',run);
  $('.lever-hit',svg)&&$('.lever-hit',svg).addEventListener('click',run);
  if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){setTimeout(run,400);io.disconnect()}},{threshold:.55});io.observe(kk)}
}

/* ---------- 6. 課題スロット ---------- */
const slot=$('.slot-box');
if(slot){
  const combos=[
    {issue:'売上を伸ばしたい',biz:'企画・制作・プロデュース',sup:'集客・販促の改善',topic:'produce'},
    {issue:'固定費を下げたい',biz:'固定費・仕入れ削減',sup:'コスト・業務改善',topic:'cost'},
    {issue:'通信費が高い',biz:'通信・電話関連',sup:'コスト・業務改善',topic:'tsushin'},
    {issue:'店舗の集客が弱い',biz:'店舗運営支援',sup:'集客・販促の改善',topic:'tenpo'},
    {issue:'人が定着しない',biz:'人材・採用支援',sup:'組織・人材の改善',topic:'hr'},
    {issue:'新しい収益の柱がほしい',biz:'新規事業開発',sup:'事業計画と実証',topic:'newbiz'},
    {issue:'自社商品の販路を広げたい',biz:'商材開拓・代理店展開',sup:'全国5,000社超の代理店網',topic:'shozai'},
    {issue:'衛生環境を整えたい',biz:'衛生・環境関連商材',sup:'販売店・施工店との連携',topic:'eisei'},
    {issue:'許認可・補助金が分からない',biz:'専門家連携・行政書士業務',sup:'有資格の専門家へ取次',topic:'experts'},
    {issue:'在庫を現金化したい',biz:'リユース・買取',sup:'法人向け買取',topic:'reuse'}
  ];
  const cols=['issue','biz','sup'];const reels=$$('.reel',slot);
  const pool=k=>[...new Set(combos.map(c=>c[k]))];
  const H=()=>{const d=$('.reel-strip div',slot);return d?d.offsetHeight:96};
  reels.forEach((r,i)=>{const strip=$('.reel-strip',r);const items=pool(cols[i]);let html='';for(let n=0;n<6;n++)items.forEach(t=>html+=`<div>${t}</div>`);strip.innerHTML=html;strip.dataset.count=items.length});
  const result=$('.slot-result',slot);let spinning=false,current=null;
  const show=c=>{current=c;result.innerHTML=`<p>「<b>${c.issue}</b>」なら、<b>${c.biz}</b> × <b>${c.sup}</b> の組み合わせで動けます。</p><a class="button primary slot-go" href="${(slot.dataset.contact||'#contact')+'#'+c.topic}">この内容で相談する <span>→</span></a>`;result.classList.remove('flash');void result.offsetWidth;result.classList.add('flash')};
  const setReel=(r,i,text,anim,delay)=>{const strip=$('.reel-strip',r),items=pool(cols[i]),n=items.length,idx=items.indexOf(text),h=H();
    const target=(n*4+idx)*h;
    r.classList.remove('stopped');
    if(!anim){strip.style.transition='none';strip.style.transform=`translateY(-${(n+idx)*h}px)`;return Promise.resolve()}
    strip.style.transition='none';strip.style.transform=`translateY(-${((idx+1)%n)*h}px)`;void strip.offsetWidth;
    return new Promise(res=>setTimeout(()=>{strip.style.transition=`transform ${1.1+i*.45}s cubic-bezier(.15,.85,.25,1.04)`;strip.style.transform=`translateY(-${target}px)`;setTimeout(()=>{r.classList.add('stopped');res()},(1.1+i*.45)*1000)},delay))};
  const spin=()=>{if(spinning)return;spinning=true;let c;do{c=combos[Math.floor(Math.random()*combos.length)]}while(c===current&&combos.length>1);
    result.innerHTML='<p>リールが回っています…</p>';
    Promise.all(reels.map((r,i)=>setReel(r,i,c[cols[i]],!reduced,0))).then(()=>{show(c);spinning=false})};
  // 初期表示（止まった状態で例を見せる）
  const first=combos[1];reels.forEach((r,i)=>setReel(r,i,first[cols[i]],false));show(first);
  addEventListener('resize',()=>{if(current&&!spinning)reels.forEach((r,i)=>setReel(r,i,current[cols[i]],false))});
  // レバー：クリック・キーボード・引き下げ操作
  const lever=$('.slot-lever',slot),btn=$('button',lever);let drag=null;
  const vertical=()=>getComputedStyle($('.grip',lever)).transform===''||innerWidth>820;
  const max=104;
  const pull=()=>{lever.style.setProperty('--pull',max+'px');setTimeout(()=>lever.style.setProperty('--pull','0px'),260);spin()};
  btn.addEventListener('pointerdown',e=>{drag={y:e.clientY,x:e.clientX,v:innerWidth>820};btn.setPointerCapture(e.pointerId);lever.classList.add('dragging')});
  btn.addEventListener('pointermove',e=>{if(!drag)return;const d=Math.max(0,Math.min(max,drag.v?e.clientY-drag.y:e.clientX-drag.x));drag.d=d;lever.style.setProperty('--pull',d+'px')});
  const end=()=>{if(!drag)return;lever.classList.remove('dragging');const d=drag.d||0;drag=null;if(d>max*.55){lever.style.setProperty('--pull','0px');spin()}else{pull()}};
  btn.addEventListener('pointerup',end);btn.addEventListener('pointercancel',()=>{drag=null;lever.classList.remove('dragging');lever.style.setProperty('--pull','0px')});
  btn.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pull()}});
  // 相談フォームへ自動入力
  result.addEventListener('click',e=>{if(!e.target.closest('.slot-go')||!current)return;try{sessionStorage.setItem('ma-prefill',`【課題スロットより】${current.issue}。${current.biz}（${current.sup}）について相談したいです。`)}catch(_){}});
}

/* ---------- 7. お問い合わせフォームへの自動入力 ---------- */
(()=>{const f=$('#contact-form');if(!f)return;const sel=f.querySelector('select[name=topic]'),ta=f.querySelector('textarea[name=message]');
  const apply=()=>{const k=decodeURIComponent(location.hash.slice(1));if(k&&sel&&[...sel.options].some(o=>o.value===k)){sel.value=k;const o=sel.selectedOptions[0];if(ta&&!ta.value)ta.value=`【${o.textContent}】について相談したいです。`}};
  apply();addEventListener('hashchange',apply);
  try{const m=sessionStorage.getItem('ma-prefill');if(m&&ta){ta.value=m;sessionStorage.removeItem('ma-prefill')}}catch(_){}
})();
$$('.issue-grid a[data-topic]').forEach(a=>a.addEventListener('click',()=>{const sel=$('#contact-form select[name=topic]');if(sel)sel.value=a.dataset.topic;const ta=$('#contact-form textarea[name=message]');if(ta&&!ta.value)ta.value=`【${a.querySelector('b').textContent}】について相談したいです。`}));

/* ---------- 8. 裏返る事業カード ---------- */
const backs=[
  {t:'通信・電話関連',items:['通信回線の見直し','電話サービス']},
  {t:'店舗運営支援',items:['キャッシュレス決済','店舗集客システム','多言語対応']},
  {t:'固定費・仕入れ削減',items:['名刺料金の削減','賃料の適正化','節水・インフラ見直し']},
  {t:'映像・ホームページ制作',items:['商品・音楽紹介映像','広告・企業ムービー','番組制作','ホームページ制作']},
  {t:'衛生・環境関連商材',items:['スーパーナノクリーンγ','販売店向け資料・エビデンス','施工店・販売店募集']},
  {t:'商材開拓・代理店展開',items:['天然石','中古車販売','不動産関連商材','仕入代行・貿易']}
];
$$('.business-grid article').forEach((a,i)=>{
  const b=backs[i];if(!b)return;
  const front=document.createElement('div');front.className='face front';while(a.firstChild)front.append(a.firstChild);
  const hint=document.createElement('p');hint.className='flip-hint';hint.textContent='めくると主な取扱商材';front.append(hint);
  const glare=document.createElement('i');glare.className='glare';front.append(glare);
  const back=document.createElement('div');back.className='face back';back.innerHTML=`<h4>主な取扱商材</h4><h3>${b.t}</h3><ul>${b.items.map(x=>`<li>${x}</li>`).join('')}</ul><a class="back-cta" href="#contact">この商材について聞く →</a>`;
  const inner=document.createElement('div');inner.className='flip-inner';inner.append(front,back);a.append(inner);
  a.classList.add('flip');a.tabIndex=0;a.setAttribute('role','button');a.setAttribute('aria-pressed','false');a.setAttribute('aria-label',b.t+'：めくって主な取扱商材を見る');
  const flip=()=>{const on=a.classList.toggle('flipped');a.setAttribute('aria-pressed',String(on))};
  a.addEventListener('click',e=>{if(e.target.closest('.back-cta')){const sel=$('#contact-form select[name=topic]');if(sel)sel.value=b.t;return}flip()});
  a.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();flip()}});
  if(fine&&!reduced){a.addEventListener('pointermove',e=>{if(a.classList.contains('flipped'))return;const r=a.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;inner.style.transform=`rotateX(${(.5-py)*10}deg) rotateY(${(px-.5)*12}deg)`;front.style.setProperty('--gx',px*100+'%');front.style.setProperty('--gy',py*100+'%')});a.addEventListener('pointerleave',()=>inner.style.transform='');a.addEventListener('click',()=>inner.style.transform='')}
});

/* ---------- 9. メイン画面の粒子：カーソルに集まってつながる ---------- */
const cv=$('.motion-canvas');
if(cv&&!reduced){
  const ctx=cv.getContext('2d');let w=0,h=0,ps=[],m={x:-999,y:-999},bursts=[];
  const rs=()=>{const b=cv.getBoundingClientRect(),r=Math.min(devicePixelRatio||1,2);w=b.width;h=b.height;cv.width=w*r;cv.height=h*r;ctx.setTransform(r,0,0,r,0,0);ps=Array.from({length:Math.min(110,Math.floor(w/12))},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.35,vy:-(.15+Math.random()*.45),r:.6+Math.random()*1.6,a:.18+Math.random()*.45}))};
  rs();addEventListener('resize',rs,{passive:true});
  hero.addEventListener('pointermove',e=>{const b=cv.getBoundingClientRect();m.x=e.clientX-b.left;m.y=e.clientY-b.top});
  hero.addEventListener('pointerleave',()=>{m.x=m.y=-999});
  hero.addEventListener('click',e=>{if(e.target.closest('a,button'))return;const b=cv.getBoundingClientRect();bursts.push({x:e.clientX-b.left,y:e.clientY-b.top,t:0});ps.forEach(p=>{const dx=p.x-(e.clientX-b.left),dy=p.y-(e.clientY-b.top),d=Math.hypot(dx,dy)||1;if(d<260){p.vx+=dx/d*2.4;p.vy+=dy/d*2.4}})});
  let visible=true;if('IntersectionObserver'in window)new IntersectionObserver(es=>{visible=es[0].isIntersecting}).observe(hero);
  const draw=()=>{requestAnimationFrame(draw);if(!visible)return;ctx.clearRect(0,0,w,h);
    ps.forEach(p=>{const dx=m.x-p.x,dy=m.y-p.y,d=Math.hypot(dx,dy);if(d<180){p.vx+=dx/d*.035;p.vy+=dy/d*.035}
      p.vx*=.97;p.vy=p.vy*.97-.012;p.x+=p.vx;p.y+=p.vy;if(p.y<-10){p.y=h+10;p.x=Math.random()*w}if(p.x<-10)p.x=w+10;if(p.x>w+10)p.x=-10;if(p.y>h+20)p.y=-5;
      ctx.beginPath();ctx.fillStyle=`rgba(255,150,70,${p.a})`;ctx.arc(p.x,p.y,p.r,0,6.283);ctx.fill();
      if(d<150){ctx.strokeStyle=`rgba(255,140,60,${(1-d/150)*.5})`;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(m.x,m.y);ctx.stroke()}});
    // 近くの粒子同士もつながる
    for(let i=0;i<ps.length;i++){const a=ps[i];if(Math.hypot(a.x-m.x,a.y-m.y)>230)continue;for(let j=i+1;j<ps.length;j++){const b=ps[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d<70){ctx.strokeStyle=`rgba(255,180,92,${(1-d/70)*.28})`;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}}
    bursts=bursts.filter(b=>b.t<1);bursts.forEach(b=>{b.t+=.025;ctx.strokeStyle=`rgba(255,122,26,${1-b.t})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,b.t*220,0,6.283);ctx.stroke()});
  };draw();
}
})();
