const menuButton=document.querySelector('.menu-button');
const nav=document.querySelector('#global-nav');
menuButton.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open))});
nav.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');menuButton.setAttribute('aria-expanded','false')}});

const solutions={
  sales:{index:'01',title:'売上につながる導線を再設計',text:'集客、営業、顧客対応を分断せず、相談から成約までの流れを一体で整えます。',items:['集客・営業方法の改善','ホームページ・広告設計','顧客対応の仕組み化']},
  cost:{index:'02',title:'支出を利益へ変える経営改善',text:'固定費と仕入れを可視化し、品質を落とさずに利益が残る経営体質へ改善します。',items:['通信・賃料などの固定費見直し','仕入れ条件の適正化','業務手順と作業時間の削減']},
  people:{index:'03',title:'人が定着し、育つ組織づくり',text:'採用だけに頼らず、役割・評価・業務の流れを整え、持続的に動ける組織をつくります。',items:['採用と定着の仕組みづくり','役割・評価制度の整理','属人化した業務の標準化']},
  new:{index:'04',title:'新しい収益の柱を実装',text:'市場性と採算性を確かめ、小さく検証してから再現できる新規事業へ育てます。',items:['市場・競合・顧客の調査','収益構造と実行計画の設計','提携先・販売網への接続']}
};
const hero=document.querySelector('.future-hero');
const panel=document.querySelector('.console-panel');
document.querySelectorAll('.console-tabs button').forEach(button=>button.addEventListener('click',()=>{
  const data=solutions[button.dataset.solution];
  document.querySelectorAll('.console-tabs button').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-selected',String(item===button))});
  panel.classList.add('switching');
  window.setTimeout(()=>{hero.dataset.mode=button.dataset.solution;panel.querySelector('.panel-index').textContent=data.index;panel.querySelector('h2').textContent=data.title;panel.querySelector('.panel-text').textContent=data.text;panel.querySelector('ul').innerHTML=data.items.map(item=>`<li>${item}</li>`).join('');panel.classList.remove('switching')},180);
}));

const counter=document.querySelector('[data-count]');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(counter){if(reduced){counter.textContent='5,000'}else{let start;const animate=time=>{start??=time;const progress=Math.min((time-start)/1100,1);counter.textContent=Math.floor(5000*(1-Math.pow(1-progress,3))).toLocaleString();if(progress<1)requestAnimationFrame(animate)};requestAnimationFrame(animate)}}

const revealTargets=document.querySelectorAll('.section .container,.network-proof .container');
if(!reduced&&'IntersectionObserver'in window){revealTargets.forEach(el=>el.classList.add('reveal'));const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.1});revealTargets.forEach(el=>observer.observe(el))}

