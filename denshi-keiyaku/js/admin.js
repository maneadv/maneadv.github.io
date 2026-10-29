// ===== 管理画面 =====
const V = document.getElementById('view');
let ME = null, COMPANIES = [], TEMPLATES = [], SETTINGS = {};

const PRESET_FIELDS = [
  { key: 'name', label: '契約名義人氏名', type: 'text' },
  { key: 'company', label: '会社名・屋号', type: 'text' },
  { key: 'position', label: '役職', type: 'text' },
  { key: 'address', label: '住所', type: 'text' },
  { key: 'tel', label: '電話番号', type: 'tel' },
  { key: 'birth', label: '生年月日', type: 'date' },
  { key: 'bank', label: '振込先口座', type: 'textarea' }
];
const PRESET_ATTS = [
  { key: 'id_front', label: '本人確認書類（表面）', kind: 'camera' },
  { key: 'id_back', label: '本人確認書類（裏面）', kind: 'camera' },
  { key: 'photo', label: '画像', kind: 'image' },
  { key: 'docs', label: '資料', kind: 'file' }
];
const FIELD_TYPES = { text: '一行', textarea: '複数行', date: '日付', tel: '電話', email: 'メール', number: '数字' };
const ATT_KINDS = { camera: '撮影＋書類', image: '画像のみ', file: '書類ファイル' };

// ---------- ログイン ----------
async function boot() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return showLogin();
  ME = data.session.user;
  let ok = false;
  try { ok = must(await sb.rpc('is_staff')); } catch (e) { }
  if (!ok) { await sb.auth.signOut(); return showLogin('このアカウントは担当者として登録されていません（手順書の「担当者の登録」を参照）'); }
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('mainView').classList.remove('hidden');
  document.getElementById('who').textContent = ME.email;
  await loadMasters();
  route();
}
function showLogin(msg) {
  document.getElementById('mainView').classList.add('hidden');
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('lMsg').textContent = msg || '';
}
document.getElementById('lBtn').onclick = async () => {
  const email = document.getElementById('lEmail').value.trim(), password = document.getElementById('lPass').value;
  try { await run(async () => must(await sb.auth.signInWithPassword({ email, password }))); } catch (e) { return; }
  boot();
};
document.getElementById('lPass').onkeydown = e => { if (e.key === 'Enter') document.getElementById('lBtn').click(); };
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { location.hash = b.dataset.go; });

async function loadMasters() {
  const [c, t, s] = await Promise.all([
    sb.from('companies').select('*').order('created_at'),
    sb.from('templates').select('*').order('created_at'),
    sb.from('app_settings').select('*')
  ]);
  COMPANIES = must(c); TEMPLATES = must(t);
  SETTINGS = {}; must(s).forEach(r => SETTINGS[r.key] = r.value);
}
const coName = id => (COMPANIES.find(c => c.id === id) || {}).name || '（削除済み）';

// ---------- 画面切り替え ----------
window.addEventListener('hashchange', route);
function route() {
  if (!ME) return;
  const h = location.hash || '#list';
  const [p, id] = h.slice(1).split('/');
  const tab = { list: '#list', c: '#list', new: '#new', edit: '#new', tpl: '#tpl', legal: '#legal', auto: '#auto', co: '#co', set: '#set' }[p] || '#list';
  document.querySelectorAll('[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === tab));
  window.scrollTo(0, 0);
  ({ list: viewList, c: viewDetail, new: viewEdit, edit: viewEdit, tpl: viewTemplates, legal: viewLegal, auto: viewIntakes, co: viewCompanies, set: viewSettings }[p] || viewList)(id);
}

// ================= 契約一覧 =================
let LIST_FILTER = { q: '', co: '', st: '' };
async function viewList() {
  V.innerHTML = `<div class="pagehead"><h2>契約一覧</h2><button class="btn primary" onclick="location.hash='#new'">＋ 新規作成</button></div>
    <div class="filters">
      <input id="fq" placeholder="契約番号・契約書名・署名者で検索" value="${esc(LIST_FILTER.q)}">
      <select id="fco"><option value="">すべての発行会社</option>${COMPANIES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <select id="fst"><option value="">すべての状態</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    </div><div id="listBody"><div class="empty">読み込み中…</div></div>`;
  document.getElementById('fco').value = LIST_FILTER.co;
  document.getElementById('fst').value = LIST_FILTER.st;
  let rows;
  try {
    rows = must(await sb.from('contracts')
      .select('id,contract_no,title,status,draft_review,draft_result,signer_name,signer_email,company_id,created_at,sent_at,signed_at,token_expires_at,intake_id')
      .order('created_at', { ascending: false }).limit(1000));
  } catch (e) { return toast(errText(e), 'err'); }
  if (!document.getElementById('listBody')) return;   // 読み込み中に別の画面へ移動した
  const draw = () => {
    const q = LIST_FILTER.q.toLowerCase();
    const list = rows.filter(r => (!LIST_FILTER.co || r.company_id === LIST_FILTER.co)
      && (!LIST_FILTER.st || effectiveStatus(r) === LIST_FILTER.st)
      && (!q || [r.contract_no, r.title, r.signer_name, r.signer_email].join(' ').toLowerCase().includes(q)));
    document.getElementById('listBody').innerHTML = list.length ? `<table class="list">
      <thead><tr><th>契約番号</th><th>契約書名</th><th>発行会社</th><th>署名者</th><th>状態</th><th>日時</th></tr></thead>
      <tbody>${list.map(r => `<tr class="click" data-id="${r.id}">
        <td class="mono">${esc(r.contract_no)}</td><td><b>${esc(r.title)}</b>${r.intake_id ? ' <span class="badge b-review">自動受付</span>' : ''}</td><td>${esc(coName(r.company_id))}</td>
        <td>${esc(r.signer_name)}</td>
        <td>${badge(r)}${r.status === 'review' && r.draft_result ? ` <span class="badge ${r.draft_result === 'approved' ? 'b-signed' : 'b-viewed'}">${r.draft_result === 'approved' ? '承認' : '修正依頼'}</span>` : ''}</td>
        <td class="muted">${fmt(r.signed_at || r.sent_at || r.created_at)}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty card">該当する契約はありません</div>';
    document.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => location.hash = '#c/' + tr.dataset.id);
  };
  document.getElementById('fq').oninput = e => { LIST_FILTER.q = e.target.value; draw(); };
  document.getElementById('fco').onchange = e => { LIST_FILTER.co = e.target.value; draw(); };
  document.getElementById('fst').onchange = e => { LIST_FILTER.st = e.target.value; draw(); };
  draw();
}

