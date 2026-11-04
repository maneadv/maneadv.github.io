/**
 * 電子契約システム メール送信・リーガルチェック用（Google Apps Script）
 *
 * 使い方は「手順書.md」の「2. メール送信の準備（Gmail）」を参照。
 * 1) このファイルの中身を全部、Apps Script の編集画面に貼り付けて保存
 * 2) 上の関数選択で「初期設定」を選び「実行」→ 表示される合言葉を控える
 * 3) 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *    実行ユーザー：自分 ／ アクセスできるユーザー：全員 → デプロイ
 */

// 電子契約のデータベース（公開して問題のない接続先と公開用の鍵。ログイン中の利用者の確認に使う）
const SB_URL_ = 'https://lguiucikcybrsojooagj.supabase.co';
const SB_ANON_ = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxndWl1Y2lrY3licnNvam9vYWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMjQ1NzIsImV4cCI6MjEwODcwMDU3Mn0.Azy2ib3T-E7I3wRfbV__vNrG5-pDS0vocO_nJKMNji0';

// ① 最初に1回だけ実行：合言葉を作って保存し、画面下の「実行ログ」に表示
function 初期設定() {
  const props = PropertiesService.getScriptProperties();
  const make = () => Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  let secret = props.getProperty('SECRET');
  if (!secret) { secret = make(); props.setProperty('SECRET', secret); }
  // Gmail 送信と外部への通信の許可を求める画面を出すための呼び出し
  const left = MailApp.getRemainingDailyQuota();
  try { UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true }); } catch (e) { }
  console.log('メール送信の合言葉（Supabase に登録）：' + secret);
  console.log('本日あと送れる通数：' + left);
  console.log('Gemini の鍵：' + (props.getProperty('GEMINI_KEY') ? '登録済み' : '未登録（プロジェクトの設定 → スクリプト プロパティ に GEMINI_KEY を追加）'));
}

// リーガルチェックの動作確認（Gemini の鍵が正しいか）
function AI動作確認() {
  const r = callGemini_([{ text: '「動作確認OK」とだけ返してください。' }], null);
  console.log('使ったモデル：' + r.model + ' ／ 応答：' + r.text);
}

// ② 動作確認用：自分宛てにテストメールを1通送る
function テスト送信() {
  const me = Session.getActiveUser().getEmail();
  MailApp.sendEmail({
    to: me,
    subject: '【電子契約】メール送信テスト',
    htmlBody: '<p>電子契約システムのメール送信設定は正常です。</p>',
    name: '電子契約'
  });
  console.log(me + ' 宛に送信しました。本日あと送れる通数：' + MailApp.getRemainingDailyQuota());
}

// 合言葉を作り直したい時だけ実行（実行後は Supabase 側も登録し直す）
function 合言葉を作り直す() {
  PropertiesService.getScriptProperties().deleteProperty('SECRET');
  初期設定();
}

// 電子契約システムからの依頼を受け付ける（メール送信／リーガルチェック）
function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (req.action === 'legal_check') return reply(legalCheck_(req));
    const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || req.secret !== secret) return reply({ ok: false, error: '合言葉が違います' });

    const to = String(req.to || '').trim();
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) return reply({ ok: false, error: '宛先が正しくありません' });
    if (MailApp.getRemainingDailyQuota() < 1) return reply({ ok: false, error: '本日の送信上限に達しました' });

    const opt = {
      to: to,
      subject: String(req.subject || '').slice(0, 250),
      htmlBody: String(req.html || ''),
      name: String(req.name || '電子契約').slice(0, 80)
    };
    if (req.reply_to) opt.replyTo = String(req.reply_to);
    MailApp.sendEmail(opt);
    return reply({ ok: true, left: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

// ===== リーガルチェック =====
const MODELS_ = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.6-flash'];

function callGemini_(parts, schema) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('GEMINI_KEY');
  if (!key) throw new Error('Gemini の鍵が登録されていません（スクリプト プロパティ GEMINI_KEY）');
  // 前回うまく動いたモデルを最初に試す（混雑しているモデルで待たされないように）
  const base = [props.getProperty('MODEL'), props.getProperty('MODEL_OK')].concat(MODELS_).filter(Boolean)
    .filter((m, i, a) => a.indexOf(m) === i);
  const models = base.concat(base);   // 混雑時に備えて一巡したらもう一度
  const started = Date.now();
  const cfg = { temperature: 0.2 };
  if (schema) { cfg.responseMimeType = 'application/json'; cfg.responseSchema = schema; }
  let last = '';
  for (const m of models) {
    if (Date.now() - started > 240000) break;   // 4分を過ぎたら打ち切る（Apps Script の上限は6分）
    const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-goog-api-key': key },
      payload: JSON.stringify({ contents: [{ role: 'user', parts: parts }], generationConfig: cfg })
    });
    const code = res.getResponseCode(), body = res.getContentText();
    if (code === 404) { last = m + ' が見つかりません'; continue; }   // モデル名が変わった場合は次を試す
    if (code === 429 || code === 500 || code === 503) {                // 混雑・一時的な不調は少し待って次のモデルへ
      last = m + ' が混み合っています（' + code + '）';
      if (props.getProperty('MODEL_OK') === m) props.deleteProperty('MODEL_OK');
      Utilities.sleep(1500); continue;
    }
    if (code !== 200) throw new Error('Gemini の呼び出しに失敗しました（' + code + '）：' + body.slice(0, 300));
    const j = JSON.parse(body);
    const text = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || '').join('');
    if (!text) throw new Error('Gemini から応答がありませんでした（' + JSON.stringify(j.promptFeedback || {}) + '）');
    if (props.getProperty('MODEL_OK') !== m) props.setProperty('MODEL_OK', m);
    return { model: m, text: text };
  }
  throw new Error('AI が混み合っているか、使えるモデルがありません。少し時間をおいてお試しください（' + last + '）');
}

