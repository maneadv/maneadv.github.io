/* 名刺の発注・資料請求フォーム（入力の手引き・確認画面・送信） 2026-11 */
(function(){
  'use strict';
  const forms=document.querySelectorAll('form.ma-form');
  if(!forms.length)return;
  const vis=el=>{for(let e=el;e&&e.tagName!=='FORM';e=e.parentElement){if(e.hidden)return false}return true};
  const txt=s=>(s||'').replace(/\s+/g,' ').trim();

  forms.forEach(form=>{
    const gas=form.dataset.gas, mail=form.dataset.mail||'info@management-advisers.com';
    let dirty=false, sent=false;
    const bar=document.querySelector('.ma-progress[data-for="'+form.id+'"]');

    /* 選択ボタン（チップ） */
    const groupVal=g=>[...g.querySelectorAll('.chip[aria-pressed="true"]')].map(b=>b.dataset.v||txt(b.textContent));
    const vals={};
    const refreshWhen=()=>{
      form.querySelectorAll('.chips[data-name]').forEach(g=>{vals[g.dataset.name]=groupVal(g)});
      form.querySelectorAll('[data-when]').forEach(el=>{
        const [n,list]=el.dataset.when.split(':');const ok=list.split('|').some(v=>(vals[n]||[]).includes(v));
        el.hidden=!ok;
      });
      let k=0;form.querySelectorAll('fieldset.pick').forEach(f=>{if(!vis(f)||f.hidden)return;const i=f.querySelector('legend i');if(i)i.textContent=++k});
      setTimeout(progress,0);
    };
    form.addEventListener('click',e=>{
      const b=e.target.closest('.chip');if(!b||!form.contains(b))return;
      const g=b.closest('.chips');if(!g)return;
      if(g.dataset.single!==undefined){g.querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'))}
      else b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')==='true'?'false':'true');
      g.closest('.bad')&&clearErr(g.closest('.bad'));
      dirty=true;refreshWhen();
    });

    /* 人数分のくり返し */
    form.querySelectorAll('[data-repeat]').forEach(box=>{
      const tpl=box.querySelector('template'), list=box.querySelector('.rep-list'), add=box.querySelector('[data-add]'), max=+box.dataset.max||10;
      const renum=()=>{const ps=list.querySelectorAll('.person');ps.forEach((p,i)=>{p.querySelector('.person-no').textContent=(i+1)+box.dataset.unit;const d=p.querySelector('.person-del');if(d)d.hidden=ps.length<2});add.hidden=ps.length>=max;const n=box.querySelector('.rep-max');if(n)n.hidden=ps.length<max;setTimeout(progress,0)};
      const addOne=()=>{list.appendChild(tpl.content.cloneNode(true));renum()};
      add.addEventListener('click',()=>{addOne();const ps=list.querySelectorAll('.person');const f=ps[ps.length-1].querySelector('input');f&&f.focus()});
      list.addEventListener('click',e=>{const d=e.target.closest('.person-del');if(d){d.closest('.person').remove();renum()}});
      addOne();
    });

    /* 入力チェック */
    const errOf=(wrap,msg)=>{wrap.classList.add('bad');let s=wrap.querySelector(':scope > .err');if(!s){s=document.createElement('span');s.className='err';wrap.appendChild(s)}s.textContent=msg};
    const clearErr=wrap=>{wrap.classList.remove('bad');const s=wrap.querySelector(':scope > .err');s&&s.remove()};
    form.addEventListener('input',e=>{dirty=true;const w=e.target.closest('.bad');w&&clearErr(w);progress()});
    form.addEventListener('change',e=>{dirty=true;const w=e.target.closest('.bad');w&&clearErr(w);progress()});
    const reqs=()=>[...form.querySelectorAll('[required],.chips[data-required]')].filter(vis);
    const filled=el=>el.classList&&el.classList.contains('chips')?groupVal(el).length>0:(el.type==='checkbox'?el.checked:txt(el.value)!=='');
    const check=()=>{
      let first=null;
      reqs().forEach(el=>{
        const w=el.classList.contains('chips')?(el.closest('fieldset')||el):(el.closest('label')||el);
        let msg='';
        if(!filled(el))msg=el.dataset.msg||(el.classList.contains('chips')?'どれか1つを選んでください':el.type==='checkbox'?'確認のうえ、チェックを入れてください':'入力してください');
        else if(el.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim()))msg='メールアドレスの形を確認してください（例：name@example.co.jp）';
        else if(el.type==='tel'&&!/^[0-9０-９+\-－ー()（） ]{9,}$/.test(el.value.trim()))msg='電話番号を確認してください（例：06-0000-0000）';
        if(msg){errOf(w,msg);first=first||w}else clearErr(w);
      });
      if(first){first.scrollIntoView({behavior:'smooth',block:'center'});const f=first.querySelector('input,select,textarea,button');f&&setTimeout(()=>f.focus({preventScroll:true}),400)}
      return !first;
    };

    function progress(){if(!bar)return;const r=reqs();const n=r.filter(filled).length;const p=r.length?Math.round(n/r.length*100):0;bar.querySelector('b').textContent=p;bar.querySelector('.bar i').style.width=p+'%'}

    /* 送る文章を組み立てる */
    const build=()=>{
      const out=[];
      const walk=node=>{
        for(const el of node.children){
          if(el.hidden||el.tagName==='TEMPLATE'||el.classList.contains('confirm')||el.classList.contains('checks'))continue;
          if(el.tagName==='LEGEND'){const t=txt(el.dataset.head||el.textContent.replace(/必須|任意/g,''));t&&out.push('\n■ '+t.replace(/^\d+\s*/,''));continue}
          if(el.classList.contains('person')){out.push('【'+txt(el.querySelector('.person-no').textContent)+'】');walk(el);continue}
          if(el.classList.contains('chips')&&el.dataset.label){const v=groupVal(el);v.length&&out.push(el.dataset.label+'：'+v.join('、'));continue}
          if((el.tagName==='INPUT'||el.tagName==='SELECT'||el.tagName==='TEXTAREA')&&el.dataset.label){
            if(el.type==='checkbox'){if(el.checked)out.push(el.dataset.label+'：はい');continue}
            const v=el.value.trim();if(v)out.push(el.dataset.label+'：'+(el.tagName==='TEXTAREA'?'\n'+v:v));continue}
          walk(el);
        }
      };
      walk(form);
      const ok=[...form.querySelectorAll('.checks input[type=checkbox][data-label]')].filter(c=>c.checked).map(c=>c.dataset.label);
      if(ok.length)out.push('\n■ 確認事項\n'+ok.map(x=>x+'：済み').join('\n'));
      const lines=out.join('\n').split('\n');
      return lines.filter((l,i)=>{if(!/^■ /.test(l))return true;for(let k=i+1;k<lines.length;k++){if(/^■ /.test(lines[k]))return false;if(lines[k].trim())return true}return false}).join('\n').replace(/\n{3,}/g,'\n\n').trim();
    };
    const pick=role=>{const el=form.querySelector('[data-role="'+role+'"]');return el?el.value.trim():''};

    const confirmBox=form.querySelector('.confirm'), pre=confirmBox.querySelector('pre');
    const step1=form.querySelectorAll('.step-input'), step2=form.querySelectorAll('.step-confirm');
    const show=c=>{step1.forEach(e=>e.hidden=c);step2.forEach(e=>e.hidden=!c);(c?confirmBox:form).scrollIntoView({behavior:'smooth',block:'start'})};
    form.querySelector('[data-go="confirm"]').addEventListener('click',()=>{if(!check())return;pre.textContent=build();show(true)});
    form.querySelector('[data-go="back"]').addEventListener('click',()=>show(false));

    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=form.querySelector('[type="submit"]');btn.disabled=true;btn.firstChild.textContent='送信しています… ';
      const body=pre.textContent||build(), mode=(vals[form.dataset.modeName]||[])[0]||'';
      const topic=form.dataset.topic+(mode?'（'+mode+'）':'');
      let ok=false;
      if(gas){try{const r=await fetch(gas,{method:'POST',body:new URLSearchParams({name:pick('name'),company:pick('company'),email:pick('email'),tel:pick('tel'),topic,cat:form.dataset.cat||'',subs:form.dataset.subs||'',message:body,_honey:(form.querySelector('.hp-field')||{}).value||''})});const j=await r.json().catch(()=>({}));ok=!!j.ok}catch(_){}}
      if(ok){sent=true;form.querySelectorAll('.step-input,.step-confirm').forEach(x=>x.hidden=true);const s=form.querySelector('.sent');s.hidden=false;s.scrollIntoView({behavior:'smooth',block:'center'});bar&&(bar.hidden=true);return}
      btn.disabled=false;btn.firstChild.textContent='この内容で送信する ';
      const er=form.querySelector('.send-error');er.hidden=false;
      try{navigator.clipboard&&navigator.clipboard.writeText(body)}catch(_){}
      er.querySelector('.send-mail').onclick=()=>{location.href='mailto:'+mail+'?subject='+encodeURIComponent('【ホームページ】'+topic)+'&body='+encodeURIComponent(body.slice(0,1800)+(body.length>1800?'\n（続きは貼り付けてください）':''))};
    });

    addEventListener('beforeunload',e=>{if(dirty&&!sent){e.preventDefault();e.returnValue=''}});
    refreshWhen();
  });
})();
