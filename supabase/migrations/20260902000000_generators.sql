-- 生成コンテンツ(canvas系)の保存: 設定(params)をユーザー所有で永続化する。
-- ラスタ系(HEX HALO / DATA CUBE / GRID CUBE / LIQUID GLASS)は SVG 文書にできないため、
-- documents とは別に params(JSONB) を保存し、ダッシュボードから再編集・再書き出しする。

create table public.generators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,                          -- コンテンツ種別 (hex-halo, data-cube, ...)
  name text not null,
  params jsonb not null default '{}'::jsonb,    -- レンダラ設定
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index generators_user_updated_idx
  on public.generators (user_id, updated_at desc);

-- Row Level Security: 所有者のみ
alter table public.generators enable row level security;
revoke all on table public.generators from anon, authenticated;
grant select, insert, update, delete on table public.generators to authenticated;

create policy "gen_own_select" on public.generators for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "gen_own_insert" on public.generators for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "gen_own_update" on public.generators for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "gen_own_delete" on public.generators for delete to authenticated
  using ((select auth.uid()) = user_id);

-- updated_at 自動更新（init.sql の touch_updated_at を再利用）
create trigger generators_touch
  before update on public.generators
  for each row execute function public.touch_updated_at();
