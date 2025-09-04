-- =====================================================================
-- QUIZ DANGAL - COMPLETE SCHEMA + RLS + FUNCTIONS + TEST SEED (V1)
-- Run in Supabase SQL Editor. Safe to re-run (idempotent where possible).
-- =====================================================================

-- Enable required extension for gen_random_uuid
create extension if not exists "pgcrypto";

-- =========================
-- TABLES
-- =========================

-- 1) Users/Profile (app-level)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone_number text,
  role text default 'user',
  wallet_balance numeric(10,2) default 0.00,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) Quizzes (daily opinion quiz definition)
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text,
  entry_fee numeric(10,2) default 0.00,
  prize_pool numeric(10,2) default 0.00,
  prizes jsonb default '[]'::jsonb, -- e.g., [251,151,51]
  start_time timestamptz not null,
  end_time timestamptz not null,
  result_time timestamptz,
  status text default 'upcoming', -- upcoming | active | finished | completed
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3) Questions for each quiz (10 per quiz)
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_text text not null,
  position smallint,
  created_at timestamptz default now()
);

-- 4) Options for each question (4 options typical)
create table if not exists public.options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_text text not null
);

-- 5) Participant mapping (who joined a quiz)
create table if not exists public.quiz_participants (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  score integer default 0,
  rank integer,
  prize_amount numeric(10,2) default 0.00,
  status text default 'joined', -- joined | completed
  unique (quiz_id, user_id)
);

-- 6) Answers - user selections for each question
create table if not exists public.user_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_id uuid not null references public.options(id) on delete cascade,
  answered_at timestamptz default now(),
  unique (user_id, question_id)
);

-- 7) Results - materialized leaderboard per quiz
create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null unique references public.quizzes(id) on delete cascade,
  leaderboard jsonb not null, -- array of { user_id, display_name, score, rank }
  created_at timestamptz default now(),
  result_shown_at timestamptz default now()
);

-- 8) Transactions (wallet) - simple for test phase
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, -- 'win', 'deposit', 'withdraw'
  amount numeric(10,2) not null,
  description text,
  quiz_id uuid references public.quizzes(id) on delete set null,
  created_at timestamptz default now()
);

-- =========================
-- INDEXES
-- =========================
create index if not exists idx_quizzes_start_time on public.quizzes(start_time);
create index if not exists idx_quizzes_status on public.quizzes(status);
create index if not exists idx_questions_quiz_id on public.questions(quiz_id);
create index if not exists idx_options_question_id on public.options(question_id);
create index if not exists idx_qp_quiz_id on public.quiz_participants(quiz_id);
create index if not exists idx_qp_user_id on public.quiz_participants(user_id);
create index if not exists idx_ua_question_id on public.user_answers(question_id);
create index if not exists idx_ua_user_id on public.user_answers(user_id);
create index if not exists idx_results_quiz_id on public.quiz_results(quiz_id);
create index if not exists idx_tx_user_id on public.transactions(user_id);
create index if not exists idx_tx_created_at on public.transactions(created_at);

-- =========================
-- RLS + POLICIES
-- =========================
alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.options enable row level security;
alter table public.quiz_participants enable row level security;
alter table public.user_answers enable row level security;
alter table public.quiz_results enable row level security;
alter table public.transactions enable row level security;

-- Helper predicate: check admin role
-- We'll reference it via inline EXISTS clauses in policies.

