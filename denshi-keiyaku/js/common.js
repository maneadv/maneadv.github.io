// ===== 共通処理（管理画面・署名画面の両方で使用）=====
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STATUS = { draft: '下書き', review: 'ドラフト確認中', sent: '送信済', viewed: '閲覧済', signed: '締結済', cancelled: '取消', expired: '期限切れ' };
const EVENTS = {
  created: '契約書作成', sent: '署名依頼メール送信', resent: '署名依頼メール再送',
  otp_sent: '確認コード送信', otp_failed: '確認コード誤り', verified: 'メール確認コードによる本人確認', link_opened: 'メール記載のURLから開封',
  opened: '契約書閲覧', signed: '押印・承認（締結）', cancelled: '取消', verify_check: '改ざん検証', auto_created: '自動受付で作成',
  draft_sent: 'ドラフト確認依頼', draft_resent: 'ドラフト確認依頼（再送）', draft_approved: 'ドラフト承認',
  draft_changes: 'ドラフト修正依頼', file_uploaded: '書類添付', file_deleted: '添付削除'
};
const SEAL_TYPES = { round: '丸印', square: '角印', hand: '手書き署名' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 日本時間で表示
function fmt(dt, withSec) {
  if (!dt) return '';
  const d = new Date(dt);
  const o = { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
  if (withSec) o.second = '2-digit';
  return d.toLocaleString('ja-JP', o);
}
function todayJa() {
  const p = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
  const g = t => p.find(x => x.type === t).value;
  return `${g('year')}年${g('month')}月${g('day')}日`;
}

function effectiveStatus(c) {
  if ((c.status === 'sent' || c.status === 'viewed') && c.token_expires_at && new Date(c.token_expires_at) < new Date()) return 'expired';
  return c.status;
}
function badge(c) {
  const s = effectiveStatus(c);
  return `<span class="badge b-${s}">${STATUS[s]}</span>`;
}

function toast(msg, type) {
  let box = document.getElementById('toast');
  if (!box) { box = document.createElement('div'); box.id = 'toast'; document.body.appendChild(box); }
  box.innerHTML = ''; // 通知は常に最新の1件だけ表示
  const d = document.createElement('div');
  if (type) d.className = type;
  d.textContent = msg;
  box.appendChild(d);
  setTimeout(() => d.remove(), type === 'err' ? 6000 : 3500);
}
function errText(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e);
  if (/Invalid login credentials/i.test(m)) return 'メールアドレスまたはパスワードが違います';
  if (/Failed to fetch|NetworkError/i.test(m)) return '通信できませんでした。接続を確認してください';
  if (/violates foreign key/i.test(m)) return 'この項目は契約で使われているため削除できません';
  if (/JWT expired/i.test(m)) return 'ログインの有効期限が切れました。再ログインしてください';
  return m;
}
let loadingCount = 0;
function loading(on) {
  loadingCount += on ? 1 : -1;
  let el = document.getElementById('loading');
  if (!el) { el = document.createElement('div'); el.id = 'loading'; el.className = 'loading hidden'; el.innerHTML = '<div class="spin"></div>'; document.body.appendChild(el); }
  el.classList.toggle('hidden', loadingCount <= 0);
}
async function run(fn) {
  loading(true);
  try { return await fn(); }
  catch (e) { toast(errText(e), 'err'); throw e; }
  finally { loading(false); }
}
// Supabase の応答からエラーを例外に変換
function must(res) { if (res.error) throw res.error; return res.data; }

// 発行側が記入済みの項目
const isLocked = f => !!(f.value && String(f.value).trim()) && !f.editable;
function prefillValues(c) {
  const v = {};
  (c.fields || []).forEach(f => { if (f.value && String(f.value).trim()) v[f.key] = f.value; });
  return v;
}
function fsize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }

