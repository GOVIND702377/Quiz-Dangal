-- ========================================================================
-- QUIZ DANGAL - ENHANCED DATABASE SETUP FOR USER ONBOARDING & GAMIFICATION
-- Run this in Supabase Dashboard -> SQL Editor
-- ========================================================================

-- 1. UPDATE PROFILES TABLE WITH NEW FIELDS
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS mobile_number TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'hindi',
ADD COLUMN IF NOT EXISTS is_profile_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS total_coins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS wallet_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_date DATE,
ADD COLUMN IF NOT EXISTS streak_month INTEGER DEFAULT EXTRACT(MONTH FROM NOW()),
ADD COLUMN IF NOT EXISTS streak_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS badges TEXT[];

-- 2. CREATE DAILY LOGIN STREAKS TABLE
CREATE TABLE IF NOT EXISTS public.daily_streaks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    login_date DATE NOT NULL,
    coins_earned INTEGER DEFAULT 0,
    streak_day INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, login_date)
);

-- 3. CREATE COINS TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.coins_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL, -- 'daily_login', 'referral_bonus', 'quiz_reward', 'debit'
    coins_amount INTEGER NOT NULL,
    description TEXT,
    reference_id UUID, -- can reference quiz_id, referral_id, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CREATE REFERRALS TABLE
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL,
    coins_awarded INTEGER DEFAULT 50,
    status TEXT DEFAULT 'completed', -- 'pending', 'completed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(referrer_id, referred_id)
);

-- 5. CREATE TRANSACTIONS TABLE (ALIAS FOR COMPATIBILITY)
CREATE OR REPLACE VIEW public.transactions AS
SELECT 
    id,
    user_id,
    transaction_type as type,
    coins_amount as amount,
    description,
    reference_id,
    created_at
FROM public.coins_transactions;

-- 6. CREATE LEADERBOARD VIEWS
CREATE OR REPLACE VIEW public.leaderboard_weekly AS
SELECT 
    p.id,
    p.id as user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.level,
    p.current_streak,
    p.max_streak,
    COALESCE(r.referrals, 0) as referrals,
    COALESCE(weekly_coins.coins_earned, 0) as coins_earned,
    p.badges
FROM public.profiles p
LEFT JOIN (
    SELECT 
        user_id, 
        SUM(coins_amount) as coins_earned
    FROM public.coins_transactions 
    WHERE created_at >= DATE_TRUNC('week', NOW())
    AND coins_amount > 0
    GROUP BY user_id
) weekly_coins ON p.id = weekly_coins.user_id
LEFT JOIN (
    SELECT 
        referrer_id,
        COUNT(*) as referrals
    FROM public.referrals
    WHERE created_at >= DATE_TRUNC('week', NOW())
    GROUP BY referrer_id
) r ON p.id = r.referrer_id
WHERE p.is_profile_complete = TRUE;

CREATE OR REPLACE VIEW public.leaderboard_monthly AS
SELECT 
    p.id,
    p.id as user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.level,
    p.current_streak,
    p.max_streak,
    COALESCE(r.referrals, 0) as referrals,
    COALESCE(monthly_coins.coins_earned, 0) as coins_earned,
    p.badges
FROM public.profiles p
LEFT JOIN (
    SELECT 
        user_id, 
        SUM(coins_amount) as coins_earned
    FROM public.coins_transactions 
    WHERE created_at >= DATE_TRUNC('month', NOW())
    AND coins_amount > 0
    GROUP BY user_id
) monthly_coins ON p.id = monthly_coins.user_id
LEFT JOIN (
    SELECT 
        referrer_id,
        COUNT(*) as referrals
    FROM public.referrals
    WHERE created_at >= DATE_TRUNC('month', NOW())
    GROUP BY referrer_id
) r ON p.id = r.referrer_id
WHERE p.is_profile_complete = TRUE;

CREATE OR REPLACE VIEW public.all_time_leaderboard AS
SELECT 
    p.id,
    p.id as user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.level,
    p.current_streak,
    p.max_streak,
    COALESCE(r.referrals, 0) as referrals,
    p.total_coins as coins_earned,
    p.total_coins as grand_total,
    p.badges
