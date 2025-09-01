begin;

-- 1) Migrate coins_transactions -> transactions, then drop coins_transactions
-- Safeguard: backup data into a temp table
create temporary table if not exists _ct_backup as table public.coins_transactions with no data;
insert into _ct_backup select * from public.coins_transactions;

-- Insert migrated rows if not already present (match by id)
insert into public.transactions (id, user_id, type, amount, status, created_at)
select
  ct.id,
  ct.user_id,
  case
    when ct.transaction_type in ('daily_login') then 'reward'
    when ct.transaction_type in ('referral_bonus') then 'referral'
    when ct.transaction_type in ('quiz_reward') then 'reward'
    else 'reward'
  end as type,
  ct.coins_amount::numeric,
  'success' as status,
  coalesce(ct.created_at, now()) as created_at
from public.coins_transactions ct
left join public.transactions t on t.id = ct.id
where t.id is null;

-- Drop RLS policies on coins_transactions (if any) and the table itself
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='coins_transactions'
  ) LOOP
    EXECUTE format('drop policy if exists %I on public.coins_transactions', r.policyname);
  END LOOP;
END $$;

drop table if exists public.coins_transactions cascade;

-- 2) Consolidate streaks to daily_streaks: remove user_streaks + dependent trigger/function
-- Drop trigger on user_streaks if exists
DROP TRIGGER IF EXISTS set_updated_at_user_streaks ON public.user_streaks;
-- Drop transactions AFTER INSERT trigger that called update_streak (activity-based)
DROP TRIGGER IF EXISTS trg_after_activity ON public.transactions;
-- Drop functions
DROP FUNCTION IF EXISTS public.update_streak(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.after_activity_check() CASCADE;
-- Drop table (and policies)
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='user_streaks'
  ) LOOP
    EXECUTE format('drop policy if exists %I on public.user_streaks', r.policyname);
  END LOOP;
END $$;
DROP TABLE IF EXISTS public.user_streaks CASCADE;

-- 3) Remove unused admins table
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='admins'
  ) LOOP
    EXECUTE format('drop policy if exists %I on public.admins', r.policyname);
  END LOOP;
END $$;
DROP TABLE IF EXISTS public.admins CASCADE;

-- 4) Streamline duplicate policies
-- user_badges had duplicate select-own policies; keep one and drop the extra if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_badges' AND policyname='Users can select own rows'
  ) THEN
    EXECUTE 'drop policy "Users can select own rows" on public.user_badges';
  END IF;
END $$;

-- 5) Update functions to use consolidated tables
-- handle_daily_login: use daily_streaks + transactions only
create or replace function public.handle_daily_login(user_uuid uuid)
returns json
language plpgsql
set search_path = public
as $$
DECLARE
    user_record RECORD;
    today_date DATE := CURRENT_DATE;
    yesterday_date DATE := CURRENT_DATE - INTERVAL '1 day';
    streak_day INTEGER := 1;
    coins_to_award INTEGER := 10;
    existing_login RECORD;
    result JSON;
BEGIN
    -- Get user profile
    SELECT * INTO user_record FROM public.profiles WHERE id = user_uuid;
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'User not found');
    END IF;

    -- Check if already logged in today
    SELECT * INTO existing_login FROM public.daily_streaks 
    WHERE user_id = user_uuid AND login_date = today_date;
    IF FOUND THEN
        RETURN json_build_object(
            'already_logged', true,
            'streak_day', existing_login.streak_day,
            'coins_earned', existing_login.coins_earned
        );
    END IF;

    -- Continue or reset streak
    IF user_record.last_login_date = yesterday_date THEN
        streak_day := coalesce(user_record.current_streak, 0) + 1;
        coins_to_award := 10 + ((streak_day - 1) * 5);
    ELSE
        streak_day := 1;
        coins_to_award := 10;
    END IF;

    -- Insert daily login record
    INSERT INTO public.daily_streaks (id, user_id, login_date, coins_earned, streak_day, created_at)
    VALUES (gen_random_uuid(), user_uuid, today_date, coins_to_award, streak_day, now());

    -- Insert coins transaction in consolidated transactions table
    INSERT INTO public.transactions (id, user_id, type, amount, status, created_at)
    VALUES (gen_random_uuid(), user_uuid, 'reward', coins_to_award, 'success', now());

    -- Update user profile
    UPDATE public.profiles 
    SET 
        current_streak = streak_day,
        max_streak = GREATEST(coalesce(max_streak, 0), streak_day),
        total_coins = coalesce(total_coins, 0) + coins_to_award,
        last_login_date = today_date
    WHERE id = user_uuid;

    result := json_build_object(
        'success', true,
        'streak_day', streak_day,
        'coins_earned', coins_to_award,
        'total_coins', coalesce(user_record.total_coins, 0) + coins_to_award,
        'is_new_login', true
    );
    RETURN result;
END;
$$;

-- handle_referral_bonus: use referrals + transactions only
create or replace function public.handle_referral_bonus(referred_user_uuid uuid, referrer_code text)
returns json
language plpgsql
set search_path = public
as $$
DECLARE
    referrer_record RECORD;
    result JSON;
BEGIN
    -- Find referrer by code
    SELECT * INTO referrer_record FROM public.profiles 
    WHERE referral_code = referrer_code AND id != referred_user_uuid;
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Invalid referral code');
    END IF;

    -- Check if referral already exists
    IF EXISTS (SELECT 1 FROM public.referrals WHERE referrer_id = referrer_record.id AND referred_id = referred_user_uuid) THEN
        RETURN json_build_object('error', 'Referral already processed');
    END IF;

    -- Create referral record
    INSERT INTO public.referrals (id, referrer_id, referred_id, referral_code, coins_awarded, created_at)
    VALUES (gen_random_uuid(), referrer_record.id, referred_user_uuid, referrer_code, 50, now());

    -- Award coins to referrer in consolidated transactions table
    INSERT INTO public.transactions (id, user_id, type, amount, status, created_at)
    VALUES (gen_random_uuid(), referrer_record.id, 'referral', 50, 'success', now());

    -- Update referrer's total coins
    UPDATE public.profiles 
    SET total_coins = coalesce(total_coins, 0) + 50
    WHERE id = referrer_record.id;

    -- Update referred user's referred_by
    UPDATE public.profiles 
    SET referred_by = referrer_record.id
    WHERE id = referred_user_uuid;

    result := json_build_object(
        'success', true,
        'referrer_username', referrer_record.username,
        'coins_awarded', 50
    );
    RETURN result;
END;
$$;

-- 6) Drop legacy leaderboard view (if present) to avoid confusion
DROP VIEW IF EXISTS public.leaderboards CASCADE;

commit;