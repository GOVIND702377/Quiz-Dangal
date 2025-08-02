-- ========================================================================
-- SUPABASE DEBUG QUERIES - ProfileUpdate Issue Diagnosis
-- Run these queries in Supabase SQL Editor to identify the exact problem
-- ========================================================================

-- 1. CHECK PROFILES TABLE STRUCTURE
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- 2. CHECK IF PROFILES TABLE EXISTS
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'profiles'
);

-- 3. CHECK CURRENT USER'S PROFILE DATA
SELECT * FROM profiles 
WHERE id = auth.uid();

-- 4. CHECK RLS POLICIES ON PROFILES TABLE
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 5. CHECK IF RLS IS ENABLED ON PROFILES TABLE
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'profiles';

-- 6. TEST PROFILE SELECT PERMISSION
SELECT 
    'SELECT permission test' as test_type,
    CASE 
        WHEN EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid()) 
        THEN 'SUCCESS: Can select own profile'
        ELSE 'FAILED: Cannot select own profile'
    END as result;

-- 7. TEST PROFILE INSERT PERMISSION (if profile doesn't exist)
-- Note: This will only work if profile doesn't exist
-- INSERT INTO profiles (id, email, full_name, phone_number) 
-- VALUES (auth.uid(), auth.email(), 'Test Name', '1234567890');

-- 8. TEST PROFILE UPDATE PERMISSION
-- UPDATE profiles 
-- SET full_name = 'Test Update', updated_at = now()
-- WHERE id = auth.uid();

-- 9. CHECK AUTH USER DETAILS
SELECT 
    auth.uid() as user_id,
    auth.email() as user_email,
    auth.role() as user_role;

-- 10. CHECK PROFILES TABLE PERMISSIONS
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'profiles';

-- ========================================================================
-- COMMON FIXES FOR PROFILE UPDATE ISSUES
-- ========================================================================

-- FIX 1: Enable RLS on profiles table
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- FIX 2: Create SELECT policy for authenticated users
-- CREATE POLICY "Users can view own profile" ON profiles
--     FOR SELECT USING (auth.uid() = id);

-- FIX 3: Create INSERT policy for authenticated users  
-- CREATE POLICY "Users can insert own profile" ON profiles
--     FOR INSERT WITH CHECK (auth.uid() = id);

-- FIX 4: Create UPDATE policy for authenticated users
-- CREATE POLICY "Users can update own profile" ON profiles
--     FOR UPDATE USING (auth.uid() = id);

-- FIX 5: Create comprehensive policy for all operations
-- CREATE POLICY "Users can manage own profile" ON profiles
--     FOR ALL USING (auth.uid() = id);

-- ========================================================================
-- PROFILES TABLE CREATION (if table doesn't exist)
-- ========================================================================

-- CREATE TABLE IF NOT EXISTS profiles (
--     id UUID REFERENCES auth.users ON DELETE CASCADE,
--     email TEXT,
--     full_name TEXT,
--     phone_number TEXT,
--     wallet_balance INTEGER DEFAULT 0,
--     kyc_status TEXT,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
--     PRIMARY KEY (id)
-- );

-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can manage own profile" ON profiles
--     FOR ALL USING (auth.uid() = id);