-- Profiles
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profiles: select own'
  ) then
    create policy "Profiles: select own" on public.profiles
      for select using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profiles: insert self'
  ) then
    create policy "Profiles: insert self" on public.profiles
      for insert with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profiles: update own'
  ) then
    create policy "Profiles: update own" on public.profiles
      for update using (auth.uid() = id);
  end if;

  -- Allow viewing basic details of users who share any quiz with current user (for leaderboard/results)
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Profiles: select co-participants'
  ) then
    create policy "Profiles: select co-participants" on public.profiles
      for select using (
        exists (
          select 1
          from public.quiz_participants qp_me
          join public.quiz_participants qp_them
            on qp_me.quiz_id = qp_them.quiz_id
          where qp_me.user_id = auth.uid()
            and qp_them.user_id = profiles.id
        )
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

-- Quizzes
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quizzes' and policyname = 'Quizzes: select all'
  ) then
    create policy "Quizzes: select all" on public.quizzes for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quizzes' and policyname = 'Quizzes: admin manage'
  ) then
    create policy "Quizzes: admin manage" on public.quizzes for all using (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    ) with check (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

-- Questions
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'questions' and policyname = 'Questions: select all'
  ) then
    create policy "Questions: select all" on public.questions for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'questions' and policyname = 'Questions: admin manage'
  ) then
    create policy "Questions: admin manage" on public.questions for all using (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    ) with check (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

-- Options
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'options' and policyname = 'Options: select all'
  ) then
    create policy "Options: select all" on public.options for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'options' and policyname = 'Options: admin manage'
  ) then
    create policy "Options: admin manage" on public.options for all using (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    ) with check (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

-- Quiz Participants
do $$ begin
  -- Non-recursive select policy with SECURITY DEFINER helper
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quiz_participants' and policyname = 'Participants: select permitted'
  ) then
    create policy "Participants: select permitted" on public.quiz_participants
      for select using (
        user_id = auth.uid()
        or public.is_quiz_member(quiz_id)
        or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quiz_participants' and policyname = 'Participants: insert self'
  ) then
    create policy "Participants: insert self" on public.quiz_participants
      for insert with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quiz_participants' and policyname = 'Participants: update own'
  ) then
    create policy "Participants: update own" on public.quiz_participants
      for update using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quiz_participants' and policyname = 'Participants: admin manage'
  ) then
    create policy "Participants: admin manage" on public.quiz_participants
      for all using (
        exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      ) with check (
        exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      );
  end if;
end $$;

-- User Answers
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_answers' and policyname = 'Answers: select own'
  ) then
    create policy "Answers: select own" on public.user_answers for select using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_answers' and policyname = 'Answers: upsert own'
  ) then
    create policy "Answers: upsert own" on public.user_answers for insert with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_answers' and policyname = 'Answers: update own'
  ) then
    create policy "Answers: update own" on public.user_answers for update using (user_id = auth.uid());
  end if;
end $$;

