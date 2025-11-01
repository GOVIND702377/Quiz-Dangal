-- RLS policies for user_answers: allow participants to upsert their own answers
-- and read their own answers, while keeping strict checks.

begin;

-- Ensure RLS enabled
alter table public.user_answers enable row level security;

-- Helper: check that the authenticated user has joined the quiz of the question
create or replace function public.has_joined_quiz_for_question(p_question_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.questions q
    join public.quiz_participants p on p.quiz_id = q.quiz_id
    where q.id = p_question_id
      and p.user_id = auth.uid()
      and p.status in ('joined','pre_joined','completed')
  );
$$;

-- INSERT/UPDATE: only row owner, and only if they joined corresponding quiz
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='user_answers' and policyname='ua_write_old') then
    drop policy ua_write_old on public.user_answers;
  end if;
end $$;

drop policy if exists ua_ins on public.user_answers;
create policy ua_ins on public.user_answers
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.has_joined_quiz_for_question(question_id)
  );

drop policy if exists ua_upd on public.user_answers;
create policy ua_upd on public.user_answers
  for update to authenticated
  using (
    user_id = auth.uid()
    and public.has_joined_quiz_for_question(question_id)
  )
  with check (
    user_id = auth.uid()
    and public.has_joined_quiz_for_question(question_id)
  );

-- SELECT: a user can read only their own answers (for results view)
drop policy if exists ua_sel on public.user_answers;
create policy ua_sel on public.user_answers
  for select to authenticated
  using ( user_id = auth.uid() );

commit;
