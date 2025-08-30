begin;

-- 1) Cleanup quiz_participants policies and recreate minimal, safe set
do $$
declare r record;
begin
  for r in (
    select policyname from pg_policies
    where schemaname='public' and tablename='quiz_participants'
  ) loop
    execute format('drop policy if exists %I on public.quiz_participants', r.policyname);
  end loop;
end $$;

-- Ensure RLS is enabled (idempotent)
alter table public.quiz_participants enable row level security;

drop policy if exists "qp: select own or admin" on public.quiz_participants;
create policy "qp: select own or admin" on public.quiz_participants
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "qp: insert self" on public.quiz_participants;
create policy "qp: insert self" on public.quiz_participants
  for insert with check (user_id = auth.uid());

drop policy if exists "qp: update own" on public.quiz_participants;
create policy "qp: update own" on public.quiz_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "qp: admin manage" on public.quiz_participants;
create policy "qp: admin manage" on public.quiz_participants
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 2) Fix export_all_data so it aggregates per-table correctly
create or replace function public.export_all_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  res jsonb := '{}'::jsonb;
  rec record;
  tbl jsonb;
begin
  for rec in
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  loop
    execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from %I t', rec.table_name)
    into tbl;
    res := jsonb_set(res, ARRAY[rec.table_name], coalesce(tbl, '[]'::jsonb));
  end loop;
  return res;
end;
$$;

revoke all on function public.export_all_data() from public;
grant execute on function public.export_all_data() to anon, authenticated;

commit;
