-- =====================================================================
-- v3：電子帳簿保存法の検索項目／アクセスコード（別経路の2要素）／
--     リーガルチェック回数は成功時のみ計上
-- tenants.sql の後に実行する。何度実行しても壊れない。
-- =====================================================================

-- 1. 取引情報（電子帳簿保存法の検索要件：取引年月日・取引金額・取引先）
alter table public.contracts add column if not exists deal_date date;
alter table public.contracts add column if not exists amount numeric(15, 0);
alter table public.contracts add column if not exists counterparty text;
create index if not exists contracts_deal_idx on public.contracts(org_id, deal_date);
create index if not exists contracts_amount_idx on public.contracts(org_id, amount);

-- 2. アクセスコード（発行者が電話・対面など、メール以外の手段で伝えるコード）
alter table public.contracts add column if not exists require_access_code boolean not null default false;
alter table public.contracts add column if not exists access_code_hash text;
alter table public.contracts add column if not exists access_attempts int not null default 0;

-- タイムスタンプ（締結した文書のハッシュ値に、第三者の時刻認証局が時刻を付けた証明）
alter table public.contracts add column if not exists ts_token text;          -- 時刻認証局の応答（RFC 3161 形式、base64）
alter table public.contracts add column if not exists ts_at timestamptz;      -- 認証された時刻
alter table public.contracts add column if not exists ts_tsa text;            -- 時刻認証局の名前
alter table public.contracts add column if not exists ts_requested_at timestamptz;

-- 取引情報は締結後も「未入力の項目を埋める」ことだけ許可（入力済みの値は変更不可）。
-- アクセスコードは画面から直接書き換えさせない（専用の操作でだけ設定）。
create or replace function public.contracts_v3_guard() returns trigger
language plpgsql set search_path = public as $$
declare client boolean := current_user in ('authenticated', 'anon');
begin
  if client and coalesce(current_setting('dk.code_ok', true), '') <> '1' then
    if tg_op = 'INSERT' then
      new.access_code_hash := null; new.access_attempts := 0;
    elsif (new.access_code_hash, new.access_attempts) is distinct from (old.access_code_hash, old.access_attempts) then
      raise exception 'アクセスコードは専用の画面から設定してください';
    end if;
    if tg_op = 'INSERT' then
      new.ts_token := null; new.ts_at := null; new.ts_tsa := null; new.ts_requested_at := null;
    elsif (new.ts_token, new.ts_at, new.ts_tsa, new.ts_requested_at) is distinct from (old.ts_token, old.ts_at, old.ts_tsa, old.ts_requested_at) then
      raise exception 'タイムスタンプは変更できません';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.status not in ('draft', 'review') then
    if new.require_access_code is distinct from old.require_access_code then
      raise exception '本契約書の送信後はアクセスコードの設定を変更できません';
    end if;
    if (old.deal_date is not null and new.deal_date is distinct from old.deal_date)
       or (old.amount is not null and new.amount is distinct from old.amount)
       or (coalesce(old.counterparty, '') <> '' and new.counterparty is distinct from old.counterparty) then
      raise exception '送信後の取引情報は、入力済みの値を変更できません（訂正・削除の防止）';
    end if;
  end if;
  if new.amount is not null and new.amount < 0 then raise exception '取引金額が正しくありません'; end if;
  new.counterparty := nullif(left(trim(coalesce(new.counterparty, '')), 200), '');
  return new;
end $$;
drop trigger if exists contracts_v3_guard_trg on public.contracts;
create trigger contracts_v3_guard_trg before insert or update on public.contracts
  for each row execute function public.contracts_v3_guard();

