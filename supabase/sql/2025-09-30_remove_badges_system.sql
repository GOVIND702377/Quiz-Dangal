-- Remove Badges System (safe, idempotent)
-- Date: 2025-09-30
-- This migration removes badge-related triggers/functions and the profiles.badges column.
-- It is designed to be safe to run multiple times.

begin;

-- 1) Drop triggers that attempted to award badges (if they exist)
do $$
begin
  if exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'quiz_results' and t.tgname = 'trg_after_quiz_result'
  ) then
    execute 'drop trigger if exists trg_after_quiz_result on public.quiz_results';
  end if;

  if exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'referrals' and t.tgname = 'trg_after_referral'
  ) then
    execute 'drop trigger if exists trg_after_referral on public.referrals';
  end if;
end$$;

-- 2) Drop helper functions that checked/awarded badges (if they exist)
-- Note: These may not exist in your instance; use IF EXISTS.
drop function if exists public.after_quiz_result_check() cascade;
drop function if exists public.after_referral_check() cascade;
drop function if exists public.check_quiz_champion(uuid) cascade;
drop function if exists public.check_referral_king(uuid) cascade;

-- 3) Drop the badges column from profiles (if present)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'badges'
  ) then
    execute 'alter table public.profiles drop column if exists badges';
  end if;
end$$;

commit;
