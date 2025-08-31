-- Test basic profiles table access
SELECT 
    id, 
    email, 
    username, 
    mobile_number, 
    is_profile_complete,
    created_at
FROM public.profiles 
LIMIT 5;

-- Check table permissions
SELECT 
    schemaname, 
    tablename, 
    tableowner, 
    hasindexes, 
    hasrules, 
    hastriggers 
FROM pg_tables 
WHERE tablename = 'profiles';

-- Check RLS status
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';