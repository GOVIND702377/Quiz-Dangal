-- Fix: Make coin awards robust and avoid double-counting profile totals
-- - Adds safety fallback: if prize_type is not 'coins' but numeric prizes exist, still award as coins
-- - Removes redundant manual UPDATE to profiles.total_coins; rely on txn trigger trg_tx_sync_profiles
--
-- Safe to run multiple times (CREATE OR REPLACE FUNCTION)

CREATE OR REPLACE FUNCTION public.award_coin_prizes(p_quiz_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_title       text;
  v_type        text;
  v_lock_key    bigint;
  v_bypass      text;
  v_treat_coins boolean := false;
  v_has_numeric boolean := false;
BEGIN
  v_bypass := current_setting('qd.allow_auto_award', true);

  -- Allow only in auto-award context, or as admin/service (no end-user mass inserts)
  IF NOT public.is_admin() THEN
    IF COALESCE(v_bypass, '0') <> '1' THEN
      IF (SELECT auth.uid()) IS NOT NULL THEN
        RAISE EXCEPTION 'forbidden';
      END IF;
    END IF;
  END IF;

  SELECT prize_type, title
    INTO v_type, v_title
  FROM public.quizzes
  WHERE id = p_quiz_id;

  -- Detect numeric prizes even if prize_type was set incorrectly
  SELECT EXISTS (
           SELECT 1 FROM public.quiz_prizes qp
           WHERE qp.quiz_id = p_quiz_id AND qp.prize_coins > 0
         )
    OR EXISTS (
           SELECT 1
           FROM jsonb_array_elements_text(
                  COALESCE((SELECT q.prizes FROM public.quizzes q WHERE q.id = p_quiz_id), '[]'::jsonb)
                ) AS e(txt)
           WHERE txt ~ '^[0-9]+$' AND length(txt) > 0
         )
    INTO v_has_numeric;

  v_treat_coins := COALESCE(v_type, 'money') = 'coins' OR v_has_numeric;
  IF NOT v_treat_coins THEN
    RETURN; -- nothing to award
  END IF;

  -- Lock per quiz to avoid concurrent dup inserts
  SELECT (('x' || substr(md5(p_quiz_id::text), 1, 16))::bit(64))::bigint
    INTO v_lock_key;
  PERFORM pg_try_advisory_xact_lock(v_lock_key);

  -- Idempotency: if any quiz_reward exists already, stop
  IF EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.reference_id = p_quiz_id
      AND t.type = 'quiz_reward'
  ) THEN
    RETURN;
  END IF;

  -- Prevent re-entrant compute when called from trigger context with bypass flag
  IF COALESCE(v_bypass, '0') = '1' THEN
    -- In auto-award context: skip calling compute_quiz_results to avoid recursion
    RAISE DEBUG 'award_coin_prizes: skipping compute_quiz_results due to qd.allow_auto_award';
  ELSE
    PERFORM public.compute_quiz_results(p_quiz_id);
  END IF;

  WITH lb AS (
    SELECT (elem->>'user_id')::uuid AS user_id,
           (elem->>'rank')::int     AS rk
    FROM public.quiz_results r,
         LATERAL jsonb_array_elements(COALESCE(r.leaderboard,'[]'::jsonb)) elem
    WHERE r.quiz_id = p_quiz_id
  ),
  json_prizes AS (
    SELECT prizes.ord::int AS rank_pos,
           NULLIF(prizes.prize_text, '')::numeric AS amt
    FROM public.quizzes q
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(q.prizes,'[]'::jsonb))
      WITH ORDINALITY AS prizes(prize_text, ord)
    WHERE q.id = p_quiz_id
  ),
  prize_rows AS (
    SELECT rank_from, rank_to, prize_coins::numeric AS amt
    FROM public.quiz_prizes
    WHERE quiz_id = p_quiz_id
      AND prize_coins > 0
    UNION ALL
    SELECT jp.rank_pos, jp.rank_pos, jp.amt
    FROM json_prizes jp
    WHERE jp.amt IS NOT NULL
      AND NOT EXISTS (
            SELECT 1
            FROM public.quiz_prizes
            WHERE quiz_id = p_quiz_id
              AND prize_coins > 0
          )
  ),
  awards AS (
    SELECT lb.user_id,
           prize_rows.amt::int AS amt,
           lb.rk,
           concat('Quiz reward for ', COALESCE(v_title,'quiz'), ' rank #', lb.rk) AS descr
    FROM lb
    JOIN prize_rows
      ON lb.rk BETWEEN prize_rows.rank_from AND prize_rows.rank_to
    WHERE prize_rows.amt > 0
  )
  INSERT INTO public.transactions (user_id, type, amount, status, reference_id, description)
  SELECT a.user_id,
         'quiz_reward',
         a.amt,
         'success',
         p_quiz_id,
         a.descr
  FROM awards a
  ON CONFLICT (user_id, reference_id)
    WHERE (reference_id IS NOT NULL AND type='quiz_reward')
  DO NOTHING;

  -- NOTE: Do not manually UPDATE profiles here. totals are synchronized by trigger:
  --   CREATE TRIGGER trg_tx_sync_profiles AFTER INSERT OR DELETE ON public.transactions
  --   FOR EACH ROW EXECUTE FUNCTION public.trg_tx_sync_profiles();
END;
$$;