// ================= 記入項目・添付項目の選択部品 =================
function makePicker(el, mode, initial) {
  const presets = mode === 'field' ? PRESET_FIELDS : PRESET_ATTS;
  const opts = mode === 'field' ? FIELD_TYPES : ATT_KINDS;
  const tkey = mode === 'field' ? 'type' : 'kind';
  let items = presets.map(p => {
    const hit = (initial || []).find(i => i.key === p.key);
    return { ...p, ...(hit || {}), on: !!hit, preset: true, required: hit ? !!hit.required : false };
  });
  (initial || []).filter(i => !presets.some(p => p.key === i.key)).forEach(i => items.push({ ...i, on: true, preset: false }));
  function draw() {
    el.innerHTML = `<div class="field-pick">${items.map((it, i) => `<div class="it">
        <input type="checkbox" data-i="${i}" data-a="on" ${it.on ? 'checked' : ''}>
        ${it.preset ? `<span>${esc(it.label)}</span>` : `<input data-i="${i}" data-a="label" value="${esc(it.label)}" placeholder="項目名" style="padding:5px 8px">`}
        <select data-i="${i}" data-a="${tkey}">${Object.entries(opts).map(([k, v]) => `<option value="${k}" ${it[tkey] === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <span class="rq"><input type="checkbox" data-i="${i}" data-a="required" ${it.required ? 'checked' : ''}>必須${it.preset ? '' : ` <button class="del" data-del="${i}" title="削除">×</button>`}</span>
        ${mode === 'field' && it.on ? `<div class="pre">
          ${it.type === 'textarea'
            ? `<textarea data-i="${i}" data-a="value" placeholder="発行側で記入（空欄なら署名者が記入）">${esc(it.value || '')}</textarea>`
            : `<input data-i="${i}" data-a="value" type="${it.type === 'date' ? 'date' : 'text'}" value="${esc(it.value || '')}" placeholder="発行側で記入（空欄なら署名者が記入）">`}
          <label class="rq ed ${(it.value || '').trim() ? '' : 'hidden'}"><input type="checkbox" data-i="${i}" data-a="editable" ${it.editable ? 'checked' : ''}>署名者の修正を許可</label>
        </div>` : ''}
      </div>`).join('')}</div>
      <button class="btn ghost" data-add style="margin-top:4px">＋ ${mode === 'field' ? '記入項目' : '添付項目'}を追加</button>`;
    el.querySelectorAll('[data-a]').forEach(inp => {
      const ev = inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'onchange' : 'oninput';
      inp[ev] = () => {
        const it = items[+inp.dataset.i];
        it[inp.dataset.a] = inp.type === 'checkbox' ? inp.checked : inp.value;
        if (inp.dataset.a === 'required' && inp.checked && !it.on) { it.on = true; draw(); }
        else if (inp.dataset.a === 'on' || inp.dataset.a === 'type') draw();
        else if (inp.dataset.a === 'value') inp.closest('.pre').querySelector('.ed').classList.toggle('hidden', !inp.value.trim());
        el.dispatchEvent(new Event('pick'));
      };
    });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { items.splice(+b.dataset.del, 1); draw(); el.dispatchEvent(new Event('pick')); });
    el.querySelector('[data-add]').onclick = () => {
      items.push({ key: 'c_' + Math.random().toString(36).slice(2, 8), label: '', [tkey]: mode === 'field' ? 'text' : 'file', required: false, on: true, preset: false });
      draw();
    };
  }
  draw();
  return {
    get() {
      return items.filter(i => i.on && (i.label || '').trim()).map(i => {
        const o = { key: i.key, label: i.label.trim(), required: !!i.required };
        o[tkey] = i[tkey];
        if (mode === 'field' && (i.value || '').trim()) { o.value = i.value.trim(); o.editable = !!i.editable; }
        return o;
      });
    }
  };
}

// ================= 新規作成・編集 =================
const BUILTIN = ['会社名', '会社住所', '代表者', '署名者氏名', '署名者メール', '作成日'];
function fillBody(text, co, signer, vars) {
  const map = {
    '会社名': co.name || '', '会社住所': co.address || '', '代表者': co.representative || '',
    '署名者氏名': signer.name || '', '署名者メール': signer.email || '', '作成日': todayJa(), ...vars
  };
  return text.replace(/\{\{([^{}]+)\}\}/g, (m, k) => (map[k.trim()] !== undefined && map[k.trim()] !== '') ? map[k.trim()] : m);
}
function customVars(text) {
  const s = new Set();
  (text.match(/\{\{([^{}]+)\}\}/g) || []).forEach(m => { const k = m.slice(2, -2).trim(); if (!BUILTIN.includes(k)) s.add(k); });
  return [...s];
}

async function viewEdit(id) {
  let c = null;
  if (id) {
    try { c = must(await sb.from('contracts').select('*').eq('id', id).single()); }
    catch (e) { return toast(errText(e), 'err'); }
    if (!['draft', 'review'].includes(c.status)) { toast('本契約書の送信後は編集できません', 'err'); location.hash = '#c/' + id; return; }
  }
  const vars = {};
  const hand = window.__handoff; window.__handoff = null;   // リーガルチェック等からの引き継ぎ
  V.innerHTML = `<div class="pagehead"><h2>${c ? '契約書の編集' : '契約書の新規作成'}</h2>
      <div class="row">${!c ? '<button class="btn primary" id="wizOpen">📋 よく使う契約書から作る</button>' : ''}
      ${c ? `<button class="btn" onclick="location.hash='#c/${c.id}'">← 詳細へ戻る</button>` : ''}</div></div>
    <div id="wizard" class="hidden"></div>
    <div class="detail" id="editMain">
      <div>
        <div class="card">
          <div class="grid2">
            <div><label style="margin-top:0">発行会社</label><select id="eCo">${COMPANIES.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>
            <div><label style="margin-top:0">雛形から作成</label><select id="eTpl"><option value="">（白紙から作成）</option></select></div>
          </div>
          <label>契約書名</label><input id="eTitle" value="${esc(c ? c.title : '')}">
          <div class="grid2">
            <div><label>署名者（相手方）氏名・会社名</label><input id="eName" value="${esc(c ? c.signer_name : '')}"></div>
            <div><label>署名者メールアドレス</label><input id="eEmail" type="email" value="${esc(c ? c.signer_email : '')}"></div>
          </div>
          <div class="row" style="justify-content:space-between;margin-top:14px">
            <label style="margin:0">本文</label>
            <div class="seg3" style="grid-template-columns:1fr 1fr;width:280px;margin:0">
              <button data-bm="clause" data-ty="edit">条項ごとに確認・修正</button><button data-bm="full" data-ty="edit">全文を編集</button></div>
          </div>
          <div id="ceBox" style="margin-top:8px"></div>
          <div id="fullBox" class="hidden" style="margin-top:8px">
            <div class="muted" style="margin-bottom:6px">差し込み：<span id="chips"></span></div>
            <textarea id="eBody" style="min-height:420px;font-family:'Noto Serif JP',serif">${esc(c ? c.body : '')}</textarea>
          </div>
          <div id="varBox"></div>
        </div>
        <div class="card" style="margin-top:16px">
          <h3 style="font-size:16px">プレビュー</h3>
          <div id="prev" style="margin-top:10px"></div>
        </div>
      </div>
      <div class="side">
        <div class="card">
          <h3 style="font-size:15px">署名者の流れ</h3>
          <label class="switch"><input type="checkbox" id="eDraft" ${c && c.draft_review ? 'checked' : ''}>
            <span><b>ドラフト確認を行う</b><br><span class="muted">本契約書の前に案を確認・承認してもらう</span></span></label>
        </div>
        <div class="card">
          <h3 style="font-size:15px">署名者の記入項目</h3>
          <div class="muted">本文に <b>[[項目名]]</b> と書くと、その位置に記入内容が入ります。</div>
          <div id="pkF" style="margin-top:8px"></div>
        </div>
        <div class="card">
          <h3 style="font-size:15px">添付してもらう書類</h3>
          <div id="pkA" style="margin-top:8px"></div>
        </div>
        <div class="card actions">
          <button class="btn primary" id="saveBtn">下書きとして保存</button>
          <div class="muted">保存後、詳細画面からドラフト確認依頼・本契約書の送信を行います。</div>
        </div>
      </div>
    </div>`;
  const $ = s => document.getElementById(s);
  if (c) $('eCo').value = c.company_id;
  Object.keys(NUM_STATE).forEach(k => delete NUM_STATE[k]);
  // 差し込み前の本文が残っていれば、それを使って編集する（金額などを入力欄で変更できる）
  if (c && c.body_src && c.vars && Object.keys(c.vars).length) {
    const co0 = COMPANIES.find(x => x.id === c.company_id) || {};
    if (fillBody(c.body_src, co0, { name: c.signer_name, email: c.signer_email }, c.vars) === c.body) {
      $('eBody').value = c.body_src;
      Object.entries(c.vars).forEach(([k, v]) => { if (k !== '__num') vars[k] = v; });
      Object.assign(NUM_STATE, JSON.parse(JSON.stringify(c.vars.__num || {})));
    }
  }
  const tplSel = $('eTpl');
  const fillTpl = () => {
    const co = $('eCo').value;
    tplSel.innerHTML = '<option value="">（白紙から作成）</option>' + TEMPLATES
      .filter(t => !t.company_id || t.company_id === co)
      .map(t => `<option value="${t.id}">${esc(t.title)}${t.company_id ? '' : '（共通）'}</option>`).join('');
  };
  fillTpl();
  let pkF = makePicker($('pkF'), 'field', c ? c.fields : []);
  let pkA = makePicker($('pkA'), 'att', c ? c.attachments : []);

  const drawChips = () => {
    const f = pkF.get().map(x => `[[${x.label}]]`);
    $('chips').innerHTML = BUILTIN.map(k => `{{${k}}}`).concat(f).map(t => `<span class="chip" data-ins="${esc(t)}">${esc(t)}</span>`).join('');
    $('chips').querySelectorAll('[data-ins]').forEach(ch => ch.onclick = () => {
      const ta = $('eBody'), s = ta.selectionStart, e = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + ch.dataset.ins + ta.value.slice(e);
      ta.focus(); ta.selectionStart = ta.selectionEnd = s + ch.dataset.ins.length; update();
    });
  };
  const drawVars = () => {
    const ks = customVars($('eBody').value);
    const tp = TEMPLATES.find(x => x.id === tplSel.value), lib = tp && CONTRACT_LIBRARY.find(l => l.name === tp.title);
    const own = {}; if (lib) lib.inputs.forEach(i => { if (i.def) own[i.key] = i.def; });
    ks.forEach(k => { if (vars[k] === undefined && (own[k] || LIB_DEFAULTS[k])) vars[k] = own[k] || LIB_DEFAULTS[k]; });
    $('varBox').innerHTML = ks.length ? `<div class="card" style="margin-top:12px;background:#fafbfc"><b style="font-size:14px">差し込み項目の入力</b>
      <div class="grid2">${ks.map(k => `<div><label>${esc(k)}</label><input data-var="${esc(k)}" value="${esc(vars[k] || '')}"></div>`).join('')}</div></div>` : '';
    $('varBox').querySelectorAll('[data-var]').forEach(i => i.oninput = () => { vars[i.dataset.var] = i.value; drawPrev(); });
    enhanceNumbers($('varBox'), 'data-var');
  };
  const current = () => {
    const co = COMPANIES.find(x => x.id === $('eCo').value) || {};
    const signer = { name: $('eName').value.trim(), email: $('eEmail').value.trim() };
    return {
      company_id: co.id, title: $('eTitle').value.trim(),
      body: fillBody($('eBody').value, co, signer, { ...vars, '作成日': vars['作成日'] || todayJa() }),
      body_src: $('eBody').value,
      vars: { ...vars, '作成日': vars['作成日'] || todayJa(), __num: JSON.parse(JSON.stringify(NUM_STATE)) },
      signer_name: signer.name, signer_email: signer.email,
      draft_review: $('eDraft').checked, fields: pkF.get(), attachments: pkA.get(),
      company_snapshot: co
    };
  };
  const drawPrev = () => {
    const d = current();
    $('prev').innerHTML = renderDoc({ ...d, status: 'draft', contract_no: c ? c.contract_no : '' });
  };
  const update = () => { drawVars(); drawPrev(); };
  let lastVarKeys = '';
  const bodyChanged = () => {
    const k = customVars($('eBody').value).join('|');
    if (k !== lastVarKeys) { lastVarKeys = k; drawVars(); }
    drawPrev();
  };
  $('eBody').oninput = bodyChanged;
  // 条項ごとの確認・修正
  let bodyMode = 'clause', fullDirty = false;
  let ce = makeClauseEditor($('ceBox'), $('eBody').value, t => { $('eBody').value = t; bodyChanged(); });
  const setMode = m => {
    if (m === 'clause' && bodyMode === 'full' && fullDirty) ce.setBody($('eBody').value, true);
    bodyMode = m; fullDirty = false;
    V.querySelectorAll('[data-bm]').forEach(b => b.classList.toggle('on', b.dataset.bm === m));
    $('ceBox').classList.toggle('hidden', m !== 'clause'); $('fullBox').classList.toggle('hidden', m !== 'full');
  };
  $('eBody').addEventListener('input', () => { fullDirty = true; });
  V.querySelectorAll('[data-bm]').forEach(b => b.onclick = () => setMode(b.dataset.bm));
  setMode(c || hand ? 'clause' : 'full');
  const loadBody = (title, body, opt) => {   // かんたん作成・引き継ぎで本文を入れ替える
    if (title) $('eTitle').value = title;
    $('eBody').value = body;
    ce = makeClauseEditor($('ceBox'), body, t => { $('eBody').value = t; bodyChanged(); });
    let miss = 0;
    (opt && opt.apply || []).forEach(x => { if (!ce.apply(x.original, x.revised)) miss++; });
    (opt && opt.adds || []).forEach(x => ce.addArticle(x.title, x.text));
    if (miss) toast(`修正案のうち${miss}件は該当箇所が見つからず、取り込めませんでした`, 'err');
    lastVarKeys = ''; bodyChanged(); setMode('clause');
  };
  if (hand) {
    if (hand.signer_name) $('eName').value = hand.signer_name;
    loadBody(hand.title, hand.body, { apply: hand.apply, adds: hand.adds });
    const n = (hand.apply || []).length + (hand.adds || []).length;
    if (n) toast(`修正案・追加条項${n}件を取り込みました（赤線＝削除、青字＝追記）`, 'ok');
  }
  if ($('wizOpen')) $('wizOpen').onclick = () => openWizard({
    company: () => COMPANIES.find(x => x.id === $('eCo').value) || {},
    done: r => {
      $('wizard').classList.add('hidden'); $('editMain').classList.remove('hidden');
      if (r) {
        if (r.partyName) $('eName').value = r.partyName;
        if (r.vars) Object.assign(vars, r.vars);
        if (r.fields) { pkF = makePicker($('pkF'), 'field', r.fields.map(k => ({ ...PRESET_FIELDS.find(p => p.key === k), required: k !== 'tel' }))); drawChips(); }
        if (r.attachments) pkA = makePicker($('pkA'), 'att', r.attachments.map(k => ({ ...PRESET_ATTS.find(p => p.key === k), required: true })));
        loadBody(r.title, r.body); toast('本文を作成しました。条項ごとに確認・修正できます', 'ok');
      }
      window.scrollTo(0, 0);
    }
  });
  ['eTitle', 'eName', 'eEmail'].forEach(i => $(i).oninput = drawPrev);
  $('eDraft').onchange = drawPrev;
  $('eCo').onchange = () => { fillTpl(); drawPrev(); };
  $('pkF').addEventListener('pick', () => { drawChips(); drawPrev(); });
  $('pkA').addEventListener('pick', drawPrev);
  tplSel.onchange = () => {
    const t = TEMPLATES.find(x => x.id === tplSel.value);
    if (!t) return;
    if ($('eBody').value.trim() && !confirm('本文・項目を雛形の内容に置き換えます。よろしいですか？')) { tplSel.value = ''; return; }
    $('eTitle').value = t.title.replace(/（サンプル）$/, '');
    Object.keys(vars).forEach(k => delete vars[k]); Object.keys(NUM_STATE).forEach(k => delete NUM_STATE[k]);
    $('eBody').value = t.body;
    ce = makeClauseEditor($('ceBox'), t.body, x => { $('eBody').value = x; bodyChanged(); });
    $('eDraft').checked = !!t.draft_review;
    pkF = makePicker($('pkF'), 'field', t.fields);
    pkA = makePicker($('pkA'), 'att', t.attachments);
    drawChips(); lastVarKeys = customVars(t.body).join('|'); update();
  };
  drawChips(); lastVarKeys = customVars($('eBody').value).join('|'); update();

  $('saveBtn').onclick = async () => {
    const d = current();
    if (!d.company_id) return toast('発行会社を登録してください', 'err');
    if (!d.title) return toast('契約書名を入力してください', 'err');
    if (!d.signer_name) return toast('署名者の氏名を入力してください', 'err');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.signer_email)) return toast('署名者のメールアドレスを確認してください', 'err');
    if (!d.body.trim()) return toast('本文を入力してください', 'err');
    if (d.body.includes('【削除した条】')) return toast('削除した条を参照している文章があります。「【削除した条】」の箇所を修正してください', 'err');
    if (/第99条（見出し）|本文を入力してください。/.test(d.body)) return toast('追加した条の見出し・本文を入力してください', 'err');
    const left = customVars(d.body);
    if (left.length && !confirm(`未入力の差し込み項目があります：${left.join('、')}\nこのまま保存しますか？`)) return;
    delete d.company_snapshot;
    try {
      const saved = await run(async () => c
        ? must(await sb.from('contracts').update(d).eq('id', c.id).select('id').single())
        : must(await sb.from('contracts').insert({ ...d, template_id: tplSel.value || null }).select('id').single()));
      toast('保存しました', 'ok');
      location.hash = '#c/' + saved.id;
    } catch (e) { }
  };
}

// ================= かんたん作成 =================
function openWizard(ctx) {
  const W = document.getElementById('wizard');
  document.getElementById('editMain').classList.add('hidden'); W.classList.remove('hidden');
  const st = { type: null, ourRole: 0, stance: 'favor', values: {}, on: {}, partyName: '', ourName: ctx.company().name || '' };
  const step1 = () => {
    W.innerHTML = `<div class="card"><h3 style="font-size:17px">① 契約書の種類を選ぶ</h3>
      ${LIB_GROUPS.map(([g, gl]) => `<h4 class="lib-group">${gl}</h4>
      <div class="lib-grid">${CONTRACT_LIBRARY.filter(t => (t.group || '一般') === g).map(t => `<button class="lib-card" data-t="${t.id}"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></button>`).join('')}</div>`).join('')}
      <div class="row" style="margin-top:14px"><button class="btn" id="wzCancel">やめる</button></div>
      <div class="muted" style="margin-top:10px">一般的な条項例をもとに作成します。重要な契約は、作成後に専門家の確認を受けてください。</div></div>`;
    W.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      st.type = b.dataset.t; st.values = {}; st.on = {};
      const tt = CONTRACT_LIBRARY.find(t => t.id === st.type); if (tt.fixedRole !== undefined) st.ourRole = tt.fixedRole;
      CONTRACT_LIBRARY.find(t => t.id === st.type).inputs.forEach(i => { if (i.def) st.values[i.key] = i.def; });
      step2();
    });
    document.getElementById('wzCancel').onclick = () => ctx.done(null);
  };
  const step2 = () => {
    const t = CONTRACT_LIBRARY.find(x => x.id === st.type);
    const roleName = i => t.mutual ? (i === 0 ? '甲' : '乙') : `${i === 0 ? '甲' : '乙'}（${t.roles[i]}）`;
    const cls = clausesFor(t, st.ourRole, st.stance);
    const isOn = c => c.req || (st.on[c.id] !== undefined ? st.on[c.id] : c.on !== false);
    const preview = buildLibraryContract({ ...st, ourName: st.ourName, partyName: st.partyName });
    W.innerHTML = `<div class="detail"><div>
      <div class="card"><h3 style="font-size:17px">② ${esc(t.name)}の内容を決める</h3>
        <label>当社の立場</label>
        <div class="seg3" style="grid-template-columns:1fr 1fr">${[0, 1].map(i => `<button data-role="${i}" data-ty="edit" class="${st.ourRole === i ? 'on' : ''}">当社は ${esc(roleName(i))}</button>`).join('')}</div>
        <label>作り方</label>
        <div class="seg3" style="grid-template-columns:1fr 1fr">
          <button data-st="favor" data-ty="edit" class="${st.stance === 'favor' ? 'on' : ''}">当社に有利な内容で作る</button>
          <button data-st="neutral" data-ty="edit" class="${st.stance === 'neutral' ? 'on' : ''}">中立的な内容で作る</button></div>
        ${t.mutual && st.stance === 'favor' ? '<div class="muted" style="margin-top:6px">この契約は双方が同じ義務を負う形のため、有利・不利で変わる条項はありません。</div>' : ''}
        <div class="grid2">
          <div><label>当社名</label><input id="wzOur" value="${esc(st.ourName)}"></div>
          <div><label>相手方の社名・氏名</label><input id="wzParty" value="${esc(st.partyName)}" placeholder="例：株式会社○○"></div>
          ${t.inputs.map(i => `<div><label>${esc(i.key)}</label><input data-in="${esc(i.key)}" value="${esc(st.values[i.key] || '')}" placeholder="${esc(i.ph || '')}"></div>`).join('')}
        </div>
        <div class="muted" style="margin-top:6px">空欄の項目は、作成後に入力欄が出ます。</div>
      </div>
      <div class="card" style="margin-top:16px"><h3 style="font-size:17px">③ 入れる条項を選ぶ</h3>
        <div class="clause-list">${cls.map(c => `<div class="cl-item ${c.changed || c.favOnly !== undefined ? 'fav' : ''}">
          <label class="cl-row"><input type="checkbox" data-cl="${c.id}" ${isOn(c) ? 'checked' : ''} ${c.req ? 'disabled' : ''}>
            <b>${esc(c.title)}</b>${c.req ? '<span class="opt">必須</span>' : ''}${c.favNote ? `<span class="badge b-signed">当社に有利</span>` : ''}</label>
          ${c.favNote ? `<div class="cl-note">${esc(c.favNote)}</div>` : ''}
          ${c.advice ? `<div class="adv"><div><span class="adv-m">メリット</span>${esc(c.advice.merit)}</div><div><span class="adv-d">注意点</span>${esc(c.advice.demerit)}</div><div><span class="adv-s">対応策</span>${esc(c.advice.measure)}</div></div>` : ''}
          ${!c.advice && c.tip && isOn(c) ? `<div class="adv"><div><span class="adv-d">注意点</span>${esc(c.tip.demerit)}</div><div><span class="adv-s">対応策</span>${esc(c.tip.measure)}</div></div>` : ''}
          ${!c.req && !isOn(c) && TIPS[c.id] ? `<div class="adv"><div><span class="adv-d">外した場合</span>${esc(TIPS[c.id].demerit)}</div></div>` : ''}
        </div>`).join('')}</div>
      </div></div>
      <div class="side">
        <div class="card"><b>まとめ</b>
          <div style="margin-top:6px;font-size:14px;line-height:1.8"><span id="wzSum">甲：${esc((st.ourRole === 0 ? st.ourName : st.partyName) || '（未入力）')}<br>乙：${esc((st.ourRole === 1 ? st.ourName : st.partyName) || '（未入力）')}</span><br>
          条項：${(preview.body.match(/^第\d+条/mg) || []).length}条／当社に有利な条項：${preview.favored.length}か所</div>
          ${preview.favored.length ? `<div class="muted" style="margin-top:8px">相手が有利な条項の削除を求めてくることがあります。各条項の「対応策」を交渉の材料にしてください。</div>` : ''}
        </div>
        <div class="card actions">
          <button class="btn primary" id="wzMake">この内容で本文を作る</button>
          <button class="btn" id="wzBack">← 種類を選び直す</button>
          <button class="btn ghost" id="wzCancel">やめる</button>
        </div>
      </div></div>`;
    W.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { st.ourRole = +b.dataset.role; st.on = {}; step2(); });
    W.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { st.stance = b.dataset.st; st.on = {}; step2(); });
    W.querySelectorAll('[data-in]').forEach(i => i.oninput = () => { st.values[i.dataset.in] = i.value; });
    enhanceNumbers(W, 'data-in');
    const sum = () => { document.getElementById('wzSum').innerHTML = `甲：${esc((st.ourRole === 0 ? st.ourName : st.partyName) || '（未入力）')}<br>乙：${esc((st.ourRole === 1 ? st.ourName : st.partyName) || '（未入力）')}`; };
    document.getElementById('wzOur').oninput = e => { st.ourName = e.target.value; sum(); };
    document.getElementById('wzParty').oninput = e => { st.partyName = e.target.value; sum(); };
    W.querySelectorAll('[data-cl]').forEach(cb => cb.onchange = () => { st.on[cb.dataset.cl] = cb.checked; step2(); });
    document.getElementById('wzBack').onclick = step1;
    document.getElementById('wzCancel').onclick = () => ctx.done(null);
    document.getElementById('wzMake').onclick = () => {
      if (!st.partyName.trim()) return toast('相手方の社名・氏名を入力してください', 'err');
      const r = buildLibraryContract({ ...st, values: {} });   // 金額・期間などは差し込み項目として残し、後から変更できるようにする
      const vals = {}; Object.entries(st.values).forEach(([k, v]) => { if (String(v || '').trim()) vals[k] = String(v).trim(); });
      ctx.done({ title: r.title, body: r.body, vars: vals, partyName: st.partyName.trim(), fields: t.fields, attachments: t.attachments });
    };
  };
  step1();
}

// ================= 契約詳細 =================
async function viewDetail(id) {
  let c, logs, files;
  try {
    [c, logs, files] = await Promise.all([
      sb.from('contracts').select('*').eq('id', id).single().then(must),
      sb.from('audit_logs').select('*').eq('contract_id', id).order('id').then(must),
      sb.from('contract_files').select('id,req_key,name,mime,size,sha256,created_at').eq('contract_id', id).order('created_at').then(must)
    ]);
  } catch (e) { V.innerHTML = '<div class="empty card">契約が見つかりません</div>'; return; }
  c.files = files;
  const st = effectiveStatus(c);
  const url = c.token ? (SETTINGS.site_url || '').replace(/\/$/, '') + '/sign.html?t=' + c.token : '';
  const draftLabel = !c.draft_review ? '省略'
    : c.status === 'draft' ? '未依頼'
    : !c.draft_result && c.status === 'review' ? '回答待ち'
    : c.draft_result === 'approved' ? '承認済み' : c.draft_result === 'changes' ? '修正依頼あり' : '―';
  const daysSel = `<select id="days" style="width:auto;padding:6px 8px">${[3, 7, 14, 30].map(d => `<option value="${d}" ${d === 14 ? 'selected' : ''}>期限 ${d}日</option>`).join('')}</select>`;

  let acts = '';
  if (c.status === 'draft' || c.status === 'review') {
    acts += `<button class="btn" id="aEdit">✎ 内容を編集</button>`;
    if (c.draft_review) acts += `<button class="btn" id="aReview">${c.status === 'review' ? 'ドラフト確認を再依頼' : 'ドラフト確認を依頼'}</button>`;
    acts += `<button class="btn primary" id="aSend">本契約書を送信（押印依頼）</button>`;
    acts += `<div class="row" style="justify-content:center">${daysSel}</div>`;
  }
  if (c.status === 'sent' || c.status === 'viewed') {
    acts += `<button class="btn primary" id="aResend">押印依頼を再送（新しいURL）</button><div class="row" style="justify-content:center">${daysSel}</div>`;
    acts += `<button class="btn" id="aCopy">署名用URLをコピー</button>`;
  }
  if (c.status === 'signed') {
    acts += `<button class="btn primary" id="aPdf">押印済み契約書をダウンロード</button>`;
    acts += `<button class="btn" id="aVerify">改ざん検証</button>`;
  }
  if (c.status === 'draft') acts += `<button class="btn danger" id="aDel">削除</button>`;
  else if (!['signed', 'cancelled'].includes(c.status)) acts += `<button class="btn danger" id="aCancel">取消</button>`;

  const fv = c.status === 'signed' ? (c.field_values || {}) : prefillValues(c);
  const entered = (c.fields || []).length ? `<table class="doc-fields" style="margin-top:6px">${c.fields.map(f => `<tr><th>${esc(f.label)}</th><td>${esc(fv[f.key] || '').replace(/\n/g, '<br>') || '<span class="muted">―</span>'}${f.value ? `<div class="muted">発行側記入${f.editable ? '（修正可）' : ''}</div>` : ''}</td></tr>`).join('')}</table>` : '<div class="muted">記入項目なし</div>';
  const fileList = (c.attachments || []).length ? (c.attachments || []).map(a => {
    const fs = files.filter(f => f.req_key === a.key);
    return `<div style="margin-top:8px"><b style="font-size:13px">${esc(a.label)}</b>${a.required ? '<span class="req">必須</span>' : ''}
      ${fs.length ? fs.map(f => `<div class="row" style="font-size:13px;gap:6px;margin-top:4px"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}（${fsize(f.size)}）</span>
        <button class="btn" style="padding:4px 10px" data-open="${f.id}">表示</button><button class="btn" style="padding:4px 10px" data-save="${f.id}">保存</button></div>`).join('') : '<div class="muted">未添付</div>'}</div>`;
  }).join('') : '<div class="muted">添付項目なし</div>';

  V.innerHTML = `<div class="pagehead"><div><div class="muted mono">${esc(c.contract_no)}</div><h2>${esc(c.title)} ${badge(c)}</h2></div>
      <button class="btn" onclick="location.hash='#list'">← 一覧へ</button></div>
    <div class="detail">
      <div>${changesPanel(c)}${renderDoc(c, logs)}</div>
      <div class="side">
        <div class="card actions">${acts || '<div class="muted" style="text-align:center">操作できる項目はありません</div>'}</div>
        ${c.draft_review && c.draft_result ? `<div class="card" style="border-color:${c.draft_result === 'approved' ? '#a9dcbf' : '#f4d3ae'}">
          <b>ドラフトへの回答：${c.draft_result === 'approved' ? '承認' : '修正依頼'}</b>
          <div class="muted">${fmt(c.draft_responded_at)}</div>
          ${(c.draft_changes || []).length ? `<div style="margin-top:6px;font-size:14px">修正箇所：${c.draft_changes.length}件（左側に表示）</div>` : ''}
          ${c.draft_comment ? `<div style="white-space:pre-wrap;margin-top:6px;font-size:14px"><b>その他のご意見</b><br>${esc(c.draft_comment)}</div>` : ''}</div>` : ''}
        <div class="card"><dl class="kv" style="margin:0">
          <dt>発行会社</dt><dd>${esc((c.company_snapshot || {}).name)}</dd>
          <dt>署名者</dt><dd>${esc(c.signer_name)}<br><span class="muted">${esc(c.signer_email)}</span></dd>
          <dt>ドラフト確認</dt><dd>${draftLabel}</dd>
          <dt>作成</dt><dd>${fmt(c.created_at)}<br><span class="muted">${esc(c.created_by || '')}</span></dd>
          ${c.sent_at ? `<dt>最終送信</dt><dd>${fmt(c.sent_at)}</dd>` : ''}
          ${c.token_expires_at && c.status !== 'signed' ? `<dt>期限</dt><dd>${fmt(c.token_expires_at)}${st === 'expired' ? ' <span class="badge b-expired">期限切れ</span>' : ''}</dd>` : ''}
          ${c.signed_at ? `<dt>締結</dt><dd>${fmt(c.signed_at, true)}</dd><dt>押印</dt><dd>${esc(SEAL_TYPES[c.seal_type] || '')}</dd>` : ''}
        </dl></div>
        ${c.intake_data ? `<div class="card"><b>サイトからの申込み内容</b>${c.intake_ref ? `<div class="muted">申込番号：${esc(c.intake_ref)}</div>` : ''}
          <table class="doc-fields" style="margin-top:6px">${Object.entries(c.intake_data).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</td></tr>`).join('')}</table></div>` : ''}
        <div class="card"><b>記入事項</b>${entered}</div>
        <div class="card"><b>添付書類</b>${fileList}</div>
        <div class="card"><b>社内メモ</b><textarea id="memo" style="min-height:80px;margin-top:6px">${esc(c.memo || '')}</textarea>
          <button class="btn" id="memoBtn" style="margin-top:8px">メモを保存</button></div>
        <div class="card"><b>操作履歴</b><ul class="log" style="margin-top:6px">${logs.map(l => `<li>${esc(EVENTS[l.event] || l.event)}
          <div class="t">${fmt(l.created_at, true)}・${esc(l.actor || '')}${l.ip ? '・' + esc(l.ip) : ''}</div></li>`).join('')}</ul></div>
      </div>
    </div>`;

  const $ = s => document.getElementById(s);
  const days = () => +(($('days') || {}).value || 14);
  const send = async mode => {
    try {
      const r = await run(async () => must(await sb.rpc('admin_send', { p_id: c.id, p_days: days(), p_mode: mode })));
      toast((mode === 'review' ? 'ドラフト確認依頼' : '押印依頼') + 'を送信しました（期限 ' + fmt(r.expires) + '）', 'ok');
      viewDetail(c.id);
    } catch (e) { }
  };
  if ($('aEdit')) $('aEdit').onclick = () => location.hash = '#edit/' + c.id;
  const applyChanges = async idxs => {
    let body = c.body, n = 0;
    idxs.forEach(i => { const x = c.draft_changes[i]; if (changeState(c, x) === 'todo') { body = body.replace(x.original, () => x.revised); n++; } });
    if (!n) return toast('反映できる修正はありません', 'err');
    if (!confirm(`${n}件の修正を本文に反映します。よろしいですか？`)) return;
    try { await run(async () => must(await sb.from('contracts').update({ body }).eq('id', c.id))); toast(`${n}件を本文に反映しました`, 'ok'); viewDetail(c.id); } catch (e) { }
  };
  V.querySelectorAll('[data-apply]').forEach(b => b.onclick = () => applyChanges([+b.dataset.apply]));
  if ($('applyAll')) $('applyAll').onclick = () => applyChanges(c.draft_changes.map((_, i) => i));
  if ($('aReview')) $('aReview').onclick = () => confirm(`${c.signer_email} 宛にドラフト確認を依頼します。よろしいですか？`) && send('review');
  if ($('aSend')) $('aSend').onclick = () => {
    let msg = `${c.signer_email} 宛に本契約書（押印依頼）を送信します。送信後は内容を変更できません。`;
    if (c.draft_review && c.draft_result === 'changes') msg = 'ドラフトに修正依頼がありました（反映済みであればそのまま進めてください）。\n' + msg;
    else if (c.draft_review && c.draft_result !== 'approved') msg = `ドラフトが未承認です（${draftLabel}）。ドラフト確認を省略して進めます。\n` + msg;
    if (confirm(msg + '\nよろしいですか？')) send('final');
  };
  if ($('aResend')) $('aResend').onclick = () => confirm('新しいURLで再送します（以前のURLは無効になります）。よろしいですか？') && send('final');
  if ($('aCopy')) $('aCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(url); toast('URLをコピーしました', 'ok'); } catch (e) { prompt('URL', url); }
  };
  if ($('aPdf')) $('aPdf').onclick = () => run(() => savePdf(c, logs)).catch(() => { });
  if ($('aVerify')) $('aVerify').onclick = async () => {
    try {
      const r = await run(async () => must(await sb.rpc('admin_verify', { p_id: c.id })));
      alert(r.match ? '✓ 改ざんはありません\n\n記録されたハッシュと現在の内容から算出したハッシュが一致しました。\n' + r.stored
        : '✕ 改ざんの可能性があります\n\n記録：' + r.stored + '\n現在：' + r.computed + (r.files_ng ? `\n内容が変わった添付ファイル：${r.files_ng}件` : ''));
      viewDetail(c.id);
    } catch (e) { }
  };
  if ($('aDel')) $('aDel').onclick = async () => {
    if (!confirm('この下書きを削除します。よろしいですか？')) return;
    try { await run(async () => must(await sb.from('contracts').delete().eq('id', c.id))); toast('削除しました', 'ok'); location.hash = '#list'; } catch (e) { }
  };
  if ($('aCancel')) $('aCancel').onclick = async () => {
    const reason = prompt('取消の理由（任意）', '');
    if (reason === null) return;
    try { await run(async () => must(await sb.rpc('admin_cancel', { p_id: c.id, p_reason: reason }))); toast('取り消しました', 'ok'); viewDetail(c.id); } catch (e) { }
  };
  $('memoBtn').onclick = async () => {
    try { await run(async () => must(await sb.from('contracts').update({ memo: $('memo').value }).eq('id', c.id))); toast('メモを保存しました', 'ok'); } catch (e) { }
  };
  const getFile = async fid => {
    const r = await run(async () => must(await sb.rpc('admin_file', { p_file: fid })));
    const bin = Uint8Array.from(atob(r.b64.replace(/\s/g, '')), ch => ch.charCodeAt(0));
    return { name: r.name, url: URL.createObjectURL(new Blob([bin], { type: r.mime })) };
  };
  V.querySelectorAll('[data-open]').forEach(b => b.onclick = async () => {
    const w = window.open('', '_blank');
    try { const f = await getFile(b.dataset.open); if (w) w.location = f.url; else location.href = f.url; } catch (e) { if (w) w.close(); }
  });
  V.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => {
    try { const f = await getFile(b.dataset.save); const a = document.createElement('a'); a.href = f.url; a.download = f.name; a.click(); } catch (e) { }
  });
}

