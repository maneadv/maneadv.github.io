/* ==========================================================
   ご案内アシスタント
   右下の「ご案内」ボタンから、選ぶだけで目的のページ・お問い合わせへ案内する。
   文字で探すこともできる（サイト内の言葉から探す。外部には送らない）。
   ========================================================== */
(()=>{
const D=window.MA_ASSIST;if(!D||document.querySelector('.ma-as'))return;
const src=(document.currentScript&&document.currentScript.src)||'';
const BASE=src.replace(/assets\/assist\.js.*$/,'');
const U=p=>BASE+p;
const h=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ss={get:k=>{try{return sessionStorage.getItem(k)}catch(_){return null}},set:(k,v)=>{try{sessionStorage.setItem(k,v)}catch(_){}}};
const bizById=id=>D.biz.find(b=>b.id===id);
const catById=id=>D.cats.find(c=>c.id===id);
const telHref='tel:'+D.co.tel.replace(/[^\d]/g,'');

/* ---- 見た目 ---- */
const css=`
.ma-as{position:fixed;right:18px;bottom:calc(74px + env(safe-area-inset-bottom,0px));z-index:400;font-family:"Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,sans-serif}
html.intro-lock .ma-as{display:none}
.ma-as-btn{display:flex;align-items:center;gap:8px;padding:12px 18px 12px 14px;border-radius:999px;border:0;background:linear-gradient(135deg,#ff7a1a,#ff9a3c);color:#fff;font-size:15px;font-weight:700;letter-spacing:.06em;box-shadow:0 8px 24px rgba(255,122,26,.35),0 2px 6px rgba(0,0,0,.3);cursor:pointer}
.ma-as-btn i{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#fff;color:#ff7a1a;font-style:normal;font-weight:800;font-size:15px}
.ma-as-btn:focus-visible{outline:3px solid #fff;outline-offset:3px}
.ma-as.open .ma-as-btn{display:none}
.ma-as-hint{position:absolute;right:0;bottom:calc(100% + 10px);width:max-content;max-width:240px;background:#fff;color:#1f1d1a;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer}
.ma-as-hint::after{content:"";position:absolute;right:28px;top:100%;border:8px solid transparent;border-top-color:#fff}
.ma-as-panel{display:none;position:fixed;right:18px;bottom:calc(18px + env(safe-area-inset-bottom,0px));width:min(400px,calc(100vw - 24px));height:min(640px,calc(100vh - 36px));flex-direction:column;background:#fbfaf8;color:#1f1d1a;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45)}
.ma-as.open .ma-as-panel{display:flex}
.ma-as-head{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 16px;background:#0d1b2c;color:#fff}
.ma-as-head b{flex:1;font-size:15px;letter-spacing:.06em}
.ma-as-head b small{display:block;font-weight:400;font-size:11px;opacity:.7;letter-spacing:0}
.ma-as-head button{border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer}
.ma-as-head .x{width:34px;height:34px;padding:0;border-radius:50%;font-size:18px;line-height:1}
.ma-as-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;font-size:15px;line-height:1.65}
.ma-as-log .b{align-self:flex-start;max-width:92%;background:#fff;border:1px solid #ebe5dc;border-radius:4px 14px 14px 14px;padding:10px 13px}
.ma-as-log .u{align-self:flex-end;max-width:85%;background:#ff7a1a;color:#fff;border-radius:14px 4px 14px 14px;padding:8px 13px;font-weight:600}
.ma-as-log .b small{display:block;color:#6b655d;font-size:13px;margin-top:4px}
.ma-as-log .b ul{margin:6px 0 0;padding-left:1.2em;font-size:14px}
.ma-as-opts{display:flex;flex-direction:column;gap:6px;align-self:stretch}
.ma-as-opts button,.ma-as-opts a{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:11px 14px;border-radius:12px;border:1px solid #e3dbcf;background:#fff;color:#1f1d1a;font-size:15px;font-weight:600;text-decoration:none;cursor:pointer;line-height:1.4}
.ma-as-opts button:hover,.ma-as-opts a:hover{border-color:#ff7a1a;background:#fff8f2}
.ma-as-opts .pri{background:#ff7a1a;border-color:#ff7a1a;color:#fff}
.ma-as-opts .pri:hover{background:#f06c10}
.ma-as-opts i{font-style:normal;flex:0 0 26px;height:26px;display:grid;place-items:center;border-radius:8px;background:#fdeee0;color:#e8691a;font-size:14px}
.ma-as-opts .pri i{background:rgba(255,255,255,.25);color:#fff}
.ma-as-opts span small{display:block;font-weight:400;font-size:12px;color:#6b655d}
.ma-as-opts .pri span small{color:#ffe9d6}
.ma-as-opts .on{border-color:#ff7a1a;background:#fff3e8}
.ma-as-opts .on i{background:#ff7a1a;color:#fff}
.ma-as-foot{display:flex;gap:8px;padding:10px;border-top:1px solid #ebe5dc;background:#fff}
.ma-as-foot input{flex:1;min-width:0;padding:11px 12px;border:1px solid #d9d1c5;border-radius:10px;font-size:16px;background:#fff;color:#1f1d1a}
.ma-as-foot button{padding:0 16px;border:0;border-radius:10px;background:#0d1b2c;color:#fff;font-weight:700;font-size:14px;cursor:pointer}
.ma-as-quick{display:flex;gap:6px;padding:8px 10px 0;background:#fff;overflow-x:auto}
.ma-as-quick a,.ma-as-quick button{flex:0 0 auto;padding:6px 12px;border-radius:999px;border:1px solid #e3dbcf;background:#fff;color:#1f1d1a;font-size:13px;text-decoration:none;cursor:pointer;white-space:nowrap}
html.ma-big .ma-as-log{font-size:18px}html.ma-big .ma-as-opts button,html.ma-big .ma-as-opts a{font-size:18px;padding:14px 16px}
@media(max-width:560px){
 .ma-as{right:12px;bottom:calc(70px + env(safe-area-inset-bottom,0px))}
 .ma-as-btn{padding:11px 16px 11px 12px;font-size:14px}
 .ma-as-panel{right:0;left:0;bottom:0;width:100%;height:88vh;height:88dvh;border-radius:18px 18px 0 0}
}
@media print{.ma-as{display:none}}
`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

/* ---- 部品 ---- */
const root=document.createElement('div');root.className='ma-as';
root.innerHTML=`<button type="button" class="ma-as-btn" aria-haspopup="dialog" aria-expanded="false"><i aria-hidden="true">？</i>ご案内</button>
<div class="ma-as-panel" role="dialog" aria-label="ご案内" aria-modal="false">
 <div class="ma-as-head"><b>ご案内<small>選ぶだけで、目的のページへご案内します</small></b><button type="button" class="big" aria-pressed="false">文字を大きく</button><button type="button" class="home">最初へ</button><button type="button" class="x" aria-label="閉じる">×</button></div>
 <div class="ma-as-log" aria-live="polite"></div>
 <div class="ma-as-quick"><a href="${telHref}">📞 電話する</a><a href="${U('contact/index.html')}">✉ お問い合わせ</a><a href="${U('company/index.html')}">📍 場所・地図</a></div>
 <form class="ma-as-foot"><input type="search" placeholder="言葉で探す（例：実家の片付け）" aria-label="言葉で探す" enterkeyhint="search"><button>探す</button></form>
</div>`;
document.body.appendChild(root);
const btn=root.querySelector('.ma-as-btn'),log=root.querySelector('.ma-as-log'),inp=root.querySelector('.ma-as-foot input');

const scroll=()=>{log.scrollTop=log.scrollHeight};
const say=(html)=>{const d=document.createElement('div');d.className='b';d.innerHTML=html;log.appendChild(d);scroll();return d};
const me=(t)=>{const d=document.createElement('div');d.className='u';d.textContent=t;log.appendChild(d);scroll()};
// opts: [{t:表示, s:補足, i:印, go:関数 | href:URL, pri:true}]
const opts=(list)=>{log.querySelectorAll('.ma-as-opts').forEach(o=>o.remove());
  const w=document.createElement('div');w.className='ma-as-opts';
  list.forEach(o=>{const el=document.createElement(o.href?'a':'button');if(o.href){el.href=o.href;if(/^https?:/.test(o.href)&&o.href.indexOf(location.host)<0){el.target='_blank';el.rel='noopener'}}else el.type='button';
    if(o.pri)el.className='pri';el.innerHTML=`<i aria-hidden="true">${h(o.i||'›')}</i><span>${h(o.t)}${o.s?'<small>'+h(o.s)+'</small>':''}</span>`;
    if(o.go)el.addEventListener('click',()=>{me(o.t);o.go()});w.appendChild(el)});
  log.appendChild(w);scroll();const f=w.querySelector('button,a');if(f&&root.classList.contains('open'))f.focus({preventScroll:true})};
const back=()=>({t:'最初に戻る',i:'↺',go:start});

/* ---- 会話の流れ ---- */
function start(){
  say('こんにちは。<b>'+h(D.co.name)+'</b>のご案内です。<br>何をお探しですか？下から選んでください。');
  opts([
    {t:'困りごとから探す',s:'「集客」「片付け」などから選べます',i:'？',go:issues},
    {t:'相談できる分野から探す',s:'当社の事業を分野ごとにご案内',i:'▦',go:cats},
    {t:'よくある質問',s:'費用・受付時間・オンライン相談など',i:'Q',go:faq},
    {t:'電話番号・場所・受付時間',i:'📍',go:info},
    {t:'代理店・パートナーになりたい',i:'∞',go:()=>{say('代理店・パートナーの募集についてご案内します。');opts([{t:'募集のページを見る',i:'›',href:U('agency/index.html'),pri:true},{t:'代理店として問い合わせる',i:'✉',go:()=>toContact('ag-dealer',[])},back()])}},
    {t:'採用について知りたい',i:'◎',go:()=>{say('採用情報のページをご案内します。営業職・事務職・アルバイト・パートを募集しています。');opts([{t:'採用情報を見る',i:'›',href:U('recruit/index.html'),pri:true},{t:'採用について問い合わせる',i:'✉',go:()=>toContact('rc-sales',[])},back()])}},
  ]);
}
function issues(){say('どんなことでお困りですか？近いものを選んでください。');
  opts(D.issues.map(x=>({t:x.t,s:x.s,i:(bizById(x.id)||{}).icon||'›',go:()=>biz(x.id)})).concat([{t:'どれにも当てはまらない',i:'…',go:unsure},back()]))}
function cats(){say('分野を選んでください。');
  opts(D.cats.map(c=>({t:c.name,i:c.icon,go:()=>cat(c.id)})).concat([back()]))}
function cat(id){const c=catById(id);say('「'+h(c.name)+'」では、次のご相談を承っています。');
  opts(D.biz.filter(b=>b.cat===id).map(b=>({t:b.name,s:b.summary,i:b.icon,go:()=>biz(b.id)})).concat([{t:'分野の一覧に戻る',i:'‹',go:cats},back()]))}
function biz(id){const b=bizById(id);if(!b)return start();
  say('<b>'+h(b.name)+'</b><br>'+h(b.summary)+(b.targets.length?'<small>こんな方へ：'+b.targets.map(h).join('／')+'</small>':''));
  opts([{t:'この内容で相談する',s:'くわしい内容を選んで、お問い合わせへ',i:'✉',pri:true,go:()=>pickSubs(b)},
    {t:'くわしく見る',s:'この事業のページを開きます',i:'›',href:U(b.url)},
    {t:'電話で相談する',s:D.co.tel+'（受付 '+D.co.hours+'）',i:'📞',href:telHref},
    {t:'ほかの分野を見る',i:'‹',go:()=>cat(b.cat)},back()])}
function pickSubs(b){const sel=new Set();
  say('くわしい内容を選んでください（いくつでも選べます。分からなければそのまま「次へ」）。');
  log.querySelectorAll('.ma-as-opts').forEach(o=>o.remove());
  const w=document.createElement('div');w.className='ma-as-opts';
  b.subs.forEach(s=>{const el=document.createElement('button');el.type='button';el.setAttribute('aria-pressed','false');el.innerHTML='<i aria-hidden="true">＋</i><span>'+h(s)+'</span>';
    el.addEventListener('click',()=>{const on=!sel.has(s);on?sel.add(s):sel.delete(s);el.classList.toggle('on',on);el.setAttribute('aria-pressed',String(on));el.querySelector('i').textContent=on?'✓':'＋'});w.appendChild(el)});
  const go=document.createElement('button');go.type='button';go.className='pri';go.innerHTML='<i aria-hidden="true">→</i><span>次へ（お問い合わせフォームへ）<small>選んだ内容が入った状態で開きます</small></span>';
  go.addEventListener('click',()=>{me(sel.size?[...sel].join('、'):'まだ決まっていない');toContact(b.id,[...sel])});
  w.appendChild(go);log.appendChild(w);scroll();w.querySelector('button').focus({preventScroll:true})}
function toContact(id,subs){
  say('お問い合わせフォームを開きます。お名前とご連絡先を入れて送信してください。');
  ss.set('ma-prefill',subs.length?subs.map(s=>'・'+s).join('\n'):'');
  const url=U('contact/index.html')+'#'+encodeURIComponent(id);
  setTimeout(()=>{if(/contact\/(index\.html)?$/.test(location.pathname)){location.hash=id;location.reload()}else location.href=url},500)}
function faq(){say('よくある質問です。知りたいものを選んでください。');
  opts(D.faq.map(f=>({t:f.q,i:'Q',go:()=>{say(h(f.a));opts([{t:'ほかの質問を見る',i:'Q',go:faq},{t:'お問い合わせする',i:'✉',href:U('contact/index.html')},back()])}})).concat([back()]))}
function info(){const c=D.co;
  say('<b>'+h(c.name)+'</b><ul><li>電話：<a href="'+telHref+'">'+h(c.tel)+'</a>（受付 '+h(c.hours)+'）</li><li>メール：<a href="mailto:'+h(c.mail)+'">'+h(c.mail)+'</a></li><li>住所：'+h(c.addr)+'</li><li>'+h(c.access)+'</li></ul>');
  opts([{t:'電話をかける',i:'📞',href:telHref,pri:true},{t:'地図を開く',i:'📍',href:c.map},{t:'会社概要を見る',i:'›',href:U('company/index.html')},back()])}
function unsure(){say('大丈夫です。ご相談の内容がまとまっていなくても、お話を伺いながら一緒に整理します。初回のご相談は無料です。');
  opts([{t:'フォームで相談する',s:'「どこに相談すればよいか分からない」で送れます',i:'✉',pri:true,go:()=>toContact('ot-unknown',[])},{t:'電話で相談する',s:D.co.tel+'（受付 '+D.co.hours+'）',i:'📞',href:telHref},{t:'言葉で探す',s:'下の欄に入力してください',i:'⌕',go:()=>{say('下の欄に、気になる言葉を入れて「探す」を押してください。');inp.focus()}},back()])}

/* ---- 言葉で探す（サイト内だけで探す） ---- */
const SYN=[['片付け','整理'],['片づけ','整理'],['かたづけ','整理'],['実家','家じまい'],['空き家','空き家'],['遺品','遺品整理'],['売りたい','買取'],['売る','買取'],['うりたい','買取'],['安く','削減'],['節約','削減'],['経費','コスト'],['費用','無料'],['料金','無料'],['値段','無料'],['人手','採用'],['人が足りない','採用'],['求人','採用'],['HP','ホームページ'],['ＨＰ','ホームページ'],['サイト','ホームページ'],['ネット','光回線'],['電話代','電話関連'],['携帯','電話関連'],['介護','介護'],['病院','医療'],['入院','保証代行'],['保証人','保証代行'],['身元','身元保証'],['海外','海外'],['輸出','輸出'],['補助金','補助金'],['助成金','補助金'],['許可','許認可'],['働きたい','採用情報'],['仕事','採用情報'],['場所','所在地'],['住所','所在地'],['地図','所在地'],['行き方','アクセス'],['営業時間','受付時間'],['何時','受付時間'],['アプリ','アプリ'],['ゲーム','ゲーム'],['AI','AI'],['集客','集客'],['売上','売上']];
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s、。・,.!?！？「」（）()]/g,'');
const grams=s=>{const g=[];for(let i=0;i<s.length-1;i++)g.push(s.slice(i,i+2));return s.length===1?[s]:g};
const DOCS=[].concat(
  D.biz.map(b=>({k:'biz',id:b.id,t:b.name,s:b.summary,key:norm(b.name+' '+b.subs.join(' ')),text:norm([b.name,b.name,b.summary,b.body,b.targets.join(' '),b.subs.join(' ')].join(' '))})),
  D.faq.map((f,i)=>({k:'faq',i,t:f.q,s:f.a,text:norm(f.q+f.q+f.a)})),
  D.pages.map(p=>({k:'page',t:p.name,url:p.url,s:'',text:norm(p.name+p.name+p.kw)})));
