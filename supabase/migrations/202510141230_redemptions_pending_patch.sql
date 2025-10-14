-- Migration: Patch legacy immediate-approval flow to pending workflow + add reject refund
-- Safe to re-run (idempotent): uses CREATE OR REPLACE. Run with: supabase db push or paste into SQL editor.

-- 1. Patch legacy redeem_from_catalog to create PENDING instead of APPROVED
CREATE OR REPLACE FUNCTION public.redeem_from_catalog(p_catalog_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_price integer;
  v_type text;
  v_value text;
  v_active boolean;
  v_balance numeric;
  v_row public.redemptions%rowtype;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode='28000';
  END IF;

  SELECT rc.coins_required, rc.reward_type, rc.reward_value, rc.is_active
    INTO v_price, v_type, v_value, v_active
  FROM public.reward_catalog rc
  WHERE rc.id = p_catalog_id;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'invalid reward' USING errcode='22023';
  END IF;
  IF NOT COALESCE(v_active,FALSE) THEN
    RAISE EXCEPTION 'reward not active' USING errcode='22023';
  END IF;
  IF v_price IS NULL OR v_price <= 0 THEN
    RAISE EXCEPTION 'invalid price' USING errcode='22023';
  END IF;

  SELECT wallet_balance INTO v_balance
  FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF v_balance IS NULL THEN v_balance := 0; END IF;
  IF v_balance < v_price THEN
    RAISE EXCEPTION 'insufficient balance' USING errcode='22023';
  END IF;

  -- Insert PENDING redemption (processed_at stays NULL until approval/rejection)
  INSERT INTO public.redemptions(
    user_id, reward_type, reward_value, coins_required, status, requested_at, catalog_id
  ) VALUES (
    v_user, v_type, v_value, v_price, 'pending', NOW(), p_catalog_id
  ) RETURNING * INTO v_row;

  -- Debit immediately to reserve coins
  INSERT INTO public.transactions(user_id,type,amount,status,reference_id,description)
  VALUES (v_user,'debit',v_price,'success',v_row.id, CONCAT('Pending redemption: ', v_type,' - ',v_value));

  RETURN jsonb_build_object(
    'ok', TRUE,
    'redemption_id', v_row.id,
    'status', v_row.status,
    'coins_charged', v_price,
    'reward_type', v_type,
    'reward_value', v_value
  );
END;
$$;

-- 2. Patch approve_redemption to enforce pending check + set approved_at
CREATE OR REPLACE FUNCTION public.approve_redemption(p_redemption_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_exists uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING errcode='42501';
  END IF;

  SELECT id INTO v_exists FROM public.redemptions WHERE id = p_redemption_id AND status='pending' FOR UPDATE;
  IF v_exists IS NULL THEN
    RAISE EXCEPTION 'not pending or missing' USING errcode='22023';
  END IF;

  UPDATE public.redemptions
    SET status='approved', processed_at=NOW(), approved_at = NOW()
  WHERE id = p_redemption_id;

  RETURN 'Redemption Approved';
END;
$$;

-- 3. Add admin_reject_redemption with refund (legacy reject_redemption lacked refund)
CREATE OR REPLACE FUNCTION public.admin_reject_redemption(p_redemption_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_user uuid;
  v_price integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING errcode='42501';
  END IF;
  IF coalesce(trim(p_reason),'') = '' THEN
    RAISE EXCEPTION 'reject reason required' USING errcode='22023';
  END IF;

  SELECT user_id, coins_required INTO v_user, v_price
  FROM public.redemptions WHERE id = p_redemption_id AND status='pending' FOR UPDATE;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not pending or missing' USING errcode='22023';
  END IF;

  UPDATE public.redemptions
    SET status='rejected', processed_at=NOW(), reject_reason=p_reason
  WHERE id = p_redemption_id;

  -- Refund coins
  INSERT INTO public.transactions(user_id,type,amount,status,reference_id,description)
  VALUES (v_user,'credit',v_price,'success',p_redemption_id,CONCAT('Refund (rejected redemption) ', p_redemption_id));
END;
$$;

-- 4. Grants (adjust roles as needed)
GRANT EXECUTE ON FUNCTION public.redeem_from_catalog(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_redemption(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_redemption(uuid,text) TO authenticated;

-- 5. (Optional) Keep old reject_redemption for backwards compatibility but discourage use
COMMENT ON FUNCTION public.reject_redemption(uuid,text) IS 'Deprecated: use admin_reject_redemption for refund + validation.';

-- 6. Ensure status column default is pending (idempotent)
ALTER TABLE public.redemptions ALTER COLUMN status SET DEFAULT 'pending';

-- 7. Sanity check: no row should be approved without approved_at; backfill
UPDATE public.redemptions SET approved_at = processed_at
WHERE status='approved' AND approved_at IS NULL;

-- 8. NOTE: Frontend should now expect pending first even if legacy redeem_from_catalog called.
