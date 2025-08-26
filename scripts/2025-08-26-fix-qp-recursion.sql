-- Fix: eliminate recursive RLS on quiz_participants and add safe count RPC
-- Run this in Supabase SQL editor. Idempotent and safe to re-run.

begin;

-- 1) Drop the self-referential policy if present
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'quiz_participants'
      and policyname = 'Participants: select own + same quiz'
  ) then
    drop policy "Participants: select own + same quiz" on public.quiz_participants;
  end if;
end $$;

-- 2) Helper: check if current user is a member of a quiz (bypasses RLS to avoid recursion)
create or replace function public.is_quiz_member(p_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.quiz_participants
    where quiz_id = p_quiz_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_quiz_member(uuid) from public;
grant execute on function public.is_quiz_member(uuid) to anon, authenticated;

-- 3) Recreate a non-recursive select policy (own rows OR anyone in same quiz via helper) + admin override
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'quiz_participants'
      and policyname = 'Participants: select permitted'
  ) then
    create policy "Participants: select permitted" on public.quiz_participants
      for select using (
        user_id = auth.uid()
        or public.is_quiz_member(quiz_id)
        or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      );
  end if;
end $$;

-- 4) Safe count RPC to avoid scanning rows client-side
create or replace function public.get_participant_count(p_quiz_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.quiz_participants
  where quiz_id = p_quiz_id and coalesce(status, 'joined') = 'joined';
$$;

revoke all on function public.get_participant_count(uuid) from public;
grant execute on function public.get_participant_count(uuid) to anon, authenticated;

commit;
