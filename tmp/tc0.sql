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

