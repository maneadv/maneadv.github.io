// ===== 署名者画面 =====
const TOKEN = new URLSearchParams(location.search).get('t') || '';
const app = document.getElementById('app');
const KEY = 'ek_' + TOKEN.slice(0, 16);
const store = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(KEY + k)); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { sessionStorage.removeItem(KEY + k); } catch (e) { } }
};

let INFO = null;          // 認証前の概要
let C = null;             // 認証後の契約内容
let session = store.get('session');
let values = store.get('values') || {};
let sealType = store.get('sealType') || 'round';
let sealText = store.get('sealText') || '';
let seal = null;          // 押印画像（画面を離れると破棄）
let step = store.get('step') || 'read';
const previews = {};
const DOC_ACCEPT = 'image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.heic,.heif';      // 今回アップロードした画像の縮小表示

const STEP_DEF = [['auth', '認証'], ['read', '確認'], ['fill', '記入'], ['seal', '押印'], ['approve', '承認'], ['done', '完了']];
const needsInput = f => !isLocked(f);
function hasFillStep() { return C && ((C.fields || []).some(needsInput) || (C.attachments || []).length); }
// 発行側の記入値を初期値として反映（修正不可の項目は常に発行側の値）
function applyPrefill() {
  (C.fields || []).forEach(f => {
    if (isLocked(f)) values[f.key] = f.value;
    else if (f.value && values[f.key] === undefined) values[f.key] = f.value;
  });
  store.set('values', values);
}
function drawSteps(cur) {
  const el = document.getElementById('steps');
  if (!cur || (C && C.status === 'review')) { el.innerHTML = ''; return; }
  const list = STEP_DEF.filter(s => s[0] !== 'fill' || hasFillStep() || !C);
  const idx = list.findIndex(s => s[0] === cur);
  el.innerHTML = list.map((s, i) => `<div class="${i === idx ? 'on' : i < idx ? 'done' : ''}">${s[1]}</div>`).join('');
}
function setStep(s) { step = s; store.set('step', s); const t = document.getElementById('toast'); if (t) t.innerHTML = ''; render(); window.scrollTo(0, 0); }

function fail(msg) {
  drawSteps(null);
  app.innerHTML = `<div class="card" style="text-align:center;margin-top:30px">
    <div style="font-size:40px">⚠</div><h3 style="margin:8px 0">ご案内</h3><p>${esc(msg)}</p></div>`;
}
function onErr(e) {
  const m = errText(e);
  if (/認証の有効期限/.test(m)) { session = null; store.del('session'); C = null; renderAuth(); }
  toast(m, 'err');
}

// ---------- 起動 ----------
(async function init() {
  if (!TOKEN) return fail('URLが正しくありません。ご案内メールのリンクから開いてください。');
  try {
    INFO = must(await sb.rpc('sign_get', { p_token: TOKEN }));
  } catch (e) { return fail(errText(e)); }
  document.title = INFO.title + '｜電子契約';
  document.getElementById('coName').textContent = INFO.company;
  document.getElementById('docNo').textContent = '契約番号 ' + INFO.contract_no;
  if (INFO.color) document.documentElement.style.setProperty('--accent', INFO.color);
  if (session) {
    try { C = must(await sb.rpc('sign_view', { p_token: TOKEN, p_session: session })); applyPrefill(); return render(); }
    catch (e) { session = null; store.del('session'); }
  }
  renderAuth();
})();

// ---------- 本人確認 ----------
function renderAuth(sent) {
  drawSteps('auth');
  const label = INFO.status === 'review' ? '契約書ドラフト（案）のご確認' : INFO.status === 'signed' ? '締結済み契約書の閲覧' : '契約書のご確認・ご押印';
  app.innerHTML = `<div class="card">
    <div class="muted">${esc(label)}</div>
    <h2 style="font-size:20px;margin:4px 0 14px">${esc(INFO.title)}</h2>
    <div class="kv"><dt>宛先</dt><dd>${esc(INFO.signer_name)} 様</dd>
      <dt>メール</dt><dd>${esc(INFO.email_masked)}</dd>
      ${INFO.status !== 'signed' ? `<dt>期限</dt><dd>${fmt(INFO.expires)}</dd>` : ''}</div>
    <p class="notice" style="margin-top:16px">ご本人確認のため、上記メールアドレス宛に6桁の認証コードをお送りします。</p>
    <div id="otpArea">${sent ? otpForm() : `<button class="btn primary lg" id="sendBtn">認証コードを送信</button>`}</div>
  </div>`;
  const sb1 = document.getElementById('sendBtn');
  if (sb1) sb1.onclick = sendOtp;
  if (sent) bindOtp();
}
function otpForm() {
  return `<label>認証コード（6桁）</label>
    <input id="code" class="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">
    <button class="btn primary lg" id="verifyBtn" style="margin-top:14px">認証する</button>
    <div style="text-align:center;margin-top:12px"><button class="btn ghost" id="resendBtn">コードを再送</button></div>`;
}
async function sendOtp() {
  try { await run(async () => must(await sb.rpc('sign_request_otp', { p_token: TOKEN }))); }
  catch (e) { return; }
  toast('認証コードを送信しました。メールをご確認ください', 'ok');
  document.getElementById('otpArea').innerHTML = otpForm();
  bindOtp();
}
function bindOtp() {
  const code = document.getElementById('code');
  code.focus();
  code.oninput = () => { code.value = code.value.replace(/\D/g, ''); if (code.value.length === 6) verify(); };
  document.getElementById('verifyBtn').onclick = verify;
  document.getElementById('resendBtn').onclick = sendOtp;
}
async function verify() {
  const code = document.getElementById('code').value;
  if (code.length !== 6) return toast('6桁のコードを入力してください', 'err');
  let r;
  try { r = await run(async () => must(await sb.rpc('sign_verify_otp', { p_token: TOKEN, p_code: code }))); }
  catch (e) { return; }
  if (!r.ok) return toast(r.message, 'err');
  session = r.session; store.set('session', session);
  try { C = await run(async () => must(await sb.rpc('sign_view', { p_token: TOKEN, p_session: session }))); }
  catch (e) { return; }
  applyPrefill();
  if (!['read', 'fill', 'seal', 'approve'].includes(step)) step = 'read';
  render();
}

