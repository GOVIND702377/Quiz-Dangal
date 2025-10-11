-- Results table and computation RPCs + engagement RPCs + redeem
-- Safe to run multiple times with IF NOT EXISTS guards.

-- 1) quiz_results table to store leaderboard
create table if not exists public.quiz_results (
  quiz_id uuid primary key references public.quizzes(id) on delete cascade,
  leaderboard jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  compute_version int not null default 1
);
comment on table public.quiz_results is 'Materialized per-quiz leaderboard';

-- RLS: allow read to authenticated users; insert/update via RPC only
alter table public.quiz_results enable row level security;
create policy if not exists quiz_results_read on public.quiz_results
  for select to authenticated using (true);

-- 2) compute_results_if_due
create or replace function public.compute_results_if_due(p_quiz_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  q record;
  lb jsonb;
begin
  select * into q from public.quizzes where id = p_quiz_id limit 1;
  if not found then
    raise exception 'quiz not found';
  end if;

  -- Only compute after end_time
  if q.end_time is null or now() < q.end_time then
    return; -- not due yet
  end if;

  -- Build leaderboard from answers/scores; replace this with your actual logic
  -- For now, if a view/table public.user_scores exists, we use it; else fallback empty
  begin
    lb := coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'user_id', s.user_id,
          'display_name', coalesce(p.full_name, p.username, left(s.user_id::text, 8)),
          'score', s.score,
          'rank', dense_rank() over(order by s.score desc, s.user_id)
        ) order by s.score desc, s.user_id)
        from (
          select ua.user_id, sum( case when ua.is_correct then 1 else 0 end )::int as score
          from public.user_answers ua
          where ua.quiz_id = p_quiz_id
          group by ua.user_id
        ) s
        left join public.profiles p on p.id = s.user_id
      ), '[]'::jsonb
    );
  exception when others then
    lb := '[]'::jsonb;
  end;

  insert into public.quiz_results(quiz_id, leaderboard, computed_at)
  values (p_quiz_id, lb, now())
  on conflict (quiz_id)
  do update set leaderboard = excluded.leaderboard, computed_at = now();
end;
$$;

revoke all on function public.compute_results_if_due(uuid) from public, anon;
grant execute on function public.compute_results_if_due(uuid) to authenticated, service_role;

-- 3) admin_recompute_quiz_results
create or replace function public.admin_recompute_quiz_results(p_quiz_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Require admin role for caller
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'admin only';
  end if;
  perform public.compute_results_if_due(p_quiz_id);
end; $$;

grant execute on function public.admin_recompute_quiz_results(uuid) to authenticated, service_role;

-- 4) engagement counts
create or replace function public.get_engagement_counts(p_quiz_id uuid)
returns table(quiz_id uuid, pre_joined int, joined int)
language sql stable security definer as $$
  select q.id as quiz_id,
         (select count(*) from public.quiz_participants pj where pj.quiz_id = q.id and coalesce(pj.status,'pre') = 'pre')::int as pre_joined,
         (select count(*) from public.quiz_participants pj where pj.quiz_id = q.id and coalesce(pj.status,'pre') = 'joined')::int as joined
  from public.quizzes q where q.id = p_quiz_id
$$;

grant execute on function public.get_engagement_counts(uuid) to anon, authenticated, service_role;

create or replace function public.get_engagement_counts_many(p_quiz_ids uuid[])
returns table(quiz_id uuid, pre_joined int, joined int)
language sql stable security definer as $$
  select q.id as quiz_id,
         (select count(*) from public.quiz_participants pj where pj.quiz_id = q.id and coalesce(pj.status,'pre') = 'pre')::int as pre_joined,
         (select count(*) from public.quiz_participants pj where pj.quiz_id = q.id and coalesce(pj.status,'pre') = 'joined')::int as joined
  from public.quizzes q where q.id = any(p_quiz_ids)
$$;

grant execute on function public.get_engagement_counts_many(uuid[]) to anon, authenticated, service_role;

-- 5) redeem_from_catalog: deduct profile.wallet_balance and insert transaction + redemptions row
-- Expected tables: profiles(id uuid pk, wallet_balance int), transactions, redemptions, reward_catalog
create table if not exists public.transactions (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null,
  type text not null,
  reason text,
  created_at timestamptz not null default now()
);
-- Optional: widen accepted types to cover app usage (reward, bonus, referral, daily_login, quiz_reward, purchase, refund, join_fee, prize, debit, credit)
-- If a CHECK existed previously, consider dropping it:
-- alter table public.transactions drop constraint if exists transactions_type_check;

create table if not exists public.redemptions (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_id bigint not null,
  coins int not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Enable RLS and add user-scoped read policies for these tables
alter table if exists public.transactions enable row level security;
create policy if not exists transactions_read_own on public.transactions for select to authenticated using (user_id = auth.uid());

alter table if exists public.redemptions enable row level security;
create policy if not exists redemptions_read_own on public.redemptions for select to authenticated using (user_id = auth.uid());

create or replace function public.redeem_from_catalog(p_user_id uuid, p_reward_id bigint)
returns table(success boolean, new_balance int)
language plpgsql security definer as $$
declare
  r record; bal int; price int;
begin
  select * into r from public.reward_catalog where id = p_reward_id and is_active = true;
  if not found then
    raise exception 'reward not found or inactive';
  end if;
  price := coalesce(r.coins_required, 0);
  select wallet_balance into bal from public.profiles where id = p_user_id for update;
  if bal is null then raise exception 'profile not found'; end if;
  if bal < price then raise exception 'insufficient balance'; end if;

  update public.profiles set wallet_balance = wallet_balance - price where id = p_user_id;
  insert into public.transactions(user_id, amount, type, reason) values (p_user_id, price, 'debit', 'catalog_redeem');
  insert into public.redemptions(user_id, reward_id, coins, status) values (p_user_id, p_reward_id, price, 'pending');

  return query select true, (select wallet_balance from public.profiles where id = p_user_id);
end; $$;

grant execute on function public.redeem_from_catalog(uuid, bigint) to authenticated, service_role;

-- Minimal read grants to support UI; use RLS policies as needed in your env
grant select on public.quiz_results to authenticated;

-- End of migration
