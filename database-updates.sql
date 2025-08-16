-- ========================================================================
-- QUIZ DANGAL - DATABASE UPDATES FOR NEW FEATURES
-- Run this in Supabase SQL Editor
-- ========================================================================

-- 1. ADD MISSING COLUMNS TO EXISTING TABLES
ALTER TABLE user_answers ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE quiz_participants ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE quiz_participants ADD COLUMN IF NOT EXISTS rank INTEGER;
ALTER TABLE quiz_participants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'joined';

-- 2. ADD PRIZES COLUMN TO QUIZZES TABLE (JSON format for multiple prizes)
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS prizes JSONB DEFAULT '[]';

-- 3. CREATE SAMPLE QUIZ DATA
INSERT INTO quizzes (
    id,
    title,
    entry_fee,
    prize_pool,
    prizes,
    start_time,
    end_time,
    result_time,
    status
) VALUES (
    gen_random_uuid(),
    'Daily Opinion Quiz - Evening',
    11.00,
    453.00,
    '[251, 151, 51]'::jsonb,
    CURRENT_DATE + INTERVAL '20 hours 45 minutes',  -- 8:45 PM today
    CURRENT_DATE + INTERVAL '20 hours 50 minutes',  -- 8:50 PM today
    CURRENT_DATE + INTERVAL '20 hours 51 minutes',  -- 8:51 PM today (result)
    'upcoming'
) ON CONFLICT DO NOTHING;

-- 4. CREATE SAMPLE QUESTIONS FOR THE QUIZ
DO $$
DECLARE
    quiz_uuid UUID;
    q1_uuid UUID := gen_random_uuid();
    q2_uuid UUID := gen_random_uuid();
    q3_uuid UUID := gen_random_uuid();
    q4_uuid UUID := gen_random_uuid();
    q5_uuid UUID := gen_random_uuid();
    q6_uuid UUID := gen_random_uuid();
    q7_uuid UUID := gen_random_uuid();
    q8_uuid UUID := gen_random_uuid();
    q9_uuid UUID := gen_random_uuid();
    q10_uuid UUID := gen_random_uuid();
BEGIN
    -- Get the quiz ID
    SELECT id INTO quiz_uuid FROM quizzes WHERE title = 'Daily Opinion Quiz - Evening' LIMIT 1;
    
    IF quiz_uuid IS NOT NULL THEN
        -- Insert 10 sample questions
        INSERT INTO questions (id, quiz_id, question_text) VALUES
        (q1_uuid, quiz_uuid, 'Which is the best social media platform?'),
        (q2_uuid, quiz_uuid, 'What is the most important quality in a friend?'),
        (q3_uuid, quiz_uuid, 'Which season do you prefer the most?'),
        (q4_uuid, quiz_uuid, 'What is the best time to wake up?'),
        (q5_uuid, quiz_uuid, 'Which type of movie do you enjoy most?'),
        (q6_uuid, quiz_uuid, 'What is the most important thing in life?'),
        (q7_uuid, quiz_uuid, 'Which food is better for breakfast?'),
        (q8_uuid, quiz_uuid, 'What is the best way to spend weekends?'),
        (q9_uuid, quiz_uuid, 'Which color makes you feel happy?'),
        (q10_uuid, quiz_uuid, 'What is the most useful invention?');
        
        -- Insert options for each question
        INSERT INTO options (question_id, option_text) VALUES
        -- Q1 options
        (q1_uuid, 'Instagram'),
        (q1_uuid, 'YouTube'),
        (q1_uuid, 'WhatsApp'),
        (q1_uuid, 'Twitter'),
        
        -- Q2 options
        (q2_uuid, 'Loyalty'),
        (q2_uuid, 'Honesty'),
        (q2_uuid, 'Humor'),
        (q2_uuid, 'Support'),
        
        -- Q3 options
        (q3_uuid, 'Summer'),
        (q3_uuid, 'Winter'),
        (q3_uuid, 'Monsoon'),
        (q3_uuid, 'Spring'),
        
        -- Q4 options
        (q4_uuid, '5:00 AM'),
        (q4_uuid, '6:00 AM'),
        (q4_uuid, '7:00 AM'),
        (q4_uuid, '8:00 AM'),
        
        -- Q5 options
        (q5_uuid, 'Action'),
        (q5_uuid, 'Comedy'),
        (q5_uuid, 'Romance'),
        (q5_uuid, 'Thriller'),
        
        -- Q6 options
        (q6_uuid, 'Health'),
        (q6_uuid, 'Family'),
        (q6_uuid, 'Money'),
        (q6_uuid, 'Happiness'),
        
        -- Q7 options
        (q7_uuid, 'Paratha'),
        (q7_uuid, 'Bread Toast'),
        (q7_uuid, 'Poha'),
        (q7_uuid, 'Idli Dosa'),
        
        -- Q8 options
        (q8_uuid, 'Watching Movies'),
        (q8_uuid, 'Going Out'),
        (q8_uuid, 'Sleeping'),
        (q8_uuid, 'Reading'),
        
        -- Q9 options
        (q9_uuid, 'Blue'),
        (q9_uuid, 'Green'),
        (q9_uuid, 'Yellow'),
        (q9_uuid, 'Red'),
        
        -- Q10 options
        (q10_uuid, 'Internet'),
        (q10_uuid, 'Mobile Phone'),
        (q10_uuid, 'Electricity'),
        (q10_uuid, 'Computer');
        
        RAISE NOTICE 'Sample quiz with 10 questions created successfully!';
    END IF;
END $$;

-- 5. CREATE ADMIN USER (Update this with your email)
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'quizdangalofficial@gmail.com';  -- Replace with your admin email

-- If profile doesn't exist, create it manually later

-- 6. VERIFICATION QUERIES
SELECT 'Quiz created:' as info, title, entry_fee, prizes, start_time, end_time 
FROM quizzes WHERE title = 'Daily Opinion Quiz - Evening';

SELECT 'Questions count:' as info, COUNT(*) as total_questions 
FROM questions q 
JOIN quizzes qz ON q.quiz_id = qz.id 
WHERE qz.title = 'Daily Opinion Quiz - Evening';

SELECT 'Options count:' as info, COUNT(*) as total_options 
FROM options o 
JOIN questions q ON o.question_id = q.id 
JOIN quizzes qz ON q.quiz_id = qz.id 
WHERE qz.title = 'Daily Opinion Quiz - Evening';