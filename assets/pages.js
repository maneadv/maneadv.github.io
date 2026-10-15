/* ==========================================================
   ページ別のからくり（Version 11）
   ========================================================== */
(()=>{
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine=matchMedia('(pointer:fine)').matches;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const page=document.body.dataset.page;
const onView=(el,fn,th=.35)=>{if(!el)return;if(!('IntersectionObserver'in window)){fn();return}const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){fn();io.disconnect()}},{threshold:th});io.observe(el)};
const store={get(k){try{return sessionStorage.getItem(k)}catch(_){return null}},set(k,v){try{sessionStorage.setItem(k,v)}catch(_){}}};

/* ---------- 共通：下層見出しの文字が揃う／紋章がスクロールで回る ---------- */
const sc=$('.page-hero h1.scramble');
if(sc&&!reduced){
  const final=sc.textContent,pool='アイウエオカキクケコサシスセソタチツテトナニヌネノ経営事業相談支援連携実行成果0123456789';
  sc.setAttribute('aria-label',final);let f=0;const total=14;
  const tick=()=>{f++;const out=[...final].map((c,i)=>{if(/\s|・|／/.test(c))return c;return i<(f/total)*final.length?c:pool[Math.floor(Math.random()*pool.length)]}).join('');sc.textContent=out;if(f<total)requestAnimationFrame(()=>setTimeout(tick,28));else sc.textContent=final};
  tick();
}
const em=$('.hero-emblem');
if(em&&!reduced){
  addEventListener('scroll',()=>{em.style.setProperty('--spin',(scrollY*.35)+'deg')},{passive:true});
  if(fine)em.parentElement.addEventListener('pointermove',e=>{const r=em.parentElement.getBoundingClientRect();em.style.setProperty('--ex',((e.clientX-r.left)/r.width-.5)*18+'px');em.style.setProperty('--ey',((e.clientY-r.top)/r.height-.5)*12+'px')});
}

/* ---------- 事業内容一覧：星座マップ・カードが配られる ---------- */
if(page==='business'){
  const stage=$('.orbit-stage');
  const cats=$$('.cat-sec').map(sec=>({id:sec.id,name:$('.cat-head h2',sec).textContent.trim(),icon:$('.cat-head h2 i',sec).textContent,biz:$$('.biz-card',sec).map(a=>({name:$('b',a).textContent,href:a.getAttribute('href')}))}));
  if(stage){
    const nodes=[];
    cats.forEach((c,ci)=>{
      const cn=document.createElement('a');cn.className='cat-node';cn.href='#'+c.id;cn.innerHTML=`<i>${c.icon}</i><span>${c.name.replace(c.icon,'').trim()}</span>`;stage.append(cn);
      const sats=c.biz.map((b,bi)=>{const s=document.createElement('a');s.className='sat';s.href=b.href;s.setAttribute('aria-label',b.name);s.innerHTML=`<span>${b.name}</span>`;stage.append(s);return {el:s,b0:bi/c.biz.length*6.283}});
      nodes.push({el:cn,a0:ci/cats.length*6.283-1.5708,sats});
    });
    let t=0,paused=false,last=performance.now();
    stage.addEventListener('pointerenter',()=>paused=true);stage.addEventListener('pointerleave',()=>paused=false);
    stage.addEventListener('focusin',()=>paused=true);stage.addEventListener('focusout',()=>paused=false);
    const frame=now=>{const dt=Math.min(50,now-last);last=now;if(!paused&&!reduced)t+=dt/1000;
      const w=stage.clientWidth,h=stage.clientHeight,cx=w/2,cy=h/2,R=Math.min(w,h)*.36,r=Math.max(38,Math.min(w,h)*.11);
      nodes.forEach(n=>{const a=n.a0+t*.12,x=cx+Math.cos(a)*R,y=cy+Math.sin(a)*R*.82;n.el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
        n.sats.forEach(s=>{const b=s.b0+t*.6;s.el.style.transform=`translate(${x+Math.cos(b)*r}px,${y+Math.sin(b)*r}px) translate(-50%,-50%)`})});
      requestAnimationFrame(frame)};
    requestAnimationFrame(frame);
  }
  // カードが配られる
  if(!reduced)$$('.cat-sec').forEach(sec=>{const cards=$$('.biz-card',sec);cards.forEach((c,i)=>{c.style.setProperty('--deal',i)});sec.classList.add('deal-ready');onView(sec,()=>sec.classList.add('dealt'),.2)});
  // 分類ボタン：押すとその分類が光る
  $$('.chip-nav a').forEach(a=>a.addEventListener('click',()=>{const t=$(a.getAttribute('href'));if(!t)return;t.classList.remove('flash-sec');void t.offsetWidth;t.classList.add('flash-sec')}));
}

