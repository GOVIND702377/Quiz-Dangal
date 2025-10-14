-- Updated: Only drop the redemptions trigger. Do NOT drop set_updated_at() because it is shared by many tables.
DROP TRIGGER IF EXISTS trg_redemptions_updated_at ON public.redemptions;
-- NOTE: set_updated_at() retained intentionally. Other tables depend on it.