/* お問い合わせ：大分類→中分類→小分類を押して選ぶ */
(()=>{const f=document.querySelector('#contact-form');if(!f||!window.MA_TREE)return;
  const T=window.MA_TREE,st={c:null,b:null,s:new Set()};
  const lv=n=>f.querySelector(`.chips[data-level="${n}"]`),step=n=>f.querySelector(`.pick[data-step="${n}"]`);
  const chip=(label,on,fn)=>{const b=document.createElement('button');b.type='button';b.className='chip'+(on?' on':'');b.textContent=label;b.setAttribute('aria-pressed',String(!!on));b.addEventListener('click',fn);return b};
  const cat=()=>T.find(c=>c.id===st.c),biz=()=>cat()&&cat().items.find(b=>b.id===st.b);
  const render=()=>{
    const l1=lv(1);l1.innerHTML='';T.forEach(c=>l1.append(chip(c.name,st.c===c.id,()=>{if(st.c!==c.id){st.c=c.id;st.b=null;st.s.clear()}render();step(2).scrollIntoView({behavior:'smooth',block:'nearest'})})));
    const c=cat();step(2).hidden=!c;const l2=lv(2);l2.innerHTML='';
    if(c)c.items.forEach(b=>l2.append(chip(b.name,st.b===b.id,()=>{if(st.b!==b.id){st.b=b.id;st.s.clear()}render();step(3).scrollIntoView({behavior:'smooth',block:'nearest'})})));
    const b=biz();step(3).hidden=!b;const l3=lv(3);l3.innerHTML='';
    if(b)b.subs.forEach(t=>l3.append(chip(t,st.s.has(t),()=>{st.s.has(t)?st.s.delete(t):st.s.add(t);render()})));
    f.querySelector('#f-topic').value=c?[c.name,b&&b.name].filter(Boolean).join(' ＞ '):'';
    const sum=f.querySelector('.pick-summary');
    if(c&&b&&st.s.size){sum.hidden=false;sum.innerHTML='<b>選んだ内容</b>'+[c.name,b.name].join(' ＞ ')+'<br>'+[...st.s].map(x=>'・'+x).join('<br>')}else sum.hidden=true;
    [1,2,3].forEach(n=>{const e=step(n).querySelector('.pick-err');if(e&&((n===1&&c)||(n===2&&b)||(n===3&&st.s.size)))e.hidden=true});
    f.dispatchEvent(new Event('change'));
  };
  // ほかのページから来たとき：分野を自動で選ぶ
  window.maPick=id=>{for(const c of T){if(c.id===id){st.c=c.id;st.b=null;st.s.clear();render();return true}const b=c.items.find(x=>x.id===id);if(b){st.c=c.id;st.b=b.id;st.s.clear();render();return true}}return false};
  render();
  const fromHash=()=>{const k=decodeURIComponent(location.hash.slice(1));if(k)window.maPick(k)};fromHash();addEventListener('hashchange',fromHash);
  // 相談メモ・課題スロットから来たとき：項目を自動で選び、残りは追加欄へ
  try{const m=sessionStorage.getItem('ma-prefill');if(m){sessionStorage.removeItem('ma-prefill');const b=biz();const rest=[];
    m.split('\n').forEach(line=>{const t=line.replace(/^・/,'').trim();if(b&&b.subs.includes(t))st.s.add(t);else if(t&&!/^【.*】について相談したいです。$/.test(t))rest.push(line)});
    render();const ta=f.querySelector('#f-msg');if(rest.length&&ta)ta.value=rest.join('\n')}}catch(_){}
  // 「特になし」
  const none=f.querySelector('.none-chip'),ta=f.querySelector('#f-msg');
  const setNone=on=>{none.classList.toggle('on',on);none.setAttribute('aria-pressed',String(on));ta.disabled=on;if(on)ta.value='';ta.placeholder=on?'特になし':'ご状況やご希望など、自由にご記入ください（なければ「特になし」を押してください）'};
  none.addEventListener('click',()=>setNone(!none.classList.contains('on')));
  // 送信前の確認（足りないところへ案内する）
  f.addEventListener('submit',e=>{let bad=null;
    if(!st.c)bad=1;else if(!st.b)bad=2;else if(!st.s.size)bad=3;
    if(bad){e.preventDefault();e.stopImmediatePropagation();const s=step(bad);s.hidden=false;s.querySelector('.pick-err').hidden=false;s.scrollIntoView({behavior:'smooth',block:'center'});return}
    const req=[...f.querySelectorAll('input[required]')].find(x=>x.type==='checkbox'?!x.checked:!x.value.trim()||!x.checkValidity());
    if(req){e.preventDefault();e.stopImmediatePropagation();req.reportValidity&&req.reportValidity();req.focus();return}
  },true);
  window.maFormState=()=>({cat:cat()&&cat().name,biz:biz()&&biz().name,subs:[...st.s],none:none.classList.contains('on')});
  window.maFormReset=()=>{st.c=null;st.b=null;st.s.clear();setNone(false);render()};
})();