/* ---------- 各事業：相談メモ・流れの再生 ---------- */
if(page==='detail'){
  const basket=$('.memo-basket'),count=$('.memo-count');const key='ma-memo:'+location.pathname;
  let picked=new Set(JSON.parse(store.get(key)||'[]'));
  const sync=()=>{count.textContent=picked.size;basket.hidden=picked.size===0;store.set(key,JSON.stringify([...picked]));
    const msg=`【${basket.dataset.biz}】について相談したいです。\n・`+[...picked].join('\n・');if(picked.size)store.set('ma-prefill',msg)};
  $$('.memo-item').forEach(btn=>{const t=$('.memo-text',btn).textContent;if(picked.has(t)){btn.classList.add('on');btn.setAttribute('aria-pressed','true')}
    btn.addEventListener('click',()=>{const on=!picked.has(t);on?picked.add(t):picked.delete(t);btn.classList.toggle('on',on);btn.setAttribute('aria-pressed',String(on));sync();
      if(on&&!reduced){// 項目が相談メモへ飛んでいく
        basket.hidden=false;const a=btn.getBoundingClientRect(),b=basket.getBoundingClientRect();const dot=document.createElement('span');dot.className='fly-dot';dot.textContent='✎';document.body.append(dot);
        dot.animate([{transform:`translate(${a.right-30}px,${a.top+a.height/2}px) scale(1)`},{transform:`translate(${(a.right+b.left)/2}px,${Math.min(a.top,b.top)-120}px) scale(1.4)`},{transform:`translate(${b.left+20}px,${b.top+b.height/2}px) scale(.6)`}],{duration:700,easing:'cubic-bezier(.4,0,.2,1)'}).onfinish=()=>{dot.remove();basket.classList.remove('bump');void basket.offsetWidth;basket.classList.add('bump')}}})});
  sync();
  // 相談するボタン：メモがあればフォームへ渡す
  $$('.detail-cta a,.memo-go').forEach(a=>a.addEventListener('click',()=>{if(picked.size)sync()}));
  // 流れの再生：コマが一つずつ進む
  const play=$('.flow-play'),steps=$$('.flow-blk .steps li');
  if(play&&steps.length){
    const token=document.createElement('span');token.className='flow-token';token.setAttribute('aria-hidden','true');$('.flow-blk .steps').append(token);
    let running=false;
    const run=()=>{if(running)return;running=true;steps.forEach(s=>s.classList.remove('lit'));play.disabled=true;let i=0;
      const step=()=>{const li=steps[i],r=li.getBoundingClientRect(),pr=li.parentElement.getBoundingClientRect();token.style.transform=`translate(${r.left-pr.left+r.width/2-14}px,${r.top-pr.top-14}px)`;token.classList.add('show');
        setTimeout(()=>{li.classList.add('lit');i++;if(i<steps.length)setTimeout(step,reduced?0:380);else{running=false;play.disabled=false;setTimeout(()=>token.classList.remove('show'),600)}},reduced?0:320)};step()};
    play.addEventListener('click',run);onView($('.flow-blk'),()=>setTimeout(run,300),.6);
  }
}

