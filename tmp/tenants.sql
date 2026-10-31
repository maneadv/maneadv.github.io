-- =====================================================================
-- 複数企業での利用（新規登録 → 運営の承認 → 企業ごとの自社ページ）
-- schema.sql の後に実行する。何度実行しても壊れない。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 表
-- ---------------------------------------------------------------------

-- 利用企業
create table if not exists public.orgs (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text unique not null,              -- 会社ごとのアドレス（?c=slug）
  status         text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'rejected')),
  plan           text not null default 'free' check (plan in ('free', 'paid')),
  monthly_limit  int,                               -- 個別の送信上限（空ならプランの標準）
  contact_name   text default '',
  contact_email  text default '',
  tel            text default '',
  address        text default '',
  representative text default '',
  website        text default '',
  note           text default '',                   -- 申込み時の利用目的など
  logo           text default '',                   -- 画像（data URL、200KBまで）
  color          text default '#E8740C',
  status_reason  text default '',
  created_at     timestamptz default now(),
  approved_at    timestamptz,
  approved_by    text
);

-- 企業の担当者（role：admin＝企業の管理者／member＝担当者）
create table if not exists public.org_members (
  org_id     uuid not null references public.orgs(id) on delete cascade,
  email      text not null,
  name       text default '',
  role       text not null default 'member' check (role in ('admin', 'member')),
  status     text not null default 'active' check (status in ('active', 'invited')),
  invited_by text,
  created_at timestamptz default now(),
  primary key (org_id, email)
);
create index if not exists org_members_email_idx on public.org_members(lower(email));

-- 新規登録時のメールアドレス確認（このシステムのメールで確認コードを送る）
create table if not exists public.account_verifications (
  email        text primary key,
  code_hash    text,
  expires_at   timestamptz,
  attempts     int not null default 0,
  sent_count   int not null default 0,
  last_sent_at timestamptz,
  day          date,
  verified_at  timestamptz
);

-- リーガルチェックの利用回数（企業・月ごと）
create table if not exists public.ai_usage (
  org_id uuid not null references public.orgs(id) on delete cascade,
  month  text not null,
  count  int not null default 0,
  primary key (org_id, month)
);

-- プランの標準値
insert into public.app_settings(key, value) values
  ('free_monthly_limit', '5'),     -- 無料プラン：1か月に送信できる契約の件数
  ('paid_monthly_limit', ''),      -- 有料プラン：空なら上限なし
  ('free_ai_limit', '3'),          -- 無料プラン：1か月のリーガルチェック回数
  ('paid_ai_limit', '100'),        -- 有料プラン：1か月のリーガルチェック回数
  ('operator_name', '株式会社マネージメントアドバイザーズ')
on conflict (key) do nothing;

-- 既存の表に企業の列を追加
alter table public.companies add column if not exists org_id uuid references public.orgs(id) on delete cascade;
alter table public.templates add column if not exists org_id uuid references public.orgs(id) on delete cascade;  -- 空＝全企業共通
alter table public.contracts add column if not exists org_id uuid references public.orgs(id);
-- 受け取る人の確認コード（既定はなし：メールで届いたURLを開くだけで契約できる）
alter table public.contracts add column if not exists require_otp boolean not null default false;
alter table public.templates add column if not exists require_otp boolean not null default false;
alter table public.intakes   add column if not exists org_id uuid references public.orgs(id) on delete cascade;
create index if not exists companies_org_idx on public.companies(org_id);
create index if not exists templates_org_idx on public.templates(org_id);
create index if not exists contracts_org_idx on public.contracts(org_id);
create index if not exists intakes_org_idx   on public.intakes(org_id);

-- ---------------------------------------------------------------------
-- 2. 既存データの移行（運営会社を最初の利用企業にする）
-- ---------------------------------------------------------------------
do $$
declare o uuid;
begin
  select id into o from public.orgs where slug = 'ma';
  if o is null then
    insert into public.orgs(name, slug, status, plan, approved_at, approved_by, color)
    values (coalesce(nullif((select value from public.app_settings where key = 'operator_name'), ''), '運営会社'),
            'ma', 'active', 'paid', now(), 'system', '#1F3A5F')
    returning id into o;
  end if;
  insert into public.org_members(org_id, email, name, role, status)
  select o, lower(email), coalesce(name, ''), 'admin', 'active' from public.staff_members
  on conflict (org_id, email) do nothing;
  update public.companies set org_id = o where org_id is null;
  update public.contracts set org_id = o where org_id is null;
  update public.intakes   set org_id = o where org_id is null;
  -- 雛形は「全企業共通」（org_id 空）のまま残す
  insert into public.account_verifications(email, verified_at)
  select lower(email), now() from public.staff_members on conflict (email) do nothing;
end $$;

alter table public.companies alter column org_id set not null;
alter table public.contracts alter column org_id set not null;
alter table public.intakes   alter column org_id set not null;

-- ---------------------------------------------------------------------
-- 3. 判定用の関数
-- ---------------------------------------------------------------------

-- 運営（staff_members に登録された人）
create or replace function public.is_operator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_members
                  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- 自分が使える（承認済みの）企業
create or replace function public.my_org_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.org_id from public.org_members m join public.orgs o on o.id = m.org_id
   where lower(m.email) = public.my_email() and m.status = 'active' and o.status = 'active';
$$;

create or replace function public.in_org(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_org is not null and p_org in (select public.my_org_ids());
$$;

create or replace function public.is_org_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_members m join public.orgs o on o.id = m.org_id
                  where m.org_id = p_org and lower(m.email) = public.my_email()
                    and m.status = 'active' and m.role = 'admin' and o.status = 'active');
$$;

-- 互換：承認済みの企業に所属していれば「担当者」
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select public.my_org_ids());
$$;

create or replace function public.is_verified() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.account_verifications
                  where email = public.my_email() and verified_at is not null);
$$;

-- 今月（日本時間）
create or replace function public.month_jst() returns text
language sql stable as $$ select to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM') $$;

-- 企業の送信上限（null＝上限なし）
create or replace function public.org_send_limit(o public.orgs) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(o.monthly_limit,
    nullif(public.get_setting(case when o.plan = 'paid' then 'paid_monthly_limit' else 'free_monthly_limit' end), '')::int);
$$;

-- 今月送信した契約の件数（本契約書の初回送信を数える。再送・ドラフト確認は数えない）
create or replace function public.org_sent_this_month(p_org uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct l.contract_id)::int from public.audit_logs l join public.contracts c on c.id = l.contract_id
   where c.org_id = p_org and l.event = 'sent'
     and to_char(l.created_at at time zone 'Asia/Tokyo', 'YYYY-MM') = public.month_jst();
