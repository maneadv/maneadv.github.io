/* ==========================================================
   事業ページ17種のからくり ＋ 各ページ下部のからくり（Version 12）
   ========================================================== */
(()=>{
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const h=(html)=>{const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild};
const rnd=(a,b)=>a+Math.random()*(b-a);
const onView=(el,fn,th=.4)=>{if(!('IntersectionObserver'in window)){fn();return}const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){fn();io.disconnect()}},{threshold:th});io.observe(el)};
const burst=(host,x,y,n=26)=>{if(reduced)return;for(let k=0;k<n;k++){const c=document.createElement('span');c.className='confetti';c.style.background=['#ff7a1a','#ffb45c','#fff','#7fc4ff'][k%4];c.style.left=x+'px';c.style.top=y+'px';host.append(c);const a=rnd(0,6.28),v=rnd(60,170);c.animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${Math.cos(a)*v}px,${Math.sin(a)*v+90}px) rotate(${rnd(0,700)}deg)`,opacity:0}],{duration:rnd(900,1500),easing:'cubic-bezier(.2,.7,.4,1)'}).onfinish=()=>c.remove()}};
const say=(el,txt)=>{el.textContent=txt;el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop')};
const canvasFit=(cv,hgt)=>{const r=Math.min(devicePixelRatio||1,2);const w=cv.clientWidth;cv.width=w*r;cv.height=hgt*r;const ctx=cv.getContext('2d');ctx.setTransform(r,0,0,r,0,0);return [ctx,w,hgt]};

const FUN={};

/* 01 企業支援：経営の天秤 */
FUN.management=s=>{
  s.innerHTML=`<div class="scale"><svg viewBox="0 0 400 230" class="scale-svg"><polygon points="190,215 210,215 200,70" class="sc-post"/><rect x="150" y="212" width="100" height="10" rx="4" class="sc-post"/><g class="sc-beam"><rect x="60" y="66" width="280" height="8" rx="4" class="sc-bar"/><circle cx="200" cy="70" r="9" class="sc-pin"/></g><g class="sc-pan L"><line x1="0" y1="0" x2="-34" y2="60"/><line x1="0" y1="0" x2="34" y2="60"/><path d="M-50 60 h100 q-8 22 -50 22 q-42 0 -50 -22z"/><text y="102">課題</text><g class="w"></g></g><g class="sc-pan R"><line x1="0" y1="0" x2="-34" y2="60"/><line x1="0" y1="0" x2="34" y2="60"/><path d="M-50 60 h100 q-8 22 -50 22 q-42 0 -50 -22z"/><text y="102">解決策</text><g class="w"></g></g></svg></div>
  <div class="fun-btns"><button type="button" data-w="売上">売上の悩みをのせる</button><button type="button" data-w="費用">費用の悩みをのせる</button><button type="button" data-w="人材">人材の悩みをのせる</button><button type="button" class="hot" data-solve>解決策をのせる</button></div><p class="fun-msg">悩みをのせると、天秤が傾きます。</p>`;
  const L=[],R=[],beam=$('.sc-beam',s),pl=$('.sc-pan.L',s),pr=$('.sc-pan.R',s),msg=$('.fun-msg',s);
  const draw=()=>{const ang=Math.max(-22,Math.min(22,(R.length-L.length)*7));beam.setAttribute('transform',`rotate(${ang} 200 70)`);const a=ang*Math.PI/180;
    [[pl,-130,L],[pr,130,R]].forEach(([g,dx,arr])=>{const x=200+dx*Math.cos(a),y=70+dx*Math.sin(a);g.setAttribute('transform',`translate(${x} ${y})`);$('.w',g).innerHTML=arr.map((t,i)=>`<g transform="translate(${(i%3-1)*30} ${52-Math.floor(i/3)*18})"><rect x="-14" y="-14" width="28" height="16" rx="3" class="wt ${arr===R?'ok':''}"/><text y="-2" class="wtx">${t}</text></g>`).join('')})};
  $$('[data-w]',s).forEach(b=>b.onclick=()=>{if(L.length>=6)return;L.push(b.dataset.w);draw();say(msg,`「${b.dataset.w}」の悩みが重くのしかかっています…`)});
  $('[data-solve]',s).onclick=()=>{if(!L.length){say(msg,'まず悩みをのせてください。');return}if(R.length<L.length){R.push(L[R.length]);draw()}
    if(R.length===L.length){say(msg,'つり合いました。課題ごとに解決策を用意します。');const r=s.getBoundingClientRect();burst(s,r.width/2,90);setTimeout(()=>{L.length=0;R.length=0;draw()},2600)}else say(msg,`解決策を1つのせました（あと${L.length-R.length}つ）`)};
  draw();
};

/* 02 専門家連携：専門家の扉 */
FUN.experts=s=>{
  const Q=[['会社をつくりたい・登記したい','司法書士','§'],['営業の許可を取りたい','行政書士','✎'],['決算・節税を相談したい','税理士','¥'],['就業規則・社会保険を整えたい','社会保険労務士','◎'],['契約のもめごとを解決したい','弁護士','⚖']];
  s.innerHTML=`<div class="doors"><div class="door-q">${Q.map((q,i)=>`<button type="button" data-i="${i}">${q[0]}</button>`).join('')}</div><div class="door-box"><div class="door-in"><b class="door-icon">?</b><span class="door-who">相談内容を選ぶと<br>扉が開きます</span></div><i class="door-l"></i><i class="door-r"></i></div></div><p class="fun-msg">どの専門家につなぐかを、当社が整理します。</p>`;
  const box=$('.door-box',s),icon=$('.door-icon',s),who=$('.door-who',s),msg=$('.fun-msg',s);
  $$('.door-q button',s).forEach(b=>b.onclick=()=>{const q=Q[b.dataset.i];$$('.door-q button',s).forEach(x=>x.classList.toggle('on',x===b));box.classList.remove('open');
    setTimeout(()=>{icon.textContent=q[2];who.innerHTML=`<small>おつなぎ先</small>${q[1]}`;box.classList.add('open');say(msg,`「${q[0]}」は${q[1]}へおつなぎします。`)},reduced?0:350)});
};

/* 03 人材：定着の木 */
FUN.hr=s=>{
  s.innerHTML=`<div class="tree"><svg viewBox="0 0 300 220"><path class="trunk" d="M140 215 q5 -60 -5 -110 l12 0 q-4 40 18 60 l-8 6 q-10 -10 -12 -20 q0 30 10 64z"/><g class="leaves"></g><g class="fruits"></g><rect x="40" y="212" width="220" height="6" rx="3" class="ground"/></svg></div><div class="fun-btns"><button type="button">研修を行う</button><button type="button">職場を改善する</button><button type="button">福利厚生を整える</button></div><p class="fun-msg">施策を重ねると、木が育ちます。</p>`;
  const leaves=$('.leaves',s),fruits=$('.fruits',s),msg=$('.fun-msg',s);let n=0;
  const grow=label=>{if(n>=24){leaves.innerHTML='';fruits.innerHTML='';n=0;say(msg,'もう一度育ててみましょう。');return}
    for(let k=0;k<4;k++){n++;const a=rnd(0,6.28),r=rnd(10,62);const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',150+Math.cos(a)*r*1.3);c.setAttribute('cy',88+Math.sin(a)*r*.75);c.setAttribute('r',rnd(9,16));c.setAttribute('class','leaf');c.style.animationDelay=k*80+'ms';leaves.append(c)}
    say(msg,`「${label}」で葉が増えました（${n}枚）`);
    if(n>=24){for(let k=0;k<6;k++){const f=document.createElementNS('http://www.w3.org/2000/svg','circle');f.setAttribute('cx',rnd(90,210));f.setAttribute('cy',rnd(50,130));f.setAttribute('r',6);f.setAttribute('class','fruit');f.style.animationDelay=k*120+'ms';fruits.append(f)}say(msg,'実がなりました。人が育ち、定着する職場です。');burst(s,s.clientWidth/2,80)}};
  $$('.fun-btns button',s).forEach(b=>b.onclick=()=>grow(b.textContent));$('svg',s).onclick=()=>grow('水やり');
};

/* 04 事業連携：つなぐ線 */
FUN.alliance=s=>{
  const A=['飲食店','小売店','不動産会社'],B=['決済サービス','買取店','整理業者'];
  const S={'飲食店|決済サービス':'キャッシュレスで客単価アップ','飲食店|買取店':'食器・厨房機器の入替を買取で','飲食店|整理業者':'閉店・移転の片付けを一括で','小売店|決済サービス':'レジ待ちを減らして回転率アップ','小売店|買取店':'店頭で買取催事、来店のきっかけに','小売店|整理業者':'在庫・什器の整理を手早く','不動産会社|決済サービス':'家賃・手数料の支払いを簡単に','不動産会社|買取店':'空き家の家財を買取で現金化','不動産会社|整理業者':'空き家の整理から売却まで一気通貫'};
  s.innerHTML=`<div class="link-board"><svg class="link-svg"></svg><div class="col l">${A.map(x=>`<button type="button" data-v="${x}">${x}</button>`).join('')}</div><div class="col r">${B.map(x=>`<button type="button" data-v="${x}">${x}</button>`).join('')}</div></div><p class="fun-msg">左と右を1つずつ押すと、企業同士がつながります。</p>`;
  const svg=$('.link-svg',s),msg=$('.fun-msg',s);let pick=null;const made=new Set();
  $$('.col.l button',s).forEach(b=>b.onclick=()=>{$$('.col.l button',s).forEach(x=>x.classList.toggle('sel',x===b));pick=b});
  $$('.col.r button',s).forEach(b=>b.onclick=()=>{if(!pick){say(msg,'先に左側の企業を選んでください。');b.classList.add('shake');setTimeout(()=>b.classList.remove('shake'),400);return}
    const k=pick.dataset.v+'|'+b.dataset.v,br=$('.link-board',s).getBoundingClientRect(),a=pick.getBoundingClientRect(),c=b.getBoundingClientRect();
    const x1=a.right-br.left,y1=a.top+a.height/2-br.top,x2=c.left-br.left,y2=c.top+c.height/2-br.top;
    if(!made.has(k)){made.add(k);const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',`M${x1} ${y1} C${(x1+x2)/2} ${y1} ${(x1+x2)/2} ${y2} ${x2} ${y2}`);p.setAttribute('class','link-line');svg.append(p);const L=p.getTotalLength();p.style.strokeDasharray=L;p.style.strokeDashoffset=L;requestAnimationFrame(()=>p.style.strokeDashoffset=0)}
    say(msg,`${pick.dataset.v} × ${b.dataset.v}：${S[k]}`);burst($('.link-board',s),(x1+x2)/2,(y1+y2)/2,14);pick.classList.add('done');b.classList.add('done');pick.classList.remove('sel');pick=null;
    if(made.size===9){say(msg,'9通りすべてつながりました。組み合わせ次第で、協業の形はいくつも生まれます。')}});
};

/* 05 新規事業：ロケット */
FUN.newbiz=s=>{
  const st=['構想','市場調査','実証','拡大'];
  s.innerHTML=`<div class="launch"><div class="lane">${st.map((x,i)=>`<span class="lv" style="--i:${i}">${x}</span>`).reverse().join('')}<div class="rocket"><svg viewBox="0 0 40 70"><path d="M20 2 C34 18 34 40 28 52 H12 C6 40 6 18 20 2z" class="rk-body"/><circle cx="20" cy="26" r="6" class="rk-win"/><path d="M12 44 L2 60 L12 56z M28 44 L38 60 L28 56z" class="rk-fin"/></svg><i class="flame"></i></div><b class="count"></b></div></div><div class="fun-btns"><button type="button" class="hot">発射する</button></div><p class="fun-msg">ボタンを押すと、事業が段階ごとに上昇します。</p>`;
  const rk=$('.rocket',s),cnt=$('.count',s),lv=$$('.lv',s).reverse(),msg=$('.fun-msg',s),btn=$('button',s);let busy=false;
  btn.onclick=()=>{if(busy)return;busy=true;btn.disabled=true;lv.forEach(x=>x.classList.remove('on'));rk.style.setProperty('--y','0%');rk.classList.remove('fly');let c=3;
    const cd=()=>{cnt.textContent=c;cnt.classList.remove('pop');void cnt.offsetWidth;cnt.classList.add('pop');if(c-->0)setTimeout(cd,reduced?0:520);else{cnt.textContent='';rk.classList.add('fly');let i=0;
      const up=()=>{rk.style.setProperty('--y',`-${(i+1)*22}%`);lv[i].classList.add('on');say(msg,`${lv[i].textContent}の段階を突破！`);i++;if(i<lv.length)setTimeout(up,reduced?0:700);else setTimeout(()=>{say(msg,'事業が軌道に乗りました。');burst(s,s.clientWidth/2,40);busy=false;btn.disabled=false;rk.classList.remove('fly')},700)};up()}};cd()};
};

/* 06 通信：電波を合わせる */
FUN.tsushin=s=>{
  s.innerHTML=`<div class="radio"><div class="antenna"><i></i><i></i><i></i></div><div class="bars">${'<i></i>'.repeat(5)}</div><div class="noise"></div><div class="dial"><input type="range" min="0" max="100" value="10" aria-label="つまみ"><span class="tick"></span></div></div><p class="fun-msg">つまみを動かして、いちばん電波が強い位置を探してください。</p>`;
  const r=$('input',s),bars=$$('.bars i',s),noise=$('.noise',s),msg=$('.fun-msg',s),ant=$('.antenna',s);let target=rnd(55,90),done=false;
  const upd=()=>{const d=Math.abs(r.value-target),q=Math.max(0,1-d/45);bars.forEach((b,i)=>b.classList.toggle('on',q>i/5+.05));noise.style.opacity=(1-q)*.9;ant.style.setProperty('--sig',q);
    if(d<4&&!done){done=true;say(msg,'つながりました。いちばん合う回線・プランを見つけるのが当社の仕事です。');burst(s,s.clientWidth/2,60,16);setTimeout(()=>{target=rnd(10,90);done=false},2500)}else if(!done)say(msg,q>.7?'あと少し…':q>.35?'近づいています':'電波が弱いようです')};
  r.oninput=upd;upd();
};

/* 07 店舗：キャッシュレス会計体験 */
FUN.tenpo=s=>{
  const M=[['ブレンドコーヒー',400,'☕'],['チーズケーキ',480,'◒'],['日替わりランチ',950,'◍'],['オレンジジュース',380,'◐']];
  s.innerHTML=`<div class="tablet"><div class="tab-head">店舗レジ<span>体験版</span></div><div class="menu">${M.map((m,i)=>`<button type="button" data-i="${i}"><i>${m[2]}</i><b>${m[0]}</b><span>¥${m[1]}</span></button>`).join('')}</div><div class="cart"><span>合計 <b class="sum">¥0</b>（<b class="qty">0</b>点）</span><button type="button" class="hot order">会計する</button></div><div class="receipt"><div class="paper"></div></div></div><p class="fun-msg">商品を押して、会計してみてください（金額は例です）。</p>`;
  const cart=[],sum=$('.sum',s),qty=$('.qty',s),paper=$('.paper',s),msg=$('.fun-msg',s);
  $$('.menu button',s).forEach(b=>b.onclick=()=>{cart.push(M[b.dataset.i]);const t=cart.reduce((a,m)=>a+m[1],0);sum.textContent='¥'+t.toLocaleString();qty.textContent=cart.length;b.classList.remove('tap');void b.offsetWidth;b.classList.add('tap')});
  $('.order',s).onclick=()=>{if(!cart.length){say(msg,'先に商品を選んでください。');return}const t=cart.reduce((a,m)=>a+m[1],0);
    paper.innerHTML=`<b>レシート</b>${cart.map(m=>`<p><span>${m[0]}</span><span>¥${m[1]}</span></p>`).join('')}<p class="tot"><span>合計</span><span>¥${t.toLocaleString()}</span></p><p class="paid">キャッシュレス決済 ✓</p>`;
    paper.classList.remove('print');void paper.offsetWidth;paper.classList.add('print');say(msg,'キャッシュレスで会計が完了しました。会計の手間と待ち時間を減らします。');cart.length=0;sum.textContent='¥0';qty.textContent='0'};
};

/* 08 固定費：固定費見直しスイッチ */
FUN.cost=s=>{
  s.innerHTML=`<div class="meter-wrap"><svg viewBox="0 0 220 130" class="gauge-svg"><path d="M20 120 A90 90 0 0 1 200 120" class="g-arc"/><path d="M20 120 A90 90 0 0 1 110 30" class="g-low"/><g class="needle"><line x1="110" y1="120" x2="110" y2="42"/><circle cx="110" cy="120" r="8"/></g><text x="30" y="112">低</text><text x="180" y="112">高</text></svg><div class="jar"><div class="coins"></div><span>浮いたお金</span></div></div><div class="fun-btns"><button type="button" class="sw" aria-pressed="false"><i></i><span>固定費の見直し：切</span></button></div><p class="fun-msg">スイッチを入れると、固定費の針が下がる様子をイメージで見られます。</p>`;
  const sw=$('.sw',s),nd=$('.needle',s),coins=$('.coins',s),msg=$('.fun-msg',s);let on=false;
  const set=()=>{nd.style.transform=`rotate(${on?-55:55}deg)`;sw.classList.toggle('on',on);sw.setAttribute('aria-pressed',on);$('span',sw).textContent='固定費の見直し：'+(on?'入':'切')};
  sw.onclick=()=>{on=!on;set();if(on){say(msg,'針が下がりました。浮いたお金が貯まっていきます（イメージ）。');let k=0;const drop=()=>{if(!on||k>=10)return;const c=document.createElement('i');c.style.left=rnd(14,58)+'%';c.style.bottom=(4+k*9)+'px';coins.append(c);k++;setTimeout(drop,reduced?0:180)};drop()}else{coins.innerHTML='';say(msg,'スイッチを切りました。')}};
  set();
};

/* 09 衛生：拭き掃除 */
FUN.eisei=s=>{
  s.innerHTML=`<div class="wipe"><div class="clean-bg"><b>ピカピカ</b><span>清潔な空間へ</span></div><canvas class="grime" aria-label="指やマウスでこすると汚れが落ちる"></canvas><span class="wipe-pc">0%</span></div><p class="fun-msg">指やマウスでこすって、汚れを拭き取ってください。</p>`;
  const cv=$('canvas',s),pc=$('.wipe-pc',s),msg=$('.fun-msg',s);let ctx,W,H=220,done=false;
  const paint=()=>{[ctx,W]=canvasFit(cv,H);ctx.globalCompositeOperation='source-over';ctx.fillStyle='#5b5346';ctx.fillRect(0,0,W,H);for(let i=0;i<500;i++){ctx.fillStyle=`rgba(${rnd(40,90)|0},${rnd(40,80)|0},${rnd(30,60)|0},${rnd(.2,.6)})`;ctx.beginPath();ctx.arc(rnd(0,W),rnd(0,H),rnd(2,14),0,6.28);ctx.fill()}ctx.fillStyle='rgba(255,255,255,.18)';ctx.font='700 15px "Noto Sans JP",sans-serif';ctx.fillText('ここをこする',W/2-48,H/2);done=false;pc.textContent='0%'};
  paint();
  let down=false,last=null;
  const rub=e=>{if(!down)return;const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;ctx.globalCompositeOperation='destination-out';ctx.lineWidth=46;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(last?last[0]:x,last?last[1]:y);ctx.lineTo(x,y);ctx.stroke();last=[x,y]};
  const check=()=>{const d=ctx.getImageData(0,0,cv.width,cv.height).data;let c=0,t=0;for(let i=3;i<d.length;i+=64){t++;if(d[i]<40)c++}const p=Math.round(c/t*100);pc.textContent=p+'%';if(p>70&&!done){done=true;ctx.clearRect(0,0,W,H);say(msg,'きれいになりました。衛生環境づくりをお手伝いします。');burst(s,s.clientWidth/2,100);setTimeout(paint,3500)}};
  cv.addEventListener('pointerdown',e=>{down=true;last=null;cv.setPointerCapture(e.pointerId);rub(e)});cv.addEventListener('pointermove',rub);
  cv.addEventListener('pointerup',()=>{down=false;check()});cv.addEventListener('pointercancel',()=>down=false);
  let t;cv.addEventListener('pointermove',()=>{clearTimeout(t);t=setTimeout(check,120)});
};

/* 10 商材開拓：全国へ届ける */
FUN.shozai=s=>{
  s.innerHTML=`<canvas class="ship-cv" aria-label="中央の商材が全国の代理店へ届く様子"></canvas><div class="fun-btns"><button type="button" class="hot">商材を送り出す</button><span class="ship-n">届いた代理店 <b>0</b></span></div><p class="fun-msg">ボタンを押すと、商材が全国の代理店へ広がります。</p>`;
  const cv=$('canvas',s),nEl=$('.ship-n b',s);let ctx,W,H=300,pts=[],fly=[],got=0;
  const init=()=>{[ctx,W]=canvasFit(cv,H);pts=[];for(let i=0;i<160;i++){const t=Math.random();const x=W*(.12+t*.76)+rnd(-1,1)*W*.05,y=H*(.82-t*.62)+Math.sin(t*9)*H*.06+rnd(-1,1)*H*.06;pts.push({x,y,lit:0})}};
  init();addEventListener('resize',init);
  const draw=()=>{ctx.clearRect(0,0,W,H);pts.forEach(p=>{p.lit*=.995;ctx.beginPath();ctx.arc(p.x,p.y,2+p.lit*2,0,6.28);ctx.fillStyle=p.lit>.05?`rgba(255,160,80,${.4+p.lit*.6})`:'rgba(201,214,226,.35)';ctx.fill()});
    const cx=W/2,cy=H/2;ctx.fillStyle='#ff7a1a';ctx.fillRect(cx-14,cy-12,28,24);ctx.strokeStyle='#1a0a00';ctx.beginPath();ctx.moveTo(cx-14,cy-4);ctx.lineTo(cx+14,cy-4);ctx.stroke();
    fly=fly.filter(f=>{f.t+=.02;const e=1-Math.pow(1-f.t,3);const x=cx+(f.p.x-cx)*e,y=cy+(f.p.y-cy)*e-Math.sin(f.t*3.14)*40;ctx.beginPath();ctx.arc(x,y,3,0,6.28);ctx.fillStyle='#ffb45c';ctx.fill();if(f.t>=1){f.p.lit=1;got++;nEl.textContent=got;return false}return true});
    requestAnimationFrame(draw)};draw();
  $('button',s).onclick=()=>{for(let i=0;i<24;i++)setTimeout(()=>fly.push({p:pts[Math.floor(Math.random()*pts.length)],t:0}),i*40)};
};

/* 11 海外：地球儀 */
FUN.global=s=>{
  s.innerHTML=`<canvas class="globe-cv" aria-label="ドラッグで回せる地球儀。日本から世界へ航路が伸びる"></canvas><div class="fun-btns"><button type="button" class="hot">航路を描く</button><span class="fun-note">地球儀はドラッグで回せます</span></div><p class="fun-msg">日本から世界へ、取引の航路を描きます。</p>`;
  const cv=$('canvas',s),msg=$('.fun-msg',s);let ctx,W,H=320,rot=-2.4,drag=null,arcT=0,dots=[];
  for(let i=0;i<900;i++){const u=Math.random()*2-1,th=Math.random()*6.28;dots.push([Math.acos(u)-1.5708,th])}
  const C={日本:[36,138],ロサンゼルス:[34,-118],シンガポール:[1.3,104],ロンドン:[51.5,0],ドバイ:[25,55],シドニー:[-34,151]};
  const P=(lat,lon)=>{const la=lat*Math.PI/180,lo=lon*Math.PI/180+rot;return [Math.cos(la)*Math.sin(lo),-Math.sin(la),Math.cos(la)*Math.cos(lo)]};
  const fit=()=>{[ctx,W]=canvasFit(cv,H)};fit();addEventListener('resize',fit);
  const slerp=(a,b,t)=>{const A=[Math.cos(a[0]*Math.PI/180)*Math.cos(a[1]*Math.PI/180),Math.cos(a[0]*Math.PI/180)*Math.sin(a[1]*Math.PI/180),Math.sin(a[0]*Math.PI/180)],B=[Math.cos(b[0]*Math.PI/180)*Math.cos(b[1]*Math.PI/180),Math.cos(b[0]*Math.PI/180)*Math.sin(b[1]*Math.PI/180),Math.sin(b[0]*Math.PI/180)];const d=Math.acos(Math.min(1,A[0]*B[0]+A[1]*B[1]+A[2]*B[2]));const s1=Math.sin((1-t)*d)/Math.sin(d),s2=Math.sin(t*d)/Math.sin(d);const v=A.map((x,i)=>x*s1+B[i]*s2);return [Math.asin(v[2])*180/Math.PI,Math.atan2(v[1],v[0])*180/Math.PI]};
  const draw=()=>{if(!drag&&!reduced)rot+=.003;ctx.clearRect(0,0,W,H);const R=H*.44,cx=W/2,cy=H/2;
    const g=ctx.createRadialGradient(cx-R*.3,cy-R*.3,R*.1,cx,cy,R);g.addColorStop(0,'#1d3a5c');g.addColorStop(1,'#08131f');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R,0,6.28);ctx.fill();ctx.strokeStyle='rgba(255,180,92,.35)';ctx.stroke();
    dots.forEach(([la,lo])=>{const p=P(la*180/Math.PI,lo*180/Math.PI);if(p[2]>0){ctx.fillStyle=`rgba(201,214,226,${p[2]*.6})`;ctx.fillRect(cx+p[0]*R,cy+p[1]*R,1.5,1.5)}});
    const jp=C.日本;Object.entries(C).forEach(([n,ll],i)=>{const p=P(...ll);if(p[2]>0){ctx.beginPath();ctx.arc(cx+p[0]*R,cy+p[1]*R,n==='日本'?6:4,0,6.28);ctx.fillStyle=n==='日本'?'#ff7a1a':'#ffb45c';ctx.fill();ctx.fillStyle='#fff';ctx.font='700 11px "Noto Sans JP",sans-serif';ctx.fillText(n,cx+p[0]*R+7,cy+p[1]*R-6)}
      if(n!=='日本'&&arcT>0){const end=Math.min(1,arcT-i*.15);if(end>0){ctx.beginPath();let first=true;for(let t=0;t<=end;t+=.02){const ll2=slerp(jp,ll,t);const lift=1+Math.sin(t*3.14)*.12;const q=P(...ll2);if(q[2]<-.05){first=true;continue}const x=cx+q[0]*R*lift,y=cy+q[1]*R*lift;first?ctx.moveTo(x,y):ctx.lineTo(x,y);first=false}ctx.strokeStyle='rgba(255,122,26,.9)';ctx.lineWidth=2;ctx.stroke()}}});
    if(arcT>0&&arcT<2)arcT+=.01;requestAnimationFrame(draw)};draw();
  cv.addEventListener('pointerdown',e=>{drag=e.clientX;cv.setPointerCapture(e.pointerId)});cv.addEventListener('pointermove',e=>{if(drag!==null){rot+=(e.clientX-drag)*.01;drag=e.clientX}});cv.addEventListener('pointerup',()=>drag=null);
  $('button',s).onclick=()=>{arcT=.01;rot=-2.4;say(msg,'日本から5つの都市へ。輸出・輸入・技術連携の航路が広がります。')};
};

/* 12 地域活性化：まちに灯り */
FUN.region=s=>{
  const hs=[70,110,90,140,80,120,60,100];
  s.innerHTML=`<div class="town"><canvas class="fw"></canvas>${hs.map((hh,i)=>`<button type="button" class="bld" style="--h:${hh}px" aria-label="建物${i+1}に灯りをともす">${'<i></i>'.repeat(Math.floor(hh/18)*2)}</button>`).join('')}</div><p class="fun-msg">建物を押して、まちに灯りをともしてください。</p>`;
  const bl=$$('.bld',s),msg=$('.fun-msg',s),cv=$('.fw',s);let lit=0;
  bl.forEach(b=>b.onclick=()=>{if(b.classList.contains('on'))return;b.classList.add('on');$$('i',b).forEach((w,k)=>setTimeout(()=>w.classList.add('lit'),reduced?0:k*60));lit++;say(msg,`灯りのともった建物：${lit} ／ ${bl.length}`);
    if(lit===bl.length){say(msg,'まち全体に灯りがともりました。地域の力を引き出します。');fireworks(cv,s,()=>{bl.forEach(x=>{x.classList.remove('on');$$('i',x).forEach(w=>w.classList.remove('lit'))});lit=0})}});
};
const fireworks=(cv,host,done,opt={})=>{if(reduced){done&&done();return}
  const [ctx,W,H]=canvasFit(cv,cv.clientHeight||240);const big=!!opt.big;let rockets=[],parts=[],t=0,flash=0;
  const COLS=[['#ffb347','#fff1c1'],['#ff4d6d','#ffd1dc'],['#7fd8ff','#e6f9ff'],['#b388ff','#efe3ff'],['#7dffb0','#e3fff0'],['#ffd23f','#fffbe0'],['#ff7a1a','#ffe0c2']];
  const launch=(x)=>{const tx=x??rnd(W*.12,W*.88),ty=rnd(H*.12,H*(big?.42:.5));rockets.push({x:tx+rnd(-30,30),y:H+4,tx,ty,vy:-(Math.sqrt(2*.06*(H-ty))+rnd(.2,.6)),vx:0,trail:[],col:COLS[Math.floor(rnd(0,COLS.length))]});rockets.at(-1).vx=(tx-rockets.at(-1).x)/((-rockets.at(-1).vy)/.06)};
  const explode=r=>{flash=big?.35:.2;const [c1,c2]=r.col;const type=['peony','peony','ring','willow','crackle','double'][Math.floor(rnd(0,6))];const n=big?(type==='ring'?90:150):(type==='ring'?60:90);const sp=big?rnd(3.2,4.6):rnd(2.2,3.2);
    for(let i=0;i<n;i++){const a=type==='ring'?i/n*6.283:rnd(0,6.283);const v=type==='ring'?sp:sp*Math.pow(Math.random(),.45);parts.push({x:r.x,y:r.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:1,dec:type==='willow'?rnd(.004,.007):rnd(.009,.015),g:type==='willow'?.035:.05,col:Math.random()<.25?c2:c1,s:big?rnd(1.6,2.8):rnd(1.2,2.2),tw:type==='crackle'||Math.random()<.15,drag:type==='willow'?.985:.975})}
    if(type==='double')for(let i=0;i<n/2;i++){const a=rnd(0,6.283),v=sp*.45*Math.random();parts.push({x:r.x,y:r.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:1,dec:.012,g:.04,col:'#ffffff',s:1.1,tw:true,drag:.97})}};
  let last=performance.now();
  const step=()=>{t++;const span=opt.span??(big?520:260);
    if(t<span-80&&(t%(big?24:30)===1||(big&&Math.random()<.02)))launch();
    rockets=rockets.filter(r=>{r.x+=r.vx;r.y+=r.vy;r.vy+=.06;r.trail.push([r.x,r.y]);if(r.trail.length>14)r.trail.shift();if(r.vy>=-.4||r.y<=r.ty){explode(r);return false}return true});
    parts=parts.filter(p=>{p.vx*=p.drag;p.vy=p.vy*p.drag+p.g;p.x+=p.vx;p.y+=p.vy;p.l-=p.dec;return p.l>0});return span};
  const loop=now=>{const k=Math.max(1,Math.min(4,Math.round((now-last)/16.7)));last=now;let span;for(let q=0;q<k;q++)span=step();
    // 残像：前の絵を少しずつ消す
    ctx.globalCompositeOperation='destination-out';ctx.fillStyle=`rgba(0,0,0,${Math.min(.7,(big?.24:.26)*k)})`;ctx.fillRect(0,0,W,H);
    if(!rockets.length&&!parts.length)ctx.clearRect(0,0,W,H);
    ctx.globalCompositeOperation='lighter';
    if(flash>0){ctx.fillStyle=`rgba(255,220,180,${flash*.25})`;ctx.fillRect(0,0,W,H);flash*=.85}
    rockets.forEach(r=>{r.trail.forEach(([x,y],q)=>{ctx.fillStyle=`rgba(255,200,140,${q/r.trail.length*.8})`;ctx.beginPath();ctx.arc(x,y,1.6*q/r.trail.length+.4,0,6.283);ctx.fill()});
      ctx.fillStyle='rgba(255,220,170,.35)';ctx.beginPath();ctx.arc(r.x,r.y,7,0,6.283);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(r.x,r.y,2.2,0,6.283);ctx.fill()});
    parts.forEach(p=>{let a=Math.min(1,p.l*1.4);if(p.tw)a*=Math.random()<.5?1:.2;const rr=p.s*(.6+p.l*.6);
      ctx.fillStyle=p.col;if(p.col!=='#ffffff'){ctx.globalAlpha=a*.14;ctx.beginPath();ctx.arc(p.x,p.y,rr*3,0,6.283);ctx.fill()}
      ctx.globalAlpha=a;ctx.beginPath();ctx.arc(p.x,p.y,rr,0,6.283);ctx.fill();
      ctx.globalAlpha=a*.9;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,rr*.45,0,6.283);ctx.fill()});
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    if(t<span||rockets.length||parts.length)requestAnimationFrame(loop);else{ctx.clearRect(0,0,W,H);done&&done()}};
  requestAnimationFrame(loop);return {launch}};

/* 13 企画・制作：カチンコ */
FUN.produce=s=>{
  const st=['企画','撮影','編集','公開'];
  s.innerHTML=`<div class="clap-wrap"><button type="button" class="clap" aria-label="カチンコを鳴らす"><span class="clap-top"></span><span class="clap-body"><b>シーン <i class="sc">1</i></b><b>テイク <i class="tk">1</i></b><small>企画・制作・プロデュース</small></span></button><div class="film"><div class="strip">${[...st,...st].map((x,i)=>`<span>${x}</span>`).join('')}</div><span class="rec">● 撮影中 <b class="tm">00:00</b></span></div></div><p class="fun-msg">カチンコを押すと、撮影が始まります。</p>`;
  const clap=$('.clap',s),tk=$('.tk',s),sc=$('.sc',s),film=$('.film',s),tm=$('.tm',s),msg=$('.fun-msg',s);let take=0,timer=null;
  clap.onclick=()=>{take++;tk.textContent=take;if(take%3===0)sc.textContent=+sc.textContent+1;clap.classList.remove('snap');void clap.offsetWidth;clap.classList.add('snap');film.classList.add('rolling');let sec=0;clearInterval(timer);tm.textContent='00:00';
    timer=setInterval(()=>{sec++;tm.textContent='00:'+String(sec).padStart(2,'0');if(sec>=4){clearInterval(timer);film.classList.remove('rolling');say(msg,`テイク${take}、撮れました。企画から公開まで一貫して形にします。`)}},reduced?10:1000);say(msg,'アクション！')};
};

/* 14 AI・システム：自動仕分け */
FUN.it=s=>{
  const K=[['飲食','#ff9b45'],['不動産','#7fc4ff'],['医療','#9be0a8'],['IT','#d9a8ff']];
  const cards=[];for(let i=0;i<16;i++){const k=K[i%4];cards.push({k:k[0],c:k[1],n:['山田','佐藤','鈴木','高橋','田中','伊藤','渡辺','中村'][i%8]})}
  s.innerHTML=`<div class="sorter"><div class="sort-cols">${K.map(k=>`<span style="--c:${k[1]}">${k[0]}</span>`).join('')}</div>${cards.map((c,i)=>`<div class="mcard" style="--c:${c.c}" data-i="${i}"><b>${c.n}</b><small>${c.k}業界</small></div>`).join('')}</div><div class="fun-btns"><button type="button" class="hot go">自動で仕分ける</button><button type="button" class="mess">散らかす</button></div><p class="fun-msg">散らかった名刺を、ボタン一つで業界別に並べ替えます。</p>`;
  const box=$('.sorter',s),els=$$('.mcard',s),msg=$('.fun-msg',s);
  const mess=()=>{const W=box.clientWidth,H=box.clientHeight;els.forEach(e=>{e.style.transform=`translate(${rnd(0,W-90)}px,${rnd(36,H-50)}px) rotate(${rnd(-25,25)}deg)`})};
  const sort=()=>{const W=box.clientWidth,cw=W/4;const cnt=[0,0,0,0];els.forEach((e,i)=>{const k=K.findIndex(k=>k[0]===cards[i].k);const n=cnt[k]++;e.style.transitionDelay=(i*40)+'ms';e.style.transform=`translate(${k*cw+(cw-86)/2}px,${40+n*44}px) rotate(0deg)`;setTimeout(()=>e.style.transitionDelay='0ms',900)});say(msg,'仕分けが完了しました。手作業の時間を、仕組みで減らします。')};
  mess();addEventListener('resize',mess);$('.go',s).onclick=sort;$('.mess',s).onclick=()=>{mess();say(msg,'散らかしました。もう一度仕分けてみてください。')};
};

/* 15 リユース・買取：査定ルーペ */
FUN.reuse=s=>{
  const IT=[['時計','<circle cx="40" cy="40" r="22" class="it-a"/><circle cx="40" cy="40" r="17" class="it-b"/><line x1="40" y1="40" x2="40" y2="28" class="it-h"/><line x1="40" y1="40" x2="49" y2="44" class="it-h"/><rect x="33" y="6" width="14" height="12" rx="3" class="it-a"/><rect x="33" y="62" width="14" height="12" rx="3" class="it-a"/>'],['指輪','<ellipse cx="40" cy="48" rx="20" ry="16" class="it-ring"/><polygon points="40,12 50,24 40,32 30,24" class="it-gem"/>'],['バッグ','<path d="M26 30 q14 -22 28 0" class="it-h"/><rect x="16" y="30" width="48" height="36" rx="6" class="it-a"/><rect x="34" y="40" width="12" height="8" rx="2" class="it-b"/>']];
  s.innerHTML=`<div class="velvet">${IT.map((it,i)=>`<button type="button" class="item" data-n="${it[0]}"><svg viewBox="0 0 80 80">${it[1]}</svg><span>${it[0]}</span><i class="prog"></i><b class="stampx">査定完了</b></button>`).join('')}<div class="loupe" aria-hidden="true"></div></div><p class="fun-msg">ルーペを品物に重ねる（スマホは押し続ける）と、査定が進みます。</p>`;
  const v=$('.velvet',s),lp=$('.loupe',s),msg=$('.fun-msg',s);let cur=null,t0=0,raf;
  v.addEventListener('pointermove',e=>{const r=v.getBoundingClientRect();lp.style.transform=`translate(${e.clientX-r.left-40}px,${e.clientY-r.top-40}px)`;lp.classList.add('on')});
  v.addEventListener('pointerleave',()=>{lp.classList.remove('on')});
  const tick=()=>{if(!cur)return;const p=Math.min(1,(performance.now()-t0)/1200);cur.style.setProperty('--p',p);if(p>=1){cur.classList.add('done');say(msg,`${cur.dataset.n}の査定が完了しました。法人の在庫・備品もご相談ください。`);burst(v,cur.offsetLeft+cur.offsetWidth/2,cur.offsetTop+40,14);cur=null;if($$('.item.done',s).length===3)setTimeout(()=>$$('.item',s).forEach(x=>{x.classList.remove('done');x.style.setProperty('--p',0)}),3000);return}raf=requestAnimationFrame(tick)};
  $$('.item',s).forEach(it=>{const start=()=>{if(it.classList.contains('done'))return;cur=it;t0=performance.now();say(msg,`${it.dataset.n}を査定中…`);cancelAnimationFrame(raf);tick()};const stop=()=>{if(cur===it){cur=null;it.style.setProperty('--p',0)}};
    it.addEventListener('pointerenter',start);it.addEventListener('pointerdown',start);it.addEventListener('pointerleave',stop);it.addEventListener('click',start)});
};

/* 16 家じまい：荷積み */
FUN.ieshimai=s=>{
  const B=['家具','衣類','食器','本','家電','思い出の品'];
  s.innerHTML=`<div class="move"><div class="room">${B.map(x=>`<button type="button" class="box">${x}</button>`).join('')}</div><div class="truck"><div class="cargo"></div><div class="cab"></div><i class="wh a"></i><i class="wh b"></i></div><div class="road"></div></div><p class="fun-msg">荷物を押すと、トラックに積み込まれます。</p>`;
  const boxes=$$('.box',s),cargo=$('.cargo',s),truck=$('.truck',s),msg=$('.fun-msg',s);let n=0;
  boxes.forEach(b=>b.onclick=()=>{if(b.classList.contains('gone'))return;const a=b.getBoundingClientRect(),c=cargo.getBoundingClientRect();const ghost=b.cloneNode(true);ghost.className='box ghost';document.body.append(ghost);b.classList.add('gone');
    const label=b.textContent==='思い出の品'?'（大切な品は取り分けて保管）':b.textContent==='家電'||b.textContent==='家具'?'（価値のある品は買取）':'';
    ghost.animate([{transform:`translate(${a.left}px,${a.top}px)`},{transform:`translate(${(a.left+c.left)/2}px,${Math.min(a.top,c.top)-80}px) rotate(20deg)`},{transform:`translate(${c.left+rnd(4,c.width-60)}px,${c.top+rnd(4,c.height-30)}px) scale(.6)`}],{duration:reduced?1:650,easing:'cubic-bezier(.4,0,.2,1)'}).onfinish=()=>{ghost.remove();const t=document.createElement('span');t.textContent=b.textContent;cargo.append(t)};
    n++;say(msg,`${b.textContent}を積み込みました${label}`);
    if(n===B.length)setTimeout(()=>{truck.classList.add('go');say(msg,'すべて積み込みました。整理・買取・売却まで一つの窓口で進めます。');setTimeout(()=>{truck.classList.remove('go');cargo.innerHTML='';boxes.forEach(x=>x.classList.remove('gone'));n=0},3200)},700)});
};

/* 17 医療・介護：つながる輪 */
FUN.care=s=>{
  const N=['病院','診療所','介護施設','訪問介護','薬局','住まい'];
  s.innerHTML=`<div class="ring-wrap"><svg class="ring-svg" viewBox="0 0 300 300"><g class="spokes"></g></svg><div class="heart" aria-hidden="true">♥</div>${N.map((n,i)=>`<button type="button" class="rn" style="--a:${i/N.length*360-90}deg">${n}</button>`).join('')}</div><canvas class="ecg"></canvas><p class="fun-msg">事業者を押して、真ん中のハートとつないでください。</p>`;
  const sp=$('.spokes',s),heart=$('.heart',s),msg=$('.fun-msg',s),cv=$('.ecg',s);let n=0,beat=0;
  $$('.rn',s).forEach((b,i)=>b.onclick=()=>{if(b.classList.contains('on'))return;b.classList.add('on');n++;const a=(i/N.length*360-90)*Math.PI/180;const l=document.createElementNS('http://www.w3.org/2000/svg','line');l.setAttribute('x1',150);l.setAttribute('y1',150);l.setAttribute('x2',150+Math.cos(a)*110);l.setAttribute('y2',150+Math.sin(a)*110);l.setAttribute('class','spoke');sp.append(l);
    heart.style.setProperty('--s',1+n*.08);say(msg,`${b.textContent}とつながりました（${n} ／ ${N.length}）`);
    if(n===N.length){heart.classList.add('beat');beat=1;say(msg,'すべてがつながり、地域の医療・介護が一つの輪になりました。');setTimeout(()=>{$$('.rn',s).forEach(x=>x.classList.remove('on'));sp.innerHTML='';heart.classList.remove('beat');heart.style.setProperty('--s',1);n=0;beat=0},5000)}});
  const [ctx,W,H]=canvasFit(cv,70);let x=0,pts=[];
  const loop=()=>{x=(x+2)%W;const ph=x%110;let y=35;if(beat||n){const amp=beat?1:n/N.length*.6;if(ph>40&&ph<46)y=35-26*amp;else if(ph>=46&&ph<52)y=35+18*amp;else if(ph>=52&&ph<56)y=35-8*amp}pts.push([x,y]);if(pts.length>W/2)pts.shift();ctx.clearRect(0,0,W,H);ctx.beginPath();pts.forEach((p,i)=>{if(i&&p[0]<pts[i-1][0]){ctx.moveTo(p[0],p[1])}else i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])});ctx.strokeStyle='#ff7a1a';ctx.lineWidth=2;ctx.stroke();if(!reduced)requestAnimationFrame(loop)};loop();
};

/* ---------- 事業ページへ組み込む ---------- */
const whenShown=(el,fn)=>{const d=el.closest('details:not([open])');if(!d){fn();return}const h=()=>{if(d.open){d.removeEventListener('toggle',h);requestAnimationFrame(()=>whenShown(el,fn))}};d.addEventListener('toggle',h)};
$$('.fun-blk').forEach(b=>{const id=b.dataset.fun,stage=$('.fun-stage',b);if(FUN[id])whenShown(stage,()=>FUN[id](stage))});

/* ==========================================================
   各ページ下部のからくり
   ========================================================== */
const BF={};
/* トップ：花火 */
BF.top=s=>{s.innerHTML=`<div class="fw-sky"><canvas class="fw big"></canvas><div class="fw-city" aria-hidden="true"></div></div><div class="bf-copy"><b>ここまでご覧いただき、ありがとうございます。</b><span>夜空を押すと、その場所に花火が上がります。</span></div>`;const cv=$('canvas',s);let show=null,running=false;
  const start=()=>{if(running)return;running=true;show=fireworks(cv,s,()=>{running=false;show=null},{big:true,span:900})};
  onView(s,start,.4);cv.addEventListener('click',e=>{const r=cv.getBoundingClientRect();if(!running)start();show&&show.launch(e.clientX-r.left)})};
/* 事業一覧：事業おみくじ */
BF.business=s=>{const items=$$('.biz-card').map(a=>({n:$('b',a).textContent,h:a.getAttribute('href'),no:$('.biz-no',a)?.textContent}));
  s.innerHTML=`<div class="omikuji"><button type="button" class="omi-box" aria-label="おみくじを引く"><span class="omi-stick"><b></b></span><i>事業<br>みくじ</i></button><div class="omi-out" aria-live="polite"><p>箱を押して、今日の事業みくじを引いてください。</p></div></div>`;
  const box=$('.omi-box',s),stick=$('.omi-stick b',s),out=$('.omi-out',s);
  box.onclick=()=>{box.classList.remove('shake','pulled');void box.offsetWidth;box.classList.add('shake');const it=items[Math.floor(Math.random()*items.length)];
    setTimeout(()=>{stick.textContent=it.no;box.classList.add('pulled');out.innerHTML=`<p class="omi-luck">${['大吉','中吉','吉','大吉'][Math.floor(rnd(0,4))]}</p><p>今日のおすすめは<b>「${it.n}」</b>。</p><a class="button primary" href="${it.h}">この事業を見る <span>→</span></a>`;out.classList.remove('pop');void out.offsetWidth;out.classList.add('pop')},reduced?0:700)}};
/* 私たちについて：ドミノ */
BF.about=s=>{s.innerHTML=`<div class="domino-row">${['課題','整理','設計','提案','連携','実行','測定','改善','定着','成果'].map((x,i)=>`<span class="dm" style="--i:${i}"><b>${x}</b></span>`).join('')}<span class="dm-bell" aria-hidden="true">♪</span></div><div class="bf-copy"><b>小さな一歩が、次の一歩を動かします。</b><button type="button" class="karakuri-btn dm-go"><span class="knob">▶</span>最初の一枚を倒す</button></div>`;
  const run=()=>{s.classList.remove('fall');void s.offsetWidth;s.classList.add('fall')};$('.dm-go',s).onclick=run;onView(s,()=>setTimeout(run,300),.6)};
/* 代理店：パズル */
BF.agency=s=>{s.innerHTML=`<div class="puzzle"><button type="button" class="pz a"><b>御社</b><small>商材・顧客・地域</small></button><button type="button" class="pz b"><b>当社</b><small>全国5,000社超の代理店網</small></button></div><div class="bf-copy"><b class="pz-msg">ピースを押すと、組み合わさります。</b></div>`;
  const pz=$('.puzzle',s),m=$('.pz-msg',s);$$('.pz',s).forEach(p=>p.onclick=()=>{pz.classList.toggle('joined');if(pz.classList.contains('joined')){say(m,'ぴったり組み合わさりました。パートナーとして一緒に広げましょう。');burst(pz,pz.clientWidth/2,60)}else say(m,'ピースを押すと、組み合わさります。')})};
/* 採用：名札づくり */
BF.recruit=s=>{s.innerHTML=`<div class="badge-maker"><div class="bm-form"><label for="nm">お名前（この画面の中だけで使います）<input id="nm" maxlength="12" placeholder="例）山田 太郎"></label><label for="jb">希望する職種<select id="jb"><option>営業職</option><option>事務職</option><option>アルバイト・パート</option></select></label></div><div class="nametag"><div class="nt-in"><span class="nt-co">マネージメントアドバイザーズ</span><b class="nt-name">お名前</b><span class="nt-job">営業職</span><i class="nt-clip"></i></div></div></div><div class="bf-copy"><b>一緒に働く日を、楽しみにしています。</b></div>`;
  const nm=$('#nm',s),jb=$('#jb',s),tag=$('.nametag',s);const upd=()=>{$('.nt-name',s).textContent=nm.value.trim()||'お名前';$('.nt-job',s).textContent=jb.value;tag.classList.remove('swing');void tag.offsetWidth;tag.classList.add('swing')};nm.oninput=upd;jb.onchange=upd};
/* 会社概要：社印 */
BF.company=s=>{s.innerHTML=`<div class="seal-paper" aria-label="押すと社印が押される紙"><span class="seal-hint">紙を押すと、社印が押されます</span></div><div class="bf-copy"><b>確かな約束を、一つずつ。</b></div>`;
  const p=$('.seal-paper',s);let n=0;p.onclick=e=>{const r=p.getBoundingClientRect();const st=document.createElement('span');st.className='seal';st.style.left=(e.clientX-r.left)+'px';st.style.top=(e.clientY-r.top)+'px';st.style.setProperty('--r',rnd(-18,18)+'deg');const tx='マネージメントアドバイザーズ之印';st.innerHTML=`<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><circle cx="50" cy="50" r="30"/>${[...tx].map((c,i)=>{const a=(i/tx.length)*360-90;return `<text x="50" y="12" text-anchor="middle" transform="rotate(${a+90} 50 50)">${c}</text>`}).join('')}<text x="50" y="58" text-anchor="middle" class="seal-c">MA</text></svg>`;p.append(st);n++;$('.seal-hint',s)?.remove();if(p.children.length>14)p.firstElementChild.remove()}};
/* お問い合わせ：タイプライター */
BF.contact=s=>{const L=['ご相談、お待ちしています。','相談内容がまとまっていなくても大丈夫です。','一緒に、次の一歩を考えましょう。'];s.innerHTML=`<div class="typewriter"><div class="tw-paper"><p class="tw-text"></p><i class="tw-caret"></i></div><div class="tw-keys">${'あいうえおかきくけこ'.split('').map(k=>`<button type="button">${k}</button>`).join('')}</div></div><div class="bf-copy"><b>キーを押すと、紙にもう一度打ち直します。</b></div>`;
  const out=$('.tw-text',s);let busy=false;const type=()=>{if(busy)return;busy=true;out.textContent='';let li=0,ci=0;const step=()=>{if(li>=L.length){busy=false;return}const line=L[li];if(ci<line.length){out.textContent+=line[ci++];setTimeout(step,reduced?0:70)}else{out.textContent+='\n';li++;ci=0;setTimeout(step,reduced?0:300)}};step()};
  $$('.tw-keys button',s).forEach(b=>b.onclick=()=>{b.classList.remove('hit');void b.offsetWidth;b.classList.add('hit');type()});onView(s,type,.5)};
/* 個人情報：シュレッダー */
BF.privacy=s=>{s.innerHTML=`<div class="shredder"><div class="sheet"><b>不要になった書類</b><span>氏名・住所・電話番号 …</span><span>───────</span><span>───────</span></div><div class="sh-body"><i></i></div><div class="strips"></div></div><div class="bf-copy"><b>不要になった個人情報は、確実に処分します。</b><button type="button" class="karakuri-btn sh-go"><span class="knob">▼</span>シュレッダーにかける</button></div>`;
  const sh=$('.shredder',s),strips=$('.strips',s);$('.sh-go',s).onclick=()=>{sh.classList.remove('run');strips.innerHTML='';void sh.offsetWidth;sh.classList.add('run');for(let i=0;i<14;i++){const st=document.createElement('i');st.style.left=(i*7+4)+'%';st.style.animationDelay=(900+i*40)+'ms';strips.append(st)}}};

const bf=$('.bottom-fun');if(bf){const k=bf.dataset.bfun,st=$('.bf-stage',bf);if(BF[k])whenShown(st,()=>BF[k](st))}
})();