/* ---------- 私たちについて：相談玉の振り分け台 ---------- */
const pk=$('canvas.plinko');
if(pk){
  const ctx=pk.getContext('2d'),msg=$('.plinko-msg'),btn=$('.plinko-btn');
  const bins=[{t:'自社で対応',c:'#ff7a1a',ex:['経営相談・事業計画づくり','ホームページ・映像の制作','業務ツールの開発','代理店網での販路拡大']},{t:'提携企業が提供',c:'#ffb45c',ex:['通信回線・電話サービスの見直し','名刺料金・賃料の見直し','キャッシュレス決済の導入','遺品整理・空き家の解体']},{t:'専門家へおつなぎ',c:'#7fc4ff',ex:['許認可の申請（行政書士）','決算・税務（税理士）','就業規則・労務（社会保険労務士）','契約トラブル（弁護士）']}];
  let W,H,pegs=[],balls=[],landed=[0,0,0];const ROWS=7;
  const size=()=>{const r=Math.min(devicePixelRatio||1,2);W=pk.clientWidth;H=pk.clientHeight||360;pk.width=W*r;pk.height=H*r;ctx.setTransform(r,0,0,r,0,0);pegs=[];const gap=Math.min(W/10,60);const rg=(H-150)/(ROWS-1);for(let row=0;row<ROWS;row++){const n=row+3;for(let k=0;k<n;k++)pegs.push({x:W/2+(k-(n-1)/2)*gap,y:40+row*rg,hit:0})}};
  size();addEventListener('resize',size);
  const binX=i=>W*(i+.5)/3;
  const draw=()=>{ctx.clearRect(0,0,W,H);
    // 受け皿
    bins.forEach((b,i)=>{const x=W*i/3;ctx.fillStyle='rgba(255,255,255,.03)';ctx.fillRect(x+6,H-78,W/3-12,72);ctx.strokeStyle=b.c;ctx.globalAlpha=.6;ctx.strokeRect(x+6,H-78,W/3-12,72);ctx.globalAlpha=1;ctx.fillStyle=b.c;ctx.font=`700 ${Math.max(10,Math.min(13,W/34))}px "Noto Sans JP",sans-serif`;ctx.textAlign='center';ctx.fillText(b.t,x+W/6,H-48);ctx.fillStyle='#93a6b9';ctx.font='600 11px "Noto Sans JP",sans-serif';ctx.fillText(landed[i]+'個',x+W/6,H-28)});
    pegs.forEach(p=>{p.hit*=.9;ctx.beginPath();ctx.arc(p.x,p.y,4+p.hit*3,0,6.283);ctx.fillStyle=p.hit>.1?`rgba(255,180,92,${.5+p.hit/2})`:'#c99a5b';ctx.fill()});
    balls.forEach(b=>{b.vy+=.32;b.x+=b.vx;b.y+=b.vy;b.vx*=.99;
      pegs.forEach(p=>{const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy);if(d<12&&d>0){b.x=p.x+dx/d*12;b.y=p.y+dy/d*12;const n=(b.vx*dx+b.vy*dy)/d;b.vx-=1.5*n*dx/d;b.vy-=1.5*n*dy/d;b.vx+=(b.bias)*.35;p.hit=1}});
      if(b.x<8){b.x=8;b.vx=Math.abs(b.vx)}if(b.x>W-8){b.x=W-8;b.vx=-Math.abs(b.vx)}
      if(b.y>H-50&&!b.done){b.done=true;const i=Math.max(0,Math.min(2,Math.floor(b.x/(W/3))));landed[i]++;const ex=bins[i].ex[Math.floor(Math.random()*bins[i].ex.length)];msg.innerHTML=`<b style="color:${bins[i].c}">${bins[i].t}</b>　例：${ex}`;btn.disabled=false}
      if(b.y>H-20){b.y=H-20;b.vy*=-.3;b.vx*=.6}
      ctx.beginPath();ctx.arc(b.x,b.y,7,0,6.283);const g=ctx.createRadialGradient(b.x-2,b.y-2,1,b.x,b.y,7);g.addColorStop(0,'#fff3e2');g.addColorStop(.5,'#ff9b45');g.addColorStop(1,'#b44a08');ctx.fillStyle=g;ctx.fill()});
    requestAnimationFrame(draw)};
  draw();
  const drop=()=>{if(reduced){const i=Math.floor(Math.random()*3);landed[i]++;msg.innerHTML=`<b style="color:${bins[i].c}">${bins[i].t}</b>　例：${bins[i].ex[0]}`;return}
    btn.disabled=true;balls.push({x:W/2+(Math.random()-.5)*8,y:12,vx:0,vy:0,bias:(Math.floor(Math.random()*3)-1)});if(balls.length>6)balls.shift()};
  btn.addEventListener('click',drop);pk.addEventListener('click',drop);
  onView(pk,()=>setTimeout(drop,400),.5);
}

