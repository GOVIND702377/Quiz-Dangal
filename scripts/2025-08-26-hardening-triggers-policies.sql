-- Quiz Dangal: DB hardening (triggers, policies, columns, defaults, checks)
-- Date: 2025-08-26
-- Safe/idempotent: can run multiple times

BEGIN;

-- 1) Transactions: remove duplicate trigger and create guarded 'activity' trigger (correct WHEN position)
DROP TRIGGER IF EXISTS trg_after_transaction ON public.transactions;
DROP TRIGGER IF EXISTS trg_after_activity ON public.transactions;

CREATE TRIGGER trg_after_activity
AFTER INSERT ON public.transactions
FOR EACH ROW
WHEN (NEW.type = 'activity')
EXECUTE FUNCTION public.after_activity_check();

-- 2) Transactions policies: remove over-permissive insert; add admin/service manage
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.transactions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='transactions' AND policyname='Transactions: service_role manage'
  ) THEN
    CREATE POLICY "Transactions: service_role manage"
    ON public.transactions
    FOR ALL TO public
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='transactions' AND policyname='Transactions: admin manage'
  ) THEN
    CREATE POLICY "Transactions: admin manage"
    ON public.transactions
    FOR ALL TO public
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END$$;

-- 3) Quiz participants: remove over-permissive insert (self-insert policies already exist)
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.quiz_participants;

-- 4) User answers: remove over-permissive insert; ensure self-insert policy exists
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.user_answers;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_answers' AND policyname='User answers: insert own'
  ) THEN
    CREATE POLICY "User answers: insert own"
    ON public.user_answers
    FOR INSERT TO public
    WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

-- 5) set_updated_at() triggers require updated_at; add if missing on options & questions
ALTER TABLE public.options   ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 6) Ensure default for transactions.created_at
ALTER TABLE public.transactions
  ALTER COLUMN created_at SET DEFAULT now();

-- 7) Enforce transactions.type whitelist (includes 'activity')
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_type_check') THEN
    ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('credit','debit','purchase','reward','refund','bonus','referral','activity')) NOT VALID;
  END IF;
END$$;

-- 8) Optional: service_role manage user_badges (backend jobs/cron)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_badges' AND policyname='User badges: service_role manage'
  ) THEN
    CREATE POLICY "User badges: service_role manage"
    ON public.user_badges
    FOR ALL TO public
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;

COMMIT;

-- Post-run (manual, optional):
-- 1) Validate constraint once legacy rows are clean
--    ALTER TABLE public.transactions VALIDATE CONSTRAINT transactions_type_check;
-- 2) Optionally make updated_at/created_at NOT NULL after backfilling
-- 3) Refresh materialized views or schedule via pg_cron
