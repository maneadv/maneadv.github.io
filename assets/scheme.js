/* ==========================================================
   販路の仕組み（図＋からくり）
   メーカー・販売元 → 当社 → 全国5,000社超の提携代理店 → 協力店 → お客さま
   ========================================================== */
(()=>{
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const rnd=(a,b)=>a+Math.random()*(b-a);

// 日本列島のおおまかな形（0〜1の座標。北海道→本州→四国・九州→沖縄）
const JP=[[[.86,.06],[.95,.12],[.90,.20],[.80,.17],[.82,.10]],
  [[.80,.24],[.83,.32],[.78,.42],[.74,.50],[.66,.56],[.56,.60],[.46,.63],[.38,.66],[.32,.64]],
  [[.44,.70],[.52,.69],[.50,.73],[.43,.74]],
  [[.26,.67],[.33,.70],[.32,.78],[.25,.82],[.22,.74]],
  [[.10,.93],[.13,.96],[.08,.98]]];
const jpDots=n=>{const pts=[];const segs=[];JP.forEach(poly=>{for(let i=0;i<poly.length-1;i++)segs.push([poly[i],poly[i+1]]);if(poly.length>3)segs.push([poly.at(-1),poly[0]])});
  for(let i=0;i<n;i++){const [a,b]=segs[Math.floor(Math.random()*segs.length)];const t=Math.random();pts.push({x:a[0]+(b[0]-a[0])*t+rnd(-.03,.03),y:a[1]+(b[1]-a[1])*t+rnd(-.025,.025),lit:0,match:false})}return pts};

const PRODUCTS=[['通信回線','⌁'],['店舗集客システム','▣'],['衛生商材','✧'],['新しい商品','✦']];

const build=root=>{
  const mode=root.dataset.mode||'full';
  root.innerHTML=`<div class="sch-top">${mode==='full'?`<div class="sch-chips" role="group" aria-label="預ける商材を選ぶ">${PRODUCTS.map((p,i)=>`<button type="button" data-i="${i}" class="${i?'':'on'}"><i>${p[1]}</i>${p[0]}</button>`).join('')}</div>`:''}<button type="button" class="karakuri-btn sch-go"><span class="knob" aria-hidden="true">▶</span>${mode==='full'?'この商材を預けてみる':'仕組みを動かす'}</button></div>
  <div class="sch-board"><canvas class="sch-cv" aria-hidden="true"></canvas>
    <div class="sch-node n-maker"><b>メーカー・販売元</b><span>商材・サービスをお預かり</span></div>
    <div class="sch-node n-ma"><span class="sch-gear" aria-hidden="true">⚙</span><b>マネージメントアドバイザーズ</b><span>選定・助言・販促支援</span></div>
    <div class="sch-node n-agency"><b>提携代理店　5,000社超</b><span>北海道から沖縄まで</span></div>
    <div class="sch-node n-custa"><em>ルートA</em><b>お客さま</b><span>代理店が直接ご提案</span></div>
    <div class="sch-node n-coop"><em>ルートB</em><b>協力店</b><span>顧客を抱える企業さま</span></div>
    <div class="sch-node n-custb"><b>協力店のお客さま</b><span>協力店の名前でご提案</span></div>
    <span class="sch-count" aria-live="polite"></span>
  </div>
  <ol class="sch-steps"><li data-s="0"><b>お預かり</b>メーカー・販売元から商材・サービスを預かる</li><li data-s="1"><b>探す</b>全国5,000社超の代理店から、関心を持つ代理店を探す</li><li data-s="2"><b>2つのルートで届ける</b>直接お客さまへ／協力店のお客さまへ</li><li data-s="3"><b>助言する</b>結果を見て、メーカー・代理店に改善を助言する</li></ol>
  <p class="sch-msg" aria-live="polite">${mode==='full'?'商材を選んで「預けてみる」を押すと、販路が広がる様子を見られます。':'ボタンを押すと、販路が広がる様子を見られます。'}</p>`;
  const cv=$('.sch-cv',root),board=$('.sch-board',root),msg=$('.sch-msg',root),cnt=$('.sch-count',root),steps=$$('.sch-steps li',root);
  let ctx,W,H,vertical,pos={},dots=[],packets=[],pulses=[],phase=-1,prod=0,running=false,scan=-1,matched=0;
  const nodeCenter=cls=>{const n=$('.'+cls,root),b=board.getBoundingClientRect(),r=n.getBoundingClientRect();return {x:r.left-b.left+r.width/2,y:r.top-b.top+r.height/2,w:r.width,h:r.height}};
  const layout=()=>{const r=Math.min(devicePixelRatio||1,2);W=board.clientWidth;H=board.clientHeight;cv.width=W*r;cv.height=H*r;ctx=cv.getContext('2d');ctx.setTransform(r,0,0,r,0,0);vertical=matchMedia('(max-width:720px)').matches;
    pos={maker:nodeCenter('n-maker'),ma:nodeCenter('n-ma'),agency:nodeCenter('n-agency'),coop:nodeCenter('n-coop'),custa:nodeCenter('n-custa'),custb:nodeCenter('n-custb')};
    // 地図の範囲
    const c=vertical?{x:W/2,y:H*.44}:{x:W*.52,y:H*.44};let mw=vertical?Math.min(W*.86,330):Math.min(W*.27,330),mh=mw*.95;const maxh=vertical?H*.26:H*.7;if(mh>maxh){mh=maxh;mw=mh/.95}pos.map={x:c.x-mw/2,y:c.y-mh/2,w:mw,h:mh};pos.mapc=c;
    if(!dots.length)dots=jpDots(vertical?160:220);
  };
  const P=d=>({x:pos.map.x+d.x*pos.map.w,y:pos.map.y+d.y*pos.map.h});
  const curve=(a,b,t,bend=0)=>{const mx=(a.x+b.x)/2+(vertical?bend:0),my=(a.y+b.y)/2+(vertical?0:bend);const u=1-t;return {x:u*u*a.x+2*u*t*mx+t*t*b.x,y:u*u*a.y+2*u*t*my+t*t*b.y}};
  const setStep=i=>{phase=i;steps.forEach((s,k)=>{s.classList.toggle('on',k===i);s.classList.toggle('done',k<i)})};
  const draw=()=>{ctx.clearRect(0,0,W,H);
    // つながりの線
    const line=(a,b,c,dash)=>{ctx.save();ctx.strokeStyle=c;ctx.lineWidth=2;if(dash)ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(a.x,a.y);for(let t=.05;t<=1;t+=.05){const p=curve(a,b,t);ctx.lineTo(p.x,p.y)}ctx.stroke();ctx.restore()};
    line(pos.maker,pos.ma,'rgba(255,180,92,.35)');line(pos.ma,pos.mapc,'rgba(255,180,92,.35)');
    line(pos.mapc,pos.custa,'rgba(155,224,168,.45)');line(pos.mapc,pos.coop,'rgba(255,210,122,.45)');line(pos.coop,pos.custb,'rgba(255,210,122,.45)');
    // 助言の戻り線（点線）
    line(pos.ma,pos.maker,'rgba(127,196,255,.45)',[5,6]);
    // 列島の点
    dots.forEach(d=>{const p=P(d);d.lit*=.985;const lit=d.match?Math.max(.55,d.lit):d.lit;ctx.beginPath();ctx.arc(p.x,p.y,1.8+lit*2.2,0,6.283);ctx.fillStyle=lit>.05?`rgba(255,${150+lit*60|0},80,${.45+lit*.55})`:'rgba(201,214,226,.28)';ctx.fill()});
    ctx.fillStyle='rgba(201,214,226,.6)';ctx.font='700 10px "Noto Sans JP",sans-serif';ctx.textAlign='center';
    ctx.fillText('北海道',pos.map.x+pos.map.w*.9,pos.map.y+pos.map.h*.03);ctx.fillText('沖縄',pos.map.x+pos.map.w*.1,pos.map.y+pos.map.h*1.04);
    // 探索の光
    if(scan>=0){const sx=pos.map.x+pos.map.w*(1-scan),g=ctx.createLinearGradient(sx-30,0,sx+4,0);g.addColorStop(0,'rgba(255,122,26,0)');g.addColorStop(1,'rgba(255,122,26,.35)');ctx.fillStyle=g;ctx.fillRect(sx-30,pos.map.y-6,34,pos.map.h+12)}
    // 流れる荷物
    packets=packets.filter(p=>{p.t+=p.v;const q=curve(p.a,p.b,Math.min(1,p.t),p.bend||0);ctx.beginPath();if(p.box){ctx.fillStyle='#ff7a1a';ctx.fillRect(q.x-7,q.y-6,14,12);ctx.strokeStyle='#1a0a00';ctx.beginPath();ctx.moveTo(q.x-7,q.y-2);ctx.lineTo(q.x+7,q.y-2);ctx.stroke()}else{ctx.arc(q.x,q.y,p.r||3,0,6.283);ctx.fillStyle=p.c||'#ffb45c';ctx.fill()}if(p.t>=1){p.done&&p.done();return false}return true});
    // 助言の波
    pulses=pulses.filter(p=>{p.t+=.012;const q=curve(p.a,p.b,Math.min(1,p.t),p.bend||0);ctx.fillStyle='#7fc4ff';ctx.font='800 11px "Noto Sans JP",sans-serif';ctx.textAlign='center';ctx.fillText(p.label,q.x,q.y-8);ctx.beginPath();ctx.arc(q.x,q.y,4,0,6.283);ctx.fill();return p.t<1});
    requestAnimationFrame(draw)};
  const say=t=>{msg.textContent=t;msg.classList.remove('pop');void msg.offsetWidth;msg.classList.add('pop')};
  const wait=ms=>new Promise(r=>setTimeout(r,reduced?0:ms));
  const send=(a,b,opt={})=>new Promise(r=>{packets.push(Object.assign({a,b,t:0,v:reduced?1:.02},opt,{done:r}))});
  const run=async()=>{if(running)return;running=true;$('.sch-go',root).disabled=true;dots.forEach(d=>{d.match=false;d.lit=0;d.seen=false});cnt.textContent='';matched=0;
    const name=PRODUCTS[prod][0];
    setStep(0);say(`メーカー・販売元から「${name}」をお預かりします。`);$('.n-maker',root).classList.add('glow');await send(pos.maker,pos.ma,{box:true,v:.015});$('.n-maker',root).classList.remove('glow');
    setStep(1);$('.n-ma',root).classList.add('spin');say(`全国5,000社超の提携代理店から、「${name}」に関心を持つ企業を探しています…`);
    for(let s=0;s<=1;s+=.02){scan=s;dots.forEach(d=>{if(Math.abs((1-d.x)-s)<.03){d.lit=1;if(!d.seen){d.seen=true;if(Math.random()<.22){d.match=true;matched++}}}});cnt.textContent=`関心あり：${matched}社（イメージ）`;await wait(28)}scan=-1;$('.n-ma',root).classList.remove('spin');
    const hits=dots.filter(d=>d.match);
    setStep(2);say('ルートAは代理店から直接お客さまへ。ルートBは協力店の名前で、協力店のお客さまへご提案します。');
    const tgt=pos.mapc;
    hits.slice(0,30).forEach((d,i)=>setTimeout(()=>send(tgt,P(d),{v:.03,r:2.5}),reduced?0:i*25));
    await wait(900);
    for(let i=0;i<14;i++){const d=hits[Math.floor(Math.random()*hits.length)];if(!d)break;
      if(i%2===0)send(P(d),pos.custa,{v:.02,r:3,c:'#9be0a8'});
      else send(P(d),pos.coop,{v:.025,r:3,c:'#ffd27a'}).then(()=>{pulses.push({a:pos.coop,b:{x:pos.coop.x,y:pos.coop.y-46},t:.4,label:'手数料を分配'});return send(pos.coop,pos.custb,{v:.035,r:3,c:'#ffd27a'})});await wait(110)}
    await wait(1500);$('.n-custa',root).classList.add('glow');$('.n-custb',root).classList.add('glow');
    setStep(3);say('結果を見て、メーカー・販売元と代理店に「次の一手」を助言し、ともに成長します。');
    pulses.push({a:pos.ma,b:pos.maker,t:0,label:'売り方の助言',bend:vertical?40:-40});pulses.push({a:pos.ma,b:{x:pos.map.x+pos.map.w*.5,y:pos.map.y+pos.map.h*.45},t:0,label:'改善点の共有',bend:vertical?-40:40});
    await wait(2200);$('.n-custa',root).classList.remove('glow');$('.n-custb',root).classList.remove('glow');steps.forEach(s=>s.classList.add('done'));running=false;$('.sch-go',root).disabled=false};
  $$('.sch-chips button',root).forEach(b=>b.onclick=()=>{prod=+b.dataset.i;$$('.sch-chips button',root).forEach(x=>x.classList.toggle('on',x===b))});
  $('.sch-go',root).onclick=run;
  steps.forEach((s,i)=>s.addEventListener('mouseenter',()=>{if(!running)s.classList.add('peek')}));steps.forEach(s=>s.addEventListener('mouseleave',()=>s.classList.remove('peek')));
  layout();addEventListener('resize',()=>{layout()});draw();
  if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){setTimeout(run,500);io.disconnect()}},{threshold:.45});io.observe(board)}
};
$$('.scheme').forEach(build);