/* ---------- 代理店：広がる代理店網 ---------- */
const nc=$('.net-canvas');
if(nc){
  const ctx=nc.getContext('2d'),num=$('.net-num');let W,H,nodes=[],links=[],pulses=[],shown=0,target=0;
  const size=()=>{const r=Math.min(devicePixelRatio||1,2);W=nc.clientWidth;H=380;nc.width=W*r;nc.height=H*r;ctx.setTransform(r,0,0,r,0,0)};
  size();addEventListener('resize',size);
  const add=(x,y,me)=>{const n={x,y,r:me?7:3.5,me,born:performance.now()};const near=nodes.map(o=>({o,d:Math.hypot(o.x-x,o.y-y)})).sort((a,b)=>a.d-b.d).slice(0,me?5:2);nodes.push(n);near.forEach(({o})=>{links.push({a:n,b:o,t:0});pulses.push({a:n,b:o,t:0})});target+=me?near.length+3:near.length};
  // 初期の網
  const seed=()=>{nodes=[];links=[];pulses=[];for(let i=0;i<46;i++)add(20+Math.random()*(W-40),20+Math.random()*(H-40),false);target=0;shown=0};
  seed();
  const draw=()=>{ctx.clearRect(0,0,W,H);
    links.forEach(l=>{l.t=Math.min(1,l.t+.03);ctx.strokeStyle=l.a.me||l.b.me?'rgba(255,150,70,.55)':'rgba(255,255,255,.12)';ctx.lineWidth=l.a.me?1.4:.8;ctx.beginPath();ctx.moveTo(l.a.x,l.a.y);ctx.lineTo(l.a.x+(l.b.x-l.a.x)*l.t,l.a.y+(l.b.y-l.a.y)*l.t);ctx.stroke()});
    pulses.forEach(p=>{p.t+=.012;if(p.t>1){p.t=0;const nx=links[Math.floor(Math.random()*links.length)];if(nx){p.a=nx.a;p.b=nx.b}}const x=p.a.x+(p.b.x-p.a.x)*p.t,y=p.a.y+(p.b.y-p.a.y)*p.t;ctx.beginPath();ctx.arc(x,y,1.8,0,6.283);ctx.fillStyle='rgba(255,180,92,.9)';ctx.fill()});
    const now=performance.now();
    nodes.forEach(n=>{const age=Math.min(1,(now-n.born)/500);ctx.beginPath();ctx.arc(n.x,n.y,n.r*age,0,6.283);ctx.fillStyle=n.me?'#ff7a1a':'#c9d6e2';ctx.fill();if(n.me){const k=((now-n.born)%1600)/1600;ctx.beginPath();ctx.arc(n.x,n.y,7+k*26,0,6.283);ctx.strokeStyle=`rgba(255,122,26,${1-k})`;ctx.lineWidth=1.5;ctx.stroke()}});
    if(shown<target){shown++;num.textContent=shown}
    if(!reduced||nodes.length)requestAnimationFrame(draw)};
  draw();
  nc.addEventListener('click',e=>{const r=nc.getBoundingClientRect();add(e.clientX-r.left,e.clientY-r.top,true)});
  $('.net-btn').addEventListener('click',()=>add(30+Math.random()*(W-60),30+Math.random()*(H-60),true));
}

