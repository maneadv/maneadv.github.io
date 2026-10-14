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

document.querySelector('#contact-form')?.addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;const v=n=>(f.elements[n]&&f.elements[n].value||'').trim();const tp=f.elements.topic;const txt=`【お問い合わせ内容】\nお名前：${v('name')}\n会社名：${v('company')}\nメール：${v('email')}\n電話：${v('tel')}\nご相談：${tp&&tp.selectedIndex>0?tp.options[tp.selectedIndex].text:''}\n${v('message')}`;try{navigator.clipboard&&navigator.clipboard.writeText(txt)}catch(_){}const to=f.dataset.mail;if(to){location.href='mailto:'+to+'?subject='+encodeURIComponent('【ホームページからのご相談】'+v('name')+'様')+'&body='+encodeURIComponent(txt)}const success=f.querySelector('.success');success.hidden=false;success.scrollIntoView({behavior:'smooth',block:'nearest'})});

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
const updateProgress=()=>{progressTick=false;const max=Math.max(document.documentElement.scrollHeight-innerHeight,1),page=Math.min(Math.max(scrollY/max,0),1);document.documentElement.style.setProperty('--page-progress',`${page*100}%`);let current=null,nearest=Infinity;zones.forEach(zone=>{const rect=zone.getBoundingClientRect(),distance=Math.abs(rect.top+rect.height/2-innerHeight/2);if(distance<nearest){nearest=distance;current=zone}});zones.forEach(zone=>zone.classList.toggle('is-current',zone===current));if(current&&progressRail)progressRail.querySelector('i').textContent=current.dataset.chapter};
const requestProgress=()=>{if(!progressTick){progressTick=true;requestAnimationFrame(updateProgress)}};if(!reduced){addEventListener('scroll',requestProgress,{passive:true});addEventListener('resize',requestProgress,{passive:true});updateProgress()}

document.querySelectorAll('.mega-toggle').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();const box=b.closest('.has-mega');const open=box.classList.toggle('open');b.setAttribute('aria-expanded',String(open))}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.has-mega.open').forEach(x=>{x.classList.remove('open');x.querySelector('.mega-toggle')?.setAttribute('aria-expanded','false')})});

/* フッター：スマホでは折りたたむ（パソコンでは常に開く） */
(()=>{const mq=matchMedia('(max-width:720px)');const ds=[...document.querySelectorAll('footer details.foot-col')];const set=()=>ds.forEach(d=>{d.open=!mq.matches});set();mq.addEventListener?mq.addEventListener('change',set):mq.addListener(set);ds.forEach(d=>d.querySelector('summary').addEventListener('click',e=>{if(!mq.matches)e.preventDefault()}))})();
