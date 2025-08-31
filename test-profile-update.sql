-- Test profile update functionality
-- Check current profiles
SELECT 
    id, 
    email, 
    username, 
    mobile_number, 
    is_profile_complete,
    preferred_language,
    notification_enabled,
    total_coins,
    current_streak
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 5;

-- Test update (replace with actual user ID)
-- UPDATE public.profiles 
-- SET 
--     username = 'testuser123',
--     mobile_number = '9876543210',
--     is_profile_complete = true
-- WHERE email = 'your-email@example.com';

-- Check if update worked
-- SELECT * FROM public.profiles WHERE email = 'your-email@example.com';