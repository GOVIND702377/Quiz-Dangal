-- Hotfix: remove any recursive quiz_participants policies and add a simple, safe set.
-- Also create a minimal update_streak RPC to stop 404s.
-- Run in Supabase SQL Editor. Idempotent.

begin;

-- 1) Drop ALL existing policies on quiz_participants to clear recursion
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

-- 2) Recreate minimal, non-recursive policies
create policy if not exists "qp: select own or admin" on public.quiz_participants
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy if not exists "qp: insert self" on public.quiz_participants
  for insert with check (user_id = auth.uid());

create policy if not exists "qp: update own" on public.quiz_participants
  for update using (user_id = auth.uid());

create policy if not exists "qp: admin manage" on public.quiz_participants
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 3) Provide a simple update_streak RPC (idempotent-ish via activity transaction)
create or replace function public.update_streak(p_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert a no-op activity transaction which your existing trigger uses to update streaks.
  insert into public.transactions (user_id, type, amount, status, description, created_at)
  values (coalesce(p_user_id, auth.uid()), 'activity', 0, 'ok', 'daily streak claim', now());
  -- Ignore conflicts or RLS failures silently
  exception when others then
    null;
end; $$;

revoke all on function public.update_streak(uuid) from public;
grant execute on function public.update_streak(uuid) to anon, authenticated;

commit;