// ---------- 画面の振り分け ----------
function render() {
  if (!C) return renderAuth();
  if (C.status === 'signed') return renderDone();
  if (C.status === 'review') return renderReview();
  if (step === 'fill' && !hasFillStep()) step = 'seal';
  ({ read: renderRead, fill: renderFill, seal: renderSeal, approve: renderApprove }[step] || renderRead)();
}

// ---------- ドラフト確認 ----------
// 本文を「前文／第N条／第N条第M項／末文」に分解
const ART_RE = /^[\s　]*第([0-9０-９一二三四五六七八九十百〇]+)条/;
const PARA_RE = /^[\s　]*([0-9０-９]+)[\s　]/;
function parseSections(body) {
  const lines = body.split('\n'), out = [];
  let pre = [], post = [], art = null, para = null, ended = false;
  const closePara = () => { if (art && para && para.lines.length) art.paras.push(para); para = null; };
  const closeArt = () => { closePara(); if (art) arts.push(art); art = null; };
  const arts = [];
  lines.forEach(ln => {
    const am = ln.match(ART_RE);
    if (am) { closeArt(); ended = false; art = { head: ln, no: am[1], lines: [ln], paras: [] }; para = { lines: [] }; return; }
    if (!art) { (arts.length ? post : pre).push(ln); return; }
    if (ended) { post.push(ln); return; }
    if (!ln.trim()) { ended = true; closeArt(); return; }
    art.lines.push(ln);
    if (PARA_RE.test(ln) && para.lines.length) { closePara(); para = { lines: [] }; }
    para.lines.push(ln);
  });
  closeArt();
  const trim = a => a.join('\n').replace(/^\n+|\n+$/g, '');
  if (trim(pre)) out.push({ id: 'pre', label: '前文', text: trim(pre) });
  arts.forEach((a, k) => {
    const title = a.head.trim();
    out.push({ id: 'a' + k, label: `第${a.no}条（全体）`, sub: title, text: a.lines.join('\n') });
    a.paras.forEach((p, m) => out.push({ id: `a${k}p${m}`, label: `第${a.no}条第${m + 1}項`, sub: title, text: p.lines.join('\n'), indent: true }));
  });
  if (trim(post)) out.push({ id: 'post', label: '末文', text: trim(post) });
  return out;
}
let REQ = [];          // 修正依頼の一覧
let SECTIONS = [];
function renderReview() {
  drawSteps(null);
  if (C.draft_result) {
    app.innerHTML = `<div class="card" style="text-align:center;margin-top:20px">
      <div class="done-mark">✓</div><h2>ご回答ありがとうございました</h2>
      <p>${C.draft_result === 'approved' ? 'ドラフトを承認いただきました。' : '修正のご依頼を承りました。'}<br>
      本契約書の準備ができ次第、あらためてメールでご案内します。</p></div>
      ${(C.draft_changes || []).length ? `<h3 style="font-size:16px;margin:18px 0 6px">ご依頼内容</h3>${C.draft_changes.map(changeView).join('')}` : ''}`;
    return;
  }
  SECTIONS = parseSections(C.body);
  REQ = store.get('req') || [];
  app.innerHTML = `<div class="notice" style="margin:4px 0 14px">これは契約書の<b>ドラフト（案）</b>です。内容をご確認のうえ、ページ下部で「承認」または「修正を依頼」を選択してください。この段階では契約は成立しません。</div>
    ${renderDoc(C)}
    <div class="card" style="margin-top:16px" id="answer">
      <div class="grid2" style="gap:10px">
        <button class="btn lg" id="chgOpen">修正を依頼する</button>
        <button class="btn primary lg" id="okBtn">この内容で承認する</button>
      </div>
    </div>
    <div id="chgArea" class="hidden">
      <h3 style="font-size:17px;margin:22px 0 2px">修正依頼</h3>
      <div class="muted">条・項を選ぶと、その文章が入力欄に表示されます。文章を直接書き換えてください。</div>
      <div class="legend"><span><del class="d-del">削除</del>＝赤の取り消し線</span><span><ins class="d-ins">追記</ins>＝青字</span></div>
      <div id="reqList"></div>
      <button class="btn" id="addReq" style="margin-top:12px;width:100%;justify-content:center">＋ 修正箇所を追加</button>
      <div class="card" style="margin-top:14px">
        <label style="margin-top:0">その他のご意見（任意）</label>
        <textarea id="cmt" style="min-height:80px"></textarea>
        <button class="btn primary lg" id="chgSend" style="margin-top:14px">修正を依頼する</button>
      </div>
    </div>`;
  document.getElementById('okBtn').onclick = async () => {
    if (!confirm('ドラフトを承認します。よろしいですか？')) return;
    await respond(true, '', []);
  };
  document.getElementById('chgOpen').onclick = () => {
    document.getElementById('chgArea').classList.remove('hidden');
    if (!REQ.length) addReq();
    drawReqs();
    document.getElementById('chgArea').scrollIntoView({ behavior: 'smooth' });
  };
  document.getElementById('addReq').onclick = () => { addReq(); drawReqs(); };
  document.getElementById('chgSend').onclick = sendChanges;
  if (REQ.length) { document.getElementById('chgArea').classList.remove('hidden'); drawReqs(); }
}
function addReq() { REQ.push({ sec: '', type: 'edit', text: '', comment: '' }); saveReq(); }
function saveReq() { store.set('req', REQ); }
function secOf(r) { return SECTIONS.find(x => x.id === r.sec); }
function opsOf(r) { const s = secOf(r); return s ? diffText(s.text, r.text) : []; }
function drawReqs() {
  const box = document.getElementById('reqList');
  box.innerHTML = REQ.map((r, i) => {
    const sec = secOf(r);
    return `<div class="chg" data-r="${i}">
      <div class="chg-head"><b>修正 ${i + 1}</b><button class="btn ghost danger" data-rm style="padding:4px 8px">この修正を取り消す</button></div>
      <label>修正する箇所（第何条・何項）</label>
      <select data-sec><option value="">選択してください</option>${SECTIONS.map(x =>
        `<option value="${x.id}" ${x.id === r.sec ? 'selected' : ''}>${x.indent ? '　└ ' : ''}${esc(x.label)}${x.sub && !x.indent ? '　' + esc(x.sub.replace(/^第\S+条/, '')) : ''}</option>`).join('')}</select>
      ${sec ? `
      <label>修正の種類</label>
      <div class="seg3">${Object.entries(CHANGE_TYPES).map(([k, v]) => `<button data-ty="${k}" class="${r.type === k ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="muted" style="margin-top:6px">${{
        delete: '削除したい文字を入力欄から消してください。元の文章は赤の取り消し線で残ります。',
        insert: '追加したい文章を入力欄に書き足してください。追加部分は青字になります。',
        edit: '消したい文字を消し、追加したい文章を書き足してください（削除と追記の両方）。'
      }[r.type]}</div>
      <label>修正の自由記載欄（${esc(sec.label)}の文章）</label>
      <textarea data-txt>${esc(r.text)}</textarea>
      <div class="row" style="margin-top:6px;gap:6px">
        <button class="btn" data-reset style="padding:5px 10px;font-size:13px">元の文章に戻す</button>
        ${r.type === 'delete' ? '<button class="btn danger" data-all style="padding:5px 10px;font-size:13px">この箇所をすべて削除</button>' : ''}
      </div>
      <label>修正後の表示</label>
      <div class="diffbox" data-diff>${renderOps(opsOf(r))}</div>
      <div class="muted" data-warn style="color:var(--ng)"></div>
      <label>修正の理由（任意）</label>
      <input data-cmt value="${esc(r.comment)}" placeholder="例：期間を延ばしたいため">` : ''}
    </div>`;
  }).join('');
  box.querySelectorAll('.chg').forEach(el => {
    const r = REQ[+el.dataset.r];
    const q = s => el.querySelector(s);
    q('[data-rm]').onclick = () => { REQ.splice(+el.dataset.r, 1); saveReq(); drawReqs(); };
    q('[data-sec]').onchange = e => {
      const sec = SECTIONS.find(x => x.id === e.target.value);
      if (r.sec && r.text !== (secOf(r) || {}).text && !confirm('入力中の修正内容は消えます。よろしいですか？')) { e.target.value = r.sec; return; }
      r.sec = e.target.value; r.text = sec ? sec.text : ''; saveReq(); drawReqs();
    };
    if (!secOf(r)) return;
    const upd = () => { q('[data-diff]').innerHTML = renderOps(opsOf(r)); q('[data-warn]').textContent = warnOf(r); saveReq(); };
    el.querySelectorAll('[data-ty]').forEach(b => b.onclick = () => { r.type = b.dataset.ty; saveReq(); drawReqs(); });
    q('[data-txt]').oninput = e => { r.text = e.target.value; upd(); };
    q('[data-reset]').onclick = () => { r.text = secOf(r).text; saveReq(); drawReqs(); };
    if (q('[data-all]')) q('[data-all]').onclick = () => { r.text = ''; saveReq(); drawReqs(); };
    q('[data-cmt]').oninput = e => { r.comment = e.target.value; saveReq(); };
    q('[data-warn]').textContent = warnOf(r);
  });
}
function warnOf(r) {
  const ops = opsOf(r), del = ops.some(o => o[0] === '-'), ins = ops.some(o => o[0] === '+');
  if (!del && !ins) return '文章が変更されていません';
  if (r.type === 'delete' && ins) return '「削除」では文字の追加はできません（追加もする場合は「添削」を選択）';
  if (r.type === 'insert' && del) return '「追記」では文字の削除はできません（削除もする場合は「添削」を選択）';
  return '';
}
function changeView(x) {
  return `<div class="chg"><div class="chg-head"><b>${esc(x.label)}</b><span class="badge b-draft">${esc(CHANGE_TYPES[x.type] || '')}</span></div>
    <div class="diffbox" style="margin-top:8px">${renderOps(x.ops)}</div>
    ${x.comment ? `<div class="muted" style="margin-top:6px">理由：${esc(x.comment)}</div>` : ''}</div>`;
}
async function sendChanges() {
  const cm = document.getElementById('cmt').value.trim();
  const list = REQ.filter(r => r.sec);
  if (!list.length && !cm) return toast('修正箇所を選択するか、ご意見を入力してください', 'err');
  for (let i = 0; i < REQ.length; i++) {
    if (!REQ[i].sec) continue;
    const w = warnOf(REQ[i]);
    if (w) return toast(`修正 ${i + 1}：${w}`, 'err');
  }
  const changes = list.map(r => {
    const sec = secOf(r);
    return { label: sec.label, type: r.type, original: sec.text, revised: r.text, ops: opsOf(r), comment: r.comment.trim() };
  });
  if (!confirm(`${changes.length}箇所の修正を依頼します。よろしいですか？`)) return;
  await respond(false, cm, changes);
}
async function respond(approve, cm, changes) {
  try { C = await run(async () => must(await sb.rpc('sign_draft_respond', { p_token: TOKEN, p_session: session, p_approve: approve, p_comment: cm, p_changes: changes }))); }
  catch (e) { return onErr(e); }
  store.del('req');
  renderReview(); window.scrollTo(0, 0);
}

// ---------- ① 本契約書の確認 ----------
function renderRead() {
  drawSteps('read');
  const nFill = (C.fields || []).filter(f => !isLocked(f)).length, nAtt = (C.attachments || []).length;
  app.innerHTML = `<h2 style="font-size:18px;margin-bottom:10px">本契約書の内容をご確認ください</h2>
    <div class="notice" style="margin-bottom:10px">この後の作業：${nFill ? `<b>記入 ${nFill}項目</b>・` : ''}${nAtt ? `<b>書類添付 ${nAtt}項目</b>・` : ''}<b>押印 1か所</b>・承認</div>
    <div class="guide-legend"><span><i style="background:#fff3b0;border-bottom:2px solid #e0b400"></i>あとで記入する箇所</span><span><i style="border:2px dashed #c62828"></i>押印箇所</span></div>
    ${renderDoc(C, null, { values, guide: true })}
    <div class="card" style="margin-top:16px">
      <label class="check"><input type="checkbox" id="readOk"> 契約書の内容をすべて確認しました</label>
      <button class="btn primary lg" id="next" style="margin-top:14px" disabled>次へ（${hasFillStep() ? '必要事項の記入' : '押印'}）</button>
    </div>`;
  const ck = document.getElementById('readOk'), nx = document.getElementById('next');
  ck.onchange = () => nx.disabled = !ck.checked;
  nx.onclick = () => setStep(hasFillStep() ? 'fill' : 'seal');
}

// ---------- ② 必要事項の記入・書類の添付 ----------
function inputFor(f) {
  const v = esc(values[f.key] || '');
  const id = 'f_' + f.key;
  if (f.type === 'textarea') return `<textarea id="${id}" data-k="${esc(f.key)}">${v}</textarea>`;
  const t = { date: 'date', tel: 'tel', email: 'email', number: 'text' }[f.type] || 'text';
  const im = f.type === 'number' ? ' inputmode="numeric"' : '';
  return `<input id="${id}" type="${t}"${im} data-k="${esc(f.key)}" value="${v}">`;
}
function renderFill() {
  drawSteps('fill');
  const fields = C.fields || [], atts = C.attachments || [];
  app.innerHTML = `<h2 style="font-size:18px;margin-bottom:10px">必要事項のご記入</h2>
    ${fields.length ? `<div class="card">${fields.map(f => isLocked(f) ? `
      <label>${esc(f.label)}<span class="opt">記入済み</span></label>
      <div class="locked">${esc(f.value).replace(/\n/g, '<br>')}</div>` : `
      <div class="fld" data-fw="${esc(f.key)}">
      <label for="f_${esc(f.key)}">${esc(f.label)}${f.required ? '<span class="req">必須</span>' : '<span class="opt">任意</span>'}${f.value ? '<span class="opt">記入済み・修正可</span>' : ''}</label>
      ${inputFor(f)}
      <div class="ctx" data-ctx="${esc(f.key)}">${contextOf(f)}</div>
      <div class="miss-msg hidden">ここが未記入です</div></div>`).join('')}</div>` : ''}
    ${atts.length ? `<h3 style="font-size:16px;margin:22px 0 4px">書類の添付</h3>
      <div class="muted">カメラで撮影するか、画像・PDF・書類ファイルを選択してください（1ファイル10MBまで）。</div>
      <div id="atts"></div>` : ''}
    <div class="grid2" style="margin-top:18px;gap:10px">
      <button class="btn lg" id="back">戻る</button>
      <button class="btn primary lg" id="next">次へ（押印）</button>
    </div>
    <div class="progress" id="prog"></div>`;
  app.querySelectorAll('[data-k]').forEach(el => el.oninput = () => {
    values[el.dataset.k] = el.value; store.set('values', values);
    const f = fields.find(x => x.key === el.dataset.k);
    app.querySelector(`[data-ctx="${el.dataset.k}"]`).innerHTML = contextOf(f);
    const w = el.closest('.fld'); if (w && el.value.trim()) { w.classList.remove('missing'); w.querySelector('.miss-msg').classList.add('hidden'); }
    drawProgress();
  });
  if (atts.length) drawAtts();
  drawProgress();
  document.getElementById('back').onclick = () => setStep('read');
  document.getElementById('next').onclick = () => {
    const miss = missingItems();
    if (miss.length) return pointMissing(miss);
    if (!sealText) sealText = defaultSealText();
    setStep('seal');
  };
}
// 未記入・未添付の必須項目
function missingItems() {
  return (C.fields || []).filter(f => f.required && !(isLocked(f) ? f.value : (values[f.key] || '')).trim()).map(f => ({ kind: 'f', key: f.key, label: f.label }))
    .concat((C.attachments || []).filter(a => a.required && !(C.files || []).some(x => x.req_key === a.key)).map(a => ({ kind: 'a', key: a.key, label: a.label })));
}
// 未記入箇所へ移動して赤枠で知らせる
function pointMissing(miss) {
  miss.forEach(m => {
    const el = m.kind === 'f' ? app.querySelector(`[data-fw="${m.key}"]`) : app.querySelector(`.att[data-ak="${m.key}"]`);
    if (!el) return;
    el.classList.add('missing');
    const msg = el.querySelector('.miss-msg'); if (msg) msg.classList.remove('hidden');
  });
  const first = miss[0];
  const el = first.kind === 'f' ? app.querySelector(`[data-fw="${first.key}"]`) : app.querySelector(`.att[data-ak="${first.key}"]`);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); const inp = el.querySelector('input,textarea'); if (inp && first.kind === 'f') setTimeout(() => inp.focus(), 400); }
  toast(`未記入の必須項目が${miss.length}件あります：${miss.map(m => m.label).join('、')}`, 'err');
}
function drawProgress() {
  const el = document.getElementById('prog'); if (!el) return;
  const fields = (C.fields || []).filter(f => !isLocked(f)), atts = C.attachments || [];
  const total = fields.filter(f => f.required).length + atts.filter(a => a.required).length;
  const miss = missingItems().length, done = total - miss;
  el.className = 'progress' + (miss ? '' : ' ok');
  el.innerHTML = total ? `<span>${miss ? `必須 残り<b style="color:var(--ng)">${miss}</b>項目` : '<b style="color:var(--ok)">必須項目はすべて完了</b>'}</span>
    <span class="bar"><i style="width:${Math.round(done / total * 100)}%"></i></span>
    ${miss ? '<button class="btn" id="goMiss" style="padding:5px 10px;font-size:12px">未記入へ移動</button>' : ''}`
    : '<span class="muted">必須項目はありません</span>';
  const g = document.getElementById('goMiss'); if (g) g.onclick = () => pointMissing(missingItems());
}
// 記入内容が契約書のどこに入るかを前後の文と一緒に表示
function contextOf(f) {
  const v = values[f.key] || '';
  const mark = v ? `<span class="fill">${esc(v)}</span>` : `<span class="blank">ここに入ります</span>`;
  const tag = `[[${f.label}]]`, at = C.body.indexOf(tag);
  if (at < 0) return `契約書内の表示：「署名者記入事項」の${esc(f.label)}欄 → ${mark}`;
  const ls = C.body.lastIndexOf('\n', at) + 1, le = C.body.indexOf('\n', at);
  const line = C.body.slice(ls, le < 0 ? undefined : le);
  const p = at - ls, before = line.slice(Math.max(0, p - 24), p), after = line.slice(p + tag.length, p + tag.length + 24);
  const clean = t => esc(t.replace(/\[\[([^\]]+)\]\]/g, '＿＿'));
  return `契約書内の表示：${p > 24 ? '…' : ''}${clean(before)}${mark}${clean(after)}${line.length > p + tag.length + 24 ? '…' : ''}`;
}
function drawAtts() {
  const box = document.getElementById('atts');
  box.innerHTML = (C.attachments || []).map(a => {
    const files = (C.files || []).filter(f => f.req_key === a.key);
    const cam = a.kind === 'camera' || a.kind === 'image';
    return `<div class="att" data-ak="${esc(a.key)}">
      <h4>${esc(a.label)}${a.required ? '<span class="req">必須</span>' : '<span class="opt">任意</span>'}</h4>
      ${a.note ? `<div class="muted">${esc(a.note)}</div>` : ''}
      <div class="row" style="margin-top:8px">
        ${cam ? `<label class="btn" style="margin:0">📷 カメラで撮影<input type="file" accept="image/*" capture="environment" data-up="${esc(a.key)}" hidden></label>` : ''}
        <label class="btn" style="margin:0">${a.kind === 'image' ? '🖼 画像を選択' : a.kind === 'camera' ? '📎 画像・書類を選択' : '📎 ファイルを選択'}<input type="file" ${a.kind === 'image' ? 'accept="image/*"' : `accept="${DOC_ACCEPT}"`} multiple data-up="${esc(a.key)}" hidden></label>
      </div>
      <div class="miss-msg hidden">この書類が未添付です</div>
      <ul class="files">${files.map(f => `<li>
        ${previews[f.id] ? `<img src="${previews[f.id]}" alt="">` : `<span style="font-size:22px">${/^image\//.test(f.mime) ? '🖼' : '📄'}</span>`}
        <span class="nm">${esc(f.name)}<br><span class="muted">${fsize(f.size)}</span></span>
        <button class="btn ghost danger" data-del="${f.id}">削除</button></li>`).join('')}</ul>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-up]').forEach(inp => inp.onchange = async () => {
    const list = Array.from(inp.files || []);
    inp.value = '';
    for (const file of list) await upload(inp.dataset.up, file);
  });
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('このファイルを削除しますか？')) return;
    try { C = await run(async () => must(await sb.rpc('sign_delete_file', { p_token: TOKEN, p_session: session, p_file: b.dataset.del }))); }
    catch (e) { return onErr(e); }
    drawAtts(); drawProgress();
  });
}
// 画像は長辺2000pxに縮小してから送信
async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) return null;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
    return blob;
  } catch (e) { return null; }
}
function toB64(blob) {
  return new Promise((ok, ng) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ng; r.readAsDataURL(blob); });
}
async function upload(key, file) {
  let blob = file, name = file.name || 'photo.jpg', mime = file.type || 'application/octet-stream';
  const small = await shrinkImage(file);
  if (small && small.size < file.size) { blob = small; mime = 'image/jpeg'; name = name.replace(/\.\w+$/, '') + '.jpg'; }
  if (blob.size > 10 * 1024 * 1024) return toast(`${name}：10MBを超えるため添付できません`, 'err');
  const before = new Set((C.files || []).map(f => f.id));
  try {
    const b64 = await toB64(blob);
    C = await run(async () => must(await sb.rpc('sign_upload', { p_token: TOKEN, p_session: session, p_key: key, p_name: name, p_mime: mime, p_b64: b64 })));
  } catch (e) { return onErr(e); }
  const added = (C.files || []).find(f => !before.has(f.id));
  if (added && /^image\//.test(mime)) previews[added.id] = URL.createObjectURL(blob);
  toast(`${name} を添付しました`, 'ok');
  drawAtts(); drawProgress();
}

// ---------- ③ 押印 ----------
function defaultSealText(type) {
  type = type || sealType;
  if (type === 'square') return values.company || '';
  const nm = (values.name || C.signer_name || '').trim();
  return nm.split(/[\s　]+/)[0].slice(0, 4);
}
function renderSeal() {
  drawSteps('seal');
  app.innerHTML = `<h2 style="font-size:18px;margin-bottom:10px">押印</h2>
    <div class="card">
      <label style="margin-top:0">押印の種類</label>
      <div class="seal-types">
        <button data-t="round">丸印（個人）</button>
        <button data-t="square">角印（法人）</button>
        <button data-t="hand">手書き署名</button>
      </div>
      <div id="sealBody"></div>
    </div>
    <div class="card" style="margin-top:16px">
      <b>契約書の押印箇所</b>
      <div class="arrow-note" id="sealNote">↓ 署名者欄の赤枠に押印されます</div>
      <div id="sealSpot" style="margin-top:8px"></div>
    </div>
    <div class="grid2" style="margin-top:18px;gap:10px">
      <button class="btn lg" id="back">戻る</button>
      <button class="btn primary lg" id="next">次へ（承認）</button>
    </div>`;
  app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
    sealType = b.dataset.t; store.set('sealType', sealType);
    sealText = defaultSealText(); store.set('sealText', sealText);
    seal = null; drawSealBody();
  });
  document.getElementById('back').onclick = () => setStep(hasFillStep() ? 'fill' : 'read');
  document.getElementById('next').onclick = () => {
    if (seal) return setStep('approve');
    toast('まだ押印されていません。押印してから進んでください', 'err');
    const t = document.getElementById('stampBtn') || document.getElementById('fix');
    if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 2400); }
  };
  if (!sealText) sealText = defaultSealText();
  drawSealBody();
}
// 署名者欄だけを切り出して押印位置を表示
function drawSealSpot() {
  const box = document.getElementById('sealSpot'); if (!box) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = renderDoc(C, null, { values, seal, guide: true });
  const parties = tmp.querySelector('.doc-parties');
  box.innerHTML = `<div class="doc guide" style="padding:14px 16px">${parties ? parties.outerHTML : ''}</div>`;
  const pt = box.querySelector('.doc-parties'); if (pt) pt.style.marginTop = '0';
  const img = box.querySelector('.sigbox img'); if (img && seal) img.classList.add('stamp-anim');
  document.getElementById('sealNote').textContent = seal ? '✓ 押印済み（下の位置に入ります）' : '↓ 署名者欄の赤枠に押印されます';
  document.getElementById('sealNote').style.color = seal ? 'var(--ok)' : '#c62828';
}
function drawSealBody() {
  app.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === sealType));
  const nx = document.getElementById('next');
  drawSealSpot();
  const body = document.getElementById('sealBody');
  if (sealType === 'hand') {
    body.innerHTML = `<label>枠内に署名してください</label>
      <div class="pad-wrap"><div class="line"></div><div class="hint" id="hint">ここに署名</div><canvas id="pad"></canvas></div>
      <div class="row" style="justify-content:space-between;margin-top:10px">
        <button class="btn" id="clr">書き直す</button>
        <button class="btn primary" id="fix">この署名で押印</button></div>
      <div class="seal-stage ${seal ? '' : 'hidden'}" id="stage">${seal ? `<img src="${seal}" style="width:auto;max-width:90%;height:auto;max-height:150px">` : ''}</div>`;
    const pad = makePad(document.getElementById('pad'));
    pad.onstart = () => { const h = document.getElementById('hint'); if (h) h.remove(); };
    document.getElementById('clr').onclick = () => { pad.clear(); seal = null; drawSealBody(); };
    document.getElementById('fix').onclick = () => {
      if (pad.isEmpty()) return toast('署名を記入してください', 'err');
      seal = pad.toPng();
      const st = document.getElementById('stage');
      st.classList.remove('hidden'); st.innerHTML = `<img src="${seal}" class="stamp-anim" style="width:auto;max-width:90%;height:auto;max-height:150px">`;
      drawSealSpot();
    };
    return;
  }
  body.innerHTML = `<label>印影の文字（${sealType === 'round' ? '氏名・最大4文字' : '会社名・最大18文字（「之印」は自動付与）'}）</label>
    <input id="stext" value="${esc(sealText)}" maxlength="${sealType === 'round' ? 4 : 18}">
    <div class="seal-stage" id="stage">${seal ? `<img src="${seal}" alt="印影">` : '<span class="muted">下の「押印」ボタンを押してください</span>'}</div>
    <button class="stamp-btn" id="stampBtn">${seal ? '押し直す' : '押印'}</button>`;
  const st = document.getElementById('stext');
  st.oninput = () => { sealText = st.value; store.set('sealText', sealText); };
  document.getElementById('stampBtn').onclick = () => {
    const t = (sealText || '').trim();
    if (!t) return toast('印影の文字を入力してください', 'err');
    seal = sealType === 'round' ? makeRoundSeal(t) : makeSquareSeal(t);
    if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) { }
    document.getElementById('stage').innerHTML = `<img src="${seal}" class="stamp-anim" alt="印影">`;
    document.getElementById('stampBtn').textContent = '押し直す';
    drawSealSpot();
  };
}

// ---------- ④ 承認 ----------
function renderApprove() {
  if (!seal) return setStep('seal');
  drawSteps('approve');
  const fields = C.fields || [];
  const miss = missingItems();
  const fNeed = fields.filter(f => f.required), aNeed = (C.attachments || []).filter(a => a.required);
  const row = (label, ok, txt, go) => `<li><span>${label}</span><span class="${ok ? 'ok' : 'ng'}">${ok ? '✓ ' + txt : '✕ ' + txt}${!ok && go ? ` <button class="btn" data-go="${go}" style="padding:2px 8px;font-size:12px">戻って対応</button>` : ''}</span></li>`;
  app.innerHTML = `<h2 style="font-size:18px;margin-bottom:10px">内容の最終確認と承認</h2>
    <div class="card" style="margin-bottom:14px"><b>締結前チェック</b>
      <ul class="checklist" style="margin-top:6px">
        ${row('契約書の確認', true, '確認済み')}
        ${fNeed.length ? row('必須の記入事項', !miss.some(m => m.kind === 'f'), miss.some(m => m.kind === 'f') ? '未記入あり' : `${fNeed.length}項目 記入済み`, 'fill') : ''}
        ${aNeed.length ? row('必須の書類添付', !miss.some(m => m.kind === 'a'), miss.some(m => m.kind === 'a') ? '未添付あり' : `${aNeed.length}項目 添付済み`, 'fill') : ''}
        ${row('押印', !!seal, seal ? SEAL_TYPES[sealType] + 'で押印済み' : '未押印', 'seal')}
      </ul></div>
    <div class="notice" style="margin-bottom:14px">押印済みの契約書です。内容に問題がなければ、ページ下部の「承認して契約を締結」を押してください。承認後は変更できません。</div>
    ${renderDoc(C, null, { values, seal })}
    ${(C.files || []).length ? `<div class="card" style="margin-top:16px"><b>添付書類</b><ul style="margin:6px 0 0;padding-left:20px">${C.files.map(f => `<li>${esc(f.name)}（${fsize(f.size)}）</li>`).join('')}</ul></div>` : ''}
    <div class="card" style="margin-top:16px">
      <label class="check"><input type="checkbox" id="agree"> 上記の契約内容・記入事項に同意し、本契約を締結します</label>
      <button class="btn primary lg" id="approveBtn" style="margin-top:14px" disabled>承認して契約を締結</button>
      <button class="btn lg" id="back" style="margin-top:10px">戻る（押印をやり直す）</button>
    </div>`;
  const ag = document.getElementById('agree'), ab = document.getElementById('approveBtn');
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => setStep(b.dataset.go));
  ag.onchange = () => ab.disabled = !ag.checked || miss.length > 0;
  if (miss.length) { ag.disabled = true; ag.closest('label').insertAdjacentHTML('afterend', '<div class="miss-msg">未対応の項目があるため承認できません。上のチェック一覧から戻って対応してください。</div>'); }
  document.getElementById('back').onclick = () => setStep('seal');
  ab.onclick = async () => {
    if (!confirm('この内容で契約を締結します。よろしいですか？')) return;
    const vals = {};
    fields.forEach(f => vals[f.key] = isLocked(f) ? f.value : (values[f.key] || '').trim());
    try {
      C = await run(async () => must(await sb.rpc('sign_submit', {
        p_token: TOKEN, p_session: session, p_values: vals, p_seal_type: sealType, p_seal: seal, p_agree: true
      })));
    } catch (e) { return onErr(e); }
    ['values', 'step', 'sealType', 'sealText'].forEach(k => store.del(k));
    renderDone(true); window.scrollTo(0, 0);
  };
}

// ---------- ⑤ 完了・ダウンロード ----------
function renderDone(justSigned) {
  drawSteps('done');
  app.innerHTML = `<div class="card" style="text-align:center">
      <div class="done-mark">✓</div>
      <h2>${justSigned ? '契約の締結が完了しました' : 'この契約は締結済みです'}</h2>
      <p class="muted" style="margin:6px 0 2px">締結日時：${fmt(C.signed_at, true)}</p>
      <p class="mono" style="margin:0 0 14px">文書ハッシュ：${esc(C.doc_hash)}</p>
      <button class="btn primary lg" id="dl">押印済み契約書をダウンロード（PDF）</button>
      ${justSigned ? '<p class="muted" style="margin-top:12px">締結完了のお知らせをメールでお送りしました。後日もメール内のリンクから再ダウンロードできます。</p>' : ''}
    </div>
    <div style="margin-top:16px">${renderDoc(C, C.logs)}</div>`;
  document.getElementById('dl').onclick = async () => {
    try { await run(() => savePdf(C, C.logs)); } catch (e) { }
  };
}
