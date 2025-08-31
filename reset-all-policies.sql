-- Completely reset all RLS policies for profiles table
-- First disable RLS temporarily
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable admin full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can manage quiz schedule" ON public.profiles;

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create very simple policies without any complex logic
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT USING (true);

CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT WITH CHECK (true);

CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE USING (true);

CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE USING (true);

-- Grant full access to authenticated users for now
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO anon;

-- Also reset other tables that might have issues
ALTER TABLE public.daily_streaks DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own streaks" ON public.daily_streaks;
DROP POLICY IF EXISTS "Users can insert own streaks" ON public.daily_streaks;
ALTER TABLE public.daily_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_streaks_all_policy" ON public.daily_streaks
FOR ALL USING (true);

ALTER TABLE public.coins_transactions DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own coins transactions" ON public.coins_transactions;
DROP POLICY IF EXISTS "Users can insert own coins transactions" ON public.coins_transactions;
ALTER TABLE public.coins_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coins_transactions_all_policy" ON public.coins_transactions
FOR ALL USING (true);

ALTER TABLE public.referrals DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can insert referrals" ON public.referrals;
DROP POLICY IF EXISTS "Enable referrals read for users" ON public.referrals;
DROP POLICY IF EXISTS "Enable referrals insert for users" ON public.referrals;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_all_policy" ON public.referrals
FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON public.daily_streaks TO authenticated;
GRANT ALL ON public.coins_transactions TO authenticated;
GRANT ALL ON public.referrals TO authenticated;