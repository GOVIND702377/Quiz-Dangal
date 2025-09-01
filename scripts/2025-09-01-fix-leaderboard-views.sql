begin;

-- Rebuild weekly/monthly leaderboard views with per-user aggregation and grant read access

create or replace view public.leaderboard_weekly as
with agg as (
  select wr.full_name, sum(wr.coins_earned)::numeric as coins_earned
  from public.winners_report wr
  where wr.period = 'weekly'
  group by wr.full_name
)
select
  p.id as user_id,
  p.full_name,
  p.level,
  a.coins_earned,
  coalesce((select count(*) from public.referrals rf where rf.referrer_id = p.id and rf.created_at >= date_trunc('week', now())), 0) as referrals,
  p.current_streak,
  p.badges
from agg a
join public.profiles p on p.full_name = a.full_name;

create or replace view public.leaderboard_monthly as
with agg as (
  select wr.full_name, sum(wr.coins_earned)::numeric as coins_earned
  from public.winners_report wr
  where wr.period = 'monthly'
  group by wr.full_name
)
select
  p.id as user_id,
  p.full_name,
  p.level,
  a.coins_earned,
  coalesce((select count(*) from public.referrals rf where rf.referrer_id = p.id and rf.created_at >= date_trunc('month', now())), 0) as referrals,
  p.current_streak,
  p.badges
from agg a
join public.profiles p on p.full_name = a.full_name;

-- Ensure public read for app (anon/authenticated)
grant select on public.all_time_leaderboard to anon, authenticated;
grant select on public.leaderboard_weekly to anon, authenticated;
grant select on public.leaderboard_monthly to anon, authenticated;

commit;