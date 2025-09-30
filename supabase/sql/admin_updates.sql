-- Fresh, idempotent admin updates: free entry, categories, reward catalog, notifications, and canonical RLS
-- Safe to re-run. It first removes existing policies on target tables, then recreates a single set of lint-safe ones.

-- 1) Quizzes: make entry free by default and add category with allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quizzes' AND column_name='category'
  ) THEN
    ALTER TABLE public.quizzes ADD COLUMN category text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quizzes' AND column_name='entry_fee'
  ) THEN
    ALTER TABLE public.quizzes ALTER COLUMN entry_fee DROP NOT NULL;
    ALTER TABLE public.quizzes ALTER COLUMN entry_fee SET DEFAULT 0;
    UPDATE public.quizzes SET entry_fee = 0 WHERE entry_fee IS NULL;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_category_allowed'
  ) THEN
    ALTER TABLE public.quizzes
      ADD CONSTRAINT quizzes_category_allowed CHECK (
        category IS NULL OR category IN ('opinion','gk','movies','sports')
      );
  END IF;
END$$;

-- 2) Reward Catalog table for redemptions (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reward_catalog'
  ) THEN
    CREATE TABLE public.reward_catalog (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      description text,
      image_url text,
      coins_required integer NOT NULL CHECK (coins_required >= 0),
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END$$;

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reward_catalog_updated_at'
  ) THEN
    CREATE TRIGGER trg_reward_catalog_updated_at
      BEFORE UPDATE ON public.reward_catalog
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- 3) Log to prevent duplicate auto notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='quiz_notification_log'
  ) THEN
    CREATE TABLE public.quiz_notification_log (
      id bigint generated always as identity primary key,
      quiz_id uuid NOT NULL,
      type text NOT NULL CHECK (type IN ('start_soon','result')),
      sent_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
  CREATE INDEX IF NOT EXISTS idx_qnlog_quiz_type ON public.quiz_notification_log(quiz_id, type);
END$$;

-- 4) Helper: admin check
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.role = 'admin');
$$;

-- 5) Canonical RLS: drop all policies on target tables, then recreate a single clean set
DO $$
DECLARE
  t text;
  r record;
