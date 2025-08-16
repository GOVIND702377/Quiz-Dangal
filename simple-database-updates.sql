-- ========================================================================
-- QUIZ DANGAL - SIMPLE DATABASE UPDATES
-- Run this in Supabase SQL Editor (Step by Step)
-- ========================================================================

-- STEP 1: ADD MISSING COLUMNS
ALTER TABLE user_answers ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE quiz_participants ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE quiz_participants ADD COLUMN IF NOT EXISTS rank INTEGER;
ALTER TABLE quiz_participants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'joined';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS prizes JSONB DEFAULT '[]';

-- STEP 2: CREATE SAMPLE QUIZ
INSERT INTO quizzes (
    title,
    entry_fee,
    prize_pool,
    prizes,
    start_time,
    end_time,
    result_time,
    status
) VALUES (
    'Daily Opinion Quiz - Evening',
    11.00,
    453.00,
    '[251, 151, 51]'::jsonb,
    CURRENT_DATE + INTERVAL '20 hours 45 minutes',
    CURRENT_DATE + INTERVAL '20 hours 50 minutes', 
    CURRENT_DATE + INTERVAL '20 hours 51 minutes',
    'upcoming'
);

-- STEP 3: GET QUIZ ID (Run this separately to get the quiz ID)
SELECT id, title FROM quizzes WHERE title = 'Daily Opinion Quiz - Evening';