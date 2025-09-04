-- Create RPC used by Home/Admin to get participant count
create or replace function public.get_participant_count(p_quiz_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
  from public.quiz_participants
  where quiz_id = p_quiz_id;
$$;

revoke all on function public.get_participant_count(uuid) from public;
grant execute on function public.get_participant_count(uuid) to anon, authenticated;

drop view if exists public.v_pending_redemptions cascade;
create view public.v_pending_redemptions as
select
  r.id,
  p.full_name,
  r.reward_type,
  r.reward_value,
  r.coins_required,
  r.requested_at
from public.redemptions r
left join public.profiles p on p.id = r.user_id
where r.status = 'pending';

-- Optional: ensure basic select allowed for admin users (relies on underlying policies)
-- No direct policy on view; it inherits permissions from base tables via RLS.