/* ---------- 2つのルートを比べる ---------- */
const R={a:{name:'ルートA：代理店から直接お客さまへ',v:{fee:3,lead:2,contact:1,exp:2},txt:'代理店が自らお客さまを開拓してご提案します。手数料は代理店がそのまま受け取れます。'},
  b:{name:'ルートB：協力店のお客さまへ',v:{fee:2,lead:3,contact:3,exp:3},txt:'すでに何らかの契約があるお客さまに、協力店の名前でご提案します。手数料は協力店にも分配されますが、いちばん大変な最初の接触がしやすく、成約の経験を積むことで営業担当者の意識と経験値が上がります。'}};
const AX=[['fee','代理店の手数料'],['lead','お客さまの見込み度'],['contact','最初の接触のしやすさ'],['exp','成約経験の積みやすさ']];const LV=['','低','中','高'];
$$('.route-compare').forEach(box=>{
  box.innerHTML=`<div class="rc-tabs" role="tablist"><button type="button" role="tab" data-r="a" aria-selected="false">ルートA<br><small>直接お客さまへ</small></button><button type="button" role="tab" data-r="b" aria-selected="true" class="on">ルートB<br><small>協力店のお客さまへ</small></button><button type="button" class="rc-both">2つを並べる</button></div>
  <div class="rc-body"><div class="rc-lane" data-r="a"><h3></h3>${AX.map(x=>`<div class="rc-row"><span>${x[1]}</span><div class="rc-bar"><i></i></div><b></b></div>`).join('')}<p></p></div><div class="rc-lane" data-r="b"><h3></h3>${AX.map(x=>`<div class="rc-row"><span>${x[1]}</span><div class="rc-bar"><i></i></div><b></b></div>`).join('')}<p></p></div></div>`;
  const fill=(lane,k)=>{const r=R[k];$('h3',lane).textContent=r.name;$('p',lane).textContent=r.txt;lane.classList.toggle('b',k==='b');$$('.rc-row',lane).forEach((row,i)=>{const v=r.v[AX[i][0]];const bar=$('i',row);bar.style.width='0%';requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.width=(v/3*100)+'%'}));$('b',row).textContent=LV[v]})};
  const lanes=$$('.rc-lane',box);
  const show=k=>{box.classList.remove('both');$$('.rc-tabs [data-r]',box).forEach(t=>{const on=t.dataset.r===k;t.classList.toggle('on',on);t.setAttribute('aria-selected',on)});lanes[1].hidden=true;fill(lanes[0],k)};
  $$('.rc-tabs [data-r]',box).forEach(t=>t.onclick=()=>show(t.dataset.r));
  $('.rc-both',box).onclick=()=>{box.classList.add('both');$$('.rc-tabs [data-r]',box).forEach(t=>{t.classList.remove('on');t.setAttribute('aria-selected','false')});lanes[1].hidden=false;fill(lanes[0],'a');fill(lanes[1],'b')};
  show('b');
});
})();
