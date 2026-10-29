// ===== 条項ごとの確認・修正（発行側）=====
// 本文を空行で区切った「かたまり」単位で扱う。第N条で始まるかたまりを条とし、
// 本文中の「第N条」の参照は内部で条そのものに結びつけて持つ（番号が変わっても参照先がずれない）
const ED_ART = /^[\s　]*第([0-9０-９]+)条/;
const toHalf = s => String(s).replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
const sameExceptNo = (a, b) => String(a).replace(/第[0-9０-９]+条/g, '第#条') === String(b).replace(/第[0-9０-９]+条/g, '第#条');
let edUid = 0;

function splitParts(body) {
  return String(body || '').replace(/\r\n/g, '\n').split(/\n[ \t　]*\n+/).map(t => t.replace(/^\n+|\n+$/g, '')).filter(t => t.trim() !== '');
}
function blockLabel(text) {
  const m = text.match(/^[\s　]*(第[0-9０-９一二三四五六七八九十百]+条(?:（[^）]*）)?)/);
  return m ? m[1] : (text.split('\n')[0].slice(0, 24) + (text.length > 24 ? '…' : ''));
}

function makeClauseEditor(container, body, onChange) {
  let blocks = [], editing = null;

  // ---- 番号 ⇔ 内部表現 ----
  const numMap = () => {   // 条のuid → 現在の番号
    const m = {}; let n = 0;
    blocks.forEach(b => { if (b.isArt && b.state !== 'deleted') m[b.uid] = String(++n); });
    blocks.forEach(b => { if (b.isArt && b.state === 'deleted') m[b.uid] = b.lastNo || '?'; });
    return m;
  };
  const render = (raw, m, self) => {
    const dead = new Set(blocks.filter(b => b.isArt && b.state === 'deleted').map(b => String(b.uid)));
    return raw.replace(/第⟦(\d+)⟧条/g, (x, u) => dead.has(u) && u !== String(self) ? `第${m[u] || '?'}条【削除した条】` : `第${m[u] || '?'}条`)
      .replace(/⟦(\d+)⟧/g, (x, u) => m[u] || '?');
  };
  const toRaw = (text, self) => {   // 表示中の番号から内部表現へ
    const m = numMap(), byNo = {};
    blocks.forEach(b => { if (b.isArt && b.state !== 'deleted') byNo[m[b.uid]] = b.uid; });
    let head = '';
    if (self && ED_ART.test(text)) { head = text.match(ED_ART)[0].replace(/[0-9０-９]+/, `⟦${self.uid}⟧`); text = text.replace(ED_ART, ''); }
    return head + text.replace(/【削除した条】/g, '').replace(/第([0-9０-９]+)条/g, (all, d) => byNo[toHalf(d)] ? `第⟦${byNo[toHalf(d)]}⟧条` : all);
  };
  const refresh = () => {   // 表示用の文章を作り直す
    const m = numMap();
    blocks.forEach(b => { b.text = render(b.raw, m, b.uid); if (b.isArt && b.state !== 'deleted') b.lastNo = m[b.uid]; });
  };
  const warnRefs = () => {   // 削除した条を参照している箇所
    const dead = new Set(blocks.filter(b => b.isArt && b.state === 'deleted').map(b => String(b.uid)));
    const m = numMap(), out = new Set();
    blocks.forEach(b => { if (b.state === 'deleted') return; (b.raw.slice(1).match(/⟦(\d+)⟧/g) || []).forEach(t => { const u = t.slice(1, -1); if (dead.has(u) && u !== String(b.uid)) out.add(m[u]); }); });
    return [...out];
  };
  function init(text) {
    blocks = splitParts(text).map(t => ({ uid: ++edUid, text: t, orig: t, raw: t, state: 'keep', isArt: ED_ART.test(t) }));
    // 読み込み時の番号で参照を結びつける
    const byNo = {};
    blocks.forEach(b => { if (b.isArt) { const k = toHalf(b.text.match(ED_ART)[1]); if (!(k in byNo)) byNo[k] = b.uid; } });
    blocks.forEach(b => {
      let head = '', rest = b.text;
      if (b.isArt) { head = b.text.match(ED_ART)[0].replace(/[0-9０-９]+/, `⟦${b.uid}⟧`); rest = b.text.replace(ED_ART, ''); }
      b.raw = head + rest.replace(/第([0-9０-９]+)条/g, (all, d) => byNo[toHalf(d)] ? `第⟦${byNo[toHalf(d)]}⟧条` : all);
    });
    refresh();
  }
  const bodyText = () => blocks.filter(b => b.state !== 'deleted').map(b => b.text).join('\n\n');
  const emit = () => onChange(bodyText());
  const isChanged = b => b.state === 'deleted' || (b.state === 'added' && !b.orig) || !sameExceptNo(b.text, b.orig);

  // ---- 表示 ----
  const view = (b, text) => {
    text = text === undefined ? b.text : text;
    if (b.state === 'deleted') return `<del class="d-del">${esc(b.orig || text).replace(/\n/g, '<br>')}</del>`;
    if (b.state === 'added' && !b.orig) return `<ins class="d-ins">${esc(text).replace(/\n/g, '<br>')}</ins>`;
    if (text === b.orig || sameExceptNo(text, b.orig)) return esc(text).replace(/\n/g, '<br>');
    return renderOps(diffText(b.orig, text));
  };
  const mark = b => b.state === 'deleted' ? '<span class="badge b-cancelled">削除</span>'
    : (b.state === 'added' && !b.orig) ? '<span class="badge b-sent">追加</span>'
    : !sameExceptNo(b.text, b.orig) ? '<span class="badge b-viewed">修正</span>'
    : b.text !== b.orig ? '<span class="muted" style="font-size:12px">番号変更</span>' : '';
  function draw() {
    const changes = blocks.filter(isChanged).length, warn = warnRefs();
    container.innerHTML = `
      <div class="ce-head"><span class="muted">条を選んで「修正」を押すと、その条を直接書き換えられます。番号と「第○条」の参照は自動で振り直します。</span>
        <span class="legend" style="margin:0"><span><del class="d-del">削除</del></span><span><ins class="d-ins">追記</ins></span>${changes ? `<b>修正 ${changes}か所</b>` : ''}</span></div>
      ${warn.length ? `<div class="miss-msg">削除した第${warn.join('条・第')}条を参照している文章が残っています。内容を確認してください。</div>` : ''}
      ${blocks.map((b, i) => `<div class="ce-block ${b.state}" data-u="${b.uid}">
        <div class="ce-bar"><b>${esc(blockLabel(b.state === 'deleted' ? (b.orig || b.text) : b.text))}</b> ${mark(b)}
          <span class="ce-tools">
            ${b.state === 'deleted' ? `<button class="btn" data-act="undel">元に戻す</button>` : `
            <button class="btn" data-act="edit">修正</button>
            <button class="btn" data-act="up" ${i === 0 ? 'disabled' : ''} title="上へ">↑</button>
            <button class="btn" data-act="down" ${i === blocks.length - 1 ? 'disabled' : ''} title="下へ">↓</button>
            <button class="btn" data-act="add" title="この下に条を追加">＋条</button>
            <button class="btn danger" data-act="del">削除</button>`}
            ${b.state !== 'deleted' && b.orig && !sameExceptNo(b.text, b.orig) ? `<button class="btn" data-act="revert">修正前に戻す</button>` : ''}
          </span></div>
        ${editing === b.uid ? `
          <textarea class="ce-ta" data-ta>${esc(b.text)}</textarea>
          <div class="row" style="gap:6px;margin-top:6px">
            ${b.isArt ? `<button class="btn" data-act="para">＋項を追加</button>` : ''}
            <button class="btn primary" data-act="done">修正を確定</button>
            <button class="btn ghost" data-act="cancel">やめる</button></div>
          <div class="muted" style="margin-top:6px">修正後の表示</div>
          <div class="diffbox" data-live>${view(b)}</div>`
        : `<div class="ce-text">${view(b)}</div>`}
      </div>`).join('')}`;
    container.querySelectorAll('[data-act]').forEach(btn => btn.onclick = () => act(+btn.closest('[data-u]').dataset.u, btn.dataset.act));
    const ta = container.querySelector('[data-ta]');
    if (ta) {
      const b = blocks.find(x => x.uid === editing);
      ta.oninput = () => { container.querySelector('[data-live]').innerHTML = view(b, ta.value); };
      ta.focus();
    }
  }
  function act(uid, a) {
    const i = blocks.findIndex(b => b.uid === uid), b = blocks[i];
    const ta = container.querySelector('[data-ta]');
    if (a === 'edit') { editing = uid; return draw(); }
    if (a === 'cancel') { editing = null; return draw(); }
    if (a === 'para') {
      const nums = (ta.value.match(/^[0-9０-９]+(?=[\s　])/mg) || []).map(toHalf).map(Number);
      ta.value = ta.value.replace(/\s+$/, '') + `\n${nums.length ? Math.max(...nums) + 1 : 2} `;
      ta.dispatchEvent(new Event('input')); ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length;
      return;
    }
    if (a === 'done') {
      const t = ta.value.replace(/^\n+|\s+$/g, '');
      if (!t) { b.state = 'deleted'; } else { b.isArt = ED_ART.test(t); b.raw = toRaw(t, b); }
      editing = null;
    }
    if (a === 'revert') { b.isArt = ED_ART.test(b.orig); b.raw = toRaw(b.orig, b); }
    if (a === 'del') { if (b.state === 'added' && !b.orig) blocks.splice(i, 1); else b.state = 'deleted'; }
    if (a === 'undel') { b.state = 'keep'; }
    if (a === 'up' && i > 0) [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]];
    if (a === 'down' && i < blocks.length - 1) [blocks[i + 1], blocks[i]] = [blocks[i], blocks[i + 1]];
    if (a === 'add') {
      const nb = { uid: ++edUid, orig: '', state: 'added', isArt: true };
      nb.raw = `第⟦${nb.uid}⟧条（見出し）\n本文を入力してください。`;
      blocks.splice(i + 1, 0, nb); editing = nb.uid;
    }
    refresh(); draw(); emit();
  }

  init(body); draw();
  return {
    // 全文編集など外から本文が変わったとき（keepOrig：修正前の文章との比較を保つ）
    setBody(t, keepOrig) {
      const prev = keepOrig ? blocks.filter(b => b.orig).map(b => ({ text: b.orig, used: false })) : null;
      init(t);
      if (prev) {
        blocks.forEach(b => {
          const lb = blockLabel(b.text).replace(/第[0-9０-９]+条/, '');
          const hit = prev.find(o => !o.used && (sameExceptNo(o.text, b.text) || (b.isArt && ED_ART.test(o.text) && blockLabel(o.text).replace(/第[0-9０-９]+条/, '') === lb)));
          if (hit) { hit.used = true; b.orig = hit.text; } else { b.orig = ''; b.state = 'added'; }
        });
        prev.filter(o => !o.used).forEach(o => blocks.push({ uid: ++edUid, text: o.text, orig: o.text, raw: o.text, state: 'deleted', isArt: ED_ART.test(o.text), lastNo: ED_ART.test(o.text) ? toHalf(o.text.match(ED_ART)[1]) : '' }));
        refresh();
      }
      editing = null; draw();
    },
    // 修正案の取り込み：original を含むかたまりを revised に置き換える
    apply(original, revised) {
      if (!original) return false;
      let b = blocks.find(x => x.state !== 'deleted' && x.text.includes(original)), t;
      if (b) t = b.text.replace(original, () => revised);
      else {   // 改行・空白の違いを無視して探す
        const re = new RegExp(Array.from(original.replace(/\s+/g, '')).map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'));
        b = blocks.find(x => x.state !== 'deleted' && re.test(x.text));
        if (!b) return false;
        t = b.text.replace(re, () => revised);
      }
      b.isArt = ED_ART.test(t); b.raw = toRaw(t, b); refresh(); draw(); emit(); return true;
    },
    // 条を最後の条の後ろに追加（追加として青字で表示）
    addArticle(title, text) {
      let last = -1; blocks.forEach((b, i) => { if (b.isArt && b.state !== 'deleted') last = i; });
      const nb = { uid: ++edUid, orig: '', state: 'added', isArt: true };
      nb.raw = toRaw(`第1条（${title}）\n${text}`, nb);
      blocks.splice(last + 1, 0, nb); refresh(); draw(); emit();
    },
    changes() { return blocks.filter(isChanged).length; },
    text: bodyText
  };
}
