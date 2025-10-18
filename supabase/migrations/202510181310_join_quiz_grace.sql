-- Add a small pre-start grace window to reduce join errors near the boundary
-- Allows joining up to 5 seconds before start_time, still requires before end_time

CREATE OR REPLACE FUNCTION public.join_quiz(p_quiz_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_user uuid := coalesce(public.get_my_claim_text('sub')::uuid, auth.uid());
  v_status text;
  v_quiz record;
  v_now timestamptz := now();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select id, start_time, end_time into v_quiz
  from public.quizzes
  where id = p_quiz_id;

  if v_quiz.id is null then
    raise exception 'Quiz not found';
  end if;

  -- Grace join: allow up to 5 seconds before start_time
  if not (
    v_quiz.start_time is not null and v_quiz.end_time is not null
    and v_now >= (v_quiz.start_time - interval '5 seconds') and v_now < v_quiz.end_time
  ) then
    raise exception 'Quiz is not active. Try again in a few seconds.';
  end if;

  select status into v_status
  from public.quiz_participants
  where quiz_id = p_quiz_id and user_id = v_user;

  if v_status = 'completed' then
    raise exception 'You have already completed this quiz';
  end if;

  insert into public.quiz_participants (quiz_id, user_id, status)
  values (p_quiz_id, v_user, 'joined')
  on conflict (quiz_id, user_id)
  do update set status = case
    when public.quiz_participants.status <> 'completed' then 'joined'
    else public.quiz_participants.status
  end;

  return 'Joined';
end;
$$;