// 修正依頼の一覧（削除＝赤の取り消し線、追記＝青字）
function changeState(c, x) {
  if (x.original && c.body.includes(x.original)) return 'todo';
  if (!x.revised || c.body.includes(x.revised)) return 'done';
  return 'gone';
}
function changesPanel(c) {
  const list = c.draft_changes || [];
  if (!list.length) return '';
  const canApply = c.status === 'review';
  const todo = list.filter(x => changeState(c, x) === 'todo').length;
  return `<div class="card" style="margin-bottom:16px;border-color:#f4d3ae">
    <div class="chg-head"><b>署名者からの修正依頼（${list.length}箇所）</b>
      ${canApply && todo ? `<button class="btn primary" id="applyAll" style="padding:6px 12px">すべて本文に反映</button>` : ''}</div>
    <div class="legend"><span><del class="d-del">削除</del>＝赤の取り消し線</span><span><ins class="d-ins">追記</ins>＝青字</span></div>
    ${list.map((x, i) => {
      const st = changeState(c, x);
      return `<div class="chg">
        <div class="chg-head"><b>${esc(x.label)}　<span class="badge b-draft">${esc(CHANGE_TYPES[x.type] || '')}</span></b>
          ${canApply ? (st === 'todo' ? `<button class="btn" data-apply="${i}" style="padding:5px 10px;font-size:13px">本文に反映</button>`
            : st === 'done' ? '<span class="badge b-signed">反映済み</span>' : '<span class="badge b-viewed">本文が変更済み</span>') : ''}</div>
        <div class="diffbox" style="margin-top:8px">${renderOps(x.ops)}</div>
        ${x.comment ? `<div class="muted" style="margin-top:6px">理由：${esc(x.comment)}</div>` : ''}
      </div>`;
    }).join('')}
    ${canApply ? '<div class="muted" style="margin-top:10px">反映後は「ドラフト確認を再依頼」で再確認、または「本契約書を送信」へ進めます。</div>' : ''}
  </div>`;
}

