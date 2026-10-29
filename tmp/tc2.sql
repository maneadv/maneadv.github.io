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
         draft_review, fields, attachments, memo, created_by, intake_id, intake_ref, intake_data)
  values (i.org_id, i.company_id, t.id, coalesce(nullif(i.title, ''), regexp_replace(t.title, '（サンプル）$', '')),
          body, sname, semail, t.draft_review, fields, coalesce(t.attachments, '[]'),
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