/* ---------- 採用：仕事タイプ診断 ---------- */
const quiz=$('.quiz');
if(quiz){
  const Q=[
    {q:'人と話すのは好きですか？',a:[['大好き。初対面でも平気',{s:2}],['慣れた相手なら',{j:1,p:1}],['黙々と作業したい',{j:2}]]},
    {q:'うれしいのはどんな時？',a:[['成果が数字で見えた時',{s:2}],['書類や仕組みがきれいに整った時',{j:2}],['自分の時間と両立できた時',{p:2}]]},
    {q:'働き方の希望は？',a:[['がっつり稼ぎたい',{s:2}],['安定して長く働きたい',{j:2}],['短時間・曜日を選びたい',{p:2}]]}
  ];
  const R={s:['営業職','多数の商材を扱い、成果が歩合に反映される仕事です。人と話すのが好きな方に向いています。','月給16万円〜30万円＋歩合'],j:['事務職','書類・データ・受発注を整え、営業を支える仕事です。正確さと段取りが活きます。','月給14万円〜25万円'],p:['アルバイト・パート','時間や曜日の相談がしやすい働き方です。未経験から始められます。','900円〜1,500円']};
  const body=$('.quiz-body'),bar=$('.quiz-bar i'),stepT=$('.quiz-step');let i=0,score={s:0,j:0,p:0};
  const render=()=>{bar.style.width=(i/Q.length*100)+'%';
    if(i<Q.length){stepT.textContent=`質問 ${i+1} ／ ${Q.length}`;body.innerHTML=`<p class="quiz-q">${Q[i].q}</p><div class="quiz-a">${Q[i].a.map((a,k)=>`<button type="button" data-k="${k}">${a[0]}</button>`).join('')}</div>`;
      $$('.quiz-a button',body).forEach(b=>b.addEventListener('click',()=>{const add=Q[i].a[b.dataset.k][1];for(const k in add)score[k]+=add[k];b.classList.add('chosen');setTimeout(()=>{i++;body.classList.add('swap');setTimeout(()=>{body.classList.remove('swap');render()},reduced?0:220)},reduced?0:250)}))}
    else{const best=Object.entries(score).sort((a,b)=>b[1]-a[1])[0][0];const r=R[best];stepT.textContent='診断結果';
      body.innerHTML=`<div class="quiz-result"><span class="quiz-badge">あなたに合いそうなのは</span><b>${r[0]}</b><p>${r[1]}</p><p class="quiz-pay">給与の目安：${r[2]}</p><div class="quiz-actions"><a class="button primary" href="../contact/index.html#recruit">この職種に応募・質問する <span>→</span></a><button type="button" class="quiz-retry">もう一度</button></div></div>`;
      store.set('ma-prefill',`【採用について】${r[0]}に興味があります。`);
      $('.quiz-retry',body).addEventListener('click',()=>{i=0;score={s:0,j:0,p:0};render()});
      if(!reduced)for(let k=0;k<24;k++){const c=document.createElement('span');c.className='confetti';c.style.background=['#ff7a1a','#ffb45c','#fff','#7fc4ff'][k%4];c.style.left='50%';c.style.top='40%';quiz.append(c);const a=Math.random()*6.28,v=80+Math.random()*120;c.animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${Math.cos(a)*v}px,${Math.sin(a)*v+80}px) rotate(${Math.random()*600}deg)`,opacity:0}],{duration:1200,easing:'ease-out'}).onfinish=()=>c.remove()}}};
  render();
}

/* ---------- 会社概要：パタパタ表示 ---------- */
const ft=$('.flap-table');
if(ft&&!reduced){
  const cells=$$('td',ft).filter(td=>!td.querySelector('.pending')&&td.children.length===0);
  const glyphs='アイウエオカキクケコサシスセソタチツテトABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  onView(ft,()=>{cells.forEach((td,ci)=>{const final=td.textContent;const chars=[...final];td.textContent='';td.setAttribute('aria-label',final);const spans=chars.map(c=>{const s=document.createElement('span');s.className='flap';s.textContent=c===' '?' ':glyphs[Math.floor(Math.random()*glyphs.length)];td.append(s);return s});
    spans.forEach((s,k)=>{let n=0;const max=4+k%5+ci*2;const t=setInterval(()=>{n++;if(n>=max){clearInterval(t);s.textContent=chars[k]===' '?' ':chars[k];s.classList.add('set')}else{s.textContent=glyphs[Math.floor(Math.random()*glyphs.length)];s.classList.remove('flip');void s.offsetWidth;s.classList.add('flip')}},55)})});
    $$('.pending',ft).forEach((p,k)=>{p.style.animationDelay=(.4+k*.15)+'s';p.classList.add('stamp')})},.2);
}

/* ---------- お問い合わせ：進み具合・紙飛行機 ---------- */
const form=$('#contact-form');
if(page==='contact'&&form){
  const req=$$('[required]',form),fill=$('.gauge-fill'),plane=$('.gauge-plane'),txt=$('.gauge-text b');
  const upd=()=>{const picks=['1','2','3'].filter(l=>form.querySelector(`.chips[data-level="${l}"] .chip.on`)).length;const ok=req.filter(el=>el.type==='checkbox'?el.checked:el.value.trim()&&el.checkValidity()).length+picks;const pc=Math.round(ok/(req.length+3)*100);fill.style.width=pc+'%';plane.style.left=`calc(${pc}% - 12px)`;txt.textContent=pc;$('.gauge').classList.toggle('full',pc===100)};
  form.addEventListener('input',upd);form.addEventListener('change',upd);setTimeout(upd,50);
  form.addEventListener('submit',()=>{if(reduced)return;const r=form.getBoundingClientRect();const p=document.createElement('span');p.className='paper-plane';p.textContent='✈';document.body.append(p);form.classList.add('folding');
    p.animate([{transform:`translate(${r.left+r.width/2}px,${r.top+r.height/2}px) scale(.4) rotate(0deg)`,opacity:0},{transform:`translate(${r.left+r.width/2}px,${r.top+r.height/2}px) scale(2) rotate(-10deg)`,opacity:1,offset:.25},{transform:`translate(${innerWidth+80}px,${r.top-260}px) scale(1) rotate(-25deg)`,opacity:1}],{duration:1400,easing:'cubic-bezier(.5,0,.3,1)'}).onfinish=()=>p.remove();
    setTimeout(()=>form.classList.remove('folding'),900)});
}

/* ---------- 個人情報：読むと鍵が閉まる ---------- */
const lock=$('.lock-widget');
if(lock){
  const pol=$('.policy'),fillR=$('.lock-fill'),lab=$('.lock-label b');
  const upd=()=>{const r=pol.getBoundingClientRect();const pc=Math.max(0,Math.min(1,(innerHeight*.7-r.top)/r.height));const h=24*pc;fillR.setAttribute('y',46-h);fillR.setAttribute('height',h);lab.textContent=Math.round(pc*100);lock.classList.toggle('locked',pc>.98)};
  addEventListener('scroll',upd,{passive:true});upd();
}
})();
