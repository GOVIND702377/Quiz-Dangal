-- Fix RLS policies to prevent infinite recursion
-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

-- Create simple, non-recursive policies
CREATE POLICY "Enable read access for users based on user_id" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Enable insert for users based on user_id" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on user_id" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Enable delete for users based on user_id" ON public.profiles
FOR DELETE USING (auth.uid() = id);

-- Also fix any potential issues with referrals table
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can insert referrals" ON public.referrals;

CREATE POLICY "Enable referrals read for users" ON public.referrals
FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Enable referrals insert for users" ON public.referrals
FOR INSERT WITH CHECK (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Ensure admin can access everything
CREATE POLICY "Enable admin full access to profiles" ON public.profiles
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role = 'admin'
    )
);

-- Grant necessary permissions
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.daily_streaks TO authenticated;
GRANT ALL ON public.coins_transactions TO authenticated;
GRANT ALL ON public.referrals TO authenticated;