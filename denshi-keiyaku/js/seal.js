// ===== 印影の作成（丸印・角印）と手書き署名パッド =====
const SEAL_RED = '#c8102e';

// 丸印：氏名（最大4文字）を縦書きで配置
function makeRoundSeal(text) {
  const chars = Array.from((text || '').replace(/\s/g, '')).slice(0, 4);
  const S = 360, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.strokeStyle = g.fillStyle = SEAL_RED;
  g.lineWidth = 14;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 12, 0, Math.PI * 2); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const font = s => `800 ${s}px "Noto Serif JP","Hiragino Mincho ProN","Yu Mincho",serif`;
  const n = chars.length;
  if (n === 1) { g.font = font(190); g.fillText(chars[0], S / 2, S / 2 + 6); }
  else if (n === 2) { g.font = font(130); g.fillText(chars[0], S / 2, S / 2 - 70); g.fillText(chars[1], S / 2, S / 2 + 78); }
  else if (n === 3) { g.font = font(92); [-98, 4, 106].forEach((y, i) => g.fillText(chars[i], S / 2, S / 2 + y)); }
  else if (n === 4) {
    // 右列→左列の順に縦書き
    g.font = font(118);
    const pos = [[1, 0], [1, 1], [0, 0], [0, 1]];
    chars.forEach((ch, i) => g.fillText(ch, S / 2 + (pos[i][0] ? 62 : -62), S / 2 + (pos[i][1] ? 66 : -60)));
  }
  roughen(g, S);
  return cv.toDataURL('image/png');
}

// 角印：会社名（最大20文字）を右から縦書きで格子状に配置
function makeSquareSeal(text) {
  let chars = Array.from((text || '').replace(/\s/g, '')).slice(0, 18);
  if (chars.length && chars.length <= 16 && chars.slice(-2).join('') !== '之印') chars = chars.concat(['之', '印']);
  const S = 360, pad = 34, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.strokeStyle = g.fillStyle = SEAL_RED;
  g.lineWidth = 14; g.strokeRect(10, 10, S - 20, S - 20);
  g.lineWidth = 4; g.strokeRect(24, 24, S - 48, S - 48);
  const n = Math.max(chars.length, 1);
  const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  const cw = (S - pad * 2) / cols, rh = (S - pad * 2) / rows;
  const fs = Math.min(cw, rh) * 0.86;
  g.font = `800 ${fs}px "Noto Serif JP","Hiragino Mincho ProN","Yu Mincho",serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  chars.forEach((ch, i) => {
    const col = Math.floor(i / rows), row = i % rows;
    // 最後の列は文字数が少なければ上下中央に寄せる
    const inCol = Math.min(rows, n - col * rows), off = (rows - inCol) * rh / 2;
    const x = S - pad - cw * (col + 0.5), y = pad + off + rh * (row + 0.5) + fs * 0.04;
    g.save(); g.translate(x, y); g.scale(cw / Math.min(cw, rh), rh / Math.min(cw, rh)); g.fillText(ch, 0, 0); g.restore();
  });
  roughen(g, S);
  return cv.toDataURL('image/png');
}

// 朱肉のかすれ感を少し加える
function roughen(g, S) {
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) {
    g.globalAlpha = Math.random() * 0.5;
    g.beginPath(); g.arc(Math.random() * S, Math.random() * S, Math.random() * 2.2, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

// 手書き署名パッド
function makePad(canvas) {
  const g = canvas.getContext('2d');
  let drawing = false, last = null, strokes = 0;
  function fit() {
    const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#111'; g.lineWidth = 2.8;
    strokes = 0;
  }
  const pt = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); drawing = true; last = pt(e); canvas.setPointerCapture(e.pointerId); pad.onstart && pad.onstart(); });
  canvas.addEventListener('pointermove', e => {
    if (!drawing) return; e.preventDefault();
    const p = pt(e); g.beginPath(); g.moveTo(last.x, last.y); g.lineTo(p.x, p.y); g.stroke(); last = p; strokes++;
  });
  const end = () => { drawing = false; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  const pad = {
    fit, clear() { g.clearRect(0, 0, canvas.width, canvas.height); strokes = 0; },
    isEmpty() { return strokes < 8; },
    toPng() {
      // 余白を切り詰めて書き出し
      const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
      let x0 = canvas.width, y0 = canvas.height, x1 = 0, y1 = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (d[(y * canvas.width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 <= x0) return null;
      const m = 12, w = x1 - x0 + m * 2, h = y1 - y0 + m * 2;
      const k = Math.min(1, 700 / w, 300 / h);
      const out = document.createElement('canvas'); out.width = Math.round(w * k); out.height = Math.round(h * k);
      out.getContext('2d').drawImage(canvas, x0 - m, y0 - m, w, h, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    }
  };
  fit();
  return pad;
}