function search(q){let qs=[norm(q)];const core=qs[0].replace(/(について|を?相談したい|を?作りたい|を?つくりたい|してほしい|したい|ほしい|たい|です|ます|どこ|どう|ですか|か)$/g,'').replace(/(を|が|は|に|の|で|と|も)/g,'');if(core&&core!==qs[0]&&core.length>1)qs.push(core);SYN.forEach(([a,b])=>{if(qs[0].indexOf(norm(a))>=0)qs.push(norm(b))});
  const res=DOCS.map(d=>{let sc=0;qs.forEach((x,j)=>{if(!x)return;const w=j?0.8:1;if(d.text.indexOf(x)>=0)sc+=10*w*(1+Math.min(x.length,6)/6);if(d.key&&d.key.indexOf(x)>=0)sc+=12*w;const g=grams(x);let hit=0;g.forEach(y=>{if(d.text.indexOf(y)>=0)hit++});sc+=6*w*hit/g.length});return {d,sc}});
  return res.filter(r=>r.sc>=4.5).sort((a,b)=>b.sc-a.sc).slice(0,4).map(r=>r.d)}
root.querySelector('.ma-as-foot').addEventListener('submit',e=>{e.preventDefault();const q=inp.value.trim();if(!q)return;inp.value='';me(q);
  const r=search(q);
  if(!r.length){say('「'+h(q)+'」に合うものが見つかりませんでした。お電話かフォームで、そのままお伝えください。');
    opts([{t:'フォームで相談する',i:'✉',pri:true,go:()=>toContact('ot-unknown',[])},{t:'電話する',s:D.co.tel+'（受付 '+D.co.hours+'）',i:'📞',href:telHref},{t:'困りごとから探す',i:'？',go:issues},back()]);return}
  say('「'+h(q)+'」に近いものです。');
  opts(r.map(d=>d.k==='biz'?{t:d.t,s:d.s,i:(bizById(d.id)||{}).icon||'›',go:()=>biz(d.id)}:d.k==='faq'?{t:d.t,i:'Q',go:()=>{say(h(d.s));opts([{t:'お問い合わせする',i:'✉',href:U('contact/index.html')},back()])}}:{t:d.t,s:'ページを開きます',i:'›',href:U(d.url)}).concat([back()]))});

