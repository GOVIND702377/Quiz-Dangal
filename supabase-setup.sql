-- ========================================================================
-- QUIZ DANGAL - COMPLETE DATABASE SETUP
-- Supabase Dashboard -> SQL Editor mein ye commands run karein
-- ========================================================================

-- 1. PROFILES TABLE (if not exists)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    phone_number TEXT,
    role TEXT DEFAULT 'user',
    wallet_balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. QUIZ SCHEDULE TABLE
CREATE TABLE IF NOT EXISTS public.quiz_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    entry_fee DECIMAL(10,2) DEFAULT 0.00,
    prize_pool DECIMAL(10,2) DEFAULT 0.00,
    max_participants INTEGER DEFAULT 100,
    current_participants INTEGER DEFAULT 0,
    status TEXT DEFAULT 'upcoming',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. QUIZ PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS public.quiz_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID REFERENCES public.quiz_schedule(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    score INTEGER DEFAULT 0,
    rank INTEGER,
    prize_amount DECIMAL(10,2) DEFAULT 0.00,
    status TEXT DEFAULT 'active',
    UNIQUE(quiz_id, user_id)
);

-- 4. WALLET TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL, -- 'credit', 'debit'
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    quiz_id UUID REFERENCES public.quiz_schedule(id),
    reference_id TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- 6. PROFILES RLS POLICIES
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON public.profiles
FOR DELETE USING (auth.uid() = id);

-- 7. QUIZ SCHEDULE RLS POLICIES
CREATE POLICY "Anyone can view quiz schedule" ON public.quiz_schedule
FOR SELECT USING (true);

CREATE POLICY "Admin can manage quiz schedule" ON public.quiz_schedule
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 8. QUIZ PARTICIPANTS RLS POLICIES
CREATE POLICY "Users can view own participation" ON public.quiz_participants
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can join quizzes" ON public.quiz_participants
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participation" ON public.quiz_participants
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all participations" ON public.quiz_participants
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 9. WALLET TRANSACTIONS RLS POLICIES
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions" ON public.wallet_transactions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all transactions" ON public.wallet_transactions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 10. SAMPLE DATA REMOVED (Do not insert any sample rows in production)

-- 11. CREATE INDEXES FOR BETTER PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_quiz_schedule_start_time ON public.quiz_schedule(start_time);
CREATE INDEX IF NOT EXISTS idx_quiz_participants_user_id ON public.quiz_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_participants_quiz_id ON public.quiz_participants(quiz_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON public.wallet_transactions(created_at);

-- 12. VERIFICATION QUERIES
-- Check if tables were created successfully
SELECT 'profiles' as table_name, COUNT(*) as row_count FROM public.profiles
UNION ALL
SELECT 'quiz_schedule', COUNT(*) FROM public.quiz_schedule
UNION ALL
SELECT 'quiz_participants', COUNT(*) FROM public.quiz_participants
UNION ALL
SELECT 'wallet_transactions', COUNT(*) FROM public.wallet_transactions;