-- Quiz Results
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quiz_results' and policyname = 'Results: select participants of quiz'
  ) then
    create policy "Results: select participants of quiz" on public.quiz_results
      for select using (
        exists (
          select 1 from public.quiz_participants qp
          where qp.quiz_id = quiz_results.quiz_id
            and qp.user_id = auth.uid()
        )
        or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quiz_results' and policyname = 'Results: admin manage'
  ) then
    create policy "Results: admin manage" on public.quiz_results for all using (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    ) with check (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

-- Transactions
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'Transactions: select own'
  ) then
    create policy "Transactions: select own" on public.transactions for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'Transactions: insert own'
  ) then
    create policy "Transactions: insert own" on public.transactions for insert with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'Transactions: admin view'
  ) then
    create policy "Transactions: admin view" on public.transactions for select using (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

-- =========================
-- TRIGGERS
-- =========================
-- Auto-update updated_at on profiles & quizzes
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger trg_quizzes_updated_at
before update on public.quizzes
for each row execute function public.set_updated_at();

-- Maintain answered_at on updates too
create or replace function public.touch_answered_at() returns trigger language plpgsql as $$
begin
  new.answered_at = now();
  return new;
end $$;

create trigger trg_user_answers_touch
before update on public.user_answers
for each row execute function public.touch_answered_at();

-- =========================
-- RESULT CALCULATION FUNCTION
-- =========================
-- Majority-based scoring (+1 per question if picked majority option)
-- Tie-breaker on equal score: earliest answered_at among correct answers; if still tied, earliest joined_at.

create or replace function public.compute_quiz_results(p_quiz_id uuid)
returns public.quiz_results
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.quiz_results;
begin
  -- Compute majority option per question for the quiz
  with
  qns as (
    select id from public.questions where quiz_id = p_quiz_id
  ),
  counts as (
    select ua.question_id, ua.selected_option_id, count(*) as cnt
    from public.user_answers ua
    join qns q on q.id = ua.question_id
    join public.quiz_participants qp on qp.user_id = ua.user_id and qp.quiz_id = p_quiz_id
    group by ua.question_id, ua.selected_option_id
  ),
  majority as (
    select c.question_id,
           (array_agg(c.selected_option_id order by c.cnt desc, c.selected_option_id asc))[1] as majority_option_id,
           max(c.cnt) as max_cnt
    from counts c
    group by c.question_id
  ),
  correct_answers as (
    select ua.user_id, ua.question_id, ua.answered_at
    from public.user_answers ua
    join majority m on m.question_id = ua.question_id and m.majority_option_id = ua.selected_option_id
  ),
  scores as (
    select qp.user_id,
           coalesce(count(ca.question_id), 0) as score,
           -- earliest time the user submitted any correct answer
           min(ca.answered_at) as tie_break_time
    from public.quiz_participants qp
    left join correct_answers ca on ca.user_id = qp.user_id
    where qp.quiz_id = p_quiz_id
    group by qp.user_id
  ),
  ranked as (
    select qp.user_id,
           s.score,
           coalesce(s.tie_break_time, 'infinity'::timestamptz) as tie_break_time,
           qp.joined_at,
           dense_rank() over (
             order by s.score desc, coalesce(s.tie_break_time, 'infinity'::timestamptz) asc, qp.joined_at asc
           ) as rnk
    from public.quiz_participants qp
    join scores s on s.user_id = qp.user_id
    where qp.quiz_id = p_quiz_id
  ),
  upd as (
    update public.quiz_participants qp
    set score = r.score,
        rank = r.rnk
    from ranked r
    where qp.quiz_id = p_quiz_id and qp.user_id = r.user_id
    returning qp.user_id, qp.score, qp.rank
  ),
  lb as (
    select jsonb_agg(
             jsonb_build_object(
               'user_id', r.user_id,
               'display_name', coalesce(p.full_name, split_part(coalesce(p.email,''),'@',1), 'Player'),
               'score', r.score,
               'rank', r.rnk
             )
             order by r.rnk asc
           ) as leaderboard
    from ranked r
    join public.profiles p on p.id = r.user_id
  )
  insert into public.quiz_results (quiz_id, leaderboard)
  select p_quiz_id, lb.leaderboard from lb
  on conflict (quiz_id)
  do update set leaderboard = excluded.leaderboard,
                created_at = now(),
                result_shown_at = now()
  returning *
  into v_result;

  -- Optionally mark quiz as completed if it was finished/active
  update public.quizzes
     set status = 'completed', result_time = coalesce(result_time, now())
   where id = p_quiz_id and status in ('active','finished','upcoming');

  return v_result;
end; $$;

-- Optional: Trigger to auto-compute results when status manually set to 'finished'
create or replace function public.trg_quiz_finished_compute()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'finished' and old.status is distinct from 'finished' then
    perform public.compute_quiz_results(new.id);
  end if;
  return new;
end; $$;

-- Drop and recreate trigger to avoid duplicates
drop trigger if exists trg_quizzes_finish_compute on public.quizzes;
create trigger trg_quizzes_finish_compute
after update on public.quizzes
for each row execute function public.trg_quiz_finished_compute();

-- =========================
-- ADMIN CONVENIENCE: promote admin by email (adjust as needed)
-- =========================
-- update public.profiles set role = 'admin' where email = 'quizdangalofficial@gmail.com';

-- =========================
-- VERIFICATION / USAGE
-- =========================
-- 1) Check seed quiz exists
-- select * from public.quizzes where title = 'Test Mode: Daily Opinion Quiz';

-- 2) After players answer and complete, compute results manually (for now):
--    select compute_quiz_results(<quiz_uuid>);
--    Example:
--    select compute_quiz_results((select id from public.quizzes where title = 'Test Mode: Daily Opinion Quiz'));

-- 3) Preview leaderboard JSON
-- select * from public.quiz_results order by created_at desc limit 1;

-- 4) Make yourself admin (replace email) then manage quizzes via frontend admin panel
-- update public.profiles set role = 'admin' where email = 'quizdangalofficial@gmail.com';