// ================= 雛形 =================
async function viewTemplates(id) {
  await loadMasters();
  if (id) return editTemplate(id === 'new' ? null : TEMPLATES.find(t => t.id === id));
  V.innerHTML = `<div class="pagehead"><h2>契約書の雛形</h2><button class="btn primary" onclick="location.hash='#tpl/new'">＋ 雛形を追加</button></div>
    ${TEMPLATES.length ? `<table class="list"><thead><tr><th>雛形名</th><th>対象</th><th>ドラフト確認</th><th>記入項目</th><th>添付</th><th>更新</th></tr></thead><tbody>
    ${TEMPLATES.map(t => `<tr class="click" data-id="${t.id}"><td><b>${esc(t.title)}</b></td><td>${t.company_id ? esc(coName(t.company_id)) : '全社共通'}</td>
      <td>${t.draft_review ? 'あり' : '省略'}</td><td>${(t.fields || []).length}項目</td><td>${(t.attachments || []).length}項目</td><td class="muted">${fmt(t.updated_at)}</td></tr>`).join('')}
    </tbody></table>` : '<div class="empty card">雛形はまだありません。下の「よく使う契約書」から登録できます。</div>'}
    <div class="card" style="margin-top:18px">
      <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 style="font-size:17px;margin:0">よく使う契約書（${CONTRACT_LIBRARY.length}種類）</h3>
        <button class="btn primary" id="libAll">未登録の分をまとめて雛形に登録</button>
      </div>
      <div class="muted" style="margin:6px 0 10px">中立的な内容で登録します。当社名は {{会社名}}、相手方は {{署名者氏名}} が自動で入ります。登録後は自由に書き換えられます。<br>
        当社に有利な内容で作りたい時は、「新規作成」→「かんたん作成」を使ってください。</div>
      ${LIB_GROUPS.map(([g, gl]) => `<h4 class="lib-group">${gl}</h4>
        <div class="lib-grid">${CONTRACT_LIBRARY.filter(t => (t.group || '一般') === g).map(t => {
          const done = TEMPLATES.some(x => x.title === t.name);
          return `<button class="lib-card" data-lib="${t.id}" ${done ? 'disabled' : ''}><b>${esc(t.name)}</b><span>${done ? '登録済み' : esc(t.desc)}</span></button>`;
        }).join('')}</div>`).join('')}
    </div>`;
  V.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => location.hash = '#tpl/' + tr.dataset.id);
  const libTpl = t => {
    const role = t.fixedRole !== undefined ? t.fixedRole : 0, values = {};   // 初期値は契約作成時に入力欄へ入る
    const r = buildLibraryContract({ type: t.id, ourRole: role, stance: 'neutral', ourName: '{{会社名}}', partyName: '{{署名者氏名}}', values, on: {} });
    return { title: t.name, company_id: null, body: r.body, draft_review: false,
      fields: (t.fields || []).map(k => ({ ...PRESET_FIELDS.find(p => p.key === k), required: k !== 'tel' })),
      attachments: (t.attachments || []).map(k => ({ ...PRESET_ATTS.find(p => p.key === k), required: k !== 'photo' })) };
  };
  const reload = async () => { TEMPLATES = must(await sb.from('templates').select('*').order('created_at')); viewTemplates(); };
  V.querySelectorAll('[data-lib]').forEach(b => b.onclick = async () => {
    const t = CONTRACT_LIBRARY.find(x => x.id === b.dataset.lib);
    try { await run(async () => must(await sb.from('templates').insert(libTpl(t)))); toast(t.name + 'を登録しました', 'ok'); await reload(); } catch (e) { }
  });
  document.getElementById('libAll').onclick = async () => {
    const rows = CONTRACT_LIBRARY.filter(t => !TEMPLATES.some(x => x.title === t.name)).map(libTpl);
    if (!rows.length) return toast('すべて登録済みです', 'ok');
    try { await run(async () => must(await sb.from('templates').insert(rows))); toast(rows.length + '種類を登録しました', 'ok'); await reload(); } catch (e) { }
  };
}
function editTemplate(t) {
  V.innerHTML = `<div class="pagehead"><h2>${t ? '雛形の編集' : '雛形の追加'}</h2><button class="btn" onclick="location.hash='#tpl'">← 雛形一覧</button></div>
    <div class="detail"><div class="card">
      <div class="grid2">
        <div><label style="margin-top:0">雛形名</label><input id="tTitle" value="${esc(t ? t.title : '')}"></div>
        <div><label style="margin-top:0">使える発行会社</label><select id="tCo"><option value="">全社共通</option>${COMPANIES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
      </div>
      <label>本文</label>
      <div class="muted" style="margin-bottom:6px">自動差し込み：${BUILTIN.map(k => `{{${k}}}`).join(' ')}　／ 作成時に入力：{{任意の名前}}　／ 署名者が記入：[[記入項目名]]</div>
      <textarea id="tBody" style="min-height:520px;font-family:'Noto Serif JP',serif">${esc(t ? t.body : '')}</textarea>
    </div>
    <div class="side">
      <div class="card"><label class="switch" style="margin-top:0"><input type="checkbox" id="tDraft" ${t && t.draft_review ? 'checked' : ''}>
        <span><b>ドラフト確認を行う（初期値）</b></span></label></div>
      <div class="card"><h3 style="font-size:15px">署名者の記入項目（初期値）</h3><div id="pkF" style="margin-top:8px"></div></div>
      <div class="card"><h3 style="font-size:15px">添付書類（初期値）</h3><div id="pkA" style="margin-top:8px"></div></div>
      <div class="card actions">
        <button class="btn primary" id="tSave">保存</button>
        ${t ? '<button class="btn" id="tCopy">複製</button><button class="btn danger" id="tDel">削除</button>' : ''}
      </div>
    </div></div>`;
  const $ = s => document.getElementById(s);
  if (t) $('tCo').value = t.company_id || '';
  const pkF = makePicker($('pkF'), 'field', t ? t.fields : []);
  const pkA = makePicker($('pkA'), 'att', t ? t.attachments : []);
  const data = () => ({ title: $('tTitle').value.trim(), company_id: $('tCo').value || null, body: $('tBody').value,
    draft_review: $('tDraft').checked, fields: pkF.get(), attachments: pkA.get(), updated_at: new Date().toISOString() });
  $('tSave').onclick = async () => {
    const d = data();
    if (!d.title || !d.body.trim()) return toast('雛形名と本文を入力してください', 'err');
    try {
      await run(async () => t ? must(await sb.from('templates').update(d).eq('id', t.id)) : must(await sb.from('templates').insert(d)));
      toast('保存しました', 'ok'); location.hash = '#tpl';
    } catch (e) { }
  };
  if ($('tCopy')) $('tCopy').onclick = async () => {
    const d = data(); d.title += '（複製）';
    try { await run(async () => must(await sb.from('templates').insert(d))); toast('複製しました', 'ok'); location.hash = '#tpl'; } catch (e) { }
  };
  if ($('tDel')) $('tDel').onclick = async () => {
    if (!confirm('この雛形を削除しますか？（作成済みの契約には影響しません）')) return;
    try { await run(async () => must(await sb.from('templates').delete().eq('id', t.id))); toast('削除しました', 'ok'); location.hash = '#tpl'; } catch (e) { }
  };
}