-- 発行者がアクセスコードを設定（空なら解除）。コードそのものは保存せず、照合用の値だけ残す
create or replace function public.admin_set_access_code(p_id uuid, p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare c public.contracts; code text := trim(coalesce(p_code, ''));
begin
  select * into c from public.contracts where id = p_id for update;
  if not found or not public.in_org(c.org_id) then raise exception '契約が見つかりません'; end if;
  if c.status not in ('draft', 'review') then raise exception '本契約書の送信後は変更できません'; end if;
  if code <> '' and (length(code) < 4 or length(code) > 32) then
    raise exception 'アクセスコードは4〜32文字にしてください';
  end if;
  perform set_config('dk.code_ok', '1', true);
  update public.contracts set
    require_access_code = code <> '',
    access_code_hash = case when code = '' then null else public.sha256_hex(c.id::text || ':' || code) end,
    access_attempts = 0
  where id = p_id;
  perform public.add_log(p_id, case when code = '' then 'access_code_off' else 'access_code_set' end, '{}'::jsonb);
  return json_build_object('ok', true, 'on', code <> '');
end $$;

-- 署名画面の情報にアクセスコードの要否を追加
create or replace function public.sign_get(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare c public.contracts;
begin
  c := public._sign_find(p_token);
  return json_build_object(
    'contract_no', c.contract_no, 'title', c.title,
    'company', c.company_snapshot ->> 'name', 'color', c.company_snapshot ->> 'color',
    'logo', coalesce(c.company_snapshot ->> 'logo', ''), 'require_otp', c.require_otp,
    'require_access_code', c.require_access_code,
    'signer_name', c.signer_name, 'email_masked', public.mask_email(c.signer_email),
    'status', c.status, 'draft_result', c.draft_result, 'expires', c.token_expires_at);
end $$;

-- URLを開く（アクセスコードが必要な契約はコードを照合。10回間違えるとロック）
drop function if exists public.sign_open(text);
create or replace function public.sign_open(p_token text, p_code text default null) returns json
language plpgsql security definer set search_path = public as $$
declare c public.contracts; sess text;
begin
  c := public._sign_find(p_token);
  if c.require_otp then raise exception 'この契約書は確認コードによる本人確認が必要です'; end if;
  if c.require_access_code then
    if c.access_attempts >= 10 then
      raise exception 'アクセスコードの入力回数が上限に達しました。発行元にご連絡ください';
    end if;
    if coalesce(trim(p_code), '') = '' then raise exception 'アクセスコードを入力してください'; end if;
    if public.sha256_hex(c.id::text || ':' || trim(p_code)) <> c.access_code_hash then
      perform set_config('dk.code_ok', '1', true);
      update public.contracts set access_attempts = access_attempts + 1 where id = c.id;
      perform public.add_log(c.id, 'access_code_failed', '{}'::jsonb, '署名者');
      -- 例外にすると回数の記録まで取り消されるため、結果として返す
      return json_build_object('ok', false, 'error', 'アクセスコードが違います（残り' || (9 - c.access_attempts) || '回）');
    end if;
  end if;
  sess := public.rand_hex(32);
  perform set_config('dk.code_ok', '1', true);
  update public.contracts set
    session_hash = public.sha256_hex(sess), session_expires_at = now() + interval '12 hours',
    access_attempts = 0,
    status = case when status = 'sent' then 'viewed' else status end
  where id = c.id;
  perform public.add_log(c.id, case when c.require_access_code then 'access_code_ok' else 'link_opened' end,
    jsonb_build_object('email', public.mask_email(c.signer_email)), '署名者');
  return json_build_object('ok', true, 'session', sess);
end $$;

-- 締結記録（証明書）にアクセスコードによる確認も残す
create or replace function public._sign_payload(c public.contracts) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', c.id, 'contract_no', c.contract_no, 'title', c.title, 'body', c.body,
    'company_snapshot', c.company_snapshot, 'signer_name', c.signer_name,
    'signer_email', c.signer_email, 'status', c.status, 'expires', c.token_expires_at,
    'draft_result', c.draft_result, 'draft_comment', c.draft_comment, 'draft_changes', c.draft_changes,
    'fields', c.fields, 'field_values', c.field_values, 'attachments', c.attachments,
    'files', (select coalesce(json_agg(json_build_object('id', f.id, 'req_key', f.req_key, 'name', f.name,
                'mime', f.mime, 'size', f.size, 'sha256', f.sha256, 'created_at', f.created_at)
                order by f.created_at, f.id), '[]'::json)
              from public.contract_files f where f.contract_id = c.id),
    'typed_name', c.typed_name, 'seal_type', c.seal_type, 'signature_png', c.signature_png,
    'signed_at', c.signed_at, 'signer_ip', c.signer_ip, 'doc_hash', c.doc_hash, 'sent_at', c.sent_at,
    'ts_at', c.ts_at, 'ts_tsa', c.ts_tsa,
    'logs', case when c.status = 'signed' then (
      select coalesce(json_agg(json_build_object('event', l.event, 'created_at', l.created_at,
             'ip', l.ip, 'actor', case when l.actor = '署名者' then '署名者' else '発行者' end)
             order by l.id), '[]'::json)
      from public.audit_logs l where l.contract_id = c.id
        and l.event in ('created','draft_sent','draft_approved','draft_changes','sent','resent',
                        'verified','link_opened','access_code_ok','file_uploaded','signed','timestamped')) else '[]'::json end);
$$;

-- 3. リーガルチェック：まず残り回数の確認だけ（p_commit=false）、成功したら1回分を計上（p_commit=true）
create or replace function public.ai_quota_use(p_org uuid, p_commit boolean) returns json
language plpgsql security definer set search_path = public as $$
declare o public.orgs; lim int; n int;
begin
  if not public.in_org(p_org) then raise exception '権限がありません'; end if;
  select * into o from public.orgs where id = p_org;
  lim := nullif(public.get_setting(case when o.plan = 'paid' then 'paid_ai_limit' else 'free_ai_limit' end), '')::int;
  insert into public.ai_usage(org_id, month, count) values (p_org, public.month_jst(), 0) on conflict do nothing;
  select count into n from public.ai_usage where org_id = p_org and month = public.month_jst() for update;
  if not p_commit then
    if lim is not null and n >= lim then
      raise exception '今月のリーガルチェックの上限（%回）に達しました', lim;
    end if;
    return json_build_object('ok', true, 'used', n, 'limit', lim);
  end if;
  update public.ai_usage set count = count + 1 where org_id = p_org and month = public.month_jst();
  return json_build_object('ok', true, 'used', n + 1, 'limit', lim);
end $$;

-- 4. 実行権限
revoke all on function public.admin_set_access_code(uuid, text) from public, anon;
grant execute on function public.admin_set_access_code(uuid, text) to authenticated;
revoke all on function public.sign_open(text, text) from public;
grant execute on function public.sign_open(text, text) to anon, authenticated;
revoke all on function public.ai_quota_use(uuid, boolean) from public, anon;
grant execute on function public.ai_quota_use(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 5. タイムスタンプ：締結したら自動で時刻認証局に依頼（Apps Script 経由）
-- ---------------------------------------------------------------------
create or replace function public._request_timestamp(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare gurl text; gsec text; c public.contracts;
begin
  select * into c from public.contracts where id = p_id;
  if not found or c.status <> 'signed' or c.doc_hash is null or c.ts_token is not null then return; end if;
  select decrypted_secret into gurl from vault.decrypted_secrets where name = 'gas_mail_url' limit 1;
  select decrypted_secret into gsec from vault.decrypted_secrets where name = 'gas_mail_secret' limit 1;
  if coalesce(gurl, '') = '' or coalesce(gsec, '') = '' then return; end if;
  perform set_config('dk.code_ok', '1', true);
  update public.contracts set ts_requested_at = now() where id = p_id;
  perform net.http_post(
    url := gurl,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('action', 'timestamp', 'secret', gsec, 'id', p_id, 'hash', c.doc_hash),
    timeout_milliseconds := 30000);
end $$;

create or replace function public.contracts_after_signed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'signed' and old.status is distinct from 'signed' and new.doc_hash is not null then
    begin perform public._request_timestamp(new.id); exception when others then null; end;   -- 失敗しても締結は止めない
  end if;
  return null;
end $$;
drop trigger if exists contracts_after_signed_trg on public.contracts;
create trigger contracts_after_signed_trg after update on public.contracts
  for each row execute function public.contracts_after_signed();

-- Apps Script が受け取ったタイムスタンプを保存（合言葉で確認。文書ハッシュが一致する場合だけ）
create or replace function public.ts_store(p_id uuid, p_hash text, p_token text, p_tsa text, p_time timestamptz, p_secret text) returns json
language plpgsql security definer set search_path = public as $$
declare gsec text; c public.contracts;
begin
  select decrypted_secret into gsec from vault.decrypted_secrets where name = 'gas_mail_secret' limit 1;
  if coalesce(gsec, '') = '' or coalesce(p_secret, '') <> gsec then raise exception '合言葉が違います'; end if;
  select * into c from public.contracts where id = p_id for update;
  if not found or c.status <> 'signed' or c.doc_hash is distinct from lower(p_hash) then raise exception '対象の契約が正しくありません'; end if;
  if c.ts_token is not null then return json_build_object('ok', true, 'already', true); end if;
  if length(coalesce(p_token, '')) < 100 or length(p_token) > 40000 or p_token !~ '^[A-Za-z0-9+/=]+$' then
    raise exception 'タイムスタンプの形式が正しくありません';
  end if;
  perform set_config('dk.code_ok', '1', true);
  update public.contracts set ts_token = p_token, ts_tsa = left(coalesce(p_tsa, ''), 100), ts_at = coalesce(p_time, now()) where id = p_id;
  perform public.add_log(p_id, 'timestamped', jsonb_build_object('tsa', p_tsa, 'time', p_time), 'システム');
  return json_build_object('ok', true);
end $$;

-- 取れていない場合に管理画面から再依頼
create or replace function public.admin_request_timestamp(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare c public.contracts;
begin
  c := public._contract_for_me(p_id);
  if c.status <> 'signed' then raise exception '締結済みの契約だけが対象です'; end if;
  if c.ts_token is not null then return json_build_object('ok', true, 'already', true); end if;
  if c.ts_requested_at is not null and c.ts_requested_at > now() - interval '1 minute' then
    raise exception '依頼中です。1分ほどおいてから画面を更新してください';
  end if;
  perform public._request_timestamp(p_id);
  return json_build_object('ok', true);
end $$;

revoke all on function public._request_timestamp(uuid) from public, anon, authenticated;
revoke all on function public.contracts_after_signed() from public, anon, authenticated;
revoke all on function public.ts_store(uuid, text, text, text, timestamptz, text) from public;
grant execute on function public.ts_store(uuid, text, text, text, timestamptz, text) to anon;
revoke all on function public.admin_request_timestamp(uuid) from public, anon;
grant execute on function public.admin_request_timestamp(uuid) to authenticated;
