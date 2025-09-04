begin;

-- Create a simple all-time leaderboard based on profiles (no RLS issues)
create or replace view public.all_time_leaderboard as
select
  p.id as user_id,
  p.full_name,
  p.level,
  p.total_earned as grand_total,
  p.total_earned as coins_earned,
  p.current_streak,
  p.badges,
  coalesce((select count(*) from public.referrals r where r.referrer_id = p.id), 0) as referrals
from public.profiles p;

-- Create weekly leaderboard using winners_report if available; fallback to transactions if needed
-- We assume winners_report contains (full_name, coins_earned, rank, period)
create or replace view public.leaderboard_weekly as
select
  p.id as user_id,
  wr.full_name,
  p.level,
  wr.coins_earned,
  coalesce((select count(*) from public.referrals rf where rf.referrer_id = p.id and rf.created_at >= date_trunc('week', now())), 0) as referrals,
  p.current_streak,
  p.badges
from public.winners_report wr
join public.profiles p on p.full_name = wr.full_name
where wr.period = 'weekly';

-- Create monthly leaderboard similarly
create or replace view public.leaderboard_monthly as
select
  p.id as user_id,
  wr.full_name,
  p.level,
  wr.coins_earned,
  coalesce((select count(*) from public.referrals rf where rf.referrer_id = p.id and rf.created_at >= date_trunc('month', now())), 0) as referrals,
  p.current_streak,
  p.badges
from public.winners_report wr
join public.profiles p on p.full_name = wr.full_name
where wr.period = 'monthly';

commit;