-- Harden search_path for functions to satisfy SQL linter and ensure deterministic resolution
-- Note: Adjust if your schema names differ. This keeps resolution explicit and avoids pg_catalog shadowing issues.

begin;

-- Ensure set_updated_at and is_admin run with a fixed search_path
-- Use DO blocks to be idempotent across environments

-- set_updated_at
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'set_updated_at'
      AND n.nspname = 'public'
      AND pg_get_function_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'ALTER FUNCTION public.set_updated_at() SET search_path = public';
  END IF;
END $$;

-- is_admin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'is_admin'
      AND n.nspname = 'public'
      AND pg_get_function_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp';
  END IF;
END $$;

commit;
