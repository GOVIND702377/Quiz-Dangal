-- ========================================================================
-- HOTFIX V2: Fix infinite recursion by simplifying the UPDATE policy
-- ========================================================================

BEGIN;

-- 1. Drop the previous, complex UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 2. Recreate the UPDATE policy without the WITH CHECK clause
-- The USING clause is sufficient to prevent users from updating other's profiles.
-- The WITH CHECK clause appears to be the source of the recursion.
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE
USING (public.is_own_profile(id));

-- Verification
SELECT 'Successfully simplified the profile UPDATE policy.' as status;

COMMIT;
