begin;

-- 1) Ensure RLS on profiles and self-service policies (idempotent)
alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can view their own profile'
  ) then
    create policy "Users can view their own profile" on public.profiles
      for select using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can insert their own profile'
  ) then
    create policy "Users can insert their own profile" on public.profiles
      for insert with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can update their own profile'
  ) then
    create policy "Users can update their own profile" on public.profiles
      for update using (auth.uid() = id) with check (auth.uid() = id);
  end if;
end$$;

-- 2) Harden handle_daily_login against concurrency
create or replace function public.handle_daily_login(user_uuid uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  user_record record;
  today_date date := current_date;
  yesterday_date date := current_date - interval '1 day';
  streak_day integer := 1;
  coins_to_award integer := 10;
  inserted record;
  existing record;
begin
  -- Verify user exists
  select * into user_record from public.profiles where id = user_uuid;
  if not found then
    return json_build_object('error','User not found');
  end if;

  -- Compute streak
  if user_record.last_login_date = yesterday_date then
    streak_day := coalesce(user_record.current_streak,0) + 1;
  else
    streak_day := 1;
  end if;

  coins_to_award := least(50, 10 + (streak_day - 1) * 5);

  -- Try insert idempotently; if already present, return already_logged
  with ins as (
    insert into public.daily_streaks (user_id, login_date, coins_earned, streak_day)
    values (user_uuid, today_date, coins_to_award, streak_day)
    on conflict (user_id, login_date) do nothing
    returning user_id, login_date, coins_earned, streak_day
  )
  select * into inserted from ins;

  if inserted is null then
    select user_id, login_date, coins_earned, streak_day
      into existing
      from public.daily_streaks
     where user_id = user_uuid and login_date = today_date;

    return json_build_object(
      'already_logged', true,
      'streak_day', coalesce(existing.streak_day, 1),
      'coins_earned', coalesce(existing.coins_earned, 10)
    );
  end if;

  -- Record coins transaction (alias view maps to coins_transactions)
  insert into public.coins_transactions (user_id, transaction_type, coins_amount, description)
  values (user_uuid, 'daily_login', inserted.coins_earned, 'Daily login streak day ' || inserted.streak_day);

  -- Update profile totals and streak
  update public.profiles
     set current_streak = inserted.streak_day,
         max_streak = greatest(coalesce(max_streak,0), inserted.streak_day),
         last_login_date = today_date,
         wallet_balance = coalesce(wallet_balance,0) + inserted.coins_earned,
         total_earned = coalesce(total_earned,0) + inserted.coins_earned,
         total_coins = coalesce(total_coins,0) + inserted.coins_earned
   where id = user_uuid;

  return json_build_object(
    'success', true,
    'streak_day', inserted.streak_day,
    'coins_earned', inserted.coins_earned,
    'is_new_login', true
  );
end;
$$;

-- 3) Function grants
revoke all on function public.handle_daily_login(uuid) from public;
grant execute on function public.handle_daily_login(uuid) to authenticated;

-- Ensure referral bonus function is callable by authenticated
revoke all on function public.handle_referral_bonus(uuid, text) from public;
grant execute on function public.handle_referral_bonus(uuid, text) to authenticated;

commit;