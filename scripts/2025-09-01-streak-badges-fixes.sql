begin;

-- Fix daily login function: cap coins at 50, update wallet + totals, run as SECURITY DEFINER
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
    existing_login record;
    result json;
begin
    select * into user_record from public.profiles where id = user_uuid;
    if not found then
        return json_build_object('error','User not found');
    end if;

    select * into existing_login from public.daily_streaks where user_id = user_uuid and login_date = today_date;
    if found then
        return json_build_object(
            'already_logged', true,
            'streak_day', existing_login.streak_day,
            'coins_earned', existing_login.coins_earned
        );
    end if;

    if user_record.last_login_date = yesterday_date then
        streak_day := coalesce(user_record.current_streak,0) + 1;
    else
        streak_day := 1;
    end if;

    coins_to_award := least(50, 10 + (streak_day - 1) * 5);

    insert into public.daily_streaks (id, user_id, login_date, coins_earned, streak_day, created_at)
    values (gen_random_uuid(), user_uuid, today_date, coins_to_award, streak_day, now());

    insert into public.transactions (id, user_id, type, amount, status, created_at)
    values (gen_random_uuid(), user_uuid, 'reward', coins_to_award, 'success', now());

    update public.profiles
    set current_streak = streak_day,
        max_streak = greatest(coalesce(max_streak,0), streak_day),
        last_login_date = today_date,
        wallet_balance = coalesce(wallet_balance,0) + coins_to_award,
        total_earned = coalesce(total_earned,0) + coins_to_award,
        total_coins = coalesce(total_coins,0) + coins_to_award
    where id = user_uuid;

    result := json_build_object(
        'success', true,
        'streak_day', streak_day,
        'coins_earned', coins_to_award,
        'is_new_login', true
    );
    return result;
end;
$$;

revoke all on function public.handle_daily_login(uuid) from public;
grant execute on function public.handle_daily_login(uuid) to authenticated;

-- Make referral bonus function SECURITY DEFINER and update wallet/total
create or replace function public.handle_referral_bonus(referred_user_uuid uuid, referrer_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    referrer_record record;
    result json;
begin
    select * into referrer_record from public.profiles where referral_code = referrer_code and id != referred_user_uuid;
    if not found then
        return json_build_object('error','Invalid referral code');
    end if;

    if exists (select 1 from public.referrals where referrer_id = referrer_record.id and referred_id = referred_user_uuid) then
        return json_build_object('error','Referral already processed');
    end if;

    insert into public.referrals (id, referrer_id, referred_id, referral_code, coins_awarded, created_at)
    values (gen_random_uuid(), referrer_record.id, referred_user_uuid, referrer_code, 50, now());

    insert into public.transactions (id, user_id, type, amount, status, created_at)
    values (gen_random_uuid(), referrer_record.id, 'referral', 50, 'success', now());

    update public.profiles
    set wallet_balance = coalesce(wallet_balance,0) + 50,
        total_earned = coalesce(total_earned,0) + 50,
        total_coins = coalesce(total_coins,0) + 50
    where id = referrer_record.id;

    update public.profiles set referred_by = referrer_record.id where id = referred_user_uuid;

    result := json_build_object('success', true, 'referrer_username', referrer_record.username, 'coins_awarded', 50);
    return result;
end;
$$;

revoke all on function public.handle_referral_bonus(uuid, text) from public;
grant execute on function public.handle_referral_bonus(uuid, text) to authenticated;

-- Ensure badge triggers exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_after_transaction') THEN
    CREATE TRIGGER trg_after_transaction
    AFTER INSERT ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.after_transaction_check();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_after_referral') THEN
    CREATE TRIGGER trg_after_referral
    AFTER INSERT ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.after_referral_check();
  END IF;
END $$;

commit;