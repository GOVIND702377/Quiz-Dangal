-- Enable RLS on reward_catalog table to fix security linter errors
-- The table already has policies but RLS was disabled

ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;
