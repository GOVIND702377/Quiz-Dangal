-- Quiz Dangal UI/UX support migration
-- 1) Profiles: username (unique) + avatar_url
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Case-insensitive unique constraint for username
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles ((lower(username)));

COMMENT ON COLUMN public.profiles.username IS 'Public username, unique case-insensitive';
COMMENT ON COLUMN public.profiles.avatar_url IS 'Public URL of avatar image stored in Supabase Storage (avatars bucket)';

-- 2) Quizzes: category support for Home filters (e.g., GK, Sports, Movies, Opinion)
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS idx_quizzes_category ON public.quizzes (category);

COMMENT ON COLUMN public.quizzes.category IS 'Quiz category label (e.g., GK, Sports, Movies, Opinion) used for filtering on Home page';
