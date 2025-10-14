-- Migration: explicit grants for redemption detail functions
-- Ensures RPC availability (avoid 404 when function exists but no execute privilege)
-- Run: supabase db push

DO $$ BEGIN
  -- Redeem with details
  BEGIN
    GRANT EXECUTE ON FUNCTION public.redeem_from_catalog_with_details(uuid, text, text) TO anon, authenticated;
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'redeem_from_catalog_with_details function not yet created';
  END;

  -- Admin approve legacy name (if present)
  BEGIN
    GRANT EXECUTE ON FUNCTION public.admin_approve_redemption(uuid) TO authenticated;
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'admin_approve_redemption function not yet created';
  END;
END $$;