$$;

-- ---------------------------------------------------------------------
-- 4. 契約・会社・雛形の整合チェック（トリガー）
-- ---------------------------------------------------------------------
create or replace function public.contracts_before() returns trigger
language plpgsql set search_path = public as $$
declare client boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception '下書き以外の契約は削除できません（取消を使ってください）';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if client then
      new.status := 'draft';
      new.token := null; new.token_expires_at := null;
      new.otp_hash := null; new.otp_expires_at := null; new.otp_attempts := 0;
      new.otp_sent_count := 0; new.otp_last_sent_at := null;
      new.session_hash := null; new.session_expires_at := null;
      new.draft_result := null; new.draft_comment := null; new.draft_responded_at := null;
      new.draft_changes := '[]';
      new.field_values := '{}'; new.seal_type := null;
      new.typed_name := null; new.signature_png := null; new.signed_at := null;
      new.signer_ip := null; new.signer_ua := null; new.doc_hash := null; new.sent_at := null;
      new.created_by := auth.jwt() ->> 'email';
      new := jsonb_populate_record(new, '{"intake_id":null,"intake_ref":null,"intake_data":null}');
      if new.org_id is null then
        select org_id into new.org_id from public.companies where id = new.company_id;
      end if;
      if not public.in_org(new.org_id) then raise exception '権限がありません'; end if;
    end if;
    if not exists (select 1 from public.companies where id = new.company_id and org_id = new.org_id) then
      raise exception '発行会社が正しくありません';
    end if;
    select jsonb_build_object('name', c.name, 'address', c.address, 'representative', c.representative,
                              'email', c.email, 'color', c.color, 'logo', coalesce(o.logo, ''))
      into new.company_snapshot from public.companies c left join public.orgs o on o.id = c.org_id where c.id = new.company_id;
    return new;
  end if;

  -- UPDATE
  if new.org_id is distinct from old.org_id then raise exception '企業は変更できません'; end if;
  if old.status = 'signed' then
    if (new.contract_no, new.company_id, new.title, new.body, new.company_snapshot,
        new.signer_name, new.signer_email, new.status, new.token, new.fields, new.field_values,
        new.attachments, new.draft_result, new.draft_changes, new.typed_name, new.seal_type,
        new.signature_png, new.signed_at, new.signer_ip, new.signer_ua, new.doc_hash)
       is distinct from
       (old.contract_no, old.company_id, old.title, old.body, old.company_snapshot,
        old.signer_name, old.signer_email, old.status, old.token, old.fields, old.field_values,
        old.attachments, old.draft_result, old.draft_changes, old.typed_name, old.seal_type,
        old.signature_png, old.signed_at, old.signer_ip, old.signer_ua, old.doc_hash) then
      raise exception '締結済みの契約は変更できません';
    end if;
    return new;
  end if;

  if client then
    if (new.contract_no, new.token, new.token_expires_at, new.otp_hash, new.otp_expires_at,
        new.otp_attempts, new.otp_sent_count, new.otp_last_sent_at, new.session_hash,
        new.session_expires_at, new.draft_result, new.draft_comment, new.draft_responded_at, new.draft_changes,
        new.field_values, new.seal_type, new.typed_name, new.signature_png, new.signed_at,
        new.signer_ip, new.signer_ua, new.doc_hash, new.sent_at, new.created_by,
        new.created_at, new.company_snapshot, to_jsonb(new) -> 'intake_id', to_jsonb(new) -> 'intake_ref', to_jsonb(new) -> 'intake_data')
       is distinct from
       (old.contract_no, old.token, old.token_expires_at, old.otp_hash, old.otp_expires_at,
        old.otp_attempts, old.otp_sent_count, old.otp_last_sent_at, old.session_hash,
        old.session_expires_at, old.draft_result, old.draft_comment, old.draft_responded_at, old.draft_changes,
        old.field_values, old.seal_type, old.typed_name, old.signature_png, old.signed_at,
        old.signer_ip, old.signer_ua, old.doc_hash, old.sent_at, old.created_by,
        old.created_at, old.company_snapshot, to_jsonb(old) -> 'intake_id', to_jsonb(old) -> 'intake_ref', to_jsonb(old) -> 'intake_data') then
      raise exception '保護された項目は変更できません';
    end if;
    if new.status is distinct from old.status then
      raise exception '状態は画面の操作ボタンからのみ変更できます';
    end if;
    if old.status not in ('draft', 'review') and
       (new.company_id, new.title, new.body, new.signer_name, new.signer_email,
        new.fields, new.attachments, new.draft_review, new.require_otp)
       is distinct from
       (old.company_id, old.title, old.body, old.signer_name, old.signer_email,
        old.fields, old.attachments, old.draft_review, old.require_otp) then
      raise exception '本契約書の送信後は内容を変更できません。取消して作り直してください';
    end if;
  end if;

  if new.company_id is distinct from old.company_id then
    if not exists (select 1 from public.companies where id = new.company_id and org_id = new.org_id) then
      raise exception '発行会社が正しくありません';
    end if;
    select jsonb_build_object('name', c.name, 'address', c.address, 'representative', c.representative,
                              'email', c.email, 'color', c.color, 'logo', coalesce(o.logo, ''))
      into new.company_snapshot from public.companies c left join public.orgs o on o.id = c.org_id where c.id = new.company_id;
  end if;
  return new;
end $$;



-- 会社：企業は作成後に変更不可
create or replace function public.companies_before() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.org_id is distinct from old.org_id then raise exception '企業は変更できません'; end if;
  return new;
end $$;
drop trigger if exists companies_before_trg on public.companies;
create trigger companies_before_trg before update on public.companies
  for each row execute function public.companies_before();

-- 受付窓口：発行会社と雛形が同じ企業のものか
create or replace function public.intakes_before() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.org_id is distinct from old.org_id then raise exception '企業は変更できません'; end if;
  if not exists (select 1 from public.companies where id = new.company_id and org_id = new.org_id) then
    raise exception '発行会社が正しくありません';
  end if;
  if new.template_id is not null and not exists (select 1 from public.templates where id = new.template_id
       and (org_id is null or org_id = new.org_id)) then
    raise exception '雛形が正しくありません';
  end if;
  return new;
end $$;
drop trigger if exists intakes_before_trg on public.intakes;
create trigger intakes_before_trg before insert or update on public.intakes
  for each row execute function public.intakes_before();

