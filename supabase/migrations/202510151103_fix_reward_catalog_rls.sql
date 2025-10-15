-- Fix reward_catalog RLS policies and simplify reward types

-- Temporarily disable trigger if it exists
DROP TRIGGER IF EXISTS trg_reward_catalog_updated_at ON public.reward_catalog;

-- First, drop existing policies
DROP POLICY IF EXISTS "reward_catalog_select" ON public.reward_catalog;
DROP POLICY IF EXISTS "reward_catalog_admin_upd" ON public.reward_catalog;
DROP POLICY IF EXISTS "reward_catalog_admin_ins" ON public.reward_catalog;
DROP POLICY IF EXISTS "reward_catalog_admin_del" ON public.reward_catalog;

-- Ensure RLS is enabled
ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;

-- Create new simplified policies
-- 1. Public can view only active rewards
CREATE POLICY "Public view active rewards"
  ON public.reward_catalog
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 2. Admins can view all rewards
CREATE POLICY "Admins view all rewards"
  ON public.reward_catalog
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 3. Admins can insert rewards
CREATE POLICY "Admins insert rewards"
  ON public.reward_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- 4. Admins can update rewards
CREATE POLICY "Admins update rewards"
  ON public.reward_catalog
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. Admins can delete rewards
CREATE POLICY "Admins delete rewards"
  ON public.reward_catalog
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Update existing rewards to use new types FIRST (map old types to new)
UPDATE public.reward_catalog
SET reward_type = CASE
  WHEN reward_type IN ('coins', 'money') THEN 'cash'
  WHEN reward_type IN ('other') THEN 'voucher'
  ELSE reward_type
END
WHERE reward_type NOT IN ('cash', 'voucher');

-- Now add constraint to limit reward types to only 'cash' and 'voucher'
ALTER TABLE public.reward_catalog
  DROP CONSTRAINT IF EXISTS chk_reward_type_allowed;

ALTER TABLE public.reward_catalog
  ADD CONSTRAINT chk_reward_type_allowed 
  CHECK (reward_type IN ('cash', 'voucher'));

COMMENT ON COLUMN public.reward_catalog.reward_type IS 'Type of reward: cash (UPI/Phone) or voucher (WhatsApp)';

-- Recreate trigger if needed (but reward_catalog doesn't have updated_at column, so skip it)
