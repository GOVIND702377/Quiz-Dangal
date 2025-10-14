-- Migration: notifications_enabled backfill + trigger
-- Run with: supabase db push

UPDATE public.profiles p
SET notifications_enabled = TRUE
WHERE EXISTS (
  SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = p.id
) AND notifications_enabled IS DISTINCT FROM TRUE;

CREATE OR REPLACE FUNCTION public.refresh_notifications_enabled(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE public.profiles p
  SET notifications_enabled = (
    SELECT EXISTS (
      SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = p.id
    )
  )
  WHERE p.id = p_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_push_subscriptions_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.refresh_notifications_enabled(COALESCE(NEW.user_id, OLD.user_id));
  RETURN NULL;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_push_subscriptions_sync' AND tgrelid = 'public.push_subscriptions'::regclass
  ) THEN
    CREATE TRIGGER trg_push_subscriptions_sync
    AFTER INSERT OR DELETE ON public.push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.trg_push_subscriptions_sync();
  END IF;
END $$;

-- Second pass ensure consistency
UPDATE public.profiles p
SET notifications_enabled = TRUE
WHERE EXISTS (
  SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = p.id
) AND notifications_enabled IS DISTINCT FROM TRUE;