/* お問い合わせ：Googleの受付（記録・通知・自動返信）へ送る。失敗したときはメールアプリで送る */
document.querySelector('#contact-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;
  const v=n=>(f.elements[n]&&f.elements[n].value||'').trim();
  if(v('_honey'))return;
  const S=window.maFormState?window.maFormState():{};const topic=v('topic');
  const extra=S.none?'特になし':(v('message')||'特になし');
  const body='【ご相談の分野】'+topic+'\n【くわしい内容】'+(S.subs||[]).join('、')+'\n【追加で伝えたいこと】\n'+extra;
  const btn=f.querySelector('.submit'),ok=f.querySelector('.success'),ng=f.querySelector('.send-error');
  const txt=`【お問い合わせ内容】\nお名前：${v('name')}\n会社名：${v('company')}\nメール：${v('email')}\n電話：${v('tel')}\n${body}`;
  btn.disabled=true;const label=btn.innerHTML;btn.innerHTML='送信しています…';ok.hidden=true;ng.hidden=true;
  let sent=false;
  if(f.dataset.gas){try{const r=await fetch(f.dataset.gas,{method:'POST',body:new URLSearchParams({name:v('name'),company:v('company'),email:v('email'),tel:v('tel'),topic:topic+(S.subs&&S.subs.length?'（'+S.subs.join('、')+'）':''),subs:(S.subs||[]).join('、'),cat:topic,message:body,_honey:v('_honey')})});const j=await r.json().catch(()=>({}));sent=!!j.ok}catch(_){}}
  btn.disabled=false;btn.innerHTML=label;
  if(sent){ok.hidden=false;f.querySelectorAll('input:not([type=checkbox]):not([name=_honey]):not([type=hidden]),textarea').forEach(x=>x.value='');window.maFormReset&&window.maFormReset();ok.scrollIntoView({behavior:'smooth',block:'nearest'});return}
  try{navigator.clipboard&&navigator.clipboard.writeText(txt)}catch(_){}
  ng.hidden=false;ng.scrollIntoView({behavior:'smooth',block:'nearest'});
  ng.querySelector('.send-mail').onclick=()=>{location.href='mailto:'+f.dataset.mail+'?subject='+encodeURIComponent('【ホームページからのご相談】'+v('name')+'様')+'&body='+encodeURIComponent(txt)};
});

// 粒子の描画は karakuri.js に移動
const tilt=document.querySelector('.tilt-surface');
if(tilt&&!reduced&&matchMedia('(pointer:fine)').matches){tilt.addEventListener('pointermove',e=>{const r=tilt.getBoundingClientRect();const rx=(.5-(e.clientY-r.top)/r.height)*5;const ry=((e.clientX-r.left)/r.width-.5)*7;tilt.style.transform=`rotateX(${rx}deg) rotateY(${ry}deg) translateZ(6px)`});tilt.addEventListener('pointerleave',()=>tilt.style.transform='')}

const header=document.querySelector('.site-header');addEventListener('scroll',()=>header.classList.toggle('scrolled',scrollY>70),{passive:true});

// A restrained orbital glow follows the pointer through the presentation sections.
if(!reduced&&matchMedia('(pointer:fine)').matches){document.querySelectorAll('.issue-strip,.flow,.businesses,.services,.strengths,.cases,.partner').forEach(section=>section.addEventListener('pointermove',event=>{const rect=section.getBoundingClientRect();section.style.setProperty('--mx',`${((event.clientX-rect.left)/rect.width)*100}%`);section.style.setProperty('--my',`${((event.clientY-rect.top)/rect.height)*100}%`)}))}

const scenes=[
  {number:'01',label:'SCENE 01',title:'課題を見つける',text:'複雑な経営課題を整理し、動かすべき一点を特定します.',nodes:['相談','分析','実行']},
  {number:'02',label:'SCENE 02',title:'解決策をつなぐ',text:'全国のネットワークから、条件に合う専門家・企業・商材を選びます。',nodes:['課題','選定','接続']},
  {number:'03',label:'SCENE 03',title:'成果まで動かす',text:'計画で終わらせず、実行結果を測りながら改善を続けます。',nodes:['実行','測定','改善']}
];
const stage=document.querySelector('.motion-stage');
document.querySelectorAll('.scene-controls button').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.scene),scene=scenes[index];document.querySelectorAll('.scene-controls button').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-selected',String(item===button))});stage.animate([{opacity:.45,transform:'scale(.985)'},{opacity:1,transform:'scale(1)'}],{duration:420,easing:'ease-out'});stage.dataset.scene=index;stage.querySelector('.scene-number').textContent=scene.number;stage.querySelector('.stage-caption small').textContent=scene.label;stage.querySelector('.stage-caption strong').textContent=scene.title;stage.querySelector('.stage-caption p').textContent=scene.text;stage.querySelectorAll('.stage-node span').forEach((node,i)=>node.textContent=scene.nodes[i])}));