BEGIN
  -- List of tables we manage policies for
  FOR t IN SELECT unnest(ARRAY['quizzes','questions','options','reward_catalog','quiz_notification_log','notifications']) LOOP
    -- Enable RLS
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXCEPTION WHEN others THEN NULL; END;

    -- Drop ALL existing policies to avoid duplicates and linter warnings
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      BEGIN
        EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, t);
      EXCEPTION WHEN others THEN NULL; END;
    END LOOP;
  END LOOP;

  -- quizzes: open read; admin writes
  EXECUTE 'CREATE POLICY quizzes_select ON public.quizzes FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY quizzes_admin_ins ON public.quizzes FOR INSERT TO authenticated WITH CHECK (public.is_admin((SELECT auth.uid())))';
  EXECUTE 'CREATE POLICY quizzes_admin_upd ON public.quizzes FOR UPDATE TO authenticated USING (public.is_admin((SELECT auth.uid()))) WITH CHECK (public.is_admin((SELECT auth.uid())))';
  EXECUTE 'CREATE POLICY quizzes_admin_del ON public.quizzes FOR DELETE TO authenticated USING (public.is_admin((SELECT auth.uid())))';

  -- questions: open read; admin writes
  EXECUTE 'CREATE POLICY questions_select ON public.questions FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY questions_admin_ins ON public.questions FOR INSERT TO authenticated WITH CHECK (public.is_admin((SELECT auth.uid())))';
  EXECUTE 'CREATE POLICY questions_admin_upd ON public.questions FOR UPDATE TO authenticated USING (public.is_admin((SELECT auth.uid()))) WITH CHECK (public.is_admin((SELECT auth.uid())))';
  EXECUTE 'CREATE POLICY questions_admin_del ON public.questions FOR DELETE TO authenticated USING (public.is_admin((SELECT auth.uid())))';

  -- options: open read; admin writes
  EXECUTE 'CREATE POLICY options_select ON public.options FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY options_admin_ins ON public.options FOR INSERT TO authenticated WITH CHECK (public.is_admin((SELECT auth.uid())))';
  EXECUTE 'CREATE POLICY options_admin_upd ON public.options FOR UPDATE TO authenticated USING (public.is_admin((SELECT auth.uid()))) WITH CHECK (public.is_admin((SELECT auth.uid())))';
  EXECUTE 'CREATE POLICY options_admin_del ON public.options FOR DELETE TO authenticated USING (public.is_admin((SELECT auth.uid())))';

  -- reward_catalog: open read; admin writes
  EXECUTE 'CREATE POLICY reward_catalog_select ON public.reward_catalog FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY reward_catalog_admin_ins ON public.reward_catalog FOR INSERT TO authenticated WITH CHECK (public.is_admin((SELECT auth.uid())))';
  EXECUTE 'CREATE POLICY reward_catalog_admin_upd ON public.reward_catalog FOR UPDATE TO authenticated USING (public.is_admin((SELECT auth.uid()))) WITH CHECK (public.is_admin((SELECT auth.uid())))';
  EXECUTE 'CREATE POLICY reward_catalog_admin_del ON public.reward_catalog FOR DELETE TO authenticated USING (public.is_admin((SELECT auth.uid())))';

  -- quiz_notification_log: admin-only for all operations
  EXECUTE 'CREATE POLICY quiz_notification_log_admin_all ON public.quiz_notification_log FOR ALL TO authenticated USING (public.is_admin((SELECT auth.uid()))) WITH CHECK (public.is_admin((SELECT auth.uid())))';

  -- notifications: open read; admin writes
  EXECUTE 'CREATE POLICY notifications_select ON public.notifications FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY notifications_admin_ins ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_admin((SELECT auth.uid())))';
  EXECUTE 'CREATE POLICY notifications_admin_upd ON public.notifications FOR UPDATE TO authenticated USING (public.is_admin((SELECT auth.uid()))) WITH CHECK (public.is_admin((SELECT auth.uid())))';
  EXECUTE 'CREATE POLICY notifications_admin_del ON public.notifications FOR DELETE TO authenticated USING (public.is_admin((SELECT auth.uid())))';
END$$;

-- 6) RPC: create_notification (admin only)
-- If an existing create_notification with same args has different return type, drop it first to avoid 42P13
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_notification'
      AND oidvectortypes(p.proargtypes) = 'text,text,text,uuid,timestamp with time zone'
      AND format_type(p.prorettype, NULL) <> 'uuid'
  ) THEN
    EXECUTE 'DROP FUNCTION public.create_notification(text, text, text, uuid, timestamp with time zone)';
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_title text,
  p_message text,
  p_type text,
  p_quiz_id uuid DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
  nid uuid;
BEGIN
  SELECT public.is_admin((SELECT auth.uid())) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.notifications(id, title, message, type, quiz_id, scheduled_at)
  VALUES (gen_random_uuid(), p_title, p_message, p_type, p_quiz_id, p_scheduled_at)
  RETURNING id INTO nid;
  RETURN nid;
END;
$$;

-- 7) Push subscriptions helpers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='push_subscriptions'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name='push_subscriptions' AND column_name='endpoint' AND table_schema='public'
    ) THEN
      ALTER TABLE public.push_subscriptions ADD COLUMN endpoint text GENERATED ALWAYS AS ((subscription_object->>'endpoint')) STORED;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname='uniq_push_sub_user_endpoint'
    ) THEN
      ALTER TABLE public.push_subscriptions ADD CONSTRAINT uniq_push_sub_user_endpoint UNIQUE (user_id, endpoint);
    END IF;
  END IF;
END$$;
