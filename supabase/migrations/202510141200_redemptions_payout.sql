-- Migration: add payout details & functions for pending redemptions
-- Run with: supabase db push

-- 1. Extend redemptions table with payout detail columns
ALTER TABLE public.redemptions
  ADD COLUMN IF NOT EXISTS payout_identifier text,
  ADD COLUMN IF NOT EXISTS payout_channel text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE OR REPLACE FUNCTION public.redeem_from_catalog_with_details(
  p_catalog_id uuid,
  p_payout_identifier text,
  p_payout_channel text DEFAULT 'upi'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_price integer;
  v_type text;
  v_value text;
  v_active boolean;
  v_balance numeric;
  v_redemption public.redemptions%rowtype;
  v_channel text;
  v_identifier text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '28000';
  END IF;

  v_channel := lower(coalesce(p_payout_channel,'upi'));
  IF v_channel NOT IN ('upi','phone') THEN
    RAISE EXCEPTION 'invalid payout channel' USING errcode = '22023';
  END IF;

  v_identifier := trim(coalesce(p_payout_identifier,''));
  IF length(v_identifier) = 0 THEN
    RAISE EXCEPTION 'payout identifier required' USING errcode = '22023';
  END IF;
  IF v_channel = 'upi' AND position('@' in v_identifier) = 0 THEN
    RAISE EXCEPTION 'invalid UPI id (must contain @)' USING errcode = '22023';
  END IF;
  IF v_channel = 'phone' AND v_identifier !~ '^[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'invalid phone (8-15 digits)' USING errcode = '22023';
  END IF;
  IF v_channel = 'upi' THEN
    v_identifier := lower(v_identifier);
  END IF;

  SELECT rc.coins_required, rc.reward_type, rc.reward_value, rc.is_active
    INTO v_price, v_type, v_value, v_active
  FROM public.reward_catalog rc
  WHERE rc.id = p_catalog_id;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'invalid reward' USING errcode = '22023';
  END IF;
  IF NOT COALESCE(v_active, FALSE) THEN
    RAISE EXCEPTION 'reward not active' USING errcode = '22023';
  END IF;
  IF v_price IS NULL OR v_price <= 0 THEN
    RAISE EXCEPTION 'invalid price' USING errcode = '22023';
  END IF;

  SELECT wallet_balance INTO v_balance
  FROM public.profiles
  WHERE id = v_user
  FOR UPDATE;

  IF v_balance IS NULL THEN v_balance := 0; END IF;
  IF v_balance < v_price THEN
    RAISE EXCEPTION 'insufficient balance' USING errcode = '22023';
  END IF;

  INSERT INTO public.redemptions (
    user_id,
    reward_type,
    reward_value,
    coins_required,
    status,
    requested_at,
    catalog_id,
    payout_identifier,
    payout_channel
  ) VALUES (
    v_user,
    v_type,
    v_value,
    v_price,
    'pending',
    NOW(),
    p_catalog_id,
    v_identifier,
    v_channel
  ) RETURNING * INTO v_redemption;

  INSERT INTO public.transactions (
    user_id, type, amount, status, reference_id, description
  ) VALUES (
    v_user,
    'debit',
    v_price,
    'success',
    v_redemption.id,
    CONCAT('Pending redemption: ', v_type, ' - ', v_value)
  );

  RETURN v_redemption.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_redemption(
  p_redemption_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING errcode = '42501';
  END IF;

  UPDATE public.redemptions
    SET status = 'approved',
        approved_at = NOW(),
        processed_at = NOW()
  WHERE id = p_redemption_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not pending or missing' USING errcode = '22023';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS redemptions_status_requested_at_idx ON public.redemptions(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS redemptions_payout_identifier_idx ON public.redemptions(payout_identifier);
CREATE INDEX IF NOT EXISTS redemptions_payout_channel_idx ON public.redemptions(payout_channel);
CREATE INDEX IF NOT EXISTS redemptions_pending_idx ON public.redemptions(requested_at) WHERE status='pending';

-- Grant execute so PostgREST can expose the RPC (otherwise 404 for anon/auth roles)
GRANT EXECUTE ON FUNCTION public.redeem_from_catalog_with_details(uuid, text, text) TO anon, authenticated;