const LEGAL_SCHEMA_ = {
  type: 'OBJECT',
  properties: {
    contract_type: { type: 'STRING' },
    parties: { type: 'OBJECT', properties: { ko: { type: 'STRING' }, otsu: { type: 'STRING' } } },
    risk: { type: 'STRING', enum: ['高', '中', '低'] },
    summary: { type: 'STRING' },
    good_points: { type: 'ARRAY', items: { type: 'STRING' } },
    findings: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      location: { type: 'STRING' }, title: { type: 'STRING' }, level: { type: 'STRING', enum: ['高', '中', '低'] },
      issue: { type: 'STRING' }, merit: { type: 'STRING' }, demerit: { type: 'STRING' }, measure: { type: 'STRING' },
      original: { type: 'STRING' }, revised: { type: 'STRING' } },
      required: ['location', 'title', 'level', 'issue', 'demerit', 'measure', 'original', 'revised'] } },
    missing: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      title: { type: 'STRING' }, reason: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['title', 'reason', 'text'] } },
    negotiation: { type: 'ARRAY', items: { type: 'STRING' } },
    full_text: { type: 'STRING' }
  },
  required: ['contract_type', 'risk', 'summary', 'findings', 'missing', 'negotiation']
};

// ログイン中の利用者本人か、所属企業の今月の回数が残っているかをデータベースで確認（1回分を使う）
function useQuota_(token, org) {
  if (!token || !org) return 'ログインし直してください';
  const res = UrlFetchApp.fetch(SB_URL_ + '/rest/v1/rpc/ai_quota_use', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SB_ANON_, Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ p_org: org })
  });
  if (res.getResponseCode() === 200) return '';
  let msg = '';
  try { msg = JSON.parse(res.getContentText()).message || ''; } catch (e) { }
  if (res.getResponseCode() === 401 || /JWT/i.test(msg)) return 'ログインの有効期限が切れました。画面を読み込み直してください';
  return msg || '利用できませんでした（' + res.getResponseCode() + '）';
}

function legalCheck_(req) {
  const ng = useQuota_(String(req.token || ''), String(req.org || ''));
  if (ng) return { ok: false, error: ng };
  const side = String(req.side || '').slice(0, 50), role = String(req.role || '').slice(0, 50);
  const our = String(req.our_name || '').slice(0, 100), focus = String(req.focus || '').slice(0, 500);
  const needText = !req.text;
  const prompt = [
    'あなたは日本の企業法務に精通した契約書レビューの専門家です。次の契約書を、依頼者の立場から確認してください。',
    '',
    '【依頼者の立場】' + (side ? side : '本文から判断') + (role ? '（' + role + '）' : '') + (our ? '／依頼者の名称：' + our : ''),
    focus ? '【特に重視する点】' + focus : '',
    '',
    '【確認の方法】',
    '・依頼者にとって不利な条項、曖昧で争いになりやすい条項、一方的な条項、法令（民法、消費者契約法、下請法、独占禁止法、個人情報保護法、古物営業法、労働基準法、労働契約法、パートタイム・有期雇用労働法、フリーランス法、利息制限法、出資法、貸金業法、会社法など該当するもの）に照らして問題のある条項を指摘する。',
    '・各指摘には、location（例：第5条第2項）、title（短い見出し）、level（高・中・低）、issue（何が問題か）、merit（その条項が依頼者にとって有利に働く点。なければ空）、demerit（依頼者にとってのリスク）、measure（交渉や実務での対応策）を書く。',
    '・original には、修正すべき部分を契約書本文から一字一句そのまま抜き出す（改行や空白も本文どおり。1つの条の中で、修正に必要な最小限かつ本文中で一意になる範囲）。revised には original を置き換える修正後の文章を書く。依頼者に有利で、かつ相手が受け入れ得る現実的な文言にする。',
    '・契約書にない方がよい条項の削除を勧める場合、revised は空文字にする。',
    '・依頼者を守るために入れるべき条項が欠けていれば missing に、title・reason・text（そのまま追加できる条文案。「第○条（見出し）」は付けない）を書く。',
    '・good_points には依頼者にとって良い点を、negotiation には交渉の進め方の要点を書く。',
    '・risk は契約全体の依頼者にとってのリスク度、summary は全体の総評（3〜5文）。',
    '・parties には本文から読み取れる甲・乙の名称、contract_type には契約の種類を書く。',
    needText ? '・full_text には、添付された契約書の本文を一字一句そのまま文字に起こして書く（条ごとに空行を入れる）。original は必ずこの full_text から抜き出す。' : '・full_text は空にする。',
    '・本文にない事実を推測で補わない。すべて日本語で書く。'
  ].filter(Boolean).join('\n');
  const parts = [{ text: prompt }];
  if (req.text) parts.push({ text: '【契約書本文】\n' + String(req.text).slice(0, 300000) });
  else if (req.file && req.file.data) parts.push({ inline_data: { mime_type: req.file.mime || 'application/pdf', data: req.file.data } });
  else return { ok: false, error: '契約書の本文またはファイルがありません' };
  const r = callGemini_(parts, LEGAL_SCHEMA_);
  let result;
  try { result = JSON.parse(r.text); } catch (e) { return { ok: false, error: 'AI の応答を読み取れませんでした。もう一度お試しください' }; }
  return { ok: true, model: r.model, result: result };
}

// 開いた時の表示（動作確認用。合言葉などは表示しない）
function doGet() {
  return reply({ ok: true, service: '電子契約 メール送信' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
