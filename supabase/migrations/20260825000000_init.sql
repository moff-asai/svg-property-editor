-- SVGプロパティ・エディタ 初期スキーマ
-- documents: ユーザー所有のSVG文書（基底SVGはStorage、編集はedits JSONB）

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  storage_path text not null,               -- svgs/{user_id}/{id}.svg
  edits jsonb not null default '{}'::jsonb,   -- eid -> プロパティ上書き
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_user_updated_idx
  on public.documents (user_id, updated_at desc);

-- Row Level Security: 所有者のみ
alter table public.documents enable row level security;
revoke all on table public.documents from anon, authenticated;
grant select, insert, update, delete on table public.documents to authenticated;

create policy "own_select" on public.documents for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own_insert" on public.documents for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own_update" on public.documents for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "own_delete" on public.documents for delete to authenticated
  using ((select auth.uid()) = user_id);

-- updated_at 自動更新
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger documents_touch
  before update on public.documents
  for each row execute function public.touch_updated_at();

-- Storage: private バケット svgs
insert into storage.buckets (id, name, public)
values ('svgs', 'svgs', false)
on conflict (id) do nothing;

-- Storage RLS: パス先頭セグメント（= user_id）が所有者に一致する場合のみ許可
create policy "svgs_owner_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'svgs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "svgs_owner_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'svgs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "svgs_owner_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'svgs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'svgs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "svgs_owner_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'svgs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
