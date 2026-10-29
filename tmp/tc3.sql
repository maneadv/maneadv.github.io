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
             rtrim(public.get_setting('site_url'), '/') || '/?c=' || o.slug || case when st = 'active' then '' else '#signup' end,
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
                      rtrim(public.get_setting('site_url'), '/') || '/?c=' || o.slug, 'ログインする')
                 || '<br><br>貴社専用のアドレス：' || rtrim(public.get_setting('site_url'), '/') || '/?c=' || o.slug
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


-- 署名画面：企業のロゴも返す
create or replace function public.sign_get(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare c public.contracts;
begin
  c := public._sign_find(p_token);
  return json_build_object(
    'contract_no', c.contract_no, 'title', c.title,
    'company', c.company_snapshot ->> 'name', 'color', c.company_snapshot ->> 'color',
    'logo', coalesce(c.company_snapshot ->> 'logo', ''),
    'signer_name', c.signer_name, 'email_masked', public.mask_email(c.signer_email),
    'status', c.status, 'draft_result', c.draft_result, 'expires', c.token_expires_at);
end $$;

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