// ===== 契約書の表示（画面・PDF共通）=====
// opts.values … 記入中の値（未締結時のプレビュー用）／ opts.seal … 押印プレビュー画像
function renderDoc(c, logs, opts) {
  opts = opts || {};
  const co = c.company_snapshot || {};
  const signed = c.status === 'signed';
  const fields = c.fields || [];
  const values = signed ? (c.field_values || {}) : { ...prefillValues(c), ...(opts.values || {}) };
  fields.forEach(f => { if (!signed && isLocked(f)) values[f.key] = f.value; });
  const seal = signed ? c.signature_png : opts.seal;
  const draft = c.status === 'review' || c.status === 'draft';

  // 本文中の [[項目名]] を記入値に置換
  let body = esc(c.body);
  fields.forEach(f => {
    const v = values[f.key];
    const rep = v ? `<span class="fill" data-fk="${esc(f.key)}">${esc(v)}</span>` : `<span class="blank" data-fk="${esc(f.key)}">${esc(f.label)}</span>`;
    body = body.split(esc(`[[${f.label}]]`)).join(rep);
  });

  const fieldRows = fields.map(f => `<tr data-fk="${esc(f.key)}"${values[f.key] ? '' : ' class="empty-row"'}><th>${esc(f.label)}</th><td>${values[f.key] ? esc(values[f.key]).replace(/\n/g, '<br>') : '<span class="blank-s">（未記入）</span>'}</td></tr>`).join('');

  let h = `<div class="doc${draft ? ' is-draft' : ''}${opts.guide && !signed ? ' guide' : ''}">
    ${draft ? '<div class="wm">ドラフト（確認用）</div>' : ''}
    <div class="doc-no">契約番号　${esc(c.contract_no || '（保存時に採番）')}</div>
    <h1>${esc(c.title)}</h1>
    <div class="doc-body">${body}</div>
    ${fields.length ? `<table class="doc-fields"><caption>署名者記入事項</caption>${fieldRows}</table>` : ''}
    <div class="doc-parties">
      <div class="party">
        <div class="party-label">発行者</div>
        ${/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(co.logo || '') ? `<img class="logo" src="${co.logo}" alt="">` : ''}
        <div class="nm">${esc(co.name)}</div>
        ${co.address ? `<div>${esc(co.address)}</div>` : ''}
        ${co.representative ? `<div>${esc(co.representative)}</div>` : ''}
        <div class="muted" style="margin-top:6px">本契約書の発行・送信者</div>
      </div>
      <div class="party">
        <div class="party-label">署名者</div>
        <div class="nm">${esc(values.company ? values.company : '')}${values.company ? '<br>' : ''}${esc(values.name || c.signer_name)}</div>
        <div>${esc(c.signer_email)}</div>
        <div class="sigbox${seal ? ' sealed' : ''}" data-seal>${seal ? `<img src="${seal}" alt="印影">` : '<span class="none">押印箇所</span>'}</div>
        ${signed ? `<div style="font-size:12px;margin-top:4px">${esc(SEAL_TYPES[c.seal_type] || '押印')}　締結日時：${fmt(c.signed_at, true)}</div>` : ''}
      </div>
    </div>`;

  if (signed) {
    const rows = (logs || []).map(l => `<tr><td style="width:150px">${fmt(l.created_at, true)}</td><td>${esc(EVENTS[l.event] || l.event)}</td><td>${esc(l.actor && l.actor !== '署名者' ? '発行者' : '署名者')}</td><td>${esc(l.ip || '')}</td></tr>`).join('');
    const files = (c.files || []).map(f => {
      const req = (c.attachments || []).find(a => a.key === f.req_key);
      return `<tr><td>${esc(req ? req.label : f.req_key)}</td><td>${esc(f.name)}（${fsize(f.size)}）</td><td class="hash">${esc(f.sha256)}</td></tr>`;
    }).join('');
    h += `<div class="cert">
      <h2>電子契約 締結証明書</h2>
      <div class="lead">本書は、上記契約が下記の記録のとおり電子的に締結されたことを証明するものです。</div>
      <table>
        <tr><th>契約番号</th><td>${esc(c.contract_no)}</td></tr>
        <tr><th>契約書名</th><td>${esc(c.title)}</td></tr>
        <tr><th>発行者</th><td>${esc(co.name)}</td></tr>
        <tr><th>署名者</th><td>${esc(c.signer_name)}（契約名義：${esc(c.typed_name)}）</td></tr>
        <tr><th>本人確認</th><td>${esc(c.signer_email)} 宛の認証コードによるメール認証</td></tr>
        <tr><th>ドラフト確認</th><td>${c.draft_result === 'approved' ? '署名者による承認済み' : c.draft_result === 'changes' ? '修正依頼のうえ本契約書を発行' : '省略'}</td></tr>
        <tr><th>押印方法</th><td>${esc(SEAL_TYPES[c.seal_type] || '')}</td></tr>
        <tr><th>締結日時（日本時間）</th><td>${fmt(c.signed_at, true)}　<span class="stamp">締結済</span></td></tr>
        <tr><th>承認時の接続元</th><td>${esc(c.signer_ip || '記録なし')}</td></tr>
        <tr><th>文書ハッシュ<br>（SHA-256）</th><td class="hash">${esc(c.doc_hash)}</td></tr>
      </table>
      ${files ? `<table><tr><th style="width:150px">添付書類</th><th>ファイル</th><th>ファイルハッシュ（SHA-256）</th></tr>${files}</table>` : ''}
      <table>
        <tr><th style="width:150px">日時</th><th>操作</th><th style="width:80px">操作者</th><th style="width:130px">接続元</th></tr>
        ${rows}
      </table>
      <div class="lead" style="text-align:left">文書ハッシュは、契約本文・当事者情報・記入事項・添付書類・印影・締結日時を一体として算出した値です。
      内容が1文字でも変更されると値が変わるため、発行者の管理システムで照合することで改ざんの有無を確認できます。</div>
    </div>`;
  }
  return h + '</div>';
}