// ================= リーガルチェック =================
let LEGAL = null;   // 直近の結果（画面を移動しても残す）
const loadScript = src => new Promise((ok, ng) => {
  if (document.querySelector(`script[src="${src}"]`)) return ok();
  const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ng(new Error('部品を読み込めませんでした')); document.head.appendChild(s);
});
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
async function pdfToText(file) {
  await loadScript(PDFJS + 'pdf.min.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const items = (await (await pdf.getPage(i)).getTextContent()).items;
    let lines = [], cur = '', lastY = null;
    items.forEach(it => {
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(cur); cur = ''; }
      cur += it.str; lastY = y;
    });
    lines.push(cur); pages.push(lines.join('\n'));
  }
  // 行の途中での改行をつなぎ、条・項・号の始まりと文末では改行を残す
  return pages.join('\n').split('\n').map(l => l.trim()).filter(Boolean).reduce((out, l) => {
    const head = /^(第[0-9０-９一二三四五六七八九十百]+条|[0-9０-９]+[\s　]|[(（][0-9０-９一二三四五六七八九十]+[)）]|以上|甲|乙|記$)/.test(l);
    if (!out.length || head || /[。）」:：]$/.test(out[out.length - 1])) {
      if (head && /^第[0-9０-９一二三四五六七八九十百]+条/.test(l) && out.length) out.push('');
      out.push(l);
    } else out[out.length - 1] += l;
    return out;
  }, []).join('\n');
}
async function docxToText(file) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
  const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return r.value.replace(/\n{2,}/g, '\n').replace(/\n(第[0-9０-９一二三四五六七八九十百]+条)/g, '\n\n$1');
}
const fileToB64 = f => new Promise((ok, ng) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ng; r.readAsDataURL(f); });
const LV = { 高: 'b-cancelled', 中: 'b-viewed', 低: 'b-draft' };

async function viewLegal() {
  await loadMasters();
  const st = LEGAL ? LEGAL.req : { side: '乙', role: '', our: (COMPANIES[0] || {}).name || '', focus: '' };
  V.innerHTML = `<div class="pagehead"><h2>リーガルチェック</h2></div>
    <div class="detail"><div>
      <div class="card">
        <b>チェックする契約書</b>
        <div class="muted">相手から届いた契約書のファイル（PDF・Word・画像・テキスト）を選ぶか、本文を貼り付けてください。</div>
        <input type="file" id="lgFile" accept=".pdf,.docx,.txt,image/*" style="margin-top:8px">
        <label>または本文を貼り付け</label>
        <textarea id="lgText" style="min-height:160px;font-family:'Noto Serif JP',serif" placeholder="契約書の本文">${esc(LEGAL && LEGAL.pasted || '')}</textarea>
        <label>当社の立場</label>
        <div class="seg3"><button data-side="甲" data-ty="edit">当社は 甲</button><button data-side="乙" data-ty="edit">当社は 乙</button><button data-side="" data-ty="edit">本文から判断</button></div>
        <div class="grid2">
          <div><label>当社の役割（任意）</label><input id="lgRole" value="${esc(st.role)}" placeholder="例：受託者、買主、代理店"></div>
          <div><label>当社名（任意）</label><input id="lgOur" value="${esc(st.our)}" list="lgCos"><datalist id="lgCos">${COMPANIES.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist></div>
        </div>
        <label>特に重視する点（任意）</label>
        <input id="lgFocus" value="${esc(st.focus)}" placeholder="例：支払条件と損害賠償の上限、中途解約">
        <button class="btn primary lg" id="lgRun" style="margin-top:16px">リーガルチェックを実行</button>
        <div class="muted" style="margin-top:8px">AI（Google Gemini）が当社の立場から読み、条項ごとに注意点と修正案を示します。1〜2分かかることがあります。</div>
      </div>
      <div id="lgResult"></div>
    </div>
    <div class="side">
      <div class="card"><b>ご注意</b><ul style="margin:6px 0 0;padding-left:18px;font-size:13px;line-height:1.8">
        <li>結果は AI による参考意見です。重要な契約は必ず弁護士の確認を受けてください。</li>
        <li>無料の Gemini の鍵を使う場合、送った内容が Google のサービス改善に使われることがあります。秘密性の高い契約書は、有料の鍵（課金を有効にした鍵）で使ってください。</li>
        <li>修正案は「条項ごとに確認・修正」の画面に取り込み、赤線・青字で確認してから使えます。</li></ul></div>
    </div></div>`;
  const $ = s => document.getElementById(s);
  let side = st.side;
  const drawSide = () => V.querySelectorAll('[data-side]').forEach(b => b.classList.toggle('on', b.dataset.side === side));
  V.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { side = b.dataset.side; drawSide(); });
  drawSide();
  if (LEGAL && LEGAL.result) drawLegal();
  $('lgRun').onclick = async () => {
    if (!SETTINGS.ai_url || !SETTINGS.ai_secret) return toast('「設定」でリーガルチェックの送信先と合言葉を登録してください', 'err');
    const file = $('lgFile').files[0], pasted = $('lgText').value.trim();
    if (!file && !pasted) return toast('契約書のファイルを選ぶか、本文を貼り付けてください', 'err');
    const req = { side, role: $('lgRole').value.trim(), our: $('lgOur').value.trim(), focus: $('lgFocus').value.trim() };
    let text = pasted, sendFile = null;
    try {
      await run(async () => {
        if (file) {
          const name = file.name.toLowerCase();
          if (name.endsWith('.txt')) text = await file.text();
          else if (name.endsWith('.docx')) text = await docxToText(file);
          else if (name.endsWith('.pdf')) { try { text = await pdfToText(file); } catch (e) { text = ''; } if (text.replace(/\s/g, '').length < 200) text = ''; }
          if (!text) {
            if (file.size > 15 * 1024 * 1024) throw new Error('ファイルが大きすぎます（15MBまで）');
            sendFile = { mime: file.type || 'application/pdf', data: await fileToB64(file) };
          }
        }
        const res = await fetch(SETTINGS.ai_url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'legal_check', secret: SETTINGS.ai_secret, side: req.side, role: req.role, our_name: req.our, focus: req.focus, text: text || undefined, file: sendFile || undefined }) });
        const j = await res.json().catch(() => ({ ok: false, error: '応答を読み取れませんでした（送信先URLを確認してください）' }));
        if (!j.ok) throw new Error(j.error || 'リーガルチェックに失敗しました');
        const r = j.result;
        LEGAL = { req, pasted, text: text || r.full_text || '', result: r, model: j.model, at: new Date().toISOString(), fileName: file ? file.name : '' };
      });
    } catch (e) { return; }
    drawLegal();
    $('lgResult').scrollIntoView({ behavior: 'smooth' });
  };
}

