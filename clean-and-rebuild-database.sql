-- ========================================================================
-- CLEAN AND REBUILD QUIZ DANGAL DATABASE
-- Complete fresh start with only essential features
-- ========================================================================

-- 1. DROP ALL EXISTING TABLES AND POLICIES
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.coins_transactions CASCADE;
DROP TABLE IF EXISTS public.daily_streaks CASCADE;
DROP VIEW IF EXISTS public.leaderboards CASCADE;
DROP FUNCTION IF EXISTS public.handle_daily_login(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.handle_referral_bonus(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.generate_referral_code() CASCADE;

-- 2. CLEAN PROFILES TABLE - Remove all policies and extra columns
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

-- Remove columns that might cause issues
ALTER TABLE public.profiles DROP COLUMN IF EXISTS username CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS mobile_number CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS avatar_url CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS preferred_language CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_profile_complete CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notification_enabled CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS referral_code CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS referred_by CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS total_coins CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS current_streak CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS max_streak CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS last_login_date CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS streak_month CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS streak_year CASCADE;

-- 3. ADD ONLY ESSENTIAL COLUMNS TO PROFILES
ALTER TABLE public.profiles 
ADD COLUMN username TEXT,
ADD COLUMN mobile_number TEXT,
ADD COLUMN avatar_url TEXT,
ADD COLUMN preferred_language TEXT DEFAULT 'hindi',
ADD COLUMN is_profile_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN notification_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN referral_code TEXT,
ADD COLUMN referred_by UUID REFERENCES public.profiles(id),
ADD COLUMN total_coins INTEGER DEFAULT 0,
ADD COLUMN current_streak INTEGER DEFAULT 0,
ADD COLUMN max_streak INTEGER DEFAULT 0,
ADD COLUMN last_login_date DATE;

-- 4. CREATE SIMPLE INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- 5. CREATE DAILY STREAKS TABLE (SIMPLE)
CREATE TABLE public.daily_streaks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    login_date DATE NOT NULL,
    coins_earned INTEGER DEFAULT 0,
    streak_day INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, login_date)
);

-- 6. CREATE COINS TRANSACTIONS TABLE (SIMPLE)
CREATE TABLE public.coins_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    coins_amount INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. CREATE REFERRALS TABLE (SIMPLE)
CREATE TABLE public.referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL,
    coins_awarded INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(referrer_id, referred_id)
);

-- 8. DISABLE RLS ON ALL TABLES (FOR TESTING)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_streaks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coins_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals DISABLE ROW LEVEL SECURITY;

-- 9. GRANT FULL ACCESS TO AUTHENTICATED USERS
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.daily_streaks TO authenticated;
GRANT ALL ON public.coins_transactions TO authenticated;
GRANT ALL ON public.referrals TO authenticated;