-- ---------------------------------------------------------------------
-- 5. アクセス制限（企業ごとに分離）
-- ---------------------------------------------------------------------
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.account_verifications enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists staff_all on public.app_settings;
drop policy if exists op_all on public.app_settings;
create policy op_all on public.app_settings for all to authenticated
  using (public.is_operator()) with check (public.is_operator());

drop policy if exists staff_read on public.staff_members;
drop policy if exists op_read on public.staff_members;
create policy op_read on public.staff_members for select to authenticated using (public.is_operator());

drop policy if exists staff_all on public.companies;
drop policy if exists org_all on public.companies;
create policy org_all on public.companies for all to authenticated
  using (public.in_org(org_id)) with check (public.in_org(org_id));

drop policy if exists staff_all on public.templates;
drop policy if exists tpl_read on public.templates;
drop policy if exists tpl_ins on public.templates;
drop policy if exists tpl_upd on public.templates;
drop policy if exists tpl_del on public.templates;
create policy tpl_read on public.templates for select to authenticated
  using ((org_id is null and public.is_staff()) or public.in_org(org_id));
create policy tpl_ins on public.templates for insert to authenticated
  with check (public.in_org(org_id) or (org_id is null and public.is_operator()));
create policy tpl_upd on public.templates for update to authenticated
  using (public.in_org(org_id) or (org_id is null and public.is_operator()))
  with check (public.in_org(org_id) or (org_id is null and public.is_operator()));
create policy tpl_del on public.templates for delete to authenticated
  using (public.in_org(org_id) or (org_id is null and public.is_operator()));

drop policy if exists staff_all on public.contracts;
drop policy if exists org_all on public.contracts;
create policy org_all on public.contracts for all to authenticated
  using (public.in_org(org_id)) with check (public.in_org(org_id));

drop policy if exists staff_read on public.audit_logs;
drop policy if exists org_read on public.audit_logs;
create policy org_read on public.audit_logs for select to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and public.in_org(c.org_id)));

drop policy if exists staff_read on public.contract_files;
drop policy if exists org_read on public.contract_files;
create policy org_read on public.contract_files for select to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and public.in_org(c.org_id)));

drop policy if exists staff_all on public.intakes;
drop policy if exists org_all on public.intakes;
create policy org_all on public.intakes for all to authenticated
  using (public.in_org(org_id)) with check (public.in_org(org_id));

drop policy if exists org_read on public.orgs;
create policy org_read on public.orgs for select to authenticated
  using (public.is_operator() or id in (select m.org_id from public.org_members m where lower(m.email) = public.my_email()));

drop policy if exists mem_read on public.org_members;
create policy mem_read on public.org_members for select to authenticated
  using (public.is_operator() or public.in_org(org_id) or lower(email) = public.my_email());

drop policy if exists ai_read on public.ai_usage;
create policy ai_read on public.ai_usage for select to authenticated
  using (public.is_operator() or public.in_org(org_id));

-- ---------------------------------------------------------------------
-- 6. 既存の操作に企業のチェックを追加
-- ---------------------------------------------------------------------
create or replace function public._contract_for_me(p_id uuid) returns public.contracts
language plpgsql security definer set search_path = public as $$
declare c public.contracts;
begin
  select * into c from public.contracts where id = p_id;
  if not found or not public.in_org(c.org_id) then raise exception '契約が見つかりません'; end if;
  return c;
end $$;