// PDF保存
async function savePdf(c, logs) {
  const name = `${c.contract_no}_${c.title}${c.status === 'signed' ? '_押印済' : ''}`.replace(/[\\/:*?"<>|]/g, '_') + '.pdf';
  const holder = document.createElement('div');
  holder.style.cssText = 'width:760px';
  holder.innerHTML = renderDoc(c, logs);
  holder.querySelector('.doc').style.border = '0';
  await html2pdf().set({
    margin: [12, 12, 14, 12],
    filename: name,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['.party', '.cert tr', '.doc-parties', '.doc-fields tr'] }
  }).from(holder).save();
}

// ===== 修正箇所の差分（削除＝赤の取り消し線／追記＝青字）=====
// 文字単位で比較し [['=',共通], ['-',削除], ['+',追記], ...] を返す
function diffText(a, b) {
  const A = Array.from(a), B = Array.from(b);
  // 前後の共通部分を先に除く
  let p = 0; while (p < A.length && p < B.length && A[p] === B[p]) p++;
  let q = 0; while (q < A.length - p && q < B.length - p && A[A.length - 1 - q] === B[B.length - 1 - q]) q++;
  const a2 = A.slice(p, A.length - q), b2 = B.slice(p, B.length - q);
  const n = a2.length, m = b2.length, ops = [];
  if (n * m > 4000000) { // 長すぎる場合は全体を置き換えとして扱う
    if (n) ops.push(['-', a2.join('')]); if (m) ops.push(['+', b2.join('')]);
  } else {
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      L[i][j] = a2[i] === b2[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a2[i] === b2[j]) { ops.push(['=', a2[i]]); i++; j++; }
      else if (i < n && (j === m || L[i + 1][j] >= L[i][j + 1])) { ops.push(['-', a2[i]]); i++; }
      else { ops.push(['+', b2[j]]); j++; }
    }
  }
  const head = p ? [['=', A.slice(0, p).join('')]] : [], tail = q ? [['=', A.slice(A.length - q).join('')]] : [];
  return cleanupOps(mergeOps(head.concat(ops, tail)));
}
function mergeOps(ops) {
  const out = [];
  ops.forEach(([t, s]) => { if (!s) return; const l = out[out.length - 1]; if (l && l[0] === t) l[1] += s; else out.push([t, s]); });
  return out;
}
// 変更に挟まれた2文字以下の共通部分は変更に含め、読みやすくする
function cleanupOps(ops) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < ops.length - 1; i++) {
      if (ops[i][0] === '=' && Array.from(ops[i][1]).length <= 2 && ops[i - 1][0] !== '=' && ops[i + 1][0] !== '=') {
        const s = ops[i][1];
        ops.splice(i, 1, ['-', s], ['+', s]);
        changed = true; break;
      }
    }
    if (changed) ops = normOps(ops);
  }
  return normOps(ops);
}
// 隣り合う削除・追記をまとめ、削除を先・追記を後に並べる
function normOps(ops) {
  const out = []; let del = '', ins = '';
  const flush = () => { if (del) out.push(['-', del]); if (ins) out.push(['+', ins]); del = ins = ''; };
  ops.forEach(([t, s]) => { if (t === '=') { flush(); out.push(['=', s]); } else if (t === '-') del += s; else ins += s; });
  flush();
  return mergeOps(out);
}
function renderOps(ops) {
  return (ops || []).map(([t, s]) => {
    const h = esc(s).replace(/\n/g, '<br>');
    return t === '-' ? `<del class="d-del">${h}</del>` : t === '+' ? `<ins class="d-ins">${h}</ins>` : h;
  }).join('');
}
const CHANGE_TYPES = { delete: '削除', insert: '追記', edit: '添削' };