function drawLegal() {
  const box = document.getElementById('lgResult'); if (!box || !LEGAL) return;
  const r = LEGAL.result, f = r.findings || [], m = r.missing || [];
  const found = x => LEGAL.text && x.original && (LEGAL.text.includes(x.original) || new RegExp(Array.from(x.original.replace(/\s+/g, '')).map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')).test(LEGAL.text));
  box.innerHTML = `<div class="card" style="margin-top:16px" id="lgReport">
    <div class="chg-head"><b style="font-size:17px">チェック結果</b><span class="muted">${fmt(LEGAL.at)}${LEGAL.fileName ? '・' + esc(LEGAL.fileName) : ''}</span></div>
    <div class="kv" style="margin-top:10px">
      <dt>契約の種類</dt><dd>${esc(r.contract_type || '')}</dd>
      <dt>当事者</dt><dd>甲：${esc((r.parties || {}).ko || '―')}<br>乙：${esc((r.parties || {}).otsu || '―')}</dd>
      <dt>当社の立場</dt><dd>${esc(LEGAL.req.side || '本文から判断')}${LEGAL.req.role ? '（' + esc(LEGAL.req.role) + '）' : ''}</dd>
      <dt>リスク度</dt><dd><span class="badge ${LV[r.risk] || 'b-draft'}">${esc(r.risk || '')}</span></dd>
    </div>
    <div class="notice" style="margin-top:12px;white-space:pre-wrap">${esc(r.summary || '')}</div>
    ${(r.good_points || []).length ? `<h4 style="margin:16px 0 4px">当社にとって良い点</h4><ul style="margin:0;padding-left:20px;line-height:1.8">${r.good_points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <h4 style="margin:18px 0 4px">指摘と修正案（${f.length}件）</h4>
    <div class="legend"><span><del class="d-del">削除</del>＝赤の取り消し線</span><span><ins class="d-ins">追記</ins>＝青字</span></div>
    ${f.map((x, i) => `<div class="chg">
      <div class="chg-head"><b>${esc(x.location)}　${esc(x.title)}</b><span class="badge ${LV[x.level] || 'b-draft'}">重要度 ${esc(x.level)}</span></div>
      <div style="margin-top:6px;font-size:14px">${esc(x.issue)}</div>
      <div class="adv" style="margin-left:0">${x.merit ? `<div><span class="adv-m">メリット</span>${esc(x.merit)}</div>` : ''}
        <div><span class="adv-d">注意点</span>${esc(x.demerit)}</div><div><span class="adv-s">対応策</span>${esc(x.measure)}</div></div>
      ${x.original ? `<div class="diffbox" style="margin-top:8px">${renderOps(diffText(x.original, x.revised || ''))}</div>
        <label class="cl-row" style="margin-top:6px"><input type="checkbox" data-fi="${i}" ${x.level !== '低' && found(x) ? 'checked' : ''} ${found(x) ? '' : 'disabled'}>
          ${found(x) ? 'この修正案を取り込む' : '<span class="muted">本文中に該当箇所が見つからないため、取り込めません（手で修正してください）</span>'}</label>` : ''}
    </div>`).join('')}
    ${m.length ? `<h4 style="margin:18px 0 4px">追加をおすすめする条項（${m.length}件）</h4>${m.map((x, i) => `<div class="chg">
      <div class="chg-head"><b>${esc(x.title)}</b></div><div class="muted" style="margin-top:4px">${esc(x.reason)}</div>
      <div class="diffbox" style="margin-top:6px"><ins class="d-ins">${esc(x.text).replace(/\n/g, '<br>')}</ins></div>
      <label class="cl-row" style="margin-top:6px"><input type="checkbox" data-mi="${i}" checked> この条項を追加する</label></div>`).join('')}` : ''}
    ${(r.negotiation || []).length ? `<h4 style="margin:18px 0 4px">交渉のポイント</h4><ol style="margin:0;padding-left:22px;line-height:1.8">${r.negotiation.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    <div class="muted" style="margin-top:14px">※ AI（${esc(LEGAL.model || 'Gemini')}）による参考意見です。重要な契約は弁護士の確認を受けてください。</div>
  </div>
  <div class="row" style="margin-top:12px">
    <button class="btn primary" id="lgMake" ${LEGAL.text ? '' : 'disabled'}>選んだ修正案を反映して契約書を作る</button>
    <button class="btn" id="lgPdf">結果をPDFで保存</button>
  </div>`;
  document.getElementById('lgPdf').onclick = () => run(() => html2pdf().set({
    margin: [12, 12, 14, 12], filename: `リーガルチェック_${(r.contract_type || '契約書').replace(/[\\/:*?"<>|]/g, '_')}.pdf`,
    html2canvas: { scale: 2, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['.chg'] }
  }).from(document.getElementById('lgReport')).save()).catch(() => { });
  document.getElementById('lgMake').onclick = () => {
    const apply = [...box.querySelectorAll('[data-fi]:checked')].map(cb => { const x = f[+cb.dataset.fi]; return { original: x.original, revised: x.revised || '' }; });
    const adds = [...box.querySelectorAll('[data-mi]:checked')].map(cb => ({ title: m[+cb.dataset.mi].title, text: m[+cb.dataset.mi].text }));
    const p = r.parties || {}, side = LEGAL.req.side;
    window.__handoff = { title: r.contract_type || '契約書', body: LEGAL.text.replace(/\r\n/g, '\n'), apply, adds,
      signer_name: side === '甲' ? p.otsu : side === '乙' ? p.ko : '' };
    location.hash = '#new';
  };
}

// ================= 自動受付 =================
const MODE_LABEL = { auto: '自動送信', approve: '承認後に送信' };
async function viewIntakes(id) {
  await loadMasters();
  let list = [];
  try { list = must(await sb.from('intakes').select('*').order('created_at')); } catch (e) { return toast(errText(e), 'err'); }
  if (id) return editIntake(id === 'new' ? null : list.find(x => x.id === id));
  V.innerHTML = `<div class="pagehead"><h2>自動受付</h2><button class="btn primary" onclick="location.hash='#auto/new'">＋ 受付窓口を追加</button></div>
    <div class="muted" style="margin-bottom:12px">サイトの申込みを受け取り、雛形から契約書を自動で作成します。「自動送信」はそのままお客様へ送信、「承認後に送信」は担当者に通知し、管理画面で確認してから送信します。</div>
    ${list.length ? `<table class="list"><thead><tr><th>窓口名</th><th>発行会社</th><th>雛形</th><th>動作</th><th>状態</th><th>合言葉</th></tr></thead><tbody>
    ${list.map(x => `<tr class="click" data-id="${x.id}"><td><b>${esc(x.name)}</b></td><td>${esc(coName(x.company_id))}</td>
      <td>${esc((TEMPLATES.find(t => t.id === x.template_id) || {}).title || '（未設定）')}</td>
      <td>${MODE_LABEL[x.mode]}</td><td>${x.enabled ? '<span class="badge b-signed">受付中</span>' : '<span class="badge b-draft">停止中</span>'}</td>
      <td class="mono">${x.key_hint ? '…' + esc(x.key_hint) : '未発行'}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty card">受付窓口はまだありません</div>'}`;
  V.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => location.hash = '#auto/' + tr.dataset.id);
}

function intakeTargets(tpl) {
  const t = [['signer_name', '署名者の氏名（必須）'], ['signer_email', '署名者のメール（必須）']];
  if (tpl) {
    customVars(tpl.body).forEach(v => t.push(['var:' + v, '差し込み：{{' + v + '}}']));
    (tpl.fields || []).forEach(f => t.push(['field:' + f.key, '記入項目：' + f.label]));
  }
  t.push(['memo', '社内メモに記載']);
  return t;
}

function editIntake(x, newKey) {
  const map = (x && x.mapping && x.mapping.length) ? x.mapping.map(m => ({ ...m })) : [{ from: 'name', to: 'signer_name' }, { from: 'email', to: 'signer_email' }];
  V.innerHTML = `<div class="pagehead"><h2>${x ? '受付窓口の設定' : '受付窓口の追加'}</h2><button class="btn" onclick="location.hash='#auto'">← 一覧へ</button></div>
    <div class="detail"><div>
      <div class="card">
        <div class="grid2">
          <div><label style="margin-top:0">窓口名</label><input id="iName" value="${esc(x ? x.name : '')}" placeholder="例：G-LOVE 申込みフォーム"></div>
          <div><label style="margin-top:0">発行会社</label><select id="iCo">${COMPANIES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
          <div><label>使う雛形</label><select id="iTpl"></select></div>
          <div><label>契約書名（空欄なら雛形名）</label><input id="iTitle" value="${esc(x ? x.title : '')}"></div>
        </div>
        <label>動作</label>
        <div class="seg3" style="grid-template-columns:1fr 1fr">
          <button data-mode="approve">承認後に送信（おすすめ）</button>
          <button data-mode="auto">自動送信</button>
        </div>
        <div class="muted" id="modeNote" style="margin-top:6px"></div>
        <div class="grid2">
          <div><label>署名の期限（日）</label><input id="iDays" type="number" min="1" max="60" value="${x ? x.send_days : 14}"></div>
          <div><label>1日の受付上限（件）</label><input id="iDaily" type="number" min="1" max="1000" value="${x ? x.daily_limit : 50}"></div>
          <div><label>同じメールアドレスの1日の上限（件）</label><input id="iPer" type="number" min="1" max="100" value="${x ? x.per_email_limit : 3}"></div>
          <div><label>状態</label><select id="iEnabled"><option value="1">受付中</option><option value="0">停止中</option></select></div>
        </div>
        <label>受け付けるサイト（ブラウザから送る場合。1行に1つ。空欄なら制限なし）</label>
        <textarea id="iOrigins" style="min-height:60px" placeholder="https://glovekaitori.github.io">${esc(x ? x.allowed_origins : '')}</textarea>
      </div>
      <div class="card" style="margin-top:16px">
        <b>項目の対応表</b>
        <div class="muted">サイトから届く項目名（左）を、契約書のどこに入れるか（右）を選びます。記入項目に入れた値は「記入済み」として署名者に表示されます。</div>
        <div id="mapBox" style="margin-top:8px"></div>
        <div id="mapWarn" class="miss-msg" style="margin-top:6px"></div>
        <button class="btn ghost" id="mapAdd" style="margin-top:4px">＋ 項目を追加</button>
      </div>
      ${x ? `<div class="card" style="margin-top:16px">
        <b>試験</b>
        <div class="muted">申込みデータの例を入れて実行すると、契約書を「下書き」で作成します（お客様には送りません）。</div>
        <textarea id="iTest" class="mono" style="min-height:120px;margin-top:8px"></textarea>
        <button class="btn" id="iTestBtn" style="margin-top:8px">試験で作成</button>
        <div id="iTestRes" style="margin-top:8px"></div>
      </div>
      <div class="card" style="margin-top:16px"><b>サイトとのつなぎ方</b><div id="howto" style="margin-top:8px"></div></div>` : ''}
    </div>
    <div class="side">
      <div class="card actions">
        <button class="btn primary" id="iSave">${x ? '保存' : '作成して合言葉を発行'}</button>
        ${x ? `<button class="btn" id="iKey">合言葉を${x.key_hint ? '再発行' : '発行'}</button>
          <div class="muted">現在の合言葉：${x.key_hint ? '末尾 …' + esc(x.key_hint) : '未発行'}。再発行すると前の合言葉は使えなくなります。</div>
          <button class="btn danger" id="iDel">削除</button>` : ''}
      </div>
      <div class="card"><b>悪用を防ぐ仕組み</b><ul style="margin:6px 0 0;padding-left:18px;font-size:13px;line-height:1.8">
        <li>合言葉がない申込みは受け付けない</li><li>1日の上限・同じメールアドレスの上限</li>
        <li>同じ申込番号は二重に作らない</li><li>受け付けるサイトを限定できる</li>
        <li>「承認後に送信」なら担当者が確認するまでお客様に届かない</li></ul></div>
    </div></div>`;
  const $ = s => document.getElementById(s);
  let mode = x ? x.mode : 'approve';
  if (x) { $('iCo').value = x.company_id; $('iEnabled').value = x.enabled ? '1' : '0'; }
  const fillTpl = () => {
    const co = $('iCo').value, cur = $('iTpl').value || (x && x.template_id) || '';
    $('iTpl').innerHTML = TEMPLATES.filter(t => !t.company_id || t.company_id === co)
      .map(t => `<option value="${t.id}">${esc(t.title)}${t.company_id ? '' : '（共通）'}</option>`).join('');
    if (cur && [...$('iTpl').options].some(o => o.value === cur)) $('iTpl').value = cur;
  };
  const drawMode = () => {
    V.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    V.querySelectorAll('[data-mode]').forEach(b => b.dataset.ty = b.dataset.mode === 'auto' ? 'delete' : 'edit');
    const tpl = TEMPLATES.find(t => t.id === $('iTpl').value);
    $('modeNote').textContent = mode === 'auto'
      ? `申込みと同時にお客様へ送信します（雛形の設定により${tpl && tpl.draft_review ? 'ドラフト確認依頼' : '押印依頼'}）。担当者にも通知します。`
      : '契約書を下書きで作成し、担当者に通知します。管理画面で内容を確認してから送信してください。';
  };
  const drawMap = () => {
    const tpl = TEMPLATES.find(t => t.id === $('iTpl').value);
    const targets = intakeTargets(tpl);
    $('mapBox').innerHTML = `<div class="field-pick">${map.map((m, i) => `<div class="it" style="grid-template-columns:1fr 1.3fr auto">
        <input data-i="${i}" data-a="from" value="${esc(m.from || '')}" placeholder="サイトの項目名（例：name）" style="padding:6px 8px">
        <select data-i="${i}" data-a="to" style="width:100%">${targets.map(([v, l]) => `<option value="${esc(v)}" ${m.to === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          ${m.to && !targets.some(t => t[0] === m.to) ? `<option value="${esc(m.to)}" selected>（雛形にない項目：${esc(m.to)}）</option>` : ''}</select>
        <span class="rq">${(m.to || '').startsWith('field:') ? `<input type="checkbox" data-i="${i}" data-a="editable" ${m.editable ? 'checked' : ''}>修正可` : ''}
          <button class="del" data-del="${i}" title="削除">×</button></span>
      </div>`).join('')}</div>`;
    $('mapBox').querySelectorAll('[data-a]').forEach(el => {
      el[el.type === 'checkbox' || el.tagName === 'SELECT' ? 'onchange' : 'oninput'] = () => {
        map[+el.dataset.i][el.dataset.a] = el.type === 'checkbox' ? el.checked : el.value;
        if (el.dataset.a === 'to') drawMap();
        drawHowto();
      };
    });
    $('mapBox').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { map.splice(+b.dataset.del, 1); drawMap(); drawHowto(); });
    const unmapped = tpl ? customVars(tpl.body).filter(v => !map.some(m => m.to === 'var:' + v && (m.from || '').trim())) : [];
    $('mapWarn').textContent = unmapped.length
      ? `対応する項目がない差し込み：${unmapped.map(v => '{{' + v + '}}').join('、')}。サイトから届かない場合は、雛形の本文に直接書き込んでください（未入力のままでは自動送信されず、送信待ちになります）。` : '';
  };
  const sample = () => {
    const o = {};
    map.forEach(m => { if (m.from) o[m.from] = m.to === 'signer_email' ? 'test@example.com' : m.to === 'signer_name' ? '試験 太郎' : '（' + m.from + 'の例）'; });
    return o;
  };
  const drawHowto = (key) => {
    if (!$('howto')) return;
    const k = key || '（発行した合言葉）';
    const data = sample();
    const kv = Object.keys(data).map(f => `'${f}', new.${f}`).join(', ');
    $('howto').innerHTML = `
      <div class="muted">${key ? '<b style="color:var(--ng)">この合言葉はこの画面を離れると二度と表示されません。下の内容ごと控えてください。</b>' : '合言葉は発行時だけ表示されます。'}</div>
      ${key ? `<label>合言葉</label><input class="mono" readonly value="${esc(key)}" onclick="this.select()">` : ''}
      <label>方法A：申込みを保存しているデータベースから送る（おすすめ・合言葉がお客様の画面に出ない）</label>
      <div class="muted">サイトが Supabase の場合、そのプロジェクトの SQL Editor で実行します。申込みの表への登録をきっかけに自動で送られます。</div>
      <textarea class="mono" readonly style="min-height:300px;font-size:12px">-- ① 合言葉を金庫に保存（最初に1回だけ）
select vault.create_secret('${k}', 'denshi_keiyaku_key');

-- ② 電子契約へ送る関数
create extension if not exists pg_net;
create or replace function public.send_to_denshi_keiyaku(p_data jsonb, p_ref text) returns bigint
language plpgsql security definer set search_path = public as $$
declare k text; rid bigint;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'denshi_keiyaku_key';
  select net.http_post(
    url := '${SUPABASE_URL}/rest/v1/rpc/intake_submit',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'apikey', '${SUPABASE_ANON_KEY}', 'Authorization', 'Bearer ${SUPABASE_ANON_KEY}'),
    body := jsonb_build_object('p_key', k, 'p_data', p_data, 'p_ref', p_ref)) into rid;
  return rid;
end $$;
revoke all on function public.send_to_denshi_keiyaku(jsonb, text) from public, anon, authenticated;

-- ③ 申込みの表に登録されたら送る（「申込みの表」「列名」はサイトに合わせて変更）
create or replace function public.on_new_application() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.send_to_denshi_keiyaku(jsonb_build_object(${kv}), new.id::text);
  return new;
end $$;
create trigger send_contract_after_insert after insert on public.申込みの表
  for each row execute function public.on_new_application();</textarea>
      <label>方法B：申込みフォームの画面から直接送る</label>
      <div class="muted">合言葉が画面の中に見える状態になるため、「承認後に送信」と「受け付けるサイト」の設定と組み合わせてください。</div>
      <textarea class="mono" readonly style="min-height:150px;font-size:12px">await fetch('${SUPABASE_URL}/rest/v1/rpc/intake_submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: '${SUPABASE_ANON_KEY}', Authorization: 'Bearer ${SUPABASE_ANON_KEY}' },
  body: JSON.stringify({ p_key: '${k}', p_ref: '申込番号', p_data: ${JSON.stringify(data)} })
});</textarea>`;
  };
  V.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; drawMode(); });
  $('iCo').onchange = () => { fillTpl(); drawMap(); drawMode(); };
  $('iTpl').onchange = () => { drawMap(); drawMode(); };
  $('mapAdd').onclick = () => { map.push({ from: '', to: 'memo' }); drawMap(); };
  fillTpl(); drawMode(); drawMap(); drawHowto(newKey);
  if ($('iTest')) $('iTest').value = JSON.stringify(sample(), null, 2);

  const data = () => ({
    name: $('iName').value.trim(), company_id: $('iCo').value, template_id: $('iTpl').value || null,
    title: $('iTitle').value.trim(), mode, enabled: $('iEnabled').value === '1',
    send_days: Math.max(1, Math.min(60, +$('iDays').value || 14)),
    daily_limit: Math.max(1, +$('iDaily').value || 50), per_email_limit: Math.max(1, +$('iPer').value || 3),
    allowed_origins: $('iOrigins').value.trim(),
    mapping: map.filter(m => (m.from || '').trim() && m.to).map(m => ({ from: m.from.trim(), to: m.to, ...(m.to.startsWith('field:') ? { editable: !!m.editable } : {}) })),
    updated_at: new Date().toISOString()
  });
  const check = d => {
    if (!d.name) return '窓口名を入力してください';
    if (!d.template_id) return '雛形を選んでください（先に「雛形」で登録）';
    if (!d.mapping.some(m => m.to === 'signer_name')) return '「署名者の氏名」に対応する項目を設定してください';
    if (!d.mapping.some(m => m.to === 'signer_email')) return '「署名者のメール」に対応する項目を設定してください';
    return '';
  };
  $('iSave').onclick = async () => {
    const d = data(), err = check(d);
    if (err) return toast(err, 'err');
    try {
      if (x) {
        await run(async () => must(await sb.from('intakes').update(d).eq('id', x.id)));
        toast('保存しました', 'ok'); viewIntakes(x.id);
      } else {
        const row = await run(async () => must(await sb.from('intakes').insert(d).select('*').single()));
        const key = await run(async () => must(await sb.rpc('admin_intake_new_key', { p_id: row.id })));
        history.replaceState(null, '', '#auto/' + row.id);
        editIntake({ ...row, key_hint: key.slice(-4) }, key);
        document.getElementById('howto').scrollIntoView({ behavior: 'smooth' });
        toast('作成しました。合言葉を控えてください', 'ok');
      }
    } catch (e) { }
  };
  if ($('iKey')) $('iKey').onclick = async () => {
    if (x.key_hint && !confirm('合言葉を再発行します。前の合言葉で送っているサイトは受け付けられなくなります。よろしいですか？')) return;
    try {
      const key = await run(async () => must(await sb.rpc('admin_intake_new_key', { p_id: x.id })));
      x.key_hint = key.slice(-4); drawHowto(key);
      $('howto').scrollIntoView({ behavior: 'smooth' });
      toast('合言葉を発行しました。画面の内容を控えてください', 'ok');
    } catch (e) { }
  };
  if ($('iDel')) $('iDel').onclick = async () => {
    if (!confirm('この受付窓口を削除しますか？（作成済みの契約は残ります）')) return;
    try { await run(async () => must(await sb.from('intakes').delete().eq('id', x.id))); toast('削除しました', 'ok'); location.hash = '#auto'; } catch (e) { }
  };
  if ($('iTestBtn')) $('iTestBtn').onclick = async () => {
    let obj;
    try { obj = JSON.parse($('iTest').value); } catch (e) { return toast('申込みデータの形式が正しくありません', 'err'); }
    try {
      const r = await run(async () => must(await sb.rpc('admin_intake_test', { p_id: x.id, p_data: obj })));
      $('iTestRes').innerHTML = `<div class="notice" style="background:#e2f4ea;border-color:#a9dcbf">✓ 下書きを作成しました：<a href="#c/${r.id}">${esc(r.contract_no)}</a>（不要なら詳細画面から削除できます）</div>`;
    } catch (e) { $('iTestRes').innerHTML = `<div class="notice" style="background:#fbe5e5;border-color:#f0c4c4">✕ ${esc(errText(e))}</div>`; }
  };
}
// ================= 発行会社 =================
async function viewCompanies() {
  await loadMasters();
  V.innerHTML = `<div class="pagehead"><h2>発行会社</h2><button class="btn primary" id="coAdd">＋ 会社を追加</button></div>
    <div class="muted" style="margin-bottom:12px">契約書の発行者欄・メールの差出名・署名画面の色に使われます。通知先メールには締結・ドラフト回答の通知が届きます。</div>
    <div id="coList"></div>`;
  const draw = () => {
    document.getElementById('coList').innerHTML = COMPANIES.map(c => `<div class="card" style="margin-bottom:12px" data-co="${c.id}">
      <div class="grid2">
        <div><label style="margin-top:0">会社名</label><input data-f="name" value="${esc(c.name)}"></div>
        <div><label style="margin-top:0">代表者（役職・氏名）</label><input data-f="representative" value="${esc(c.representative)}" placeholder="代表取締役 〇〇 〇〇"></div>
        <div><label>所在地</label><input data-f="address" value="${esc(c.address)}"></div>
        <div><label>通知先メール</label><input data-f="email" type="email" value="${esc(c.email)}"></div>
        <div><label>テーマ色</label><input data-f="color" type="color" value="${esc(c.color || '#E8740C')}" style="height:44px;padding:4px"></div>
      </div>
      <div class="row" style="margin-top:14px"><button class="btn primary" data-save>保存</button><button class="btn danger" data-del>削除</button></div>
    </div>`).join('') || '<div class="empty card">会社が登録されていません</div>';
    document.querySelectorAll('[data-co]').forEach(box => {
      const id = box.dataset.co;
      box.querySelector('[data-save]').onclick = async () => {
        const d = {}; box.querySelectorAll('[data-f]').forEach(i => d[i.dataset.f] = i.value.trim());
        if (!d.name) return toast('会社名を入力してください', 'err');
        try { await run(async () => must(await sb.from('companies').update(d).eq('id', id))); await loadMasters(); toast('保存しました（以後に作成する契約から反映）', 'ok'); } catch (e) { }
      };
      box.querySelector('[data-del]').onclick = async () => {
        if (!confirm('この会社を削除しますか？')) return;
        try { await run(async () => must(await sb.from('companies').delete().eq('id', id))); await loadMasters(); draw(); toast('削除しました', 'ok'); } catch (e) { }
      };
    });
  };
  document.getElementById('coAdd').onclick = async () => {
    const name = prompt('会社名', '');
    if (!name) return;
    try { await run(async () => must(await sb.from('companies').insert({ name: name.trim() }))); await loadMasters(); draw(); } catch (e) { }
  };
  draw();
}

// ================= 設定 =================
async function viewSettings() {
  await loadMasters();
  let staff = [];
  try { staff = must(await sb.from('staff_members').select('*').order('created_at')); } catch (e) { }
  V.innerHTML = `<div class="pagehead"><h2>設定</h2></div>
    <div class="detail"><div>
      <div class="card">
        <label style="margin-top:0">署名ページの公開URL（このファイル一式を置いた場所）</label>
        <input id="sUrl" value="${esc(SETTINGS.site_url || '')}" placeholder="https://アカウント名.github.io/denshi-keiyaku">
        <div class="muted">現在の画面のURL：${esc(location.origin + location.pathname.replace(/[^/]*$/, ''))}　<button class="btn ghost" id="sUse" style="padding:2px 8px">これを使う</button></div>
        <label>メール差出人（独自ドメインで送る場合のみ）</label>
        <input id="sFrom" value="${esc(SETTINGS.mail_from || '')}">
        <div class="muted">Gmail から送る方式では使いません。差出人名は契約の発行会社名、返信先は発行会社の通知先メールになります。</div>
        <label>締結・回答の通知先（全社共通）</label>
        <input id="sNotify" value="${esc(SETTINGS.notify_to || '')}">
        <label>リーガルチェックの送信先（Apps Script のウェブアプリURL）</label>
        <input id="sAiUrl" value="${esc(SETTINGS.ai_url || '')}" placeholder="https://script.google.com/macros/s/…/exec">
        <label>リーガルチェックの合言葉</label>
        <input id="sAiSecret" type="password" value="${esc(SETTINGS.ai_secret || '')}" autocomplete="off">
        <div class="muted">Apps Script の「初期設定」を実行したときに表示される「リーガルチェックの合言葉」です。</div>
        <button class="btn primary" id="sSave" style="margin-top:16px">設定を保存</button>
      </div>
      <div class="card" style="margin-top:16px">
        <b>文書ハッシュの照合</b>
        <div class="muted">相手から提示されたPDFの「文書ハッシュ」が、本システムの締結記録と一致するか確認します。</div>
        <div class="row" style="margin-top:8px;flex-wrap:nowrap"><input id="hq" class="mono" placeholder="64桁のハッシュ値"><button class="btn" id="hBtn">照合</button></div>
        <div id="hRes" style="margin-top:8px"></div>
      </div>
    </div>
    <div class="side">
      <div class="card"><b>担当者</b><ul class="log" style="margin-top:6px">${staff.map(s => `<li>${esc(s.email)}<div class="t">${esc(s.name || '')}</div></li>`).join('')}</ul>
        <div class="muted" style="margin-top:6px">追加は手順書の「担当者の登録」を参照</div></div>
      <div class="card actions"><div class="muted">${esc(ME.email)} でログイン中</div><button class="btn" id="out">ログアウト</button></div>
    </div></div>`;
  const $ = s => document.getElementById(s);
  $('sUse').onclick = () => $('sUrl').value = (location.origin + location.pathname.replace(/[^/]*$/, '')).replace(/\/$/, '');
  $('sSave').onclick = async () => {
    const rows = [['site_url', $('sUrl').value.trim().replace(/\/$/, '')], ['mail_from', $('sFrom').value.trim()], ['notify_to', $('sNotify').value.trim()],
      ['ai_url', $('sAiUrl').value.trim()], ['ai_secret', $('sAiSecret').value.trim()]];
    try {
      await run(async () => { for (const [k, v] of rows) {
        const r = must(await sb.from('app_settings').update({ value: v }).eq('key', k).select('key'));
        if (!r.length) throw new Error('設定項目「' + k + '」がありません。最新の schema.sql を実行してください');
      } });
      await loadMasters(); toast('保存しました', 'ok');
    } catch (e) { }
  };
  $('hBtn').onclick = async () => {
    try {
      const r = await run(async () => must(await sb.rpc('admin_lookup_hash', { p_hash: $('hq').value })));
      $('hRes').innerHTML = r.found
        ? `<div class="notice" style="background:#e2f4ea;border-color:#a9dcbf">✓ 一致する締結記録があります：<a href="#c/${r.id}">${esc(r.contract_no)}「${esc(r.title)}」</a>（${esc(r.signer_name)}・${fmt(r.signed_at)}）</div>`
        : '<div class="notice" style="background:#fbe5e5;border-color:#f0c4c4">✕ 一致する締結記録はありません（内容が変更されている可能性があります）</div>';
    } catch (e) { }
  };
  $('out').onclick = async () => { await sb.auth.signOut(); ME = null; location.hash = ''; showLogin(); };
}

// ================= 数字の入力補助（金額・割合・段階・期間・日付） =================
// 差し込み項目のうち、金額・手数料・期間・日付などに入力用の小さな部品を付ける。
// 部品で選ぶと、元の入力欄に契約書用の文章が入る（元の入力欄は直接書き換えも可能）。
const NUM_STATE = {};
const LIB_DEFAULTS = {};
CONTRACT_LIBRARY.forEach(t => t.inputs.forEach(i => { if (i.def && LIB_DEFAULTS[i.key] === undefined) LIB_DEFAULTS[i.key] = i.def; }));
const AMOUNT_ONLY = ['売買代金', '購入価格', '譲渡価格', '貸付金額', '払込総額', '1株あたりの払込金額', '入会金', '月会費', '年会費',
  '作業料金', '着手金', '月額報酬', '調査費', '基本給', '時給', '最低販売価格', '顧問料'];
const RATE_BASES = ['売上金額（税抜）', '成約した取引の売上金額（税抜）', '販売価格（税込）', '販売金額（税抜）', '削減額', '交付決定額',
  '譲渡価格', '粗利益額', '受注金額（税抜）', '月額利用料'];
const DEFAULT_BASE = { '紹介料': '成約した取引の売上金額（税抜）', '販売手数料': '販売価格（税込）', '手数料': '販売金額（税抜）' };
const NO_TAX = ['売買代金', '購入価格', '貸付金額', '譲渡価格', '払込総額', '1株あたりの払込金額', '基本給', '時給', '最低販売価格'];
function numKind(key) {
  if (/裁判所|方法|条件|内容|場所|範囲|目的|対象|名称|区分|氏名|窓口|資産|契約$/.test(key)) return null;
  if (AMOUNT_ONLY.includes(key)) return 'amount';
  if (/(料|報酬|報酬額|手数料|マージン|代金|価格|金額|会費|費|手当)$/.test(key)) return 'money';
  if (/期間$/.test(key)) return 'period';
  if (/(日|期日)$/.test(key) && !/作業日|休日|日・/.test(key)) return 'date';
  return null;
}
const yen = n => Number(n).toLocaleString('ja-JP');
const yenJ = n => { n = Number(n); return n >= 1e8 && n % 1e8 === 0 ? (n / 1e8) + '億' : n >= 1e4 && n % 1e4 === 0 ? (n / 1e4).toLocaleString('ja-JP') + '万' : yen(n); };
function numText(key, s) {
  const tax = s.tax ? `（${s.tax}）` : '';
  const min = s.min ? `（ただし最低${yenJ(s.min)}円）` : '';
  if (s.mode === 'amount') return s.amt === '' || s.amt == null ? '' : `${s.unit === 'なし' ? '金' : s.unit}${yen(s.amt)}円${tax}`;
  if (s.mode === 'rate') return s.rate === '' || s.rate == null ? '' : `${s.base || '○○'}の${s.rate}%${tax}${min}`;
  if (s.mode === 'tier') {
    const rows = s.tiers.filter(t => t.rate !== '');
    if (!rows.length) return '';
    let prev = null; const parts = rows.map((t, i) => {
      const last = i === rows.length - 1 || t.upto === '';
      const p = last ? (prev == null ? '全額' : `${yenJ(prev)}円を超える部分`) : (prev == null ? `${yenJ(t.upto)}円以下の部分` : `${yenJ(prev)}円を超え${yenJ(t.upto)}円以下の部分`);
      prev = t.upto === '' ? prev : t.upto; return `${p}は${t.rate}%`;
    });
    return `${s.base || '○○'}のうち、${parts.join('、')}を合計した額${tax}${min}`;
  }
  if (s.mode === 'period') return s.n === '' ? '' : `${s.n}${s.u}${s.kan ? '間' : ''}`;
  if (s.mode === 'date') { if (!s.d) return ''; const [y, m, d] = s.d.split('-').map(Number); return `${y}年${m}月${d}日`; }
  return '';
}
function numInit(key, kind, cur) {
  if (kind === 'period') {
    const m = /^(\d+)\s*(日|週間|か月|ヶ月|年)(間?)$/.exec(cur || '');
    return { mode: 'period', n: m ? m[1] : '', u: m ? m[2].replace('ヶ月', 'か月') : 'か月', kan: m ? !!m[3] : !/存続期間|予告期間/.test(key) };
  }
  if (kind === 'date') { const m = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(cur || ''); return { mode: 'date', d: m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '' }; }
  const unit = /月会費|顧問料|月額報酬|基本給/.test(key) ? '月額' : key === '年会費' ? '年額' : key === '時給' ? '1時間あたり' : 'なし';
  return { mode: kind === 'amount' ? 'amount' : (DEFAULT_BASE[key] ? 'rate' : 'amount'), amt: '', unit, tax: NO_TAX.includes(key) ? '' : '税別',
    rate: '', base: DEFAULT_BASE[key] || '', min: '', tiers: [{ upto: '', rate: '' }, { upto: '', rate: '' }] };
}
function enhanceNumbers(root, attr) {
  if (!document.getElementById('rateBases')) {
    const dl = document.createElement('datalist'); dl.id = 'rateBases';
    dl.innerHTML = RATE_BASES.map(b => `<option value="${esc(b)}">`).join(''); document.body.appendChild(dl);
  }
  root.querySelectorAll(`input[${attr}]`).forEach(inp => {
    const key = inp.getAttribute(attr), kind = numKind(key);
    if (!kind || inp.dataset.numDone) return;
    inp.dataset.numDone = '1';
    const s = NUM_STATE[key] || (NUM_STATE[key] = numInit(key, kind, inp.value));
    const box = document.createElement('div'); box.className = 'numbox';
    if (kind === 'money' && inp.parentElement && inp.parentElement.parentElement && inp.parentElement.parentElement.classList.contains('grid2')) inp.parentElement.style.gridColumn = '1 / -1';
    inp.insertAdjacentElement('afterend', box);
    const put = () => { const t = numText(key, s); if (t) { inp.value = t; inp.dispatchEvent(new Event('input', { bubbles: true })); } };
    const draw = () => {
      const tax = `<select data-k="tax">${['税別', '税込', '非課税', ''].map(x => `<option value="${x}" ${s.tax === x ? 'selected' : ''}>${x || '税の表示なし'}</option>`).join('')}</select>`;
      let h = '';
      if (kind === 'period') {
        h = `<input type="number" min="0" data-k="n" value="${esc(s.n)}" class="n">
          <select data-k="u">${['日', '週間', 'か月', '年'].map(x => `<option ${s.u === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
          <label class="ck"><input type="checkbox" data-k="kan" ${s.kan ? 'checked' : ''}>「間」を付ける</label>`;
      } else if (kind === 'date') {
        h = `<input type="date" data-k="d" value="${esc(s.d)}">`;
      } else {
        h = (kind === 'money' ? `<div class="seg">${[['amount', '金額'], ['rate', '割合（%）'], ['tier', '段階制']].map(([m, l]) => `<button type="button" data-mode="${m}" class="${s.mode === m ? 'on' : ''}">${l}</button>`).join('')}</div>` : '');
        if (s.mode === 'amount') h += `<select data-k="unit">${['なし', '月額', '年額', '1件あたり', '1回あたり', '1時間あたり'].map(x => `<option value="${x}" ${s.unit === x ? 'selected' : ''}>${x === 'なし' ? '（単位なし）' : x}</option>`).join('')}</select>
          <input type="number" min="0" data-k="amt" value="${esc(s.amt)}" class="n" placeholder="金額"> 円 ${tax}`;
        if (s.mode === 'rate') h += `<input data-k="base" list="rateBases" value="${esc(s.base)}" placeholder="何に対して（例：売上金額）" class="b"> の
          <input type="number" min="0" step="0.1" data-k="rate" value="${esc(s.rate)}" class="n s"> % ${tax}
          <span class="nowrap">最低額 <input type="number" min="0" data-k="min" value="${esc(s.min)}" class="n" placeholder="なし"> 円</span>`;
        if (s.mode === 'tier') h += `<div><input data-k="base" list="rateBases" value="${esc(s.base)}" placeholder="何に対して（例：譲渡価格）" class="b"> ${tax}</div>
          <table class="tier">${s.tiers.map((t, i) => `<tr><td>${i ? '〜' : '0円〜'}</td>
            <td><input type="number" min="0" data-t="${i}" data-f="upto" value="${esc(t.upto)}" class="n" placeholder="${i === s.tiers.length - 1 ? '上限なし' : '上限額'}"> 円まで</td>
            <td><input type="number" min="0" step="0.1" data-t="${i}" data-f="rate" value="${esc(t.rate)}" class="n s"> %</td>
            <td>${s.tiers.length > 1 ? `<button type="button" class="x" data-del="${i}">×</button>` : ''}</td></tr>`).join('')}</table>
          <button type="button" class="btn sm" data-add>＋ 段階を追加</button>
          <span class="nowrap">最低額 <input type="number" min="0" data-k="min" value="${esc(s.min)}" class="n" placeholder="なし"> 円</span>`;
      }
      box.innerHTML = h;
      const rd = el => { const r = el.nextElementSibling && el.nextElementSibling.classList.contains('rd') ? el.nextElementSibling : null; if (r) r.textContent = el.value >= 10000 ? '＝' + yenJ(el.value) + '円' : ''; };
      box.querySelectorAll('[data-k="amt"],[data-k="min"],[data-f="upto"]').forEach(el => { const sp = document.createElement('span'); sp.className = 'rd'; el.after(sp); rd(el); el.addEventListener('input', () => rd(el)); });
      box.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { s.mode = b.dataset.mode; draw(); put(); });
      box.querySelectorAll('[data-k]').forEach(el => el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
        s[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; put();
      }));
      box.querySelectorAll('[data-t]').forEach(el => el.oninput = () => { s.tiers[+el.dataset.t][el.dataset.f] = el.value; put(); });
      box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { s.tiers.splice(+b.dataset.del, 1); draw(); put(); });
      const add = box.querySelector('[data-add]'); if (add) add.onclick = () => { s.tiers.push({ upto: '', rate: '' }); draw(); };
    };
    draw();
  });
}

boot();