FROM public.profiles p
LEFT JOIN (
    SELECT 
        referrer_id,
        COUNT(*) as referrals
    FROM public.referrals
    GROUP BY referrer_id
) r ON p.id = r.referrer_id
WHERE p.is_profile_complete = TRUE;

-- 6. ENABLE RLS FOR NEW TABLES
ALTER TABLE public.daily_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coins_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES FOR DAILY STREAKS
CREATE POLICY "Users can view own streaks" ON public.daily_streaks
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streaks" ON public.daily_streaks
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. RLS POLICIES FOR COINS TRANSACTIONS
CREATE POLICY "Users can view own coins transactions" ON public.coins_transactions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coins transactions" ON public.coins_transactions
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 9. RLS POLICIES FOR REFERRALS
CREATE POLICY "Users can view own referrals" ON public.referrals
FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users can insert referrals" ON public.referrals
FOR INSERT WITH CHECK (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- 10. FUNCTION TO HANDLE DAILY LOGIN STREAK
CREATE OR REPLACE FUNCTION public.handle_daily_login(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    today_date DATE := CURRENT_DATE;
    yesterday_date DATE := CURRENT_DATE - INTERVAL '1 day';
    current_month INTEGER := EXTRACT(MONTH FROM NOW());
    current_year INTEGER := EXTRACT(YEAR FROM NOW());
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
    
    -- Reset streak if month changed
    IF user_record.streak_month != current_month OR user_record.streak_year != current_year THEN
        UPDATE public.profiles 
        SET current_streak = 0, 
            streak_month = current_month,
            streak_year = current_year
        WHERE id = user_uuid;
        user_record.current_streak := 0;
    END IF;
    
    -- Check if user logged in yesterday
    IF user_record.last_login_date = yesterday_date THEN
        -- Continue streak
        streak_day := user_record.current_streak + 1;
        coins_to_award := 10 + ((streak_day - 1) * 5); -- Day 1: 10, Day 2: 15, Day 3: 20, etc.
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. FUNCTION TO HANDLE REFERRAL BONUS
CREATE OR REPLACE FUNCTION public.handle_referral_bonus(referred_user_uuid UUID, referrer_code TEXT)
RETURNS JSON AS $$
DECLARE
    referrer_record RECORD;
    existing_referral RECORD;
    result JSON;
BEGIN
    -- Find referrer by code
    SELECT * INTO referrer_record FROM public.profiles 
    WHERE referral_code = referrer_code AND id != referred_user_uuid;
    
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Invalid referral code');
    END IF;
    
    -- Check if referral already exists
    SELECT * INTO existing_referral FROM public.referrals 
    WHERE referrer_id = referrer_record.id AND referred_id = referred_user_uuid;
    
    IF FOUND THEN
        RETURN json_build_object('error', 'Referral already processed');
    END IF;
    
    -- Create referral record
    INSERT INTO public.referrals (referrer_id, referred_id, referral_code, coins_awarded)
    VALUES (referrer_record.id, referred_user_uuid, referrer_code, 50);
    
    -- Award coins to referrer
    INSERT INTO public.coins_transactions (user_id, transaction_type, coins_amount, description, reference_id)
    VALUES (referrer_record.id, 'referral_bonus', 50, 'Referral bonus for inviting new user', referred_user_uuid);
    
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. TRIGGER TO GENERATE REFERRAL CODE
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

-- 13. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_total_coins ON public.profiles(total_coins DESC);
CREATE INDEX IF NOT EXISTS idx_daily_streaks_user_date ON public.daily_streaks(user_id, login_date);
CREATE INDEX IF NOT EXISTS idx_coins_transactions_user_id ON public.coins_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coins_transactions_created_at ON public.coins_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);

-- 14. GRANT PERMISSIONS
GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT ON public.leaderboard_weekly TO authenticated;
GRANT SELECT ON public.leaderboard_monthly TO authenticated;
GRANT SELECT ON public.all_time_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_daily_login(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_referral_bonus(UUID, TEXT) TO authenticated;

-- Verification
SELECT 'Enhanced schema setup completed successfully!' as status;