-- 送信（本契約書の初回送信は企業の月間上限の対象）
create or replace function public._send_limit_check(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.contracts; o public.orgs; lim int; n int;
begin
  select * into c from public.contracts where id = p_id;
  if c.status not in ('draft', 'review') then return; end if;    -- 再送は数えない
  select * into o from public.orgs where id = c.org_id;
  if o.status <> 'active' then raise exception 'この企業は現在ご利用いただけません'; end if;
  lim := public.org_send_limit(o);
  if lim is null then return; end if;
  n := public.org_sent_this_month(c.org_id);
  if n >= lim then
    raise exception '今月の送信上限（%件）に達しました。上限を増やすには有料プランへの切り替えをご相談ください', lim;
  end if;
end $$;

create or replace function public.admin_send(p_id uuid, p_days int default 14, p_mode text default 'final') returns json
language plpgsql security definer set search_path = public as $$
begin
  perform public._contract_for_me(p_id);
  if p_mode <> 'review' then perform public._send_limit_check(p_id); end if;
  return public._send_contract(p_id, p_days, p_mode, null);
end $$;

create or replace function public.admin_cancel(p_id uuid, p_reason text default '') returns void
language plpgsql security definer set search_path = public as $$
declare c public.contracts;
begin
  perform public._contract_for_me(p_id);
  select * into c from public.contracts where id = p_id for update;
  if c.status in ('signed', 'cancelled') then raise exception 'この契約は取消できません'; end if;
  update public.contracts set status = 'cancelled', session_hash = null, otp_hash = null where id = p_id;
  perform public.add_log(p_id, 'cancelled', jsonb_build_object('reason', coalesce(p_reason, '')));
end $$;

create or replace function public.admin_verify(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare c public.contracts; now_hash text; bad int;
begin
  c := public._contract_for_me(p_id);
  if c.status <> 'signed' then raise exception '締結済みの契約のみ検証できます'; end if;
  now_hash := public.compute_doc_hash(c);
  select count(*) into bad from public.contract_files
    where contract_id = p_id and encode(extensions.digest(data, 'sha256'), 'hex') <> sha256;
  perform public.add_log(p_id, 'verify_check', jsonb_build_object('match', now_hash = c.doc_hash and bad = 0));
  return json_build_object('stored', c.doc_hash, 'computed', now_hash,
    'files_ng', bad, 'match', now_hash = c.doc_hash and bad = 0);
end $$;

create or replace function public.admin_lookup_hash(p_hash text) returns json
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_staff() then raise exception '権限がありません'; end if;
  select id, contract_no, title, signer_name, signed_at into r
    from public.contracts where doc_hash = lower(trim(p_hash)) and status = 'signed' and public.in_org(org_id);
  if not found then return json_build_object('found', false); end if;
  return json_build_object('found', true, 'id', r.id, 'contract_no', r.contract_no,
    'title', r.title, 'signer_name', r.signer_name, 'signed_at', r.signed_at);
end $$;

create or replace function public.admin_file(p_file uuid) returns json
language plpgsql security definer set search_path = public as $$
declare f public.contract_files;
begin
  select * into f from public.contract_files where id = p_file;
  if not found then raise exception 'ファイルが見つかりません'; end if;
  perform public._contract_for_me(f.contract_id);
  return json_build_object('name', f.name, 'mime', f.mime, 'b64', encode(f.data, 'base64'));
end $$;

create or replace function public.admin_intake_new_key(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if not exists (select 1 from public.intakes where id = p_id and public.in_org(org_id)) then
    raise exception '受付窓口が見つかりません';
  end if;
  k := 'ik_' || public.rand_hex(24);
  update public.intakes set key_hash = public.sha256_hex(k), key_hint = right(k, 4), updated_at = now() where id = p_id;
  return k;
end $$;

create or replace function public.admin_intake_test(p_id uuid, p_data jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare i public.intakes; c public.contracts;
begin
  select * into i from public.intakes where id = p_id;
  if not found or not public.in_org(i.org_id) then raise exception '受付窓口が見つかりません'; end if;
  c := public._intake_build(i, p_data, null, '自動受付（試験）：' || i.name);
  perform public.add_log(c.id, 'auto_created', jsonb_build_object('intake', i.name, 'test', true));
  return json_build_object('ok', true, 'id', c.id, 'contract_no', c.contract_no);
end $$;

-- 自動受付：企業の契約として作成。停止中の企業は受け付けない
create or replace function public._intake_build(i public.intakes, p_data jsonb, p_ref text, p_actor text)
returns public.contracts
language plpgsql security definer set search_path = public as $$
declare t public.templates; co public.companies; m jsonb; v text; tgt text;
        body text; fields jsonb; vars jsonb := '{}'; sname text; semail text; memo text := '';
        c public.contracts; f jsonb; newf jsonb := '[]';
begin
  if not exists (select 1 from public.orgs where id = i.org_id and status = 'active') then
    raise exception 'この受付窓口は現在ご利用いただけません';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception '申込みデータが正しくありません'; end if;
  if length(p_data::text) > 100000 then raise exception '申込みデータが大きすぎます'; end if;
  select * into co from public.companies where id = i.company_id and org_id = i.org_id;
  if not found then raise exception '発行会社が見つかりません'; end if;
  select * into t from public.templates where id = i.template_id and (org_id is null or org_id = i.org_id);
  if not found then raise exception '受付窓口に雛形が設定されていません'; end if;

  body := t.body; fields := coalesce(t.fields, '[]');
  for m in select * from jsonb_array_elements(coalesce(i.mapping, '[]')) loop
    v := left(trim(coalesce(p_data ->> (m ->> 'from'), '')), 2000);
    tgt := coalesce(m ->> 'to', '');
    continue when v = '' or tgt = '';
    if tgt = 'signer_name' then sname := left(v, 200);
    elsif tgt = 'signer_email' then semail := lower(left(v, 200));
    elsif tgt like 'var:%' then vars := vars || jsonb_build_object(substr(tgt, 5), v);
    elsif tgt = 'memo' then memo := memo || coalesce(nullif(m ->> 'label', ''), m ->> 'from') || '：' || v || chr(10);
    elsif tgt like 'field:%' then
      newf := '[]';
      for f in select * from jsonb_array_elements(fields) loop
        if f ->> 'key' = substr(tgt, 7) then
          f := f || jsonb_build_object('value', v, 'editable', coalesce((m ->> 'editable')::boolean, false));
        end if;
        newf := newf || jsonb_build_array(f);
      end loop;
      fields := newf;
    end if;
  end loop;

  if coalesce(sname, '') = '' then raise exception '署名者の氏名がありません（項目の対応表を確認してください）'; end if;
  if coalesce(semail, '') !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$' then
    raise exception '署名者のメールアドレスが正しくありません';
  end if;

  body := replace(body, '{{会社名}}', coalesce(co.name, ''));
  body := replace(body, '{{会社住所}}', coalesce(co.address, ''));
  body := replace(body, '{{代表者}}', coalesce(co.representative, ''));
  body := replace(body, '{{署名者氏名}}', sname);
  body := replace(body, '{{署名者メール}}', semail);
  body := replace(body, '{{作成日}}', to_char(now() at time zone 'Asia/Tokyo', 'FMYYYY"年"FMMM"月"FMDD"日"'));
  for tgt, v in select key, value from jsonb_each_text(vars) loop
    body := replace(body, '{{' || tgt || '}}', v);
  end loop;

  insert into public.contracts(org_id, company_id, template_id, title, body, signer_name, signer_email,
         draft_review, require_otp, fields, attachments, memo, created_by, intake_id, intake_ref, intake_data)
  values (i.org_id, i.company_id, t.id, coalesce(nullif(i.title, ''), regexp_replace(t.title, '（サンプル）$', '')),
          body, sname, semail, t.draft_review, t.require_otp, fields, coalesce(t.attachments, '[]'),
          case when memo <> '' then '【自動受付：' || i.name || '】' || chr(10) || memo else '' end,
          p_actor, i.id, nullif(left(trim(coalesce(p_ref, '')), 200), ''), p_data)
  returning * into c;
  return c;
end $$;

-- 自動送信も月間上限の対象（上限に達していれば送信待ちで止める）
create or replace function public._intake_after(i public.intakes, c public.contracts, p_actor text) returns json
language plpgsql security definer set search_path = public as $$
declare r json; mode text; left_vars text; over boolean := false;
begin
  perform public.add_log(c.id, 'auto_created', jsonb_build_object('intake', i.name, 'ref', c.intake_ref), p_actor);
  select string_agg(distinct m[1], '、') into left_vars from regexp_matches(c.body, '\{\{([^{}]+)\}\}', 'g') m;
  if i.mode = 'auto' and left_vars is null and not c.draft_review then
    begin perform public._send_limit_check(c.id); exception when others then over := true; end;
  end if;
  if i.mode = 'auto' and left_vars is null and not over then
    mode := case when c.draft_review then 'review' else 'final' end;
    r := public._send_contract(c.id, i.send_days, mode, p_actor);
    perform public.notify_issuer(c,
      '【自動送信】' || c.signer_name || ' 様「' || c.title || '」',
      '自動受付「' || public.html_esc(i.name) || '」で契約書を作成し、'
      || case when mode = 'review' then 'ドラフト確認依頼' else '押印依頼' end || 'をお客様へ送信しました。<br><br>'
      || '<b>契約番号：</b>' || c.contract_no || '<br>'
      || '<b>署名者：</b>' || public.html_esc(c.signer_name) || '（' || public.html_esc(c.signer_email) || '）');
    return json_build_object('ok', true, 'contract_no', c.contract_no, 'status', case when mode = 'review' then 'review' else 'sent' end);
  end if;
  perform public.notify_issuer(c,
    '【送信待ち】' || c.signer_name || ' 様「' || c.title || '」',
    '自動受付「' || public.html_esc(i.name) || '」で契約書を作成しました。<br>'
    || '管理画面で内容を確認し、送信してください（まだお客様には送っていません）。<br><br>'
    || case when over then '<b style="color:#c62828">今月の送信上限に達しているため、自動送信を保留しました。</b><br><br>' else '' end
    || case when left_vars is not null then '<b style="color:#c62828">未入力の差し込み項目：' || public.html_esc(left_vars)
         || '</b><br>' || case when i.mode = 'auto' then '（未入力があるため自動送信を保留しました）<br>' else '' end || '<br>' else '' end
    || '<b>契約番号：</b>' || c.contract_no || '<br>'
    || '<b>署名者：</b>' || public.html_esc(c.signer_name) || '（' || public.html_esc(c.signer_email) || '）');
  return json_build_object('ok', true, 'contract_no', c.contract_no, 'status', 'draft',
    'held', i.mode = 'auto' and (left_vars is not null or over));
end $$;

-- 発行会社への通知：運営の通知先には送らず、企業の担当者（管理者）へ
create or replace function public.notify_issuer(c public.contracts, p_subject text, p_inner text) returns void
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  for t in
    select distinct x from unnest(array_remove(array[nullif(c.company_snapshot ->> 'email', '')], null)) x
    union
    select distinct lower(m.email) from public.org_members m
     where m.org_id = c.org_id and m.role = 'admin' and m.status = 'active'
       and nullif(c.company_snapshot ->> 'email', '') is null
  loop
    begin
      perform public.send_mail(t, p_subject, public.mail_wrap(c.company_snapshot, p_inner), c.company_snapshot);
    exception when others then null;   -- 通知の失敗で本来の処理を止めない
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. 新規登録・メール確認
-- ---------------------------------------------------------------------

-- 会社ごとのアドレス用（ログイン前に社名・ロゴ・色を表示）
create or replace function public.org_public(p_slug text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', name, 'logo', logo, 'color', color, 'slug', slug)
    from public.orgs where slug = lower(trim(p_slug)) and status = 'active';
$$;

-- 確認コードの送信
create or replace function public.account_send_code() returns json
language plpgsql security definer set search_path = public as $$
declare e text := public.my_email(); v public.account_verifications; code text;
begin
  if e = '' then raise exception 'ログインしてください'; end if;
  insert into public.account_verifications(email) values (e) on conflict (email) do nothing;
  select * into v from public.account_verifications where email = e for update;
  if v.verified_at is not null then return json_build_object('ok', true, 'verified', true); end if;
  if v.last_sent_at is not null and v.last_sent_at > now() - interval '60 seconds' then
    raise exception '少し時間をおいてから再送してください';
  end if;
  if v.day = (now() at time zone 'Asia/Tokyo')::date and v.sent_count >= 5 then
    raise exception '本日の送信回数の上限に達しました';
  end if;
  code := lpad((('x' || public.rand_hex(4))::bit(32)::bigint % 1000000)::text, 6, '0');
  update public.account_verifications set code_hash = public.sha256_hex(e || ':' || code),
    expires_at = now() + interval '15 minutes', attempts = 0, last_sent_at = now(),
    sent_count = case when day = (now() at time zone 'Asia/Tokyo')::date then sent_count + 1 else 1 end,
    day = (now() at time zone 'Asia/Tokyo')::date
   where email = e;
  perform public.send_mail(e, '【電子契約】メールアドレスの確認コード',
    public.mail_wrap(jsonb_build_object('name', '電子契約', 'color', '#E8740C'),
      '電子契約サービスへのご登録ありがとうございます。<br>次の確認コードを画面に入力してください（15分間有効）。<br><br>'
      || '<div style="font-size:28px;font-weight:700;letter-spacing:6px">' || code || '</div>'),
    jsonb_build_object('name', '電子契約'));
  return json_build_object('ok', true, 'verified', false);
end $$;

create or replace function public.account_verify(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare e text := public.my_email(); v public.account_verifications;
begin
  select * into v from public.account_verifications where email = e for update;
  if not found or v.code_hash is null then raise exception '先に確認コードを送信してください'; end if;
  if v.verified_at is not null then return json_build_object('ok', true); end if;
  if v.attempts >= 5 then raise exception '入力の回数が上限に達しました。コードを再送してください'; end if;
  if v.expires_at < now() then raise exception '確認コードの有効期限が切れました。再送してください'; end if;
  if public.sha256_hex(e || ':' || trim(coalesce(p_code, ''))) <> v.code_hash then
    update public.account_verifications set attempts = attempts + 1 where email = e;
    raise exception '確認コードが違います';
  end if;
  update public.account_verifications set verified_at = now(), code_hash = null where email = e;
  -- 招待されている企業があれば参加
  update public.org_members set status = 'active' where lower(email) = e and status = 'invited';
  return json_build_object('ok', true);
end $$;

-- 利用の申込み（ログイン・メール確認済みの人が、自分の会社を登録する）
create or replace function public.org_apply(p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare e text := public.my_email(); o uuid; s text; nm text := left(trim(coalesce(p ->> 'name', '')), 100);
begin
  if e = '' then raise exception 'ログインしてください'; end if;
  if not public.is_verified() then raise exception 'メールアドレスの確認が済んでいません'; end if;
  if nm = '' then raise exception '会社名を入力してください'; end if;
  if exists (select 1 from public.org_members m join public.orgs g on g.id = m.org_id
              where lower(m.email) = e and g.status in ('pending', 'active')) then
    raise exception 'このメールアドレスは既に企業に登録されています';
  end if;
  s := lower(regexp_replace(coalesce(p ->> 'slug', ''), '[^a-zA-Z0-9-]', '', 'g'));
  if length(s) < 3 then s := 'c' || public.rand_hex(4); end if;
  if s in ('ma', 'admin', 'www', 'api', 'sign') or exists (select 1 from public.orgs where slug = s) then
    raise exception 'その会社用アドレスは使われています。別の文字列にしてください';
  end if;
  insert into public.orgs(name, slug, contact_name, contact_email, tel, address, representative, website, note)
  values (nm, left(s, 40), left(coalesce(p ->> 'contact_name', ''), 100), e, left(coalesce(p ->> 'tel', ''), 40),
          left(coalesce(p ->> 'address', ''), 200), left(coalesce(p ->> 'representative', ''), 100),
          left(coalesce(p ->> 'website', ''), 200), left(coalesce(p ->> 'note', ''), 1000))
  returning id into o;
  insert into public.org_members(org_id, email, name, role, status)
  values (o, e, left(coalesce(p ->> 'contact_name', ''), 100), 'admin', 'active');
  -- 運営へ通知
  begin
    perform public.send_mail(public.get_setting('notify_to'), '【電子契約】新規の利用申込み：' || nm,
      public.mail_wrap(jsonb_build_object('name', '電子契約（運営）', 'color', '#1F3A5F'),
        '新しい利用申込みがありました。管理画面の「運営」で承認してください。<br><br>'
        || '<b>会社名：</b>' || public.html_esc(nm) || '<br><b>担当者：</b>' || public.html_esc(p ->> 'contact_name')
        || '（' || public.html_esc(e) || '）<br><b>電話：</b>' || public.html_esc(p ->> 'tel')
        || '<br><b>利用目的：</b>' || public.html_esc(p ->> 'note')),
      jsonb_build_object('name', '電子契約'));
  exception when others then null;
  end;
  return json_build_object('ok', true, 'id', o, 'slug', s);
end $$;

-- ログイン後の状態（所属企業・承認状況・運営かどうか）
create or replace function public.my_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'email', public.my_email(),
    'operator', public.is_operator(),
    'verified', public.is_verified(),
    'orgs', coalesce((select json_agg(json_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status,
              'plan', o.plan, 'role', m.role, 'member_status', m.status, 'logo', o.logo, 'color', o.color,
              'reason', o.status_reason) order by o.created_at)
              from public.org_members m join public.orgs o on o.id = m.org_id
             where lower(m.email) = public.my_email()), '[]'::json),
    'site_url', public.get_setting('site_url'),
    'ai_url', public.get_setting('ai_url'));
$$;

-- ---------------------------------------------------------------------
-- 8. 企業の管理者用
-- ---------------------------------------------------------------------
create or replace function public.org_update(p_org uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_org_admin(p_org) then raise exception '権限がありません'; end if;
  if length(coalesce(p ->> 'logo', '')) > 280000 then raise exception 'ロゴの画像が大きすぎます（200KBまで）'; end if;
  if coalesce(p ->> 'logo', '') <> '' and (p ->> 'logo') !~ '^data:image/(png|jpeg|webp|gif);base64,' then
    raise exception 'ロゴは画像ファイルを指定してください';
  end if;
  update public.orgs set
    name = coalesce(nullif(left(trim(p ->> 'name'), 100), ''), name),
    contact_name = coalesce(left(p ->> 'contact_name', 100), contact_name),
    tel = coalesce(left(p ->> 'tel', 40), tel),
    address = coalesce(left(p ->> 'address', 200), address),
    representative = coalesce(left(p ->> 'representative', 100), representative),
    website = coalesce(left(p ->> 'website', 200), website),
    logo = coalesce(p ->> 'logo', logo),
    color = case when coalesce(p ->> 'color', '') ~ '^#[0-9a-fA-F]{6}$' then p ->> 'color' else color end
  where id = p_org;
end $$;

create or replace function public.org_invite(p_org uuid, p_email text, p_role text default 'member', p_name text default '') returns json
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email, ''))); o public.orgs; st text;
begin
  if not public.is_org_admin(p_org) then raise exception '権限がありません'; end if;
  if e !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$' then raise exception 'メールアドレスが正しくありません'; end if;
  if p_role not in ('admin', 'member') then raise exception '役割が正しくありません'; end if;
  if (select count(*) from public.org_members where org_id = p_org) >= 50 then raise exception '担当者は50人までです'; end if;
  select * into o from public.orgs where id = p_org;
  -- 確認済みのアカウントならすぐ参加、未登録なら招待中
  st := case when exists (select 1 from public.account_verifications where email = e and verified_at is not null)
             then 'active' else 'invited' end;
  insert into public.org_members(org_id, email, name, role, status, invited_by)
  values (p_org, e, left(coalesce(p_name, ''), 100), p_role, st, public.my_email())
  on conflict (org_id, email) do update set role = excluded.role, name = coalesce(nullif(excluded.name, ''), org_members.name);
  begin
    perform public.send_mail(e, '【電子契約】' || o.name || ' の担当者として招待されました',
      public.mail_wrap(jsonb_build_object('name', o.name, 'color', o.color),
        public.html_esc(o.name) || ' の電子契約の担当者として招待されました。<br>次のボタンから'
        || case when st = 'active' then 'ログイン' else '新規登録（このメールアドレスで登録）' end || 'してください。<br><br>'
        || public.mail_button(jsonb_build_object('color', o.color),
             rtrim(public.get_setting('site_url'), '/') || '/login.html?c=' || o.slug || case when st = 'active' then '' else '#signup' end,
             case when st = 'active' then 'ログインする' else '登録する' end)),
      jsonb_build_object('name', o.name));
  exception when others then null;
  end;
  return json_build_object('ok', true, 'status', st);
end $$;

create or replace function public.org_member_update(p_org uuid, p_email text, p_role text, p_remove boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_org_admin(p_org) then raise exception '権限がありません'; end if;
  if p_remove then
    delete from public.org_members where org_id = p_org and lower(email) = e;
  else
    if p_role not in ('admin', 'member') then raise exception '役割が正しくありません'; end if;
    update public.org_members set role = p_role where org_id = p_org and lower(email) = e;
  end if;
  if not exists (select 1 from public.org_members where org_id = p_org and role = 'admin' and status = 'active') then
    raise exception '管理者が1人もいなくなるため変更できません';
  end if;
end $$;

-- 利用状況（今月の送信件数・上限・リーガルチェック回数）
create or replace function public.org_usage(p_org uuid) returns json
language plpgsql security definer set search_path = public as $$
declare o public.orgs;
begin
  if not (public.in_org(p_org) or public.is_operator()) then raise exception '権限がありません'; end if;
  select * into o from public.orgs where id = p_org;
  return json_build_object('plan', o.plan, 'sent', public.org_sent_this_month(p_org), 'limit', public.org_send_limit(o),
    'ai_used', coalesce((select count from public.ai_usage where org_id = p_org and month = public.month_jst()), 0),
    'ai_limit', nullif(public.get_setting(case when o.plan = 'paid' then 'paid_ai_limit' else 'free_ai_limit' end), '')::int);
end $$;

-- リーガルチェックの回数を1回使う（Apps Script からログイン中の利用者の権限で呼ぶ）
create or replace function public.ai_quota_use(p_org uuid) returns json
language plpgsql security definer set search_path = public as $$
declare o public.orgs; lim int; n int;
begin
  if not public.in_org(p_org) then raise exception '権限がありません'; end if;
  select * into o from public.orgs where id = p_org;
  lim := nullif(public.get_setting(case when o.plan = 'paid' then 'paid_ai_limit' else 'free_ai_limit' end), '')::int;
  insert into public.ai_usage(org_id, month, count) values (p_org, public.month_jst(), 0) on conflict do nothing;
  select count into n from public.ai_usage where org_id = p_org and month = public.month_jst() for update;
  if lim is not null and n >= lim then
    raise exception '今月のリーガルチェックの上限（%回）に達しました', lim;
  end if;
  update public.ai_usage set count = count + 1 where org_id = p_org and month = public.month_jst();
  return json_build_object('ok', true, 'used', n + 1, 'limit', lim);
end $$;

-- ---------------------------------------------------------------------
-- 9. 運営用
-- ---------------------------------------------------------------------
create or replace function public.op_orgs() returns json
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception '権限がありません'; end if;
  return coalesce((select json_agg(json_build_object(
      'id', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status, 'plan', o.plan, 'monthly_limit', o.monthly_limit,
      'contact_name', o.contact_name, 'contact_email', o.contact_email, 'tel', o.tel, 'address', o.address,
      'representative', o.representative, 'website', o.website, 'note', o.note, 'reason', o.status_reason,
      'created_at', o.created_at, 'approved_at', o.approved_at,
      'members', (select count(*) from public.org_members m where m.org_id = o.id),
      'contracts', (select count(*) from public.contracts c where c.org_id = o.id),
      'sent_month', public.org_sent_this_month(o.id),
      'limit', public.org_send_limit(o),
      'ai_month', coalesce((select count from public.ai_usage a where a.org_id = o.id and a.month = public.month_jst()), 0))
    order by case o.status when 'pending' then 0 when 'active' then 1 else 2 end, o.created_at desc)
    from public.orgs o), '[]'::json);
end $$;

create or replace function public.op_set_org(p_org uuid, p_status text, p_plan text, p_limit int, p_reason text default '') returns void
language plpgsql security definer set search_path = public as $$
declare o public.orgs; was text;
begin
  if not public.is_operator() then raise exception '権限がありません'; end if;
  select * into o from public.orgs where id = p_org for update;
  if not found then raise exception '企業が見つかりません'; end if;
  if p_status not in ('pending', 'active', 'suspended', 'rejected') or p_plan not in ('free', 'paid') then
    raise exception '値が正しくありません';
  end if;
  was := o.status;
  update public.orgs set status = p_status, plan = p_plan, monthly_limit = p_limit,
    status_reason = coalesce(p_reason, ''),
    approved_at = case when p_status = 'active' and was <> 'active' then now() else approved_at end,
    approved_by = case when p_status = 'active' and was <> 'active' then public.my_email() else approved_by end
  where id = p_org;
  -- 承認したら、その企業の最初の発行会社を自動で作る
  if p_status = 'active' and not exists (select 1 from public.companies where org_id = p_org) then
    insert into public.companies(org_id, name, address, representative, email, color)
    values (p_org, o.name, o.address, o.representative, o.contact_email, o.color);
  end if;
  if p_status is distinct from was and p_status in ('active', 'rejected', 'suspended') then
    begin
      perform public.send_mail(o.contact_email,
        case p_status when 'active' then '【電子契約】ご利用を承認しました'
                      when 'rejected' then '【電子契約】ご利用の申込みについて'
                      else '【電子契約】ご利用の停止について' end,
        public.mail_wrap(jsonb_build_object('name', '電子契約', 'color', '#E8740C'),
          public.html_esc(o.name) || ' ' || public.html_esc(o.contact_name) || ' 様<br><br>'
          || case p_status
               when 'active' then 'ご利用の申込みを承認しました。次のボタンからログインしてご利用ください。<br><br>'
                 || public.mail_button(jsonb_build_object('color', '#E8740C'),
                      rtrim(public.get_setting('site_url'), '/') || '/login.html?c=' || o.slug, 'ログインする')
                 || '<br><br>貴社専用のアドレス：' || rtrim(public.get_setting('site_url'), '/') || '/login.html?c=' || o.slug
               when 'rejected' then '誠に恐れ入りますが、今回はご利用をお受けできませんでした。'
                 || case when coalesce(p_reason, '') <> '' then '<br>理由：' || public.html_esc(p_reason) else '' end
               else 'ご利用を停止しました。'
                 || case when coalesce(p_reason, '') <> '' then '<br>理由：' || public.html_esc(p_reason) else '' end
             end),
        jsonb_build_object('name', '電子契約'));
    exception when others then null;
    end;
  end if;
end $$;





-- ---------------------------------------------------------------------
-- 受け取る人はログイン不要：メールのURLを開くだけで確認・記入・押印・締結まで行える
-- （確認コードを求めるのは、発行側が「確認コードあり」を選んだ契約だけ）
-- ---------------------------------------------------------------------
create or replace function public.sign_get(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare c public.contracts;
begin
  c := public._sign_find(p_token);
  return json_build_object(
    'contract_no', c.contract_no, 'title', c.title,
    'company', c.company_snapshot ->> 'name', 'color', c.company_snapshot ->> 'color',
    'logo', coalesce(c.company_snapshot ->> 'logo', ''), 'require_otp', c.require_otp,
    'signer_name', c.signer_name, 'email_masked', public.mask_email(c.signer_email),
    'status', c.status, 'draft_result', c.draft_result, 'expires', c.token_expires_at);
end $$;

-- 署名依頼メール：確認コードの有無で案内文を変える
create or replace function public._send_contract(p_id uuid, p_days int default 14, p_mode text default 'final',
  p_actor text default null) returns json
language plpgsql security definer set search_path = public as $$
declare c public.contracts; tok text; url text; ev text; review boolean := p_mode = 'review';
begin
  select * into c from public.contracts where id = p_id for update;
  if not found then raise exception '契約が見つかりません'; end if;
  if review and c.status not in ('draft', 'review') then
    raise exception 'ドラフト確認は本契約書の送信前のみ依頼できます';
  end if;
  if not review and c.status not in ('draft', 'review', 'sent', 'viewed') then
    raise exception 'この状態の契約は送信できません';
  end if;

  ev := case when review then (case when c.status = 'review' then 'draft_resent' else 'draft_sent' end)
             else (case when c.status in ('sent', 'viewed') then 'resent' else 'sent' end) end;
  tok := public.rand_hex(24);
  update public.contracts set
    token = tok, token_expires_at = now() + make_interval(days => greatest(1, least(p_days, 60))),
    status = case when review then 'review' when status in ('draft', 'review') then 'sent' else status end,
    draft_result  = case when review then null else draft_result end,
    draft_comment = case when review then null else draft_comment end,
    draft_changes = case when review then '[]'::jsonb else draft_changes end,
    draft_responded_at = case when review then null else draft_responded_at end,
    sent_at = now(), otp_hash = null, otp_attempts = 0, otp_sent_count = 0,
    otp_last_sent_at = null, session_hash = null
  where id = p_id returning * into c;

  url := rtrim(public.get_setting('site_url'), '/') || '/sign.html?t=' || tok;
  if review then
    perform public.send_mail(c.signer_email,
      '【契約書ドラフトのご確認】「' || c.title || '」',
      public.mail_wrap(c.company_snapshot,
        public.html_esc(c.signer_name) || ' 様<br><br>'
        || public.html_esc(c.company_snapshot ->> 'name') || 'より、契約書のドラフト（案）をお送りします。<br>'
        || '内容をご確認のうえ「承認」または「修正を依頼」を選択してください。<br><br>'
        || '<b>契約書名：</b>' || public.html_esc(c.title) || '<br>'
        || '<b>回答期限：</b>' || to_char(c.token_expires_at at time zone 'Asia/Tokyo', 'YYYY年MM月DD日 HH24:MI') || '<br><br>'
        || public.mail_button(c.company_snapshot, url, 'ドラフトを確認する')
        || case when c.require_otp then '<br><br>開いた後、このメールアドレス宛に届く確認コードで本人確認を行います。'
          else '<br><br>ログインやパスワードは不要です。ボタンを押すと、内容の確認から押印・締結まで行えます。' end
        || '<br>このURLは ' || public.html_esc(c.signer_name) || ' 様専用です。他の方へ転送しないでください。'),
      c.company_snapshot);
  else
    perform public.send_mail(c.signer_email,
      '【電子契約】「' || c.title || '」ご確認とご押印のお願い',
      public.mail_wrap(c.company_snapshot,
        public.html_esc(c.signer_name) || ' 様<br><br>'
        || public.html_esc(c.company_snapshot ->> 'name') || 'より、下記契約書のご確認・必要事項のご記入・ご押印をお願い申し上げます。<br><br>'
        || '<b>契約書名：</b>' || public.html_esc(c.title) || '<br>'
        || '<b>契約番号：</b>' || c.contract_no || '<br>'
        || '<b>署名期限：</b>' || to_char(c.token_expires_at at time zone 'Asia/Tokyo', 'YYYY年MM月DD日 HH24:MI') || '<br><br>'
        || public.mail_button(c.company_snapshot, url, '契約書を確認する')
        || case when c.require_otp then '<br><br>開いた後、このメールアドレス宛に届く確認コードで本人確認を行います。'
          else '<br><br>ログインやパスワードは不要です。ボタンを押すと、内容の確認から押印・締結まで行えます。' end
        || '<br>このURLは ' || public.html_esc(c.signer_name) || ' 様専用です。他の方へ転送しないでください。'),
      c.company_snapshot);
  end if;
  perform public.add_log(p_id, ev, jsonb_build_object('to', c.signer_email, 'expires', c.token_expires_at), p_actor);
  return json_build_object('url', url, 'expires', c.token_expires_at);
end $$;

-- URLを開いた時点で閲覧を始める（メールの到達をもって本人確認とする）
create or replace function public.sign_open(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare c public.contracts; sess text;
begin
  c := public._sign_find(p_token);
  if c.require_otp then raise exception 'この契約書は確認コードによる本人確認が必要です'; end if;
  sess := public.rand_hex(32);
  update public.contracts set
    session_hash = public.sha256_hex(sess), session_expires_at = now() + interval '12 hours',
    status = case when status = 'sent' then 'viewed' else status end
  where id = c.id;
  perform public.add_log(c.id, 'link_opened', jsonb_build_object('email', public.mask_email(c.signer_email)), '署名者');
  return json_build_object('ok', true, 'session', sess);
end $$;

-- 締結記録に「URLからの開封」も残す
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
    'logs', case when c.status = 'signed' then (
      select coalesce(json_agg(json_build_object('event', l.event, 'created_at', l.created_at,
             'ip', l.ip, 'actor', case when l.actor = '署名者' then '署名者' else '発行者' end)
             order by l.id), '[]'::json)
      from public.audit_logs l where l.contract_id = c.id
        and l.event in ('created','draft_sent','draft_approved','draft_changes','sent','resent',
                        'verified','link_opened','file_uploaded','signed')) else '[]'::json end);
$$;

-- ---------------------------------------------------------------------
-- 10. 実行権限
-- ---------------------------------------------------------------------
revoke all on function public._contract_for_me(uuid) from public, anon, authenticated;
revoke all on function public._send_limit_check(uuid) from public, anon, authenticated;
revoke all on function public.org_send_limit(public.orgs) from public, anon, authenticated;
revoke all on function public.org_sent_this_month(uuid) from public, anon, authenticated;
revoke all on function public.notify_issuer(public.contracts, text, text) from public, anon, authenticated;
revoke all on function public._intake_build(public.intakes, jsonb, text, text) from public, anon, authenticated;
revoke all on function public._intake_after(public.intakes, public.contracts, text) from public, anon, authenticated;

grant execute on function public.org_public(text) to anon, authenticated;
grant execute on function public.sign_open(text) to anon, authenticated;
grant execute on function public.is_operator(), public.my_org_ids(), public.in_org(uuid), public.is_org_admin(uuid),
  public.is_staff(), public.is_verified(), public.my_email(), public.month_jst() to authenticated;
revoke all on function public.account_send_code(), public.account_verify(text), public.org_apply(jsonb), public.my_status(),
  public.org_update(uuid, jsonb), public.org_invite(uuid, text, text, text), public.org_member_update(uuid, text, text, boolean),
  public.org_usage(uuid), public.ai_quota_use(uuid), public.op_orgs(), public.op_set_org(uuid, text, text, int, text)
  from public, anon;
grant execute on function public.account_send_code(), public.account_verify(text), public.org_apply(jsonb), public.my_status(),
  public.org_update(uuid, jsonb), public.org_invite(uuid, text, text, text), public.org_member_update(uuid, text, text, boolean),
  public.org_usage(uuid), public.ai_quota_use(uuid), public.op_orgs(), public.op_set_org(uuid, text, text, int, text)
  to authenticated;

grant select on public.orgs, public.org_members, public.ai_usage to authenticated;
revoke insert, update, delete, truncate, trigger, references on public.orgs, public.org_members, public.ai_usage,
  public.account_verifications from anon, authenticated;
revoke all on public.orgs, public.org_members, public.ai_usage, public.account_verifications from anon;
revoke all on public.account_verifications from authenticated;
