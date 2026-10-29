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
        new.fields, new.attachments, new.draft_review)
       is distinct from
       (old.company_id, old.title, old.body, old.signer_name, old.signer_email,
        old.fields, old.attachments, old.draft_review) then
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