const progressRail=document.querySelector('.scroll-progress'),zones=[...document.querySelectorAll('.cosmic-zone')];let progressTick=false;
const updateProgress=()=>{progressTick=false;const max=Math.max(document.documentElement.scrollHeight-innerHeight,1),page=Math.min(Math.max(scrollY/max,0),1);let current=null,nearest=Infinity;zones.forEach(zone=>{const rect=zone.getBoundingClientRect(),distance=Math.abs(rect.top+rect.height/2-innerHeight/2);if(distance<nearest){nearest=distance;current=zone}});zones.forEach(zone=>zone.classList.toggle('is-current',zone===current));if(current&&progressRail)progressRail.querySelector('i').textContent=current.dataset.chapter};
const requestProgress=()=>{if(!progressTick){progressTick=true;requestAnimationFrame(updateProgress)}};if(!reduced){addEventListener('scroll',requestProgress,{passive:true});addEventListener('resize',requestProgress,{passive:true});updateProgress()}

document.querySelectorAll('.mega-toggle').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();const box=b.closest('.has-mega');const open=box.classList.toggle('open');b.setAttribute('aria-expanded',String(open))}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.has-mega.open').forEach(x=>{x.classList.remove('open');x.querySelector('.mega-toggle')?.setAttribute('aria-expanded','false')})});

/* フッター：スマホでは折りたたむ（パソコンでは常に開く） */
(()=>{const mq=matchMedia('(max-width:720px)');const ds=[...document.querySelectorAll('footer details.foot-col')];const set=()=>ds.forEach(d=>{d.open=!mq.matches});set();mq.addEventListener?mq.addEventListener('change',set):mq.addListener(set);ds.forEach(d=>d.querySelector('summary').addEventListener('click',e=>{if(!mq.matches)e.preventDefault()}))})();

/* 通信量を節約する設定の端末では、トップの動画を止めて静止画にする */
(()=>{const c=navigator.connection;if(!(c&&(c.saveData||/2g/.test(c.effectiveType||''))))return;document.querySelectorAll('video.hero-video,video.page-hero-bg').forEach(v=>{v.removeAttribute('autoplay');v.pause();v.preload='none'})})();
/* タップで開く枠（ページが縦に長くなりすぎないように） */
(()=>{const folds=[...document.querySelectorAll('details.fold')];if(!folds.length)return;
  const pc=matchMedia('(min-width: 761px)').matches;
  folds.forEach(d=>{if(pc&&d.dataset.pcopen)d.open=true;
    d.addEventListener('toggle',()=>{if(d.open){setTimeout(()=>dispatchEvent(new Event('resize')),30)}})});
  const openTo=()=>{const id=decodeURIComponent(location.hash.slice(1));if(!id)return;const el=document.getElementById(id);if(!el)return;
    let p=el.closest('details');while(p){p.open=true;p=p.parentElement&&p.parentElement.closest('details')}
    el.querySelectorAll(':scope > details.fold, :scope > * > details.fold').forEach(d=>d.open=true)};
  openTo();addEventListener('hashchange',openTo);
  document.addEventListener('click',e=>{const a=e.target.closest('a[href*="#"]');if(a&&a.pathname===location.pathname)setTimeout(openTo,0)})})();

/* 映像が画面の外に出たら止めて、スマホの負担を減らす */
(()=>{const vs=[...document.querySelectorAll('video.hero-video,video.page-hero-bg')];if(!vs.length||!('IntersectionObserver'in window))return;
  const io=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;if(document.getElementById('intro'))return;if(e.isIntersecting){v.play&&v.play().catch(()=>{})}else{v.pause&&v.pause()}}),{threshold:0});
  vs.forEach(v=>io.observe(v))})();

/* 動きが重い端末は自動で軽い表示に切り替える（最初の数秒の描画速度で判定） */
(()=>{const d=document.documentElement;if(d.classList.contains('lite'))return;let f=0,slow=0,t0=performance.now(),last=t0;
  const step=n=>{const dt=n-last;last=n;if(dt>40)slow++;f++;if(n-t0<4000)requestAnimationFrame(step);else{if(f/((n-t0)/1000)<40||slow>f*.3){d.classList.add('lite');try{localStorage.setItem('ma-lite','1')}catch(_){}}}};
  setTimeout(()=>{if(document.hidden||document.getElementById('intro'))return;t0=last=performance.now();requestAnimationFrame(step)},1500)})();