/* ---- 開く・閉じる ---- */
let started=false;
const open=()=>{root.classList.add('open');btn.setAttribute('aria-expanded','true');hideHint();ss.set('ma-as-hint','1');
  if(!started){started=true;start()}else{const f=log.querySelector('.ma-as-opts button,.ma-as-opts a');f&&f.focus({preventScroll:true})}};
const close=()=>{root.classList.remove('open');btn.setAttribute('aria-expanded','false');btn.focus({preventScroll:true})};
btn.addEventListener('click',open);
root.querySelector('.x').addEventListener('click',close);
root.querySelector('.home').addEventListener('click',()=>{me('最初に戻る');start()});
const big=root.querySelector('.big');
const setBig=on=>{document.documentElement.classList.toggle('ma-big',on);big.setAttribute('aria-pressed',String(on));big.textContent=on?'文字を元に':'文字を大きく';try{localStorage.setItem('ma-big',on?'1':'0')}catch(_){}};
try{if(localStorage.getItem('ma-big')==='1')setBig(true)}catch(_){}
big.addEventListener('click',()=>setBig(!document.documentElement.classList.contains('ma-big')));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root.classList.contains('open'))close()});

/* ---- 初めての方へ、ひとことお声がけ（1回だけ） ---- */
let hintEl=null;
const hideHint=()=>{if(hintEl){hintEl.remove();hintEl=null}};
if(!ss.get('ma-as-hint')&&!/contact\//.test(location.pathname)){
  const show=()=>{if(document.documentElement.classList.contains('intro-lock')||root.classList.contains('open')||ss.get('ma-as-hint'))return setTimeout(show,4000);
    ss.set('ma-as-hint','1');hintEl=document.createElement('div');hintEl.className='ma-as-hint';hintEl.textContent='お探しのものはありますか？ ご案内します';
    hintEl.addEventListener('click',open);root.appendChild(hintEl);setTimeout(hideHint,9000)};
  setTimeout(show,9000)}
})();
