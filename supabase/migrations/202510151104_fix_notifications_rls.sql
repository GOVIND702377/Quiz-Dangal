-- Fix notifications RLS policies so admins can send notifications

-- Drop existing policies
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_admin_upd" ON public.notifications;
DROP POLICY IF EXISTS "notifications_admin_ins" ON public.notifications;
DROP POLICY IF EXISTS "notifications_admin_del" ON public.notifications;

-- Ensure RLS is enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create new policies
-- 1. Everyone can read notifications
CREATE POLICY "Everyone read notifications"
  ON public.notifications
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. Admins can insert notifications
CREATE POLICY "Admins insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- 3. Admins can update notifications
CREATE POLICY "Admins update notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Admins can delete notifications
CREATE POLICY "Admins delete notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