-- 10. CREATE SIMPLE DAILY LOGIN FUNCTION
CREATE OR REPLACE FUNCTION public.handle_daily_login(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    today_date DATE := CURRENT_DATE;
    yesterday_date DATE := CURRENT_DATE - INTERVAL '1 day';
    streak_day INTEGER := 1;
    coins_to_award INTEGER := 10;
    existing_login RECORD;
    result JSON;
BEGIN
    -- Get user profile
    SELECT * INTO user_record FROM public.profiles WHERE id = user_uuid;
    
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'User not found');
    END IF;
    
    -- Check if already logged in today
    SELECT * INTO existing_login FROM public.daily_streaks 
    WHERE user_id = user_uuid AND login_date = today_date;
    
    IF FOUND THEN
        RETURN json_build_object(
            'already_logged', true,
            'streak_day', existing_login.streak_day,
            'coins_earned', existing_login.coins_earned
        );
    END IF;
    
    -- Check if user logged in yesterday
    IF user_record.last_login_date = yesterday_date THEN
        -- Continue streak
        streak_day := user_record.current_streak + 1;
        coins_to_award := 10 + ((streak_day - 1) * 5);
    ELSE
        -- Reset streak
        streak_day := 1;
        coins_to_award := 10;
    END IF;
    
    -- Insert daily login record
    INSERT INTO public.daily_streaks (user_id, login_date, coins_earned, streak_day)
    VALUES (user_uuid, today_date, coins_to_award, streak_day);
    
    -- Insert coins transaction
    INSERT INTO public.coins_transactions (user_id, transaction_type, coins_amount, description)
    VALUES (user_uuid, 'daily_login', coins_to_award, 'Daily login streak day ' || streak_day);
    
    -- Update user profile
    UPDATE public.profiles 
    SET 
        current_streak = streak_day,
        max_streak = GREATEST(max_streak, streak_day),
        total_coins = total_coins + coins_to_award,
        last_login_date = today_date
    WHERE id = user_uuid;
    
    result := json_build_object(
        'success', true,
        'streak_day', streak_day,
        'coins_earned', coins_to_award,
        'total_coins', user_record.total_coins + coins_to_award,
        'is_new_login', true
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 11. CREATE SIMPLE REFERRAL FUNCTION
CREATE OR REPLACE FUNCTION public.handle_referral_bonus(referred_user_uuid UUID, referrer_code TEXT)
RETURNS JSON AS $$
DECLARE
    referrer_record RECORD;
    result JSON;
BEGIN
    -- Find referrer by code
    SELECT * INTO referrer_record FROM public.profiles 
    WHERE referral_code = referrer_code AND id != referred_user_uuid;
    
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Invalid referral code');
    END IF;
    
    -- Check if referral already exists
    IF EXISTS (SELECT 1 FROM public.referrals WHERE referrer_id = referrer_record.id AND referred_id = referred_user_uuid) THEN
        RETURN json_build_object('error', 'Referral already processed');
    END IF;
    
    -- Create referral record
    INSERT INTO public.referrals (referrer_id, referred_id, referral_code, coins_awarded)
    VALUES (referrer_record.id, referred_user_uuid, referrer_code, 50);
    
    -- Award coins to referrer
    INSERT INTO public.coins_transactions (user_id, transaction_type, coins_amount, description)
    VALUES (referrer_record.id, 'referral_bonus', 50, 'Referral bonus for inviting new user');
    
    -- Update referrer's total coins
    UPDATE public.profiles 
    SET total_coins = total_coins + 50
    WHERE id = referrer_record.id;
    
    -- Update referred user's referred_by
    UPDATE public.profiles 
    SET referred_by = referrer_record.id
    WHERE id = referred_user_uuid;
    
    result := json_build_object(
        'success', true,
        'referrer_username', referrer_record.username,
        'coins_awarded', 50
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 12. CREATE TRIGGER FOR REFERRAL CODE GENERATION
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 8));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_referral_code
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_referral_code();

-- 13. CREATE SIMPLE LEADERBOARD VIEW
CREATE OR REPLACE VIEW public.leaderboards AS
SELECT 
    p.id,
    p.username,
    p.avatar_url,
    p.total_coins,
    p.current_streak,
    p.max_streak,
    ROW_NUMBER() OVER (ORDER BY p.total_coins DESC, p.created_at ASC) as all_time_rank,
    COALESCE(weekly_coins.coins, 0) as weekly_coins,
    COALESCE(monthly_coins.coins, 0) as monthly_coins
FROM public.profiles p
LEFT JOIN (
    SELECT 
        user_id, 
        SUM(coins_amount) as coins
    FROM public.coins_transactions 
    WHERE created_at >= DATE_TRUNC('week', NOW())
    AND coins_amount > 0
    GROUP BY user_id
) weekly_coins ON p.id = weekly_coins.user_id
LEFT JOIN (
    SELECT 
        user_id, 
        SUM(coins_amount) as coins
    FROM public.coins_transactions 
    WHERE created_at >= DATE_TRUNC('month', NOW())
    AND coins_amount > 0
    GROUP BY user_id
) monthly_coins ON p.id = monthly_coins.user_id
WHERE p.is_profile_complete = TRUE
ORDER BY p.total_coins DESC;

-- 14. GRANT PERMISSIONS ON FUNCTIONS AND VIEWS
GRANT EXECUTE ON FUNCTION public.handle_daily_login(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_referral_bonus(UUID, TEXT) TO authenticated;
GRANT SELECT ON public.leaderboards TO authenticated;

-- 15. SUCCESS MESSAGE
SELECT 'Database cleaned and rebuilt successfully! All tables are now accessible without RLS restrictions.' as status;